---

description: "Task list for 012-seven-strings"
---

# Tasks: Seven-String Guitars

**Input**: Design documents from `/specs/012-seven-strings/`

**Prerequisites**: plan.md, spec.md, research.md (R-01 … R-15), data-model.md, contracts/ (`tuning-api.md`, `storage-format.md`, `instrument-panel-ui.md`), quickstart.md, `.specify/memory/constitution.md`

**Tests**: INCLUDED. Constitution Principle IV requires test-first for logic and every acceptance scenario as an automated test; the plan lists the required suites (contracts/tuning-api §7). Within each phase, write the tests first and see them FAIL before the implementation tasks.

**Organization**: Grouped by user story. Foundational phase carries the count-aware theory/instrument/config core that every story needs.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on an incomplete task
- **[Story]**: US1 … US5 (spec.md priorities)
- Paths are relative to the repository root. Single SvelteKit project (`src/lib/...`, `tests/unit/...`, `e2e/...`).
- Run commands with the `rtk` prefix (e.g. `rtk pnpm vitest run …`).

---

## Phase 1: Setup

**Purpose**: Baseline and shared catalog entries.

- [X] T001 Run `rtk pnpm check && rtk pnpm test:unit` and confirm the baseline is green before any change (SC-006 reference point); note any pre-existing failure in the PR description.
- [X] T002 [P] Add catalog keys to `messages/en.json`: `tuning_af21` "7-string standard", `tuning_af22` "7-string half step down", `tuning_af23` "Drop A", `instrument_strings_legend` "Strings", `instrument_strings_option` "{count} strings"; add the `{count}` parameter to `instrument_summary_standard` and `instrument_summary_preset` so the 6-string English output stays byte-identical ("6 strings · standard tuning · right-handed"). Re-run `rtk pnpm check` (paraglide compile).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Count-aware pure core. No user story can start until this phase is complete.

**⚠️ CRITICAL**: Tests first (T003–T006, must fail), then implementation (T007–T012).

### Tests (write first)

- [X] T003 [P] Add `fourthBelow` tests in `tests/unit/theory/pitch.test.ts`: table E→B, D→A, C→G, E♭→B♭, B→F♯, F→C, plus returns `null` for B𝄪; fast-check property in the same file: `pitchOfSpelling(fourthBelow(s)) === pitchOfSpelling(s) − 5` and letter index differs by 3 for every spelling with |accidental| ≤ 1.
- [X] T004 [P] Add tests in `tests/unit/instrument/tunings.test.ts`: `presetsFor(6)` = AF-1…AF-11 (11 ids); `presetsFor(7)` = AF-21, AF-22, AF-23, AF-3…AF-11 in that order (12 ids); AF-21/22/23 spelling (B1 E2 A2 D3 G3 B3 E4 / B♭1 E♭2 A♭2 D♭3 G♭3 B♭3 E♭4 / A1 E2 A2 D3 G3 B3 E4); derived 7-string rows for AF-3…AF-11 exactly as data-model §1 table (e.g. AF-3 = A1 D2 G2 C3 F3 A3 D4; AF-5 = G1 C2 G2 C3 F3 A3 D4; AF-10 = B1 E2 B2 E3 G♯3 B3 E4); `isTuningIdFor`, `standardTuningId`, `normalizePresetId` (7: AF-1→AF-21, AF-2→AF-22; 6: AF-21/22/23→AF-1); `isStandard` true only for AF-1 and AF-21; `tuningInstrument(t, 7, 24).stringCount === 7`.
- [X] T005 [P] Add tests in `tests/unit/instrument/custom-tuning.test.ts` (+ fast-check): `referencePitches(6|7)` = `[40,45,50,55,59,64]` / `[35,40,45,50,55,59,64]`; `isOffsets(x, count)` length and −7…4 range; string 7 limits (`canStep` false at E1 lower / D♯2 raise, refused for string 7 when length 6); `matchPreset` on 7 offsets never returns AF-1/AF-2 (`[0…0]` → AF-21, `[-2,0,0,0,0,0,0]` → AF-23, `[-1,-1,-1,-1,-1,-1,-1]` → AF-22); `addSeventh`/`dropSeventh` (incl. same reference when precondition fails) and round trip; `invertedStrings` covers pair 7/6; canonical-form property for both counts (`tuningFromOffsets(o)` is a preset iff some preset of `presetsFor(o.length)` has pitches `o`, and `offsetsOfTuning(tuningFromOffsets(o), o.length)` equals `o`).
- [X] T006 [P] Add tests in `tests/unit/state/instrument-config.test.ts`: every transition row of data-model §4 (6/AF-1→7/AF-21; 6/AF-2→7/AF-22; 6/AF-4→7/AF-4; 6/custom `[-2,0,0,-1,0,0]`→7/custom `[-2,-2,0,0,-1,0,0]`; 7/AF-21→6/AF-1; 7/AF-23→6/AF-1; 7/AF-22→6/AF-2; 7/AF-21 custom open lowering string 7 twice→AF-23; 7/AF-23 lowering once→custom `[-3,0,0,0,0,0,0]`; Restore default→6/AF-1/22 frets); `setStringCount` returns the same object when closed / invalid n / same count; `fretCount` and `customOpen` preserved; `selectTuning` refuses AF-1 on 7 and AF-21 on 6; `stepString` refuses string 7 on 6; `equalsConfig` compares `stringCount`.

