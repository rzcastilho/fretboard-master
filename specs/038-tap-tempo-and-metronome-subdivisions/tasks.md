---

description: "Task list for Tap Tempo and Metronome Subdivisions (038)"
---

# Tasks: Tap Tempo and Metronome Subdivisions

**Input**: Design documents from `/specs/038-tap-tempo-and-metronome-subdivisions/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (tap-tempo-api, click-engine-api, metronome-store-api, preferences-record, tap-subdivision-ui), quickstart.md

**Tests**: Included. The constitution (IV, Test-First) and plan.md require the tap module, scheduler retime, codec and store to be built test-first. Write each test task first and see it fail before the implementation task that follows it.

**Organization**: Grouped by user story. US1 = tap tempo (P1, MVP). US2 = subdivision (P2). Both stories are plain-Metronome-only (FR-013).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 or US2
- Paths are from the repository root. This is a single SvelteKit project.

## Verification (CLAUDE.md)

- Per task: `pnpm vitest run <touched test paths>`.
- E2E: `pnpm build:test` once after changing `src/`, then `pnpm test:e2e:fast <spec files>`.
- Changed screenshots: `pnpm playwright test <spec> -g "<test name>" --project=desktop --update-snapshots`.
- End of slice, once: `pnpm verify`. Never run `pnpm test:e2e` or `pnpm lhci` locally.
- A test file that touches `document`, `window` or `localStorage` MUST start with `// @vitest-environment jsdom`.

---

## Phase 1: Setup

**Purpose**: Confirm the baseline before editing. No new directory or dependency is needed.

- [X] T001 Run `pnpm vitest run tests/unit/metronome tests/unit/audio/metronome.test.ts tests/unit/prefs tests/unit/shortcut-list.test.ts` and record that the 037 baseline is green before any edit
- [X] T002 [P] Read `src/lib/audio/metronome.ts`, `src/lib/state/metronome.svelte.ts`, `src/lib/state/metronome-settings.ts`, `src/lib/state/metronome-keys.ts` and `src/lib/tools/metronome/MetronomePanel.svelte` to confirm the names in plan.md (`ClickScheduler`, `plainRunPlan`, `resetMetronomeForTests`, `onKeydown`) still match. If a name differs, note it at the top of this file.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: The shared extension points that both stories use. Each task here is a small, test-covered change that does not alter behaviour on its own.

**CRITICAL**: Complete before Phase 3 or 4.

- [X] T003 [P] Add `'retime'` to the `click-cancel` reason union in `src/lib/audio/types.ts` (test-build log only, per contracts/click-engine-api.md)
- [X] T004 [P] Add the optional `options` prop to `src/lib/tools/metronome/SubdivisionSelect.svelte`. Default is the existing 1–8 list, so Ratios Training markup is unchanged (FR-013). Extend the existing SubdivisionSelect tests (or the panel test) in `tests/unit/metronome/panel.test.ts` with a case that `options=[1,2,3,4]` renders only those four options and that the default still renders all eight.

**Checkpoint**: Both extension points exist. Behaviour is unchanged. Run `pnpm vitest run tests/unit/metronome tests/unit/audio/metronome.test.ts`.

---

## Phase 3: User Story 1 - Tap the tempo of a song (Priority: P1) 🎯 MVP

**Goal**: In plain Metronome mode, tapping the BPM value (or pressing `T`) sets the BPM from the tap gaps, including live while running, without restarting the loop.

**Independent Test**: In plain mode, tap the BPM pill value 4 times 500 ms apart and read 120. Tap 3 times and read no change. Start, tap a new tempo, and the beat number keeps advancing with no reset (quickstart rows 1–12, 19–20, 22).

### Tests for User Story 1 (write first, confirm they fail)

