/** Instrument traits sent with events and reports (specs/028 data-model §2–§3). Pure. */
import type { InstrumentConfig } from '$lib/state/instrument-config';
import type { InstrumentReport, InstrumentTraits } from './wire';

/** Preset id or `custom`; offsets and notes are never copied. */
export function traitsOf(c: InstrumentConfig): InstrumentTraits {
  return {
    strings: c.stringCount,
    tuning: c.tuning.kind === 'preset' ? c.tuning.id : 'custom',
    hand: c.handedness
  };
}

export function instrumentOf(c: InstrumentConfig): InstrumentReport {
  return { ...traitsOf(c), frets: c.fretCount };
}

export function sameTraits(a: InstrumentTraits, b: InstrumentTraits): boolean {
  return a.strings === b.strings && a.tuning === b.tuning && a.hand === b.hand;
}
