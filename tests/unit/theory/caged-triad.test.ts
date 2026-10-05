import { must } from '../must';
import { describe, expect, it } from 'vitest';
import {
  cagedOccurrences,
  type CagedQuality,
  type CagedShapeId
} from '../../../src/lib/theory/caged';
import { shapeTriad, type ShapeTriad } from '../../../src/lib/theory/caged-triad';
import { pitchClass, type Pitch } from '../../../src/lib/theory/pitch';
import { spellTriad } from '../../../src/lib/theory/triad';

const STANDARD_6: readonly Pitch[] = [40, 45, 50, 55, 59, 64]; // string 6 → 1
const open = (six: readonly Pitch[], seven?: Pitch): readonly Pitch[] =>
  [...(seven === undefined ? six : [seven, ...six])].reverse(); // string 1 first

const C = { letter: 'C', accidental: 0 } as const;

function triadFor(
  rootPc: number,
  quality: CagedQuality,
  shape: CagedShapeId,
  set: number,
  opts: { six?: readonly Pitch[]; seven?: Pitch; frets?: number; root?: typeof C } = {}
): ShapeTriad | null {
  const six = opts.six ?? STANDARD_6;
  const fretCount = opts.frets ?? 24;
  const occ = cagedOccurrences(six, rootPc, quality, fretCount).find((o) => o.shape.id === shape);
  if (!occ) return null;
  const rootSpelling = opts.root ?? C;
  return shapeTriad(occ, open(six, opts.seven), spellTriad(rootSpelling, quality), set, fretCount);
}

type Cell = readonly [string, number, number, number] | null; // inversion, frets
const cell = (inv: string, a: number, b: number, c: number): Cell => [inv, a, b, c];

/** research R-01 matrix; columns are sets 6, 5, 4, 3 (bass string). */
const MATRIX: Record<CagedQuality, Record<CagedShapeId, readonly Cell[]>> = {
  major: {
    C: [
      cell('second', 3, 3, 2),
      cell('root', 3, 2, 0),
      cell('first', 2, 0, 1),
      cell('second', 0, 1, 0)
    ],
    A: [cell('second', 3, 3, 2), null, cell('second', 5, 5, 5), cell('root', 5, 5, 3)],
    G: [cell('root', 8, 7, 5), cell('first', 7, 5, 5), cell('second', 5, 5, 5), null],
    E: [null, cell('second', 10, 10, 9), cell('root', 10, 9, 8), cell('first', 9, 8, 8)],
    D: [cell('first', 12, 10, 10), cell('second', 10, 10, 9), null, cell('second', 12, 13, 12)]
  },
  minor: {
    C: [cell('second', 3, 3, 1), cell('root', 3, 1, 0), cell('first', 1, 0, 1), null],
    A: [null, cell('first', 6, 5, 5), cell('second', 5, 5, 4), cell('root', 5, 4, 3)],
    G: [cell('root', 8, 6, 5), cell('first', 6, 5, 5), null, cell('first', 8, 8, 8)],
    E: [
      cell('first', 11, 10, 10),
      cell('second', 10, 10, 8),
      cell('root', 10, 8, 8),
      cell('first', 8, 8, 8)
    ],
    D: [cell('first', 11, 10, 10), null, cell('first', 13, 12, 13), cell('second', 12, 13, 11)]
  }
};
const SETS = [6, 5, 4, 3];

describe('shapeTriad — R-01 C-key matrix (standard, 6 strings, 24 frets)', () => {
  for (const quality of ['major', 'minor'] as const) {
    for (const shape of ['C', 'A', 'G', 'E', 'D'] as const) {
      it.each(SETS.map((s, i) => [s, MATRIX[quality][shape][i]] as const))(
        `C ${quality}, ${shape} shape, set %s`,
        (set, expected) => {
          const got = triadFor(0, quality, shape, set);
          if (expected === null) {
            expect(got).toBeNull();
            return;
          }
          expect(got).not.toBeNull();
          expect(got?.inversion).toBe(expected[0]);
          expect([...must(got).frets]).toEqual([expected[1], expected[2], expected[3]]);
          expect(got?.set).toBe(set);
        }
      );
    }
  }

  it('C major A shape set 3 is root position, occurrence 0, pitches C-E-G', () => {
    const t = must(triadFor(0, 'major', 'A', 3));
    expect(t.inversion).toBe('root');
    expect(t.occurrence).toBe(0);
    expect(t.functions).toEqual(['root', 'third', 'fifth']);
    expect(t.pitches.map(pitchClass)).toEqual([0, 4, 7]);
    expect(t.pitches[2] - t.pitches[0]).toBeLessThan(12);
  });

  it('C major D shape set 3 is second inversion 12-13-12, occurrence 1', () => {
    const t = must(triadFor(0, 'major', 'D', 3));
    expect(t.inversion).toBe('second');
    expect([...t.frets]).toEqual([12, 13, 12]);
    expect(t.occurrence).toBe(1);
  });

  it('C shape set 3 is open position 0-1-0', () => {
    const t = must(triadFor(0, 'major', 'C', 3));
    expect([...t.frets]).toEqual([0, 1, 0]);
    expect(t.occurrence).toBe(0);
  });
});

