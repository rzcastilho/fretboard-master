import { describe, expect, it } from 'vitest';
import { presetStrings, type TuningId } from '../../../src/lib/instrument/tunings';
import {
  CAGED_CYCLE,
  CAGED_SHAPES,
  cagedOccurrences,
  cagedTuningClass,
  fitCount,
  rootStrings,
  type CagedQuality,
  type ShapeOccurrence
} from '../../../src/lib/theory/caged';
import { pitchOfSpelling, type Pitch } from '../../../src/lib/theory/pitch';

/** Open pitches of strings 6 → 1 (the six highest strings). */
function sixOpen(id: TuningId, count: 6 | 7 = 6): readonly Pitch[] {
  return presetStrings(id, count).map(pitchOfSpelling).slice(-6);
}

const STD = sixOpen('AF-1');
const label = (o: readonly ShapeOccurrence[]): string[] => o.map((x) => `${x.shape.id}${x.start}`);

const X = null;
const TABLE: Record<
  string,
  { quality: CagedQuality; frets: (number | null)[]; degrees: (string | null)[]; roots: number[] }
> = {
  C: {
    quality: 'major',
    frets: [X, 3, 2, 0, 1, 0],
    degrees: [X, 'R', '3', '5', 'R', '3'],
    roots: [5, 2]
  },
  A: {
    quality: 'major',
    frets: [X, 3, 5, 5, 5, 3],
    degrees: [X, 'R', '5', 'R', '3', '5'],
    roots: [5, 3]
  },
  G: {
    quality: 'major',
    frets: [8, 7, 5, 5, 5, 8],
    degrees: ['R', '3', '5', 'R', '3', 'R'],
    roots: [6, 3, 1]
  },
  E: {
    quality: 'major',
    frets: [8, 10, 10, 9, 8, 8],
    degrees: ['R', '5', 'R', '3', '5', 'R'],
    roots: [6, 4, 1]
  },
  D: {
    quality: 'major',
    frets: [X, X, 10, 12, 13, 12],
    degrees: [X, X, 'R', '5', 'R', '3'],
    roots: [4, 2]
  },
  Cm: {
    quality: 'minor',
    frets: [X, 3, 1, 0, 1, X],
    degrees: [X, 'R', 'b3', '5', 'R', X],
    roots: [5, 2]
  },
  Am: {
    quality: 'minor',
    frets: [X, 3, 5, 5, 4, 3],
    degrees: [X, 'R', '5', 'R', 'b3', '5'],
    roots: [5, 3]
  },
  Gm: {
    quality: 'minor',
    frets: [8, 6, 5, 5, 8, 8],
    degrees: ['R', 'b3', '5', 'R', '5', 'R'],
    roots: [6, 3, 1]
  },
  Em: {
    quality: 'minor',
    frets: [8, 10, 10, 8, 8, 8],
    degrees: ['R', '5', 'R', 'b3', '5', 'R'],
    roots: [6, 4, 1]
  },
  Dm: {
    quality: 'minor',
    frets: [X, X, 10, 12, 13, 11],
    degrees: [X, X, 'R', '5', 'R', 'b3'],
    roots: [4, 2]
  }
};

describe('shape tables (TM-6.1, TM-7.1)', () => {
  it('cycle order is C A G E D', () => {
    expect([...CAGED_CYCLE]).toEqual(['C', 'A', 'G', 'E', 'D']);
  });

  it.each(Object.entries(TABLE))('%s matches data-model §1', (name, row) => {
    const id = name.replace('m', '');
    const shape = CAGED_SHAPES[row.quality].find((s) => s.id === id);
    if (!shape) throw new Error(`missing shape ${name}`);
    expect(shape.quality).toBe(row.quality);
    expect(shape.strings.map((n) => (n ? n.fret : null))).toEqual(row.frets);
    expect(shape.strings.map((n) => (n ? n.degree : null))).toEqual(row.degrees);
    expect([...rootStrings(shape)]).toEqual(row.roots);
  });

  it('each quality lists five shapes in cycle order', () => {
    for (const q of ['major', 'minor'] as const)
      expect(CAGED_SHAPES[q].map((s) => s.id)).toEqual([...CAGED_CYCLE]);
  });
});

