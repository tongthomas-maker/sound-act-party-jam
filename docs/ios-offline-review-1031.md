# Sound It! offline preparation review — 2026-10-31 UTC

## One confirmed verifier issue corrected

The static checker previously required local JavaScript/CSS and rejected outside requests, but did not require custom fonts. Omitted font declarations could silently use system fallback. `verify-static-0413.py` now requires genuinely loaded Anton 400 and Archivo 500/700/900 faces in both fresh launches. Multiple subset faces are allowed. Its entry point is guarded so the isolated regression can import the real check without starting a game verifier.

`test-static-fonts.py` tests that same helper against the licensed font proof, then removes the stylesheet declarations and confirms rejection. No app source, production settings, dependencies, or gameplay changed.

## Executed evidence

- Full game suite: **138/138 tests, 12/12 files**, 01:35:55 UTC, 3.94 seconds.
- Licensed pinned-font proof rerun in temporary storage: **PASS**, two fresh launches, zero outside requests and zero browser/request failures; registry integrity and included OFL notices checked.
- Font-gate browser regressions: **3/3 checks PASS** — both local-font launches accepted; missing declarations rejected.
- Python syntax: all three proof/verifier/regression scripts **PASS**.
- One regression-fixture retry: `document.fonts.clear()` does not remove CSS-connected faces. Removing the stylesheet declarations reproduced the actual omitted-font condition and passed the negative check. No production correction was needed.
- Automatic build log: **build OK at 2026-10-31T01:37:23Z**. No independent production/static build or typecheck executed. Existing redundant `vite-tsconfig-paths` warning remains; configuration unchanged.

## Remaining native gates

1. On Mac, use the disposable workspace instructions in `ios-static-experiment-0413.md`. Prerequisites: exported source with `bun.lock`, Bun, supported Node, Python 3, `rsync`, `shasum`, internet for installation, and Playwright/Chromium. Sandbox rules prohibit manual builds here, including copied workspaces.
2. Apply the licensed font trial only in that disposable workspace, retaining OFL notices and comparing visual/language coverage (`ios-local-font-proof.md`). The unchanged live Google Fonts links still fail the self-contained-assets check.
3. Require a successful build, newly emitted `dist/client/index.html`, local asset inventory and static verifier PASS: two cold launches with outside requests blocked, real manual GOT IT!/PASS scoring and running Web Audio after tap. Review both font result arrays. No static-game PASS exists yet.
4. Create the separate local-asset iOS package using Mac/Xcode only after static verification. No native project, archive, IPA or installation path is present here.
5. On physical iPhone and iPad mini, test permission grant/denial/retry, DOWN=GOT IT!/UP=PASS, both landscape directions, mid-card rotation, one score per card, manual fallback, audible sound/silent switch/interruption, and installed airplane-mode cold launch. Safari and packaged WKWebView need separate checks (`ios-owner-sound-rotation-check.md`).
6. Confirm Apple membership/team/signing, bundle identity, icons/screenshots, privacy disclosures and current upload requirements before any separately approved TestFlight upload. These account/device conditions remain unverified, not asserted missing.

No deployment, signing or Apple upload. Font-only Chromium results do not establish whole-app offline launch, audibility, visual parity or native readiness.