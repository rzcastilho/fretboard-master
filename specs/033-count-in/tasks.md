---

description: "Task list for Count In (033)"
---

# Tasks: Count In

**Input**: Design documents from `/specs/033-count-in/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (click-engine-api.md, metronome-store-api.md, metronome-ui.md), quickstart.md

**Tests**: Requested. The constitution (Principle IV) requires logic test-first and every acceptance scenario as an automated test. Write each test task before its implementation task and see it fail.

**Organization**: Grouped by user story. US1 and US2 are both P1: US1 delivers the audible/visible count-in, US2 delivers the switch and rows. US2 depends only on the foundational settings; US1 depends on the engine.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US4, mapped to spec.md
- Verification per CLAUDE.md: per task `pnpm vitest run <touched test paths>`; e2e `pnpm build:test` once, then `pnpm test:e2e:fast <spec files>`; end of slice `pnpm verify` once. Do NOT run `pnpm test:e2e` or `pnpm lhci` locally.
- Test files that render components or touch `document`/`window` start with `// @vitest-environment jsdom`.

## Path Conventions

Single SvelteKit project: `src/lib/audio/`, `src/lib/state/`, `src/lib/tools/metronome/`, `src/lib/styles/`, `messages/`, `docs/`, `tests/unit/`, `e2e/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Tokens, messages and docs that every story reads.

- [X] T001 [P] Add the token `--metronome-pulse-scale: 1.25;` next to the other metronome tokens in `src/lib/styles/tokens.css` (research R-09; style lint allows only tokens)
- [X] T002 [P] Add the 14 new keys to `messages/en.json`, `messages/pt-BR.json` and `messages/es.json` with the exact en / pt-BR / es values from `research.md` R-10: `metronome_count_in_label`, `metronome_switch_on`, `metronome_switch_off`, `metronome_initial_count_in_label`, `metronome_repeat_count_in_label`, `metronome_initial_count_in_decrease`, `metronome_initial_count_in_increase`, `metronome_repeat_count_in_decrease`, `metronome_repeat_count_in_increase`, `metronome_status_count_in` (`{click}`/`{count}`), `metronome_status_count_in_none` (`{count}`), `metronome_announce_started_count_in` (`{bpm}`,`{beats}`,`{subdivision}`,`{count}`), `metronome_announce_paused_count_in` (`{click}`,`{count}`), `metronome_announce_paused_count_in_none`. Do not change `tests/unit/i18n/identical-allowlist.ts` (no value equals English). Verify with `pnpm vitest run tests/unit/i18n`
- [X] T003 [P] Add draft glossary rows for Count In, Initial Count In and Repeat Count In (en / pt-BR / es) in `docs/i18n/glossary.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Engine prefix grid, log entry type, settings model. No story can start before this.

**⚠️ CRITICAL**: Complete before any user story.

### Tests first

- [X] T004 [P] Extend `tests/unit/audio/metronome.test.ts` (use existing `FakeAudioPort` / `FakeClock` / `FakeFrames`) with failing cases for `contracts/click-engine-api.md` E1–E9: (E1) no `countIn` or `total = from` reproduces the 032 schedule exactly; (E2) fast-check property over BPM 30–300 × r 0–8 × n 1–8: count-in click *i* at `anchor + i·T`, loop click *j* at `anchor + r·T + j·T/n`, every `|when − ideal| < 2 ms`, and `when(first loop) − when(last count-in) = T ± 2 ms`; (E3) count-in clicks are `accent`, no `sub`/`normal` before the first loop click, each its own source; (E4) first click at `anchor`, within START_LEAD_S + one tick; (E5) `onCountIn(from+c+1)` once per count-in click then `onBeat`, never both for one slot, never `onCountIn` after `onBeat`; (E6) `halt()` mid-count-in stops pending sources and returns `{kind:'count-in', click}`, after a loop beat `{kind:'beat', beat}`, before any audible click `{kind:'none'}`; (E7) skip-forward after a pump gap, including past the whole count-in, never replays count-in and reports `onBeat` when the next slot is a loop click; (E8) second `start()` while live ignored; (E9) `sink === null` drives the same events; `{from:2,total:4}` plays clicks 3, 4 then the loop; invalid `countIn` (non-integer, from > total, total > 8) falls back to none; log entries carry `countIn` and negative `slot`
- [X] T005 [P] Extend `tests/unit/metronome/settings.test.ts` with failing cases: defaults `countIn true`, `initialCountIn 4`, `repeatCountIn 2`; `clampCount(-1,4)=0`, `clampCount(9,4)=8`, `clampCount(2.6,4)=3`, `clampCount(NaN,4)=4`, `clampCount(NaN,2)=2`; `effectiveCountIn` for on/off × 0/4/8; `atLimit` at 0 (−) and 8 (+) and `stepSetting` for `initialCountIn` / `repeatCountIn`

