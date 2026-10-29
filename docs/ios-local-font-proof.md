# Sound It! isolated local-font proof

2026-10-29 UTC. **Font-only proof PASS. No production adoption, static app build, or native readiness claim.**

## Actual evidence

- Ran `docs/prove-local-fonts.py` in `/tmp/browser/font-proof/run-1`; no app source, live styles, package manifest, lockfile or production config changed.
- Downloaded `@fontsource/anton@5.3.0` and `@fontsource/archivo@5.3.0` directly from npm into temporary storage. Verified package SHA-512 integrity against registry metadata, inspected both included copyright/OFL texts, and retained them beside the proof fonts.
- Both packages declare **OFL-1.1** and include the **SIL Open Font License Version 1.1**. Unmodified font embedding/redistribution is permitted under its terms; retain copyright and license notices. Font software may not be sold by itself; modified fonts have additional naming requirements. No fonts were modified.
- Served ordinary HTML/CSS/WOFF2 with Python's static HTTP server, not Vite or SSR. Blocked all outside requests before navigation; disabled service workers; used two independent fresh Chromium contexts.
- Each launch fetched all four fonts locally with HTTP 200 and returned one genuinely loaded FontFace for every requested weight. Checked `document.fonts.load`, loaded status, and `document.fonts.check` rather than assuming that fallback text proves availability.
- **2/2 cold font launches passed; 0 blocked external requests; 0 browser/request failures.** Inspected the second-launch screenshot: Anton and the three Archivo weights render distinctly.
- Python syntax: proof and existing static-game verifier PASS. Full game tests: **138/138 across 12 files**, 19:44:51 UTC, 6.40s.
- Automatic production log: build OK at 19:44:35 UTC. No manual production/static build or typecheck ran.

| Font | Weight | Local WOFF2 bytes |
|---|---:|---:|
| Anton | 400 | 18,612 |
| Archivo | 500 | 14,600 |
| Archivo | 700 | 14,508 |
| Archivo | 900 | 13,548 |

Total: 61,268 bytes. These are **Latin subsets only**. Arbitrary player names in other scripts, emoji, and missing glyphs may use system fallback. A later adoption must explicitly choose full package subsets or reviewed language coverage; this proof does not establish whole-app typography parity or equivalence to Google's font revisions.

## Reproduce on Mac without modifying V1

Requires Python 3, internet for npm package downloads only, Playwright and Chromium. No Bun/Vite build, Xcode or Apple account is required for this font-only proof.

```bash
set -euo pipefail
SOURCE="/absolute/path/to/exported-sound-it"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/sound-it-fonts.XXXXXX")"
python3 -m venv "$WORK/venv"
"$WORK/venv/bin/python" -m pip install 'playwright==1.56.0'
"$WORK/venv/bin/python" -m playwright install chromium
"$WORK/venv/bin/python" "$SOURCE/docs/prove-local-fonts.py" \
  --work "$WORK/proof" 2>&1 | tee "$WORK/font-proof.log"
```

The proof directory must not exist beforehand; the script never overwrites a prior run. It downloads before browser verification. The local HTTP server remains reachable while all outside browser requests are blocked (browser-wide offline mode would also block that server).

Require `proof/result.json` status PASS, two launches, all four weights loaded in each, empty `blocked_external` and `failures`. Preserve `inventory.json`, metadata, package archives, both license texts, screenshots and log. A download/integrity/license failure stops preparation; browser failures write FAIL. Commands were executed here using preinstalled Playwright; the Mac setup commands themselves have not been run on a Mac.

## Reversible production adoption plan — not applied

1. Obtain separate approval for live font loading changes. First trial adoption only in a disposable exported workspace; preserve original source/config/manifest/lockfile outside it.
2. Pin `@fontsource/anton@5.3.0` and `@fontsource/archivo@5.3.0` there. Use package CSS imports for Anton 400 and Archivo 500/700/900 at the top of `src/styles.css` before `@source` or other rules. The full package weight CSS includes additional language subsets, unlike this Latin-only proof.
3. Remove only the Google Fonts stylesheet and its two preconnect entries from `src/routes/__root.tsx`. Keep existing font-family tokens and weights unchanged. Keep Archivo Black as the existing fallback; do not add an unnecessary third font.
4. Include the exact package copyright/OFL notices in the distributed package/legal materials and the planned font credit in release notes. Ensure distribution tooling actually retains the notices.
5. Compare setup, play and results screenshots at phone/tablet sizes, including accented/non-Latin player names and line wrapping. Run all regressions. Then run the existing isolated static build and `docs/verify-static-0413.py` on Mac, requiring real `dist/client/index.html`, local emitted font assets and zero outside requests.
6. Only after owner approval adopt the same narrow changes in production. Rollback: restore original stylesheet/root files and manifest/lockfile as a matching set, restoring Google links and removing local font imports. Do not remove unrelated changes or deploy as part of this proof.

## Remaining gates

- Full static-game cold launch/scoring/audio/tilt fallback: **not verified**; manual builds remain prohibited here, including disposable copies. Use `docs/ios-static-experiment-0413.md` on Mac after experimental local-font adoption. The unchanged live game's Google Fonts links still fail that verifier's self-contained-assets rule.
- Whole-app visual parity, audible sound, real iOS permission/sensors, WKWebView local-font loading and installed airplane-mode launch: **not verified**.
- No deploy, Apple upload, gameplay changes or font assets added to the live app. Temporary fonts are proof-only, not app-served media.