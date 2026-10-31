---

description: "Task list for 034 Alternate Two Ratios"
---

# Tasks: Alternate Two Ratios

**Input**: Design documents from `/specs/034-alternating-ratios/`

**Prerequisites**: plan.md, spec.md, research.md (R-01…R-12), data-model.md, contracts/ (click-engine-api, metronome-store-api, metronome-ui), quickstart.md

**Tests**: Included. The constitution (Principle IV) requires test-first for logic and tested behaviour for UI, and the spec maps every acceptance scenario to a Vitest or Playwright case (quickstart §1–2). Write each test task first and see it fail before the implementation task it precedes.

**Organization**: Grouped by user story. The cycle engine and the settings/store refactor replace `startBeat`/`countIn` for every consumer, so they sit in Foundational (Phase 2). Each story then adds its own behaviour, UI and tests on top.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US4 from spec.md
- Verification per CLAUDE.md: per task `pnpm vitest run <touched tests>`; for e2e `pnpm build:test` once, then `pnpm test:e2e:fast <spec files>`; `pnpm verify` once at the end. Never run `pnpm test:e2e` or `pnpm lhci` locally.
- Unit tests that render components or touch `document`/`window`/`localStorage` MUST start with `// @vitest-environment jsdom`.

## Path Conventions

Single SvelteKit project: `src/lib/audio/`, `src/lib/state/`, `src/lib/tools/metronome/`, `messages/`, `docs/`, `tests/unit/`, `e2e/`.

---

## Phase 1: Setup

**Purpose**: Shared test and message scaffolding used by several stories.

- [X] T001 [P] Add the 5 message keys to `messages/en.json`, `messages/pt-BR.json` and `messages/es.json` with the exact texts from research.md R-10: `metronome_ratio_heading`, `metronome_loop2_label`, `metronome_announce_started_ratio`, `metronome_announce_started_ratio_count_in` (placeholder `{count}`), `metronome_announce_paused_loop` (placeholders `{beat}`, `{beats}`, `{subdivision}`). Keep key order and formatting consistent with neighbouring `metronome_*` keys, then regenerate Paraglide output the way the repo does (`pnpm check`).
- [X] T002 [P] Add `ratioOff(page)` to `e2e/support/helpers.ts` beside `countInOff`: it turns the "Subdivision ratio" switch off (`getByRole('switch', { name: 'Subdivision ratio' })`, click only when `aria-checked="true"`). Used by the existing 031–033 specs (R-11).
- [X] T003 [P] Add draft glossary rows for "Subdivision ratio" and "Loop 2" (en, pt-BR, es) in `docs/i18n/glossary.md`, using the texts from R-10.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure cycle module, the migrated engine, the new settings fields and the store's `position`. No user story can be verified until these are done.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Cycle module (pure)

- [X] T004 Write the failing table and property tests in `tests/unit/audio/metronome-cycle.test.ts` (node env, fast-check): table 85 BPM, N 4, k 4, r 2, n1 3, n2 6 (slots 0–3 initial, 4–7 Loop 1 with 12 clicks, 8–9 repeat, 10–13 Loop 2 with 24 clicks, 14–15 repeat, 16 Loop 1 beat 1); section off; Count In off; r = 0; n1 = n2; N = 1; `toRunPlan` clamping rules C1 (non-integer or out-of-range → 0 / `clicksPerBeat` → 1, no `alternate` → `repeat = 0`); kinds rule C4 (count-in always `accent`, beat 1 of each loop `accent`, beats 2…N `normal`, others `sub`); C5 round trip `slotAt`/`slotStart`/`clickAt`; C6 `repeat`/`next` flags. Property tests over BPM 30–300 × N 1–16 × k, r 0–8 × n1, n2 1–8: successive slot starts are exactly *T* apart (±1e-9 s) across every boundary; click times strictly increasing; slot `k + m·S` is Loop 1 beat 1 for m ≤ 100; section off equals the 033 sequence after the prefix.
- [X] T005 Implement `src/lib/audio/metronome-cycle.ts` per contracts/click-engine-api.md §1 and data-model.md §2–§5: types `RunPlan`, `CyclePhase`, `SlotPosition`, `CycleClick`, `PlanInput`; `toRunPlan`, `cycleSlots`, `cycleClicks`, `slotAt`, `slotStart`, `clickAt`. Use integer division by `S`/`C` (no loop over earlier cycles) and skip zero-length phases. Keep it framework-free (no Svelte, `$app/*`, i18n, state imports). Run `pnpm vitest run tests/unit/audio/metronome-cycle.test.ts` until green. (depends on T004)

