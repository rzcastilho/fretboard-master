---

description: "Task list for Left-Handed Mode and String Orientation"
---

# Tasks: Left-Handed Mode and String Orientation

**Input**: Design documents from `/specs/013-left-handed-and-orientation/`

**Prerequisites**: plan.md, spec.md, research.md (R-01…R-15), data-model.md, contracts/ (`instrument-panel-ui.md`, `orientation-api.md`, `storage-format.md`), quickstart.md (Q1–Q26)

**Tests**: INCLUDED. Constitution IV mandates test-first for logic and an automated test for every acceptance scenario. Within each story, write tests first and see them fail before implementing.

**Organization**: Grouped by user story. US1 and US2 touch the same files (`geometry.ts`, `Fretboard.svelte`, `InstrumentPanel.svelte`), so implement them in priority order (US1 → US2); tests of different files stay parallel.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on an incomplete task
- **[Story]**: US1…US5 (spec.md); none for Setup, Foundational, Polish
- All paths are relative to the repository root. Single SvelteKit project; no new directories except `docs/adr/` file.

## Path Conventions

`src/lib/{instrument,fretboard,state,prefs,shell}`, `messages/en.json`, `tests/unit/**`, `e2e/**`, `docs/adr/`. Do NOT modify `src/lib/theory`, `src/lib/tools/**`, notation or audio.

---

## Phase 1: Setup

**Purpose**: Confirm green baseline before changing anything

- [X] T001 Run baseline gates and record results: `pnpm check && pnpm lint && pnpm test:unit && pnpm build && node scripts/check-bundle-size.mjs`; note current gzip size of initial JS (cap 85 KB) in the PR description
- [X] T002 Locate the two placeholder tests to be replaced ("screenOrder is identity", "screenOrder lists string 7 last for every handedness/orientation") in `tests/unit/fretboard/geometry.test.ts` and note them for T017/T034 (do not delete yet; research R-13)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Value types, config state and transitions, catalog keys, boundary guard. Every story needs these.

**⚠️ CRITICAL**: No user story work starts until this phase is complete.

