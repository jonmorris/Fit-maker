import { liveQuery } from 'dexie';
import { daysBetween, outfitKey } from '../engine/outfits';
import type { Outfit, WearLog } from '../engine/types';
import { localDate } from '../services/weather';
import { db, newId } from './db';

const HISTORY_DAYS = 60;

/** Recent wear log, newest first. */
export const recentWear = liveQuery(async () => {
  const today = localDate();
  const rows = await db.wearLog.orderBy('date').reverse().toArray();
  return rows.filter((r) => daysBetween(r.date, today) < HISTORY_DAYS);
});

export const favoriteOutfits = liveQuery(() =>
  db.outfits.filter((o) => o.favorite).toArray().then((rows) => rows.sort((a, b) => b.createdAt - a.createdAt)),
);

export async function logWear(itemIds: string[], date = localDate()): Promise<WearLog> {
  const entry: WearLog = { id: newId(), date, itemIds: [...itemIds] };
  await db.wearLog.add(entry);
  return entry;
}

export function deleteWear(id: string) {
  return db.wearLog.delete(id);
}

export async function toggleFavorite(itemIds: string[]): Promise<boolean> {
  const key = outfitKey(itemIds);
  const existing = (await db.outfits.toArray()).find((o) => outfitKey(o.itemIds) === key);
  if (existing) {
    await db.outfits.update(existing.id, { favorite: !existing.favorite });
    return !existing.favorite;
  }
  const outfit: Outfit = { id: newId(), itemIds: [...itemIds], favorite: true, createdAt: Date.now() };
  await db.outfits.add(outfit);
  return true;
}
