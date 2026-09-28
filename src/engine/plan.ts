// Wardrobe plan: your own categories (Basics, Casual, Golf…) and item types
// with a target count, compared against what you actually own.

import type { SizeKind } from './sizes';
import type { Category, Item } from './types';

export interface PlanCategory {
  id: string;
  name: string;
  order: number;
  /** Whether items of this category's types show up in daily outfit suggestions. */
  inOutfits: boolean;
}

export interface ItemType {
  id: string;
  categoryId: string;
  name: string;
  target: number;
  /** Optional range around the target; defaults to the target itself. */
  min?: number;
  max?: number;
  /** Which outfit slot items of this type fill ('other' = never in outfits). */
  slot: Category;
  /** Size format override; defaults to one inferred from slot + name. */
  sizeKind?: SizeKind;
  /** Track a number instead of individual items (socks, underwear…). */
  countOnly: boolean;
  /** Owned count for count-only types. */
  ownedCount: number;
  notes: string;
  /** What to buy / replace. */
  shopping: string;
  order: number;
}

export type PlanStatus = 'under' | 'ok' | 'over';

export interface TypeProgress {
  type: ItemType;
  owned: number;
  min: number;
  max: number;
  status: PlanStatus;
  /** How many to buy to reach the minimum (0 unless under). */
  need: number;
  /** How many above the maximum (0 unless over). */
  extra: number;
}

export function typeRange(t: Pick<ItemType, 'target' | 'min' | 'max'>): [number, number] {
  const min = t.min ?? t.target;
  const max = Math.max(min, t.max ?? t.target);
  return [min, max];
}

/** Items marked "donate" no longer count as owned; "needs repair" still does. */
export function ownedFor(t: ItemType, items: Item[]): number {
  if (t.countOnly) return t.ownedCount;
  return items.filter((i) => i.typeId === t.id && i.status !== 'donate').length;
}

export function progressFor(t: ItemType, items: Item[]): TypeProgress {
  const owned = ownedFor(t, items);
  const [min, max] = typeRange(t);
  const status: PlanStatus = owned < min ? 'under' : owned > max ? 'over' : 'ok';
  return { type: t, owned, min, max, status, need: Math.max(0, min - owned), extra: Math.max(0, owned - max) };
}

export function planProgress(types: ItemType[], items: Item[]): TypeProgress[] {
  return types.map((t) => progressFor(t, items));
}

export function planSummary(progress: TypeProgress[]): Record<PlanStatus, number> {
  const out = { under: 0, ok: 0, over: 0 };
  for (const p of progress) out[p.status]++;
  return out;
}

// ---------------------------------------------------------------------------
// Guessing slot and count-only from a type name

const SLOT_RULES: [RegExp, Category][] = [
  // Things that never belong in an outfit suggestion
  [/underwear|boxer|brief|sock|under ?shirt|swim|base ?layer|compression|pajama|yard|snow ?pant/i, 'other'],
  [/shoe|boot|sneaker|sandal|loafer|flip ?flop|trainer|cleat|slipper|derby|oxford shoe/i, 'shoes'],
  [/coat|jacket|shell|parka|rain|blazer|puffer|windbreaker|anorak|overcoat|trench/i, 'outerwear'],
  [/sweater|hoodie|fleece|cardigan|sweatshirt|quarter.?zip|vest|pullover|crewneck/i, 'layer'],
  [/pant|jean|short|chino|trouser|jogger|skirt|legging/i, 'bottom'],
  [/belt|watch|\bties?\b|bow ?tie|hat|cap\b|beanie|glove|scarf|bag|sunglass|jewel/i, 'accessory'],
  [/shirt|tee\b|t-shirt|polo|henley|blouse|tank|\btop|long ?sleeve|button/i, 'top'],
];

export function guessSlot(name: string): Category {
  for (const [re, slot] of SLOT_RULES) if (re.test(name)) return slot;
  return 'other';
}

export function guessCountOnly(name: string): boolean {
  return /underwear|boxer|brief|sock|under ?shirt|compression/i.test(name);
}

// ---------------------------------------------------------------------------
// Import from a pasted spreadsheet

export interface ParsedType {
  category: string;
  name: string;
  target: number;
  notes: string;
  shopping: string;
}

export interface ParsedPlan {
  categories: string[];
  types: ParsedType[];
}

const CODE_NAMES: Record<string, string> = {
  ba: 'Basics',
  ca: 'Casual',
  dr: 'Dress',
  go: 'Golf',
  wi: 'Winter',
  wo: 'Workout',
  fo: 'Formal',
  ou: 'Outdoor',
  tr: 'Travel',
  sp: 'Sport',
};

/** Expands two-letter codes like "Ba" → "Basics"; anything else is kept as typed. */
export function expandCategory(raw: string): string {
  const t = raw.trim();
  return CODE_NAMES[t.toLowerCase()] ?? t;
}

function splitRow(line: string, delimiter: string): string[] {
  if (delimiter === '\t') return line.split('\t').map((c) => c.trim());
  // Minimal CSV: commas, with "quoted, values" and "" escapes.
  const cells: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      cells.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

/**
 * Parses a table pasted from Sheets/Excel (tab-separated) or CSV.
 * Columns are found by header names (Category/Cat, Item/Type, #/Target/Count,
 * Description/Notes, Need/Shopping); without a header the order is assumed to be
 * category, item, target, notes, shopping.
 */
export function parsePlanTable(text: string): ParsedPlan {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { categories: [], types: [] };
  const delimiter = lines.some((l) => l.includes('\t')) ? '\t' : ',';
  const rows = lines.map((l) => splitRow(l, delimiter));

  const find = (header: string[], re: RegExp) => header.findIndex((h) => re.test(h.trim()));
  let col = { cat: 0, item: 1, target: 2, notes: 3, shopping: 4 };
  let start = 0;
  const headerIdx = rows.findIndex((r) => r.some((c) => /^(cat|category)$/i.test(c)) && r.some((c) => /^(item|type|name)/i.test(c)));
  if (headerIdx >= 0) {
    const h = rows[headerIdx];
    col = {
      cat: find(h, /^(cat|category)$/i),
      item: find(h, /^(item|type|name)/i),
      target: find(h, /^(#|target|count|qty|quantity|number)$/i),
      notes: find(h, /desc|notes?$/i),
      shopping: find(h, /need|shop|buy/i),
    };
    start = headerIdx + 1;
  }

  const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');
  const types: ParsedType[] = [];
  const categories: string[] = [];
  for (const r of rows.slice(start)) {
    const name = cell(r, col.item);
    if (!name) continue;
    const category = expandCategory(cell(r, col.cat)) || 'Uncategorized';
    const target = parseInt(cell(r, col.target), 10);
    const shopping = cell(r, col.shopping);
    types.push({
      category,
      name,
      target: Number.isFinite(target) && target >= 0 ? target : 1,
      notes: cell(r, col.notes),
      // A lone "-" means "nothing to buy".
      shopping: /^[-–—]$/.test(shopping) ? '' : shopping,
    });
    if (!categories.includes(category)) categories.push(category);
  }
  return { categories, types };
}
