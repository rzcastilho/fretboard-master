import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cagedOccurrences } from '../../../src/lib/theory/caged';
import { degreeOf, inLayer, layerNotes } from '../../../src/lib/theory/caged-layers';
import { pitchClass, type Pitch } from '../../../src/lib/theory/pitch';

const STEPS = [5, 5, 5, 4, 5] as const;

const arbSix = fc
  .tuple(
    fc.integer({ min: 28, max: 52 }),
    fc.constantFrom(0, 0, -2, -1, 1, 2) // 0 = compatible; else string 6 off its standard step
  )
  .map(([base, delta]) => {
    const six: Pitch[] = [base];
    for (const s of STEPS) six.push(six[six.length - 1] + s);
    six[0] += delta;
    return six;
  });

const arbCase = fc
  .record({
    six: arbSix,
    seven: fc.option(fc.integer({ min: 20, max: 40 }), { nil: null }),
    rootPc: fc.integer({ min: 0, max: 11 }),
    quality: fc.constantFrom<'major' | 'minor'>('major', 'minor'),
    frets: fc.constantFrom(12, 22, 24)
  })
  .map((c) => ({
    ...c,
    // string 1 first
    open: [...(c.seven === null ? c.six : [c.seven, ...c.six])].reverse()
  }));

describe('layerNotes invariants', () => {
  it('pitch class, fret range, region bounds', () => {
    fc.assert(
      fc.property(arbCase, ({ six, open, rootPc, quality, frets }) => {
        for (const occ of cagedOccurrences(six, rootPc, quality, frets)) {
          expect(occ.region.start).toBeLessThanOrEqual(occ.start);
          expect(occ.end).toBeLessThanOrEqual(occ.region.end);
          for (const n of layerNotes(occ, open, rootPc, quality, frets)) {
            expect(n.fret).toBeGreaterThanOrEqual(0);
            expect(n.fret).toBeLessThanOrEqual(frets);
            expect(n.fret).toBeGreaterThanOrEqual(occ.region.start);
            expect(n.fret).toBeLessThanOrEqual(occ.region.end);
            expect(n.pitch).toBe(open[n.string - 1] + n.fret);
            expect(degreeOf(pitchClass(n.pitch), rootPc, quality)).toBe(n.degree);
          }
        }
      })
    );
  });

  it('Arpeggio ⊂ Pentatonic ⊂ Scale', () => {
    fc.assert(
      fc.property(arbCase, ({ six, open, rootPc, quality, frets }) => {
        for (const occ of cagedOccurrences(six, rootPc, quality, frets)) {
          const notes = layerNotes(occ, open, rootPc, quality, frets);
          const keys = (l: 'arpeggio' | 'pentatonic' | 'scale') =>
            new Set(
              notes.filter((n) => inLayer(n.degree, l, quality)).map((n) => `${n.string}:${n.fret}`)
            );
          const a = keys('arpeggio');
          const p = keys('pentatonic');
          const s = keys('scale');
          for (const k of a) expect(p.has(k)).toBe(true);
          for (const k of p) expect(s.has(k)).toBe(true);
          expect(s.size).toBe(notes.length);
        }
      })
    );
  });
});
