/**
 * Custom tuning offsets (011 data-model §1, contracts/tuning-api.md §2). Pure.
 * Offsets are semitone differences from standard, ordered strings 6 → 1 (low → high).
 */
import type { Pitch } from '../theory/pitch';
import { TUNING_PRESETS, tuningPreset, type TuningId } from './tunings';
import { pitchOfSpelling } from '../theory/pitch';

export type Offsets = readonly [number, number, number, number, number, number];
export type StringNumber = 1 | 2 | 3 | 4 | 5 | 6;

export const OFFSET_MIN = -7 as const;
export const OFFSET_MAX = 4 as const;

const freeze = (o: readonly number[]): Offsets => Object.freeze([...o]) as unknown as Offsets;

export const STANDARD_OFFSETS: Offsets = freeze([0, 0, 0, 0, 0, 0]);

/** Standard E2 A2 D3 G3 B3 E4, strings 6 → 1. */
const STANDARD_PITCHES: readonly Pitch[] = Object.freeze([40, 45, 50, 55, 59, 64]);

export function isOffsets(x: unknown): x is Offsets {
  return (
    Array.isArray(x) &&
    x.length === 6 &&
    x.every((v) => Number.isInteger(v) && v >= OFFSET_MIN && v <= OFFSET_MAX)
  );
}

let presetTable: Map<TuningId, Offsets> | null = null;

/** Built lazily: `tunings.ts` imports this module, so no work at load time. */
export function presetOffsets(id: TuningId): Offsets {
  if (!presetTable) {
    presetTable = new Map(
      TUNING_PRESETS.map((t) => [
        t.id,
        freeze(t.strings.map((s, i) => pitchOfSpelling(s) - STANDARD_PITCHES[i]))
      ])
    );
  }
  return presetTable.get(id) ?? presetOffsets(tuningPreset(id).id);
}

const sameOffsets = (a: Offsets, b: Offsets): boolean => a.every((v, i) => v === b[i]);

/** First match in AF-1 … AF-11 order; pitch only, never spelling (R-02). */
export function matchPreset(o: Offsets): TuningId | null {
  for (const t of TUNING_PRESETS) if (sameOffsets(o, presetOffsets(t.id))) return t.id;
  return null;
}

/** Strings 6 → 1. */
export function offsetPitches(o: Offsets): readonly Pitch[] {
  return Object.freeze(o.map((v, i) => STANDARD_PITCHES[i] + v));
}

/** True iff some string n (1…5) is strictly lower than string n+1. Unison is not inverted. */
export function invertedStrings(o: Offsets): boolean {
  const p = offsetPitches(o); // index 0 = string 6; string n+1 sits just before string n
  for (let i = 0; i < 5; i++) if (p[i] > p[i + 1]) return true;
  return false;
}

const indexOf = (string: StringNumber): number => 6 - string;

export function canStep(o: Offsets, string: StringNumber, delta: 1 | -1): boolean {
  const next = o[indexOf(string)] + delta;
  return next >= OFFSET_MIN && next <= OFFSET_MAX;
}

/** Returns the same reference when the step is refused. */
export function stepOffsets(o: Offsets, string: StringNumber, delta: 1 | -1): Offsets {
  if (!canStep(o, string, delta)) return o;
  const next = [...o];
  next[indexOf(string)] += delta;
  return freeze(next);
}
