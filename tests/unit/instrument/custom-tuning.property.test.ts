import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  addSeventh,
  canStep,
  dropSeventh,
  isOffsets,
  offsetPitches,
  referencePitches,
  stepOffsets,
  type Offsets
} from '../../../src/lib/instrument/custom-tuning';
import {
  offsetsOfTuning,
  presetsFor,
  tuningFromOffsets,
  type StringCount
} from '../../../src/lib/instrument/tunings';
import { presetOffsets } from '../../../src/lib/instrument/custom-tuning';
import { pitchOfSpelling, spellSharp } from '../../../src/lib/theory/pitch';

const offsetsOf = (n: number): fc.Arbitrary<Offsets> =>
  fc.tuple(
    ...Array.from({ length: n }, () => fc.integer({ min: -7, max: 4 }))
  ) as unknown as fc.Arbitrary<Offsets>;
const offsets = offsetsOf(6);
const str = fc.constantFrom(1, 2, 3, 4, 5, 6) as fc.Arbitrary<1 | 2 | 3 | 4 | 5 | 6>;
const dir = fc.constantFrom(1, -1) as fc.Arbitrary<1 | -1>;

describe('custom-tuning properties', () => {
  it('stepOffsets keeps offsets valid', () => {
    fc.assert(
      fc.property(offsets, str, dir, (o, s, d) => {
        expect(isOffsets(stepOffsets(o, s, d), 6)).toBe(true);
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

describe('seven-string properties (012)', () => {
  const str7 = fc.constantFrom(1, 2, 3, 4, 5, 6, 7) as fc.Arbitrary<1 | 2 | 3 | 4 | 5 | 6 | 7>;

  it('stepOffsets keeps 7-string offsets valid', () => {
    fc.assert(
      fc.property(offsetsOf(7), str7, dir, (o, s, d) => {
        expect(isOffsets(stepOffsets(o, s, d), 7)).toBe(true);
      })
    );
  });

  it('addSeventh then dropSeventh round-trips', () => {
    fc.assert(
      fc.property(offsets, (o) => {
        expect([...dropSeventh(addSeventh(o))]).toEqual([...o]);
      })
    );
  });

  it.each([6, 7] as StringCount[])('canonical form holds for %i strings', (count) => {
    const ids = presetsFor(count);
    fc.assert(
      fc.property(offsetsOf(count), (o) => {
        const t = tuningFromOffsets(o);
        const some = ids.some((id) => [...presetOffsets(id, count)].join() === o.join());
        expect(t.kind === 'preset').toBe(some);
        expect([...offsetsOfTuning(t, count)]).toEqual([...o]);
        expect(referencePitches(count)).toHaveLength(count);
      })
    );
  });
});
