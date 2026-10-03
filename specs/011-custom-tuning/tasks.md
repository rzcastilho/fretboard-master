---

description: "Task list for 011 Custom Tuning"
---

# Tasks: Custom Tuning

**Input**: Design documents from `/specs/011-custom-tuning/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/{tuning-api,custom-panel-ui,storage-format}.md, quickstart.md

**Tests**: REQUIRED. Constitution IV (test-first) and SC-005 (every acceptance scenario has an automated test). Write each test task first, see it FAIL, then implement.

**Organization**: Grouped by user story. Paths follow plan.md (single SvelteKit project at repo root). Signatures in `contracts/tuning-api.md` are binding.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1…US5, from spec.md
- String numbering: string 1 = thinnest. `Offsets` are ordered strings 6 → 1. Limits: −7…+4 semitones per string.
- Quality gates after any task touching code: `pnpm check`, `pnpm lint`, `pnpm test:unit`.

---

## Phase 1: Setup

**Purpose**: Establish baseline before changing shared types.

- [X] T001 Run `pnpm install && pnpm check && pnpm lint && pnpm test:unit` at repo root and confirm a green baseline; record any pre-existing failures in the PR description
- [X] T002 [P] Run `pnpm build && node scripts/check-bundle-size.mjs` and note current gzip size of initial JS (expected ≈ 82.2 KB; budget ≤ 85 KB, plan R-11)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure core (spelling, offsets, Tuning union) and the behaviour-preserving `tuningId → tuning` migration. All user stories depend on this.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

### Pure theory and instrument core (test-first)

- [X] T003 [P] Write failing tests for `sharpSpelling` (12 pitch classes: C C♯ D D♯ E F F♯ G G♯ A A♯ B) and `spellSharp` (octave = `octaveOf(p)`, octave boundaries B/C, pitch preserved) in `tests/unit/theory/pitch.test.ts`
- [X] T004 Implement `sharpSpelling` and `spellSharp` in `src/lib/theory/pitch.ts` per `contracts/tuning-api.md` §1; make `defaultSpelling` in `src/lib/notation/notation.ts` delegate to `sharpSpelling` (behaviour unchanged; existing notation tests must still pass)
- [X] T005 [P] Write failing tests in `tests/unit/instrument/custom-tuning.test.ts`: `OFFSET_MIN = -7`, `OFFSET_MAX = 4`; per-string limits table (6: A1–G♯2, 5: D2–C♯3, 4: G2–F♯3, 3: C3–B3, 2: E3–D♯4, 1: A3–G♯4); all 12 positions × 6 strings give the correct pitch (SC-002, 72 cases); `isOffsets` rejects non-array, length ≠ 6, non-integer, < −7, > 4; `presetOffsets` for all 11 presets is in range; `matchPreset` returns each preset id (SC-004) and `null` otherwise; `canStep`/`stepOffsets` (refused step returns same reference); `invertedStrings` (string n strictly lower than n+1; equal pitches NOT inverted; Standard NOT inverted); results frozen
- [X] T006 [P] Write failing property tests in `tests/unit/instrument/custom-tuning.property.test.ts` (fast-check): `stepOffsets` keeps offsets valid; step then opposite step round-trips; `spellSharp(offsetPitches(o)[i])` preserves pitch
- [X] T007 Implement `src/lib/instrument/custom-tuning.ts` per `contracts/tuning-api.md` §2 and `data-model.md` §1 (`Offsets`, `OFFSET_MIN`, `OFFSET_MAX`, `STANDARD_OFFSETS`, `StringNumber`, `isOffsets`, `presetOffsets` memoized, `matchPreset` in AF-1…AF-11 order, `offsetPitches`, `invertedStrings`, `canStep`, `stepOffsets`). Imports only `../theory/*` and `./*` (lint boundary). Makes T005/T006 pass
- [X] T008 [P] Write failing tests in `tests/unit/instrument/tunings.test.ts`: `tuningFromOffsets` canonical (matched → preset, else custom); `offsetsOfTuning`; `equalsTuning`; `isStandard`; `tuningStrings` (Half step down keeps flats E♭2 A♭2 D♭3 G♭3 B♭3 E♭4; unmatched uses sharps); `tuningInstrument` custom is frozen 6-string with `openStrings` = reverse of `tuningStrings`, memoized by `offsets.join(',') + '|' + frets`; `tuningInstrument(STANDARD_TUNING, 22) === STANDARD_GUITAR`. Add property test: `tuningFromOffsets(o).kind === 'custom'` ⇔ `matchPreset(o) === null`, and `offsetsOfTuning(tuningFromOffsets(o))` equals `o`
- [X] T009 Implement in `src/lib/instrument/tunings.ts` (depends on T004, T007): `Tuning` union, `STANDARD_TUNING`, `tuningFromOffsets` (only constructor of `custom`), `offsetsOfTuning`, `equalsTuning`, `isStandard`, `tuningStrings`, `tuningInstrument` (memoized, frozen, handedness/orientation unchanged)

### Migration `InstrumentConfig.tuningId → tuning` (behaviour-preserving)

- [X] T010 Update tests first: migrate every `tuningId` fixture/assertion to `tuning: { kind: 'preset', id }` in `tests/unit/state/instrument-config.test.ts`, `tests/unit/state/instrument-store.test.ts`, `tests/unit/state/preferences-store.test.ts`, `tests/unit/instrument-panel.test.ts`, `tests/unit/tuning-badge.test.ts`, `tests/unit/home-screen.test.ts` (grep `tuningId` under `tests/` to find all). Add transition tests for `openPanel` (`customOpen` = active is custom), `selectTuning` (sets `customOpen = false`), `restoreDefault` (Standard, `customOpen = false`, frets 22)
- [X] T011 Migrate `src/lib/state/instrument-config.ts` to `InstrumentConfig { tuning: Tuning; fretCount }`, `PanelState` open variant with `customOpen: boolean`, `DEFAULT_CONFIG`, `equalsConfig` via `equalsTuning`, `instrumentOf` via `tuningInstrument`, transitions per `data-model.md` §3 table (except `chooseCustom`/`stepString`, added in US1)
- [X] T012 [P] Add `tuningLabel(t: Tuning)` to `src/lib/shell/tuning-names.ts` (preset → `tuningName(id)`; custom → `m.tuning_custom()`); update `src/lib/shell/TuningBadge.svelte` (shown iff `!isStandard(active.tuning)`, text `tuningLabel`) and `src/lib/shell/InstrumentSummary.svelte` (`isStandard` → `instrument_summary_standard`, else `instrument_summary_preset({ name: tuningLabel(...) })`)
- [X] T013 [P] Add the 7 catalog messages from `contracts/custom-panel-ui.md` to `messages/en.json`: `tuning_custom`, `instrument_custom_label`, `instrument_custom_strings`, `instrument_string_lower`, `instrument_string_raise`, `instrument_string_note`, `instrument_tuning_order` (exact English text from the contract); run `pnpm check` so Paraglide compiles them
- [X] T014 Migrate `src/lib/state/instrument.svelte.ts` (`confirm` temporarily writes `tuningId` from `tuning.id` for presets; `restore(config)` carries `tuning`), `src/lib/state/preferences.svelte.ts`, and `src/lib/shell/InstrumentPanel.svelte` radios to read/write `pending.tuning` (selected radio = `customOpen ? 'custom' : pending.tuning.id`; Custom radio not yet shown). Fix remaining `tuningId` references until `pnpm check` passes
- [X] T015 Run `pnpm check && pnpm lint && pnpm test:unit`; all pre-existing 009/010 tests pass after migration

**Checkpoint**: Pure core and migration green; feature not yet visible.

---

## Phase 3: User Story 1 - Set each string to my own tuning (Priority: P1) 🎯 MVP

**Goal**: Choose Custom, adjust each string by semitones within limits, see note + octave per string, preview follows, confirm applies to all tools; cancel discards; Restore default resets.

**Independent Test**: Open panel, choose Custom, lower string 6 twice → D2 shown, preview open string 6 is D; confirm; Fretboard Notes/Triads use custom pitches.

### Tests for User Story 1 ⚠️ (write first, must FAIL)

- [X] T016 [P] [US1] Transition tests in `tests/unit/state/instrument-config.test.ts`: `chooseCustom` sets `customOpen = true` and keeps pending pitches (from Standard and from Half step down); `stepString` changes one offset and returns canonical tuning; refused step at limit returns the same object (all 6 strings × both directions, SC-003); `stepFrets/setFrets` keep tuning and `customOpen`; select preset after Custom replaces pitches and hides rows; Custom again restarts from preset pitches (spec edge case); `cancelPanel` discards; `confirmPanel` `changed` false for identical pitches
- [X] T017 [P] [US1] Store tests in `tests/unit/state/instrument-store.test.ts`: `instrument.chooseCustom()`, `instrument.stepString(n, delta)` returns true iff pitch changed; confirm applies tuning to Notes and Triads instruments (AS 1.2); close-without-confirm keeps previous instrument (AS 1.5); no-change confirm rewrites nothing and shows no adjust notice
- [X] T018 [P] [US1] Panel component tests in `tests/unit/instrument-panel.test.ts` for scenarios 1.1, 1.3, 1.4, 1.6, 1.7, 1.8, 1.9, 1.10: Custom radio last after AF-11; six rows string 6 first, E2 A2 D3 G3 B3 E4; lower string 6 ×2 → D2; string 1 lowered 7× → A3 and lower button `disabled` with no error text; string 6 raised to G♯2 disables raise; sharps spelling (F2, F♯2); Half step down + lower string 6 → D2, others G♯2 C♯3 F♯3 A♯3 D♯4 (sharps); Restore default → Standard selected, rows hidden, frets 22; preview reflects pending pitches (FR-021); clicking a disabled button changes nothing; accessible names "Lower string n", "Raise string n", "String 6, D 2" / "String 2, A sharp 3" (via `spokenNote`)
- [X] T019 [P] [US1] Focus-rescue test in `tests/unit/instrument-panel.test.ts`: when a focused lower/raise button becomes disabled at a limit, focus moves to that row's note button (FR-023); rapid repeated presses never pass the limit

### Implementation for User Story 1

- [X] T020 [US1] Add `chooseCustom` and `stepString` transitions to `src/lib/state/instrument-config.ts` per `data-model.md` §3 (`stepString` = `tuningFromOffsets(stepOffsets(offsetsOfTuning(pending.tuning), string, delta))`; no-op returns same object)
- [X] T021 [US1] Add `chooseCustom()` and `stepString(string, delta): boolean` to `src/lib/state/instrument.svelte.ts` (returns whether pitch changed); expose derived panel view (selected radio, rows via `tuningStrings(pending.tuning)` with `canStep(-1)`/`canStep(+1)`, preview instrument `instrumentOf(pending)`)
- [X] T022 [US1] Extend `src/lib/shell/InstrumentPanel.svelte`: Custom radio (`value="custom"`, name `instrument_custom_label`, last entry); rows group labelled `instrument_custom_strings`, string 6 first; each row = Lower button (`−`, aria-hidden glyph), note button (`pitchLabel`, name from `instrument_string_note` with `spokenNote`), Raise button (`+`); native `disabled` at limits with no error text; focus rescue to note button after DOM update; opening on a custom active tuning checks Custom and shows rows, on a preset checks it and hides rows; labels via notation module only (FR-018)
- [X] T023 [US1] Style rows with design tokens only: every button ≥ `--target-min` (44 px) both directions, visible focus, wraps without overlap at 320 px and 200 % zoom, only preview fretboard scrolls horizontally (FR-019, SC-008)
- [X] T024 [US1] Run T016–T019 to green; run `pnpm check && pnpm lint`

**Checkpoint**: US1 independently functional and testable (silent MVP).

---

## Phase 4: User Story 2 - Hear each string as I tune it (Priority: P1)

**Goal**: Each lower/raise press plays the new pitch; note button plays current pitch without changing it.

**Independent Test**: Lower string 6 twice, activate its note button → D2 plays; displayed note and heard pitch agree.

### Tests for User Story 2 ⚠️

- [X] T025 [P] [US2] Store test in `tests/unit/state/instrument-store.test.ts` using the injectable fake audio engine: `playString(n)` calls `playback.note({ string: n, fret: 0 }, previewInstrument)` for the pending instrument; no-op when panel closed; a new sound stops the previous one (FR-7.9); mute/unlock rules respected; played pitch equals `offsetPitches` value for all 72 positions
- [X] T026 [P] [US2] Panel tests in `tests/unit/instrument-panel.test.ts` for scenarios 2.1–2.6: note button plays D2 without state change; lower/raise plays new pitch only when it changed; disabled button plays nothing; muted/locked audio leaves panel working; keyboard Enter and Space on a focused note button plays

### Implementation for User Story 2

- [X] T027 [US2] Add `playString(string)` to `src/lib/state/instrument.svelte.ts` → `playback.note({ string, fret: 0 }, preview)`; no-op when closed
- [X] T028 [US2] Wire `src/lib/shell/InstrumentPanel.svelte`: note button → `playString(n)`; lower/raise → `if (instrument.stepString(n, d)) instrument.playString(n)`
- [X] T029 [US2] Run T025/T026 to green

**Checkpoint**: US1 + US2 work together.

---

## Phase 5: User Story 3 - See when my tuning is a known one (Priority: P2)

**Goal**: Matching pitches take the preset's name/spelling everywhere; unmatched read "Custom".

**Independent Test**: From Standard, lower string 6 twice → name line "Drop D"; confirm → badge "Drop D"; reopen → Drop D radio selected, rows hidden.

### Tests for User Story 3 ⚠️

- [X] T030 [P] [US3] Panel tests in `tests/unit/instrument-panel.test.ts` for scenarios 3.1–3.3: tuning-name line in a `role="status"` region (polite) reads "Drop D" while Custom stays selected and rows visible; raising string 6 → "Custom"; all offsets 0 → "Standard"; reopening after confirming a matched tuning selects the preset with rows hidden; reopening after unmatched confirm selects Custom with rows visible and confirmed values; matching ignores spelling (G♯ vs A♭ case shows A♭)
- [X] T031 [P] [US3] Badge/summary tests in `tests/unit/tuning-badge.test.ts` and `tests/unit/home-screen.test.ts` for scenarios 3.4–3.5: confirmed custom matching Half step down → "Half step down" with flat spelling; unmatched → badge "Custom" and summary "6 strings · Custom · right-handed"; Standard → no badge
- [X] T032 [P] [US3] SC-004 coverage test in `tests/unit/instrument/custom-tuning.test.ts` (if not already complete from T005): all 11 presets named by pitch from offsets, via `tuningFromOffsets` → `tuningLabel`

### Implementation for User Story 3

- [X] T033 [US3] Render the tuning-name line in `src/lib/shell/InstrumentPanel.svelte` (visible when `customOpen`): preset → `tuningName(id)`, custom → `m.tuning_custom()`, inside `role="status"` `aria-live="polite"`
- [X] T034 [US3] Verify canonicalization on confirm in `src/lib/state/instrument-config.ts` / `src/lib/state/instrument.svelte.ts` (matched → stored/active as preset; spelling from preset); fix any gap found by T030/T031
- [X] T035 [US3] Run T030–T032 to green

**Checkpoint**: US1–US3 work.

---

## Phase 6: User Story 4 - Unusual set-ups are allowed (Priority: P2)

**Goal**: Unison and inverted tunings accepted; order note shown; Triads guidance for non-closing sets.

**Independent Test**: Tune string 3 to string 2's pitch, confirm, open Triads on set 3-2-1 → empty fretboard, guidance, **Another set** and **See all notes**.

### Tests for User Story 4 ⚠️

- [X] T036 [P] [US4] Panel tests in `tests/unit/instrument-panel.test.ts` for scenarios 4.1, 4.5, 4.6: unison accepted, no error, Confirm enabled; lowering string 3 to C♯3 shows "The strings are not in order from low to high" (muted token, no `--color-error*`, single line, inside polite status, Confirm enabled); disappears when back in order
- [X] T037 [P] [US4] Triads tests in `tests/unit/triads/triads-guidance.test.ts` and `tests/unit/state/triads-store.test.ts` for scenarios 4.2–4.4, 4.8 and edge cases: unison 3-2-1 → empty fretboard with "This triad does not close on this string set with the current tuning" and both actions; **Another set** moves to nearest closing set; **See all notes** switches Triads to its All notes view (FR-014, AS 4.3, R-08; existing 006 C8 behaviour); no closing set → only **See all notes**; tuning change keeps the current set and shows guidance; in-order set on same tuning shows shape normally; only affected sets show guidance
- [X] T038 [P] [US4] Notes test (scenario 4.7) in `tests/unit/` (existing Fretboard Notes test file; locate with grep): two strings at same pitch → every note on every string still shows correctly

### Implementation for User Story 4

- [X] T039 [US4] Render the order note in `src/lib/shell/InstrumentPanel.svelte` when `customOpen && invertedStrings(offsetsOfTuning(pending.tuning))`, text `m.instrument_tuning_order()`, muted text token, non-blocking
- [X] T040 [US4] Run T036–T038; if Triads tests expose a gap in the existing guidance (not-closing for unison/inverted sets, no auto-move of set), fix in `src/lib/` Triads state/theory code the tests point to, reusing the existing mechanism (Assumption: guidance is reused, not rebuilt)

**Checkpoint**: US1–US4 work.

---

## Phase 7: User Story 5 - My custom tuning is remembered (Priority: P2)

**Goal**: `customTuning` stored in the v1 record, restored on load, damaged data ignored, erased with preferences.

**Independent Test**: Confirm unmatched tuning, reload → same tuning active and panel shows same notes.

### Tests for User Story 5 ⚠️

- [X] T041 [P] [US5] Add six fixtures to `tests/unit/prefs/fixtures/` (`v1-custom.txt`, `v1-custom-drop-d.txt`, `custom-wrong-length.txt`, `custom-out-of-range.txt`, `custom-non-integer.txt`, `custom-non-array.txt`) with exact raw values from `contracts/storage-format.md` and register them in `tests/unit/prefs/fixtures/index.ts`; do not modify or remove existing fixtures
- [X] T042 [P] [US5] Schema tests in `tests/unit/prefs/schema.test.ts`: each of the six fixtures yields the expected column list from the contract table; records without `customTuning` load unchanged (FR-017); invalid `customTuning` never throws and keeps other fields; serialized field order `version, tuning, customTuning (when present), frets, muted, volume, lastTool (when present), labels`; fast-check round-trip: for every valid `Offsets` `o`, serialize preferences of `tuningFromOffsets(o)` and parse back → same `Tuning`
- [X] T043 [P] [US5] Store tests in `tests/unit/state/instrument-store.test.ts` and `tests/unit/state/preferences-store.test.ts`: confirming unmatched writes `tuning: "AF-1"` + `customTuning`; confirming matched (or Standard) writes preset id and NO `customTuning`; erase restores Standard; blocked/full storage applies for session with no error (AS 5.6); start() restores custom tuning
- [X] T044 [P] [US5] E2E in `e2e/preferences.spec.ts`: reload persistence of a custom tuning; damaged `customTuning` (`[0,0,0,0,0,9]`) loads Standard with no error screen; erase preferences resets to Standard

### Implementation for User Story 5

- [X] T045 [US5] Extend `src/lib/prefs/schema.ts`: Valibot `customTuning` field (array of exactly 6 integers, each −7 ≤ x ≤ 4, using `isOffsets` rules) with per-field fallback to `null` on invalid; `Preferences.customTuning: Offsets | null` (default `null` in `DEFAULT_PREFERENCES`); `tuningOfPreferences(p)` per `data-model.md` §5; serializer field order and writer rules 1–2 (omit key when `null`). Add no new dependency
- [X] T046 [P] [US5] Update `src/lib/prefs/session.ts`: `PreferencesPatch` accepts `customTuning` (type only)
- [X] T047 [US5] Update `src/lib/state/instrument.svelte.ts` `confirm` to call `preferences.remember({ tuningId: tuning.kind === 'preset' ? tuning.id : 'AF-1', customTuning: tuning.kind === 'custom' ? tuning.offsets : null, fretCount })`; update `src/lib/state/preferences.svelte.ts` `start()`/`erase()` to call `instrument.restore({ tuning: tuningOfPreferences(p), fretCount })`
- [X] T048 [US5] Run T041–T043 to green

**Checkpoint**: All five stories functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T049 [P] Write `e2e/custom-tuning.spec.ts` (Playwright, phone 360 px + desktop) covering US1–US5 flows from the quickstart manual walkthrough steps 1–9 (SC-001 Drop D in two presses; limits with focus on note button; order note; confirm unmatched → badge and summary; reload; Triads unison 3-2-1 guidance with both actions); use role + accessible-name selectors, no new `data-testid`
- [X] T050 [P] Add axe (`@axe-core/playwright`) zero-violation checks for the panel in Custom state at phone and desktop sizes, plus layout assertions at 320 px width and 200 % text zoom (SC-008) in `e2e/custom-tuning.spec.ts`
- [X] T051 [P] Write ADR `docs/adr/0014-custom-tuning-canonical-form.md` (canonical-form decision; changes ADR 0012 store contract and ADR 0013 record; follow the format of existing ADRs in `docs/adr/`)
- [X] T052 Run `pnpm build && node scripts/check-bundle-size.mjs`; confirm initial JS ≤ 85 KB gzip. If exceeded, lazy-load the string rows per plan R-11 (do NOT raise the limit without a constitution amendment)
- [X] T053 [P] Verify performance budgets (SC-007): control change → fretboard update ≤ 100 ms, instrument change ≤ 300 ms, using existing perf test approach
- [X] T054 Run all gates from quickstart: `pnpm check`, `pnpm lint`, `pnpm format:check`, `pnpm test:unit` (coverage ≥ 95 % theory, ≥ 80 % overall), `pnpm test:e2e`
  - Result: check/lint/format green; unit 2026 pass, coverage lines 97.3 % / branches 91.4 % (thresholds enforced); bundle 84.0 KB ≤ 85 KB. E2E fixed 1 app bug (FR-023 focus lost when the step button disables — browsers blur it before `tick()`) and 4 test bugs (spoken `C sharp` names, Triads card link, hidden description match, perf label sequence). Remaining load-sensitive perf/playback tests pass with `--workers=1`. Local caveat: on macOS 12 the bundled Chromium/WebKit builds do not launch (`dyld: Symbol not found`), so Chromium projects ran on the installed Chrome channel and WebKit smoke was not run.
- [X] T055 Execute the quickstart.md manual walkthrough (steps 1–9) with `pnpm dev` and note any deviation
  - Done as a scripted check in real Chrome, no human pass: steps 1–5, 7, 8 → `e2e/custom-tuning.spec.ts`; 6 → custom-tuning US3/US5 + `preferences.spec.ts` AS 5.1; 9 → `preferences.spec.ts` AS 5.5 (About → Erase). Deviation: step 3 focus did not move to the note button in real browsers (fixed in `InstrumentPanel.svelte`).
- [X] T056 Grep for leftover `tuningId` on `InstrumentConfig` and hard-coded user-facing strings or note names outside the catalog/notation module (FR-018); fix findings

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)**: none
- **Foundational (2)**: after Setup; BLOCKS all stories. Internal order: T003→T004; T005/T006→T007; T004+T007→T008→T009; T010→T011→T012/T013→T014→T015
- **US1 (3)**: after Phase 2
- **US2 (4)**: after US1 (needs panel rows, `stepString`)
- **US3 (5)**: after US1 (name line lives in the panel); independent of US2
- **US4 (6)**: after US1; Triads tests (T037/T038) are independent of panel work
- **US5 (7)**: after Phase 2; schema work (T041, T042, T045, T046) is independent of US1; T047 needs US1's store changes
- **Polish (8)**: after desired stories complete

### Story Dependencies

- US1 → US2, US3, US4 (all extend the panel built in US1)
- US5 mostly independent (shares `instrument.svelte.ts` with US1/US2: serialize edits to that file)

### Within Each Story

Tests first and failing → pure transitions → store → component → green.

### Same-file conflicts (do not parallelize)

`src/lib/shell/InstrumentPanel.svelte` (T022, T023, T028, T033, T039), `src/lib/state/instrument.svelte.ts` (T014, T021, T027, T047), `tests/unit/instrument-panel.test.ts` (T018, T019, T026, T030, T036), `src/lib/state/instrument-config.ts` (T011, T020, T034).

## Parallel Examples

```bash
# Foundational tests together:
T003 pitch tests | T005 custom-tuning tests | T006 property tests | T008 tunings tests

# US1 tests together:
T016 transitions | T017 store | T018 panel | T019 focus

# US5 tests together:
T041 fixtures | T042 schema | T043 store | T044 e2e

# After Phase 2, two tracks:
Track A: US1 → US2 → US3 → US4      Track B: US5 schema (T041, T042, T045, T046)
```

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 → Phase 2 → Phase 3 (US1). **Stop and validate**: Custom rows, limits, preview, confirm drives Notes/Triads. (Note: US2 sound is also P1 — ship US1+US2 together if the release needs "can hear it".)
2. Add US2 (sound) → demo.

### Incremental Delivery

3. US3 (names) → 4. US4 (unusual set-ups) → 5. US5 (persistence) → Polish. Each stage keeps previous stories passing.

## Notes

- **See all notes** = shipped 006 C8 behaviour (Triads All notes view), per amended FR-014 / AS 4.3. Do not change the action.
- Out of scope: seven-string tunings, capo, accidental preference, CAGED, share links (FR-020).
- Commit after each task or logical group (Conventional Commits).
