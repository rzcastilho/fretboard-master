---

description: "Task list for Speed Training Mode (037)"
---

# Tasks: Speed Training Mode

**Input**: Design documents from `/specs/037-speed-training/`

**Prerequisites**: plan.md, spec.md, research.md (R-01 … R-16), data-model.md, contracts/, quickstart.md

**Tests**: Included. The constitution (IV Test-First) and plan.md require the ramp layout, settings maths, codec and store to be built test-first. Write each test task first and watch it fail before the implementation task that follows it.

**Organization**: Tasks are grouped by user story. Foundational work (Phase 2) is shared by all stories.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US4, mapped to spec.md
- Paths are relative to the repository root.

## Verification during implementation (from CLAUDE.md)

- Per task, unit: `pnpm vitest run <touched test paths>`. A test that touches `document`, `window` or `localStorage` starts with `// @vitest-environment jsdom`.
- Per task, e2e: `pnpm build:test` once after changing `src/`, then `pnpm test:e2e:fast <spec files>`.
- New or changed screenshot: `pnpm playwright test <spec> -g "<name>" --project=desktop --update-snapshots`.
- End of slice, once: `pnpm verify`. Do NOT run `pnpm test:e2e` or `pnpm lhci` locally.

---

## Phase 1: Setup

**Purpose**: Shared scaffolding that every later task builds on. No new directory is created.

- [X] T001 Add the 26 new catalog keys from data-model.md §5 (`metronome_mode_speed`, the start/target/increment/loops label + decrease + increase triples, `metronome_at_target_label/_hold/_stop`, `metronome_status_step/_loop/_hold`, `metronome_announce_started_speed`, `..._started_speed_count_in`, `..._step`, `..._hold`, `..._finished`, `..._paused_step`, `..._paused_hold`) to `messages/en.json`, `messages/pt-BR.json` and `messages/es.json`. Keep the same placeholders in every language (`{start}`, `{target}`, `{beats}`, `{count}`, `{step}`, `{steps}`, `{loop}`, `{loops}`, `{bpm}`, `{beat}`). Each status part is its own message. Run the project's i18n parity unit test (find it under `tests/unit/` with `grep -rl "pt-BR" tests/unit`) and `pnpm vitest run` on it.
- [X] T002 [P] Create the six new prefs fixture files under `tests/unit/prefs/fixtures/` as listed in contracts/preferences-record.md: `metronome-speed.txt` (the example JSON there), `metronome-mode-speed.txt`, `metronome-speed-invalid.txt`, `metronome-speed-target-below.txt`, `metronome-speed-array.txt`, `metronome-all-modes.txt`. Do not edit the existing fixture files.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: Pure settings maths, ramp layout, scheduler ramp branch and the preferences codec. All user stories depend on these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Settings maths (pure)

- [X] T003 [P] Write failing tests in `tests/unit/metronome/settings.test.ts` for the Speed Training settings per data-model.md §1:
  - `speedSteps` table cases: 80→120/5 gives 9 steps, 80→102/5 gives `[80,85,90,95,100,102]`, 290→300/20 gives `[290,300]`, 300→300 gives `[300]`, 40→300/1 gives 261 steps.
  - A fast-check property for the step-schedule invariants (first = Start, last = Target, strictly increasing, every step ≤ Target, equal gaps except the last, `length ≤ 271`) (SC-003).
  - `withStartBpm` and `withTargetBpm`, with Target never below Start.
  - `clampIncrement` (1–20, NaN gives 1) and `clampLoops` (1–16, NaN gives 1).
  - `atLimit` and `stepSetting` for `SpeedSettings` (Target − at Target = Start returns the same object).
  - `toMode` accepting `'speed'`, and `toAtTarget`.
  - `speedRunPlan`: `clicksPerBeat: 1`, `initialCountIn` from `effectiveCountIn`, `repeatCountIn` 0 when Count In is off.
