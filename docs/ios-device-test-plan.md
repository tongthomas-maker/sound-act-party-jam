# Sound It! — Real iPhone & iPad mini test plan

Goal: confirm the mid-turn 180° rotation fix and core tilt scoring on real hardware.
~10 minutes per device. Use current iOS/iPadOS, Safari, ring/silent OFF, volume up.
Setup per run: 2 players, any mode, 30s round. Details: `ios-acceptance-matrix.md`, `ios-device-checklist-compact.md`.

## 1. Permission (2 min)

1. Start a game, turn Flip Controls ON → motion prompt appears once.
2. Allow → tilt works on the next card.
3. Fresh tab, Don't Allow → no freeze, "Motion blocked — use buttons" shows, buttons still score.
4. Toggle Flip Controls OFF mid-turn → tilt stops scoring instantly; buttons still work.

## 2. Tilt directions, both notch sides (3 min)

For each side (notch LEFT, then notch RIGHT):

1. Hold still ~1s → tilt DOWN → exactly one GOT IT!, +1, one sound.
2. Hold still ~1s → tilt UP → exactly one PASS, no point.
3. Hold DOWN for 2s → still only one point.

## 3. Rotation fix — release blocker (3 min)

1. Notch LEFT, mid-card: flip the phone end-over-end to notch RIGHT.
   - The flip swing itself must score nothing.
   - Hold still ~1s → tilt DOWN → GOT IT! (not PASS).
2. Flip back to notch LEFT mid-card → hold still → tilt UP → PASS.
3. Rapid double-flip (LEFT→RIGHT→LEFT within ~1s) → nothing scores during the flips; after settling, DOWN = GOT IT!.

## 4. Scoring safety (2 min)

1. Rapid flicks up/down on one card → one result per card, no double sound.
2. Tilt and tap a button on the same card → scores once.
3. Lock screen 5s mid-turn → timer and audio resume correctly.

## 5. Finish

Complete a game → totals equal the sum of turns; ties shown; sound audible across the room.

## Reporting

For any fail, note: device, iOS version, notch side, exact motion, expected vs actual.
Pass criteria: all of section 3 plus no double-scoring anywhere.
