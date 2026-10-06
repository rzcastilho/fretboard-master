---

description: "Task list for 021 Letters or Solfège, Sharps or Flats"
---

# Tasks: Letters or Solfège, Sharps or Flats

**Input**: Design documents from `/specs/021-note-notation-and-accidentals/`

**Prerequisites**: plan.md, spec.md, research.md (R-01…R-16), data-model.md, contracts/notation-api.md, contracts/notation-ui.md, quickstart.md

**Tests**: Included. Constitution IV requires test-first for the notation, policy, label-fit, prefs schema, and store modules, and every US1–US5 scenario maps to a test (quickstart.md). Write each test task first and confirm it FAILS before the matching implementation task.

**Organization**: Grouped by user story. Foundational work (Phase 2) blocks all stories.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US5, from spec.md
- Paths are repo-relative from the worktree root

## Verification cadence (CLAUDE.md "Verification during implementation")

- Per task or checkpoint: `pnpm vitest run <touched test paths>`
- E2E: `pnpm build:test` once after `src/` changes, then `pnpm test:e2e:fast <spec files added or edited>`
- New or changed screenshot: `pnpm playwright test <spec> -g "<test name>" --project=phone --project=phone-touch --project=desktop --update-snapshots`
- End of slice, once: `pnpm verify`
- Do NOT run `pnpm test:e2e` or `pnpm lhci` locally

---

## Phase 1: Setup

**Purpose**: Baselines and decision record before code changes.

- [X] T001 Record the bundle baseline: run `pnpm build && node scripts/check-bundle-size.mjs build` and note the gzip size in the PR description. The cap is 120 KB (R-15)
- [X] T002 [P] Write ADR `docs/adr/0020-notation-context-and-accidental-policy.md`. Cover the replaceable notation source (R-01), the per-surface accidental opt-in via `DisplayModel.spellingPolicy` and `Instrument.fixedSpelling` (R-04–R-06), and the grapheme fit rule (R-09). Follow the format of the existing ADRs in `docs/adr/`
- [X] T003 [P] Add notation terms to `docs/i18n/glossary.md` for en, pt-BR, es: note names, letters, solfège (Solfejo/Solfeo), accidentals, sharps, flats, both, language and notation. Match the wording in contracts/notation-api.md §9

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The notation context, catalogs, prefs fields, and store that every story reads.

**⚠️ CRITICAL**: No user story work starts until this phase is complete.

### Tests first

