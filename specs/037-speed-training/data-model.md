# Data Model: Speed Training Mode (037)

This builds on `specs/036-mode-tabs-and-plain-metronome/data-model.md` and lists only what is
new or changed. The research entries are cited as R-nn.

## 1. Settings (`src/lib/state/metronome-settings.ts`, pure)

```ts
export type MetronomeMode = 'plain' | 'speed' | 'ratios';
export const METRONOME_MODES: readonly MetronomeMode[] = ['plain', 'speed', 'ratios']; // tab order
export const DEFAULT_MODE: MetronomeMode = 'ratios';            // unchanged

export type AtTarget = 'hold' | 'stop';

export interface SpeedSettings {
  readonly startBpm: number;        // 30–300
  readonly targetBpm: number;       // startBpm–300 (invariant T ≥ S)
  readonly increment: number;       // 1–20
  readonly loops: number;           // loops per step, 1–16
  readonly beats: number;           // 1–16
  readonly countIn: boolean;
  readonly initialCountIn: number;  // 0–8
  readonly repeatCountIn: number;   // 0–8
  readonly atTarget: AtTarget;
}

export const DEFAULT_SPEED_SETTINGS: Readonly<SpeedSettings> = Object.freeze({
  startBpm: 85, targetBpm: 125, increment: 5, loops: 4, beats: 4,
  countIn: true, initialCountIn: 4, repeatCountIn: 2, atTarget: 'hold'
});

export const MIN_INCREMENT = 1;  export const MAX_INCREMENT = 20;
export const MIN_LOOPS = 1;      export const MAX_LOOPS = 16;
export const MAX_STEPS = 271;    // (300 − 30) / 1 + 1

/** Fields shared by every mode (rows rendered by the common components). */
export type SharedSettings = Pick<PlainSettings, 'beats' | 'countIn' | 'initialCountIn'>;
export type SpeedField = 'startBpm' | 'targetBpm' | 'increment' | 'loops'
                       | 'beats' | 'initialCountIn' | 'repeatCountIn';
```

### Functions (all pure, total, never throw)

| Function | Rule |
|---|---|
| `clampIncrement(v)` | 1–20, rounded. NaN gives 1 |
| `clampLoops(v)` | 1–16, rounded. NaN gives 1 |
| `withStartBpm(s, v)` | `start = clampBpm(v)`, `target = max(s.targetBpm, start)` (FR-003) |
| `withTargetBpm(s, v)` | `target = max(clampBpm(v), s.startBpm)` (FR-003) |
| `atLimit(s, field, dir)` | Extended to `SpeedSettings`. For `targetBpm` and `dir = −1` it is `target ≤ start`. Otherwise it is the field's own range |
| `stepSetting(s, field, dir)` | Extended to `SpeedSettings`. Start and Target steps go through `withStartBpm` / `withTargetBpm`. At a limit the same object is returned |
| `speedSteps(s)` | `[S, S+i, S+2i, … < T, T]`. When `T = S` it is `[S]` (FR-004, R-03) |
| `speedRunPlan(s)` | `{ clicksPerBeat: 1, initialCountIn: effectiveCountIn(s), ramp: { bpms: speedSteps(s), loops: s.loops, repeatCountIn: s.countIn ? s.repeatCountIn : 0, atTarget: s.atTarget } }` |
| `toMode(v)` | `'plain'`, `'speed'` or `'ratios'`; anything else gives `null` |
| `toAtTarget(v)` | `'hold'` or `'stop'`; anything else gives `null` |

**Step-schedule invariants** (fast-check, SC-003). For every valid `s`, `b = speedSteps(s)`:
- `b[0] = s.startBpm` and `b.at(-1) = s.targetBpm`;
- `b` is strictly increasing, and every `b[k] ≤ s.targetBpm`;
- `b[k+1] − b[k] = s.increment` for `k < b.length − 2`, and the last gap is between 1 and
  `s.increment`;
- `b.length = s.targetBpm === s.startBpm ? 1 : ceil((T − S) / i) + 1`, and `b.length ≤ 271`.

The examples are fixed table tests: 80→120/5 gives 9 steps (SC-001), 80→102/5 gives
`[80, 85, 90, 95, 100, 102]` (SC-002), 290→300/20 gives `[290, 300]`, 300→300 gives `[300]`, and
40→300/1 gives 261 steps.

