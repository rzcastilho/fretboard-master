/**
 * Guarded storage adapter (contracts/preferences-api.md §2). The only module that touches
 * `localStorage`. Every function swallows storage exceptions.
 */
import { MAX_RAW_LENGTH } from './schema';

export const PREFS_KEY = 'fretboard-master:prefs';
export const PROBE_KEY = 'fretboard-master:probe';
export const KEY_PREFIX = 'fretboard-master:';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

export function resolveStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // fire-and-forget storage access (FR-010 / EC-9.3)
    return null;
  }
}

/** Guarded write + read-back + remove of the probe key. */
export function probeStorage(s: StorageLike | null): boolean {
  if (!s) return false;
  try {
    const token = String(Date.now());
    s.setItem(PROBE_KEY, token);
    const ok = s.getItem(PROBE_KEY) === token;
    s.removeItem(PROBE_KEY);
    return ok;
  } catch {
    // fire-and-forget storage access (FR-010 / EC-9.3)
    return false;
  }
}

export function readRaw(s: StorageLike): string | null {
  try {
    const raw = s.getItem(PREFS_KEY);
    return raw === null || raw.length > MAX_RAW_LENGTH ? null : raw;
  } catch {
    // fire-and-forget storage access (FR-010 / EC-9.3)
    return null;
  }
}

/** Fire-and-forget; returns whether the write landed so the session can retry later. */
export function writeRaw(s: StorageLike, value: string): boolean {
  try {
    s.setItem(PREFS_KEY, value);
    return true;
  } catch {
    // fire-and-forget storage access (FR-010 / EC-9.3)
    return false;
  }
}

/** Removes every `KEY_PREFIX` key. Keys are collected first so removal cannot skip entries. */
export function eraseAll(s: StorageLike): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k !== null && k.startsWith(KEY_PREFIX)) keys.push(k);
    }
    for (const k of keys) s.removeItem(k);
  } catch {
    // fire-and-forget storage access (FR-010 / EC-9.3)
  }
}
