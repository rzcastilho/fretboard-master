import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { overwriteGetLocale } from '../../../src/lib/paraglide/runtime.js';
import {
  defaultSpelling,
  intervalLabel,
  flatSpelling,
  noteLabel,
  noteLabelParts,
  noteList,
  noteName,
  overwriteNotationSource,
  pitchLabel,
  resetNotationSourceForTests,
  solfegeName,
  singleSpelling,
  spellingPair,
  markerSpellings,
  stringSpelling,
  spokenPair,
  labelPair,
  spokenNote,
  spokenNoteList
} from '../../../src/lib/notation/notation';
import type { Notation, AccidentalPolicy } from '../../../src/lib/notation/policy';
import { m } from '../../../src/lib/paraglide/messages.js';
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

type Locale = 'en' | 'pt-BR' | 'es';
const LOCALES: Locale[] = ['en', 'pt-BR', 'es'];
const SOLFEGE: Record<Locale, string[]> = {
  en: ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'],
  es: ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'],
  'pt-BR': ['Dó', 'Ré', 'Mi', 'Fá', 'Sol', 'Lá', 'Si']
};
const SOLFEGE_ORDER: Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

function useContext(notation: Notation, accidentals: AccidentalPolicy = 'sharps'): void {
  overwriteNotationSource(() => ({ notation, accidentals }));
}

