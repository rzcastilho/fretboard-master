/**
 * Tap tempo (038): pure measurement of BPM from tap timestamps. DOM-free; the run lives in the
 * store and is never persisted.
 */
import { clampBpm } from './metronome-settings';

/** Timestamps (ms) of the current run, oldest first; 0–8 entries. */
export type TapRun = readonly number[];

export const TAP_WINDOW = 8;
export const TAP_MIN_TAPS = 4;
export const TAP_MAX_GAP_MS = 2000;

export function tap(
  run: TapRun,
  atMs: number
): { readonly run: TapRun; readonly bpm: number | null } {
  if (typeof atMs !== 'number' || !Number.isFinite(atMs)) return { run: [], bpm: null };
  const last = run.length > 0 ? run[run.length - 1] : undefined;
  if (last === undefined || atMs < last || atMs - last > TAP_MAX_GAP_MS) {
    return { run: [atMs], bpm: null };
  }
  const next = [...run, atMs].slice(-TAP_WINDOW);
  const n = next.length;
  if (n < TAP_MIN_TAPS) return { run: next, bpm: null };
  const avg = (next[n - 1] - next[0]) / (n - 1);
  const bpm = avg <= 0 ? 300 : clampBpm(Math.round(60000 / avg));
  return { run: next, bpm };
}
