import { describe, expect, it } from 'vitest';
import {
  expandCategory, guessCountOnly, guessSlot, ownedFor, parsePlanTable, planProgress, planSummary, progressFor, typeRange,
  type ItemType,
} from './plan';
import type { Item } from './types';

const type = (over: Partial<ItemType> = {}): ItemType => ({
  id: 't1',
  categoryId: 'c1',
  name: 'Jeans',
  target: 3,
  slot: 'bottom',
  countOnly: false,
  ownedCount: 0,
  notes: '',
  shopping: '',
  order: 0,
  ...over,
});

let n = 0;
const item = (typeId: string | undefined, status: Item['status'] = 'active'): Item => ({
  id: `i${++n}`,
  name: 'x',
  category: 'bottom',
  subcategory: '',
  primaryColor: { hex: '#1f2a44', family: 'navy' },
  pattern: 'solid',
  fabric: '',
  formality: ['casual'],
  warmth: 2,
  rainOk: false,
  fitNotes: '',
  status,
  typeId,
  createdAt: 0,
  updatedAt: 0,
});

describe('typeRange', () => {
  it('defaults min and max to the target', () => {
    expect(typeRange({ target: 4 })).toEqual([4, 4]);
  });
  it('uses an explicit range', () => {
    expect(typeRange({ target: 6, min: 5, max: 8 })).toEqual([5, 8]);
  });
  it('never lets max fall below min', () => {
    expect(typeRange({ target: 2, min: 3 })).toEqual([3, 3]);
  });
});

describe('ownedFor / progressFor', () => {
  it('counts linked items, excluding ones marked donate', () => {
    const items = [item('t1'), item('t1', 'repair'), item('t1', 'donate'), item('other'), item(undefined)];
    expect(ownedFor(type(), items)).toBe(2);
  });

  it('uses the typed-in number for count-only types', () => {
    expect(ownedFor(type({ countOnly: true, ownedCount: 7 }), [item('t1')])).toBe(7);
  });

  it('reports under, ok and over', () => {
    const t = type({ target: 2 });
    expect(progressFor(t, [item('t1')])).toMatchObject({ status: 'under', need: 1, extra: 0 });
    expect(progressFor(t, [item('t1'), item('t1')])).toMatchObject({ status: 'ok', need: 0 });
    expect(progressFor(t, [item('t1'), item('t1'), item('t1'), item('t1')])).toMatchObject({ status: 'over', extra: 2 });
  });

  it('treats anything inside a range as ok', () => {
    const t = type({ target: 6, min: 5, max: 8 });
    expect(progressFor(t, Array.from({ length: 7 }, () => item('t1'))).status).toBe('ok');
  });

  it('summarises a plan', () => {
    const types = [type({ id: 'a', target: 1 }), type({ id: 'b', target: 0 }), type({ id: 'c', target: 2 })];
    const items = [item('a'), item('b')];
    expect(planSummary(planProgress(types, items))).toEqual({ under: 1, ok: 1, over: 1 });
  });
});

describe('guessSlot', () => {
  it.each([
    ['Underwear', 'other'],
    ['Casual Socks', 'other'],
    ['Under shirts', 'other'],
    ['Base layer pants', 'other'],
    ['Swimsuits', 'other'],
    ['Snowpants', 'other'],
    ['T-shirts', 'top'],
    ['Casual button down shirts', 'top'],
    ['Golf polo', 'top'],
    ['Performance long sleeve', 'top'],
    ['Jeans', 'bottom'],
    ['Sweatpants', 'bottom'],
    ['Baggies Shorts', 'bottom'],
    ['Dress pants', 'bottom'],
    ['Hoodie', 'layer'],
    ['Sweater/Fleece?', 'layer'],
    ['Golf sweater/hoodie', 'layer'],
    ['Light Jacket', 'outerwear'],
    ['Rain shell', 'outerwear'],
    ['Golf rain layer', 'outerwear'],
    ['Blazer', 'outerwear'],
    ['Nice winter coat', 'outerwear'],
    ['Boots', 'shoes'],
    ['Sneakers', 'shoes'],
    ['Dress Shoes', 'shoes'],
    ['Sandals', 'shoes'],
    ['Belts', 'accessory'],
    ['Watch', 'accessory'],
    ['Ties', 'accessory'],
    ['Bow Ties', 'accessory'],
    ['Winter Hat', 'accessory'],
    ['Heavy winter gloves', 'accessory'],
    ['Dirty yard clothes', 'other'],
  ])('%s → %s', (name, slot) => {
    expect(guessSlot(name)).toBe(slot);
  });
});

describe('guessCountOnly', () => {
  it('flags basics you just count', () => {
    expect(guessCountOnly('Underwear')).toBe(true);
    expect(guessCountOnly('Dress Socks')).toBe(true);
    expect(guessCountOnly('Compression Shorts')).toBe(true);
    expect(guessCountOnly('Jeans')).toBe(false);
  });
});

describe('expandCategory', () => {
  it('expands common two-letter codes and keeps anything else', () => {
    expect(expandCategory('Ba')).toBe('Basics');
    expect(expandCategory('wo')).toBe('Workout');
    expect(expandCategory('Travel capsule')).toBe('Travel capsule');
  });
});

describe('parsePlanTable', () => {
  const sheet = [
    '\t\t\t\t\t\t',
    'Cat\tItem\t#\tOwn\tItem Description\tNeed New\t\t\t',
    'Ba\tUnderwear\t9\txx\tMaybe more, why throw them away\t\t\t',
    'Ba\tBelts\t2\t+\t1 brown, 1 black\tYes',
    'Ca\tJeans\t4\txx\t2 blue, 1 tan, 1 grey\tYes',
    'Dr\tDress shirts\t5\txx\tBonobos XXL Slim fit\t-',
    'Go\tGolf polo\t4\txx\t\tNeed new better options',
    'Wo\tRunning shoes\t1\t+\tActual good sneakers for running\tMaybe',
  ].join('\n');

  it('reads a tab-separated sheet by its header names, ignoring extra columns', () => {
    const plan = parsePlanTable(sheet);
    expect(plan.categories).toEqual(['Basics', 'Casual', 'Dress', 'Golf', 'Workout']);
    expect(plan.types).toHaveLength(6);
    expect(plan.types[0]).toEqual({
      category: 'Basics',
      name: 'Underwear',
      target: 9,
      notes: 'Maybe more, why throw them away',
      shopping: '',
    });
    expect(plan.types[1].shopping).toBe('Yes');
    expect(plan.types[3].shopping).toBe(''); // "-" means nothing to buy
  });

  it('reads CSV with quoted commas', () => {
    const plan = parsePlanTable('Category,Item,Target,Notes\nCasual,Jeans,4,"2 blue, 1 tan"\n');
    expect(plan.types[0]).toMatchObject({ category: 'Casual', name: 'Jeans', target: 4, notes: '2 blue, 1 tan' });
  });

  it('assumes category, item, target, notes, shopping without a header', () => {
    const plan = parsePlanTable('Casual\tSneakers\t2\tWhite + black\tMaybe');
    expect(plan.types[0]).toEqual({ category: 'Casual', name: 'Sneakers', target: 2, notes: 'White + black', shopping: 'Maybe' });
  });

  it('defaults a missing target to 1 and skips blank rows', () => {
    const plan = parsePlanTable('Cat\tItem\t#\nCa\tHat\t\n\t\t\n');
    expect(plan.types).toEqual([{ category: 'Casual', name: 'Hat', target: 1, notes: '', shopping: '' }]);
  });
});
