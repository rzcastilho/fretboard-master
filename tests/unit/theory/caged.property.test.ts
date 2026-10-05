import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CAGED_CYCLE,
  CAGED_SHAPES,
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

describe('P6: placement from string 5 matches slice-014 for compatible tunings', () => {
  it('start of each shape equals the string-6-based shift expectation', () => {
    // Slice-014 expected starts come from the table: min table fret + shift, folded by octave.
    const MIN_FRET = { C: 0, A: 3, G: 5, E: 8, D: 10 } as const;
    fc.assert(
      fc.property(arbCase, ({ open, rootPc, quality, frets }) => {
        const shift = (((rootPc - (pitchClass(open[0]) - 4)) % 12) + 12) % 12;
        for (const occ of cagedOccurrences(open, rootPc, quality, frets)) {
          const base = MIN_FRET[occ.shape.id] + shift;
          expect((((occ.start - base) % 12) + 12) % 12).toBe(0);
          expect(occ.alteredString).toBe(false);
        }
      })
    );
  });
});

describe('altered lowest string (P1–P5)', () => {
  const arbDelta = fc.integer({ min: -11, max: 11 }).filter((d) => d !== 0);
  const arbAltered = fc.record({
    base: arbCompatible,
    delta: arbDelta,
    rootPc: fc.integer({ min: 0, max: 11 }),
    quality: fc.constantFrom<'major' | 'minor'>('major', 'minor'),
    frets: fc.integer({ min: 12, max: 24 })
  });
  const alter = (base: readonly number[], delta: number) => [base[0] + delta, ...base.slice(1)];
  const upper = <T extends { string: number }>(notes: readonly T[]) =>
    notes.filter((n) => n.string !== 6);

  it('P1: strings 5→1 equal the compatible base', () => {
    fc.assert(
      fc.property(arbAltered, ({ base, delta, rootPc, quality, frets }) => {
        const alt = cagedOccurrences(alter(base, delta), rootPc, quality, frets);
        const std = cagedOccurrences(base, rootPc, quality, frets);
        for (const b of std) {
          const a = alt.find((o) => o.shape.id === b.shape.id && o.start === b.start);
          expect(a).toBeDefined();
          expect(upper(a?.notes ?? [])).toEqual(upper(b.notes));
        }
        for (const a of alt)
          if (!['G', 'E'].includes(a.shape.id)) {
            const b = std.find((o) => o.shape.id === a.shape.id && o.start === a.start);
            expect(b).toBeDefined();
          }
      })
    );
  });

  it('P2: string-6 notes are real chord tones of their degree inside start…end', () => {
    fc.assert(
      fc.property(arbAltered, ({ base, delta, rootPc, quality, frets }) => {
        const open = alter(base, delta);
        for (const occ of cagedOccurrences(open, rootPc, quality, frets))
          for (const n of occ.notes.filter((x) => x.string === 6)) {
            expect(pitchClass(open[0] + n.fret)).toBe((rootPc + OFFSET[n.degree]) % 12);
            expect(n.degree).not.toBe(quality === 'minor' ? '3' : 'b3');
            expect(n.fret).toBeGreaterThanOrEqual(occ.start);
            expect(n.fret).toBeLessThanOrEqual(occ.end);
          }
      })
    );
  });

  it('P3: string-6 notes appear only in G and E shapes', () => {
    fc.assert(
      fc.property(arbAltered, ({ base, delta, rootPc, quality, frets }) => {
        for (const occ of cagedOccurrences(alter(base, delta), rootPc, quality, frets))
          if (occ.notes.some((n) => n.string === 6)) expect(['G', 'E']).toContain(occ.shape.id);
      })
    );
  });

  it('P4: no string-6 note has the table degree at the table fret', () => {
    fc.assert(
      fc.property(arbAltered, ({ base, delta, rootPc, quality, frets }) => {
        const shift = (((rootPc - (pitchClass(base[1]) - 9)) % 12) + 12) % 12;
        for (const occ of cagedOccurrences(alter(base, delta), rootPc, quality, frets)) {
          const cell = CAGED_SHAPES[quality].find((x) => x.id === occ.shape.id)?.strings[0];
          if (!cell) continue;
          for (const n of occ.notes.filter((x) => x.string === 6))
            expect(
              n.degree === cell.degree &&
                [-12, 0, 12, 24].some((o) => n.fret === cell.fret + shift + o)
            ).toBe(false);
        }
      })
    );
  });

  it('P5: strings 5→1 stay in 0…fretCount and fit ignores string 6', () => {
    fc.assert(
      fc.property(arbAltered, arbDelta, ({ base, delta, rootPc, quality, frets }, other) => {
        const a = cagedOccurrences(alter(base, delta), rootPc, quality, frets);
        const b = cagedOccurrences(alter(base, other), rootPc, quality, frets);
        const key = (o: (typeof a)[number]) => `${o.shape.id}@${o.start}-${o.end}`;
        expect(a.map(key)).toEqual(b.map(key));
        for (const occ of a)
          for (const n of upper(occ.notes)) {
            expect(n.fret).toBeGreaterThanOrEqual(0);
            expect(n.fret).toBeLessThanOrEqual(frets);
          }
      })
    );
  });
});