### Implementation

- [X] T006 Edit `src/lib/audio/types.ts`: add `countIn: number | null` to the `click` `AudioLogEntry` (`slot` may be negative; `beat` is 0 for count-in clicks) per `contracts/click-engine-api.md` §3
- [X] T007 Edit `src/lib/audio/metronome.ts` per `contracts/click-engine-api.md` §1–2 and `data-model.md` §3 (depends on T006; makes T004 pass): add `CountInSpan` and optional `SegmentStart.countIn`; validate (`total` integer 0–8, `from` integer 0…`total`, else `countInRemaining = 0`); add `onCountIn(click)` to `SchedulerEvents`; export `HaltedAt` union and make `halt()` return it; extend `GridClick` with `countIn` and `clickAt`/`skipTo` with `countInRemaining` / `countInFrom` on the single combined integer grid (count-in slots −r…−1, `kind: 'accent'`, `beat: 0`); frame loop reports `onCountIn` for negative slots and `onBeat` otherwise; keep the framework-free rule (no Svelte, `$app/*`, i18n, state imports). Run `pnpm vitest run tests/unit/audio/metronome.test.ts`
- [X] T008 Edit `src/lib/state/metronome-settings.ts` (makes T005 pass): add `countIn`, `initialCountIn`, `repeatCountIn` to `MetronomeSettings` and `DEFAULT_SETTINGS`; export `MIN_COUNT_IN = 0`, `MAX_COUNT_IN = 8`, `DEFAULT_INITIAL_COUNT_IN = 4`, `DEFAULT_REPEAT_COUNT_IN = 2`, `clampCount(v, fallback)` ("0–8, rounded; NaN → fallback") and `effectiveCountIn(s)`; widen `SettingField` to `'bpm' | 'beats' | 'initialCountIn' | 'repeatCountIn'` and make `atLimit` / `stepSetting` cover them. Run `pnpm vitest run tests/unit/metronome/settings.test.ts`
- [X] T009 Fix the compile/behaviour fallout of the new `halt()` return type and defaults in existing unit tests and callers: update `src/lib/state/metronome.svelte.ts` minimally so `pause()` consumes `HaltedAt` (`beat` → `beat`, others unchanged) and `start()` still uses the 032 path until US1; update `tests/unit/metronome/store.test.ts` and `tests/unit/metronome/panel.test.ts` helpers to set `countIn` off where they test loop behaviour (research R-11). Run `pnpm vitest run tests/unit/metronome tests/unit/audio`

**Checkpoint**: Engine and settings are complete; the 032 behaviour is unchanged with Count In off.

---

## Phase 3: User Story 1 - Hear a count-in before the first loop (Priority: P1) 🎯 MVP

**Goal**: With the defaults, Start plays 4 accented clicks, a single pulsing dot and `COUNT IN n/4`, then `BEAT 1/4 · SUB 3` one beat after the last click.

**Independent Test**: At 85 BPM, 4 beats, 8th Triplets, defaults: Start; check four accented clicks 60/85 s apart, `COUNT IN 1/4`…`4/4`, one dot, then the dot row and beat 1 exactly one beat later. With Initial Count In 0 the run starts on beat 1.

### Tests for User Story 1 ⚠️ (write first, see them fail)

