import type { AudioLogEntry } from './types';

/** Test builds only: append to `__fmAudioLog` (never read by app code). */
export function log(entry: AudioLogEntry): void {
  if (__FM_FAULT_INJECTION__) (globalThis.__fmAudioLog ??= []).push(entry);
}
