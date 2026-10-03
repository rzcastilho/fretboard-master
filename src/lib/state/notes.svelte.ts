/**
 * Notes tool store (contracts/notes-state-api.md §4, research R-01).
 * Module singleton: survives navigation, resets on reload. Imports only `notes-view`
 * and `state/playback.svelte` (never `audio/engine`).
 */
import { STANDARD_GUITAR, type Instrument, type Position } from '$lib/instrument/instrument';
import type { PitchClass } from '$lib/theory/pitch';
import { LISTEN_BPM } from './listen';
import { carrySelection } from './links';
import { buildNotesModel, type NotesDisplay } from './notes-model';
import {
  adaptNotesView,
  addNote,
  clear,
  closeCard,
  equalsNotesView,
  initialNotesView,
  openCard,
  reset,
  setBackground,
  setHideNames,
  setLabelType,
  setRegionEnd,
  setRegionShortcut,
  setRegionStart,
  toggleNote,
  toggleString,
  widenRegion,
  type Background,
  type LabelType,
  type NotesViewState,
  type RegionShortcut
} from './notes-view';
import { playback } from './playback.svelte';

let view = $state<NotesViewState>(initialNotesView(STANDARD_GUITAR));
let instrument = $state.raw<Instrument>(STANDARD_GUITAR);

const display = $derived<NotesDisplay>(buildNotesModel(view, instrument));

/** Apply a transition; a changed view stops playback (FR-012a), a no-op does nothing. */
function apply(next: NotesViewState): void {
  if (equalsNotesView(next, view)) return;
  playback.stop('view');
  view = next;
}

export const notes = {
  get state(): NotesViewState {
    return view;
  },
  get instrument(): Instrument {
    return instrument;
  },
  get display(): NotesDisplay {
    return display;
  },
  toggleNote(pc: PitchClass): void {
    apply(toggleNote(view, pc));
  },
  addNote(pc: PitchClass): void {
    apply(addNote(view, pc));
  },
  /** Triads → Notes carry: replaces only the selection (FR-002). */
  carrySelection(sel: readonly PitchClass[]): void {
    apply(carrySelection(view, sel));
  },
  toggleString(n: number): void {
    apply(toggleString(view, n, instrument));
  },
  setRegionStart(v: number): void {
    apply(setRegionStart(view, v, instrument));
  },
  setRegionEnd(v: number): void {
    apply(setRegionEnd(view, v, instrument));
  },
  setRegionShortcut(k: RegionShortcut): void {
    apply(setRegionShortcut(view, k, instrument));
  },
  widenRegion(): void {
    apply(widenRegion(view, instrument));
  },
  setLabelType(t: LabelType): void {
    apply(setLabelType(view, t));
  },
  setBackground(b: Background): void {
    apply(setBackground(view, b));
  },
  setHideNames(on: boolean): void {
    apply(setHideNames(view, on));
  },
  /** Sound the selected notes inside the filters, ascending (new `sequence` interrupts; no `stop`). */
  listen(): void {
    if (!display.listen.enabled) return;
    playback.sequence(display.listenSteps, LISTEN_BPM, instrument);
  },
  clear(): void {
    apply(clear(view, instrument));
  },
  reset(): void {
    apply(reset(instrument));
  },
  /**
   * Apply an instrument: revalidate the view. Returns whether the view was adjusted.
   * Never stops playback (the orchestrator does).
   */
  applyInstrument(next: Instrument): boolean {
    if (next === instrument) return false;
    const { view: result, adjusted } = adaptNotesView(view, instrument, next);
    instrument = next;
    view = result;
    return adjusted;
  },
  /** Test-hook switch: stop playback (reason `instrument`), then apply. */
  useInstrument(next: Instrument): void {
    if (next === instrument) return;
    playback.stop('instrument');
    this.applyInstrument(next);
  },
  /** Play the position and open its card. `note` interrupts playback itself (no `stop`). */
  activate(p: Position): void {
    playback.note(p, instrument);
    view = openCard(view, p);
  },
  closeCard(): void {
    view = closeCard(view);
  }
};

/** Test seam: restore the initial view for `instrument` (Vitest only). */
export function resetNotesForTests(next: Instrument = STANDARD_GUITAR): void {
  instrument = next;
  view = initialNotesView(next);
}
