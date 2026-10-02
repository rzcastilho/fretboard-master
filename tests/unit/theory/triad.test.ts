import { describe, expect, it } from 'vitest';
import {
  QUALITIES,
  accidentalCount,
  choiceOf,
  defaultRootSpelling,
  doubleAccidentalNotes,
  effectiveRootSpelling,
  intervalsOf,
  isAlteredRoot,
  otherRootSpelling,
  rootSpellings,
  spellTriad,
  stackingOf,
  type Quality
} from '../../../src/lib/theory/triad';
import {
  pitchClassOfSpelling,
  type Accidental,
  type Letter,
  type Spelling
} from '../../../src/lib/theory/pitch';

const ACC: Record<string, Accidental> = { '𝄫': -2, '♭': -1, '': 0, '♯': 1, '𝄪': 2 };

function sp(text: string): Spelling {
  return { letter: text[0] as Letter, accidental: ACC[text.slice(1)] };
}

const fmt = (s: Spelling): string =>
  s.letter +
  ({ '-2': '𝄫', '-1': '♭', '0': '', '1': '♯', '2': '𝄪' } as Record<string, string>)[
    String(s.accidental)
  ];

/** TM-4.2: root → [major, minor, diminished, augmented]. */
const TM_4_2: Record<string, [string, string, string, string]> = {
  C: ['C–E–G', 'C–E♭–G', 'C–E♭–G♭', 'C–E–G♯'],
  'C♯': ['C♯–E♯–G♯', 'C♯–E–G♯', 'C♯–E–G', 'C♯–E♯–G𝄪'],
  'D♭': ['D♭–F–A♭', 'D♭–F♭–A♭', 'D♭–F♭–A𝄫', 'D♭–F–A'],
  D: ['D–F♯–A', 'D–F–A', 'D–F–A♭', 'D–F♯–A♯'],
  'D♯': ['D♯–F𝄪–A♯', 'D♯–F♯–A♯', 'D♯–F♯–A', 'D♯–F𝄪–A𝄪'],
  'E♭': ['E♭–G–B♭', 'E♭–G♭–B♭', 'E♭–G♭–B𝄫', 'E♭–G–B'],
  E: ['E–G♯–B', 'E–G–B', 'E–G–B♭', 'E–G♯–B♯'],
  F: ['F–A–C', 'F–A♭–C', 'F–A♭–C♭', 'F–A–C♯'],
  'F♯': ['F♯–A♯–C♯', 'F♯–A–C♯', 'F♯–A–C', 'F♯–A♯–C𝄪'],
  'G♭': ['G♭–B♭–D♭', 'G♭–B𝄫–D♭', 'G♭–B𝄫–D𝄫', 'G♭–B♭–D'],
  G: ['G–B–D', 'G–B♭–D', 'G–B♭–D♭', 'G–B–D♯'],
  'G♯': ['G♯–B♯–D♯', 'G♯–B–D♯', 'G♯–B–D', 'G♯–B♯–D𝄪'],
  'A♭': ['A♭–C–E♭', 'A♭–C♭–E♭', 'A♭–C♭–E𝄫', 'A♭–C–E'],
  A: ['A–C♯–E', 'A–C–E', 'A–C–E♭', 'A–C♯–E♯'],
  'A♯': ['A♯–C𝄪–E♯', 'A♯–C♯–E♯', 'A♯–C♯–E', 'A♯–C𝄪–E𝄪'],
  'B♭': ['B♭–D–F', 'B♭–D♭–F', 'B♭–D♭–F♭', 'B♭–D–F♯'],
  B: ['B–D♯–F♯', 'B–D–F♯', 'B–D–F', 'B–D♯–F𝄪']
};

describe('T1 spellTriad equals TM-4.2 (68 spellings)', () => {
  it('has 17 roots × 4 qualities', () => {
    expect(Object.keys(TM_4_2)).toHaveLength(17);
  });
  for (const [root, row] of Object.entries(TM_4_2)) {
    QUALITIES.forEach((q, i) => {
      it(`${root} ${q}`, () => {
        const t = spellTriad(sp(root), q);
        expect([t.root, t.third, t.fifth].map(fmt).join('–')).toBe(row[i]);
        expect(t.pitchClasses).toEqual(
          [t.root, t.third, t.fifth].map((s) => pitchClassOfSpelling(s))
        );
      });
    });
  }
});

