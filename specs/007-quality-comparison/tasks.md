---

description: "Task list for Triads Quality Comparison (feature 007)"
---

# Tasks: Triads Quality Comparison

**Input**: Design documents from `/specs/007-quality-comparison/`

**Prerequisites**: plan.md, spec.md, research.md (R-01…R-17), data-model.md, contracts/ (`triads-theory-api.md`, `triads-state-api.md`, `fretboard-model.md`, `triads-ui.md`), quickstart.md

**Tests**: INCLUDED. Constitution Principle IV (test-first) and the plan require table/property tests for theory, view-transition tests, and a Vitest and/or Playwright test for every acceptance scenario (see the behaviour checklist in `contracts/triads-ui.md`). Write each test first and confirm it FAILS before the implementation task that follows it.

**Organization**: Tasks are grouped by user story (US1–US6 from spec.md) so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: User story the task belongs to (US1…US6). Setup, Foundational and Polish tasks have no label
- Every task names the exact file(s) it changes

## Path Conventions

Single SvelteKit project at the repository root (plan.md "Structure Decision"): `src/lib/{theory,state,fretboard,tools/triads,styles}`, `messages/en.json`, `docs/adr/`, `tests/unit/{theory,state,fretboard,audio,triads}`, `e2e/`. Shell commands use the `rtk` prefix (project CLAUDE.md).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline check plus the catalog keys, design tokens and ADR that every story reads.

- [X] T001 Confirm a green baseline before changes: run `rtk pnpm check` and `rtk pnpm test:unit` from the repo root; record any pre-existing failures so they are not blamed on this feature
- [X] T002 [P] Add the ~19 new message keys from research R-14 to `messages/en.json` with the exact English text listed there (`triads_compare_toggle`, `triads_compare_group`, `triads_compare_listen`, `triads_compare_changed`, `triads_compare_arrow_one`/`_other`, `triads_compare_swapped`, `triads_compare_omitted_one`/`_other`, `triads_compare_toward_nut`, `triads_compare_toward_body`, `triads_compare_off_nut`, `triads_compare_off_end`, `triads_desc_compare`, `triads_desc_compare_shift`, `triads_desc_compare_move`, `triads_desc_compare_off`, `triads_desc_compare_shared_entry`, `fretboard_comparison_note`); run `rtk pnpm check` so Paraglide compiles them
- [X] T003 [P] Add the four design tokens to `src/lib/styles/tokens.css`: `--marker-dash`, `--marker-dash-gap`, `--arrow-head-size`, `--panel-column-min` (pick values consistent with the existing marker-stroke and spacing tokens; no literals may appear in components, FR-020)
- [X] T004 [P] Write `docs/adr/0010-fretboard-arrows-and-marker-identity.md` in the format of ADR 0009: record `DisplayModel.arrows`, `Marker.id` as motion identity (CSS transform transition, R-07) and `Marker.variant = 'comparison'` (R-09), with the alternatives rejected in plan.md "Complexity Tracking"

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure theory helpers, renderer types and the `compare` view-state field. Every user story depends on these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 [P] Write theory table tests in `tests/unit/theory/triad-compare.test.ts` (new) covering contract guarantees T1, T2, T5, T6, T7:
  - the SC-001 matrix: 12 roots × 3 inversions × the 4 string sets of 6-string standard tuning (plus the 7-string sets) × the 12 ordered quality pairs, checked against the expected-moves table in data-model §1;
  - TM-9 sample 10: G major 2nd inversion on 4-3-2, standard, 22 frets → occurrences `[0,0,0]`, `[12,12,12]`, `pairOccurrences` = `[1]`, comparison at k=1 `[12,12,11]`;
  - C2 spellings: D♭ minor = D♭–F♭–A♭; D♯ major vs augmented gives A♯→A𝄪;
  - T6: `comparisonFrets(f, fn, q, q)` equals `f` and `noteMoves` is `[]`;
  - T7: pure functions, frozen input not mutated
