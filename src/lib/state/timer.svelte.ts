/**
 * Practice timer run state (039, contracts/timer-store-api.md). A module singleton, so the
 * countdown survives mode tabs and route changes. It never imports the metronome store (R-01).
 */
import { playChime } from '$lib/audio/chime';
import { m } from '$lib/paraglide/messages.js';
import { recordFailure } from '$lib/shell/failure';
import {
  announcementFor,
  DEFAULT_TIMER_MINUTES,
  FLASH_MS,
  formatReadout,
  nextTickDelay,
  secondsLeft,
  shouldChime,
  toPreset,
  type TimerStatus
} from './timer-model';
import { playback } from './playback.svelte';
import { preferences } from './preferences.svelte';

/** The shared sink; only the playback store may import the engine, so the type comes via the chime. */
type AudioSink = Parameters<typeof playChime>[0];

export interface TimerDeps {
  clock: {
    now(): number;
    setTimeout(cb: () => void, ms: number): number;
    clearTimeout(id: number): void;
  };
  /** Called inside the play gesture. Default: `playback.clickSink()`. */
  sink: () => AudioSink | null;
  /** Default: `playChime`. */
  chime: (sink: AudioSink, lateMs: number) => boolean;
}

function realDeps(): TimerDeps {
  return {
    clock: {
      now: () => performance.now(),
      setTimeout: (cb, ms) => window.setTimeout(cb, ms),
      clearTimeout: (id) => window.clearTimeout(id)
    },
    sink: () => playback.clickSink(),
    chime: playChime
  };
}

const state = $state<{
  preset: number;
  status: TimerStatus;
  remainingMs: number;
  seconds: number;
  flashing: boolean;
  announcement: string;
}>({
  preset: DEFAULT_TIMER_MINUTES,
  status: 'stopped',
  remainingMs: DEFAULT_TIMER_MINUTES * 60_000,
  seconds: DEFAULT_TIMER_MINUTES * 60,
  flashing: false,
  announcement: ''
});

let deps: TimerDeps | null = null;
let endsAt = 0;
let sink: AudioSink | null = null;
let displayTimer: number | null = null;
let endTimer: number | null = null;
let flashTimer: number | null = null;

const d = (): TimerDeps => (deps ??= realDeps());

function clearTimers(): void {
  const { clock } = d();
  if (displayTimer !== null) clock.clearTimeout(displayTimer);
  if (endTimer !== null) clock.clearTimeout(endTimer);
  if (flashTimer !== null) clock.clearTimeout(flashTimer);
  displayTimer = endTimer = flashTimer = null;
}

/** Stopped at the full duration of `minutes`; the shared reset path. */
function resetTo(minutes: number): void {
  clearTimers();
  state.preset = minutes;
  state.status = 'stopped';
  state.remainingMs = minutes * 60_000;
  state.seconds = secondsLeft(state.remainingMs);
  state.flashing = false;
  state.announcement = '';
}

/** Set the polite announcement for a change of the shown seconds (R-06 catalog). */
function announce(prev: number, next: number): void {
  const a = announcementFor(prev, next);
  if (!a) return;
  state.announcement =
    a.kind === 'finished'
      ? m.timer_announce_finished()
      : a.kind === 'second'
        ? m.timer_announce_second()
        : m.timer_announce_seconds({ count: a.count });
}

function finish(): void {
  const { clock, chime } = d();
  const lateMs = clock.now() - endsAt;
  clearTimers();
  state.status = 'finished';
  state.remainingMs = 0;
  announce(state.seconds, 0);
  state.seconds = 0;
  state.flashing = true;
  flashTimer = clock.setTimeout(() => {
    flashTimer = null;
    state.flashing = false;
  }, FLASH_MS);
  if (sink && shouldChime(lateMs)) {
    try {
      chime(sink, lateMs);
    } catch (error) {
      // Audio failure must not affect the timer (FR-008): it finishes silently, visibly.
      recordFailure(null, error, 'audio');
    }
  }
}

function tick(): void {
  displayTimer = null;
  if (state.status !== 'running') return;
  const { clock } = d();
  const remaining = endsAt - clock.now();
  if (remaining <= 0) {
    finish();
    return;
  }
  const next = secondsLeft(remaining);
  announce(state.seconds, next);
  state.seconds = next;
  displayTimer = clock.setTimeout(tick, nextTickDelay(remaining));
}

function play(): void {
  const { clock } = d();
  state.status = 'running';
  state.flashing = false;
  state.announcement = '';
  endsAt = clock.now() + state.remainingMs;
  state.seconds = secondsLeft(state.remainingMs);
  displayTimer = clock.setTimeout(tick, nextTickDelay(state.remainingMs));
  endTimer = clock.setTimeout(() => {
    endTimer = null;
    if (state.status === 'running') finish();
  }, state.remainingMs);
}

export const timer = {
  get preset(): number {
    return state.preset;
  },
  get status(): TimerStatus {
    return state.status;
  },
  get seconds(): number {
    return state.seconds;
  },
  get readout(): string {
    return formatReadout(state.seconds);
  },
  get flashing(): boolean {
    return state.flashing;
  },
  get announcement(): string {
    return state.announcement;
  },
  /** Gesture: play, pause, or restart from the full duration after a finish. */
  toggle(): void {
    if (state.status === 'running') {
      state.remainingMs = Math.max(0, endsAt - d().clock.now());
      state.seconds = secondsLeft(state.remainingMs);
      clearTimers();
      state.announcement = '';
      state.status = 'paused';
      return;
    }
    // The unlock must happen in this call stack: it is the user's gesture.
    sink = d().sink();
    clearTimers();
    if (state.status === 'finished') state.remainingMs = state.preset * 60_000;
    play();
  },
  /** Choose a length: always resets to stopped at the full duration, and remembers it. */
  selectPreset(minutes: unknown): void {
    const n = toPreset(minutes);
    if (n === null) return;
    resetTo(n);
    preferences.remember({ metronome: { timer: n } });
  },
  /** Apply a remembered value: no write, invalid falls back to the default. */
  restore(minutes: unknown): void {
    resetTo(toPreset(minutes) ?? DEFAULT_TIMER_MINUTES);
  }
};

/** Test seam: replace deps, stop timers, reset to preset 2 / stopped. Vitest only. */
export function resetTimerForTests(overrides: Partial<TimerDeps> = {}): void {
  if (deps) clearTimers();
  deps = { ...realDeps(), ...overrides };
  sink = null;
  endsAt = 0;
  resetTo(DEFAULT_TIMER_MINUTES);
}
