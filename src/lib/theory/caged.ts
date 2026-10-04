/**
 * The five CAGED shapes (TM-6, TM-7). Pure: imports only `./pitch` and `./triad`.
 * Every function is total and never throws.
 */
import { pitchClass, type Pitch, type PitchClass } from './pitch';
import type { IntervalId, Quality } from './triad';

export type CagedShapeId = 'C' | 'A' | 'G' | 'E' | 'D';
export type CagedQuality = Extract<Quality, 'major' | 'minor'>;
export type CagedDegree = Extract<IntervalId, 'R' | '3' | 'b3' | '5'>;

export interface ShapeNote {
  readonly fret: number;
  readonly degree: CagedDegree;
}

export interface CagedShape {
  readonly id: CagedShapeId;
  readonly quality: CagedQuality;
  /** Index 0 = string 6 … 5 = string 1; null = muted. C-key, standard-tuning reference. */
  readonly strings: readonly (ShapeNote | null)[];
}

export interface OccurrenceNote {
  readonly string: number;
  readonly fret: number;
  readonly degree: CagedDegree;
}

export interface ShapeOccurrence {
  readonly shape: CagedShape;
  readonly start: number;
  readonly end: number;
  readonly notes: readonly OccurrenceNote[];
}

export type CagedTuningClass = 'compatible' | 'altered-string' | 'non-compatible';

/** Order of the shapes along the neck, low to high. */
export const CAGED_CYCLE: readonly CagedShapeId[] = Object.freeze(['C', 'A', 'G', 'E', 'D']);

type Cell = readonly [fret: number, degree: CagedDegree] | null;

function shape(id: CagedShapeId, quality: CagedQuality, cells: readonly Cell[]): CagedShape {
  return Object.freeze({
    id,
    quality,
    strings: Object.freeze(
      cells.map((c) => (c === null ? null : Object.freeze({ fret: c[0], degree: c[1] })))
    )
  });
}

/** Strings 6 → 1, from data-model §1 (TM-6.1, TM-7.1). */
export const CAGED_SHAPES: Readonly<Record<CagedQuality, readonly CagedShape[]>> = Object.freeze({
  major: Object.freeze([
    shape('C', 'major', [null, [3, 'R'], [2, '3'], [0, '5'], [1, 'R'], [0, '3']]),
    shape('A', 'major', [null, [3, 'R'], [5, '5'], [5, 'R'], [5, '3'], [3, '5']]),
    shape('G', 'major', [
      [8, 'R'],
      [7, '3'],
      [5, '5'],
      [5, 'R'],
      [5, '3'],
      [8, 'R']
    ]),
    shape('E', 'major', [
      [8, 'R'],
      [10, '5'],
      [10, 'R'],
      [9, '3'],
      [8, '5'],
      [8, 'R']
    ]),
    shape('D', 'major', [null, null, [10, 'R'], [12, '5'], [13, 'R'], [12, '3']])
  ]),
  minor: Object.freeze([
    shape('C', 'minor', [null, [3, 'R'], [1, 'b3'], [0, '5'], [1, 'R'], null]),
    shape('A', 'minor', [null, [3, 'R'], [5, '5'], [5, 'R'], [4, 'b3'], [3, '5']]),
    shape('G', 'minor', [
      [8, 'R'],
      [6, 'b3'],
      [5, '5'],
      [5, 'R'],
      [8, '5'],
      [8, 'R']
    ]),
    shape('E', 'minor', [
      [8, 'R'],
      [10, '5'],
      [10, 'R'],
      [8, 'b3'],
      [8, '5'],
      [8, 'R']
    ]),
    shape('D', 'minor', [null, null, [10, 'R'], [12, '5'], [13, 'R'], [11, 'b3']])
  ])
});

/** Standard intervals between strings 6→5, 5→4, 4→3, 3→2, 2→1. */
const STANDARD_STEPS: readonly number[] = [5, 5, 5, 4, 5];

/** Octave offsets tried for each shape (R-02). */
const OCTAVES: readonly number[] = [-12, 0, 12, 24];

/** String numbers holding the root, descending (e.g. E → [6, 4, 1]). */
export function rootStrings(s: CagedShape): readonly number[] {
  const out: number[] = [];
  s.strings.forEach((n, i) => {
    if (n !== null && n.degree === 'R') out.push(6 - i);
  });
  return out.sort((a, b) => b - a);
}

function wellFormed(sixOpen: readonly Pitch[]): boolean {
  return Array.isArray(sixOpen) && sixOpen.length === 6 && sixOpen.every((p) => Number.isFinite(p));
}

/** Class of the open pitches of strings 6 → 1 (the six highest strings). */
export function cagedTuningClass(sixOpen: readonly Pitch[]): CagedTuningClass {
  if (!wellFormed(sixOpen)) return 'non-compatible';
  const steps = STANDARD_STEPS.map((_, i) => sixOpen[i + 1] - sixOpen[i]);
  if (steps.every((s, i) => s === STANDARD_STEPS[i])) return 'compatible';
  if (steps.slice(1).every((s, i) => s === STANDARD_STEPS[i + 1])) return 'altered-string';
  return 'non-compatible';
}

/**
 * Every complete copy of the five shapes for the key, lowest first. `[]` unless the tuning is
 * `'compatible'`, the input is well formed and at least one copy fits in `0…fretCount`.
 */
export function cagedOccurrences(
  sixOpen: readonly Pitch[],
  rootPc: PitchClass,
  quality: CagedQuality,
  fretCount: number
): readonly ShapeOccurrence[] {
  const shapes = CAGED_SHAPES[quality];
  if (!shapes || !Number.isFinite(rootPc) || !Number.isFinite(fretCount)) return [];
  if (cagedTuningClass(sixOpen) !== 'compatible') return [];
  const shift = (((rootPc - (pitchClass(sixOpen[0]) - 4)) % 12) + 12) % 12;
  const out: ShapeOccurrence[] = [];
  for (const sh of shapes) {
    for (const o of OCTAVES) {
      const notes: OccurrenceNote[] = [];
      sh.strings.forEach((n, i) => {
        if (n !== null) notes.push({ string: 6 - i, fret: n.fret + shift + o, degree: n.degree });
      });
      const frets = notes.map((n) => n.fret);
      const start = Math.min(...frets);
      const end = Math.max(...frets);
      if (start >= 0 && end <= fretCount) out.push({ shape: sh, start, end, notes });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Number of distinct shapes among the occurrences. */
export function fitCount(occ: readonly ShapeOccurrence[]): number {
  return new Set(occ.map((o) => o.shape.id)).size;
}
