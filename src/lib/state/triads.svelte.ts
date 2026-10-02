/**
 * Triads tool store (contracts/triads-state-api.md §3).
 * Module singleton: survives navigation, resets on reload. Imports only `triads-view`,
 * `triads-model`, `listen` and `state/playback.svelte` (never `audio/engine`).
 */
import { STANDARD_GUITAR, type Instrument, type Position } from '$lib/instrument/instrument';
import { buildTriadsModel, tagTarget, type TriadsDisplay } from './triads-model';
import {
  equalsTriadsView,
  initialTriadsView,
  octaveDown,
  octaveUp,
  resetTriads,
  selectRoot,
  seeAllNotes,
  selectShape,
  setInversion,
  setLabelType,
  setQuality,
  setStringSet,
  setView,
  switchSpelling,
  type TriadsLabelType,
  type TriadsView,
  type TriadsViewState
} from './triads-view';
import type { PitchClass } from '$lib/theory/pitch';
import type { Quality } from '$lib/theory/triad';
import type { Inversion } from '$lib/theory/triad-shape';
import type { StringSetId } from '$lib/instrument/string-sets';
import { playback } from './playback.svelte';
import { LISTEN_BPM } from './listen';

let view = $state<TriadsViewState>(initialTriadsView(STANDARD_GUITAR));
let instrument = $state.raw<Instrument>(STANDARD_GUITAR);

const display = $derived<TriadsDisplay>(buildTriadsModel(view, instrument));

/** Apply a transition; a changed view stops playback (FR-028), a no-op does nothing. */
function apply(next: TriadsViewState): void {
  if (equalsTriadsView(next, view)) return;
  playback.stop('view');
  view = next;
}

export const triads = {
  get state(): TriadsViewState {
    return view;
  },
  get instrument(): Instrument {
    return instrument;
  },
  get display(): TriadsDisplay {
    return display;
  },
  selectRoot(pc: PitchClass): void {
    apply(selectRoot(view, pc));
  },
  setQuality(q: Quality): void {
    apply(setQuality(view, q));
  },
  setInversion(inv: Inversion): void {
    apply(setInversion(view, inv));
  },
  setStringSet(id: StringSetId): void {
    apply(setStringSet(view, id, instrument));
  },
  switchSpelling(): void {
    apply(switchSpelling(view));
  },
  /** Adopt the nearest string set on which the triad closes (C11); no-op when none. */
  anotherSet(): void {
    const id = display.anotherSet;
    if (id !== null) apply(setStringSet(view, id, instrument));
  },
  /** Guidance recovery: switch to All notes, keeping inversion, set and occurrence (C8). */
  seeAllNotes(): void {
    apply(seeAllNotes(view));
  },
  setView(v: TriadsView): void {
    apply(setView(view, v));
  },
  /** Full neck tag tap: select the tag's inversion and occurrence together (C3). */
  selectTag(id: string): void {
    const target = tagTarget(display, id);
    if (target) apply(selectShape(view, target.inversion, target.octave, instrument));
  },
  /** Reset tool: back to the initial state, view isolated (C14). */
  reset(): void {
    apply(resetTriads(instrument));
  },
  setLabelType(t: TriadsLabelType): void {
    apply(setLabelType(view, t));
  },
  octaveUp(): void {
    apply(octaveUp(view, instrument));
  },
  octaveDown(): void {
    apply(octaveDown(view, instrument));
  },
  /** Switch instrument: revalidate nothing yet (later stories); playback stops iff it changed. */
  useInstrument(next: Instrument): void {
    if (next === instrument) return;
    playback.stop('instrument');
    instrument = next;
    view = initialTriadsView(next);
  },
  /** Sound the shape low → mid → high, then the block (new `sequence` interrupts; no `stop`). */
  listen(): void {
    if (!display.listen.enabled) return;
    playback.sequence(display.listenSteps, LISTEN_BPM, instrument);
  },
  /** Fretboard tap: sound the position; no state change. `note` interrupts playback itself. */
  activate(p: Position): void {
    playback.note(p, instrument);
  }
};

/** Test seam: restore the initial view for `instrument` (Vitest only). */
export function resetTriadsForTests(next: Instrument = STANDARD_GUITAR): void {
  instrument = next;
  view = initialTriadsView(next);
}