describe('notation context (021 N-1 to N-5)', () => {
  beforeEach(() => resetNotationSourceForTests());
  afterEach(() => {
    resetNotationSourceForTests();
    overwriteGetLocale(() => 'en');
  });

  it('N-1: the getter is read on every call, never cached', () => {
    let notation: Notation = 'letters';
    overwriteNotationSource(() => ({ notation, accidentals: 'sharps' }));
    const s: Spelling = { letter: 'F', accidental: 1 };
    expect(noteLabel(s)).toBe('F♯');
    notation = 'solfege';
    expect(noteLabel(s)).toBe('Fa♯');
    expect(spokenNote(s)).toBe('Fa sharp');
    notation = 'letters';
    expect(noteLabel(s)).toBe('F♯');
    expect(noteName('G')).toBe('G');
  });

  it('reset restores letters and sharps', () => {
    useContext('solfege');
    resetNotationSourceForTests();
    expect(noteName('C')).toBe('C');
  });

  it('N-2: noteName is the letter in letters', () => {
    for (const l of LETTERS) expect(noteName(l)).toBe(l);
  });

  it('N-2: noteName and solfegeName per locale in solfège', () => {
    useContext('solfege');
    for (const locale of LOCALES) {
      overwriteGetLocale(() => locale);
      SOLFEGE_ORDER.forEach((l, i) => {
        expect(noteName(l)).toBe(SOLFEGE[locale][i]);
        expect(solfegeName(l)).toBe(SOLFEGE[locale][i]);
      });
    }
  });

  it('N-2: solfegeName ignores the notation (letters context)', () => {
    useContext('letters');
    expect(solfegeName('C')).toBe('Do');
    overwriteGetLocale(() => 'pt-BR');
    expect(solfegeName('A')).toBe('Lá');
  });

  it('N-2: the 7 solfège catalog values are NFC-normalized', () => {
    for (const locale of LOCALES) {
      for (const k of ['c', 'd', 'e', 'f', 'g', 'a', 'b'] as const) {
        const v = m[`note_name_solfege_${k}`]({}, { locale });
        expect(v).toBe(v.normalize('NFC'));
      }
    }
  });

  it('N-3: noteLabel and pitchLabel in solfège', () => {
    useContext('solfege');
    expect(noteLabel({ letter: 'G', accidental: 1 })).toBe('Sol♯');
    expect(noteLabel({ letter: 'B', accidental: -2 })).toBe('Si𝄫');
    expect(noteLabel({ letter: 'F', accidental: 2 })).toBe('Fa𝄪');
    expect(pitchLabel({ letter: 'G', accidental: 1 }, 3)).toBe('Sol♯3');
    overwriteGetLocale(() => 'pt-BR');
    expect(pitchLabel({ letter: 'F', accidental: -1 }, 4)).toBe('Fá♭4');
  });

  it('noteLabelParts splits name, accidental and octave', () => {
    expect(noteLabelParts({ letter: 'F', accidental: 1 })).toEqual({
      name: 'F',
      accidental: '♯',
      octave: ''
    });
    expect(noteLabelParts({ letter: 'E', accidental: 0 }, 3)).toEqual({
      name: 'E',
      accidental: '',
      octave: '3'
    });
    useContext('solfege');
    expect(noteLabelParts({ letter: 'G', accidental: 2 }, 3)).toEqual({
      name: 'Sol',
      accidental: '𝄪',
      octave: '3'
    });
  });

  it('noteLabelParts joins to noteLabel / pitchLabel', () => {
    for (const n of ['letters', 'solfege'] as const) {
      useContext(n);
      for (const s of ALL_SPELLINGS) {
        const a = noteLabelParts(s);
        expect(a.name + a.accidental).toBe(noteLabel(s));
        const b = noteLabelParts(s, 4);
        expect(b.name + b.accidental + b.octave).toBe(pitchLabel(s, 4));
      }
    }
  });

  it('N-4: spokenNote follows the notation and the locale', () => {
    const f: Spelling = { letter: 'F', accidental: 1 };
    expect(spokenNote(f)).toBe('F sharp');
    useContext('solfege');
    expect(spokenNote(f)).toBe('Fa sharp');
    overwriteGetLocale(() => 'pt-BR');
    expect(spokenNote(f)).toBe('Fá sustenido');
    overwriteGetLocale(() => 'es');
    expect(spokenNote(f)).toBe('Fa sostenido');
    overwriteGetLocale(() => 'en');
    expect(spokenNote({ letter: 'B', accidental: -2 })).toBe('Si double flat');
    useContext('letters');
    expect(spokenNote({ letter: 'B', accidental: -2 })).toBe('B double flat');
  });

  it('spokenNoteList uses the notation', () => {
    useContext('solfege');
    expect(
      spokenNoteList([
        { letter: 'C', accidental: 1 },
        { letter: 'E', accidental: 0 }
      ])
    ).toBe('Do sharp and Mi');
  });

  it('N-5: intervalLabel is unaffected by notation', () => {
    const ids = ['R', '3', 'b3', '5', 'b5', '#5', 'b6', 'b7', '2', '4', '6', '7'] as const;
    const letters = ids.map((i) => intervalLabel(i));
    useContext('solfege');
    expect(ids.map((i) => intervalLabel(i))).toEqual(letters);
  });

  it('property: no output has # or a note name followed by an ASCII b', () => {
    const spelling = fc.constantFrom(...ALL_SPELLINGS);
    const bad = /#|(?:[A-G]|Do|Dó|Re|Ré|Mi|Fa|Fá|Sol|La|Lá|Si)b/u;
    fc.assert(
      fc.property(
        spelling,
        fc.constantFrom<Notation>('letters', 'solfege'),
        fc.constantFrom(...LOCALES),
        fc.integer({ min: 0, max: 8 }),
        (s, notation, locale, octave) => {
          useContext(notation);
          overwriteGetLocale(() => locale);
          for (const out of [noteLabel(s), pitchLabel(s, octave), noteName(s.letter)]) {
            expect(out).not.toMatch(bad);
          }
          expect(spokenNote(s)).not.toMatch(/[#♯♭𝄪𝄫]/u);
        }
      )
    );
  });
});

describe('accidental policy helpers (021 N-6 to N-9)', () => {
  beforeEach(() => resetNotationSourceForTests());
  afterEach(() => resetNotationSourceForTests());

  const NATURAL_PCS = [0, 2, 4, 5, 7, 9, 11];
  const ALTERED_PCS = [1, 3, 6, 8, 10];
  const POLICIES: AccidentalPolicy[] = ['sharps', 'flats', 'both'];
  const labels = (l: readonly Spelling[]) => l.map(noteLabel);

  it('N-6: defaultSpelling ignores the policy', () => {
    for (const p of POLICIES) {
      useContext('letters', p);
      expect(noteLabel(defaultSpelling(1))).toBe('C♯');
    }
  });

  it('singleSpelling: sharp under sharps and both, flat under flats', () => {
    useContext('letters', 'sharps');
    expect(noteLabel(singleSpelling(1))).toBe('C♯');
    useContext('letters', 'both');
    expect(noteLabel(singleSpelling(1))).toBe('C♯');
    useContext('letters', 'flats');
    expect(noteLabel(singleSpelling(1))).toBe('D♭');
  });

  it('spellingPair: preferred first (N-7)', () => {
    useContext('letters', 'sharps');
    expect(labels(spellingPair(1))).toEqual(['C♯', 'D♭']);
    useContext('letters', 'both');
    expect(labels(spellingPair(1))).toEqual(['C♯', 'D♭']);
    useContext('letters', 'flats');
    expect(labels(spellingPair(1))).toEqual(['D♭', 'C♯']);
  });

  it('markerSpellings: sharps [♯], flats [♭], both [♯, ♭]', () => {
    useContext('letters', 'sharps');
    expect(labels(markerSpellings(10))).toEqual(['A♯']);
    useContext('letters', 'flats');
    expect(labels(markerSpellings(10))).toEqual(['B♭']);
    useContext('letters', 'both');
    expect(labels(markerSpellings(10))).toEqual(['A♯', 'B♭']);
  });

  it('labelPair and spokenPair', () => {
    useContext('letters', 'flats');
    expect(labelPair(1)).toBe('D♭ / C♯');
    expect(spokenPair(1)).toBe('D flat or C sharp');
    useContext('letters', 'sharps');
    expect(labelPair(1)).toBe('C♯ / D♭');
    expect(spokenPair(1)).toBe('C sharp or D flat');
    useContext('solfege', 'both');
    expect(labelPair(1)).toBe('Do♯ / Re♭');
  });

  it('N-8: naturals return the natural only under every policy', () => {
    for (const p of POLICIES) {
      useContext('letters', p);
      for (const pc of NATURAL_PCS) {
        const n = noteLabel(defaultSpelling(pc));
        expect(labels([singleSpelling(pc)])).toEqual([n]);
        expect(labels(spellingPair(pc))).toEqual([n]);
        expect(labels(markerSpellings(pc))).toEqual([n]);
        expect(labelPair(pc)).toBe(n);
        expect(spokenPair(pc)).toBe(spokenNote(defaultSpelling(pc)));
      }
    }
  });

  it('N-9: stringSpelling keeps a fixed spelling, else follows the policy', () => {
    const eFlat: Spelling = { letter: 'E', accidental: -1 };
    const dSharp: Spelling = { letter: 'D', accidental: 1 };
    for (const p of POLICIES) {
      useContext('letters', p);
      expect(stringSpelling(eFlat, true)).toEqual(eFlat);
      expect(pitchClassOfSpelling(stringSpelling(dSharp, false))).toBe(3);
    }
    useContext('letters', 'flats');
    expect(noteLabel(stringSpelling(dSharp, false))).toBe('E♭');
    useContext('letters', 'sharps');
    expect(noteLabel(stringSpelling(dSharp, false))).toBe('D♯');
    useContext('letters', 'both');
    expect(noteLabel(stringSpelling(dSharp, false))).toBe('D♯');
  });

  it('every altered pc has two distinct spellings of the same pitch class', () => {
    useContext('letters', 'both');
    for (const pc of ALTERED_PCS) {
      const pair = spellingPair(pc);
      expect(pair).toHaveLength(2);
      for (const s of pair) expect(pitchClassOfSpelling(s)).toBe(pc);
    }
  });
});
