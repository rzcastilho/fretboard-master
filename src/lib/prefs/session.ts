/**
 * Plain-TS preferences session (contracts/preferences-api.md §3, data-model §3).
 * Reads once at start, writes only on `remember`, never re-reads (FR-005).
 */
import {
  DEFAULT_PREFERENCES,
  parsePreferences,
  serializePreferences,
  type Preferences
} from './schema';
import {
  eraseAll,
  probeStorage,
  readRaw,
  resolveStorage,
  writeRaw,
  type StorageLike
} from './storage';

/**
 * Any preference field, including `customTuning` (011); `null` clears it. 021 adds `{ notation }`,
 * `{ accidentals }` and `{ cagedNoteShown: true }`, which are covered by the partial. 026 adds
 * `{ theme }` (`Theme | null`; `null` clears the pin), covered the same way. 027 adds `{ shortcuts }` (boolean), covered the same way.
 */
export type PreferencesPatch = Partial<Omit<Preferences, 'labels' | 'metronome'>> & {
  labels?: Partial<Preferences['labels']>;
  /** 039: merged one level deep, so `{ timer }` keeps the modes and the modes keep `timer`. */
  metronome?: Partial<Preferences['metronome']>;
};

export interface PrefsSession {
  readonly available: boolean;
  readonly current: Preferences;
  remember(patch: PreferencesPatch): void;
  erase(): void;
}

export function startSession(storage: StorageLike | null = resolveStorage()): PrefsSession {
  const available = probeStorage(storage);
  const store = available ? storage : null;
  let current = DEFAULT_PREFERENCES;
  let lastWritten: string | null = null;

  if (store) {
    const raw = readRaw(store);
    current = parsePreferences(raw);
    // Only a record that is already in canonical v1 form counts as written.
    if (raw !== null && serializePreferences(current) === raw) lastWritten = raw;
  }

  return {
    available,
    get current(): Preferences {
      return current;
    },
    remember(patch: PreferencesPatch): void {
      const { labels, metronome, ...rest } = patch;
      current = {
        ...current,
        ...rest,
        labels: { ...current.labels, ...labels },
        metronome: { ...current.metronome, ...metronome }
      };
      const serialized = serializePreferences(current);
      if (serialized === lastWritten) return;
      if (!store) return;
      if (writeRaw(store, serialized)) lastWritten = serialized;
    },
    erase(): void {
      if (store) eraseAll(store);
      current = DEFAULT_PREFERENCES;
      lastWritten = null;
    }
  };
}
