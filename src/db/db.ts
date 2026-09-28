import Dexie, { type EntityTable } from 'dexie';
import type { ItemType, PlanCategory } from '../engine/plan';
import type { Item, Outfit, WearLog } from '../engine/types';

/** Full-size compressed photo. Kept apart from items so list queries never load blobs. */
export interface Photo {
  id: string;
  blob: Blob;
  width: number;
  height: number;
}

/** Small thumbnail with the same id as its Photo; the closet grid only loads these. */
export interface Thumb {
  id: string;
  blob: Blob;
}

export interface Setting {
  key: string;
  value: unknown;
}

export class WardrobeDB extends Dexie {
  items!: EntityTable<Item, 'id'>;
  photos!: EntityTable<Photo, 'id'>;
  thumbs!: EntityTable<Thumb, 'id'>;
  outfits!: EntityTable<Outfit, 'id'>;
  wearLog!: EntityTable<WearLog, 'id'>;
  settings!: EntityTable<Setting, 'key'>;
  planCategories!: EntityTable<PlanCategory, 'id'>;
  itemTypes!: EntityTable<ItemType, 'id'>;

  constructor(name = 'fit-maker') {
    super(name);
    // Only indexed fields are listed; everything else is stored anyway.
    // Filtering happens in memory — a wardrobe is a few hundred rows at most.
    this.version(1).stores({
      items: 'id, category, status, updatedAt',
      photos: 'id',
      thumbs: 'id',
      outfits: 'id, favorite, createdAt',
      wearLog: 'id, date',
      settings: 'key',
    });
    // v2: wardrobe plan (your categories and item types with target counts).
    this.version(2).stores({
      planCategories: 'id, order',
      itemTypes: 'id, categoryId, order',
    });
  }
}

export const db = new WardrobeDB();

export const newId = (): string => crypto.randomUUID();