- [X] T005 [P] [US1] Create `tests/unit/metronome/tap-tempo.test.ts` covering T1–T11 from contracts/tap-tempo-api.md: a table for 0/500/1000/1500 ms → 120, 0/100/200/300 → 300, the exactly-2000 ms gap continues, the 2000.001 ms gap restarts, tap 5 of 500/500/500/400 → 126, only the last 8 taps count, half-up rounding, backwards or non-finite time starts a new run, a 0 ms gap gives 300. Add fast-check properties for T8 (non-null bpm is an integer in 30–300) and T9 (constant gap g in [200, 2000] over k ≥ 4 taps gives `Math.round(60000 / g)`). Also assert `tap` never mutates its input.
- [X] T006 [P] [US1] Add retime cases to `tests/unit/audio/metronome.test.ts` using the fake clock and port from `tests/unit/audio/support/fake-audio`, covering E11–E19 from contracts/click-engine-api.md: clicks before `S′` keep their times, the first click of `S′` keeps its old time and later clicks follow `T(S′) + k × 60/bpm + j × (60/bpm)/n`, `S′` is `a+1` or `a+2`, retime before the anchor starts at the new bpm, `halt('pause')` right after a retime never returns a slot `≥ S′`, the first-click re-anchor guard never fires after a retime, retime on a ramp, a halted scheduler or an invalid bpm returns `false` with no log and no stop. Add the fast-check property for E14 (random sequences of advance-clock and retime with n ∈ 1–4, beats ∈ 1–16, count-in ∈ 0–8: each slot sounds exactly once). Add E20: with no retime the click log equals the 037 expectation. Add quickstart row 24 (16ths at 300 BPM for 10 s: 20 clicks/s, times exact to 1e-9).
- [X] T007 [P] [US1] Extend `tests/unit/metronome/keys.test.ts` for the `'tap'` action: `t` and `T` (Shift allowed) tap in plain mode with shortcuts on. Ignored with shortcuts off, `repeat`, `isComposing`, Ctrl/Meta/Alt/AltGraph, focus in input/textarea/select/contenteditable, an app-bar disclosure open, and in Ratios or Speed mode (quickstart rows 8, 9, 19).
- [X] T008 [P] [US1] Extend `tests/unit/metronome/store.test.ts` for S15–S20: `tapTempo()` outside plain mode does nothing. Taps 1–3 and an unchanged bpm change nothing and announce nothing. A bpm change in settings makes one `preferences.remember` call and sets `announcement = "{bpm} BPM"`. In `starting`/`running` it calls the scheduler `retime(bpm)` once and leaves phase, position and generation unchanged. In `paused` it only commits, and `toggle()` resumes at `position.slot + 1` with the new bpm. `reset()`, `selectMode()`, `screenChanged()` and `restore()` clear the run, and `toggle()` does not. Use the injectable clock (`overrides.clock`).
- [X] T009 [P] [US1] Create `tests/unit/metronome/status-box.test.ts` (jsdom) and extend `tests/unit/metronome/value-row.test.ts`: without the `tap` prop the markup is unchanged (the pill is an `<output aria-live="off">`, the tempo is non-interactive). With `tap`, the value renders a `<button class="tap">` with `aria-label="{bpm} BPM, tap tempo"` (reactive), `title="Tap tempo"`, and visible text that is the BPM. A click calls the handler.
- [X] T010 [P] [US1] Extend `tests/unit/metronome/panel.test.ts` (jsdom): in plain mode both views render tap buttons wired to `metronome.tapTempo()`, and Enter and Space on the focused tap button tap without toggling Start/Pause. `T` calls `tapTempo` only in plain mode and with shortcuts on. Ratios and Speed render no tap button (quickstart rows 12, 19).
- [X] T011 [P] [US1] Extend `tests/unit/shortcut-list.test.ts`: the Metronome list shows a third row `T` with "Tap tempo (Metronome mode)" in en, pt-BR and es, after Space and Escape (quickstart row 22).

### Implementation for User Story 1