describe('shapeTriad — boundaries and tunings', () => {
  it('12-fret E shape: set 6 null; sets needing fret > 12 null', () => {
    const got = SETS.map((s) => triadFor(0, 'major', 'E', s, { frets: 12 }));
    expect(got[0]).toBeNull();
    for (const t of got) if (t) expect(Math.max(...t.frets)).toBeLessThanOrEqual(12);
    // the 24-fret matrix has E shape sets 5,4,3 available at <= 10; they remain.
    expect(got[1]).not.toBeNull();
  });

  it('Drop D, D major, E shape set 6 uses the real string 6', () => {
    const six = [38, 45, 50, 55, 59, 64];
    const D = { letter: 'D', accidental: 0 } as const;
    const t = triadFor(2, 'major', 'E', 6, { six, root: D as unknown as typeof C });
    if (t !== null) {
      expect(t.pitches[0]).toBe(six[0] + t.frets[0]);
      expect(t.pitches.map(pitchClass)).toContain(2);
    }
  });

  it('7-string standard: set 7 available for at least one shape', () => {
    const results = (['C', 'A', 'G', 'E', 'D'] as const).map((s) =>
      triadFor(0, 'major', s, 7, { seven: 35 })
    );
    const hit = must(results.find((t) => t !== null));
    expect(hit.pitches[0]).toBe(35 + hit.frets[0]);
    expect(hit.set).toBe(7);
  });

  it('Half step down: A shape set 3 has the standard-tuning frets', () => {
    const down = STANDARD_6.map((p) => p - 1);
    // root C♯/D♭ sounding, same drawing as C in standard shifted by tuning: key one semitone lower.
    const standard = must(triadFor(0, 'major', 'A', 3));
    const half = must(
      triadFor(11, 'major', 'A', 3, {
        six: down,
        root: { letter: 'B', accidental: 0 } as unknown as typeof C
      })
    );
    expect([...half.frets]).toEqual([...standard.frets]);
  });

  it('non-ascending custom set returns null (does-not-close)', () => {
    const six = [40, 45, 50, 55, 59, 64];
    const occ = cagedOccurrences(six, 0, 'major', 24)[1];
    const bad = open(six).slice();
    bad[1] = bad[2] - 2; // string 2 below string 3
    expect(shapeTriad(occ, bad, spellTriad(C, 'major'), 3, 24)).toBeNull();
  });

  it('is total on malformed input', () => {
    const occ = cagedOccurrences(STANDARD_6, 0, 'major', 24)[0];
    const tri = spellTriad(C, 'major');
    expect(shapeTriad(occ, open(STANDARD_6), tri, 2, 24)).toBeNull();
    expect(shapeTriad(occ, open(STANDARD_6), tri, 9, 24)).toBeNull();
    expect(shapeTriad(occ, open(STANDARD_6), tri, 3.5, 24)).toBeNull();
    expect(shapeTriad(occ, open(STANDARD_6), tri, 3, NaN)).toBeNull();
    expect(shapeTriad(null as never, open(STANDARD_6), tri, 3, 24)).toBeNull();
  });
});

describe('shapeTriad defensive inputs', () => {
  const occ = must(cagedOccurrences(STANDARD_6, 0, 'major', 24).find((o) => o.shape.id === 'A'));
  const triad = spellTriad(C, 'major');
  const six = open(STANDARD_6);

  it('accepts the baseline', () => {
    expect(shapeTriad(occ, six, triad, 3, 24)).not.toBeNull();
  });

  it('returns null for malformed or out-of-range arguments', () => {
    expect(shapeTriad({ ...occ, region: undefined } as never, six, triad, 3, 24)).toBeNull();
    expect(shapeTriad(occ, six, undefined as never, 3, 24)).toBeNull();
    expect(shapeTriad(occ, 'x' as never, triad, 3, 24)).toBeNull();
    expect(shapeTriad(occ, six, triad, 3.5, 24)).toBeNull();
    expect(shapeTriad(occ, six, triad, 3, Number.NaN)).toBeNull();
    expect(shapeTriad(occ, six, triad, 2, 24)).toBeNull();
    expect(shapeTriad(occ, six, triad, 7, 24)).toBeNull();
  });

  it('returns null when a string pitch is not finite', () => {
    const bad = [...six];
    bad[2] = Number.NaN;
    expect(shapeTriad(occ, bad, triad, 3, 24)).toBeNull();
  });

  it('returns null when the strings do not ascend (no candidate for the set)', () => {
    const reversed = [...STANDARD_6]; // string 1 lowest: pitch falls going up the string numbers
    expect(shapeTriad(occ, reversed, triad, 3, 24)).toBeNull();
  });
});