- [X] T004 [P] Write `tests/unit/notation/policy.test.ts`. Assert `NOTATIONS` equals `['letters','solfege']`, `ACCIDENTAL_POLICIES` equals `['sharps','flats','both']`, and `DEFAULT_NOTATION_CONTEXT` is `{ letters, sharps }` and frozen
- [X] T005 [P] Extend `tests/unit/notation/notation.test.ts` for contract rules N-1 to N-5. Cover the getter being read on every call, `noteName` and `solfegeName` per locale (en/es: Do Re Mi Fa Sol La Si; pt-BR: Dó Ré Mi Fá Sol Lá Si), `noteLabel` and `pitchLabel` in solfège, and `noteLabelParts`. Cover `spokenNote` ("F sharp", "Fa sharp", "Fá sustenido", "Fa sostenido", "B double flat") and `intervalLabel` unaffected. Add a fast-check property test: no output contains `#` or a note name followed by an ASCII `b`, over all spellings × notations × locales. Add an assertion that the 7 solfège catalog values are NFC-normalized (plan "Grapheme counting")
- [X] T006 [P] Extend `tests/unit/i18n/languages.test.ts`: `defaultNotation('en')` and `defaultNotation('pt-BR')` give `letters`, and `defaultNotation('es')` gives `solfege`
- [X] T007 [P] Extend `tests/unit/prefs/schema.test.ts` for P-1 and P-2. Cover each new field parsing alone with its own fallback: `notation` (picklist or null), `accidentals` (picklist, else `'sharps'`), and `cagedNote` (boolean, else false). Cover serializer order after `language`, with no field written at its default. Cover every pre-existing fixture round-tripping byte-identically, and `parsePreferences` never throwing
- [X] T008 [P] Create the 7 add-only fixtures in `tests/unit/prefs/fixtures/`: `notation-solfege.txt`, `notation-letters.txt`, `accidentals-flats.txt`, `accidentals-both.txt`, `bad-notation.txt`, `bad-accidentals.txt`, `caged-note.txt`. Copy the layout of an existing fixture (for example the `language` one). Do not edit existing fixtures
- [X] T009 [P] Write `tests/unit/state/notation-store.test.ts` for S-1 to S-3. Before any `choose`, a language change moves `effective` (es gives solfège; en and pt-BR give letters). After `choose`, it does not. `choose(n)` remembers `{ notation: n }` even when equal. `chooseAccidentals` remembers `{ accidentals }`. `restore` does not persist. `start` is idempotent and installs the source. `choose` never reloads, navigates, fetches, or resets another store. Use `resetNotationForTests`
- [X] T010 [P] Extend `tests/unit/state/preferences-store.test.ts` for P-3 and P-4. `start` calls `notation.start` after `language.start`. `erase` resets notation, accidentals, and `cagedNoteShown`. `markCagedNoteShown` is idempotent and sets the in-load flag when storage is unavailable
- [X] T011 [P] Extend `tests/unit/i18n/catalogs.test.ts` and `tests/unit/i18n/identical-allowlist.ts` expectations. The new keys exist in all 3 catalogs with placeholder parity (`{note}`, `{first}`/`{second}`, `{c}{a}{g}{e}{d}`). Add the es/en-identical solfège keys and "Drop {note}" to the identical-text allowlist. Assert `notes_selector_altered_spoken` is gone

### Implementation

- [X] T012 Create `src/lib/notation/policy.ts` (pure, no Paraglide, Svelte, or DOM): `Notation`, `AccidentalPolicy`, `NOTATIONS`, `ACCIDENTAL_POLICIES`, `NotationContext`, and a frozen `DEFAULT_NOTATION_CONTEXT`. Must make T004 pass
- [X] T013 Update `messages/en.json`, `messages/pt-BR.json`, `messages/es.json` per contracts/notation-api.md §9. Add `note_name_solfege_{c,d,e,f,g,a,b}`, `note_spoken_either`, `notation_label`, `notation_letters`, `notation_solfege`, `accidentals_label`, `accidentals_{sharps,flats,both}`, and `caged_solfege_note`. Rename the `{letter}` param to `{note}` in every `note_spoken_*`. Change `language_panel_label` and `language_close` to the "…and notation" wording. Parameterize `tuning_af4/5/6/8/9/10/11/23` with `{note}`. Leave `tuning_af7` ("DADGAD") literal. Remove `notes_selector_altered_spoken`. Keep the 3 catalogs in sync. Must make T011 pass
- [X] T014 Extend `src/lib/notation/notation.ts` with `overwriteNotationSource`, `resetNotationSourceForTests`, `noteName`, `solfegeName`, and `noteLabelParts`. Route `noteLabel`, `pitchLabel`, and `spokenNote` through `noteName` and the context getter, read on every call and never cached. Pass `{ note }` to the `note_spoken_*` messages. Keep `src/lib/notation` free of Svelte imports. Depends on T012 and T013. Must make T005 pass
- [X] T015 [P] Add `notation: Notation` to each `LANGUAGES` entry and export `defaultNotation(tag)` in `src/lib/i18n/languages.ts` (en: letters, pt-BR: letters, es: solfege). Depends on T012. Must make T006 pass
- [X] T016 [P] Add `notation`, `accidentals`, and `cagedNoteShown` (stored key `cagedNote`) to the `Preferences` interface, `DEFAULT_PREFERENCES`, parsing, and serialization in `src/lib/prefs/schema.ts`. Each uses its own `v.fallback`, with `v.picklist(NOTATIONS)` and `v.picklist(ACCIDENTAL_POLICIES)`. `PREFS_VERSION` stays 1. Depends on T012. Must make T007 and T008 pass
- [X] T017 Extend `PreferencesPatch` in `src/lib/prefs/session.ts` to accept `{ notation }`, `{ accidentals }`, and `{ cagedNoteShown: true }`. Depends on T016
- [X] T018 Create the runes store `src/lib/state/notation.svelte.ts`: `chosen`, `accidentals`, `effective` (derived as `chosen ?? defaultNotation(language.current)`), `start`, `choose`, `chooseAccidentals`, `restore`, and `resetNotationForTests`. `start` installs the getter through `overwriteNotationSource`, reading `$state` reactively. Depends on T014, T015, and T017. Must make T009 pass
- [X] T019 Wire `src/lib/state/preferences.svelte.ts`. `start` calls `notation.start(...)` right after `language.start(...)` and before hydration (R-13). Add `cagedNoteShown` and `markCagedNoteShown()` mirroring `rotateHintShown`. `erase` calls `notation.restore(null, 'sharps')` and resets `cagedNoteShown`. Depends on T017 and T018. Must make T010 pass

