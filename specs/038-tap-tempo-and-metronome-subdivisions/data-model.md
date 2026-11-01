# Data Model: Tap Tempo and Metronome Subdivisions (038)

Phase 1 of [plan.md](plan.md). The decisions behind this model are in [research.md](research.md).

## 1. Tap measurement (`src/lib/state/tap-tempo.ts`, new, pure)

```ts
/** Timestamps (ms) of the current run, oldest first; 0–8 entries. */
export type TapRun = readonly number[];

export const TAP_WINDOW = 8;        // most recent taps averaged (FR-003)
export const TAP_MIN_TAPS = 4;      // first tap that sets BPM (FR-002)
export const TAP_MAX_GAP_MS = 2000; // a longer gap starts a new run (FR-004)

export function tap(run: TapRun, atMs: number): { readonly run: TapRun; readonly bpm: number | null };
```

| Rule | Detail |
|---|---|
| New run | `run` is empty, `atMs − last > 2000`, `atMs < last`, or `atMs` is not finite. The result is `run = [atMs]` (or `[]` if not finite) and `bpm = null` |
| Continue | The gap is ≤ 2000 (exactly 2000 continues). Append `atMs`, then keep the last 8 entries |
| BPM | With `n = run.length ≥ 4`: `clampBpm(60000 / ((run[n−1] − run[0]) / (n − 1)))`. Otherwise `null` |
| Rounding | `Math.round` (half up), then clamped to 30–300. An average gap of 0 gives 300 |

**Lifecycle (state transitions)**:

```text
empty --tap--> [t1] --tap(≤2s)--> [t1,t2] --> [t1..t3] --> [t1..t4] (bpm) --> … [last 8] (bpm)
  ^                                                                                  |
  +--- Reset / selectMode / screenChanged / restore ---------------------------------+
any state --tap(gap >2s)--> [t]   (tap one of a new run)
```

The run lives in the store as a non-reactive module variable, and it is never persisted.

## 2. Plain settings (`src/lib/state/metronome-settings.ts`, extended)

```ts
export type PlainSubdivision = 1 | 2 | 3 | 4;
export const PLAIN_SUBDIVISIONS: readonly PlainSubdivision[] = [1, 2, 3, 4];
export const DEFAULT_PLAIN_SUBDIVISION: PlainSubdivision = 1;

export interface PlainSettings {
  readonly bpm: number;              // 30–300 (tap tempo writes here too)
  readonly beats: number;            // 1–16
  readonly countIn: boolean;
  readonly initialCountIn: number;   // 0–8
  readonly subdivision: PlainSubdivision; // NEW: clicks per beat; 1 = Quarter
}

export function toPlainSubdivision(v: unknown): PlainSubdivision | null; // toSubdivision ∩ 1–4
export function plainRunPlan(p: PlainSettings): PlanFields; // clicksPerBeat: p.subdivision
```

| Subdivision | Option label (existing strings) | Clicks per beat | Status suffix |
|---|---|---|---|
| 1 | Quarter notes (1) | 1 | none |
| 2 | 8th notes (2) | 2 | `· SUB 2` |
| 3 | 8th Triplets (3) | 3 | `· SUB 3` |
| 4 | 16th notes (4) | 4 | `· SUB 4` |

**Validation**: the UI setter accepts numbers or numeric strings in 1–4 and ignores anything
else. The stored record accepts integers 1–4, and anything else reads as 1.

`SharedSettings` (`beats`, `countIn`, `initialCountIn`) is unchanged, and so are the Ratios and
Speed records (FR-013).

## 3. Scheduler grid (`src/lib/audio/metronome.ts`, extended)

The `Grid` shape is unchanged: `plan`, `anchor`, `period`, `startSlot`, `startIndex`, optional
`ramp`. A retime replaces the live grid by a new grid with the same `plan`, and:

| Field | After `retime(bpm)` at commit slot `S′` |
|---|---|
| `anchor` | `clickTime(oldGrid, clickAt(plan, slotStart(plan, S′)))`, the unchanged old time of `S′` |
| `period` | `60 / bpm` |
| `startSlot` | `S′` |
| `startIndex` | `slotStart(plan, S′)` |

New scheduler-internal state:

- `pendingBpm: number | null`: a retime requested while the segment is live but not yet
  anchored. `anchorAndRun` uses it in place of `segment.bpm`.
- `firstScheduled: boolean`: limits the existing first-click re-anchor guard to a segment's
  first click (research R-03).

`S′` is the smallest slot with `clickTime(oldGrid, first click of slot) ≥ now + START_LEAD_S`.

## 4. Store state (`src/lib/state/metronome.svelte.ts`, extended)

| Item | Kind | Notes |
|---|---|---|
| `state.plain.subdivision` | reactive (inside `plain`) | Edited in the settings phase and plain mode only |
| `tapRun: TapRun` | module variable | Cleared by `reset`, `halt` (and so by `selectMode` and `screenChanged`) and `restore` |
| `tapNow()` | function | `overrides.clock?.now() ?? performance.now()` |

Getters and actions that change:

| Name | Change |
|---|---|
| `sub` | Plain mode: `subdivision > 1 ? subdivision : null` |
| `tapTempo()` | NEW. Plain mode, any phase. See [contracts/metronome-store-api.md](contracts/metronome-store-api.md) |
| `setPlainSubdivision(v)` | NEW. Settings phase and plain mode only |
| `start()` (plain) | Uses the `metronome_announce_started[_count_in]` strings with `subdivision` when it is not 1 |

## 5. Stored preferences record (`src/lib/prefs/schema.ts`, extended)

The record is `fretboard-master:prefs` at `version: 1`, unchanged. Only the `metronome.plain`
entry changes:

```jsonc
"plain": {
  "bpm": 100, "beats": 3, "countIn": true, "initialCountIn": 4,
  "subdivision": 3            // NEW, optional; written only when ≠ 1
}
```

| Read input | Result |
|---|---|
| `subdivision` absent | 1, with the other fields as before |
| 1, 2, 3 or 4 (integer) | that value |
| `"3"`, 2.5, 0, 5, `null`, `true` | 1, with the other plain fields kept |

The `plain` entry itself is written only when the plain record differs from
`METRONOME_PLAIN_DEFAULTS` (which gains `subdivision: 1`).

## 6. Catalog keys (`messages/{en,pt-BR,es}.json`)

| Key | en | pt-BR | es |
|---|---|---|---|
| `metronome_plain_subdivision_label` | Subdivision | Subdivisão | Subdivisión |
| `metronome_tap_name` | {bpm} BPM, tap tempo | {bpm} BPM, marcar andamento | {bpm} BPM, marcar tempo |
| `metronome_tap_title` | Tap tempo | Marcar andamento | Marcar tempo |
| `shortcuts_metronome_tap` | Tap tempo (Metronome mode) | Marcar andamento (modo Metrônomo) | Marcar tempo (modo Metrónomo) |

The following keys are reused unchanged:

- `metronome_subdivision_option` and `metronome_subdivision_1…4`;
- `metronome_status_sub`;
- `summary_separator`;
- `metronome_bpm_unit`, for the `{bpm} BPM` tap announcement;
- `metronome_announce_started` and `metronome_announce_started_count_in`.

The mode name in the About entry matches the existing plain tab label `metronome_mode_plain`
in each language: Metronome, Metrônomo, Metrónomo.
