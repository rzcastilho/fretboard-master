import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_METRICS,
  DOUBLE_INLAY_FRETS,
  INLAY_FRETS,
  layoutFretboard,
  nearestPosition,
  rowOf,
  trailingEdgeScroll,
  screenOrder,
  visibleColumnCount
} from '../../../src/lib/fretboard/geometry';
import {
  positionPitch,
  STANDARD_GUITAR,
  withPresentation
} from '../../../src/lib/instrument/instrument';
import { presetInstrument } from '../../../src/lib/instrument/tunings';

describe('layoutFretboard (interactive)', () => {
  const layout = layoutFretboard(STANDARD_GUITAR, DEFAULT_METRICS, 0, 'interactive');

  it('has an open column plus 22 frets and 6 rows', () => {
    expect(layout.columns).toHaveLength(23);
    expect(layout.rows).toHaveLength(6);
    expect(layout.columns.map((c) => c.fret)).toEqual(Array.from({ length: 23 }, (_, i) => i));
    expect(layout.rows.map((r) => r.string)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('keeps every column ≥ open-column width and every row ≥ 44 px', () => {
    for (const c of layout.columns) {
      expect(c.end - c.start).toBeGreaterThanOrEqual(DEFAULT_METRICS.openCol);
    }
    expect(DEFAULT_METRICS.openCol).toBe(44);
    for (const r of layout.rows) expect(r.bottom - r.top).toBeGreaterThanOrEqual(44);
  });

  it('has contiguous, strictly increasing columns starting after the label column', () => {
    expect(layout.columns[0].start).toBe(DEFAULT_METRICS.labelCol);
    for (let i = 1; i < layout.columns.length; i++) {
      expect(layout.columns[i].start).toBe(layout.columns[i - 1].end);
      expect(layout.columns[i].start).toBeGreaterThan(layout.columns[i - 1].start);
    }
    for (const c of layout.columns) expect(c.center).toBe((c.start + c.end) / 2);
  });

  it('narrows fret widths linearly from 52 (fret 1) to 44 (fret 22)', () => {
    const w = (f: number) => layout.columns[f].end - layout.columns[f].start;
    expect(w(1)).toBe(52);
    expect(w(22)).toBe(44);
    for (let f = 2; f <= 22; f++) expect(w(f)).toBeLessThanOrEqual(w(f - 1));
    expect(w(1)).toBeGreaterThan(w(22));
    expect(w(0)).toBe(44);
  });

  it('places rows top to bottom, string 1 on top, and the nut after the open column', () => {
    expect(layout.rows[0].top).toBe(0);
    for (let i = 1; i < 6; i++) expect(layout.rows[i].top).toBe(layout.rows[i - 1].bottom);
    expect(layout.boardTop).toBe(0);
    expect(layout.boardBottom).toBe(layout.rows[5].bottom);
    expect(layout.height).toBe(layout.boardBottom + DEFAULT_METRICS.numbersRow);
    expect(layout.nutX).toBe(layout.columns[0].end);
    expect(layout.scale).toBe(1);
    expect(layout.scrolls).toBe(true);
    expect(layout.width).toBe(layout.columns[22].end);
  });

  it('screenOrder lists strings 1..n for right-handed highest-top', () => {
    expect(screenOrder(STANDARD_GUITAR)).toEqual({ rows: [1, 2, 3, 4, 5, 6], reversed: false });
  });
});

describe('fill and scroll', () => {
  const natural = layoutFretboard(STANDARD_GUITAR, DEFAULT_METRICS, 0, 'interactive');

  it('scrolls and does not scale when the container is narrower', () => {
    const l = layoutFretboard(STANDARD_GUITAR, DEFAULT_METRICS, 320, 'interactive');
    expect(l.scale).toBe(1);
    expect(l.scrolls).toBe(true);
    expect(l.width).toBe(natural.width);
  });

  it('scales column widths up to fill a wider container, without scrolling', () => {
    const container = natural.width * 2;
    const l = layoutFretboard(STANDARD_GUITAR, DEFAULT_METRICS, container, 'interactive');
    expect(l.scale).toBeGreaterThan(1);
    expect(l.scrolls).toBe(false);
    expect(l.width).toBeCloseTo(container, 5);
    expect(l.columns[0].start).toBe(DEFAULT_METRICS.labelCol);
    expect(l.columns[1].end - l.columns[1].start).toBeCloseTo(52 * l.scale, 5);
    expect(l.rows[0].bottom - l.rows[0].top).toBe(44);
  });
});

describe('inlays', () => {
  it('matches the single and double inlay frets', () => {
    expect(INLAY_FRETS).toEqual([3, 5, 7, 9, 15, 17, 19, 21]);
    expect(DOUBLE_INLAY_FRETS).toEqual([12, 24]);
  });
});

describe('thumbnail layout', () => {
  const l = layoutFretboard(STANDARD_GUITAR, DEFAULT_METRICS, 500, 'thumbnail');

  it('covers frets 0–12 with a label column and no numbers row', () => {
    expect(l.columns).toHaveLength(13);
    expect(l.columns[0].start).toBe(DEFAULT_METRICS.labelCol);
    expect(l.height).toBe(l.boardBottom);
    expect(l.rows).toHaveLength(6);
    expect(l.scale).toBe(1);
    expect(l.scrolls).toBe(false);
    expect(l.columns[0].end - l.columns[0].start).toBe(DEFAULT_METRICS.thumbOpenCol);
    expect(l.columns[1].end - l.columns[1].start).toBe(DEFAULT_METRICS.thumbFret);
    expect(l.rows[0].bottom - l.rows[0].top).toBe(DEFAULT_METRICS.thumbRow);
  });
});

describe('nearestPosition', () => {
  const layout = layoutFretboard(STANDARD_GUITAR, DEFAULT_METRICS, 0, 'interactive');

  it('returns the position for every cell center', () => {
    for (const r of layout.rows) {
      for (const c of layout.columns) {
        expect(nearestPosition(layout, c.center, r.center)).toEqual({
          string: r.string,
          fret: c.fret
        });
      }
    }
  });

  it('picks the closest center by Euclidean distance', () => {
    const c3 = layout.columns[3];
    const c4 = layout.columns[4];
    const x = c3.center + (c4.center - c3.center) * 0.6;
    expect(nearestPosition(layout, x, layout.rows[2].center + 5)).toEqual({ string: 3, fret: 4 });
  });

  it('breaks exact ties by lower fret, then lower string', () => {
    const a = layout.columns[5];
    const b = layout.columns[6];
    const r1 = layout.rows[0];
    const r2 = layout.rows[1];
    expect(nearestPosition(layout, (a.center + b.center) / 2, r1.center).fret).toBe(5);
    expect(nearestPosition(layout, a.center, (r1.center + r2.center) / 2).string).toBe(1);
    expect(nearestPosition(layout, (a.center + b.center) / 2, (r1.center + r2.center) / 2)).toEqual(
      { string: 1, fret: 5 }
    );
  });

  it('clamps points outside the grid', () => {
    expect(nearestPosition(layout, -50, layout.rows[2].center)).toEqual({ string: 3, fret: 0 });
    expect(nearestPosition(layout, layout.width + 500, layout.rows[2].center).fret).toBe(22);
    expect(nearestPosition(layout, layout.columns[7].center, -30)).toEqual({ string: 1, fret: 7 });
    expect(nearestPosition(layout, layout.columns[7].center, layout.height + 90)).toEqual({
      string: 6,
      fret: 7
    });
  });
});

describe('visibleColumnCount', () => {
  // Zone C inner width at a 320 px viewport (R-05): 320 − 2·16 − 2·1.
  const width = 286;
  const layout = layoutFretboard(STANDARD_GUITAR, DEFAULT_METRICS, width, 'interactive');
  const max = layout.width - width;

  it('scrolls at 320 px', () => {
    expect(layout.scrolls).toBe(true);
  });

  it.each([0, 0.25, 0.5, 0.75, 1])('is within 5–7 at %f of max scroll', (frac) => {
    const n = visibleColumnCount(layout, max * frac, width);
    expect(n).toBeGreaterThanOrEqual(5);
    expect(n).toBeLessThanOrEqual(7);
  });

  it('is about 5.2 at scroll 0 and about 6.4 at max (R-05)', () => {
    expect(visibleColumnCount(layout, 0, width)).toBeCloseTo(5.2, 1);
    expect(visibleColumnCount(layout, max, width)).toBeCloseTo(6.4, 1);
  });

  it('counts a whole board as 23 columns when it fits', () => {
    const wide = layoutFretboard(STANDARD_GUITAR, DEFAULT_METRICS, 2560, 'interactive');
    expect(visibleColumnCount(wide, 0, 2560)).toBeCloseTo(23, 5);
  });
});

describe('preview layout', () => {
  const wide = presetInstrument('AF-1', 6, 24);
  const l = layoutFretboard(wide, DEFAULT_METRICS, 500, 'preview');

  it('draws every pending fret (24 is not capped at the thumbnail 12)', () => {
    expect(l.columns).toHaveLength(25);
    expect(
      layoutFretboard(presetInstrument('AF-1', 6, 12), DEFAULT_METRICS, 500, 'preview').columns
    ).toHaveLength(13);
  });

  it('reserves a label column, has no numbers row, never scrolls or scales', () => {
    expect(l.columns[0].start).toBe(DEFAULT_METRICS.labelCol);
    expect(l.height).toBe(l.boardBottom);
    expect(l.rows).toHaveLength(6);
    expect(l.scale).toBe(1);
    expect(l.scrolls).toBe(false);
  });
});

describe('trailingEdgeScroll', () => {
  const layout = layoutFretboard(
    presetInstrument('AF-1', 6, 12),
    DEFAULT_METRICS,
    0,
    'interactive'
  );

  it('puts the last fret at the trailing edge', () => {
    const vw = 360;
    const s = trailingEdgeScroll(layout, vw);
    expect(s).toBeGreaterThan(0);
    expect(s + vw).toBeCloseTo(layout.columns[layout.columns.length - 1].end);
  });

  it('is never negative and is 0 when the content fits', () => {
    expect(trailingEdgeScroll(layout, layout.width + 100)).toBe(0);
    expect(trailingEdgeScroll(layout, layout.width)).toBe(0);
    expect(trailingEdgeScroll(layout, 10)).toBeGreaterThanOrEqual(0);
  });
});

describe('left-handed layout', () => {
  const left = withPresentation(STANDARD_GUITAR, 'left', 'highest-top');
  const right = STANDARD_GUITAR;
  const variants = ['interactive', 'thumbnail', 'preview'] as const;

  it('screenOrder reverses the frets only', () => {
    expect(screenOrder(left)).toEqual({ rows: [1, 2, 3, 4, 5, 6], reversed: true });
  });

  for (const variant of variants) {
    describe(variant, () => {
      const l = layoutFretboard(left, DEFAULT_METRICS, 0, variant);
      const r = layoutFretboard(right, DEFAULT_METRICS, 0, variant);

      it('orders outer-in: label column, open column, nut, fret 1…', () => {
        expect(l.mirrored).toBe(true);
        expect(r.mirrored).toBe(false);
        expect(l.columns[0].end).toBe(l.width - DEFAULT_METRICS.labelCol);
        for (let f = 1; f < l.columns.length; f++) {
          expect(l.columns[f].center).toBeLessThan(l.columns[f - 1].center);
          expect(l.columns[f].end).toBe(l.columns[f - 1].start);
        }
        for (const c of l.columns) expect(c.start).toBeLessThan(c.end);
        expect(l.columns[l.columns.length - 1].start).toBe(0);
      });

      it('is the right-handed layout with x ↦ width − x', () => {
        expect(l.width).toBe(r.width);
        r.columns.forEach((c, i) => {
          expect(l.columns[i].start).toBeCloseTo(r.width - c.end);
          expect(l.columns[i].end).toBeCloseTo(r.width - c.start);
          expect(l.columns[i].center).toBeCloseTo(r.width - c.center);
        });
        expect(l.rows).toEqual(r.rows);
      });

      it('exposes mirrored label, board, strings and nut extents', () => {
        expect(l.labelCenter).toBe(l.width - DEFAULT_METRICS.labelCol / 2);
        expect(l.board).toEqual({ start: 0, end: l.width - DEFAULT_METRICS.labelCol });
        expect(l.strings).toEqual({ from: 0, to: l.columns[0].center });
        expect(l.nutX).toBe(l.columns[0].start);
        expect(r.labelCenter).toBe(DEFAULT_METRICS.labelCol / 2);
        expect(r.board).toEqual({ start: DEFAULT_METRICS.labelCol, end: r.width });
        expect(r.strings).toEqual({ from: r.columns[0].center, to: r.width });
        expect(r.nutX).toBe(r.columns[0].end);
      });

      it('nearestPosition returns the cell for its own centre', () => {
        for (const row of l.rows) {
          for (const col of l.columns) {
            expect(nearestPosition(l, col.center, row.center)).toEqual({
              string: row.string,
              fret: col.fret
            });
          }
        }
      });
    });
  }

  it('breaks exact ties to the lower fret, then the lower string, whatever the row order', () => {
    const base = layoutFretboard(left, DEFAULT_METRICS, 0, 'interactive');
    // Hand-built exact numbers: fret 4 at x=10, fret 3 at x=30 (mirrored); string 2 above string 1.
    const layout = {
      ...base,
      columns: [
        { fret: 3, start: 20, end: 40, center: 30 },
        { fret: 4, start: 0, end: 20, center: 10 }
      ],
      rows: [
        { string: 2, top: 0, bottom: 20, center: 10 },
        { string: 1, top: 20, bottom: 40, center: 30 }
      ]
    };
    expect(nearestPosition(layout, 20, 20)).toEqual({ string: 1, fret: 3 });
  });
});

describe('lowest-top layout (US2)', () => {
  const combos = [
    ['right', 'highest-top'],
    ['right', 'lowest-top'],
    ['left', 'highest-top'],
    ['left', 'lowest-top']
  ] as const;
  const seven = presetInstrument('AF-21', 7, 24);

  it('screenOrder lists strings n..1 for lowest-top, whatever the handedness', () => {
    for (const h of ['right', 'left'] as const) {
      expect(screenOrder(withPresentation(STANDARD_GUITAR, h, 'lowest-top')).rows).toEqual([
        6, 5, 4, 3, 2, 1
      ]);
      expect(screenOrder(withPresentation(seven, h, 'lowest-top')).rows).toEqual([
        7, 6, 5, 4, 3, 2, 1
      ]);
    }
  });

  it('rowOf finds each string and the row order equals screenOrder.rows', () => {
    for (const base of [STANDARD_GUITAR, seven]) {
      for (const [h, o] of combos) {
        const inst = withPresentation(base, h, o);
        const l = layoutFretboard(inst, DEFAULT_METRICS, 0, 'interactive');
        for (let s = 1; s <= inst.stringCount; s++) expect(rowOf(l, s).string).toBe(s);
        expect(l.rows.map((r) => r.string)).toEqual(screenOrder(inst).rows);
      }
    }
  });

  it('numbersEdge is bottom for highest-top, top for lowest-top, regardless of handedness', () => {
    for (const [h, o] of combos) {
      const l = layoutFretboard(
        withPresentation(STANDARD_GUITAR, h, o),
        DEFAULT_METRICS,
        0,
        'interactive'
      );
      expect(l.numbersEdge).toBe(o === 'highest-top' ? 'bottom' : 'top');
    }
  });

  it('offsets the board by numbersRow when the numbers are above', () => {
    const hi = layoutFretboard(STANDARD_GUITAR, DEFAULT_METRICS, 0, 'interactive');
    const lo = layoutFretboard(
      withPresentation(STANDARD_GUITAR, 'right', 'lowest-top'),
      DEFAULT_METRICS,
      0,
      'interactive'
    );
    expect(hi.boardTop).toBe(0);
    expect(hi.boardBottom).toBe(6 * DEFAULT_METRICS.row);
    expect(lo.boardTop).toBe(DEFAULT_METRICS.numbersRow);
    expect(lo.boardBottom).toBe(DEFAULT_METRICS.numbersRow + 6 * DEFAULT_METRICS.row);
    expect(lo.rows[0].top).toBe(lo.boardTop);
    expect(lo.rows[5].bottom).toBe(lo.boardBottom);
    expect(lo.height).toBe(hi.height);
  });

  it('lowest-top is highest-top with y mirrored inside the board, double inlays included', () => {
    for (const base of [STANDARD_GUITAR, seven]) {
      for (const h of ['right', 'left'] as const) {
        const hi = layoutFretboard(
          withPresentation(base, h, 'highest-top'),
          DEFAULT_METRICS,
          0,
          'interactive'
        );
        const lo = layoutFretboard(
          withPresentation(base, h, 'lowest-top'),
          DEFAULT_METRICS,
          0,
          'interactive'
        );
        // Board-relative terms: distance from the board's top edge flips.
        const rel = (l: typeof hi, y: number) => y - l.boardTop;
        const size = hi.boardBottom - hi.boardTop;
        expect(lo.boardBottom - lo.boardTop).toBe(size);
        for (const r of hi.rows) {
          const m = rowOf(lo, r.string);
          expect(rel(lo, m.center)).toBeCloseTo(size - rel(hi, r.center), 6);
          expect(rel(lo, m.top)).toBeCloseTo(size - rel(hi, r.bottom), 6);
        }
        expect(lo.doubleInlayY.map((y) => rel(lo, y)).sort((a, b) => a - b)).toEqual(
          hi.doubleInlayY.map((y) => size - rel(hi, y)).sort((a, b) => a - b)
        );
        expect(lo.columns).toEqual(hi.columns);
      }
    }
  });

  it('double inlays sit between strings 2/3 and 4/5 (highest-top) and mirror for lowest-top', () => {
    const hi = layoutFretboard(STANDARD_GUITAR, DEFAULT_METRICS, 0, 'interactive');
    expect(hi.doubleInlayY).toEqual([hi.rows[1].bottom, hi.rows[3].bottom]);
    const lo = layoutFretboard(
      withPresentation(STANDARD_GUITAR, 'right', 'lowest-top'),
      DEFAULT_METRICS,
      0,
      'interactive'
    );
    // 6 strings: symmetric, so lowest-top lands between rows 2/3 and 4/5 as well.
    expect(lo.doubleInlayY).toEqual([lo.rows[1].bottom, lo.rows[3].bottom]);
    // 7 strings: one row different.
    const l7 = layoutFretboard(
      withPresentation(seven, 'right', 'lowest-top'),
      DEFAULT_METRICS,
      0,
      'interactive'
    );
    expect(l7.doubleInlayY).toEqual([l7.rows[2].bottom, l7.rows[4].bottom]);
  });

  it('exposes the same (string, fret) set and pitches in all four combinations (SC-002)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(STANDARD_GUITAR, seven),
        fc.constantFrom(...combos),
        (base, [h, o]) => {
          const inst = withPresentation(base, h, o);
          const l = layoutFretboard(inst, DEFAULT_METRICS, 0, 'interactive');
          const cells = l.rows.flatMap((r) => l.columns.map((c) => `${r.string}:${c.fret}`)).sort();
          const ref = layoutFretboard(base, DEFAULT_METRICS, 0, 'interactive');
          const expected = ref.rows
            .flatMap((r) => ref.columns.map((c) => `${r.string}:${c.fret}`))
            .sort();
          expect(cells).toEqual(expected);
          for (let s = 1; s <= base.stringCount; s++)
            for (let f = 0; f <= base.fretCount; f++)
              expect(positionPitch(inst, { string: s, fret: f })).toBe(
                positionPitch(base, { string: s, fret: f })
              );
        }
      )
    );
  });

  it('hit-testing returns the right { string, fret } for every cell, all combinations', () => {
    for (const base of [STANDARD_GUITAR, seven]) {
      for (const [h, o] of combos) {
        const l = layoutFretboard(withPresentation(base, h, o), DEFAULT_METRICS, 0, 'interactive');
        for (const r of l.rows)
          for (const c of l.columns)
            expect(nearestPosition(l, c.center, r.center)).toEqual({
              string: r.string,
              fret: c.fret
            });
      }
    }
  });
});