**Checkpoint**: Run `pnpm vitest run tests/unit/notation tests/unit/i18n tests/unit/prefs tests/unit/state/notation-store.test.ts tests/unit/state/preferences-store.test.ts tests/unit/theory`. Then run `pnpm build && node scripts/check-bundle-size.mjs build` and compare with T001 (the R-15 contingency: shorten new prose first).

---

## Phase 3: User Story 1 - Choose how note names are written (Priority: P1) 🎯 MVP

**Goal**: A user picks letters or solfège in the language panel and every note name follows. Spanish defaults to solfège, and an explicit pick survives a language change.

**Independent Test**: Open Notes in Spanish with no stored choice and read Do Re Mi Fa Sol La Si. Switch notation in the panel and confirm every name changes.

### Tests for User Story 1 ⚠️ (write first, confirm they fail)

- [X] T020 [P] [US1] Write `tests/unit/notation-selector.test.ts`. The Note names fieldset has native radios Letters and Solfège, the checked one is `notation.effective`, selecting calls `notation.choose`, arrow keys move within the group, and each label is ≥ `--target-min`. (The Accidentals fieldset is covered in T037.)
- [X] T021 [P] [US1] Extend `tests/unit/language-panel.test.ts`. The panel region is named "Language and notation" and renders `NotationSelector` under the language selector. The close button uses the new label
- [X] T022 [P] [US1] Extend `tests/unit/instrument/custom-tuning.test.ts` (the existing home of `tuningLabel` tests; or add `tests/unit/tuning-names.test.ts`). T-1: `tuningLabel` gives "Drop Re", "Double Drop Re", "Open Sol", "Aberta em Sol", "Abierta en Sol", "Drop La" in solfège. "DADGAD" stays literal in every notation
- [X] T023 [P] [US1] Write `e2e/notation.spec.ts` with the US1 tests: "spanish default" (US1-1, SC-001), "switch to solfège" (US1-2, US1-3), and "explicit choice sticks" (US1-4, US1-5). The e2e projects pin `locale: 'en-US'`, so set Spanish through stored language or `localStorage` before load. Include an axe check

### Implementation for User Story 1

- [X] T024 [US1] Create `src/lib/shell/NotationSelector.svelte`: a "Note names" radio fieldset (Letters / Solfège) bound to `notation.effective` and `notation.choose`, in the `LanguageSelector` pattern (020 R-10). Labels use `--target-min`. Must make T020 pass
- [X] T025 [US1] Render `NotationSelector` under `LanguageSelector` in `src/lib/shell/LanguagePanel.svelte` and use the new panel and close labels. The app-bar button text stays "Language" (plan assumption). Depends on T024. Must make T021 pass
- [X] T026 [P] [US1] Update `src/lib/shell/tuning-names.ts` to pass `noteLabel({ letter, accidental: 0 })` as `{note}` to the parameterized tuning messages. `tuning_af7` stays literal. Depends on T013 and T014. Must make T022 pass
- [X] T027 [US1] Audit note-bearing call sites for stale letters: grep `src/` for `noteLabel(`, `spokenNote(`, and `pitchLabel(` at module top level or stored on stores (plan Risks). Fix any found. Known case: the CAGED `tuningName` capture, handled in T031

