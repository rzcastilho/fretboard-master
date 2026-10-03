import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  canStep,
  isOffsets,
  offsetPitches,
  stepOffsets,
  type Offsets
} from '../../../src/lib/instrument/custom-tuning';
import { pitchOfSpelling, spellSharp } from '../../../src/lib/theory/pitch';

const offsets = fc.tuple(
  ...Array.from({ length: 6 }, () => fc.integer({ min: -7, max: 4 }))
) as unknown as fc.Arbitrary<Offsets>;
const str = fc.constantFrom(1, 2, 3, 4, 5, 6) as fc.Arbitrary<1 | 2 | 3 | 4 | 5 | 6>;
const dir = fc.constantFrom(1, -1) as fc.Arbitrary<1 | -1>;

describe('custom-tuning properties', () => {
  it('stepOffsets keeps offsets valid', () => {
    fc.assert(
      fc.property(offsets, str, dir, (o, s, d) => {
        expect(isOffsets(stepOffsets(o, s, d))).toBe(true);
      })
    );
  });

  it('step then opposite step round-trips', () => {
    fc.assert(
      fc.property(offsets, str, dir, (o, s, d) => {
        fc.pre(canStep(o, s, d));
        const back = stepOffsets(stepOffsets(o, s, d), s, (d === 1 ? -1 : 1) as 1 | -1);
        expect([...back]).toEqual([...o]);
      })
    );
  });

  it('spellSharp preserves the pitch of every string', () => {
    fc.assert(
      fc.property(offsets, (o) => {
        for (const p of offsetPitches(o)) expect(pitchOfSpelling(spellSharp(p))).toBe(p);
      })
    );
  });
});
