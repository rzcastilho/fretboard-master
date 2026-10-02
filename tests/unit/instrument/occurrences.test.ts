import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  STANDARD_GUITAR,
  positionPitch,
  positionsWithPitchClass,
  unisonsOf,
  type Instrument
} from '../../../src/lib/instrument/instrument';
import { pitchClass } from '../../../src/lib/theory/pitch';

describe('positionsWithPitchClass', () => {
  it('finds exactly the 12 G positions on a standard guitar, string then fret ascending', () => {
    const g = positionsWithPitchClass(STANDARD_GUITAR, 7).map((p) => `s${p.string}f${p.fret}`);
    expect(g).toEqual(
      [
        // G2
        's3f0',
        's3f12',
        's4f5',
        's4f17',
        's5f10',
        's5f22',
        's6f3',
        's6f15',
        's2f8',
        's1f3',
        's1f15',
        's2f20'
      ].sort(byStringThenFret)
    );
    expect(g).toHaveLength(12);
  });

  it('covers the G2–G5 octaves', () => {
    const octs = positionsWithPitchClass(STANDARD_GUITAR, 7).map(
      (p) => Math.floor(positionPitch(STANDARD_GUITAR, p) / 12) - 1
    );
    expect(new Set(octs)).toEqual(new Set([2, 3, 4, 5]));
    expect(octs.filter((o) => o === 2)).toHaveLength(1);
    expect(octs.filter((o) => o === 3)).toHaveLength(4);
    expect(octs.filter((o) => o === 4)).toHaveLength(5);
    expect(octs.filter((o) => o === 5)).toHaveLength(2);
  });

  it('property: every result has the pitch class, none is omitted, order is stable', () => {
    const letter = fc.constantFrom('C', 'D', 'E', 'F', 'G', 'A', 'B' as const);
    const inst = fc.record({
      tuning: fc.array(
        fc.record({
          letter,
          accidental: fc.constant(0 as const),
          octave: fc.integer({ min: 0, max: 5 })
        }),
        { minLength: 1, maxLength: 9 }
      ),
      fretCount: fc.integer({ min: 0, max: 30 })
    });
    fc.assert(
      fc.property(inst, fc.integer({ min: 0, max: 11 }), ({ tuning, fretCount }, pc) => {
        const instrument: Instrument = {
          ...STANDARD_GUITAR,
          stringCount: tuning.length,
          fretCount,
          openStrings: tuning
        };
        const got = positionsWithPitchClass(instrument, pc);
        let expected = 0;
        for (let string = 1; string <= tuning.length; string++)
          for (let fret = 0; fret <= fretCount; fret++)
            if (pitchClass(positionPitch(instrument, { string, fret })) === pc) expected++;
        expect(got).toHaveLength(expected);
        for (const p of got) expect(pitchClass(positionPitch(instrument, p))).toBe(pc);
        const sorted = [...got].sort((a, b) => a.string - b.string || a.fret - b.fret);
        expect(got).toEqual(sorted);
      })
    );
  });
});

describe('unisonsOf', () => {
  it('finds the other positions with the same pitch, string then fret ascending', () => {
    expect(unisonsOf(STANDARD_GUITAR, { string: 3, fret: 2 })).toEqual([
      { string: 4, fret: 7 },
      { string: 5, fret: 12 },
      { string: 6, fret: 17 }
    ]);
  });

  it('returns [] for the lowest open string (E2)', () => {
    expect(unisonsOf(STANDARD_GUITAR, { string: 6, fret: 0 })).toEqual([]);
  });

  it('excludes the position itself', () => {
    const p = { string: 4, fret: 7 };
    expect(unisonsOf(STANDARD_GUITAR, p)).not.toContainEqual(p);
  });

  it('property: every unison has equal pitch, none is omitted', () => {
    const inst = fc.record({
      tuning: fc.array(
        fc.record({
          letter: fc.constantFrom('C', 'D', 'E', 'F', 'G', 'A', 'B' as const),
          accidental: fc.constant(0 as const),
          octave: fc.integer({ min: 0, max: 5 })
        }),
        { minLength: 1, maxLength: 9 }
      ),
      fretCount: fc.integer({ min: 0, max: 30 }),
      s: fc.nat(),
      f: fc.nat()
    });
    fc.assert(
      fc.property(inst, ({ tuning, fretCount, s, f }) => {
        const instrument: Instrument = {
          ...STANDARD_GUITAR,
          stringCount: tuning.length,
          fretCount,
          openStrings: tuning
        };
        const p = { string: (s % tuning.length) + 1, fret: f % (fretCount + 1) };
        const pitch = positionPitch(instrument, p);
        const got = unisonsOf(instrument, p);
        let expected = 0;
        for (let string = 1; string <= tuning.length; string++)
          for (let fret = 0; fret <= fretCount; fret++)
            if (positionPitch(instrument, { string, fret }) === pitch) expected++;
        expect(got).toHaveLength(expected - 1);
        for (const u of got) expect(positionPitch(instrument, u)).toBe(pitch);
        expect(got).toEqual([...got].sort((a, b) => a.string - b.string || a.fret - b.fret));
      })
    );
  });
});

function byStringThenFret(a: string, b: string): number {
  const [as, af] = a.slice(1).split('f').map(Number);
  const [bs, bf] = b.slice(1).split('f').map(Number);
  return as - bs || af - bf;
}
