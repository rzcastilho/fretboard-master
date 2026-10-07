/** Pure minimap geometry (025 data-model §3). No DOM, no Svelte. */
import type { FretboardLayout } from './geometry';
import type { ScrollViewport } from './interaction';

export interface FretRange {
  first: number;
  last: number;
  count: number;
}

export interface MinimapWindow {
  x: number;
  width: number;
}

export type MinimapKey = 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End';

function maxScroll(layout: FretboardLayout, viewportWidth: number): number {
  return Math.max(0, layout.width - viewportWidth);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Frets ≥ 1 whose column centre lies in the viewport. When none does (viewport inside the open
 * column) the range is fret 1.
 */
export function visibleFretRange(layout: FretboardLayout, viewport: ScrollViewport): FretRange {
  const count = layout.columns.length - 1;
  const left = viewport.scrollLeft;
  const right = viewport.scrollLeft + viewport.width;
  let first = 0;
  let last = 0;
  for (const c of layout.columns) {
    if (c.fret < 1) continue;
    if (c.center >= left && c.center <= right) {
      if (first === 0) first = c.fret;
      last = c.fret;
    }
  }
  if (first === 0) return { first: 1, last: 1, count };
  return { first, last, count };
}

/** Viewport window in minimap px, clamped to the minimap (`k` = minimap width / layout width). */
export function minimapWindow(
  layout: FretboardLayout,
  viewport: ScrollViewport,
  k: number
): MinimapWindow {
  const total = layout.width * k;
  const x = clamp(viewport.scrollLeft * k, 0, total);
  const width = clamp(viewport.width * k, 0, total - x);
  return { x, width };
}

/** `scrollLeft` that centres the tapped minimap point `x`, clamped to the scrollable range. */
export function minimapTapScroll(
  layout: FretboardLayout,
  x: number,
  k: number,
  viewportWidth: number
): number {
  return clamp(x / k - viewportWidth / 2, 0, maxScroll(layout, viewportWidth));
}

/**
 * Target `scrollLeft` for a keyboard command, or null for other keys. Arrows are visual
 * (right = +viewport); Home goes to the nut end, End to the last-fret end (swapped when mirrored).
 */
export function minimapKeyScroll(
  layout: FretboardLayout,
  key: string,
  viewport: ScrollViewport
): number | null {
  const max = maxScroll(layout, viewport.width);
  switch (key) {
    case 'ArrowRight':
      return clamp(viewport.scrollLeft + viewport.width, 0, max);
    case 'ArrowLeft':
      return clamp(viewport.scrollLeft - viewport.width, 0, max);
    case 'Home':
      return layout.mirrored ? max : 0;
    case 'End':
      return layout.mirrored ? 0 : max;
    default:
      return null;
  }
}
