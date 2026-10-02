---

description: "Task list for Triads Isolated View (slice 005)"
---

# Tasks: Triads Isolated View

**Input**: Design documents from `/specs/005-triads-isolated-view/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (triads-theory-api, triads-state-api, fretboard-model, triads-ui, test-hooks), quickstart.md

**Tests**: REQUIRED. Constitution Principle I (theory merge gate) and IV (test-first), spec FR-033 and SC-008 (every acceptance scenario has an automated test). Write each test task first and watch it fail before the implementation task that follows it.

**Organization**: Grouped by user story. US1–US3 are P1, US4–US7 are P2, US8 is P3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US8, from spec.md
- All paths are relative to the repository root. Theory modules import only `./pitch` (ESLint theory boundary). All UI text goes in `messages/en.json`; note names come from `src/lib/notation`.

## Path Conventions

SvelteKit single project: `src/lib/{theory,instrument,notation,fretboard,state,tools,shell}`, unit tests in `tests/unit/<area>/`, e2e in `e2e/`.

---

## Phase 1: Setup

**Purpose**: Scaffolding and shared constants

- [X] T001 [P] Confirm the baseline is green before changes (`pnpm check && pnpm test:unit`) and that `src/routes/triads/+page.svelte` already exists; directories `src/lib/tools/triads/` and `tests/unit/triads/` are created by the first task that writes into them
- [X] T002 [P] Add the `triads_*` message keys and `interval_root` ("R") to `messages/en.json`: group labels (Root, Quality, Inversion, String set), quality names, inversion names ("Root position", "1st inversion", "2nd inversion"), name pattern `{root} {quality} — {inversion}`, four stacking phrases, low-to-high entry `{note} ({function})`, function names (root, third, fifth), `triads_sounds_as` "{written} sounds as {sounds}", suggestion "Simpler spelling: {root}", switch "Switch to {root}", symmetry statement, characteristic-note statement (♭5), "Wide stretch", `triads_beyond_fret` "This shape lies beyond fret {fret}", `triads_does_not_close` "This triad does not close on this string set with the current tuning", "Another set", "Octave up", "Octave down", "Listen", label types "Intervals" / "Note names", description summary sentences (per contracts/triads-ui.md "Text")

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: Pure theory, instrument queries, notation, renderer support, shared extractions. No story can start until this completes.

**⚠️ CRITICAL**: Theory tests (T003, T004, T005) gate every later theory change (Principle I).

### Theory (test-first)

- [X] T003 [P] Write failing table tests in `tests/unit/theory/triad.test.ts`: T1 all 68 TM-4.2 spellings (17 root spellings × 4 qualities, from `specs/autonomous/fretboard-master/11-music-theory-reference.md`), T2 TM-4.3 defaults (5 keys × 4 qualities = 20; naturals return the natural; tie-break `{pc 3, minor} → flat`, `{pc 6, major} → sharp`), T10 C augmented = C–E–G♯, plus `doubleAccidentalNotes`, `otherRootSpelling`, `choiceOf`, `effectiveRootSpelling`, `intervalsOf`, `stackingOf`
- [X] T004 [P] Write failing table tests in `tests/unit/theory/triad-shape.test.ts`: T3 all 48 TM-5.5 shapes for root C (standard tuning open pitches), T4 Drop D 6-5-4 C major root = 10-7-5 span 5 wide stretch, T5 C diminished root on 5-4-3 = 15-13-11 with `occurrences(…, 12)` = `[]` and `(…, 22)` = one entry, T9 `span` ignores fret 0 (0-1-0 → 0), does-not-close for unison/descending open pitches
- [X] T005 [P] Write failing property tests in `tests/unit/theory/triad-shape.property.test.ts` (fast-check, ≥ 1,000 runs): T6 NFR-9.3 invariants (three adjacent strings, strictly rising sounding pitch, top − bottom < 12, correct pitch classes, correct bass pitch class, frets ≥ 0), T7 non-rising open triples → `does-not-close`, T8 `occurrences` entries differ by exactly 12 on every string and all ≤ fretCount, T11 transposition of the TM-5.5 root-C shape reduced to lowest occurrence
- [X] T006 Implement `src/lib/theory/triad.ts` per contracts/triads-theory-api.md and data-model §1 (types, `QUALITIES`, `QUALITY_INTERVALS`/labels/stacking constants, `TIE_BREAK`, all functions; imports only `./pitch`) until T003 passes
- [X] T007 Implement `src/lib/theory/triad-shape.ts` per data-model §2 (`Inversion`, `INVERSIONS`, `INVERSION_ORDER`, `WIDE_STRETCH_SPAN = 5`, `triadShape` using TM-5.3 over three open pitches with does-not-close unless `open[0] < open[1] < open[2]`, `occurrences`, `span`, `isWideStretch`) until T004 and T005 pass (depends on T006)
- [X] T008 Verify theory coverage ≥ 95% lines and branches on `src/lib/theory` with `pnpm vitest run --coverage`, and that the ESLint theory boundary passes (`pnpm lint`); add missing cases to T003–T005 files if short

### Instrument, notation, renderer, shared UI

- [X] T009 [P] Write failing tests in `tests/unit/instrument/string-sets.test.ts` then implement `src/lib/instrument/string-sets.ts` (`StringSetId`, `stringSets`, `setStrings`, `setOpenPitches`, `setLabel`, `shapePositions`; valid iff integer and `3 ≤ id ≤ stringCount`; MVP `[6, 5, 4, 3]`)
- [X] T010 [P] Add test-only instruments `AF-4` (Drop D, 22 frets), `AF-1-12` (standard, 12 frets), `NC-UNISON` (E4 B3 B3 D3 A2 E2, 22 frets) to `src/lib/instrument/fixtures.ts`; extend the `__fmInstrument` union in `src/app.d.ts`; add cases to existing fixture tests in `tests/unit/instrument/` (unknown name still returns default, never throws)
- [X] T011 [P] Write failing tests in `tests/unit/notation/notation.test.ts` then add `intervalLabel(id)` to `src/lib/notation/notation.ts` (R from catalog `interval_root`; `3`, `♭3`, `5`, `♭5`, `♯5`; glyphs never `b`/`#`)
- [X] T012 [P] Write failing interval-mode cases in `tests/unit/fretboard/fretboard.test.ts`, then add `LabelMode 'interval'` and `Marker.interval?: IntervalId` to `src/lib/fretboard/types.ts` and the label rule in `src/lib/fretboard/Fretboard.svelte` (per contracts/fretboard-model.md: label from `intervalLabel`, none when absent; marker shapes and `describeView` unchanged; note mode must show F𝄪 for a double-sharp `spelling`)
- [X] T013 [P] Create `src/lib/state/listen.ts` exporting `LISTEN_BPM = 120` and `ListenStep` (moved from `src/lib/state/notes-model.ts`); update `notes-model.ts` imports; existing Notes tests must still pass unchanged
- [X] T014 [P] Extract the radiogroup from `src/lib/tools/notes/NotesActions.svelte` into `src/lib/tools/ChoiceGroup.svelte` (`role="radiogroup"`/`radio`, arrow/Home/End roving focus); `NotesActions` uses it; add `tests/unit/triads/choice-group.test.ts`; existing Notes unit and e2e tests must still pass
- [X] T015 [P] Add optional `label?: string` prop (defaulting to the existing Notes label) to `src/lib/tools/NoteSelector.svelte`; add a case to the existing NoteSelector tests under `tests/unit/notes/`

