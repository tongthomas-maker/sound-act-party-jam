# Sound It! — Step-by-step iPhone & iPad mini test

Takes about 15 minutes per device. Record results in `ios-acceptance-matrix.md`.

## Before you start
1. Charge the device, turn the ring/silent switch OFF, volume up.
2. Open Safari and go to the game link.
3. Add 2 players (e.g. "A" and "B"). Pick any mode. Round length 30s for speed.

## Part 1 — Permission (checks 1–4)
1. In settings, turn **Flip Controls ON**. A "Motion & Orientation" pop-up should appear. Tap **Allow**.
2. Next round: tilting should work.
3. To test Deny: close the Safari tab, reopen the link, turn Flip Controls ON, tap **Don't Allow**. Game must not freeze; the label shows "Motion blocked — use buttons"; GOT IT!/PASS buttons still score.
4. Turn Flip Controls on again. Note whether the pop-up returns or you must use Settings → Safari → Motion & Orientation Access.

## Part 2 — Tilt both sideways directions (checks 5–8)
1. Hold the phone sideways, screen facing your friends, button/notch on the **left**.
2. Wait for the countdown, hold still ~1 second.
3. Tilt top of screen **DOWN** (toward floor): expect GOT IT!, +1, one beep.
4. Tilt **UP** (toward ceiling): expect PASS, no point.
5. Repeat steps 1–4 with the notch on the **right**.

## Part 3 — Scoring safety (checks 9–12)
1. Tilt DOWN and hold for 2 seconds: only one point.
2. Flick quickly up and down several times: one result per card, no double beep.
3. Rotate the phone end-over-end mid-turn: rotating alone scores nothing.
4. Tilt DOWN and tap GOT IT! at the same moment: one point only.

## Part 4 — Buttons only (check 13)
1. Turn Flip Controls OFF. Tilting does nothing; GOT IT! and PASS buttons work.
2. With **VoiceOver** on (Settings → Accessibility → VoiceOver): swipe to the buttons; they read "Got it, plus one point" and "Pass, no point"; double-tap scores. Score changes are announced.

## Part 5 — Interruptions & finish (checks 14–16)
1. Mid-turn, lock the screen 5 seconds, unlock: timer and sound were paused, then resume.
2. Switch to another app and back: same.
3. Finish the game: totals match each turn; ties shown as ties.
4. Sound is loud across a room. (iPhone/iPad Safari cannot vibrate from web pages — no buzz is expected.)

## Reporting
For any failure send: device, iOS version, which way the notch faced, what you did, what happened.
