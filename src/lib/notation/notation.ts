/** Note naming: glyph labels and spoken names. */
import { m } from '$lib/paraglide/messages.js';
import type { Accidental, Letter, PitchClass, Spelling } from '../theory/pitch';

const SHARP_SPELLINGS: readonly Spelling[] = [
  { letter: 'C', accidental: 0 },
  { letter: 'C', accidental: 1 },
  { letter: 'D', accidental: 0 },
  { letter: 'D', accidental: 1 },
  { letter: 'E', accidental: 0 },
  { letter: 'F', accidental: 0 },
  { letter: 'F', accidental: 1 },
  { letter: 'G', accidental: 0 },
  { letter: 'G', accidental: 1 },
  { letter: 'A', accidental: 0 },
  { letter: 'A', accidental: 1 },
  { letter: 'B', accidental: 0 }
];

const GLYPH: Readonly<Record<Accidental, string>> = {
  [-2]: '\u{1D12B}',
  [-1]: '♭',
  0: '',
  1: '♯',
  2: '\u{1D12A}'
};

/** Sharps: C C♯ D D♯ E F F♯ G G♯ A A♯ B. */
export function defaultSpelling(pc: PitchClass): Spelling {
  return SHARP_SPELLINGS[((Math.trunc(pc) % 12) + 12) % 12];
}

export function noteLabel(s: Spelling): string {
  return `${s.letter}${GLYPH[s.accidental]}`;
}

export function spokenNote(s: Spelling): string {
  const letter: Letter = s.letter;
  switch (s.accidental) {
    case -2:
      return m.note_spoken_double_flat({ letter });
    case -1:
      return m.note_spoken_flat({ letter });
    case 1:
      return m.note_spoken_sharp({ letter });
    case 2:
      return m.note_spoken_double_sharp({ letter });
    default:
      return m.note_spoken_natural({ letter });
  }
}