- [X] T003 [P] Write failing tests in `tests/unit/instrument/instrument.test.ts` for `withPresentation` (contracts/orientation-api §1): default args return `base` itself (`STANDARD_GUITAR` identity kept); non-default returns frozen object with musical fields equal and same inputs → same object (memoized); `positionPitch` identical for every position in all four combinations; add `equalsMusicalInstrument(a,b)` test helper usage
- [X] T004 Implement in `src/lib/instrument/instrument.ts`: `export type Handedness = Instrument['handedness']`, `export type Orientation = Instrument['orientation']`, `HANDEDNESS = ['right','left']`, `ORIENTATIONS = ['highest-top','lowest-top']`, `withPresentation(base, h, o)` memoized via `WeakMap<Instrument, Map<string, Instrument>>` (data-model §1–2); add `equalsMusicalInstrument` helper (depends on T003)
- [X] T005 [P] Write failing tests in `tests/unit/state/instrument-config.test.ts` for every row of data-model §3: `DEFAULT_CONFIG` has `handedness:'right'`, `orientation:'highest-top'`; `equalsConfig` compares five fields; `equalsMusical` ignores presentation; `instrumentOf` returns the unchanged `tuningInstrument(...)` object for defaults; `setHandedness`/`setOrientation` are no-ops when closed, same value, or invalid value, otherwise set pending and keep Custom rows state; `restoreDefault` resets presentation to right/highest-top plus 6 strings/standard/22 frets; `cancelPanel` discards pending; `confirmPanel` returns `{panel, next, changed, musicalChanged}` (presentation-only change → `changed:true, musicalChanged:false`)
- [X] T006 Implement in `src/lib/state/instrument-config.ts`: add `handedness`/`orientation` to `InstrumentConfig` and `DEFAULT_CONFIG`; `equalsConfig` (5 fields), new `equalsMusical` (`stringCount`, `tuning`, `fretCount`), `instrumentOf` via `withPresentation`, `setHandedness`, `setOrientation`, `confirmPanel` returning `musicalChanged` (depends on T004, T005)
- [X] T007 [P] Write failing tests in `tests/unit/state/instrument-store.test.ts` (contracts/orientation-api §5): `instrument.setHandedness('left')`/`setOrientation('lowest-top')` change pending only; presentation-only `confirm` does NOT call `playback.stop`, leaves `adjustedIn === null`, keeps `notes.view` and `triads.view` object-identical, and `notes.instrument.handedness === 'left'`; musical confirm still stops playback and may raise the adjustment notice; Close/Escape discards pending presentation (EC-2.7)
- [X] T008 Implement in `src/lib/state/instrument.svelte.ts`: `setHandedness`, `setOrientation`, presentation-only branch in `confirm` (calls `notes.applyInstrument(inst)` and `triads.applyInstrument(inst)`, no playback stop, no notice), `restore(config)` accepts the two fields; `current` and `preview` already use `instrumentOf` so thumbnails/preview follow (depends on T006, T007)
- [X] T009 [P] Add catalog keys to `messages/en.json` per contracts/instrument-panel-ui §2: `instrument_handedness_legend`, `instrument_handedness_right_option`, `instrument_handedness_left_option`, `instrument_orientation_legend`, `instrument_orientation_highest`, `instrument_orientation_lowest`, `instrument_handedness_right`, `instrument_handedness_left`; change `instrument_summary_standard` to `{count} strings · standard tuning · {handedness}` and `instrument_summary_preset` to `{count} strings · {name} · {handedness}` **(summary-message change deferred to T021: `InstrumentSummary.svelte` must pass `handedness` in the same step or `pnpm check` fails)**; run `pnpm check` to recompile Paraglide
- [X] T010 [P] Write `tests/unit/presentation-boundary.test.ts` (contracts/orientation-api §7): scan `src/**/*.{ts,svelte}`, ignoring comments, and fail on `/\.(handedness|orientation)\b|\b(handedness|orientation)\s*:/` outside the allow-list `instrument/instrument.ts`, `instrument/tunings.ts`, `instrument/fixtures.ts`, `fretboard/geometry.ts`, `state/instrument-config.ts`, `state/instrument.svelte.ts`, `state/preferences.svelte.ts`, `prefs/schema.ts`, `shell/InstrumentPanel.svelte`, `shell/InstrumentSummary.svelte`; adjust the allow-list only if a real, justified read exists (research R-08)

**Checkpoint**: `pnpm test:unit` green for T003–T010; defaults behave exactly as before. Stories can start.

---

## Phase 3: User Story 1 - Mirror the fretboard for left-handed play (Priority: P1) 🎯 MVP

**Goal**: Choosing Left-handed in the instrument panel and confirming mirrors the whole fretboard (nut right, frets increase leftward, labels/tags/arrows/region/focus follow), same notes, same sound, same reported positions; preview shows pending value; no view change, no notice.

**Independent Test**: Quickstart Q1–Q8, Q22, Q23, Q25 — set Left-handed, confirm; nut is right of fret 1, string-label column rightmost, ArrowLeft = fret +1, tapping string 3 fret 5 reports 3:5 with the same pitch as right-handed.

### Tests for User Story 1 ⚠️ write first, must fail

