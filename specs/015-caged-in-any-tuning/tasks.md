---

description: "Task list for CAGED Across Tunings (slice 015)"
---

# Tasks: CAGED Across Tunings

**Input**: Design documents from `/specs/015-caged-in-any-tuning/`

**Prerequisites**: plan.md, spec.md, research.md (R-01…R-15), data-model.md, contracts/caged-api.md, contracts/caged-ui.md, quickstart.md

**Tests**: REQUIRED. Constitution Principle IV (test-first for logic) and the contracts list mandatory tests (T1–T14, P1–P6, M1–M9, E1–E14, A1–A4). Write each test first and watch it fail before the implementation task that follows it.

**Organization**: Grouped by user story. US1 (P1) is the MVP; US2 (P2) and US3 (P3) build on the shared foundation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on an incomplete task
- **[Story]**: US1, US2, US3 (story phases only)

## Path Conventions

Single SvelteKit project at repo root: `src/lib/…`, `src/routes/`, `messages/`, `tests/unit/`, `e2e/`, `docs/adr/`.

**Local verification (CLAUDE.md tiers)**: per task `pnpm vitest run <touched test paths>`; e2e `pnpm build:test` once after `src/` changes, then `pnpm test:e2e:fast <spec files>`; screenshots via the `--update-snapshots` three-project command; `pnpm verify` once at the end. Never run `pnpm test:e2e` or `pnpm lhci` locally.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: catalog keys and ADR stub that every story needs.

- [X] T001 Add the 9 new catalog keys to `messages/en.json` with the exact English text from contracts/caged-ui.md §5: `caged_tuning_unsupported`, `caged_view_in_standard`, `caged_go_to_triads`, `caged_temporary_badge`, `caged_temporary_badge_label`, `caged_altered_mark`, `caged_description_tuning`, `caged_description_temporary`, `caged_description_altered`. Do NOT remove `caged_tuning_unavailable` yet (removed in T028 once its last use is gone).
- [X] T002 [P] Create `docs/adr/0018-caged-tuning-classes-and-temporary-tuning.md` (status Accepted, follow the format of existing ADRs in `docs/adr/`). Record: three tuning classes drive behavior; placement from string 5 (R-02); temporary tuning is CAGED-local and never stored (R-06); amends ADR 0017's "only compatible draws" (R-15); non-dismissible fallback notice (plan Complexity Tracking).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: shared theory placement change, `alteredString` flag, tag-text helper, and model/store plumbing for tuning name and context. Everything here is behavior-neutral for Standard (slice 014 tests must still pass).

**⚠️ CRITICAL**: No user story work starts until this phase is complete.

