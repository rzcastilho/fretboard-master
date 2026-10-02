/** Listen playback shared by Notes and Triads (R-07, FR-012). Pure. */
import type { Position } from '../instrument/instrument';

/** Listen tempo. */
export const LISTEN_BPM = 120;

/** One position, or several sounding together. */
export type ListenStep = Position | readonly Position[];
