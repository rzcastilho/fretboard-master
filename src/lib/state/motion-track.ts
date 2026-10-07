/**
 * Motion bookkeeping for the tool stores (026, data-model §7). No Svelte: a store calls the
 * tracker from inside its `display` derivation, so the previous view is whatever the last
 * derivation saw. Re-deriving with the same view and instrument (language, notation, fit)
 * is not a change of the view and gives `'none'`.
 */
import type { DisplayModel } from '../fretboard/types';
import type { MotionKind } from '../fretboard/transition';
import type { MotionContext } from './triads-view';

export type Classify<V> = (prev: V | null, next: V, ctx: MotionContext) => MotionKind;

export interface MotionTracker<V, I> {
  /** Kind for this derivation; call it from inside the `display` derivation. */
  (view: V, instrument: I): MotionKind;
  /** The UI has read the display: a later re-derivation of the same view is not a motion. */
  consume(): void;
}

/**
 * A store derives its display several times for one change (internal reads, then the UI's).
 * The kind of the change is kept until the UI reads the display; after that, deriving the same
 * view and instrument again (language, notation, fit, a reveal ending) gives `'none'`.
 */
export function createMotionTracker<V, I>(
  classify: Classify<V>,
  presentationChanged: (prev: V, next: V) => boolean
): MotionTracker<V, I> {
  let lastView: V | null = null;
  let lastInstrument: I | undefined;
  let lastKind: MotionKind = 'none';
  let consumed = true;
  const track = ((view: V, instrument: I): MotionKind => {
    const prev = lastView;
    const prevInstrument = lastInstrument;
    if (prev !== null && prev === view && prevInstrument === instrument) {
      return consumed ? 'none' : lastKind;
    }
    lastView = view;
    lastInstrument = instrument;
    consumed = false;
    lastKind =
      prev === null
        ? 'none'
        : classify(prev, view, {
            instrumentChanged: prevInstrument !== instrument,
            presentationChanged: presentationChanged(prev, view)
          });
    return lastKind;
  }) as MotionTracker<V, I>;
  track.consume = () => {
    consumed = true;
  };
  return track;
}

/** The display with `motion` set on its model; unchanged (same object) for `'none'`. */
export function withMotion<T extends { readonly model: DisplayModel | null }>(
  display: T,
  motion: MotionKind
): T {
  if (motion === 'none' || display.model === null) return display;
  return { ...display, model: { ...display.model, motion } };
}