- [X] T003 [P] Write failing tests in `tests/unit/theory/caged.test.ts`: T7 (AF-2, E♭ major: first E occurrence `start` 0, root notes on strings 6, 4, 1), T8 (AF-2, G♭ major: E occurrence `start` 3), T9 (AF-21/AF-22/AF-23 strings 6→1 equal AF-1/AF-2/AF-1 drawings, string 7 has no note), T12 (`occurrenceRootStrings`: compatible → table order descending; and for a hand-built occurrence with `alteredString: true`, E → [4, 1], G → [3, 1]), T14 (existing TM-6.1, TM-6.2, TM-7.1, fit-count suites untouched and passing).
- [X] T004 [P] Write failing property test P6 in `tests/unit/theory/caged.property.test.ts` (fast-check): for compatible tunings, `cagedOccurrences` output is identical to the slice-014 behavior (string-5 shift equals the previous string-6-based shift). Capture the slice-014 expected values from the existing table tests, not from the new code.
- [X] T005 In `src/lib/theory/caged.ts`: add `readonly alteredString: boolean` to `ShapeOccurrence` (false for every compatible occurrence); change placement to `shift = mod12(rootPc − (pc(open[string 5]) − 9))` per data-model §2 and R-02, keeping candidate octave offsets −12, 0, +12, +24 and the fit rule (every table note on the positioning strings, 6→1 for compatible, in `0…fretCount`); export `occurrenceRootStrings(occ)` per contracts/caged-api.md §1 (descending; drops string 6 when `occ.alteredString`). Makes T003/T004 pass. Theory stays pure: imports `./pitch` and `./triad` only.
- [X] T006 [P] Update existing and add failing tests in `tests/unit/state/caged-model.test.ts` for the new signatures: `buildCagedModel(view, instrument, { tuningName, temporary })` and `cagedTagText(occ)` taking the occurrence; M8 (description order: tuning sentence first via `caged_description_tuning`; altered sentence only when altered; string-6 notes listed). Keep all slice-014 expectations except the interim non-compatible text (handled in US1).
- [X] T007 In `src/lib/state/caged-model.ts`: add `CagedContext { tuningName: string; temporary: boolean }`; extend `CagedDisplay` with `tuningName`, `temporaryName` (null unless temporary), `unsupportedNotice` (null for now); change `cagedTagText` to take a `ShapeOccurrence` and build "roots on strings" from `occurrenceRootStrings`; prepend the tuning sentence (`caged_description_tuning`, or `caged_description_temporary` when temporary) to `description`. Makes T006 pass. No theory logic in components.
- [X] T008 [P] Write failing store tests in `tests/unit/state/caged-store.test.ts`: `applyInstrument(next, tuningName)` stores `preferred` and `tuningName`, keeps the view (FR-011) and returns `false`; `useInstrument(next, tuningName?)` test hook; `resetCagedForTests(next?, tuningName?)`.
- [X] T009 In `src/lib/state/caged.svelte.ts`: rename the stored instrument to `preferred` (`$state.raw<Instrument>`), add `tuningName` (`$state<string>`), make `instrument` a `$derived` getter (equals `preferred` for now), pass `{ tuningName, temporary: false }` to `buildCagedModel`, change `applyInstrument(next, tuningName)` and `useInstrument`, update `resetCagedForTests`. Makes T008 pass.
- [X] T010 [P] Write failing test in `tests/unit/state/instrument-store.test.ts`: `confirm` and `restore` call `caged.applyInstrument(inst, tuningLabel(config.tuning))` (preset name or "Custom").
- [X] T011 In `src/lib/state/instrument.svelte.ts`: pass `tuningLabel(config.tuning)` in the `confirm` and `restore` calls to `caged.applyInstrument`. Makes T010 pass. Run `pnpm vitest run tests/unit/theory tests/unit/state` and confirm slice-014 CAGED suites still pass.

**Checkpoint**: Foundation ready. Standard behavior unchanged; theory exposes `alteredString` and `occurrenceRootStrings`; store/model carry tuning name and context.

---

## Phase 3: User Story 1 - Honest CAGED in a non-compatible tuning (Priority: P1) 🎯 MVP

**Goal**: Non-compatible tunings show the explanation plus **View in standard tuning** and **Go to Triads**; the temporary standard view works with a permanent badge, is never stored, and ends on leave/reload/confirm.

**Independent Test**: Seed Open G, open CAGED: no markers/tags/fit note, notice text and two buttons; View in standard tuning draws C major's five shapes with badge "Temporary tuning: Standard" while the stored prefs stay AF-8.

### Tests for User Story 1 (write first, confirm they fail) ⚠️

