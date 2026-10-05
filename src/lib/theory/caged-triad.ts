/**
 * CAGED Triad layer theory (research R-01, R-02). Pure: imports only `./pitch`, `./triad`,
 * `./triad-shape` and `./caged`. Every function is total and never throws.
 *
 * The triad of a shape is built with the Triads tool's own shape function and kept only when all
 * three notes lie inside the occurrence's clipped arpeggio window, so it equals a Triads shape by
 * construction.
 */
import type { Pitch } from './pitch';
import type { ShapeOccurrence } from './caged';
import type { TriadSpelling } from './triad';
import {
  INVERSIONS,
  INVERSION_ORDER,
  occurrences,
  span,
  triadShape,
  type Frets3,
  type Functions3,
  type Inversion
} from './triad-shape';

export interface ShapeTriad {
  /** Bass string number; the strings are `set`, `set − 1`, `set − 2`. */
  readonly set: number;
  readonly inversion: Inversion;
  /** Low → high string. */
  readonly frets: Frets3;
  readonly functions: Functions3;
  /** Triads octave index k: `frets = triadShape(…).frets + 12k`. */
  readonly occurrence: number;
  readonly pitches: readonly [Pitch, Pitch, Pitch];
}

/**
 * Close-position triad of `set` inside `occ`'s clipped region, or null (R-01, R-02).
 * `openPitches` is string 1 first (length 6 or 7, real tuning).
 */
export function shapeTriad(
  occ: ShapeOccurrence,
  openPitches: readonly Pitch[],
  triad: TriadSpelling,
  set: number,
  fretCount: number
): ShapeTriad | null {
  if (
    !occ?.region ||
    !triad?.pitchClasses ||
    !Array.isArray(openPitches) ||
    !Number.isInteger(set) ||
    !Number.isFinite(fretCount) ||
    set < 3 ||
    set > openPitches.length
  )
    return null;
  const open3 = [openPitches[set - 1], openPitches[set - 2], openPitches[set - 3]] as const;
  if (!open3.every((p) => Number.isFinite(p))) return null;

  const lo = Math.max(0, Math.ceil(occ.region.start));
  const hi = Math.min(Math.floor(fretCount), occ.region.end);
  let best: ShapeTriad | null = null;
  let bestSpan = Infinity;

  for (const inversion of INVERSIONS) {
    const base = triadShape(open3, triad, inversion);
    if (base.kind !== 'shape') return null; // non-ascending strings: no candidate for the set
    occurrences(base.frets, Math.floor(fretCount)).forEach((frets, k) => {
      if (!frets.every((f) => f >= lo && f <= hi)) return;
      const s = span(frets);
      if (best === null || s < bestSpan || (s === bestSpan && frets[0] < best.frets[0])) {
        bestSpan = s;
        best = {
          set,
          inversion,
          frets,
          functions: INVERSION_ORDER[inversion],
          occurrence: k,
          pitches: [open3[0] + frets[0], open3[1] + frets[1], open3[2] + frets[2]]
        };
      }
    });
  }
  return best;
}
