# Case study: Fit Maker

A running, modular case study of Fit Maker, a personal wardrobe app for the phone, for use in a portfolio. It is a repo-only record (never built or shipped). Facts and dates come from [DECISION-LOG.md](DECISION-LOG.md); this file is where they become a story.

## How this file works

- **Modules, not chapters.** Each `##` section stands alone, so a write-up can pick modules and drop the rest without leaving a gap. Don't write "as mentioned above".
- **Tag lines.** Every module opens with an italic tag line:
  - **Core**: the spine of any version.
  - **Optional**: for the long form or a specific audience, named in brackets.
  - **Evidence**: what to show beside the text, with `[ ]` while it hasn't been captured and `[x]` once it has.
- **Running.** When work is worth telling, add or amend a module and add a row to *Log of additions*. Take facts and dates from DECISION-LOG.md. New modules get the next number; don't renumber.
- **Placeholders** go in `[[double brackets]]` for the owner to fill in (role, tools, metrics, reflections). Never invent those.

## Suggested cuts

| Form | Modules |
|---|---|
| Short (one page) | 1, 2, 3, 4, 12 |
| Standard | 1, 2, 3, 4, 5, 6, 9, 12 |
| Long | 1–12 |

## 1. Overview

*Core. Evidence: [ ] home-screen icon and the four tabs (Closet, Today, Plan, Settings) on an iPhone; [ ] one screenshot per tab.*

Fit Maker is a wardrobe app I built for myself and use on my phone. It catalogues what I own, suggests outfits for the day's weather and dress code, and tracks a wardrobe plan, so I can see what I actually need before I buy more of what I already have.

