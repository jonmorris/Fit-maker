import { describe, expect, it } from 'vitest';
import { colorFamily } from './color';
import { daysBetween, outfitKey, piecesOf, recentWearMap, scoreOutfit, suggestOutfits, type OutfitRequest } from './outfits';
import type { Item } from './types';
import { DEFAULT_NEEDS, needsFor, type WeatherNeeds } from './weather';

let n = 0;
function item(name: string, category: Item['category'], hex: string, over: Partial<Item> = {}): Item {
  return {
    id: `${category}-${++n}`,
    name,
    category,
    subcategory: '',
    primaryColor: { hex, family: colorFamily(hex) },
    pattern: 'solid',
    fabric: '',
    formality: ['casual', 'business-casual'],
    warmth: category === 'outerwear' ? 3 : 2,
    rainOk: false,
    fitNotes: '',
    status: 'active',
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

const whiteOxford = item('White oxford', 'top', '#f5f5f0');
const greenShirt = item('Green shirt', 'top', '#228b22');
const navyChinos = item('Navy chinos', 'bottom', '#1f2a44');
const khakis = item('Khakis', 'bottom', '#c3b091');
const brownShoes = item('Brown derbies', 'shoes', '#6b4a2f');
const whiteSneakers = item('White sneakers', 'shoes', '#f7f7f7', { formality: ['casual'] });
const greenCoat = item('Green coat', 'outerwear', '#355e3b', { warmth: 4 });
const rainShell = item('Navy rain shell', 'outerwear', '#243050', { rainOk: true, warmth: 2 });
const greySweater = item('Grey sweater', 'layer', '#8d8d8d', { warmth: 3 });
const wardrobe = [whiteOxford, greenShirt, navyChinos, khakis, brownShoes, whiteSneakers, greenCoat, rainShell, greySweater];

const req = (over: Partial<OutfitRequest> = {}): OutfitRequest => ({
  items: wardrobe,
  dressCode: 'business-casual',
  needs: DEFAULT_NEEDS,
  ...over,
});

const mild: WeatherNeeds = needsFor({ date: 'd', tempMin: 19, tempMax: 23, feelsMin: 19, feelsMax: 23, rainChance: 0 });
const coldRain: WeatherNeeds = needsFor({ date: 'd', tempMin: 6, tempMax: 9, feelsMin: 5, feelsMax: 8, rainChance: 80 });
const hot: WeatherNeeds = needsFor({ date: 'd', tempMin: 28, tempMax: 32, feelsMin: 29, feelsMax: 33, rainChance: 0 });

describe('scoreOutfit', () => {
  it('prefers a harmonious outfit over one with a near-miss clash', () => {
    const good = scoreOutfit({ top: whiteOxford, bottom: navyChinos, shoes: brownShoes, outerwear: greenCoat }, req());
    const clash = scoreOutfit({ top: greenShirt, bottom: navyChinos, shoes: brownShoes, outerwear: greenCoat }, req());
    expect(good.score).toBeGreaterThan(clash.score + 20);
    expect(clash.warnings.join(' ')).toMatch(/Green shirt \+ Green coat/);
  });

  it('penalises competing patterns', () => {
    const plaid = item('Plaid shirt', 'top', '#f5f5f0', { pattern: 'plaid' });
    const striped = item('Striped chinos', 'bottom', '#1f2a44', { pattern: 'stripe' });
    const one = scoreOutfit({ top: plaid, bottom: navyChinos, shoes: brownShoes }, req());
    const two = scoreOutfit({ top: plaid, bottom: striped, shoes: brownShoes }, req());
    expect(two.score).toBeLessThan(one.score);
    expect(two.warnings).toContain('Competing patterns');
  });

  it('penalises being far too warm on a hot day', () => {
    const base = { top: whiteOxford, bottom: navyChinos, shoes: brownShoes };
    expect(scoreOutfit({ ...base, layer: greySweater }, req({ needs: hot })).score).toBeLessThan(
      scoreOutfit(base, req({ needs: hot })).score,
    );
  });

  it('penalises recently worn items and exact repeats', () => {
    const pieces = { top: whiteOxford, bottom: navyChinos, shoes: brownShoes };
    const fresh = scoreOutfit(pieces, req()).score;
    const recentWear = new Map([[whiteOxford.id, 1]]);
    const recentOutfits = new Set([outfitKey(piecesOf(pieces).map((i) => i.id))]);
    expect(scoreOutfit(pieces, req({ recentWear })).score).toBeLessThan(fresh);
    expect(scoreOutfit(pieces, req({ recentOutfits })).score).toBeLessThan(fresh - 15);
  });
});

describe('suggestOutfits', () => {
  it('always fills top, bottom and shoes', () => {
    const { suggestions } = suggestOutfits(req({ needs: mild }));
    expect(suggestions.length).toBeGreaterThan(0);
    for (const s of suggestions) {
      expect(s.pieces.top && s.pieces.bottom && s.pieces.shoes).toBeTruthy();
    }
  });

  it('never pairs the green shirt with the green coat in its top pick', () => {
    const { suggestions } = suggestOutfits(req({ needs: coldRain, items: [...wardrobe, item('Olive parka', 'outerwear', '#556b2f', { warmth: 4, rainOk: true })] }));
    const top = suggestions[0];
    const greens = piecesOf(top.pieces).filter((i) => i.primaryColor.family === 'green' || i.primaryColor.family === 'olive');
    expect(greens.length).toBeLessThanOrEqual(1);
  });

  it('requires rain-ready outerwear when rain is likely', () => {
    const { suggestions } = suggestOutfits(req({ needs: { ...coldRain, outerwearMinWarmth: 1 } }));
    for (const s of suggestions) expect(s.pieces.outerwear?.rainOk).toBe(true);
  });

  it('falls back with a notice when nothing rain-ready is warm enough', () => {
    const { suggestions, notices } = suggestOutfits(req({ needs: coldRain, items: wardrobe.filter((i) => i !== rainShell) }));
    expect(suggestions.length).toBeGreaterThan(0);
    expect(notices.join(' ')).toMatch(/umbrella/);
  });

  it('skips outerwear and layers on a hot day', () => {
    const { suggestions } = suggestOutfits(req({ needs: hot }));
    for (const s of suggestions) {
      expect(s.pieces.outerwear).toBeUndefined();
      expect(s.pieces.layer).toBeUndefined();
    }
  });

  it('honours a locked piece in every suggestion', () => {
    const { suggestions } = suggestOutfits(req({ locked: { bottom: khakis.id } }));
    expect(suggestions.length).toBeGreaterThan(0);
    for (const s of suggestions) expect(s.pieces.bottom?.id).toBe(khakis.id);
  });

  it('honours a lock even when the piece fails the filters', () => {
    const { suggestions } = suggestOutfits(req({ dressCode: 'dressy', locked: { shoes: whiteSneakers.id } }));
    expect(suggestions[0].pieces.shoes?.id).toBe(whiteSneakers.id);
  });

  it('drops casual-only pieces for business casual when alternatives exist', () => {
    const { suggestions } = suggestOutfits(req());
    expect(suggestions[0].pieces.shoes?.id).toBe(brownShoes.id);
  });

  it('reports missing required categories', () => {
    const { suggestions, missing } = suggestOutfits(req({ items: [whiteOxford, navyChinos] }));
    expect(suggestions).toEqual([]);
    expect(missing).toEqual(['shoes']);
  });

  it('ignores items that are not active', () => {
    const { suggestions } = suggestOutfits(req({ items: wardrobe.map((i) => (i === brownShoes ? { ...i, status: 'repair' as const } : i)) }));
    for (const s of suggestions) expect(s.pieces.shoes?.id).not.toBe(brownShoes.id);
  });

  it('returns distinct outfits', () => {
    const { suggestions } = suggestOutfits(req({ needs: mild }));
    expect(new Set(suggestions.map((s) => s.key)).size).toBe(suggestions.length);
  });

  it('is deterministic for a seed and changes with a different seed', () => {
    const a = suggestOutfits(req({ seed: 1 })).suggestions.map((s) => s.key);
    expect(suggestOutfits(req({ seed: 1 })).suggestions.map((s) => s.key)).toEqual(a);
    const seeds = [2, 3, 4, 5, 6].map((seed) => suggestOutfits(req({ seed })).suggestions.map((s) => s.key).join());
    expect(seeds.some((k) => k !== a.join())).toBe(true);
  });

  it('treats the same outfit plus one extra piece as a near repeat', () => {
    const worn = { top: whiteOxford, bottom: navyChinos, shoes: brownShoes };
    const recentOutfits = new Set([outfitKey(piecesOf(worn).map((i) => i.id))]);
    const plusLayer = scoreOutfit({ ...worn, layer: greySweater }, req({ recentOutfits }));
    expect(plusLayer.warnings).toContain('Nearly the same as a recent outfit');
    const different = scoreOutfit({ top: whiteOxford, bottom: khakis, shoes: whiteSneakers }, req({ recentOutfits }));
    expect(different.warnings).not.toContain('Nearly the same as a recent outfit');
  });

  it('lists suggestions best first', () => {
    const scores = suggestOutfits(req({ seed: 3 })).suggestions.map((s) => s.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('pushes a just-worn outfit down the list', () => {
    const first = suggestOutfits(req({ needs: mild })).suggestions[0];
    const recentOutfits = new Set([first.key]);
    const recentWear = recentWearMap([{ date: '2026-09-28', itemIds: piecesOf(first.pieces).map((i) => i.id) }], '2026-09-28');
    const next = suggestOutfits(req({ needs: mild, recentOutfits, recentWear })).suggestions[0];
    expect(next.key).not.toBe(first.key);
  });
});

describe('wear history helpers', () => {
  it('counts days between dates', () => {
    expect(daysBetween('2026-09-26', '2026-09-28')).toBe(2);
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1);
  });

  it('keeps the most recent wear per item within two weeks', () => {
    const m = recentWearMap(
      [
        { date: '2026-09-20', itemIds: ['a', 'b'] },
        { date: '2026-09-27', itemIds: ['a'] },
        { date: '2026-08-01', itemIds: ['c'] },
      ],
      '2026-09-28',
    );
    expect(m.get('a')).toBe(1);
    expect(m.get('b')).toBe(8);
    expect(m.has('c')).toBe(false);
  });
});