- [X] T012 [P] [US1] Create `src/lib/state/tap-tempo.ts` per data-model §1: export `TapRun`, `TAP_WINDOW = 8`, `TAP_MIN_TAPS = 4`, `TAP_MAX_GAP_MS = 2000` and a pure `tap(run, atMs)`. A new run starts when the run is empty, `atMs − last > 2000`, `atMs < last`, or `atMs` is not finite (`[]` if not finite). Otherwise append and keep the last 8. With `n ≥ 4`, bpm is `clampBpm(60000 / ((run[n−1] − run[0]) / (n − 1)))` with `Math.round` half up, clamped to 30–300, and a 0 gap gives 300. Import only `clampBpm` from `./metronome-settings`. Makes T005 pass.
- [X] T013 [US1] Add `retime(bpm): boolean` to `ClickScheduler` in `src/lib/audio/metronome.ts` following the 7-step algorithm in contracts/click-engine-api.md. Add the `pendingBpm: number | null` state (used by `anchorAndRun` as `pendingBpm ?? segment.bpm`) and the `firstScheduled` flag that limits the first-click re-anchor guard in `pump` to a segment's first click. Log `click-cancel` with `reason: 'retime'`. Keep the module framework-free and the no-retime path byte-identical to 037. Makes T006 pass (depends on T003).
- [X] T014 [US1] Add the `'tap'` action to `src/lib/state/metronome-keys.ts`. The context becomes `{ mode, shortcuts }`. Match `t` or `T` on the typed character with the rules in FR-005, and keep the matcher pure and DOM-free. Makes T007 pass.
- [X] T015 [US1] Add `tapTempo()` to `src/lib/state/metronome.svelte.ts`. Use a non-reactive module variable `tapRun` and `tapNow()` = `overrides.clock?.now() ?? performance.now()`. Apply `tap()`. On a new bpm, commit `plain.bpm` through the existing remember path, set `announcement` to `{bpm} {metronome_bpm_unit}`, and in `starting`/`running` call the scheduler's `retime(bpm)` once. Clear `tapRun` in `reset`, `halt` (and so `selectMode` and `screenChanged`) and `restore`, and in `resetMetronomeForTests`. Do nothing outside plain mode. Makes T008 pass (depends on T012, T013).
- [X] T016 [P] [US1] Add the catalog keys `metronome_tap_name` ("{bpm} BPM, tap tempo" / "{bpm} BPM, marcar andamento" / "{bpm} BPM, marcar tempo"), `metronome_tap_title` ("Tap tempo" / "Marcar andamento" / "Marcar tempo") and `shortcuts_metronome_tap` ("Tap tempo (Metronome mode)" / "Marcar andamento (modo Metrônomo)" / "Marcar tempo (modo Metrónomo)") to `messages/en.json`, `messages/pt-BR.json` and `messages/es.json` (data-model §6).
- [X] T017 [US1] Add the optional `tap` prop to `src/lib/tools/metronome/ValueRow.svelte` and `src/lib/tools/metronome/StatusBox.svelte`. Render the button only when `tap` is passed, so Ratios and Speed markup is unchanged. Contract: `class="tap"`, reactive `aria-label` from `metronome_tap_name`, `title` from `metronome_tap_title`, `min-block-size` and `min-inline-size` of `var(--target-min)`, the shared `:focus-visible` ring, an `:active` state, `touch-action: manipulation`, a `ButtonText` outline on focus in forced colours, and design tokens only. Makes T009 pass (depends on T016).
- [X] T018 [US1] Wire `src/lib/tools/metronome/MetronomePanel.svelte`: pass `tap` to the BPM `ValueRow` and to `StatusBox` in plain mode only, and dispatch `T` in `onKeydown` next to Space and Escape, reading `shortcuts.enabled` from `$lib/state/shortcuts.svelte` and calling `metronome.tapTempo()` with `preventDefault()`. Makes T010 pass (depends on T014, T015, T017).
- [X] T019 [P] [US1] Add the `T` row ("Tap tempo (Metronome mode)") to the Metronome list in `src/lib/shell/ShortcutList.svelte` using `shortcuts_metronome_tap`. Makes T011 pass (depends on T016).
- [X] T020 [US1] Create `e2e/metronome-tap-subdivision.spec.ts` with the US1 rows of quickstart: 1, 2, 3, 4, 6, 7, 8, 10, 12, 22 and 23. Install `page.clock` before navigation and use `runFor(500)` between taps. The running scenario (row 6) also uses `page.clock` (no real-time waits): it asserts the readout is exactly 120, the beat never returns to 1, and `__fmAudioLog` has a `click-cancel` entry with `reason: 'retime'`; exact retimed click times stay in the unit tests (T006, E11–E15, S18). Add axe checks and a 320 px no-horizontal-scroll check in en, pt-BR and es.
- [X] T021 [P] [US1] Extend `e2e/metronome-modes.spec.ts`: in Ratios and Speed there is no tap button (the pill is an `<output>`) and `T` does nothing (quickstart row 19).