- [X] T004 Implement the Speed Training settings in `src/lib/state/metronome-settings.ts`, to make T003 pass:
  - Widen `MetronomeMode` to `'plain' | 'speed' | 'ratios'`, and set `METRONOME_MODES = ['plain','speed','ratios']`.
  - Add `AtTarget`, `SpeedSettings`, `DEFAULT_SPEED_SETTINGS` (frozen: 85, 125, 5, 4, 4, true, 4, 2, `'hold'`), `MIN/MAX_INCREMENT` (1/20), `MIN/MAX_LOOPS` (1/16), `MAX_STEPS = 271`, `SharedSettings`, `SpeedField`.
  - Add `clampIncrement`, `clampLoops`, `withStartBpm`, `withTargetBpm`, `speedSteps`, `speedRunPlan`, `toAtTarget`, and extend `toMode`, `atLimit` and `stepSetting`.
  - All of it is pure, total and never throws.
  - Run `pnpm vitest run tests/unit/metronome/settings.test.ts`, then `pnpm check` (or the project's type-check script) to find call sites broken by the wider `MetronomeMode`.

### Ramp layout (pure)

- [X] T005 [P] Write failing tests in `tests/unit/audio/metronome-ramp.test.ts` (new) for contracts/click-engine-api.md E1–E5 and E7:
  - **E1**: invalid `bpms` (empty, longer than 271, not strictly increasing, non-integer, out of range) give `[bpm]`; `loops` outside 1–16 gives 1; `repeatCountIn` outside 0–8 gives 0; never throws.
  - **E2**: 80→120/5, L = 4, N = 4, k = 4, r = 2 gives 164 slots, and `endSlot = 164` for Stop.
  - **E3**: `rampOffset(s+1) − rampOffset(s)` equals `60/bpm` of the block holding slot s, to 1e-9, for every slot, and by fast-check over random ramps. This includes the last count-in click, which is spaced at the previous tempo.
  - **E4**: no drift in the tail at slot `tailSlot + 10⁶`.
  - **E5**: `rampSlotFloor` identity and `−1e-6` cases.
  - **E7**: tail slots carry `ramp.hold = true`.
  - The `rampSlotAt` positions and `rampClickAt` kinds from data-model.md §2 (accent on count-in clicks and beat 1, never `sub`).
  - A single-step ramp with no repeat count-in.
- [X] T006 Add the optional `ramp` fields to `SlotPosition` (types only) in `src/lib/audio/metronome-cycle.ts`, per contracts/click-engine-api.md §1. Do not change any runtime code there.
- [X] T007 Implement `src/lib/audio/metronome-ramp.ts` (new, pure, framework-free): the `RampInput` and `RampPlan` types, `toRampPlan`, `rampSlotAt`, `rampClickAt`, `rampOffset` and `rampSlotFloor`. Follow the layout table in data-model.md §2. Block start times come from one exact prefix sum. `rampSlotFloor` uses binary search over the blocks. Make T005 pass: `pnpm vitest run tests/unit/audio/metronome-ramp.test.ts`.

### Scheduler ramp branch and `onEnd`

- [X] T008 Write failing tests in `tests/unit/audio/metronome.test.ts` for E6, E8 and E10, using the fake clock, frames and port in `tests/unit/audio/support/fake-audio`. Do not edit any existing test (E9).
  - **E6**: Stop never schedules an index ≥ `endSlot`. `onEnd` fires exactly once, at the first pump or frame where `now() − latency() ≥ anchor + tailT0 − offset(startSlot)`. It also fires from the pump timer when frames are paused, as in a hidden tab (R-05). After it fires, `live` is false and `halt()` returns `{ kind: 'none' }`.
  - **E8**: `start({ …, ramp, startSlot })` resumes inside a block, across a boundary and in the tail.
  - **E10**: log entries for ramp runs, and `click-cancel` with `reason: 'end'` and `count: 0`.
- [X] T009 Implement the ramp branch in `src/lib/audio/metronome.ts`, per contracts/click-engine-api.md §2 and plan.md note 2:
  - Add `SegmentStart.ramp`, `SchedulerEvents.onEnd` and `HaltReason 'end'`.
  - Add a `Grid.ramp` branch tested once in each of `clickTime`, `skipTo` and `indexAt`. Keep the periodic branch textually unchanged.
  - Stop `endSlot` handling checked in `pump` before scheduling (R-05) and on frames.
  - Run `pnpm vitest run tests/unit/audio/` and confirm all pre-existing metronome and cycle tests pass untouched (E9).

### Preferences codec

- [X] T010 [P] Write failing tests in `tests/unit/prefs/schema.test.ts` for C9–C12 and C15–C18, per contracts/preferences-record.md §3:
  - Register the six new fixtures in `tests/unit/prefs/fixtures/index.ts`.
  - Update the expected parse of `metronome-bad-mode` (mode `'speed'`) and `metronome-other-mode` (speed defaults) as R-12 explains. Do not edit those two fixture files.
  - Cover: R13–R17 read rules, W9–W12 write rules, key order `ratios, plain, speed, mode`, the fast-check round trip with all nine speed fields and three modes, `METRONOME_SPEED_DEFAULTS` parity with `DEFAULT_SPEED_SETTINGS` and `METRONOME_MODES` parity (C18), and C1 byte-identical defaults.
- [X] T011 Implement the codec in `src/lib/prefs/schema.ts`, to make T010 pass:
  - Add `Preferences.metronome.speed` (type-only import from state), `METRONOME_SPEED_DEFAULTS`, `METRONOME_MODES = ['plain','speed','ratios'] as const`, and `increment: [1,20]` and `loops: [1,16]` in `METRONOME_LIMITS`.
  - Parse each field with a Valibot fallback, then lift Target to Start. Integers only. `atTarget` is `"hold"` or `"stop"`.
  - Serialize per W9–W12: omit `speed` when all defaults, write `mode` for `plain` and `speed`, omit `metronome` when empty.
  - Parsing never throws.
- [X] T012 Wire `speed` through `src/lib/state/preferences.svelte.ts`: `restore()` passes `p.metronome.speed`. Extend `tests/unit/state/preferences-store.test.ts` and `tests/unit/erase-preferences.test.ts` so Erase preferences clears `speed` and restores the defaults and the Ratios mode. Run `pnpm vitest run tests/unit/prefs/schema.test.ts tests/unit/state/preferences-store.test.ts tests/unit/erase-preferences.test.ts`.

**Checkpoint**: The pure core, the scheduler and the codec are done and tested. User stories can start.

---

## Phase 3: User Story 1 - Climb from a start tempo to a target tempo (Priority: P1) 🎯 MVP

**Goal**: Pressing Start on the Speed Training tab plays loops at each step tempo, with count-ins, and the status line and BPM readout follow the run.

**Independent Test**: With the defaults (or Start 80, Target 120, Increment 5, 4 loops, 4 beats, Count In on), press Start. The status goes `COUNT IN 1/4` then `STEP 1/9 · LOOP 1/4`, with a 2-click count-in at the old tempo between steps, and the readout changes at each step's first loop click.

### Tests for User Story 1

- [X] T013 [P] [US1] Write failing store tests in `tests/unit/metronome/store.test.ts` (fake clock, port and frames) for S6, S7, S12 and S14, plus `bpm`, `steps` and `speedStatus` before the first click (`{ step: 1, loop: 1 }`):
  - S6: 80→120/5 gives `4 + 144 + 16` clicks, with statuses `COUNT IN 1/4 … 4/4` then `STEP 1/9 · LOOP 1/4 … STEP 9/9 · LOOP 4/4`; `bpm` is 80 through step 1 and its following count-in, then 85 from step 2's first loop click.
  - S7: 80→102/5 gives `steps = 6` and the `bpm` values `[80,85,90,95,100,102]`.
  - S12: mode isolation, and `selectMode('speed')` during a Ratios run halts at once.
  - S14: `remember()` sends `{ ratios, plain, speed, mode }` as one object.
  - Start announces `metronome_announce_started_speed` (and `_count_in` when a count-in plays).
  - Step announcements fire once per step s ≥ 2, at its first loop click (S10 first part). Loops and beats are never announced.
- [X] T014 [P] [US1] Write failing tests in `tests/unit/metronome/view.test.ts` for the `statusParams` kinds `step` and `hold`, and in `tests/unit/metronome/mode-tabs.test.ts` for the three tabs in order (`metronome-tab-plain`, `-speed`, `-ratios`), arrow wrap across three, Home and End, and the lightning-bolt icon being `aria-hidden`.
- [X] T015 [P] [US1] Write a failing panel test in `tests/unit/metronome/panel.test.ts` (jsdom docblock): in Speed mode while running, the position line reads `STEP s/S · LOOP l/L`, the tempo readout shows `metronome.bpm`, and the dots show `speed.beats`. Also assert that no BPM row, Subdivision ratio section or Loop 1 / Loop 2 rows are rendered in the speed settings view.

### Implementation for User Story 1

- [X] T016 [US1] Extend `src/lib/state/metronome-view.ts` with the `step` and `hold` kinds in `statusParams`.
- [X] T017 [US1] Extend `src/lib/state/metronome.svelte.ts` per contracts/metronome-store-api.md:
  - Add `state.speed` and `state.finished`, and the getters `speed`, `bpm`, `steps` and `speedStatus`. Narrow `current` to `SharedSettings`. `sub` is `null` in Speed mode.
  - Make `selectMode` accept `'speed'`.
  - In Speed mode, `toggle()` starts with `speedRunPlan(speed)` at slot 0 and announces the started string.
  - Make the shared setters (`setBeats`, `setCountIn`, the Initial and Repeat count-in setters) edit `speed` in Speed mode. Make `setBpm`, `stepBpm`, `setRatio`, `setSubdivision` and `setLoop2` no-ops there.
  - Announce each step change at its first loop click.
  - `remember()` and `restore()` carry `speed`.
  - Make T013 pass: `pnpm vitest run tests/unit/metronome/store.test.ts`.
- [X] T018 [P] [US1] Add the third tab with an inline lightning-bolt SVG (`aria-hidden`) and the equal-width, text-only-at-30rem rule in `src/lib/tools/metronome/ModeTabs.svelte`, per contracts/speed-training-ui.md §1.
- [X] T019 [P] [US1] Render `STEP s/S · LOOP l/L` with each part in a `nowrap` span (wrapping only at the ` · ` separator) in `src/lib/tools/metronome/StatusBox.svelte`. Keep `COUNT IN n/M` as it is.
- [X] T020 [US1] Add the Speed branch to `src/lib/tools/metronome/MetronomePanel.svelte`: `data-mode="speed"`, the tempo readout from `metronome.bpm`, the dots from `speed.beats`, the `Start Training` button, and the run controls. The settings rows are added in US3, so this task shows only the button in the settings view. Make T014 and T015 pass: `pnpm vitest run tests/unit/metronome/`.
- [X] T021 [US1] Create `e2e/metronome-speed.spec.ts` with quickstart scenarios 6 and 8:
  - A fast run (Start 290, Target 300, Increment 5, 1 loop, 1 beat, Count In 1/1) from defaults is not enough, so drive the controls in US3 or seed the preferences record in `localStorage` with the speed example before load. The audio log intervals are ≈ 60/290 through the boundary count-in click, then 60/295, then 60/300, each within 2 ms, and the `.position` text passes `STEP 1/3 · LOOP 1/1`, `STEP 2/3`, `STEP 3/3`.
  - Run `pnpm build:test` then `pnpm test:e2e:fast e2e/metronome-speed.spec.ts`.

**Checkpoint**: US1 works end to end with seeded settings. This is the MVP.

---

## Phase 4: User Story 2 - Finish at the target (Priority: P1)

**Goal**: At the target, either Hold keeps clicking at Target BPM or Stop ends the run one beat after the last beat, with focus on `Start Training`.

**Independent Test**: Run Start 100, Target 105, Increment 5, 1 loop once with Hold and once with Stop.

### Tests for User Story 2

- [X] T022 [P] [US2] Write failing store tests in `tests/unit/metronome/store.test.ts` for S8 and S9:
  - Hold: the status becomes `{ kind: 'hold', steps: S }` after the last loop, `Holding at {T} BPM` is announced once, clicks go on at 60/T with no count-in, and Pause then Resume continues in Hold at the next beat.
  - Stop: at `anchor + tailT0`, `phase` is `'settings'`, `finished` is bumped once, the announcement is `Finished at {T} BPM`, no click has an index ≥ `endSlot`, and the speed record is unchanged.
  - A single step (Start = Target) shows `STEP 1/1` and then follows the At target rule.
- [X] T023 [P] [US2] Write failing component tests in `tests/unit/metronome/at-target-select.test.ts` (new, jsdom docblock): a `<fieldset>` with a `<legend>`, two native radios (Hold, Stop), the checked state shown by a glyph as well as fill, and arrow-key selection calling the store's `setAtTarget`. In `tests/unit/metronome/panel.test.ts`, add a failing case that focus moves to the `Start Training` button when `finished` grows, and that mount never steals focus.

### Implementation for User Story 2

- [X] T024 [US2] In `src/lib/state/metronome.svelte.ts`: handle `onEnd` (phase to `settings`, clear the position, keep the values, announce `Finished at {target} BPM`, bump `finished`), enter Hold with `speedStatus` `{ kind: 'hold', steps }` and a single `Holding at {bpm} BPM` announcement, and add `setAtTarget(v)` (ignores any value other than `'hold'` or `'stop'`). Make T022 pass.
- [X] T025 [P] [US2] Create `src/lib/tools/metronome/AtTargetSelect.svelte`: the fieldset and two radios, 44 px targets (`--target-min`), `--color-focus-ring`, a fill-plus-check-glyph checked state, and `Highlight` in forced colours. Use design tokens only. Make T023's component cases pass.
- [X] T026 [US2] In `src/lib/tools/metronome/MetronomePanel.svelte`: render `AtTargetSelect` in the settings view (row 7), show `STEP S/S · HOLD` through `StatusBox` in Hold, and keep the last-seen `finished` value so that the panel focuses `startButton` after `tick()` only when the value grows (plan.md note 5). Add `StatusBox.svelte` Hold rendering if it is not already covered by T019.
- [X] T027 [US2] Add to `e2e/metronome-speed.spec.ts` quickstart scenarios 9, 10 and 11: Hold shows `STEP 3/3 · HOLD`, clicks continue at 60/300 with no count-in, and `Holding at 300 BPM` is announced. Stop returns to settings about one beat after the last beat with no later click in the audio log, focus on `Start Training`, the live region reads `Finished at 300 BPM`, and the values are unchanged. Start 300 gives a single step. Run `pnpm build:test` and `pnpm test:e2e:fast e2e/metronome-speed.spec.ts`.

**Checkpoint**: Both endings are predictable and tested.

---

## Phase 5: User Story 3 - Set up the climb with safe settings (Priority: P1)

**Goal**: The settings view offers every Speed Training row, with Target never below Start.

**Independent Test**: Open the Speed Training tab and edit every row with the pointer and the keyboard.

### Tests for User Story 3

- [X] T028 [P] [US3] Write failing store tests in `tests/unit/metronome/store.test.ts` for S11 and the setters: `stepTargetBpm(−1)` and `setTargetBpm(start − 10)` keep Target = Start, `setStartBpm(target + 5)` raises Target, `setStartBpm(start − 5)` leaves Target, `setIncrement` and `setLoops` clamp to 1–20 and 1–16, and an equal record commits and writes nothing. Setters are no-ops outside the settings phase or outside Speed mode.
- [X] T029 [P] [US3] Write failing tests in `tests/unit/metronome/value-row.test.ts` (new, jsdom docblock): `floor` disables the − button at `value <= floor` (default `min`), and a clamped commit writes the `value` prop back into the `<input>` so the slider snaps back (R-07).
- [X] T030 [US3] Extend `tests/unit/metronome/panel.test.ts` with failing cases for the Speed settings view: rows appear in the order Start BPM, Target BPM, Increment, Loops per step, # of Beats, Count In (with Initial and Repeat rows shown only while the switch is on), At target, `Start Training` (contracts/speed-training-ui.md §2). The defaults are 85, 125, 5, 4, 4, on (4, 2) and Hold. The Target − button is disabled when Target equals Start. The row ids are `metronome-start-bpm`, `-target-bpm`, `-increment`, `-loops` and `-beats`.

### Implementation for User Story 3

- [X] T031 [US3] Add `setStartBpm`, `stepStartBpm`, `setTargetBpm`, `stepTargetBpm`, `setIncrement`, `stepIncrement`, `setLoops` and `stepLoops` to `src/lib/state/metronome.svelte.ts`, per contracts/metronome-store-api.md §2. Each commit assigns the record and then calls `remember()`. Make T028 pass.
- [X] T032 [P] [US3] Add the optional `floor` prop and the write-back after `onset` to `src/lib/tools/metronome/ValueRow.svelte`. Existing callers must behave as before. Make T029 pass, and re-run the existing panel and count-in tests.
- [X] T033 [US3] In `src/lib/tools/metronome/MetronomePanel.svelte`, render the Speed settings rows in the order of contracts/speed-training-ui.md §2 using `ValueRow` (Target uses `floor = speed.startBpm`) and the existing `CountInSettings` with `repeat = true`. Show no BPM row, ratio section or Loop rows. Make T030 pass: `pnpm vitest run tests/unit/metronome/`.
- [X] T034 [US3] Add to `e2e/metronome-speed.spec.ts` quickstart scenarios 1–5, 14 and 15's metronome checks:
  - Tab order, arrow keys, Home and End, and Enter to select.
  - The first-use defaults.
  - Filling the Target slider with 60 while Start is 85 leaves it at 85 with Target − disabled; Start 130 lifts Target; Start 100 leaves it.
  - Count In off hides the Initial and Repeat rows and a run starts at `STEP 1/S · LOOP 1/L`.
  - After 80→120 with Stop and a reload, the Speed tab is selected with the same values; Erase preferences returns to the defaults and the Ratios tab.
  - Use this to replace any seeding workaround in T021.
- [X] T035 [P] [US3] Update `e2e/metronome-modes.spec.ts` for three tabs (order, keyboard wrap, equal widths), and add a "speed training settings" screenshot test to `e2e/metronome.spec.ts`. Generate the local desktop baseline: `pnpm playwright test e2e/metronome.spec.ts -g "speed training settings" --project=desktop --update-snapshots`. Linux baselines for the changed tab-bar screenshots come only from `.github/workflows/update-snapshots.yml`.

**Checkpoint**: Every row is editable and the invariants hold.

---

## Phase 6: User Story 4 - Pause, resume and reset (Priority: P2)

**Goal**: Pause holds the exact position, Resume continues with no new count-in, and Reset, Escape and tab switches stop at once.

**Independent Test**: Pause during step 3 loop 2, wait, resume, then reset.

### Tests for User Story 4

- [X] T036 [P] [US4] Write failing store tests in `tests/unit/metronome/store.test.ts` for S10 (the pause part) and S13:
  - Pause during loops announces `Paused, step {s} of {S}, loop {l} of {L}, beat {b} of {N}`.
  - Pause in Hold announces `Paused, holding at {bpm} BPM, beat {b} of {N}`.
  - Pause during a count-in reuses the existing count-in strings, and Resume continues the count-in.
  - Resume continues in the same step, loop and beat with no new count-in (`startSlot = slot + 1`).
  - Reset, Escape, a tab switch and a route change, paused or running, stop with no further click and keep the values. The next Start begins at slot 0, step 1.

### Implementation for User Story 4

- [X] T037 [US4] Add the Speed-mode pause announcements and make sure resume uses `startSlot = slot + 1` through the ramp branch in `src/lib/state/metronome.svelte.ts`. Make T036 pass.
- [X] T038 [US4] Add to `e2e/metronome-speed.spec.ts` quickstart scenarios 12 and 13: pause during step 2 loop 1 announces `Paused, step 2 of 3, loop 1 of 1, beat 1 of 1`; Resume adds no count-in; Reset or Escape returns to settings and the next Start begins at step 1; Space toggles; selecting the Metronome tab mid-run adds no new `click` entries and returning shows the speed values unchanged. Run `pnpm build:test` and `pnpm test:e2e:fast e2e/metronome-speed.spec.ts`.

**Checkpoint**: All four stories work independently.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T039 [P] Add the accessibility and reflow checks of quickstart scenario 16 to `e2e/metronome-speed.spec.ts`: axe reports zero violations in the settings view, the running view and Hold; every control works by keyboard; with the Speed Training tab selected, the settings view, the running view and Hold each show no truncation, overlap or horizontal scroll at 1024 px, 2560 px, 375 px and 320 px in en, pt-BR and es, and at 200 % text zoom at 320 px (the existing `e2e/metronome.spec.ts` width and zoom tests cover only the default Ratios view).
- [X] T040 [P] Confirm that the Ratios and Metronome behaviour and stored values are unchanged (FR-014, SC-007, E9): run `pnpm vitest run tests/unit/audio tests/unit/metronome tests/unit/prefs`, and `pnpm test:e2e:fast e2e/metronome.spec.ts e2e/metronome-modes.spec.ts` after `pnpm build:test`. Confirm that `src/lib/link`, `src/lib/theory`, `src/routes/metronome` and `metronome-keys.ts` are untouched (`git diff --stat`).
- [X] T041 [P] Check the initial JS size against the ≤ 160 KB gzip budget (about +3 KB expected, R-15) with the project's bundle-size check, and check that no new dependency or design token was added.
- [X] T042 Run `pnpm verify` once for the whole slice and fix any failure.
- [X] T043 Record the "Manual checks" note below in this file and list it in the PR description, together with the 036 Complexity Tracking deviation (first visit opens on Ratios Training) from plan.md.

### Manual checks (human step, not automatable)

_Recorded for T043. List these in the PR description, together with the 036 Complexity Tracking deviation from plan.md: a first visit opens on Ratios Training._

- Listen by ear to a 100→120/5 run with 2 loops: the step boundaries should sound with no gap, flam or extra click, and the count-in should be at the old tempo.
- In a real Firefox or Safari window, check that a hidden tab still ends a Stop run (R-05).

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup (T001 for the string keys used later; T002 for T010). It blocks every user story.
  - T003 → T004; T005 → T006 → T007; T008 → T009 (needs T007); T010 → T011 → T012 (T011 needs T004 for the types).
  - The settings, ramp and codec tracks are independent of each other until T009 and T011.
- **US1 (Phase 3)**: Depends on Phase 2. This is the MVP.
- **US2 (Phase 4)**: Depends on Phase 2 and on the store and panel work of US1 (T017, T020).
- **US3 (Phase 5)**: Depends on Phase 2 and on the US1 panel branch (T020). It is independent of US2 except for `AtTargetSelect`, which US2 already adds to the panel.
- **US4 (Phase 6)**: Depends on US1 (store run logic). Hold pause cases need US2's Hold.
- **Polish (Phase 7)**: Depends on all the stories you want to ship.

### Story completion order

US1 → (US2, US3 in parallel) → US4 → Polish.

### Within each story

Test tasks first (failing), then store, then components, then panel, then e2e.

## Parallel opportunities

- Phase 1: T001 and T002 together.
- Phase 2: the three tracks run in parallel, T003/T004 (settings), T005–T007 (ramp), and T010/T011 (codec, after T004's types). T003, T005 and T010 are `[P]` test files.
- US1: T013, T014 and T015 together. Then T018 and T019 together, after T017.
- US2: T022 and T023 together, and T025 in parallel with T024.
- US3: T028 and T029 together, and T032 in parallel with T031. T035 in parallel with T034.
- Polish: T039, T040 and T041 together.

### Example: Foundational tracks

```text
Track A: T003 → T004
Track B: T005 → T006 → T007 → T008 → T009
Track C: T010 → T011 → T012   (after T004)
```

## Implementation strategy

### MVP first (User Story 1)

1. Phase 1 and Phase 2.
2. Phase 3 (US1), then stop and validate: a Speed Training run climbs through the step schedule with count-ins at the old tempo.
3. The default Hold ending already makes the run usable, because the run holds at Target.

### Incremental delivery

1. US1 gives the climb and the status line.
2. US2 adds the Stop ending and the At target control.
3. US3 adds the full settings view and the Start/Target invariant.
4. US4 adds the pause announcements and the reset checks.
5. Polish, `pnpm verify`, and the manual checks.

## Notes

- Keep local runs targeted. Rebuild with `pnpm build:test` only after changing `src/`.
- Commit after each task or logical group. Do not widen the 036 first-visit deviation.
