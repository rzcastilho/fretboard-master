/**
 * Motion durations read from design tokens (never hard-coded). Zero when the token is missing
 * or the viewer prefers reduced motion, so every slide and fade is instant.
 */
export function tokenDuration(el: Element | undefined, token = '--duration-short'): number {
  if (!el) return 0;
  if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 0;
  const raw = getComputedStyle(el).getPropertyValue(token).trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return 0;
  return raw.endsWith('ms') ? n : raw.endsWith('s') ? n * 1000 : 0;
}
