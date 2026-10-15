# Sound It! — Tilt QA handoff (iPhone + iPad mini)

**What changed:** mid-turn 180° rotation fix. Rotating the phone to the other
landscape side mid-card now re-reads the physical side and re-calibrates, so
DOWN stays GOT IT! and UP stays PASS on the new side. The rotation swing
itself never scores. Scoring rules unchanged: 18° trigger, 600ms lock,
one result per card, manual buttons always available.

**Automated status:** 118/118 tests pass, build clean (2026-10-15).
Synthetic tests cover both landscape sides, portrait, permission grant/deny,
rapid flips, rearm/debounce, and rotation. They cannot cover real sensor
behavior — that's what this handoff is for.

## Pass/fail checklist (~10 min per device)

Devices: one iPhone, one iPad mini, current iOS/iPadOS, Safari.
Setup: 2 players, any mode, 30s round, ring/silent OFF, volume up.

| # | Check | Pass criteria | iPhone | iPad mini |
|---|---|---|---|---|
| 1 | Permission prompt | Appears once on Flip Controls ON; Allow enables tilt | ☐ | ☐ |
| 2 | Permission denied | No freeze; "Motion blocked — use buttons"; buttons score | ☐ | ☐ |
| 3 | Notch LEFT tilt | DOWN = one GOT IT! (+1, one sound); UP = one PASS | ☐ | ☐ |
| 4 | Notch RIGHT tilt | Same as #3 on the other side | ☐ | ☐ |
| 5 | **Rotation fix (blocker)** | Mid-card flip to other side: swing scores nothing; after ~1s still, DOWN = GOT IT! (not PASS) | ☐ | ☐ |
| 6 | Rapid double-flip | LEFT→RIGHT→LEFT in ~1s: nothing scores during flips; DOWN works after settling | ☐ | ☐ |
| 7 | Hold DOWN 2s | Exactly one point | ☐ | ☐ |
| 8 | Rapid flicks / tilt+tap same card | One result per card, no double sound | ☐ | ☐ |
| 9 | Flip Controls OFF mid-turn | Tilt stops immediately; buttons still score | ☐ | ☐ |
| 10 | Finish a game | Totals = sum of turns; sound audible across the room | ☐ | ☐ |

**Ship gate:** all rows pass on both devices. Rows 5–6 are the release
blockers for the rotation fix; everything else is regression confirmation.

## Reporting fails

Send: device, iOS version, notch side, exact motion, expected vs actual.
Full procedures: `ios-device-test-plan.md`, `ios-acceptance-matrix.md`,
`ios-device-checklist-compact.md`.
