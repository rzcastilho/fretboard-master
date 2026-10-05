import { afterEach, describe, expect, it } from 'vitest';
import { overwriteGetLocale } from '../../../src/lib/paraglide/runtime.js';
import {
  defaultSpelling,
  intervalLabel,
  flatSpelling,
  noteLabel,
  noteList,
  pitchLabel,
  spokenNote,
  spokenNoteList
} from '../../../src/lib/notation/notation';
import {
  pitchClassOfSpelling,
  type Accidental,
  type Letter,
  type Spelling
} from '../../../src/lib/theory/pitch';

const LETTERS: Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const ACCIDENTALS: Accidental[] = [-2, -1, 0, 1, 2];
const ALL_SPELLINGS: Spelling[] = LETTERS.flatMap((letter) =>
  ACCIDENTALS.map((accidental) => ({ letter, accidental }))
);

describe('defaultSpelling', () => {
  it('uses sharps for pitch classes 0–11', () => {
    const expected = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
    for (let pc = 0; pc < 12; pc++) {
      const s = defaultSpelling(pc);
      expect(noteLabel(s)).toBe(expected[pc]);
      expect(pitchClassOfSpelling(s)).toBe(pc);
    }
  });
});

describe('noteLabel', () => {
  it('has 35 spellings', () => {
    expect(ALL_SPELLINGS).toHaveLength(35);
  });

  it('uses only ♯ ♭ 𝄪 𝄫 glyphs, never # or an accidental b', () => {
    for (const s of ALL_SPELLINGS) {
      const label = noteLabel(s);
      expect(label).not.toContain('#');
      expect(label.slice(1)).not.toMatch(/b/);
      expect(label[0]).toBe(s.letter);
    }
  });

  it('maps each accidental to its glyph', () => {
    expect(noteLabel({ letter: 'F', accidental: 1 })).toBe('F♯');
    expect(noteLabel({ letter: 'B', accidental: -1 })).toBe('B♭');
    expect(noteLabel({ letter: 'F', accidental: 2 })).toBe('F𝄪');
    expect(noteLabel({ letter: 'B', accidental: -2 })).toBe('B𝄫');
    expect(noteLabel({ letter: 'E', accidental: 0 })).toBe('E');
  });
});

describe('spokenNote', () => {
  it('speaks names from the catalog', () => {
    expect(spokenNote({ letter: 'F', accidental: 1 })).toBe('F sharp');
    expect(spokenNote({ letter: 'B', accidental: -2 })).toBe('B double flat');
    expect(spokenNote({ letter: 'B', accidental: -1 })).toBe('B flat');
    expect(spokenNote({ letter: 'F', accidental: 2 })).toBe('F double sharp');
    expect(spokenNote({ letter: 'E', accidental: 0 })).toBe('E');
  });

  it('never contains accidental glyphs', () => {
    for (const s of ALL_SPELLINGS) expect(spokenNote(s)).not.toMatch(/[♯♭𝄪𝄫]/u);
  });
});

describe('spokenNoteList (R-12)', () => {
  it('joins with a conjunction in the active locale', () => {
    expect(
      spokenNoteList([
        { letter: 'C', accidental: 1 },
        { letter: 'E', accidental: 0 }
      ])
    ).toBe('C sharp and E');
  });

  it('gives a single note alone', () => {
    expect(spokenNoteList([{ letter: 'G', accidental: 0 }])).toBe('G');
  });

  it('uses a serial conjunction for three notes', () => {
    expect(
      spokenNoteList([
        { letter: 'C', accidental: 0 },
        { letter: 'E', accidental: 0 },
        { letter: 'G', accidental: 0 }
      ])
    ).toBe('C, E, and G');
  });
});

describe('pitchLabel (R-05)', () => {
  it('appends the octave number to the note label', () => {
    expect(pitchLabel({ letter: 'A', accidental: 0 }, 3)).toBe('A3');
    expect(pitchLabel({ letter: 'C', accidental: 1 }, 5)).toBe('C♯5');
  });
});

describe('flatSpelling', () => {
  it('gives D♭ for C♯ and leaves naturals alone (card heading)', () => {
    expect(noteLabel(flatSpelling(1))).toBe('D♭');
    expect(noteLabel(flatSpelling(9))).toBe('A');
  });

  it('spells altered notes with flats and leaves naturals alone', () => {
    const expected = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
    for (let pc = 0; pc < 12; pc++) {
      const s = flatSpelling(pc);
      expect(noteLabel(s)).toBe(expected[pc]);
      expect(pitchClassOfSpelling(s)).toBe(pc);
    }
  });
});

describe('noteList (disjunction)', () => {
  it('joins with "or" in the given order', () => {
    expect(noteList([defaultSpelling(1), defaultSpelling(2)])).toBe('C♯ or D');
    expect(noteList([defaultSpelling(3), defaultSpelling(1), defaultSpelling(2)])).toBe(
      'D♯, C♯, or D'
    );
  });

  it('gives a single note alone', () => {
    expect(noteList([defaultSpelling(1)])).toBe('C♯');
  });
});

describe('intervalLabel', () => {
  it('uses real glyphs, never ASCII b / #', () => {
    expect(intervalLabel('R')).toBe('R');
    expect(intervalLabel('3')).toBe('3');
    expect(intervalLabel('b3')).toBe('♭3');
    expect(intervalLabel('5')).toBe('5');
    expect(intervalLabel('b5')).toBe('♭5');
    expect(intervalLabel('#5')).toBe('♯5');
    for (const id of ['R', '3', 'b3', '5', 'b5', '#5'] as const) {
      expect(intervalLabel(id)).not.toMatch(/[b#]/);
    }
  });
});

describe('intervalLabel with scale degrees', () => {
  it('maps flats and sharps to real glyphs, R to the catalog string', () => {
    expect(intervalLabel('b3')).toBe('♭3');
    expect(intervalLabel('b6')).toBe('♭6');
    expect(intervalLabel('b7')).toBe('♭7');
    expect(intervalLabel('b5')).toBe('♭5');
    expect(intervalLabel('#5')).toBe('♯5');
    expect(intervalLabel('R')).toBe('R');
    for (const d of ['2', '4', '6', '7'] as const) expect(intervalLabel(d)).toBe(d);
  });
});

describe('list joining follows the active language (020)', () => {
  afterEach(() => overwriteGetLocale(() => 'en'));
  const three: Spelling[] = [
    { letter: 'C', accidental: 0 },
    { letter: 'E', accidental: 0 },
    { letter: 'G', accidental: 0 }
  ];

  it('joins with "y" in Spanish and "e" in Brazilian Portuguese', () => {
    overwriteGetLocale(() => 'es');
    expect(spokenNoteList(three.slice(0, 2))).toMatch(/ y /);
    expect(spokenNoteList(three)).toMatch(/, .* y /);
    overwriteGetLocale(() => 'pt-BR');
    expect(spokenNoteList(three.slice(0, 2))).toMatch(/ e /);
    expect(noteList(three.slice(0, 2))).toMatch(/ ou /);
    overwriteGetLocale(() => 'es');
    expect(noteList(three.slice(0, 2))).toMatch(/ o /);
  });
});
