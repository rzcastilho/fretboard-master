---

description: "Task list for Instrument Panel and Preset Tunings"
---

# Tasks: Instrument Panel and Preset Tunings

**Input**: Design documents from `/specs/009-instrument-panel-and-tunings/`

**Prerequisites**: plan.md, spec.md, research.md (R-01…R-14), data-model.md, contracts/instrument-config-api.md, contracts/instrument-panel-ui.md, quickstart.md

**Tests**: INCLUDED. Constitution IV requires test-first for logic (`tunings.ts`, `instrument-config.ts`, `adaptNotesView`, `applyInstrument`) and a test for every acceptance scenario. Write each test task first and confirm it FAILS before the matching implementation task.

**Organization**: Grouped by user story. Story priorities follow spec.md: US1 (P1), US5 (P1), US2 (P2), US3 (P2), US4 (P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1…US5 (user-story phases only)
- All paths are relative to the repository root. Unit tests use Vitest in `tests/unit/`; E2E uses Playwright in `e2e/`. Select UI elements by role and accessible name (contracts/instrument-panel-ui.md), never by CSS class.

## Path Conventions

Single-project SvelteKit app: `src/lib/{instrument,state,fretboard,shell,tools}`, `src/routes`, `messages/`, `tests/unit`, `e2e/`, `docs/adr/`. No new top-level directory.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Catalog strings and design tokens used by every later task

- [X] T001 [P] Add the message catalog keys from data-model §7 to `messages/en.json`: `tuning_af1`…`tuning_af11` (Standard, Half step down, Whole step down, Drop D, Drop C, Double Drop D, DADGAD, Open G, Open D, Open E, Open A), `instrument_button` ("Instrument"), `instrument_panel_title` ("Instrument"), `instrument_tuning_legend` ("Tuning"), `instrument_preset_label` ("{name}: {notes}"), `instrument_frets_label` ("Frets"), `instrument_frets_decrease` ("Fewer frets"), `instrument_frets_increase` ("More frets"), `instrument_preview_label` ("Preview"), `instrument_confirm` ("Confirm"), `instrument_restore_default` ("Restore default"), `instrument_close` ("Close"), `instrument_badge_label` ("Tuning: {name}. Open instrument panel"), `instrument_summary_standard` ("6 strings · standard tuning · right-handed"), `instrument_summary_preset` ("6 strings · {name} · right-handed"), `instrument_adjusted` ("We adjusted the view to the new instrument"). Keep the "·" separators inside the strings. Then run `pnpm check` to recompile Paraglide.
- [X] T002 [P] Add panel tokens to `src/lib/styles/tokens.css`: side-panel inline size and bottom-sheet max block size (`90dvh`). Reuse existing `--target-min`, `--duration-short` and spacing tokens; add no color literals (reserved-color test must still pass).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Preset data, pure config/transition logic, tool-store `applyInstrument`, and the app-wide instrument store. No user story can start before this phase is complete.

**⚠️ CRITICAL**: Tests T003, T004, T007, T008, T010 must be written and failing before T005, T006, T009, T011, T012.

- [X] T003 [P] Write the SC-002 table test in `tests/unit/instrument/tunings.test.ts`: 11 presets × 6 strings = 66 rows asserting letter, accidental, octave and MIDI pitch exactly as data-model §1 (AF-1 E2 A2 D3 G3 B3 E4; AF-2 E♭2 A♭2 D♭3 G♭3 B♭3 E♭4; AF-3 D2 G2 C3 F3 A3 D4; AF-4 D2 A2 D3 G3 B3 E4; AF-5 C2 G2 C3 F3 A3 D4; AF-6 D2 A2 D3 G3 B3 D4; AF-7 D2 A2 D3 G3 A3 D4; AF-8 D2 G2 D3 G3 B3 D4; AF-9 D2 A2 D3 F♯3 A3 D4; AF-10 E2 B2 E3 G♯3 B3 E4; AF-11 E2 A2 E3 A3 C♯4 E4). Also assert: every preset has 6 strings, pitch strictly rising low → high; `TUNING_PRESETS` is in AF-1…AF-11 order; `presetInstrument('AF-1', 22) === STANDARD_GUITAR`; `presetInstrument(id, n) === presetInstrument(id, n)`; `openStrings[k]` equals `tuningPreset(id).strings[5 - k]`; result is frozen with `stringCount: 6`, `handedness: 'right'`, `orientation: 'highest-top'`; `clampFrets` rounds non-integers, clamps to 12..24, NaN → 22; `isTuningId` accepts only the 11 ids; constants `MIN_FRETS = 12`, `MAX_FRETS = 24`, `DEFAULT_FRETS = 22`, `DEFAULT_TUNING_ID = 'AF-1'`.
- [X] T004 [P] Write `tests/unit/state/instrument-config.test.ts` for every transition in data-model §3: `openPanel` (closed → open with pending = active; already open → same object), `selectTuning` (unknown id → same object), `stepFrets` and `setFrets` clamped to 12..24 ("Integer, MIN_FRETS ≤ fretCount ≤ MAX_FRETS"), `restoreDefault` → `{ tuningId: 'AF-1', fretCount: 22 }`, `cancelPanel` leaves active untouched (SC-005), `confirmPanel` returns `{ panel: closed, next: pending, changed: !equalsConfig(pending, active) }`, `confirmPanel` on a closed panel returns `{ panel: p, next: active, changed: false }`, edits on a closed panel return the same object, no-op transitions return the same object (`Object.is`). Add a fast-check property: any sequence of transitions keeps `fretCount` an integer in 12..24.
- [X] T005 Implement `src/lib/instrument/tunings.ts` per contracts/instrument-config-api.md §1 and data-model §1: `TuningId`, `TuningPreset`, `TUNING_PRESETS` authored low → high in the preset's own spelling with stored `accidental` values (never re-derived, FR-005), `MIN_FRETS`, `MAX_FRETS`, `DEFAULT_FRETS`, `DEFAULT_TUNING_ID`, `isTuningId`, `tuningPreset`, `clampFrets`, and `presetInstrument(id, fretCount)` memoized by `` `${id}|${fretCount}` ``, frozen, reversing the strings once so `openStrings[0]` is string 1; return `STANDARD_GUITAR` for `('AF-1', 22)`. Must stay DOM/Svelte-free (lint boundary). Makes T003 pass.
- [X] T006 Implement `src/lib/state/instrument-config.ts` per contracts/instrument-config-api.md §2 and data-model §2–3: `InstrumentConfig`, `PanelState`, `DEFAULT_CONFIG`, `CLOSED`, `equalsConfig`, `instrumentOf` (= `presetInstrument`), `openPanel`, `selectTuning`, `stepFrets`, `setFrets`, `restoreDefault`, `cancelPanel`, `confirmPanel`. Pure: no Svelte, i18n or DOM; no-op transitions return the same object. Makes T004 pass.
- [X] T007 Update `src/lib/instrument/fixtures.ts` so `AF_4` and `AF_7` are `presetInstrument('AF-4', 22)` / `presetInstrument('AF-7', 22)` (R-13), and extend `tests/unit/instrument/fixtures.test.ts` asserting their open strings equal the presets' and are unchanged from the current TM-9 values (screenshots stay untouched). Leave the `__fmInstrument` test hook bypassing the instrument store.
- [X] T008 [P] Extend `tests/unit/state/triads-store.test.ts` (failing first): `applyInstrument(next)` keeps root, spelling override, quality, inversion, string set, label type, view and compare; clamps `occurrence` to the highest remaining one; returns `true` iff the view state changed; returns `false` when `next === instrument`; never calls `playback.stop`; SC-003 (Drop D: C major root position strings 6-5-4 reads 10-7-5 tagged "wide stretch"; Standard reads 8-7-5). Keep `useInstrument` test: it stops playback with reason `instrument` then delegates.
- [X] T009 Implement `applyInstrument(next: Instrument): boolean` in `src/lib/state/triads.svelte.ts` using the existing `revalidate` from `src/lib/state/triads-view.ts` (no more view reset); no-op returning `false` when `next === instrument`; `useInstrument` delegates after its own `playback.stop('instrument')`. Makes T008 pass.
- [X] T010 [P] Extend `tests/unit/state/notes-store.test.ts` (failing first): `applyInstrument(next)` sets the store instrument, returns `false` when `next === instrument` or the view stays valid, never calls `playback.stop`; `useInstrument` still stops playback with reason `instrument` then delegates.
- [X] T011 Implement `applyInstrument(next: Instrument): boolean` in `src/lib/state/notes.svelte.ts` using the existing `revalidate` (`adjusted = result !== s`); `useInstrument` delegates after `playback.stop('instrument')`. (US4 later swaps in `adaptNotesView`.) Makes T010 pass.
- [X] T012 [P] Write `tests/unit/state/instrument-store.test.ts` with a spy playback store covering the contracts §3 table: pending equals active → `playback.stop` not called, tool stores not called, `adjustedIn` unchanged; changed and valid → stop once with reason `instrument`, both `applyInstrument` called, `adjustedIn = null`; changed and current tool adjusted → `adjustedIn` is the current tool; changed and only the other tool adjusted → `adjustedIn = null`. Also: starts at `DEFAULT_CONFIG` (FR-018), `current === instrumentOf(active)`, `preview` is non-null only while open, `cancel` keeps `active` (SC-005), `dismissAdjusted` clears, `resetInstrumentForTests` resets.
- [X] T013 Implement `src/lib/state/instrument.svelte.ts` (runes singleton, ADR 0008 pattern) per contracts §3 and data-model §4: `$state.raw` `active` and `panel`, `$derived` `current` and `preview`, `adjustedIn: ToolId | null`, methods `open`, `selectTuning`, `stepFrets`, `setFrets`, `restoreDefault`, `cancel`, `confirm(screen)` (orchestration steps 1–6: `confirmPanel`; stop if unchanged; `playback.stop('instrument')` once; set `active`; call `notes.applyInstrument` and `triads.applyInstrument`; set `adjustedIn` only for the displayed tool when it was adjusted), `dismissAdjusted`, and `resetInstrumentForTests`. Nothing is written to storage or the URL. Makes T012 pass.

**Checkpoint**: Pure data, transitions, tool-store application and the app-wide store are tested; UI work can begin.

---

## Phase 3: User Story 1 - Play in a different tuning and see matching views (Priority: P1) 🎯 MVP

**Goal**: From any tool, open the panel, pick a preset, see a preview, confirm, and have Notes, Triads and sound follow the real tuning, with a badge for non-Standard tunings.

**Independent Test**: In `/triads` activate **Instrument**, pick Drop D, press Confirm: string 6 shows and plays D2, a "Drop D" badge appears, and C major root position on strings 6-5-4 reads 10-7-5 with "wide stretch" (standard 8-7-5).

### Tests for User Story 1 ⚠️ (write first, ensure they FAIL)

- [X] T014 [P] [US1] Extend `tests/unit/fretboard/geometry.test.ts`: the `preview` variant draws `instrument.fretCount` frets (24-fret preview is not capped at the thumbnail's 12); add a `Fretboard` component test in `tests/unit/fretboard/` asserting `variant="preview"` renders open-string labels from `instrument.openStrings` in preset spelling (♭, ♯ glyphs), no markers, no handlers, root `aria-hidden="true"` and no description region.
- [X] T015 [P] [US1] Write `tests/unit/instrument-panel.test.ts` (radio-group part): a `dialog` named "Instrument" (heading `h2`, `aria-labelledby`); a `group` "Tuning" with 11 native `radio` items in TM-2 order; accessible name "{name}: {notes spoken}" via `spokenNoteList` (e.g. "Half step down: E flat, A flat, D flat, G flat, B flat, E flat"); visible glyph notes line `aria-hidden`; checked radio = pending tuning; selecting a preset updates only the pending preview and applies nothing; focus on open lands on the checked radio; Confirm calls `instrument.confirm` and closes; Confirm is always enabled.
- [X] T016 [P] [US1] Write `tests/unit/tuning-badge.test.ts`: badge is a `button` with accessible name "Tuning: {name}. Open instrument panel" and visible text exactly the preset name; rendered iff `tuningId !== 'AF-1'`, independent of fret count; activation opens the panel. Add an `InstrumentButton` test (button "Instrument", always rendered) in the same file or `tests/unit/instrument-button.test.ts`.
- [X] T017 [P] [US1] Extend `tests/unit/tool-layout.test.ts`: zone A of `ToolLayout` shows the "Instrument" button always, and the badge only when tuning ≠ Standard.
- [X] T018 [US1] Write `e2e/instrument-panel.spec.ts` (US1 part; phone 360 px and desktop; select by role/name): quickstart scenario 1 (open from `/triads`, pick Drop D, Confirm, badge "Drop D", C major root 6-5-4 = 10-7-5 "wide stretch", string 6 open plays D2 via the existing audio test seam); scenario 2 (badge opens the panel with Drop D checked; choose Standard, Confirm → badge gone); US1-6 (Standard at 22 frets shows no badge); US1-3 (preview shows the lowest string D before anything is applied).

### Implementation for User Story 1

- [X] T019 [P] [US1] Add `'preview'` to the `variant` union in `src/lib/fretboard/types.ts` and implement the preview branch in `src/lib/fretboard/geometry.ts` (full pending fret count, compact metrics, no cap at 12).
- [X] T020 [US1] Implement `variant="preview"` in `src/lib/fretboard/Fretboard.svelte` (depends on T019): draws `instrument.fretCount` frets, open-string labels from `instrument.openStrings`, no markers, no pointer or keyboard handlers, root `aria-hidden="true"`, no description. Makes T014 pass.
- [X] T021 [US1] Create `src/lib/shell/InstrumentPanel.svelte`: native `<dialog>` opened with `showModal()` when `instrument.panel.open`, labelled by its `h2` heading `m.instrument_panel_title()`; `<fieldset>` + `<legend>` "Tuning" with one `<input type="radio">` per `TUNING_PRESETS` entry (visible name + glyph notes via `src/lib/notation` `noteLabel`; visually hidden accessible name via `spokenNoteList`; names from `m.tuning_afN()`); non-interactive `Fretboard variant="preview"` bound to `instrument.preview` labelled "Preview"; **Confirm** (`instrument.confirm(currentScreen)`) and **Close** buttons (targets ≥ `--target-min`); initial focus on the checked radio; hold the opener element reference in the component and return focus to it on every close. Only tokens in CSS; all text from the catalog (no raw text). Makes T015 pass.
- [X] T022 [US1] Mount `InstrumentPanel` once in `src/routes/+layout.svelte`.
- [X] T023 [P] [US1] Create `src/lib/shell/InstrumentButton.svelte`: `button` "Instrument" (`m.instrument_button()`), calls `instrument.open()` and passes itself as the opener for focus return.
- [X] T024 [P] [US1] Create `src/lib/shell/TuningBadge.svelte`: a `button` rendered iff `instrument.active.tuningId !== 'AF-1'`, visible text = the catalog preset name, `aria-label` = `m.instrument_badge_label({ name })`; no fixed width; opens the panel.
- [X] T025 [US1] Modify `src/lib/shell/ToolLayout.svelte` (depends on T023, T024) to render `InstrumentButton` and `TuningBadge` in zone A of every tool (Notes, Triads, placeholders). Makes T016 and T017 pass.
- [X] T026 [US1] Verify T018 passes on phone and desktop profiles (`pnpm build:test && pnpm test:e2e -g "instrument"`), fixing wiring gaps.

**Checkpoint**: US1 works end to end from every tool and is demoable as the MVP.

---

## Phase 4: User Story 5 - Reach the panel from the home screen and every tool (Priority: P1)

**Goal**: Home shows the tappable instrument summary and active-instrument thumbnails; the panel is a bottom sheet below 1024 px and a side panel from 1024 px.

**Independent Test**: From home activate the summary: the panel opens. From each tool activate "Instrument": the panel opens as a bottom sheet at 360 px and a side panel at ≥ 1024 px. After confirming Drop D, home reads "6 strings · Drop D · right-handed" and thumbnails show D on string 6.

### Tests for User Story 5 ⚠️ (write first, ensure they FAIL)

- [X] T027 [P] [US5] Extend `tests/unit/home-screen.test.ts`: `data-zone="bottom"` holds a single `button` "6 strings · standard tuning · right-handed" for Standard and "6 strings · Drop D · right-handed" for Drop D; the fret count is not shown; activation opens the panel.
- [X] T028 [P] [US5] Extend `tests/unit/tool-card.test.ts`: thumbnails receive `instrument.current` (not `STANDARD_GUITAR`); with Drop D active the thumbnail's string 6 label is D.
- [X] T029 [US5] Extend `e2e/instrument-panel.spec.ts` (US5 part): home summary opens the panel (US5-1); app-bar button opens it in Notes and Triads (US5-2); computed layout is a bottom sheet at 360 px (full inline size, anchored to block end, max block size 90dvh) and an inline-end side panel at 1280 px (US5-3, FR-002); summary text and thumbnails update after confirming Drop D (US5-4, quickstart scenario 9).

### Implementation for User Story 5

- [X] T030 [P] [US5] Create `src/lib/shell/InstrumentSummary.svelte`: one `<button>` with text `m.instrument_summary_standard()` when `tuningId === 'AF-1'`, otherwise `m.instrument_summary_preset({ name })` (name from `m.tuning_afN()`); opens the panel with itself as the opener.
- [X] T031 [US5] Modify `src/lib/shell/HomeScreen.svelte` (depends on T030) to place `InstrumentSummary` in the `data-zone="bottom"` slot.
- [X] T032 [P] [US5] Modify `src/lib/shell/ToolCard.svelte` to pass `instrument.current` to its thumbnail `Fretboard` (FR-008).
- [X] T033 [US5] Add responsive panel CSS in `src/lib/shell/InstrumentPanel.svelte`: default bottom sheet (full inline size, block-end anchored, `max-block-size` from the T002 token, internal scroll, long names wrap); `@media (min-width: 1024px)` side panel at inline end with the tokenized inline size and full block size (repeat the documented breakpoint literal, as `tokens.css` does); no slide-in animation under `prefers-reduced-motion`. Verify at 320 px, 1024 px and 2560 px. Makes T027–T029 pass.

**Checkpoint**: US1 and US5 both work independently; the feature is discoverable on every screen.

---

## Phase 5: User Story 2 - Change the fret count (Priority: P2)

**Goal**: Set 12–24 frets (default 22) with a bounded stepper; every tool follows.

**Independent Test**: Set frets to 12 and confirm: every tool's fretboard ends at fret 12 and nothing is drawn past it.

### Tests for User Story 2 ⚠️ (write first, ensure they FAIL)

- [X] T034 [P] [US2] Write `tests/unit/fret-stepper.test.ts`: `spinbutton` named "Frets" with `aria-valuemin=12`, `aria-valuemax=24`, `aria-valuenow`; ArrowUp/ArrowDown ±1, Home → 12, End → 24; "Fewer frets" `disabled` at 12, "More frets" `disabled` at 24, no error message; no free-text entry; buttons ≥ `--target-min`.
- [X] T035 [P] [US2] Extend `tests/unit/instrument-panel.test.ts` (fret part): default open shows 6 strings, Standard checked, 22 frets (US2-3); the stepper edits pending only and the preview re-renders with the new fret count.
- [X] T036 [US2] Extend `e2e/instrument-panel.spec.ts` (US2 part): quickstart scenario 3 (End → 24 with "More frets" disabled; Home → 12 with "Fewer frets" disabled; Confirm with 12 → Notes and Triads end at fret 12); a value outside 12–24 cannot be entered (US2-2).

### Implementation for User Story 2

- [X] T037 [US2] Create `src/lib/shell/FretStepper.svelte` per R-08: `role="spinbutton"` labelled `m.instrument_frets_label()` with `aria-valuemin="12"`, `aria-valuemax="24"`, `aria-valuenow`, flanked by `button`s `m.instrument_frets_decrease()` / `m.instrument_frets_increase()` (≥ `--target-min`, native `disabled` at the ends); keys ArrowUp/ArrowDown ±1 via `instrument.stepFrets`, Home/End via `instrument.setFrets(12 | 24)`. Makes T034 pass.
- [X] T038 [US2] Add `FretStepper` to `src/lib/shell/InstrumentPanel.svelte` between the tuning group and the preview, in tab order (depends on T037). Makes T035 and T036 pass.

**Checkpoint**: Fret count configurable end to end; US1, US5, US2 independently functional.

---

## Phase 6: User Story 3 - Cancel and restore default safely (Priority: P2)

**Goal**: Every non-Confirm close discards pending edits and leaves the user on the same screen; Restore default resets to Standard/22.

**Independent Test**: Change tuning, close without confirming: previous tuning remains. With Drop D / 16 frets active, Restore default then Confirm applies Standard/22 and removes the badge.

### Tests for User Story 3 ⚠️ (write first, ensure they FAIL)

- [X] T039 [P] [US3] Extend `tests/unit/instrument-panel.test.ts` (cancel/restore part): Escape (`cancel` event), "Close", and a click whose target is the `<dialog>` itself each discard pending edits, return focus to the opener and leave `active` unchanged (SC-005); reopening shows the active config with its preset checked (FR-009); "Restore default" sets the pending config to Standard/22 without applying it (FR-010).
- [X] T040 [P] [US3] Extend `tests/unit/screens.test.ts` or add `tests/unit/layout-shallow-history.test.ts`: the layout's `beforeNavigate`/`afterNavigate` ignore navigations whose URL path does not change (shallow pops) — no playback stop, no focus move to `h1`.
- [X] T041 [US3] Extend `e2e/instrument-panel.spec.ts` (US3 part): quickstart scenario 4 — pick Open G and 16 frets, then dismiss with Escape, Close, backdrop click and browser Back; each time the same screen and URL remain, history length equals the length before opening, Standard/22 is still active, reopening shows Standard checked and 22; scenario 5 (Restore default → Confirm → badge gone, 22 frets); scenario 10 (Confirm with no changes: no status, playback continues); scenario 11 (reload resets to Standard/22, no badge).

### Implementation for User Story 3

- [X] T042 [US3] Add the "Restore default" button (`m.instrument_restore_default()`, ≥ `--target-min`) to `src/lib/shell/InstrumentPanel.svelte`, wired to `instrument.restoreDefault()`, placed before Confirm in tab order.
- [X] T043 [US3] Wire all discard paths in `src/lib/shell/InstrumentPanel.svelte`: the dialog `cancel` event (Escape) calls `instrument.cancel()`; a `click` whose `target` is the `<dialog>` element (backdrop) and the Close button do the same; each returns focus to the opener.
- [X] T044 [US3] Implement Back-closes-panel (R-07) in `src/lib/shell/InstrumentPanel.svelte` and `src/lib/state/instrument.svelte.ts`: opening calls `pushState('', { instrumentPanel: true })` from `$app/navigation`; an effect on `page.state.instrumentPanel` (from `$app/state`) calls `instrument.cancel()` when a Back press pops it; every other close (Confirm, Escape, Close, backdrop) calls the store action then `history.back()` so net history is unchanged; the URL never changes. Declare `App.PageState` with `instrumentPanel?: boolean` in `src/app.d.ts`.
- [X] T045 [US3] Modify `src/routes/+layout.svelte` to guard `beforeNavigate` (playback stop) and `afterNavigate` (focus to `h1`) so they ignore navigations whose URL path does not change (shallow pops), letting focus return to the opener. Makes T039–T041 pass.

**Checkpoint**: Safe experimentation works through all four dismissal paths; US1, US5, US2, US3 independent.

---

## Phase 7: User Story 4 - View adjusts when the new instrument makes it impossible (Priority: P3)

**Goal**: Impossible views clamp to the nearest equivalent with the notice "We adjusted the view to the new instrument"; whole-neck regions follow silently; scroll position corrects.

**Independent Test**: In Notes set region 10–14, cut frets to 12, confirm: region becomes 10–12 and the notice appears. A whole-neck region becomes 0–12 with no notice.

### Tests for User Story 4 ⚠️ (write first, ensure they FAIL)

- [X] T046 [P] [US4] Write `tests/unit/state/notes-adapt.test.ts` for `adaptNotesView(s, prev, next)` per data-model §5.1: whole-neck region `0..prev.fretCount` → `0..next.fretCount` with `adjusted = false` (card still valid); end ≤ `next.fretCount` and card valid → same object, `adjusted = false`; 10–14 → 10–12 with `adjusted = true`; both ends > `next.fretCount` → `next.fretCount..next.fretCount` with `adjusted = true`; card on a fret > `next.fretCount` closes with `adjusted = true`; whole-neck with a closed card still `adjusted = true`; fret increase never adjusts; selection, label type, background, hide-names and active strings unchanged.
- [X] T047 [P] [US4] Extend `tests/unit/state/notes-store.test.ts`: `applyInstrument` uses the whole-neck rule (a 22 → 12 change keeps a whole-neck region whole without `adjusted`) and returns `true` for region 10–14 → 10–12.
- [X] T048 [P] [US4] Extend `tests/unit/fretboard/geometry.test.ts` for `trailingEdgeScroll(layout, viewportWidth)`: the result puts the last fret at the trailing edge; never negative; 0 when the content fits the viewport.
- [X] T049 [P] [US4] Extend the Notes and Triads tool component tests (`tests/unit/notes/`, `tests/unit/triads/`): a `status` "We adjusted the view to the new instrument" with "Dismiss" is shown iff `instrument.adjustedIn === <this tool>` and the tool's own notice is null; it clears on Dismiss, on the next confirm, on navigation away, and when the tool's own notice becomes non-null (R-05).
- [X] T050 [US4] Extend `e2e/instrument-panel.spec.ts` (US4 part): scenario 6 (Notes 10–14 → 12 frets → region 10–12, polite status with Dismiss; whole-neck region → 0–12 with no status); scenario 7 (Triads highest occurrence → 12 frets → lower occurrence of the same shape with the status; if no shape exists, EC-5.1 guidance shows); scenario 8 (at 360 px scroll to fret 22, set 12 frets, Confirm → the last fret is at the trailing edge, no status; `prefers-reduced-motion: reduce` jumps instantly); US4-4 (valid view → no message).

### Implementation for User Story 4

- [X] T051 [US4] Implement `adaptNotesView(s, prev, next): { view, adjusted }` in `src/lib/state/notes-view.ts` per data-model §5.1 (the whole-neck check is `s.region.start === 0 && s.region.end === prev.fretCount`; otherwise the existing `revalidate` runs and `adjusted = result !== s`; a card on a position that no longer exists closes). Pure. Makes T046 pass.
- [X] T052 [US4] Change `applyInstrument` in `src/lib/state/notes.svelte.ts` to call `adaptNotesView(view, previousInstrument, next)` and return its `adjusted` (depends on T051). Makes T047 pass.
- [X] T053 [P] [US4] Add `trailingEdgeScroll(layout, viewportWidth): number` to `src/lib/fretboard/geometry.ts`. Makes T048 pass.
- [X] T054 [US4] Implement scroll correction in the interactive variant of `src/lib/fretboard/Fretboard.svelte` (R-11, depends on T053): a `$effect.pre` records `scrollLeft` and the old total width when `instrument.fretCount` changes; if the old `scrollLeft` exceeds the new maximum, hold content `min-inline-size` at the old width for one animation, run the existing `animateScroll` (injectable clock) to `trailingEdgeScroll(...)` over `--duration-short`, then release the hold; under `prefers-reduced-motion` the token is `0s` and no hold is applied. Never sets a notice (FR-014).
- [X] T055 [P] [US4] Render the adjustment `Notice` in `src/lib/tools/notes/NotesTool.svelte`, visible iff `instrument.adjustedIn === 'notes'` and the tool's own notice is null; Dismiss calls `instrument.dismissAdjusted()`; text `m.instrument_adjusted()`.
- [X] T056 [P] [US4] Render the same notice in `src/lib/tools/triads/TriadsTool.svelte` for `adjustedIn === 'triads'` (one notice line at a time; own compare/region notices win).
- [X] T057 [US4] In `src/lib/state/instrument.svelte.ts` clear `adjustedIn` on screen change and at the start of the next confirm (R-05); confirm the `+layout.svelte` `beforeNavigate` hook calls `dismissAdjusted()` for real screen changes only. Makes T049 and T050 pass.

**Checkpoint**: All five stories independently functional; no view ever shows frets past the last fret (SC-006).

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: ADR, performance and accessibility gates, final validation

- [X] T058 [P] Write `docs/adr/0012-app-wide-instrument-store-and-panel.md` recording the app-wide instrument store, the confirm orchestration, and the temporary shallow-history entry for Back (plan Complexity Tracking).
- [X] T059 [P] Add an "instrument change ≤ 300 ms" measurement to `e2e/perf.spec.ts` (Confirm click → fretboard re-rendered with the new open-string label, SC-001).
- [X] T060 [P] Add axe zero-violation checks to `e2e/instrument-panel.spec.ts` with the panel open on the phone 360 px, phone-touch and desktop profiles, and on tools showing the badge; add a 200 % text-zoom check at 320 px (no truncation of preset names, summary or badge) and a keyboard-only run of quickstart scenario 13 (Tab never leaves the panel, focus returns to the opener).
- [X] T061 [P] Run and, if needed, extend `tests/unit/no-raw-text.test.ts` and `tests/unit/reserved-colors.test.ts` to cover `InstrumentPanel`, `FretStepper`, `InstrumentButton`, `TuningBadge` and `InstrumentSummary` (no raw text, no root/third/fifth colors, tokens only).
- [X] T062 [P] Add an E2E check of spelling (quickstart scenario 12): Half step down lists "E♭ A♭ D♭ G♭ B♭ E♭", Open D lists "D A D F♯ A D", and the accessible names read "E flat…" / "F sharp".
- [X] T063 Run all gates from quickstart.md and fix failures: `pnpm check`, `pnpm lint` (import boundaries), `pnpm format:check`, `pnpm test:unit` (theory ≥ 95 %, overall ≥ 80 %; TM-4/TM-5 and NFR-9.3 suites unchanged and green), `pnpm build:test && pnpm test:e2e` (TM-9 screenshots unchanged), `pnpm lhci` (initial JS ≤ 80 KB gzip, Lighthouse mobile ≥ 90).
- [X] T064 Walk quickstart.md manual scenarios 1–13 in `pnpm dev` and tick each off.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none; start immediately.
- **Foundational (Phase 2)**: depends on Setup; BLOCKS all user stories.
- **US1 (Phase 3)**: depends on Foundational.
- **US5 (Phase 4)**: depends on Foundational and on the panel from US1 (T021, T022); otherwise independent.
- **US2 (Phase 5)**: depends on the panel from US1 (T021).
- **US3 (Phase 6)**: depends on the panel from US1 (T021); T033 (responsive CSS) is not required.
- **US4 (Phase 7)**: depends on Foundational and on the panel from US1 for the E2E; unit work (T046–T053) is independent of the UI.
- **Polish (Phase 8)**: after all desired stories.

### Within Phases

- Task order: tests → pure modules → stores → components → E2E verification.
- T005 before T006 (config imports presets); T005 before T007; T009 and T011 before T013; T019 before T020; T020 and T021 before T022; T023 and T024 before T025; T051 before T052; T053 before T054.
- Same-file edits are sequential: `InstrumentPanel.svelte` (T021 → T033 → T038 → T042 → T043 → T044), `instrument.svelte.ts` (T013 → T044 → T057), `notes.svelte.ts` (T011 → T052), `+layout.svelte` (T022 → T045 → T057), `e2e/instrument-panel.spec.ts` (T018 → T029 → T036 → T041 → T050 → T060 → T062).

### Parallel Opportunities

- Setup: T001 ‖ T002.
- Foundational: T003 ‖ T004 ‖ T008 ‖ T010 ‖ T012 (tests, different files); then T005, T009, T011 in parallel (T006 after T005).
- US1: T014 ‖ T015 ‖ T016 ‖ T017; T019 ‖ T023 ‖ T024.
- US5: T027 ‖ T028; T030 ‖ T032.
- US2: T034 ‖ T035.
- US3: T039 ‖ T040.
- US4: T046 ‖ T047 ‖ T048 ‖ T049; T053 ‖ T055 ‖ T056.
- Polish: T058 ‖ T059 ‖ T060 ‖ T061 ‖ T062.
- After US1's panel exists, US2, US3, US4 and US5 can proceed in parallel by different developers, merging at `InstrumentPanel.svelte`.

## Parallel Example: Foundational tests

```bash
Task: "Table test 66 rows in tests/unit/instrument/tunings.test.ts"            # T003
Task: "Transition tests in tests/unit/state/instrument-config.test.ts"          # T004
Task: "applyInstrument tests in tests/unit/state/triads-store.test.ts"          # T008
Task: "applyInstrument tests in tests/unit/state/notes-store.test.ts"           # T010
Task: "Confirm orchestration tests in tests/unit/state/instrument-store.test.ts" # T012
```

## Implementation Strategy

### MVP First (US1, then US5)

1. Phase 1 Setup → Phase 2 Foundational (tests first, all green).
2. Phase 3 US1 → STOP and validate: Drop D flow from a tool (quickstart scenarios 1–2).
3. Phase 4 US5 (both P1) → home summary, thumbnails, responsive layout. This is the shippable MVP.

### Incremental Delivery

1. Add US2 (fret count) → validate scenario 3.
2. Add US3 (cancel, Restore default, Back) → validate scenarios 4, 5, 10, 11.
3. Add US4 (adjustment, scroll correction) → validate scenarios 6–8.
4. Polish → gates T063 and manual walk T064.

## Notes

- [P] = different files, no dependency on an incomplete task.
- Presets are authored in TM-2 spelling and never re-derived or respelled (FR-005, FR-019). Note names come only from `src/lib/notation`.
- No `src/lib/theory` change. If any existing theory suite fails, stop and investigate; do not edit theory code in this slice.
- No new runtime dependency, no storage and no URL state (FR-018).
- Commit after each task or logical group; Conventional Commits.
