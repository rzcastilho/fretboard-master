/**
 * CAGED tool store (contracts/caged-api §4). Module singleton: survives navigation, resets on
 * reload. Imports `caged-view`, `caged-model`, `state/playback.svelte` and, to remember the
 * label type, `state/preferences.svelte`.
 */
import { STANDARD_GUITAR, type Instrument, type Position } from '$lib/instrument/instrument';
import {
  STANDARD_TUNING,
  standardCounterpart,
  standardTuningId,
  type Tuning
} from '$lib/instrument/tunings';
import { tuningLabel, tuningName as presetName } from '$lib/shell/tuning-names';
import { pitchOfSpelling, type PitchClass } from '$lib/theory/pitch';
import { sharedPositions, type CagedQuality } from '$lib/theory/caged';
import {
  buildCagedModel,
  cagedOccurrencesFor,
  type CagedDisplay,
  type CagedExtras,
  type StepTransition
} from './caged-model';
import {
  ensureDrawable,
  needsAutoFocus,
  revealOrder,
  toggleLayer as flipLayer,
  type SwitchState
} from './caged-layers';
import type { CagedLayer } from '../theory/caged-layers';
import {
  defaultTriadSet,
  selectedTriad,
  settleTriadSet,
  triadAvailability,
  triadRevealIds
} from './caged-triad';
import type { StringSetId } from '../instrument/string-sets';
import {
  STEP_WINDOW_MS,
  focusFromLetter,
  focusOfIndex,
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
  setLabelType,
  setLayers,
  setQuality,
  setTriadSet,
  switchSpelling,
  CAGED_LABEL_TYPES,
  cagedRootSpelling,
  type CagedLabelType,
  type CagedViewState
} from './caged-view';
import { carryIntoCaged, type CagedCarry } from './links';
import { buildCagedListen, type ListenSource } from './caged-listen';
import { DEFAULT_TEMPO, isTempo, type Tempo } from './listen';
import { playback } from './playback.svelte';
import { preferences } from './preferences.svelte';

/** Layer reveal window; equals `--duration-short` (asserted by a test). */
export const REVEAL_WINDOW_MS = 300;

/** Remembered label type: part of the initial view and of `reset()` (010, 017). */
let preferredLabel: CagedLabelType = 'interval';

let view = $state<CagedViewState>(initialCagedView(preferredLabel));
/** Keys newly drawn by the last layer switch, for the staggered intro; never part of the view. */
let reveal = $state.raw<CagedExtras['reveal']>(null);
let revealTimer: ReturnType<typeof setTimeout> | null = null;
/** The last layer change (or automatic Chord restore), announced first; never part of the view. */
let layerChange = $state.raw<CagedExtras['layerChange']>(null);
/** The last Triad set selection, announced first; never part of the view. */
let triadChange = $state.raw<CagedExtras['triadChange']>(null);

/** Stagger the intro of `ids` for `REVEAL_WINDOW_MS`; nothing to reveal leaves it null. */
function startReveal(ids: readonly string[]): void {
  if (ids.length === 0) return;
  reveal = { ids };
  revealTimer = setTimeout(() => {
    revealTimer = null;
    reveal = null;
  }, REVEAL_WINDOW_MS);
}

/** Drop the layer transients and the pending reveal timer. */
function clearLayerTransients(): void {
  if (revealTimer !== null) {
    clearTimeout(revealTimer);
    revealTimer = null;
  }
  reveal = null;
  layerChange = null;
  triadChange = null;
}
let preferred = $state.raw<Instrument>(STANDARD_GUITAR);
/** The applied tuning; the label is derived so a notation or language change updates it. */
let tuning = $state.raw<Tuning>(STANDARD_TUNING);
/**
 * CAGED-local temporary standard view. Carried in share links (`tmp`, FR-009 supersedes slice
 * 015), but never written to device storage.
 */
let temporary = $state<boolean>(false);
/** Shared positions of the last step, shown for `STEP_WINDOW_MS`; never part of the view state. */
let transition = $state.raw<StepTransition | null>(null);
/** Source of the Listen playback started by `listen()`; read through `listening`. */
let listenSource = $state.raw<ListenSource | null>(null);
/** Listen tempo; remembered (`tempo`), restored by `preferences.start()` and `erase()`. */
let tempo = $state<Tempo>(DEFAULT_TEMPO);
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
  temporary
    ? presetName(standardTuningId(instrument.stringCount === 7 ? 7 : 6))
    : tuningLabel(tuning)
);

const display = $derived<CagedDisplay>(
  buildCagedModel(view, instrument, { tuningName: effectiveName, temporary }, transition, {
    reveal,
    layerChange,
    triadChange
  })
);