- [X] T011 [P] [US1] In `tests/unit/fretboard/geometry.test.ts` add left-handed (`handedness:'left'`, highest-top) table tests: `screenOrder` → `{rows:[1..n], reversed:true}`; data-model §4 invariants 1 and 5 (outer-in order label column → open column → nut → fret 1…; `columns[f].center < columns[f-1].center` for f ≥ 1; `start < end`; layout = right-handed layout with `x ↦ width − x`); `mirrored`, `labelCenter = width − labelCol/2`, `board = {0, width − labelCol}`, `strings = {0, columns[0].center}`, `nutX = columns[0].start`; `nearestPosition(layout, col.center, row.center)` returns that cell; ties → lower fret, then lower string number
- [X] T012 [P] [US1] In `tests/unit/fretboard/interaction.test.ts` add tests (contracts/orientation-api §3): `moveFocus` left-handed ArrowLeft 3:5 → 3:6 and ArrowRight → 3:4, no wrapping at either edge; `nutOffset`/`scrollForNutOffset` round-trip (`scrollForNutOffset(nutOffset(x)) === x`); unscrolled left-handed = `maxScroll`; `autoScrollTarget`/`groupScrollTarget`/`scrollIntoViewTarget` return the mirror of the right-handed target; `spanTarget` wider than viewport aligns the nut side; `trailingEdgeScroll` mirrored → 0; handedness switch keeps the same fret interval in view (`scrollLeft' = maxScroll − scrollLeft`)
- [X] T013 [P] [US1] In `tests/unit/fretboard/fretboard.test.ts` add component tests for left-handed rendering: `.string-label` x > cells x; `.nut` x > fret-1 cell x; `.fret-number` for fret N has smaller x than N−1; `.region-band` covers the mirrored frets 5–8; Triads Full neck A major 3-2-1 `.tag` running order root → 1st → 2nd goes right to left; `onactivate` receives `{string:3, fret:5}` when that cell is activated (FR-008)
- [X] T014 [P] [US1] In `tests/unit/instrument-panel.test.ts` add: fieldset "Handedness" with radios "Right-handed" (checked) and "Left-handed"; choosing Left updates preview only; Close discards; Confirm applies; Restore default re-checks Right-handed. In `tests/unit/home-screen.test.ts` and `tests/unit/tuning-badge.test.ts` add: summary ends "right-handed"/"left-handed" (default strings unchanged). In `tests/unit/tool-card.test.ts` add: thumbnails follow confirmed handedness
- [X] T015 [US1] Create `e2e/handedness.spec.ts` with Q1–Q8 (US1-1…US1-8), Q22, Q23, Q25 using role/name selectors and `.nut`, `.string-label`, `.fret-number`, `.tag`, `.region-band` bounding boxes, `__fmFretboardEvents` and the audio log hook; include no-notice / sound-not-stopped assertions for FR-017

### Implementation for User Story 1

- [X] T016 [US1] Implement in `src/lib/fretboard/geometry.ts`: make `screenOrder` return `reversed` from `instrument.handedness`; compute the layout left-to-right then, when reversed, map every x `x' = width − x` and swap each column's `start`/`end`; add `FretboardLayout` fields `mirrored`, `labelCenter`, `board`, `strings`, `nutX` per data-model §4; make `nearestPosition` tie rule explicit (lower fret, then lower string number) (depends on T011)
- [X] T017 [US1] In `tests/unit/fretboard/geometry.test.ts` remove/replace the two placeholder `screenOrder` tests noted in T002 with the T011 table (research R-13)
- [X] T018 [US1] Implement in `src/lib/fretboard/interaction.ts`: `nutOffset`, `scrollForNutOffset`, nut-side alignment in `spanTarget`, mirrored `trailingEdgeScroll`; confirm `moveFocus` needs no logic change (reads `screenOrder`) (depends on T016, T012)
- [X] T019 [US1] Update `src/lib/fretboard/Fretboard.svelte`: replace "label column at x = 0 / nut on the left" assumptions with `layout.labelCenter`, `layout.board`, `layout.strings`, `layout.nutX`; add the anchor effect that re-applies the previous nut offset when layout `width` or `mirrored` changes (unscrolled left-handed board starts at `maxScroll`; handedness switch keeps the same frets in view; no animation; startup restore after hydration); mirror the fret-count-shrink glide with the hold spacer as a leading inline margin on the `<svg>` when mirrored (research R-06). Keep cell DOM order in fret order (nut → body) (depends on T016, T018, T013)
- [X] T020 [US1] Add the "Handedness" radio fieldset to `src/lib/shell/InstrumentPanel.svelte` after the frets stepper and before the preview, reusing the Strings group `count-option` styles (≥ 44 × 44 px, wraps at 200 % zoom), bound to `instrument.setHandedness`; labels from T009 keys (depends on T008, T009, T014)
- [X] T021 [US1] Update `src/lib/shell/InstrumentSummary.svelte` to pass `handedness` (`instrument_handedness_right` / `instrument_handedness_left`) into both summary messages (depends on T009, T014)
- [X] T022 [US1] Add TM-9 view 22 (view 6 left-handed: Triads, A major, three inversions, set 3-2-1, Full neck, 6 strings, AF-1) to `e2e/triads-tm9.spec.ts`, seeding `localStorage` `fretboard-master:prefs` = `{"version":1,"handedness":"left"}` via `page.addInitScript`; generate `tm9-view-22-{desktop,phone,phone-touch}-darwin.png` with `--update-snapshots` and review by eye (nut right, tags root → 1st → 2nd right to left, numbers below) (FR-020; needs T036 for the seed to be read)

