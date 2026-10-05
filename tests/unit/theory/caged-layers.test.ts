import { describe, expect, it } from 'vitest';
import {
  cagedOccurrences,
  type CagedQuality,
  type CagedShapeId
} from '../../../src/lib/theory/caged';
import {
  LAYER_DEGREES,
  LAYER_PRIORITY,
  SCALE_REGIONS,
  degreeOf,
  inLayer,
  isExtraMarked,
  layerNotes,
  spellScale,
  type ScaleDegree
} from '../../../src/lib/theory/caged-layers';
import { pitchClassOfSpelling } from '../../../src/lib/theory/pitch';

function must<T>(v: T | undefined | null): T {
  if (v === undefined || v === null) throw new Error('expected a value');
  return v;
}

const STANDARD = [40, 45, 50, 55, 59, 64]; // string 6 → 1
const OPEN_S1_FIRST = [...STANDARD].reverse();
const SHAPES: readonly CagedShapeId[] = ['C', 'A', 'G', 'E', 'D'];

/** Rows are strings 6 → 1; cells are "fret(degree)" (TM-6.4, TM-7.4). */
const SCALE_TABLE: Record<CagedQuality, Record<CagedShapeId, readonly string[]>> = {
  major: {
    C: [
      '0(3) 1(4) 3(5)',
      '0(6) 2(7) 3(R)',
      '0(2) 2(3) 3(4)',
      '0(5) 2(6)',
      '0(7) 1(R) 3(2)',
      '0(3) 1(4) 3(5)'
    ],
    A: [
      '3(5) 5(6)',
      '2(7) 3(R) 5(2)',
      '2(3) 3(4) 5(5)',
      '2(6) 4(7) 5(R)',
      '3(2) 5(3) 6(4)',
      '3(5) 5(6)'
    ],
    G: [
      '5(6) 7(7) 8(R)',
      '5(2) 7(3) 8(4)',
      '5(5) 7(6)',
      '4(7) 5(R) 7(2)',
      '5(3) 6(4) 8(5)',
      '5(6) 7(7) 8(R)'
    ],
    E: [
      '7(7) 8(R) 10(2)',
      '7(3) 8(4) 10(5)',
      '7(6) 9(7) 10(R)',
      '7(2) 9(3) 10(4)',
      '8(5) 10(6)',
      '7(7) 8(R) 10(2)'
    ],
    D: [
      '10(2) 12(3) 13(4)',
      '10(5) 12(6)',
      '9(7) 10(R) 12(2)',
      '9(3) 10(4) 12(5)',
      '10(6) 12(7) 13(R)',
      '10(2) 12(3) 13(4)'
    ]
  },
  minor: {
    C: [
      '1(4) 3(5) 4(b6)',
      '1(b7) 3(R)',
      '0(2) 1(b3) 3(4)',
      '0(5) 1(b6) 3(b7)',
      '1(R) 3(2) 4(b3)',
      '1(4) 3(5) 4(b6)'
    ],
    A: [
      '3(5) 4(b6) 6(b7)',
      '3(R) 5(2) 6(b3)',
      '3(4) 5(5) 6(b6)',
      '3(b7) 5(R)',
      '3(2) 4(b3) 6(4)',
      '3(5) 4(b6) 6(b7)'
    ],
    G: [
      '6(b7) 8(R)',
      '5(2) 6(b3) 8(4)',
      '5(5) 6(b6) 8(b7)',
      '5(R) 7(2) 8(b3)',
      '6(4) 8(5) 9(b6)',
      '6(b7) 8(R)'
    ],
    E: [
      '8(R) 10(2) 11(b3)',
      '8(4) 10(5) 11(b6)',
      '8(b7) 10(R)',
      '7(2) 8(b3) 10(4)',
      '8(5) 9(b6) 11(b7)',
      '8(R) 10(2) 11(b3)'
    ],
    D: [
      '10(2) 11(b3) 13(4)',
      '10(5) 11(b6) 13(b7)',
      '10(R) 12(2) 13(b3)',
      '10(4) 12(5) 13(b6)',
      '11(b7) 13(R)',
      '10(2) 11(b3) 13(4)'
    ]
  }
};

