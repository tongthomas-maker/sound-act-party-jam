/** Developer-only tilt diagnostics (readout, SWAP, AUTO CALIBRATE) show only in dev builds. */
export function showTiltDiagnostics(env: { DEV?: boolean } = import.meta.env): boolean {
  return env.DEV === true;
}
