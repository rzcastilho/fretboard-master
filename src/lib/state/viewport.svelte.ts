/**
 * Viewport runes store (025 data-model §5). Holds the window size and root font size and derives
 * the layout arrangement. The prerender default `{0, 0, 16}` yields no arrangement, so nothing is
 * written to the DOM and the CSS media-query fallback applies until mount.
 */
import { layoutFretboard } from '$lib/fretboard/geometry';
import { readMetrics } from '$lib/fretboard/metrics';
import { arrangementFor, type Arrangement, type LayoutChrome } from '$lib/shell/layout';
import { instrument } from './instrument.svelte';

const DEFAULT_ROOT_PX = 16;
/** Chrome at a 16 px root (tokens `--space-4`, `--space-4`, `--border-width`). */
const DEFAULT_CHROME: LayoutChrome = { mainPadding: 16, gap: 16, zoneBorder: 1 };

let width = $state(0);
let height = $state(0);
let rootPx = $state(DEFAULT_ROOT_PX);
let chrome = $state<LayoutChrome>(DEFAULT_CHROME);
let metrics = $state(readMetrics());

function tokenPx(style: CSSStyleDeclaration, name: string, fallback: number, root: number): number {
  const raw = style.getPropertyValue(name).trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  if (raw.endsWith('rem')) return n * root;
  if (raw.endsWith('px')) return n;
  return fallback;
}

/** Re-read window size, root font size, tokens and metrics. Cheap; called on resize. */
export function measureViewport(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const style = getComputedStyle(document.documentElement);
  const root = parseFloat(style.fontSize) || DEFAULT_ROOT_PX;
  width = window.innerWidth;
  height = window.innerHeight;
  rootPx = root;
  chrome = {
    mainPadding: tokenPx(style, '--space-4', DEFAULT_CHROME.mainPadding, root),
    gap: tokenPx(style, '--space-4', DEFAULT_CHROME.gap, root),
    zoneBorder: tokenPx(style, '--border-width', DEFAULT_CHROME.zoneBorder, root)
  };
  metrics = readMetrics();
}

export const viewport = {
  get width(): number {
    return width;
  },
  get height(): number {
    return height;
  },
  get rootPx(): number {
    return rootPx;
  },
  /** Undefined before mount (width 0): the CSS fallback applies. */
  get arrangement(): Arrangement | undefined {
    if (width === 0 || height === 0) return undefined;
    const neckWidth = layoutFretboard(instrument.current, metrics, 0, 'interactive').naturalWidth;
    return arrangementFor({ width, height, neckWidth, chrome });
  }
};

/** Start tracking resize and root font size changes; returns the cleanup. Browser only. */
export function startViewport(): () => void {
  measureViewport();
  window.addEventListener('resize', measureViewport);
  // A root font-size change does not fire `resize`; it does change the root's laid-out size.
  const observer =
    typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measureViewport);
  observer?.observe(document.documentElement);
  return () => {
    window.removeEventListener('resize', measureViewport);
    observer?.disconnect();
  };
}

/** Test seam: set the viewport directly, or reset it to the prerender default (Vitest only). */
export function setViewportForTests(v?: { width: number; height: number; rootPx?: number }): void {
  width = v?.width ?? 0;
  height = v?.height ?? 0;
  rootPx = v?.rootPx ?? DEFAULT_ROOT_PX;
  chrome = DEFAULT_CHROME;
  metrics = readMetrics();
}
