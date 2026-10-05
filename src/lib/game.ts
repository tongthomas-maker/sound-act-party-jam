/** Pure, deterministic game logic for Sound It! (no React, no browser APIs). */

export const ROUND_LENGTHS = [30, 60, 90] as const;
export type RoundLength = (typeof ROUND_LENGTHS)[number];
export const DEFAULT_ROUND_LENGTH: RoundLength = 60;

export const ROUND_COUNTS = [1, 2, 3] as const;
export type RoundCount = (typeof ROUND_COUNTS)[number];
export const DEFAULT_ROUND_COUNT: RoundCount = 1;

export const MIN_PLAYERS = 2;

export function isRoundLength(v: unknown): v is RoundLength {
  return ROUND_LENGTHS.includes(v as RoundLength);
}
export function isRoundCount(v: unknown): v is RoundCount {
  return ROUND_COUNTS.includes(v as RoundCount);
}

export function canStartGame(selectedCount: number, eligibleCards: number) {
  if (selectedCount < MIN_PLAYERS) return { ok: false, reason: "players" } as const;
  if (eligibleCards <= 0) return { ok: false, reason: "cards" } as const;
  return { ok: true, reason: null } as const;
}

/* ---------- turns ---------- */

export interface Turn<P> {
  player: P;
  round: number; // 1-based
}

/** Every player takes exactly one turn per round, in the same order each round. */
export function buildTurnOrder<P>(players: P[], rounds: number): Turn<P>[] {
  const out: Turn<P>[] = [];
  const r = Math.max(1, Math.floor(rounds));
  for (let round = 1; round <= r; round++)
    for (const player of players) out.push({ player, round });
  return out;
}

/* ---------- actions & scoring ---------- */

export type Action = "got" | "pass";

export interface TurnStats {
  correct: number;
  passes: number;
  streak: number;
  bestStreak: number;
}

export const emptyStats = (): TurnStats => ({
  correct: 0,
  passes: 0,
  streak: 0,
  bestStreak: 0,
});

/** GOT IT = +1 and streak up; PASS = no point, streak reset. */
export function applyAction(s: TurnStats, a: Action): TurnStats {
  if (a === "got") {
    const streak = s.streak + 1;
    return {
      correct: s.correct + 1,
      passes: s.passes,
      streak,
      bestStreak: Math.max(s.bestStreak, streak),
    };
  }
  return { ...s, passes: s.passes + 1, streak: 0 };
}

/**
 * Input gate: one action per card. Returns true if the action is accepted.
 * Rejects while locked (card transitioning), when time is up, or outside play.
 */
export function createInputGate() {
  let locked = false;
  return {
    tryAccept(active: boolean, secondsLeft: number) {
      if (locked || !active || secondsLeft <= 0) return false;
      locked = true;
      return true;
    },
    release() {
      locked = false;
    },
    lock() {
      locked = true;
    },
    get locked() {
      return locked;
    },
  };
}

/* ---------- gestures ---------- */

/** Superseding V1 mapping: tilt/flip DOWN = GOT IT, tilt/flip UP = PASS. */
export function gestureToAction(direction: "up" | "down"): Action {
  return direction === "down" ? "got" : "pass";
}

/* ---------- results ---------- */

export interface TurnResult {
  playerId: string;
  name: string;
  round: number;
  correct: number;
  passes: number;
  bestStreak: number;
}

export interface PlayerTotal {
  playerId: string;
  name: string;
  total: number;
  passes: number;
  bestStreak: number;
  turns: number;
  rank: number; // 1-based, tied players share a rank
}

export function aggregateScores(results: TurnResult[]): PlayerTotal[] {
  const map = new Map<string, PlayerTotal>();
  for (const r of results) {
    const t =
      map.get(r.playerId) ??
      { playerId: r.playerId, name: r.name, total: 0, passes: 0, bestStreak: 0, turns: 0, rank: 0 };
    t.name = r.name;
    t.total += r.correct;
    t.passes += r.passes;
    t.bestStreak = Math.max(t.bestStreak, r.bestStreak);
    t.turns += 1;
    map.set(r.playerId, t);
  }
  const list = [...map.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  let rank = 0;
  let prev: number | null = null;
  list.forEach((t, i) => {
    if (t.total !== prev) rank = i + 1;
    prev = t.total;
    t.rank = rank;
  });
  return list;
}

export function winners(totals: PlayerTotal[]): PlayerTotal[] {
  return totals.filter((t) => t.rank === 1);
}

/* ---------- prompt repeat protection ---------- */

export function shuffleWith<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
}

/**
 * Deals every eligible prompt once before any repeats. On exhaustion it
 * reshuffles (avoiding an immediate back-to-back repeat). Empty pool → null.
 */
export function createPromptDeck<T extends { id: string }>(
  pool: T[],
  rand: () => number = Math.random,
) {
  let queue = shuffleWith(pool, rand);
  let lastId: string | null = null;
  let cycles = 0;
  return {
    next(): T | null {
      if (pool.length === 0) return null;
      if (queue.length === 0) {
        cycles += 1;
        queue = shuffleWith(pool, rand);
        if (queue.length > 1 && queue[0]?.id === lastId) queue.push(queue.shift() as T);
      }
      const card = queue.shift() as T;
      lastId = card.id;
      return card;
    },
    get remaining() {
      return queue.length;
    },
    get cycles() {
      return cycles;
    },
  };
}

export function formatClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
