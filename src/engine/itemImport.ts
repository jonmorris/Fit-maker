// "Add items from text": a forgiving JSON item list (e.g. written by Claude from
// your screenshots, order emails or descriptions) that becomes closet items,
// matched to your wardrobe-plan types by name.
//
// {
//   "fitMakerItems": 1,
//   "items": [
//     { "name": "Navy chinos", "category": "Casual", "type": "Jeans", "color": "#1f2a44",
//       "size": "32x30", "fabric": "Cotton twill", "formality": ["casual", "business casual"],
//       "warmth": 2, "rainOk": false, "brand": "Bonobos", "notes": "Slim fit" }
//   ]
// }

import { colorFamily, isHex, normalizeHex } from './color';
import { guessSlot, type ItemType, type PlanCategory } from './plan';
import { SIZE_KINDS, sizeKindFor, type ItemSize, type ShoeSystem, type SizeKind } from './sizes';
import {
  CATEGORIES, COLOR_FAMILIES, FORMALITIES, PATTERNS, STATUSES,
  type Category, type ColorFamily, type ColorTag, type Formality, type Item, type Pattern, type Status,
} from './types';

export interface ImportEntry {
  name: string;
  category?: string;
  type?: string;
  slot?: string;
  color?: string;
  family?: string;
  secondaryColor?: string;
  pattern?: string;
  fabric?: string;
  formality?: string | string[];
  warmth?: number;
  rainOk?: boolean;
  size?: string;
  sizeKind?: string;
  status?: string;
  brand?: string;
  notes?: string;
}

export interface ParsedEntries {
  entries: ImportEntry[];
  error?: string;
}

/** Parses pasted text. Accepts {"items": [...]} or a bare array, and tolerates ``` fences around it. */
export function parseItemsText(text: string): ParsedEntries {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  if (!cleaned) return { entries: [] };
  let data: unknown;
  try {
    data = JSON.parse(cleaned);
  } catch {
    return { entries: [], error: "That isn't valid item text. Copy the whole block, including the { and }." };
  }
  const list = Array.isArray(data) ? data : (data as { items?: unknown })?.items;
  if (!Array.isArray(list)) return { entries: [], error: 'No "items" list found.' };
  const entries = list.filter(
    (e): e is ImportEntry => !!e && typeof e === 'object' && typeof (e as ImportEntry).name === 'string' && !!(e as ImportEntry).name.trim(),
  );
  return { entries };
}

// ---------------------------------------------------------------------------
// Field normalisers

const norm = (s: string) => s.trim().toLowerCase();

export function parseFormality(v: ImportEntry['formality']): Formality[] | undefined {
  const raw = (Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,/]| and /) : []).map((s) =>
    norm(s).replace(/[\s_]+/g, '-'),
  );
  const out = FORMALITIES.filter((f) => raw.some((r) => r === f || (f === 'business-casual' && r.startsWith('business')) || (f === 'dressy' && /formal|dress/.test(r))));
  return out.length ? out : undefined;
}

/** Turns how people write sizes ("32 x 30", "US 10.5", "15.5/34-35", "40 Regular") into an ItemSize. */
export function parseSize(raw: string | undefined, kind: SizeKind): ItemSize | undefined {
  if (kind === 'one-size') return { kind, value: 'One size' };
  const s = (raw ?? '').trim();
  if (!s) return undefined;
  const nums: string[] = [...(s.match(/\d+(?:\.\d+)?/g) ?? [])];
  switch (kind) {
    case 'letter': {
      const v = s.toUpperCase().replace(/\s+/g, '').replace(/^XXXL$/, '3XL').replace(/^(SMALL)$/, 'S').replace(/^(MEDIUM)$/, 'M').replace(/^(LARGE)$/, 'L');
      return { kind, value: v };
    }
    case 'dress-shirt': {
      if (!nums.length) return undefined;
      const [neck, ...sleeve] = nums;
      return { kind, value: sleeve.length ? `${neck}/${sleeve.join('/')}` : neck };
    }
    case 'jacket': {
      if (!nums.length) return undefined;
      const len = /\b(xl|extra long)\b/i.test(s) ? 'XL' : /\d\s*S\b|\bshort\b/i.test(s) ? 'S' : /\d\s*L\b|\blong\b/i.test(s) ? 'L' : 'R';
      return { kind, value: `${nums[0]}${len}` };
    }
    case 'waist-inseam':
      if (!nums.length) return undefined;
      return { kind, value: nums[1] ? `${nums[0]}x${nums[1]}` : nums[0] };
    case 'waist':
    case 'belt':
      return nums.length ? { kind, value: nums[0] } : undefined;
    case 'shoe': {
      if (!nums.length) return undefined;
      let system: ShoeSystem = 'US-M';
      if (/\beu\b/i.test(s)) system = 'EU';
      else if (/\buk\b/i.test(s)) system = 'UK';
      else if (/\d\s*w\b|women/i.test(s)) system = 'US-W';
      return { kind, value: nums[0], system };
    }
  }
}

