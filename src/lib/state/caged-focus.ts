/**
 * CAGED focus resolution (data-model §3, contracts/caged-focus-api §2).
 * Pure: no Svelte, DOM or paraglide. `occs` are the drawn occurrences sorted by start.
 * A function that returns an unchanged focus returns the same object reference.
 */
import type { CagedShapeId, ShapeOccurrence } from '../theory/caged';
import type { CagedFocus } from './caged-view';

/** Equals the `--duration-medium` token (asserted by a test). */
export const STEP_WINDOW_MS = 500;

export type FocusChoice = CagedShapeId | 'all';

export function occurrenceIndex(
  f: CagedFocus | null,
  occs: readonly ShapeOccurrence[]
): number | null {
  if (f === null) return null;
  let seen = 0;
  for (let i = 0; i < occs.length; i++) {
    if (occs[i].shape.id !== f.letter) continue;
    if (seen === f.ordinal) return i;
    seen++;
  }
  return null;
}

export function focusOfIndex(i: number, occs: readonly ShapeOccurrence[]): CagedFocus | null {
  if (!Number.isInteger(i) || i < 0 || i >= occs.length) return null;
  const letter = occs[i].shape.id;
  let ordinal = 0;
  for (let k = 0; k < i; k++) if (occs[k].shape.id === letter) ordinal++;
  return { letter, ordinal };
}

export function focusFromLetter(
  f: CagedFocus | null,
  c: FocusChoice,
  occs: readonly ShapeOccurrence[]
): CagedFocus | null {
  if (c === 'all') return null;
  if (f !== null && f.letter === c) return f;
  const first = occs.findIndex((o) => o.shape.id === c);
  return first < 0 ? f : focusOfIndex(first, occs);
}

export function toggleTagFocus(
  f: CagedFocus | null,
  i: number,
  occs: readonly ShapeOccurrence[]
): CagedFocus | null {
  return occurrenceIndex(f, occs) === i ? null : focusOfIndex(i, occs);
}

export function stepFocus(
  f: CagedFocus | null,
  dir: 1 | -1,
  occs: readonly ShapeOccurrence[]
): CagedFocus | null {
  const idx = occurrenceIndex(f, occs);
  if (idx === null) return f;
  return focusOfIndex(idx + dir, occs) ?? f;
}

export function stepAvailability(
  f: CagedFocus | null,
  occs: readonly ShapeOccurrence[]
): { readonly previous: boolean; readonly next: boolean } {
  const idx = occurrenceIndex(f, occs);
  if (idx === null) return { previous: false, next: false };
  return { previous: idx > 0, next: idx < occs.length - 1 };
}

export function drawnLetters(occs: readonly ShapeOccurrence[]): ReadonlySet<CagedShapeId> {
  return new Set(occs.map((o) => o.shape.id));
}

/** Nearest start to `target`; the lower start wins a tie. `occs` is sorted by start. */
function nearestIndex(
  occs: readonly ShapeOccurrence[],
  target: number,
  pick: (o: ShapeOccurrence) => boolean
): number {
  let best = -1;
  for (let i = 0; i < occs.length; i++) {
    if (!pick(occs[i])) continue;
    if (best < 0 || Math.abs(occs[i].start - target) < Math.abs(occs[best].start - target))
      best = i;
  }
  return best;
}

/** Re-resolve a focus after a key, quality or instrument change (R-02). */
export function reresolveFocus(
  prev: ShapeOccurrence | null,
  prevFocus: CagedFocus | null,
  next: readonly ShapeOccurrence[]
): CagedFocus | null {
  if (prevFocus === null || next.length === 0) return null;
  if (occurrenceIndex(prevFocus, next) !== null) return prevFocus;
  const target = prev?.start ?? 0;
  const same = nearestIndex(next, target, (o) => o.shape.id === prevFocus.letter);
  const i = same >= 0 ? same : nearestIndex(next, target, () => true);
  return focusOfIndex(i, next);
}
