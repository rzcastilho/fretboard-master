/** Pure fretboard layout (data-model §5). No DOM, no Svelte. */
import type { Instrument, Position } from '../instrument/instrument';

export interface FretboardMetrics {
  row: number;
  labelCol: number;
  openCol: number;
  fretFirst: number;
  fretLast: number;
  numbersRow: number;
  nutWidth: number;
  thumbRow: number;
  thumbOpenCol: number;
  thumbFret: number;
  markerRoot: number;
  markerMedium: number;
  markerSmall: number;
  arrowHead: number;
}

/** Token values at a 16 px root. */
export const DEFAULT_METRICS: FretboardMetrics = Object.freeze({
  row: 44,
  labelCol: 24,
  openCol: 44,
  fretFirst: 52,
  fretLast: 44,
  numbersRow: 24,
  nutWidth: 6,
  thumbRow: 8,
  thumbOpenCol: 8,
  thumbFret: 12,
  markerRoot: 36,
  markerMedium: 30,
  markerSmall: 24,
  arrowHead: 8
});

export interface Column {
  fret: number;
  start: number;
  end: number;
  center: number;
}

export interface Row {
  string: number;
  top: number;
  bottom: number;
  center: number;
}

export interface FretboardLayout {
  width: number;
  height: number;
  scale: number;
  columns: readonly Column[];
  rows: readonly Row[];
  /** Nut centre (between the open column and fret 1). */
  nutX: number;
  /** True when handedness mirrors the board (nut on the right). */
  mirrored: boolean;
  /** x centre of the string-label column. */
  labelCenter: number;
  /** Wood extent, label column excluded. */
  board: { start: number; end: number };
  /** String-line extent: open-column centre to the far end. */
  strings: { from: number; to: number };
  /** Edge carrying the fret numbers; the shape-tag strip sits on the opposite edge. */
  numbersEdge: 'top' | 'bottom';
  /** Wood extent in y: `boardTop` is `numbersRow` when the numbers are above. */
  boardTop: number;
  boardBottom: number;
  /** y of the two double-inlay dots (frets 12/24), mirrored with the strings. */
  doubleInlayY: readonly number[];
  scrolls: boolean;
}

export type FretboardVariant = 'interactive' | 'thumbnail' | 'preview';

export const INLAY_FRETS: readonly number[] = [3, 5, 7, 9, 15, 17, 19, 21];
export const DOUBLE_INLAY_FRETS: readonly number[] = [12, 24];

/** Thumbnail shows the open column and frets 1–12. */
export const THUMBNAIL_FRETS = 12;

/**
 * The single place handedness/orientation is read. `rows` lists strings top → bottom;
 * `reversed` is true when the board is mirrored (nut on the right, frets increase leftward).
 */
export function screenOrder(instrument: Instrument): {
  rows: readonly number[];
  reversed: boolean;
} {
  const n = instrument.stringCount;
  const rows = Array.from({ length: n }, (_, i) =>
    instrument.orientation === 'lowest-top' ? n - i : i + 1
  );
  return {
    rows,
    reversed: instrument.handedness === 'left'
  };
}

function fretWidth(metrics: FretboardMetrics, fret: number, fretCount: number): number {
  const span = Math.max(1, fretCount - 1);
  const w = metrics.fretFirst - ((metrics.fretFirst - metrics.fretLast) * (fret - 1)) / span;
  return Math.max(metrics.fretLast, w);
}

