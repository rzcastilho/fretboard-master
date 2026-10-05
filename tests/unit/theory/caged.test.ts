import { describe, expect, it } from 'vitest';
import { presetStrings, type TuningId } from '../../../src/lib/instrument/tunings';
import {
  CAGED_CYCLE,
  CAGED_SHAPES,
  alteredStringNotes,
  cagedConnections,
  cagedOccurrences,
  cagedTuningClass,
  fitCount,
  occurrenceRootStrings,
  rootStrings,
  sharedPositions,
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
    for (const id of ['AF-6', 'AF-7', 'AF-8', 'AF-9', 'AF-10', 'AF-11'] as const)
      expect(cagedOccurrences(sixOpen(id), 0, 'major', 22)).toEqual([]);
  });
  it('non-finite pitches never throw', () => {
    const bad = [NaN, 33, 38, 43, 47, 52];
    expect(cagedTuningClass(bad)).toBe('non-compatible');
    expect(cagedOccurrences(bad, 0, 'major', 22)).toEqual([]);
  });
});

describe('placement from string 5 (slice 015, T7–T9)', () => {
  const firstE = (open: readonly Pitch[], pc: number) => {
    const occ = cagedOccurrences(open, pc, 'major', 22).find((o) => o.shape.id === 'E');
    if (!occ) throw new Error('no E occurrence');
    return occ;
  };

  it('T7: AF-2, E♭ major: first E occurrence starts at 0, roots on strings 6, 4, 1', () => {
    const e = firstE(sixOpen('AF-2'), 3);
    expect(e.start).toBe(0);
    expect(e.notes.filter((n) => n.degree === 'R').map((n) => n.string)).toEqual([6, 4, 1]);
    expect(e.alteredString).toBe(false);
  });

  it('T8: AF-2, G♭ major: E occurrence starts at 3', () => {
    expect(firstE(sixOpen('AF-2'), 6).start).toBe(3);
  });

  it.each([
    ['AF-21', 'AF-1'],
    ['AF-22', 'AF-2'],
    ['AF-23', 'AF-1']
  ] as const)('T9: %s draws like %s on strings 6→1 and nothing on string 7', (seven, six) => {
    for (const q of ['major', 'minor'] as const)
      for (let pc = 0; pc < 12; pc++) {
        const a = cagedOccurrences(sixOpen(seven, 7), pc, q, 22);
        const b = cagedOccurrences(sixOpen(six), pc, q, 22);
        expect(a).toEqual(b);
        for (const o of a) expect(o.notes.some((n) => n.string === 7)).toBe(false);
      }
  });
});

describe('occurrenceRootStrings (T12)', () => {
  const shapeOf = (id: string) => {
    const s = CAGED_SHAPES.major.find((x) => x.id === id);
    if (!s) throw new Error(id);
    return s;
  };
  const occ = (id: string, alteredString: boolean): ShapeOccurrence => ({
    shape: shapeOf(id),
    start: 0,
    end: 0,
    notes: [],
    alteredString
  });

  it('compatible: table order, descending', () => {
    expect([...occurrenceRootStrings(occ('E', false))]).toEqual([6, 4, 1]);
    expect([...occurrenceRootStrings(occ('C', false))]).toEqual([5, 2]);
  });

  it('altered string drops string 6', () => {
    expect([...occurrenceRootStrings(occ('E', true))]).toEqual([4, 1]);
    expect([...occurrenceRootStrings(occ('G', true))]).toEqual([3, 1]);
  });
});

describe('slice-014 behavior stays (T14)', () => {
  it('standard occurrences are not altered', () => {
    for (const o of cagedOccurrences(STD, 0, 'major', 24)) expect(o.alteredString).toBe(false);
  });
});