### Engine

- [X] T006 Update `src/lib/audio/types.ts`: the `click` log entry gains `phase: 'initial' | 'repeat' | 'loop1' | 'loop2'`; `slot` becomes run-global and non-negative (count-in slots `0 … k − 1`); `beat` is 0 for count-in clicks; `countIn` is the 1-based number within its own count-in, else `null` (contracts/click-engine-api.md §4). (depends on T005)
- [X] T007 Migrate `tests/unit/audio/metronome.test.ts` to the new API (`startSlot`, `initialCountIn`, `alternate`; `startBeat: b` → `startSlot: b − 1`; `countIn: { from, total }` → `initialCountIn: total, startSlot: from`) and add failing cycle cases with `FakeAudioPort` / `FakeClock` / `FakeFrames`: E1 click time formula, E2 first click ≤ 50 ms and equal to `slotStart(plan, startSlot)`, E3 skip-forward over a switch lands on the right phase with no burst, E4 no-sink visual drive, H1 one event per slot (never for sub-clicks) with the `SlotPosition` as second argument, H2 `halt()` returns the last audible `SlotPosition` or `{ kind: 'none' }` and logs `click-cancel`, H3 superseded segment events dropped. Existing 031–033 cases must keep their meaning (FR-015).
- [X] T008 Edit `src/lib/audio/metronome.ts` per contracts/click-engine-api.md §2–§3: replace `startBeat`/`countIn`/`CountInSpan` in `SegmentStart` with `initialCountIn`, `alternate: { clicksPerBeat, repeatCountIn }`, `startSlot`; schedule, `skipTo` and the audible index work on the cycle in O(1) via `metronome-cycle.ts`; `onBeat(beat, at)` and `onCountIn(click, at)` gain the `SlotPosition`; `HaltedAt = SlotPosition | { kind: 'none' }`; log entries carry `phase` and the run-global `slot`. Time is `anchor + (slot − startSlot)·T + sub·T/n` with the slot difference computed as an integer first. Run `pnpm vitest run tests/unit/audio/metronome.test.ts tests/unit/audio/metronome-cycle.test.ts` until green. (depends on T005, T006, T007)

### Settings and store

