import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Item } from '../engine/types';
import { db } from './db';
import { parseBackup, readAll, serializeBackup, writeAll, type BackupData } from './backup';

const item = (id: string, name: string): Item => ({
  id,
  name,
  category: 'bottom',
  subcategory: 'chinos',
  primaryColor: { hex: '#1f2a44', family: 'navy' },
  pattern: 'solid',
  fabric: 'cotton twill',
  formality: ['casual', 'business-casual'],
  warmth: 2,
  rainOk: false,
  fitNotes: '',
  status: 'active',
  photoId: `p-${id}`,
  createdAt: 1,
  updatedAt: 1,
});

const sample = (): BackupData => ({
  planCategories: [{ id: 'c1', name: 'Casual', order: 0, inOutfits: true }],
  itemTypes: [],
  items: [item('a', 'Navy chinos')],
  outfits: [],
  wearLog: [{ id: 'w1', date: '2026-09-28', itemIds: ['a'] }],
  settings: [
    { key: 'units', value: 'F' },
    { key: 'anthropicApiKey', value: 'sk-secret' },
  ],
  photos: [
    {
      id: 'p-a',
      width: 2,
      height: 1,
      full: new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/jpeg' }),
      thumb: new Blob([new Uint8Array([9])], { type: 'image/jpeg' }),
    },
  ],
});

describe('serializeBackup / parseBackup', () => {
  it('round-trips through JSON, including photo bytes', async () => {
    const file = await serializeBackup(sample(), new Date('2026-09-28T12:00:00Z'));
    const back = parseBackup(JSON.stringify(file));
    expect(back.items).toEqual(sample().items);
    expect(back.wearLog).toEqual(sample().wearLog);
    expect(back.photos[0].full.type).toBe('image/jpeg');
    expect([...new Uint8Array(await back.photos[0].full.arrayBuffer())]).toEqual([1, 2, 3, 250]);
  });

  it('never exports the API key', async () => {
    const file = await serializeBackup(sample());
    expect(JSON.stringify(file)).not.toContain('sk-secret');
    expect(file.settings.map((s) => s.key)).toEqual(['units']);
  });

  it('round-trips the wardrobe plan and still reads v1 files without one', async () => {
    const file = await serializeBackup(sample());
    expect(parseBackup(JSON.stringify(file)).planCategories).toEqual(sample().planCategories);
    const v1 = { ...file, schemaVersion: 1, planCategories: undefined, itemTypes: undefined };
    expect(parseBackup(JSON.stringify(v1)).planCategories).toEqual([]);
  });

  it('rejects files from other apps and newer schema versions', () => {
    expect(() => parseBackup('not json')).toThrow(/valid JSON/);
    expect(() => parseBackup(JSON.stringify({ app: 'other' }))).toThrow(/not a Fit Maker/);
    expect(() => parseBackup(JSON.stringify({ app: 'fit-maker', schemaVersion: 99 }))).toThrow(/newer version/);
  });
});

describe('writeAll / readAll', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it('merge keeps existing items and upserts incoming ones', async () => {
    await db.items.put(item('existing', 'Old shirt'));
    await writeAll(sample(), 'merge');
    const names = (await db.items.toArray()).map((i) => i.name).sort();
    expect(names).toEqual(['Navy chinos', 'Old shirt']);
  });

  it('replace wipes data but keeps the local API key', async () => {
    await db.items.put(item('existing', 'Old shirt'));
    await db.settings.put({ key: 'anthropicApiKey', value: 'sk-local' });
    const incoming = sample();
    incoming.settings = [{ key: 'units', value: 'C' }];
    await writeAll(incoming, 'replace');

    expect((await db.items.toArray()).map((i) => i.id)).toEqual(['a']);
    expect((await db.settings.get('anthropicApiKey'))?.value).toBe('sk-local');
    expect((await db.settings.get('units'))?.value).toBe('C');
  });

  it('readAll pairs photos with their thumbnails', async () => {
    await writeAll(sample(), 'replace');
    const data = await readAll();
    expect(data.photos).toHaveLength(1);
    expect(data.photos[0].thumb.size).toBe(1);
  });
});
