# Sound It! 

Implement the complete, immediately playable Sound It! mobile-first party game web application in build mode now; use internal planning and do not present another implementation plan for user approval.

### Product Overview
Sound It! is a high-energy, single-device social party game played on one phone passed around a group.
- One player is the Guesser (looks away from screen).
- Everyone else sees the card and communicates the prompt following the clue rule:
  - 🔊 SOUND IT! (sounds only, no words, no physical acting)
  - 🎭 ACT IT! (actions only, no words, no sounds)
  - 🔊🎭 EITHER! (sounds or physical acting, no words)
- Group judges itself. Phone holder taps GOT IT (+1 point, streak up, flip up/out) or SKIP (no point, streak reset, slide out).

### Key Features & Architecture
1. **Black Stage & Edge-to-Edge Cards**:
   - Deep black (#0a0a0c or black) background shell.
   - Active card takes 75–80% of screen height, nearly edge-to-edge width with safe margins.
   - Saturated bold card colors cycling per card: electric yellow, punchy purple, bright electric blue, lime green, hot neon pink, vivid orange.
   - Giant, bold display typography (e.g., Anton / Archivo Black / heavy sans) with smart line breaking for multi-word situation prompts.
   - Stationary top status strip: streak badge (🔥 X), master timer (⏱ 0:XX), current score (✓ X), and current guesser's name.

2. **Web Audio Sound Engine (Synthesized via Web Audio API)**:
   - Three distinct audio states:
     1. **5-Second Countdown**: 5 crisp, pleasant, game-like countdown tones on each beat (5, 4, 3, 2, 1) with an energetic chime on 1/reveal.
     2. **Master Timer Ticking**: Soft mechanical percussive woodblock/ticking ("tok... tok... tok"), non-harsh, accelerating tempo in the final 10s and rapid pressure rhythm in the final 5s.
     3. **Time-Up Buzzer**: Rounded, punchy low-mid frequency buzzer ("BWAAZZ!", ~0.7s) layered for satisfying game-show finish.
   - Clean audio cleanup when rounds pause, end, or reset, with audio toggle/mute button available.

3. **Master Card Library (150–175 rich, vetted cards)**:
   - Unified data model: `{ id, prompt, category, clueType: 'sound' | 'act' | 'either' }`.
   - 4 Categories + All Categories:
     - 🐾 Animals (~40 cards: Dog, Rooster, Dolphin, Mosquito, Elephant, Lion, Gorilla, etc.)
     - 🔊 Things & Sounds (~45 cards: Police Siren, Chainsaw, Popcorn, Microwave, Jackhammer, Race Car, etc.)
     - 👤 Human Sounds & Actions (~35 cards: Sneezing, Hiccuping, Snoring, Tying Shoes, Heavy Breathing, Yawning, etc.)
     - 😂 What’s Happening?! (~50 cards: Stepping on a LEGO, Getting brain freeze, Car won't start, Sneaking late at night, etc.)
   - High content quality: sound cards have unmistakably recognizable sounds; act cards are physically pantomimable.

4. **Play Modes**:
   - 🔊 SOUND IT: Filters to cards with clueType = 'sound' or 'either'.
   - 🎭 ACT IT: Filters to cards with clueType = 'act' or 'either'.
   - 🔀 MIX IT: All cards shuffled together; every card prominently displays its clue-type badge (🔊 SOUND IT!, 🎭 ACT IT!, or 🔊🎭 EITHER!).

5. **Player Roster & Rotation**:
   - Locally persistent saved player roster in localStorage (add, edit name, delete, toggle active).
   - Minimum 2 active players to start.
   - Round rotation: Guesser rotates sequentially each round ("Tom guesses" -> "Pass to Tom, Mike is now guessing!").
   - Scoring strictly tracks points per Guesser.

6. **Game Loop**:
   - Home / Setup (Player selection chips, Mode selection, Category selection)
   - Guesser Announcement ("Mike is guessing! Mike, don't look at the screen! 🙈")
   - Round Ready & 5-Second Countdown (Full screen 5, 4, 3, 2, 1 with audio tones)
   - Master 60-Second Active Round (Giant card reveals instantly at 1, timer ticks, Got It / Skip bottom zones, streak popup stamps)
   - Buzzer & Input Freeze on 0:00
   - Round Summary (Guesser name, Correct count, Skips, Best streak, "Pass to [Next Player] →")
   - Final Game Scoreboard once all players complete a round (Ranked leaderboard, celebratory podium, Play Again option).

7. **Controls & Motion**:
   - Giant bottom touch controls: Left `SKIP`, Right `✓ GOT IT!` (prominently accented).
   - Fast kinetic animations: card flips up on Got It, slides away on Skip.
   - Double-tap debouncing to prevent accidental multi-scoring.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://sound-act-party-jam.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f245b3d7-657a-424c-8007-0441786269b3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
