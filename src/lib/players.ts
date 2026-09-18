export interface Player {
  id: string;
  name: string;
}

const ROSTER_KEY = "sound-it:roster";
const SELECTION_KEY = "sound-it:selection";
const LEGACY_KEY = "sound-it:players";

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

/** Durable saved roster of player names on this device. */
export function loadRoster(): Player[] {
  const roster = read<Player[]>(ROSTER_KEY);
  if (Array.isArray(roster)) return roster.filter((p) => p && p.id && p.name);

  // migrate old shape { id, name, active }
  const legacy = read<(Player & { active?: boolean })[]>(LEGACY_KEY);
  if (Array.isArray(legacy) && legacy.length) {
    const migrated = legacy.map((p) => ({ id: p.id, name: p.name }));
    write(ROSTER_KEY, migrated);
    write(
      SELECTION_KEY,
      legacy.filter((p) => p.active !== false).map((p) => p.id),
    );
    return migrated;
  }
  return [];
}

export function saveRoster(players: Player[]) {
  write(ROSTER_KEY, players);
}

/** Temporary-ish per-device selection of who is playing next game. */
export function loadSelection(): string[] {
  const sel = read<string[]>(SELECTION_KEY);
  return Array.isArray(sel) ? sel : [];
}

export function saveSelection(ids: string[]) {
  write(SELECTION_KEY, ids);
}

export function newPlayer(name: string): Player {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
  };
}
