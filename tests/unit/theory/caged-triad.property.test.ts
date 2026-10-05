import { must } from '../must';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cagedOccurrences } from '../../../src/lib/theory/caged';
import { inLayer, layerNotes } from '../../../src/lib/theory/caged-layers';
import { shapeTriad } from '../../../src/lib/theory/caged-triad';
import { pitchClass, pitchClassOfSpelling, type Pitch } from '../../../src/lib/theory/pitch';
import { rootSpellings, spellTriad } from '../../../src/lib/theory/triad';
import { INVERSIONS, occurrences, span, triadShape } from '../../../src/lib/theory/triad-shape';

const STEPS = [5, 5, 5, 4, 5] as const;

const arbCase = fc
  .record({
    base: fc.integer({ min: 36, max: 44 }),
    seven: fc.option(fc.integer({ min: 28, max: 38 }), { nil: null }),
    rootPc: fc.integer({ min: 0, max: 11 }),
    quality: fc.constantFrom<'major' | 'minor'>('major', 'minor'),
    frets: fc.constantFrom(12, 22, 24),
    transpose: fc.integer({ min: -2, max: 2 })
  })
  .map((c) => {
    const six: Pitch[] = [c.base + c.transpose];
    for (const s of STEPS) six.push(six[six.length - 1] + s);
    const open = [...(c.seven === null ? six : [c.seven, ...six])].reverse();
    return { ...c, six, open };
  });

const rootOf = (pc: number) => rootSpellings(pc)[0];

describe('shapeTriad invariants', () => {
  it('T-1..T-5 for every drawn occurrence and set', () => {
    fc.assert(
      fc.property(arbCase, ({ six, open, rootPc, quality, frets }) => {
        const triad = spellTriad(rootOf(rootPc), quality);
        for (const occ of cagedOccurrences(six, rootPc, quality, frets)) {
          const scale = layerNotes(occ, open, rootPc, quality, frets);
          const arp = new Set(
            scale
              .filter((n) => inLayer(n.degree, 'arpeggio', quality))
              .map((n) => `${n.string}:${n.fret}`)
          );
          const lo = Math.max(0, occ.region.start);
          const hi = Math.min(frets, occ.region.end);
          for (let set = open.length; set >= 3; set--) {
            const open3 = [open[set - 1], open[set - 2], open[set - 3]] as const;
            const t = shapeTriad(occ, open, triad, set, frets);

            // T-4 oracle: every close-position triad of the set inside the window.
            const cands: { frets: readonly [number, number, number]; k: number }[] = [];
            for (const inv of INVERSIONS) {
              const sh = triadShape(open3, triad, inv);
              if (sh.kind !== 'shape') continue;
              occurrences(sh.frets, frets).forEach((f, k) => {
                if (f.every((x) => x >= lo && x <= hi)) cands.push({ frets: f, k });
              });
            }
            if (cands.length === 0) {
              expect(t).toBeNull();
              continue;
            }
            expect(t).not.toBeNull(); // T-4
            const got = must(t);
            // T-1
            const keys = [set, set - 1, set - 2].map((s, i) => `${s}:${got.frets[i]}`);
            keys.forEach((k) => expect(arp.has(k)).toBe(true));
            // T-2
            expect([...got.functions].sort()).toEqual(['fifth', 'root', 'third']);
            expect(got.pitches[0]).toBeLessThan(got.pitches[1]);
            expect(got.pitches[1]).toBeLessThan(got.pitches[2]);
            expect(got.pitches[2] - got.pitches[0]).toBeLessThan(12);
            got.pitches.forEach((p, i) => {
              expect(p).toBe(open3[i] + got.frets[i]);
            });
            const pcs = new Set(got.pitches.map(pitchClass));
            expect(pcs).toEqual(new Set(triad.pitchClasses));
            expect(pcs.has(pitchClassOfSpelling(triad.root))).toBe(true);
            // T-3
            const sh = triadShape(open3, triad, got.inversion);
            expect(sh.kind).toBe('shape');
            if (sh.kind === 'shape') {
              expect([...got.frets]).toEqual([...occurrences(sh.frets, frets)[got.occurrence]]);
            }
            // T-5
            const best = [...cands].sort(
              (a, b) => span(a.frets as never) - span(b.frets as never) || a.frets[0] - b.frets[0]
            )[0];
            expect([...got.frets]).toEqual([...best.frets]);
          }
        }
      }),
      { numRuns: 60 }
    );
  });
});