/** Pentatonic frets per string 6 → 1 (TM-6.5, TM-7.5). */
const PENT_TABLE: Record<CagedQuality, Record<CagedShapeId, readonly string[]>> = {
  major: {
    C: ['0 3', '0 3', '0 2', '0 2', '1 3', '0 3'],
    A: ['3 5', '3 5', '2 5', '2 5', '3 5', '3 5'],
    G: ['5 8', '5 7', '5 7', '5 7', '5 8', '5 8'],
    E: ['8 10', '7 10', '7 10', '7 9', '8 10', '8 10'],
    D: ['10 12', '10 12', '10 12', '9 12', '10 13', '10 12']
  },
  minor: {
    C: ['1 3', '1 3', '1 3', '0 3', '1 4', '1 3'],
    A: ['3 6', '3 6', '3 5', '3 5', '4 6', '3 6'],
    G: ['6 8', '6 8', '5 8', '5 8', '6 8', '6 8'],
    E: ['8 11', '8 10', '8 10', '8 10', '8 11', '8 11'],
    D: ['11 13', '10 13', '10 13', '10 12', '11 13', '11 13']
  }
};

function expectedSet(rows: readonly string[]): string[] {
  const out: string[] = [];
  rows.forEach((row, i) => {
    for (const cell of row.split(' ')) {
      const m = must(/^(\d+)\((.+)\)$/.exec(cell));
      out.push(`${6 - i}:${m[1]}:${m[2]}`);
    }
  });
  return out.sort();
}

function occurrenceAt(
  open: readonly number[],
  rootPc: number,
  q: CagedQuality,
  id: CagedShapeId,
  regionStart: number,
  frets = 24
) {
  const sixOpen = open.slice(-6);
  const occ = cagedOccurrences(sixOpen, rootPc, q, frets).find(
    (o) => o.shape.id === id && o.region.start === regionStart
  );
  if (!occ) throw new Error(`no ${id} occurrence at ${regionStart}`);
  return occ;
}

const key = (n: { string: number; fret: number; degree: ScaleDegree }) =>
  `${n.string}:${n.fret}:${n.degree}`;

describe('layerNotes tables (C key, standard tuning)', () => {
  for (const q of ['major', 'minor'] as const) {
    for (const id of SHAPES) {
      it(`scale: ${q} ${id} shape matches ${q === 'major' ? 'TM-6.4' : 'TM-7.4'}`, () => {
        const occ = occurrenceAt(STANDARD, 0, q, id, SCALE_REGIONS[q][id][0]);
        const notes = layerNotes(occ, OPEN_S1_FIRST, 0, q, 24);
        expect(notes.map(key).sort()).toEqual(expectedSet(SCALE_TABLE[q][id]));
      });
      it(`pentatonic: ${q} ${id} shape matches ${q === 'major' ? 'TM-6.5' : 'TM-7.5'}`, () => {
        const occ = occurrenceAt(STANDARD, 0, q, id, SCALE_REGIONS[q][id][0]);
        const notes = layerNotes(occ, OPEN_S1_FIRST, 0, q, 24).filter((n) =>
          inLayer(n.degree, 'pentatonic', q)
        );
        const expected: string[] = [];
        PENT_TABLE[q][id].forEach((row, i) =>
          row.split(' ').forEach((f) => expected.push(`${6 - i}:${f}`))
        );
        expect(notes.map((n) => `${n.string}:${n.fret}`).sort()).toEqual(expected.sort());
      });
    }
  }
});