**Checkpoint**: US1 fully functional via the panel (without persistence). Run `pnpm vitest run tests/unit/fretboard tests/unit/state tests/unit/instrument-panel.test.ts` and `pnpm playwright test e2e/handedness.spec.ts`.

---

## Phase 4: User Story 2 - Choose which string is on top (Priority: P1)

**Goal**: "Strings on top" radios (Highest / Lowest) reorder rows; fret numbers and shape tags swap edges so they are always opposite; the same string/fret/pitch is reported everywhere.

**Independent Test**: Quickstart Q9–Q12 — Lowest on top: string 6 (7 with seven strings) drawn at the top and thickest; tapping the top string at fret 0 plays E2 and reports 6:0; ArrowUp from string 5 → string 6; Triads Full neck puts fret numbers above and tags below.

### Tests for User Story 2 ⚠️ write first, must fail

- [X] T023 [P] [US2] In `tests/unit/fretboard/geometry.test.ts` add lowest-top tests: `screenOrder` rows `[n..1]`; `rowOf(layout, s).string === s` for all strings and row order equals `screenOrder.rows`; `numbersEdge` is `'bottom'` for highest-top and `'top'` for lowest-top regardless of handedness; `boardTop`/`boardBottom` offsets (`numbersRow` when numbers above); lowest-top layout = highest-top with `y ↦ boardTop + boardBottom − y` inside the board incl. double inlays at frets 12/24 (R-04; identical for 6 strings, one row different for 7); same `{(string, fret)}` set and `positionPitch` in all four combinations (SC-002, property test with fast-check); hit-testing returns the right `{string, fret}` for every cell
- [X] T024 [P] [US2] In `tests/unit/fretboard/interaction.test.ts` add: lowest-top ArrowUp from string 5 → 6, ArrowDown from 6 → 5; no wrapping at top/bottom edge in all four combinations; handedness and orientation independent
- [X] T025 [P] [US2] In `tests/unit/fretboard/fretboard.test.ts` add: string-6 row is first and has the thickest class when lowest-top, string 7 first with seven strings (FR-006); tag strip is before the `<svg>` in DOM when `numbersEdge==='bottom'` and after it when `'top'` (tags edge always opposite fret numbers); markers, arrows, hover hint and focus ring land on the row from `rowOf` (not `string − 1`)
- [X] T026 [P] [US2] In `tests/unit/instrument-panel.test.ts` add fieldset "Strings on top" with radios "Highest string on top" (checked) and "Lowest string on top": pending-only, Close discards, Confirm applies, Restore default resets, independent of Handedness
- [X] T027 [US2] Extend `e2e/handedness.spec.ts` with Q9–Q12 (US2-1…US2-6): top string fret 0 plays E2 and reports 6:0; 7 strings + lowest on top; Triads Full neck fret numbers above / tags below; ArrowUp on string 5 → 6

