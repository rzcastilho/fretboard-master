/** Pure tag-strip layout (data-model §5). No DOM, no Svelte. */
export interface TagBox {
  /** Horizontal centre the tag wants (layout coordinates). */
  readonly center: number;
  readonly width: number;
}

export interface PlacedTag {
  readonly x: number;
  readonly row: number;
}

/**
 * Places each tag, in input order, at its centre clamped to `[0, boardWidth - width]`, on the
 * lowest row where it does not come within `gap` of an already placed tag.
 */
export function layoutTags(
  items: readonly TagBox[],
  boardWidth: number,
  gap: number
): readonly PlacedTag[] {
  const rows: { x: number; end: number }[][] = [];
  return items.map((item) => {
    const max = Math.max(0, boardWidth - item.width);
    const x = Math.min(Math.max(item.center - item.width / 2, 0), max);
    const end = x + item.width;
    let row = 0;
    while (rows[row]?.some((t) => x < t.end + gap && t.x < end + gap)) row++;
    (rows[row] ??= []).push({ x, end });
    return { x, row };
  });
}
