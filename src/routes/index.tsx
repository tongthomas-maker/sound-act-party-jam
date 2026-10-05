import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SetupScreen } from "@/components/game/SetupScreen";
import { CATEGORIES, CLUE_LABEL, filterCards, type Card, type CategoryId } from "@/lib/cards";
import {
  aggregateScores,
  applyAction,
  buildTurnOrder,
  createPromptDeck,
  emptyStats,
  formatClock,
  gestureToAction,
  shuffleWith,
  winners,
  type Action,
  type Turn,
  type TurnResult,
  type TurnStats,
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

  const deckRef = useRef<ReturnType<typeof createPromptDeck<Card>> | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [exit, setExit] = useState<Action | null>(null);
  const [stamp, setStamp] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<Action | null>(null);
  const actionFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [countValue, setCountValue] = useState(COUNTDOWN_FROM);
  const countRef = useRef(COUNTDOWN_FROM);
  const [secondsLeft, setSecondsLeft] = useState<number>(DEFAULT_PREFS.roundSeconds);
  const leftRef = useRef<number>(DEFAULT_PREFS.roundSeconds);
  const [stats, setStats] = useState<TurnStats>(emptyStats());
  const lockRef = useRef(false);

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
  }, [prefs.music, prefs.sfx, prefs.haptics]);

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

  const availableCards = useMemo(
    () => filterCards(prefs.mode, categories.length === CATEGORIES.length ? "all" : categories),
    [prefs.mode, categories],
  );

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
      countRef.current -= 1;
      const v = countRef.current;
      if (v <= 0) {
        clearInterval(id);
        revealChime();
        leftRef.current = prefs.roundSeconds;
        setSecondsLeft(prefs.roundSeconds);
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
      if (left <= 10) tick(2);
      else if (left <= PRESSURE_SECONDS) tick(1);
      else tick(0);
      if (left <= PRESSURE_SECONDS) {
        beatCount += 1;
        if (left <= 6 || beatCount % 2 === 0) heartbeat(left <= 6 ? 1.2 : 0.8);
      }
      const gap = left <= 5 ? 220 : left <= 10 ? 380 : left <= PRESSURE_SECONDS ? 600 : 1000;
      tickTimer = setTimeout(tickLoop, gap);
    };
    tickTimer = setTimeout(tickLoop, 1000);

    const secInterval = setInterval(() => {
      leftRef.current -= 1;
      const left = leftRef.current;
      setSecondsLeft(left);
      setMusicIntensity(intensity(left));
      if (left <= 0) {
        clearInterval(secInterval);
        clearTimeout(tickTimer);
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
    setStats(next);
    if (kind === "got") {
      gotItSound();
      hapticGotIt();
      setStamp(next.streak >= 3 ? `🔥 ${next.streak} IN A ROW!` : "+1");
    } else {
      skipSound();
      hapticSkip();
      setStamp("PASS");
    }
    setTimeout(() => {
      setCard(deckRef.current?.next() ?? null);
      setCardIndex((i) => i + 1);
      setExit(null);
      lockRef.current = false;
    }, 230);
  };

  useEffect(
    () => () => {
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
    setPaused(false);
    setPhase("announce");
  };

  const beginTurn = () => {
    unlockAudio();
    setCardIndex(0);
    setStats(emptyStats());
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
      },
    ]);
  }, [phase, turn, turnIndex, stats]);

  const goNext = () => {
    hapticPass();
    if (turnIndex + 1 >= turns.length) {
      fanfare();
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
    <main className="min-h-dvh bg-stage text-white select-none">
      {phase !== "setup" && (
        <button
          onClick={toggleMute}
          className="fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 rounded-full bg-white/10 px-3 py-2 text-sm backdrop-blur"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? "🔇" : "🔊"}
        </button>
      )}

      {paused && (phase === "countdown" || phase === "play") && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-stage/95 px-6 text-center">
          <p className="text-[12vh] leading-none text-card-yellow" style={{ fontFamily: "var(--font-display)" }}>
            PAUSED
          </p>
          <p className="text-lg font-bold text-white/60">
            {phase === "play" ? `${formatClock(secondsLeft)} left for ${guesser?.name}` : "Countdown paused"}
          </p>
          <button
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
            n.trim() && updatePlayers(players.map((p) => (p.id === id ? { ...p, name: n.trim() } : p)))
          }
          onDeletePlayer={(id) => {
            updatePlayers(players.filter((p) => p.id !== id));
            updateSelected(selected.filter((s) => s !== id));
          }}
          onToggleSelect={(id) =>
            updateSelected(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
          }
          prefs={prefs}
          setPrefs={setPrefs}
          categories={categories}
          setCategories={setCategories}
          cardCount={availableCards.length}
          onStart={startGame}
        />
      )}

      {phase === "announce" && guesser && turn && (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 py-6 text-center">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-white/40">
            {totalRounds > 1 ? `Round ${turn.round} of ${totalRounds} · ` : ""}Turn {turnIndex + 1} of {turns.length}
          </p>
          <h2
            className="si-pop text-[min(14vw,16vh)] leading-[0.9] text-card-pink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {guesser.name.toUpperCase()} IS GUESSING!
          </h2>
          <p className="max-w-md text-lg font-bold text-white/70">
            {guesser.name}, don&apos;t look at the screen! 🙈 Everyone else:{" "}
            {prefs.mode === "sound" ? "make the sounds" : prefs.mode === "act" ? "act it out" : "follow each card's badge"}
            . No words!
          </p>
          <p className="text-base font-black text-white/60">
            {landscape ? "✅ Sideways — perfect" : "↔️ Turn sideways to play"} · {prefs.roundSeconds}s
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
            className="si-pop text-[min(55vw,70vh)] leading-none text-card-yellow"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {countValue}
          </div>
        </div>
      )}

      {phase === "play" && card && (
        <div
          className={`flex h-dvh flex-col px-2 pt-[env(safe-area-inset-top)] pb-[max(0.5rem,env(safe-area-inset-bottom))] ${
            urgent ? "si-pressure" : ""
          }`}
        >
          {/* status strip */}
          <div className="flex items-center gap-2 px-2 py-2 text-sm font-black">
            <span className="rounded-full bg-white/10 px-3 py-1">🔥 {stats.streak}</span>
            <span
              data-testid="timer"
              className={`rounded-full px-3 py-1 tabular-nums ${urgent ? "si-urgent bg-card-pink text-white" : "bg-white/10"}`}
            >
              ⏱ {formatClock(secondsLeft)}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1">✓ {stats.correct}</span>
            <span className="ml-auto truncate pr-12 text-xs uppercase tracking-wider text-white/40">
              {guesser?.name}
            </span>
          </div>

          <div className={`relative flex min-h-0 flex-1 gap-2 ${landscape ? "flex-row" : "flex-col"}`}>
            <div
              key={cardIndex}
              className={`si-card-in flex min-h-0 flex-1 flex-col items-center justify-center rounded-[2.25rem] px-6 text-center ${
                exit === "got" ? "si-slide-out" : exit === "pass" ? "si-flip-out" : ""
              }`}
              style={{ backgroundColor: color, color: darkText ? "#0a0a0c" : "#fff" }}
            >
              {prefs.mode === "mix" && (
                <span
                  className="mb-4 rounded-full px-5 py-2 text-sm font-black tracking-wide"
                  style={{ backgroundColor: darkText ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.22)" }}
                >
                  {CLUE_LABEL[card.clueType]}
                </span>
              )}
              <h2 className={`${promptSize(card.prompt, landscape)} uppercase`} style={{ fontFamily: "var(--font-display)" }}>
                {card.prompt}
              </h2>
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
                onClick={() => void toggleFlip()}
                className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${
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
          <p className="si-pop text-[min(16vw,18vh)] leading-none text-card-pink" style={{ fontFamily: "var(--font-display)" }}>
            TIME!
          </p>
          <h2 className="text-[min(14vw,14vh)] leading-none text-card-yellow" style={{ fontFamily: "var(--font-display)" }}>
            {guesser.name.toUpperCase()}
          </h2>
          <div className="grid w-full max-w-sm grid-cols-3 gap-3">
            {[
              { label: "Got it", value: stats.correct, c: "bg-card-lime text-black" },
              { label: "Passed", value: stats.passes, c: "bg-white/10 text-white" },
              { label: "Best 🔥", value: stats.bestStreak, c: "bg-card-purple text-white" },
            ].map((s) => (
              <div key={s.label} className={`rounded-3xl py-5 ${s.c}`}>
                <div className="text-5xl font-black">{s.value}</div>
                <div className="mt-1 text-xs font-bold uppercase opacity-70">{s.label}</div>
              </div>
            ))}
          </div>
          <button
            onClick={goNext}
            className="mt-2 w-full max-w-sm rounded-3xl bg-card-pink py-5 text-2xl font-black text-white active:scale-[0.98]"
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
        <p data-testid="winner" className="text-center text-lg font-black text-card-lime">
          🎉 {top[0].name} wins with {top[0].total} {top[0].total === 1 ? "point" : "points"}!
        </p>
      )}
      {top.length > 1 && (
        <p data-testid="winner" className="text-center text-lg font-black text-card-lime">
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
            <span className="shrink-0 text-2xl font-black">{medals[t.rank - 1] ?? `${t.rank}.`}</span>
            <span className="min-w-0">
              <span className="block truncate text-xl font-black">{t.name}</span>
              <span className="text-xs font-bold opacity-60">
                {t.turns} {t.turns === 1 ? "turn" : "turns"} · {t.passes} passed · best streak {t.bestStreak}
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
        </button>
        <button onClick={onNewGame} className="w-full rounded-3xl bg-white/10 py-4 text-lg font-black text-white/70">
          NEW GAME / CHANGE SETTINGS
        </button>
      </div>
    </div>
  );
}
