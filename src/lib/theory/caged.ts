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
  /**
   * Scale window of the shape (R-01, R-02): `SCALE_REGIONS` + placement. Not clipped, so it may
   * be < 0 or > `fretCount`; always contains `start…end`.
   */
  readonly region: { readonly start: number; readonly end: number };
  /** True when string 6 is altered and shows only chord tones (never for compatible tunings). */
  readonly alteredString: boolean;
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

/**
 * Scale window per shape and quality, in the same C-key, standard-tuning reference frets as
 * `CAGED_SHAPES` (R-01). Lives here so `cagedOccurrences` can place it; re-exported by
 * `caged-layers`.
 */
export const SCALE_REGIONS: Readonly<
  Record<CagedQuality, Readonly<Record<CagedShapeId, readonly [lo: number, hi: number]>>>
> = Object.freeze({
  major: Object.freeze({
    C: [0, 3],
    A: [2, 6],
    G: [4, 8],
    E: [7, 10],
    D: [9, 13]
  } as const),
  minor: Object.freeze({
    C: [0, 4],
    A: [3, 6],
    G: [5, 9],
    E: [7, 11],
    D: [10, 13]
  } as const)
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

/** `rootStrings` minus string 6 when the occurrence has an altered string; descending. */
export function occurrenceRootStrings(occ: ShapeOccurrence): readonly number[] {
  const all = rootStrings(occ.shape);
  return occ.alteredString ? all.filter((s) => s !== 6) : all;
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
 * Chord tones of the key on the altered string 6 for frets `lo…hi` (inclusive), ascending.
 * `open6` is the open pitch of string 6. Total: a bad input or `lo > hi` gives `[]`.
 */
export function alteredStringNotes(
  open6: Pitch,
  rootPc: PitchClass,
  quality: CagedQuality,
  lo: number,
  hi: number
): readonly OccurrenceNote[] {
  if (![open6, rootPc, lo, hi].every((v) => Number.isFinite(v)) || lo > hi) return [];
  const third = quality === 'minor' ? 3 : 4;
  const degreeAt = (offset: number): CagedDegree | null =>
    offset === 0
      ? 'R'
      : offset === third
        ? quality === 'minor'
          ? 'b3'
          : '3'
        : offset === 7
          ? '5'
          : null;
  const out: OccurrenceNote[] = [];
  for (let fret = Math.ceil(lo); fret <= hi; fret++) {
    const offset = (((pitchClass(open6 + fret) - rootPc) % 12) + 12) % 12;
    const degree = degreeAt(offset);
    if (degree !== null) out.push({ string: 6, fret, degree });
  }
  return out;
}

/**
 * Every complete copy of the five shapes for the key, lowest first. `[]` when the tuning is
 * `'non-compatible'`, the input is malformed or no copy fits in `0…fretCount`. When string 6 is
 * altered, position and fit come from strings 5→1 only and string 6 shows chord tones (G, E).
 */
export function cagedOccurrences(
  sixOpen: readonly Pitch[],
  rootPc: PitchClass,
  quality: CagedQuality,
  fretCount: number
): readonly ShapeOccurrence[] {
  const shapes = CAGED_SHAPES[quality];
  if (!shapes || !Number.isFinite(rootPc) || !Number.isFinite(fretCount)) return [];
  const tuningClass = cagedTuningClass(sixOpen);
  if (tuningClass === 'non-compatible') return [];
  const altered = tuningClass === 'altered-string';
  // Placement from string 5 (R-02): its open A = pitch class 9 in the table's reference tuning.
  const shift = (((rootPc - (pitchClass(sixOpen[1]) - 9)) % 12) + 12) % 12;
  const out: ShapeOccurrence[] = [];
  for (const sh of shapes) {
    for (const o of OCTAVES) {
      const notes: OccurrenceNote[] = [];
      sh.strings.forEach((n, i) => {
        if (n === null || (altered && i === 0)) return;
        notes.push({ string: 6 - i, fret: n.fret + shift + o, degree: n.degree });
      });
      const frets = notes.map((n) => n.fret);
      const start = Math.min(...frets);
      const end = Math.max(...frets);
      if (start < 0 || end > fretCount) continue;
      if (altered && (sh.id === 'G' || sh.id === 'E')) {
        notes.unshift(...alteredStringNotes(sixOpen[0], rootPc, quality, start, end));
      }
      const [lo, hi] = SCALE_REGIONS[quality][sh.id];
      const region = { start: lo + shift + o, end: hi + shift + o };
      out.push({ shape: sh, start, end, notes, region, alteredString: altered });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Number of distinct shapes among the occurrences. */
export function fitCount(occ: readonly ShapeOccurrence[]): number {
  return new Set(occ.map((o) => o.shape.id)).size;
}

export interface CagedConnection {
  /** 1…6 (never 7; never an altered string 6). */
  readonly string: number;
  readonly fret: number;
  readonly degree: CagedDegree;
  /** Occurrence indices (into the sorted list) of each adjacent pair sharing this position. */
  readonly pairs: readonly (readonly [lower: number, upper: number])[];
}

/** Notes an occurrence really draws: a synthesized altered string-6 note is not one. */
function realNotes(o: ShapeOccurrence): readonly OccurrenceNote[] {
  return o.alteredString ? o.notes.filter((n) => n.string !== 6) : o.notes;
}

/** Positions (string, fret) drawn by both occurrences, in `a`'s note order. */
export function sharedPositions(a: ShapeOccurrence, b: ShapeOccurrence): readonly OccurrenceNote[] {
  const inB = new Set(realNotes(b).map((n) => `${n.string}:${n.fret}`));
  return realNotes(a).filter((n) => inB.has(`${n.string}:${n.fret}`));
}

/**
 * Positions shared by each adjacent pair of occurrences (FR-009), sorted by fret then string
 * descending. `[]` for fewer than two occurrences.
 */
export function cagedConnections(occs: readonly ShapeOccurrence[]): readonly CagedConnection[] {
  const byKey = new Map<string, { note: OccurrenceNote; pairs: [number, number][] }>();
  for (let i = 0; i < occs.length - 1; i++) {
    for (const note of sharedPositions(occs[i], occs[i + 1])) {
      const key = `${note.string}:${note.fret}`;
      const hit = byKey.get(key);
      if (hit) hit.pairs.push([i, i + 1]);
      else byKey.set(key, { note, pairs: [[i, i + 1]] });
    }
  }
  return [...byKey.values()]
    .sort((x, y) => x.note.fret - y.note.fret || y.note.string - x.note.string)
    .map(({ note, pairs }) => ({
      string: note.string,
      fret: note.fret,
      degree: note.degree,
      pairs
    }));
}
