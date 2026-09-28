# Fit Maker

A personal wardrobe PWA: catalog your clothes, get outfit suggestions for today's weather, and catch redundant or clashing purchases before you make them. It is local-first, with no account or backend; everything lives in IndexedDB on your phone.

## Status

| Phase | Scope | State |
|---|---|---|
| 0 | Skeleton: PWA manifest and service worker, offline, iOS home-screen, dark mode, Pages deploy | ✅ |
| 1 | Inventory: photo capture and compression, eyedropper, color families, filters, edit, JSON backup | ✅ |
| 2 | Rules-based outfit builder: color harmony, formality, Open-Meteo weather, lock-a-piece, favorites, wear log | – |
| 3 | Analysis: redundancy, clash risk, gaps, capsule slots, before-you-buy, orphans | – |
| 4 | AI tagging with the Claude API (your own key, stored locally) | – |

## Stack and why

- **Vite + TypeScript**: fast builds with no framework lock-in.
- **Svelte 5 (plain SPA, no SvelteKit)**: components are mostly HTML and scoped CSS, with very little boilerplate. Dexie's `liveQuery()` is a valid Svelte store, so `$allItems` re-renders whenever the database changes.
- **Dexie** (IndexedDB): photos and thumbnails live in their own tables so list views never load full images.
- **vite-plugin-pwa**: generates the manifest and a Workbox service worker that precaches the app shell.
- **Vitest**: tests the pure logic.
- **Hash routing** (`#/closet`, `#/item/<id>`): needs no server rewrites on GitHub Pages and is reliable in iOS standalone mode.
- **No** state library, CSS framework, component kit or color library. Design tokens are CSS custom properties in `src/styles/tokens.css`.

## Layout

```
src/
  engine/     Pure TS domain logic: types, color math. No DOM, no Dexie. Unit tested.
  db/         Dexie schema, item/photo helpers, settings, backup (export/import)
  services/   Photo compression, pixel sampling (eyedropper + dominant colors), file saving
  ui/         Svelte app: router, views, components, filter logic
  styles/     tokens.css (light/dark), base.css
```

The rule: **`engine/` takes plain data and returns plain data.** The outfit builder and analysis (phases 2–3) will live there, which keeps them testable and makes "before you buy" just "run the analysis with one hypothetical item added".

## Color model

Colors are stored as hex and analysed in **OKLCH**, a perceptual space where equal distances look about equally different. `colorFamily()` maps a hex value to a clothing-oriented family. It carves out "fashion neutrals" (navy, denim, beige/khaki, brown, olive) before falling back to hue buckets, because in outfits they behave like neutrals. `deltaE()` is what will catch "two slightly different greens" in phase 2.

The family is derived automatically when you pick a color, but you can override it in the editor.

## Data model

See `src/engine/types.ts`. Notes:

- `formality` is a **list**, because dark jeans can be both casual and business casual.
- `ItemAttributes` is the shape the editor works on. Phase 4 AI tagging will return `Partial<ItemAttributes>` into the same draft, and `attrSource` records which fields came from AI. No schema rewrite is needed.
- `outfits` and `wearLog` tables exist already, so phase 2 needs no migration.

## Develop

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run check      # svelte-check / TypeScript
npm run build
npm run icons      # regenerate PNG icons from public/logo.svg
```

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` builds and deploys on every push to `main`. One-time setup: in **Settings → Pages → Build and deployment → Source**, choose **GitHub Actions**. The app will be at `https://<user>.github.io/Fit-maker/`.

## iPhone notes

- Open the Pages URL in Safari, then **Share → Add to Home Screen**. Do this *before* entering data: iOS keeps the home-screen app's storage separate from Safari's.
- Export a backup from **Settings** now and then. On iOS it opens the share sheet, so you can save it to Files or iCloud Drive. The backup is a single JSON file with photos inlined; your API key (phase 4) is never included.
- Photos are resized to 1280px (JPEG, quality 0.8), with a 320px thumbnail, so each item takes roughly 100–250 KB.