- [X] T010 [P] [US1] Extend `tests/unit/metronome/view.test.ts`: `statusParams` returns `{kind:'count-in',click,total}` and `{kind:'count-in-none',total}` for a `CountInView`; null/absent count-in equals 032 output; `countInDot(0) = 'upcoming'`, `countInDot(n≥1) = 'lit'`
- [X] T011 [P] [US1] Extend `tests/unit/metronome/store.test.ts` (S3–S6, S10): Start with k = 4 → segment `countIn {from:0,total:4}`, `stage 'count-in'`, `dots = []`, `metronome.countIn = {click:0,total:4}`; `onCountIn(n)` → `running`, `countInClick = n`; `onBeat(b)` → `stage 'loop'`, dots return, `countIn` null; k = 0 (switch off or Initial 0) → no `countIn` in the segment, 032 start announcement; k > 0 → `metronome_announce_started_count_in` text "Started, 85 BPM, 4 beats, 8th Triplets, count in 4"; stale generations ignored; `repeatCountIn` never reaches the segment
- [X] T012 [P] [US1] Extend `tests/unit/metronome/panel.test.ts` (jsdom): running view shows `COUNT IN –/4` then `COUNT IN 1/4`, exactly one `.dot` with `data-state` `upcoming` → `lit` and `aria-hidden`; after the first `onBeat` shows `BEAT 1/4 · SUB 3` and four dots; the count-in `.position` has no `· SUB`
- [X] T013 [P] [US1] Create `e2e/metronome-count-in.spec.ts` with scenarios 2.1 (defaults, four accent entries `countIn` 1…4 spaced 60/85 s ± 2 ms, first within 50 ms of press, next entry `countIn: null` / `slot 0` at last + 60/85 ± 2 ms, status sequence), 2.2 (single dot then 4 dots), 2.3 (`emulateMedia({reducedMotion:'reduce'})`: dot `animation-name` is `none`, `data-state` `lit`), 2.4 (Initial 0: first click `countIn: null` within 50 ms, never `COUNT IN`) and 2.15 (BPM 300 × Initial 8: eight clicks 200 ms ± 2 ms apart) from `quickstart.md` §2, reading `__fmAudioLog`. Scenario 2.4 sets Initial Count In to 0 through the slider (available after US2, T023–T024); until then run 2.1–2.3 and 2.15

### Implementation for User Story 1

- [X] T014 [US1] Edit `src/lib/state/metronome-view.ts` (makes T010 pass): add the `count-in` and `count-in-none` `StatusParams` variants, `CountInView`, the optional fourth `countIn` parameter of `statusParams`, and `countInDot(click)`
- [X] T015 [US1] Edit `src/lib/state/metronome.svelte.ts` (depends on T007, T008, T014; makes T011 pass): add internal `stage`, `countInClick`, `countInTotal`; `start()` fixes `k = effectiveCountIn(settings)` and passes `countIn: {from:0,total:k}` only when k > 0; handle `onCountIn` and `onBeat` per data-model §2; expose `metronome.countIn` (non-null only in the count-in stage of a run) and make `metronome.dots` return `[]` during the count-in; use `m.metronome_announce_started_count_in` when k > 0, otherwise the unchanged 032 announcement; `reset()` / `screenChanged()` / `resetMetronomeForTests()` clear the new run fields and restore defaults
- [X] T016 [US1] Edit `src/lib/tools/metronome/StatusBox.svelte` (depends on T001, T014, T015; makes T012 pass): render `COUNT IN n/k` / `COUNT IN –/k` via `metronome_status_count_in` / `metronome_status_count_in_none` with `.part { white-space: nowrap }` and no `· SUB` part; render one `<li class="dot pulse">` inside `<ol class="dots count-in" aria-hidden="true">`, remounted per click with `{#key click}`, `data-state` from `countInDot`; add `@keyframes` scale 1 → `var(--metronome-pulse-scale)` → 1 with `animation-duration: var(--duration-base)` and `animation-timing-function: var(--ease-standard)`; `@media (prefers-reduced-motion: reduce) { .dot.pulse { animation: none } }`; forced-colours lit rules as for the beat dots; tokens only
- [X] T017 [US1] Edit `src/lib/tools/metronome/MetronomePanel.svelte`: pass `metronome.countIn` to `StatusBox`. Run `pnpm vitest run tests/unit/metronome/view.test.ts tests/unit/metronome/store.test.ts tests/unit/metronome/panel.test.ts`
- [X] T018 [US1] Run `pnpm build:test` then `pnpm test:e2e:fast e2e/metronome-count-in.spec.ts -g "2.1|2.2|2.3|2.15"` and fix failures in the files from T014–T017 (scenario 2.4 is verified in T025 after US2)

**Checkpoint**: US1 works with the default 4 clicks. Scenario 2.4 needs the Initial slider from US2 (T023–T024).

---

## Phase 4: User Story 2 - Turn the count-in on or off and set its length (Priority: P1)

