# Sound It! — V1 native iOS release handoff

Prepared 2026-10-28, release batch 04–09. Readiness documentation only: no native dependencies, project generation, signing, upload, deployment, credential changes, or gameplay changes.

## Current evidence

- 138/138 automated tests pass across 12 files, including seven tilt-to-score/clock harness cases. These exercise DOWN = GOT IT!, UP = PASS, neutral return, held events, same-card debounce, permission denial/manual fallback, and expiry cutoff.
- Targeted ESLint passed with no warnings for `src/hooks/use-tilt-controls.ts`, `src/lib/__tests__/tilt-round-harness.test.ts`, and `src/routes/index.tsx`.
- Fresh Chromium session: added two players through the UI, chose 30s, started a turn, tapped GOT IT! then PASS, waited for TIME!; summary read 1 point, 1 passed, best streak 1, and next-player handoff. No page errors. This is not physical iOS verification or an audio audibility check.
- No proven source-level release-blocking gameplay defect was reproduced; no application code changed. Existing V1 scoring, turn order, categories, timers, reset and visuals remain intact.
- Manual production builds and TypeScript checks were **not executed**: environment instructions reserve them for the automatic verifier. Automatic build status must be reported separately; a successful test/lint/browser run does not establish a production build or typecheck result.
- Automatic verifier log inspected after edits: **build OK**, 2026-10-28T04:33:44Z. No independent production-build or explicit TypeScript result is exposed. Dev server reports a non-blocking redundant `vite-tsconfig-paths` plugin warning; configuration was not changed.

## Native packaging status

This repository is a TanStack Start web app. No Capacitor configuration/dependencies, Xcode iOS project, signed archive, IPA, or TestFlight invitation is present. A separately maintained native project/account could exist, but was not inspected. A browser shortcut is not an App Store package.

### Non-destructive next packaging gate (not implemented)

1. Preserve this web project; evaluate native packaging in a separate reviewed workspace. Do not replace the router, change rules, or run native initialization against this repository during this documentation batch.
2. A potential Capacitor shell needs a self-contained built web directory with `index.html` at its root. Do **not** assume TanStack Start's SSR output or an arbitrary `dist` directory satisfies `webDir`. Server rendering cannot execute inside WKWebView.
3. Prove the existing client gameplay can launch from bundled assets, with correct asset paths, without a remote server. Validate setup, all modes/categories, round start, expiry, summary, final totals, replay and local roster/preferences. Do not invent an export configuration without testing it.
4. For offline packaging, audit every asset: current Anton/Archivo fonts load from Google Fonts. Cold offline startup and appearance are not guaranteed. Bundle appropriately licensed fonts through a separate approved packaging task if needed; preserve the appearance.
5. Do not use the temporary Lovable preview URL or Capacitor development live-reload `server.url` as the production app. A hosted-only shell adds network dependence and App Review risk; it is not evidence of bundled/offline operation.
6. On macOS with compatible Xcode, a later approved packaging task must configure a stable bundle ID, supported iPhone/iPad targets and both landscape orientations, version/build numbers, icon assets, safe areas, motion permission handling and signing. Audit the native dependency privacy report.
7. Run the device script in `ios-owner-sound-rotation-check.md` in Safari **and again in the actual packaged WKWebView**. Safari results do not sign off the native container. Archive validation, install/relaunch and cold offline play are separate gates.

No packaging architecture is implemented or selected by this handoff. Capacitor is a candidate, not a guaranteed drop-in export.

## Apple / TestFlight gate list

| Gate | Evidence / blocker | Responsible next step |
|---|---|---|
| Real-device acceptance | iPhone/iPad QA results remain blank | Owner tests both devices; report failures before release |
| Native artifact | No native project/archive/IPA in repository | Approved packaging work plus macOS/Xcode build |
| Developer membership | Enrollment, team and agreements unverified | Owner checks Apple Developer → Account; no enrollment attempted |
| Identity/signing | Bundle ID, team, certificates/profiles unverified | Owner/native packager configures signing later; never paste credentials into chat |
| SDK/toolchain | Apple currently lists Xcode 26+ and iOS/iPadOS 26+ SDK; minimum target iOS 13+ | Recheck live Apple requirements before creating/uploading an archive; dependencies may require a newer minimum |
| Store record/assets | App record, screenshots, icon, URLs and rights not verified | Complete `ios-store-checklist.md` |
| Privacy | Final native traffic/SDK audit and policy/labels absent | Resolve fonts, error reporting, native manifests and disclosures before upload |
| TestFlight distribution | No processed signed build or invitation verified | After approval: upload/process, resolve export compliance, provide beta description/feedback contact; external beta review may be required |
| App Review | Acceptance cannot be guaranteed | Document real playable value; assess guideline 4.2, not merely a browser wrapper |

These are readiness gates, not claims that the owner's Apple account is missing. No Apple submission or deployment occurred.

## References

- [Capacitor: existing web app requirements](https://capacitorjs.com/docs/getting-started)
- [Capacitor build/sync workflow](https://capacitorjs.com/docs/basics/workflow)
- [Capacitor live reload (development)](https://capacitorjs.com/docs/guides/live-reload)
- [Apple current submission requirements](https://developer.apple.com/news/upcoming-requirements/) — fetched 2026-10-28; recheck before upload.
- [Apple enrollment](https://developer.apple.com/help/account/membership/program-enrollment)
- [Apple upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/)
- [Apple beta information](https://developer.apple.com/help/app-store-connect/test-a-beta-version/provide-test-information/)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)