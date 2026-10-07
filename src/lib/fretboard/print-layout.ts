/**
 * Nominal print width of the board in CSS px, read from `--print-board-inline` (R-11), which is
 * written in `mm` (or `px`). Falls back to 190 mm (A4 portrait printable width at default
 * margins) without a DOM, a token or a known unit.
 */
const MM = 96 / 25.4;

export function printInlinePx(el?: Element | null): number {
  const raw =
    typeof getComputedStyle === 'undefined'
      ? ''
      : getComputedStyle(el ?? document.documentElement)
          .getPropertyValue('--print-board-inline')
          .trim();
  const n = parseFloat(raw);
  const factor = raw.endsWith('mm') ? MM : raw.endsWith('px') ? 1 : NaN;
  return n * factor || 190 * MM;
}
