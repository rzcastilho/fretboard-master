import { m } from '$lib/paraglide/messages.js';
import type { Tuning, TuningId } from '$lib/instrument/tunings';

const NAMES: Readonly<Record<TuningId, () => string>> = {
  'AF-1': () => m.tuning_af1(),
  'AF-2': () => m.tuning_af2(),
  'AF-3': () => m.tuning_af3(),
  'AF-4': () => m.tuning_af4(),
  'AF-5': () => m.tuning_af5(),
  'AF-6': () => m.tuning_af6(),
  'AF-7': () => m.tuning_af7(),
  'AF-8': () => m.tuning_af8(),
  'AF-9': () => m.tuning_af9(),
  'AF-10': () => m.tuning_af10(),
  'AF-11': () => m.tuning_af11(),
  'AF-21': () => m.tuning_af21(),
  'AF-22': () => m.tuning_af22(),
  'AF-23': () => m.tuning_af23()
};

/** Localized preset name. */
export function tuningName(id: TuningId): string {
  return NAMES[id]();
}

/** Preset name, or "Custom" for an unmatched tuning. */
export function tuningLabel(t: Tuning): string {
  return t.kind === 'preset' ? tuningName(t.id) : m.tuning_custom();
}