### Implementation for User Story 2

- [X] T028 [US2] In `src/lib/fretboard/geometry.ts`: `screenOrder.rows` = `[n..1]` for `lowest-top`; add `numbersEdge`, `boardTop`/`boardBottom` offsets, mirrored double-inlay placement for lowest-top, and exported `rowOf(layout, string)` (depends on T016, T023)
- [X] T029 [US2] In `src/lib/fretboard/Fretboard.svelte`: replace every `rows[string − 1]` lookup (drawn markers, arrows, hover hint, focus ring) with `rowOf(layout, string)`; render the tag strip before the `<svg>` for `numbersEdge === 'bottom'` and after it for `'top'`; keep tag stacking row 0 nearest the board in both cases; fret-number row on `numbersEdge` (depends on T028, T025)
- [X] T030 [US2] Add the "Strings on top" radio fieldset after the Handedness group in `src/lib/shell/InstrumentPanel.svelte`, bound to `instrument.setOrientation`; same styles/targets as T020 (depends on T020, T026)

**Checkpoint**: US1 and US2 both work independently and together (four combinations).

---

## Phase 5: User Story 3 - A screen reader follows the neck from the nut (Priority: P1)

**Goal**: In all four combinations the reading order is nut → body, names/descriptions/announcements are identical text, and nothing says "left" or "right".

**Independent Test**: Quickstart Q13 — for each combination, cells in a grid row appear in fret order in the DOM, every `aria-label` and the text description are byte-identical to the right-handed ones, and axe reports zero violations.

### Tests for User Story 3 ⚠️ write first

- [X] T031 [P] [US3] In `tests/unit/fretboard/fretboard.test.ts` add: for each of the four combinations the `aria-label` of every cell, the text description (`describeView`) and live announcements equal the right/highest-top versions; within each row cells are DOM-ordered fret 0 → N; grid rows are DOM-ordered top → bottom as drawn; no label or description matches `/\b(left|right)\b/i`
- [X] T032 [US3] Extend `e2e/handedness.spec.ts` with Q13 (US3-1…): Tab/arrow navigation announces the same accessible names in all four combinations, focus ring visible, and `@axe-core/playwright` reports zero violations per combination (FR-019, SC-007)

### Implementation for User Story 3

- [X] T033 [US3] Fix any failure from T031/T032 in `src/lib/fretboard/Fretboard.svelte` (cell iteration over fret-indexed `layout.columns` rather than sorted by x; focus order equals visual order; announcements untouched); if nothing fails, record "no change needed" in the PR notes (depends on T019, T029)

**Checkpoint**: Accessibility parity proven in all four combinations.

---

## Phase 6: User Story 4 - The settings are remembered (Priority: P2)

**Goal**: Both settings persist as optional v1 preference fields, restore on load, reset on erase and Restore default, invalid values fall back independently without notice.

**Independent Test**: Quickstart Q14–Q19 — Left + Lowest → Confirm → reload keeps both; seeded `{"version":1,"handedness":"LEFT","orientation":"lowest-top","tuning":"AF-2"}` loads right-handed, lowest-top, Half step down with no error; pre-013 record loads as before; erase → defaults.

### Tests for User Story 4 ⚠️ write first, must fail

- [X] T034 [P] [US4] Add the five fixtures from contracts/storage-format.md under `tests/unit/prefs/fixtures/` (`left-only`, `lowest-only`, `bad-handed`, `left-lowest-full`, `bad-orientation`); in `tests/unit/prefs/schema.test.ts` assert their expected results, that every pre-013 fixture still parses with right/highest-top added to expected values (none removed or edited otherwise), that `future` (`version: 7`) still yields all defaults, that `left-lowest-full` re-serializes byte-identical, and that defaults serialize with neither key (byte-identical to slice 012); add a fast-check round-trip `parsePreferences(serializePreferences(p))` equals `p` across both fields × existing arbitraries (reader rules 19–22, writer rules 15–18)
- [X] T035 [P] [US4] In `tests/unit/state/preferences-store.test.ts` add: `confirm` of a presentation change performs exactly one write containing all five instrument fields; `start` passes stored `handedness`/`orientation` to `instrument.restore`; `erase` removes the key and resets both; invalid stored value in one field keeps the other and all other fields

