import { beforeEach, describe, expect, it } from "vitest";
import { buildPlayPool } from "../playcards";
import { loadRoster, loadSelection } from "../players";

describe("batch34: legacy roster migration", () => {
  let m: Map<string, string>;
  beforeEach(() => {
    m = new Map();
    (globalThis as unknown as { window: unknown }).window = {};
    (globalThis as unknown as { localStorage: unknown }).localStorage = {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
    };
  });
  it("skips malformed legacy entries instead of crashing", () => {
    m.set(
      "sound-it:players",
      JSON.stringify([
        null,
        { id: "1", name: "  Ann  " },
        { id: 2, name: "x" },
        { id: "3", name: " ", active: true },
        { id: "4", name: "Bo", active: false },
      ]),
    );
    expect(loadRoster()).toEqual([
      { id: "1", name: "Ann" },
      { id: "4", name: "Bo" },
    ]);
    expect(loadSelection()).toEqual(["1"]);
  });
});

describe("batch34: category selection", () => {
  it("duplicate category ids are not treated as all categories", () => {
    expect(buildPlayPool("sound", ["animals", "animals", "animals", "animals"])).toEqual(
      buildPlayPool("sound", ["animals"]),
    );
  });
});
