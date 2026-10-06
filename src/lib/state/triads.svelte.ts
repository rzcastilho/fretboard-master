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
  revalidate,
  selectRoot,
  seeAllNotes,
  selectShape,
  setCompare,
  setCompareQuality,
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
import type { PitchClass, Spelling } from '$lib/theory/pitch';
import type { Quality } from '$lib/theory/triad';
import type { Inversion } from '$lib/theory/triad-shape';
import type { StringSetId } from '$lib/instrument/string-sets';
import { carryCagedTriad, carryRoot, carryTriad } from './links';
import type { TriadsHandoff } from './caged-triad';
import { playback } from './playback.svelte';
import { preferences } from './preferences.svelte';
import type { SpellingOverride } from './triads-view';
import { LISTEN_BPM } from './listen';

/** Remembered label type: part of the initial view and of `reset()` (010). */
let preferredLabel: TriadsLabelType = 'interval';

const initialView = (i: Instrument): TriadsViewState => ({
  ...initialTriadsView(i),
  labelType: preferredLabel
});

let view = $state<TriadsViewState>(initialView(STANDARD_GUITAR));
let instrument = $state.raw<Instrument>(STANDARD_GUITAR);

/** One-line, non-blocking message about the last applied change (A2). */
export type TriadsNotice =
  | { readonly kind: 'compare-swapped'; readonly quality: Quality }
  | { readonly kind: 'compare-off-for-shape' }
  | { readonly kind: 'compare-omitted'; readonly notes: readonly Spelling[] }
  | null;

let notice = $state.raw<TriadsNotice>(null);

const display = $derived<TriadsDisplay>(buildTriadsModel(view, instrument));

/** Apply a transition; a changed view stops playback (FR-028), a no-op does nothing. */
function apply(next: TriadsViewState, message: TriadsNotice = null): void {
  if (equalsTriadsView(next, view)) return;
  playback.stop('view');
  view = next;
  notice = message;
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
  get notice(): TriadsNotice {
    return notice;
  },
  dismissNotice(): void {
    notice = null;
  },
  selectRoot(pc: PitchClass): void {
    apply(selectRoot(view, pc));
  },
  setQuality(q: Quality): void {
    const prev = view;
    const next = setQuality(prev, q);
    const swapped =
      next.compare.on &&
      next.compare.quality === prev.quality &&
      next.quality === prev.compare.quality;
    apply(next, swapped ? { kind: 'compare-swapped', quality: prev.quality } : null);
  },
  /** Notes → Triads carry: root only (FR-001). */
  carryRoot(pc: PitchClass): void {
    apply(carryRoot(view, pc));
  },
  /** View as triad: root, spelling and quality (FR-008); raises compare-swapped when swapped. */
  carryTriad(pc: PitchClass, q: Quality, spelling: SpellingOverride): void {
    const prev = view;
    const next = carryTriad(prev, pc, q, spelling, instrument);
    const swapped =
      next.compare.on &&
      next.compare.quality === prev.quality &&
      next.quality === prev.compare.quality;
    apply(next, swapped ? { kind: 'compare-swapped', quality: prev.quality } : null);
  },
  /** CAGED "Open in Triads": land on the drawn triad; Compare goes off when its pair does not fit. */
  carryCagedTriad(h: TriadsHandoff): void {
    const { state, compareOff } = carryCagedTriad(view, h, instrument);
    apply(state, compareOff ? { kind: 'compare-off-for-shape' } : null);
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
    apply({ ...resetTriads(instrument), labelType: preferredLabel });
    notice = null;
  },
  setLabelType(t: TriadsLabelType): void {
    apply(setLabelType(view, t));
    preferences.remember({ labels: { triads: t } });
  },
  /** Apply a remembered label type: no playback stop, no write (010). */
  restoreLabelType(t: TriadsLabelType): void {
    preferredLabel = t;
    view = setLabelType(view, t);
  },
  /** Compare on/off (S2, S3). */
  setCompare(on: boolean): void {
    apply(setCompare(view, on, instrument));
  },
  /** Pick the comparison quality (S4). */
  setCompareQuality(q: Quality): void {
    apply(setCompareQuality(view, q, instrument));
  },
  octaveUp(): void {
    apply(octaveUp(view, instrument));
  },
  octaveDown(): void {
    apply(octaveDown(view, instrument));
  },
  /**
   * Apply an instrument: keep the whole view, revalidate (clamp occurrence / string set).
   * Returns whether the view changed. Never stops playback (the orchestrator does).
   */
  applyInstrument(next: Instrument): boolean {
    if (next === instrument) return false;
    instrument = next;
    const revalidated = revalidate(view, next);
    const adjusted = revalidated !== view;
    view = revalidated;
    if (adjusted) notice = null;
    return adjusted;
  },
  /** Test-hook switch: stop playback (reason `instrument`), then apply. */
  useInstrument(next: Instrument): void {
    if (next === instrument) return;
    playback.stop('instrument');
    this.applyInstrument(next);
  },
  /**
   * Open a received link's view (023): startup only. Revalidates against the current instrument;
   * no playback stop, no write, `preferredLabel` untouched; clears any notice.
   */
  receive(next: TriadsViewState): void {
    view = revalidate(next, instrument);
    notice = null;
  },
  /** Sound the shape low → mid → high, then the block (new `sequence` interrupts; no `stop`). */
  listen(): void {
    if (!display.listen.enabled) return;
    playback.sequence(display.listenSteps, LISTEN_BPM, instrument);
  },
  /** First triad, a rest, then the comparison triad; names any off-board notes (R-10). */
  listenComparison(): void {
    const lc = display.listenComparison;
    if (!lc.enabled) return;
    playback.sequence(lc.steps, LISTEN_BPM, instrument);
    // sequence() interrupts without a view change; the notice is set after it, never cleared by it.
    notice = lc.omitted.length > 0 ? { kind: 'compare-omitted', notes: lc.omitted } : null;
  },
  /** Fretboard tap: sound the position; no state change. `note` interrupts playback itself. */
  activate(p: Position): void {
    playback.note(p, instrument);
  }
};

/** Test seam: restore the initial view for `instrument` (Vitest only). */
export function resetTriadsForTests(next: Instrument = STANDARD_GUITAR): void {
  instrument = next;
  preferredLabel = 'interval';
  view = initialView(next);
  notice = null;
}
