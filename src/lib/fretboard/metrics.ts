/** Resolves the rem geometry tokens to px (R-05). Falls back to defaults without a DOM. */
import { DEFAULT_METRICS, type FretboardMetrics } from './geometry';

const TOKENS: Readonly<Record<keyof FretboardMetrics, string>> = {
  row: '--fb-row',
  labelCol: '--fb-label-col',
  openCol: '--fb-open-col',
  fretFirst: '--fb-fret-first',
  fretLast: '--fb-fret-last',
  numbersRow: '--fb-numbers-row',
  nutWidth: '--fb-nut-width',
  thumbRow: '--fb-thumb-row',
  thumbOpenCol: '--fb-thumb-open-col',
  thumbFret: '--fb-thumb-fret',
  markerRoot: '--marker-root',
  markerMedium: '--marker-medium',
  markerSmall: '--marker-small'
};

function toPx(raw: string, rootPx: number): number | undefined {
  const v = raw.trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return undefined;
  if (v.endsWith('rem')) return n * rootPx;
  if (v.endsWith('px')) return n;
  return undefined;
}

export function readMetrics(el?: Element | null): FretboardMetrics {
  if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') {
    return DEFAULT_METRICS;
  }
  const target = el ?? document.documentElement;
  const style = getComputedStyle(target);
  const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const out: FretboardMetrics = { ...DEFAULT_METRICS };
  for (const key of Object.keys(TOKENS) as Array<keyof FretboardMetrics>) {
    const px = toPx(style.getPropertyValue(TOKENS[key]), rootPx);
    if (px !== undefined) out[key] = px;
  }
  return out;
}
