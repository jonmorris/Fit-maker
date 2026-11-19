# Fit Maker

Personal wardrobe PWA (Vite + TypeScript + Svelte 5 + Dexie). See [README.md](README.md) for the stack, layout and how each part works. Before pushing, run `npm run check`, `npm test` and `npm run build` (CI runs the same three).

## Running records

[docs/DECISION-LOG.md](docs/DECISION-LOG.md) and [docs/CASE-STUDY.md](docs/CASE-STUDY.md) are repo-only indexes over the other docs (README.md, docs/DECISIONS.md). They are never built or shipped.

- When a change makes a decision, add a decision-log entry in the same commit.
- When a change is worth telling, amend a case-study module (and its *Log of additions*) in the same commit.
- A decision-log entry is always a new file in `docs/decision-log/` (`YYYY-MM-DD-short-name.md`, one table row), never an edit to the table. `npm run decision-log` validates entries; folding them into the table happens on `main` with `npm run decision-log -- --fold`, in a commit of its own.
- If a decision's "why" isn't written anywhere, write it in docs/DECISIONS.md first, then point the entry's Ref at it.