**Checkpoint**: US1 works alone. Run `pnpm vitest run tests/unit/metronome/tap-tempo.test.ts tests/unit/metronome/keys.test.ts tests/unit/metronome/store.test.ts tests/unit/metronome/panel.test.ts tests/unit/metronome/value-row.test.ts tests/unit/metronome/status-box.test.ts tests/unit/audio/metronome.test.ts tests/unit/shortcut-list.test.ts`, then `pnpm build:test` and `pnpm test:e2e:fast e2e/metronome-tap-subdivision.spec.ts e2e/metronome-modes.spec.ts`.

---

## Phase 4: User Story 2 - Subdivide the click (Priority: P2)

**Goal**: The plain Metronome settings view has a Subdivision drop-down (Quarter, 8ths, Triplets, 16ths). The choice drives playback, the status line, the Start announcement and the stored record.

**Independent Test**: Pick Triplets at 90 BPM, press Start, and see `BEAT n/4 · SUB 3` with one beat click and two even soft clicks per beat. Reload and see Triplets again (quickstart rows 13–18, 21).

### Tests for User Story 2 (write first, confirm they fail)

- [X] T022 [P] [US2] Extend the tests for `src/lib/state/metronome-settings.ts` (the existing settings test under `tests/unit/metronome/`): `toPlainSubdivision` accepts 1–4 and returns `null` for anything else, `DEFAULT_PLAIN_SETTINGS.subdivision` is 1, and `plainRunPlan` sets `clicksPerBeat: p.subdivision`.
- [X] T023 [P] [US2] Extend `tests/unit/prefs/schema.test.ts` for C19–C26: an absent `subdivision` parses to 1 with the other fields kept. The integers 1–4 parse as-is. `"3"`, 2.5, 0, 5, -1, `null`, `true` and `{}` parse to 1 and never throw. A subdivision-1 plain record serializes byte-identically to 037. A record that differs from the defaults only in `subdivision` is written, with `subdivision` after `initialCountIn`. `METRONOME_PLAIN_DEFAULTS` deep-equals `DEFAULT_PLAIN_SETTINGS`. The round-trip property covers 1–4. Erase restores 1.
- [X] T024 [P] [US2] Add the fixtures `tests/unit/prefs/fixtures/metronome-plain-subdivision.txt` (`plain: { bpm: 100, beats: 3, countIn: true, initialCountIn: 4, subdivision: 3 }, mode: "plain"`) and `tests/unit/prefs/fixtures/metronome-plain-subdivision-invalid.txt` (`plain: { bpm: 100, beats: 3, countIn: false, initialCountIn: 2, subdivision: "3" }`), and register them in `tests/unit/prefs/fixtures/index.ts`. Leave the existing fixture files byte-for-byte unchanged. Only their expected parse in `index.ts` gains `subdivision: 1`.
- [X] T025 [P] [US2] Extend `tests/unit/metronome/store.test.ts` for S21–S25: `setPlainSubdivision` accepts 1–4 (numbers or numeric strings) in the settings phase and plain mode, and ignores anything else, any other phase and any other mode. A plain run uses `clicksPerBeat = subdivision` and the count-in is one click per slot. `sub` is `null` for Quarter and 2/3/4 otherwise. Start with Triplets announces "Started, 90 BPM, 4 beats, 8th Triplets[, count in 4]", and Quarter keeps the 036 strings. Ratios and Speed are unchanged. Also cover quickstart rows 13, 14, 16 (the 4 count-in clicks are all `accent` with no `sub`) and 15 (Quarter click log identical to 036).
- [X] T026 [P] [US2] Extend `tests/unit/metronome/panel.test.ts` (jsdom): the plain settings view shows a Subdivision select (`id="metronome-plain-subdivision"`) after # of Beats with the four options, changing it calls `setPlainSubdivision`, it is absent while running or paused and in Ratios and Speed, and the status line gains `· SUB k` through the existing status component.

### Implementation for User Story 2