**Goal**: Count In switch (on by default) with Initial (0–8, 4) and Repeat (0–8, 2) rows, shown only when on.

**Independent Test**: Open the tool: switch on, rows 4 and 2. Change values within 0–8; switch off removes the rows; Start goes straight to `BEAT 1/4`; switch on again restores the kept values.

### Tests for User Story 2 ⚠️ (write first)

- [X] T019 [P] [US2] Create `tests/unit/metronome/count-in-settings.test.ts` (`// @vitest-environment jsdom`, @testing-library/svelte): `getByRole('switch', {name:'Count In'})` has `aria-checked="true"`; rows `getByRole('slider', {name:'Initial Count In'})` = 4 and `'Repeat Count In'` = 2 with `aria-valuetext`; − named "Fewer initial count-in clicks" etc.; − disabled at 0, + disabled at 8; off removes both rows from the DOM and on restores the kept values; the visible On/Off word is `aria-hidden` so the name stays "Count In"; component not rendered in `starting`/`running`/`paused` (panel level)
- [X] T020 [P] [US2] Extend `tests/unit/metronome/store.test.ts` (S1, S2): `setCountIn`, `setInitialCountIn`, `stepInitialCountIn`, `setRepeatCountIn`, `stepRepeatCountIn` act only in the `settings` phase; numeric setters clamp with `clampCount`; `setCountIn` ignores non-booleans; `setCountIn(false)` keeps both counts. Extend `tests/unit/metronome/keys.test.ts`: Space with `targetActivates` (switch) returns `null`
- [X] T021 [P] [US2] Extend `e2e/metronome-count-in.spec.ts` with scenarios 2.5 (switch off: slider count 0, Tab skips rows, Start has no `countIn` entries and shows `BEAT 1/4`), 2.6 (keyboard only: arrows, Home/End, −/+, limits, Space on switch toggles and never starts) and 2.7 (off then on keeps values); add `countInOff(page)` to `e2e/support/helpers.ts` (click the `Count In` switch if `aria-checked="true"`)

### Implementation for User Story 2

- [X] T022 [US2] Edit `src/lib/state/metronome.svelte.ts` (depends on T015; makes T020 pass): add the six setters per `contracts/metronome-store-api.md` §3 (settings phase only, clamp via `clampCount`, boolean-only `setCountIn`)
- [X] T023 [US2] Create `src/lib/tools/metronome/CountInSettings.svelte` (depends on T001, T002, T022; makes T019 pass) per `contracts/metronome-ui.md` §1: `<button type="button" class="switch" role="switch" aria-checked>` using the global `.switch` family with `.switch-track`/`.switch-thumb` (aria-hidden), label from `metronome_count_in_label` and a visible `aria-hidden` On/Off word (`metronome_switch_on`/`metronome_switch_off`); when on, two reused `ValueRow`s (`id="metronome-initial-count-in"` and `"metronome-repeat-count-in"`, min 0, max 8, step 1, labels and −/+ names from the new keys); rows removed from the DOM when off; props `settings` plus callbacks; `min-block-size`/`min-inline-size: var(--target-min)`; label and state word may wrap at 320 px; tokens only
- [X] T024 [US2] Edit `src/lib/tools/metronome/MetronomePanel.svelte`: mount `CountInSettings` between the # of Beats row and the Loop 1 select, only in the `settings` phase, wired to the store setters. Run `pnpm vitest run tests/unit/metronome`
- [X] T025 [US2] Update existing e2e specs to the new default (research R-11): in `e2e/metronome.spec.ts` and `e2e/metronome-subdivisions.spec.ts` call `countInOff(page)` before Start wherever a test asserts the loop's first click, `BEAT –/4`, or the 032 start announcement. Run `pnpm build:test` then `pnpm test:e2e:fast e2e/metronome-count-in.spec.ts e2e/metronome.spec.ts e2e/metronome-subdivisions.spec.ts`
- [X] T026 [US2] Re-record the changed desktop baseline for the "metronome views" test only (new settings rows): `pnpm playwright test e2e/metronome.spec.ts -g "metronome views" --project=desktop --update-snapshots`; Linux baselines come from `.github/workflows/update-snapshots.yml` in CI

**Checkpoint**: US1 and US2 work together; the MVP (T001–T026) is shippable.

---

## Phase 5: User Story 3 - Pause and resume during a count-in (Priority: P2)