- [X] T012 [P] [US1] Add `standardCounterpart` tests to `tests/unit/instrument/tunings.test.ts`: AF-8 at 6 strings with 24 frets, left-handed, lowest-top → AF-1 with same frets/handedness/orientation; 7-string AF-10 → AF-21; custom → standard for its count; repeated calls return the same reference.
- [X] T013 [P] [US1] Add model tests in `tests/unit/state/caged-model.test.ts`: M1 (Open G, C major: `model === null`, `occurrences = []`, `unsupportedNotice` equals the FR-016 text containing "Open G"), M2 (custom non-compatible names "Custom"), M7 (`temporary: true` on a 7-string instrument → `temporaryName = '7-string standard'`, description starts "Temporary tuning: 7-string standard.").
- [X] T014 [P] [US1] Add store tests in `tests/unit/state/caged-store.test.ts`: `viewInStandard` is a no-op unless class is non-compatible; it keeps the view, switches class to compatible and calls `playback.stop('instrument')` once; `selectRoot`/`setQuality`/`switchSpelling`/`reset` keep `temporary`; `screenChanged` and `endTemporary` clear it; `activate` plays on the standard instrument while temporary.
- [X] T015 [P] [US1] Add tests in `tests/unit/state/instrument-store.test.ts`: `confirm` (changed or unchanged) ends the temporary tuning; `cancel` keeps it; `preferences.remember` is never called by `viewInStandard`/`endTemporary` (SC-005).
- [X] T016 [P] [US1] Add test in `tests/unit/state/links-store.test.ts`: `openTriadsFromCaged()` calls `goto('/triads')` exactly once and leaves the `triads` state unchanged.
- [X] T017 [P] [US1] Add temporary-variant tests in `tests/unit/tuning-badge.test.ts`: while `caged.temporaryName !== null` the badge shows visible text "Temporary tuning: Standard" with accessible name "Temporary tuning: Standard. Open instrument panel", replaces the FR-2.10 badge, activation opens the instrument panel (same `rememberOpener` path).
- [X] T018 [P] [US1] Rewrite the interim-message case in `tests/unit/caged/caged-tool.test.ts`: non-compatible shows `<p role="status">` with the FR-016 text and buttons in order **View in standard tuning**, **Go to Triads**; key/quality controls remain with their values; no fretboard, tags or fit note; clicking View in standard tuning calls `caged.viewInStandard()` and moves focus to `#caged-zone-c`; Go to Triads calls `openTriadsFromCaged`.
- [X] T019 [US1] Create `e2e/caged-tunings.spec.ts` with E1–E8 and axe A1/A2 per contracts/caged-ui.md §7. Seed `localStorage['fretboard-master:prefs']` (v1 record) before `goto` so the stored preference can be asserted unchanged. E1 Open G notice/buttons/0 markers/0 tags/no fit note; E2 View in standard, C major → 5 tags as Standard, badge, prefs still AF-8; E3 go to Notes and back → notice again; E4 Go to Triads → `/triads` with FR-2.10 badge "Open G"; E5 Standard → DADGAD via panel Confirm → notice, key/quality kept; E6 7-string non-compatible → badge "Temporary tuning: 7-string standard", 7 string rows; E7 key/quality change keeps badge, reload → notice; E8 badge opens panel with Open G selected, Cancel keeps temporary, Confirm ends it; A1 axe on notice, A2 axe on temporary view (include 320 px).
- [X] T020 [P] [US1] Edit the interim-message expectations for NON-COMPATIBLE ids only in `e2e/caged.spec.ts` (Q18 list, "axe: … shows the message"): they now expect the new notice. Leave AF-4/Drop D cases for T046 (US3). Edit, do not delete.
- [X] T021 [P] [US1] Add perf case "CAGED instrument change to DADGAD ≤ 300 ms" to `e2e/perf.spec.ts` (SC-006), using the existing perf helpers in that file.

### Implementation for User Story 1

