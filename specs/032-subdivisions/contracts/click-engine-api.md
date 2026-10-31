# Contract: Click engine changes (`src/lib/audio/`)

Delta against `specs/031-metronome-tool-and-click-engine/contracts/click-engine-api.md`. The
framework-free rule stays: no Svelte, `$app/*`, i18n, state, shell or prefs imports.

## 1. `click.ts`

```ts
export type ClickKind = 'accent' | 'normal' | 'sub';
export const CLICK_LENGTH_S: Readonly<Record<ClickKind, number>>; // { accent: 0.03, normal: 0.03, sub: 0.018 }
export const CLICK_S: number; // max of CLICK_LENGTH_S (0.03), used to prune pending sources
export function renderClick(kind: ClickKind, sampleRate: number): Float32Array;
```

Guarantees (unit-tested):

- `renderClick('sub', r).length === round(0.018 × r)`; length ≤ `round(0.020 × r)`.
- `max |renderClick('sub', r)| ≤ 0.5 × max |renderClick('normal', r)|`.
- The dominant frequency of `sub` (zero-crossing estimate) differs from both `accent` (1600 Hz)
  and `normal` (1000 Hz); it is 2400 Hz ± 5 %.
- `accent` and `normal` output is sample-identical to 031 (regression test).
- Invalid sample rate → 48 kHz, as in 031.

## 2. `metronome.ts`

```ts
export interface SegmentStart {
  readonly bpm: number;
  readonly beats: number;
  readonly startBeat: number;
  readonly clicksPerBeat: number; // NEW: 1–8; non-integer or out of range → 1
  readonly run: number;
  readonly pressedAtMs: number;
}

export interface GridClick {
  readonly index: number;   // j
  readonly when: number;    // anchor + (j × period) / perBeat
  readonly slot: number;    // floor(j / perBeat)
  readonly beat: number;    // 1-based beat of the slot
  readonly kind: ClickKind; // 'sub' when j mod perBeat ≠ 0
  readonly accent: boolean; // kind === 'accent'
}

export function clickAt(
  seg: { anchor: number; period: number; perBeat: number; startBeat: number; beats: number },
  j: number
): GridClick;

export function skipTo(seg: { anchor: number; period: number; perBeat: number }, now: number): number;
```

`ClickScheduler`, `SchedulerEvents`, `SchedulerDeps`, `HaltReason`, `START_LEAD_S`, `HORIZON_S`,
`TICK_MS` are unchanged in shape.

Behaviour:

| # | Guarantee | Spec |
|---|---|---|
| E1 | Every scheduled `source.start(when)` equals `clickAt(seg, j).when` for consecutive `j`; times never accumulate. Property test over BPM 30–300 × n 1–8: `|when − ideal| < 2 ms` for `j` up to 10 minutes. | FR-008, SC-002 |
| E2 | Buffer chosen by `kind`; `kind === 'sub'` exactly when `j mod n ≠ 0`. `n = 1` produces the 031 sequence exactly. | FR-004, FR-005 |
| E3 | Each click is its own `AudioBufferSourceNode` connected to `sink.destination` (the app's mute/volume chain). | FR-009, FR-011 |
| E4 | `onBeat` fires once per slot, when the slot's beat click becomes audible; never for a `sub` click. | FR-007 |
| E5 | `halt()` stops every pending source with `when > now`, soft ones included, and returns the beat of the last audible slot. | FR-010, SC-005 |
| E6 | After a pump gap (suspension, throttling), scheduling resumes at `skipTo(seg, now)`, the next due grid click; nothing earlier is scheduled. | FR-015 |
| E7 | `start()` while live is ignored (no doubled stream). | edge case |
| E8 | 300 BPM × 8: 40 starts per second over 60 s (2400 ± 1 within the window), consecutive `sub` starts 25 ms apart, none skipped. | FR-009, SC-003 |

## 3. `types.ts` log entry

```ts
| {
    type: 'click';
    run: number;
    index: number;
    slot: number;     // NEW
    beat: number;
    kind: ClickKind;  // NEW
    accent: boolean;
    when: number;
    contextTime: number;
    pressedAtMs: number | null;
    scheduledAtMs: number;
  }
```

Written only in test builds (`__FM_FAULT_INJECTION__`), as in 031.
