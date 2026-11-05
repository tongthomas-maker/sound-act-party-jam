# Sound It! — App Store submission package (one-time handoff)

2026-11-05. Consolidates release work; details stay in the linked docs. Nothing was submitted, published, deployed, signed or migrated. Drafts below are source-grounded and need **owner approval**.

## 1. Listing fields (drafts; limits from `ios-store-checklist.md`)

| Field | Draft / status | Source |
| --- | --- | --- |
| App name (≤30) | `Sound It!` (9) — availability UNVERIFIED | app title |
| Subtitle (≤30) | `Pass-the-Phone Party Game` (25) | title in `src/routes/index.tsx` |
| Promotional text (≤170) | `Make the sound, act it out, guess it fast. A fast party game for one phone and a whole room.` | og:description |
| Description (≤4000) | See below | modes/categories/settings in source |
| Keywords (≤100 bytes) | `party,charades,sounds,guessing,group,family,game night,act,friends,pass the phone` (81) | — |
| Category | Games → Party / Word (owner choice) | — |
| Age rating | OPEN — answer Apple questionnaire against full prompt deck in `src/lib/cards.ts` | — |
| Support URL / Privacy URL | OPEN — no pages exist; owner must provide | — |
| Copyright / seller | OPEN — owner | — |
| Price | Free; no in-app purchases (V1 has no monetization) | project rules |

Description draft:

> Sound It! is a loud, fast party game for one phone. Make the sound, act it out, and get your friends to guess before the buzzer.
> • Three modes: SOUND IT!, ACT IT! and MIX IT!
> • Categories: Animals, Things & Sounds, Human Sounds, What's Happening?!
> • 30, 60 or 90 second rounds with a 5-second countdown
> • Tilt down for GOT IT!, tilt up to PASS — or just tap the buttons
> • Build a streak to hit FIRE MODE for bonus points
> • Add your players, pass the phone, and see the final scoreboard
> No accounts, no ads, no online play — just one phone and a room full of friends.

Do not claim AI judging, online multiplayer, accounts or stats.

## 2. App Privacy inventory (no speculative claims)

| Data / surface | Known from source | Unknown — must resolve before labels |
| --- | --- | --- |
| Player names, settings, unlock counter | Stored on device only (`players.ts`, `prefs.ts` localStorage); never sent by game code | Native container persistence on uninstall |
| Gameplay | No backend, accounts, analytics, ads, mic/camera/location | — |
| Motion sensor | Read on device for tilt scoring; optional; not transmitted | WKWebView prompt behavior |
| Fonts | Live app loads Google Fonts; `prepare-ios.py` bundles them locally for native | Confirm packaged build makes zero font requests (static verifier) |
| Error reporting | `reportLovableError` forwards to injected runtime hooks if present | Whether any hook exists in native build; recipients/retention |
| Native SDKs (Capacitor 7.4.3) | Not yet inventoried | Privacy manifests / required-reason APIs from Xcode privacy report |
| Share button | Uses system share sheet, user-initiated | — |

**Do not select "Data Not Collected" until the Unknown column is resolved** from the actual packaged build. Tracking/ATT: none expected; confirm from final package.

## 3. iPhone screenshot shot list

Capture from the real packaged app on a 6.9"/Dynamic Island iPhone size per Apple's live spec (plus iPad 13" if iPad ships). Landscape for gameplay.

1. Setup: players added, mode pills SOUND IT! | ACT IT! | MIX IT! visible.
2. Category + round length selection.
3. 5-second countdown.
4. Play card (SOUND IT!) with PASS / GOT IT! buttons.
5. FIRE MODE streak with confetti.
6. Turn recap (Got it / Passed).
7. Final scoreboard.

Use real UI only; no device frames claiming features that do not exist.

## 4. Native build — exact commands

Requirements and gates: `ios-one-command-handoff.md` (Node 22.12+, Bun, Python 3.10+, Xcode 16+, CocoaPods, port 8765).

```bash
python3 docs/test-ios-handoff.py -v        # optional fixture check
python3 "/absolute/path/to/exported-sound-it/docs/prepare-ios.py" --app-id com.yourcompany.soundit
open "<reported workspace>/native/ios/App/App.xcworkspace"
```

Success = `STATIC_PASS_NATIVE_WORKSPACE_PREPARED`, exit 0. Then in Xcode: signing team, version 1.0 / build 1, Product → Archive → Validate → Distribute (owner-approved step).

## 5. Remaining gates

| Gate | Owner | Agent |
| --- | --- | --- |
| Run `prepare-ios.py` on Mac, return `handoff-result.json` + logs | ✔ | Review evidence |
| Apple Developer membership, bundle ID, signing | ✔ | — |
| Approve app icon (`ios-assets/AppIcon-1024.png`) and listing copy above | ✔ | Revise on request |
| Support + privacy policy URLs | ✔ provide/approve | Can draft pages if requested |
| Age rating, export compliance, content rights | ✔ | — |
| iPhone + iPad mini device QA (`ios-qa-handoff.md`) | ✔ | Fix reported bugs |
| Resolve privacy Unknowns from packaged build | ✔ supply report | Fill labels from evidence |
| Screenshots (section 3) | ✔ | — |
| Archive, upload, TestFlight, App Review | ✔ | — |
| Tilt debug controls still visible — keep or hide for release | ✔ decide | Implement decision |
