# Decision log

A dated, one-line-per-decision index of what this project decided and when. It is a **pointer, not a second source of truth**: each row names the file and section where the reasoning lives. The reasoning itself is in:

- [README.md](../README.md): stack, layout, color model, outfit builder, wardrobe plan, sizes, data model, deploy and iPhone notes.
- [docs/DECISIONS.md](DECISIONS.md): decisions made with the owner whose "why" isn't written elsewhere, and things deliberately not done yet.
- Git history, for the few decisions that predate both. Those rows say "git history".

This file and [CASE-STUDY.md](CASE-STUDY.md) are repo-only records. They are never built or shipped with the app.

## How to keep this file

- **Add a file, not a row.** A new decision goes in [`docs/decision-log/`](decision-log/) as its own file named `YYYY-MM-DD-short-name.md` (lowercase, hyphenated), holding exactly one table row. Never edit the table below on a branch: rows appended to the same last line by parallel branches always conflict, and separate files never do.
- **Fold on main.** `npm run decision-log -- --fold` appends the waiting entries to the end of the table in filename order (date, then name) and deletes their files. Run it on `main`, in a commit of its own, whenever the folder gets long. Plain `npm run decision-log` validates the entries and prints them with a count. `npm test` fails if any entry is malformed.
- **One row per decision, not per commit.** A reversed decision gets a new row of kind Reversed. The old row stays.
- **Say the decision, not the change**, e.g. "A category can be kept out of outfit suggestions", not "edit Today.svelte".
- **Kind** is one of the following. The list lives in code in `scripts/decision-log/lib.ts` (`KINDS`); change it there and here together.
  - **Product**: what the app does for its one user (features, defaults, data the owner sees).
  - **Design**: how it looks, reads or judges (UI, color and style rules).
  - **Engineering**: how it's built (stack, architecture, storage, algorithms).
  - **Process**: how the project is run (hosting, CI, workflow, records).
  - **Deferred**: deliberately not doing something yet.
  - **Reversed**: undoing an earlier row (name it in the Decision).
- **Ref** names the file → section holding the why. If no why is written anywhere, write it there first (usually [DECISIONS.md](DECISIONS.md)).

## Log

| Date | Kind | Decision | Ref |
|---|---|---|---|
| 2026-09-28 | Product | Local-first PWA for one person: no account or backend in v1, everything in IndexedDB on the phone | README.md → opening paragraph; Stack and why |
| 2026-09-28 | Engineering | Vite + TypeScript + Svelte 5 SPA (no SvelteKit) + Dexie + vite-plugin-pwa; no state library, CSS framework or color library | README.md → Stack and why |
| 2026-09-28 | Engineering | Hash routing, so GitHub Pages needs no rewrites and iOS standalone mode behaves | README.md → Stack and why |
| 2026-09-28 | Process | Hosted on GitHub Pages, deployed from main by GitHub Actions; CI type-checks, tests and builds every PR | README.md → Deploy (GitHub Pages); .github/workflows/ |
| 2026-09-28 | Engineering | Recommendation and analysis logic lives in a pure, unit-tested src/engine/ (plain data in, plain data out) | README.md → Layout |
| 2026-09-28 | Design | Colors are stored as hex and judged in OKLCH; navy, denim, khaki, brown and olive count as neutral families | README.md → Color model |
| 2026-09-28 | Product | Formality is multi-select: an item can be both casual and business casual | README.md → Data model |
| 2026-09-28 | Engineering | Photos are resized to a 1280px JPEG plus a 320px thumbnail and stored apart from items | README.md → Stack and why; iPhone notes |
| 2026-09-28 | Product | Backups are one JSON file with photos inlined, saved through the iOS share sheet; the API key and location are never included | README.md → iPhone notes; Outfit builder (phase 2) |
| 2026-09-28 | Engineering | Item attributes share one draft shape so AI tagging can fill it later without a schema change | README.md → Data model |
| 2026-09-28 | Product | °F is the default temperature unit | docs/DECISIONS.md → °F by default |
| 2026-09-28 | Design | Two similar hues without deliberate lightness contrast (olive vs forest green, two denim washes) count as a clash | README.md → Outfit builder (phase 2) |
| 2026-09-28 | Engineering | Outfits come from a beam search scored mainly by the worst color pair, not the average | README.md → Outfit builder (phase 2) |
| 2026-09-28 | Product | Weather comes from Open-Meteo for the phone's location over 8am–7pm; 40%+ rain requires rain-ready outerwear | README.md → Outfit builder (phase 2) |
| 2026-09-28 | Product | Near repeats of a recently worn outfit (the same outfit give or take one piece) are pushed down the suggestions | README.md → Outfit builder (phase 2) |
| 2026-09-28 | Deferred | Accessories are not part of generated outfits | docs/DECISIONS.md → Accessories in outfits |
| 2026-09-28 | Product | Each item stores its size in the format that fits it (letter, neck/sleeve, waist × inseam, shoe…), pre-filled from a My sizes profile | README.md → Sizes |
| 2026-09-28 | Product | A wardrobe plan of the owner's own categories and item types with target counts replaces the planned capsule slots; Insights became Plan | docs/DECISIONS.md → Wardrobe plan instead of capsule slots |
| 2026-09-28 | Product | Basics like socks and underwear are counted with a number, not catalogued item by item | README.md → Wardrobe plan |
| 2026-09-28 | Product | A plan category can be kept out of daily outfit suggestions (e.g. golf, workout) | README.md → Wardrobe plan |
| 2026-09-28 | Product | Plan import ignores the spreadsheet's "owned" column; owned counts come from real items | docs/DECISIONS.md → Spreadsheet "owned" column ignored on import |
| 2026-09-28 | Product | Items can be added from a pasted item list written by Claude in chat, instead of an in-app Claude API key | docs/DECISIONS.md → Paste-in items instead of an API key |
| 2026-09-28 | Deferred | In-app AI intake and tagging with the owner's own Claude API key (phase 4) | docs/DECISIONS.md → Paste-in items instead of an API key |
| 2026-09-28 | Deferred | "Share → Fit Maker" from the iOS share sheet | docs/DECISIONS.md → iOS share target |
| 2026-09-28 | Deferred | Phase 3b analysis (redundancy, clash risk, gaps, before-you-buy, orphans) waits behind the plan and bulk intake | docs/DECISIONS.md → Order of work; README.md → Status |
