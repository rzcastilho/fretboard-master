/**
 * Marker label fit (data-model §11, FR-008, FR-012). Pure: no DOM, no Svelte.
 * Graphemes are counted as code points, so 𝄪 and 𝄫 count as one.
 */

export type MarkerSize = 'small' | 'medium' | 'root';

export interface FittedLabel {
  readonly lines: readonly string[];
  readonly size: 'normal' | 'min';
}

const NORMAL_MAX = 3;
const MIN_MAX = 4;
const NAME_ABBREVIATION = 2;
const PARTS = /^([^♯♭𝄪𝄫\d]*)([♯♭𝄪𝄫]*)(\d*)$/u;

const length = (text: string): number => Array.from(text).length;

/** Shorten the note name to 2 graphemes, then drop the octave, re-testing after each step. */
function abbreviate(text: string): string {
  const parts = PARTS.exec(text);
  if (!parts) return text;
  const [, name, accidental, octave] = parts;
  const shortName = Array.from(name).slice(0, NAME_ABBREVIATION).join('');
  const shortened = `${shortName}${accidental}${octave}`;
  if (length(shortened) <= MIN_MAX) return shortened;
  return `${shortName}${accidental}`;
}

export function fitMarkerLabel(lines: readonly string[], size: MarkerSize): FittedLabel {
  const stackable =
    lines.length === 2 &&
    (size === 'medium' || size === 'root') &&
    lines.every((line) => length(line) <= NORMAL_MAX);
  if (stackable) return { lines: [lines[0], lines[1]], size: 'min' };

  const first = lines[0] ?? '';
  const count = length(first);
  if (count <= NORMAL_MAX) return { lines: [first], size: 'normal' };
  if (count <= MIN_MAX) return { lines: [first], size: 'min' };
  return { lines: [abbreviate(first)], size: 'min' };
}