/**
 * After a focus clear, bring Chord back when nothing else is drawable (FR-002). Reads the view
 * only, so it is safe to call after any focus change.
 */
function settleLayers(): void {
  const { layers, restoredChord } = ensureDrawable(view.layers, view.focus !== null);
  if (restoredChord) {
    view = setLayers(view, layers);
    layerChange = { layer: 'chord', on: true };
  }
  settleTriad();
}

/**
 * Keep the Triad set valid for the focused occurrence (R-05). A set that became unavailable moves
 * to the default with an announcement and no reveal; when no set is available the stored set is
 * kept for the next shape and the unavailable state is announced. Reads the view only.
 */
function settleTriad(): void {
  if (!view.layers.triad || view.focus === null) return;
  const { set, moved } = settleTriadSet(view.triadSet, currentAvailability());
  if (moved && set !== null) {
    const from = view.triadSet ?? set;
    view = setTriadSet(view, set);
    triadChange = { kind: 'moved', set, from };
    return;
  }
  if (set !== view.triadSet) view = setTriadSet(view, set);
  if (set !== null && currentTriad() === null) triadChange = { kind: 'unavailable', set };
}

/** Triad availability of every string set for the focused occurrence. */
function currentAvailability(): ReturnType<typeof triadAvailability> {
  return triadAvailability(display.focused, instrument, cagedRootSpelling(view), view.quality);
}

/** The triad of the selected set for the focused occurrence, else null. */
function currentTriad(): ReturnType<typeof selectedTriad> {
  return selectedTriad(view.triadSet, currentAvailability());
}

/**
 * Stop a playing Listen sequence or timeline (R-09). A tapped single note is not a sequence and
 * keeps sounding through focus and layer changes.
 */
function stopListen(): void {
  if (playback.sequencePlaying) playback.stop('view');
}

/** Apply a transition; a changed view stops playback, a no-op does nothing. */
function apply(next: CagedViewState, stops: boolean = true): void {
  if (equalsCagedView(next, view)) return;
  clearTransition();
  clearLayerTransients();
  if (stops) playback.stop('view');
  view = next;
  settleLayers();
}

