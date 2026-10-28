# Sound It! — Isolated native bundle feasibility, batch 04–11

2026-10-28. Investigation only. No V1 source, production Vite configuration, dependencies, routing, assets, signing or deployment changed. No native readiness claim.

## Decision

**Local static packaging is technically plausible, not demonstrated.** The game data, scoring, timer and generated sound are client-side. Installed TanStack supports both prerender and SPA options. However, no experimental static production build was run and no static artifact was generated: environment instructions prohibit manual project builds/typechecks and reserve build verification for the automatic harness. This restriction was not bypassed with a copied project or alternate config.

There is no existing `.output`, `dist` or `.tanstack` production artifact in this sandbox to test independently. A Vite development page is not a packaged bundle. Do not treat this investigation as a successful static build.

## Installed configuration evidence

- `@lovable.dev/vite-tanstack-config` 2.26.5 wraps TanStack Start and Nitro. `vite.config.ts` selects `server: { entry: "server" }`; the production configuration remains untouched.
- `src/server.ts` dynamically loads the Start server entry and wraps server error responses. `src/start.ts` installs server request/CSRF middleware. Neither is a WKWebView browser entry.
- `src/router.tsx` creates the TanStack router with the generated route tree and QueryClient; `__root.tsx` supplies the HTML document, `HeadContent` and `Scripts`. There is no conventional root HTML entry to copy blindly.
- Installed `node_modules/@tanstack/start-plugin-core/src/schema.ts:158–171` explicitly defines `spa.enabled`, `spa.maskPath` (default `/`) and `spa.prerender`; standalone TanStack's default shell output path is `/_shell`. SPA prerender is forced enabled by its schema transformation.
- The same schema at lines 270–283 supports `prerender.enabled`, `autoStaticPathsDiscovery`, `failOnError` and page prerender options. Installed Lovable wrapper also applies prerender output-shape overrides in managed builds; a requested SPA output path is not proof that an `index.html` appears where expected.
- No loader, `createServerFn` or fetch call was found in the reviewed content route/game/card paths. The server middleware is not required for the in-memory scoring tested below. This finding does not certify the full emitted client import graph.

## Actual execution evidence

| Check                          | Actual result                                                                                                                                                                                                                            | What it does not prove                                                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Targeted automated regressions | **50/50 pass, 3 files**: tilt harness 7, tilt hook events 29, feedback 14                                                                                                                                                                | Real iOS sensors, native prompt, audible output                                                                  |
| Warm offline gameplay          | Fresh Chromium 1280×1800: load app online, create two players, choose 30s, start, disconnect network before READY!, score GOT IT! then PASS, wait to TIME!                                                                               | Cold offline startup or packaged asset operation                                                                 |
| Offline round summary          | **1 point, 1 passed, best streak 1**, next-player handoff visible; no page errors                                                                                                                                                        | Full game/replay/native lifecycle signoff                                                                        |
| Audio tap                      | Instrumented the real browser AudioContext constructor; after READY!/scoring, context **running**, time advancing (~5.43s); no remote sound file required                                                                                | Audibility, iOS silent-switch behavior, interruption recovery                                                    |
| Offline reload                 | **Failed: `net::ERR_INTERNET_DISCONNECTED`**; no service-worker controller                                                                                                                                                               | Failure of a future locally served native bundle: this tested the current development origin, not packaged files |
| Permission browser branches    | Fresh browser with explicitly mocked DeviceOrientation permission: in-game tap made one request; denied showed retry/GOT IT!/PASS guidance, granted showed Flip on; manual controls remained available and accepted clicks in both paths | An actual iOS permission prompt, native delegate policy or physical tilt behavior                                |
| Automatic build signal         | Automatic log reports **build OK**, 2026-10-28T04:37:06Z                                                                                                                                                                                 | An experimental static build, explicit TypeScript check, artifact inventory or native archive                    |

Permission test correction: toggling the setup preference alone made zero permission requests, as designed. The observed grant/deny results above came from the actual in-game “Tap to allow flip controls” button. Browser mocks are not device verification.

