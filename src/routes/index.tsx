import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SetupScreen } from "@/components/game/SetupScreen";
import { CATEGORIES, type CategoryId } from "@/lib/cards";
import { buildPlayPool, type PlayCard } from "@/lib/playcards";
import { useWakeLock } from "@/hooks/use-wake-lock";
import {
  aggregateScores,
  applyAction,
  buildTurnOrder,
  createPromptDeck,
  emptyStats,
  fireBonus,
  isFireMode,
  isQuickCallUnlocked,
  isStreakMilestone,
  recap,
  shareText,
  type CardLogEntry,
  formatClock,
  gestureToAction,
  shuffleWith,
  winners,
  type Action,
  type Turn,
  type TurnResult,
  type TurnStats,
  stepCountdown,
  stepRoundClock,
} from "@/lib/game";
import { loadPrefs, savePrefs, DEFAULT_PREFS, type Prefs } from "@/lib/prefs";
import {
  buzzer,
  countdownBeep,
  fanfare,
  gotItSound,
  heartbeat,
  isMuted,
  revealChime,
  setMuted,
  setMusicEnabled,
  setMusicIntensity,
  setSfxEnabled,
  setVolume,
  lastTenBeep,
  skipSound,
  startMusic,
  stopMusic,
  tick,
  unlockAudio,
} from "@/lib/audio";
import {
  loadRoster,
  loadSelection,
  newPlayer,
  saveRoster,
  saveSelection,
  type Player,
} from "@/lib/players";
import { useTiltControls } from "@/hooks/use-tilt-controls";
import { useFullscreen, useIsLandscape } from "@/hooks/use-fullscreen";
import {
  hapticGotIt,
  hapticPass,
  hapticSkip,
  hapticTimeUp,
  hapticTick,
  hapticWin,
  setHapticsEnabled,
} from "@/lib/haptics";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sound It! — The Pass-the-Phone Party Game" },
      {
        name: "description",
        content:
          "Sound It! is a loud, fast party game for one phone. Make the sound, act it out, and get your friends to guess before the buzzer.",
      },
      { property: "og:title", content: "Sound It! — The Pass-the-Phone Party Game" },
      {
        property: "og:description",
        content:
          "Make the sound, act it out, guess it fast. A fast party game for one phone and a whole room.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SoundItGame,
});

type Phase = "setup" | "announce" | "countdown" | "play" | "summary" | "final";

const CARD_COLORS = [
  "var(--color-card-yellow)",
  "var(--color-card-purple)",
  "var(--color-card-blue)",
  "var(--color-card-lime)",
  "var(--color-card-pink)",
  "var(--color-card-orange)",
];
const DARK_TEXT_ON = [0, 3]; // yellow, lime
const PRESSURE_SECONDS = 15; // psychological pressure phase length
const COUNTDOWN_FROM = 5;

function promptSize(prompt: string, landscape: boolean) {
  const n = prompt.length;
  if (landscape) {
    if (n <= 12) return "text-[17vh] leading-[0.9]";
    if (n <= 20) return "text-[13vh] leading-[0.92]";
    if (n <= 32) return "text-[10vh] leading-[0.95]";
    return "text-[8vh] leading-[1]";
  }
  if (n <= 12) return "text-[20vw] leading-[0.88]";
  if (n <= 20) return "text-[15vw] leading-[0.9]";
  if (n <= 32) return "text-[11.5vw] leading-[0.95]";
  return "text-[9vw] leading-[1]";
}

