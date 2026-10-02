---

description: "Task list for the Fretboard Notes Tool (004)"
---

# Tasks: Fretboard Notes Tool

**Input**: Design documents from `/specs/004-fretboard-notes-tool/`

**Prerequisites**: plan.md, spec.md, research.md (R-01–R-15), data-model.md, contracts/ (notes-state-api, fretboard-model, notes-ui, test-hooks), quickstart.md

**Tests**: INCLUDED. Constitution Principle IV and plan.md require test-first work for logic (instrument queries, notation helpers, `notes-view`, widen, `notes-model`), tested behavior for UI, and every acceptance scenario automated. Write each test task first, run it, and see it FAIL before its implementation task.

**Organization**: Grouped by user story. US1 and US2 are both P1 (US1 is the MVP; US2 builds on the same foundation and is independently testable).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US5 from spec.md. Setup, Foundational, and Polish phases carry no story label.
- Tasks touching the same file are NOT marked [P] against each other.

## Path Conventions

Single SvelteKit project at the repository root (plan.md "Structure Decision"): `src/lib/{instrument,notation,fretboard,state,shell,tools,styles}`, `src/routes/notes`, `messages/`, `tests/unit/`, `e2e/`, `scripts/`, `docs/adr/`.

Quoted constraints from data-model.md are repeated verbatim in tasks so they are not left to implementation-time discretion.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Decision record and import boundaries that every later module relies on.

- [X] T001 [P] Write ADR `docs/adr/0008-tool-view-state-and-display-model.md`: tool view state is a pure `notes-view.ts` + a runes singleton store (R-01); display model is a pure `buildNotesModel` (R-02); no generic tool store (Principle X). Follow the format of `docs/adr/0005-fretboard-as-single-svg-aria-grid.md`.
- [X] T002 [P] Add ESLint boundary blocks to `eslint.config.js` per contracts/notes-state-api.md §1: `src/lib/tools/**` restricts `$lib/theory/*` and `$lib/audio/engine` (mirror the existing shell rule); `src/lib/state/notes-view.ts` restricts `svelte`, `$lib/paraglide/*`, and DOM globals.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Types, tokens, the state skeleton, and an empty `NotesTool` mounted on `/notes`. No user story can start before this is done.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Extend `src/lib/fretboard/types.ts` exactly per data-model.md §7: `LabelMode = 'note' | 'octave' | 'none'`, `OctaveTone = 1 | 2 | 3 | 4 | 5 | 6 | 7`, optional `Marker.label?: boolean`, `Marker.tone?: OctaveTone`, `Marker.octaveBadge?: boolean`, optional `DisplayModel.region?: { start; end }`, `DisplayModel.hoverHint?: boolean`, `DisplayModel.description?: string`. All fields optional so `ToolPlaceholder` and `src/lib/fretboard/fixtures.ts` compile unchanged. Types only; no renderer behavior yet.
- [X] T004 [P] Extend `tests/unit/reserved-colors.test.ts` FIRST (must fail): assert `--color-note-highlight`, `--color-note-highlight-label`, `--octave-tone-1` … `--octave-tone-7`, and `--region-band` are defined in `src/lib/styles/tokens.css` for light, dark, and `prefers-contrast: more`, and that none equals or references `--color-root`, `--color-third`, or `--color-fifth`.
- [X] T005 Add tokens to `src/lib/styles/tokens.css` (makes T004 pass): `--color-note-highlight`, `--color-note-highlight-label`, `--octave-tone-1…7` (fixed lightness ramp of the accent hue, R-04), `--region-band`, `--marker-badge-size`, each with light, dark, and `prefers-contrast: more` variants. Visual values only as tokens.
- [X] T006 [P] Write `tests/unit/state/notes-view.test.ts` (core part, FIRST, must fail): `initialNotesView(instrument)` equals FR-001 (`selection: []`, `labelType: 'name'`, `background: 'naturals'`, `hideNames: false`, `activeStrings` = all `1..stringCount`, `region: { start: 0, end: fretCount }`, `card: null`) for the default instrument and a 7-string instrument; `equalsNotesView` true/false cases.
- [X] T007 Create `src/lib/state/notes-view.ts` (makes T006 pass): export types `LabelType`, `Background`, `RegionShortcut`, `Region`, `NotesViewState` (data-model §1 field table, `readonly`), `initialNotesView`, `equalsNotesView`. Pure: imports only `theory` and `instrument`. All functions total; a no-op returns the **same object** (`Object.is`).
- [X] T008 Create the store skeleton `src/lib/state/notes.svelte.ts`: module-singleton `$state<NotesViewState>`, exported `notes` object with read-only getters `state`, `instrument` (default `STANDARD_GUITAR`), `display` (placeholder `$derived` until `buildNotesModel` exists in US1), and `resetNotesForTests(instrument?)`. Follow the pattern in `src/lib/state/playback.svelte.ts`. Imports only `notes-view` and `state/playback.svelte` (never `audio/engine`).
- [X] T009 Add `messages/en.json` foundation keys with the `notes_` prefix: `notes_zone_selector` ("Notes"), `notes_zone_fretboard` ("Fretboard"), `notes_zone_details` ("Details"), `notes_zone_actions` ("Actions"). Add further keys in the story phase that needs them (never raw text in components; `tests/unit/no-raw-text.test.ts` guards this).
- [X] T010 Create `src/lib/tools/notes/NotesTool.svelte` skeleton rendering the four zone sections (B "Notes", C "Fretboard", D "Details", E "Actions") using the existing grid areas, with `<Fretboard instrument model={...}>` in zone C fed by a minimal model. Edit `src/lib/shell/ToolLayout.svelte` so `tool === 'notes'` renders `NotesTool` while `triads` keeps `ToolPlaceholder`. Extend `tests/unit/tool-layout.test.ts`: notes renders the four named sections, triads still renders the placeholder.

