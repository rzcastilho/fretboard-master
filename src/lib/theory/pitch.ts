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

const SHARP_SPELLINGS: readonly Spelling[] = Object.freeze(
  (
    [
      ['C', 0],
      ['C', 1],
      ['D', 0],
      ['D', 1],
      ['E', 0],
      ['F', 0],
      ['F', 1],
      ['G', 0],
      ['G', 1],
      ['A', 0],
      ['A', 1],
      ['B', 0]
    ] as const
  ).map(([letter, accidental]) => Object.freeze({ letter, accidental }))
);

/** Sharps: C C♯ D D♯ E F F♯ G G♯ A A♯ B. */
export function sharpSpelling(pc: PitchClass): Spelling {
  return SHARP_SPELLINGS[((Math.trunc(pc) % 12) + 12) % 12];
}

/** Sharp spelling of a sounding pitch; the table never yields B♯/C♭, so octave = octaveOf(p). */
export function spellSharp(p: Pitch): SpelledPitch {
  const { letter, accidental } = sharpSpelling(pitchClass(p));
  return Object.freeze({ letter, accidental, octave: octaveOf(p) });
}

const LETTER_CYCLE: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/**
 * Exact perfect fourth below `s` by the letter rule (3 steps down C D E F G A B), 5 semitones
 * lower. Returns `null` when the accidental would leave −2…+2 (only B𝄪).
 */
export function fourthBelow(s: SpelledPitch): SpelledPitch | null {
  const from = LETTER_CYCLE.indexOf(s.letter);
  const to = (from + 4) % 7; // −3 steps ≡ +4 steps
  const letter = LETTER_CYCLE[to];
  const octave = to > from ? s.octave - 1 : s.octave;
  const accidental = pitchOfSpelling(s) - 5 - ((octave + 1) * 12 + NATURAL_CLASS[letter]);
  if (accidental < -2 || accidental > 2) return null;
  return Object.freeze({ letter, accidental: accidental as Accidental, octave });
}
