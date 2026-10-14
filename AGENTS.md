<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Pure game rules (turns, scoring, gestures, winners, prompt deck) live in `src/lib/game.ts` with vitest tests in `src/lib/__tests__`; keep UI files free of rule logic so rules stay testable.
- Local preferences go through `src/lib/prefs.ts` (validated parse, defaults on bad data); roster/selection stay in `src/lib/players.ts`.
- Play screen cards come from `src/lib/playcards.ts` (one display shape for all modes incl. unlockable Quick Call) so the UI never branches on card source.
- Tests run via `vitest.config.ts` (plain config, no app plugins); hook tests opt into jsdom per file. Why: the app's plugin chain breaks React hook rendering in tests.
