import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { layoutTags, type TagBox } from '../../../src/lib/fretboard/tags';

const GAP = 4;

function overlaps(a: { x: number; w: number }, b: { x: number; w: number }, gap: number): boolean {
  return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap;
}

describe('layoutTags', () => {
  it('returns nothing for no items and one row-0 tag for one item', () => {
    expect(layoutTags([], 500, GAP)).toEqual([]);
    expect(layoutTags([{ center: 200, width: 60 }], 500, GAP)).toEqual([{ x: 170, row: 0 }]);
  });

  it('keeps separated tags on row 0 in input order', () => {
    const placed = layoutTags(
      [
        { center: 50, width: 60 },
        { center: 200, width: 60 },
        { center: 350, width: 60 }
      ],
      500,
      GAP
    );
    expect(placed.map((p) => p.row)).toEqual([0, 0, 0]);
    expect(placed.map((p) => p.x)).toEqual([20, 170, 320]);
  });

  it('moves a later overlapping tag to the next row', () => {
    const placed = layoutTags(
      [
        { center: 100, width: 80 },
        { center: 130, width: 80 }
      ],
      500,
      GAP
    );
    expect(placed[0].row).toBe(0);
    expect(placed[1].row).toBe(1);
  });

  it('treats the gap as part of the overlap (touching within gap moves down)', () => {
    // first ends at 100; second starts at 102 (< 100 + gap 4)
    const placed = layoutTags(
      [
        { center: 60, width: 80 },
        { center: 142, width: 80 }
      ],
      500,
      GAP
    );
    expect(placed[1].row).toBe(1);
    const exact = layoutTags(
      [
        { center: 60, width: 80 },
        { center: 144, width: 80 }
      ],
      500,
      GAP
    );
    expect(exact[1].row).toBe(0);
  });

  it('clamps at both edges', () => {
    const placed = layoutTags(
      [
        { center: 5, width: 60 },
        { center: 495, width: 60 }
      ],
      500,
      GAP
    );
    expect(placed[0].x).toBe(0);
    expect(placed[1].x).toBe(440);
  });

  it('chooses the lowest row where the tag fits', () => {
    const placed = layoutTags(
      [
        { center: 100, width: 80 },
        { center: 110, width: 80 },
        { center: 400, width: 80 }
      ],
      500,
      GAP
    );
    expect(placed.map((p) => p.row)).toEqual([0, 1, 0]);
  });

  it('holds the invariants for random centres and widths', () => {
    const box = fc.record({
      center: fc.integer({ min: -50, max: 1200 }),
      width: fc.integer({ min: 20, max: 120 })
    });
    fc.assert(
      fc.property(
        fc.array(box, { maxLength: 12 }),
        fc.integer({ min: 300, max: 1000 }),
        (items: TagBox[], board) => {
          const placed = layoutTags(items, board, GAP);
          expect(placed).toHaveLength(items.length);
          placed.forEach((p, i) => {
            expect(p.x).toBeGreaterThanOrEqual(0);
            expect(p.x + items[i].width).toBeLessThanOrEqual(board);
          });
          for (let i = 0; i < placed.length; i++)
            for (let j = i + 1; j < placed.length; j++)
              if (placed[i].row === placed[j].row)
                expect(
                  overlaps(
                    { x: placed[i].x, w: items[i].width },
                    { x: placed[j].x, w: items[j].width },
                    GAP
                  )
                ).toBe(false);
        }
      )
    );
  });
});
