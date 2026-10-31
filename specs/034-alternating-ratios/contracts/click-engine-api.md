# Contract: Click engine API (cycle, segment start, positions, log)

Delta against `specs/033-count-in/contracts/click-engine-api.md`. Modules:
`src/lib/audio/metronome-cycle.ts` (new, pure) and `src/lib/audio/metronome.ts` (edited).
Both stay framework-free (no Svelte, `$app/*`, i18n, state, shell or prefs imports).

## 1. `metronome-cycle.ts` (new, pure)

```ts
export interface RunPlan {
  readonly beats: number;          // N, 1–16
  readonly initial: number;        // k, 0–8
  readonly loops: readonly [number] | readonly [number, number]; // n1[, n2], each 1–8
  readonly repeat: number;         // r, 0–8; 0 when loops has one entry
}

export type CyclePhase = 'initial' | 'repeat' | 'loop1' | 'loop2';

export type SlotPosition =
  | { readonly kind: 'count-in'; readonly slot: number; readonly click: number;
      readonly total: number; readonly repeat: boolean; readonly next: 1 | 2 }
  | { readonly kind: 'beat'; readonly slot: number; readonly beat: number;
      readonly loop: 1 | 2; readonly clicksPerBeat: number };

export interface CycleClick {
  readonly index: number;          // run-global click index
  readonly slot: number;           // run-global slot
  readonly sub: number;            // 0 … n − 1 within the slot (0 for count-in)
  readonly phase: CyclePhase;
  readonly kind: ClickKind;        // 'accent' | 'normal' | 'sub'
  readonly position: SlotPosition; // position of the slot this click belongs to
}

export function toRunPlan(input: PlanInput): RunPlan;        // validates; never throws
export function cycleSlots(plan: RunPlan): number;           // S
export function cycleClicks(plan: RunPlan): number;          // C
export function slotAt(plan: RunPlan, slot: number): SlotPosition;
export function slotStart(plan: RunPlan, slot: number): number; // first click index of slot
export function clickAt(plan: RunPlan, index: number): CycleClick;
```

`PlanInput` = `{ beats, clicksPerBeat, initialCountIn?, alternate?: { clicksPerBeat,
repeatCountIn } }` (the plan part of `SegmentStart`).

| # | Rule | Spec |
|---|---|---|
| C1 | `toRunPlan`: non-integer or out-of-range `initialCountIn`/`repeatCountIn` → 0; `clicksPerBeat` outside 1–8 → 1; `alternate` absent → one loop and `repeat = 0`. | FR-005, FR-006 |
| C2 | Phase order per cycle: `loop1, repeat, loop2, repeat` (on) or `loop1` (off), after a prefix of `initial` slots; zero-length phases are skipped. | FR-004, FR-005 |
| C3 | `slotAt` and `clickAt` use integer division by `S`/`C`; no loop over earlier cycles. | FR-008 |
| C4 | Kinds per data-model §5: every count-in click `accent`; beat 1 of every loop `accent`; beats 2…N `normal`; in-between `sub`. | FR-006 |
| C5 | `slotAt(plan, slotStart(plan, s) → clickAt(...).slot) === s`, and `clickAt(slotStart(s)).sub === 0`. | — |
| C6 | `repeat: true` and `next` set on repeat count-in positions; `repeat: false`, `next: 1` on the initial count-in. | FR-007 |

## 2. `SegmentStart` (edited)

```ts
export interface SegmentStart {
  readonly bpm: number;
  readonly beats: number;
  readonly clicksPerBeat: number;           // Loop 1
  readonly initialCountIn?: number;         // k; absent = 0
  readonly alternate?: {                    // absent = Loop 1 only
    readonly clicksPerBeat: number;         // Loop 2
    readonly repeatCountIn: number;         // r
  };
  readonly startSlot?: number;              // run-global slot to begin at; absent/invalid = 0
  readonly run: number;
  readonly pressedAtMs: number;
}
```

Removed: `startBeat`, `countIn: CountInSpan` (and the `CountInSpan` type). Migration for
callers: `startBeat: b` → `startSlot: b − 1`; `countIn: { from, total }` →
`initialCountIn: total, startSlot: from`.

| # | Rule | Spec |
|---|---|---|
| E1 | Click `c` of a segment sounds at `anchor + (slotOf(c) − startSlot) · T + sub(c) · T / n` with `anchor = now + START_LEAD_S` (re-anchored before the first schedule, as in 031). | FR-008, FR-009 |
| E2 | The first scheduled click is `slotStart(plan, startSlot)`; it sounds ≤ 50 ms after `start()`. | FR-009 |
| E3 | Skip-forward: when the next click is in the past, jump to the first click with `when ≥ now + START_LEAD_S` (slot floor, then ≤ n steps); missed clicks are never scheduled. | Edge Cases |
| E4 | Without a sink or with sound unavailable the same grid drives the events on the timer clock. | Edge Cases |

## 3. Events and halt (edited, additive)

```ts
export interface SchedulerEvents {
  onBeat(beat: number, at: SlotPosition & { kind: 'beat' }): void;
  onCountIn(click: number, at: SlotPosition & { kind: 'count-in' }): void;
  onSuspended(): void;
  onSoundUnavailable(): void;
}
export type HaltedAt = SlotPosition | { readonly kind: 'none' };
```

| # | Rule | Spec |
|---|---|---|
| H1 | One event per slot, fired from the frame loop when the slot's first click's audible time (`now − outputLatency`) is reached; never for sub-clicks. | FR-007 |
| H2 | `halt()` returns the position of the last audible slot (or `none`), stops every pending source with `when > now`, cancels timer and frame, and logs `click-cancel`. | FR-009 |
| H3 | Events from a halted or superseded segment never reach the store (generation check, unchanged). | Edge Cases (rapid presses) |

## 4. Test-build log entry `click` (edited)

```ts
{ type: 'click', run, index, slot, beat, countIn, phase, kind, accent, when, contextTime,
  pressedAtMs, scheduledAtMs }
```

- `slot`: run-global slot (count-in slots are `0 … k − 1`; no longer negative).
- `index`: run-global click index.
- `beat`: 1…N within the current loop; 0 for count-in clicks.
- `countIn`: 1-based click number within its own count-in (initial or repeat), else `null`.
- `phase`: `'initial' | 'repeat' | 'loop1' | 'loop2'` (new).
- `pressedAtMs`: set on the segment's first click only (unchanged).
