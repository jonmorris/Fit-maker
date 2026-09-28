import { describe, expect, it } from 'vitest';
import type { Item } from '../engine/types';
import { DEFAULT_FILTERS, filterItems } from './filters';

let n = 0;
const make = (over: Partial<Item>): Item => ({
  id: `i${++n}`,
  name: 'Item',
  category: 'top',
  subcategory: '',
  primaryColor: { hex: '#ffffff', family: 'white' },
  pattern: 'solid',
  fabric: '',
  formality: ['business-casual'],
  warmth: 2,
  rainOk: false,
  fitNotes: '',
  status: 'active',
  createdAt: n,
  updatedAt: n,
  ...over,
});

const shirt = make({ name: 'White oxford', category: 'top', subcategory: 'Oxford' });
const coat = make({ name: 'Green parka', category: 'outerwear', primaryColor: { hex: '#228b22', family: 'green' }, formality: ['casual'] });
const chinos = make({ name: 'Navy chinos', category: 'bottom', primaryColor: { hex: '#1f2a44', family: 'navy' }, secondaryColor: { hex: '#228b22', family: 'green' } });
const worn = make({ name: 'Old tee', status: 'donate' });
const all = [coat, worn, chinos, shirt];

describe('filterItems', () => {
  it('hides non-active items by default and sorts by category', () => {
    expect(filterItems(all, DEFAULT_FILTERS).map((i) => i.name)).toEqual(['White oxford', 'Navy chinos', 'Green parka']);
  });

  it('filters by color family, matching secondary colors too', () => {
    const res = filterItems(all, { ...DEFAULT_FILTERS, families: ['green'] });
    expect(res.map((i) => i.name)).toEqual(['Navy chinos', 'Green parka']);
  });

  it('filters by formality and category', () => {
    expect(filterItems(all, { ...DEFAULT_FILTERS, formality: 'casual' }).map((i) => i.name)).toEqual(['Green parka']);
    expect(filterItems(all, { ...DEFAULT_FILTERS, category: 'bottom' }).map((i) => i.name)).toEqual(['Navy chinos']);
  });

  it('searches name, subcategory and fabric', () => {
    expect(filterItems(all, { ...DEFAULT_FILTERS, query: 'oxford' }).map((i) => i.name)).toEqual(['White oxford']);
  });

  it('can show all statuses', () => {
    expect(filterItems(all, { ...DEFAULT_FILTERS, status: 'all' })).toHaveLength(4);
  });
});