**Checkpoint**: Theory gates green; shared renderer/notation/instrument pieces ready.

---

## Phase 3: User Story 1 - See what a chord is made of (Priority: P1) 🎯 MVP

**Goal**: `/triads` opens on C major, root position, 3-2-1, interval labels, showing frets 5-5-3 and a composition panel; label switch works.

**Independent Test**: Open `/triads` with no input; fretboard and panel match SC-001; toggle labels to note names and back.

### Tests for User Story 1

- [X] T016 [P] [US1] Write failing tests in `tests/unit/state/triads-view.test.ts` for `initialTriadsView` (FR-001 defaults), `setLabelType`, `equalsTriadsView`, unchanged → same object
- [X] T017 [P] [US1] Write failing tests in `tests/unit/state/triads-model.test.ts` for guarantees M1, M2 (3 markers, `highlighted`, with `spelling` and `interval`), composition name/notes/intervals/stacking/low-to-high for default state, `labelMode` interval vs note (US1-1…US1-4)
- [X] T018 [P] [US1] Write failing component tests in `tests/unit/triads/composition-panel.test.ts` and `tests/unit/triads/triads-tool.test.ts` (default render: "C major — Root position", notes C E G with root/third/fifth marker glyphs, "R – 3 – 5", "major third + minor third", low-to-high order; label switch to Note names shows C, E, G)
- [X] T019 [P] [US1] Write e2e `e2e/triads.spec.ts` (first flows): US1-1 to US1-4 at phone 360 px and desktop, with axe zero violations

