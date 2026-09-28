// Shared domain types. Pure data — no DOM, no Dexie.

import type { ItemSize } from './sizes';

export const CATEGORIES = ['top', 'bottom', 'outerwear', 'shoes', 'layer', 'accessory'] as const;
export type Category = (typeof CATEGORIES)[number];

export const FORMALITIES = ['casual', 'business-casual', 'dressy'] as const;
export type Formality = (typeof FORMALITIES)[number];

export const PATTERNS = ['solid', 'stripe', 'check', 'plaid', 'print', 'texture'] as const;
export type Pattern = (typeof PATTERNS)[number];

export const STATUSES = ['active', 'repair', 'donate'] as const;
export type Status = (typeof STATUSES)[number];

export const COLOR_FAMILIES = [
  // neutrals (incl. "fashion neutrals")
  'black', 'white', 'gray', 'navy', 'beige', 'brown', 'olive', 'denim',
  // chromatic
  'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink',
] as const;
export type ColorFamily = (typeof COLOR_FAMILIES)[number];

export interface ColorTag {
  hex: string; // "#rrggbb", lowercase
  family: ColorFamily;
}

/** Everything describing a garment. The editor form produces this, and so will AI tagging. */
export interface ItemAttributes {
  name: string;
  category: Category;
  subcategory: string;
  primaryColor: ColorTag;
  secondaryColor?: ColorTag;
  pattern: Pattern;
  fabric: string;
  formality: Formality[];
  warmth: 1 | 2 | 3 | 4 | 5;
  rainOk: boolean;
  size?: ItemSize;
  fitNotes: string;
}

export type AttrSource = 'user' | 'ai';

export interface Item extends ItemAttributes {
  id: string;
  status: Status;
  photoId?: string;
  /** Where each attribute value came from. Unused until AI tagging lands. */
  attrSource?: Partial<Record<keyof ItemAttributes, AttrSource>>;
  createdAt: number;
  updatedAt: number;
}

export interface Outfit {
  id: string;
  itemIds: string[];
  favorite: boolean;
  name?: string;
  createdAt: number;
}

export interface WearLog {
  id: string;
  date: string; // YYYY-MM-DD
  itemIds: string[];
  outfitId?: string;
}