- [X] T022 [P] [US1] Implement `standardCounterpart(inst)` in `src/lib/instrument/tunings.ts`: `withPresentation(presetInstrument(standardTuningId(inst.stringCount), inst.stringCount, inst.fretCount), inst.handedness, inst.orientation)` (memoized through `presetInstrument`). Makes T012 pass.
- [X] T023 [US1] In `src/lib/state/caged-model.ts`: when the effective class is non-compatible, return `model: null`, `occurrences: []`, `fitCount` 0, `fitNote: null`, and `unsupportedNotice` = `caged_tuning_unsupported({ tuning: tuningName })`; set `temporaryName` to the effective (standard) tuning name when `context.temporary`. Makes T013 pass.
- [X] T024 [US1] In `src/lib/state/caged.svelte.ts`: add `temporary` (`$state<boolean>`, false initially), make `instrument` = `temporary ? standardCounterpart(preferred) : preferred`, expose `temporary` and `temporaryName`, add `viewInStandard()` (precondition: class non-compatible and `!temporary`; sets flag; `playback.stop('instrument')`), `endTemporary()` (precondition `temporary`; clears flag; `playback.stop('instrument')`), `screenChanged()` → `endTemporary()`; `activate` plays on the effective instrument; key/quality/spelling/reset leave `temporary` alone. Makes T014 pass. Depends on T022, T023.
- [X] T025 [US1] In `src/lib/state/instrument.svelte.ts`: `confirm(screen)` calls `caged.endTemporary()` before computing `result.changed` (so an unchanged confirm still ends it); `cancel()` does not touch CAGED. Makes T015 pass. Depends on T024.
- [X] T026 [P] [US1] Add `openTriadsFromCaged(): Promise<void>` to `src/lib/state/links.svelte.ts`: `goto('/triads')` under the preferred instrument, no musical-context carry. Makes T016 pass.
- [X] T027 [P] [US1] In `src/routes/+layout.svelte`: in `beforeNavigate`, call `caged.screenChanged()` beside `instrument.screenChanged()` on a real path change (ignore shallow same-path pops, as today).
- [X] T028 [US1] In `src/lib/tools/caged/CagedTool.svelte`: replace the slice-014 interim text with the non-compatible zone (contracts/caged-ui.md §1, §2): `<div class="unsupported"><p role="status">` with `display.unsupportedNotice` and two native `<button type="button">`s (**View in standard tuning** → `caged.viewInStandard()` then focus `#caged-zone-c`; **Go to Triads** → `openTriadsFromCaged()`), neutral text colour `--color-text`, targets ≥ `--target-min`, wrap on narrow widths. No fretboard/tags/fit note in this state; zone B and D stay. Then remove `caged_tuning_unavailable` from `messages/en.json` and any other reference. Use only catalog keys (`no-raw-text`). Makes T018 pass.
- [X] T029 [US1] In `src/lib/shell/TuningBadge.svelte`: while `caged.temporaryName !== null`, render the temporary variant in place of the FR-2.10 badge (visible `caged_temporary_badge({ name })`, accessible name `caged_temporary_badge_label({ name })`, same opener/`instrument.open()` path, no time-out, visible at every viewport width). Makes T017 pass.
- [X] T030 [US1] Run `pnpm vitest run tests/unit/instrument tests/unit/state tests/unit/caged tests/unit/tuning-badge.test.ts`, then `pnpm build:test` and `pnpm test:e2e:fast e2e/caged-tunings.spec.ts e2e/caged.spec.ts e2e/perf.spec.ts`; fix failures.
- [X] T031 [US1] Add screenshot "Open G notice" to `e2e/caged-tm9.spec.ts` and generate it with `pnpm playwright test e2e/caged-tm9.spec.ts -g "Open G notice" --project=phone --project=phone-touch --project=desktop --update-snapshots`; inspect the three images before committing.

**Checkpoint**: US1 fully functional and testable on its own (MVP).

---

## Phase 4: User Story 2 - Transposed compatible tunings (Priority: P2)

**Goal**: Half step down, Whole step down, 7-string standard/half step down and Drop A draw the Standard shapes with real-tuning notes and pitches, names unchanged, no badge or "altered" mark.

**Independent Test**: Half step down, E♭ major: E shape at fret 0 tagged "E shape · roots on strings 6, 4, 1" with E♭2/E♭3/E♭4 roots; G♭ major: E shape starts at fret 3, spells G♭–B♭–D♭.

Foundational T005 already supplies the string-5 placement; this story proves compatible behavior end to end and fixes any gap found.

### Tests for User Story 2 ⚠️