**Checkpoint**: `pnpm vitest run` on T020–T022 and the existing notation tests, then `pnpm build:test` and `pnpm test:e2e:fast e2e/notation.spec.ts`. US1 is now independently testable and shippable as the MVP.

---

## Phase 4: User Story 2 - Switch notation from anywhere, instantly (Priority: P1)

**Goal**: A bar toggle in Notes, Triads, and CAGED and the panel share one state. The switch is instant, keeps tool state, and reaches every surface, including string names, tuning names, and screen-reader text.

**Independent Test**: In each tool, flip the bar toggle and confirm no note name remains in the previous notation. Tool state is unchanged, with no reload.

### Tests for User Story 2 ⚠️

- [X] T028 [P] [US2] Write `tests/unit/notation-toggle.test.ts`. `role="group"` named "Note names" with two buttons, "C D E" and "Do Re Mi" ("Dó Ré Mi" in pt-BR), built through `noteName`. `aria-pressed` follows `notation.effective`. Click calls `choose`. Each button is ≥ 44×44. The toggle and the panel radios agree
- [X] T029 [P] [US2] Extend `tests/unit/tool-layout.test.ts`: `ToolLayout` renders `NotationToggle` in the header before `LanguagePanel`. Home and About, which do not use `ToolLayout`, do not
- [X] T030 [P] [US2] Extend `tests/unit/state/caged-store.test.ts`. `caged.applyInstrument(next, tuning: Tuning)` stores the `Tuning`, and the label is derived reactively so a notation or language change updates the unsupported-tuning notice (T-2)
- [X] T031 [P] [US2] Extend `e2e/notation.spec.ts` with US2 tests: "toggle reaches every surface" (×3 tools; no stale names, tool state kept, no reload, focus stays on the toggle), "one shared state" (toggle ↔ panel), "solfège everywhere" (tuning, string names, selector, composition, live-region text), and "persistence" (reload remembers; corrupt stored value gives defaults with no error screen and no hydration warning). Extend `e2e/perf.spec.ts` with "notation switch" ≤ 100 ms

### Implementation for User Story 2

- [X] T032 [US2] Create `src/lib/shell/NotationToggle.svelte`: a `role="group"` named by `notation_label` with two `<button aria-pressed>` options built from `noteName` of C, D, E. Targets ≥ `--target-min`, with a visible focus ring. Must make T028 pass
- [X] T033 [US2] Render `NotationToggle` in the `src/lib/shell/ToolLayout.svelte` header before `LanguagePanel`. Depends on T032. Must make T029 pass
- [X] T034 [US2] Change `src/lib/state/caged.svelte.ts` to store the `Tuning` instead of a name string and derive the label with `tuningLabel(tuning)` inside its display `$derived`. Change `src/lib/state/instrument.svelte.ts` to pass the `Tuning` to `caged.applyInstrument` (R-07). Must make T030 pass
- [X] T035 [US2] Leave shape tags, the shape-focus buttons (C A G E D), and interval labels in letters (FR-014, notation-ui §3). Verify in `src/lib/tools/caged/CagedControls.svelte` and the CAGED description code that only note-naming strings go through notation, while shape tags and focus buttons stay literal. Fix and add a test in the existing CAGED component test if any are wrong
- [X] T036 [US2] Run the e2e scan from T031 and fix any surface that kept the old notation (selectors, composition panel, nut labels, string filter, instrument panel rows and summary, tuning badge, descriptions). Files likely touched: `src/lib/fretboard/Fretboard.svelte`, `src/lib/fretboard/description.ts`, `src/lib/shell/InstrumentPanel.svelte`, `src/lib/tools/notes/StringFilter.svelte`, `src/lib/tools/triads/CompositionPanel.svelte`

**Checkpoint**: `pnpm vitest run` on T028–T030, then `pnpm build:test` and `pnpm test:e2e:fast e2e/notation.spec.ts e2e/perf.spec.ts`. US1 and US2 both work.

