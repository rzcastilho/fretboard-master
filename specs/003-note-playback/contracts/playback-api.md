# Contract: Playback API (`src/lib/audio`, `src/lib/state/playback`)

**Feature**: `003-note-playback` | Types: [data-model.md](../data-model.md) | Research: R-01, R-07, R-08–R-12, R-15

This is the reusable interface that later tools (triads 005, CAGED Listen, arpeggios, scales) call.
They ask in musical terms, and they get time marks back synchronously. Exported functions have
explicit return types and never throw for expected input (constitution, Code quality).

## 1. Pure modules

### `src/lib/theory/pitch.ts` (addition)

```ts
/** 12-TET, A4 = 440 Hz, C4 = 60. */
export function frequencyOf(p: Pitch): number;
```

### `src/lib/audio/schedule.ts`

```ts
export const NOTE_MS = 1500;
export const MIN_BPM = 30;
export const MAX_BPM = 300;
export function clampBpm(bpm: number): number;                       // NaN/±∞ → 30 / 300 / 30
export function planRequest(request: PlaybackRequest, instrument: Instrument): Plan; // data-model §2–§4
```

### `src/lib/audio/pluck.ts`, `src/lib/audio/loudness.ts`

```ts
export const pluckSynth: Synth;                                       // data-model §7
export function aWeightedRms(samples: Float32Array, sampleRate: number, windowSamples: number): number;
```

### `src/lib/fretboard/pulse.ts`

```ts
export function applyPulses(markers: readonly Marker[], pulses: readonly Pulse[]): readonly DrawnMarker[]; // data-model §6 (renderer-internal)
```

## 2. Engine (`src/lib/audio/engine.ts`, Web Audio side, no Svelte)

```ts
export interface TimerClock {
  now(): number;
  setTimeout(cb: () => void, ms: number): number;
  clearTimeout(id: number): void;
}

/** Subset of BaseAudioContext the engine uses; a fake implements it in tests. */
export interface AudioPort {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly state: AudioContextState | 'interrupted';
  readonly destination: AudioNode;
  resume(): Promise<void>;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer;
  createBufferSource(): AudioBufferSourceNode;
  createGain(): GainNode;
}

export interface EngineDeps {
  createContext: () => AudioPort;   // default: () => new AudioContext({ latencyHint: 'interactive' }); may throw
  loadSynth: SynthLoader;           // default: () => Promise.resolve(pluckSynth)
  clock: TimerClock;                // default: window timers + performance.now
}

export interface EngineEvents {
  onPulseStart(p: Pulse): void;
  onPulseEnd(id: number): void;
  onSequenceChange(playing: boolean): void;
  onUnavailable(cause: 'context' | 'resume' | 'synth'): void;
}

export interface PlaybackEngine {
  /** Starts loading the synth without creating an AudioContext. Call after the fretboard is interactive. */
  preload(): void;
  /** Must be called from a user-gesture handler. Interrupts any active request (FR-011). */
  play(request: PlaybackRequest, instrument: Instrument): readonly TimeMark[];
  /** Unlocks audio without playing (sound-control interaction). */
  unlock(): void;
  stop(reason?: 'stop' | 'hidden' | 'navigate' | 'instrument' | 'view'): void;
  setMuted(muted: boolean): void;   // ramps 10 ms, affects sounding notes, never stops
  setVolume(volume: number): void;  // 0..100, gain (v/100)², ramps 10 ms
}

export function createPlaybackEngine(events: EngineEvents, deps?: Partial<EngineDeps>): PlaybackEngine;
```

Behavioral guarantees (each one is a Vitest case against a fake `AudioPort` and a fake `TimerClock`):