- [X] T032 [P] [US2] Add model tests in `tests/unit/state/caged-model.test.ts`: M5 (Standard and Half step down: no `stringMarks`; tag text equals Standard's), M6 (Half step down, E♭ major: root markers at fret 0 spell E♭; pitches E♭2/E♭3/E♭4 via `positionPitch`).
- [X] T033 [P] [US2] Add E9 and E10 to `e2e/caged-tunings.spec.ts`: E9 Half step down with E♭ major and G♭ major → tag text "E shape · roots on strings 6, 4, 1", marker names E♭ / G♭–B♭–D♭, E start fret 0 / 3; E10 AF-3, AF-21, AF-22, AF-23 (and Drop A) → shapes drawn, no "altered" text, no temporary badge, string 7 has no markers.

### Implementation for User Story 2

- [X] T034 [US2] Run `pnpm vitest run tests/unit/state/caged-model.test.ts tests/unit/theory/caged.test.ts` and `pnpm test:e2e:fast e2e/caged-tunings.spec.ts`. Fix any mismatch in `src/lib/state/caged-model.ts` (spelling or pitch from the real tuning, FR-002/FR-017) or `src/lib/theory/caged.ts`. If nothing needs fixing, record that and tick the task. *(Result: no source fix needed; unit M5/M6 + e2e E9/E10 pass against the foundation placement.)*

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Altered lowest string (Drop D, Drop C) (Priority: P3)

**Goal**: Drop D/Drop C draw shapes on strings 5→1 as in Standard/Whole step down; string 6 shows region-computed chord tones for G and E shapes only, carries the visible "altered" text mark, and tags omit string 6.

**Independent Test**: Drop D, D major: E shape string 6 shows exactly D (R) at fret 12; G shape exactly A (5) at fret 7; C/A/D shapes none; "altered" visible; tags "E shape · roots on strings 4, 1" and "G shape · roots on strings 3, 1".

### Tests for User Story 3 ⚠️

- [X] T035 [P] [US3] Add theory tests in `tests/unit/theory/caged.test.ts`: T1 (Drop D, every key × quality: strings 5→1 notes and `start` per shape equal AF-1's), T2 (Drop C equals AF-3 on strings 5→1), T3 (Drop D, D major, E shape: string 6 = `[{string 6, fret 12, R}]`, span 10–12), T4 (G shape: `[{string 6, fret 7, '5'}]`, span 7–10, nothing at 10), T5 (altered, any C/A/D shape major+minor: no string-6 note), T6 (region with no chord tone: occurrence still returned, no string-6 note), T10 (`presetStrings('AF-4', 7)` → class `altered-string`, T3 holds), T11 (AF-6…AF-11 and malformed input → `[]`), T13 (`alteredStringNotes`: minor uses `b3`, several notes possible, `lo > hi` → `[]`).
- [X] T036 [P] [US3] Add properties P1–P5 to `tests/unit/theory/caged.property.test.ts` (fast-check over random altered tunings = random compatible base + string-6 delta in `[−11, 11] \ {0}`, all keys, both qualities, 12–24 frets): P1 strings 5→1 equal the compatible base; P2 every string-6 note's real pitch class is a chord tone matching its degree and `start ≤ fret ≤ end`; P3 string-6 notes only in G and E shapes; P4 no string-6 note has the table's degree at the table fret; P5 every string 5→1 fret in `0…fretCount` and fit depends on strings 5→1 only.
- [X] T037 [P] [US3] Add model tests in `tests/unit/state/caged-model.test.ts`: M3 (Drop D, D major: `stringMarks = [{6, 'altered'}]`; string-6 markers exactly frets 7 (A, '5') and 12 (D, 'R'); tags "E shape · roots on strings 4, 1" and "G shape · roots on strings 3, 1"), M4 (Drop D any key: `stringMarks` present even with no string-6 marker), M9 (Drop D string 6 fret 12 spells D and `positionPitch` = D3), M8 altered sentence (`caged_description_altered` with string 6, only when altered).
- [X] T038 [P] [US3] Add renderer tests in `tests/unit/fretboard/fretboard.test.ts`: mark text renders in the string-6 row for all four handedness × orientation combinations; a mark for a string the instrument lacks is ignored; the mark is `aria-hidden` (not in the accessibility tree).
- [X] T039 [P] [US3] Add geometry tests in `tests/unit/fretboard/geometry.test.ts`: the label column uses `--fb-label-col-marked` width only when `stringMarks` is non-empty, otherwise `--fb-label-col`.
- [X] T040 [US3] Add E11–E13 and axe A3/A4 to `e2e/caged-tunings.spec.ts`: E11 Drop D D major → "altered" visible, string-6 markers only at frets 7 and 12 in the E/G regions, tags omit 6; E12 Drop D with a C/A/D-only window or an empty region → mark present with no string-6 marker; E13 Drop C occurrence tags start where Whole step down's do; A3 axe on Drop D; A4 axe on left-handed + lowest-top Drop D with mark mirrored, plus 320 px.
- [X] T041 [P] [US3] Edit the AF-4/Drop D interim cases in `e2e/caged.spec.ts` (Q18 list, "axe: Drop D shows the message"): AF-4 now draws shapes with the "altered" mark. Edit, do not delete.

### Implementation for User Story 3

- [X] T042 [US3] In `src/lib/theory/caged.ts`: export `alteredStringNotes(open6, rootPc, quality, lo, hi)` (frets `f ∈ [lo, hi]` where `pc(open6 + f)` is root → `R`, major third → `3` / minor third → `b3`, fifth → `5`; ascending; total; `lo > hi` → `[]`). In `cagedOccurrences`, for class `altered-string`: position and fit from strings 5→1 only, discard the table's string-6 cell, set `alteredString: true`, and for G and E shapes (major and minor) append `alteredStringNotes(open6, rootPc, quality, start, end)`; C, A, D shapes get no string-6 note. Class `non-compatible` or malformed → `[]`. Makes T035/T036 pass (`start`/`end` are the chord-fret span on strings 5→1).
- [X] T043 [P] [US3] In `src/lib/fretboard/types.ts` add `readonly stringMarks?: readonly { readonly string: number; readonly label: string }[]` to `DisplayModel`. Add token `--fb-label-col-marked` in `src/lib/styles/tokens.css` and its metric in `src/lib/fretboard/metrics.ts`; in `src/lib/fretboard/geometry.ts` use the marked width only when marks exist. Makes T039 pass.
- [X] T044 [US3] In `src/lib/fretboard/Fretboard.svelte`: draw each `stringMarks[i].label` as `aria-hidden` SVG text in the label column of its string's row (below the string-number/open-note label), positioned via `labelCenter` so handedness and orientation mirror for free; ignore marks for strings not on the instrument; neutral text token colour, no new colour, no motion. Makes T038 pass. Depends on T043.
- [X] T045 [US3] In `src/lib/state/caged-model.ts`: for class `altered-string` emit `stringMarks: [{ string: 6, label: m.caged_altered_mark() }]` (also when no string-6 marker exists and also for C/A/D-only boards); render string-6 region markers with the same spelling (`spellTriad`), degree label and `"string:fret"` ids as other markers (deduplicated across occurrences); add `caged_description_altered` (string 6) after the tuning sentence; keep root strings via `occurrenceRootStrings`; never emit `stringMarks` for compatible, non-compatible or temporary views. Makes T037 pass. Depends on T042, T044.
- [X] T046 [US3] Run `pnpm vitest run tests/unit/theory tests/unit/state tests/unit/fretboard`, then `pnpm build:test` and `pnpm test:e2e:fast e2e/caged-tunings.spec.ts e2e/caged.spec.ts`; fix failures.
- [X] T047 [US3] Add screenshot "Drop D, D major" to `e2e/caged-tm9.spec.ts` and generate it with `pnpm playwright test e2e/caged-tm9.spec.ts -g "Drop D, D major" --project=phone --project=phone-touch --project=desktop --update-snapshots`; inspect the images.

**Checkpoint**: All three user stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T048 Add E14 to `e2e/caged-tunings.spec.ts`: sweep all 14 preset tunings and assert the expected class UI (compatible → shapes without mark/badge; altered → shapes plus "altered"; non-compatible → notice with two actions and no invented shape) (SC-001).
- [X] T049 [P] Re-check no stored or URL writes for the temporary tuning: grep `src/` for any `preferences.remember`/URL write reachable from `viewInStandard`/`endTemporary`; confirm `fretboard-master:prefs` v1 schema and fixtures are untouched (Principle IX N/A).
- [X] T050 [P] Confirm `no-raw-text` and the ESLint boundary rule pass for every touched file: `pnpm lint`.
- [X] T051 Walk through quickstart.md manual scenarios Q1–Q16 on the built app (`pnpm build:test` served), including handedness/orientation mirroring of the "altered" mark and 200 % zoom wrapping of the notice and badge.
- [X] T052 Run all local gates once: `pnpm verify` (includes the bundle-size check, budget initial JS ≤ 92 KB gzip since constitution 1.6.0; the estimate is +1.0–1.5 KB). A bundle breach needs a constitution amendment PR and is not pre-approved. The full Playwright matrix runs in CI only.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none; T001 and T002 can run together.
- **Foundational (Phase 2)**: after Setup; BLOCKS all stories.
- **US1 (Phase 3)**: after Foundational. MVP.
- **US2 (Phase 4)**: after Foundational; independent of US1 (verification and any fix).
- **US3 (Phase 5)**: after Foundational; independent of US1/US2 in behavior. Shares `caged-model.ts`, `e2e/caged-tunings.spec.ts` and `e2e/caged.spec.ts` with other stories, so run stories sequentially or coordinate those files.
- **Polish (Phase 6)**: after the desired stories (T048 needs all three).

### Within Each Story

- Tests first and failing, then implementation.
- Theory before model, model before store, store before components.

### Key task dependencies

- T005 → T007 → T009 → T011 (foundation chain); T003/T004/T006/T008/T010 (tests) precede their implementations.
- T022 + T023 → T024 → T025; T028 needs T024 and T026; T029 needs T024.
- T042 → T045; T043 → T044 → T045.
- T031 needs T028 and T029; T047 needs T045.

### Parallel Opportunities

- Phase 2: T003, T004, T006, T008, T010 (different files).
- US1 tests T012–T018, T020, T021 in parallel; implementation T022, T026, T027 in parallel.
- US3 tests T035–T039 and T041 in parallel; T043 parallel with T042.
- Polish T049 and T050 in parallel.

## Parallel Example: User Story 1

```bash
# Tests together:
Task: "standardCounterpart tests in tests/unit/instrument/tunings.test.ts"        # T012
Task: "model tests M1/M2/M7 in tests/unit/state/caged-model.test.ts"              # T013
Task: "links test in tests/unit/state/links-store.test.ts"                        # T016
Task: "badge tests in tests/unit/tuning-badge.test.ts"                            # T017

# Independent implementation together:
Task: "standardCounterpart in src/lib/instrument/tunings.ts"                      # T022
Task: "openTriadsFromCaged in src/lib/state/links.svelte.ts"                      # T026
Task: "beforeNavigate hook in src/routes/+layout.svelte"                          # T027
```

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 Setup, Phase 2 Foundational.
2. Phase 3 US1.
3. Stop and validate: Open G notice, View in standard tuning, badge, Go to Triads, prefs unchanged.

### Incremental Delivery

1. Foundation → US1 (MVP, replaces the interim message) → US2 (compatible verification) → US3 (altered string) → Polish.
2. Each story keeps slice-014 and earlier stories green; run only targeted tests per task and `pnpm verify` once at the end.

## Notes

- Never write the temporary tuning to storage or the URL.
- Shape names never change with tuning; only the "roots on strings" list drops string 6 when altered.
- Commit after each task or logical group (Conventional Commits).