---

## Phase 5: User Story 3 - Sharps, flats, or both for single notes (Priority: P2)

**Goal**: An accidental preference (default sharps) applies to the Notes tool and to open-string names, and never to Triads, CAGED, or preset tunings.

**Independent Test**: Choose flats, and see Notes markers and selector lead with D♭ E♭ G♭ A♭ B♭. Open Triads A major and confirm it still reads A–C♯–E.

### Tests for User Story 3 ⚠️

- [X] T037 [P] [US3] Extend `tests/unit/notation-selector.test.ts` for the Accidentals fieldset: Sharps / Flats / Both radios checked from `notation.accidentals`, selecting calls `chooseAccidentals`, and the bar has no accidentals control
- [X] T038 [P] [US3] Extend `tests/unit/notation/notation.test.ts` for N-6 to N-9. Cover the policy table for `singleSpelling`, `spellingPair`, `markerSpellings`, `spokenPair`, and `labelPair` (`labelPair(1)` is "D♭ / C♯" under flats). Cover naturals returning the natural only under every policy, `stringSpelling(E♭, true)` giving E♭ under every policy, `stringSpelling(D♯, false)` giving D♭ under flats, and `defaultSpelling` ignoring the policy. Octave is never changed by a respell
- [X] T039 [P] [US3] Extend `tests/unit/instrument` tests for I-1: every preset has `fixedSpelling: true`, an unmatched custom tuning has `false`, and a custom tuning equal to Half step down builds the preset (`true`)
- [X] T040 [P] [US3] Extend `tests/unit/state/notes-model.test.ts`. The Notes model sets `spellingPolicy: 'preference'`. Card info uses `spellingPair`. The missing-notes notice and detected-triad root use `singleSpelling` (sharp under both). Selector order is preferred first. Add a Triads and CAGED model check that A major under flats is A–C♯–E (SC-003)
- [X] T041 [P] [US3] Extend `tests/unit/fretboard/fretboard.test.ts` and `tests/unit/fretboard/description.test.ts` for F-1, F-2, and F-4. With `spellingPolicy` absent, output is byte-identical to the existing snapshots. With `'preference'`, an unspelled marker uses `markerSpellings` for its label, `singleSpelling` for the hover hint, and `spokenPair` for the description and cell name. Nut labels use `stringSpelling(open, instrument.fixedSpelling)`
- [X] T042 [P] [US3] Extend `e2e/notation.spec.ts` with US3 tests: "flats in notes, theory in triads" (US3-1, US3-2, SC-003), "both spellings" (US3-3; stacked on medium and root markers, sharp on small markers, card shows both), and "string names" (US3-4, US3-5; Half step down keeps E♭, a custom altered string follows the policy)

### Implementation for User Story 3

- [X] T043 [US3] Add `singleSpelling`, `spellingPair`, `markerSpellings`, `stringSpelling`, `spokenPair`, and `labelPair` to `src/lib/notation/notation.ts`, per contracts/notation-api.md §2 and N-6 to N-9. Must make T038 pass
- [X] T044 [P] [US3] Add `readonly fixedSpelling: boolean` to `Instrument` in `src/lib/instrument/instrument.ts`, and set it in `src/lib/instrument/tunings.ts` (presets true, including a custom tuning that canonicalizes to a preset, unmatched custom false). It is part of the memoized instrument identity. Must make T039 pass
- [X] T045 [P] [US3] Add the Accidentals radio fieldset to `src/lib/shell/NotationSelector.svelte`, bound to `notation.accidentals` and `notation.chooseAccidentals`. Depends on T024. Must make T037 pass
- [X] T046 [US3] Add `spellingPolicy?: 'preference'` to `DisplayModel` in `src/lib/fretboard/types.ts`. Depends on T043
- [X] T047 [US3] Update `src/lib/state/notes-model.ts` to set `spellingPolicy: 'preference'` and use `spellingPair`, `singleSpelling`, and `spokenPair` for card info, the detected-triad root, the missing-notes notice, and descriptions. Do NOT touch `triads-model` or `caged-model` (FR-009). Depends on T046. Must make T040 pass
- [X] T048 [US3] Make `src/lib/fretboard/Fretboard.svelte` and `src/lib/fretboard/description.ts` policy-aware (F-1, F-2, F-4): unspelled markers, hover hint, description names, and nut labels via `stringSpelling`. With `spellingPolicy` absent, nothing changes. Depends on T044 and T046. Must make T041 pass
- [X] T049 [P] [US3] Update `src/lib/tools/NoteSelector.svelte` to use `labelPair` and `spokenPair` (preferred first, " / " joined, spoken via `note_spoken_either`). Update `src/lib/tools/notes/NotesTool.svelte` and `src/lib/tools/notes/PositionCard.svelte` to use the policy helpers. The position card always shows both spellings
- [X] T050 [P] [US3] Update `src/lib/tools/notes/StringFilter.svelte` and `src/lib/shell/InstrumentPanel.svelte` (custom rows and summary) to use `stringSpelling(open, instrument.fixedSpelling)`. Preset list rows stay unchanged. Depends on T043 and T044