describe('layerNotes anchors', () => {
  it('A minor Em shape pentatonic (5-fret occurrence)', () => {
    const occ = occurrenceAt(STANDARD, 9, 'minor', 'E', 4);
    const notes = layerNotes(occ, OPEN_S1_FIRST, 9, 'minor', 24).filter((n) =>
      inLayer(n.degree, 'pentatonic', 'minor')
    );
    const byString = (s: number) =>
      notes
        .filter((n) => n.string === s)
        .map((n) => n.fret)
        .sort((a, b) => a - b);
    expect(byString(6)).toEqual([5, 8]);
    expect(byString(5)).toEqual([5, 7]);
    expect(byString(4)).toEqual([5, 7]);
    expect(byString(3)).toEqual([5, 7]);
    expect(byString(2)).toEqual([5, 8]);
    expect(byString(1)).toEqual([5, 8]);
  });

  it('TM-6.6: C major C shape at fret 0 has no fret < 0', () => {
    const occ = occurrenceAt(STANDARD, 0, 'major', 'C', 0);
    const notes = layerNotes(occ, OPEN_S1_FIRST, 0, 'major', 24);
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every((n) => n.fret >= 0)).toBe(true);
  });

  it('region is not clipped: occurrence below the nut keeps a negative start', () => {
    const occ = cagedOccurrences(STANDARD, 9, 'major', 24).find((o) => o.region.start < 0);
    // A major, A shape: chord at frets 0–2, scale window −1…3.
    expect(occ).toBeDefined();
    const notes = layerNotes(must(occ), OPEN_S1_FIRST, 9, 'major', 24);
    expect(notes.every((n) => n.fret >= 0)).toBe(true);
  });

  it('TM-6.7 AF-21: D major C shape, string 7 frets equal string 2 frets', () => {
    // B E A D G B E (string 7 → 1), pitches 35 40 45 50 55 59 64
    const open7 = [35, 40, 45, 50, 55, 59, 64];
    const occ = cagedOccurrences(open7.slice(-6), 2, 'major', 24).find((o) => o.shape.id === 'C');
    expect(occ).toBeDefined();
    const notes = layerNotes(must(occ), [...open7].reverse(), 2, 'major', 24);
    const frets = (s: number) =>
      notes
        .filter((n) => n.string === s)
        .map((n) => n.fret)
        .sort((a, b) => a - b);
    expect(frets(7).length).toBeGreaterThan(0);
    expect(frets(7)).toEqual(frets(2));
  });

  it('AF-4 Drop D, D major, E shape: region 9–12, scale s6 and pentatonic s6', () => {
    const drop = [38, 45, 50, 55, 59, 64];
    const occ = cagedOccurrences(drop, 2, 'major', 24).find(
      (o) => o.shape.id === 'E' && o.region.start === 9
    );
    expect(occ).toBeDefined();
    expect(must(occ).region).toEqual({ start: 9, end: 12 });
    const s6 = layerNotes(must(occ), [...drop].reverse(), 2, 'major', 24).filter(
      (n) => n.string === 6
    );
    expect(s6.map((n) => `${n.fret}(${n.degree})`).sort()).toEqual(['11(7)', '12(R)', '9(6)']);
    expect(
      s6
        .filter((n) => inLayer(n.degree, 'pentatonic', 'major'))
        .map((n) => n.fret)
        .sort((a, b) => a - b)
    ).toEqual([9, 12]);
  });

  it('sorts by pitch ascending, ties to the higher string number first', () => {
    const occ = occurrenceAt(STANDARD, 0, 'major', 'E', 7);
    const notes = layerNotes(occ, OPEN_S1_FIRST, 0, 'major', 24);
    for (let i = 1; i < notes.length; i++) {
      const a = notes[i - 1];
      const b = notes[i];
      expect(a.pitch < b.pitch || (a.pitch === b.pitch && a.string > b.string)).toBe(true);
    }
  });

  it('is total on malformed input', () => {
    const occ = occurrenceAt(STANDARD, 0, 'major', 'E', 7);
    expect(layerNotes(occ, [], 0, 'major', 24)).toEqual([]);
    expect(layerNotes(occ, OPEN_S1_FIRST, NaN, 'major', 24)).toEqual([]);
    expect(layerNotes(occ, OPEN_S1_FIRST, 0, 'major', NaN)).toEqual([]);
  });
});

