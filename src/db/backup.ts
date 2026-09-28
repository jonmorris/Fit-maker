// JSON export / import. Photos are inlined as base64 data URLs so a backup is
// one self-contained file you can AirDrop, email or drop in iCloud Drive.

import type { Item, Outfit, WearLog } from '../engine/types';
import { db, type Setting } from './db';
import { PRIVATE_SETTING_KEYS } from './settings';

export const BACKUP_APP = 'fit-maker';
export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupPhoto {
  id: string;
  width: number;
  height: number;
  full: string; // data URL
  thumb: string; // data URL
}

export interface BackupFile {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  exportedAt: string;
  items: Item[];
  outfits: Outfit[];
  wearLog: WearLog[];
  settings: Setting[];
  photos: BackupPhoto[];
}

export interface BackupData {
  items: Item[];
  outfits: Outfit[];
  wearLog: WearLog[];
  settings: Setting[];
  photos: { id: string; width: number; height: number; full: Blob; thumb: Blob }[];
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m || !m[2]) throw new Error('Unsupported data URL in backup');
  const binary = atob(m[3]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}

export async function serializeBackup(data: BackupData, now = new Date()): Promise<BackupFile> {
  const photos: BackupPhoto[] = [];
  for (const p of data.photos) {
    photos.push({
      id: p.id,
      width: p.width,
      height: p.height,
      full: await blobToDataUrl(p.full),
      thumb: await blobToDataUrl(p.thumb),
    });
  }
  return {
    app: BACKUP_APP,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    items: data.items,
    outfits: data.outfits,
    wearLog: data.wearLog,
    settings: data.settings.filter((s) => !PRIVATE_SETTING_KEYS.has(s.key)),
    photos,
  };
}

export function parseBackup(json: string): BackupData {
  let file: BackupFile;
  try {
    file = JSON.parse(json);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (file?.app !== BACKUP_APP) throw new Error('That file is not a Fit Maker backup.');
  if (typeof file.schemaVersion !== 'number' || file.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error('This backup was made by a newer version of the app. Update the app first.');
  }
  return {
    items: file.items ?? [],
    outfits: file.outfits ?? [],
    wearLog: file.wearLog ?? [],
    settings: (file.settings ?? []).filter((s) => !PRIVATE_SETTING_KEYS.has(s.key)),
    photos: (file.photos ?? []).map((p) => ({
      id: p.id,
      width: p.width,
      height: p.height,
      full: dataUrlToBlob(p.full),
      thumb: dataUrlToBlob(p.thumb),
    })),
  };
}

export async function readAll(): Promise<BackupData> {
  const [items, outfits, wearLog, settings, photos, thumbs] = await Promise.all([
    db.items.toArray(),
    db.outfits.toArray(),
    db.wearLog.toArray(),
    db.settings.toArray(),
    db.photos.toArray(),
    db.thumbs.toArray(),
  ]);
  const thumbById = new Map(thumbs.map((t) => [t.id, t.blob]));
  return {
    items,
    outfits,
    wearLog,
    settings,
    photos: photos.map((p) => ({
      id: p.id,
      width: p.width,
      height: p.height,
      full: p.blob,
      thumb: thumbById.get(p.id) ?? p.blob,
    })),
  };
}

/**
 * 'merge' upserts by id (backup wins on conflicts, nothing is deleted).
 * 'replace' wipes everything first, except private settings like the API key.
 */
export async function writeAll(data: BackupData, mode: 'merge' | 'replace'): Promise<void> {
  const tables = [db.items, db.outfits, db.wearLog, db.settings, db.photos, db.thumbs];
  await db.transaction('rw', tables, async () => {
    if (mode === 'replace') {
      await Promise.all([db.items.clear(), db.outfits.clear(), db.wearLog.clear(), db.photos.clear(), db.thumbs.clear()]);
      const keep = (await db.settings.toArray()).filter((s) => PRIVATE_SETTING_KEYS.has(s.key));
      await db.settings.clear();
      await db.settings.bulkPut(keep);
    }
    await db.items.bulkPut(data.items);
    await db.outfits.bulkPut(data.outfits);
    await db.wearLog.bulkPut(data.wearLog);
    await db.settings.bulkPut(data.settings);
    await db.photos.bulkPut(data.photos.map((p) => ({ id: p.id, blob: p.full, width: p.width, height: p.height })));
    await db.thumbs.bulkPut(data.photos.map((p) => ({ id: p.id, blob: p.thumb })));
  });
}
