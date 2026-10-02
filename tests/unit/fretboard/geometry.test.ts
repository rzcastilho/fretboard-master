import { describe, expect, it } from 'vitest';
import {
  DEFAULT_METRICS,
  DOUBLE_INLAY_FRETS,
  INLAY_FRETS,
  layoutFretboard,
  nearestPosition,
  screenOrder,
  visibleColumnCount
} from '../../../src/lib/fretboard/geometry';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';

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

  it('screenOrder is identity', () => {
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

  it('covers frets 0–12 with no label column and no numbers row', () => {
    expect(l.columns).toHaveLength(13);
    expect(l.columns[0].start).toBe(0);
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
