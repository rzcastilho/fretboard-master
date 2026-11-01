# Contract: Tap tempo module (`src/lib/state/tap-tempo.ts`)

The module is pure and DOM-free, with no imports except `clampBpm` from `metronome-settings`.
See [data-model.md §1](../data-model.md).

```ts
export type TapRun = readonly number[];
export const TAP_WINDOW: 8;
export const TAP_MIN_TAPS: 4;
export const TAP_MAX_GAP_MS: 2000;
export function tap(run: TapRun, atMs: number): { readonly run: TapRun; readonly bpm: number | null };
```

## Guarantees

| # | Guarantee |
|---|---|
| T1 | `tap` never throws, never mutates `run`, and returns a run of length 0–8 |
| T2 | Taps 1–3 of a run return `bpm: null` |
| T3 | Taps at 0, 500, 1000 and 1500 ms give `bpm = 120` on the fourth tap (SC-001, US1 1) |
| T4 | Taps at 0, 100, 200 and 300 ms give 300 (US1 3). Any average gap below 200 ms gives 300 |
| T5 | A gap of 2000 ms continues the run. A gap of 2000.001 ms starts a new run whose first tap is that tap (US1 4) |
| T6 | Tap 5 of a run updates the bpm from the gaps of taps 1–5 (US1 5). From tap 9 on, only the last 8 taps count |
| T7 | Rounding is half up: an average gap that gives 120.5 returns 121 |
| T8 | Every non-null bpm is an integer in 30–300 (property) |
| T9 | A constant gap `g` in [200, 2000] over k ≥ 4 taps gives `Math.round(60000 / g)` (property) |
| T10 | `atMs` that is less than the last tap, or not finite, starts a new run (finite) or leaves an empty run (not finite). It never returns a bpm |
| T11 | Identical timestamps (a 0 ms gap) give 300, not `NaN` or `Infinity` |
