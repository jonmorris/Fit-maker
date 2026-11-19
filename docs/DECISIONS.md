# Decisions

Reasoning for decisions that isn't written anywhere else. Most of the "why" for this project lives in [README.md](../README.md) (stack, color model, outfit builder, plan, sizes); this file holds the rest: choices made in conversation with the owner, and things deliberately not done yet.

[DECISION-LOG.md](DECISION-LOG.md) is the dated index over both. Add a section here when a decision's reasoning has no other home, then point a decision-log entry at it.

## °F by default

The owner reads temperatures in Fahrenheit. The engine works in °C (Open-Meteo's default) and converts for display; Settings can switch to °C.

## Accessories in outfits

Generated outfits fill top, bottom, shoes, and a layer and coat when the weather calls for them. Belts, watches, hats and ties are left out for now: they add little to color matching, and more slots slow the search and make suggestions busier without making them better. Revisit once the closet is catalogued and real suggestions show whether accessories are missed.

## Wardrobe plan instead of capsule slots

Phase 3 originally planned simple capsule slots ("navy chinos ×1", "rain shell ×1"). The owner already kept a spreadsheet of their own categories (Basics, Casual, Dress, Golf, Winter, Workout) and item types with a target count, notes and a "need new" column, and wanted to edit those in the app, with minimums and maximums. That spreadsheet is a superset of capsule slots, so the plan replaced them:

- Categories and types are the owner's, not built in.
- Each type carries a target, an optional min–max range, an outfit slot and a size format.
- Insights became the Plan tab. Analysis (phase 3b) will build on the plan.

## Spreadsheet "owned" column ignored on import

The owner's sheet had an "Own" column of symbols (`xx`, `+`, `*`). The owner said the symbols were only an example and not a system to keep. Owned counts come from real items (and from the typed-in number for count-only types), so the import ignores that column and every type starts at 0.

## Paste-in items instead of an API key

The owner wanted to add items from screenshots, order emails and links. The options were:

1. **An in-app Claude API key**, stored on the phone, calling the API from the browser. Cheap to run (roughly a few dollars to catalogue ~300 items once, then cents per item) but with real downsides for the owner: separate prepaid API billing from their Claude plan, an API key living inside a web page, screenshots and order emails leaving the device, and a fallible extraction step that still needs review.
2. **No AI**: the screenshot becomes the photo, colors are picked automatically, and the owner types the rest.
3. **Claude in chat writes the item list; the app imports it.** No key, no extra cost, and the owner reviews the list twice (in chat and in the app's preview).

Since the app is for personal use only, the owner chose option 3. The app gained Settings → Add items from text, a forgiving JSON importer that matches plan types by name and parses sizes as people write them. Copying a block of text from the chat is easier on a phone than handling a downloaded .json file, so the importer takes pasted text rather than a file.

The in-app API path (phase 4) stays possible: the item data model already has a draft shape and an `attrSource` field for AI-filled values.

## iOS share target

"Share → Fit Maker" from Mail or Safari would be the smoothest intake, but iOS doesn't let home-screen web apps register as share targets (Android does). On iPhone the flow stays screenshot or copy, then paste. A native wrapper or an iOS Shortcut could close the gap later.

## Order of work

After phase 2 the owner asked for sizes, then a wardrobe plan, then a way to add items in bulk, before the analysis features. Analysis is more useful once the closet and plan hold real data, so phase 3b (redundancy, clash risk, gaps, before-you-buy, orphans) waits behind them.
