import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { pitchClass, type Pitch } from '../../../src/lib/theory/pitch';
import { QUALITIES, spellTriad } from '../../../src/lib/theory/triad';
import { INVERSIONS, comparisonFrets, triadShape } from '../../../src/lib/theory/triad-shape';

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

/** NFR-9.3 random-tuning generator (same as triad-shape.property.test.ts). */
const rising = fc
  .tuple(
    fc.integer({ min: 24, max: 55 }),
    fc.integer({ min: 1, max: 9 }),
    fc.integer({ min: 1, max: 9 })
  )
  .map(([a, g1, g2]): readonly [Pitch, Pitch, Pitch] => [a, a + g1, a + g1 + g2]);

describe('T3/T4 comparison shape invariants', () => {
  it('holds for random tunings and every ordered quality pair', () => {
    fc.assert(
      fc.property(rising, root, quality, quality, inversion, (open, pc, from, to, inv) => {
        const first = triadShape(open, spellTriad(SPELL_FOR_PC[pc], from), inv);
        const target = spellTriad(SPELL_FOR_PC[pc], to);
        const lowest = triadShape(open, target, inv);
        expect(first.kind).toBe('shape');
        expect(lowest.kind).toBe('shape');
        if (first.kind !== 'shape' || lowest.kind !== 'shape') return;

        const cmp = comparisonFrets(first.frets, first.functions, from, to);
        const sounding = cmp.map((f, i) => open[i] + f);

        // T3: strictly rising, right pitch classes, right bass function, root delta 0
        expect(sounding[1]).toBeGreaterThan(sounding[0]);
        expect(sounding[2]).toBeGreaterThan(sounding[1]);
        const pcOf = {
          root: target.pitchClasses[0],
          third: target.pitchClasses[1],
          fifth: target.pitchClasses[2]
        };
        first.functions.forEach((fn, i) => expect(pitchClass(sounding[i])).toBe(pcOf[fn]));
        expect(first.functions[0]).toBe(lowest.functions[0]);
        first.functions.forEach((fn, i) => {
          if (fn === 'root') expect(cmp[i]).toBe(first.frets[i]);
        });

        // T4: same multiple of 12 away from the lowest comparison shape on all strings
        const diffs = cmp.map((f, i) => f - lowest.frets[i]);
        expect(((diffs[0] % 12) + 12) % 12).toBe(0);
        expect(diffs[1]).toBe(diffs[0]);
        expect(diffs[2]).toBe(diffs[0]);
      }),
      RUNS
    );
  });
});
