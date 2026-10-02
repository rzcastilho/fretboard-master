/** Pure triad detection (TM-4.5). Imports only `./pitch` and `./triad`. */
import type { PitchClass } from './pitch';
import { QUALITIES, QUALITY_INTERVALS, type Quality } from './triad';

export interface TriadMatch {
  readonly rootPc: PitchClass;
  readonly quality: Quality;
}

const isPc = (v: unknown): v is PitchClass =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 11;

/**
 * `selection` is in first-selected order. Returns null unless it is exactly three distinct
 * pitch classes forming major, minor, diminished or augmented above one of them.
 * Augmented is symmetric, so the first selected note is the root.
 */
export function detectTriad(selection: readonly PitchClass[]): TriadMatch | null {
  if (!Array.isArray(selection) || selection.length !== 3 || !selection.every(isPc)) return null;
  if (new Set(selection).size !== 3) return null;
  const set = new Set(selection);
  for (const rootPc of selection) {
    for (const quality of QUALITIES) {
      const { third, fifth } = QUALITY_INTERVALS[quality];
      if (set.has((rootPc + third) % 12) && set.has((rootPc + fifth) % 12)) {
        return { rootPc, quality };
      }
    }
  }
  return null;
}