**Checkpoint**: Foundation ready. `/notes` shows the four named zones and a fretboard; user stories can begin.

---

## Phase 3: User Story 1 - Find every occurrence of a note (Priority: P1) 🎯 MVP

**Goal**: Pick notes from a chromatic selector; every occurrence is highlighted, others dimmed; one note (or Octave label) shows same-octave tones with octave numbers.

**Independent Test**: Open `/notes`, select G: 12 G positions highlighted in four tones (G2–G5) each with its octave number, other visible positions dimmed; selecting G again returns to the initial view.

### Tests for User Story 1 (write first, confirm they FAIL)

- [X] T011 [P] [US1] Create `tests/unit/instrument/occurrences.test.ts` (part 1): `positionsWithPitchClass(STANDARD_GUITAR, G)` returns exactly the 12 positions G2 s6f3; G3 s6f15 s5f10 s4f5 s3f0; G4 s5f22 s4f17 s3f12 s2f8 s1f3; G5 s2f20 s1f15, ordered string ascending then fret ascending; fast-check property across random tunings/string counts/fret counts: every returned position has the requested pitch class and none is omitted.
- [X] T012 [P] [US1] Extend `tests/unit/notation/notation.test.ts`: `spokenNoteList` of C♯ and E gives "C sharp and E" (`Intl.ListFormat` conjunction, active locale, R-12); a single note gives "G"; `pitchLabel(spelling, octave)` gives "A3" for (A, 3) and "C♯5" for (C♯, 5), built from `noteLabel` (R-05: string 1 fret 9 = C♯5).
- [X] T013 [P] [US1] Add US1 cases to `tests/unit/state/notes-view.test.ts`: `toggleNote` appends when absent, removes when present, preserves first-selected order, accepts all 12 distinct pitch classes, ignores non-integer or out-of-range pc by returning the same object.
- [X] T014 [P] [US1] Create `tests/unit/state/notes-model.test.ts` (US1 part): initial state → naturals `normal` and labeled, altered `hidden`; G selected → 12 `highlighted`, `tone` 2,3,4,5 by octave (`toneOf(octave) = min(7, max(1, octave))`), `octaveBadge` true on highlighted with `labelType` `'name'`, other visible positions `dimmed` with label kept (selection-dimmed, row 5′); two notes → no tones, no badges; 12 notes selected → every position `highlighted`; `highlightedCount`; every marker `function: 'neutral'`; `description` equals the FR-019a form "G selected: 12 positions highlighted, strings 1 to 6, frets 0 to 22." followed by entries "string N, fret F, G3" ordered string descending then fret ascending (open: "string N, open, E2"); nothing selected → "Showing natural notes, strings 1 to 6, frets 0 to 22."
- [X] T015 [P] [US1] Extend `tests/unit/fretboard/fretboard.test.ts`: neutral `highlighted` markers use `var(--color-note-highlight)`; `marker.tone = N` adds class `tone-N` (fill `var(--octave-tone-N)`) only on `highlighted`; `octaveBadge: true` with `labelMode: 'note'` renders `<text class="octave-badge">` with the octave number and is ignored in other modes; `label: true` labels a `dimmed` marker and `label: false` never labels; `description` replaces the computed description verbatim; a pulsing marker keeps its tone class; every existing fretboard test still passes unmodified.
- [X] T016 [P] [US1] Create `tests/unit/notes/note-selector.test.ts`: `role="group"` named "Choose notes"; 12 buttons in chromatic order from C with `aria-pressed`; visible labels "C" and "C♯ / D♭"; accessible names "C" and "C sharp or D flat"; click toggles via `ontoggle`; naturals vs altered differ by a class/style hook (fill vs outline), not color alone.
- [X] T017 [P] [US1] Create `tests/unit/state/notes-store.test.ts` (US1 part, fake playback via `resetPlaybackForTests`): `notes.toggleNote` calls `playback.stop('view')` exactly once when state changes; state survives a remount of the tool component (FR-019).

### Implementation for User Story 1

