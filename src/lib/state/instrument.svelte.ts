/**
 * App-wide instrument store (contracts/instrument-config-api.md §3, data-model §4).
 * Runes singleton (ADR 0008): survives navigation, resets on reload. Nothing is written
 * to storage or the URL (FR-018).
 */
import type { Instrument } from '$lib/instrument/instrument';
import type { TuningId } from '$lib/instrument/tunings';
import type { ScreenId } from '$lib/shell/screens';
import type { ToolId } from '$lib/shell/tools';
import {
  CLOSED,
  DEFAULT_CONFIG,
  cancelPanel,
  confirmPanel,
  instrumentOf,
  openPanel,
  restoreDefault,
  selectTuning,
  setFrets,
  stepFrets,
  type InstrumentConfig,
  type PanelState
} from './instrument-config';
import { notes } from './notes.svelte';
import { playback } from './playback.svelte';
import { triads } from './triads.svelte';

let active = $state.raw<InstrumentConfig>(DEFAULT_CONFIG);
let panel = $state.raw<PanelState>(CLOSED);
let adjustedIn = $state.raw<ToolId | null>(null);

const current = $derived<Instrument>(instrumentOf(active));
const preview = $derived<Instrument | null>(panel.open ? instrumentOf(panel.pending) : null);

export const instrument = {
  get active(): InstrumentConfig {
    return active;
  },
  get current(): Instrument {
    return current;
  },
  get panel(): PanelState {
    return panel;
  },
  get preview(): Instrument | null {
    return preview;
  },
  get adjustedIn(): ToolId | null {
    return adjustedIn;
  },
  /** Panel state only; opener focus is handled by the component. */
  open(): void {
    panel = openPanel(panel, active);
  },
  selectTuning(id: TuningId): void {
    panel = selectTuning(panel, id);
  },
  stepFrets(delta: 1 | -1): void {
    panel = stepFrets(panel, delta);
  },
  setFrets(n: number): void {
    panel = setFrets(panel, n);
  },
  restoreDefault(): void {
    panel = restoreDefault(panel);
  },
  cancel(): void {
    panel = cancelPanel(panel);
  },
  /** Orchestration (data-model §4): apply once, stop playback once, notify the shown tool. */
  confirm(screen: ScreenId): void {
    const result = confirmPanel(panel, active);
    panel = result.panel;
    adjustedIn = null; // R-05: a new confirm replaces any earlier notice
    if (!result.changed) return;
    playback.stop('instrument');
    active = result.next;
    const inst = instrumentOf(result.next);
    const adjNotes = notes.applyInstrument(inst);
    const adjTriads = triads.applyInstrument(inst);
    adjustedIn =
      screen === 'notes' && adjNotes ? 'notes' : screen === 'triads' && adjTriads ? 'triads' : null;
  },
  dismissAdjusted(): void {
    adjustedIn = null;
  },
  /** A real screen change (not a shallow pop) drops the adjustment notice (R-05). */
  screenChanged(): void {
    adjustedIn = null;
  }
};

/** Test seam: restore the initial state (Vitest only). */
export function resetInstrumentForTests(): void {
  active = DEFAULT_CONFIG;
  panel = CLOSED;
  adjustedIn = null;
}
