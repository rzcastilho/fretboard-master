import { describe, expect, it } from 'vitest';
import { QUALITIES, spellTriad, type Quality } from '../../../src/lib/theory/triad';
import {
  INVERSIONS,
  INVERSION_ORDER,
  inversionChain,
  occurrences,
  triadShape,
  type ChainShape,
  type Frets3
} from '../../../src/lib/theory/triad-shape';
import type { Pitch } from '../../../src/lib/theory/pitch';

const SPELL = [
  { letter: 'C', accidental: 0 },
  { letter: 'C', accidental: 1 },
  { letter: 'D', accidental: 0 },
  { letter: 'E', accidental: -1 },
  { letter: 'E', accidental: 0 },
  { letter: 'F', accidental: 0 },
  { letter: 'F', accidental: 1 },
  { letter: 'G', accidental: 0 },
  { letter: 'A', accidental: -1 },
  { letter: 'A', accidental: 0 },
  { letter: 'B', accidental: -1 },
  { letter: 'B', accidental: 0 }
] as const;

const SET_OPEN: Record<number, readonly [Pitch, Pitch, Pitch]> = {
  6: [40, 45, 50],
  5: [45, 50, 55],
  4: [50, 55, 59],
  3: [55, 59, 64]
};

const A = spellTriad({ letter: 'A', accidental: 0 }, 'major');
const C = (q: Quality) => spellTriad({ letter: 'C', accidental: 0 }, q);

function chain(open: readonly [Pitch, Pitch, Pitch], t: ReturnType<typeof C>, n: number) {
  const r = inversionChain(open, t, n);
  if (r.kind !== 'chain') throw new Error(`expected chain, got ${r.kind}`);
  return r.shapes;
}
const desc = (shapes: readonly ChainShape[]) =>
  shapes.map((s) => `${s.inversion}:${s.frets.join('-')}`);
const pattern = (f: Frets3) => f.map((x) => x - Math.min(...f)).join('-');

describe('inversionChain: reference rows', () => {
  it('A major, 3-2-1, 22 frets', () => {
    expect(desc(chain(SET_OPEN[3], A, 22))).toEqual([
      'root:2-2-0',
      'first:6-5-5',
      'second:9-10-9',
      'root:14-14-12',
      'first:18-17-17',
      'second:21-22-21'
    ]);
  });

  it('C major, 3-2-1, 22 frets', () => {
    expect(desc(chain(SET_OPEN[3], C('major'), 22))).toEqual([
      'second:0-1-0',
      'root:5-5-3',
      'first:9-8-8',
      'second:12-13-12',
      'root:17-17-15',
      'first:21-20-20'
    ]);
  });

  it('C augmented, 3-2-1, 22 frets: same pattern, lowest-string deltas exactly 4 (C17)', () => {
    const shapes = chain(SET_OPEN[3], C('augmented'), 22);
    expect(desc(shapes)).toEqual([
      'second:1-1-0',
      'root:5-5-4',
      'first:9-9-8',
      'second:13-13-12',
      'root:17-17-16',
      'first:21-21-20'
    ]);
    for (let i = 1; i < shapes.length; i++) {
      expect(shapes[i].frets[0] - shapes[i - 1].frets[0]).toBe(4);
      expect(pattern(shapes[i].frets)).toBe(pattern(shapes[0].frets));
    }
  });

  it('A major, 3-2-1, 7 frets: only root and first inversion fit', () => {
    expect(desc(chain(SET_OPEN[3], A, 7))).toEqual(['root:2-2-0', 'first:6-5-5']);
  });

  it('octave index and functions are carried', () => {
    const shapes = chain(SET_OPEN[3], A, 22);
    expect(shapes.map((s) => s.octave)).toEqual([0, 0, 0, 1, 1, 1]);
    for (const s of shapes) expect(s.functions).toBe(INVERSION_ORDER[s.inversion]);
  });
});

describe('inversionChain: guidance results', () => {
  it('non-rising open pitches → does-not-close', () => {
    expect(inversionChain([59, 59, 64], A, 22)).toEqual({ kind: 'does-not-close' });
    expect(inversionChain([64, 59, 55], A, 22)).toEqual({ kind: 'does-not-close' });
  });

  it('closes but nothing fits → beyond', () => {
    expect(inversionChain(SET_OPEN[3], A, 1)).toEqual({ kind: 'beyond' });
  });
});

describe('inversionChain: C16 patterns', () => {
  it('6-5-4 pattern equals 5-4-3 pattern for every root × quality × inversion', () => {
    for (const rp of SPELL) {
      for (const q of QUALITIES) {
        const t = spellTriad(rp, q);
        for (const inv of INVERSIONS) {
          const a = triadShape(SET_OPEN[6], t, inv);
          const b = triadShape(SET_OPEN[5], t, inv);
          if (a.kind !== 'shape' || b.kind !== 'shape') throw new Error('must close');
          expect(pattern(a.frets)).toBe(pattern(b.frets));
        }
      }
    }
  });

  it('4-3-2 differs from 3-2-1 (B string tuning)', () => {
    const t = C('major');
    const p = (set: number, inv: 'root') => {
      const r = triadShape(SET_OPEN[set], t, inv);
      if (r.kind !== 'shape') throw new Error();
      return r.frets;
    };
    expect(p(4, 'root').join('-')).toBe('10-9-8');
    expect(pattern(p(4, 'root'))).toBe('2-1-0');
    expect(p(3, 'root').join('-')).toBe('5-5-3');
    expect(pattern(p(3, 'root'))).toBe('2-2-0');
    const root543 = chain(SET_OPEN[5], C('major'), 22).find((s) => s.inversion === 'root');
    expect(pattern(root543?.frets ?? [0, 0, 0])).toBe('3-2-0');
  });
});

describe('inversionChain: SC-002 exhaustive', () => {
  it('equals TM-5.3 lowest + 12k that fits, per inversion, sorted', () => {
    for (const rp of SPELL) {
      for (const q of QUALITIES) {
        const t = spellTriad(rp, q);
        for (const set of [6, 5, 4, 3]) {
          for (let n = 0; n <= 22; n++) {
            const open = SET_OPEN[set];
            const expected: { inv: string; frets: Frets3 }[] = [];
            for (const inv of INVERSIONS) {
              const r = triadShape(open, t, inv);
              if (r.kind !== 'shape') throw new Error('must close');
              for (const f of occurrences(r.frets, n)) expected.push({ inv, frets: f });
            }
            expected.sort((x, y) => x.frets[0] - y.frets[0]);
            const got = inversionChain(open, t, n);
            if (expected.length === 0) {
              expect(got).toEqual({ kind: 'beyond' });
            } else {
              if (got.kind !== 'chain') throw new Error('expected chain');
              expect(got.shapes.map((s) => ({ inv: s.inversion, frets: s.frets }))).toEqual(
                expected
              );
            }
          }
        }
      }
    }
  });
});
