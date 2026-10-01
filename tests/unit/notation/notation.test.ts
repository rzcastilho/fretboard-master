import { describe, expect, it } from 'vitest';
import { defaultSpelling, noteLabel, spokenNote } from '../../../src/lib/notation/notation';
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
