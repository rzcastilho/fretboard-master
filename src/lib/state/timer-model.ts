/** Practice timer: pure model (039, contracts/timer-store-api.md §1). No Svelte, no DOM. */

export const TIMER_PRESETS: readonly number[] = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
export const DEFAULT_TIMER_MINUTES = 2;
/** How long the finished display flashes. */
export const FLASH_MS = 5000;
/** A chime later than this after zero (e.g. after a device sleep) is skipped. */
export const LATE_CHIME_LIMIT_MS = 2000;
/** Added to a tick delay so the callback lands just past the second boundary. */
export const TICK_SLACK_MS = 15;

export type TimerStatus = 'stopped' | 'running' | 'paused' | 'finished';
export type TimerAnnouncement =
  { kind: 'seconds'; count: number } | { kind: 'second' } | { kind: 'finished' } | null;

/** An integer 1–10, else `null`. */
export function toPreset(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 10 ? v : null;
}

/** Whole seconds shown for a remaining time: `max(0, ceil(ms / 1000))`; NaN → 0. */
export function secondsLeft(remainingMs: number): number {
  if (!(remainingMs > 0)) return 0;
  return Math.ceil(remainingMs / 1000);
}

/** `MM:SS`, clamped to 0–5999 seconds. */
export function formatReadout(seconds: number): string {
  const s = Number.isFinite(seconds) ? Math.min(5999, Math.max(0, Math.trunc(seconds))) : 0;
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** Milliseconds to wait so the callback lands just past the next whole-second boundary. */
export function nextTickDelay(remainingMs: number): number {
  return remainingMs - (secondsLeft(remainingMs) - 1) * 1000 + TICK_SLACK_MS;
}

export function shouldChime(lateMs: number): boolean {
  return lateMs <= LATE_CHIME_LIMIT_MS;
}

/** What to announce politely when the shown seconds change from `prev` to `next`. */
export function announcementFor(prev: number, next: number): TimerAnnouncement {
  if (next === prev || next > 10) return null;
  if (next === 0) return { kind: 'finished' };
  if (next === 1) return { kind: 'second' };
  return { kind: 'seconds', count: next };
}
