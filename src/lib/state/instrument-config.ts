/**
 * Instrument configuration and panel transitions (data-model §2–3,
 * contracts/instrument-config-api.md §2). Pure: no Svelte, i18n or DOM.
 * No-op transitions return the same object.
 */
import {
  HANDEDNESS,
  ORIENTATIONS,
  withPresentation,
  type Handedness,
  type Instrument,
  type Orientation
} from '$lib/instrument/instrument';
import {
  addSeventh,
  canStep,
  dropSeventh,
  stepOffsets,
  type StringNumber
} from '$lib/instrument/custom-tuning';
import {
  DEFAULT_FRETS,
  DEFAULT_STRING_COUNT,
  STANDARD_TUNING,
  clampFrets,
  equalsTuning,
  isStringCount,
  isTuningIdFor,
  offsetsOfTuning,
  tuningFromOffsets,
  tuningInstrument,
  type StringCount,
  type Tuning,
  type TuningId
} from '$lib/instrument/tunings';

export interface InstrumentConfig {
  /** 6 or 7. */
  readonly stringCount: StringCount;
  /** Canonical for `stringCount`: a custom value never matches a preset. */
  readonly tuning: Tuning;
  /** Integer, MIN_FRETS ≤ fretCount ≤ MAX_FRETS. */
  readonly fretCount: number;
  /** Presentation only (013): never changes pitches or positions. */
  readonly handedness: Handedness;
  /** Presentation only (013). */
  readonly orientation: Orientation;
}

export type PanelState =
  | { readonly open: false }
  | {
      readonly open: true;
      readonly pending: InstrumentConfig;
      /** Custom radio chosen for this panel session (rows shown). */
      readonly customOpen: boolean;
    };

export const DEFAULT_CONFIG: InstrumentConfig = Object.freeze({
  stringCount: DEFAULT_STRING_COUNT,
  tuning: STANDARD_TUNING,
  fretCount: DEFAULT_FRETS,
  handedness: 'right',
  orientation: 'highest-top'
});

export const CLOSED: PanelState = Object.freeze({ open: false });

export function equalsConfig(a: InstrumentConfig, b: InstrumentConfig): boolean {
  return (
    a.stringCount === b.stringCount &&
    equalsTuning(a.tuning, b.tuning) &&
    a.fretCount === b.fretCount &&
    a.handedness === b.handedness &&
    a.orientation === b.orientation
  );
}

/** Musical fields only; presentation is ignored. */
export function equalsMusical(a: InstrumentConfig, b: InstrumentConfig): boolean {
  return (
    a.stringCount === b.stringCount &&
    equalsTuning(a.tuning, b.tuning) &&
    a.fretCount === b.fretCount
  );
}

export function instrumentOf(c: InstrumentConfig): Instrument {
  return withPresentation(
    tuningInstrument(c.tuning, c.stringCount, c.fretCount),
    c.handedness,
    c.orientation
  );
}

export function openPanel(p: PanelState, active: InstrumentConfig): PanelState {
  return p.open ? p : { open: true, pending: active, customOpen: active.tuning.kind === 'custom' };
}

function withPending(
  p: PanelState,
  next: InstrumentConfig,
  customOpen: boolean = p.open && p.customOpen
): PanelState {
  if (!p.open || (equalsConfig(p.pending, next) && p.customOpen === customOpen)) return p;
  return { open: true, pending: next, customOpen };
}

/** 6 ↔ 7: string 7 is added as a copy of string 6's offset, or dropped; re-canonicalized. */
export function setStringCount(p: PanelState, n: number): PanelState {
  if (!p.open || !isStringCount(n) || n === p.pending.stringCount) return p;
  const o = offsetsOfTuning(p.pending.tuning, p.pending.stringCount);
  const tuning = tuningFromOffsets(n === 7 ? addSeventh(o) : dropSeventh(o));
  return withPending(p, { ...p.pending, stringCount: n, tuning });
}

export function selectTuning(p: PanelState, id: TuningId): PanelState {
  if (!p.open || !isTuningIdFor(id, p.pending.stringCount)) return p;
  return withPending(p, { ...p.pending, tuning: { kind: 'preset', id } }, false);
}

/** Show the string rows, starting from the current pending pitches. */
export function chooseCustom(p: PanelState): PanelState {
  return withPending(p, p.open ? p.pending : DEFAULT_CONFIG, true);
}

/** One semitone on one string; refused (same object) at a limit or outside custom mode. */
export function stepString(p: PanelState, string: StringNumber, delta: 1 | -1): PanelState {
  if (!p.open || !p.customOpen || string > p.pending.stringCount) return p;
  const offsets = offsetsOfTuning(p.pending.tuning, p.pending.stringCount);
  if (!canStep(offsets, string, delta)) return p;
  const tuning = tuningFromOffsets(stepOffsets(offsets, string, delta));
  return withPending(p, { ...p.pending, tuning });
}

export function setFrets(p: PanelState, n: number): PanelState {
  if (!p.open) return p;
  return withPending(p, { ...p.pending, fretCount: clampFrets(n) });
}

export function stepFrets(p: PanelState, delta: 1 | -1): PanelState {
  if (!p.open) return p;
  return setFrets(p, p.pending.fretCount + delta);
}

export function setHandedness(p: PanelState, h: Handedness): PanelState {
  if (!p.open || !HANDEDNESS.includes(h) || h === p.pending.handedness) return p;
  return withPending(p, { ...p.pending, handedness: h });
}

export function setOrientation(p: PanelState, o: Orientation): PanelState {
  if (!p.open || !ORIENTATIONS.includes(o) || o === p.pending.orientation) return p;
  return withPending(p, { ...p.pending, orientation: o });
}

export function restoreDefault(p: PanelState): PanelState {
  return withPending(p, DEFAULT_CONFIG, false);
}

export function cancelPanel(p: PanelState): PanelState {
  return p.open ? CLOSED : p;
}

export function confirmPanel(
  p: PanelState,
  active: InstrumentConfig
): {
  readonly panel: PanelState;
  readonly next: InstrumentConfig;
  readonly changed: boolean;
  readonly musicalChanged: boolean;
} {
  if (!p.open) return { panel: p, next: active, changed: false, musicalChanged: false };
  return {
    panel: CLOSED,
    next: p.pending,
    changed: !equalsConfig(p.pending, active),
    musicalChanged: !equalsMusical(p.pending, active)
  };
}