describe('layout invariants table (US5)', () => {
  const combos = [
    ['right', 'highest-top'],
    ['right', 'lowest-top'],
    ['left', 'highest-top'],
    ['left', 'lowest-top']
  ] as const;
  const variants = ['interactive', 'thumbnail', 'preview'] as const;

  for (const strings of [6, 7] as const) {
    for (const frets of [12, 24]) {
      for (const [h, o] of combos) {
        for (const variant of variants) {
          const name = `${strings} strings × ${frets} frets, ${h}/${o}, ${variant}`;
          it(name, () => {
            const base =
              strings === 6
                ? presetInstrument('AF-1', 6, frets)
                : presetInstrument('AF-21', 7, frets);
            const inst = withPresentation(base, h, o);
            const l = layoutFretboard(inst, DEFAULT_METRICS, 0, variant);
            const ref = layoutFretboard(base, DEFAULT_METRICS, 0, variant);
            const mirrored = h === 'left';

            // 1. Outer edge inward: label → open column → nut → fret 1 → …
            expect(l.mirrored).toBe(mirrored);
            const last = l.columns[l.columns.length - 1];
            if (mirrored) {
              expect(l.columns[0].end).toBe(l.width - DEFAULT_METRICS.labelCol);
              expect(last.start).toBe(0);
              for (let f = 1; f < l.columns.length; f++)
                expect(l.columns[f].center).toBeLessThan(l.columns[f - 1].center);
            } else {
              expect(l.columns[0].start).toBe(DEFAULT_METRICS.labelCol);
              expect(last.end).toBe(l.width);
              for (let f = 1; f < l.columns.length; f++)
                expect(l.columns[f].center).toBeGreaterThan(l.columns[f - 1].center);
            }
            for (const c of l.columns) expect(c.start).toBeLessThan(c.end);

            // 2. rowOf and screenOrder agree; every string present once.
            expect(l.rows.map((r) => r.string)).toEqual([...screenOrder(inst).rows]);
            for (let s = 1; s <= strings; s++) expect(rowOf(l, s).string).toBe(s);

            // 3. Tags edge opposite the numbers edge (thumbnail/preview have no numbers row).
            expect(l.numbersEdge).toBe(o === 'lowest-top' ? 'top' : 'bottom');

            // 4. Same cells and pitches.
            const cells = l.rows.flatMap((r) => l.columns.map((c) => `${r.string}:${c.fret}`));
            const refCells = ref.rows.flatMap((r) =>
              ref.columns.map((c) => `${r.string}:${c.fret}`)
            );
            expect([...cells].sort()).toEqual([...refCells].sort());
            for (const r of l.rows)
              for (const c of l.columns)
                expect(positionPitch(inst, { string: r.string, fret: c.fret })).toBe(
                  positionPitch(base, { string: r.string, fret: c.fret })
                );

            // 5. Mirror relations against the right/highest-top layout.
            ref.columns.forEach((c, i) => {
              const m = mirrored ? ref.width - c.center : c.center;
              expect(l.columns[i].center).toBeCloseTo(m);
            });
            expect(l.width).toBe(ref.width);
            const yMirror = (y: number) => l.boardTop + l.boardBottom - y;
            ref.rows.forEach((r) => {
              const row = rowOf(l, r.string);
              const expected =
                o === 'lowest-top'
                  ? yMirror(r.center + (l.boardTop - ref.boardTop))
                  : r.center + (l.boardTop - ref.boardTop);
              expect(row.center).toBeCloseTo(expected);
            });

            // Hit-testing round trip.
            for (const r of l.rows)
              for (const c of l.columns)
                expect(nearestPosition(l, c.center, r.center)).toEqual({
                  string: r.string,
                  fret: c.fret
                });
          });
        }
      }
    }
  }
});

describe('layoutFretboard label column with string marks (slice 015)', () => {
  const plain = layoutFretboard(STANDARD_GUITAR, DEFAULT_METRICS, 0, 'interactive');
  const marked = layoutFretboard(STANDARD_GUITAR, DEFAULT_METRICS, 0, 'interactive', true);

  it('uses --fb-label-col-marked width only when marks exist', () => {
    expect(plain.columns[0].start).toBe(DEFAULT_METRICS.labelCol);
    expect(marked.columns[0].start).toBe(DEFAULT_METRICS.labelColMarked);
    expect(marked.labelCenter).toBe(DEFAULT_METRICS.labelColMarked / 2);
    expect(DEFAULT_METRICS.labelColMarked).toBeGreaterThan(DEFAULT_METRICS.labelCol);
  });

  it('mirrors the wider column for left-handed boards', () => {
    const left = withPresentation(STANDARD_GUITAR, 'left', 'highest-top');
    const l = layoutFretboard(left, DEFAULT_METRICS, 0, 'interactive', true);
    expect(l.labelCenter).toBe(l.width - DEFAULT_METRICS.labelColMarked / 2);
    expect(l.board).toEqual({ start: 0, end: l.width - DEFAULT_METRICS.labelColMarked });
  });
});
