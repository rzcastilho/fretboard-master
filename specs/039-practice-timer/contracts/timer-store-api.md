# Contract: Timer store and model

**Modules**: `src/lib/state/timer.svelte.ts` (runes store) and `src/lib/state/timer-model.ts`
(pure). See [data-model.md](../data-model.md) §1–§2 and [research.md](../research.md) R-01–R-03,
R-05, R-07, R-10 and R-11.

## 1. Pure model (`timer-model.ts`)

```ts
export const TIMER_PRESETS: readonly number[];          // [1, …, 10]
export const DEFAULT_TIMER_MINUTES = 2;
export const FLASH_MS = 5000;
export const LATE_CHIME_LIMIT_MS = 2000;
export const TICK_SLACK_MS = 15;
export type TimerStatus = 'stopped' | 'running' | 'paused' | 'finished';
export type TimerAnnouncement = { kind: 'seconds'; count: number } | { kind: 'second' } | { kind: 'finished' } | null;

export function toPreset(v: unknown): number | null;             // integer 1–10 else null
export function secondsLeft(remainingMs: number): number;         // max(0, ceil(ms / 1000)); NaN → 0
export function formatReadout(seconds: number): string;           // 'MM:SS', clamped 0–5999
export function nextTickDelay(remainingMs: number): number;       // ms to just past the next whole-second boundary
export function shouldChime(lateMs: number): boolean;             // lateMs ≤ LATE_CHIME_LIMIT_MS
export function announcementFor(prev: number, next: number): TimerAnnouncement;
```

| # | Guarantee |
|---|---|
| M1 | `toPreset` accepts exactly the integers 1–10. `"5"`, 5.5, 0, 11, -1, NaN, null, `{}` give `null` |
| M2 | `secondsLeft(120000) = 120`, `secondsLeft(119001) = 120`, `secondsLeft(119000) = 119`, `secondsLeft(0) = 0`, `secondsLeft(-5) = 0` |
| M3 | `formatReadout`: 600 → `10:00`, 120 → `02:00`, 119 → `01:59`, 9 → `00:09`, 0 → `00:00`. Property: the output always matches `/^\d\d:\d\d$/` and parses back to the input for 0–5999 |
| M4 | `nextTickDelay(r) = r − (secondsLeft(r) − 1) × 1000 + TICK_SLACK_MS` for `r > 0`, and lies in `(TICK_SLACK_MS, 1000 + TICK_SLACK_MS]`. Property: after waiting it, `secondsLeft` is exactly one lower |
| M5 | `shouldChime(0)` and `shouldChime(2000)` are true. `shouldChime(2001)` is false |
| M6 | `announcementFor(prev, next)` returns `null` when `next === prev` or `next > 10`. For `2 ≤ next ≤ 10` it returns `{seconds, next}`, for `next = 1` `{second}`, and for `next = 0` `{finished}` |

## 2. Store (`timer.svelte.ts`)

```ts
export interface TimerDeps {
  clock: { now(): number; setTimeout(cb: () => void, ms: number): number; clearTimeout(id: number): void };
  /** Called inside the play gesture. Default: () => playback.clickSink(). */
  sink: () => AudioSink | null;
  /** Default: playChime from $lib/audio/chime. */
  chime: (sink: AudioSink, lateMs: number) => boolean;
}

export const timer: {
  readonly preset: number;              // 1–10
  readonly status: TimerStatus;
  readonly seconds: number;             // whole seconds shown
  readonly readout: string;             // 'MM:SS'
  readonly flashing: boolean;
  readonly announcement: string;        // localized; '' when none
  toggle(): void;                       // gesture: play / pause / restart
  selectPreset(v: unknown): void;       // gesture: select, or reset when equal
  restore(minutes: unknown): void;      // non-writing apply (start / erase)
};

/** Vitest only: replace deps, stop timers, reset to preset 2 / stopped. */
export function resetTimerForTests(deps?: Partial<TimerDeps>): void;
```

| # | Guarantee |
|---|---|
| S1 | Initial: `preset 2`, `stopped`, `readout '02:00'`, `flashing false`, `announcement ''` |
| S2 | `toggle()` from `stopped` calls `deps.sink()` exactly once in the same call stack and goes to `running`. After advancing the fake clock by 1000 ms the readout is `01:59`, and after 120 000 ms it is `00:00` with `status 'finished'` |
| S3 | `toggle()` while `running` gives `paused`, and the readout holds after any further clock advance. `toggle()` again resumes. Total running time to zero equals the preset duration (± `TICK_SLACK_MS`) |
| S4 | `toggle()` from `finished` restarts from `preset × 60` seconds and clears `flashing` |
| S5 | `selectPreset(5)` in any status gives `stopped`, `readout '05:00'`, timers cleared and `flashing false`. `selectPreset(5)` while `preset === 5` mid-run also resets to `05:00` |
| S6 | `selectPreset` with an invalid value changes nothing and writes nothing |
| S7 | `selectPreset(n)` calls `preferences.remember({ metronome: { timer: n } })` once per call. `toggle`, ticks, zero and `restore` never write |
| S8 | Zero: `chime` is called once, with `lateMs ≤ 2000`, when a sink was captured. If the clock jumps past `endsAt + 2000` before any callback runs (a simulated sleep), the store reaches `finished` and `chime` is **not** called. If the sink was `null`, `chime` is not called and the state is still `finished` |
| S9 | A `chime` that returns `false` or throws leaves `status 'finished'` and `flashing true` (FR-008) |
| S10 | `flashing` is true for exactly `FLASH_MS` after zero detection, unless cleared earlier by `toggle()` or `selectPreset` |
| S11 | Announcements while running: the store sets `'10 seconds'` … `'2 seconds'`, `'1 second'`, then `'Timer finished'`, in that order, for a countdown that passes through them. Nothing is set for seconds > 10. Any user action sets `''` |
| S12 | Drift: under a fake clock where every callback fires up to 900 ms late, the countdown reaches `finished` no later than `endsAt + 1000 ms`, and `readout` always equals `formatReadout(secondsLeft(endsAt − now))` at each tick (property test) |
| S13 | Independence: `metronome.toggle()`, `metronome.reset()`, `metronome.selectMode()`, `metronome.screenChanged()` and `metronome.restore()` leave every timer field unchanged (FR-009, SC-004) |
| S14 | `restore(7)` gives `preset 7`, `stopped`, `07:00`, with no write. `restore('x')` gives `preset 2` |
| S15 | Timer actions never call any metronome method and never change `metronome.phase` (FR-009) |
