/**
 * CAGED tool store (contracts/caged-api §4). Module singleton: survives navigation, resets on
 * reload. Imports only `caged-view`, `caged-model` and `state/playback.svelte`.
 */
import { STANDARD_GUITAR, type Instrument, type Position } from '$lib/instrument/instrument';
import type { PitchClass } from '$lib/theory/pitch';
import type { CagedQuality } from '$lib/theory/caged';
import { buildCagedModel, type CagedDisplay } from './caged-model';
import {
  equalsCagedView,
  initialCagedView,
  resetCaged,
  selectRoot,
  setQuality,
  switchSpelling,
  type CagedViewState
} from './caged-view';
import { playback } from './playback.svelte';

let view = $state<CagedViewState>(initialCagedView());
let instrument = $state.raw<Instrument>(STANDARD_GUITAR);

const display = $derived<CagedDisplay>(buildCagedModel(view, instrument));

/** Apply a transition; a changed view stops playback, a no-op does nothing. */
function apply(next: CagedViewState): void {
  if (equalsCagedView(next, view)) return;
  playback.stop('view');
  view = next;
}

export const caged = {
  get state(): CagedViewState {
    return view;
  },
  get instrument(): Instrument {
    return instrument;
  },
  get display(): CagedDisplay {
    return display;
  },
  selectRoot(pc: PitchClass): void {
    apply(selectRoot(view, pc));
  },
  setQuality(q: CagedQuality): void {
    apply(setQuality(view, q));
  },
  switchSpelling(): void {
    apply(switchSpelling(view));
  },
  reset(): void {
    apply(resetCaged());
  },
  /** Keep the whole view; the display recomputes. Never changes the view, so returns false. */
  applyInstrument(next: Instrument): boolean {
    instrument = next;
    return false;
  },
  /** Test-hook switch: stop playback (reason `instrument`), then apply. */
  useInstrument(next: Instrument): void {
    if (next === instrument) return;
    playback.stop('instrument');
    this.applyInstrument(next);
  },
  /** Fretboard tap: sound the position; no state change. */
  activate(p: Position): void {
    playback.note(p, instrument);
  }
};

/** Test seam: restore the initial view for `instrument` (Vitest only). */
export function resetCagedForTests(next: Instrument = STANDARD_GUITAR): void {
  instrument = next;
  view = initialCagedView();
}
