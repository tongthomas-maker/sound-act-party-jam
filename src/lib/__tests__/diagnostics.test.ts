import { describe, expect, it } from "vitest";
import { showTiltDiagnostics } from "../diagnostics";

describe("tilt diagnostics visibility", () => {
  it("hidden in production builds", () => {
    expect(showTiltDiagnostics({ DEV: false })).toBe(false);
  });
  it("hidden when the flag is missing", () => {
    expect(showTiltDiagnostics({})).toBe(false);
  });
  it("shown in development", () => {
    expect(showTiltDiagnostics({ DEV: true })).toBe(true);
  });
});