- [X] T006 [P] Write fast-check property tests in `tests/unit/theory/triad-compare.property.test.ts` (new), reusing the NFR-9.3 random-tuning generator from `tests/unit/theory/triad-shape.property.test.ts`; for every ordered quality pair assert T3 (pitches strictly rising, correct pitch classes, correct bass function, root delta 0) and T4 (`comparisonFrets − triadShape(...).frets` is the same multiple of 12 on all three strings)
- [X] T007 Implement in `src/lib/theory/triad-shape.ts` (depends on T005, T006; imports only `./pitch` and `./triad`): export `Functions3` (replace the three inline copies of the tuple type), `NoteMove` (`index`, `function: 'third'|'fifth'`, `fromFret`, `toFret`, `delta: -2|-1|1|2`), `ONE_NOTE_PARTNER` (`{major:'minor', minor:'major', diminished:'minor', augmented:'major'}`), `comparisonFrets`, `noteMoves` (only `delta ≠ 0`, low → high, never the root) and `pairOccurrences` (indexes `k` whose comparison frets all lie in `0…fretCount`); delta = `QUALITY_INTERVALS[to][fn] − QUALITY_INTERVALS[from][fn]`; make T005/T006 pass and keep the existing triad-shape/chain suites green
- [X] T008 [P] Extend `src/lib/fretboard/types.ts` per data-model §5: optional `Marker.id?: string`, `Marker.variant?: 'comparison'`, the `FretboardArrow` union (`kind: 'move'` with `id,string,fromFret,toFret,label`; `kind: 'off-board'` with `id,string,fromFret,edge: 'nut'|'end',label`), and `DisplayModel.arrows?: readonly FretboardArrow[]`; all additions optional so the Notes tool compiles unchanged (`rtk pnpm check`)
- [X] T009 Write failing view-state tests in `tests/unit/state/triads-view.test.ts` for S1 (`initialTriadsView(i).compare` is `{ on: false, quality: null }`), S7 (`resetTriads(i).compare` is `{ on: false, quality: null }`) and `equalsTriadsView` comparing `compare.on` and `compare.quality`
- [X] T010 Add `TriadsCompare` (`{ readonly on: boolean; readonly quality: Quality | null }`) and the `compare` field to `TriadsViewState` in `src/lib/state/triads-view.ts`: initial value, `resetTriads`, `equalsTriadsView`; invariant `on ⇒ quality ∉ {null, state.quality}`; not written to preferences or share links (FR-018); make T009 pass

**Checkpoint**: Theory helpers, renderer types and the `compare` state field exist. User stories can begin.

---

## Phase 3: User Story 1 - See that quality is one altered note (Priority: P1) 🎯 MVP

**Goal**: In Isolated, a **Compare** toggle and quality list overlay the current triad with a second quality of the same root, inversion and string set: shared notes once, differing notes at both frets with a dashed comparison marker, a "N fret(s)" arrow, and a two-column composition panel with the change emphasised.

**Independent Test**: Isolated, C major, root position, set 3-2-1: turn Compare on and pick minor. Two notes appear once, the third appears at two frets one apart, the comparison position has a dashed outline, and a 1-fret arrow joins them (spec US1 Independent Test). This story shows the pair at the first triad's current occurrence; octave shifting and off-board handling come in US3.

### Tests for User Story 1 ⚠️ (write first, confirm they FAIL)

