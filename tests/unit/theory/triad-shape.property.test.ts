import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { QUALITIES, spellTriad } from '../../../src/lib/theory/triad';
import {
  INVERSIONS,
  INVERSION_ORDER,
  occurrences,
  triadShape,
  type Frets3
} from '../../../src/lib/theory/triad-shape';
import { pitchClass, type Pitch } from '../../../src/lib/theory/pitch';

const RUNS = { numRuns: 1000 };

const root = fc.integer({ min: 0, max: 11 });
const quality = fc.constantFrom(...QUALITIES);
const inversion = fc.constantFrom(...INVERSIONS);
const SPELL_FOR_PC = [
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

const rising = fc
  .tuple(
    fc.integer({ min: 24, max: 55 }),
    fc.integer({ min: 1, max: 9 }),
    fc.integer({ min: 1, max: 9 })
  )
  .map(([a, g1, g2]): readonly [Pitch, Pitch, Pitch] => [a, a + g1, a + g1 + g2]);

const nonRising = fc
  .tuple(
    fc.integer({ min: 24, max: 70 }),
    fc.integer({ min: -9, max: 9 }),
    fc.integer({ min: -9, max: 9 })
  )
  .filter(([, g1, g2]) => g1 <= 0 || g2 <= 0)
  .map(([a, g1, g2]): readonly [Pitch, Pitch, Pitch] => [a, a + g1, a + g1 + g2]);

describe('T6 shape invariants (NFR-9.3)', () => {
  it('holds for random strictly rising open pitches', () => {
    fc.assert(
      fc.property(rising, root, quality, inversion, (open, pc, q, inv) => {
        const t = spellTriad(SPELL_FOR_PC[pc], q);
        const r = triadShape(open, t, inv);
        expect(r.kind).toBe('shape');
        if (r.kind !== 'shape') return;
        const sounding = r.frets.map((f, i) => open[i] + f);
        expect(r.frets.every((f) => Number.isInteger(f) && f >= 0)).toBe(true);
        expect(sounding[1]).toBeGreaterThan(sounding[0]);
        expect(sounding[2]).toBeGreaterThan(sounding[1]);
        expect(sounding[2] - sounding[0]).toBeLessThan(12);
        const order = INVERSION_ORDER[inv];
        expect(r.functions).toEqual(order);
        const pcOf = {
          root: t.pitchClasses[0],
          third: t.pitchClasses[1],
          fifth: t.pitchClasses[2]
        };
        sounding.forEach((p, i) => expect(pitchClass(p)).toBe(pcOf[order[i]]));
        // lowest occurrence: lowering by an octave would make a fret negative
        expect(Math.min(...r.frets)).toBeLessThan(12);
      }),
      RUNS
    );
  });
});

describe('T7 non-rising open pitches', () => {
  it('never close', () => {
    fc.assert(
      fc.property(nonRising, root, quality, inversion, (open, pc, q, inv) => {
        const r = triadShape(open, spellTriad(SPELL_FOR_PC[pc], q), inv);
        expect(r).toEqual({ kind: 'does-not-close' });
      }),
      RUNS
    );
  });
});

describe('T8 occurrences', () => {
  it('differ by 12 on every string and never exceed fretCount', () => {
    const frets = fc.tuple(
      fc.integer({ min: 0, max: 30 }),
      fc.integer({ min: 0, max: 30 }),
      fc.integer({ min: 0, max: 30 })
    ) as fc.Arbitrary<Frets3>;
    fc.assert(
      fc.property(frets, fc.integer({ min: 12, max: 36 }), (f, count) => {
        const occ = occurrences(f, count);
        occ.forEach((o, k) => {
          expect(Math.max(...o)).toBeLessThanOrEqual(count);
          o.forEach((fret, s) => expect(fret).toBe(f[s] + 12 * k));
        });
        if (Math.max(...f) > count) expect(occ).toEqual([]);
        else {
          expect(occ.length).toBeGreaterThan(0);
          const next = Math.max(...f) + 12 * occ.length;
          expect(next).toBeGreaterThan(count);
        }
      }),
      RUNS
    );
  });
});

describe('T11 transposition', () => {
  // TM-5.5 root-C shapes, standard tuning, root position / 1st / 2nd per quality (set 3-2-1 .. 6-5-4)
  const SET_OPEN: Record<number, readonly [Pitch, Pitch, Pitch]> = {
    6: [40, 45, 50],
    5: [45, 50, 55],
    4: [50, 55, 59],
    3: [55, 59, 64]
  };
  it('shape for root r equals the root-C shape shifted by r, reduced to the lowest occurrence', () => {
    fc.assert(
      fc.property(root, quality, inversion, fc.constantFrom(3, 4, 5, 6), (pc, q, inv, set) => {
        const open = SET_OPEN[set];
        const c = triadShape(open, spellTriad(SPELL_FOR_PC[0], q), inv);
        const r = triadShape(open, spellTriad(SPELL_FOR_PC[pc], q), inv);
        if (c.kind !== 'shape' || r.kind !== 'shape') throw new Error('expected shapes');
        let shifted = c.frets.map((f) => f + pc);
        while (shifted.every((f) => f >= 12)) shifted = shifted.map((f) => f - 12);
        expect([...r.frets]).toEqual(shifted);
      }),
      RUNS
    );
  });
});
