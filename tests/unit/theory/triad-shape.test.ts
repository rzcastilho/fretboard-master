import { describe, expect, it } from 'vitest';
import {
  INVERSIONS,
  INVERSION_ORDER,
  WIDE_STRETCH_SPAN,
  isWideStretch,
  occurrences,
  span,
  triadShape,
  type Frets3,
  type Inversion
} from '../../../src/lib/theory/triad-shape';
import { spellTriad, QUALITIES, type Quality } from '../../../src/lib/theory/triad';
import type { Pitch } from '../../../src/lib/theory/pitch';

const C = { letter: 'C', accidental: 0 } as const;

/** Standard-tuning open pitches (E2 A2 D3 G3 B3 E4) by set id = lowest string of the set. */
const SET_OPEN: Record<number, readonly [Pitch, Pitch, Pitch]> = {
  6: [40, 45, 50],
  5: [45, 50, 55],
  4: [50, 55, 59],
  3: [55, 59, 64]
};
const SETS = [6, 5, 4, 3] as const;

/** TM-5.5: quality × inversion → frets for sets 6-5-4, 5-4-3, 4-3-2, 3-2-1. */
const TM_5_5: Record<Quality, Record<Inversion, [string, string, string, string]>> = {
  major: {
    root: ['8-7-5', '3-2-0', '10-9-8', '5-5-3'],
    first: ['12-10-10', '7-5-5', '2-0-1', '9-8-8'],
    second: ['3-3-2', '10-10-9', '5-5-5', '0-1-0']
  },
  minor: {
    root: ['8-6-5', '3-1-0', '10-8-8', '5-4-3'],
    first: ['11-10-10', '6-5-5', '1-0-1', '8-8-8'],
    second: ['3-3-1', '10-10-8', '5-5-4', '12-13-11']
  },
  diminished: {
    root: ['8-6-4', '15-13-11', '10-8-7', '5-4-2'],
    first: ['11-9-10', '6-4-5', '13-11-13', '8-7-8'],
    second: ['2-3-1', '9-10-8', '4-5-4', '11-13-11']
  },
  augmented: {
    root: ['8-7-6', '3-2-1', '10-9-9', '5-5-4'],
    first: ['12-11-10', '7-6-5', '2-1-1', '9-9-8'],
    second: ['4-3-2', '11-10-9', '6-5-5', '1-1-0']
  }
};

describe('T3 triadShape equals TM-5.5 (48 shapes, root C)', () => {
  for (const q of QUALITIES) {
    for (const inv of INVERSIONS) {
      SETS.forEach((set, i) => {
        it(`C ${q} ${inv} on set ${set}`, () => {
          const r = triadShape(SET_OPEN[set], spellTriad(C, q), inv);
          expect(r.kind).toBe('shape');
          if (r.kind === 'shape') {
            expect(r.frets.join('-')).toBe(TM_5_5[q][inv][i]);
            expect(r.functions).toEqual(INVERSION_ORDER[inv]);
          }
        });
      });
    }
  }
});

describe('TM-5.2 inversion order', () => {
  it('lists functions low → high', () => {
    expect(INVERSION_ORDER.root).toEqual(['root', 'third', 'fifth']);
    expect(INVERSION_ORDER.first).toEqual(['third', 'fifth', 'root']);
    expect(INVERSION_ORDER.second).toEqual(['fifth', 'root', 'third']);
    expect(INVERSIONS).toEqual(['root', 'first', 'second']);
  });
});

describe('T4 Drop D', () => {
  it('C major root on 6-5-4 = 10-7-5, span 5, wide stretch', () => {
    const r = triadShape([38, 45, 50], spellTriad(C, 'major'), 'root');
    expect(r).toMatchObject({ kind: 'shape', frets: [10, 7, 5] });
    expect(span([10, 7, 5])).toBe(5);
    expect(isWideStretch([10, 7, 5])).toBe(true);
    expect(WIDE_STRETCH_SPAN).toBe(5);
  });
});

describe('T5 occurrences', () => {
  it('C diminished root on 5-4-3 = 15-13-11', () => {
    const r = triadShape(SET_OPEN[5], spellTriad(C, 'diminished'), 'root');
    expect(r).toMatchObject({ kind: 'shape', frets: [15, 13, 11] });
    expect(occurrences([15, 13, 11], 12)).toEqual([]);
    expect(occurrences([15, 13, 11], 22)).toEqual([[15, 13, 11]]);
  });
  it('returns every octave copy that fits', () => {
    expect(occurrences([5, 5, 3], 22)).toEqual([
      [5, 5, 3],
      [17, 17, 15]
    ]);
    expect(occurrences([5, 5, 3], 12)).toEqual([[5, 5, 3]]);
    expect(occurrences([3, 2, 0], 24)).toEqual([
      [3, 2, 0],
      [15, 14, 12]
    ]);
  });
});