describe('cagedOccurrences, standard tuning', () => {
  const ROWS: Record<string, readonly [number, string]> = {
    C: [0, 'C0 A3 G5 E8 D10'],
    'C♯/D♭': [1, 'C1 A4 G6 E9 D11'],
    D: [2, 'D0 C2 A5 G7 E10'],
    'D♯/E♭': [3, 'D1 C3 A6 G8 E11'],
    E: [4, 'E0 D2 C4 A7 G9'],
    F: [5, 'E1 D3 C5 A8 G10'],
    'F♯/G♭': [6, 'E2 D4 C6 A9 G11'],
    G: [7, 'G0 E3 D5 C7 A10'],
    'G♯/A♭': [8, 'G1 E4 D6 C8 A11'],
    A: [9, 'A0 G2 E5 D7 C9'],
    'A♯/B♭': [10, 'A1 G3 E6 D8 C10'],
    B: [11, 'A2 G4 E7 D9 C11']
  };

  it.each(Object.entries(ROWS))(
    '%s: first five shapes along the neck (TM-6.2)',
    (_k, [pc, exp]) => {
      for (const q of ['major', 'minor'] as const) {
        const occ = cagedOccurrences(STD, pc, q, 24);
        expect(label(occ).slice(0, 5).join(' ')).toBe(exp);
      }
    }
  );

  it('second cycle: C major, 24 frets', () => {
    expect(label(cagedOccurrences(STD, 0, 'major', 24))).toEqual([
      'C0',
      'A3',
      'G5',
      'E8',
      'D10',
      'C12',
      'A15',
      'G17',
      'E20'
    ]);
  });

  it('end is the highest chord fret and notes cover the shape', () => {
    const occ = cagedOccurrences(STD, 0, 'major', 22);
    expect(occ.map((o) => [o.start, o.end])).toEqual([
      [0, 3],
      [3, 5],
      [5, 8],
      [8, 10],
      [10, 13],
      [12, 15],
      [15, 17],
      [17, 20],
      [20, 22]
    ]);
    // C shape: strings 5..1 minus muted string 6
    expect(occ[0].notes.map((n) => `${n.string}:${n.fret}`)).toEqual([
      '5:3',
      '4:2',
      '3:0',
      '2:1',
      '1:0'
    ]);
  });
});

describe('fit count (EC-6.3)', () => {
  it('C major 12 frets → C A G E, 4', () => {
    const occ = cagedOccurrences(STD, 0, 'major', 12);
    expect([...new Set(occ.map((o) => o.shape.id))]).toEqual(['C', 'A', 'G', 'E']);
    expect(fitCount(occ)).toBe(4);
  });
  it('G major 12 frets → 5', () => {
    expect(fitCount(cagedOccurrences(STD, 7, 'major', 12))).toBe(5);
  });
  it('D♭ major 13 frets → 4', () => {
    expect(fitCount(cagedOccurrences(STD, 1, 'major', 13))).toBe(4);
  });
  it('minor gives the same counts', () => {
    expect(fitCount(cagedOccurrences(STD, 0, 'minor', 12))).toBe(4);
    expect(fitCount(cagedOccurrences(STD, 7, 'minor', 12))).toBe(5);
    expect(fitCount(cagedOccurrences(STD, 1, 'minor', 13))).toBe(4);
  });
  it('empty list → 0', () => {
    expect(fitCount([])).toBe(0);
  });
});

describe('real tuning', () => {
  it('AF-2 (half step down), key C → C1 A4 G6 E9 D11', () => {
    expect(label(cagedOccurrences(sixOpen('AF-2'), 0, 'major', 24)).slice(0, 5)).toEqual([
      'C1',
      'A4',
      'G6',
      'E9',
      'D11'
    ]);
  });
  it('AF-21 and AF-23 (strings 6 … 1) equal AF-1', () => {
    const base = cagedOccurrences(STD, 0, 'major', 22);
    for (const id of ['AF-21', 'AF-23'] as const)
      expect(cagedOccurrences(sixOpen(id, 7), 0, 'major', 22)).toEqual(base);
  });
});

describe('cagedTuningClass', () => {
  it.each(['AF-1', 'AF-2', 'AF-3'] as const)('%s is compatible', (id) => {
    expect(cagedTuningClass(sixOpen(id))).toBe('compatible');
  });
  it.each(['AF-21', 'AF-22', 'AF-23'] as const)('%s (7 strings) is compatible', (id) => {
    expect(cagedTuningClass(sixOpen(id, 7))).toBe('compatible');
  });
  it.each(['AF-4', 'AF-5'] as const)('%s is altered-string', (id) => {
    expect(cagedTuningClass(sixOpen(id))).toBe('altered-string');
  });
  it.each(['AF-6', 'AF-7', 'AF-8', 'AF-9', 'AF-10', 'AF-11'] as const)(
    '%s is non-compatible',
    (id) => {
      expect(cagedTuningClass(sixOpen(id))).toBe('non-compatible');
    }
  );
});

describe('malformed input', () => {
  it('wrong length gives [] and non-compatible without throwing', () => {
    for (const bad of [[], STD.slice(1), [...STD, 28]]) {
      expect(cagedTuningClass(bad)).toBe('non-compatible');
      expect(cagedOccurrences(bad, 0, 'major', 22)).toEqual([]);
    }
  });
  it('non-compatible tuning gives no occurrences', () => {
    expect(cagedOccurrences(sixOpen('AF-4'), 0, 'major', 22)).toEqual([]);
    expect(cagedOccurrences(sixOpen('AF-8'), 0, 'major', 22)).toEqual([]);
  });
  it('non-finite pitches never throw', () => {
    const bad = [NaN, 33, 38, 43, 47, 52];
    expect(cagedTuningClass(bad)).toBe('non-compatible');
    expect(cagedOccurrences(bad, 0, 'major', 22)).toEqual([]);
  });
});