### Implementation for User Story 1

- [X] T020 [US1] Implement `src/lib/state/triads-view.ts` (state type, `initialTriadsView`, `setLabelType`, `equalsTriadsView`; remaining transitions land in later stories) per contracts/triads-state-api.md §1
- [X] T021 [US1] Implement `src/lib/state/triads-model.ts` `buildTriadsModel`: `shown` shape, markers, composition (name, notes, intervals, stacking, lowToHigh), `labelMode`, description text via `spokenNote` (data-model §5); other `ShapeView` kinds and composition extras stubbed as empty/null until their stories (depends on T020, T006, T007, T009, T011)
- [X] T022 [US1] Implement `src/lib/state/triads.svelte.ts` store (`state`, `instrument`, `display`, `setLabelType`, `activate` → `playback.note`, `resetTriadsForTests`; `apply(next)` stops playback via `playback.stop('view')` on any change) per contracts/triads-state-api.md §3 (depends on T021)
- [X] T023 [P] [US1] Create `src/lib/tools/triads/CompositionPanel.svelte` (zone D; `<section aria-labelledby>`; name, notes with marker glyphs and spoken `aria-label`s, intervals, stacking, low-to-high line)
- [X] T024 [P] [US1] Create `src/lib/tools/triads/TriadsSecondary.svelte` (zone E; label type `ChoiceGroup` Intervals / Note names; octave and Listen buttons are added by US4/US7)
- [X] T025 [US1] Create `src/lib/tools/triads/TriadsTool.svelte` wiring store → `Fretboard` (`display.model`, `onactivate → triads.activate`), `CompositionPanel`, `TriadsSecondary`; read `__fmInstrument` once on mount under `__FM_FAULT_INJECTION__` and call `triads.useInstrument` (add `useInstrument` to the store here); render it from `src/lib/shell/ToolLayout.svelte` for `tool === 'triads'` replacing `ToolPlaceholder`; update `tests/unit/tool-layout.test.ts` and `tests/unit/tool-placeholder.test.ts` if they assert the placeholder for triads (depends on T022–T024)

**Checkpoint**: US1 works alone: default C major view, labels, panel. MVP.

---

## Phase 4: User Story 2 - Choose root, quality, inversion, and string set (Priority: P1)

**Goal**: All four main controls visible; changing one updates fretboard and panel and keeps the other three.

**Independent Test**: Walk every combination and compare with TM-5.5 and the spelling table.

### Tests for User Story 2

- [X] T026 [P] [US2] Extend `tests/unit/state/triads-view.test.ts`: `selectRoot` (clears override, resets occurrence, no-op on same root), `setQuality`, `setInversion`, `setStringSet` (validates `3 ≤ id ≤ stringCount`, invalid → same object), keep/reset table of data-model §4, `revalidate`
- [X] T027 [P] [US2] Extend `tests/unit/state/triads-model.test.ts`: A major 1st inversion on 4-3-2 gives string 4 fret 11 C♯ (third), string 3 fret 9 E (fifth), string 2 fret 10 A (root); C across all 12 qualities×inversions×sets equals TM-5.5 through the model (US2-1…US2-4); every root×quality notes equal TM-4.2
- [X] T028 [P] [US2] Write `tests/unit/triads/triads-controls.test.ts` (Root, Quality, Inversion, String set groups all rendered at once; keyboard arrows move within groups; selecting fires store action; root buttons show "C♯ / D♭" style labels)
- [X] T029 [P] [US2] Extend `e2e/triads.spec.ts`: US2-1…US2-4, and "playback stops on every control change" for the four controls

### Implementation for User Story 2

- [X] T030 [US2] Add `selectRoot`, `setQuality`, `setInversion`, `setStringSet`, `revalidate` to `src/lib/state/triads-view.ts` (data-model §4)
- [X] T031 [US2] Add `selectRoot`, `setQuality`, `setInversion`, `setStringSet` to `src/lib/state/triads.svelte.ts` (each through `apply`)
- [X] T032 [P] [US2] Create `src/lib/tools/triads/TriadsControls.svelte` (zone B: Root via `NoteSelector` with `label` prop, Quality/Inversion/String set via `ChoiceGroup`; all always visible; set buttons labeled via `setLabel`); mount it in `TriadsTool.svelte` (depends on T030, T031)

