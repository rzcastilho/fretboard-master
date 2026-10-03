/**
 * Instrument configuration and panel transitions (data-model §2–3,
 * contracts/instrument-config-api.md §2). Pure: no Svelte, i18n or DOM.
 * No-op transitions return the same object.
 */
import type { Instrument } from '$lib/instrument/instrument';
import {
  DEFAULT_FRETS,
  DEFAULT_TUNING_ID,
  clampFrets,
  isTuningId,
  presetInstrument,
  type TuningId
} from '$lib/instrument/tunings';

export interface InstrumentConfig {
  readonly tuningId: TuningId;
  /** Integer, MIN_FRETS ≤ fretCount ≤ MAX_FRETS. */
  readonly fretCount: number;
}

export type PanelState =
  { readonly open: false } | { readonly open: true; readonly pending: InstrumentConfig };

export const DEFAULT_CONFIG: InstrumentConfig = Object.freeze({
  tuningId: DEFAULT_TUNING_ID,
  fretCount: DEFAULT_FRETS
});

export const CLOSED: PanelState = Object.freeze({ open: false });

export function equalsConfig(a: InstrumentConfig, b: InstrumentConfig): boolean {
  return a.tuningId === b.tuningId && a.fretCount === b.fretCount;
}

export function instrumentOf(c: InstrumentConfig): Instrument {
  return presetInstrument(c.tuningId, c.fretCount);
}

export function openPanel(p: PanelState, active: InstrumentConfig): PanelState {
  return p.open ? p : { open: true, pending: active };
}

function withPending(p: PanelState, next: InstrumentConfig): PanelState {
  if (!p.open || equalsConfig(p.pending, next)) return p;
  return { open: true, pending: next };
}

export function selectTuning(p: PanelState, id: TuningId): PanelState {
  if (!p.open || !isTuningId(id)) return p;
  return withPending(p, { ...p.pending, tuningId: id });
}

export function setFrets(p: PanelState, n: number): PanelState {
  if (!p.open) return p;
  return withPending(p, { ...p.pending, fretCount: clampFrets(n) });
}

export function stepFrets(p: PanelState, delta: 1 | -1): PanelState {
  if (!p.open) return p;
  return setFrets(p, p.pending.fretCount + delta);
}

export function restoreDefault(p: PanelState): PanelState {
  return withPending(p, DEFAULT_CONFIG);
}

export function cancelPanel(p: PanelState): PanelState {
  return p.open ? CLOSED : p;
}

export function confirmPanel(
  p: PanelState,
  active: InstrumentConfig
): { readonly panel: PanelState; readonly next: InstrumentConfig; readonly changed: boolean } {
  if (!p.open) return { panel: p, next: active, changed: false };
  return { panel: CLOSED, next: p.pending, changed: !equalsConfig(p.pending, active) };
}
