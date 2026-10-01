/** Instrument model and positions (DM-5, DM-6). Pure. */
import { pitchOfSpelling, type Pitch, type SpelledPitch } from '../theory/pitch';

export interface Instrument {
  readonly stringCount: number;
  readonly fretCount: number;
  /** Index 0 = string 1 (highest). */
  readonly openStrings: readonly SpelledPitch[];
  /** Presentation only. */
  readonly handedness: 'right' | 'left';
  /** Presentation only. */
  readonly orientation: 'highest-top' | 'lowest-top';
}

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
  orientation: 'highest-top'
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
