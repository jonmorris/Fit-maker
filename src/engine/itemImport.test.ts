import { describe, expect, it } from 'vitest';
import { parseFormality, parseItemsText, parseSize, resolveEntries, type ResolveContext } from './itemImport';
import type { ItemType, PlanCategory } from './plan';
import type { Item } from './types';

const cats: PlanCategory[] = [
  { id: 'ca', name: 'Casual', order: 0, inOutfits: true },
  { id: 'go', name: 'Golf', order: 1, inOutfits: false },
];
const type = (id: string, categoryId: string, name: string, slot: ItemType['slot'], over: Partial<ItemType> = {}): ItemType => ({
  id, categoryId, name, target: 1, slot, countOnly: false, ownedCount: 0, notes: '', shopping: '', order: 0, ...over,
});
const types = [
  type('jeans', 'ca', 'Jeans', 'bottom'),
  type('polo-ca', 'ca', 'Polo', 'top'),
  type('polo-go', 'go', 'Polo', 'top'),
  type('rain', 'ca', 'Rain shell', 'outerwear'),
];

let n = 0;
const ctx = (over: Partial<ResolveContext> = {}): ResolveContext => ({
  categories: cats,
  types,
  existing: [],
  newId: () => `new-${++n}`,
  now: 1000,
  ...over,
});

describe('parseItemsText', () => {
  it('accepts a wrapped list, a bare array and code fences', () => {
    expect(parseItemsText('{"items":[{"name":"A"}]}').entries).toHaveLength(1);
    expect(parseItemsText('[{"name":"A"},{"name":"B"}]').entries).toHaveLength(2);
    expect(parseItemsText('```json\n{"fitMakerItems":1,"items":[{"name":"A"}]}\n```').entries).toHaveLength(1);
  });

  it('drops entries without a name and reports bad JSON', () => {
    expect(parseItemsText('[{"name":""},{"color":"#fff"},{"name":"Ok"}]').entries.map((e) => e.name)).toEqual(['Ok']);
    expect(parseItemsText('{nope').error).toMatch(/valid/);
    expect(parseItemsText('{"foo":1}').error).toMatch(/items/);
  });
});

describe('parseSize', () => {
  it.each([
    ['32 x 30', 'waist-inseam', { kind: 'waist-inseam', value: '32x30' }],
    ['32×32', 'waist-inseam', { kind: 'waist-inseam', value: '32x32' }],
    ['W33', 'waist', { kind: 'waist', value: '33' }],
    ['US 10.5', 'shoe', { kind: 'shoe', value: '10.5', system: 'US-M' }],
    ['EU 44', 'shoe', { kind: 'shoe', value: '44', system: 'EU' }],
    ['8W', 'shoe', { kind: 'shoe', value: '8', system: 'US-W' }],
    ['15.5/34-35', 'dress-shirt', { kind: 'dress-shirt', value: '15.5/34/35' }],
    ['40 Regular', 'jacket', { kind: 'jacket', value: '40R' }],
    ['42L', 'jacket', { kind: 'jacket', value: '42L' }],
    ['xxl', 'letter', { kind: 'letter', value: 'XXL' }],
    ['Medium', 'letter', { kind: 'letter', value: 'M' }],
    ['', 'one-size', { kind: 'one-size', value: 'One size' }],
  ] as const)('%s as %s', (raw, kind, expected) => {
    expect(parseSize(raw, kind)).toEqual(expected);
  });

  it('returns undefined when nothing usable is given', () => {
    expect(parseSize('', 'letter')).toBeUndefined();
    expect(parseSize('slim', 'waist-inseam')).toBeUndefined();
  });
});

describe('parseFormality', () => {
  it('understands loose wording', () => {
    expect(parseFormality(['casual', 'business casual'])).toEqual(['casual', 'business-casual']);
    expect(parseFormality('Business-casual, formal')).toEqual(['business-casual', 'dressy']);
    expect(parseFormality(undefined)).toBeUndefined();
  });
});

describe('resolveEntries', () => {
  it('matches plan types by name, preferring the given category', () => {
    const [golf, casual] = resolveEntries(
      [
        { name: 'White golf polo', category: 'Golf', type: 'polo', color: '#f5f5f0', size: 'L' },
        { name: 'Navy polo', type: 'Polo', color: '#1f2a44' },
      ],
      ctx(),
    );
    expect(golf.item.typeId).toBe('polo-go');
    expect(golf.item.category).toBe('top');
    expect(golf.item.size).toEqual({ kind: 'letter', value: 'L' });
    expect(casual.item.typeId).toBe('polo-ca');
  });

  it('fills slot, size format, color family and notes', () => {
    const [r] = resolveEntries(
      [{ name: 'Dark jeans', category: 'Casual', type: 'Jeans', color: '#2C3E5C', size: '32x32', brand: 'Levi’s', notes: '511 slim' }],
      ctx(),
    );
    expect(r.item).toMatchObject({
      category: 'bottom',
      subcategory: 'Jeans',
      primaryColor: { hex: '#2c3e5c', family: 'navy' },
      size: { kind: 'waist-inseam', value: '32x32' },
      fitNotes: 'Levi’s · 511 slim',
      status: 'active',
    });
  });

  it('keeps unmatched types as untyped items and says so', () => {
    const [r] = resolveEntries([{ name: 'Linen shirt', type: 'Linen shirts', color: '#f5f5dc' }], ctx());
    expect(r.item.typeId).toBeUndefined();
    expect(r.unmatchedType).toBe('Linen shirts');
    expect(r.item.category).toBe('top'); // guessed from the type name
  });

  it('flags duplicates of existing items and within the paste', () => {
    const existing = [{ name: 'Navy polo', primaryColor: { hex: '#1f2a44', family: 'navy' } } as Item];
    const res = resolveEntries(
      [
        { name: 'navy polo', color: '#1F2A44' },
        { name: 'Grey tee', color: '#8d8d8d' },
        { name: 'Grey tee', color: '#8d8d8d' },
      ],
      ctx({ existing }),
    );
    expect(res.map((r) => r.duplicate)).toEqual([true, false, true]);
  });

  it('defaults to gray when the color is missing or invalid, and clamps warmth', () => {
    const [r] = resolveEntries([{ name: 'Mystery jacket', color: 'greenish', warmth: 9, rainOk: true }], ctx());
    expect(r.item.primaryColor.hex).toBe('#808080');
    expect(r.item.warmth).toBe(5);
    expect(r.item.rainOk).toBe(true);
  });
});
