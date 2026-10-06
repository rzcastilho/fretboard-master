/** Instrument model and positions (DM-5, DM-6). Pure. */
import {
  pitchClass,
  pitchOfSpelling,
  type Pitch,
  type PitchClass,
  type SpelledPitch
} from '../theory/pitch';

export interface Instrument {
  readonly stringCount: number;
  readonly fretCount: number;
  /** Index 0 = string 1 (highest). */
  readonly openStrings: readonly SpelledPitch[];
  /** Presentation only. */
  readonly handedness: 'right' | 'left';
  /** Presentation only. */
  readonly orientation: 'highest-top' | 'lowest-top';
  /**
   * True when `openStrings` keep their own spelling under every accidental preference (presets);
   * false for a custom tuning, whose altered strings follow the preference (021 I-1).
   */
  readonly fixedSpelling: boolean;
}

export type Handedness = Instrument['handedness'];
export type Orientation = Instrument['orientation'];
export const HANDEDNESS: readonly Handedness[] = Object.freeze(['right', 'left'] as const);
export const ORIENTATIONS: readonly Orientation[] = Object.freeze([
  'highest-top',
  'lowest-top'
] as const);

/** string 1..stringCount (1 = highest), fret 0..fretCount. */
export interface Position {
  readonly string: number;
  readonly fret: number;
}

const open = (letter: SpelledPitch['letter'], octave: number): SpelledPitch =>
  Object.freeze({ letter, accidental: 0, octave });

export const STANDARD_GUITAR: Instrument = Object.freeze({
  stringCount: 6,
  fretCount: 22,
  openStrings: Object.freeze([
    open('E', 4),
    open('B', 3),
    open('G', 3),
    open('D', 3),
    open('A', 2),
    open('E', 2)
  ]),
  handedness: 'right',
  orientation: 'highest-top',
  fixedSpelling: true
});

export function isValidPosition(instrument: Instrument, p: Position): boolean {
  return (
    Number.isInteger(p.string) &&
    Number.isInteger(p.fret) &&
    p.string >= 1 &&
    p.string <= instrument.stringCount &&
    p.fret >= 0 &&
    p.fret <= instrument.fretCount
  );
}

/** Precondition: valid position. */
export function positionPitch(instrument: Instrument, p: Position): Pitch {
  return pitchOfSpelling(instrument.openStrings[p.string - 1]) + p.fret;
}

export function positionKey(p: Position): string {
  return `${p.string}:${p.fret}`;
}

export function allPositions(instrument: Instrument): readonly Position[] {
  const out: Position[] = [];
  for (let string = 1; string <= instrument.stringCount; string++) {
    for (let fret = 0; fret <= instrument.fretCount; fret++) out.push({ string, fret });
  }
  return out;
}

/** Every valid position sounding pitch class `pc`: string ascending, fret ascending. */
export function positionsWithPitchClass(instrument: Instrument, pc: PitchClass): Position[] {
  return allPositions(instrument).filter((p) => pitchClass(positionPitch(instrument, p)) === pc);
}

/** Every other valid position with the same pitch as `p`: string ascending, fret ascending. */
export function unisonsOf(instrument: Instrument, p: Position): Position[] {
  const pitch = positionPitch(instrument, p);
  return allPositions(instrument).filter(
    (q) => (q.string !== p.string || q.fret !== p.fret) && positionPitch(instrument, q) === pitch
  );
}

/**
 * Lowest-fret position sounding `pitch`; a tie goes to the thicker (higher-numbered)
 * string. `null` when the pitch is not on the board.
 */
export function lowestPositionOfPitch(instrument: Instrument, pitch: Pitch): Position | null {
  let best: Position | null = null;
  for (let string = instrument.stringCount; string >= 1; string--) {
    const fret = pitch - pitchOfSpelling(instrument.openStrings[string - 1]);
    if (fret < 0 || fret > instrument.fretCount) continue;
    if (best === null || fret < best.fret) best = { string, fret };
  }
  return best;
}

const presentations = new WeakMap<Instrument, Map<string, Instrument>>();

/**
 * `base` with a presentation applied. Defaults return `base` itself; otherwise a frozen,
 * memoized copy (same inputs → same object). Musical fields are untouched.
 */
export function withPresentation(base: Instrument, h: Handedness, o: Orientation): Instrument {
  if (h === 'right' && o === 'highest-top' && base.handedness === h && base.orientation === o) {
    return base;
  }
  let byKey = presentations.get(base);
  if (!byKey) {
    byKey = new Map();
    presentations.set(base, byKey);
  }
  const key = `${h}|${o}`;
  let made = byKey.get(key);
  if (!made) {
    made = Object.freeze({ ...base, handedness: h, orientation: o });
    byKey.set(key, made);
  }
  return made;
}

/** Same string count, fret count and open strings; presentation ignored. */
export function equalsMusicalInstrument(a: Instrument, b: Instrument): boolean {
  return (
    a.stringCount === b.stringCount &&
    a.fretCount === b.fretCount &&
    a.openStrings.length === b.openStrings.length &&
    a.openStrings.every((s, i) => {
      const t = b.openStrings[i];
      return s.letter === t.letter && s.accidental === t.accidental && s.octave === t.octave;
    })
  );
}