**Checkpoint**: `pnpm vitest run` on the touched notation, instrument, state, and fretboard tests (the Triads and CAGED snapshot tests must stay green). Then `pnpm build:test` and `pnpm test:e2e:fast e2e/notation.spec.ts`.

---

## Phase 6: User Story 4 - Real accidental symbols, legible and spoken in full (Priority: P2)

**Goal**: Accidentals are always ♯ ♭ 𝄪 𝄫. Marker labels shrink then abbreviate by a pure rule, and "both" stacks on medium and root markers. Screen readers get full names.

**Independent Test**: Render F♯, Sol♯, F𝄪, and B𝄫 in each language and notation. Check symbols, alignment, shrink-then-abbreviate, and the spoken text.

### Tests for User Story 4 ⚠️

- [X] T051 [P] [US4] Write `tests/unit/fretboard/label-fit.test.ts` for F-3 and data-model §11. "F♯" is normal. "Sol♯" is min. "Sol♯3" gives "So♯3" at min. "Sol𝄪3" gives "So𝄪3" at min. Under both, medium with "C♯" and "D♭" gives two lines at min. Under both, medium with "Do♯" and "Re♭" gives two lines at min. Under both, small gives "C♯" at normal. A two-line input with a line > 3 graphemes falls back to line 1 only. Abbreviation order is (a) name to 2 graphemes, then (b) drop the octave. It is deterministic and DOM-free
- [X] T052 [P] [US4] Extend `tests/unit/fretboard/fretboard.test.ts`: a marker label renders through `fitMarkerLabel` with the `normal` or `min` class (`--marker-label-size` or `--marker-label-min-size`), a stacked label renders as two `<tspan>`s, the visible label stays `aria-hidden`, and the accessible name and hover hint always carry the full unabbreviated name
- [X] T053 [P] [US4] Extend `tests/unit/fretboard/description.test.ts`: spoken text is never abbreviated, and under both a single altered Notes note reads "C sharp or D flat" (es: "Do sostenido o Re bemol"), preferred first
- [X] T054 [P] [US4] Extend `e2e/notation.spec.ts` with US4 tests: "no ascii accidentals" (18 language × notation × policy combinations × 3 tools, set via `localStorage`; assert no `#` and no match of `\b([A-G]|Do|Dó|Re|Ré|Mi|Fa|Fá|Sol|La|Lá|Si)b\b` in `innerText` and `aria-label` text), "label fit" (US4-2), "spoken names" (US4-3, US4-4, SC-005), and "accidental glyphs" (a screenshot of F♯, Sol♯, F𝄪, B𝄫 on root and medium markers, rendered through `MarkerSample.svelte`)
- [X] T055 [P] [US4] Write `e2e/notation-layout.spec.ts`: at 320 px and 200 % text (use the existing `setTextScale` and `expectNoTruncationOrOverlap` helpers) in pt-BR and es solfège with flats and both, on Notes, Triads, and CAGED. No label is truncated or overlapping, and only the fretboard scrolls horizontally (US4-5, SC-007)

