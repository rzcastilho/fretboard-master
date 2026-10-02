# Tasks: Triads Full Neck and All Notes Views

**Input**: Design documents from `/specs/006-full-neck-and-all-notes/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (theory, state, fretboard-model, ui, test-hooks), quickstart.md

**Tests**: INCLUDED. Constitution Principle IV (test-first) and the contracts require them. Write each test task first and confirm it fails before the implementation tasks of the same story.

**Organization**: Grouped by user story. Paths are relative to the repository root. All edits extend feature 005 modules; the only new source file is `src/lib/fretboard/tags.ts`.

## Format: `- [ ] [ID] [P?] [Story] Description with file path`

- **[P]**: different file, no dependency on an unfinished task
- **[Story]**: US1..US5 (story phases only)
- Spec refs: C1–C18 clarifications, FR-xxx requirements, R-xx research items

---

## Phase 1: Setup

- [X] T001 Run `rtk pnpm install` then the baseline gates (`rtk pnpm test`, `rtk pnpm check`) and confirm feature 005 is green before any change; note failures in the PR description, do not fix unrelated ones.
- [X] T002 [P] Add every new message key to `messages/en.json` (R-12, ~15 keys): view group label and options (`triads_view_label`, `triads_view_isolated`, `triads_view_full_neck`, `triads_view_all_notes`), tag labels (`triads_tag_root`, `triads_tag_first`, `triads_tag_second`, `triads_tag_wide_stretch`, tag accessible-name pattern "{inversion} inversion, frets {frets}"), `fretboard_tags_label`, `triads_see_all_notes`, `triads_hint_all_notes`, `triads_hint_octave_isolated`, `triads_reset`, `triads_name_no_inversion`, and the C18 description patterns for Full neck and All notes. Mirror the keys in any other locale files already in `messages/` (same English text if no translation exists). `tests/unit/no-raw-text.test.ts` must still pass.

---

## Phase 2: Foundational (blocks all user stories)

**Purpose**: theory chain, view state field, test instruments, disabled tokens. Every story depends on these.

**⚠️ CRITICAL**: No user story work starts before this phase is complete.

### Tests first

- [X] T003 [P] Write table tests in `tests/unit/theory/triad-chain.test.ts` for `inversionChain` (contracts/triads-theory-api.md): A major 3-2-1 22 frets → root 2-2-0, 1st 6-5-5, 2nd 9-10-9, root 14-14-12, 1st 18-17-17, 2nd 21-22-21; C major → 2nd 0-1-0, root 5-5-3, 1st 9-8-8, 2nd 12-13-12, root 17-17-15, 1st 21-20-20; C augmented → 2nd 1-1-0, root 5-5-4, 1st 9-9-8, 2nd 13-13-12, root 17-17-16, 1st 21-21-20 (C17, consecutive `frets[0]` deltas exactly 4); A major 7 frets → root 2-2-0, 1st 6-5-5; non-rising open pitches → `does-not-close`; A major 1 fret → `beyond`; C16 patterns (pattern = frets − min) equal on 6-5-4 and 5-4-3 for every root × quality × inversion, 8-7-5/3-2-0 → 3-2-0, 4-3-2 vs 3-2-1 differ (10-9-8 → 2-1-0 vs 5-5-3 → 2-2-0); SC-002 over 12 roots × 4 qualities × 4 sets × 22 frets equals {TM-5.3 lowest + 12k that fits} per inversion, sorted by lowest-string fret; shapes carry `functions` from `INVERSION_ORDER`. Must fail.
- [X] T004 [P] Write fast-check property tests in `tests/unit/theory/triad-chain.property.test.ts`: random strictly rising open pitches (adjacent gaps 1–11), fret count 0–30, any root/quality → sorted strictly by `frets[0]`; each shape equals `triadShape(...)` + 12·octave; set equality with ⋃ `occurrences`; every shape satisfies NFR-9.3 (rising pitch, span < 12, correct pitch classes, correct bass); `beyond` iff closes and no occurrence fits. Must fail.
- [X] T005 [P] Write transition tests in `tests/unit/state/triads-view.test.ts` for every row of data-model §3: initial `view === 'isolated'`; `setView` (invalid value and same value return the same object, other fields kept); `seeAllNotes`; `selectShape` (no-op unless `full-neck`, invalid inversion, octave not an integer in `[0, count(inv) − 1]`, already equal; otherwise sets `inversion` and `occurrence`, C3); `setInversion` still resets occurrence to 0 and is a no-op in `all-notes`; `setStringSet` no-op in `all-notes`; `octaveUp/octaveDown` no-op outside `isolated` with index kept (C4); `resetTriads` returns a state with view `isolated`; view survives `selectRoot`, `setQuality`, `switchSpelling`, `setLabelType`, `revalidate`; `equalsTriadsView` compares `view`. Must fail.

### Implementation

- [X] T006 Implement `ChainShape`, `ChainResult` and `inversionChain(open, t, fretCount)` in `src/lib/theory/triad-shape.ts` (R-01, R-02): call existing `triadShape` for each of `INVERSIONS`, expand with existing `occurrences(frets, fretCount)`, tag each entry `{ inversion, octave: k, frets, functions: INVERSION_ORDER[inversion] }`, sort strictly ascending by `frets[0]`; return `{ kind: 'chain', shapes }` (length ≥ 1), `{ kind: 'beyond' }` or `{ kind: 'does-not-close' }`. Keep imports to `./pitch` and `./triad` only. Makes T003 and T004 pass.
- [X] T007 Add the `view` field to `src/lib/state/triads-view.ts`: `TriadsView` type, `TRIADS_VIEWS`, `view` in `TriadsViewState` (initial `'isolated'`), `setView`, `seeAllNotes`, `selectShape`, `resetTriads(i)`, the new guards on `setInversion` / `setStringSet` / `octaveUp` / `octaveDown`, and `view` in `equalsTriadsView`. Do not import `prefs` or write to local storage (FR-019, C14). Makes T005 pass.
- [X] T008 [P] Add test-only fixture instruments in `src/lib/instrument/fixtures.ts`: `AF-8` (Open G: D4 B3 G3 D3 G2 D2, 22 frets) and `SHORT-7` (E4 B3 G3 D3 A2 E2, 7 frets); extend the `__fmInstrument` union in `src/app.d.ts` with `'AF-8' | 'SHORT-7'`; register them wherever `AF-1-12` is resolved (contracts/test-hooks.md, same dev/test-only availability); add cases to `tests/unit/instrument/instrument.test.ts`.
- [X] T009 [P] Add disabled-state tokens (greyed text and border, no error red) to `src/lib/styles/tokens.css` if they are not already defined, for both light and dark themes.

**Checkpoint**: `inversionChain` and view state are tested and green. Stories can start.

---

## Phase 3: User Story 1 - See how the inversions chain along a string set (Priority: P1) 🎯 MVP

**Goal**: View control with Isolated / Full neck; Full neck shows every chain shape with a tappable tag; selected inversion highlighted, others normal.

**Independent Test**: A major, set 3-2-1, 22 frets, Full neck shows exactly the six shapes with tags in order; tapping "2nd" highlights both 2nd-inversion shapes and sets the occurrence index (SC-001).

### Tests for User Story 1 ⚠️ write first, must fail

- [X] T010 [P] [US1] Write `layoutTags` tests in `tests/unit/fretboard/tags.test.ts`: no overlap per row (including gap), later tag moves to the next row, clamping at both edges (`0 ≤ x ≤ boardWidth − width`), chain order preserved, 0-item and 1-item cases, lowest fitting row chosen; plus a fast-check property test over random centres and widths for the no-overlap and clamp invariants.
- [X] T011 [P] [US1] Add `groupScrollTarget` cases to `tests/unit/fretboard/interaction.test.ts`: any group fully visible → `null`; none visible → `spanTarget` move for `groups[0]`; empty groups → `null`.
- [X] T012 [P] [US1] Add tag tests to `tests/unit/fretboard/fretboard.test.ts`: tag buttons render in `tags` order with `aria-pressed` and accessible names inside `.scroller` before the SVG; `ontag(id)` on click, Enter and Space; clicking a tag does not change `scrollLeft`; no strip and no reserved height without tags; unchanged `autoScroll.key` → no scroll; changed key → scroll; tags excluded from `describeView`.
- [X] T013 [P] [US1] Add Full neck tests to `tests/unit/state/triads-model.test.ts`: A major 3-2-1 yields six `ChainShapeView`s with ids `${inversion}:${octave}`, frets and order of C1; selected inversion highlighted, others normal, unrelated positions hidden, highlighted markers first (R-07); `model.tags` in chain order with label, accessible name ("2nd inversion, frets 9-10-9"), `pressed`, wide-stretch `detail` when span ≥ 5 (C6); `model.autoScroll` key `full-neck|set|root|quality|frets` with groups = selected shapes (R-06); control changes keep the selected inversion and view (US1-3); inversion control change highlights all shapes of that inversion and resets occurrence (US1-4); C18 Full neck description text; composition panel identical to Isolated for the selected inversion (C10); guidance when chain is `beyond` / `does-not-close` (C7, no tags row); augmented tags relative to chosen root (C17); `tagTarget(display, id)` maps ids back and returns `null` for unknown ids.
- [X] T014 [P] [US1] Add store tests to `tests/unit/state/triads-store.test.ts`: `setView` changes view; `selectTag('2nd:0')` sets inversion and occurrence (C3); tapping a tag of the already selected inversion only updates the occurrence index; no-op tag id changes nothing.

### Implementation for User Story 1

- [X] T015 [P] [US1] Create `src/lib/fretboard/tags.ts` with pure `layoutTags(items: readonly TagBox[], boardWidth: number, gap: number): readonly PlacedTag[]` per data-model §5 (same length and order as input, clamp, lowest row where it fits). Makes T010 pass.
- [X] T016 [P] [US1] Add `groupScrollTarget(layout, groups, viewport)` to `src/lib/fretboard/interaction.ts` (C15, R-06). Makes T011 pass.
- [X] T017 [US1] Extend `src/lib/fretboard/types.ts` with `FretboardTag`, `DisplayModel.tags?`, `DisplayModel.autoScroll?` and `FretboardProps.ontag?` exactly as in data-model §5 (depends on nothing but unblocks T018, T019).
- [X] T018 [US1] Update `src/lib/fretboard/Fretboard.svelte` (depends on T015–T017): in the interactive variant render `<div class="tags" role="group" aria-label={m.fretboard_tags_label()}>` inside `.scroller` before the SVG, width = `layout.width`, one `<button type="button" aria-pressed aria-label={name}>` per tag (label plus optional `detail`), positioned with `layoutTags` from the fret-column geometry, widths measured with `ResizeObserver` (fallback `--target-min`), min size `var(--target-min)`, pressed shown by fill and border weight, never changing scroll; keyed auto-scroll effect that re-runs only when `autoScroll.key` changes and uses `groupScrollTarget` with `--duration-short` (0 under reduced motion); absent `autoScroll` keeps the 005 trigger. Makes T012 pass.
- [X] T019 [US1] Extend `src/lib/state/triads-model.ts` with the Full neck derivation (depends on T006, T007, T017): `ChainShapeView`, `ShapeView` kinds `chain`, `view` and `octave.applies` fields, markers, `model.tags`, `model.autoScroll`, C18 Full neck description, guidance for non-chain results, `tagTarget`, and re-exports of `TRIADS_VIEWS` / `type TriadsView`. Makes T013 pass.
- [X] T020 [US1] Add `setView(v)` and `selectTag(id)` actions to `src/lib/state/triads.svelte.ts` per contracts/triads-state-api.md §3 (playback stops iff the state really changed through the existing rule, C13). Makes T014 pass.
- [X] T021 [US1] Add the **View** `ChoiceGroup` (Isolated / Full neck / All notes, `onview`) as the first group in `src/lib/tools/triads/TriadsControls.svelte`, and wire `onview` and `ontag={(id) => triads.selectTag(id)}` in `src/lib/tools/triads/TriadsTool.svelte`; render `WideStretchMark` only when `shape.kind === 'shown'`.
- [X] T022 [US1] Write `e2e/triads-full-neck.spec.ts` (phone 360 px + desktop): US1-1 six shapes and tags, US1-2 tap "2nd", US1-3/4 control changes, US1-5 Tab order in chain order with Enter/Space and `aria-pressed`, no page horizontal scroll, tag tap never scrolls the board, tags ≥ 44×44 px and non-overlapping at 320 px and 200 % zoom (SC-008), axe with zero violations (SC-007).

**Checkpoint**: Full neck works end to end. MVP = Phases 1–3.

---

## Phase 4: User Story 2 - See every occurrence of the three notes (Priority: P2)

**Goal**: All notes shows every root, third and fifth by function; inversion and string-set controls disabled; octave buttons disabled outside Isolated; Reset tool returns to Isolated.

**Independent Test**: A major, All notes: every A, C♯, E marked by function with labels, no tags or outline, both controls disabled; switching back re-enables them with prior values.

### Tests for User Story 2 ⚠️ write first, must fail

- [X] T023 [P] [US2] Add `disabled` tests to `tests/unit/triads/choice-group.test.ts`: `aria-disabled="true"` on group and radios, click/arrow/Home/End ignored, checked radio still focusable, Notes usage unchanged.
- [X] T024 [P] [US2] Add tests to `tests/unit/triads/triads-controls.test.ts`: View group present; inversion and string-set groups `aria-disabled` with `aria-describedby` to the `triads_hint_all_notes` hint only in All notes; values stay checked; enabled again in other views (SC-004).
- [X] T025 [P] [US2] Add tests to `tests/unit/triads/triads-secondary.test.ts` and `tests/unit/triads/composition-panel.test.ts`: octave buttons `aria-disabled` plus `triads_hint_octave_isolated` hint when `!octave.applies`; **Reset tool** button calls `onreset`; composition name uses `triads_name_no_inversion` and hides the low-to-high line when `name.inversion === null` / `lowToHigh === null` (C10).
- [X] T026 [P] [US2] Add All notes tests to `tests/unit/state/triads-model.test.ts`: every position with pc ∈ {root, third, fifth} marked normal with function marker and label, nothing else, for 12 roots × 4 qualities in standard tuning (SC-003); `controls` both false only in All notes (SC-004); no tags, no guidance, `anotherSet === null`; `autoScroll` `{ key: 'all-notes', groups: [] }`; C18 All notes description; D♯ major shows F𝄪 not G (US2-4); `AF-8` G major shows every G, B, D (TM-9 view 14). Add to `tests/unit/state/triads-store.test.ts`: `reset()` returns view to `isolated`, stops playback only if the state changed.

### Implementation for User Story 2

- [X] T027 [P] [US2] Add `disabled?: boolean` to `src/lib/tools/ChoiceGroup.svelte` (`aria-disabled`, inert interactions, still focusable, disabled tokens from T009). Makes T023 pass.
- [X] T028 [US2] Extend `src/lib/state/triads-model.ts` with the All notes derivation: `ShapeView` kind `all-notes`, all-notes markers, `controls` flags, `octave.applies`, nullable `composition.name.inversion` and `composition.lowToHigh`, C18 All notes description (depends on T019 — same file). Makes T026 pass.
- [X] T029 [US2] Add `reset()` to `src/lib/state/triads.svelte.ts` (calls `resetTriads(instrument)`, compares with `equalsTriadsView`).
- [X] T030 [P] [US2] Update `src/lib/tools/triads/TriadsControls.svelte` (depends on T027): `disabled={!display.controls.inversion}` / `stringSet` and the All notes hint. Makes T024 pass.
- [X] T031 [P] [US2] Update `src/lib/tools/triads/TriadsSecondary.svelte`: octave buttons `aria-disabled` with hint when `!octave.applies`, and a **Reset tool** button (`triads_reset`) wired through `TriadsTool.svelte` `onreset`.
- [X] T032 [P] [US2] Update `src/lib/tools/triads/CompositionPanel.svelte` for C10 (no-inversion name, hide low-to-high line). Together with T031 makes T025 pass.
- [X] T033 [US2] Write `e2e/triads-all-notes.spec.ts` (phone + desktop): US2-1..4, controls disabled and re-enabled with previous values, **Reset tool** returns to Isolated, axe zero violations on All notes, no page horizontal scroll 320–2560 px.

**Checkpoint**: Both new views work independently.

---

## Phase 5: User Story 3 - Recover from guidance (Priority: P2)

**Goal**: **See all notes** in both guidance messages; **Another set** keeps the view.

**Independent Test**: `AF-1-12` triggers beyond-fret and `NC-UNISON` triggers does-not-close; activating each action gives the expected view.

### Tests for User Story 3 ⚠️ write first, must fail

- [X] T034 [P] [US3] Add tests to `tests/unit/triads/triads-guidance.test.ts`: **See all notes** button for `beyond` and `does-not-close` when `display.seeAllNotes`; **Another set** only for does-not-close; neither in All notes; not error-coloured.
- [X] T035 [P] [US3] Add tests to `tests/unit/state/triads-model.test.ts` and `tests/unit/state/triads-store.test.ts`: `display.seeAllNotes` true iff guidance shown and view ≠ all-notes (US3-4 in Full neck too); `seeAllNotes()` changes only the view, keeping inversion, set and occurrence (C8, US3-1/2); `anotherSet()` keeps the current view (US3-3); playback stops on both (C13).

### Implementation for User Story 3

- [X] T036 [US3] Add `seeAllNotes()` to `src/lib/state/triads.svelte.ts` and the `seeAllNotes` flag to `buildTriadsModel` in `src/lib/state/triads-model.ts` (depends on T028 and T029, same files). Makes T035 pass.
- [X] T037 [US3] Add the **See all notes** button (`triads_see_all_notes`) to `src/lib/tools/triads/TriadsGuidance.svelte`, rendered in Isolated and Full neck and never in All notes; wire `onseeallnotes` in `TriadsTool.svelte`. Makes T034 pass.
- [X] T038 [US3] Add US3-1..4 scenarios to `e2e/triads-full-neck.spec.ts` and `e2e/triads-all-notes.spec.ts` using `AF-1-12` and `NC-UNISON`; assert no state in which a guidance message leaves a blank fretboard (SC-009).

---

## Phase 6: User Story 4 - Listen follows the view (Priority: P3)

**Goal**: Listen plays 24 steps in Full neck (A major 3-2-1) and three ascending notes in All notes; Isolated unchanged.

**Independent Test**: With the fake engine and clock, compare pitch sequences per view.

### Tests for User Story 4 ⚠️ write first, must fail

- [X] T039 [P] [US4] Add `lowestPositionOfPitch` tests to `tests/unit/instrument/instrument.test.ts`: lowest fret wins, ties go to the thicker (higher-numbered) string, `null` when the pitch is not on the board.
- [X] T040 [P] [US4] Add Listen tests to `tests/unit/state/triads-model.test.ts` and `tests/unit/state/triads-store.test.ts`: Full neck → 6 shapes × (3 single notes low→high + 1 chord) = 24 steps in chain order at `LISTEN_BPM` 120, repeated inversions played each time (C11); All notes → A2 s5 f0, C♯3 s5 f4, E3 s4 f2 as single notes, no chord (C12); root unreachable → `listen.enabled` false; unreachable third/fifth → reachable prefix only (plan assumption 4); playback-stop matrix for view, root, spelling, quality, inversion, set, occurrence, label type, See all notes, Another set (C13); muted playback still pulses sounding positions (US4-4); Isolated sequence unchanged.

### Implementation for User Story 4

- [X] T041 [P] [US4] Implement `lowestPositionOfPitch(instrument, pitch)` in `src/lib/instrument/instrument.ts` (data-model §2). Makes T039 pass.
- [X] T042 [US4] Make `listenSteps` and `listen.enabled` view-dependent in `src/lib/state/triads-model.ts` (depends on T028, T041): Full neck per C11, All notes per C12 (root at the lowest pitch where it occurs, third at the nearest pitch above it, fifth nearest above the third). `listen()` in `triads.svelte.ts` stays unchanged. Makes T040 pass.
- [X] T043 [US4] Add US4 scenarios to `e2e/playback.spec.ts`: step count in Full neck, three notes in All notes, stop on change, pulse while muted.

---

## Phase 7: User Story 5 - Special cases in Full neck (Priority: P3)

**Goal**: Teaching cases hold in the UI: 6-5-4 equals 5-4-3, 4-3-2 differs from 3-2-1, augmented symmetry, no message when only one or two inversions fit.

**Independent Test**: Compare displayed frets with the reference tables.

- [X] T044 [P] [US5] Add model tests to `tests/unit/state/triads-model.test.ts`: `SHORT-7` A major 3-2-1 shows only root 2-2-0 and 1st 6-5-5 with tags and no guidance, notice or empty-state text (US5-3, FR-007); C major set switches give the C16 patterns; C augmented tags relative to C (C17); a span ≥ 5 shape keeps its wide-stretch tag and is never hidden (C6).
- [X] T045 [US5] Add US5-1..3 scenarios to `e2e/triads-full-neck.spec.ts` (US5-3 with `SHORT-7`). Only behaviour already built in US1 is expected; fix defects found rather than adding new features.
- [X] T046 [US5] Add TM-9 views 6, 9 and 14 screenshot checks to `e2e/triads-tm9.spec.ts` per contracts/test-hooks.md (6: A major 3-2-1 Full neck; 9: A♭ augmented 6-5-4 Full neck, switching spelling if needed; 14: `AF-8` G major All notes).

---

## Phase 8: Polish & Cross-Cutting

- [X] T047 [P] Add view-switch and tag-tap timing checks (≤ 100 ms, FR-021, SC-006) to `e2e/perf.spec.ts`.
- [X] T048 [P] Write `docs/adr/0009-fretboard-tags-and-keyed-auto-scroll.md` (R-05, R-06): context, decision (shared tag strip inside the scroller, keyed `autoScroll`), rejected alternatives from the plan's Complexity Tracking table.
- [X] T049 Verify `Fretboard.svelte` only re-animates changed markers on view switch (keyed per position, FR-021) and that reduced motion makes scrolling instant; add a unit assertion if missing.
- [X] T050 Run all gates: `rtk pnpm test` with coverage (theory ≥ 95 %), `rtk pnpm check` (svelte-check), `rtk lint`, `rtk prettier --check`, `rtk playwright test` (phone, desktop, phone-touch, axe), check initial JS ≤ 80 KB gzip, `no-raw-text.test.ts`, and `scripts/check-no-fault-hook.mjs` on the production build.
- [X] T051 Walk through `specs/006-full-neck-and-all-notes/quickstart.md` (10-step manual walkthrough, fixture checks, 320 px / 200 % zoom / keyboard-only spot checks) and fix any mismatch.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (1)** → **Foundational (2)** → user stories → **Polish (8)**.
- Foundational blocks all stories. Inside it: T003/T004 → T006; T005 → T007; T008, T009 independent.

### Story dependencies

- **US1 (P1)**: after Foundational. Order: T010–T014 (tests, parallel) → T015, T016, T017 → T018, T019 → T020 → T021 → T022.
- **US2 (P2)**: after Foundational; shares `triads-model.ts` and `triads.svelte.ts` with US1, so do its model/store tasks (T028, T029) after T019/T020. UI parts (T027, T030–T032) are independent of US1.
- **US3 (P2)**: needs US2's model/store work (T036 after T028, T029) and US1's Full neck for US3-4.
- **US4 (P3)**: needs T028 (same file) and T041.
- **US5 (P3)**: validation only; needs US1 and T008 (`SHORT-7`, `AF-8`).

### Parallel opportunities

- Foundational tests T003, T004, T005 together; T008, T009 alongside.
- US1 tests T010–T014 together; then T015 ‖ T016.
- US2 tests T023–T026 together; T027 ‖ T030 ‖ T031 ‖ T032 after T028.
- US3 tests T034 ‖ T035. US4 tests T039 ‖ T040.
- Different developers can take US1 (fretboard + model) and US2 UI parts (ChoiceGroup, controls, secondary, composition) at the same time.

### Parallel example: User Story 1 tests

```text
Task: "layoutTags tests in tests/unit/fretboard/tags.test.ts"
Task: "groupScrollTarget cases in tests/unit/fretboard/interaction.test.ts"
Task: "tag tests in tests/unit/fretboard/fretboard.test.ts"
Task: "Full neck model tests in tests/unit/state/triads-model.test.ts"
Task: "selectTag store tests in tests/unit/state/triads-store.test.ts"
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1 Setup, Phase 2 Foundational.
2. Phase 3 (US1): stop and validate with `e2e/triads-full-neck.spec.ts` and SC-001.
3. Demo: Full neck on A major 3-2-1.

### Incremental delivery

1. Add US2 (All notes, disabled controls, Reset tool) → validate.
2. Add US3 (guidance actions) → validate (SC-009).
3. Add US4 (Listen per view) → validate.
4. Add US5 (teaching cases, TM-9 views) → Polish.

## Notes

- Commit after each task or logical group, using Conventional Commits.
- Theory stays pure: `triad-shape.ts` imports only `./pitch` and `./triad`.
- Never persist the view (no `prefs` import in state files).
- Every user-visible string comes from `messages/en.json`; note names from `src/lib/notation`.