### Implementation for User Story 4

- [X] T036 [US4] Implement in `src/lib/prefs/schema.ts`: `handedness: v.fallback(v.picklist(['right','left']), 'right')`, `orientation: v.fallback(v.picklist(['highest-top','lowest-top']), 'highest-top')`, `Preferences` and `PreferencesPatch` gain both fields, writer emits `"handedness":"left"` / `"orientation":"lowest-top"` only when non-default, after `labels`, `version` stays 1, never throws (depends on T034)
- [X] T037 [US4] Implement in `src/lib/state/preferences.svelte.ts` and `src/lib/state/instrument.svelte.ts`: `preferences.start`/`erase` pass both fields to `instrument.restore`; `confirm` calls `preferences.remember({...all five fields})` once for any change, including presentation-only (depends on T036, T035, T008)
- [X] T038 [US4] Extend `e2e/preferences.spec.ts` with Q14–Q19 (US4-1…US4-7): reload keeps both, `LEFT` fallback, pre-013 `v1-full` loads unchanged, erase resets, storage-unavailable fault hook shows the existing notice and applies for the session, Restore default + Confirm resets to right / highest-top + other defaults (FR-011, FR-012)

**Checkpoint**: Settings survive reload; default users' stored bytes unchanged.

---

## Phase 7: User Story 5 - Works on every screen and with every instrument (Priority: P2)

**Goal**: All four combinations work from 320 to 2560 px, 6/7 strings, 12–24 frets, with only the fretboard scrolling, nut side in view when unscrolled, switching is instant, and no regression for default users.

**Independent Test**: Quickstart Q20–Q24 — at 320 px with 24 frets left-handed the page does not scroll horizontally and nut + fret 1 are visible unscrolled; changing 22 ↔ 24 frets grows the neck leftward and keeps the same frets in view; switching handedness mid-scroll keeps the same frets in view without animation.

### Tests for User Story 5 ⚠️ write first

