/** Pure pitch theory (TM-1). No DOM, i18n, or framework imports. */

export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
/** −2 = 𝄫, −1 = ♭, 0 = natural, 1 = ♯, 2 = 𝄪. */
export type Accidental = -2 | -1 | 0 | 1 | 2;

export interface Spelling {
  readonly letter: Letter;
  readonly accidental: Accidental;
}

/** Octave is numbered by the letter (B♯3 sounds as C4). */
export interface SpelledPitch extends Spelling {
  readonly octave: number;
}

/** Semitones; C4 = 60. */
export type Pitch = number;
/** 0..11, C = 0. */
export type PitchClass = number;

const NATURAL_CLASS: Readonly<Record<Letter, PitchClass>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11
};

export function pitchClass(p: Pitch): PitchClass {
  return ((p % 12) + 12) % 12;
}

export function octaveOf(p: Pitch): number {
  return Math.floor(p / 12) - 1;
}

export function transpose(p: Pitch, semitones: number): Pitch {
  return p + semitones;
}

export function pitchClassOfSpelling(s: Spelling): PitchClass {
  return pitchClass(NATURAL_CLASS[s.letter] + s.accidental);
}

export function pitchOfSpelling(s: SpelledPitch): Pitch {
  return (s.octave + 1) * 12 + NATURAL_CLASS[s.letter] + s.accidental;
}

/** 12-TET, A4 = 440 Hz, C4 = 60. */
export function frequencyOf(p: Pitch): number {
  return 440 * Math.pow(2, (p - 69) / 12);
}
