import { liveQuery } from 'dexie';
import { guessCountOnly, guessSlot, type ItemType, type ParsedPlan, type PlanCategory } from '../engine/plan';
import { db, newId } from './db';

export const planCategories = liveQuery(() => db.planCategories.orderBy('order').toArray());
export const itemTypes = liveQuery(() => db.itemTypes.orderBy('order').toArray());

const nextOrder = async (table: typeof db.planCategories | typeof db.itemTypes) =>
  ((await table.orderBy('order').last())?.order ?? -1) + 1;

export async function addCategory(name: string): Promise<PlanCategory> {
  const cat: PlanCategory = { id: newId(), name: name.trim(), order: await nextOrder(db.planCategories), inOutfits: true };
  await db.planCategories.add(cat);
  return cat;
}

export function updateCategory(id: string, patch: Partial<Omit<PlanCategory, 'id'>>) {
  return db.planCategories.update(id, patch);
}

/** Deletes a category and its types; items that counted toward them become untyped. */
export async function deleteCategory(id: string): Promise<void> {
  await db.transaction('rw', db.planCategories, db.itemTypes, db.items, async () => {
    const typeIds = (await db.itemTypes.where('categoryId').equals(id).toArray()).map((t) => t.id);
    for (const tid of typeIds) await unlinkItems(tid);
    await db.itemTypes.bulkDelete(typeIds);
    await db.planCategories.delete(id);
  });
}

export function newType(categoryId: string, name: string, order: number): ItemType {
  return {
    id: newId(),
    categoryId,
    name: name.trim(),
    target: 1,
    slot: guessSlot(name),
    countOnly: guessCountOnly(name),
    ownedCount: 0,
    notes: '',
    shopping: '',
    order,
  };
}

export async function addType(categoryId: string, name: string): Promise<ItemType> {
  const t = newType(categoryId, name, await nextOrder(db.itemTypes));
  await db.itemTypes.add(t);
  return t;
}

export function updateType(id: string, patch: Partial<Omit<ItemType, 'id'>>) {
  return db.itemTypes.update(id, patch);
}

async function unlinkItems(typeId: string) {
  await db.items.filter((i) => i.typeId === typeId).modify((i) => {
    delete i.typeId;
  });
}

export async function deleteType(id: string): Promise<void> {
  await db.transaction('rw', db.itemTypes, db.items, async () => {
    await unlinkItems(id);
    await db.itemTypes.delete(id);
  });
}

/**
 * Adds a pasted plan. Categories are matched by name (case-insensitive) so a
 * re-import doesn't duplicate them; a type that already exists in its category
 * gets its target and notes updated instead of being added twice.
 */
export async function importPlan(plan: ParsedPlan): Promise<{ added: number; updated: number }> {
  let added = 0;
  let updated = 0;
  await db.transaction('rw', db.planCategories, db.itemTypes, async () => {
    const cats = await db.planCategories.toArray();
    const byName = new Map(cats.map((c) => [c.name.toLowerCase(), c]));
    let catOrder = cats.reduce((m, c) => Math.max(m, c.order), -1) + 1;
    for (const name of plan.categories) {
      if (!byName.has(name.toLowerCase())) {
        const c: PlanCategory = { id: newId(), name, order: catOrder++, inOutfits: true };
        await db.planCategories.add(c);
        byName.set(name.toLowerCase(), c);
      }
    }
    const types = await db.itemTypes.toArray();
    let typeOrder = types.reduce((m, t) => Math.max(m, t.order), -1) + 1;
    for (const p of plan.types) {
      const cat = byName.get(p.category.toLowerCase())!;
      const existing = types.find((t) => t.categoryId === cat.id && t.name.toLowerCase() === p.name.toLowerCase());
      if (existing) {
        await db.itemTypes.update(existing.id, { target: p.target, notes: p.notes || existing.notes, shopping: p.shopping });
        updated++;
      } else {
        const t = { ...newType(cat.id, p.name, typeOrder++), target: p.target, notes: p.notes, shopping: p.shopping };
        await db.itemTypes.add(t);
        types.push(t);
        added++;
      }
    }
  });
  return { added, updated };
}
