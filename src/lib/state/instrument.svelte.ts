/**
 * App-wide instrument store (contracts/instrument-config-api.md §3, data-model §4).
 * Runes singleton (ADR 0008): survives navigation, resets on reload. Nothing is written
 * to storage or the URL (FR-018).
 */
import { canStep, type StringNumber } from '$lib/instrument/custom-tuning';
import type { Handedness, Instrument, Orientation } from '$lib/instrument/instrument';
import {
  equalsTuning,
  offsetsOfTuning,
  presetStrings,
  presetsFor,
  standardTuningId,
  tuningStrings,
  type StringCount,
  type TuningId
} from '$lib/instrument/tunings';
import { musicalOf, type LinkInstrument } from '$lib/link/types';
import { measure } from '$lib/measure/measure.svelte';
import type { SpelledPitch } from '$lib/theory/pitch';
import type { ScreenId } from '$lib/shell/screens';
import type { FretboardToolId, ToolId } from '$lib/shell/tools';
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
import { cagedTuningClass } from '$lib/theory/caged';
import { sixHighestOpen } from './caged-model';
import { notes } from './notes.svelte';
import { playback } from './playback.svelte';
import { preferences } from './preferences.svelte';
import { caged } from './caged.svelte';
import { triads } from './triads.svelte';

let active = $state.raw<InstrumentConfig>(DEFAULT_CONFIG);
let panel = $state.raw<PanelState>(CLOSED);
let adjustedIn = $state.raw<ToolId | null>(null);

/**
 * Session instrument override (023 data-model §2): a received link whose instrument differs from
 * the stored one is drawn on the link's instrument in the opened tool only. Never persisted.
 */
export interface InstrumentOverride {
  /** The opened tool: the only store on the link instrument. */
  readonly tool: ToolId;
  /** CAGED: the preferred instrument (`sc`/`tu`/`fr`), not the temporary one. */
  readonly link: LinkInstrument;
  /** String count or tuning differs from stored: show the instrument notice. False = frets only. */
  readonly notice: boolean;
}

let override = $state.raw<InstrumentOverride | null>(null);
/** The instrument notice is hidden for the current visit only. */
let overrideDismissed = $state.raw(false);

const sameMusical = (a: LinkInstrument, b: LinkInstrument): boolean =>
  a.stringCount === b.stringCount &&
  a.fretCount === b.fretCount &&
  equalsTuning(a.tuning, b.tuning);

