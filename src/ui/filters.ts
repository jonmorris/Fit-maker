import { formatSize } from '../engine/sizes';
import { CATEGORIES, type Category, type ColorFamily, type Formality, type Item, type Status } from '../engine/types';

export interface ClosetFilters {
  category: Category | 'all';
  families: ColorFamily[]; // empty = any
  formality: Formality | 'all';
  status: Status | 'all';
  query: string;
  /** Wardrobe-plan category id, 'none' for items without a type, or 'all'. */
  planCategory: string;
}

export const DEFAULT_FILTERS: ClosetFilters = {
  category: 'all',
  families: [],
  formality: 'all',
  status: 'active',
  query: '',
  planCategory: 'all',
};

const categoryOrder = new Map(CATEGORIES.map((c, i) => [c, i]));

/** Filters, then sorts by category (top → accessory) and most recently edited. */
export function filterItems(items: Item[], f: ClosetFilters, typeCategory?: Map<string, string>): Item[] {
  const q = f.query.trim().toLowerCase();
  const planCat = (it: Item) => (it.typeId && typeCategory?.get(it.typeId)) || 'none';
  return items
    .filter((it) => f.planCategory === 'all' || planCat(it) === f.planCategory)
    .filter((it) => f.category === 'all' || it.category === f.category)
    .filter(
      (it) =>
        !f.families.length ||
        f.families.includes(it.primaryColor.family) ||
        (it.secondaryColor !== undefined && f.families.includes(it.secondaryColor.family)),
    )
    .filter((it) => f.formality === 'all' || it.formality.includes(f.formality))
    .filter((it) => f.status === 'all' || it.status === f.status)
    .filter(
      (it) =>
        !q || [it.name, it.subcategory, it.fabric, it.primaryColor.family, formatSize(it.size)].some((s) => s.toLowerCase().includes(q)),
    )
    .sort((a, b) => categoryOrder.get(a.category)! - categoryOrder.get(b.category)! || b.updatedAt - a.updatedAt);
}

/** Counts per key, for chip badges. */
export function countBy<K extends string>(items: Item[], key: (it: Item) => K): Map<K, number> {
  const m = new Map<K, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return m;
}
