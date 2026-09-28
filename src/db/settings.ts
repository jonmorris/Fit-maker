import { liveQuery, type Observable } from 'dexie';
import type { SizeProfile } from '../engine/sizes';
import type { Formality } from '../engine/types';
import { db } from './db';

export interface Settings {
  units: 'F' | 'C';
  theme: 'system' | 'light' | 'dark';
  lastBackupAt: number | null;
  dressCode: Formality;
  /** Your usual size per format; pre-fills new items. */
  sizeProfile: SizeProfile;
}

export const DEFAULT_SETTINGS: Settings = {
  units: 'F',
  theme: 'system',
  lastBackupAt: null,
  dressCode: 'business-casual',
  sizeProfile: {},
};

/** Keys never written to backups: the future AI API key, and the cached forecast (it holds your location). */
export const PRIVATE_SETTING_KEYS = new Set(['anthropicApiKey', 'weatherCache']);

export async function getSettings(): Promise<Settings> {
  const rows = await db.settings.toArray();
  const out: Settings = { ...DEFAULT_SETTINGS };
  for (const { key, value } of rows) {
    if (key in out) (out as unknown as Record<string, unknown>)[key] = value;
  }
  return out;
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<string> {
  return db.settings.put({ key, value });
}

export const settingsStore: Observable<Settings> = liveQuery(getSettings);