## 2. Ramp layout (`src/lib/audio/metronome-ramp.ts`, pure, new)

```ts
export interface RampInput {
  readonly bpms: readonly number[];
  readonly loops: number;
  readonly repeatCountIn: number;
  readonly atTarget: 'hold' | 'stop';
}

export interface RampPlan {
  readonly beats: number;            // N
  readonly initial: number;          // k
  readonly loops: number;            // L
  readonly repeat: number;           // r (0 = steps follow directly)
  readonly bpms: readonly number[];  // validated step tempos, length S
  readonly hold: boolean;
  /** Block b: first slot, first time (s from run start), period (s). Length S. */
  readonly blocks: readonly { slot0: number; t0: number; period: number }[];
  /** First Hold slot (= first slot after the last block). */
  readonly tailSlot: number;
  readonly tailT0: number;
  /** Stop only: the slot at which the run ends (no click there); null for Hold. */
  readonly endSlot: number | null;
}
```

**Layout.** `S = bpms.length`, `LN = L × N`.

| Block | Slots, in order | Period |
|---|---|---|
| 0 | `k` initial count-in, `LN` loop slots of step 1, then `r` repeat count-in if `S > 1` | `60 / bpms[0]` |
| b, with 0 < b < S − 1 | `LN` loop slots of step b + 1, then `r` repeat count-in | `60 / bpms[b]` |
| S − 1 (when S > 1) | `LN` loop slots of step S | `60 / bpms[S − 1]` |
| tail (Hold) | endless loop slots, beat `((slot − tailSlot) mod N) + 1` | `60 / bpms[S − 1]` |

Block times are computed once:
- `blocks[0].t0 = 0`;
- `blocks[b+1].t0 = blocks[b].t0 + slotsOf(b) × blocks[b].period`.

The time of a slot is `blocks[b].t0 + (slot − blocks[b].slot0) × blocks[b].period`, or
`tailT0 + (slot − tailSlot) × period[S−1]` in the tail. For Stop, `endSlot = tailSlot`. The
end time is `tailT0`, which is one period after the final beat (R-05).

**Exports**:
- `toRampPlan(beats, initial, bpm, input): RampPlan`, which validates, falls back to a one-step
  ramp at the segment BPM, and never throws;
- `rampSlotAt(plan, slot): SlotPosition`;
- `rampClickAt(plan, index): CycleClick` (index = slot);
- `rampOffset(plan, slot): number` (seconds);
- `rampSlotFloor(plan, seconds): number` (the latest slot whose time is ≤ seconds, by binary
  search over the blocks).

**Position fields** for ramp runs (R-04):

| Slot | `SlotPosition` |
|---|---|
| Initial count-in click j | `{ kind: 'count-in', click: j+1, total: k, repeat: false, next: 1, ramp: { step: 1, steps: S, bpm: bpms[0] } }` |
| Repeat count-in click j before step s + 1 | `{ kind: 'count-in', click: j+1, total: r, repeat: true, next: 1, ramp: { step: s+1, steps: S, bpm: bpms[s−1] } }` |
| Loop slot of step s | `{ kind: 'beat', beat, loop: 1, clicksPerBeat: 1, ramp: { step: s, steps: S, loop: l, loops: L, hold: false, bpm: bpms[s−1] } }` |
| Tail slot | `{ kind: 'beat', beat, loop: 1, clicksPerBeat: 1, ramp: { step: S, steps: S, loop: 0, loops: L, hold: true, bpm: bpms[S−1] } }` |

The click `kind` is `accent` for every count-in click and for beat 1 of a loop, and `normal`
for the other beats. There are never `sub` clicks (FR-007).

## 3. Store state (`src/lib/state/metronome.svelte.ts`)

The `state` object gains these fields:

| Field | Type | Initial | Notes |
|---|---|---|---|
| `speed` | `SpeedSettings` | `DEFAULT_SPEED_SETTINGS` | Edited only in the settings phase while `mode === 'speed'` |
| `finished` | `number` | `0` | Bumped once per Stop ending, and drives the focus move in the panel |

The `mode` field is now `'plain' | 'speed' | 'ratios'`.

**Run phases**: these are unchanged (`settings → starting → running ⇄ paused → settings`). There
is one new transition, `running → settings` on the scheduler's `onEnd`. It clears the position,
keeps the values, announces `Finished at {target} BPM` and bumps `finished`. Pause, Reset,
selecting a tab, a route change and `restore()` are unchanged; each halts at once.