describe('altered lowest string (slice 015, US3)', () => {
  const DROP_D = sixOpen('AF-4');
  const DROP_C = sixOpen('AF-5');
  const without6 = (o: ShapeOccurrence) => ({
    shape: o.shape.id,
    start: o.start,
    end: o.end,
    notes: o.notes.filter((n) => n.string !== 6)
  });
  const strip = (occ: readonly ShapeOccurrence[]) => occ.map(without6);

  it('T1: Drop D strings 5→1 and start equal standard, every key × quality', () => {
    for (const q of ['major', 'minor'] as const)
      for (let pc = 0; pc < 12; pc++) {
        const alt = cagedOccurrences(DROP_D, pc, q, 22);
        const std = cagedOccurrences(STD, pc, q, 22);
        // Standard fit also depends on string 6 (fret ≥ 0), so compare on shared shapes.
        const base = strip(std);
        for (const a of strip(alt))
          if (a.shape !== 'G' && a.shape !== 'E') expect(base).toContainEqual(a);
        for (const o of alt) expect(o.alteredString).toBe(true);
      }
  });

  it('T2: Drop C equals Whole step down on strings 5→1', () => {
    const wsd = sixOpen('AF-3');
    for (let pc = 0; pc < 12; pc++) {
      const alt = strip(cagedOccurrences(DROP_C, pc, 'major', 24));
      const base = strip(cagedOccurrences(wsd, pc, 'major', 24));
      for (const a of alt) if (a.shape !== 'G' && a.shape !== 'E') expect(base).toContainEqual(a);
    }
  });

  const dMajor = (shape: string) => {
    const occ = cagedOccurrences(DROP_D, 2, 'major', 22).filter((o) => o.shape.id === shape);
    if (occ.length === 0) throw new Error(shape);
    return occ;
  };

  it('T3: Drop D, D major, E shape: string 6 is D (R) at fret 12, span 10–12', () => {
    const e = dMajor('E').find((o) => o.start === 10);
    expect(e).toBeDefined();
    expect(e?.end).toBe(12);
    expect(e?.notes.filter((n) => n.string === 6)).toEqual([{ string: 6, fret: 12, degree: 'R' }]);
  });

  it('T4: G shape: string 6 is A (5) at fret 7, span 7–10, nothing at 10', () => {
    const g = dMajor('G').find((o) => o.start === 7);
    expect(g).toBeDefined();
    expect(g?.end).toBe(10);
    expect(g?.notes.filter((n) => n.string === 6)).toEqual([{ string: 6, fret: 7, degree: '5' }]);
  });

  it('T5: C, A and D shapes never have a string-6 note', () => {
    for (const q of ['major', 'minor'] as const)
      for (let pc = 0; pc < 12; pc++)
        for (const o of cagedOccurrences(DROP_D, pc, q, 22))
          if (['C', 'A', 'D'].includes(o.shape.id))
            expect(o.notes.some((n) => n.string === 6)).toBe(false);
  });

  it('T6: a region without a chord tone still returns the occurrence, without string 6', () => {
    let seen = 0;
    const odd = [STD[0] - 11, ...STD.slice(1)];
    for (let pc = 0; pc < 12; pc++)
      for (const o of cagedOccurrences(odd, pc, 'major', 22))
        if ((o.shape.id === 'G' || o.shape.id === 'E') && !o.notes.some((n) => n.string === 6)) {
          seen++;
          expect(o.notes.length).toBeGreaterThan(0);
        }
    expect(seen).toBeGreaterThan(0);
  });

  it('T10: Drop D classifies as altered-string and AF-4 satisfies T3', () => {
    expect(cagedTuningClass(presetStrings('AF-4', 7).map(pitchOfSpelling).slice(-6))).toBe(
      'altered-string'
    );
    expect(dMajor('E').some((o) => o.notes.some((n) => n.string === 6 && n.fret === 12))).toBe(
      true
    );
  });

  it('T11: AF-6…AF-11 and malformed input give []', () => {
    for (const id of ['AF-6', 'AF-7', 'AF-8', 'AF-9', 'AF-10', 'AF-11'] as const)
      expect(cagedOccurrences(sixOpen(id), 2, 'major', 22)).toEqual([]);
    expect(cagedOccurrences([NaN, 45, 50, 55, 59, 64], 2, 'major', 22)).toEqual([]);
    expect(cagedOccurrences(DROP_D.slice(1), 2, 'major', 22)).toEqual([]);
  });

  describe('alteredStringNotes (T13)', () => {
    const D2 = DROP_D[0];
    it('major uses 3, minor uses b3', () => {
      // Key B on string 6 = D: fret 0 is D (b3 / not major 3), D♯ at 1 (3), F♯ at 4 (5), B at 9.
      expect(alteredStringNotes(D2, 11, 'major', 0, 11).map((n) => n.degree)).toEqual([
        '3',
        '5',
        'R'
      ]);
      expect(alteredStringNotes(D2, 11, 'minor', 0, 11).map((n) => n.degree)).toEqual([
        'b3',
        '5',
        'R'
      ]);
      expect(alteredStringNotes(D2, 2, 'minor', 0, 12).map((n) => n.degree)).toEqual([
        'R',
        'b3',
        '5',
        'R'
      ]);
    });
    it('can return several notes, ascending, on string 6', () => {
      const notes = alteredStringNotes(D2, 0, 'major', 0, 24);
      expect(notes.length).toBeGreaterThan(3);
      expect(notes.every((n) => n.string === 6)).toBe(true);
      expect(notes.map((n) => n.fret)).toEqual([...notes.map((n) => n.fret)].sort((a, b) => a - b));
    });
    it('lo > hi gives []', () => {
      expect(alteredStringNotes(D2, 0, 'major', 5, 4)).toEqual([]);
      expect(alteredStringNotes(NaN, 0, 'major', 0, 4)).toEqual([]);
    });
  });
});

