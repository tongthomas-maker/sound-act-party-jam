import { CATEGORIES, CLUE_LABEL, filterCards, type CategoryId, type ClueType } from "./cards";
import { QUICK_CALL_CATEGORIES } from "./quickcall";
import type { PlayMode } from "./prefs";

/** Display-ready card used by the play screen for every mode. */
export interface PlayCard {
  id: string;
  prompt: string;
  icon: string;
  badge: string | null; // MIX IT! per-card clue badge
  hint: string; // bottom-of-card instruction
}

export const MODE_HINT: Record<ClueType | "quick", string> = {
  sound: "Make the sound!",
  act: "Act it out!",
  either: "Sound it or act it!",
  quick: "Shout an answer!",
};

export function buildPlayPool(mode: PlayMode, categories: CategoryId[]): PlayCard[] {
  if (mode === "quick") {
    return QUICK_CALL_CATEGORIES.flatMap((c) =>
      c.validLetters.map((letter) => ({
        id: `qc-${c.id}-${letter}`,
        prompt: c.promptTemplate.replace("{letter}", letter),
        icon: c.emoji,
        badge: null,
        hint: MODE_HINT.quick,
      })),
    );
  }
  const unique = [...new Set(categories)];
  const all = unique.length === CATEGORIES.length ? "all" : unique;
  return filterCards(mode, all).map((c) => ({
    id: c.id,
    prompt: c.prompt,
    icon: CATEGORIES.find((k) => k.id === c.category)?.emoji ?? "🎲",
    badge: mode === "mix" ? CLUE_LABEL[c.clueType] : null,
    hint: MODE_HINT[mode === "mix" ? c.clueType : mode],
  }));
}
