# Sound It! final Mac handoff

2026-10-31 UTC. This replaces the manual assembly in `ios-static-experiment-0413.md` with one fail-closed command. **The actual static build and native preparation have not been executed here.** No game tests or font audits are repeated by this command.

## Run on Mac

Export the complete source, including `bun.lock` and `docs/`, into an ordinary local folder. Install these prerequisites first:

- Node **22 LTS, 22.12.0 or newer within 22.x**, with npm; Bun; Python **3.10+**.
- Full Xcode selected as the active developer directory, with first-launch setup/license completed. Capacitor 7 requires Xcode 16+ and iOS 14+; this is not a claim about current App Store upload requirements.
- CocoaPods (`pod` on PATH), internet for dependency/Chromium installation, free localhost port **8765**, and disk space for the source/dependencies/Chromium/iOS workspace.
- Your chosen reverse-domain bundle identifier. The command does not register it or access your Apple account.

Run this **single command**, substituting the exported folder and your identifier:

```bash
python3 "/absolute/path/to/exported-sound-it/docs/prepare-ios.py" --app-id com.yourcompany.soundit
```

The command rejects Linux and managed Lovable environments. It never builds against the original source. It prints a fresh `/private/var/.../sound-it-ios-...` workspace path immediately and preserves that folder on success or failure. No signing, archiving, Xcode opening, upload, deployment, or Apple enrollment is performed.

## Automatic sequence and gates

1. Copy source into a fresh candidate, excluding repository metadata at every depth, dependencies, old output, environment files, caches and symlinks. Hash included source before and after.
2. Install the existing frozen web lock. Add exact Fontsource **5.3.0** Anton/Archivo only to the candidate. Prepend the four full-subset weight imports and remove only the three known Google font links. Unexpected source text stops execution. Copy unchanged package OFL notices into public assets.
3. Generate the separate static config: prerender only `/`, retain the SSR build entry, disable discovery/crawling. Run the locally installed Vite once. Require a successful exit and actual fresh `dist/client/index.html`; reject development HTML, missing referenced assets, outside HTML/CSS assets and missing/changed licenses.
4. Install **Playwright 1.56.0** into a local venv. Run the existing strict verifier against the emitted bundle, not development/hosted HTML. Require exit 0 **and** fresh JSON PASS, both cold-launch font checks, no external requests/failures, and manual Points 1 / Passed 1 / Best streak 1. The existing verifier also observes Web Audio after a real tap. This is HTTP-based external-network blocking, not an installed airplane-mode result.
5. **Only after static PASS**, create a separate minimal native project with matched Capacitor CLI/core/iOS **7.4.3**, no remote `server.url`, and `webDir: www`. Add iOS, include motion-purpose text and both landscape directions for phone/tablet, then sync. Require the CocoaPods Xcode workspace and verify all copied static file hashes, including font notices. Known injected Capacitor bridge files are inventoried separately.

Each command has a separate log and a 20-minute timeout. A failure stops subsequent stages. Do not interpret output written by a timed-out build as success.

## Evidence to return

Keep the **entire workspace**, especially:

- `handoff-result.json`, `versions.json`, all stage logs, `static-inventory.json`, `native-inventory.json`.
- Candidate `package.json` and `bun.lock`, native `package.json` and `package-lock.json`.
- `candidate/static-evidence/result.json`, screenshots and `files.txt`.
- `candidate/dist/client/` and `native/ios/App/App.xcworkspace`.

Only `STATIC_PASS_NATIVE_WORKSPACE_PREPARED` with exit 0 means the sequence succeeded. The report still explicitly says **native_build: NOT_RUN** and **device_checks: NOT_RUN**. A browser verification failure leaves no native directory; a later native-stage failure can leave a partial native directory, which is not success.

The control flow and selected direct dependency versions are deterministic, and the web baseline uses a frozen lock. **First-run transitive resolution for added font/native packages and the local Bun/Python versions are not fully pinned.** Their locks and actual versions are preserved; use these reviewed locks and the same tools for repeat release builds. No bit-for-bit reproducible binary claim is made.

## What remains on Mac/devices

After success, open the reported `.xcworkspace` in Xcode. Review bundle identity, generated targets, dependency privacy notices, motion text and icons. Configure signing only as a separately approved step; this handoff does not create an IPA or installation link.

On real iPhone and iPad mini, test the packaged WKWebView separately from Safari: permission grant/denial/retry, manual fallback, DOWN=GOT IT!/UP=PASS, both landscapes, mid-card rotation, rearm/debounce, one score per card, audible countdown/correct/PASS/TIME!, interruptions/silent switch, and installed airplane-mode cold launch. Use `ios-qa-handoff.md`. Static Chromium PASS cannot establish these outcomes or typography parity.

Apple membership/team, signing, current SDK/upload requirements, store assets/privacy, archive validation and TestFlight processing remain unverified. Nothing is uploaded by this command.

## Safe local tooling check (no builds/downloads)

```bash
python3 docs/test-ios-handoff.py -v
```

These synthetic fixtures validate ordering, source preservation, exclusions and failure gates. They do not contain real game output or fonts and are not evidence of a static/native build.