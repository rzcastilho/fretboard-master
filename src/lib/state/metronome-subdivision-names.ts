/** Translated subdivision names and option labels (032). */
import * as m from '$lib/paraglide/messages.js';
import type { Subdivision } from './metronome-settings';

const NAMES: Record<Subdivision, () => string> = {
  1: () => m.metronome_subdivision_1(),
  2: () => m.metronome_subdivision_2(),
  3: () => m.metronome_subdivision_3(),
  4: () => m.metronome_subdivision_4(),
  5: () => m.metronome_subdivision_5(),
  6: () => m.metronome_subdivision_6(),
  7: () => m.metronome_subdivision_7(),
  8: () => m.metronome_subdivision_8()
};

export const subdivisionName = (n: Subdivision): string => NAMES[n]();

/** `8th Triplets (3)`. */
export const subdivisionLabel = (n: Subdivision): string =>
  m.metronome_subdivision_option({ name: subdivisionName(n), count: n });
