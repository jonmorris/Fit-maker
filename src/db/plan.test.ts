import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { parsePlanTable } from '../engine/plan';
import type { Item } from '../engine/types';
import { db } from './db';
import { addCategory, addType, deleteCategory, deleteType, importPlan } from './plan';

const sheet = 'Cat\tItem\t#\tItem Description\tNeed New\nBa\tUnderwear\t9\t\t\nCa\tJeans\t4\t2 blue\tYes\nCa\tRain shell\t1\t\tMaybe';

const item = (id: string, typeId: string): Item => ({
  id, name: id, category: 'bottom', subcategory: '', primaryColor: { hex: '#1f2a44', family: 'navy' }, pattern: 'solid',
  fabric: '', formality: ['casual'], warmth: 2, rainOk: false, fitNotes: '', status: 'active', typeId, createdAt: 0, updatedAt: 0,
});

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('importPlan', () => {
  it('creates categories and types with guessed slots', async () => {
    const res = await importPlan(parsePlanTable(sheet));
    expect(res).toEqual({ added: 3, updated: 0 });
    expect((await db.planCategories.orderBy('order').toArray()).map((c) => c.name)).toEqual(['Basics', 'Casual']);
    const types = await db.itemTypes.orderBy('order').toArray();
    expect(types.map((t) => [t.name, t.target, t.slot, t.countOnly])).toEqual([
      ['Underwear', 9, 'other', true],
      ['Jeans', 4, 'bottom', false],
      ['Rain shell', 1, 'outerwear', false],
    ]);
  });

  it('updates instead of duplicating on re-import, and reuses existing categories by name', async () => {
    await addCategory('casual');
    await importPlan(parsePlanTable(sheet));
    const res = await importPlan(parsePlanTable(sheet.replace('Jeans\t4', 'Jeans\t5')));
    expect(res).toEqual({ added: 0, updated: 3 });
    expect(await db.planCategories.count()).toBe(2);
    expect((await db.itemTypes.toArray()).find((t) => t.name === 'Jeans')?.target).toBe(5);
  });
});

describe('deleting', () => {
  it('unlinks items when a type is deleted', async () => {
    const cat = await addCategory('Casual');
    const t = await addType(cat.id, 'Jeans');
    await db.items.put(item('i1', t.id));
    await deleteType(t.id);
    expect(await db.itemTypes.count()).toBe(0);
    expect((await db.items.get('i1'))?.typeId).toBeUndefined();
  });

  it('removes a category with its types', async () => {
    const cat = await addCategory('Golf');
    const t = await addType(cat.id, 'Golf polo');
    await db.items.put(item('i1', t.id));
    await deleteCategory(cat.id);
    expect(await db.planCategories.count()).toBe(0);
    expect(await db.itemTypes.count()).toBe(0);
    expect((await db.items.get('i1'))?.typeId).toBeUndefined();
  });
});
