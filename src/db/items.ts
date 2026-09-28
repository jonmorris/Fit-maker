import { liveQuery } from 'dexie';
import type { Item } from '../engine/types';
import type { CompressedPhoto } from '../services/photo';
import { db, newId } from './db';

export const allItems = liveQuery(() => db.items.toArray());

export async function savePhoto(photo: CompressedPhoto): Promise<string> {
  const id = newId();
  await db.transaction('rw', db.photos, db.thumbs, async () => {
    await db.photos.put({ id, blob: photo.full, width: photo.width, height: photo.height });
    await db.thumbs.put({ id, blob: photo.thumb });
  });
  return id;
}

export async function deletePhoto(id: string): Promise<void> {
  await db.transaction('rw', db.photos, db.thumbs, async () => {
    await db.photos.delete(id);
    await db.thumbs.delete(id);
  });
  releaseThumbUrl(id);
}

export async function saveItem(item: Item, previousPhotoId?: string): Promise<void> {
  await db.items.put({ ...item, updatedAt: Date.now() });
  if (previousPhotoId && previousPhotoId !== item.photoId) await deletePhoto(previousPhotoId);
}

export async function deleteItem(item: Item): Promise<void> {
  await db.items.delete(item.id);
  if (item.photoId) await deletePhoto(item.photoId);
}

// Thumbnails are immutable per id (a new photo gets a new id), so object URLs
// can be cached for the whole session.
const thumbUrls = new Map<string, Promise<string | null>>();

export function thumbUrl(id: string): Promise<string | null> {
  let url = thumbUrls.get(id);
  if (!url) {
    url = db.thumbs.get(id).then((t) => (t ? URL.createObjectURL(t.blob) : null));
    thumbUrls.set(id, url);
  }
  return url;
}

function releaseThumbUrl(id: string) {
  thumbUrls.get(id)?.then((u) => u && URL.revokeObjectURL(u));
  thumbUrls.delete(id);
}
