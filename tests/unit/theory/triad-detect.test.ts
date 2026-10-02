import { describe, expect, it } from 'vitest';
import { detectTriad } from '../../../src/lib/theory/triad-detect';
import {
  QUALITIES,
  defaultRootSpelling,
  spellTriad,
  type Quality
} from '../../../src/lib/theory/triad';

const PERMUTATIONS: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0]
];

describe('detectTriad guarantees', () => {
  it('D1 C E G → C major', () => {
    expect(detectTriad([0, 4, 7])).toEqual({ rootPc: 0, quality: 'major' });
  });
  it('D2 G♯ C E → G♯ augmented', () => {
    expect(detectTriad([8, 0, 4])).toEqual({ rootPc: 8, quality: 'augmented' });
  });
  it('D3 E G♯ C → E augmented', () => {
    expect(detectTriad([4, 8, 0])).toEqual({ rootPc: 4, quality: 'augmented' });
  });
  it('D4 C D E → null', () => {
    expect(detectTriad([0, 2, 4])).toBeNull();
  });
  it('D5 C♯ F G♯ → C♯ major', () => {
    expect(detectTriad([1, 5, 8])).toEqual({ rootPc: 1, quality: 'major' });
  });
  it('D6 every order of a non-augmented triad gives the same root and quality', () => {
    for (const q of QUALITIES.filter((x) => x !== 'augmented')) {
      for (let r = 0; r < 12; r++) {
        const pcs = spellTriad(defaultRootSpelling(r, q), q).pitchClasses;
        for (const p of PERMUTATIONS) {
          expect(detectTriad(p.map((i) => pcs[i]))).toEqual({ rootPc: r, quality: q });
        }
      }
    }
  });
});

describe('D7 invalid input returns null and never throws', () => {
  const cases: [string, readonly number[]][] = [
    ['empty', []],
    ['one note', [0]],
    ['two notes', [0, 4]],
    ['four notes', [0, 4, 7, 11]],
    ['duplicates', [0, 0, 7]],
    ['all equal', [4, 4, 4]],
    ['non-integers', [0, 4.5, 7]],
    ['NaN', [0, NaN, 7]],
    ['negative', [-1, 4, 7]],
    ['above 11', [0, 4, 12]]
  ];
  for (const [name, input] of cases) {
    it(name, () => {
      expect(() => detectTriad(input)).not.toThrow();
      expect(detectTriad(input)).toBeNull();
    });
  }
});

describe('D8 SC-002 table: 12 roots × 4 qualities × 6 orders = 288 rows', () => {
  const rows: { r: number; q: Quality; sel: number[]; expectedRoot: number }[] = [];
  for (let r = 0; r < 12; r++) {
    for (const q of QUALITIES) {
      const pcs = spellTriad(defaultRootSpelling(r, q), q).pitchClasses;
      for (const p of PERMUTATIONS) {
        const sel = p.map((i) => pcs[i]);
        rows.push({ r, q, sel, expectedRoot: q === 'augmented' ? sel[0] : r });
      }
    }
  }

  it('has 288 rows', () => {
    expect(rows).toHaveLength(288);
  });

  it.each(rows.map((row) => [`${row.r} ${row.q} [${row.sel}]`, row] as const))(
    '%s',
    (_name, row) => {
      expect(detectTriad(row.sel)).toEqual({ rootPc: row.expectedRoot, quality: row.q });
    }
  );
});
