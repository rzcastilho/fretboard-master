# Research: Speed Training Mode (037)

Phase 0 of the plan. Each entry records the decision, its rationale and the alternatives that
were rejected. The Technical Context had no `NEEDS CLARIFICATION` left after reading the code
(`src/lib/audio/metronome{,-cycle}.ts`, `src/lib/state/metronome{.svelte,-settings,-view}.ts`,
`src/lib/prefs/schema.ts`, `src/lib/tools/metronome/*`), so the entries below resolve the open
design questions the spec leaves to planning.

## R-01 How the tempo changes inside one run

**Decision**: The click scheduler learns a second timing shape, a **tempo ramp**. A new pure
module `src/lib/audio/metronome-ramp.ts` lays a Speed Training run out as a sequence of
**blocks**, one per step. Block *i* plays at `bpm[i]` and holds the step's loop slots, followed
by the Repeat Count In that precedes step *i + 1* (FR-006: the count-in plays at the tempo of
the step just completed). Block 0 also starts with the Initial Count In at Start BPM. The
start time of each block is computed **once** per run as an exact sum
`blockStart[i + 1] = blockStart[i] + slots[i] × 60 / bpm[i]` over at most 271 blocks. A slot's
time is `blockStart[b] + (slot − blockSlot0[b]) × 60 / bpm[b]`. This is an integer slot
difference times a period, never accumulated tick by tick. The Hold tail after the last block
uses the same rule at Target BPM (`holdStart + (slot − holdSlot0) × 60 / target`). The scheduler
stays one segment for the whole run, so there is no restart and no re-anchoring at a step
boundary (FR-011).

**Rationale**: ADR 0030 requires every click time to come from the anchor and an integer index,
so that nothing drifts. A piecewise-constant grid keeps that property inside each block, and the
block start times are a fixed prefix sum, not a running total. Keeping one segment means the
boundary click is scheduled inside the same 1.5 s horizon as its neighbours, with no gap and no
extra click.

**Alternatives considered**:
- *Halt and start a new segment at each step*: each start re-anchors at `now() + 20 ms` and
  drops the clicks already queued in the horizon. The result is an audible gap or flam at every
  step, which fails FR-011. The halt also cancels sources, so the boundary would depend on
  main-thread timing.
- *Extend `metronome-cycle.ts` (`RunPlan`) with a ramp variant*: its layout is periodic (cycle
  of `S` slots, `% S` arithmetic) and every function would need a second branch. A separate
  module keeps the 034 cycle maths untouched and byte-identical for Ratios and Metronome runs.
- *One `period` per click stored in an array*: up to ~71 k entries for the longest run,
  rebuilt on every Resume. The block table holds at most 271 entries.

## R-02 Scheduler surface for the ramp

**Decision**: `SegmentStart` gains an optional `ramp` field
(`{ bpms, loops, repeatCountIn, atTarget }`, contracts/click-engine-api.md §2). When it is present, the
scheduler uses the ramp layout for `clickAt`, `slotStart` and the time of a click. `Grid`
gains an optional `ramp: RampPlan`. `clickTime`, `skipTo` and `indexAt` keep their signatures
and branch once on `g.ramp`: with no ramp they run today's constant-period code unchanged. The
`clicksPerBeat` of a ramp run is always 1, so a slot is exactly one click (`slotStart` is the
identity). The only change seen by existing callers is a new optional field.

