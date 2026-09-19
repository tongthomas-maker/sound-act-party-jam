/**
 * ⚡ QUICK CALL — category + starting letter rapid recall.
 *
 * Data model is intentionally extensible:
 *  - `style` allows future "creative" categories (group judges the answer).
 *  - `family` is a grouping key that future Theme Packs / presets can select by.
 *    Theme Packs are NOT implemented yet; the field only keeps the door open.
 *  - `validLetters` is per-category. We never randomize A–Z blindly: a letter is
 *    only listed when an ordinary player could reasonably name an answer.
 */

export type QuickCallStyle = "knowledge" | "creative";
export type QuickCallFamily =
  | "geography"
  | "food"
  | "animals"
  | "everyday";

export interface QuickCallCategory {
  id: string;
  name: string;
  emoji: string;
  /** {letter} is replaced with the drawn letter. */
  promptTemplate: string;
  style: QuickCallStyle;
  family: QuickCallFamily;
  validLetters: string[];
}

const L = (s: string) => s.split("");

export const QUICK_CALL_CATEGORIES: QuickCallCategory[] = [
  {
    id: "us-states",
    name: "U.S. STATES",
    emoji: "🗺️",
    promptTemplate: "Name a U.S. state that starts with {letter}.",
    style: "knowledge",
    family: "geography",
    // No U.S. state begins with B, E, J, Q, X, Y or Z.
    validLetters: L("ACDFGHIKLMNOPRSTUVW"),
  },
  {
    id: "countries",
    name: "COUNTRIES",
    emoji: "🌍",
    promptTemplate: "Name a country that starts with {letter}.",
    style: "knowledge",
    family: "geography",
    // W and X have no well-known country.
    validLetters: L("ABCDEFGHIJKLMNOPQRSTUVYZ"),
  },
  {
    id: "fruits",
    name: "FRUITS",
    emoji: "🍓",
    promptTemplate: "Name a fruit that starts with {letter}.",
    style: "knowledge",
    family: "food",
    validLetters: L("ABCDFGHKLMNOPRSTW"),
  },
  {
    id: "animals",
    name: "ANIMALS",
    emoji: "🐾",
    promptTemplate: "Name an animal that starts with {letter}.",
    style: "knowledge",
    family: "animals",
    validLetters: L("ABCDEFGHIJKLMNOPRSTWZ"),
  },
  {
    id: "foods",
    name: "FOODS",
    emoji: "🍕",
    promptTemplate: "Name a food that starts with {letter}.",
    style: "knowledge",
    family: "food",
    validLetters: L("ABCDEFGHIJKLMNOPRSTVWY"),
  },
  {
    id: "brands",
    name: "BRANDS",
    emoji: "🏷️",
    promptTemplate: "Name a brand that starts with {letter}.",
    style: "knowledge",
    family: "everyday",
    validLetters: L("ABCDEFGHIJKLMNOPRSTUVWY"),
  },
];

export const QUICK_CALL_CATEGORY_IDS = QUICK_CALL_CATEGORIES.map((c) => c.id);

export interface QuickCallCard {
  key: string;
  categoryId: string;
  categoryName: string;
  emoji: string;
  letter: string;
  prompt: string;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

/** Total distinct category+letter combinations in the chosen pool. */
export function quickCallPoolSize(categoryIds: string[]): number {
  return QUICK_CALL_CATEGORIES.filter((c) => categoryIds.includes(c.id)).reduce(
    (n, c) => n + c.validLetters.length,
    0,
  );
}

/**
 * Draw one card from the eligible pool, avoiding anything in `recent`
 * (the caller keeps a short sliding window of recently shown keys).
 */
export function drawQuickCallCard(
  categoryIds: string[],
  recent: string[] = [],
): QuickCallCard | null {
  const pool = QUICK_CALL_CATEGORIES.filter((c) => categoryIds.includes(c.id));
  if (!pool.length) return null;

  const make = (cat: QuickCallCategory, letter: string): QuickCallCard => ({
    key: `${cat.id}:${letter}`,
    categoryId: cat.id,
    categoryName: cat.name,
    emoji: cat.emoji,
    letter,
    prompt: cat.promptTemplate.replace("{letter}", letter),
  });

  for (let attempt = 0; attempt < 24; attempt++) {
    const cat = pick(pool);
    const letter = pick(cat.validLetters);
    const card = make(cat, letter);
    if (!recent.includes(card.key)) return card;
  }
  const cat = pick(pool);
  return make(cat, pick(cat.validLetters));
}
