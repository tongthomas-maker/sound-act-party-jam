# Sound It! release preparation

- [x] Inspect current permission controls and existing fallback coverage.
- [x] Clarify the denied-permission control with retry and named manual buttons.
- [x] Add one offline regression for denial followed by successful retry and rearm.
- [x] Run full tests (131/131) and targeted lint; automatic build reports OK after edits.
- [x] Verify denied-permission instructions and manual scoring at phone/tablet sizes in Chromium.
- [x] Report verified evidence and remaining physical-device checks; do not publish.
- [ ] Separate TypeScript and fresh production-build checks: blocked by environment instructions requiring automatic verification; only automatic build OK is exposed.