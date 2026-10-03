/** Note naming: glyph labels and spoken names. */
import { m } from '$lib/paraglide/messages.js';
import { getLocale } from '$lib/paraglide/runtime.js';
import type { IntervalId } from '../theory/triad';
import { sharpSpelling } from '../theory/pitch';
import type { Accidental, Letter, PitchClass, Spelling } from '../theory/pitch';

const GLYPH: Readonly<Record<Accidental, string>> = {
  [-2]: '\u{1D12B}',
  [-1]: '♭',
  0: '',
  1: '♯',
  2: '\u{1D12A}'
};

/** Sharps: C C♯ D D♯ E F F♯ G G♯ A A♯ B. */
export function defaultSpelling(pc: PitchClass): Spelling {
  return sharpSpelling(pc);
}

/** Flats for altered notes (C♯ → D♭); naturals are unchanged. */
export function flatSpelling(pc: PitchClass): Spelling {
  const sharp = defaultSpelling(pc);
  if (sharp.accidental === 0) return sharp;
  return { letter: defaultSpelling(pc + 1).letter, accidental: -1 };
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

/** Spoken names joined with the locale's conjunction ("C sharp and E"). */
export function spokenNoteList(spellings: readonly Spelling[]): string {
  return new Intl.ListFormat(getLocale(), { style: 'long', type: 'conjunction' }).format(
    spellings.map(spokenNote)
  );
}

/** Note label plus octave number, e.g. "G3", "C♯5". */
export function pitchLabel(s: Spelling, octave: number): string {
  return `${noteLabel(s)}${octave}`;
}

/** Note labels joined with the locale's disjunction ("C♯ or D"), in the given order. */
export function noteList(spellings: readonly Spelling[]): string {
  return new Intl.ListFormat(getLocale(), { style: 'long', type: 'disjunction' }).format(
    spellings.map(noteLabel)
  );
}

/** Interval label for a triad member: R from the catalog, other ids as glyph strings. */
export function intervalLabel(id: IntervalId): string {
  switch (id) {
    case 'R':
      return m.interval_root();
    case 'b3':
      return '♭3';
    case 'b5':
      return '♭5';
    case '#5':
      return '♯5';
    default:
      return id;
  }
}
