import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { detectTriad } from '../../../src/lib/theory/triad-detect';
import {
  QUALITIES,
  QUALITY_INTERVALS,
  defaultRootSpelling,
  spellTriad
} from '../../../src/lib/theory/triad';

const RUNS = { numRuns: 1000 };
const root = fc.integer({ min: 0, max: 11 });
const quality = fc.constantFrom(...QUALITIES);

describe('detectTriad properties', () => {
  it('any permutation of a triad gives its quality; root is r (augmented: first element)', () => {
    fc.assert(
      fc.property(root, quality, (r, q) => {
        const pcs = spellTriad(defaultRootSpelling(r, q), q).pitchClasses;
        return fc.assert(
          fc.property(fc.shuffledSubarray([...pcs], { minLength: 3, maxLength: 3 }), (p) => {
            const got = detectTriad(p);
            expect(got).toEqual({ rootPc: q === 'augmented' ? p[0] : r, quality: q });
          }),
          { numRuns: 12 }
        );
      }),
      RUNS
    );
  });

  it('any accepted 3-set round-trips through spellTriad', () => {
    fc.assert(
      fc.property(fc.uniqueArray(root, { minLength: 3, maxLength: 3 }), (sel) => {
        const got = detectTriad(sel);
        if (got === null) return;
        const pcs = spellTriad(
          defaultRootSpelling(got.rootPc, got.quality),
          got.quality
        ).pitchClasses;
        expect([...pcs].sort((a, b) => a - b)).toEqual([...sel].sort((a, b) => a - b));
      }),
      RUNS
    );
  });

  it('a 3-set matching no interval pattern returns null', () => {
    fc.assert(
      fc.property(fc.uniqueArray(root, { minLength: 3, maxLength: 3 }), (sel) => {
        const matches = sel.some((r) =>
          QUALITIES.some((q) => {
            const { third, fifth } = QUALITY_INTERVALS[q];
            const set = new Set(sel);
            return set.has((r + third) % 12) && set.has((r + fifth) % 12);
          })
        );
        if (!matches) expect(detectTriad(sel)).toBeNull();
      }),
      RUNS
    );
  });
});
