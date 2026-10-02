import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { QUALITIES, spellTriad } from '../../../src/lib/theory/triad';
import {
  INVERSIONS,
  INVERSION_ORDER,
  inversionChain,
  occurrences,
  triadShape,
  type Frets3
} from '../../../src/lib/theory/triad-shape';
import { pitchClass, type Pitch } from '../../../src/lib/theory/pitch';

const RUNS = { numRuns: 500 };

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
const PC_INDEX = { root: 0, third: 1, fifth: 2 } as const;

const rising = fc
  .tuple(
    fc.integer({ min: 24, max: 55 }),
    fc.integer({ min: 1, max: 11 }),
    fc.integer({ min: 1, max: 11 })
  )
  .map(([a, g1, g2]): readonly [Pitch, Pitch, Pitch] => [a, a + g1, a + g1 + g2]);
const rootIdx = fc.integer({ min: 0, max: 11 });
const quality = fc.constantFrom(...QUALITIES);
const fretCount = fc.integer({ min: 0, max: 30 });

describe('inversionChain properties', () => {
  it('sorted strictly, equals triadShape + 12k, equals union of occurrences, NFR-9.3', () => {
    fc.assert(
      fc.property(rising, rootIdx, quality, fretCount, (open, r, q, n) => {
        const t = spellTriad(SPELL[r], q);
        const res = inversionChain(open, t, n);
        const union: Frets3[] = [];
        for (const inv of INVERSIONS) {
          const s = triadShape(open, t, inv);
          if (s.kind === 'shape') union.push(...occurrences(s.frets, n));
        }
        if (res.kind !== 'chain') {
          expect(res.kind).toBe(union.length === 0 ? 'beyond' : 'chain');
          return;
        }
        expect(res.shapes.length).toBe(union.length);
        for (let i = 1; i < res.shapes.length; i++) {
          expect(res.shapes[i].frets[0]).toBeGreaterThan(res.shapes[i - 1].frets[0]);
        }
        const key = (f: Frets3) => f.join(',');
        expect(new Set(res.shapes.map((s) => key(s.frets)))).toEqual(new Set(union.map(key)));
        for (const s of res.shapes) {
          const base = triadShape(open, t, s.inversion);
          if (base.kind !== 'shape') throw new Error('base must close');
          expect(s.frets).toEqual(base.frets.map((f) => f + 12 * s.octave));
          expect(s.functions).toEqual(INVERSION_ORDER[s.inversion]);
          const pitches = s.frets.map((f, j) => open[j] + f);
          expect(pitches[0]).toBeLessThan(pitches[1]);
          expect(pitches[1]).toBeLessThan(pitches[2]);
          expect(pitches[2] - pitches[0]).toBeLessThan(12);
          expect(Math.max(...s.frets)).toBeLessThanOrEqual(n);
          expect(Math.min(...s.frets)).toBeGreaterThanOrEqual(0);
          s.functions.forEach((fn, j) =>
            expect(pitchClass(pitches[j])).toBe(t.pitchClasses[PC_INDEX[fn]])
          );
          expect(s.functions[0]).toBe(INVERSION_ORDER[s.inversion][0]);
        }
      }),
      RUNS
    );
  });

  it('beyond iff the shape closes and no occurrence fits', () => {
    fc.assert(
      fc.property(rising, rootIdx, quality, fretCount, (open, r, q, n) => {
        const t = spellTriad(SPELL[r], q);
        const anyFits = INVERSIONS.some((inv) => {
          const s = triadShape(open, t, inv);
          return s.kind === 'shape' && occurrences(s.frets, n).length > 0;
        });
        expect(inversionChain(open, t, n).kind === 'beyond').toBe(!anyFits);
      }),
      RUNS
    );
  });
});