describe('T2 defaultRootSpelling equals TM-4.3 (20) and TM-4.3 tie-breaks', () => {
  const TM_4_3: Record<number, [string, string, string, string]> = {
    1: ['D♭', 'C♯', 'C♯', 'D♭'],
    3: ['E♭', 'E♭', 'D♯', 'E♭'],
    6: ['F♯', 'F♯', 'F♯', 'G♭'],
    8: ['A♭', 'G♯', 'G♯', 'A♭'],
    10: ['B♭', 'B♭', 'A♯', 'B♭']
  };
  const order: Quality[] = ['major', 'minor', 'diminished', 'augmented'];
  for (const [pc, row] of Object.entries(TM_4_3)) {
    order.forEach((q, i) => {
      it(`pc ${pc} ${q} → ${row[i]}`, () => {
        expect(fmt(defaultRootSpelling(Number(pc), q))).toBe(row[i]);
      });
    });
  }
  it('naturals return the natural', () => {
    for (const [pc, name] of [
      [0, 'C'],
      [2, 'D'],
      [4, 'E'],
      [5, 'F'],
      [7, 'G'],
      [9, 'A'],
      [11, 'B']
    ] as const) {
      for (const q of QUALITIES) expect(fmt(defaultRootSpelling(pc, q))).toBe(name);
    }
  });
  it('tie-break: {pc 3, minor} → flat, {pc 6, major} → sharp', () => {
    expect(fmt(defaultRootSpelling(3, 'minor'))).toBe('E♭');
    expect(fmt(defaultRootSpelling(6, 'major'))).toBe('F♯');
  });
});

describe('T10 augmented', () => {
  it('C augmented = C–E–G♯ (never A♭)', () => {
    const t = spellTriad(sp('C'), 'augmented');
    expect(fmt(t.fifth)).toBe('G♯');
  });
});

describe('helpers', () => {
  it('QUALITIES display order', () => {
    expect(QUALITIES).toEqual(['major', 'minor', 'diminished', 'augmented']);
  });
  it('rootSpellings / isAlteredRoot', () => {
    expect(rootSpellings(0).map(fmt)).toEqual(['C']);
    expect(rootSpellings(1).map(fmt)).toEqual(['C♯', 'D♭']);
    expect(rootSpellings(10).map(fmt)).toEqual(['A♯', 'B♭']);
    expect(isAlteredRoot(1)).toBe(true);
    expect(isAlteredRoot(11)).toBe(false);
    for (let pc = 0; pc < 12; pc++) {
      for (const s of rootSpellings(pc)) expect(pitchClassOfSpelling(s)).toBe(pc);
    }
  });
  it('rootSpellings wraps out-of-range pitch classes', () => {
    expect(rootSpellings(13).map(fmt)).toEqual(['C♯', 'D♭']);
    expect(rootSpellings(-1).map(fmt)).toEqual(['B']);
  });
  it('accidentalCount counts doubles as two', () => {
    expect(accidentalCount(spellTriad(sp('D♯'), 'major'))).toBe(4);
    expect(accidentalCount(spellTriad(sp('C'), 'major'))).toBe(0);
  });
  it('effectiveRootSpelling honours override on altered roots only', () => {
    expect(fmt(effectiveRootSpelling(3, 'sharp', 'major'))).toBe('D♯');
    expect(fmt(effectiveRootSpelling(3, 'flat', 'major'))).toBe('E♭');
    expect(fmt(effectiveRootSpelling(3, 'none', 'major'))).toBe('E♭');
    expect(fmt(effectiveRootSpelling(0, 'sharp', 'major'))).toBe('C');
  });
  it('otherRootSpelling', () => {
    expect(fmt(otherRootSpelling(1, sp('C♯')) as Spelling)).toBe('D♭');
    expect(fmt(otherRootSpelling(1, sp('D♭')) as Spelling)).toBe('C♯');
    expect(otherRootSpelling(0, sp('C'))).toBeNull();
  });
  it('choiceOf', () => {
    expect(choiceOf(1, sp('C♯'))).toBe('sharp');
    expect(choiceOf(1, sp('D♭'))).toBe('flat');
    expect(choiceOf(0, sp('C'))).toBeNull();
  });
  it('doubleAccidentalNotes in R-3-5 order', () => {
    const d = doubleAccidentalNotes(spellTriad(sp('D♯'), 'augmented'));
    expect(d.map((x) => [x.function, fmt(x.spelling)])).toEqual([
      ['third', 'F𝄪'],
      ['fifth', 'A𝄪']
    ]);
    expect(doubleAccidentalNotes(spellTriad(sp('A'), 'augmented'))).toEqual([]);
    const dd = doubleAccidentalNotes(spellTriad(sp('D♭'), 'diminished'));
    expect(dd.map((x) => x.function)).toEqual(['fifth']);
  });
  it('intervalsOf / stackingOf', () => {
    expect(intervalsOf('major')).toEqual(['R', '3', '5']);
    expect(intervalsOf('minor')).toEqual(['R', 'b3', '5']);
    expect(intervalsOf('diminished')).toEqual(['R', 'b3', 'b5']);
    expect(intervalsOf('augmented')).toEqual(['R', '3', '#5']);
    expect(stackingOf('major')).toBe('M3+m3');
    expect(stackingOf('minor')).toBe('m3+M3');
    expect(stackingOf('diminished')).toBe('m3+m3');
    expect(stackingOf('augmented')).toBe('M3+M3');
  });
});