Browser scripts/screenshots are temporary evidence under `/tmp/browser/bundle0411/`; they are not app code, permanent deliverables or native installation files. The previous full suite passed 138/138 in batch 04–09; this batch executed the 50 targeted tests, not a second full-suite run.

## What can plausibly be bundled

- **Gameplay/cards/preferences:** local modules and guarded localStorage, with no gameplay account/backend dependency in reviewed paths. Validate persistence and replay in the emitted artifact.
- **Audio:** Web Audio synthesizes chords, music and buzzer locally. Existing tap-based creation/resume can be retained; real WKWebView audio/silent-mode/resume still needs testing.
- **Motion:** current DeviceOrientation code and permission branches are browser-capable and covered by mocks/tests. Packaging does not automatically grant motion permission. Verify container origin, WKUIDelegate decision handling, purpose strings where required, and both rotation directions on physical devices. No native motion plugin is added or needed to be assumed here.
- **Startup/assets:** not established. Remote Google Fonts remain a network dependency; preserve font licensing and appearance in any later local-asset experiment. Optional preview error hooks and final external traffic must be audited. No offline cache exists in current reviewed web setup.

Use Capacitor's documented local asset serving model rather than assuming direct `file://index.html` loading supports ES modules, absolute asset paths and permission-origin rules. A remote preview URL is not an offline bundle.

## Safe next experiment outside the restricted build environment

1. Export a clean source snapshot to a disposable workspace on a Mac; retain the original production config and record its checksum. Do not use stateful Git operations or change this live project to perform the experiment.
2. Use the **same installed versions**. In the disposable copy only, add a separate experimental Vite config with a distinct output area. Start with the documented `pages: [{ path: "/" }]` and `prerender: { enabled: true, autoStaticPathsDiscovery: false, failOnError: true }`, retaining the existing server entry. This is a candidate to test, not a config successfully built here. Alternatively evaluate the installed SPA schema once output conventions are understood; do not stack conflicting strategies.
3. Run the experimental build there, capture command, exit code, log, output paths and generated file listing. Verify an actual root `index.html`, every JS/CSS/media dependency, and absence of required server-function endpoints. SSR may be used during build; only static client files belong in the native `webDir`.
4. Serve **only** the candidate static files, not Vite/SSR. Block every external request while allowing the local asset origin. In a fresh browser/storage context verify first startup, all modes/categories, two complete turns, expiry, final totals, replay and reloading. Package licensed fonts in the experiment if required; no live styling changes.
5. If static startup fails, preserve the log and stop. Do not work around it by embedding the hosted preview, changing V1 rules, installing unrelated features or claiming a native export exists.
6. Only after static evidence passes, create a candidate Capacitor iOS shell in that disposable workspace with `webDir` pointing to the **verified** directory. Native sync can overwrite copied assets, so run it only against the experiment. Review current compatible Capacitor/Xcode versions before installing; none installed in this batch.
7. In Xcode choose the owner team/bundle ID, compatible deployment target, both landscape orientations and iPad support; audit purpose strings and native privacy manifests. Apple currently lists Xcode 26+ / iOS/iPadOS 26+ SDK and target iOS 13+, while wrapper dependencies may require newer versions. Recheck Apple's live requirements.
8. Run an actual install from Xcode and repeat `ios-owner-sound-rotation-check.md`: first launch in airplane mode, allow/deny/retry motion, both landscape sides/180° rotations, held tilt/debounce, sound after READY!, mute/silent switch, lock/resume, expiry, replay and local persistence. Safari or simulator-only results cannot close these gates.

**Remaining gates:** successful isolated static build and cold-start test; licensed local assets/final traffic audit; native shell and signing on Mac/Xcode; real iPhone/iPad WKWebView audio/motion/lifecycle checks. No IPA/TestFlight path or native readiness established.

References: [TanStack static prerender](https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering), [TanStack SPA mode](https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode), [Capacitor existing web app](https://capacitorjs.com/docs/getting-started), [Capacitor workflow](https://capacitorjs.com/docs/basics/workflow), [Apple requirements](https://developer.apple.com/news/upcoming-requirements/). Installed source/schema is the version-specific configuration evidence; URLs are follow-up references, not a substitute for artifact validation.
