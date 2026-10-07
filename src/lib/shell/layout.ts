/** Pure responsive arrangement rules (025 data-model §5). No DOM, no Svelte. */

export const NARROW_MAX = 599;
export const MEDIUM_MAX = 1023;
export const LANDSCAPE_MAX_HEIGHT = 499;

export type Arrangement = 'narrow' | 'medium' | 'wide-side' | 'wide-stacked' | 'landscape';

/** Chrome sizes in px (from tokens, already scaled by the root font size). */
export interface LayoutChrome {
  mainPadding: number;
  gap: number;
  zoneBorder: number;
}

/** A phone held sideways: short and wider than tall, at any width. */
export function isPhoneLandscape(width: number, height: number): boolean {
  return height <= LANDSCAPE_MAX_HEIGHT && width > height;
}

/** Inner width of the wide layout's 3/4 column that holds the fretboard. */
export function wideLeftColumn(width: number, chrome: LayoutChrome): number {
  return ((width - 2 * chrome.mainPadding - chrome.gap) * 3) / 4 - 2 * chrome.zoneBorder;
}

export function arrangementFor(input: {
  width: number;
  height: number;
  neckWidth: number;
  chrome: LayoutChrome;
}): Arrangement {
  const { width, height, neckWidth, chrome } = input;
  if (isPhoneLandscape(width, height)) return 'landscape';
  if (width <= NARROW_MAX) return 'narrow';
  if (width <= MEDIUM_MAX) return 'medium';
  return neckWidth <= wideLeftColumn(width, chrome) ? 'wide-side' : 'wide-stacked';
}