**Checkpoint**: US1 + US2 independently testable.

---

## Phase 5: User Story 3 - Correct spelling of altered roots (Priority: P1)

**Goal**: Default spelling by accidental count, switch command, sounds-as lines, simpler-spelling suggestion.

**Independent Test**: For 12 roots × 4 qualities check default and switched spelling; D♯ major, D♯ augmented, B augmented, A augmented panels.

### Tests for User Story 3

- [X] T033 [P] [US3] Extend `tests/unit/state/triads-view.test.ts`: `switchSpelling` (toggles override, no-op on naturals, kept across quality/inversion/set/label/octave changes, cleared on root change; quality change without override uses the TM-4.3 default)
- [X] T034 [P] [US3] Extend `tests/unit/state/triads-model.test.ts`: M5 (`soundsAs` only double accidentals in R–3–5 order; `suggestion` per C4; `canSwitchSpelling`/`switchTo`), US3-1…US3-9 including note-name marker spelling F𝄪 for D♯ major, same pitches (shape unchanged) after switching
- [X] T035 [P] [US3] Extend `tests/unit/triads/composition-panel.test.ts`: sounds-as lines ("F𝄪 sounds as G"), two lines for D♯ augmented, none for A augmented, suggestion button "Simpler spelling: E♭" activates switch, switch command absent for naturals
- [X] T036 [P] [US3] Extend `e2e/triads.spec.ts`: US3-1…US3-9

### Implementation for User Story 3

- [X] T037 [US3] Add `switchSpelling` to `src/lib/state/triads-view.ts` and `src/lib/state/triads.svelte.ts`
- [X] T038 [US3] Fill `soundsAs` (`defaultSpelling(pitchClassOfSpelling(written))`), `suggestion`, `canSwitchSpelling`, `switchTo` in `src/lib/state/triads-model.ts` (C3, C4)
- [X] T039 [US3] Render sounds-as lines, suggestion button, and **Switch to X** command in `src/lib/tools/triads/CompositionPanel.svelte` (spoken text uses `spokenNote`)

**Checkpoint**: Spelling gate (Principle I) satisfied in UI.

---

## Phase 6: User Story 4 - Move the shape between octaves (Priority: P2)

**Goal**: Octave up/down between occurrences, disabled (not hidden) at ends.

**Independent Test**: C major root 3-2-1 → Octave up gives 17-17-15, then Octave up disabled; 1st inversion 6-5-4 has both disabled.

### Tests for User Story 4

- [X] T040 [P] [US4] Extend `tests/unit/state/triads-view.test.ts`: `octaveUp`/`octaveDown` within `0…count − 1`, no-op at ends and when count is 0, reset on root/quality/inversion/set, kept on spelling/label
- [X] T041 [P] [US4] Extend `tests/unit/state/triads-model.test.ts`: M7 and `octave` fields, shown occurrence frets +12 with same notes (US4-1…US4-4)
- [X] T042 [P] [US4] Write `tests/unit/triads/triads-secondary.test.ts` octave cases: `aria-disabled="true"`, still focusable, no error styling
- [X] T043 [P] [US4] Extend `e2e/triads.spec.ts`: US4-1…US4-4

### Implementation for User Story 4

- [X] T044 [US4] Add `octaveUp`/`octaveDown` to `src/lib/state/triads-view.ts` and `src/lib/state/triads.svelte.ts`
- [X] T045 [US4] Compute `octave { up, down, index, count }` and the shown occurrence in `src/lib/state/triads-model.ts` using `occurrences`
- [X] T046 [US4] Add **Octave down** / **Octave up** buttons (`aria-disabled`, neutral style) to `src/lib/tools/triads/TriadsSecondary.svelte`

---

## Phase 7: User Story 5 - Know how hard a shape is to play (Priority: P2)

**Goal**: "Wide stretch" text + icon for span ≥ 5; open strings ignored in span.

**Independent Test**: Inject `AF-4`; C major root 6-5-4 shows 10-7-5 and the mark; standard tuning shows none; 0-1-0 shape shows no mark.

### Tests for User Story 5

- [X] T047 [P] [US5] Extend `tests/unit/state/triads-model.test.ts`: `wideStretch` true for Drop D 10-7-5, false for every standard shape, C major 2nd inversion 3-2-1 (0-1-0) span 0 (US5-1…US5-3)
- [X] T048 [P] [US5] Write `tests/unit/triads/wide-stretch.test.ts` (text and icon present, not color alone) and extend `e2e/triads.spec.ts` with US5 via `__fmInstrument = 'AF-4'`

