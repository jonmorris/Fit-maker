// Garment sizing. Each item stores its size in the format that fits its type
// (letter, neck/sleeve, waist × inseam, shoe…), and a profile holds your
// usual size per format so new items can be pre-filled.

import type { Category } from './types';

export const SIZE_KINDS = ['letter', 'dress-shirt', 'jacket', 'waist-inseam', 'waist', 'shoe', 'belt', 'one-size'] as const;
export type SizeKind = (typeof SIZE_KINDS)[number];

export const SHOE_SYSTEMS = ['US-M', 'US-W', 'UK', 'EU'] as const;
export type ShoeSystem = (typeof SHOE_SYSTEMS)[number];

export interface ItemSize {
  kind: SizeKind;
  /** Canonical value, e.g. "M", "15.5/34", "40R", "32x32", "10.5", "One size". */
  value: string;
  /** Only for shoes. */
  system?: ShoeSystem;
}

/** Your usual size for each format. */
export type SizeProfile = Partial<Record<SizeKind, ItemSize>>;

export const SIZE_KIND_LABEL: Record<SizeKind, string> = {
  letter: 'Letter (S/M/L)',
  'dress-shirt': 'Neck / sleeve',
  jacket: 'Jacket (chest + length)',
  'waist-inseam': 'Waist × inseam',
  waist: 'Waist',
  shoe: 'Shoe',
  belt: 'Belt',
  'one-size': 'One size',
};

export const SHOE_SYSTEM_LABEL: Record<ShoeSystem, string> = {
  'US-M': 'US men',
  'US-W': 'US women',
  UK: 'UK',
  EU: 'EU',
};

// ---------------------------------------------------------------------------
// Options

const range = (from: number, to: number, step = 1) => {
  const out: string[] = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push(String(Math.round(v * 10) / 10));
  return out;
};

export const LETTER_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
export const NECK_SIZES = range(14, 18.5, 0.5);
export const SLEEVE_SIZES = ['32', '32/33', '33', '33/34', '34', '34/35', '35', '35/36', '36', '37'];
export const CHEST_SIZES = range(34, 54, 2);
export const JACKET_LENGTHS = ['S', 'R', 'L', 'XL'];
export const WAIST_SIZES = [...range(26, 40), ...range(42, 48, 2)];
export const INSEAM_SIZES = range(26, 36);
export const BELT_SIZES = range(28, 48, 2);

export const SHOE_SIZES: Record<ShoeSystem, string[]> = {
  'US-M': range(5, 16, 0.5),
  'US-W': range(4, 13, 0.5),
  UK: range(3, 15, 0.5),
  EU: range(35, 50, 0.5),
};

// ---------------------------------------------------------------------------
// Which format fits which garment

const DRESS_SHIRT = /dress shirt/i;
const TAILORED = /blazer|sport ?coat|suit|tux/i;
const WAIST_ONLY = /short|skirt/i;
const ONE_SIZE = /scarf|bag|watch|tie|sunglass|glove/i;

export function sizeKindFor(category: Category, subcategory = ''): SizeKind {
  switch (category) {
    case 'top':
      return DRESS_SHIRT.test(subcategory) ? 'dress-shirt' : 'letter';
    case 'bottom':
      return WAIST_ONLY.test(subcategory) ? 'waist' : 'waist-inseam';
    case 'outerwear':
    case 'layer':
      return TAILORED.test(subcategory) ? 'jacket' : 'letter';
    case 'shoes':
      return 'shoe';
    case 'accessory':
      if (/belt/i.test(subcategory)) return 'belt';
      if (ONE_SIZE.test(subcategory)) return 'one-size';
      return 'letter';
    case 'other':
      if (/sock/i.test(subcategory)) return 'shoe';
      if (/short|pant|swim/i.test(subcategory)) return 'waist';
      return 'letter';
  }
}

// ---------------------------------------------------------------------------
// Parts ↔ value

/** Splits a value into the parts the picker edits: [neck, sleeve], [chest, length], [waist, inseam] or [value]. */
export function sizeParts(size: ItemSize | undefined): [string, string] {
  if (!size) return ['', ''];
  switch (size.kind) {
    case 'dress-shirt': {
      const [neck, ...sleeve] = size.value.split('/');
      return [neck ?? '', sleeve.join('/')];
    }
    case 'jacket': {
      const m = /^(\d+)([A-Z]+)?$/.exec(size.value);
      return m ? [m[1], m[2] ?? ''] : [size.value, ''];
    }
    case 'waist-inseam': {
      const [w, i] = size.value.split('x');
      return [w ?? '', i ?? ''];
    }
    default:
      return [size.value, ''];
  }
}

/** Builds a size from picker parts. Returns undefined when nothing meaningful is set. */
export function makeSize(kind: SizeKind, a: string, b = '', system?: ShoeSystem): ItemSize | undefined {
  if (kind === 'one-size') return { kind, value: 'One size' };
  if (!a) return undefined;
  switch (kind) {
    case 'dress-shirt':
      return { kind, value: b ? `${a}/${b}` : a };
    case 'jacket':
      return { kind, value: `${a}${b}` };
    case 'waist-inseam':
      return { kind, value: b ? `${a}x${b}` : a };
    case 'shoe':
      return { kind, value: a, system: system ?? 'US-M' };
    default:
      return { kind, value: a };
  }
}

/** Human-readable size, e.g. "M", "15.5 / 34", "40R", "32 × 32", "US 10.5", "EU 44". */
export function formatSize(size: ItemSize | undefined): string {
  if (!size) return '';
  switch (size.kind) {
    case 'dress-shirt':
      return size.value.replace('/', ' / ');
    case 'waist-inseam':
      return size.value.replace('x', ' × ');
    case 'waist':
      return `W${size.value}`;
    case 'shoe': {
      const sys = size.system ?? 'US-M';
      return sys === 'US-M' || sys === 'US-W' ? `US ${size.value}${sys === 'US-W' ? 'W' : ''}` : `${sys} ${size.value}`;
    }
    default:
      return size.value;
  }
}

/** Default size for a new item: your profile size for the matching format, if set. */
export function defaultSize(category: Category, subcategory: string, profile: SizeProfile | undefined): ItemSize | undefined {
  return defaultSizeForKind(sizeKindFor(category, subcategory), profile);
}

export function defaultSizeForKind(kind: SizeKind, profile: SizeProfile | undefined): ItemSize | undefined {
  if (kind === 'one-size') return { kind, value: 'One size' };
  const fromProfile = profile?.[kind];
  if (fromProfile) return { ...fromProfile };
  // Shorts without a waist-only default can borrow the waist from waist × inseam.
  if (kind === 'waist' && profile?.['waist-inseam']) {
    return { kind, value: sizeParts(profile['waist-inseam'])[0] };
  }
  return undefined;
}