function colorTag(hex: string | undefined, family?: string): ColorTag | undefined {
  if (!hex || !isHex(hex)) return undefined;
  const h = normalizeHex(hex);
  const fam = family && (COLOR_FAMILIES as readonly string[]).includes(norm(family)) ? (norm(family) as ColorFamily) : colorFamily(h);
  return { hex: h, family: fam };
}

// ---------------------------------------------------------------------------
// Resolve entries against your plan and closet

export interface ResolvedEntry {
  entry: ImportEntry;
  item: Item;
  type?: ItemType;
  /** A type name was given but not found in your plan. */
  unmatchedType?: string;
  /** Same name and color as something already in the closet. */
  duplicate: boolean;
}

export interface ResolveContext {
  categories: PlanCategory[];
  types: ItemType[];
  existing: Item[];
  newId: () => string;
  now?: number;
  defaults?: (slot: Category) => { warmth: Item['warmth']; formality: Formality[] };
}

export function findType(entry: ImportEntry, categories: PlanCategory[], types: ItemType[]): ItemType | undefined {
  if (!entry.type) return undefined;
  const cat = entry.category ? categories.find((c) => norm(c.name) === norm(entry.category!)) : undefined;
  const same = (t: ItemType) => norm(t.name) === norm(entry.type!);
  return (cat && types.find((t) => t.categoryId === cat.id && same(t))) ?? types.find(same);
}

export function resolveEntries(entries: ImportEntry[], ctx: ResolveContext): ResolvedEntry[] {
  const now = ctx.now ?? Date.now();
  const seen = new Set(ctx.existing.map((i) => `${norm(i.name)}|${i.primaryColor.hex}`));
  return entries.map((entry, idx) => {
    const type = findType(entry, ctx.categories, ctx.types);
    const slot: Category =
      type?.slot ??
      ((CATEGORIES as readonly string[]).includes(norm(entry.slot ?? '')) ? (norm(entry.slot!) as Category) : guessSlot(entry.type || entry.name));
    const subcategory = type?.name ?? entry.type?.trim() ?? '';
    const kind: SizeKind =
      (SIZE_KINDS as readonly string[]).includes(entry.sizeKind ?? '') ? (entry.sizeKind as SizeKind) : type?.sizeKind ?? sizeKindFor(slot, subcategory);
    const defaults = ctx.defaults?.(slot) ?? { warmth: 2 as const, formality: ['casual' as const] };
    const primary = colorTag(entry.color, entry.family) ?? { hex: '#808080', family: 'gray' as const };
    const pattern = (PATTERNS as readonly string[]).includes(norm(entry.pattern ?? '')) ? (norm(entry.pattern!) as Pattern) : 'solid';
    const status = (STATUSES as readonly string[]).includes(norm(entry.status ?? '')) ? (norm(entry.status!) as Status) : 'active';
    const warmth = typeof entry.warmth === 'number' ? (Math.min(5, Math.max(1, Math.round(entry.warmth))) as Item['warmth']) : defaults.warmth;
    const notes = [entry.brand?.trim(), entry.notes?.trim()].filter(Boolean).join(' · ');

    const item: Item = {
      id: ctx.newId(),
      name: entry.name.trim(),
      category: slot,
      subcategory,
      primaryColor: primary,
      pattern,
      fabric: entry.fabric?.trim() ?? '',
      formality: parseFormality(entry.formality) ?? defaults.formality,
      warmth,
      rainOk: !!entry.rainOk,
      fitNotes: notes,
      status,
      createdAt: now + idx, // keeps paste order stable
      updatedAt: now + idx,
    };
    const secondary = colorTag(entry.secondaryColor);
    if (secondary) item.secondaryColor = secondary;
    const size = parseSize(entry.size, kind);
    if (size) item.size = size;
    if (type) item.typeId = type.id;

    const key = `${norm(item.name)}|${item.primaryColor.hex}`;
    const duplicate = seen.has(key);
    seen.add(key);
    return { entry, item, type, unmatchedType: entry.type && !type ? entry.type : undefined, duplicate };
  });
}

