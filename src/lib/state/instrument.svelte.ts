/**
 * App-wide instrument store (contracts/instrument-config-api.md §3, data-model §4).
 * Runes singleton (ADR 0008): survives navigation, resets on reload. Nothing is written
 * to storage or the URL (FR-018).
 */
import { canStep, type StringNumber } from '$lib/instrument/custom-tuning';
import type { Instrument } from '$lib/instrument/instrument';
import { offsetsOfTuning, tuningStrings, type TuningId } from '$lib/instrument/tunings';
import type { SpelledPitch } from '$lib/theory/pitch';
import type { ScreenId } from '$lib/shell/screens';
import type { ToolId } from '$lib/shell/tools';
import {
  CLOSED,
  DEFAULT_CONFIG,
  cancelPanel,
  chooseCustom,
  confirmPanel,
  equalsConfig,
  instrumentOf,
  openPanel,
  restoreDefault,
  selectTuning,
  setFrets,
  stepFrets,
  stepString,
  type InstrumentConfig,
  type PanelState
} from './instrument-config';
import { notes } from './notes.svelte';
import { playback } from './playback.svelte';
import { preferences } from './preferences.svelte';
import { triads } from './triads.svelte';

let active = $state.raw<InstrumentConfig>(DEFAULT_CONFIG);
let panel = $state.raw<PanelState>(CLOSED);
let adjustedIn = $state.raw<ToolId | null>(null);

const current = $derived<Instrument>(instrumentOf(active));
const preview = $derived<Instrument | null>(panel.open ? instrumentOf(panel.pending) : null);

/** One row of the custom tuning editor (string 6 first). */
export interface StringRow {
  readonly string: StringNumber;
  readonly pitch: SpelledPitch;
  readonly canLower: boolean;
  readonly canRaise: boolean;
}

const ROW_ORDER: readonly StringNumber[] = [6, 5, 4, 3, 2, 1];

const customRows = $derived<readonly StringRow[]>(
  panel.open && panel.customOpen
    ? (() => {
        const offsets = offsetsOfTuning(panel.pending.tuning);
        const spelled = tuningStrings(panel.pending.tuning);
        return ROW_ORDER.map((string, i) => ({
          string,
          pitch: spelled[i],
          canLower: canStep(offsets, string, -1),
          canRaise: canStep(offsets, string, 1)
        }));
      })()
    : []
);

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
  /** Custom radio chosen for this panel session (string rows shown). */
  get customOpen(): boolean {
    return panel.open && panel.customOpen;
  },
  /** Radio value to check: 'custom' or a preset id; null when closed. */
  get selectedRadio(): TuningId | 'custom' | null {
    if (!panel.open) return null;
    if (panel.customOpen) return 'custom';
    return panel.pending.tuning.kind === 'preset' ? panel.pending.tuning.id : 'custom';
  },
  get rows(): readonly StringRow[] {
    return customRows;
  },
  /** Panel state only; opener focus is handled by the component. */
  open(): void {
    panel = openPanel(panel, active);
  },
  selectTuning(id: TuningId): void {
    panel = selectTuning(panel, id);
  },
  chooseCustom(): void {
    panel = chooseCustom(panel);
  },
  /** Returns true iff the pitch changed (caller plays it / checks focus). */
  stepString(string: StringNumber, delta: 1 | -1): boolean {
    const next = stepString(panel, string, delta);
    if (next === panel) return false;
    panel = next;
    return true;
  },
  /** Sound the pending open string (US2); no-op while closed. Call from a gesture handler. */
  playString(string: StringNumber): void {
    if (!preview) return;
    playback.note({ string, fret: 0 }, preview);
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
    const tuning = result.next.tuning;
    preferences.remember({
      tuningId: tuning.kind === 'preset' ? tuning.id : 'AF-1',
      customTuning: tuning.kind === 'custom' ? tuning.offsets : null,
      fretCount: result.next.fretCount
    });
    const inst = instrumentOf(result.next);
    const adjNotes = notes.applyInstrument(inst);
    const adjTriads = triads.applyInstrument(inst);
    adjustedIn =
      screen === 'notes' && adjNotes ? 'notes' : screen === 'triads' && adjTriads ? 'triads' : null;
  },
  /**
   * Apply a remembered config at startup (010): same path as Confirm, but no notice, no
   * playback stop and no write.
   */
  restore(config: InstrumentConfig): void {
    if (equalsConfig(config, active)) return;
    active = config;
    const inst = instrumentOf(config);
    notes.applyInstrument(inst);
    triads.applyInstrument(inst);
    adjustedIn = null;
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
