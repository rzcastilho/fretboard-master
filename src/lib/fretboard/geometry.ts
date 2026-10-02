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
  nutX: number;
  boardTop: number;
  boardBottom: number;
  scrolls: boolean;
}

export type FretboardVariant = 'interactive' | 'thumbnail';

export const INLAY_FRETS: readonly number[] = [3, 5, 7, 9, 15, 17, 19, 21];
export const DOUBLE_INLAY_FRETS: readonly number[] = [12, 24];

/** Thumbnail shows the open column and frets 1–12. */
export const THUMBNAIL_FRETS = 12;

/**
 * The single place handedness/orientation is read. Identity in this slice:
 * string 1 on top, nut on the left.
 */
export function screenOrder(instrument: Instrument): {
  rows: readonly number[];
  reversed: boolean;
} {
  return {
    rows: Array.from({ length: instrument.stringCount }, (_, i) => i + 1),
    reversed: false
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
  const fretCount = thumb ? Math.min(THUMBNAIL_FRETS, instrument.fretCount) : instrument.fretCount;
  const labelCol = thumb ? 0 : metrics.labelCol;
  const rowH = thumb ? metrics.thumbRow : metrics.row;
  const numbersRow = thumb ? 0 : metrics.numbersRow;

  const widths: number[] = [thumb ? metrics.thumbOpenCol : metrics.openCol];
  for (let f = 1; f <= fretCount; f++) {
    widths.push(thumb ? metrics.thumbFret : fretWidth(metrics, f, instrument.fretCount));
  }
  const columnsNatural = widths.reduce((a, b) => a + b, 0);
  const naturalWidth = labelCol + columnsNatural;

  let scale = 1;
  if (!thumb && containerWidth > naturalWidth) {
    scale = (containerWidth - labelCol) / columnsNatural;
  }

  let x = labelCol;
  const columns: Column[] = widths.map((w, fret) => {
    const start = x;
    x += w * scale;
    return { fret, start, end: x, center: (start + x) / 2 };
  });

  const order = screenOrder(instrument).rows;
  const rows: Row[] = order.map((string, i) => ({
    string,
    top: i * rowH,
    bottom: (i + 1) * rowH,
    center: i * rowH + rowH / 2
  }));
  const boardBottom = rows.length * rowH;

  return {
    width: x,
    height: boardBottom + numbersRow,
    scale,
    columns,
    rows,
    nutX: columns[0].end,
    boardTop: 0,
    boardBottom,
    scrolls: !thumb && naturalWidth > containerWidth
  };
}

function nearestIndex(centers: readonly number[], v: number): number {
  let best = 0;
  let bestDist = Math.abs(v - centers[0]);
  // Strict `<` keeps the lower index on exact ties.
  for (let i = 1; i < centers.length; i++) {
    const d = Math.abs(v - centers[i]);
    if (d < bestDist) {
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
    x
  );
  const row = nearestIndex(
    layout.rows.map((r) => r.center),
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
