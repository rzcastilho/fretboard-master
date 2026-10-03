/**
 * Preset tunings and fret-count rules (data-model §1, contracts/instrument-config-api.md §1).
 * Pure: no DOM, Svelte or i18n. Spelling is stored per preset, never re-derived (FR-005).
 */
import type { Accidental, Letter, SpelledPitch } from '../theory/pitch';
import { STANDARD_GUITAR, type Instrument } from './instrument';

export type TuningId =
  | 'AF-1'
  | 'AF-2'
  | 'AF-3'
  | 'AF-4'
  | 'AF-5'
  | 'AF-6'
  | 'AF-7'
  | 'AF-8'
  | 'AF-9'
  | 'AF-10'
  | 'AF-11';

export interface TuningPreset {
  readonly id: TuningId;
  /** Low → high, the preset's own spelling. */
  readonly strings: readonly SpelledPitch[];
}

export const MIN_FRETS = 12 as const;
export const MAX_FRETS = 24 as const;
export const DEFAULT_FRETS = 22 as const;
export const DEFAULT_TUNING_ID = 'AF-1' as const;

const p = (letter: Letter, octave: number, accidental: Accidental = 0): SpelledPitch =>
  Object.freeze({ letter, accidental, octave });

const preset = (id: TuningId, strings: readonly SpelledPitch[]): TuningPreset =>
  Object.freeze({ id, strings: Object.freeze(strings) });

/** Display order AF-1 … AF-11. */
export const TUNING_PRESETS: readonly TuningPreset[] = Object.freeze([
  preset('AF-1', [p('E', 2), p('A', 2), p('D', 3), p('G', 3), p('B', 3), p('E', 4)]),
  preset('AF-2', [
    p('E', 2, -1),
    p('A', 2, -1),
    p('D', 3, -1),
    p('G', 3, -1),
    p('B', 3, -1),
    p('E', 4, -1)
  ]),
  preset('AF-3', [p('D', 2), p('G', 2), p('C', 3), p('F', 3), p('A', 3), p('D', 4)]),
  preset('AF-4', [p('D', 2), p('A', 2), p('D', 3), p('G', 3), p('B', 3), p('E', 4)]),
  preset('AF-5', [p('C', 2), p('G', 2), p('C', 3), p('F', 3), p('A', 3), p('D', 4)]),
  preset('AF-6', [p('D', 2), p('A', 2), p('D', 3), p('G', 3), p('B', 3), p('D', 4)]),
  preset('AF-7', [p('D', 2), p('A', 2), p('D', 3), p('G', 3), p('A', 3), p('D', 4)]),
  preset('AF-8', [p('D', 2), p('G', 2), p('D', 3), p('G', 3), p('B', 3), p('D', 4)]),
  preset('AF-9', [p('D', 2), p('A', 2), p('D', 3), p('F', 3, 1), p('A', 3), p('D', 4)]),
  preset('AF-10', [p('E', 2), p('B', 2), p('E', 3), p('G', 3, 1), p('B', 3), p('E', 4)]),
  preset('AF-11', [p('E', 2), p('A', 2), p('E', 3), p('A', 3), p('C', 4, 1), p('E', 4)])
]);

export function isTuningId(x: unknown): x is TuningId {
  return typeof x === 'string' && TUNING_PRESETS.some((t) => t.id === x);
}

export function tuningPreset(id: TuningId): TuningPreset {
  return TUNING_PRESETS.find((t) => t.id === id) ?? TUNING_PRESETS[0];
}

/** Non-integer → round; clamp to 12..24; NaN → default. */
export function clampFrets(n: number): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return DEFAULT_FRETS;
  return Math.min(MAX_FRETS, Math.max(MIN_FRETS, Math.round(n)));
}

const cache = new Map<string, Instrument>();

/** Memoized and frozen; string 1 (highest) first. `('AF-1', 22)` is `STANDARD_GUITAR`. */
export function presetInstrument(id: TuningId, fretCount: number): Instrument {
  const frets = clampFrets(fretCount);
  const key = `${id}|${frets}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const made: Instrument =
    id === 'AF-1' && frets === DEFAULT_FRETS
      ? STANDARD_GUITAR
      : Object.freeze({
          stringCount: 6,
          fretCount: frets,
          openStrings: Object.freeze([...tuningPreset(id).strings].reverse()),
          handedness: 'right',
          orientation: 'highest-top'
        });
  cache.set(key, made);
  return made;
}
