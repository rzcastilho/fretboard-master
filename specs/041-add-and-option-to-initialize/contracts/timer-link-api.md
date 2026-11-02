# Contract: Timer link store and store seams (041)

TypeScript surface added by this slice. Bodies are implementation detail; behaviour is
[data-model.md §3](../data-model.md).

## `src/lib/state/timer-link.svelte.ts` (new)

```ts
export const timerLink: {
  /** Reactive; drives the switch's aria-checked. */
  readonly enabled: boolean;
  /** Gesture: set the switch and remember it. Non-booleans are ignored. Off cancels a pending start. */
  setEnabled(on: unknown): void;
  /** Apply a stored or erased value without writing; connects the observers (idempotent). */
  restore(on: unknown): void;
};

/** Vitest only: disconnect, reset to off, then reconnect to the (already reset) stores. */
export function resetTimerLinkForTests(): void;
```

## `src/lib/state/metronome.svelte.ts` (additions)

```ts
export type RunClick = 'count-in' | 'beat';

export interface RunObserver {
  /** settings → starting, inside the start gesture. */
  started(): void;
  /** A click became audible (the existing onBeat / onCountIn points). */
  clicked(kind: RunClick): void;
  /** running → paused, by the user or by an audio suspend. */
  paused(): void;
  /** A non-settings phase returned to settings by reset, halt or onEnd. Not by stopForTimer. */
  stopped(): void;
}

metronome.observeRun(observer: RunObserver | null): void;
/** Halt a starting/running/paused run to settings, values kept, no announcement, no `stopped`. */
metronome.stopForTimer(): void;
```

Rules:
- Resume (`paused → starting`) reports nothing until its first `clicked`.
- `halt()` reports `stopped` only if the phase before it was not `settings`.
- With no observer, behaviour and announcements are byte-identical to 038/039.

## `src/lib/state/timer.svelte.ts` (additions)

```ts
timer.arm(): void;          // stopped at full duration, capture sink (gesture), armed = true
timer.startArmed(): void;   // if armed: play from full duration; armed = false
timer.disarm(): void;       // armed = false
timer.hold(): void;         // if running: pause, held = true
timer.release(): void;      // if held && paused: play from reading; held = false
timer.onFinished(listener: (() => void) | null): void; // called once at the end of finish()
```

Existing `toggle()`, `selectPreset()` and `restore()` additionally clear `armed` and `held`. The
timer still never imports the metronome (039 R-01).

## Wiring

`preferences.start()` → `timerLink.restore(p.metronome.timerLink)` (after `metronome.restore` and
`timer.restore`). `preferences.erase()` → `timerLink.restore(false)`.
