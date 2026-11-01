# Contract: Click scheduler live retime (`src/lib/audio/metronome.ts`)

This contract extends `specs/037-speed-training/contracts/click-engine-api.md`. The module stays
framework-free. See research R-03.

```ts
export interface ClickScheduler {
  start(segment: SegmentStart): void;
  halt(reason: HaltReason): HaltedAt;
  /**
   * 038: change the tempo of a live periodic segment without restarting it. The change applies
   * from the first slot whose first click starts at or after now + START_LEAD_S. Returns false
   * (and does nothing) when the segment is not live or is a ramp, or when bpm is not a finite
   * number in 30–300.
   */
  retime(bpm: number): boolean;
  readonly live: boolean;
}
```

`AudioLogEntry` `click-cancel` gains `reason: 'retime'` in test builds. `HaltReason` is
unchanged.

## Algorithm

This is the normative order. The notation is in [data-model.md §3](../data-model.md).

1. If the segment is not live or `bpm` is invalid, return `false`. If `seg.ramp` is set, return
   `false`.
2. If the segment is live but not anchored (`seg === null`), set `pendingBpm = bpm` and return
   `true`. `anchorAndRun` uses `pendingBpm ?? segment.bpm`.
3. Report the audible slot, as `frameLoop` does: fire `onBeat` or `onCountIn` if its slot is
   greater than `reported`.
4. Let `t = now()`, and let `a` be the slot of the audible click, or `startSlot − 1` when no
   click is audible yet. `S′` is the smallest slot `> a` whose first click satisfies
   `T(S′) = clickTime(seg, first click of S′) ≥ t + START_LEAD_S`. Because slots are at least
   0.2 s apart (300 BPM) and `START_LEAD_S` is 0.02 s, `S′` is `a + 1` or `a + 2` whenever
   the output latency is shorter than one beat minus `START_LEAD_S`. The audible slot `a`
   already accounts for output latency.
5. For `i` from `next` to `slotStart(S′) − 1`, schedule click `i` on the old grid.
6. Stop and disconnect every pending source with `when ≥ T(S′) − 1e-9`, and remove it from
   `pending`. Log `click-cancel` with `reason: 'retime'`.
7. Set `seg = { ...seg, anchor: T(S′), period: 60 / bpm, startSlot: S′,
   startIndex: slotStart(S′) }` and `next = startIndex`. Return `true`.

## Guarantees

| # | Guarantee |
|---|---|
| E11 | Every click with time `< T(S′)` keeps the time it had before the retime. Already-scheduled clicks before `S′` are not stopped, and unscheduled sub-clicks of the beat that is playing are scheduled at their old times |
| E12 | The first click of `S′` sounds at its old time `T(S′)`. Click `j` of slot `S′ + k` (k ≥ 0) sounds at `T(S′) + k × 60/bpm + j × (60/bpm) / n`, so there is no phase shift and the new spacing starts with the beat `S′` (FR-007) |
| E13 | `S′` is the next slot after the audible one, or the slot after that when the next slot starts within `START_LEAD_S` of now. So the new tempo is heard no later than the second beat after the tap (SC-003) |
| E14 | The slot sequence is continuous: each slot `≥ startSlot` sounds exactly once, with no slot doubled or skipped across any number of retimes (property, fast-check: random tap times, bpm pairs, n ∈ 1–4, beats ∈ 1–16, count-in ∈ 0–8) |
| E15 | Beat numbers, loop positions and count-in clicks continue: `clickAt(plan, i)` is unchanged by a retime |
| E16 | `retime` on a ramp segment, on a halted scheduler, or with an invalid bpm returns `false` and changes nothing (no log, no stop) |
| E17 | A retime before the anchor (sink still resolving) starts the segment at the new bpm. A later `halt` behaves as before |
| E18 | `halt('pause')` right after a retime, before `S′` is audible, returns `{ kind: 'none' }` or the last audible slot, never a slot `≥ S′` |
| E19 | The first-click re-anchor guard in `pump` fires only before the segment's first click is scheduled. It never fires after a retime |
| E20 | With no retime, scheduling is byte-identical to 037. The existing E1–E10 tests pass unchanged |