- **Role:** [[your role, e.g. designer and front-end developer, product owner]]
- **Timeline:** the first version through the wardrobe plan and bulk intake landed in four pull requests on 28–29 September 2026. [[How you'd like to frame the timeline, and what happened after]]
- **Platform:** an installable Progressive Web App on the iPhone home screen. It works offline, with no account or server; everything stays on the phone.
- **Tools:** Vite, TypeScript, Svelte 5, Dexie (IndexedDB), Workbox via vite-plugin-pwa, Vitest, Playwright for phone-sized end-to-end checks, GitHub Actions and GitHub Pages. Built with Claude Code as a collaborator (module 11). [[Design tools, if any: Figma, sketches…]]

## 2. The problem

*Core. Evidence: [ ] photo of the clashing pieces [[e.g. the green coats and shirts]]; [ ] the old wardrobe spreadsheet (cropped).*

I kept buying things that were nearly the same as what I already owned: a lot of green coats and green shirts that didn't go together. Each purchase looked fine on its own. Together they made outfits that clashed, and the closet filled up without getting more useful.

I already kept a spreadsheet of what I owned and what I meant to have: categories like Basics, Casual, Dress, Golf, Winter and Workout, a target count for each kind of item, and a "need new" column. But it didn't know what anything looked like, so it couldn't warn me that a new olive jacket would fight with a forest-green shirt.

[[Anything else that made this worth solving: cost, closet space, getting dressed in the morning]]

## 3. Reframing the brief

*Core. Evidence: [ ] the original phased plan (Phases 0–4) as a simple diagram.*

The obvious brief was "an outfit app". The real brief was **making better buying decisions**, and outfits are how you find out whether a wardrobe works. That reframing shaped the build:

- **Local-first, for one person.** No account, no backend, nothing to maintain. Data lives in the phone's storage, with a one-file JSON backup.
- **The judgment lives in one place.** All color, outfit and plan logic sits in a pure, unit-tested `engine/` folder. A "before you buy" check then just means running the same analysis with one hypothetical item added.
- **Phased, and re-ordered by use.** The plan was inventory, then outfits with weather, then analysis, then AI tagging. Once real use started, sizes, a wardrobe plan and bulk intake jumped ahead of analysis, because analysis is only useful once the closet holds real data (DECISION-LOG, 2026-09-28, "Order of work").
- **Going minimal.** The goal shifted from "catalogue everything" to "own the right number of the right things", which became the wardrobe plan (module 6).

## 4. Catching "two greens": teaching the app to see clashes

*Core. Evidence: [ ] a pair of swatches the app flags (olive #556b2f vs forest #228b22) next to a pair it allows (light blue vs navy); [ ] the outfit card's "⚠ close but not matching" warning.*

The core problem was a color problem, so the app needed an opinion about color that matches how people see it.

- **A perceptual color space.** Colors are stored as hex and judged in OKLCH, where equal numeric distances look roughly equally different. Hue math in RGB would call some clearly different colors "close" and miss others.
- **Fashion neutrals.** Navy, denim, khaki, brown and olive behave like neutrals in an outfit, so they get their own families instead of being filed under blue, yellow or green. The mapping was tuned against about 50 real garment colors (charcoal, chambray, camel, cognac, burgundy, hunter green…) and locked in with tests.
- **The "near miss" rule.** The first version flagged clashes by overall color distance alone, and it missed forest green against hunter green. Measuring the failing pairs showed the real signal: a clash is two similar hues **without enough lightness contrast to look deliberate**. Light blue with navy is the same hue too, but the big lightness gap makes it read as intentional. The rule now uses both, so olive vs forest, two denim washes and two khakis are flagged, while light blue with navy is not.
- **The color wheel isn't the eye.** In OKLCH, red and green are about 113° apart, not 180°, so "complementary" starts at 110°. That's a small detail, but the kind of thing that makes suggestions feel right or wrong.

## 5. An outfit engine that explains itself

*Core. Evidence: [ ] the Today tab on a rainy day: weather card, a suggestion with its reasons, a locked piece; [ ] before/after of the "same outfit plus a sweater" fix.*

The Today tab builds outfits from what's in the closet: top, bottom and shoes, plus a layer and coat when the weather calls for them.

- **The worst pair matters most.** One clash ruins an outfit no matter how well the rest goes together, so the score weights the worst color pair most heavily. Patterns, formality stretch, warmth and recent wear adjust it from there.
- **Weather as constraints, not trivia.** The forecast for the hours I'm actually out (8am–7pm) sets a warmth budget. At 40%+ rain, the coat has to be rain-ready; on a hot, rainy day it suggests an umbrella instead.
- **Every suggestion says why.** For example "Navy + white: neutral pairing", "Navy shell for the rain", or "⚠ Green shirt + Green coat: close but not matching". That makes the logic trustworthy, and tunable when it's wrong.
- **Control without configuration.** Tap a piece to lock it and build around it, shuffle for alternatives, star favorites, log what I wore.
- **A bug that only real use shows.** After logging an outfit, the next top suggestion was the same outfit plus a sweater. An exact-repeat check misses that, so near repeats (the same outfit give or take one piece) are now pushed down too.

## 6. From closet to plan

*Core. Evidence: [ ] the Plan tab with Need / On target / Over filters; [ ] the spreadsheet pasted in and the resulting plan.*

The wardrobe plan turned my old spreadsheet into something the app understands.

- **My categories, not the app's.** Basics, Casual, Dress, Golf, Winter and Workout, each with item types that have a target count or a range ("5–8 T-shirts is fine"), notes and a "need new" note.
- **Owned vs target.** Each type shows 🔴 Need, 🟢 On target or 🟠 Over. "Need" is a shopping list, and "Over" is where the redundancy lives.
- **Paste, don't retype.** Pasting the existing 52-row spreadsheet creates the whole plan. Each type's outfit slot is guessed from its name (Golf polo → top, Rain shell → outerwear, Snowpants → never in outfits), and every guess on the real sheet came out right.
- **Count, don't catalogue, the boring things.** Socks and underwear are a number with −/+ buttons, not a photo per pair.
- **Some clothes aren't for daily outfits.** A category like Golf can be switched off for suggestions while still counting toward the plan.
- This replaced the simpler "capsule slots" first planned, because the spreadsheet already did more (DECISIONS.md → Wardrobe plan instead of capsule slots).

## 7. Designing for a phone, not a desk

*Optional [mobile / interaction design audience]. Evidence: [ ] the eyedropper loupe mid-drag; [ ] the size picker for shoes vs dress shirts; [ ] dark mode.*

- **An eyedropper iOS doesn't have.** Safari has no native eyedropper, so picking a garment's color is a custom touch-and-drag with a magnifier loupe above the finger (which would otherwise hide what you're picking). It averages a small patch to ignore fabric texture. The most dominant colors are also suggested as one-tap swatches.
- **Photos that fit on a phone.** Camera photos are re-encoded to a 1280px JPEG plus a thumbnail, about 100–250 KB per item, because Safari can't reliably encode WebP.
- **Sizes the way they're actually written.** A dress shirt is 15.5/34, jeans are 32×30, shoes are US 10.5, a blazer is 40R. Each item uses the format that fits it, and a My sizes profile pre-fills new items.
- **iOS details that bite.** Inputs are kept at 16px so iOS doesn't zoom on tap. Safe areas are respected around the notch. Backups go through the share sheet because downloads are unreliable in home-screen mode. And the app tells you to install it before entering data, because iOS keeps the home-screen app's storage separate from Safari's.

## 8. The API-key question

*Optional [product / AI-product audience]. Evidence: [ ] a Claude chat turning a screenshot into an item list; [ ] the app's "Add items from text" preview.*

I wanted to add items by dropping in screenshots, order emails or links. The natural design was an in-app AI step using my own Claude API key. It would have been cheap (roughly a few dollars to catalogue ~300 items once), but it brought separate API billing, an API key living inside a web page, and private emails leaving the device. All that for a tool with one user.

The alternative: Claude in chat writes the item list from whatever I send, and the app imports it through a forgiving paste-in box that matches my plan types by name and reads sizes as people write them. No key, no extra cost, and two review points (the chat and the app's preview). The in-app AI path stays open for later, because the data model was shaped for it from day one (DECISIONS.md → Paste-in items instead of an API key).

[[Your take: was this the right call in practice?]]

## 9. Saying no on the record

*Core. Evidence: [ ] the Deferred rows of DECISION-LOG.md.*

Some of the most useful decisions were things not to build yet. Each one is logged with its reason:

- **Accessories in outfits:** they add little to color matching, and more slots make suggestions busier without making them better.
- **In-app AI intake and tagging:** replaced, for now, by Claude-in-chat plus paste-in (module 8).
- **"Share → Fit Maker" on iPhone:** iOS doesn't let home-screen web apps be share targets. The workaround is screenshot and paste.
- **Analysis (redundancy, clash risk, gaps, before-you-buy, orphans):** waits until the closet and plan hold real data.

Writing these down kept the scope honest and made them easy to pick back up later.

## 10. Quality

*Optional [engineering audience]. Evidence: [ ] CI run on a pull request; [ ] a phone-sized end-to-end screenshot set (light and dark).*

- **The logic is tested where it lives.** Color mapping, harmony, weather rules, outfit search, sizes, plan math, spreadsheet and item parsing and backups are all unit-tested: 199 tests by the fourth pull request. Every fixture is a real garment color or a real row from my spreadsheet.
- **Every pull request** passes type checks, tests and a production build in CI before it can merge.
- **Real-browser checks at iPhone size.** Each feature was driven end to end in headless Chromium at iPhone 13 size, in light and dark mode: add an item, eyedrop a color, build outfits on a mocked rainy day, import the real 52-row plan.

Those runs caught bugs unit tests didn't:
- a doubled accessibility label;
- a magnifier that didn't draw on the first touch;
- an outfit card column stretched by the word "OUTERWEAR";
- suggestions not sorted by the score they showed;
- "Add …" buttons in the browser's default blue;
- the "same outfit plus a sweater" problem from module 5.

## 11. Working with an AI collaborator

*Optional [AI / process audience]. Evidence: [ ] the opening plan-before-code exchange; [ ] a mid-build answer changing direction (e.g. "going minimal").*

I built Fit Maker with Claude Code. A few patterns made it work:

- **Plan before code.** The first exchange was a written plan (stack, data model, phases) that I approved, pushed back on where needed, and answered questions about: °F, GitHub Pages, formality as multi-select, and "going minimal".
- **Decisions stay with me.** Claude proposed and explained the trade-offs (Svelte vs no framework, API key vs paste-in, plan vs capsule slots), and I chose.
- **Evidence over assurance.** Each change came with tests, a type check, a build and phone-sized screenshots, and bugs found that way were fixed before the pull request went up.
- **Records as we go.** This case study and the decision log are kept by the same process, in the same commits as the work.

[[Your reflection: what worked, what you'd change, where you overrode it]]

## 12. Outcome and reflection

*Core. Evidence: [ ] [[metrics screenshot, e.g. the Plan summary]]; [ ] [[before/after of the closet]].*

- **Shipped:** an installable, offline phone app with inventory, weather-aware outfit suggestions that flag near-miss clashes, a wardrobe plan imported from my existing spreadsheet, sizes, and bulk intake via Claude.
- **In use:** [[how many items catalogued, how often you use Today, how long you've used it]]
- **Effect on buying:** [[purchases avoided or changed because of a Need/Over count or a clash warning]]
- **What I learned:** [[reflection]]
- **Next:** analysis (redundancy, clash risk, gaps, before-you-buy, orphans) on top of the plan. [[Anything else you want to name]]

## Log of additions

| Date | Module | Change |
|---|---|---|
| 2026-11-19 | 1–12 | Initial draft from git history, README, DECISIONS.md and DECISION-LOG.md |