- [X] T018 [US1] Add `positionsWithPitchClass(inst, pc)` to `src/lib/instrument/instrument.ts` per data-model §3 (uses `positionPitch` + `pitchClass`; no UI imports). Makes T011 pass.
- [X] T019 [P] [US1] Add `spokenNoteList` to `src/lib/notation/notation.ts` using `Intl.ListFormat(getLocale(), …)`, and `pitchLabel(spelling, octave)` (name + octave number, e.g. "G3", "C♯5"); names come from `noteLabel` and `spokenNote` only. Every octave-qualified name in the renderer, `notes-model` description entries, and the card sentence MUST come from `pitchLabel` (Principle VIII). Makes T012 pass.
- [X] T020 [US1] Add `toggleNote` to `src/lib/state/notes-view.ts` (data-model §1). Makes T013 pass.
- [X] T021 [US1] Create `src/lib/state/notes-model.ts` with `buildNotesModel(state, instrument)` returning `NotesDisplay` (data-model §5): implement emphasis rows 2, 3, 4, 5, 5′ in order over `allPositions(instrument)` with `tonesOn = !hideNames && labelType !== 'none' && (selection.length === 1 || labelType === 'octave')`, `toneOf`, `octaveBadge = tonesOn && labelType === 'name' && emphasis === 'highlighted'`, `label` override (selection-dimmed keeps label, filter-dimmed never), `function: 'neutral'`, `highlightedCount`, `model.description` (summary + entries, entry names via `notation.pitchLabel`; messages for `notes_desc_*` added in T026). Pure + paraglide only. Wire `notes.display` in `src/lib/state/notes.svelte.ts` to `$derived(buildNotesModel(state, instrument))`. Makes T014 pass.
- [X] T022 [US1] Update `src/lib/fretboard/Fretboard.svelte` (R-03): honor `marker.label`, `marker.tone` (class `tone-N`), `marker.octaveBadge` (`<text class="octave-badge">` offset upper-right at `--marker-badge-size`), neutral highlighted fill `--color-note-highlight`, and `model.description` verbatim override of the live description and the "Show description" text. Handedness/orientation applied only here. Makes T015 pass.
- [X] T023 [P] [US1] Create `src/lib/tools/NoteSelector.svelte` per contracts/notes-ui.md (Zone B): `role="group"` "Choose notes", 12 `<button type="button" aria-pressed>`, only props `selected` and `ontoggle` (Principle X), ≥ `--target-min` (44 px), CSS grid `repeat(6, …)` below 600 px and `repeat(12, …)` above, never scrolls, naturals solid fill, altered outlined plus two-spelling label; names from `notation` (`noteLabel`, `spokenNote`) only. Makes T016 pass.
- [X] T024 [US1] Add `toggleNote(pc)` to the store in `src/lib/state/notes.svelte.ts`: compute next state with the pure transition; if `!Object.is(next, current)` call `playback.stop('view')` then assign. Makes T017 pass.
- [X] T025 [US1] Wire `src/lib/tools/notes/NotesTool.svelte`: zone B renders `NoteSelector` bound to `notes.state.selection` / `notes.toggleNote`; zone C renders `<Fretboard instrument={notes.instrument} model={notes.display.model} onactivate={…} pulses={playback.pulses}>` (activation wired in US2).
- [X] T026 [US1] Add `messages/en.json` keys: `notes_selector_label` ("Choose notes"), `notes_selector_altered_spoken`, `notes_desc_*` (summary one-note/many-notes, nothing-selected naturals/all/none, strings range/list, frets range, entry/open-entry templates).

### E2E for User Story 1

- [X] T027 [US1] Create `e2e/notes.spec.ts` with quickstart scenarios 1–6 (US1-1…US1-6): initial view; G → 12 highlighted markers, 4 tone classes, octave badges 2–5, description starts "G selected: 12 positions highlighted"; G again → `aria-pressed=false` and initial view; C + E then no tones; 320 px selector in 2 rows × 6 with no horizontal page scroll; all 12 selected → everything highlighted. (Octave-label half of scenario 4 and Listen-disabled half of scenario 6 are finished in US4 and US5.) Include an axe check at 320 px and 1280 px for these states.

**Checkpoint**: US1 is fully functional and independently testable. This is the MVP.

---

## Phase 4: User Story 2 - Tap a position to hear it and learn about it (Priority: P1)

**Goal**: Tapping or keyboard-activating any position plays it and opens a non-modal position card with name (both spellings if altered), octave, string, fret, unisons (highlighted on the board), **See every occurrence**, and Close.

**Independent Test**: Tap string 3 fret 2: A3 plays (MIDI 57); the card shows A, octave 3, string 3, fret 2 and lists string 4 fret 7, string 5 fret 12, string 6 fret 17, all highlighted.

### Tests for User Story 2 (write first, confirm they FAIL)