- [X] T039 [P] [US5] In `tests/unit/fretboard/geometry.test.ts` run the invariants table over 4 combinations × {6, 7} strings × {12, 24} frets × variants {interactive, thumbnail, preview} (thumbnail/preview mirror like interactive); in `tests/unit/fretboard/interaction.test.ts` add fret-count change keeps visible frets when mirrored
- [X] T040 [US5] Extend `e2e/handedness.spec.ts` with Q20, Q21, Q24, Q26 (US5-4 motion: in each of the 4 combinations a Triads quality change major → minor moves only the third's marker — same DOM node, changed `transform` — while root and fifth markers keep the same DOM node and `transform`) across viewports 320 / 360 / 768 / 2560 px: no page horizontal scroll, touch targets ≥ 44 × 44, axe zero violations, 200 % text zoom wrap of the new radio groups
- [X] T041 [P] [US5] In `e2e/perf.spec.ts` add "handedness" cases: switching handedness or orientation updates the fretboard ≤ 100 ms (SC-006) and a left-handed 7 strings × 24 frets smooth-scroll case

### Implementation for User Story 5

- [X] T042 [US5] Fix any failure from T039–T041 in `src/lib/fretboard/geometry.ts`, `src/lib/fretboard/interaction.ts`, `src/lib/fretboard/Fretboard.svelte` and panel CSS in `src/lib/shell/InstrumentPanel.svelte` (CSS must use existing design tokens only; no hard-coded values); if nothing fails, record "no change needed" (depends on T019, T029, T030)

**Checkpoint**: All stories independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T043 [P] Write `docs/adr/0016-handedness-and-orientation-in-layout.md` (mirroring in pure layout coordinates, nut-anchored scroll offsets, presentation carried in `Instrument`, presentation-only confirm; amends ADR 0005, 0009, 0012) per research R-15
- [X] T044 [P] Add a "Complexity" note in the PR for the en-only catalogs discrepancy (research R-12); ensure no `pt.json`/`es.json` was created
- [X] T045 Run all gates: `pnpm check && pnpm lint && pnpm format:check && pnpm test:unit && pnpm build && node scripts/check-bundle-size.mjs && pnpm test:e2e`; coverage ≥ 95 % theory, ≥ 80 % overall; initial JS ≤ 90 KB gzip (constitution 1.4.0; measured 86.1 KB)
- [X] T046 Verify the boundary test (T010) passes with the final code and that `git diff --stat` shows no change under `src/lib/theory`, `src/lib/tools`, notation or audio
- [X] T047 Walk through every scenario Q1–Q26 of `specs/013-left-handed-and-orientation/quickstart.md` and confirm each is covered by an automated test or manually check it; fix gaps
- [X] T048 Review the TM-9 view 22 screenshots by eye (T022) and commit them

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)** → **Foundational (2)** blocks everything
- **US1 (3)** after Phase 2; **US2 (4)** after Phase 2 but shares `geometry.ts`, `Fretboard.svelte`, `InstrumentPanel.svelte` with US1, so run after US1 impl (T016, T019, T020)
- **US3 (5)** after US1 + US2 implementation (verifies all four combinations)
- **US4 (6)** after Phase 2 (schema independent of drawing); T037 needs T008; T022 needs T036
- **US5 (7)** after US1 + US2 + US3
- **Polish (8)** after all desired stories

### Within Phases

- Tests first, confirm failing, then implement
- T003→T004→T006→T008; T005→T006; T007→T008
- T011→T016→T018→T019; T023→T028→T029; T034→T036→T037

### Story Dependencies

- US1: needs Foundational only. **MVP.**
- US2: logically independent but sequenced after US1 for shared files.
- US3: verification of US1 + US2.
- US4: independent of drawing; can run in parallel with US1/US2 by another developer (different files).
- US5: hardening over US1–US3.

## Parallel Opportunities

- Phase 2: T003, T005, T007, T009, T010 in parallel (different files)
- US1 tests: T011, T012, T013, T014 in parallel
- US2 tests: T023, T024, T025, T026 in parallel
- US4 (T034, T035) in parallel with US1/US2 implementation
- Polish: T043, T044 in parallel

### Parallel Example: User Story 1 tests

```bash
Task: "Left-handed geometry table tests in tests/unit/fretboard/geometry.test.ts"          # T011
Task: "Nut-offset and moveFocus tests in tests/unit/fretboard/interaction.test.ts"         # T012
Task: "Mirrored rendering component tests in tests/unit/fretboard/fretboard.test.ts"       # T013
Task: "Handedness radios and summary tests in tests/unit/instrument-panel.test.ts etc."    # T014
```

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 → Phase 2 (foundation, defaults unchanged)
2. Phase 3 (US1): left-handed mirror via panel
3. **STOP and VALIDATE**: Q1–Q8, Q22, Q23, Q25; default rendering byte-identical
4. Demo

### Incremental Delivery

1. + US2 (orientation) → four combinations
2. + US3 (accessibility proof)
3. + US4 (persistence) — can ship earlier in parallel since it is independent
4. + US5 (screen/instrument hardening), then Polish

## Notes

- [P] = different files, no dependencies
- Presentation fields are read only by files on the R-08 allow-list; tools and theory never touch them
- Switching either setting never animates, never stops sound, never raises the adjustment notice
- Commit after each task or logical group (Conventional Commits)