function SoundItGame() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [categories, setCategories] = useState<CategoryId[]>(CATEGORIES.map((c) => c.id));
  const [phase, setPhase] = useState<Phase>("setup");
  const [paused, setPaused] = useState(false);
  const [muted, setMutedState] = useState(false);

  const [turns, setTurns] = useState<Turn<Player>[]>([]);
  const [turnIndex, setTurnIndex] = useState(0);
  const [results, setResults] = useState<TurnResult[]>([]);

  const deckRef = useRef<ReturnType<typeof createPromptDeck<PlayCard>> | null>(null);
  const [card, setCard] = useState<PlayCard | null>(null);
  const [bonus, setBonus] = useState(0);
  const [log, setLog] = useState<CardLogEntry[]>([]);
  const cardShownAt = useRef(0);
  const fireRef = useRef(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [exit, setExit] = useState<Action | null>(null);
  const [stamp, setStamp] = useState<string | null>(null);
  const [fx, setFx] = useState<{ kind: Action; id: number; burst?: boolean } | null>(null);
  const [actionFeedback, setActionFeedback] = useState<Action | null>(null);
  const actionFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [countValue, setCountValue] = useState(COUNTDOWN_FROM);
  const countRef = useRef(COUNTDOWN_FROM);
  const [secondsLeft, setSecondsLeft] = useState<number>(DEFAULT_PREFS.roundSeconds);
  const leftRef = useRef<number>(DEFAULT_PREFS.roundSeconds);
  const [stats, setStats] = useState<TurnStats>(emptyStats());
  const lockRef = useRef(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fullscreen = useFullscreen();
  const landscape = useIsLandscape();

  /* ---------- load durable local data ---------- */
  useEffect(() => {
    const roster = loadRoster();
    setPlayers(roster);
    const sel = loadSelection().filter((id) => roster.some((p) => p.id === id));
    setSelected(sel.length ? sel : roster.map((p) => p.id));
    setPrefsState(loadPrefs());
    setMutedState(isMuted());
  }, []);

  useEffect(() => {
    setMusicEnabled(prefs.music);
    setSfxEnabled(prefs.sfx);
    setHapticsEnabled(prefs.haptics);
    setVolume(prefs.volume / 100);
  }, [prefs.music, prefs.sfx, prefs.haptics, prefs.volume]);

  const setPrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefsState((p) => {
      const next = { ...p, ...patch };
      savePrefs(next);
      return next;
    });
  }, []);

  const updatePlayers = useCallback((next: Player[]) => {
    setPlayers(next);
    saveRoster(next);
  }, []);
  const updateSelected = useCallback((next: string[]) => {
    setSelected(next);
    saveSelection(next);
  }, []);

  const quickUnlocked = isQuickCallUnlocked(prefs.gamesCompleted);
  const playMode = prefs.mode === "quick" && !quickUnlocked ? "mix" : prefs.mode;
  const availableCards = useMemo(() => buildPlayPool(playMode, categories), [playMode, categories]);
  const fire = phase === "play" && isFireMode(stats.streak);
  fireRef.current = fire;
  useWakeLock(phase !== "setup" && phase !== "final");

  const turn = turns[turnIndex];
  const guesser = turn?.player;
  const nextTurn = turns[turnIndex + 1];
  const totalRounds = turns.length ? (turns[turns.length - 1]?.round ?? 1) : 1;

  /* ---------- pause on interruption ---------- */
  useEffect(() => {
    if (phase !== "countdown" && phase !== "play") return;
    const onHide = () => {
      if (document.visibilityState === "hidden") setPaused(true);
    };
    const onBlur = () => setPaused(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onBlur);
    };
  }, [phase]);

  /* ---------- countdown (resumable) ---------- */
  useEffect(() => {
    if (phase !== "countdown" || paused) return;
    setCountValue(countRef.current);
    countdownBeep();
    const id = setInterval(() => {
      const step = stepCountdown(countRef.current);
      countRef.current = step.value;
      const v = step.value;
      if (step.done) {
        clearInterval(id);
        revealChime();
        leftRef.current = prefs.roundSeconds;
        setSecondsLeft(prefs.roundSeconds);
        cardShownAt.current = Date.now();
        setPhase("play");
        return;
      }
      setCountValue(v);
      if (v === 1) revealChime();
      else countdownBeep();
    }, 800);
    return () => clearInterval(id);
  }, [phase, paused, prefs.roundSeconds]);

  /* ---------- master timer (+ Sound V2 pressure), resumable ---------- */
  useEffect(() => {
    if (phase !== "play" || paused) return;
    const intensity = (left: number) =>
      left > PRESSURE_SECONDS ? 1 : Math.max(0, left / PRESSURE_SECONDS) * 0.85;
    startMusic();
    setMusicIntensity(intensity(leftRef.current));

    let tickTimer: ReturnType<typeof setTimeout>;
    let beatCount = 0;
    const tickLoop = () => {
      const left = leftRef.current;
      if (left <= 0) return;
      // last 10s: the clock below fires one 800Hz beep + light haptic per second
      if (left <= 10) {
        /* no extra tick */
      } else if (left <= PRESSURE_SECONDS) tick(1);
      else tick(fireRef.current ? 1 : 0);
      if (left <= PRESSURE_SECONDS) {
        beatCount += 1;
        if (left <= 6 || beatCount % 2 === 0) heartbeat(left <= 6 ? 1.2 : 0.8);
      }
      const base = left <= 5 ? 220 : left <= 10 ? 380 : left <= PRESSURE_SECONDS ? 600 : 1000;
      const gap = fireRef.current ? Math.round(base * 0.6) : base;
      tickTimer = setTimeout(tickLoop, gap);
    };
    tickTimer = setTimeout(tickLoop, 1000);

    const secInterval = setInterval(() => {
      const step = stepRoundClock(leftRef.current);
      leftRef.current = step.left;
      const left = step.left;
      setSecondsLeft(left);
      setMusicIntensity(intensity(left));
      if (left > 0 && left <= 10) {
        lastTenBeep();
        hapticTick();
      }
      if (step.expired) {
        clearInterval(secInterval);
        clearTimeout(tickTimer);
        // drop any in-flight card advance so it can't leak past TIME!
        if (advanceTimer.current) clearTimeout(advanceTimer.current);
        advanceTimer.current = null;
        stopMusic();
        buzzer();
        hapticTimeUp();
        lockRef.current = true;
        setPhase("summary");
      }
    }, 1000);

    return () => {
      clearInterval(secInterval);
      clearTimeout(tickTimer);
      stopMusic();
    };
  }, [phase, paused]);

  /* ---------- actions (shared gate for buttons + motion) ---------- */
  const advance = (kind: Action, _source: "button" | "motion" = "button") => {
    if (lockRef.current || paused || phase !== "play" || leftRef.current <= 0) return;
    lockRef.current = true;
    setExit(kind);
    setActionFeedback(kind);
    if (actionFeedbackTimer.current) clearTimeout(actionFeedbackTimer.current);
    actionFeedbackTimer.current = setTimeout(() => {
      setActionFeedback(null);
      actionFeedbackTimer.current = null;
    }, 300);
    const next = applyAction(stats, kind);
    setStats((s) => applyAction(s, kind));
    setBonus((b) => b + fireBonus(stats.streak, kind));
    if (card) {
      const entry = { prompt: card.prompt, action: kind, ms: Date.now() - cardShownAt.current };
      setLog((l) => [...l, entry]);
    }
    if (kind === "got") {
      gotItSound();
      hapticGotIt();
      setStamp(next.streak >= 3 ? `🔥 ${next.streak} IN A ROW!` : "+1");
      setFx({ kind: "got", id: Date.now(), burst: isStreakMilestone(next.streak) });
    } else {
      skipSound();
      hapticSkip();
      setStamp("PASS");
      setFx({ kind: "pass", id: Date.now() });
    }
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      advanceTimer.current = null;
      setCard(deckRef.current?.next() ?? null);
      cardShownAt.current = Date.now();
      setCardIndex((i) => i + 1);
      setExit(null);
      lockRef.current = false;
    }, 230);
  };

  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      if (actionFeedbackTimer.current) clearTimeout(actionFeedbackTimer.current);
    },
    [],
  );

  const tilt = useTiltControls({
    enabled: phase === "play" && !paused && secondsLeft > 0 && exit === null,
    onUp: () => advance(gestureToAction("up"), "motion"),
    onDown: () => advance(gestureToAction("down"), "motion"),
    preferOn: prefs.flip,
  });

  const toggleFlip = async () => {
    if (prefs.flip && tilt.motionOn) {
      setPrefs({ flip: false });
      return;
    }
    if (!tilt.motionOn) await tilt.toggleMotion();
    setPrefs({ flip: true });
  };

  useEffect(() => {
    if (!stamp) return;
    const id = setTimeout(() => setStamp(null), 800);
    return () => clearTimeout(id);
  }, [stamp]);

  /* ---------- game flow ---------- */
  const startGame = () => {
    unlockAudio();
    const active = players.filter((p) => selected.includes(p.id));
    if (active.length < 2 || availableCards.length === 0) return;
    setTurns(buildTurnOrder(shuffleWith(active), prefs.rounds));
    setResults([]);
    recordedRef.current = -1;
    setTurnIndex(0);
    deckRef.current = createPromptDeck(availableCards); // fresh used-prompt state
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
    setExit(null);
    setStamp(null);
    setActionFeedback(null);
    setPaused(false);
    setPhase("announce");
  };

  const beginTurn = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
    setExit(null);
    unlockAudio();
    setCardIndex(0);
    setStats(emptyStats());
    setBonus(0);
    setLog([]);
    lockRef.current = false;
    setCard(deckRef.current?.next() ?? null);
    countRef.current = COUNTDOWN_FROM;
    leftRef.current = prefs.roundSeconds;
    setSecondsLeft(prefs.roundSeconds);
    setPaused(false);
    setPhase("countdown");
  };

  // record the turn result exactly once when entering summary
  const recordedRef = useRef(-1);
  useEffect(() => {
    if (phase !== "summary" || !turn) return;
    if (recordedRef.current === turnIndex) return;
    recordedRef.current = turnIndex;
    setResults((r) => [
      ...r,
      {
        playerId: turn.player.id,
        name: turn.player.name,
        round: turn.round,
        correct: stats.correct,
        passes: stats.passes,
        bestStreak: stats.bestStreak,
        bonus,
      },
    ]);
  }, [phase, turn, turnIndex, stats, bonus]);

  const goNext = () => {
    hapticPass();
    if (turnIndex + 1 >= turns.length) {
      fanfare();
      hapticWin();
      setPrefs({ gamesCompleted: prefs.gamesCompleted + 1 });
      setPhase("final");
    } else {
      setTurnIndex((i) => i + 1);
      setPhase("announce");
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
    if (!next) unlockAudio();
  };

  const colorIdx = cardIndex % CARD_COLORS.length;
  const peekColor = CARD_COLORS[(cardIndex + 1) % CARD_COLORS.length];
  const turnRecap = recap(log);
  const color = CARD_COLORS[colorIdx];
  const darkText = DARK_TEXT_ON.includes(colorIdx);
  const urgent = secondsLeft <= PRESSURE_SECONDS;

  const flipLabel = tilt.motionOn
    ? "📱 Flip on — down = got it, up = pass"
    : tilt.permission === "denied"
      ? "📱 Motion blocked — use buttons"
      : prefs.flip && tilt.permission === "needs-permission"
        ? "📱 Tap to allow flip controls"
        : "📱 Flip controls off";

  const gotBtn = (cls: string) => (
    <button
      type="button"
      aria-label="Got it, plus one point"
      onClick={() => advance("got")}
      className={`rounded-3xl bg-card-lime font-black text-black transition-transform duration-150 active:scale-[0.97] ${cls} ${
        actionFeedback === "got" ? "scale-[1.04] brightness-125" : ""
      }`}
      style={{ fontFamily: "var(--font-display)" }}
    >
      {actionFeedback === "got" ? "✓ +1" : "GOT IT!"}
    </button>
  );
  const passBtn = (cls: string) => (
    <button
      type="button"
      aria-label="Pass, no point"
      onClick={() => advance("pass")}
      className={`rounded-3xl bg-white/12 font-black text-white/80 transition-transform duration-150 active:scale-[0.97] ${cls} ${
        actionFeedback === "pass" ? "scale-[1.04] brightness-125" : ""
      }`}
      style={{ fontFamily: "var(--font-display)" }}
    >
      {actionFeedback === "pass" ? "PASSED" : "PASS"}
    </button>
  );

  /* ---------- render ---------- */
  return (
    <main
      className={`min-h-dvh bg-stage text-white select-none ${fx?.kind === "pass" ? "si-shake" : ""}`}
    >
      {fx && (
        <div
          key={fx.id}
          aria-hidden
          onAnimationEnd={() => setFx(null)}
          className={`si-flash pointer-events-none fixed inset-0 z-40 ${fx.kind === "got" ? "bg-card-lime" : "bg-card-pink"}`}
        >
          {fx.kind === "got" &&
            Array.from({ length: fx.burst ? 60 : 24 }, (_, i) => (
              <span
                key={i}
                className="si-confetti absolute top-1/2 left-1/2 h-3 w-2 rounded-sm"
                style={{
                  background: `var(--color-card-${["yellow", "pink", "blue", "purple"][i % 4]})`,
                  ["--dx" as string]: `${Math.cos((i / (fx.burst ? 60 : 24)) * Math.PI * 2) * (fx.burst ? 45 : 30) * (1 + (i % 3) * 0.4)}vw`,
                  ["--dy" as string]: `${Math.sin((i / (fx.burst ? 60 : 24)) * Math.PI * 2) * (fx.burst ? 40 : 25) * (1 + (i % 4) * 0.3)}vh`,
                }}
              />
            ))}
        </div>
      )}
      {phase !== "setup" && (
        <button
          onClick={toggleMute}
          className="fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 rounded-full bg-white/10 px-3 py-2 text-sm backdrop-blur"
          type="button"
          aria-pressed={muted}
          aria-label={muted ? "Unmute sound" : "Mute sound"}
        >
          {muted ? "🔇" : "🔊"}
        </button>
      )}

      {paused && (phase === "countdown" || phase === "play") && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Game paused"
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-stage/95 px-6 text-center"
        >
          <p
            className="text-[12vh] leading-none text-card-yellow"
            style={{ fontFamily: "var(--font-display)" }}
          >
            PAUSED
          </p>
          <p className="text-lg font-bold text-white/60">
            {phase === "play"
              ? `${formatClock(secondsLeft)} left for ${guesser?.name}`
              : "Countdown paused"}
          </p>
          <button
            type="button"
            autoFocus
            onClick={() => {
              unlockAudio();
              setPaused(false);
            }}
            className="w-full max-w-sm rounded-3xl bg-card-lime py-6 text-3xl font-black text-black"
            style={{ fontFamily: "var(--font-display)" }}
          >
            RESUME
          </button>
        </div>
      )}

      {phase === "setup" && (
        <SetupScreen
          players={players}
          selected={selected}
          onAddPlayer={(n) => {
            const p = newPlayer(n);
            if (!p.name) return;
            updatePlayers([...players, p]);
            updateSelected([...selected, p.id]);
          }}
          onRenamePlayer={(id, n) =>
            n.trim() &&
            updatePlayers(players.map((p) => (p.id === id ? { ...p, name: n.trim() } : p)))
          }
          onDeletePlayer={(id) => {
            updatePlayers(players.filter((p) => p.id !== id));
            updateSelected(selected.filter((s) => s !== id));
          }}
          onToggleSelect={(id) =>
            updateSelected(
              selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id],
            )
          }
          prefs={prefs}
          setPrefs={setPrefs}
          categories={categories}
          setCategories={setCategories}
          cardCount={availableCards.length}
          quickUnlocked={quickUnlocked}
          onStart={startGame}
        />
      )}

      {phase === "announce" && guesser && turn && (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 py-6 text-center">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-white/40">
            {totalRounds > 1 ? `Round ${turn.round} of ${totalRounds} · ` : ""}Turn {turnIndex + 1}{" "}
            of {turns.length}
          </p>
          <h2
            className="si-pop max-w-full [overflow-wrap:anywhere] text-[min(14vw,16vh)] leading-[0.9] text-card-pink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {guesser.name.toUpperCase()} IS GUESSING!
          </h2>
          <p className="max-w-md text-lg font-bold text-white/70">
            {guesser.name}, don&apos;t look at the screen! 🙈 Everyone else:{" "}
            {playMode === "sound"
              ? "make the sounds. No words!"
              : playMode === "act"
                ? "act it out. No words!"
                : playMode === "quick"
                  ? "read the card out loud. Guesser shouts answers!"
                  : "follow each card's badge. No words!"}
          </p>
          <p className="text-base font-black text-white/60">
            {landscape ? "✅ Sideways — perfect" : "↔️ Turn sideways to play"} ·{" "}
            {prefs.roundSeconds}s
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {fullscreen.supported && !fullscreen.isFullscreen && (
              <button
                onClick={() => void fullscreen.expand()}
                className="rounded-full bg-white/12 px-5 py-3 text-sm font-black text-white"
              >
                ⛶ EXPAND SCREEN
              </button>
            )}
            {tilt.supported && (
              <button
                type="button"
                aria-pressed={tilt.motionOn}
                onClick={() => void toggleFlip()}
                className={`rounded-full px-5 py-3 text-sm font-black ${
                  tilt.motionOn ? "bg-card-blue text-white" : "bg-white/12 text-white/70"
                }`}
              >
                {flipLabel}
              </button>
            )}
          </div>
          <button
            onClick={beginTurn}
            className="mt-2 w-full max-w-sm rounded-3xl bg-card-lime py-5 text-3xl font-black text-black active:scale-[0.98]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            READY!
          </button>
        </div>
      )}

      {phase === "countdown" && (
        <div className="flex min-h-dvh flex-col items-center justify-center">
          <div
            key={countValue}
            role="timer"
            aria-live="assertive"
            aria-label={`Starting in ${countValue}`}
            className="si-pop text-[min(55vw,70vh)] leading-none text-card-yellow"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {countValue}
          </div>
          <p className="mt-4 text-xl font-black uppercase tracking-wider text-white/70">
            {landscape ? "📱 Hold sideways — on forehead" : "↔️ Hold sideways!"}
          </p>
          {fullscreen.supported && !fullscreen.isFullscreen && (
            <button
              type="button"
              onClick={() => void fullscreen.expand()}
              className="mt-4 rounded-full bg-white/12 px-5 py-3 text-sm font-black text-white"
            >
              ⛶ FULL SCREEN
            </button>
          )}
        </div>
      )}

      {phase === "play" && card && (
        <div
          className={`flex h-dvh flex-col px-2 pt-[env(safe-area-inset-top)] pb-[max(0.5rem,env(safe-area-inset-bottom))] ${
            fire ? "si-fire" : urgent ? "si-pressure" : ""
          }`}
        >
          {/* status strip */}
          <div className="flex items-center gap-2 px-2 py-2 text-sm font-black">
            <span
              className={`rounded-full px-3 py-1 ${fire ? "si-pop bg-card-orange text-black" : "bg-white/10"}`}
              key={stats.streak}
            >
              {stats.streak >= 2 ? `🔥 x${stats.streak}` : `🔥 ${stats.streak}`}
              {fire ? " FIRE MODE" : ""}
            </span>
            <span
              data-testid="timer"
              className={`rounded-full px-3 py-1 tabular-nums ${fire ? "bg-card-orange text-black" : ""} ${urgent ? "si-urgent" : ""} ${!fire && urgent ? "bg-card-pink text-white" : ""} ${!fire && !urgent ? "bg-white/10" : ""}`}
            >
              ⏱ {formatClock(secondsLeft)}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1">✓ {stats.correct + bonus}</span>
            {tilt.motionOn && tilt.debug && (
              <span
                data-testid="tilt-debug"
                className="rounded-full bg-white/10 px-3 py-1 text-xs tabular-nums text-white/60"
              >
                β {tilt.debug.beta}° γ {tilt.debug.gamma}° {tilt.debug.landscape ? "L" : "P"}
                {tilt.debug.calibrating ? " cal…" : ` Δ${tilt.debug.delta}°`}
                {` ${tilt.debug.state}`}
              </span>
            )}
            <span className="ml-auto truncate pr-12 text-xs uppercase tracking-wider text-white/40">
              {guesser?.name}
            </span>
          </div>

          <div
            className={`relative flex min-h-0 flex-1 gap-2 ${landscape ? "flex-row" : "flex-col"}`}
          >
            <div className="relative flex min-h-0 flex-1">
              <div
                aria-hidden
                className="absolute inset-0 translate-y-2 scale-[0.96] rounded-[2.25rem] opacity-60"
                style={{ backgroundColor: peekColor }}
              />
              <div
                key={cardIndex}
                className={`si-card-in relative flex min-h-0 flex-1 flex-col items-center justify-center rounded-[2.25rem] px-6 text-center shadow-2xl ${
                  exit === "got" ? "si-fly-down" : exit === "pass" ? "si-fly-up" : ""
                }`}
                style={{ backgroundColor: color, color: darkText ? "#0a0a0c" : "#fff" }}
              >
                <span aria-hidden className="absolute left-5 top-4 text-4xl">
                  {card.icon}
                </span>
                {card.badge && (
                  <span
                    className="mb-4 rounded-full px-5 py-2 text-sm font-black tracking-wide"
                    style={{ backgroundColor: darkText ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.22)" }}
                  >
                    {card.badge}
                  </span>
                )}
                <h2
                  className={`${promptSize(card.prompt, landscape)} font-black uppercase`}
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {card.prompt}
                </h2>
                <span className="absolute bottom-4 left-0 right-0 text-center text-base font-black uppercase tracking-wider opacity-70">
                  {card.hint}
                </span>
              </div>
            </div>

            {landscape ? (
              <div className="flex w-[24vw] max-w-48 shrink-0 flex-col gap-2">
                {gotBtn("flex-[1.5] text-3xl")}
                {passBtn("flex-1 text-2xl")}
              </div>
            ) : (
              <div className="grid shrink-0 grid-cols-[1fr_1.4fr] gap-3">
                {passBtn("py-7 text-2xl")}
                {gotBtn("py-7 text-3xl")}
              </div>
            )}

            <span role="status" aria-live="polite" className="sr-only">
              {stamp ?? ""}
              {secondsLeft <= 10 && secondsLeft > 0 ? ` ${secondsLeft} seconds left` : ""}
            </span>
            {stamp && (
              <div
                className="si-stamp pointer-events-none absolute inset-0 flex items-center justify-center text-[min(13vw,14vh)] font-black text-white drop-shadow-[0_6px_0_rgba(0,0,0,0.35)]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {stamp}
              </div>
            )}
          </div>

          {tilt.supported && (
            <div className="pt-1 text-center">
              <button
                type="button"
                aria-pressed={tilt.motionOn}
                onClick={() => void toggleFlip()}
                className={`rounded-full min-h-11 px-3 py-1 text-[11px] font-black uppercase tracking-wider ${
                  tilt.motionOn ? "bg-card-blue text-white" : "bg-white/10 text-white/50"
                }`}
              >
                {flipLabel}
              </button>
            </div>
          )}
        </div>
      )}

      {phase === "summary" && guesser && (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 py-6 text-center">
          <p
            role="alert"
            className="si-pop text-[min(16vw,18vh)] leading-none text-card-pink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            TIME!
          </p>
          <h2
            className="max-w-full [overflow-wrap:anywhere] text-[min(14vw,14vh)] leading-none text-card-yellow"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {guesser.name.toUpperCase()}
          </h2>
          <div className="grid w-full max-w-sm grid-cols-3 gap-3">
            {[
              { label: "Points", value: stats.correct + bonus, c: "bg-card-lime text-black" },
              { label: "Passed", value: stats.passes, c: "bg-white/10 text-white" },
              { label: "Best 🔥", value: stats.bestStreak, c: "bg-card-purple text-white" },
            ].map((s) => (
              <div key={s.label} className={`rounded-3xl py-5 ${s.c}`}>
                <div className="text-5xl font-black">{s.value}</div>
                <div className="mt-1 text-xs font-bold uppercase opacity-70">{s.label}</div>
              </div>
            ))}
          </div>
          {turnRecap.fastest && (
            <p className="text-sm font-black text-white/70">
              ⚡ Fastest: {turnRecap.fastest.prompt} ({(turnRecap.fastest.ms / 1000).toFixed(1)}s)
            </p>
          )}
          {bonus > 0 && (
            <p className="text-sm font-black text-card-orange">🔥 +{bonus} FIRE MODE bonus</p>
          )}
          <div className="grid w-full max-w-sm grid-cols-2 gap-3 text-left">
            {[
              { title: "✓ Got it", items: turnRecap.correct, c: "text-card-lime" },
              { title: "↷ Passed", items: turnRecap.passed, c: "text-white/60" },
            ].map((col) => (
              <div key={col.title} className="rounded-2xl bg-white/8 p-3">
                <div className={`mb-1 text-xs font-black uppercase ${col.c}`}>{col.title}</div>
                <ul className="max-h-40 overflow-y-auto text-sm font-bold text-white/80">
                  {col.items.length === 0 && <li className="text-white/30">—</li>}
                  {col.items.map((e, i) => (
                    <li key={i} className="[overflow-wrap:anywhere]">
                      {e.prompt}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <button
            onClick={goNext}
            className="mt-2 [overflow-wrap:anywhere] px-3 w-full max-w-sm rounded-3xl bg-card-pink py-5 text-2xl font-black text-white active:scale-[0.98]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {nextTurn ? `PASS TO ${nextTurn.player.name.toUpperCase()} →` : "SEE RESULTS →"}
          </button>
        </div>
      )}

      {phase === "final" && (
        <FinalScoreboard
          results={results}
          onNewGame={() => setPhase("setup")}
          onPlayAgain={startGame}
        />
      )}
    </main>
  );
}

function FinalScoreboard({
  results,
  onNewGame,
  onPlayAgain,
}: {
  results: TurnResult[];
  onNewGame: () => void;
  onPlayAgain: () => void;
}) {
  const totals = aggregateScores(results);
  const top = winners(totals);
  const [shared, setShared] = useState<string | null>(null);
  const share = async () => {
    const text = shareText(totals);
    try {
      const nav = navigator as Navigator & {
        share?: (d: { text: string; title?: string }) => Promise<void>;
      };
      if (typeof nav.share === "function") {
        await nav.share({ title: "Sound It! scores", text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setShared("Copied to clipboard!");
    } catch {
      setShared("Couldn't share — try a screenshot");
    }
  };
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-5 px-5 pt-[max(3rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <h2
        className="si-pop text-center text-[min(14vw,14vh)] leading-none text-card-yellow"
        style={{ fontFamily: "var(--font-display)" }}
      >
        FINAL SCORES
      </h2>
      {top.length === 1 && top[0] && (
        <p
          data-testid="winner"
          className="[overflow-wrap:anywhere] text-center text-lg font-black text-card-lime"
        >
          🎉 {top[0].name} wins with {top[0].total} {top[0].total === 1 ? "point" : "points"}!
        </p>
      )}
      {top.length > 1 && (
        <p
          data-testid="winner"
          className="[overflow-wrap:anywhere] text-center text-lg font-black text-card-lime"
        >
          🤝 It&apos;s a tie! {top.map((t) => t.name).join(" & ")} — {top[0]?.total} each
        </p>
      )}
      <div className="flex flex-col gap-2">
        {totals.map((t) => (
          <div
            key={t.playerId}
            className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-3xl px-5 py-4 ${
              t.rank === 1 ? "bg-card-yellow text-black" : "bg-white/8 text-white"
            }`}
          >
            <span className="shrink-0 text-2xl font-black">
              {medals[t.rank - 1] ?? `${t.rank}.`}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xl font-black">{t.name}</span>
              <span className="text-xs font-bold opacity-60">
                {t.turns} {t.turns === 1 ? "turn" : "turns"} · {t.passes} passed · best streak{" "}
                {t.bestStreak}
              </span>
            </span>
            <span className="shrink-0 text-4xl font-black">{t.total}</span>
          </div>
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-3 pt-4">
        <button
          onClick={onPlayAgain}
          className="w-full rounded-3xl bg-card-lime py-6 text-3xl font-black text-black active:scale-[0.98]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          PLAY AGAIN
          <span className="block text-sm opacity-60" style={{ fontFamily: "inherit" }}>
            same players
          </span>
        </button>
        <button
          type="button"
          onClick={() => void share()}
          className="w-full rounded-3xl bg-card-blue py-4 text-lg font-black text-white"
        >
          📤 SHARE SCORE
        </button>
        {shared && (
          <p role="status" className="text-center text-sm font-bold text-white/60">
            {shared}
          </p>
        )}
        <button
          onClick={onNewGame}
          className="w-full rounded-3xl bg-white/10 py-4 text-lg font-black text-white/70"
        >
          NEW GAME · NEW PLAYERS
        </button>
      </div>
    </div>
  );
}
