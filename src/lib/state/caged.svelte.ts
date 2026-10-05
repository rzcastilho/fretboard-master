/**
 * CAGED tool store (contracts/caged-api §4). Module singleton: survives navigation, resets on
 * reload. Imports only `caged-view`, `caged-model` and `state/playback.svelte`.
 */
import { STANDARD_GUITAR, type Instrument, type Position } from '$lib/instrument/instrument';
import { standardCounterpart, standardTuningId } from '$lib/instrument/tunings';
import { tuningName as presetName } from '$lib/shell/tuning-names';
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
let preferred = $state.raw<Instrument>(STANDARD_GUITAR);
let tuningName = $state<string>('Standard');
/** CAGED-local temporary standard view; never stored, never in the URL. */
let temporary = $state<boolean>(false);

/** Effective instrument: the standard counterpart while the temporary view is on. */
const instrument = $derived<Instrument>(temporary ? standardCounterpart(preferred) : preferred);

const effectiveName = $derived<string>(
  temporary ? presetName(standardTuningId(instrument.stringCount === 7 ? 7 : 6)) : tuningName
);

const display = $derived<CagedDisplay>(
  buildCagedModel(view, instrument, { tuningName: effectiveName, temporary })
);

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
  get temporary(): boolean {
    return temporary;
  },
  get temporaryName(): string | null {
    return display.temporaryName;
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
  applyInstrument(next: Instrument, name: string): boolean {
    preferred = next;
    tuningName = name;
    return false;
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
    playback.stop('instrument');
  },
  /** Leave the temporary view (confirm, screen change). No-op when not temporary. */
  endTemporary(): void {
    if (!temporary) return;
    temporary = false;
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
  view = initialCagedView();
}