- [X] T011 [P] [US1] Add view-transition tests S2, S3, S4 to `tests/unit/state/triads-view.test.ts`: `setCompare(s,true)` in `all-notes` returns `s`; turning on uses a valid remembered `compare.quality` else `ONE_NOTE_PARTNER[s.quality]`; turning off keeps `quality`; `setCompareQuality(s, s.quality)` and `setCompareQuality` while Compare is off return `s`; invalid qualities return `s` (S9)
- [X] T012 [P] [US1] Add model tests to `tests/unit/state/triads-model.test.ts`: M1 (`compare.options` is `QUALITIES` without `s.quality`, in product order; `compare.offered` false in All notes), M2 (`comparison === null` when off, in All notes, or when the first shape is `beyond`/`does-not-close`), M4 (one `variant: 'comparison'` marker per moved note; shared notes not duplicated), M5 for on-board moves (one `kind: 'move'` arrow per move with label `triads_compare_arrow_one/_other`, two arrows for pairs differing in both third and fifth, no arrow for the root), M7 (first-triad markers carry id `${scope}:first:${fn}@${shapeKey}` with and without Compare; US5-4: changing root, inversion or string set changes every first-triad and comparison marker id, changing quality keeps them), M10 (comparison spelling uses the first triad's effective root spelling), US1-1…US1-3 move directions and sizes, `composition.comparison` and `composition.changed` (`['third']` for major↔minor), C17 description (M8, accidentals spoken in full, polite single announcement)
- [X] T013 [P] [US1] Add renderer tests to `tests/unit/fretboard/fretboard.test.ts`: F6 (comparison marker has the dash attribute and keeps function fill and shape), F8 via `tests/unit/fretboard/description.test.ts` (cell name gets the `fretboard_comparison_note` suffix), F9 (move arrow drawn between the two cells with arrowhead at `toFret` and the label), F11 (mirrored layout mirrors the arrowhead), F12 (arrows in an `aria-hidden` `<g class="arrows">`), F14 (invalid string/fret arrows dropped without throwing), F15 (thumbnail ignores arrows), US1-5/US1-6 (every comparison marker has both a dashed outline and an arrow; no arrows or dashes when Compare is off)
- [X] T014 [P] [US1] Add composition tests to `tests/unit/triads/composition-panel.test.ts`: two columns when `composition.comparison` is non-null; changed intervals and notes are `<strong>` with the visible `triads_compare_changed` tag in both columns; dashed swatch is `aria-hidden`; FR-5.12 and FR-5.13 notes appear in the column of the quality they concern; single column when no comparison
- [X] T015 [P] [US1] Create `tests/unit/triads/triads-compare.test.ts`: component not rendered when `display.compare.offered` is false; toggle has `aria-pressed` and name `triads_compare_toggle`; when on, a radio `ChoiceGroup` named `triads_compare_group` lists `compare.options` with the current comparison checked; list never contains the current quality; Tab order toggle → list; focus returns to the toggle when Compare is turned off from inside the list
- [X] T016 [P] [US1] Add store tests to `tests/unit/state/triads-store.test.ts`: `setCompare(on)` and `setCompareQuality(q)` update the display, go through `apply()` (A1: any real change calls `playback.stop('view')`), and are no-ops when nothing changes

### Implementation for User Story 1

- [X] T017 [US1] Implement `setCompare(s, on, i)` and `setCompareQuality(s, q, i)` in `src/lib/state/triads-view.ts` per data-model §2 and rules S2–S4, S9 (clamp `occurrence` to `occurrenceCount`; no pair-aware counting yet); make T011 pass
- [X] T018 [US1] Extend `buildTriadsModel` in `src/lib/state/triads-model.ts` (Isolated only in this story): add `compare` (`offered`, `on`, `quality`, `options`), `comparison` (`ComparisonView` with `spelling = spellTriad(firstRootSpelling, quality)` and one `ComparisonPair` built from `comparisonFrets`/`noteMoves` at the first triad's current occurrence, `shifted: false`, `fits: true`), first-triad marker ids `${scope}:first:${fn}@${shapeKey}` (always, M7), dashed `variant: 'comparison'` markers for moved on-board notes, `kind: 'move'` arrows with plural labels chosen by `count === 1`, `composition.comparison`/`composition.changed`, and the C17 description from the R-12 catalog fragments with `spokenNote`; make T012 pass
- [X] T019 [US1] Add `setCompare(on)` and `setCompareQuality(q)` to `src/lib/state/triads.svelte.ts`, both through `apply()`; make T016 pass
- [X] T020 [P] [US1] Update `src/lib/fretboard/Fretboard.svelte`: add the `comparison` marker class (function fill and shape kept; stroke `var(--color-text)` with `stroke-dasharray: var(--marker-dash) var(--marker-dash-gap)`; `prefers-contrast: more` uses `--marker-stroke`/`CanvasText`) and an `aria-hidden` `<g class="arrows">` layer between markers and the focus ring that draws `kind: 'move'` arrows from `layout.columns` (line between cell centres shortened by the marker radius, arrowhead `--arrow-head-size` at `toFret`, label above), dropping invalid arrows and ignoring arrows in the thumbnail variant; colours only from `--color-text`/`--marker-stroke`; make T013 renderer tests pass
- [X] T021 [P] [US1] Update `src/lib/fretboard/description.ts` so `positionName` appends the `fretboard_comparison_note` suffix for comparison markers (F8)
- [X] T022 [P] [US1] Update `src/lib/tools/triads/CompositionPanel.svelte`: when `composition.comparison` is non-null render two columns with grid `repeat(auto-fit, minmax(min(100%, var(--panel-column-min)), 1fr))` so they stack at narrow widths; wrap changed intervals/notes in `<strong>` plus the visible `m.triads_compare_changed()` tag in both columns; add the `aria-hidden` dashed swatch (built from the dash tokens) to the comparison heading; keep symmetry/characteristic notes in their quality's column; make T014 pass
- [X] T023 [P] [US1] Create `src/lib/tools/triads/TriadsCompare.svelte` (zone E): rendered only when `display.compare.offered`; **Compare** toggle button (`aria-pressed`, `m.triads_compare_toggle()`); when on, a `ChoiceGroup` (`m.triads_compare_group()`, options from `display.compare.options` labelled with `qualityName`, current comparison checked); 44×44 px targets, standard focus-ring tokens; props `onsetcompare`, `oncomparequality`; make T015 pass
- [X] T024 [US1] Wire `TriadsCompare` into `src/lib/tools/triads/TriadsTool.svelte` next to the fretboard (zone E, never covering it) with `onsetcompare={triads.setCompare}` and `oncomparequality={triads.setCompareQuality}`; keep the tool simple when Compare is off; make `tests/unit/triads/triads-tool.test.ts` pass (add a case for the Compare control in Isolated)
- [X] T025 [US1] Create `e2e/triads-compare.spec.ts` (new) with the US1 flows on phone 360 px and desktop: C major 3-2-1 compare minor (one note at two frets, dashed, 1-fret arrow toward the nut), minor vs diminished (fifth −1), major vs augmented (fifth +1), list excludes the current quality, Compare off restores the single triad, grayscale screenshot (not by colour alone, US1-6), two-column panel, and an axe check with Compare on (zero violations)

**Checkpoint**: US1 is fully functional and independently testable in Isolated. This is the MVP.

---

## Phase 4: User Story 2 - Compare in the Full neck view (Priority: P2)

**Goal**: In Full neck, every chain shape is overlaid in place with its comparison counterpart; Compare survives view switches and is hidden (paused, not discarded) in All notes.

**Independent Test**: Full neck, A major on set 3-2-1 with Compare on minor: every displayed shape shows one note at two positions with a 1-fret arrow and the other notes once (spec US2 Independent Test). Off-board arrows for shapes whose comparison note leaves the board are added in US3 (C8).

### Tests for User Story 2 ⚠️

- [X] T026 [P] [US2] Add Full-neck tests to `tests/unit/state/triads-model.test.ts`: M6 (`comparison.pairs.length === shape.shapes.length`; the chain, tags and auto-scroll key are identical with Compare on and off; no shape added, hidden or shifted), per-shape marker ids `${chainShapeId}:first:${fn}@${shapeKey}` and `${chainShapeId}:cmp:${fn}@${shapeKey}` (US5-4: a root or string-set change in Full neck changes every id although the chain shape ids stay the same), and M1/M2 behaviour in All notes (`offered: false`, `comparison: null`)
- [X] T027 [P] [US2] Add S6 to `tests/unit/state/triads-view.test.ts` (`selectRoot`, `switchSpelling`, `setInversion`, `setStringSet` and `setView` never change `compare`; Isolated → Full neck → All notes → back restores the same comparison) and a case to `tests/unit/triads/triads-tool.test.ts` (Compare control and Listen-to-comparison hidden in All notes)

### Implementation for User Story 2

- [X] T028 [US2] In `src/lib/state/triads-model.ts` `fullNeck()`: give every `ChainShapeView` a `ComparisonPair` (scope = chain shape id `${inversion}:${octave}`) computed with `comparisonFrets`/`noteMoves` on that shape's own frets; emit dashed markers (id `${scope}:cmp:${fn}@${shapeKey}`) and move arrows per shape with the emphasis of its pair; first-triad marker ids use the same `@${shapeKey}` suffix (M7); do not filter or shift shapes; make T026 pass
- [X] T029 [US2] Make the Compare control hidden and `comparison` null in All notes without clearing state (`display.compare.offered = view !== 'all-notes'`) in `src/lib/state/triads-model.ts`, and make `src/lib/tools/triads/TriadsTool.svelte` render nothing for it there; make T027 pass
- [X] T030 [US2] Add Full neck US2 flows to `e2e/triads-compare.spec.ts`: A major vs minor on 3-2-1, every shape shows one note at two positions with a 1-fret arrow, tags and auto-scroll unchanged, Compare survives Isolated → Full neck, hidden in All notes, restored on return; axe zero violations on Full neck with Compare on

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Handle octave and fretboard limits (Priority: P2)

**Goal**: Both triads always share an octave. In Isolated, a pair is shown one octave up when the comparison note would fall below the open string (G major vs minor, 2nd inv., 4-3-2: 12-12-12 and 12-12-11). When no octave fits, the first triad stays complete and each missing comparison note gets a labelled off-fretboard arrow, in Isolated and Full neck.

**Independent Test**: Compare G major with G minor, 2nd inversion, set 4-3-2, standard tuning: 12-12-12 and 12-12-11 with a 1-fret arrow on string 2 (spec US3 Independent Test).

### Tests for User Story 3 ⚠️

- [X] T031 [P] [US3] Add S8 to `tests/unit/state/triads-view.test.ts`: with Compare on in Isolated, `octaveUp`/`octaveDown`/`revalidate` step through pair occurrences; with no pair occurrence they step through first-triad occurrences (C7); `setCompare` and `setCompareQuality` clamp `occurrence` (to the last pair occurrence when turning on or changing quality, to the last first-triad occurrence when turning off); quality, root, inversion and set changes still reset it to 0
- [X] T032 [P] [US3] Add model tests to `tests/unit/state/triads-model.test.ts`: M3 (Isolated pair at `pairOccurrences[s.occurrence]`, else first-triad occurrence `s.occurrence` with `fits: false`), `shifted` true only when occurrence 0 had no pair and not when the user pressed Octave up (R-15), G major 2nd inv. 4-3-2 → 12-12-12 / 12-12-11 with a 1-fret arrow on string 2, M5 off-board arrows (`edge` `'nut'` when `toFret < 0`, `'end'` when `toFret > fretCount`, label from the notation layer), fixtures `SHORT-7` (B♭ off the nut) and `AF-1-12` (E♯ at fret 13 → off-end), `AF-8` Open G (exactly one note moves −1), `NC-UNISON` (guidance shown, no comparison, Compare still on), Full neck G 4-3-2: 0-0-0 shape has an off-nut B♭ arrow and the 12-12-12 shape has minor at 12-12-11 with a 1-fret arrow, same octave always (US3-3), `triads_desc_compare_shift` and `triads_desc_compare_off` wording
- [X] T033 [P] [US3] Add off-board arrow tests to `tests/unit/fretboard/fretboard.test.ts`: F10 (line from the `fromFret` marker to the board edge, arrowhead at the edge, note name beside it, `edge: 'nut'` toward the open-string side and `edge: 'end'` past the last fret column), F11 (mirrored layout flips them), F14 (invalid off-board arrows dropped)

### Implementation for User Story 3

- [X] T034 [US3] Make `occurrenceCount` pair-aware in `src/lib/state/triads-view.ts` using `pairOccurrences` (Compare on, Isolated, at least one pair fits → pair count; otherwise the first-triad count) and make `setCompare`/`setCompareQuality` clamp as in T031; `octaveUp`/`octaveDown`/`revalidate` pick it up unchanged; make T031 pass
- [X] T035 [US3] In `src/lib/state/triads-model.ts`: choose the Isolated pair per M3, set `shifted` and `fits`, split `moves` into on-board and `offBoard` entries (`{ move, edge, spelling }`) for Isolated and for every Full-neck pair, emit `kind: 'off-board'` arrows labelled with `noteLabel(spelling)`, and extend the C17 description with the shift and off-board fragments; make T032 pass
- [X] T036 [US3] Draw `kind: 'off-board'` arrows in `src/lib/fretboard/Fretboard.svelte` from `layout.columns` (line from the `fromFret` marker to the edge of that string, arrowhead `--arrow-head-size`, label beside it, orientation and handedness via `geometry.screenOrder` only); make T033 pass
- [X] T037 [US3] Add US3 flows to `e2e/triads-compare.spec.ts`: G major 2nd inv. 4-3-2 → 12-12-12 / 12-12-11 with arrow on string 2; fixture `SHORT-7` off-nut B♭ arrow; fixture `AF-1-12` off-end E♯ arrow; Full neck G 4-3-2 shows the off-nut B♭ arrow on the 0-0-0 shape and the 1-fret arrow on the 12-12-12 shape; `NC-UNISON` shows guidance with Compare still on
- [X] T038 [US3] Add TM-9 sample 10 (G major vs minor, 2nd inversion, set 4-3-2) as a Playwright screenshot test in `e2e/triads-tm9.spec.ts` and generate its baseline under `e2e/triads-tm9.spec.ts-snapshots/`

**Checkpoint**: US1–US3 work; no comparison ever leaves a blank or half-drawn fretboard (SC-004).

---

## Phase 6: User Story 4 - Keep the comparison when the root changes (Priority: P2)

**Goal**: Compare is a view mode. Changing root, inversion or string set recalculates it; changing the current quality to the comparison quality swaps the two and shows a one-line non-blocking notice.

**Independent Test**: G major vs G minor, 2nd inversion, 4-3-2; change the root to A and see A major vs A minor with Compare still on (spec US4 Independent Test).

### Tests for User Story 4 ⚠️

- [X] T039 [P] [US4] Add S5 to `tests/unit/state/triads-view.test.ts`: `setQuality(s, q)` with `s.compare.on && q === s.compare.quality` returns `quality: q, compare.quality: s.quality` (swap), and any other quality change keeps `compare.quality`
- [X] T040 [P] [US4] Add A2, A5 to `tests/unit/state/triads-store.test.ts`: the swap sets `notice = { kind: 'compare-swapped', quality }`, any other applied transition clears `notice`, `dismissNotice()` clears it, `reset()` clears it
- [X] T041 [P] [US4] Add tests to `tests/unit/triads/triads-tool.test.ts`: `Notice` renders `triads_compare_swapped({ quality: qualityName(q) })` for `compare-swapped` (one line, dismissible, `role="status"`, not error-red), dismissal calls `dismissNotice`, and the list still excludes the new current quality; add US4-1 and US4-3 model cases (root, inversion and set changes recalculate with correct spelling, EC-5.9) to `tests/unit/state/triads-model.test.ts`

### Implementation for User Story 4

- [X] T042 [US4] Implement the swap in `setQuality` in `src/lib/state/triads-view.ts` (keep `occurrence = 0`); confirm `selectRoot`, `switchSpelling`, `setInversion`, `setStringSet` leave `compare` unchanged; make T039 pass
- [X] T043 [US4] Add the store-level `notice` state (`{ kind: 'compare-swapped'; quality } | { kind: 'compare-omitted'; notes } | null`), the `notice` getter and `dismissNotice()` to `src/lib/state/triads.svelte.ts`; set the swap notice in `setQuality` when `next.compare.on && next.compare.quality === prev.quality && next.quality === prev.compare.quality`; clear on the next applied transition and in `reset()`; make T040 pass
- [X] T044 [US4] Render the notice in `src/lib/tools/triads/TriadsTool.svelte` with the existing `src/lib/shell/Notice.svelte` (`compare-swapped` → `m.triads_compare_swapped({ quality: qualityName(q) })`; `ondismiss` → `triads.dismissNotice`); make T041 pass
- [X] T045 [US4] Add US4 flows to `e2e/triads-compare.spec.ts`: root G → A keeps Compare and recalculates; current quality → comparison quality swaps and shows "Now comparing with major"; inversion and string-set changes recalculate

**Checkpoint**: US1–US4 work independently.

---

## Phase 7: User Story 5 - Watch only the changing note move (Priority: P3)

**Goal**: On a quality or comparison-quality change, with or without Compare, only the changing markers slide (≤ 300 ms); unchanged markers keep their DOM node. Turning Compare on or off fades only comparison markers and arrows. Everything is instant under reduced motion.

**Independent Test**: Show a major triad, change the quality to minor: only the third's marker moves; the root and fifth nodes are not re-created (spec US5 Independent Test).

### Tests for User Story 5 ⚠️

- [X] T046 [P] [US5] Add motion tests to `tests/unit/fretboard/fretboard.test.ts`: F1 (keyed loop uses `mk.pulse?.id ?? mk.id ?? positionKey`; markers without an id behave as today, so Notes is unchanged), F2 (same id, new fret → same DOM node with a changed `transform`), F3 (unchanged id, position and function → same node, same transform), F4 (reduced-motion token `0s`), F5 (comparison markers and arrows fade using `tokenDuration('--duration-short')`, 0 under reduced motion; arrows of a moved comparison fade in after a delay equal to that duration), US5-2 (a comparison-quality change slides only the changed comparison notes), US5-4 (when every marker id changes, as on a root, inversion or string-set change, the old nodes are removed and new nodes are created at the new positions with no `transform` transition from the old cells)

### Implementation for User Story 5

- [X] T047 [US5] In `src/lib/fretboard/Fretboard.svelte`: key the marker `{#each}` on `mk.pulse?.id ?? mk.id ?? key`; move marker positioning from the SVG `transform` attribute to `style:transform="translate(xpx, ypx)"` with `transition: transform var(--duration-short) var(--ease-standard)`; generalise `scrollDuration()` into `tokenDuration('--duration-short')` (0 under `prefers-reduced-motion`) and use Svelte `fade` for comparison markers and arrows with the arrow delay from F5; no hard-coded durations; make T046 pass and keep every existing fretboard test green
- [X] T048 [US5] Add motion flows to `e2e/triads-compare.spec.ts`: major → minor with Compare off, only the third's `data-key` node changes position and the root and fifth nodes are stable; with `page.emulateMedia({ reducedMotion: 'reduce' })` the change is instant; US5-4: a root change (and a string-set change) re-creates every marker node, so no `data-key` node from before the change is still attached and none slides

**Checkpoint**: US1–US5 work independently.

---

## Phase 8: User Story 6 - Listen to the comparison (Priority: P3)

**Goal**: **Listen to comparison** (shown only while Compare is on, never in All notes) plays the first triad as a block, a 500 ms rest, then the comparison triad as a block at 120 bpm; omitted off-board notes are named in a one-line notice; any listed change stops playback.

**Independent Test**: With a comparison on, activate Listen to comparison and verify two blocks with a pause between, at the displayed pitches (spec US6 Independent Test).

### Tests for User Story 6 ⚠️

- [X] T049 [P] [US6] Add to `tests/unit/audio/schedule.test.ts` (R-10, quickstart §4): `planRequest({ kind: 'sequence', steps: [[a,b,c], [], [d,e,f]], bpm: 120 })` returns two planned steps with onsets 0 and 1000, durations 500, marks 0–500 and 1000–1500 ms, so a later refactor cannot compact the rest away
- [X] T050 [P] [US6] Add M9 to `tests/unit/state/triads-model.test.ts`: `listenComparison.steps` is `[first, [], cmpOnBoard]`; `omitted` lists the off-board comparison spellings; in Full neck it uses the shape with `inversion === s.inversion && octave === s.occurrence`, else the lowest shape of that inversion (C13); `enabled` is false when Compare is off, in All notes, or when there is no shape
- [X] T051 [P] [US6] Add A1, A3, A4 to `tests/unit/state/triads-store.test.ts` with the injectable fake engine and clock: `listenComparison()` calls `playback.sequence(steps, LISTEN_BPM, instrument)`; it does nothing when `!enabled`; omitted notes set `notice = { kind: 'compare-omitted', notes }`; plain `listen()` still plays only the first triad; changing root, spelling, quality, comparison quality, inversion, set, view or Compare state stops playback
- [X] T052 [P] [US6] Add to `tests/unit/triads/triads-secondary.test.ts`: **Listen to comparison** (`triads_compare_listen`) rendered after **Listen** only when `display.compare.on && display.compare.offered`, `aria-disabled` when `!listenComparison.enabled`, hidden when Compare is off or in All notes (US6-4); add `compare-omitted` notice tests to `tests/unit/triads/triads-tool.test.ts` (`triads_compare_omitted_one/_other` with the note list from `noteLabel`)

### Implementation for User Story 6

- [X] T053 [US6] Add `listenComparison: { enabled, steps, omitted }` to `buildTriadsModel` in `src/lib/state/triads-model.ts` per data-model §4 and rules M9/C13; make T049 and T050 pass (no change to `src/lib/audio/` expected: the engine already skips empty steps)
- [X] T054 [US6] Add `listenComparison()` to `src/lib/state/triads.svelte.ts` through `apply()`, reuse the notice state from T043 for `compare-omitted`; make T051 pass
- [X] T055 [US6] Add the **Listen to comparison** button to `src/lib/tools/triads/TriadsSecondary.svelte` and wire `onlistencomparison` and the `compare-omitted` notice through `src/lib/tools/triads/TriadsTool.svelte`; Tab order Compare → list → Listen → Listen to comparison; make T052 pass
- [X] T056 [US6] Add Listen to comparison flow to `e2e/playback.spec.ts`: block, rest, block with the 500 ms pause, sync pulses on displayed markers, `SHORT-7` fixture plays the major block then only D and G with the one-line B♭ notice, changing any control during playback stops it

**Checkpoint**: All six user stories work independently.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Performance, accessibility, responsiveness, i18n and final gates.

- [X] T057 [P] Add "Compare on" and "comparison-quality change" timings under the existing 100 ms budget to `e2e/perf.spec.ts` (FR-021, SC-007)
- [X] T058 [P] Add responsive and accessibility checks to `e2e/triads-compare.spec.ts`: 320 px width and 200 % text zoom (columns stack, no truncation, only the fretboard scrolls horizontally), keyboard-only walkthrough (Space on the toggle, arrow keys in the list, visible focus, targets ≥ 44×44 px), left-handed mode mirrors arrows (FR-2.6), axe zero violations on every comparison state (SC-006)
- [X] T059 [P] Verify `tests/unit/shell/no-raw-text.test.ts` and `tests/unit/shell/reserved-colors.test.ts` cover the new `TriadsCompare.svelte` and arrows (no literal strings, no root/third/fifth colours reused); extend them if the new file or `Fretboard.svelte` additions are not picked up
- [X] T060 Run the full gates from quickstart.md §1: `rtk pnpm lint` (theory import boundary), `rtk pnpm check`, `rtk pnpm test:unit -- --coverage` (theory ≥ 95 % lines/branches, overall ≥ 80 %), `rtk pnpm test:e2e` for the four affected specs; confirm initial JS stays ≤ 80 KB gzip (expected growth < 2 KB)
- [X] T061 Walk quickstart.md §2 (steps 1–12) and §3 (fixtures `SHORT-7`, `AF-1-12`, `AF-8`, `NC-UNISON`) against `pnpm dev`; fix any deviation found

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies; T002, T003, T004 are parallel after or beside T001
- **Foundational (Phase 2)**: depends on Setup (T002 keys and T003 tokens are read later, T008 types needed by US1) and BLOCKS all user stories
- **User Stories (Phases 3–8)**: all depend on Foundational completion
- **Polish (Phase 9)**: depends on the stories you want shipped

### User Story Dependencies

- **US1 (P1)**: starts after Foundational; no dependency on other stories. MVP
- **US2 (P2)**: after Foundational; builds on US1's model, markers and arrows (T018, T020) for per-shape pairs; independently testable in Full neck
- **US3 (P2)**: after US1 (extends T017, T018, T020); its off-board arrows also complete the Full-neck C8 example from US2, so run US3 after US2 for that e2e (T037)
- **US4 (P2)**: after US1; independent of US2/US3 (T043's notice state is reused by US6)
- **US5 (P3)**: after US1 (needs first-triad marker ids from T018 and the comparison markers/arrows from T020); independent otherwise
- **US6 (P3)**: after US1 and US4's notice state (T043); the omitted-notes case needs US3's off-board moves for its e2e (T056 `SHORT-7`)

### Within Each Story

- Tests first and failing, then implementation
- Theory → view state → model → store → renderer/components → e2e
- Tasks that edit the same file (`triads-model.ts`, `triads-view.ts`, `triads.svelte.ts`, `Fretboard.svelte`, `TriadsTool.svelte`, `e2e/triads-compare.spec.ts`) are NOT marked [P] against each other and run in the order listed

### Parallel Opportunities

- Setup: T002, T003, T004
- Foundational: T005 ∥ T006 ∥ T008, then T007; T009 can be written alongside T005/T006
- US1 tests: T011–T016 together; US1 implementation: T020, T021, T022, T023 together once T018 is done
- US2 tests T026 ∥ T027; US3 tests T031 ∥ T032 ∥ T033; US4 tests T039 ∥ T040 ∥ T041; US6 tests T049 ∥ T050 ∥ T051 ∥ T052
- Polish: T057 ∥ T058 ∥ T059

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together (each in its own file, except T011/T016 which share files with other stories' tests):
Task: "T012 triads-model tests in tests/unit/state/triads-model.test.ts"
Task: "T013 renderer tests in tests/unit/fretboard/fretboard.test.ts and description.test.ts"
Task: "T014 composition tests in tests/unit/triads/composition-panel.test.ts"
Task: "T015 component tests in tests/unit/triads/triads-compare.test.ts"

# After T018 (model) is done, launch the UI pieces together:
Task: "T020 dashed variant + move arrows in src/lib/fretboard/Fretboard.svelte"
Task: "T021 comparison suffix in src/lib/fretboard/description.ts"
Task: "T022 two-column panel in src/lib/tools/triads/CompositionPanel.svelte"
Task: "T023 new src/lib/tools/triads/TriadsCompare.svelte"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup
2. Phase 2: Foundational (theory helpers, types, state field)
3. Phase 3: US1
4. **STOP and VALIDATE**: run the US1 Independent Test and `e2e/triads-compare.spec.ts` (US1 flows + axe)
5. Demo: Isolated Compare for qualities whose pair fits at the current occurrence

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → validate → MVP
3. US2 (Full neck) → validate
4. US3 (octave and board limits) → validate; TM-9 sample 10 baseline
5. US4 (root change, swap notice) → validate
6. US5 (motion) → validate
7. US6 (Listen to comparison) → validate
8. Polish (Phase 9) → full gates

### Parallel Team Strategy

After Foundational: Developer A takes US1 then US3; B takes US4 and US6 once US1's model lands; C takes US5 (renderer only) once US1's markers land; US2 follows US1's model task.

---

## Notes

- [P] = different files, no dependency on incomplete work
- Commit after each task or logical group (Conventional Commits)
- Verify each test fails before implementing
- The first-triad marker ids (M7) are emitted in US1 (T018) even with Compare off, so US5's slide works without Compare (FR-013)
- Theory stays pure: `triad-shape.ts` imports only `./pitch` and `./triad` (lint boundary)
- Avoid: literals for dash, gap, arrowhead or column widths (use the four new tokens); drawing arrows outside `Fretboard.svelte`; persisting Compare state to storage or share links