- [X] T009 [P] Extend `tests/unit/metronome/settings.test.ts` (failing first): `DEFAULT_SETTINGS` has `ratio: true` and `loop2: 6` with every other default unchanged (S1); `toRatio` returns booleans as-is and `true` for anything else (S2); `effectiveRepeatCountIn` table over countIn × ratio × r (`s.countIn && s.ratio ? s.repeatCountIn : 0`); `runPlanFor` omits `alternate` when `ratio` is false and uses `effectiveRepeatCountIn` inside it (S3); `toSubdivision(v) ?? DEFAULT_LOOP2` falls back to 6.
- [X] T010 Edit `src/lib/state/metronome-settings.ts` per contracts/metronome-store-api.md §1: add `ratio: boolean` (default `true`) and `loop2: Subdivision` (default `6`) to `MetronomeSettings`/`DEFAULT_SETTINGS`, export `DEFAULT_LOOP2`, `toRatio`, `effectiveRepeatCountIn`, `runPlanFor`. Nothing is persisted (FR-012). Run `pnpm vitest run tests/unit/metronome/settings.test.ts`. (depends on T005, T009)
- [X] T011 [P] Extend `tests/unit/metronome/view.test.ts` and `tests/unit/metronome/store.test.ts` (failing first; store tests use `resetMetronomeForTests` with `ratio` / `loop2`, and pass `ratio: false` where they assert 033 wrap-around, R-11): store exposes one `position: SlotPosition | null`; `beat`, `countIn`, `dots`, `sub` derive from it (`beat` = 0 outside a beat position; `countIn` = `{ click, total }` during an initial or repeat count-in, or before the first click when k > 0; `dots` = `[]` during a count-in or in settings, else `beatDots(beats, beat)`; `sub` = playing loop's clicks per beat, Loop 1 before the first beat); display model of data-model.md §7 (`COUNT IN –/k`, `BEAT –/N · SUB n1`, `COUNT IN click/total`, `BEAT beat/N · SUB s`); `setRatio` ignores non-booleans and keeps `loop2`; `setLoop2` ignores invalid input; setters are no-ops outside the settings phase; `reset()` clears `position` and leaves settings unchanged; `screenChanged()` restores defaults.
- [X] T012 Edit `src/lib/state/metronome.svelte.ts` per contracts/metronome-store-api.md §2 and data-model.md §6: replace `stage`/`countInClick`/`countInTotal` with `position: SlotPosition | null` and `initialTotal`; add `setRatio`, `setLoop2` and the `sub` getter; build the segment from `runPlanFor(settings)` with `startSlot: 0` on Start; `onBeat`/`onCountIn` set `position = at`; Pause stores `halt()` when not `none`; Resume uses `startSlot = (position?.slot ?? −1) + 1`; `reset()` and `screenChanged()` as in T011. Keep the 033 announcement behaviour for now (stories add the new keys). Run `pnpm vitest run tests/unit/metronome/store.test.ts tests/unit/metronome/view.test.ts`. (depends on T008, T010, T011)
- [X] T013 Update the remaining 033-era unit tests that touch the changed store/engine surface so they still pass unchanged in meaning: `tests/unit/metronome/panel.test.ts` and `tests/unit/metronome/count-in-settings.test.ts` (use `ratio: false` where a test runs past beat N). Run `pnpm vitest run tests/unit/metronome tests/unit/audio`. (depends on T012)

**Checkpoint**: Engine and store speak cycles; all unit tests green; the UI still shows no new controls. Verify with `pnpm vitest run tests/unit/audio tests/unit/metronome`.

---

## Phase 3: User Story 1 - Alternate between two subdivisions with a count-in at each switch (Priority: P1) 🎯 MVP

**Goal**: With the section on (default), a run plays Initial Count In → Loop 1 → Repeat Count In → Loop 2 → Repeat Count In → Loop 1 … at constant BPM, with `SUB` and `COUNT IN n/r` in step with the audio.

**Independent Test**: 85 BPM, 4 beats, Count In 4/2, Loop 1 8th Triplets, Loop 2 Sextuplets: the log shows `initial×4, loop1×12, repeat×2, loop2×24, repeat×2, loop1…` and the status reads `COUNT IN n/4`, `BEAT n/4 · SUB 3`, `COUNT IN n/2`, `BEAT n/4 · SUB 6`.

### Tests for User Story 1 ⚠️ (write first, see them fail)

- [X] T014 [US1] Create `e2e/metronome-ratios.spec.ts` (reads the test-build `__fmAudioLog` `click` entries: `phase`, `slot`, `beat`, `countIn`, `kind`, `when`) with the US1 cases from quickstart §2: 2.1 (US1-1/SC-001, 2 full cycles — the 100-cycle check is the T004 property test — status text sampled per slot), 2.2 (US1-4/SC-002: gap between the last click of a phase and the first of the next = 60/BPM ± 2 ms at 30, 85 and 300 BPM, each with Beats 1 and Count In off / 1 so one cycle is 4 slots, ≤ 8 s at 30 BPM). Long real-time cases call `test.setTimeout(60_000)`, since no Playwright config sets a timeout and the 30 s default is too short, 2.3 (US1-3: during a repeat count-in exactly one dot `.dots.count-in` and `COUNT IN n/2`). Also a case for US1-5 (Loop 1 = Loop 2 still alternates with the repeat count-in) and US1-2 (`SUB` changes on beat 1 of the next loop). Because Loop 2 is not yet settable in the UI, drive Loop 2 through its default (Sextuplets) and Loop 1 default (8th Triplets); the settings-UI cases come in US2.
- [X] T015 [P] [US1] Extend `tests/unit/metronome/panel.test.ts` (jsdom) with failing cases: the running view passes `metronome.sub` (not `settings.subdivision`) to `StatusBox`; a repeat count-in shows the single pulsing dot and `COUNT IN n/r`; at a loop start the full dot row returns with beat 1 lit and later dots upcoming.

### Implementation for User Story 1

- [X] T016 [US1] Edit `src/lib/tools/metronome/MetronomePanel.svelte`: pass `sub={metronome.sub}` and `countIn={metronome.countIn}` to `StatusBox` (markup of `StatusBox.svelte` unchanged; contracts/metronome-ui.md §2). Confirm the status `nowrap` parts fit `COUNT IN 8/8` and `BEAT 16/16 · SUB 8` at 320 CSS px (R5). (depends on T012, T015)
- [X] T017 [US1] Add the "Started … then …" announcements to `src/lib/state/metronome.svelte.ts` with the ratio-on keys: Start with the section on announces `metronome_announce_started_ratio` (k = 0) or `metronome_announce_started_ratio_count_in` (k > 0, `count` = k), naming Loop 1 and Loop 2 with `subdivisionLabel`; section off keeps the 033 keys (data-model.md §8, FR-013). Add the matching cases to `tests/unit/metronome/store.test.ts` first. Loop switches and clicks are never announced. (depends on T001, T012)
- [X] T018 [US1] Run `pnpm build:test`, then `pnpm test:e2e:fast e2e/metronome-ratios.spec.ts` and fix until the US1 cases pass. (depends on T014, T016, T017)

**Checkpoint**: US1 works with default settings. Verify with `pnpm vitest run tests/unit/metronome/panel.test.ts tests/unit/metronome/store.test.ts` and `pnpm test:e2e:fast e2e/metronome-ratios.spec.ts`.

---

## Phase 4: User Story 2 - Choose the two loops and turn alternation on or off (Priority: P1)

**Goal**: The settings view gets the SUBDIVISION RATIO `h3` (small caps) with an on/off switch, Loop 1, and a Loop 2 dropdown (hidden when off).

**Independent Test**: Open the tool: header, switch on, Loop 1 = 8th Triplets, Loop 2 = Sextuplets. Change Loop 2 through all options; switch off, start, and only Loop 1 repeats.

### Tests for User Story 2 ⚠️

- [X] T019 [P] [US2] Create `tests/unit/metronome/ratio-settings.test.ts` (`// @vitest-environment jsdom`, @testing-library/svelte), failing first: `getByRole('heading', { level: 3, name: 'Subdivision ratio' })` exists; `getByRole('switch', { name: 'Subdivision ratio' })` with `aria-checked` mirroring `settings.ratio`, toggled by click, Enter and Space; `getByRole('combobox', { name: 'Loop 2' })` lists the same eight options as Loop 1 in the same order and defaults to "Sextuplets (6)"; switch off removes Loop 2 from the DOM and keeps Loop 1; switching on again shows the kept Loop 2 value; nothing renders outside the settings phase (U1–U6).
- [X] T020 [US2] Add the US2 cases to `e2e/metronome-ratios.spec.ts` (quickstart 2.4, 2.5, 2.8): defaults visible; Loop 2 options equal Loop 1 options; switch off removes Loop 2 and the keyboard toggles the switch without starting training (Space); controls absent while running and paused (US2-6); section off → only `initial` and `loop1` phases in the log and `SUB 3` throughout (US2-3/SC-003); Reset leaves settings unchanged and Start begins with `initial` click 1 (US4-4 shares this setup).

### Implementation for User Story 2

- [X] T021 [P] [US2] Edit `src/lib/tools/metronome/SubdivisionSelect.svelte`: add `id` and `label` props (the existing options, chevron and forced-colours rule are unchanged); the Loop 1 caller passes `id="metronome-subdivision"` and the existing `metronome_subdivision_label`.
- [X] T022 [US2] Create `src/lib/tools/metronome/RatioSettings.svelte` per contracts/metronome-ui.md §1: a `div.ratio` with a header row (flex, wraps at narrow widths, switch on the inline end) holding `<h3 id="metronome-ratio-heading">` (text `metronome_ratio_heading`, `font-variant-caps: all-small-caps`, `--font-size-md`, `--font-weight-bold`) and the `button.switch[role="switch"]` using the global `.switch` family from `controls.css`, `aria-checked` bound to `settings.ratio`, `aria-labelledby="metronome-ratio-heading"`, visible On/Off word (`metronome_switch_on/off`); then the Loop 1 `SubdivisionSelect`; then Loop 2 (`id="metronome-loop2"`, label `metronome_loop2_label`) only when the section is on. Tokens only, no new token; no hard-coded colours (style lint, ADR 0028). Selects full width at narrow widths. (depends on T001, T012, T021)
- [X] T023 [US2] Edit `src/lib/tools/metronome/MetronomePanel.svelte`: mount `RatioSettings` after the Count In rows and before Start Training, replacing the lone Loop 1 select; render it only in the settings phase. Run `pnpm vitest run tests/unit/metronome/ratio-settings.test.ts tests/unit/metronome/panel.test.ts`. (depends on T019, T022)
- [X] T024 [US2] Run `pnpm build:test` and `pnpm test:e2e:fast e2e/metronome-ratios.spec.ts`; fix until the US2 cases pass. (depends on T020, T023)

**Checkpoint**: Loops and the section switch are fully configurable. Verify with the Vitest and `test:e2e:fast` commands above.

---

## Phase 5: User Story 3 - Count-in settings at each switch (Priority: P2)

**Goal**: The repeat count-in plays only when Count In is on, Repeat Count In > 0 and the section is on; otherwise loops switch back to back.

**Independent Test**: Repeat 0 and Count In off → Loop 1 flows straight into Loop 2; Repeat 6 → six accented clicks at each switch.

- [X] T025 [US3] Add the US3 cases to `e2e/metronome-ratios.spec.ts` (quickstart 2.6): Count In off → no `initial` or `repeat` clicks and loop1 → loop2 exactly one beat apart (US3-1); Count In on with Repeat 0 → the initial count-in plays, no `repeat` phase (US3-2); Repeat 6 → six accented `repeat` clicks one beat apart with status `COUNT IN n/6` (US3-3); section off with Count In on → no repeat count-in (US3-4).
- [X] T026 [P] [US3] Add the edge-case cases to `e2e/metronome-ratios.spec.ts` (quickstart 2.9, plus spec Edge Cases): # of Beats 1 (loops alternate every beat), 16 beats with Repeat 8 (status `COUNT IN n/8` and `BEAT n/16 · SUB n` fit at every width), rapid Start/Pause/Resume/Space produce no overlapping click streams and no doubled count-in.
- [X] T027 [US3] Run `pnpm test:e2e:fast e2e/metronome-ratios.spec.ts`; if a case fails, fix the cause in `src/lib/state/metronome-settings.ts` or `src/lib/audio/metronome-cycle.ts` (the unit tests of Phase 2 already cover the table, so failures here point to wiring). (depends on T025, T026)

**Checkpoint**: Repeat count-in rules hold in the real build.

---

## Phase 6: User Story 4 - Pause and resume at the exact position (Priority: P2)

**Goal**: Pause freezes display and status on the last click that sounded; Resume continues with the exact next click, including inside a repeat count-in.

**Independent Test**: Pause on `BEAT 3/4 · SUB 6` → Resume → next click is beat 4 of Loop 2. Pause on `COUNT IN 1/2` → Resume → next click is count-in click 2, then the next loop one beat later.

### Tests for User Story 4 ⚠️

- [X] T028 [US4] Add the failing store cases to `tests/unit/metronome/store.test.ts` (quickstart 1.8): pause on beat 3 of Loop 2 → resume `startSlot` is the next beat; pause on repeat click 1 of 2 → resume on click 2 and not restarted; pause on the last loop beat → resume on repeat click 1 (or beat 1 of the next loop when r = 0); pause on the last repeat click → resume on beat 1 of the next loop; pause before click 1 → resume at slot 0; Reset → next Start at slot 0; announcements: section on, Pause in a loop → `metronome_announce_paused_loop` naming the playing loop (`{beat}`, `{beats}`, `{subdivision}`); Pause in a repeat count-in → `metronome_announce_paused_count_in` with `count` = r; Pause before click 1 → `metronome_announce_paused_count_in_none`; section off → 033 keys unchanged.
- [X] T029 [US4] Add the US4 cases to `e2e/metronome-ratios.spec.ts` (quickstart 2.7): pause on `BEAT 3/4 · SUB 6` → no clicks after the Pause instant and status frozen; resume → next click is `loop2` beat 4; pause on `COUNT IN 1/2` → resume plays repeat click 2 then the next loop starts one beat later (US4-1/2/3, SC-004).

### Implementation for User Story 4

- [X] T030 [US4] In `src/lib/state/metronome.svelte.ts`, announce Pause with `metronome_announce_paused_loop` when the section is on and the frozen position is a beat (name the playing loop with `subdivisionLabel`); keep `metronome_announce_paused_count_in` / `_none` for count-in positions (using the frozen position's `total`). Resume math is already in T012; fix any case T028 shows failing. Run `pnpm vitest run tests/unit/metronome/store.test.ts`. (depends on T001, T012, T028)
- [X] T031 [US4] Run `pnpm test:e2e:fast e2e/metronome-ratios.spec.ts`; fix until the US4 cases pass. (depends on T029, T030)

**Checkpoint**: All four stories pass in unit and e2e.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T032 [P] Apply `ratioOff(page)` (T002) in the existing specs whose assertions span more than one loop, per R-11: `e2e/metronome.spec.ts`, `e2e/metronome-subdivisions.spec.ts`, `e2e/metronome-count-in.spec.ts`; in `e2e/metronome-count-in.spec.ts` change the 033 `loop.slot === 0` assertion to `slot === k`. Run `pnpm test:e2e:fast e2e/metronome.spec.ts e2e/metronome-subdivisions.spec.ts e2e/metronome-count-in.spec.ts` (after `pnpm build:test`).
- [X] T033 [P] Extend `e2e/metronome-a11y.spec.ts` (quickstart 2.11): axe zero violations on the settings view with the section on and off, on a running loop, and on a running repeat count-in.
- [X] T034 [P] Add the responsive/i18n case to `e2e/metronome-ratios.spec.ts` (quickstart 2.10): 320 CSS px zoom, 200 % text, en/pt-BR/es and the themes (incl. high contrast): no horizontal scroll, no truncation (`expectNoTruncationOrOverlap`), header, switch and both selects visible, `COUNT IN 8/8` and `BEAT 16/16 · SUB 8` fit.
- [X] T035 [P] Add a "Revision (034 alternating ratios)" section to `docs/adr/0030-metronome-click-scheduler.md`: cyclic slot grid, `startSlot`, run-global log `slot`, events carrying `SlotPosition` (R-12). No new ADR.
- [X] T036 Update the "metronome views" screenshot test in `e2e/metronome.spec.ts` for the settings view (header and Loop 2) and generate a local desktop baseline only for inspection: `pnpm playwright test e2e/metronome.spec.ts -g "metronome views" --project=desktop --update-snapshots`. Do not commit Linux baselines; they come from `.github/workflows/update-snapshots.yml` (list this in the PR description).
- [X] T037 Run the quickstart §1 and §2 commands once end to end and tick off every scenario row (1.1–1.9, 2.1–2.11).
- [X] T038 Run all local gates once: `pnpm verify` (check, lint, format, full Vitest with coverage, build, bundle-size ≤ 160 KB gzip with expected growth < 2 KB, desktop Playwright; screenshots and perf are skipped locally). Do not run `pnpm test:e2e` or `pnpm lhci`.
- [X] T039 Record under a "Manual checks" note at the bottom of this file, tick the task, and list in the PR description: (a) by ear at 85 BPM, 8th Triplets ↔ Sextuplets with a 2-click count-in sounds even with no hiccup at the switch; (b) real-browser check of the switch and Loop 2 select in Firefox and Safari on macOS (forced colours on Windows if available).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies; T001–T003 are independent of each other.
- **Foundational (Phase 2)**: T004 → T005 → T006 → T007/T008 (T008 after T005–T007); T009 → T010; T011 → T012 (after T008, T010); T013 last. Blocks all stories.
- **US1 (Phase 3)**: after Phase 2 and T001. **US2 (Phase 4)**: after Phase 2 and T001; independent of US1 except that both edit `MetronomePanel.svelte` (T016, T023), so do them in order. **US3 (Phase 5)** and **US4 (Phase 6)**: after Phase 2 and US1 (they extend `e2e/metronome-ratios.spec.ts`); US3 e2e that sets non-default loops or Repeat values uses the US2 controls, so run US2 first.
- **Polish (Phase 7)**: after the stories you intend to ship. T038 is last but one, T039 last.

### Within Each Story

Tests written and failing first → state/logic → components → e2e run.

### Parallel Opportunities

- Setup: T001, T002, T003 together.
- Foundational: T009 and T011 (different test files) can be written in parallel with T004; T007 in parallel with T009.
- US1: T015 in parallel with T014 (different files).
- US2: T019 and T021 in parallel.
- US3: T026 in parallel with T025 only if the spec file is split; otherwise sequential (same file).
- Polish: T032, T033, T034, T035 together (different files).

## Parallel Example: Foundational

```bash
Task: "Write failing cycle tests in tests/unit/audio/metronome-cycle.test.ts"      # T004
Task: "Extend failing settings tests in tests/unit/metronome/settings.test.ts"     # T009
Task: "Extend failing view/store tests in tests/unit/metronome/{view,store}.test.ts" # T011
```

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup, Phase 2 Foundational (the engine, settings and store carry the whole alternation).
2. Phase 3 US1: with the defaults (section on, 8th Triplets then Sextuplets) the alternating run already plays and displays correctly.
3. **Stop and validate** with `pnpm test:e2e:fast e2e/metronome-ratios.spec.ts`. Note US1 alone ships no UI to turn the section off or change Loop 2, so ship US1 and US2 together as the user-visible MVP.

### Incremental Delivery

1. Setup + Foundational → engine ready.
2. US1 → alternation plays. 3. US2 → controls. 4. US3 → count-in rules verified. 5. US4 → pause/resume verified. 6. Polish → existing specs adjusted, a11y, ADR, `pnpm verify`.

## Notes

- [P] = different files, no dependency on incomplete tasks. Several tasks append to `e2e/metronome-ratios.spec.ts` (T014, T020, T025, T026, T029, T034) and are therefore sequential.
- Keep `src/lib/audio` framework-free; only `metronome.svelte.ts` creates the scheduler.
- No new colour token or dependency. Initial JS stays ≤ 160 KB gzip.
- Commit after each task or logical group.

## Manual checks

_To be filled in by T039._

## Manual checks

Not automatable; do these before merge and list them in the PR description:

- By ear at 85 BPM: 8th Triplets ↔ Sextuplets with a 2-click count-in sounds even, with no hiccup at the switch.
- Real-browser check of the switch and Loop 2 select in Firefox and Safari on macOS (forced colours on Windows if available).

## Local gate notes (T038)

- In this sandbox `pnpm check` and `pnpm lint` cannot run (TypeScript `lib.*.d.ts` files and an ESLint plugin dependency are missing from `node_modules`); CI runs them. Format, full Vitest with coverage (after fixing the pt-BR `metronome_loop2_label` allowlist entry and Prettier on `StatusBox.svelte`), build, bundle size (154.6 KB ≤ 160 KB) and the desktop Playwright suite with `--ignore-snapshots` passed (`print.spec.ts` failed once under load and passed on rerun).
- PR description: the "metronome views" Linux baselines (`e2e/metronome.spec.ts-snapshots/metronome-settings-*`) are stale and must be regenerated by `.github/workflows/update-snapshots.yml`.
