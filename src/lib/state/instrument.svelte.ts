/**
 * App-wide instrument store (contracts/instrument-config-api.md §3, data-model §4).
 * Runes singleton (ADR 0008): survives navigation, resets on reload. Nothing is written
 * to storage or the URL (FR-018).
 */
import { canStep, type StringNumber } from '$lib/instrument/custom-tuning';
import type { Handedness, Instrument, Orientation } from '$lib/instrument/instrument';
import {
  offsetsOfTuning,
  presetStrings,
  presetsFor,
  standardTuningId,
  tuningStrings,
  type StringCount,
  type TuningId
} from '$lib/instrument/tunings';
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
  setHandedness,
  setOrientation,
  setStringCount,
  stepFrets,
  stepString,
  type InstrumentConfig,
  type PanelState
} from './instrument-config';
import { notes } from './notes.svelte';
import { playback } from './playback.svelte';
import { preferences } from './preferences.svelte';
import { caged } from './caged.svelte';
import { triads } from './triads.svelte';

let active = $state.raw<InstrumentConfig>(DEFAULT_CONFIG);
let panel = $state.raw<PanelState>(CLOSED);
let adjustedIn = $state.raw<ToolId | null>(null);

const current = $derived<Instrument>(instrumentOf(active));
const preview = $derived<Instrument | null>(panel.open ? instrumentOf(panel.pending) : null);

/** One row of the custom tuning editor (string `count` first, string 1 last). */
export interface StringRow {
  readonly string: StringNumber;
  readonly pitch: SpelledPitch;
  readonly canLower: boolean;
  readonly canRaise: boolean;
}

/** One preset row of the tuning list: id and its open strings, lowest → highest. */
export interface PresetRow {
  readonly id: TuningId;
  readonly strings: readonly SpelledPitch[];
}

const presetRows = $derived<readonly PresetRow[]>(
  panel.open
    ? (() => {
        const count = panel.pending.stringCount;
        return presetsFor(count).map((id) => ({ id, strings: presetStrings(id, count) }));
      })()
    : []
);

const customRows = $derived<readonly StringRow[]>(
  panel.open && panel.customOpen
    ? (() => {
        const offsets = offsetsOfTuning(panel.pending.tuning, panel.pending.stringCount);
        const spelled = tuningStrings(panel.pending.tuning, panel.pending.stringCount);
        // Stored lowest → highest, which is string `count` → 1.
        return spelled.map((pitch, i) => {
          const string = (spelled.length - i) as StringNumber;
          return {
            string,
            pitch,
            canLower: canStep(offsets, string, -1),
            canRaise: canStep(offsets, string, 1)
          };
        });
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
  /** Pending string count while the panel is open, else the active one. */
  get stringCount(): StringCount {
    return panel.open ? panel.pending.stringCount : active.stringCount;
  },
  /** Preset rows for the pending string count; empty while closed. */
  get presets(): readonly PresetRow[] {
    return presetRows;
  },
  get rows(): readonly StringRow[] {
    return customRows;
  },
  /** Panel state only; opener focus is handled by the component. */
  open(): void {
    panel = openPanel(panel, active);
  },
  setStringCount(n: number): void {
    panel = setStringCount(panel, n);
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
  setHandedness(h: Handedness): void {
    panel = setHandedness(panel, h);
  },
  setOrientation(o: Orientation): void {
    panel = setOrientation(panel, o);
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
    caged.endTemporary();
    panel = result.panel;
    adjustedIn = null; // R-05: a new confirm replaces any earlier notice
    if (!result.changed) return;
    active = result.next;
    const inst = instrumentOf(result.next);
    const tuning = result.next.tuning;
    preferences.remember({
      stringCount: result.next.stringCount,
      tuningId: tuning.kind === 'preset' ? tuning.id : standardTuningId(result.next.stringCount),
      customTuning: tuning.kind === 'custom' ? tuning.offsets : null,
      fretCount: result.next.fretCount,
      handedness: result.next.handedness,
      orientation: result.next.orientation
    });
    if (!result.musicalChanged) {
      // Presentation only (FR-017): views and sound untouched, no notice.
      notes.applyInstrument(inst);
      triads.applyInstrument(inst);
      caged.applyInstrument(inst, tuning);
      return;
    }
    playback.stop('instrument');
    const adjNotes = notes.applyInstrument(inst);
    const adjTriads = triads.applyInstrument(inst);
    const adjCaged = caged.applyInstrument(inst, tuning);
    adjustedIn =
      screen === 'notes' && adjNotes
        ? 'notes'
        : screen === 'triads' && adjTriads
          ? 'triads'
          : screen === 'caged' && adjCaged
            ? 'caged'
            : null;
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
    caged.applyInstrument(inst, config.tuning);
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
