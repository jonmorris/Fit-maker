# Fit Maker

A personal wardrobe PWA: catalog your clothes, get outfit suggestions for today's weather, and catch redundant or clashing purchases before you make them. It is local-first, with no account or backend; everything lives in IndexedDB on your phone.

## Status

| Phase | Scope | State |
|---|---|---|
| 0 | Skeleton: PWA manifest and service worker, offline, iOS home-screen, dark mode, Pages deploy | ✅ |
| 1 | Inventory: photo capture and compression, eyedropper, color families, filters, edit, JSON backup | ✅ |
| 2 | Rules-based outfit builder: color harmony, formality, Open-Meteo weather, lock-a-piece, favorites, wear log | ✅ |
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

## Outfit builder (phase 2)

All logic lives in `src/engine/` and is unit tested.

- **`harmony.ts`** rates each pair of colors. Neutrals pair with anything, and tonal, analogous and complementary pairs score well. A **near miss** is a clash: similar hue with not enough lightness contrast to look deliberate, such as olive with forest green, two denim washes or two khakis. A near miss scores very low. OKLCH hue angles aren't the painter's color wheel (red↔green is about 113°), so "complementary" starts at 110°.
- **`weather.ts`** takes the hourly Open-Meteo forecast for 8am–7pm and picks a temperature band from the lowest "feels like" temperature. The band sets a warmth budget for top + layer + outerwear (item warmth is 1–5) and says whether outerwear is needed. At 40% or more rain, outerwear must be rain-ready.
- **`outfits.ts`** filters each slot (active items, dress code, weather), then runs a beam search over bottom → top → shoes → layer → outerwear.
  - The score weights the **worst** color pair most, then penalizes competing patterns, formality stretch, being too warm or cold, pieces worn in the last 14 days, and exact or near repeats of recent outfits. Favorites get a small boost.
  - Locking a piece pins its slot. Shuffle adds seeded jitter.
  - The dress code is relaxed one level only when a required slot would otherwise be empty, and the app shows a notice when that happens.

The forecast is cached in IndexedDB and by the service worker, so Today still works offline. The cached forecast includes your location, so it is never included in backups.

## Sizes

Each item stores its size in the format that fits it (`src/engine/sizes.ts`):

| Format | Used for | Example |
|---|---|---|
| Letter | tops, layers, most outerwear, hats | M |
| Neck / sleeve | dress shirts | 15.5 / 34 |
| Jacket | blazers, sport coats, suits | 40R |
| Waist × inseam | chinos, jeans, trousers | 32 × 32 |
| Waist | shorts, skirts | W32 |
| Shoe | shoes, in US men / US women / UK / EU | US 10.5 |
| Belt | belts | 34 |
| One size | scarves, bags, watches, ties | One size |

The format is picked from the category and type, and you can override it per item. **Settings → My sizes** holds your usual size for each format and pre-fills new items. Shorts borrow the waist from your pants size. You can search the closet by size.

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