### Implementation for User Story 4

- [X] T056 [US4] Create `src/lib/fretboard/label-fit.ts` (pure): `MarkerSize`, `fitMarkerLabel(lines, size)`. Count graphemes with `Array.from(text).length`, apply the data-model §11 rules and the abbreviation order, and keep it free of DOM and Svelte. Must make T051 pass
- [X] T057 [US4] Render marker labels in `src/lib/fretboard/Fretboard.svelte` through `noteLabelParts` and `fitMarkerLabel`: a single `<text>` or two `<tspan>`s, with a size class mapped to `--marker-label-size` or `--marker-label-min-size`. Under both with `spellingPolicy: 'preference'`, pass `markerSpellings` lines and the marker size. Keep ♯ ♭ 𝄪 𝄫 at letter weight and baseline in the accidentals font (ADR 0006). Depends on T048 and T056. Must make T052 pass
- [X] T058 [US4] Make descriptions and cell names use full spoken text (never abbreviated), and `spokenPair` under both for Notes (F-2, FR-013). Must make T053 pass
- [X] T059 [US4] Generate the "accidental glyphs" screenshot baselines only for the new test: `pnpm playwright test e2e/notation.spec.ts -g "accidental glyphs" --project=phone --project=phone-touch --project=desktop --update-snapshots`. Check by eye that glyphs sit at letter weight and baseline
- [X] T060 [US4] Run T054 and T055 and fix any surface that shows `#`, ASCII `b`, a truncated label, or an overlap

**Checkpoint**: `pnpm vitest run tests/unit/fretboard tests/unit/notation`, then `pnpm build:test` and `pnpm test:e2e:fast e2e/notation.spec.ts e2e/notation-layout.spec.ts`.

---

## Phase 7: User Story 5 - CAGED keeps letter shape names, with a one-time explanation (Priority: P3)

**Goal**: The CAGED explanation shows once when CAGED is displayed in solfège, and never again.

**Independent Test**: In solfège, open CAGED for the first time and see "E shape" tags and the note. Reopen and reload, and see no note.

### Tests for User Story 5 ⚠️

- [X] T061 [P] [US5] Write a component test for the CAGED note in a new `tests/unit/caged/caged-solfege-note.test.ts` (existing CAGED component tests live in `tests/unit/caged/`). It shows when solfège is effective and `cagedNoteShown` is false. It is recorded at once via `markCagedNoteShown`. It shows on a letters → solfège switch while CAGED is open. It never shows again after dismissal, a reload, or a letters → solfège round trip. It is absent in letters. Text uses `solfegeName` per language ("Dó, Lá, Sol, Mi, Ré" in pt-BR). It is independent of the rotate hint, and both may show. It is non-modal and ≤ 2 lines
- [X] T062 [P] [US5] Extend `e2e/caged.spec.ts` with "solfège note" (US5-1 to US5-5, SC-006): tags read "E shape", the note shows once, shows on a switch, and never again after a reload. After "Erase preferences" it may show again

### Implementation for User Story 5

- [X] T063 [US5] In `src/lib/tools/caged/CagedTool.svelte`, add `noteOpen` local `$state` and an `$effect`: when `notation.effective === 'solfege'` and `!preferences.cagedNoteShown`, set `noteOpen = true` and call `preferences.markCagedNoteShown()` in the same tick. Render the existing `Notice` (dismissible, non-blocking) with `caged_solfege_note` filled by `solfegeName('c' | 'a' | 'g' | 'e' | 'd')`. Dismissing sets `noteOpen = false`. Depends on T019. Must make T061 pass

