# Contract: Metronome state changes (`src/lib/state/`)

Delta against `specs/032-subdivisions/contracts/metronome-store-api.md`.

## 1. `metronome-settings.ts` (pure)

```ts
export interface MetronomeSettings {
  readonly bpm: number;
  readonly beats: number;
  readonly subdivision: Subdivision;
  readonly countIn: boolean;        // NEW, default true
  readonly initialCountIn: number;  // NEW, 0–8, default 4
  readonly repeatCountIn: number;   // NEW, 0–8, default 2
}

export type SettingField = 'bpm' | 'beats' | 'initialCountIn' | 'repeatCountIn';

export const MIN_COUNT_IN = 0;
export const MAX_COUNT_IN = 8;
export const DEFAULT_INITIAL_COUNT_IN = 4;
export const DEFAULT_REPEAT_COUNT_IN = 2;

/** 0–8, rounded; NaN → `fallback`. */
export function clampCount(v: number, fallback: number): number;

/** k for a run: `initialCountIn` when the switch is on, else 0. */
export function effectiveCountIn(s: MetronomeSettings): number;

// atLimit / stepSetting: unchanged signatures, now also for the two count fields.
```

Table tests: `clampCount(-1, 4) = 0`, `clampCount(9, 4) = 8`, `clampCount(2.6, 4) = 3`,
`clampCount(NaN, 4) = 4`, `clampCount(NaN, 2) = 2`; `effectiveCountIn` for on/off × 0/4/8;
`atLimit` at 0 (−) and 8 (+).

## 2. `metronome-view.ts` (pure)

```ts
export type StatusParams =
  | { readonly kind: 'beat'; readonly beat: number; readonly beats: number; readonly sub: number }
  | { readonly kind: 'none'; readonly beats: number; readonly sub: number }
  | { readonly kind: 'count-in'; readonly click: number; readonly total: number }  // NEW
  | { readonly kind: 'count-in-none'; readonly total: number };                     // NEW

export interface CountInView { readonly click: number; readonly total: number }

export function statusParams(
  beat: number, beats: number, sub: number, countIn?: CountInView | null
): StatusParams;

/** 'upcoming' before the first count-in click, 'lit' from click 1 on. */
export function countInDot(click: number): DotState;
```

`statusParams` with `countIn` null/absent behaves exactly as in 032.

## 3. Store (`metronome.svelte.ts`)

Additions:

```ts
metronome.countIn: CountInView | null;           // non-null only in the count-in stage of a run
metronome.setCountIn(on: boolean): void;
metronome.setInitialCountIn(v: number): void;
metronome.stepInitialCountIn(dir: 1 | -1): void;
metronome.setRepeatCountIn(v: number): void;
metronome.stepRepeatCountIn(dir: 1 | -1): void;
```

| # | Rule | Spec |
|---|---|---|
| S1 | All six setters act only in the `settings` phase; otherwise no-op. Numeric setters clamp with `clampCount`. `setCountIn` ignores non-booleans. | FR-002, FR-004, FR-005 |
| S2 | `setCountIn(false)` keeps `initialCountIn` and `repeatCountIn`. | FR-003, US2-5 |
| S3 | `start()` fixes `k = effectiveCountIn(settings)`. k > 0 → `stage = 'count-in'`, segment `countIn: { from: 0, total: k }`; k = 0 → `stage = 'loop'`, no `countIn` (032 path). | FR-006, FR-008 |
| S4 | `onCountIn(n)` sets `countInClick = n` and `starting → running`; `onBeat(b)` sets `beat = b`, `stage = 'loop'`, `starting → running`. Stale generations ignored (031 rule). | FR-010 |
| S5 | `metronome.dots` is `[]` while `stage === 'count-in'`; `metronome.countIn` is `{ click: countInClick, total: k }` then, else null. | FR-009 |
| S6 | Start announcement: `m.metronome_announce_started_count_in({ bpm, beats, subdivision, count: k })` when k > 0, else the 032 `m.metronome_announce_started(...)` unchanged. | FR-016 |
| S7 | `pause()` uses `halt('pause')`: `count-in` → `countInClick = click`; `beat` → `beat`, `stage = 'loop'`; `none` → unchanged. Announcement in the count-in stage: `m.metronome_announce_paused_count_in({ click, count: k })`, or `..._count_in_none()` when `countInClick = 0`; loop stage unchanged. | FR-011, FR-016 |
| S8 | `resume()` in the count-in stage passes `countIn: { from: countInClick, total: k }`, `startBeat: 1`; in the loop stage passes no `countIn` and `startBeat = beat % beats + 1`. Never a new count-in after the loop started. | FR-011, US3-2, US3-3 |
| S9 | `reset()` keeps all settings and clears `stage`, `countInClick`, `countInTotal`. `screenChanged()` and `resetMetronomeForTests()` restore `DEFAULT_SETTINGS`. | FR-012 |
| S10 | `repeatCountIn` is never read by `start`, `resume` or the engine. | FR-013, US4 |
| S11 | `onSuspended` during a count-in freezes like Pause (031 FR-026 path, using the store's `countInClick`). | edge: background |

`metronome-keys.ts`: unchanged. The panel already passes `targetActivates` for
`[role="switch"]`, so Space on the Count In switch toggles it and never starts training; a unit
case pins this in `tests/unit/metronome/keys.test.ts`.