export function layoutFretboard(
  instrument: Instrument,
  metrics: FretboardMetrics,
  containerWidth: number,
  variant: FretboardVariant
): FretboardLayout {
  const thumb = variant === 'thumbnail';
  // Preview: compact like the thumbnail, but every pending fret and a label column.
  const compact = thumb || variant === 'preview';
  const fretCount = thumb ? Math.min(THUMBNAIL_FRETS, instrument.fretCount) : instrument.fretCount;
  const labelCol = metrics.labelCol;
  const rowH = variant === 'preview' ? metrics.markerSmall : thumb ? metrics.thumbRow : metrics.row;
  const numbersRow = compact ? 0 : metrics.numbersRow;

  const widths: number[] = [compact ? metrics.thumbOpenCol : metrics.openCol];
  for (let f = 1; f <= fretCount; f++) {
    widths.push(compact ? metrics.thumbFret : fretWidth(metrics, f, instrument.fretCount));
  }
  const columnsNatural = widths.reduce((a, b) => a + b, 0);
  const naturalWidth = labelCol + columnsNatural;

  let scale = 1;
  if (!compact && containerWidth > naturalWidth) {
    scale = (containerWidth - labelCol) / columnsNatural;
  }

  let x = labelCol;
  const natural: Column[] = widths.map((w, fret) => {
    const start = x;
    x += w * scale;
    return { fret, start, end: x, center: (start + x) / 2 };
  });
  const width = x;
  const { rows: order, reversed: mirrored } = screenOrder(instrument);
  // Mirrored: x ↦ width − x, swapping start and end so `start < end` still holds.
  const columns: Column[] = mirrored
    ? natural.map((c) => ({
        fret: c.fret,
        start: width - c.end,
        end: width - c.start,
        center: width - c.center
      }))
    : natural;

  // Numbers above the board when the lowest string is on top; tags take the opposite edge.
  const numbersEdge = instrument.orientation === 'lowest-top' ? 'top' : 'bottom';
  const boardTop = numbersEdge === 'top' ? numbersRow : 0;
  const rows: Row[] = order.map((string, i) => ({
    string,
    top: boardTop + i * rowH,
    bottom: boardTop + (i + 1) * rowH,
    center: boardTop + i * rowH + rowH / 2
  }));
  const boardBottom = boardTop + rows.length * rowH;
  // Highest-top: between rows 2/3 and 4/5 from the top. Lowest-top mirrors y inside the board
  // (lower row bottom first, so the dots stay in ascending y).
  const doubleInlayY =
    numbersEdge === 'top'
      ? [rows[3].bottom, rows[1].bottom].map((y) => boardTop + boardBottom - y)
      : [rows[1].bottom, rows[3].bottom];

  return {
    width,
    height: rows.length * rowH + numbersRow,
    scale,
    columns,
    rows,
    nutX: mirrored ? columns[0].start : columns[0].end,
    mirrored,
    labelCenter: mirrored ? width - labelCol / 2 : labelCol / 2,
    board: mirrored ? { start: 0, end: width - labelCol } : { start: labelCol, end: width },
    strings: mirrored ? { from: 0, to: columns[0].center } : { from: columns[0].center, to: width },
    numbersEdge,
    boardTop,
    boardBottom,
    doubleInlayY,
    scrolls: !compact && naturalWidth > containerWidth
  };
}

/** The row drawn for `string` (rows are in screen order, not string order). */
export function rowOf(layout: FretboardLayout, string: number): Row {
  const row = layout.rows.find((r) => r.string === string);
  if (!row) throw new RangeError(`string ${string} is not in the layout`);
  return row;
}

/** Index of the nearest center; exact ties go to the lowest `key` (fret or string number). */
function nearestIndex(centers: readonly number[], keys: readonly number[], v: number): number {
  let best = 0;
  let bestDist = Math.abs(v - centers[0]);
  for (let i = 1; i < centers.length; i++) {
    const d = Math.abs(v - centers[i]);
    if (d < bestDist || (d === bestDist && keys[i] < keys[best])) {
      best = i;
      bestDist = d;
    }
  }
  return best;
}

/**
 * Position whose cell center is nearest (Euclidean) to a layout-space point. Axes are
 * independent, so each is resolved separately; out-of-grid points clamp to the edge;
 * exact ties go to the lower fret, then the lower string.
 */
export function nearestPosition(layout: FretboardLayout, x: number, y: number): Position {
  const col = nearestIndex(
    layout.columns.map((c) => c.center),
    layout.columns.map((c) => c.fret),
    x
  );
  const row = nearestIndex(
    layout.rows.map((r) => r.center),
    layout.rows.map((r) => r.string),
    y
  );
  return { string: layout.rows[row].string, fret: layout.columns[col].fret };
}

/**
 * Fractional number of fret columns (open column included, label column excluded) inside the
 * viewport `[scrollLeft, scrollLeft + width]`. A column half in view counts 0.5.
 */
export function visibleColumnCount(
  layout: FretboardLayout,
  scrollLeft: number,
  width: number
): number {
  const left = scrollLeft;
  const right = scrollLeft + width;
  let total = 0;
  for (const c of layout.columns) {
    const w = c.end - c.start;
    if (w <= 0) continue;
    const overlap = Math.min(c.end, right) - Math.max(c.start, left);
    if (overlap > 0) total += overlap / w;
  }
  return total;
}

/**
 * `scrollLeft` that puts the last fret at the far edge (0 when mirrored: the last fret is leftmost) of a viewport `viewportWidth` wide.
 * Never negative; 0 when the content fits (R-11).
 */
export function trailingEdgeScroll(layout: FretboardLayout, viewportWidth: number): number {
  if (layout.mirrored) return 0;
  const last = layout.columns[layout.columns.length - 1];
  return Math.max(0, last.end - viewportWidth);
}
