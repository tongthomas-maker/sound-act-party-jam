import {
  DEFAULT_ROUND_COUNT,
  DEFAULT_ROUND_LENGTH,
  isRoundCount,
  isRoundLength,
  type RoundCount,
  type RoundLength,
} from "./game";

export type PlayMode = "sound" | "act" | "mix" | "quick";

export interface Prefs {
  music: boolean;
  sfx: boolean;
  haptics: boolean;
  flip: boolean;
  roundSeconds: RoundLength;
  rounds: RoundCount;
  mode: PlayMode;
  /** Master volume 0–100. */
  volume: number;
  /** Completed games on this device (unlocks Quick Call). */
  gamesCompleted: number;
}

export const PREFS_KEY = "sound-it:prefs";

export const DEFAULT_PREFS: Prefs = {
  music: true,
  sfx: true,
  haptics: true,
  flip: false,
  roundSeconds: DEFAULT_ROUND_LENGTH,
  rounds: DEFAULT_ROUND_COUNT,
  mode: "mix",
  volume: 80,
  gamesCompleted: 0,
};

/** Validates unknown stored data field-by-field, falling back to defaults. */
export function parsePrefs(raw: unknown): Prefs {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const bool = (k: keyof Prefs) =>
    typeof o[k] === "boolean" ? (o[k] as boolean) : (DEFAULT_PREFS[k] as boolean);
  const mode = o["mode"];
  return {
    music: bool("music"),
    sfx: bool("sfx"),
    haptics: bool("haptics"),
    flip: bool("flip"),
    roundSeconds: isRoundLength(o["roundSeconds"]) ? o["roundSeconds"] : DEFAULT_PREFS.roundSeconds,
    rounds: isRoundCount(o["rounds"]) ? o["rounds"] : DEFAULT_PREFS.rounds,
    volume:
      typeof o["volume"] === "number" && Number.isFinite(o["volume"])
        ? Math.max(0, Math.min(100, Math.round(o["volume"] as number)))
        : DEFAULT_PREFS.volume,
    gamesCompleted:
      typeof o["gamesCompleted"] === "number" && Number.isFinite(o["gamesCompleted"])
        ? Math.max(0, Math.floor(o["gamesCompleted"] as number))
        : 0,
    mode:
      mode === "sound" || mode === "act" || mode === "mix" || mode === "quick"
        ? mode
        : DEFAULT_PREFS.mode,
  };
}

export function loadPrefs(storage: Pick<Storage, "getItem"> | null = safeStorage()): Prefs {
  if (!storage) return { ...DEFAULT_PREFS };
  try {
    const raw = storage.getItem(PREFS_KEY);
    return parsePrefs(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(p: Prefs, storage: Pick<Storage, "setItem"> | null = safeStorage()) {
  if (!storage) return;
  try {
    storage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* ignore quota / private mode */
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}
