import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SetupScreen, type Mode } from "@/components/game/SetupScreen";
import {
  CATEGORIES,
  CLUE_LABEL,
  filterCards,
  shuffle,
  type Card,
  type CategoryId,
} from "@/lib/cards";
import {
  buzzer,
  countdownBeep,
  fanfare,
  gotItSound,
  isMuted,
  revealChime,
  setMuted,
  skipSound,
  tick,
  unlockAudio,
} from "@/lib/audio";
import { loadPlayers, newPlayer, savePlayers, type Player } from "@/lib/players";

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
          "Make the sound, act it out, guess it fast. A 60-second party game for one phone and a whole room.",
      },
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
const ROUND_SECONDS = 60;

interface RoundResult {
  playerId: string;
  name: string;
  correct: number;
  skips: number;
  bestStreak: number;
}

function promptSize(prompt: string) {
  const n = prompt.length;
  if (n <= 12) return "text-[20vw] leading-[0.88]";
  if (n <= 20) return "text-[15vw] leading-[0.9]";
  if (n <= 32) return "text-[11.5vw] leading-[0.95]";
  return "text-[9vw] leading-[1]";
}

function SoundItGame() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [mode, setMode] = useState<Mode>("mix");
  const [categories, setCategories] = useState<CategoryId[]>(
    CATEGORIES.map((c) => c.id),
  );
  const [phase, setPhase] = useState<Phase>("setup");
  const [muted, setMutedState] = useState(false);

  const [order, setOrder] = useState<Player[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);

  const [deck, setDeck] = useState<Card[]>([]);
  const [deckPos, setDeckPos] = useState(0);
  const [cardIndex, setCardIndex] = useState(0);
  const [exit, setExit] = useState<"got" | "skip" | null>(null);
  const [stamp, setStamp] = useState<string | null>(null);

  const [countValue, setCountValue] = useState(5);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [correct, setCorrect] = useState(0);
  const [skips, setSkips] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const lockRef = useRef(false);

  useEffect(() => {
    const saved = loadPlayers();
    setPlayers(
      saved.length
        ? saved
        : [newPlayer("Player 1"), newPlayer("Player 2")],
    );
  }, []);

  const updatePlayers = useCallback((next: Player[]) => {
    setPlayers(next);
    savePlayers(next);
  }, []);

  const availableCards = useMemo(
    () => filterCards(mode, categories.length === CATEGORIES.length ? "all" : categories),
    [mode, categories],
  );

  const guesser = order[roundIndex];
  const nextGuesser = order[roundIndex + 1];
  const card = deck[deckPos];

  /* ---------- countdown ---------- */
  useEffect(() => {
    if (phase !== "countdown") return;
    setCountValue(5);
    countdownBeep();
    let v = 5;
    const id = setInterval(() => {
      v -= 1;
      if (v === 0) {
        clearInterval(id);
        revealChime();
        setPhase("play");
        return;
      }
      setCountValue(v);
      if (v === 1) revealChime();
      else countdownBeep();
    }, 800);
    return () => clearInterval(id);
  }, [phase]);

  /* ---------- master timer ---------- */
  useEffect(() => {
    if (phase !== "play") return;
    setSecondsLeft(ROUND_SECONDS);
    let left = ROUND_SECONDS;
    let timeout: ReturnType<typeof setTimeout>;

    const step = () => {
      left -= 1;
      setSecondsLeft(left);
      if (left <= 0) {
        buzzer();
        lockRef.current = true;
        setPhase("summary");
        return;
      }
      if (left <= 5) tick(2);
      else if (left <= 10) tick(1);
      else tick(0);
      timeout = setTimeout(step, left <= 5 ? 400 : left <= 10 ? 700 : 1000);
    };
    timeout = setTimeout(step, 1000);
    return () => clearTimeout(timeout);
  }, [phase]);

  /* ---------- actions ---------- */
  const advance = (kind: "got" | "skip") => {
    if (lockRef.current || phase !== "play") return;
    lockRef.current = true;
    setExit(kind);
    if (kind === "got") {
      gotItSound();
      const s = streak + 1;
      setStreak(s);
      setBestStreak((b) => Math.max(b, s));
      setCorrect((c) => c + 1);
      if (s >= 3) setStamp(`🔥 ${s} IN A ROW!`);
    } else {
      skipSound();
      setStreak(0);
      setSkips((s) => s + 1);
    }
    setTimeout(() => {
      setDeckPos((p) => (p + 1 < deck.length ? p + 1 : 0));
      setCardIndex((i) => i + 1);
      setExit(null);
      lockRef.current = false;
    }, 230);
  };

  useEffect(() => {
    if (!stamp) return;
    const id = setTimeout(() => setStamp(null), 800);
    return () => clearTimeout(id);
  }, [stamp]);

  const startGame = () => {
    unlockAudio();
    const active = players.filter((p) => p.active);
    setOrder(shuffle(active));
    setResults([]);
    setRoundIndex(0);
    setPhase("announce");
  };

  const beginRound = () => {
    unlockAudio();
    setDeck(shuffle(availableCards));
    setDeckPos(0);
    setCardIndex(0);
    setCorrect(0);
    setSkips(0);
    setStreak(0);
    setBestStreak(0);
    lockRef.current = false;
    setPhase("countdown");
  };

  // record result when entering summary
  const recordedRef = useRef(-1);
  useEffect(() => {
    if (phase !== "summary" || !guesser) return;
    if (recordedRef.current === roundIndex) return;
    recordedRef.current = roundIndex;
    setResults((r) => [
      ...r,
      { playerId: guesser.id, name: guesser.name, correct, skips, bestStreak },
    ]);
  }, [phase, guesser, roundIndex, correct, skips, bestStreak]);

  const goNext = () => {
    if (roundIndex + 1 >= order.length) {
      fanfare();
      setPhase("final");
    } else {
      setRoundIndex((i) => i + 1);
      setPhase("announce");
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
    if (!next) unlockAudio();
  };

  useEffect(() => setMutedState(isMuted()), []);

  const color = CARD_COLORS[cardIndex % CARD_COLORS.length];
  const darkText = DARK_TEXT_ON.includes(cardIndex % CARD_COLORS.length);

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

      {phase === "setup" && (
        <SetupScreen
          players={players}
          onAddPlayer={(n) => updatePlayers([...players, newPlayer(n)])}
          onRenamePlayer={(id, n) =>
            updatePlayers(
              players.map((p) => (p.id === id ? { ...p, name: n.trim() } : p)),
            )
          }
          onDeletePlayer={(id) => updatePlayers(players.filter((p) => p.id !== id))}
          onTogglePlayer={(id) =>
            updatePlayers(
              players.map((p) => (p.id === id ? { ...p, active: !p.active } : p)),
            )
          }
          mode={mode}
          setMode={setMode}
          categories={categories}
          setCategories={setCategories}
          cardCount={availableCards.length}
          onStart={startGame}
        />
      )}

      {phase === "announce" && guesser && (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-white/40">
            Round {roundIndex + 1} of {order.length}
          </p>
          <h2
            className="si-pop text-[16vw] leading-[0.9] text-card-pink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {guesser.name.toUpperCase()} IS GUESSING!
          </h2>
          <p className="max-w-sm text-lg font-bold text-white/70">
            {guesser.name}, don&apos;t look at the screen! 🙈 Everyone else: pass the
            phone around and{" "}
            {mode === "sound"
              ? "make the sounds"
              : mode === "act"
                ? "act it out"
                : "follow each card's badge"}
            . No words!
          </p>
          <button
            onClick={beginRound}
            className="mt-4 w-full max-w-sm rounded-3xl bg-card-lime py-6 text-3xl font-black text-black active:scale-[0.98]"
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
            className="si-pop text-[55vw] leading-none text-card-yellow"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {countValue}
          </div>
        </div>
      )}

      {phase === "play" && card && (
        <div className="flex min-h-dvh flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
          {/* status strip */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3 text-sm font-black">
              <span className="shrink-0 rounded-full bg-white/10 px-3 py-1.5">
                🔥 {streak}
              </span>
              <span
                className={`shrink-0 rounded-full px-3 py-1.5 tabular-nums ${
                  secondsLeft <= 10 ? "bg-card-pink text-white" : "bg-white/10"
                }`}
              >
                ⏱ 0:{String(Math.max(secondsLeft, 0)).padStart(2, "0")}
              </span>
              <span className="shrink-0 rounded-full bg-white/10 px-3 py-1.5">
                ✓ {correct}
              </span>
            </div>
            <span className="truncate pr-10 text-xs font-bold uppercase tracking-wider text-white/40">
              {guesser?.name}
            </span>
          </div>

          {/* card */}
          <div className="relative flex flex-1 items-center justify-center px-3">
            <div
              key={cardIndex}
              className={`si-card-in flex h-[76dvh] w-full flex-col items-center justify-center rounded-[2.5rem] px-6 text-center ${
                exit === "got" ? "si-flip-out" : exit === "skip" ? "si-slide-out" : ""
              }`}
              style={{ backgroundColor: color, color: darkText ? "#0a0a0c" : "#fff" }}
            >
              {mode === "mix" && (
                <span
                  className="mb-6 rounded-full px-5 py-2 text-sm font-black tracking-wide"
                  style={{
                    backgroundColor: darkText ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.22)",
                  }}
                >
                  {CLUE_LABEL[card.clueType]}
                </span>
              )}
              <h2
                className={`${promptSize(card.prompt)} uppercase`}
                style={{ fontFamily: "var(--font-display)" }}
              >
                {card.prompt}
              </h2>
            </div>
            {stamp && (
              <div
                className="si-stamp pointer-events-none absolute text-[13vw] font-black text-white drop-shadow-[0_6px_0_rgba(0,0,0,0.35)]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {stamp}
              </div>
            )}
          </div>

          {/* controls */}
          <div className="grid grid-cols-[1fr_1.4fr] gap-3 px-3 pb-3 pt-3">
            <button
              onClick={() => advance("skip")}
              className="rounded-3xl bg-white/12 py-7 text-2xl font-black text-white/80 active:scale-[0.97]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              SKIP
            </button>
            <button
              onClick={() => advance("got")}
              className="rounded-3xl bg-card-lime py-7 text-3xl font-black text-black active:scale-[0.97]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              ✓ GOT IT!
            </button>
          </div>
        </div>
      )}

      {phase === "summary" && guesser && (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-white/40">
            Time&apos;s up
          </p>
          <h2
            className="text-[14vw] leading-none text-card-yellow"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {guesser.name.toUpperCase()}
          </h2>
          <div className="grid w-full max-w-sm grid-cols-3 gap-3">
            {[
              { label: "Correct", value: correct, c: "bg-card-lime text-black" },
              { label: "Skips", value: skips, c: "bg-white/10 text-white" },
              { label: "Best 🔥", value: bestStreak, c: "bg-card-purple text-white" },
            ].map((s) => (
              <div key={s.label} className={`rounded-3xl py-6 ${s.c}`}>
                <div className="text-5xl font-black">{s.value}</div>
                <div className="mt-1 text-xs font-bold uppercase opacity-70">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={goNext}
            className="mt-4 w-full max-w-sm rounded-3xl bg-card-pink py-6 text-2xl font-black text-white active:scale-[0.98]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {nextGuesser ? `PASS TO ${nextGuesser.name.toUpperCase()} →` : "SEE RESULTS →"}
          </button>
        </div>
      )}

      {phase === "final" && (
        <FinalScoreboard
          results={results}
          onPlayAgain={() => {
            recordedRef.current = -1;
            setPhase("setup");
          }}
          onRematch={() => {
            recordedRef.current = -1;
            startGame();
          }}
        />
      )}
    </main>
  );
}

function FinalScoreboard({
  results,
  onPlayAgain,
  onRematch,
}: {
  results: RoundResult[];
  onPlayAgain: () => void;
  onRematch: () => void;
}) {
  const ranked = [...results].sort(
    (a, b) => b.correct - a.correct || b.bestStreak - a.bestStreak,
  );
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-5 px-5 pt-[max(3rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <h2
        className="si-pop text-center text-[14vw] leading-none text-card-yellow"
        style={{ fontFamily: "var(--font-display)" }}
      >
        FINAL SCORES
      </h2>
      {ranked[0] && (
        <p className="text-center text-lg font-black text-card-lime">
          🎉 {ranked[0].name} wins with {ranked[0].correct} points!
        </p>
      )}
      <div className="flex flex-col gap-2">
        {ranked.map((r, i) => (
          <div
            key={r.playerId}
            className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-3xl px-5 py-4 ${
              i === 0 ? "bg-card-yellow text-black" : "bg-white/8 text-white"
            }`}
          >
            <span className="shrink-0 text-2xl font-black">
              {medals[i] ?? `${i + 1}.`}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xl font-black">{r.name}</span>
              <span className="text-xs font-bold opacity-60">
                {r.skips} skips · best streak {r.bestStreak}
              </span>
            </span>
            <span className="shrink-0 text-4xl font-black">{r.correct}</span>
          </div>
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-3 pt-4">
        <button
          onClick={onRematch}
          className="w-full rounded-3xl bg-card-lime py-6 text-3xl font-black text-black active:scale-[0.98]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          PLAY AGAIN
        </button>
        <button
          onClick={onPlayAgain}
          className="w-full rounded-3xl bg-white/10 py-4 text-lg font-black text-white/70"
        >
          Change players & settings
        </button>
      </div>
    </div>
  );
}
