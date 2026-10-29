# Sound It! — local font packaging plan (not applied)

2026-10-29 UTC. Plan only. No fonts downloaded, no source/config changed.

## Current usage
- `src/routes/__root.tsx` loads Google Fonts: **Anton** (400) and **Archivo** (500/700/900).
- `src/styles.css`: `--font-display: "Anton", "Archivo Black", …`; `--font-body: "Archivo", …`.
  "Archivo Black" is a fallback name only and is never loaded, so it does not need packaging.
- The static verifier fails while these external requests exist, as designed.

## License check (package metadata only, nothing downloaded)
| Font | Package | Version | License |
|---|---|---|---|
| Anton | `@fontsource/anton` | 5.3.0 | OFL-1.1 |
| Archivo | `@fontsource/archivo` | 5.3.0 | OFL-1.1 |

The SIL Open Font License 1.1 allows bundling in apps, including paid ones. Keep the license text, don't sell the fonts on their own, and don't use the reserved font names on modified versions. Before release, the owner should confirm the OFL text inside each package.

## Proposed change (needs owner approval)
1. `bun add @fontsource/anton@5.3.0 @fontsource/archivo@5.3.0` (the exact versions go into the lockfile).
2. At the top of `src/styles.css`: `@import "@fontsource/anton/400.css";` plus Archivo `500.css`, `700.css`, `900.css`.
3. Remove the three Google Fonts `<link>` entries from `__root.tsx`.
4. Keep the font names and weights the same, so the look doesn't change.
5. Add a short "Fonts: Anton, Archivo — SIL OFL 1.1" credit to the store notes/about text.
6. Verify: run the tests, compare screenshots before and after, run the static verifier and confirm `blocked_external` is empty.

Risk: low and limited to appearance. Gameplay is unaffected. This also affects the live web app, so it is an owner decision.

## Static instructions reproducibility review
- `vite.config.ts` and `src/server.ts` match the experiment config (`server.entry: "server"`).
- Node is 22.x here. Bun, Python 3 and Playwright 1.56 are installed on the Mac per the doc.
- **Unverified risk:** the wrapper's build-only nitro output (Cloudflare target by default) may not write `dist/client/index.html`. If it is missing, stop and record the actual output folder. Don't rename or copy files to fake a pass.
- **Unverified risk:** the managed wrapper may override prerender `failOnError`. The doc already requires real output plus a browser PASS.
- Nothing has been executed on a Mac yet, so the instructions are reviewed, not proven reproducible.