/** Commit a focus change without touching playback (contracts §5). */
function commitFocus(f: CagedViewState['focus']): void {
  const next = setFocus(view, f);
  if (next === view) return;
  stopListen();
  clearLayerTransients();
  view = next;
  settleLayers();
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
  /** What Listen is playing right now, else null (only while a sequence plays). */
  get listening(): ListenSource | null {
    return playback.sequencePlaying ? listenSource : null;
  },
  /** The Listen tempo. */
  get tempo(): Tempo {
    return tempo;
  },
  /**
   * Pick the Listen tempo. Invalid and equal values are ignored. Stops a playing sequence (the
   * pace is part of what is playing) and is remembered.
   */
  setTempo(t: Tempo): void {
    if (!isTempo(t) || t === tempo) return;
    stopListen();
    tempo = t;
    preferences.remember({ tempo: t });
  },
  /** Apply a remembered tempo: no playback stop, no write (010). */
  restoreTempo(t: Tempo): void {
    if (!isTempo(t)) return;
    tempo = t;
  },
  /** Play the widest layer on for the focused shape, or every shape. Gesture handler. */
  listen(): void {
    const plan = buildCagedListen({
      view,
      occurrences: display.occurrences,
      focusIndex: display.focusIndex,
      positions: display.positions,
      triad: currentTriad(),
      openPitches: instrument.openStrings.map(pitchOfSpelling),
      tempo
    });
    if (plan.kind === 'none') return;
    listenSource = plan.source;
    if (plan.kind === 'sequence') playback.sequence(plan.steps, plan.bpm, instrument);
    else playback.timeline(plan.events, instrument);
  },
  /** Tool-link carry: as if the user picked this key and quality; focus re-resolves (R-11). */
  carry(k: CagedCarry): void {
    apply(withResolvedFocus(carryIntoCaged(view, k)));
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
  /** Zone-D layer switches, by layer. */
  get switches(): Readonly<Record<CagedLayer, SwitchState>> {
    return display.switches;
  },
  /** Keys newly drawn by the last layer switch, else null. */
  get reveal(): CagedExtras['reveal'] {
    return reveal;
  },
  /** The last layer change to announce, else null. */
  get layerChange(): CagedExtras['layerChange'] {
    return layerChange;
  },
  /**
   * Flip one layer. A disabled switch does nothing. Not routed through `apply()`: layers never
   * stop playback (R-16).
   */
  toggleLayer(layer: CagedLayer): void {
    if (needsAutoFocus(view.layers, layer, view.focus)) {
      // Pentatonic and Scale draw only around a focus: focus the first occurrence (nearest the
      // nut) as a tag activation before toggling, so the reveal sees the new focus (data-model §9).
      commitFocus(focusOfIndex(0, display.occurrences));
    }
    const next = flipLayer(view.layers, layer, view.focus !== null, display.occurrences.length > 0);
    if (next === view.layers) return;
    stopListen();
    const before = display.positions;
    clearTransition();
    clearLayerTransients();
    view = setLayers(view, next);
    layerChange = { layer, on: next[layer] };
    if (layer === 'triad') {
      view = setTriadSet(view, next.triad ? defaultTriadSet(currentAvailability()) : null);
      if (next.triad) startReveal(triadRevealIds(currentTriad()));
      return;
    }
    if (next[layer]) startReveal(revealOrder(before, display.positions));
  },
  /**
   * Shortcut entry (R-12): leave the Triad layer on with the default string set and a shape in
   * focus. Off → the ordinary toggle (auto-focus nearest the nut). Already on → reset the set and
   * focus the first occurrence if none. A no-op in a non-compatible tuning.
   */
  showTriadLayer(): void {
    if (display.tuningClass === 'non-compatible') return;
    if (!view.layers.triad) {
      this.toggleLayer('triad');
      return;
    }
    if (view.focus === null) commitFocus(focusOfIndex(0, display.occurrences));
    if (view.focus === null) return;
    const set = defaultTriadSet(currentAvailability());
    if (set === null || set === view.triadSet) return;
    stopListen();
    view = setTriadSet(view, set);
    triadChange = { kind: 'selected', set };
    startReveal(triadRevealIds(currentTriad()));
  },
  /** The last Triad set change to announce, else null. */
  get triadChange(): CagedExtras['triadChange'] {
    return triadChange;
  },
  /**
   * Pick a Triad string set. A no-op while Triad is off, for an unavailable set or the set already
   * selected. Never stops playback (R-15).
   */
  selectTriadSet(id: StringSetId): void {
    if (!view.layers.triad || view.focus === null || view.triadSet === id) return;
    if (!currentAvailability().some((a) => a.set === id && a.triad !== null)) return;
    stopListen();
    clearTransition();
    clearLayerTransients();
    view = setTriadSet(view, id);
    triadChange = { kind: 'selected', set: id };
    startReveal(triadRevealIds(currentTriad()));
  },
  switchSpelling(): void {
    apply(switchSpelling(view));
  },
  reset(): void {
    clearLayerTransients();
    apply(resetCaged(preferredLabel));
  },
  /** Zone-E label control; remembered across reloads (`labels.caged`). */
  setLabelType(t: CagedLabelType): void {
    apply(setLabelType(view, t), false);
    if (view.labelType === t) preferredLabel = t;
    preferences.remember({ labels: { caged: t } });
  },
  /** Apply a remembered label type: no playback stop, no write (010). */
  restoreLabelType(t: CagedLabelType): void {
    if (!CAGED_LABEL_TYPES.includes(t)) return;
    preferredLabel = t;
    view = setLabelType(view, t);
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
  applyInstrument(next: Instrument, nextTuning: Tuning): boolean {
    const prev = display.focused;
    const prevFocus = view.focus;
    clearTransition();
    preferred = next;
    tuning = nextTuning;
    if (prevFocus === null) return false;
    const occs = cagedOccurrencesFor(view, instrument);
    const focus = reresolveFocus(prev, prevFocus, occs);
    commitFocus(focus);
    settleTriad();
    if (prev === null || focus === null) return false;
    const now = display.focused;
    return now !== null && (now.shape.id !== prev.shape.id || now.start !== prev.start);
  },
  /** Test-hook switch: stop playback (reason `instrument`), then apply. */
  useInstrument(next: Instrument, nextTuning: Tuning = tuning): void {
    if (next === preferred && nextTuning === tuning) return;
    playback.stop('instrument');
    this.applyInstrument(next, nextTuning);
  },
  /** Show the same key in the standard tuning; only from the non-compatible notice. */
  viewInStandard(): void {
    if (temporary || display.tuningClass !== 'non-compatible') return;
    playback.stop('instrument');
    temporary = true;
    clearTransition();
    clearFocusIfUnsupported();
    settleLayers();
  },
  /** Leave the temporary view (confirm, screen change). No-op when not temporary. */
  endTemporary(): void {
    if (!temporary) return;
    playback.stop('instrument');
    temporary = false;
    clearTransition();
    clearFocusIfUnsupported();
    settleTriad();
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
  nextTuning: Tuning = STANDARD_TUNING
): void {
  preferred = next;
  tuning = nextTuning;
  temporary = false;
  clearTransition();
  clearLayerTransients();
  preferredLabel = 'interval';
  tempo = DEFAULT_TEMPO;
  listenSource = null;
  view = initialCagedView(preferredLabel);
}
