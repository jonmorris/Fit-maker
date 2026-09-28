import { describe, expect, it } from 'vitest';
import {
  SHOE_SIZES, defaultSize, formatSize, makeSize, sizeKindFor, sizeParts, type ItemSize, type SizeProfile,
} from './sizes';

describe('sizeKindFor', () => {
  it('picks the right format per garment', () => {
    expect(sizeKindFor('top', 'T-shirt')).toBe('letter');
    expect(sizeKindFor('top', 'Dress shirt')).toBe('dress-shirt');
    expect(sizeKindFor('bottom', 'Chinos')).toBe('waist-inseam');
    expect(sizeKindFor('bottom', 'Shorts')).toBe('waist');
    expect(sizeKindFor('outerwear', 'Blazer')).toBe('jacket');
    expect(sizeKindFor('outerwear', 'Rain jacket')).toBe('letter');
    expect(sizeKindFor('layer', 'Cardigan')).toBe('letter');
    expect(sizeKindFor('shoes', 'Loafers')).toBe('shoe');
    expect(sizeKindFor('accessory', 'Belt')).toBe('belt');
    expect(sizeKindFor('accessory', 'Scarf')).toBe('one-size');
    expect(sizeKindFor('accessory', 'Hat')).toBe('letter');
  });

  it('defaults sensibly with no subcategory', () => {
    expect(sizeKindFor('top')).toBe('letter');
    expect(sizeKindFor('bottom')).toBe('waist-inseam');
  });
});

describe('makeSize / sizeParts', () => {
  const roundTrip = (size: ItemSize) => {
    const [a, b] = sizeParts(size);
    return makeSize(size.kind, a, b, size.system);
  };

  it.each<ItemSize>([
    { kind: 'letter', value: 'M' },
    { kind: 'dress-shirt', value: '15.5/34/35' },
    { kind: 'dress-shirt', value: '16/34' },
    { kind: 'jacket', value: '40R' },
    { kind: 'waist-inseam', value: '32x30' },
    { kind: 'waist', value: '33' },
    { kind: 'shoe', value: '10.5', system: 'EU' },
    { kind: 'belt', value: '34' },
  ])('round-trips %o', (size) => {
    expect(roundTrip(size)).toEqual(size);
  });

  it('returns undefined when nothing is picked', () => {
    expect(makeSize('letter', '')).toBeUndefined();
  });

  it('one-size needs no input', () => {
    expect(makeSize('one-size', '')).toEqual({ kind: 'one-size', value: 'One size' });
  });

  it('defaults shoes to US men', () => {
    expect(makeSize('shoe', '10')?.system).toBe('US-M');
  });
});

describe('formatSize', () => {
  it('formats each kind for display', () => {
    expect(formatSize({ kind: 'dress-shirt', value: '15.5/34' })).toBe('15.5 / 34');
    expect(formatSize({ kind: 'waist-inseam', value: '32x32' })).toBe('32 × 32');
    expect(formatSize({ kind: 'waist', value: '32' })).toBe('W32');
    expect(formatSize({ kind: 'shoe', value: '10.5', system: 'US-M' })).toBe('US 10.5');
    expect(formatSize({ kind: 'shoe', value: '8', system: 'US-W' })).toBe('US 8W');
    expect(formatSize({ kind: 'shoe', value: '44', system: 'EU' })).toBe('EU 44');
    expect(formatSize(undefined)).toBe('');
  });
});

describe('shoe size options', () => {
  it('include half sizes', () => {
    expect(SHOE_SIZES['US-M']).toContain('10.5');
    expect(SHOE_SIZES['US-M'][0]).toBe('5');
    expect(SHOE_SIZES['US-M'].at(-1)).toBe('16');
  });
});

describe('defaultSize', () => {
  const profile: SizeProfile = {
    letter: { kind: 'letter', value: 'M' },
    'waist-inseam': { kind: 'waist-inseam', value: '32x32' },
    shoe: { kind: 'shoe', value: '10.5', system: 'US-M' },
  };

  it('uses the profile size for the matching format', () => {
    expect(defaultSize('top', 'Polo', profile)).toEqual({ kind: 'letter', value: 'M' });
    expect(defaultSize('bottom', 'Chinos', profile)).toEqual({ kind: 'waist-inseam', value: '32x32' });
    expect(defaultSize('shoes', '', profile)).toEqual({ kind: 'shoe', value: '10.5', system: 'US-M' });
  });

  it('borrows the waist for shorts', () => {
    expect(defaultSize('bottom', 'Shorts', profile)).toEqual({ kind: 'waist', value: '32' });
  });

  it('returns a copy, not the profile object', () => {
    const s = defaultSize('top', '', profile)!;
    s.value = 'L';
    expect(profile.letter?.value).toBe('M');
  });

  it('is empty when the profile has no size for that format', () => {
    expect(defaultSize('top', 'Dress shirt', profile)).toBeUndefined();
    expect(defaultSize('top', '', undefined)).toBeUndefined();
  });

  it('always fills one-size accessories', () => {
    expect(defaultSize('accessory', 'Scarf', {})).toEqual({ kind: 'one-size', value: 'One size' });
  });
});
