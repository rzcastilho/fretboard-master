/** Pure triad shapes on three adjacent strings (TM-5). Imports only `./pitch` and `./triad`. */
import { pitchClass, type Pitch } from './pitch';
import type { TriadFunction, TriadSpelling } from './triad';

export type Inversion = 'root' | 'first' | 'second';
/** Frets from the lowest string of the set to the highest. */
export type Frets3 = readonly [number, number, number];
export type ShapeResult =
  | {
      readonly kind: 'shape';
      readonly frets: Frets3;
      readonly functions: readonly [TriadFunction, TriadFunction, TriadFunction];
    }
  | { readonly kind: 'does-not-close' };

export const INVERSIONS: readonly Inversion[] = ['root', 'first', 'second'];

/** TM-5.2, low → high. */
export const INVERSION_ORDER: Readonly<
  Record<Inversion, readonly [TriadFunction, TriadFunction, TriadFunction]>
> = {
  root: ['root', 'third', 'fifth'],
  first: ['third', 'fifth', 'root'],
  second: ['fifth', 'root', 'third']
};

export const WIDE_STRETCH_SPAN = 5;
export const OCTAVE_FRETS = 12;

const PC_INDEX: Readonly<Record<TriadFunction, 0 | 1 | 2>> = { root: 0, third: 1, fifth: 2 };

/** Smallest pitch above `above` with pitch class `pc` (triad pitch classes are distinct, so never equal). */
function nextAbove(above: Pitch, pc: number): Pitch {
  const diff = (((pc - pitchClass(above)) % 12) + 12) % 12;
  return above + diff;
}

/** TM-5.3 over three open pitches (low → high). Never consults a fret count. */
export function triadShape(
  open: readonly [Pitch, Pitch, Pitch],
  t: TriadSpelling,
  inv: Inversion
): ShapeResult {
  if (!(open[0] < open[1] && open[1] < open[2])) return { kind: 'does-not-close' };
  const order = INVERSION_ORDER[inv];
  const pcs = order.map((f) => t.pitchClasses[PC_INDEX[f]]);

  // Step 1: the fret closest to the nut (0..11) holding the bass note.
  const bassFret = (((pcs[0] - pitchClass(open[0])) % 12) + 12) % 12;
  let bass = open[0] + bassFret;
  // Steps 2–4: stack upward; raise by an octave while any fret is negative.
  for (;;) {
    const mid = nextAbove(bass, pcs[1]);
    const high = nextAbove(mid, pcs[2]);
    const frets: Frets3 = [bass - open[0], mid - open[1], high - open[2]];
    if (frets.every((f) => f >= 0)) return { kind: 'shape', frets, functions: order };
    bass += OCTAVE_FRETS;
  }
}

/** Octave copies of a shape: `[frets + 12k]` while the highest fret fits. */
export function occurrences(frets: Frets3, fretCount: number): readonly Frets3[] {
  const out: Frets3[] = [];
  const top = Math.max(...frets);
  for (let k = 0; top + OCTAVE_FRETS * k <= fretCount; k++) {
    const d = OCTAVE_FRETS * k;
    out.push([frets[0] + d, frets[1] + d, frets[2] + d]);
  }
  return out;
}

/** Highest − lowest fretted fret (open strings ignored); 0 with < 2 fretted notes. */
export function span(frets: Frets3): number {
  const fretted = frets.filter((f) => f > 0);
  return fretted.length < 2 ? 0 : Math.max(...fretted) - Math.min(...fretted);
}

export function isWideStretch(frets: Frets3): boolean {
  return span(frets) >= WIDE_STRETCH_SPAN;
}