- [X] T028 [P] [US2] Extend `tests/unit/instrument/occurrences.test.ts`: `unisonsOf(STANDARD_GUITAR, s3f2)` = s4f7, s5f12, s6f17 (string ascending, then fret ascending, excludes the position itself); s6f0 (E2) returns `[]`; property across random tunings: every unison has equal `positionPitch`, none is omitted, ignores filters and background.
- [X] T029 [P] [US2] Extend `tests/unit/notation/notation.test.ts`: `flatSpelling(1)` = D♭ (C♯'s alternative), `flatSpelling` of a natural returns `null`/natural per the helper's documented contract; used for the card's "C♯ / D♭".
- [X] T030 [P] [US2] Add to `tests/unit/state/notes-view.test.ts`: `addNote` appends if absent and returns the same object if already selected (never removes); `openCard` replaces the card, same position is a same-object no-op; `closeCard` clears the card and is a no-op when closed; selection/label/background/filter changes keep the card open.
- [X] T031 [P] [US2] Add to `tests/unit/state/notes-model.test.ts`: card open on s3f2 → exactly 4 `highlighted` (tapped + 3 unisons, no tones, single highlight token, labeled), all other non-hidden positions `dimmed` and (only if inside filters) labeled; card on a hidden altered position (e.g. s5f4 under "naturals") → highlighted and labeled although it would be hidden; row 1b hidden when `!selected && !bg`; `cardInfo` fields per data-model §6 (`spelling` sharp, `altSpelling` flat when altered else `null`, `octave`, `unisons`, `selected`); description appends "Position card: A3, string 3, fret 2, 3 positions with the same pitch."
- [X] T032 [P] [US2] Add to `tests/unit/state/notes-store.test.ts`: `activate(p)` calls `playback.note(p, instrument)` and opens the card without `stop('view')`; activating the same position replays and keeps the card; `closeCard` does not call stop; `addNote` calls `stop('view')` only when it changes the selection.
- [X] T033 [P] [US2] Add to `tests/unit/fretboard/fretboard.test.ts`: exported `focusPosition(p)` focuses the cell for `p`, moves the roving tabindex, scrolls it into view, and is a no-op for an invalid position; cell accessible names (`positionName`) are unchanged.
- [X] T034 [P] [US2] Create `tests/unit/notes/position-card.test.ts`: `<section aria-labelledby="notes-card-title">`, no `dialog` role; heading "A" or "C♯ / D♭" (spoken "C sharp or D flat"); `<dl>` Octave/String/Fret with open string as "Open"; "Same pitch" `<ul>` entries "String 4, fret 7"… or "This pitch exists only at this position"; **See every occurrence** calls `addNote(pc)`; **Close** (name "Close position card") calls `closeCard` then `focusPosition(card)`.

### Implementation for User Story 2

- [X] T035 [US2] Add `unisonsOf(inst, p)` to `src/lib/instrument/instrument.ts` (data-model §3, TM-1.4). Makes T028 pass.
- [X] T036 [P] [US2] Add `flatSpelling(pc)` to `src/lib/notation/notation.ts` (only `notation` produces names, Principle VIII). Makes T029 pass.
- [X] T037 [US2] Add `addNote`, `openCard`, `closeCard` to `src/lib/state/notes-view.ts` (data-model §1 table). Makes T030 pass.
- [X] T038 [US2] In `src/lib/state/notes-model.ts` implement emphasis rows 1a/1b/1c, `cardInfo(state, instrument)` (data-model §6), and the card sentence in the description (pitch name via `notation.pitchLabel`). Makes T031 pass.
- [X] T039 [US2] Add `activate(p)`, `addNote(pc)`, `closeCard()` to `src/lib/state/notes.svelte.ts` per contracts/notes-state-api.md §4 playback-obligations table. Makes T032 pass.
- [X] T040 [US2] Add the exported `focusPosition(p: Position): void` to `src/lib/fretboard/Fretboard.svelte` (contracts/fretboard-model.md §6). Makes T033 pass.
- [X] T041 [US2] Add `messages/en.json` keys `notes_card_title`, `notes_card_octave`, `notes_card_string`, `notes_card_fret`, `notes_card_open`, `notes_card_unisons_heading`, `notes_card_unison_entry`, `notes_card_no_unison`, `notes_card_see_every`, `notes_card_close`, and the card description sentence.
- [X] T042 [US2] Create `src/lib/tools/notes/PositionCard.svelte` per contracts/notes-ui.md (Zone D). Makes T034 pass.
- [X] T043 [US2] Update `src/lib/tools/notes/NotesTool.svelte`: pass `onactivate={notes.activate}`; `bind:this={board}`; render `PositionCard` in zone D when `notes.display.cardInfo`; Escape keydown in zones C or D closes the card and calls `board.focusPosition(card)` (no global Escape listener, R-10); opening the card leaves focus on the fretboard cell.

### E2E for User Story 2

- [X] T044 [US2] Extend `e2e/notes.spec.ts` with quickstart scenarios 7–12: activate s3f2 → audio log (`__fmAudioLog`) `note` pitch 57, card text and 4 highlighted markers; Escape and Close return focus to cell s3f2; s5f4 → heading "C♯ / D♭"; s6f0 → "This pitch exists only at this position"; **See every occurrence** twice (A pressed, card stays, second press no change); arrow-key to s3f2 + Enter behaves like a tap. axe at 320 px and 1280 px with the card open.

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Narrow the view with string and region filters (Priority: P2)

**Goal**: Per-string toggles and a start/end fret region (steppers + shortcuts) dim and unlabel everything outside; last string cannot be turned off; limits push each other; "There is no [note] in this region" with **Widen region**.

**Independent Test**: Select C♯, keep only string 1, set region 0–4: notice "There is no C♯ in this region" appears; **Widen region** sets 0–9 and string 1 fret 9 highlights.

### Tests for User Story 3 (write first, confirm they FAIL)

- [X] T045 [P] [US3] Add to `tests/unit/state/notes-view.test.ts`: `toggleString` removes/adds keeping ascending order and is a same-object no-op when removing the only active string (EC-4.2); `setRegionStart`: `start = clamp(v, 0, fretCount)` and if `start > end` then `end = start`; `setRegionEnd`: `end = clamp(v, 0, fretCount)` and if `end < start` then `start = end`; non-integers rounded then clamped; `start === end` allowed; `setRegionShortcut` `'0-4'` → `{0,4}`, `'5-9'` → `{5,9}`, `'10-14'` → `{10, min(14, fretCount)}` (fretCount 12 → 10–12), `'whole'` → `{0, fretCount}`; `revalidate`: 7→6 strings drops string 7, keeps others; if none remain all strings become active; 24→12 frets clamps region then applies push rule; drops an invalid `card`; selection unchanged; already-valid returns same object; `missingNotes`.
- [X] T046 [P] [US3] Create `tests/unit/state/notes-widen.test.ts`: C♯, string 1 only, region 0–4 → region 0–9 (position s1f9; label is computed, C♯**5** per R-05, never hard-code "C♯4"); ties extend the end; never touches strings or selection; terminates; fast-check property over random selections, active-string sets, and regions: result contains the original region, contains every selected note on the active strings, and shrinking either moved limit by one fret drops a note (minimality).
- [X] T047 [P] [US3] Extend `tests/unit/notation/notation.test.ts`: `noteList` gives "C♯ or D" (disjunction, selection order) and a single note gives "C♯".
- [X] T048 [P] [US3] Add to `tests/unit/state/notes-model.test.ts`: row 3 (positions outside active strings or region → `dimmed`, `label: false`) including with a card open (row 1c unlabeled when `!inFilter`); `missing` lists selected notes with zero positions in the filters in selection order; `model.region` equals `state.region` (absent or whole-neck rule per the renderer contract); description states active strings ("strings 1 to 6" when contiguous, otherwise a list) and "frets 5 to 9".
- [X] T049 [P] [US3] Add to `tests/unit/fretboard/fretboard.test.ts`: `model.region` renders one `rect.region-band` (`aria-hidden`, `fill: var(--region-band)`) in the drawing layer below strings and markers spanning `columns[start].start`…`columns[end].end`, clamped to `0..fretCount`; absent → no band; a changed region (compared by `start:end`, not on first render) scrolls via `autoScrollTarget` + `animateScroll` (instant under reduced motion); band honors handedness/orientation.
- [X] T050 [P] [US3] Extend `tests/unit/notice.test.ts`: optional `action: { label, onclick }` renders a button before Dismiss and calls `onclick`; without `action` the markup is unchanged; still `role="status"`, polite, dismissible.
- [X] T051 [P] [US3] Create `tests/unit/notes/string-filter.test.ts`: `role="group"` "Strings"; one `aria-pressed` button per string in fretboard row order labeled "{n} {openNote}" (e.g. "1 E") with accessible name "String 1, E"; the only active string has `aria-pressed="true"` + `aria-disabled="true"` + description "At least one string stays on" and activation is a no-op.
- [X] T052 [P] [US3] Create `tests/unit/notes/region-filter.test.ts`: `role="group"` "Frets"; "Start fret"/"End fret" `role="spinbutton"` with `aria-valuemin=0`, `aria-valuemax=fretCount`, `aria-valuenow`; ArrowUp/ArrowDown ±1, PageUp/PageDown ±5, Home/End → 0/fretCount; − / + buttons named "Lower start fret", "Raise start fret", etc. (≥ 44 px); shortcut buttons "0–4", "5–9", "10–14", "Whole neck" with `aria-pressed` when equal to the region; pushed value updates visibly.
- [X] T053 [P] [US3] Add to `tests/unit/state/notes-store.test.ts`: `toggleString`, `setRegionStart`, `setRegionEnd`, `setRegionShortcut`, `widenRegion`, `useInstrument` each call `playback.stop('view')` (`stop('instrument')` for `useInstrument`) iff state/instrument changed; last-string removal does not stop playback.

### Implementation for User Story 3

- [X] T054 [US3] Add `toggleString`, `setRegionStart`, `setRegionEnd`, `setRegionShortcut`, `widenRegion` (R-06 algorithm), `revalidate`, `missingNotes` to `src/lib/state/notes-view.ts`. Makes T045 and T046 pass.
- [X] T055 [P] [US3] Add `noteList(spellings)` (disjunction, `Intl.ListFormat(getLocale(), { type: 'disjunction' })`, names from `noteLabel` only) to `src/lib/notation/notation.ts`. Makes T047 pass.
- [X] T056 [US3] In `src/lib/state/notes-model.ts` implement row 3, `missing`, `model.region`, and the strings/region description parts. Makes T048 pass.
- [X] T057 [US3] Add the region band and region-change scroll to `src/lib/fretboard/Fretboard.svelte` (contracts/fretboard-model.md §3). Makes T049 pass.
- [X] T058 [P] [US3] Add the optional `action` prop to `src/lib/shell/Notice.svelte`. Makes T050 pass.
- [X] T059 [US3] Add store actions `toggleString`, `setRegionStart`, `setRegionEnd`, `setRegionShortcut`, `widenRegion`, `useInstrument(i)` to `src/lib/state/notes.svelte.ts`. Makes T053 pass.
- [X] T060 [US3] Add `messages/en.json` keys `notes_strings_*`, `notes_region_*` (group, start, end, lower/raise, shortcut labels, whole neck), `notes_notice_missing` ("There is no {notes} in this region"), `notes_notice_missing_count` ("{count} selected notes are not in this region"), `notes_notice_widen` ("Widen region").
- [X] T061 [P] [US3] Create `src/lib/tools/notes/StringFilter.svelte` per contracts/notes-ui.md. Makes T051 pass.
- [X] T062 [P] [US3] Create `src/lib/tools/notes/RegionFilter.svelte` per contracts/notes-ui.md. Makes T052 pass.
- [X] T063 [US3] Update `src/lib/tools/notes/NotesTool.svelte`: zone D renders `StringFilter` and `RegionFilter` below the card; zone C renders the region `Notice` (`notes_notice_missing` via `noteList` when 1–3 notes are missing, `notes_notice_missing_count` when more than 3, + **Widen region** action) above the fretboard; a dismissed notice reappears when its condition goes false then true.

### E2E for User Story 3

- [X] T064 [US3] Extend `e2e/notes.spec.ts` with quickstart scenarios 13–17: strings 1–5 off → dimmed unlabeled, string 6 `aria-disabled` and pressed; 5–9 then Start → 12 pushes End to 12; each shortcut sets steppers 0/4, 5/9, 10/14, 0/22; C♯ + string 1 + 0–4 → notice then **Widen region** → 0–9 and s1f9 highlighted; notice length: with C♯, D, D♯ missing the notice names all three, with all 12 selected on string 1 region 5–5 it shows "11 selected notes are not in this region", and in both cases the notice (text + **Widen region** + Dismiss) renders in at most 2 lines at 320 px and at 200 % zoom; region 5–9 → outside markers dimmed unlabeled, band visible, board scrolled. axe at 320 px and 1280 px with the notice visible.

**Checkpoint**: US1–US3 work independently.

---

## Phase 6: User Story 4 - Control what the neck shows (labels and background) (Priority: P2)

**Goal**: Label type (Name, Octave, No label) and **Show** background (naturals, all, none); selected notes always show; "Pick a note or tap a fret" when nothing can be shown.

**Independent Test**: Background none, nothing selected → empty board and "Pick a note or tap a fret"; select C♯ → it appears although altered notes are hidden by default.

### Tests for User Story 4 (write first, confirm they FAIL)

- [X] T065 [P] [US4] Add to `tests/unit/state/notes-view.test.ts`: `setLabelType` and `setBackground` set the field and return the same object when unchanged.
- [X] T066 [P] [US4] Add to `tests/unit/state/notes-model.test.ts`: `background: 'all'` → naturals and altered visible (`normal`, or `dimmed` with label when a selection exists); `'none'` → only selected notes shown, others `hidden`; selected altered note shows under "naturals"; `emptyGuidance` true only when `background === 'none' && selection.length === 0`; Octave label type → `labelMode: 'octave'`, labels "A3" on every labeled position (highlighted, normal, selection-dimmed), tones on for any selection size (FR-004); "No label" → no labels, tones off, single highlight token.
- [X] T067 [P] [US4] Add to `tests/unit/fretboard/fretboard.test.ts`: `labelMode: 'octave'` renders `pitchLabel(spelling, octaveOf(positionPitch))` from `src/lib/notation` (e.g. `A3`, `C♯5`); `'none'` renders no `.marker-label`.
- [X] T068 [P] [US4] Create `tests/unit/notes/notes-actions.test.ts` (Show/Label part): `radiogroup` "Show" with radios "Natural notes" (default), "All notes", "None"; `radiogroup` "Label" with radios "Name" (default), "Octave", "No label"; roving tabindex, arrows move and select, Tab leaves the group.
- [X] T069 [P] [US4] Add to `tests/unit/state/notes-store.test.ts`: `setLabelType` and `setBackground` call `playback.stop('view')` iff changed.

### Implementation for User Story 4

- [X] T070 [US4] Add `setLabelType`, `setBackground` to `src/lib/state/notes-view.ts`. Makes T065 pass.
- [X] T071 [US4] In `src/lib/state/notes-model.ts` implement the background set, `emptyGuidance`, and Octave/No label handling (`labelMode`, tones). Makes T066 pass.
- [X] T072 [US4] Add `labelMode: 'octave'` to `src/lib/fretboard/Fretboard.svelte`, labeling via `notation.pitchLabel` (no name formatting in the component). Makes T067 pass.
- [X] T073 [US4] Add `setLabelType`, `setBackground` to `src/lib/state/notes.svelte.ts`. Makes T069 pass.
- [X] T074 [US4] Add `messages/en.json` keys `notes_show_*` (group, naturals, all, none), `notes_label_*` (group, name, octave, none), `notes_notice_empty` ("Pick a note or tap a fret").
- [X] T075 [US4] Create `src/lib/tools/notes/NotesActions.svelte` with the Show and Label radiogroups (roving tabindex). Makes T068 pass. Mount it in zone E of `NotesTool.svelte`, and render the `emptyGuidance` notice ("Pick a note or tap a fret") in zone C.

### E2E for User Story 4

- [X] T076 [US4] Extend `e2e/notes.spec.ts` with quickstart scenarios 18–21 and the Octave half of scenario 4: select C♯ → shown while D♯ hidden; Show all / none; Show none + no selection → "Pick a note or tap a fret" and no markers; No label → no `.marker-label`; C + E with Label → Octave → labels "C3"… and tones on. axe at 320 px and 1280 px.

**Checkpoint**: US1–US4 work independently.

---

## Phase 7: User Story 5 - Listen, self-test, clear, and reset (Priority: P3)

**Goal**: **Listen** (120 bpm ascending sequence, 1–3 notes), **Hide names**, **Clear**, **Reset tool**, plus the TM-9 screenshot fixtures with the test-only instrument harness (FR-020).

**Independent Test**: Select A, press Listen: every A inside the filters sounds in ascending pitch with unisons together and pulses in order; Hide names removes all labels and the hover hint; changing the selection stops playback.

### Tests for User Story 5 (write first, confirm they FAIL)

- [X] T077 [P] [US5] Add to `tests/unit/state/notes-view.test.ts`: `setHideNames` (labelType kept while on and restored when off; same-object no-op); `clear(s, inst)` empties selection, activates all strings, whole-neck region, closes the card, keeps `labelType`/`background`/`hideNames`, same-object on an already-matching state; `reset(inst)` equals `initialNotesView(inst)`.
- [X] T078 [P] [US5] Add to `tests/unit/state/notes-model.test.ts`: Hide names → no labels, no tones, no badges, `model.hoverHint === false`, description lists no entries for unselected positions; card still shows the name; `listenSteps` = selected-note positions inside active strings and region, grouped by pitch (same-pitch positions form one chord step ordered by string number; single positions bare), ascending pitch; `listen` matrix for 0, 1, 3, 4, and 12 selected notes (`enabled` only for 1–3 with ≥ 1 step; otherwise `reason` `'none' | 'too-many' | 'no-positions'`); `LISTEN_BPM === 120`.
- [X] T079 [P] [US5] Add to `tests/unit/fretboard/fretboard.test.ts`: `model.hoverHint === false` never renders the hover hint; default unchanged.
- [X] T080 [P] [US5] Extend `tests/unit/notes/notes-actions.test.ts`: **Hide names** `button aria-pressed`; **Listen** `button`, disabled via `aria-disabled="true"` (not removed) with `aria-describedby` → "Select one to three notes to listen" / "Listen plays up to three notes" / "No position of the selected notes is inside the filters"; **Clear** and **Reset tool** buttons call their store actions and are always enabled.
- [X] T081 [P] [US5] Add to `tests/unit/state/notes-store.test.ts`: `setHideNames`, `clear`, `reset` call `stop('view')` iff changed; `listen()` calls `playback.sequence(steps, 120, instrument)` only when enabled and does not call `stop`; Clear/Reset close the card.
- [X] T082 [P] [US5] Create `tests/unit/instrument/fixtures.test.ts`: `AF-7` = strings 1→6 D4 A3 G3 D3 A2 D2 and `AF-21` = E4 B3 G3 D3 A2 E2 B1, 22 frets each (contracts/test-hooks.md); `notes.useInstrument(AF-21)` revalidates (7 strings kept); switching back drops string 7 and keeps the selection; unknown `__fmInstrument` values fall back to the default via `Object.hasOwn` and never throw.

### Implementation for User Story 5

- [X] T083 [US5] Add `setHideNames`, `clear`, `reset` to `src/lib/state/notes-view.ts`. Makes T077 pass.
- [X] T084 [US5] In `src/lib/state/notes-model.ts` implement Hide names handling, `hoverHint`, `listenSteps`, `listen` availability, and `LISTEN_BPM`. Makes T078 pass.
- [X] T085 [US5] Honor `model.hoverHint === false` in `src/lib/fretboard/Fretboard.svelte`. Makes T079 pass.
- [X] T086 [US5] Add `setHideNames`, `listen`, `clear`, `reset` to `src/lib/state/notes.svelte.ts` per the playback-obligations table. Makes T081 pass.
- [X] T087 [US5] Add `messages/en.json` keys `notes_hide_names`, `notes_listen`, `notes_listen_reason_none`, `notes_listen_reason_too_many`, `notes_listen_reason_no_positions`, `notes_clear`, `notes_reset`.
- [X] T088 [US5] Extend `src/lib/tools/notes/NotesActions.svelte` with Hide names, Listen, Clear, and Reset tool (Listen uses `aria-disabled` + `aria-describedby`). Makes T080 pass.
- [X] T089 [P] [US5] Create test-only `src/lib/instrument/fixtures.ts` with `AF-7` and `AF-21` (22 frets each), pure, imported only inside `if (__FM_FAULT_INJECTION__)`.
- [X] T090 [P] [US5] Declare `var __fmInstrument: 'AF-7' | 'AF-21' | undefined;` in `src/app.d.ts` and add the `__fmInstrument` needle to `scripts/check-no-fault-hook.mjs` (ADR 0004 pattern).
- [X] T091 [US5] In `src/lib/tools/notes/NotesTool.svelte`, read `__fmInstrument` once on mount behind `__FM_FAULT_INJECTION__` (allow-list lookup, `Object.hasOwn`) and apply via `notes.useInstrument(fixture)`. Makes T082 pass.

### E2E for User Story 5

- [X] T092 [US5] Extend `e2e/notes.spec.ts` with quickstart scenarios 22–28 and the Listen-disabled half of scenario 6: A + Listen → audio log `sequence` ascending, unisons as chords, 0.5 s apart, pulses in order (also muted); 0 and 4 notes → Listen `aria-disabled` with the reason announced; Hide names → no labels or hover hint, tap → card shows the name; Clear keeps Octave + all; Reset tool equals scenario 1; Listen then toggle a note → audio log `stop` reason `view` and pulses cleared; select G, go to `/triads`, back → G still selected, reload → initial. axe at 320 px and 1280 px.
- [X] T093 [US5] Create `e2e/notes-tm9.spec.ts` (TM-9 views 1–5, contracts/test-hooks.md): view 1 default, select F♯ (12 highlighted, octave tones and numbers); view 2 region 0–12 via steppers (naturals normal inside, dimmed unlabeled beyond, lit band); view 3 activate s3f2 (card A3, unisons s4f7 s5f12 s6f17 highlighted); view 4 `__fmInstrument='AF-21'` via `page.addInitScript`, Show all, region 0–5 (7 strings, all labeled in frets 0–5); view 5 `AF-7`, select D. Each test asserts semantic facts (counts, card text, description) in addition to `toHaveScreenshot('tm9-view-N.png')` per Playwright project. Generate snapshots with `--update-snapshots`, review, commit.

**Checkpoint**: All user stories work independently.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Gates that span stories.

- [X] T094 [P] Add the control-change performance case to `e2e/perf.spec.ts` (quickstart #30): select a note → highlighted markers present, median ≤ 100 ms under 4× CPU throttle.
- [X] T095 [P] Add keyboard-only end-to-end scenario 29 to `e2e/notes.spec.ts`: reach and operate every control (selector, fretboard, card, strings, steppers, shortcuts, radiogroups, Hide names, Listen, Clear, Reset tool) by keyboard alone, with axe zero violations at 320 px and 1280 px, and a 200 % zoom check at 320 px.
- [X] T096 [P] Confirm `tests/unit/no-raw-text.test.ts` covers `src/lib/tools/**` and `messages/en.json` contains every `notes_*` key used; fix any raw text.
- [X] T097 Run all gates from quickstart.md §2: `pnpm check`, `pnpm lint`, `pnpm format:check`, `pnpm test:unit -- --coverage` (≥ 95 % theory, ≥ 80 % overall), `pnpm build:test && pnpm test:e2e`, `pnpm build && node scripts/check-no-fault-hook.mjs && node scripts/check-bundle-size.mjs`, `pnpm lhci`. Fix findings.
  - Note (T097): every gate passes except the pre-existing FR-023 navigation-latency case in `e2e/perf.spec.ts`, which also fails on the pre-004 commit on this machine (macOS 12, system Chrome; ~330 ms there vs ~310–350 ms here at 4× throttle), so it is environmental, not a 004 regression.
- [X] T098 Verify production safety: `pnpm build && grep -r __fmInstrument build/` returns nothing; `src/lib/theory` is untouched (`git diff --stat -- src/lib/theory` empty).
- [X] T099 Run the quickstart.md §3–§5 validation matrix end to end and tick off every row (scenarios 1–30 and TM-9 views 1–5).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none; start immediately.
- **Foundational (Phase 2)**: depends on Setup; BLOCKS all user stories.
- **User Stories (Phase 3–7)**: all depend on Foundational.
  - US1 and US2 (both P1) share `notes-model.ts`, `notes-view.ts`, `notes.svelte.ts`, `Fretboard.svelte`, and `NotesTool.svelte` with later stories, so run them in priority order (US1 → US2 → US3 → US4 → US5) unless one developer per story coordinates on those files.
  - Each story's pure logic lands in the same files but touches disjoint functions, so stories remain independently testable and shippable.
- **Polish (Phase 8)**: depends on all desired stories.

### User Story Dependencies

- **US1 (P1)**: after Foundational. No dependency on other stories. MVP.
- **US2 (P1)**: after Foundational. Uses US1's model and renderer files but not its behavior; testable alone (tap a position on the default view).
- **US3 (P2)**: after Foundational. Independent; its Widen e2e uses selection from US1.
- **US4 (P2)**: after Foundational. Independent; Octave label tones reuse US1's tone code.
- **US5 (P3)**: after Foundational. Listen uses selection (US1); TM-9 views 2–4 reuse US3/US4 controls, so run T093 last.

### Within Each Story

- Test tasks first and seen failing, then implementation: instrument/notation → `notes-view` → `notes-model` → renderer → store → components → `NotesTool` wiring → e2e.
- Pure modules before the store, the store before components, and the story's e2e last.

### Parallel Opportunities

- Setup: T001 and T002.
- Foundational: T003, T004, T006 in parallel; T005 after T004, T007 after T006.
- Within each story, all test-file tasks marked [P] (different files) run together; impl tasks on different files (e.g. T019, T023; T036; T058, T061, T062; T089, T090) run together.
- Polish: T094, T095, T096.

---

## Parallel Example: User Story 1

```bash
# Launch all US1 test tasks together (different files):
Task: "T011 tests/unit/instrument/occurrences.test.ts positionsWithPitchClass"
Task: "T012 tests/unit/notation/notation.test.ts spokenNoteList + pitchLabel"
Task: "T014 tests/unit/state/notes-model.test.ts US1 classification"
Task: "T015 tests/unit/fretboard/fretboard.test.ts tone/badge/label/description"
Task: "T016 tests/unit/notes/note-selector.test.ts"

# Then independent implementation files together:
Task: "T019 src/lib/notation/notation.ts spokenNoteList + pitchLabel"
Task: "T023 src/lib/tools/NoteSelector.svelte"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup, then Phase 2 Foundational.
2. Phase 3 US1.
3. **STOP and VALIDATE**: select G, verify 12 positions in four tones and the e2e scenarios 1–6; axe clean.
4. Ship (`/triads` keeps its placeholder, so the slice is shippable alone).

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 → validate → MVP.
3. US2 (card, unisons, sound) → validate.
4. US3 (filters, Widen) → validate.
5. US4 (labels, background) → validate.
6. US5 (Listen, Hide names, Clear/Reset, TM-9) → validate.
7. Polish gates.

### Parallel Team Strategy

After Phase 2, one developer takes the renderer and `notes-model` work while others take components (`NoteSelector`, `PositionCard`, `StringFilter`, `RegionFilter`, `NotesActions`) whose tests and files are disjoint; merge `notes-model.ts`, `notes-view.ts`, `notes.svelte.ts`, and `NotesTool.svelte` edits in story order.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] labels map tasks to spec.md user stories for traceability.
- `theory` is not modified in this feature; pitch queries live in `instrument`, names only in `notation` (Principles I, III, VIII).
- Every state-changing store action calls `playback.stop('view')` only when the state changed (contracts/notes-state-api.md §4).
- Never hard-code "C♯4" for string 1 fret 9; compute the label (C♯5).
- Commit after each task or logical group.
