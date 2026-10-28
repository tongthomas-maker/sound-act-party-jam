# Sound It! — isolated static prerender experiment 04–13

2026-10-28 UTC. **Prepared, not executed. No static/native readiness claim.**

## Actual evidence and restriction

- Full automated suite executed: **138/138 tests, 12/12 files passed**, 04:44:08 UTC, 3.99 seconds.
- Installed wrapper is `@lovable.dev/vite-tanstack-config` **2.26.5**, above the 2.20.0 prerender minimum. Vite **8.1.5**, Start **1.168.60**. Use the committed lockfile, not older trial versions.
- Production `vite.config.ts` remains unchanged. There is no `dist/client/index.html` or existing production output here to serve.
- Explicit environment rule: **“Do not run the Lovable project's builds or typechecks manually because the harness runs them automatically.”** A disposable copy/alternate config does not bypass this restriction. No build command was attempted or failed; this is an instruction-level execution block, not a compiler failure.
- Consequently: experimental build exit code, emitted assets, cold offline startup, bundled sound/manual scoring **NOT VERIFIED**. An automatic production build signal cannot establish any of them. No new independent TypeScript check was run.
- Current `/` renders visitor-independent setup HTML. Player/preferences storage is read after hydration; no content loader/session/request-dependent data was found. Root QueryClient has no explicit finite GC timer. Prerender only `/`, disable discovery and crawling; retain the existing SSR entry for build-time rendering.
- Google Fonts in `src/routes/__root.tsx` are external. Blocking them may permit gameplay using fallback fonts, but **offline font/visual parity is not established**. Do not change live fonts as part of this experiment.

## Reproducible Mac experiment

Prerequisites: exported source folder including `bun.lock`, Bun, Python 3, a current supported Node release, and internet for dependency installation only. Run these commands in a separate Terminal, never in the live project workspace. No Xcode/signing/Apple account is needed for this static trial.

```bash
set -euo pipefail
SOURCE="/absolute/path/to/exported-sound-it"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/sound-it-static-0413.XXXXXX")"
rsync -a \
  --exclude='.git/' --exclude='node_modules/' --exclude='dist/' \
  --exclude='.output/' --exclude='.tanstack/' --exclude='.nitro/' \
  --exclude='.wrangler/' --exclude='.workspace/' --exclude='.lovable/' \
  --exclude='.env*' --exclude='.dev.vars*' --exclude='*.local' \
  "$SOURCE/" "$WORK/"
cd "$WORK"
printf 'Disposable workspace: %s\n' "$WORK"
shasum -a 256 "$SOURCE/vite.config.ts" > source-vite-before.sha256
bun --version
node --version
bun install --frozen-lockfile
cat > vite.static-experiment.ts <<'TS'
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    pages: [{ path: "/" }],
    prerender: {
      enabled: true,
      autoStaticPathsDiscovery: false,
      crawlLinks: false,
      failOnError: true,
    },
  },
});
TS
bunx vitest run 2>&1 | tee static-tests.log
# Outside the managed build environment; never use the development server as evidence.
# pipefail makes a nonzero build exit stop this procedure even when tee succeeds.
env -u LOVABLE_SANDBOX -u SANDBOX \
  bunx vite build --config vite.static-experiment.ts 2>&1 | tee static-build.log
printf 'Experimental build exited successfully\n'
test -s dist/client/index.html
python3 - <<'PY'
from pathlib import Path
root = Path('dist/client')
files = sorted(p for p in root.rglob('*') if p.is_file())
print('\n'.join(str(p) for p in files))
assert any(p.suffix == '.js' for p in files), 'No JavaScript output'
assert any(p.suffix == '.css' for p in files), 'No CSS output'
html = (root / 'index.html').read_text()
assert '/@vite/client' not in html and '/src/' not in html, 'Development HTML, not static output'
assert 'START GAME' in html, 'Root setup was not prerendered as expected'
PY
shasum -a 256 "$SOURCE/vite.config.ts" > source-vite-after.sha256
cmp source-vite-before.sha256 source-vite-after.sha256
python3 -m venv .qa-venv
. .qa-venv/bin/activate
python -m pip install 'playwright==1.56.0'
python -m playwright install chromium
python docs/verify-static-0413.py 2>&1 | tee static-browser.log
```

If a command fails, preserve the disposable workspace and log and **stop**. Do not fall back to hosted HTML or Vite preview. If the build writes all pages but never exits, record that separately; inspect render-time timers/Query GC before proposing a fix. The wrapper may pin `failOnError` to false in managed builds, so exit 0 alone is never enough: require a newly emitted root document plus successful browser checks. These commands and this config have **not** been built on Mac here.

## What the supplied verifier establishes if it passes

`docs/verify-static-0413.py` serves **only `dist/client`** at `http://localhost:8765`, using Python's static server. Port 8765 must be free. It creates fresh Chromium contexts with service workers disabled and blocks all external requests **before first navigation**; the local HTTP server remains reachable. Do not use browser-wide offline mode, which also blocks the local server.

The verifier requires root HTTP 200, visible setup, local JS/CSS, no failed local asset requests/page errors, two manually created players, a real tap to unlock Web Audio, a 30-second round, GOT IT! then PASS, and final **Points 1 / Passed 1 / Best streak 1**. It observes real AudioContext running state, advancing clock and oscillator starts without mocking playback. A second empty context checks cold startup again. Output includes screenshots, asset inventory and `static-evidence/result.json`. FAIL is saved even if the run raises an exception.

External fonts are explicitly blocked and listed. A gameplay PASS with fallback fonts is **not** an all-assets-local/appearance PASS. Review emitted HTML/CSS and inventory for licensed font packaging needs before native packaging. Web Audio state is **not evidence of audible sound**; listen manually on Mac, then test physical iOS. No permission/sensor mock proves native permission behavior.

## Owner result checklist / next gate

- [ ] Build exits 0 and newly emits `dist/client/index.html`; preserve complete log and warnings.
- [ ] Local asset inventory and verifier PASS; blocked external requests reviewed, not hidden.
- [ ] Manual Mac listening: countdown, correct chord, PASS buzzer, TIME!; no server or network dependency for sounds.
- [ ] Offline font/visual parity assessed separately; no source gameplay changes.
- [ ] Mac/Xcode only **after** static pass: create a disposable native shell, point its local asset directory to verified `dist/client`, sync/open iOS there. Do not point to preview URL or copy server output into the app.
- [ ] Physical iPhone/iPad mini: fresh permission grant/denial/retry, manual buttons, both landscape directions and mid-card 180° rotation, DOWN=GOT IT!/UP=PASS, one score per card, sound/silent switch/interruption, cold airplane-mode launch of installed shell.

**Owner blocker:** Mac build and static verifier execution. Why: sandbox build restriction. Work preserved: commands, candidate config, verifier and existing V1/tests. Other safe work completed: source dependency audit and 138 regressions. Later blockers: verified local assets/visuals, native project, physical-device QA, Apple signing/TestFlight requirements. Nothing was deployed, signed or submitted.