**Rationale**: It is the smallest change that keeps a single scheduler (ADR 0030 "engine
boundary kept"), and the old paths stay byte-identical (FR-014, SC-007). It is guarded by the
existing `tests/unit/audio/metronome.test.ts` suite, which must pass unchanged.

**Alternatives considered**: A second scheduler factory (`createRampScheduler`) would duplicate
the pump, frame loop, halt and suspend logic (~200 lines) for one mode. A generic "timeline"
interface would also be possible, but its only two implementations would be these two, and the
branch is three lines.

## R-03 Where step tempos are computed

**Decision**: `speedSteps(s: SpeedSettings): readonly number[]` lives in
`src/lib/state/metronome-settings.ts` (pure). It returns
`[start, start + inc, start + 2·inc, … while < target, target]`, and `[start]` when target
equals start. The state passes the array to the scheduler as `ramp.bpms`. `toRampPlan` in the
audio module validates it: 1–271 entries, integers 30–300, strictly increasing. Any invalid
value falls back to `[bpm]`, a single step at the segment's `bpm`, and the module never throws.

**Rationale**: The state layer owns settings maths (031 data-model §1). The audio module stays
ignorant of Start, Target and Increment, so it only plays what it is given. A property test
(fast-check, SC-003) proves the result over the whole input space: the first item is Start, the
last is Target, the items rise strictly, each gap is Increment except the last (≤ Increment),
and the count is `ceil((target − start) / inc) + 1`, or 1 when target equals start.

**Alternatives considered**: Computing the steps in the audio module from `(start, target,
increment)`. That would move a settings rule into `src/lib/audio` and need a second clamp
table.

## R-04 Position reported for a ramp run

**Decision**: `SlotPosition` keeps its two kinds. Each gains an optional `ramp` field filled
only by ramp runs:
- `beat`: `ramp: { step, steps, loop, loops, hold, bpm }`, where `loop` is 1-based within the
  step and `hold` is true in the tail.
- `count-in`: `ramp: { step, steps, bpm }`, where `step` is the step the count-in leads into
  and `bpm` is the tempo it plays at.

The existing `loop: 1 | 2` (Ratios Loop 1 or Loop 2) is set to `1` for ramp beats. `next` is
set to `1` for ramp count-ins. The store reads `ramp` for the status line, the BPM readout and
the announcements.

**Rationale**: The store already keeps "the last slot that sounded" as its only run position.
With this, Pause, Resume (`startSlot = slot + 1`), the status line and the paused announcement
all come from one value, as in 031–036. A Hold position is just a slot past the last block, so
Pause and Resume in Hold need no special code (FR-009).

**Alternatives considered**: A third `kind: 'speed-beat'`. Every existing `kind === 'beat'`
consumer (dots, `metronome.beat`, the paused announcements) would then need a new branch.
Deriving the step in the store from the slot index would duplicate the ramp layout in the state
layer.

## R-05 Stop ending: when and how the run ends

**Decision**: With `atTarget: 'stop'`, the ramp layout has an `endSlot` equal to the total slot
count. The pump never schedules a click at or after `endSlot`. The scheduler calls a new event,
`onEnd()`, once audible time reaches `time(endSlot)`, which is exactly one beat interval at
Target BPM after the final beat. The check runs in **both** the 25 ms pump and the frame loop.
After `onEnd` fires, the scheduler halts itself with the new `HaltReason` `'end'`, which logs
`click-cancel` with `count: 0`. The store's handler returns to the settings view, keeps the
values, posts `Finished at {target} BPM` and bumps a `finished` counter. The panel moves focus
to the Start button when that counter changes (FR-009, FR-016).

**Rationale**: "One beat interval after the last beat, with no click at that moment" is the
clarified rule. The frame loop alone is not enough: `requestAnimationFrame` does not run in a
hidden tab, and the click deliberately keeps running there (031 FR-016). The pump's throttled
timer, about 1 s at worst, still ends a hidden run. Driving the end from the scheduler's own
clock keeps it deterministic under the fake clock (Principle IV).

**Alternatives considered**: A `setTimeout` in the store for the computed end time. That timer
would be a second clock, would drift from the audio clock and would need cancelling on every
halt path. Ending at the last beat itself would cut that beat's length short and contradict the
clarification.

## R-06 Speed Training settings, defaults and the Start/Target rule

**Decision**: There is a new `SpeedSettings` record (data-model §1) with the defaults
`{ startBpm: 85, targetBpm: 125, increment: 5, loops: 4, beats: 4, countIn: true,
initialCountIn: 4, repeatCountIn: 2, atTarget: 'hold' }`. All edits go through two pure
helpers:
- `withStartBpm(s, v)` sets Start to `clampBpm(v)` and Target to `max(target, start)`.
- `withTargetBpm(s, v)` sets Target to `max(clampBpm(v), start)`.

`atLimit` for `targetBpm` and `dir = −1` is `target ≤ start`, so the Target − button is
disabled exactly while Target equals Start (FR-003). Increment is clamped to 1–20 and Loops per
step to 1–16. Both use the existing `clampTo` rounding, where NaN gives the minimum.

**Rationale**: These are the spec's clarified rules, expressed in one place, so the slider,
the − / + buttons, the arrow keys and typed entry all behave the same way: every one of them
calls a `set*` or `step*` action that goes through these helpers.

**Alternatives considered**: Giving the Target slider `min = start`. The spec's clarification
explicitly keeps the 30–300 range, and a moving `min` would make the slider's scale jump while
Start is edited.

## R-07 Slider re-sync when a commit is clamped to the same value

**Decision**: `ValueRow.svelte` gains two optional props:
- `floor?: number` (default `min`). The − button is disabled when `value <= floor`.
- After calling `onset`, the component writes the prop value back into the `<input>`, so a
  slider dragged below Start snaps back to Start even though the store value did not change.

**Rationale**: The range input is uncontrolled between renders. When the store rejects a
change (Target clamped to the unchanged Start), Svelte sees no new prop value and does not
patch the DOM. Without the write-back, the thumb would stay below the value shown in the pill.
This is the only component change outside the new mode, and existing rows get the same
behaviour for free. That is harmless, because today their commits always equal the input.

**Alternatives considered**: Bumping a `{#key}` on every rejected commit. That remounts the
input, which drops keyboard focus mid-drag and fails Principle V.

## R-08 At target control

**Decision**: The At target control is a native radio group: a `<fieldset>` with a `<legend>`
"At target" and two `<input type="radio">` options, "Hold" and "Stop", styled as a two-option
segmented pill with design tokens. It lives in a new component,
`src/lib/tools/metronome/AtTargetSelect.svelte`.

**Rationale**: Native radios give the right semantics, arrow-key behaviour and form-control
announcements with no ARIA plumbing. A switch would be wrong, because Hold and Stop are two
named choices, not on and off. A `<select>` hides the choice behind a menu, against Principle
VII ("main controls never behind a menu") for a two-option control.

**Alternatives considered**: `role="switch"` like Count In (rejected: wrong semantics). Two
toggle buttons with `aria-pressed` (rejected: they need hand-rolled mutual exclusion).

## R-09 Status line and BPM readout

**Decision**: `statusParams` (metronome-view.ts) gains two kinds:
- `{ kind: 'step', step, steps, loop, loops }`, rendered as `STEP s/S · LOOP l/L`.
- `{ kind: 'hold', steps }`, rendered as `STEP S/S · HOLD`.

Each part is its own `nowrap` span joined by `summary_separator`, as with `SUB`. This lets the
line wrap between parts at 320 px but never inside a part. Before the first click, with no
count-in, the line shows `STEP 1/S · LOOP 1/L`. The count-in kinds are reused as they are. The
readout shows `metronome.bpm`, the tempo of the slot that last sounded: during a count-in that
is the previous step's tempo, Start BPM before the first click, and the step tempo from its
first loop click (FR-006). The Speed Training status line shows no `BEAT` part (FR-008); the
dots carry the beat.

**Rationale**: It follows the 032 pattern for multi-part status lines, and the edge case
`STEP 261/261 · LOOP 16/16` fits at 320 px because it can wrap at the separator.

**Alternatives considered**: A `–` placeholder (`LOOP –/L`) before the first click. That would
need two new "none" strings for no user value. The run is about to begin at step 1, loop 1.

## R-10 Announcements

**Decision**: The store posts the polite announcements in FR-012 and FR-016 from the scheduler
events:
- On `onBeat`, when `ramp.loop === 1 && beat === 1 && ramp.step > 1` and not in Hold:
  `Step {s} of {S}, {bpm} BPM`.
- On the first Hold slot (`ramp.hold`, whose previous reported slot was not Hold):
  `Holding at {bpm} BPM`.
- On `onEnd`: `Finished at {target} BPM`.
- On Pause, the two new paused strings, or the existing count-in ones during a count-in.

There are no announcements per loop or per beat.

**Rationale**: Sound must not be the only carrier of information (Principle V), and one
announcement per step keeps the polite region quiet. A step lasts at least `L × N` beats, about
0.2 s at the minimum, 300 BPM with 1 loop of 1 beat. That is an edge where announcements would
queue, but only the latest text matters in a polite region.

**Alternatives considered**: Announcing every loop (rejected in clarification as noisy).

## R-11 Store integration

**Decision**: `metronome.svelte.ts` gains `state.speed: SpeedSettings` and `state.finished`. It
extends `MetronomeMode` to `'plain' | 'speed' | 'ratios'` and `METRONOME_MODES` to
`['plain', 'speed', 'ratios']` (tab order, FR-001). The shared actions route by mode:
- `setBeats` / `stepBeats` go to the speed record in Speed mode.
- `setCountIn`, `set*CountIn` and `step*CountIn` go there too, and Repeat Count In is accepted
  in Speed mode.
- `setBpm` / `stepBpm` are no-ops in Speed mode.

There are new actions: `setStartBpm` / `stepStartBpm`, `setTargetBpm` / `stepTargetBpm`,
`setIncrement` / `stepIncrement`, `setLoops` / `stepLoops` and `setAtTarget`. There are new
getters: `speed`, `bpm` (the readout tempo), `steps` and `finished`. `current` is narrowed to
the fields every mode shares (`beats`, `countIn`, `initialCountIn`). `commitSpeed` follows the
same assign-then-remember rule as `commitPlain`. `remember()` writes
`{ ratios, plain, speed, mode }`. `restore()` takes `speed`.

**Rationale**: It is the 036 pattern (R-01 there): one store and one scheduler, with per-mode
records and nothing copied between modes (FR-013, spec clarification 2).

**Alternatives considered**: A separate `speedTraining` store. It would need a second
scheduler owner, and ADR 0030 says only `metronome.svelte.ts` creates one.

## R-12 Preferences record

**Decision**: The record stays at `version: 1`. `Preferences.metronome` gains
`speed: SpeedSettings`, and `mode` accepts `'speed'`. Reading:
- `parseSpeed` validates each field with Valibot `v.fallback` to its default, then lifts Target
  to Start.
- A missing or non-object `speed` gives all defaults.
- `parseMode` accepts `'plain'` and `'speed'`, and anything else reads as `'ratios'`.

Writing:
- The keys are ordered `ratios`, `plain`, `speed`, `mode`, each only when non-default.
- `speed` keys are written in the fixed order `startBpm, targetBpm, increment, loops, beats,
  countIn, initialCountIn, repeatCountIn, atTarget`.
- `mode` is written when it is `'plain'` or `'speed'`.

`METRONOME_SPEED_DEFAULTS` mirrors `DEFAULT_SPEED_SETTINGS`, with a parity test (036 R-10).

Two existing fixtures change meaning. Their files stay byte-identical; only the expected parse
in `fixtures/index.ts` and the tests that assert on them change:
- `metronome-bad-mode.txt` (`"mode":"speed"`) now reads as mode `'speed'`.
- `metronome-other-mode.txt` (`"speed":{"bpm":100}`) now reads `speed` as an object whose only
  key is unknown. It gives speed defaults, and it still re-serializes with no `speed` key.

036's C12 (`"speed"` → `'ratios'`) and C6 ("unknown `speed` key dropped") are restated for the
new meaning (contracts/preferences-record.md).

**Rationale**: FR-013 requires this format. No record written by a released build can contain
`mode: "speed"` or a `speed` object: 036's writer only emits `"plain"`, and these fixtures were
hand-written to probe forward compatibility. So no real user's stored state changes meaning,
which honours FR-014 and Principle IX's intent. The fixture files themselves are kept, not
removed.

**Alternatives considered**: Bumping to `version: 2`. That would discard every 035/036 record
under the current "future version → defaults" rule, against FR-013 ("version unchanged").
Renaming the stored key to avoid the old fixtures. That would contradict the spec's field
names.

## R-13 Catalog

**Decision**: 26 new keys in `messages/{en,pt-BR,es}.json` (data-model §5):
- Tab label: `metronome_mode_speed`.
- Row labels and −/+ names: Start BPM, Target BPM, Increment, Loops per step (12 keys).
- At target: label, Hold and Stop (3 keys).
- Status parts: `STEP`, `LOOP`, `HOLD` (3 keys).
- Announcements: started (×2), step, hold, finished, paused step and paused hold (7 keys).

The start button reuses `metronome_start` ("Start Training"). Pause, Resume and Reset reuse
their strings. pt-BR and es label lengths are checked at 320 px in e2e (SC-006), and the tab
label is checked in the narrow, text-only state.

**Rationale**: Principle VIII. Every visible string and accessible name comes from the
catalog.

**Alternatives considered**: Reusing `metronome_status_beat`-style strings with a word
parameter. The word order differs between languages, so each part is its own message.

## R-14 Tab icon

**Decision**: A lightning bolt drawn as inline SVG in `ModeTabs.svelte`, following the 036 R-08
icon approach (`⚡` is not text). The `METRONOME_MODES` array gains `'speed'` between `'plain'`
and `'ratios'`. Equal widths come from the existing `grid-auto-columns: 1fr`.

**Rationale**: It follows the 036 decision. The system font stack does not reliably cover the
emoji, and an emoji would render in colour, breaking the token palette.

**Alternatives considered**: None beyond 036 R-08.

## R-15 Performance and bundle

**Decision**: There is no new dependency. The estimated cost is +3 KB gzip: the ramp module
(~1 KB), the settings maths, `AtTargetSelect`, the panel branch and 26 strings × 3 languages.
This stays under the 160 KB gate (Principle VI). It is checked by `scripts/check-bundle-size.mjs`
in `pnpm verify`. The ramp table is built once per Start or Resume, in O(steps) ≤ 271
iterations. Each lookup is O(log steps) by binary search over block starts.

**Rationale**: Tool switch ≤ 300 ms and tap-to-sound ≤ 100 ms are unaffected. Start still
schedules the first click 20 ms ahead.

**Alternatives considered**: Lazy-loading the mode. ADR 0002 keeps the single bundle.

## R-16 Test strategy

**Decision**:
- **Unit, test-first**:
  - `tests/unit/audio/metronome-ramp.test.ts` (new): the layout, offsets and fast-check
    properties.
  - `tests/unit/audio/metronome.test.ts`: ramp scheduling with the fake clock and port, which
    covers step-boundary intervals, the Stop end with no click at `endSlot`, Hold, and
    Pause/Resume across a boundary and in Hold.
  - `tests/unit/metronome/{settings,view,store,panel,mode-tabs,count-in-settings}.test.ts`.
  - New `tests/unit/metronome/at-target-select.test.ts` and `value-row.test.ts`.
  - `tests/unit/prefs/schema.test.ts` with the new fixtures.
  - `tests/unit/state/preferences-store.test.ts` and `tests/unit/erase-preferences.test.ts`.
- **E2E**: a new `e2e/metronome-speed.spec.ts`. It uses short real-time runs (e.g. Start 290,
  Target 300, Increment 5, 1 loop, 1 beat), reads the audio log's `when` values for the tempo
  checks, runs axe, and checks the layout at 375 px and 320 px in three languages.
  `e2e/metronome-modes.spec.ts` is updated for three tabs.
- **Screenshots**: a new Speed Training settings view baseline. The existing tab-bar baselines
  change (three tabs) and are regenerated through `update-snapshots.yml`.

**Rationale**: Principle IV requires deterministic timing tests through injected clocks.
SC-001's full 9-step run takes about 3.5 minutes in real time, so it is covered by the fake
clock, and e2e checks a fast run end to end.

**Alternatives considered**: Playwright's `page.clock`. It does not drive
`AudioContext.currentTime`, which is the scheduler's clock in a real browser.
