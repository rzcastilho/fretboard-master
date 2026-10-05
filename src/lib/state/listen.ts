/** Listen playback shared by Notes and Triads (R-07, FR-012). Pure. */
import type { Position } from '../instrument/instrument';

/** Listen tempo. */
export const LISTEN_BPM = 120;

/** One position, or several sounding together. */
export type ListenStep = Position | readonly Position[];

/** Listen tempo. */
export type Tempo = 'slow' | 'medium' | 'fast';

/** Tempos in UI order. */
export const TEMPOS: readonly Tempo[] = ['slow', 'medium', 'fast'];

export const DEFAULT_TEMPO: Tempo = 'medium';

/** Beats per minute for each tempo. */
export const TEMPO_BPM: Record<Tempo, number> = { slow: 80, medium: 120, fast: 180 };

/** Gap between strummed notes of a chord, in ms. */
export const STRUM_GAP_MS = 250;

/** Delay before the block chord, in ms. */
export const BLOCK_DELAY_MS = 500;

/** Gap between shapes when playing every shape, in ms. */
export const SHAPE_GAP_MS = 1500;

/** How long a note rings, in ms. Equals `NOTE_MS` in audio/schedule. */
export const RING_MS = 1500;

export function isTempo(x: unknown): x is Tempo {
  return x === 'slow' || x === 'medium' || x === 'fast';
}