**Goal**: Pause freezes on the last count-in click; Resume continues from the next click; Resume after the loop started never plays a count-in; Reset keeps the settings.

**Independent Test**: Initial 4, Pause after `COUNT IN 2/4` (frozen), Resume plays clicks 3 and 4 then the loop one beat later.

### Tests for User Story 3 ⚠️ (write first)

- [X] T027 [P] [US3] Extend `tests/unit/metronome/store.test.ts` (S7, S8, S9, S11): `halt('pause')` returning `count-in` sets `countInClick`; `beat` sets `beat` and `stage 'loop'`; `none` leaves state (`COUNT IN –/k`); pause announcements `metronome_announce_paused_count_in` ("Paused on count-in click 2 of 4") and `..._count_in_none` ("Paused before the count-in"); loop-stage pause announcement unchanged; Resume in the count-in stage passes `countIn {from: countInClick, total: k}`, `startBeat 1`; Resume in the loop stage passes no `countIn` and `startBeat = beat % beats + 1`; `onSuspended` during a count-in freezes like Pause; `reset()` keeps all settings and clears run fields; `screenChanged()` restores `DEFAULT_SETTINGS`
- [X] T028 [P] [US3] Extend `e2e/metronome-count-in.spec.ts` with scenarios 2.8 (Pause after `COUNT IN 2/4`: no click after the pause instant, status frozen; Resume: next entries `countIn` 3 and 4, first within 50 ms of the press, loop one beat later, no `countIn` 1 or 2 in the new segment), 2.9 (pause in loop then Resume: no `countIn` entries) and 2.10 (Reset mid-count-in keeps switch and values, next Start plays a full count-in, leaving and returning shows defaults)

### Implementation for User Story 3

- [X] T029 [US3] Edit `src/lib/state/metronome.svelte.ts` (makes T027 pass): implement the `HaltedAt` freeze in `pause()` and in the `onSuspended` path, the count-in pause announcements, and the stage-dependent `resume()` segment (`countIn: {from: countInClick, total: countInTotal}` only in the count-in stage). Run `pnpm vitest run tests/unit/metronome/store.test.ts tests/unit/audio/metronome.test.ts`
- [X] T030 [US3] Run `pnpm build:test` then `pnpm test:e2e:fast e2e/metronome-count-in.spec.ts` and fix any failure of scenarios 2.8–2.10 in `src/lib/state/metronome.svelte.ts` or `src/lib/audio/metronome.ts`

**Checkpoint**: Pause, Resume and Reset behave per FR-011 and FR-012.

---

## Phase 6: User Story 4 - Keep the Repeat Count In value ready (Priority: P3)

**Goal**: Repeat Count In is stored and unchanged across Start and Reset, with no effect on playback.

**Independent Test**: Set Repeat Count In 6, Start, Reset: still 6, no extra count-in clicks.

### Tests for User Story 4 ⚠️

- [X] T031 [P] [US4] Extend `tests/unit/metronome/store.test.ts` (S10): with `repeatCountIn = 6`, `start`, `resume` and the engine segment never include or depend on it; value unchanged after `reset()`
- [X] T032 [P] [US4] Extend `e2e/metronome-count-in.spec.ts` with scenario 2.11 (set Repeat to 6, Start, Reset → slider still 6; no `countIn` entries beyond the initial count-in during the run)

### Implementation for User Story 4

- [X] T033 [US4] Confirm `repeatCountIn` is read nowhere in `src/lib/state/metronome.svelte.ts` or `src/lib/audio/` (store-only, FR-013); fix if any read exists. Run `pnpm vitest run tests/unit/metronome/store.test.ts` and `pnpm test:e2e:fast e2e/metronome-count-in.spec.ts`

