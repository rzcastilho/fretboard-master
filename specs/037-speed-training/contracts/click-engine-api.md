# Contract: Click engine API, tempo ramp (037)

This is a delta against `specs/034-alternating-ratios/contracts/click-engine-api.md`. It covers
two modules: `src/lib/audio/metronome-ramp.ts`, which is new and pure, and
`src/lib/audio/metronome.ts`, which is edited. Both stay framework-free, with no Svelte,
`$app/*`, i18n, state, shell or prefs imports. `metronome-cycle.ts` is **not** modified apart
from the optional `ramp` fields on `SlotPosition`.

## 1. `SlotPosition` (metronome-cycle.ts, type only)

```ts
type SlotPosition =
  | { kind: 'count-in'; slot; click; total; repeat; next: 1 | 2;
      ramp?: { step: number; steps: number; bpm: number } }
  | { kind: 'beat'; slot; beat; loop: 1 | 2; clicksPerBeat;
      ramp?: { step: number; steps: number; loop: number; loops: number;
               hold: boolean; bpm: number } };
```

`ramp` is present only for slots of a ramp run (data-model §2). Positions from periodic plans
never carry it.

## 2. `SegmentStart` (metronome.ts)

```ts
interface SegmentStart {
  /* …unchanged fields… */
  /** Speed Training: a tempo ramp. When present, `clicksPerBeat` and `alternate` are ignored
   *  (one click per beat) and `bpm` is used only as the fallback for an invalid `bpms`. */
  readonly ramp?: {
    readonly bpms: readonly number[];   // 1–271 integers 30–300, strictly increasing
    readonly loops: number;             // 1–16
    readonly repeatCountIn: number;     // 0–8
    readonly atTarget: 'hold' | 'stop';
  };
}

interface SchedulerEvents {
  /* …unchanged… */
  /** Stop ramps only: audible time reached the end of the run. Fired once, then the scheduler
   *  is no longer live. */
  onEnd?(): void;
}

type HaltReason = 'pause' | 'reset' | 'leave' | 'suspend' | 'end';
```

## 3. `metronome-ramp.ts` exports

```ts
export function toRampPlan(beats: number, initial: number, bpm: number, input: RampInput): RampPlan;
export function rampSlotAt(plan: RampPlan, slot: number): SlotPosition;
export function rampClickAt(plan: RampPlan, index: number): CycleClick;
export function rampOffset(plan: RampPlan, slot: number): number;     // seconds from slot 0
export function rampSlotFloor(plan: RampPlan, seconds: number): number; // −1 before slot 0
```

## 4. Guarantees (tests in `tests/unit/audio/metronome-ramp.test.ts` and `metronome.test.ts`)

- **E1, validation**: `toRampPlan` never throws. `bpms` that are empty, longer than 271, not
  strictly increasing, non-integer or out of range give `[bpm]`. `loops` outside 1–16 gives 1
  and `repeatCountIn` outside 0–8 gives 0.
- **E2, layout**: the slot count of block b matches data-model §2. For 80→120/5, L = 4, N = 4,
  k = 4 and r = 2, the run has `4 + 9 × 16 + 8 × 2 = 164` slots, and `endSlot = 164` for Stop.
- **E3, exact times**: `rampOffset(plan, s + 1) − rampOffset(plan, s)` equals `60 / bpm` of
  the block that holds slot s. This includes the last count-in click of a block, so the first
  loop click of step n + 1 comes one *previous-tempo* beat after the last count-in click
  (FR-006). It is checked to 1e-9 for every slot of the E2 run, and by fast-check over random
  ramps.
- **E4, no drift**: `rampOffset(plan, tailSlot + 10⁶)` equals
  `tailT0 + 10⁶ × 60 / target` exactly, as the same float expression.
- **E5, floor**: `rampSlotFloor(plan, rampOffset(plan, s))` equals s, and
  `rampSlotFloor(plan, rampOffset(plan, s) − 1e-6)` equals s − 1, for every s of E2.
- **E6, Stop**: the scheduler never schedules a click with an index ≥ `endSlot`. `onEnd` fires
  exactly once, at the first pump or frame where `now() − latency() ≥ anchor + tailT0 −
  offset(startSlot)`. Afterwards `live` is false and `halt()` returns `{ kind: 'none' }`.
- **E7, Hold**: clicks after `tailSlot` carry `ramp.hold = true` and play at Target BPM.
  Beat 1 is accented, with no count-in, and the run never ends.
- **E8, resume**: `start({ …, ramp, startSlot: s })` schedules slot s first, at
  `anchor + START_LEAD_S`, and every later slot at its ramp offset relative to s. This holds
  inside a block, across a boundary and in the tail.
- **E9, unchanged paths**: every existing test in `tests/unit/audio/metronome.test.ts` and
  `metronome-cycle.test.ts` passes unmodified. A segment without `ramp` takes the 034 code path.
- **E10, log**: `click` log entries for ramp runs carry the existing fields. `beat` is
  1-based, and `countIn` is the click number or null. `click-cancel` with `reason: 'end'` is
  logged with `count: 0` when a Stop run ends.