/** The one place a confirmed instrument is written to storage (confirm; adopt). */
function persist(config: InstrumentConfig): void {
  const tuning = config.tuning;
  preferences.remember({
    stringCount: config.stringCount,
    tuningId: tuning.kind === 'preset' ? tuning.id : standardTuningId(config.stringCount),
    customTuning: tuning.kind === 'custom' ? tuning.offsets : null,
    fretCount: config.fretCount,
    handedness: config.handedness,
    orientation: config.orientation
  });
}

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
  get override(): InstrumentOverride | null {
    return override;
  },
  get overrideDismissed(): boolean {
    return overrideDismissed;
  },
  /** The instrument notice to show for `tool` now, else null. */
  overrideNoticeFor(tool: FretboardToolId): InstrumentOverride | null {
    return override !== null && override.tool === tool && override.notice && !overrideDismissed
      ? override
      : null;
  },
  /** Musical instrument `tool` is drawn with: the link's while overridden, else the stored one. */
  effectiveFor(tool: ToolId): LinkInstrument {
    return override !== null && override.tool === tool ? override.link : musicalOf(active);
  },
  /**
   * Startup only (023): draw `tool` on a received link's instrument. Writes nothing, stops no
   * playback and sets no adjustment notice. Does nothing when the link instrument is the stored one.
   */
  receive(tool: ToolId, link: LinkInstrument): void {
    if (sameMusical(link, musicalOf(active))) return;
    override = {
      tool,
      link,
      notice: link.stringCount !== active.stringCount || !equalsTuning(link.tuning, active.tuning)
    };
    overrideDismissed = false;
    // The viewer's own handedness and orientation still apply to the link's instrument.
    const inst = instrumentOf({
      ...link,
      handedness: active.handedness,
      orientation: active.orientation
    });
    if (tool === 'notes') notes.applyInstrument(inst);
    else if (tool === 'triads') triads.applyInstrument(inst);
    else caged.applyInstrument(inst, link.tuning);
  },
  /**
   * "Use mine" (023 I2): return the opened tool to the stored instrument. Writes nothing. The
   * nearest-equivalent notice shows only when the opened store reports an adjustment.
   */
  useMine(): void {
    const current = override;
    if (current === null) return;
    override = null;
    overrideDismissed = false;
    playback.stop('instrument');
    const inst = instrumentOf(active);
    const tool = current.tool;
    let adjusted: boolean;
    if (tool === 'notes') adjusted = notes.applyInstrument(inst);
    else if (tool === 'triads') adjusted = triads.applyInstrument(inst);
    else {
      // The temporary standard view only stays when the stored tuning has no shapes either.
      if (cagedTuningClass(sixHighestOpen(inst)) !== 'non-compatible') caged.endTemporary();
      adjusted = caged.applyInstrument(inst, active.tuning);
    }
    adjustedIn = adjusted ? tool : null;
  },
  /**
   * "Adopt this one" (023 I3): the link instrument becomes the stored one (the only write).
   * The opened view is already on it and stays untouched; the other tools follow, no notice.
   */
  adopt(): void {
    const current = override;
    if (current === null) return;
    override = null;
    overrideDismissed = false;
    active = { ...current.link, handedness: active.handedness, orientation: active.orientation };
    persist(active);
    const inst = instrumentOf(active);
    if (current.tool !== 'notes') notes.applyInstrument(inst);
    if (current.tool !== 'triads') triads.applyInstrument(inst);
    if (current.tool !== 'caged') caged.applyInstrument(inst, active.tuning);
    adjustedIn = null;
  },
  /** Hide the instrument notice for this visit; the override stays. */
  dismissOverrideNotice(): void {
    overrideDismissed = true;
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
    measure.instrumentEdited();
  },
  selectTuning(id: TuningId): void {
    panel = selectTuning(panel, id);
    measure.instrumentEdited();
  },
  chooseCustom(): void {
    panel = chooseCustom(panel);
    measure.instrumentEdited();
  },
  /** Returns true iff the pitch changed (caller plays it / checks focus). */
  stepString(string: StringNumber, delta: 1 | -1): boolean {
    const next = stepString(panel, string, delta);
    if (next === panel) return false;
    panel = next;
    measure.instrumentEdited();
    return true;
  },
  /** Sound the pending open string (US2); no-op while closed. Call from a gesture handler. */
  playString(string: StringNumber): void {
    if (!preview) return;
    playback.note({ string, fret: 0 }, preview);
  },
  stepFrets(delta: 1 | -1): void {
    panel = stepFrets(panel, delta);
    measure.instrumentEdited();
  },
  setFrets(n: number): void {
    panel = setFrets(panel, n);
    measure.instrumentEdited();
  },
  setHandedness(h: Handedness): void {
    panel = setHandedness(panel, h);
    measure.instrumentEdited();
  },
  setOrientation(o: Orientation): void {
    panel = setOrientation(panel, o);
    measure.instrumentEdited();
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
    // Cancel or no change keeps a received link's override and its temporary CAGED view (023 I4).
    if (result.changed || override === null) caged.endTemporary();
    panel = result.panel;
    adjustedIn = null; // R-05: a new confirm replaces any earlier notice
    if (!result.changed) return;
    override = null; // any confirmed change ends the override (023 R-04)
    active = result.next;
    const inst = instrumentOf(result.next);
    const tuning = result.next.tuning;
    persist(result.next);
    // 028: the panel actions above only edit the pending value; the traits change here.
    measure.instrumentEdited();
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
    const hadOverride = override !== null;
    override = null;
    // With an override the opened store is off the stored instrument: apply it even if equal.
    if (!hadOverride && equalsConfig(config, active)) return;
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
    overrideDismissed = false;
  }
};

/** Test seam: restore the initial state (Vitest only). */
export function resetInstrumentForTests(): void {
  active = DEFAULT_CONFIG;
  panel = CLOSED;
  adjustedIn = null;
  override = null;
  overrideDismissed = false;
}