- [X] T027 [P] [US2] In `src/lib/state/metronome-settings.ts` add `PlainSubdivision = 1 | 2 | 3 | 4`, `PLAIN_SUBDIVISIONS`, `DEFAULT_PLAIN_SUBDIVISION = 1`, `toPlainSubdivision(v: unknown)` (the existing `toSubdivision` intersected with 1–4), the `PlainSettings.subdivision` field with default 1, and `clicksPerBeat: p.subdivision` in `plainRunPlan`. `SharedSettings` and the Ratios and Speed settings stay unchanged. Makes T022 pass.
- [X] T028 [US2] In `src/lib/prefs/schema.ts` add `subdivision: 1` to `METRONOME_PLAIN_DEFAULTS`, add a Valibot picklist fallback in `plainSchema` so values other than the integers 1–4 read as 1 with the other fields kept and no throw, and write `subdivision` after `initialCountIn` only when it is not 1. `version: 1` stays. Makes T023 and T024 pass (depends on T027).
- [X] T029 [US2] In `src/lib/state/metronome.svelte.ts` add `setPlainSubdivision(v)` (settings phase and plain mode only, number or numeric string in 1–4, committed through the existing remember path). Make `sub` return `subdivision > 1 ? subdivision : null` in plain mode. In plain `start()`, when `subdivision` is not 1, use `metronome_announce_started[_count_in]` with `subdivision: subdivisionName(n)`, and keep the 036 `_plain` strings for Quarter. Include `subdivision` in the `plain` partial of `resetMetronomeForTests`. Makes T025 pass (depends on T027, T028; same file as T015, so run after it).
- [X] T030 [P] [US2] Add `metronome_plain_subdivision_label` ("Subdivision" / "Subdivisão" / "Subdivisión") to `messages/en.json`, `messages/pt-BR.json` and `messages/es.json`. Reuse `metronome_subdivision_option`, `metronome_subdivision_1…4` and `metronome_status_sub` unchanged.
- [X] T031 [US2] In `src/lib/tools/metronome/MetronomePanel.svelte` add the plain Subdivision row after # of Beats: `SubdivisionSelect` with `options={[1,2,3,4]}`, `id="metronome-plain-subdivision"`, the label from `metronome_plain_subdivision_label`, the value `plain.subdivision`, and `onchange` calling `metronome.setPlainSubdivision`. Show it only in the settings phase and plain mode. The select fills the row width. Makes T026 pass (depends on T004, T029, T030; same file as T018, so run after it).
- [X] T032 [US2] Add the US2 rows to `e2e/metronome-tap-subdivision.spec.ts` (quickstart 13, 14, 15, 23): Triplets at 90 BPM shows `BEAT n/4 · SUB 3` and the `__fmAudioLog` per-beat pattern `accent|normal` then 2× `sub` at a third of the beat within 10 ms (SC-004). 8ths and 16ths give `· SUB 2` and `· SUB 4`. Quarter shows no `· SUB`. Check axe and 320 px fit for the Subdivision row in en, pt-BR and es (depends on T020).
- [X] T033 [P] [US2] Extend `e2e/metronome-remembered.spec.ts`: choose Triplets, reload, and see "8th Triplets (3)" selected while the Ratios Loop 1 and Loop 2 values are unchanged (quickstart row 17, SC-005). Also assert a tapped bpm is restored after reload.
- [X] T034 [US2] Regenerate the desktop baseline for the new plain settings row with `pnpm playwright test e2e/metronome.spec.ts -g "metronome plain-mode views" --project=desktop --update-snapshots`. Do not hand-edit Linux baselines (they come from `.github/workflows/update-snapshots.yml`). Review the diff shows only the added Subdivision row and the tap-button styling.