**Checkpoint**: `pnpm vitest run` on T061, then `pnpm build:test` and `pnpm test:e2e:fast e2e/caged.spec.ts`.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T064 [P] Confirm share links never carry notation or accidentals, and that "Reset tool" never changes them (DM-17, FR-1.11). Add one assertion in an existing share-link or reset test if none exists
- [X] T065 [P] Confirm the Triads and CAGED snapshot and description tests are unchanged, and that `tests/unit/theory` is green with no file in `src/lib/theory` modified (Constitution I)
- [X] T066 [P] Run existing e2e specs that assert note text, `pnpm test:e2e:fast e2e/preferences.spec.ts e2e/caged.spec.ts e2e/perf.spec.ts`. Update only assertions that legitimately changed and keep defaults at letters and sharps for en
- [X] T067 Re-measure the bundle: `pnpm build && node scripts/check-bundle-size.mjs build` must be ≤ 120 KB gzip (R-15). If over, shorten new prose first
- [X] T068 Run the manual smoke from `specs/021-note-notation-and-accidentals/quickstart.md` §4, and flag the new glossary terms for native review (pre-launch gate, plan)
- [X] T069 Run all local gates once: `pnpm verify`. The full Playwright matrix and Lighthouse run in CI only, so do not run `pnpm test:e2e` or `pnpm lhci` locally
  - Result: check, lint, format, unit + coverage, build, bundle size, build:test green. e2e: 21 screenshot baselines were stale (header notation toggle, accidental glyphs on markers); regenerated darwin baselines for phone, phone-touch, desktop, now 77/77. Perf: misses under parallel load; serial run 18/19, the one miss (7×24 control change ≈111 ms vs 100 ms) also fails on `main` (≈117 ms) on this machine, so it is not a regression

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)**: none. T002 and T003 can run alongside T001
- **Foundational (2)**: depends on Setup. BLOCKS all stories
- **US1 (3)** and **US2 (4)**: both P1, depend on Phase 2. US2 reuses `NotationSelector`'s state but not its code, so the two can run in parallel after Phase 2. US2's T036 audit is best done after US1's T027
- **US3 (5)**: depends on Phase 2. T045 needs T024 (US1) for the shared component file
- **US4 (6)**: depends on US3's T048 (the policy-aware Fretboard) for T057. T056 and the tests can start after Phase 2
- **US5 (7)**: depends on Phase 2 (T019) only
- **Polish (8)**: after the desired stories

### Within Each Story

- Tests first, and confirm they fail
- `notation.ts` and pure modules, then state and models, then components, then e2e

### Task-level notes

- T014 depends on T012 and T013. T018 depends on T014, T015, T017. T019 depends on T017 and T018
- `src/lib/fretboard/Fretboard.svelte` is edited by T036, T048, and T057, so keep them sequential
- `tests/unit/notation/notation.test.ts` is edited by T005 and T038, and `e2e/notation.spec.ts` by T023, T031, T042, and T054, so keep these sequential

## Parallel Opportunities

- Phase 2 tests T004–T011 are all [P]
- Phase 2 implementation T015 and T016 are [P] after T012
- US1: T020–T023 in parallel, then T026 alongside T024 and T025
- US3: T037–T042 in parallel, then T044, T045, T049, and T050 in parallel
- US4: T051–T055 in parallel
- US5 can run in parallel with US3 and US4 once Phase 2 is done

### Parallel example: Phase 2 tests

```text
Task: "Write tests/unit/notation/policy.test.ts"
Task: "Extend tests/unit/i18n/languages.test.ts"
Task: "Extend tests/unit/prefs/schema.test.ts"
Task: "Write tests/unit/state/notation-store.test.ts"
```

## Implementation Strategy

### MVP first (US1)

1. Phase 1 and Phase 2 (including the bundle checkpoint)
2. Phase 3 (US1): the panel selector, notation across every note name, and tuning names
3. Stop and validate: Spanish first visit shows Do Re Mi, and switching changes every name

### Incremental delivery

1. Add US2 (bar toggle, full-surface reach, perf)
2. Add US3 (accidental policy) and US4 (fit and spoken names)
3. Add US5 (CAGED note)
4. Polish, then `pnpm verify` once

## Notes

- Keep triads and CAGED theory-spelled: the policy is opt-in only (`spellingPolicy`, `fixedSpelling`)
- Defaults stay letters and sharps for en, so existing e2e text assertions keep passing
- Commit after each task or logical group, using Conventional Commits
