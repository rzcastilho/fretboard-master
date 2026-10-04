import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CAGED_CYCLE,
  cagedOccurrences,
  cagedTuningClass,
  fitCount
} from '../../../src/lib/theory/caged';
import { pitchClass, type Pitch } from '../../../src/lib/theory/pitch';

const STANDARD_STEPS = [5, 5, 5, 4, 5] as const;
const OFFSET = { R: 0, '3': 4, b3: 3, '5': 7 } as const;

function tuning(low: number, steps: readonly number[] = STANDARD_STEPS): Pitch[] {
  const out = [low];
  for (const s of steps) out.push(out[out.length - 1] + s);
  return out;
}

const arbCompatible = fc.integer({ min: 28, max: 52 }).map((low) => tuning(low));
const arbCase = fc.record({
  open: arbCompatible,
  rootPc: fc.integer({ min: 0, max: 11 }),
  quality: fc.constantFrom<'major' | 'minor'>('major', 'minor'),
  frets: fc.integer({ min: 12, max: 24 })
});

describe('cagedOccurrences invariants', () => {
  it('1: every note has the right pitch class (from the real open pitch)', () => {
    fc.assert(
      fc.property(arbCase, ({ open, rootPc, quality, frets }) => {
        for (const occ of cagedOccurrences(open, rootPc, quality, frets))
          for (const n of occ.notes) {
            const pitch = open[6 - n.string] + n.fret;
            expect(pitchClass(pitch)).toBe((rootPc + OFFSET[n.degree]) % 12);
          }
      })
    );
  });

  it('2: frets stay within 0…fretCount', () => {
    fc.assert(
      fc.property(arbCase, ({ open, rootPc, quality, frets }) => {
        for (const occ of cagedOccurrences(open, rootPc, quality, frets)) {
          expect(occ.start).toBeGreaterThanOrEqual(0);
          expect(occ.end).toBeLessThanOrEqual(frets);
          for (const n of occ.notes) {
            expect(n.fret).toBeGreaterThanOrEqual(0);
            expect(n.fret).toBeLessThanOrEqual(frets);
          }
        }
      })
    );
  });

  it('3: ids are a contiguous run of the cycle', () => {
    fc.assert(
      fc.property(arbCase, ({ open, rootPc, quality, frets }) => {
        const ids = cagedOccurrences(open, rootPc, quality, frets).map((o) =>
          CAGED_CYCLE.indexOf(o.shape.id)
        );
        for (let i = 1; i < ids.length; i++) expect(ids[i]).toBe((ids[i - 1] + 1) % 5);
      })
    );
  });

  it('4: occurrences 12 frets apart share an id', () => {
    fc.assert(
      fc.property(arbCase, ({ open, rootPc, quality, frets }) => {
        const occ = cagedOccurrences(open, rootPc, quality, frets);
        for (const a of occ)
          for (const b of occ) if (b.start === a.start + 12) expect(b.shape.id).toBe(a.shape.id);
      })
    );
  });

  it('5: fitCount is 4 or 5', () => {
    fc.assert(
      fc.property(arbCase, ({ open, rootPc, quality, frets }) => {
        expect([4, 5]).toContain(fitCount(cagedOccurrences(open, rootPc, quality, frets)));
      })
    );
  });
});

describe('cagedTuningClass properties', () => {
  it('random compatible tuning is compatible', () => {
    fc.assert(
      fc.property(arbCompatible, (open) => {
        expect(cagedTuningClass(open)).toBe('compatible');
      })
    );
  });

  it('non-standard interval vectors are never compatible', () => {
    const arbSteps = fc
      .array(fc.integer({ min: -12, max: 12 }), { minLength: 5, maxLength: 5 })
      .filter((s) => s.some((v, i) => v !== STANDARD_STEPS[i]));
    fc.assert(
      fc.property(fc.integer({ min: 28, max: 52 }), arbSteps, (low, steps) => {
        expect(cagedTuningClass(tuning(low, steps))).not.toBe('compatible');
      })
    );
  });

  it('changing only string 6 gives altered-string', () => {
    fc.assert(
      fc.property(
        arbCompatible,
        fc.integer({ min: -12, max: 12 }).filter((d) => d !== 0),
        (open, d) => {
          const altered = [open[0] + d, ...open.slice(1)];
          expect(cagedTuningClass(altered)).toBe('altered-string');
        }
      )
    );
  });
});
