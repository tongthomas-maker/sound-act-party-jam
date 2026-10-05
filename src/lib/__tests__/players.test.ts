import { beforeEach, describe, expect, it } from "vitest";
import { loadRoster, loadSelection, newPlayer, saveRoster, saveSelection } from "../players";

beforeEach(() => {
  const m = new Map<string, string>();
  const ls = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  (globalThis as unknown as { window: unknown }).window = {};
  (globalThis as unknown as { localStorage: unknown }).localStorage = ls;
});

describe("durable roster vs temporary selection", () => {
  it("persists roster and selection independently", () => {
    const a = newPlayer("  Ann "), b = newPlayer("Bo");
    expect(a.name).toBe("Ann");
    saveRoster([a, b]);
    saveSelection([b.id]);
    expect(loadRoster().map((p) => p.name)).toEqual(["Ann", "Bo"]);
    expect(loadSelection()).toEqual([b.id]);
    saveSelection([]); // deselecting everyone never deletes saved players
    expect(loadRoster()).toHaveLength(2);
  });
  it("empty storage gives empty roster", () => {
    expect(loadRoster()).toEqual([]);
    expect(loadSelection()).toEqual([]);
  });
});
