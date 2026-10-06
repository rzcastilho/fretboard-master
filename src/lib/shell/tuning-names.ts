import { m } from '$lib/paraglide/messages.js';
import { noteLabel } from '$lib/notation/notation';
import type { Tuning, TuningId } from '$lib/instrument/tunings';

/** Open-string root of a parameterized preset name, in the active notation. */
const note = (letter: 'A' | 'C' | 'D' | 'E' | 'G'): string => noteLabel({ letter, accidental: 0 });

const NAMES: Readonly<Record<TuningId, () => string>> = {
  'AF-1': () => m.tuning_af1(),
  'AF-2': () => m.tuning_af2(),
  'AF-3': () => m.tuning_af3(),
  'AF-4': () => m.tuning_af4({ note: note('D') }),
  'AF-5': () => m.tuning_af5({ note: note('C') }),
  'AF-6': () => m.tuning_af6({ note: note('D') }),
  'AF-7': () => m.tuning_af7(),
  'AF-8': () => m.tuning_af8({ note: note('G') }),
  'AF-9': () => m.tuning_af9({ note: note('D') }),
  'AF-10': () => m.tuning_af10({ note: note('E') }),
  'AF-11': () => m.tuning_af11({ note: note('A') }),
  'AF-21': () => m.tuning_af21(),
  'AF-22': () => m.tuning_af22(),
  'AF-23': () => m.tuning_af23({ note: note('A') })
};

/** Localized preset name. */
export function tuningName(id: TuningId): string {
  return NAMES[id]();
}

/** Preset name, or "Custom" for an unmatched tuning. */
export function tuningLabel(t: Tuning): string {
  return t.kind === 'preset' ? tuningName(t.id) : m.tuning_custom();
}