### Implementation

- [X] T007 Implement `fourthBelow(s: SpelledPitch): SpelledPitch | null` in `src/lib/theory/pitch.ts` per data-model §2 (3 steps down the letter cycle, octave lowered on wrap below C, accidental from target pitch, `null` when out of −2…+2). No UI imports (theory boundary lint).
- [X] T008 Implement `src/lib/instrument/tunings.ts` per contracts/tuning-api §2: `StringCount`, `DEFAULT_STRING_COUNT`, `isStringCount`, extended `TuningId` (14 ids) and `isTuningId`, `isTuningIdFor`, `presetsFor`, memoized frozen `presetStrings(id, count)` (AF-3…AF-11 on 7 = `[fourthBelow(strings[0]), ...strings]`; non-canonical pair falls back to the count's standard), `standardTuningId`, `normalizePresetId`, count-aware `tuningFromOffsets`/`offsetsOfTuning`/`tuningStrings`/`tuningInstrument`/`presetInstrument`, `isStandard` (AF-1 | AF-21); add AF-21/22/23 to `TUNING_PRESETS` (14 entries). Depends on T007.
- [X] T009 Implement `src/lib/instrument/custom-tuning.ts` per contracts/tuning-api §3: `Offsets = readonly number[]` (length = count, frozen, −7…4), `StringNumber` 1…7, `referencePitches`, `isOffsets(x, count)`, `standardOffsets`, `presetOffsets`, `matchPreset` (searches `presetsFor(o.length)`, pitch only), `offsetPitches`, `invertedStrings` (loop to `o.length − 1`), `canStep`/`stepOffsets` (index = `o.length − string`, refuse string > length), `addSeventh`, `dropSeventh`. Depends on T008.
- [X] T010 Update every call site of the changed signatures (`presetInstrument`, `offsetsOfTuning`, `tuningStrings`, `tuningInstrument`, `TUNING_PRESETS` list consumers, 6-tuple `Offsets` assumptions) found with `rtk grep` across `src/` and `tests/`, passing `count = 6` where behavior must stay unchanged; fix existing tests only for signature changes, never for behavior (FR-019).
- [X] T011 Implement `src/lib/state/instrument-config.ts` per data-model §4 and contracts/tuning-api §4: `stringCount` in `InstrumentConfig`, `DEFAULT_CONFIG = { stringCount: 6, tuning: AF-1, fretCount: 22 }`, `setStringCount(p, n)` (offsets → `addSeventh`/`dropSeventh` → `tuningFromOffsets`; no-op returns same object), `selectTuning` refusal rule, `stepString` refusal, `chooseCustom` count-aware, `restoreDefault`, `equalsConfig` + `instrumentOf` with count. Depends on T008, T009.
- [X] T012 [P] Add AF-21/AF-22/AF-23 names (catalog keys from T002) to `src/lib/shell/tuning-names.ts`.

**Checkpoint**: `rtk pnpm check`, `rtk pnpm vitest run tests/unit/theory tests/unit/instrument tests/unit/state/instrument-config.test.ts` green; all pre-existing tests pass unchanged.

---

## Phase 3: User Story 1 - Add the seventh string to my instrument (Priority: P1) 🎯 MVP

**Goal**: Player picks 6/7 strings in the panel, confirms, sees and hears string 7 in 7-string standard; 12-row preset list; custom string 7 range; persisted across reload.

**Independent Test**: Default state → panel → 7 strings → Confirm: seven strings, string 7 = B1, plays B1 (pitch 35), "7-string standard", no badge; reload restores it (Q1–Q6, Q15–Q17).

### Tests for User Story 1 (write first, must fail)

- [X] T013 [P] [US1] Add the 13 fixture files from contracts/storage-format.md to `tests/unit/prefs/fixtures/` (`v1-seven-standard`, `v1-seven-drop-a`, `v1-seven-drop-d`, `v1-seven-custom`, `v1-seven-custom-drop-a`, `seven-af1`, `seven-af2`, `six-af21`, `strings-absent-af23`, `strings-invalid`, `strings-string`, `seven-custom-six-long`, `six-custom-seven-long`) as `.txt` with the exact raw values; never edit or remove existing fixtures.
- [X] T014 [US1] Extend `tests/unit/prefs/schema.test.ts`: expected-value table for the 13 new fixtures; every pre-012 fixture expects `stringCount = 6` (add to expected column only); writer rules 1–4 (6 strings → no `strings` key and output byte-identical to slice 011; 7 + preset → `"strings":7,"tuning":"AF-n"`; 7 + unmatched custom → `"strings":7,"tuning":"AF-21","customTuning":[7 offsets]`; erase unchanged); field order `version, strings, tuning, customTuning, frets, muted, volume, lastTool, labels`; fast-check round trip per count (6 → no `strings` key). Depends on T013.
- [X] T015 [P] [US1] Extend `tests/unit/state/instrument-store.test.ts`: `setStringCount`, `stringCount` getter (pending while open), `presets` (12 rows on 7 with strings), `rows` order `[count … 1]`, `confirm` passes `stringCount` to `preferences.remember` (AF-21 placeholder for unmatched 7-string custom), `restore(config)` with count, close-without-confirm discards (EC-2.7).
- [X] T016 [P] [US1] Extend `tests/unit/instrument-panel.test.ts` and `tests/unit/tuning-badge.test.ts`: Strings fieldset first with radios "6 strings"/"7 strings"; 7-string list order and notes (FR-003; no "Standard"/"Half step down" rows; Drop D row "A1 D2 A2 D3 G3 B3 E4"); Drop D stays checked on 6→7; Custom row "Lower string 7" disabled at E1 and "Raise string 7" disabled at D♯2 with no error text; name line "Drop A" at A1 and "Custom" at G♯1; badge hidden for 6-string and 7-string standard, shown for every other tuning; summary "7 strings · standard tuning · right-handed".
- [X] T017 [P] [US1] Add audio test (existing playback test hook, no real time) in `tests/unit/audio/` (use the existing playback test file): `playback.note({string: 7, fret: 0})` requests MIDI pitch 35 in AF-21 and 33 in AF-23 (FR-014, R-12).
- [X] T018 [P] [US1] Create `e2e/seven-strings.spec.ts` covering Q1–Q6 and Q15–Q17 (select by role and accessible name; reload persistence checks `localStorage['fretboard-master:prefs']` contains `"strings":7`; Restore default → no `strings` key; close without confirm keeps 6 strings) with an axe scan of the panel and Notes at 7 strings (SC-008).

### Implementation for User Story 1

- [X] T019 [US1] Implement `src/lib/prefs/schema.ts`: `Preferences.stringCount` (default 6), Valibot `strings` field (6 | 7; absent/invalid → 6), count-aware `tuning` normalization (reader rule 11) and `customTuning` validity only when length = count (rule 12), canonicalization against the count's presets (rule 13), writer rules 1–4, `tuningOfPreferences(p)` returning the canonical `Tuning` for `p.stringCount`. Never throw. Depends on T014 failing first, T008, T009.
- [X] T020 [US1] Update `src/lib/state/preferences.svelte.ts` so `remember`/restore carry `stringCount` and the restored config is `{ stringCount, tuning, fretCount }`. Depends on T019.
- [X] T021 [US1] Update `src/lib/state/instrument.svelte.ts`: `setStringCount(n)`, `stringCount` getter, `presets` getter (`presetsFor(pending.stringCount)` with `presetStrings`), `rows` ordered `[count … 1]`, `confirm` passes `stringCount` to `preferences.remember` (canonical tuning id), `restore(config)` shape with count. Depends on T011, T020.
- [X] T022 [US1] Update `src/lib/shell/InstrumentPanel.svelte` per contracts/instrument-panel-ui.md: first `fieldset` "Strings" with native radios ("{count} strings", ≥ 44×44 px, focus stays on the radio), preset radios from `instrument.presets` (name + notes lowest → highest, label `instrument_preset_label`), Custom rows for string `count` first … string 1 last including "Lower/Raise string 7" and "String 7, B 1", preview shows pending count + tuning. Only catalog strings and `src/lib/notation` for note names. Depends on T021.
- [X] T023 [P] [US1] Update `src/lib/shell/InstrumentSummary.svelte` to pass `{count}` and verify the tuning badge component (`src/lib/shell/TuningBadge.svelte`) uses `isStandard` (hidden for AF-1 and AF-21 only). Depends on T002, T008.
- [X] T024 [US1] Make T013–T018 pass; run `rtk pnpm vitest run tests/unit/prefs tests/unit/state tests/unit/instrument-panel.test.ts tests/unit/tuning-badge.test.ts` and `rtk pnpm playwright test e2e/seven-strings.spec.ts`; confirm all pre-existing prefs and panel tests still pass unchanged (SC-006).

**Checkpoint**: US1 fully functional and independently testable. **MVP = Phases 1–3.**

---

## Phase 4: User Story 2 - Notes on all seven strings (Priority: P1)

**Goal**: Fretboard Notes shows, filters, lists unisons on and plays all seven strings; string filter follows the count-change rule.

**Independent Test**: 7-string standard, all notes, frets 0–5: string 7 shows B C C♯ D D♯ E (TM-9 view 4).

### Tests for User Story 2 (write first, must fail)

- [X] T025 [P] [US2] Extend `tests/unit/state/notes-adapt.test.ts` with every string-filter row of data-model §6 (6→7 all on → `[1…7]`, not adjusted; 6→7 subset → unchanged, 7 off, not adjusted; 7→6 with others → 7 dropped silently, not adjusted; 7→6 `[7]` only → `[1…6]`, `filterForced` → adjusted; same count unchanged); a position card on string 7 closes on 7→6 with `adjusted`; a silent string-7 drop does not raise the notice.
- [X] T026 [P] [US2] Add Notes unit/component tests (existing notes test files under `tests/unit/`): string 7 occurrences at frets 0–5 in AF-21 are B C C♯ D D♯ E; note filter and region filter include string 7; Drop A unisons for string 7 fret 12 (A2) = string 6 fret 5 and string 5 fret 0, and the reverse lookup from string 5 fret 0 lists string 7 fret 12; B1 (string 7) and B3 (string 2) are not unisons; string-filter control renders 7 toggle buttons "String 7, B".
- [X] T027 [P] [US2] Extend `e2e/notes.spec.ts` (Q7–Q10) and `e2e/notes-tm9.spec.ts` (new TM-9 view 4 screenshot fixture: Notes, 7-string standard, all notes, frets 0–5) with axe scan.

### Implementation for User Story 2

- [X] T028 [US2] Implement the string-count step in `adaptNotesView` in `src/lib/state/notes-view.ts` (R-09, data-model §6): `adjusted = regionClamped || cardClosed || filterForced`; replace the `view !== s` test with explicit flags.
- [X] T029 [US2] Audit `src/lib/state/notes.svelte.ts` and the Notes route components for any 6-assumption (string filter, unisons, text description); fix only count-generic gaps. Make T025–T027 pass.

**Checkpoint**: US1 + US2 work independently.

---

## Phase 5: User Story 3 - Triads on set 7-6-5 (Priority: P1)

**Goal**: With 7 strings Triads offers 7-6-5 and calculates shapes from the real tuning.

**Independent Test**: 7-string standard, set 7-6-5, C major root = 13-12-10, E minor root = 5-3-2 (TM-9 view 13).

### Tests for User Story 3 (write first)

- [X] T030 [P] [US3] Extend `tests/unit/theory/triad-shape.test.ts`: TM-5.5 7-6-5 table (4 qualities × 3 inversions, root C, AF-21; 12 shapes) incl. C major root 13-12-10 and E minor root 5-3-2; extend the NFR-9.3 fast-check property to random 7-string tunings (three adjacent strings, strictly rising pitch, span < one octave, pitch classes, bass note); Drop A 7-6-5 computed from real pitches; a tuning where the triad cannot close yields the EC-5.1 "does not close" result.
- [X] T031 [P] [US3] Add tests (`tests/unit/state/triads-view.test.ts` and string-set tests under `tests/unit/instrument/`): `stringSets` on 7 strings = 7-6-5, 6-5-4, 5-4-3, 4-3-2, 3-2-1; on 6 = 6-5-4 … 3-2-1; sets 6-5-4…3-2-1 on 7 strings give shapes identical to a 6-string instrument with the same six higher strings (US3-7); 12-fret 7-6-5 C major root yields the "beyond fret 12" result, not "does not close".
- [X] T032 [P] [US3] Extend `e2e/triads.spec.ts` (Q11, Q14) and `e2e/triads-tm9.spec.ts` (new TM-9 view 13 screenshot: Triads E minor 7-6-5) with axe scan and a check that notes sound at their pitches.

### Implementation for User Story 3

- [X] T033 [US3] Verify `src/lib/instrument/string-sets.ts` and the Triads set selector (`radiogroup`, 7-6-5 first on 7 strings) need no code change (R-10); fix only if a test from T030–T032 exposes a 6-assumption. Make T030–T032 pass.

**Checkpoint**: US1, US2, US3 work independently.

---

## Phase 6: User Story 4 - Back to six strings without a broken view (Priority: P2)

**Goal**: 7→6 on Triads 7-6-5 lands on 6-5-4 with the adjustment notice; no notice when nothing needed to change.

**Independent Test**: On 7-6-5, switch to 6 strings, confirm: set 6-5-4 and "We adjusted the view to the new instrument" (Q12, Q13).

### Tests for User Story 4 (write first)

- [X] T034 [P] [US4] Extend `tests/unit/state/triads-view.test.ts`: 7→6 on 7-6-5 → 6-5-4 and `adjusted`; any other set 7→6 not adjusted; 6→7 never adjusted and set unchanged.
- [X] T035 [P] [US4] Extend `e2e/triads.spec.ts` and `e2e/seven-strings.spec.ts`: Q12 (notice visible, announced politely via `status`, new set described, Dismiss works), Q13 (no notice), 6→7 keeps view with no notice; Notes Q10 notice also verified; axe scan.

### Implementation for User Story 4

- [X] T036 [US4] Verify `revalidate` in `src/lib/state/triads-view.ts` and the `adjustedIn` notice path in `src/lib/state/instrument.svelte.ts` (R-10): 7 → `min(set, stringCount)`, `triads.applyInstrument` reports `adjusted`, notice uses message `instrument_adjusted`. Fix only what T034/T035 expose. Depends on T021.

**Checkpoint**: US1–US4 independently verified.

---

## Phase 7: User Story 5 - Legible, smooth seven-string fretboard (Priority: P2)

**Goal**: String 7 visibly thicker, markers never touch, keyboard/screen-reader reach, smooth at 7 × 24.

**Independent Test**: 7 strings × 24 frets on the 360 px phone profile: scroll/drag smooth, no marker overlap (Q18, quickstart §4).

### Tests for User Story 5 (write first)

- [X] T037 [P] [US5] Extend `tests/unit/fretboard/fretboard.test.ts`: 7 string rows; `.string-7` present; stroke widths increase from string 1 to string 7 via tokens; row pitch ≥ root marker size (`--fb-row` ≥ `--marker-root` + gap); `screenOrder` with 7 strings for each handedness/orientation value `Instrument` admits (string 7 mirrors correctly); text description includes string 7 with accidentals in full ("F sharp", FR-018) in `tests/unit/fretboard/` description tests.
- [X] T038 [P] [US5] Extend `e2e/fretboard.spec.ts` (Q18: ArrowDown from string 6 reaches string 7; screen-reader text "String 7, …"; 44×44 px targets in comfortable mode; 320 px width with 24 frets keeps comfortable mode and minimap) and `e2e/perf.spec.ts` (7 strings × 24 frets at 4× CPU throttle: Confirm → board ≤ 300 ms, control change ≤ 100 ms, scroll/drag smoothness; bounding boxes of root markers on neighboring strings at the same fret do not intersect).

### Implementation for User Story 5

- [X] T039 [P] [US5] Add token `--fb-string-width-7: 0.375rem` to `src/lib/styles/tokens.css` (keep `--fb-row: 2.75rem` unchanged).
- [X] T040 [US5] Add the `.string-7` stroke rule (token only, no hard-coded values) in `src/lib/fretboard/Fretboard.svelte`; confirm `src/lib/fretboard/geometry.ts` and `description.ts` are count-generic and that label column shows "7 B"/open note. Depends on T039. Make T037–T038 pass.

**Checkpoint**: all user stories complete.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T041 [P] Write `docs/adr/0015-string-count-and-seven-string-canonical-form.md` (context, decision: `InstrumentConfig.stringCount`, presets per count, variable-length offsets, `strings` storage field; amends ADR 0012, 0013, 0014; alternatives from research R-01/R-03/R-11).
- [X] T042 [P] Add a short note to the 011/010 contract docs only if the repo convention requires cross-links (skip otherwise); update `README`/docs mention of supported string counts if any exists.
- [X] T043 Run all gates from quickstart §1: `rtk pnpm check`, `rtk pnpm lint` (theory import boundary), `rtk pnpm format:check`, `rtk pnpm test:unit` (≥ 95 % theory, ≥ 80 % overall coverage), `rtk pnpm build && node scripts/check-bundle-size.mjs` (≤ 85 KB gzip; expected < 1 KB impact), `rtk pnpm test:e2e` (zero axe violations).
- [X] T044 Run the quickstart manual/Playwright scenarios Q1–Q18 and §4 performance (`pnpm build:test && pnpm playwright test e2e/perf.spec.ts`); record results in the PR.
- [X] T045 Regression pass for FR-019/SC-006: confirm every pre-012 unit, e2e and screenshot test and every pre-012 prefs fixture passes with no change other than adding `stringCount = 6` to expected columns.
- [X] T046 Remove dead code and unused exports left by the signature changes (constitution code quality); Conventional Commits (`feat:`, `test:`, `docs:`) for each logical group.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (1)** → **Foundational (2)** BLOCKS all stories.
- **US1 (3)** needs Phase 2. It carries prefs + store + panel, so US2–US5 end-to-end flows (changing count through the panel) depend on **US1 T021–T022**; their pure-logic parts (T025, T028, T030, T031, T034, T037) depend only on Phase 2.
- **US2 (4)**, **US3 (5)**, **US5 (7)**: independent of each other after US1.
- **US4 (6)**: after US1 (needs panel/store) ; code is shared with US3's `triads-view`, so run after US3 if working sequentially.
- **Polish (8)**: after all desired stories.

### Within a phase

- Tests first and failing → pure modules → state → UI.
- Task-level: T007 → T008 → T009 → T010/T011; T013 → T014 → T019 → T020 → T021 → T022; T039 → T040; T028 before T029.

### Story completion order

US1 (MVP) → US2 ∥ US3 ∥ US5 → US4 → Polish.

## Parallel Examples

```text
# Foundational tests together
T003 pitch.test.ts | T004 tunings.test.ts | T005 custom-tuning.test.ts | T006 instrument-config.test.ts

# US1 tests together (different files)
T013 fixtures | T015 instrument-store.test.ts | T016 panel+badge tests | T017 playback test | T018 e2e/seven-strings.spec.ts

# After US1: different stories in parallel
T025–T029 (Notes) | T030–T033 (Triads) | T037–T040 (Fretboard rendering)
```

## Implementation Strategy

### MVP first

1. Phases 1–2 (core + config) → 2. Phase 3 (US1) → **STOP and validate** Q1–Q6, Q15–Q17 → demo.

### Incremental delivery

US1 → US2 (Notes) → US3 (Triads 7-6-5) → US5 (rendering polish, perf gate) → US4 (adjustment flows) → Polish. Each step keeps 6-string behavior byte-for-byte unchanged.

## Notes

- [P] = different files, no dependency on incomplete tasks.
- Preset/offset constraints are quoted from data-model: offsets are integers in −7 … 4; custom length = string count (6 or 7); `strings` ∈ {6, 7}, absent/invalid = 6; fret count 12–24 independent of string count.
- No new dependency; theory code stays pure (no UI/i18n imports).
- Commit after each task or logical group; verify tests fail before implementing.
