# Sound It! — iOS real-device acceptance matrix

Devices: iPhone (current iOS, Safari) and iPad mini (current iPadOS, Safari). Record Pass/Fail + notes per cell.

| # | Check | Expected | iPhone | iPad mini |
|---|---|---|---|---|
| 1 | Turn Flip Controls ON | Motion permission prompt appears once | | |
| 2 | Allow permission | Tilt works next round | | |
| 3 | Deny permission | No crash; GOT IT!/PASS buttons work | | |
| 4 | Re-enable after deny | Prompt or clear Settings guidance; buttons still work | | |
| 5 | Landscape (home button/notch left): tilt DOWN | GOT IT!, +1 once | | |
| 6 | Landscape (left): tilt UP | PASS, no point | | |
| 7 | Landscape (right): tilt DOWN | GOT IT!, +1 once | | |
| 8 | Landscape (right): tilt UP | PASS, no point | | |
| 9 | Hold DOWN 2s | Single score only | | |
| 10 | Rapid repeated flicks | One score per card, no double beep | | |
| 11 | Rotate phone mid-turn | Rotation does not score; tilt resumes after holding still | | |
| 12 | Tilt + tap same card | Scores once | | |
| 13 | Flip Controls OFF | Tilt ignored, buttons work | | |
| 14 | Lock screen / app switch mid-turn | Timer + audio pause, resume correctly | | |
| 15 | Final scoreboard | Totals equal sum of turns; ties shown | | |
| 16 | Sound + vibration | Audible across room; vibration where supported (iPhone has no web vibrate) | | |

Synthetic coverage: `src/lib/__tests__/hardening.test.ts`, `src/lib/__tests__/ios-regression.test.ts`. Synthetic tests do not prove physical behaviour.
