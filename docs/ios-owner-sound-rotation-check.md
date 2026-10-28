# Sound It! — Owner iPhone / iPad mini check

About 10 minutes per device. Use Safari on one iPhone and one iPad mini; write down device model and iOS/iPadOS version. All results are **NOT RUN** until recorded by the tester.

**Current preview:** https://id-preview--f245b3d7-657a-424c-8007-0441786269b3.lovable.app

Preview may require project access. For a guest, use Lovable → Share → Create shared preview link; this is not publishing. Existing public URL: https://sound-act-party-jam.lovable.app — its snapshot was not compared with this batch. No native installer or TestFlight link is available in this repository.

**Setup:** add two players; choose 30s and one turn each; turn silent mode OFF, volume up, Music/Effects ON. Start and tap READY! to unlock sound. Keep the phone screen facing friends. Run once with tilt allowed, then a separate denied-permission test. Safari may remember denial: a new tab is not guaranteed to reset it; record whether retry prompts again and follow device settings guidance rather than clearing unrelated personal data.

| Check | What to do / pass result | iPhone | iPad mini |
|---|---|---|---|
| Sound | Tap READY!: countdown/reveal audible. GOT IT! gives a clear chord; PASS gives a buzzer; TIME! audible once. No double sound for one card. | NOT RUN | NOT RUN |
| Allow / deny | Enable Flip Controls and allow: tilt works. In denied test: game stays usable, blocked-motion retry message appears, GOT IT!/PASS still work. Record prompt/retry behavior. | NOT RUN | NOT RUN |
| Both sideways directions | Notch/home-button LEFT, hold still ~1s, tilt DOWN = one GOT IT!, UP = one PASS. Repeat notch RIGHT. Early GOT IT! is +1; later FIRE bonuses follow existing rules. | NOT RUN | NOT RUN |
| Mid-card 180° rotation | Change LEFT→RIGHT during a card: rotation swing scores nothing. Hold still ~1s, DOWN still GOT IT!, UP still PASS. Repeat RIGHT→LEFT and rapid LEFT→RIGHT→LEFT. | NOT RUN | NOT RUN |
| Repeat safety | Hold DOWN 2s: only one result. Return level then tilt the next card. Tilt+tap same card and rapid taps: no duplicate result/sound. | NOT RUN | NOT RUN |
| Controls OFF / touch | With Flip Controls OFF, tilts do nothing; both buttons work. Check portrait and both landscape sides: prompt, timer and controls visible and reachable. | NOT RUN | NOT RUN |
| Sound settings / interruption | Toggle mute/music/effects; record actual buzzer behavior too. Lock/switch apps for 5s mid-turn: game pauses, no ongoing music; resume by tap, timer/scoring/sound continue safely. Repeat with silent mode ON and report actual output, not assumed behavior. | NOT RUN | NOT RUN |
| VoiceOver / finish | Buttons read “Got it, plus one point” / “Pass, no point”; activation records once. Finish both turns: correct+FIRE bonus totals agree, PASS gives no points, ties shown when applicable. Replay starts fresh game results. | NOT RUN | NOT RUN |

No vibration is expected from iOS Safari. Do not mark lack of web vibration as a failure.

**Stop-release failures:** reversed DOWN/UP, scoring during rotation, duplicate results, scoring after TIME!, manual fallback unusable, timer/score corruption or required sounds failing after a normal start/resume tap. Send: device/version, notch side, exact steps, expected/actual result and a short recording if safe.

**After native packaging exists:** repeat every row inside the installed app, then test first launch/relaunch in airplane mode, roster/settings persistence, background/resume and installation. Current web cold-offline support is not promised. Safari-only success is not TestFlight signoff.

More detail: `ios-qa-handoff.md`, `ios-acceptance-matrix.md`, `ios-device-test-plan.md`.