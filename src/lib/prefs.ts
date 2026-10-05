import {
  DEFAULT_ROUND_COUNT,
  DEFAULT_ROUND_LENGTH,
  isRoundCount,
  isRoundLength,
  type RoundCount,
  type RoundLength,
} from "./game";

export type PlayMode = "sound" | "act" | "mix";

export interface Prefs {
  music: boolean;
  sfx: boolean;
  haptics: boolean;
  flip: boolean;
  roundSeconds: RoundLength;
  rounds: RoundCount;
  mode: PlayMode;
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
    mode: mode === "sound" || mode === "act" || mode === "mix" ? mode : DEFAULT_PREFS.mode,
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
