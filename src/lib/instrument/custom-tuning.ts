/**
 * Custom tuning offsets (011 data-model §1, contracts/tuning-api.md §2). Pure.
 * Offsets are semitone differences from standard, ordered strings 6 → 1 (low → high).
 */
import type { Pitch } from '../theory/pitch';
import { presetsFor, presetStrings, type StringCount, type TuningId } from './tunings';
import { pitchOfSpelling } from '../theory/pitch';

/** One entry per string (length 6 or 7), lowest string → string 1. Frozen. */
export type Offsets = readonly number[];
export type StringNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const OFFSET_MIN = -7 as const;
export const OFFSET_MAX = 4 as const;

const freeze = (o: readonly number[]): Offsets => Object.freeze([...o]);

export const STANDARD_OFFSETS: Offsets = freeze([0, 0, 0, 0, 0, 0]);
const STANDARD_OFFSETS_7: Offsets = freeze([0, 0, 0, 0, 0, 0, 0]);

/** E2 A2 D3 G3 B3 E4 (6) or B1 E2 A2 D3 G3 B3 E4 (7), lowest string first. */
const REFERENCE: Readonly<Record<StringCount, readonly Pitch[]>> = Object.freeze({
  6: Object.freeze([40, 45, 50, 55, 59, 64]),
  7: Object.freeze([35, 40, 45, 50, 55, 59, 64])
});

export function referencePitches(count: StringCount): readonly Pitch[] {
  return REFERENCE[count];
}

export function standardOffsets(count: StringCount): Offsets {
  return count === 7 ? STANDARD_OFFSETS_7 : STANDARD_OFFSETS;
}

export function isOffsets(x: unknown, count: StringCount): x is Offsets {
  return (
    Array.isArray(x) &&
    x.length === count &&
    x.every((v) => Number.isInteger(v) && v >= OFFSET_MIN && v <= OFFSET_MAX)
  );
}

const presetTable = new Map<string, Offsets>();

/** Built lazily: `tunings.ts` imports this module, so no work at load time. */
export function presetOffsets(id: TuningId, count: StringCount): Offsets {
  const key = `${id}|${count}`;
  let hit = presetTable.get(key);
  if (!hit) {
    const ref = REFERENCE[count];
    hit = freeze(presetStrings(id, count).map((s, i) => pitchOfSpelling(s) - ref[i]));
    presetTable.set(key, hit);
  }
  return hit;
}

const sameOffsets = (a: Offsets, b: Offsets): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/** First match in `presetsFor(count)` order; pitch only, never spelling (R-02). */
export function matchPreset(o: Offsets): TuningId | null {
  if (o.length !== 6 && o.length !== 7) return null;
  const count = o.length as StringCount;
  for (const id of presetsFor(count)) if (sameOffsets(o, presetOffsets(id, count))) return id;
  return null;
}

/** Lowest string → string 1. */
export function offsetPitches(o: Offsets): readonly Pitch[] {
  const ref = REFERENCE[o.length === 7 ? 7 : 6];
  return Object.freeze(o.map((v, i) => ref[i] + v));
}

/** True iff some string n is strictly lower than string n+1. Unison is not inverted. */
export function invertedStrings(o: Offsets): boolean {
  const p = offsetPitches(o); // index 0 = lowest string; string n+1 sits just before string n
  for (let i = 0; i < o.length - 1; i++) if (p[i] > p[i + 1]) return true;
  return false;
}

const indexOf = (o: Offsets, string: StringNumber): number => o.length - string;

export function canStep(o: Offsets, string: StringNumber, delta: 1 | -1): boolean {
  if (string > o.length) return false;
  const next = o[indexOf(o, string)] + delta;
  return next >= OFFSET_MIN && next <= OFFSET_MAX;
}

/** Returns the same reference when the step is refused. */
export function stepOffsets(o: Offsets, string: StringNumber, delta: 1 | -1): Offsets {
  if (!canStep(o, string, delta)) return o;
  const next = [...o];
  next[indexOf(o, string)] += delta;
  return freeze(next);
}

/** 6 → 7: string 7 starts as a copy of string 6's offset (a perfect fourth below). */
export function addSeventh(o: Offsets): Offsets {
  return o.length === 6 ? freeze([o[0], ...o]) : o;
}

/** 7 → 6: drops string 7. */
export function dropSeventh(o: Offsets): Offsets {
  return o.length === 7 ? freeze(o.slice(1)) : o;
}