### Implementation for User Story 5

- [X] T049 [US5] Set `span` and `wideStretch` on the shown `ShapeView` in `src/lib/state/triads-model.ts` and add the wide-stretch sentence to the description
- [X] T050 [P] [US5] Create `src/lib/tools/triads/WideStretchMark.svelte` (text "Wide stretch" + icon, caption under the board) and render it from `TriadsTool.svelte` when `shape.wideStretch`

---

## Phase 8: User Story 6 - Understand special qualities (Priority: P2)

**Goal**: Symmetry statement for augmented; ♭5 characteristic note for diminished.

**Independent Test**: Select augmented, diminished, major, minor and read the panel.

### Tests for User Story 6

- [X] T051 [P] [US6] Extend `tests/unit/state/triads-model.test.ts` (`symmetric`, `characteristic`) and `tests/unit/triads/composition-panel.test.ts` (statement present only for the matching quality, US6-1…US6-3)
- [X] T052 [P] [US6] Extend `e2e/triads.spec.ts`: US6-1…US6-3

### Implementation for User Story 6

- [X] T053 [US6] Fill `symmetric` and `characteristic` in `src/lib/state/triads-model.ts` and render both statements in `src/lib/tools/triads/CompositionPanel.svelte`

---

## Phase 9: User Story 7 - Hear the shape (Priority: P2)

**Goal**: **Listen** plays low→mid→high then the block at calculated pitches; pulses even when muted; stops on any change.

**Independent Test**: With the injectable clock and audio context, press Listen and check four steps and pitches.

### Tests for User Story 7

- [X] T054 [P] [US7] Extend `tests/unit/state/triads-model.test.ts`: M6 `listenSteps` = `[low, mid, high, [low, mid, high]]`, empty when no shape, `listen.enabled`
- [X] T055 [P] [US7] Write `tests/unit/state/triads-store.test.ts`: `listen()` sends one `sequence` at `LISTEN_BPM` with the four steps, no-op when disabled, a second `listen()` restarts without calling `stop`, every state-changing action calls `playback.stop('view')`, `useInstrument` stops with `'instrument'`, `activate` plays a note and changes no state; use the 003 injectable clock (no real time)
- [X] T056 [P] [US7] Extend `e2e/triads.spec.ts`: US7-1 (pitches via the 003 audio test harness), US7-2 (stop on change), US7-3 (muted: markers still pulse)

### Implementation for User Story 7

- [X] T057 [US7] Build `listenSteps` and `listen.enabled` in `src/lib/state/triads-model.ts` using `positionPitch` and `ListenStep` from `listen.ts`
- [X] T058 [US7] Add `listen()` to `src/lib/state/triads.svelte.ts` (sequence at `LISTEN_BPM`; wire `pulses` into the `Fretboard` props in `TriadsTool.svelte` as Notes does)
- [X] T059 [US7] Add the **Listen** button (`aria-disabled` when no shape) to `src/lib/tools/triads/TriadsSecondary.svelte`

---

## Phase 10: User Story 8 - Honest messages when a shape cannot be shown (Priority: P3)

**Goal**: Never a blank fretboard: beyond-fret and does-not-close guidance, **Another set**.

**Independent Test**: `AF-1-12`: C diminished root 5-4-3 → "This shape lies beyond fret 12". `NC-UNISON`: default → does-not-close with **Another set** → 5-4-3 shows a shape.

### Tests for User Story 8

- [X] T060 [P] [US8] Extend `tests/unit/state/triads-model.test.ts`: M3 (beyond iff lowest max fret > fretCount, markers `[]`, octaves/listen disabled, composition populated), M4 and `nearestClosingSet` C11 order (treble step first, then bass, alternating; `null` when none), M8 description contains guidance, 40 of 576 combinations beyond fret 12
- [X] T061 [P] [US8] Write `tests/unit/triads/triads-guidance.test.ts` (text ≤ 2 lines, no error color, no dismiss control, **Another set** shown only when `anotherSet` non-null) and extend `tests/unit/state/triads-store.test.ts` for `anotherSet()`
- [X] T062 [P] [US8] Extend `e2e/triads.spec.ts`: US8-1…US8-3 via `AF-1-12` and `NC-UNISON`; guidance never covers controls