**Checkpoint**: US1 and US2 both work. Run the Phase 3 unit command plus `tests/unit/prefs/schema.test.ts`, then `pnpm build:test` and `pnpm test:e2e:fast e2e/metronome-tap-subdivision.spec.ts e2e/metronome-modes.spec.ts e2e/metronome-remembered.spec.ts`.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T035 [P] Check the bundle budget: run the existing bundle-size gate (via `pnpm build` and the repo's size check, which `pnpm verify` also runs). Initial JS must stay ≤ 160 KB gzip (about +1.5 KB expected, R-11). Confirm no new dependency and no new design token were added.
- [X] T036 [P] Walk quickstart.md rows 1–24 against the tests and confirm each has a passing unit or e2e test. Note any row covered only by hand.
- [X] T037 Add a "Manual checks" note under this task list (and list it in the PR description) for the human steps in quickstart.md: by ear, Triplets at 90 BPM sound even with the Ratios soft sound in Chrome and Firefox. By ear, a live tap from 100 to about 140 BPM changes within two beats with no stutter, double click or gap. On a touch screen, fast taps are not delayed and do not zoom. In the PR description also note that 031 FR-023 is amended for the plain mode and that the 036 first-visit-on-Ratios deviation is carried forward.
- [X] T038 Run all local gates once: `pnpm verify` (it skips screenshot assertions and `e2e/perf.spec.ts` outside CI). Do not run `pnpm test:e2e` or `pnpm lhci` locally.

### Phase 5 notes

- T035: initial JS 158.3 KB gzip (≤ 160 KB). No dependency change; the one new design token (`--metronome-tab-underline`) comes from the 036/037 tabs, not from 038.
- T036: rows 1–4, 6–8, 10, 12–15, 17, 19, 22, 23 have unit and e2e tests; rows 5, 9, 11, 16, 18, 20, 21, 24 are unit-only. No row is hand-only except the manual checks above.
- T038: `pnpm check`, `format:check`, unit with coverage, build, bundle size and desktop e2e (without screenshots and perf) pass. `pnpm lint` could not run here: ESLint fails to load `@typescript-eslint` because `node_modules` files go missing in this environment even after a clean reinstall. Run it in CI. Two unit tests that broke on the new `subdivision` field and the `T` key row were fixed. Two e2e tests (handedness, one subdivision pause test) failed once under load and passed on rerun.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: after Setup. Blocks both stories.
- **US1 (Phase 3)**: after Phase 2. No dependency on US2.
- **US2 (Phase 4)**: after Phase 2. No functional dependency on US1, but it edits the same files as US1 (`metronome.svelte.ts`, `MetronomePanel.svelte`, the catalogs and `tests/unit/metronome/store.test.ts` and `panel.test.ts`). Run it after US1 when one person does both, or merge carefully when two do.
- **Polish (Phase 5)**: after both stories.

### Within each story

- Tests first, and they must fail before the implementation.
- US1: T012 and T013 (independent modules) → T015 (store) → T018 (panel). T014 → T018. T016 → T017 → T018. T016 → T019.
- US2: T027 → T028 → T029 → T031. T030 and T004 → T031.

### Story completion order

US1 (MVP) → US2 → Polish.

## Parallel opportunities

- Phase 2: T003 and T004 together.
- US1 tests: T005–T011 touch different files, so run them together.
- US1 implementation: T012, T013 (after T003), T014 and T016 together. Then T017 and T019.
- US2 tests: T022–T026 together, except T025 and T026, which share files with US1's test edits.
- US2 implementation: T027 and T030 together.
- E2E: T021 and T033 touch different spec files and can run beside other work.

```text
# US1 tests together
Task: "tests/unit/metronome/tap-tempo.test.ts (T005)"
Task: "tests/unit/audio/metronome.test.ts retime cases (T006)"
Task: "tests/unit/metronome/keys.test.ts tap action (T007)"
Task: "tests/unit/shortcut-list.test.ts T row (T011)"
```

## Implementation strategy

### MVP first (US1 only)

1. Phase 1 and Phase 2.
2. Phase 3 (US1).
3. Stop and validate: 4 taps at 500 ms give 120, 3 taps change nothing, a live tap keeps the loop running.
4. Ship it if wanted. Quarter and no tapping stays identical to 037 (FR-014).

### Incremental delivery

1. Setup and Foundational.
2. US1, test, ship (MVP).
3. US2, test, regenerate the screenshots, ship.
4. Polish and `pnpm verify` once.

## Notes

- `[P]` means different files and no dependency on an unfinished task.
- Ratios Training, Speed Training, `metronome-cycle.ts`, `metronome-ramp.ts`, the link codec, the theory and instrument modules are not modified (FR-013).
- Commit after each task or logical group.

## Manual checks

- By ear, in Chrome and Firefox: Triplets at 90 BPM sound even, with the Ratios soft sound.
- By ear: a live tap from 100 to about 140 BPM changes within two beats with no stutter, double click or gap.
- On a touch screen: fast taps are not delayed and do not zoom.
- PR description: 031 FR-023 is amended for the plain mode; the 036 first-visit-on-Ratios deviation is carried forward.

- T034: the local run changes `metronome-plain-{settings,running}-{light,dark}` (the added Subdivision row and tap-button styling). The Linux PNGs were not committed from this machine; regenerate them with `.github/workflows/update-snapshots.yml` before merge.
