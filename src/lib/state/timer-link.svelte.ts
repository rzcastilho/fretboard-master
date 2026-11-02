/**
 * Timer link (041, contracts/timer-link-api.md). The only module that knows both the metronome
 * and the timer: it listens to the metronome's run observer and the timer's finish listener and
 * drives the other store through its public seam. Every reaction checks `enabled` at the event
 * (FR-016), so the switch can change mid-run. With the switch off nothing here does anything.
 */
import { metronome, type RunObserver } from './metronome.svelte';
import { preferences } from './preferences.svelte';
import { timer } from './timer.svelte';

let enabled = $state(false);
let connected = false;

/** Reactions are filled in by the user stories (US1: start/finish, US3: stop/pause/resume). */
const observer: RunObserver = {
  started() {
    if (enabled) timer.arm();
  },
  clicked(kind) {
    if (!enabled) return;
    timer.release();
    if (kind === 'beat') timer.startArmed();
  },
  paused() {
    if (enabled) timer.hold();
  },
  stopped() {
    if (enabled) timer.restore(timer.preset);
  }
};

function onTimerFinished(): void {
  if (enabled && metronome.phase !== 'settings') metronome.stopForTimer();
}

function connect(): void {
  if (connected) return;
  connected = true;
  metronome.observeRun(observer);
  timer.onFinished(onTimerFinished);
}

function disconnect(): void {
  connected = false;
  metronome.observeRun(null);
  timer.onFinished(null);
}

export const timerLink = {
  /** Reactive; drives the switch's aria-checked. */
  get enabled(): boolean {
    return enabled;
  },
  /** Gesture: set the switch and remember it. Non-booleans are ignored. Off cancels a pending start. */
  setEnabled(on: unknown): void {
    if (typeof on !== 'boolean') return;
    enabled = on;
    if (!on) timer.disarm();
    preferences.remember({ metronome: { timerLink: on } });
  },
  /** Apply a stored or erased value without writing; connects the observers (idempotent). */
  restore(on: unknown): void {
    enabled = on === true;
    connect();
  }
};

/** Vitest only: disconnect, reset to off, then reconnect to the (already reset) stores. */
export function resetTimerLinkForTests(): void {
  disconnect();
  enabled = false;
  connect();
}
