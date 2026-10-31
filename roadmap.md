# Sound It! release batch 04–09

- [x] Review current V1 source, QA evidence, and reproducible release blockers; no gameplay blocker reproduced.
- [x] Create non-destructive native iOS packaging readiness handoff.
- [x] Create App Store assets, metadata, privacy, and permissions checklist.
- [x] Create concise owner iPhone/iPad sound and rotation instructions.
- [x] Run full automated tests: 138/138 passed across 12 files.
- [x] Inspect automatic build evidence: build OK at 2026-10-28T04:33:44Z; manual production build/typecheck prohibited by environment instructions.
- [x] Document exact Apple/TestFlight and physical-device gates; no submission, deployment, or credential changes.
- [ ] Physical iPhone/iPad and installed-native QA: blocked on device testing and a native package outside this batch.

## Release batch 04–11 — isolated bundle feasibility

- [x] Inspect installed TanStack static/SPA options and SSR entry boundaries.
- [x] Run targeted audio/motion/tilt tests: 50/50 passed across 3 files.
- [x] Check browser behavior: warm offline scoring/audio passed; offline reload failed; mocked grant/deny and fallback exercised.
- [x] Record static-build constraint: no manual experimental build allowed; no static artifact generated or production config changed.
- [x] Write feasibility evidence and Mac/Xcode next steps; no native readiness claim or deployment.
- [ ] Isolated static build/cold-start verification: blocked on a build-capable disposable workspace outside this restricted environment.

## Release batch 04–13 — reproducible isolated static experiment

- [x] Inspect prerender safety, installed wrapper options and local/remote startup dependencies.
- [x] Execute full regressions: 138/138 passed across 12 files; no gameplay changes.
- [x] Provide disposable Mac workspace/config commands and static-only cold-start/audio/manual-scoring verifier.
- [x] Record build restriction and separate actual evidence from unexecuted checks; no deployment or signing.
- [ ] Execute experimental build and verifier on Mac: sandbox prohibits manual builds, including copied workspaces; no static artifact or offline cold-start result exists.

## Release batch 04–17 — static client build check

- [x] Re-checked static build feasibility: manual builds remain prohibited in this environment, including disposable workspaces; V1 source and production config unchanged.
- [x] Re-ran full regressions: 138/138 passed across 12 files; no gameplay changes.
- [x] Verified existing Mac commands and `docs/verify-static-0413.py` still match current UI labels (START GAME, READY!, 30s, GOT IT!/PASS, TIME! summary).
- [ ] Execute experimental build and verifier on Mac: same owner blocker as batch 04–13; covers offline cold launch, local assets, scoring, audio after tap, and manual tilt fallback.

## Isolated local-font proof

- [x] Fetch pinned Anton/Archivo packages into temporary storage and verify included OFL licenses and registry integrity.
- [x] Verify all four font weights in two fresh browsers with outside requests blocked: PASS, zero external requests or failures.
- [x] Document reversible adoption without changing live source, dependencies or production configuration in docs/ios-local-font-proof.md.
- [x] Run proof/verifier syntax checks and full game regressions: 138/138 tests across 12 files.
- [ ] Production font adoption: requires separate owner approval; not needed to complete this isolated proof.

## Release batch 10–31 — offline preparation inspection

- [x] Correct one verifier gap: require loaded bundled font faces in both fresh static launches, rejecting omitted declarations/system fallback.
- [x] Run font-gate regressions (3/3), isolated licensed-font proof (2/2 launches), syntax checks (3 scripts), and full game tests (138/138 across 12 files); evidence and native gates in docs/ios-offline-review-1031.md.
- [ ] Mac static-game build and physical installed-iOS QA remain blocked on owner execution outside this build-restricted environment; no V1/config changes or deployment.