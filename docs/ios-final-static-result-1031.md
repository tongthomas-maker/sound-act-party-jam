# Sound It! — final static deliverable status

2026-10-31 UTC, checks executed at 01:53 UTC. **Static-game deliverable BLOCKED; not built or verified.**

## Exact executed results

| Check | Result | Evidence |
|---|---|---|
| Full game regressions | PASS | 138/138 tests, 12/12 files; 5.41 seconds; exit 0 |
| Licensed font-only offline proof | PASS | 2/2 fresh Chromium contexts; four local weights each; zero external requests/failures; exit 0 |
| Real font-verifier regressions | PASS | 4/4 checks: two accepted launches, missing Archivo 900 rejected, omitted declarations rejected; exit 0 |
| Warning-strict Python compilation | PASS | All three proof/verifier scripts, using `compile()` with `-W error` |
| Static verifier invocation | FAIL — missing-input precondition | Exit 1: `Missing dist/client/index.html; stop, do not serve development HTML`; no browser/game check ran |
| Disposable static build | BLOCKED / NOT RUN | Explicit environment instruction prohibits manual project builds/typechecks, including copied workspaces |
| Whole-game offline cold launch/assets/scoring/audio | NOT VERIFIED | No emitted static game root exists; font-only success is not game success |
| Automatic managed build signal | PASS, limited scope | Latest inspected entry: build OK at 2026-10-31T01:53:50Z; not evidence of experimental static output |

Reproduced and corrected one isolated tooling defect: Python treated the JavaScript regex `\s` as an invalid Python escape, failing warning-strict compilation. Making that JavaScript string raw preserves the regex and passes the existing real-browser font regressions. No gameplay, production configuration, dependencies, live fonts, font binaries, signing or deployment changed.

Temporary logs and font evidence are under `/tmp/browser/final-static/`. The second font-launch screenshot was inspected. These are disposable evidence, not an installation package. The missing-input verifier exits before its report-writing block, so this precondition failure is preserved in `static-verifier.log`, not a generated `static-evidence/result.json`.

## Next build-capable workspace gate

Use the full commands in `docs/ios-static-experiment-0413.md` in an unrestricted disposable exported-source workspace. This static trial does not itself require Mac/Xcode; Mac is required for the later native iOS work.

Prerequisites: exported source **with `bun.lock`**, Bun, a supported Node release compatible with the locked toolchain, Python 3, `rsync`, `shasum`, free port 8765, internet for installation, and Playwright/Chromium. Record actual Bun/Node/Python versions with the result; the existing instructions do not pin Bun/Node versions and have not been executed on Mac here.

The reference to font-proof steps 2–4 means the numbered **Reversible production adoption plan** in `docs/ios-local-font-proof.md`, applied only to the disposable candidate: pinned Fontsource 5.3.0 packages, four local CSS weight imports, remove only the Google stylesheet/preconnects there, retain both package OFL notices. Do not copy the Latin-only synthetic proof site over the game. Unchanged Google links deliberately fail the strict outside-request gate.

Require all of the following before calling the static game PASS:

1. Successful build exit **and newly emitted** `dist/client/index.html`; preserve full build log and local inventory. Do not substitute the live preview or development HTML.
2. Strict verifier exit 0 and `static-evidence/result.json` status PASS: two fresh launches with outside requests blocked, local JS/CSS and real loaded font weights, no asset/page failures.
3. Real manual GOT IT! then PASS and final Points 1 / Passed 1 / Best streak 1; running Web Audio with advancing clock and oscillator playback after a tap.
4. Separately inspect retained licenses, glyph coverage, visuals and listen for sound. Browser audio state does not prove audibility.

## Mac/device-only gates

- After static PASS, create the separate local-asset iOS shell using Mac/Xcode. No native project, IPA, signed archive or installation path exists here.
- On physical iPhone and iPad mini, separately test Safari and packaged WKWebView: permission grant/denial/retry, manual fallback, DOWN=GOT IT!/UP=PASS, both landscape directions, mid-card rotation, rearm/debounce and one score per card.
- Listen for countdown/correct/PASS/TIME! audio; test silent-switch/interruption behavior and installed airplane-mode cold launch.
- Verify Apple membership/team/signing, bundle identity, icons/screenshots, privacy disclosures and current TestFlight requirements before any separately approved upload. These conditions remain unverified, not asserted missing.

Owner action: run the disposable static procedure outside this restricted environment and return its full build log, asset inventory and verifier result. All permitted coding checks are complete; nothing continues in the background.