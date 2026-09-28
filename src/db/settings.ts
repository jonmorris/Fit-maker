import { liveQuery, type Observable } from 'dexie';
import { db } from './db';

export interface Settings {
  units: 'F' | 'C';
  theme: 'system' | 'light' | 'dark';
  lastBackupAt: number | null;
}

export const DEFAULT_SETTINGS: Settings = {
  units: 'F',
  theme: 'system',
  lastBackupAt: null,
};

/** Keys never written to backups (e.g. the future AI API key). */
export const PRIVATE_SETTING_KEYS = new Set(['anthropicApiKey']);

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