| # | Guarantee | Spec |
|---|---|---|
| E1 | `createContext` is never called before the first `play`/`unlock`. `preload` does not call it | FR-002, US1-4 |
| E2 | The first `play` creates the context, calls `resume()`, and schedules `start(when)` with `when = ctx.currentTime` in the same synchronous call (no awaiting, no look-ahead) | FR-002, FR-003, SC-001, SC-002 |
| E3 | `play` returns marks synchronously, equal to `planRequest(...).marks` | FR-018 |
| E4 | A new `play` ramps every live voice gain to 0 within ≤ 20 ms, calls `stop()` on each source, and clears all pending pulse timers before scheduling | FR-011, US4-1 |
| E5 | Pulses fire `onPulseStart` at `onsetMs` and `onPulseEnd` at `endMs` on the clock, including when muted, unavailable, or when the note was dropped | FR-007, US2-2, US5-1 |
| E6 | `stop()` silences, cancels pending steps and pulses, and emits `onSequenceChange(false)` if a sequence was active | FR-012, FR-013, FR-014 |
| E7 | Constructor throws / API missing / `resume()` rejects on the first unlock / loader rejects → `onUnavailable` exactly once. After that no `createContext` and no `resume` calls happen, and pulses still fire | FR-015, US5-1, US5-2, US5-4 |
| E8 | After audio was `on`, a later `resume()` rejection drops that request's sound, does **not** call `onUnavailable`, and the next `play` calls `resume()` again | EC-7.7 |
| E9 | Synth still loading at `play`: pulse now. If the loader resolves ≤ 100 ms after the activation, the note is scheduled at that moment's `currentTime`; otherwise it is dropped | FR-017 |
| E10 | A chord plays one source whose buffer is `mixVoices(voices)` (peak ≤ 0.89) | FR-021, US6-2 |
| E11 | Sequence step i is scheduled at `t0 + i·60/bpm` seconds on the audio clock. `onSequenceChange(true)` fires at start and `(false)` after the last `endMs` | US6-3, FR-012 |
| E12 | `setMuted`/`setVolume` change only gain-node automation and never stop sources | FR-009, FR-014 |

## 3. Playback state (`src/lib/state/playback.svelte.ts`, runes; single app-wide instance)

```ts
export interface PlaybackState {
  readonly availability: 'idle' | 'on' | 'unavailable';
  readonly controlState: 'on' | 'muted' | 'unavailable';
  readonly muted: boolean;
  readonly volume: number;               // 0..100, step 5, default 80
  readonly sequencePlaying: boolean;
  readonly pulses: readonly Pulse[];
  readonly noticeVisible: boolean;
}

export const playback: PlaybackState & {
  note(position: Position, instrument: Instrument): readonly TimeMark[];
  chord(positions: readonly Position[], instrument: Instrument): readonly TimeMark[];
  sequence(steps: readonly (Position | readonly Position[])[], bpm: number, instrument: Instrument): readonly TimeMark[];
  stop(reason?: 'stop' | 'hidden' | 'navigate' | 'instrument' | 'view'): void;
  setMuted(muted: boolean): void;        // also unlocks (sound-control gesture)
  setVolume(volume: number): void;       // also unlocks
  dismissNotice(): void;
  preload(): void;
};

/** Test seam: replace the engine dependencies and reset state (Vitest only). */
export function resetPlaybackForTests(deps?: Partial<EngineDeps>): void;
```

### Caller obligations

| Caller | Must |
|---|---|
| Fretboard hosts (`ToolPlaceholder` now; tools later) | Call `playback.note(position, instrument)` from `onactivate`. Pass `pulses={playback.pulses}` to the board next to its unchanged `model`. Call `playback.stop('instrument')` when the instrument changes |
| `src/routes/+layout.svelte` | Mount `PlaybackHost`, which calls `preload()` after mount and `stop('hidden')` on `visibilitychange`→hidden and on `pagehide`. Call `stop('navigate')` in `beforeNavigate` |
| Future view-state store (004+) | Call `playback.stop('view')` on every view-state change (FR-014). Carried obligation; no view state exists in this slice |
| Navigation, scroll, focus code | Must **not** call any playback method (FR-002) |

## 4. Import boundaries (ESLint, `eslint.config.js`)

- `src/lib/audio/**` may import `theory`, `instrument`. It must not import `svelte`, `$app/*`,
  `$lib/paraglide/*`, `$lib/fretboard/*`, `$lib/state/*`, `$lib/shell/*`, `$lib/prefs/*`.
- `src/lib/theory/**` already forbids `$lib/audio/*` (unchanged).
- `src/lib/fretboard/**` must not import `$lib/audio/*` or `$lib/state/*`. The board receives
  pulses only through its `pulses` prop (Principle III: data flows into the renderer).
- Only `src/lib/state/playback.svelte.ts` imports `$lib/audio/engine`.