describe('T9 span and does-not-close', () => {
  it('span ignores open strings', () => {
    expect(span([0, 1, 0] as Frets3)).toBe(0);
    expect(span([3, 2, 0])).toBe(1);
    expect(span([0, 0, 0])).toBe(0);
    expect(isWideStretch([0, 1, 0])).toBe(false);
    expect(isWideStretch([12, 10, 10])).toBe(false);
  });
  it('unison / descending open pitches do not close', () => {
    const t = spellTriad(C, 'major');
    expect(triadShape([59, 59, 64], t, 'root')).toEqual({ kind: 'does-not-close' });
    expect(triadShape([64, 59, 55], t, 'first')).toEqual({ kind: 'does-not-close' });
    expect(triadShape([50, 59, 55], t, 'second')).toEqual({ kind: 'does-not-close' });
  });
});

/** TM-5.5 (012): root C on 7-6-5 in AF-21 (B1 E2 A2 = 35 40 45), by quality × inversion. */
const SET_765_AF21: Record<Quality, Record<Inversion, string>> = {
  major: { root: '13-12-10', first: '5-3-3', second: '8-8-7' },
  minor: { root: '13-11-10', first: '4-3-3', second: '8-8-6' },
  diminished: { root: '13-11-9', first: '4-2-3', second: '7-8-6' },
  augmented: { root: '13-12-11', first: '5-4-3', second: '9-8-7' }
};
/** Drop A: string 7 lowered to A1 (33). Only the bass fret changes, by +2. */
const SET_765_DROP_A: Record<Quality, Record<Inversion, string>> = {
  major: { root: '15-12-10', first: '7-3-3', second: '10-8-7' },
  minor: { root: '15-11-10', first: '6-3-3', second: '10-8-6' },
  diminished: { root: '15-11-9', first: '6-2-3', second: '9-8-6' },
  augmented: { root: '15-12-11', first: '7-4-3', second: '11-8-7' }
};

describe('TM-5.5 set 7-6-5 on 7-string standard (12 shapes, root C)', () => {
  for (const q of QUALITIES) {
    for (const inv of INVERSIONS) {
      it(`C ${q} ${inv}`, () => {
        const r = triadShape([35, 40, 45], spellTriad(C, q), inv);
        expect(r.kind).toBe('shape');
        if (r.kind === 'shape') {
          expect(r.frets.join('-')).toBe(SET_765_AF21[q][inv]);
          expect(r.functions).toEqual(INVERSION_ORDER[inv]);
        }
      });
    }
  }
  it('C major root is 13-12-10 and E minor root is 5-3-2 (TM-9 view 13)', () => {
    expect(triadShape([35, 40, 45], spellTriad(C, 'major'), 'root')).toMatchObject({
      frets: [13, 12, 10]
    });
    const E = { letter: 'E', accidental: 0 } as const;
    expect(triadShape([35, 40, 45], spellTriad(E, 'minor'), 'root')).toMatchObject({
      kind: 'shape',
      frets: [5, 3, 2]
    });
  });
});

describe('Drop A 7-6-5 is computed from the real pitches', () => {
  for (const q of QUALITIES) {
    for (const inv of INVERSIONS) {
      it(`C ${q} ${inv}`, () => {
        const r = triadShape([33, 40, 45], spellTriad(C, q), inv);
        expect(r.kind === 'shape' && r.frets.join('-')).toBe(SET_765_DROP_A[q][inv]);
      });
    }
  }
});

describe('EC-5.1 7-string tuning where the triad cannot close', () => {
  it('string 7 equal to string 6 does not close on 7-6-5', () => {
    for (const inv of INVERSIONS) {
      expect(triadShape([40, 40, 45], spellTriad(C, 'major'), inv)).toEqual({
        kind: 'does-not-close'
      });
    }
  });
  it('string 7 above string 6 does not close', () => {
    expect(triadShape([42, 40, 45], spellTriad(C, 'minor'), 'root')).toEqual({
      kind: 'does-not-close'
    });
  });
});
