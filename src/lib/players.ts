export interface Player {
  id: string;
  name: string;
  active: boolean;
}

const KEY = "sound-it:players";

export function loadPlayers(): Player[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Player[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePlayers(players: Player[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(players));
  } catch {
    /* ignore */
  }
}

export function newPlayer(name: string): Player {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    active: true,
  };
}