**Derived getters** (contracts/metronome-store-api.md):

| Getter | Speed mode value |
|---|---|
| `bpm` | `position.ramp.bpm` once a click has sounded, else `speed.startBpm` |
| `steps` | `speedSteps(speed).length` |
| `speedStatus` | `{ kind: 'step', step, steps, loop, loops } \| { kind: 'hold', steps } \| null` (null in other modes and during a count-in) |
| `sub` | `null` |
| `dots` | `beatDots(speed.beats, beat)` (empty during a count-in) |

## 4. Stored record (`src/lib/prefs/schema.ts`)

`Preferences.metronome` becomes
`{ ratios: MetronomeSettings; plain: PlainSettings; speed: SpeedSettings; mode: MetronomeMode }`.

```text
metronome?: {
  ratios?: { …035 shape… },
  plain?:  { …036 shape… },
  speed?: {
    startBpm: integer 30..300,
    targetBpm: integer 30..300,   // lifted to startBpm on read when below it
    increment: integer 1..20,
    loops: integer 1..16,
    beats: integer 1..16,
    countIn: boolean,
    initialCountIn: integer 0..8,
    repeatCountIn: integer 0..8,
    atTarget: "hold" | "stop"
  },
  mode?: "plain" | "speed"
}
```

**Read rules** (these continue 036's R7–R12):

- **R13**: `speed` missing, `null`, an array or not an object gives `DEFAULT_SPEED_SETTINGS`.
- **R14**: each `speed` field is checked against its own type and range (integers only, no
  numeric strings) and falls back to its default independently.
- **R15**: after R14, when `targetBpm < startBpm`, `targetBpm` becomes `startBpm`.
- **R16**: `mode` of `"plain"` or `"speed"` is kept; any other value or a missing one gives
  `"ratios"`.
- **R17**: an invalid `speed` never changes `ratios`, `plain` or `mode`, and the other way
  round.

**Write rules** (these continue W5–W8):

- **W9**: inside `metronome` the keys are ordered `ratios`, `plain`, `speed`, `mode`.
- **W10**: `speed` is omitted when every field equals its default. Otherwise all nine fields are
  written in the fixed order above.
- **W11**: `mode` is written for `"plain"` and `"speed"` and omitted for `"ratios"`.
- **W12**: `metronome` is omitted when it would be empty.

**Erase preferences** clears the whole record, so `speed` goes with it. `restore()` then
applies the defaults.

## 5. Catalog keys (`messages/{en,pt-BR,es}.json`)

| Key | en |
|---|---|
| `metronome_mode_speed` | Speed Training |
| `metronome_start_bpm_label` / `_decrease` / `_increase` | Start BPM / Decrease start BPM / Increase start BPM |
| `metronome_target_bpm_label` / `_decrease` / `_increase` | Target BPM / Decrease target BPM / Increase target BPM |
| `metronome_increment_label` / `_decrease` / `_increase` | Increment / Decrease increment / Increase increment |
| `metronome_loops_label` / `_decrease` / `_increase` | Loops per step / Decrease loops per step / Increase loops per step |
| `metronome_at_target_label` | At target |
| `metronome_at_target_hold` / `metronome_at_target_stop` | Hold / Stop |
| `metronome_status_step` | STEP {step}/{steps} |
| `metronome_status_loop` | LOOP {loop}/{loops} |
| `metronome_status_hold` | HOLD |
| `metronome_announce_started_speed` | Started, {start} to {target} BPM, {beats} beats |
| `metronome_announce_started_speed_count_in` | Started, {start} to {target} BPM, {beats} beats, count in {count} |
| `metronome_announce_step` | Step {step} of {steps}, {bpm} BPM |
| `metronome_announce_hold` | Holding at {bpm} BPM |
| `metronome_announce_finished` | Finished at {bpm} BPM |
| `metronome_announce_paused_step` | Paused, step {step} of {steps}, loop {loop} of {loops}, beat {beat} of {beats} |
| `metronome_announce_paused_hold` | Paused, holding at {bpm} BPM, beat {beat} of {beats} |

The Increment value text uses the existing `metronome_bpm_unit` (`5 BPM`). The Start button
reuses `metronome_start` ("Start Training").
