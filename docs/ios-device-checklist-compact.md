# Sound It! — Compact real-device checklist

Fill this in on one iPhone and one iPad mini (current iOS/iPadOS, Safari).
Takes ~5 minutes per device. Full details: `ios-acceptance-matrix.md`, `ios-test-procedure.md`.

Setup: 2 players, any mode, 30s round, volume up, ring/silent OFF.

## A. Permission

| # | Do | Expected | iPhone | iPad mini |
|---|---|---|---|---|
| A1 | Turn Flip Controls ON | Motion prompt appears once | | |
| A2 | Tap Allow | Tilt works next round | | |
| A3 | Tap Don't Allow (fresh tab) | No freeze; "Motion blocked — use buttons"; buttons score | | |
| A4 | Turn Flip Controls ON again after deny | Prompt returns, or Settings guidance shown; buttons still work | | |

## B. Tilt directions (both landscape sides)

| # | Do | Expected | iPhone | iPad mini |
|---|---|---|---|---|
| B1 | Notch LEFT: tilt DOWN | GOT IT!, +1, one beep | | |
| B2 | Notch LEFT: tilt UP | PASS, no point | | |
| B3 | Notch RIGHT: tilt DOWN | GOT IT!, +1, one beep | | |
| B4 | Notch RIGHT: tilt UP | PASS, no point | | |

## C. Scoring safety

| # | Do | Expected | iPhone | iPad mini |
|---|---|---|---|---|
| C1 | Hold DOWN 2s | One point only | | |
| C2 | Rapid flicks up/down | One result per card, no double beep | | |
| C3 | Rotate phone mid-turn | Nothing scores; tilt works again after holding still | | |
| C4 | Tilt + tap same card | Scores once | | |

## D. Button fallback

| # | Do | Expected | iPhone | iPad mini |
|---|---|---|---|---|
| D1 | Flip Controls OFF: tilt, then tap buttons | Tilt ignored; buttons score | | |
| D2 | VoiceOver: swipe to buttons | Reads "Got it, plus one point" / "Pass, no point"; double-tap scores | | |

## E. Finish

| # | Do | Expected | iPhone | iPad mini |
|---|---|---|---|---|
| E1 | Lock screen 5s mid-turn | Timer + audio pause, resume correctly | | |
| E2 | Finish a game | Totals = sum of turns; ties shown | | |
| E3 | Sound | Audible across the room (no vibration expected on iOS Safari) | | |

## Reporting

For any fail, send: device, iOS version, notch side, what you did, what happened.
