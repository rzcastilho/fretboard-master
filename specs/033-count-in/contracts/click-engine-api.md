# Contract: Click engine changes (`src/lib/audio/`)

Delta against `specs/032-subdivisions/contracts/click-engine-api.md`. The framework-free rule
stays: no Svelte, `$app/*`, i18n, state, shell or prefs imports. `click.ts` is unchanged.

## 1. `metronome.ts`

```ts
export interface CountInSpan {
  readonly from: number;  // clicks already played, 0…total
  readonly total: number; // k, 0–8
}

export interface SegmentStart {
  readonly bpm: number;
  readonly beats: number;
  readonly startBeat: number;
  readonly clicksPerBeat: number;
  readonly countIn?: CountInSpan; // NEW: absent or invalid → no count-in
  readonly run: number;
  readonly pressedAtMs: number;
}

export interface SchedulerEvents {
  onBeat(beat: number): void;
  onCountIn(click: number): void; // NEW: 1-based, in the run's numbering (from + 1 … total)
  onSuspended(): void;
  onSoundUnavailable(): void;
}

export type HaltedAt =
  | { readonly kind: 'count-in'; readonly click: number }
  | { readonly kind: 'beat'; readonly beat: number }
  | { readonly kind: 'none' };

export interface ClickScheduler {
  start(segment: SegmentStart): void;
  halt(reason: HaltReason): HaltedAt; // was: number
  readonly live: boolean;
}

export interface GridClick {
  readonly index: number;          // combined index c
  readonly when: number;
  readonly slot: number;           // c − r for count-in (negative), floor(j / n) for loop
  readonly beat: number;           // 0 for count-in clicks
  readonly countIn: number | null; // NEW: from + c + 1 for count-in clicks, else null
  readonly kind: ClickKind;        // 'accent' for count-in clicks
  readonly accent: boolean;
}

export function clickAt(
  seg: {
    anchor: number; period: number; perBeat: number; startBeat: number; beats: number;
    countInRemaining: number; countInFrom: number;
  },
  c: number
): GridClick;

export function skipTo(
  seg: { anchor: number; period: number; perBeat: number; countInRemaining: number },
  now: number
): number;
```

Validation of `countIn`: `total` an integer 0–8 and `from` an integer 0…`total`; otherwise the
segment has no count-in (`countInRemaining = 0`). `START_LEAD_S`, `HORIZON_S`, `TICK_MS`,
`HaltReason`, `SchedulerDeps` unchanged.

## 2. Behaviour

| # | Guarantee | Spec |
|---|---|---|
| E1 | With `countIn` absent or `total = from`, every `source.start` time, kind and `onBeat` sequence equals 032's exactly (regression test). | FR-008, FR-019 |
| E2 | Count-in click *i* (0-based within the segment) starts at `anchor + i × 60/BPM`; loop click *j* at `anchor + r × 60/BPM + j × (60/BPM)/n`. Property test over BPM 30–300 × r 0–8 × n 1–8: every `|when − ideal| < 2 ms`, and `when(first loop) − when(last count-in) = 60/BPM ± 2 ms`. | FR-007, FR-014, SC-002 |
| E3 | Every count-in click uses the `accent` buffer; no `sub` or `normal` click is scheduled before the first loop click. Each is its own source on `sink.destination`. | FR-006, FR-015 |
| E4 | The first scheduled click of a segment (count-in or loop) is at `anchor`, ≤ `START_LEAD_S` + one tick after `start()` — the 031 50 ms rule. | FR-007, SC-003 |
| E5 | The frame loop calls `onCountIn(from + c + 1)` once per count-in click when it becomes audible, and `onBeat` once per loop slot; never both for one slot; never `onCountIn` after an `onBeat` in the same segment. | FR-009, FR-010 |
| E6 | `halt()` stops every pending source with `when > now` (count-in and loop) and returns the `HaltedAt` of the last audible slot. | FR-011, SC-004 |
| E7 | After a pump gap, scheduling resumes at `skipTo(seg, now)` on the combined grid; missed count-in clicks are never scheduled; if the next due click is a loop click, the next report is `onBeat`. | FR-019 (edge: background) |
| E8 | `start()` while live is ignored (no doubled count-in). | edge: rapid presses |
| E9 | With `sink === null` or sound unavailable, the same grid drives `onCountIn`/`onBeat` from the clock (visual run). | edge: no Web Audio |

## 3. `types.ts` log entry

```ts
| {
    type: 'click';
    run: number;
    index: number;            // combined grid index
    slot: number;             // may be negative for count-in clicks
    beat: number;             // 0 for count-in clicks
    countIn: number | null;   // NEW
    kind: ClickKind;
    accent: boolean;
    when: number;
    contextTime: number;
    pressedAtMs: number | null;
    scheduledAtMs: number;
  }
```

Written only in test builds (`__FM_FAULT_INJECTION__`), as in 031.