describe('connections (slice 016, FR-009, SC-002)', () => {
  const keyOf = (c: { string: number; fret: number; degree: string }) =>
    `${c.string},${c.fret},${c.degree}`;
  const set = (rows: readonly (readonly [number, number, string])[]) =>
    rows.map(([s, f, d]) => `${s},${f},${d}`).sort();
  const got = (open: readonly Pitch[], q: CagedQuality, frets: number) =>
    cagedConnections(cagedOccurrences(open, 0, q, frets))
      .map(keyOf)
      .sort();

  it('C major, standard, 22 frets: exact set incl. +12 repeats', () => {
    expect(got(STD, 'major', 22)).toEqual(
      set([
        [5, 3, 'R'],
        [4, 5, '5'],
        [3, 5, 'R'],
        [2, 5, '3'],
        [6, 8, 'R'],
        [1, 8, 'R'],
        [4, 10, 'R'],
        [3, 12, '5'],
        [2, 13, 'R'],
        [1, 12, '3'],
        [5, 15, 'R'],
        [4, 17, '5'],
        [3, 17, 'R'],
        [2, 17, '3'],
        [6, 20, 'R'],
        [1, 20, 'R']
      ])
    );
  });

  it('C minor, standard, 22 frets: exact set incl. +12 repeats', () => {
    expect(got(STD, 'minor', 22)).toEqual(
      set([
        [5, 3, 'R'],
        [4, 5, '5'],
        [3, 5, 'R'],
        [6, 8, 'R'],
        [2, 8, '5'],
        [1, 8, 'R'],
        [4, 10, 'R'],
        [3, 12, '5'],
        [2, 13, 'R'],
        [5, 15, 'R'],
        [4, 17, '5'],
        [3, 17, 'R'],
        [6, 20, 'R'],
        [2, 20, '5'],
        [1, 20, 'R']
      ])
    );
  });

  it('12 frets: pairs C→A, A→G, G→E only; (4,10,R) is not a connection', () => {
    const occ = cagedOccurrences(STD, 0, 'major', 12);
    expect(label(occ)).toEqual(['C0', 'A3', 'G5', 'E8']);
    const conns = cagedConnections(occ);
    expect(conns.flatMap((c) => c.pairs.map((p) => p.join('-')))).toSatisfy(
      (x: string[]) => new Set(x).size === 3 && ['0-1', '1-2', '2-3'].every((p) => x.includes(p))
    );
    expect(conns.map(keyOf)).not.toContain('4,10,R');
  });

  it('Drop D has no string-6 connection; no string 7 ever', () => {
    const drop = cagedConnections(cagedOccurrences(sixOpen('AF-4'), 0, 'major', 22));
    expect(drop.length).toBeGreaterThan(0);
    expect(drop.some((c) => c.string === 6)).toBe(false);
    const seven = cagedConnections(cagedOccurrences(sixOpen('AF-1', 7), 0, 'major', 22));
    expect(seven.some((c) => c.string === 7)).toBe(false);
  });

  it('fewer than 2 occurrences gives []', () => {
    expect(cagedConnections([])).toEqual([]);
    expect(cagedConnections(cagedOccurrences(STD, 0, 'major', 22).slice(0, 1))).toEqual([]);
  });

  it('sorted by fret then string descending; pairs length 1 or 2', () => {
    const conns = cagedConnections(cagedOccurrences(STD, 0, 'major', 22));
    for (let i = 1; i < conns.length; i++) {
      const a = conns[i - 1];
      const b = conns[i];
      expect(a.fret < b.fret || (a.fret === b.fret && a.string > b.string)).toBe(true);
    }
    for (const c of conns) expect([1, 2]).toContain(c.pairs.length);
  });

  it('sharedPositions returns the pair intersection', () => {
    const occ = cagedOccurrences(STD, 0, 'major', 22);
    const shared = sharedPositions(occ[3], occ[4]); // E8 ∩ D10
    expect(shared.map(keyOf)).toEqual(['4,10,R']);
  });

  it('sharedPositions ignores synthesized altered string-6 notes', () => {
    const occ = cagedOccurrences(sixOpen('AF-4'), 0, 'major', 22);
    for (let i = 0; i < occ.length - 1; i++)
      expect(sharedPositions(occ[i], occ[i + 1]).some((n) => n.string === 6)).toBe(false);
  });
});