### Implementation for User Story 8

- [X] T063 [US8] Implement `beyond` and `does-not-close` `ShapeView` kinds, `nearestClosingSet`, `anotherSet`, and guidance description text in `src/lib/state/triads-model.ts`
- [X] T064 [US8] Add `anotherSet()` to `src/lib/state/triads.svelte.ts`
- [X] T065 [US8] Create `src/lib/tools/triads/TriadsGuidance.svelte` (in-board empty state, plain text, optional **Another set** button, no `role="status"`, no error styling) and render it from `TriadsTool.svelte` inside the board area when no shape is shown

---

## Phase 11: Polish & Cross-Cutting Concerns

- [X] T066 [P] Add `e2e/triads-tm9.spec.ts` with screenshot fixtures `tm9-view-7`, `-8`, `-11` (default instrument) and `-12` (`AF-4`) per contracts/test-hooks.md, one per Playwright project; commit the baselines
- [X] T067 [P] Extend `e2e/triads.spec.ts`: keyboard-only pass over every control, 320 px and 2560 px (only the fretboard scrolls horizontally), 200% text zoom, axe zero violations on default, guidance, and wide-stretch states
- [X] T068 [P] Extend `e2e/perf.spec.ts` with a triads control-change ≤ 100 ms check (FR-031, SC-003)
- [X] T069 [P] Confirm `tests/unit/no-raw-text.test.ts` passes for `src/lib/tools/triads/*`, and confirm production build contains no `__fmInstrument` (`scripts/check-no-fault-hook.mjs`)
- [X] T070 Check the initial JS budget (route-split `/triads`, ≤ 80 KB gzip) via the bundle-size check and Lighthouse CI
- [X] T071 Run the full merge gate from quickstart.md §5 (`pnpm check && pnpm lint && pnpm format:check && pnpm test:unit && pnpm build && pnpm test:e2e && pnpm lhci`) and the manual smoke table; fix findings
- [X] T072 Confirm every one of the 33 acceptance scenarios (US1–US8) maps to a named test (SC-008) and that Notes tool tests are unchanged after T013–T015

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)**: no dependencies
- **Foundational (2)**: after Setup; T006 → T007; T009–T015 are independent of each other and of the theory tasks except where noted
- **US1 (3)**: after Foundational; creates store, model, tool shell
- **US2–US8**: after US1 (they extend the same model, view, store, and tool files); order by priority US2 → US3 → US4 → US5 → US6 → US7 → US8. Stories touch different logical parts, so US4–US8 can run in parallel after US2 only if their edits to `triads-model.ts` and `triads.svelte.ts` are merged carefully
- **Polish (11)**: after the stories you ship

### Story Dependencies

- US1: foundation only. US2: needs US1 shell. US3: needs US2 (root control) for its e2e flow. US4/US5/US6/US7/US8: need US1; US8 e2e uses `NC-UNISON`/`AF-1-12` from T010; US5 uses `AF-4`.

### Within Each Story

Tests first (must fail) → view state → model → store → components → e2e green.

## Parallel Opportunities

- Foundational tests T003, T004, T005 together; then T009–T015 together alongside T006/T007
- Within each story, all test tasks marked [P] run together; component tasks in different files (e.g. T023 and T024; T032) run together

```text
# Foundational parallel launch
T003 triad.test.ts | T004 triad-shape.test.ts | T005 triad-shape.property.test.ts
T009 string-sets | T010 fixtures | T011 intervalLabel | T012 fretboard interval | T013 listen.ts | T014 ChoiceGroup | T015 NoteSelector label

# User Story 1 test launch
T016 triads-view.test | T017 triads-model.test | T018 component tests | T019 e2e
```

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 → Phase 2 (theory gates green) → Phase 3
2. **Stop and validate**: open `/triads`, check SC-001 and the quickstart smoke rows for the default view

### Incremental Delivery

1. Setup + Foundational → US1 (MVP) → US2 (full selection) → US3 (spelling) = P1 complete, release gate for theory
2. US4 → US5 → US6 → US7 (P2) each ships independently
3. US8 (P3) last; unreachable in shipped standard guitar, verified through injected instruments
4. Polish and merge gate

## Notes

- Never add a view selector, Full neck, All notes, comparison, View in CAGED, **See all notes**, or 7-string sets (FR-028a, FR-021)
- Persist nothing; no new runtime dependencies
- Commit after each task using Conventional Commits on branch `feature/005-triads-isolated-view`
