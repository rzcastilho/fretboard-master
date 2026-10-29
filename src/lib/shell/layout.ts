/** Pure responsive arrangement rules (025 data-model §5, 030 desktop-only). No DOM, no Svelte. */

/** Widest window that reflows (single column, compact bar). Desktop layouts start at 1024. */
export const REFLOW_MAX = 1023;

export type Arrangement = 'reflow' | 'wide-side' | 'wide-stacked';

/** Chrome sizes in px (from tokens, already scaled by the root font size). */
export interface LayoutChrome {
  mainPadding: number;
  gap: number;
  zoneBorder: number;
}

/** Inner width of the wide layout's 3/4 column that holds the fretboard. */
export function wideLeftColumn(width: number, chrome: LayoutChrome): number {
  return ((width - 2 * chrome.mainPadding - chrome.gap) * 3) / 4 - 2 * chrome.zoneBorder;
}

export function arrangementFor(input: {
  width: number;
  neckWidth: number;
  chrome: LayoutChrome;
}): Arrangement {
  const { width, neckWidth, chrome } = input;
  if (width <= REFLOW_MAX) return 'reflow';
  return neckWidth <= wideLeftColumn(width, chrome) ? 'wide-side' : 'wide-stacked';
}