**Checkpoint**: All four stories pass independently.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T034 [P] Extend `e2e/metronome-a11y.spec.ts`: axe zero violations on the settings view with the switch on and off, and on the running view during a count-in, in light, dark, more contrast and forced colours; keep the existing cases working by using `countInOff(page)` where they need the loop
- [X] T035 [P] Extend `e2e/metronome-count-in.spec.ts` with scenario 2.12 (live-region texts: start "Started, 85 BPM, 4 beats, 8th Triplets, count in 4", pause "Paused on count-in click 2 of 4", no per-click announcements), 2.13 (pt-BR switch "Contagem", status `CONTAGEM 1/4`; es "Cuenta previa", `CUENTA 1/4`) and 2.14 (320 px and 200 % text zoom, every theme: no horizontal scroll; switch, rows and `COUNT IN 8/8` fully visible)
- [X] T036 [P] Add the "Revision (033 count-in)" section to `docs/adr/0030-metronome-click-scheduler.md`: count-in prefix on the integer grid, signed slots, `onCountIn`, `HaltedAt` (research R-12; no new ADR)
- [X] T037 Run `pnpm build:test` then `pnpm test:e2e:fast e2e/metronome-count-in.spec.ts e2e/metronome.spec.ts e2e/metronome-subdivisions.spec.ts e2e/metronome-a11y.spec.ts`; fix failures
- [X] T038 Walk through `quickstart.md` §1–2 and confirm every scenario row has a passing test
- [X] T039 Run all local gates once: `pnpm verify` (screenshots and `e2e/perf.spec.ts` are skipped outside CI; check bundle-size ≤ 160 KB gzip, expected growth < 2 KB)
- [X] T040 Manual checks (human; tick this task once recorded here and in the PR description): by ear at 85 BPM and 300 BPM, four (eight) accented count-in clicks, then the first loop's beat 1 lands exactly one beat later with no audible gap or flam; with the app muted, the count-in is silent but the dot and status still run, and volume changes apply to count-in clicks

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)**: none; T001–T003 run in parallel.
- **Foundational (2)**: T004, T005 first (parallel); T006 → T007; T008; T009 after T007 and T008. Blocks all stories.
- **US1 (3)**: after Phase 2. **US2 (4)**: after Phase 2 and T015 (shares `metronome.svelte.ts`). **US3 (5)**: after T015 and T022. **US4 (6)**: after T022.
- **Polish (7)**: after the desired stories.

### Within Stories

- Test tasks precede implementation and must fail first.
- `src/lib/state/metronome.svelte.ts` is edited by T009, T015, T022, T029: run those sequentially, never in parallel.
- `e2e/metronome-count-in.spec.ts` is edited by T013, T021, T028, T032, T035: sequential.
- `tests/unit/metronome/store.test.ts` is edited by T009, T011, T020, T027, T031: sequential.

### Parallel Opportunities

- Phase 1: T001, T002, T003.
- Phase 2: T004 and T005 (then T006/T008 in parallel with their tests written).
- US1 tests: T010, T011, T012, T013 touch different files.
- US2 tests: T019, T020, T021 (T020 and T021 touch files used elsewhere; keep sequential with their other story's edits).
- Polish: T034, T035, T036 (T035 after T032).

## Parallel Example: User Story 1

```bash
Task: "T010 statusParams / countInDot tests in tests/unit/metronome/view.test.ts"
Task: "T011 store count-in start tests in tests/unit/metronome/store.test.ts"
Task: "T012 panel count-in tests in tests/unit/metronome/panel.test.ts"
Task: "T013 e2e scenarios in e2e/metronome-count-in.spec.ts"
```

## Implementation Strategy

### MVP First

1. Phase 1 and Phase 2 (engine + settings).
2. US1 (audible and visible count-in) then US2 (switch and rows). Both are P1; together they are the MVP (T001–T026).
3. Validate with targeted Vitest and `test:e2e:fast`.

### Incremental Delivery

1. Add US3 (Pause/Resume) → validate.
2. Add US4 (stored Repeat value) → validate.
3. Polish, `pnpm verify` once, record the Manual checks.

## Notes

- Do not persist anything (FR-013); remembered settings are slice 008-ratios-training/005.
- `src/lib/audio` stays framework-free; only `metronome.svelte.ts` creates the scheduler.
- Colours, durations and sizes come from tokens only (style lint).
- Commit after each task or logical group using Conventional Commits.

## Manual checks

- T039: `pnpm verify` stopped at `lint`/`format:check` because this container's `node_modules` lacks `esrecurse` and prettier's yaml plugin (environment, not code). `check` (0 errors, 0 warnings), all unit tests, `pnpm build` and the bundle-size step (153.5 KB ≤ 160 KB) pass. Run lint and format:check in CI.
- T040 (human, by ear): at 85 BPM and 300 BPM, four (eight) accented count-in clicks, then the first loop's beat 1 lands exactly one beat later with no audible gap or flam. With the app muted, the count-in is silent but the dot and status still run, and volume changes apply to count-in clicks. List in the PR description.
