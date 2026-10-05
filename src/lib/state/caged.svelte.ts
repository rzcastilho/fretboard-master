/**
 * CAGED tool store (contracts/caged-api §4). Module singleton: survives navigation, resets on
 * reload. Imports only `caged-view`, `caged-model` and `state/playback.svelte`.
 */
import { STANDARD_GUITAR, type Instrument, type Position } from '$lib/instrument/instrument';
import { standardCounterpart, standardTuningId } from '$lib/instrument/tunings';
import { tuningName as presetName } from '$lib/shell/tuning-names';
import type { PitchClass } from '$lib/theory/pitch';
import { sharedPositions, type CagedQuality } from '$lib/theory/caged';
import {
  buildCagedModel,
  cagedOccurrencesFor,
  type CagedDisplay,
  type StepTransition
} from './caged-model';
import {
  STEP_WINDOW_MS,
  focusFromLetter,
  occurrenceIndex,
  reresolveFocus,
  stepFocus,
  toggleTagFocus,
  type FocusChoice
} from './caged-focus';
import {
  equalsCagedView,
  initialCagedView,
  resetCaged,
  selectRoot,
  setConnections,
  setFocus,
  setQuality,
  switchSpelling,
  type CagedViewState
} from './caged-view';
import { playback } from './playback.svelte';

let view = $state<CagedViewState>(initialCagedView());
let preferred = $state.raw<Instrument>(STANDARD_GUITAR);
let tuningName = $state<string>('Standard');
/** CAGED-local temporary standard view; never stored, never in the URL. */
let temporary = $state<boolean>(false);
/** Shared positions of the last step, shown for `STEP_WINDOW_MS`; never part of the view state. */
let transition = $state.raw<StepTransition | null>(null);
let transitionTimer: ReturnType<typeof setTimeout> | null = null;

/** Drop the transition and its pending timer. */
function clearTransition(): void {
  if (transitionTimer !== null) {
    clearTimeout(transitionTimer);
    transitionTimer = null;
  }
  transition = null;
}

/** Effective instrument: the standard counterpart while the temporary view is on. */
const instrument = $derived<Instrument>(temporary ? standardCounterpart(preferred) : preferred);

const effectiveName = $derived<string>(
  temporary ? presetName(standardTuningId(instrument.stringCount === 7 ? 7 : 6)) : tuningName
);

const display = $derived<CagedDisplay>(
  buildCagedModel(view, instrument, { tuningName: effectiveName, temporary }, transition)
);

/** Apply a transition; a changed view stops playback, a no-op does nothing. */
function apply(next: CagedViewState): void {
  if (equalsCagedView(next, view)) return;
  clearTransition();
  playback.stop('view');
  view = next;
}

/** Commit a focus change without touching playback (contracts §5). */
function commitFocus(f: CagedViewState['focus']): void {
  view = setFocus(view, f);
}

/** A non-compatible tuning has no shapes: drop any focus. */
function clearFocusIfUnsupported(): void {
  if (view.focus !== null && display.tuningClass === 'non-compatible') commitFocus(null);
}

/** Next view with its focus re-resolved against the new occurrences (R-02). */
function withResolvedFocus(next: CagedViewState): CagedViewState {
  if (next.focus === null) return next;
  const occs = cagedOccurrencesFor(next, instrument);
  return setFocus(next, reresolveFocus(display.focused, view.focus, occs));
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
  get temporary(): boolean {
    return temporary;
  },
  /** The step transition currently shown, else null. */
  get transition(): StepTransition | null {
    return transition;
  },
  get temporaryName(): string | null {
    return display.temporaryName;
  },
  selectRoot(pc: PitchClass): void {
    apply(withResolvedFocus(selectRoot(view, pc)));
  },
  setQuality(q: CagedQuality): void {
    apply(withResolvedFocus(setQuality(view, q)));
  },
  /** Zone-D switch: ring every connection. Not persisted; a transition is left untouched. */
  setConnections(on: boolean): void {
    view = setConnections(view, on);
  },
  switchSpelling(): void {
    apply(switchSpelling(view));
  },
  reset(): void {
    apply(resetCaged());
  },
  /** Zone-B shape selector: a letter focuses its nearest-the-nut occurrence, 'all' clears. */
  chooseShape(c: FocusChoice): void {
    clearTransition();
    commitFocus(focusFromLetter(view.focus, c, display.occurrences));
  },
  /** Tag press: toggles that exact occurrence; an unknown id is a no-op. */
  toggleTag(id: string): void {
    const i = display.occurrences.findIndex((o) => `${o.shape.id}@${o.start}` === id);
    if (i < 0) return;
    clearTransition();
    commitFocus(toggleTagFocus(view.focus, i, display.occurrences));
  },
  /**
   * Move focus to the neighbor occurrence (dir 1 = toward the body). No wrap. The positions
   * shared by the departing and arriving occurrences carry the ring for `STEP_WINDOW_MS`; a new
   * step replaces them and restarts the window.
   */
  step(dir: 1 | -1): void {
    const occs = display.occurrences;
    const from = occurrenceIndex(view.focus, occs);
    const nextFocus = stepFocus(view.focus, dir, occs);
    const to = occurrenceIndex(nextFocus, occs);
    if (from === null || to === null || to === from) return;
    clearTransition();
    commitFocus(nextFocus);
    transition = {
      positions: sharedPositions(occs[from], occs[to]).map((n) => `${n.string}:${n.fret}`)
    };
    transitionTimer = setTimeout(clearTransition, STEP_WINDOW_MS);
  },
  /**
   * Keep key, quality and override; re-resolve focus on the new instrument. Returns true iff a
   * focused occurrence existed and the re-resolved one differs in letter or start. A tuning
   * that became non-compatible clears focus and returns false.
   */
  applyInstrument(next: Instrument, name: string): boolean {
    const prev = display.focused;
    const prevFocus = view.focus;
    clearTransition();
    preferred = next;
    tuningName = name;
    if (prevFocus === null) return false;
    const occs = cagedOccurrencesFor(view, instrument);
    const focus = reresolveFocus(prev, prevFocus, occs);
    commitFocus(focus);
    if (prev === null || focus === null) return false;
    const now = display.focused;
    return now !== null && (now.shape.id !== prev.shape.id || now.start !== prev.start);
  },
  /** Test-hook switch: stop playback (reason `instrument`), then apply. */
  useInstrument(next: Instrument, name: string = tuningName): void {
    if (next === preferred && name === tuningName) return;
    playback.stop('instrument');
    this.applyInstrument(next, name);
  },
  /** Show the same key in the standard tuning; only from the non-compatible notice. */
  viewInStandard(): void {
    if (temporary || display.tuningClass !== 'non-compatible') return;
    temporary = true;
    clearTransition();
    clearFocusIfUnsupported();
    playback.stop('instrument');
  },
  /** Leave the temporary view (confirm, screen change). No-op when not temporary. */
  endTemporary(): void {
    if (!temporary) return;
    temporary = false;
    clearTransition();
    clearFocusIfUnsupported();
    playback.stop('instrument');
  },
  /** A real screen change ends the temporary view. */
  screenChanged(): void {
    this.endTemporary();
  },
  /** Fretboard tap: sound the position; no state change. */
  activate(p: Position): void {
    playback.note(p, instrument);
  }
};

/** Test seam: restore the initial view for `instrument` (Vitest only). */
export function resetCagedForTests(
  next: Instrument = STANDARD_GUITAR,
  name: string = 'Standard'
): void {
  preferred = next;
  tuningName = name;
  temporary = false;
  clearTransition();
  view = initialCagedView();
}
