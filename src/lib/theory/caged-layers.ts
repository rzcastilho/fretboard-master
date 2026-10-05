/**
 * CAGED Arpeggio, Pentatonic and Scale layers (R-01, R-04, R-05). Pure: imports only `./pitch`,
 * `./triad` and `./caged`. Every function is total and never throws.
 *
 * A layer is derived, not looked up: the scale pattern of an occurrence is every position inside
 * its `region` whose real pitch class (open pitch + fret) belongs to the scale. Arpeggio and
 * Pentatonic are degree filters of that pattern.
 */
import {
  pitchClass,
  pitchClassOfSpelling,
  type Accidental,
  type Letter,
  type Pitch,
  type PitchClass,
  type Spelling
} from './pitch';
import { SCALE_REGIONS, type CagedQuality, type ShapeOccurrence } from './caged';

export { SCALE_REGIONS };

export type CagedLayer = 'triad' | 'chord' | 'arpeggio' | 'pentatonic' | 'scale';
export type MelodicLayer = 'arpeggio' | 'pentatonic' | 'scale';
export type ScaleDegree = 'R' | '2' | '3' | 'b3' | '4' | '5' | '6' | 'b6' | '7' | 'b7';

/** Higher priority wins a shared position (FR-009). */
export const LAYER_PRIORITY: readonly CagedLayer[] = Object.freeze([
  'triad',
  'chord',
  'arpeggio',
  'pentatonic',
  'scale'
] as const);

const set = (...d: ScaleDegree[]): ReadonlySet<ScaleDegree> => new Set(d);

export const LAYER_DEGREES: Readonly<
  Record<CagedQuality, Readonly<Record<MelodicLayer, ReadonlySet<ScaleDegree>>>>
> = Object.freeze({
  major: Object.freeze({
    arpeggio: set('R', '3', '5'),
    pentatonic: set('R', '2', '3', '5', '6'),
    scale: set('R', '2', '3', '4', '5', '6', '7')
  }),
  minor: Object.freeze({
    arpeggio: set('R', 'b3', '5'),
    pentatonic: set('R', 'b3', '4', '5', 'b7'),
    scale: set('R', '2', 'b3', '4', '5', 'b6', 'b7')
  })
});

export interface LayerNote {
  /** 1 … stringCount (7 allowed). */
  readonly string: number;
  /** 0 … fretCount. */
  readonly fret: number;
  readonly degree: ScaleDegree;
  /** Kept for the low-to-high ordering. */
  readonly pitch: Pitch;
}

/** Semitones above the root → degree, per quality. */
const DEGREE_BY_OFFSET: Readonly<Record<CagedQuality, readonly (ScaleDegree | null)[]>> = {
  major: ['R', null, '2', null, '3', '4', null, '5', null, '6', null, '7'],
  minor: ['R', null, '2', 'b3', null, '4', null, '5', 'b6', null, 'b7', null]
};

function validQuality(q: CagedQuality): boolean {
  return q === 'major' || q === 'minor';
}

export function degreeOf(pc: PitchClass, rootPc: PitchClass, q: CagedQuality): ScaleDegree | null {
  if (!Number.isFinite(pc) || !Number.isFinite(rootPc) || !validQuality(q)) return null;
  return DEGREE_BY_OFFSET[q][pitchClass(Math.trunc(pc) - Math.trunc(rootPc))];
}

/** Membership of the Arpeggio, Pentatonic or Scale layer. Chord membership is `occ.notes`. */
export function inLayer(d: ScaleDegree, layer: MelodicLayer, q: CagedQuality): boolean {
  return LAYER_DEGREES[q]?.[layer]?.has(d) ?? false;
}

/** Degrees that get the extra dot when Pentatonic and Scale are both on (FR-010). */
export function isExtraMarked(d: ScaleDegree, q: CagedQuality): boolean {
  return q === 'major' ? d === '4' || d === '7' : q === 'minor' ? d === '2' || d === 'b6' : false;
}

/**
 * Every scale note of the occurrence's region on every string, clipped to `0…fretCount`, sorted
 * by pitch ascending (ties: higher string number first). `openPitches` is string 1 first.
 */
export function layerNotes(
  occ: ShapeOccurrence,
  openPitches: readonly Pitch[],
  rootPc: PitchClass,
  q: CagedQuality,
  fretCount: number
): readonly LayerNote[] {
  if (
    !occ?.region ||
    !Array.isArray(openPitches) ||
    !Number.isFinite(rootPc) ||
    !Number.isFinite(fretCount) ||
    !validQuality(q)
  )
    return [];
  const lo = Math.max(0, Math.ceil(occ.region.start));
  const hi = Math.min(Math.floor(fretCount), occ.region.end);
  const out: LayerNote[] = [];
  openPitches.forEach((open, i) => {
    if (!Number.isFinite(open)) return;
    for (let fret = lo; fret <= hi; fret++) {
      const pitch = open + fret;
      const degree = degreeOf(pitchClass(pitch), rootPc, q);
      if (degree !== null) out.push({ string: i + 1, fret, degree, pitch });
    }
  });
  return out.sort((a, b) => a.pitch - b.pitch || b.string - a.string);
}

const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/** Letter steps above the root letter for each degree (alternate letters). */
const LETTER_STEPS: Readonly<Record<ScaleDegree, number>> = {
  R: 0,
  '2': 1,
  '3': 2,
  b3: 2,
  '4': 3,
  '5': 4,
  '6': 5,
  b6: 5,
  '7': 6,
  b7: 6
};

const OFFSET_OF: Readonly<Record<ScaleDegree, number>> = {
  R: 0,
  '2': 2,
  '3': 4,
  b3: 3,
  '4': 5,
  '5': 7,
  '6': 9,
  b6: 8,
  '7': 11,
  b7: 10
};

/**
 * Spelling of each degree of the quality's scale, on consecutive letters from the root's letter.
 * A degree whose accidental would leave −2…+2 is omitted.
 */
export function spellScale(
  root: Spelling,
  q: CagedQuality
): Readonly<Partial<Record<ScaleDegree, Spelling>>> {
  const start = LETTERS.indexOf(root?.letter);
  if (start < 0 || !validQuality(q)) return {};
  const rootPc = pitchClassOfSpelling(root);
  const out: Partial<Record<ScaleDegree, Spelling>> = {};
  for (const d of LAYER_DEGREES[q].scale) {
    const letter = LETTERS[(start + LETTER_STEPS[d]) % 7];
    const target = pitchClass(rootPc + OFFSET_OF[d]);
    let acc = target - pitchClassOfSpelling({ letter, accidental: 0 });
    if (acc > 6) acc -= 12;
    if (acc < -6) acc += 12;
    if (acc < -2 || acc > 2) continue;
    out[d] = Object.freeze({ letter, accidental: acc as Accidental });
  }
  return out;
}
