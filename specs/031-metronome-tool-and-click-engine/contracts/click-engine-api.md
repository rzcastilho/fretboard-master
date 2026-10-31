# Contract: Click engine (audio layer)

Scope: `src/lib/audio/click.ts`, `src/lib/audio/metronome.ts`, the engine addition in
`src/lib/audio/engine.ts`, and the playback store addition in `src/lib/state/playback.svelte.ts`.
The `src/lib/audio/**` modules import neither Svelte, `$app/*`, i18n, state, shell nor prefs
(existing eslint rule). Background for each choice is in [research.md](../research.md) R-01 to
R-09.

## 1. `click.ts` (pure)

```ts
export type ClickKind = 'accent' | 'normal';
export const CLICK_S = 0.03;                     // tick length
/** Never throws. Length = round(CLICK_S × sampleRate). Peak ≤ 0.9. */
export function renderClick(kind: ClickKind, sampleRate: number): Float32Array;
```

Guarantees, checked by unit tests:
- `accent`: dominant frequency 1600 Hz ± 2 %, peak 0.9 ± 0.01. `normal`: 1000 Hz ± 2 %,
  peak 0.55 ± 0.01. Accent peak / normal peak ≥ 1.5.
- The first sample is 0 (1 ms linear attack) and the last sample is ≤ 0.01 × peak.
- Deterministic: the same input gives the same output.

## 2. `metronome.ts`: the click scheduler

```ts
export const START_LEAD_S = 0.02;
export const HORIZON_S = 1.5;
export const TICK_MS = 25;

/** What the scheduler needs from an AudioContext; `null` = visual-only run. */
export interface ClickSink {
  readonly port: ClickPort;              // currentTime, state, sampleRate, outputLatency?, baseLatency?, resume(), createBuffer, createBufferSource
  readonly destination: AudioNode;       // the engine's volume gain (→ mute → out)
  readonly running: Promise<boolean>;    // true once resume() resolved; false if the unlock failed
}

export interface FrameClock {
  request(cb: () => void): number;       // requestAnimationFrame in the app
  cancel(id: number): void;
}

export interface SchedulerDeps {
  readonly sink: ClickSink | null;
  readonly clock: TimerClock;            // reused from engine.ts (now() in ms, setTimeout, clearTimeout)
  readonly frames: FrameClock;
}

export interface SchedulerEvents {
  /** Audible beat changed (1…beats). Called from a frame, never at scheduling time. */
  onBeat(beat: number): void;
  /** Audio could not be resumed after a suspension (R-07): the caller pauses. */
  onSuspended(): void;
  /** The sink resolved `running = false`: the run continues on the visual clock. */
  onSoundUnavailable(): void;
}

export interface SegmentStart { readonly bpm: number; readonly beats: number; readonly startBeat: number; readonly run: number; readonly pressedAtMs: number }

export interface ClickScheduler {
  /** Begins a segment. Anchors at clock + START_LEAD_S once the sink is running (or at once in visual mode). No-op if a segment is live. */
  start(segment: SegmentStart): void;
  /** Cancels every click whose `when` > now. Returns the last audible beat (0 if none). Idempotent. */
  halt(reason: 'pause' | 'reset' | 'leave' | 'suspend'): number;
  /** True while a segment is live (anchored or waiting for `running`). */
  readonly live: boolean;
}

export function createClickScheduler(events: SchedulerEvents, deps: SchedulerDeps): ClickScheduler;

/** Pure grid maths, exported for property tests. */
export function clickAt(seg: { anchor: number; period: number; startBeat: number; beats: number }, k: number): { index: number; when: number; beat: number; accent: boolean };
export function skipTo(seg: { anchor: number; period: number }, now: number): number;
```

Behavioural guarantees (each is a Vitest case with fakes; spec IDs in brackets):

| # | Guarantee |
|---|-----------|
| S1 | Click *k* is started at exactly `anchor + k·60/bpm` (difference ≤ 1e-9 s). Property-tested over BPM 30–300 and *k* ≤ 3000 [FR-014, SC-001, SC-002] |
| S2 | Every `source.start(when)` has `when ≥ port.currentTime` at the call [SC-003] |
| S3 | The first click of a segment has `when − currentTime(running) ≤ 0.05` [FR-015, SC-003] |
| S4 | With wakes only every 1000 ms for 60 s, every index 0…N is scheduled once, in order, none late [FR-016, SC-004] |
| S5 | `halt()` stops every pending source with `when > now`, and no `start` call follows until the next `start()` [FR-009] |
| S6 | Pausing at beat 3 of 4 and starting with `startBeat = 4` gives a first click with beat 4, accent false. The next click is beat 1, accent true [SC-006, FR-025] |
| S7 | A jump of `currentTime` by 30 s schedules no click with `when < now` and continues at `skipTo` [FR-026] |
| S8 | `onBeat` fires from a frame callback once `now − latency ≥ when`, never inside the scheduling call [FR-006] |
| S9 | A second `start()` while live does nothing. After `halt()`, stale timers and frames never schedule [FR-028] |
| S10 | `sink = null` → no `createBufferSource` call. `onBeat` still steps on `clock.now()` [FR-027] |
| S11 | `beats = 1` → every click has accent true and beat 1 [FR-020] |
| S12 | The two click buffers are created once per sink, not per click |

## 3. Engine addition (`engine.ts`)

```ts
export interface AudioSink { readonly port: AudioPort; readonly destination: AudioNode; readonly running: Promise<boolean> }

interface PlaybackEngine {
  /**
   * Unlocks (must be called in a user gesture) and hands out the shared context and its
   * volume→mute chain. `null` when audio is unavailable. Never part of the active request:
   * `stop()` (any reason, including 'hidden' and 'navigate') does not touch sources started on it.
   */
  sink(): AudioSink | null;
}
```

- `running` resolves `true` after the context's `resume()` resolves (or right away if it is
  already `running`), and `false` if `resume()` rejects or the engine is `failed`.
- `AudioPort` gains optional `outputLatency?: number` and `baseLatency?: number` (read-only).
- Test builds: the scheduler logs `click`/`click-cancel` entries through the same `__fmAudioLog`
  helper (moved to `src/lib/audio/log.ts` so both modules share it).

## 4. Playback store addition (`playback.svelte.ts`)

```ts
playback.clickSink(): AudioSink | null   // engine.sink() + markUnlocked(); call from a gesture
```

`playback.stop(reason)` is unchanged and does not affect the metronome (FR-016, FR-024).
`playback.sequencePlaying` is never set by the metronome, so the app-bar `StopButton` stays
hidden for the click (FR-024).