describe('degreeOf / inLayer / isExtraMarked', () => {
  it('degreeOf maps pitch classes for both qualities', () => {
    const major = [0, 2, 4, 5, 7, 9, 11].map((pc) => degreeOf(pc, 0, 'major'));
    expect(major).toEqual(['R', '2', '3', '4', '5', '6', '7']);
    const minor = [0, 2, 3, 5, 7, 8, 10].map((pc) => degreeOf(pc, 0, 'minor'));
    expect(minor).toEqual(['R', '2', 'b3', '4', '5', 'b6', 'b7']);
    expect(degreeOf(1, 0, 'major')).toBeNull();
    expect(degreeOf(4, 0, 'minor')).toBeNull();
    expect(degreeOf(7, 9, 'minor')).toBe('b7');
    expect(degreeOf(11, 2, 'major')).toBe('6');
    expect(degreeOf(NaN, 0, 'major')).toBeNull();
  });

  it('inLayer follows LAYER_DEGREES', () => {
    expect(inLayer('R', 'arpeggio', 'major')).toBe(true);
    expect(inLayer('2', 'arpeggio', 'major')).toBe(false);
    expect(inLayer('4', 'pentatonic', 'major')).toBe(false);
    expect(inLayer('4', 'pentatonic', 'minor')).toBe(true);
    expect(inLayer('4', 'scale', 'major')).toBe(true);
    expect(inLayer('b3', 'scale', 'major')).toBe(false);
    expect(LAYER_DEGREES.minor.arpeggio.size).toBe(3);
  });

  it('isExtraMarked', () => {
    expect(isExtraMarked('4', 'major')).toBe(true);
    expect(isExtraMarked('7', 'major')).toBe(true);
    expect(isExtraMarked('2', 'major')).toBe(false);
    expect(isExtraMarked('2', 'minor')).toBe(true);
    expect(isExtraMarked('b6', 'minor')).toBe(true);
    expect(isExtraMarked('4', 'minor')).toBe(false);
  });

  it('LAYER_PRIORITY order', () => {
    expect(LAYER_PRIORITY).toEqual(['chord', 'arpeggio', 'pentatonic', 'scale']);
  });
});

describe('spellScale', () => {
  const letters = (r: ReturnType<typeof spellScale>, ds: ScaleDegree[]) =>
    ds.map((d) => must(r[d]).letter).join('');

  it('uses alternate letters (major)', () => {
    const s = spellScale({ letter: 'D', accidental: 0 }, 'major');
    expect(letters(s, ['R', '2', '3', '4', '5', '6', '7'])).toBe('DEFGABC');
    expect(s['3']).toEqual({ letter: 'F', accidental: 1 });
    expect(s['7']).toEqual({ letter: 'C', accidental: 1 });
    expect(s['b3']).toBeUndefined();
  });

  it('uses alternate letters (minor), flat root', () => {
    const s = spellScale({ letter: 'B', accidental: -1 }, 'minor');
    expect(letters(s, ['R', '2', 'b3', '4', '5', 'b6', 'b7'])).toBe('BCDEFGA');
    expect(s['b3']).toEqual({ letter: 'D', accidental: -1 });
    expect(s['b7']).toEqual({ letter: 'A', accidental: -1 });
    expect(s['3']).toBeUndefined();
  });

  it('each spelling sounds the right pitch class', () => {
    const root = { letter: 'F' as const, accidental: 1 as const };
    const s = spellScale(root, 'major');
    expect(pitchClassOfSpelling(must(s['4']))).toBe((6 + 5) % 12);
    expect(s['4']).toEqual({ letter: 'B', accidental: 0 });
  });
});
