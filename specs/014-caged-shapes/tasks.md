---

description: "Task list for 014-caged-shapes: the five CAGED shapes along the neck"
---

# Tasks: The Five CAGED Shapes Along the Neck

**Input**: Design documents from `/specs/014-caged-shapes/`

**Prerequisites**: plan.md, spec.md, research.md (R-01 … R-14), data-model.md, contracts/ (caged-api, caged-ui, storage-format), quickstart.md

**Tests**: INCLUDED. Constitution Principle I and IV require test-first theory, view-state and prefs code, and an automated test for every acceptance scenario (quickstart Q1–Q27). Write each test first and confirm it fails before the implementation task that follows it.

**Organization**: Tasks are grouped by user story. Theory, view state, shell registration and the fretboard tag flag are shared, so they sit in Phase 2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 … US6, from spec.md
- Paths are relative to the repository root

## Verification during implementation (CLAUDE.md tiers)

- Per task or checkpoint (unit): `pnpm vitest run <touched test paths>`
- Per task or checkpoint (e2e): `pnpm build:test` once after `src/` changes, then `pnpm test:e2e:fast <spec files added or edited>` (desktop project only)
- New or changed screenshot: `pnpm playwright test <spec> -g "<test name>" --project=phone --project=phone-touch --project=desktop --update-snapshots`
- End of slice, once: `pnpm verify`
- Do NOT run `pnpm test:e2e` or `pnpm lhci` locally

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Documentation and catalog keys every later phase uses

- [X] T001 [P] Write ADR `docs/adr/0017-caged-occurrences-from-real-tuning.md` recording (a) fixed drawing with start fret from the string-6 pitch class and octave candidates −12…+24 filtered by `0…fretCount` (R-02), (b) the interval-based tuning class (R-03), (c) the non-interactive tag variant `tagsInteractive`, amending ADR 0009 (R-06). Follow the format of `docs/adr/0016-handedness-and-orientation-in-layout.md`.
- [X] T002 [P] Add the 21 CAGED message keys to `messages/en.json` with the English text from contracts/caged-ui §4–§5: `tool_caged_name` "CAGED", `tool_caged_question` "How does the whole neck connect?", `caged_group_key` "Key", `caged_group_quality` "Quality", `caged_quality_major` "Major", `caged_quality_minor` "Minor", `caged_switch_spelling` "Switch to {root}", `caged_key_name` "{root} {quality}", `caged_tag_major` "{shape} shape · roots on strings {strings}", `caged_tag_minor` "{shape}m shape · roots on strings {strings}", `caged_fit_note` "With {frets} frets, {count} shapes fit on the fretboard", `caged_tuning_unavailable` "CAGED depends on the standard relationship between the strings. It isn't available in this tuning yet.", `caged_description_summary` "{key}: {count} shapes along the neck.", `caged_description_entry` "{shape} shape, frets {lo} to {hi}, roots on strings {strings}: {notes}", `caged_description_note` "string {string} fret {fret} {interval}", `caged_description_note_open` "string {string} open {interval}", `caged_interval_root` "root", `caged_interval_third` "major third", `caged_interval_flat_third` "minor third", `caged_interval_fifth` "fifth", `caged_reset` "Reset tool". Shape letters stay literal parameters. Check how existing `triads_*` keys are declared and run Paraglide generation the same way.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure theory, view state, prefs widening, fretboard tag flag and tool/route registration. No user story can start before this phase is complete.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests first (must fail before implementation)

- [X] T003 [P] Write `tests/unit/theory/caged.test.ts` per contracts/caged-api §1:
  - TM-6.1 and TM-7.1: frets, degrees and `rootStrings` of all ten shapes equal data-model §1 (C `x 3 2 0 1 0` roots 5,2; A `x 3 5 5 5 3` roots 5,3; G `8 7 5 5 5 8` roots 6,3,1; E `8 10 10 9 8 8` roots 6,4,1; D `x x 10 12 13 12` roots 4,2; Cm `x 3 1 0 1 x`; Am `x 3 5 5 4 3`; Gm `8 6 5 5 8 8`; Em `8 10 10 8 8 8`; Dm `x x 10 12 13 11`);
  - TM-6.2: 12 keys × {major, minor}, standard tuning, 24 frets, first five `(shape.id, start)` pairs equal the TM-6.2 row (C: C0 A3 G5 E8 D10; D♭: C1 A4 G6 E9 D11; G: G0 E3 D5 C7 A10; F♯: E2 D4 C6 A9 G11);
  - second cycle: C major 24 frets → C0 A3 G5 E8 D10 C12 A15 G17 E20 (nine; D at 22 omitted);
  - EC-6.3: C/12 frets → C A G E and `fitCount` 4; G/12 → 5; D♭/13 → 4; minor identical;
  - real tuning: AF-2 key C → C1 A4 G6 E9 D11; AF-21 (strings 6…1) and AF-23 equal AF-1;
  - `cagedTuningClass` per preset: AF-1, 2, 3, 21, 22, 23 compatible; AF-4, 5 altered-string; AF-6 … AF-11 non-compatible;
  - malformed input (length ≠ 6) → `[]` / `'non-compatible'`, never throws.
- [X] T004 [P] Write `tests/unit/theory/caged.property.test.ts` (fast-check): random compatible tuning (string 6 pitch 28…52, standard intervals above), random key, quality, fret count 12…24 → data-model §3 invariants 1–5 (pitch class of each note equals `rootPc + {R:0,3:4,b3:3,5:7}`, frets within `0…fretCount`, ids are a contiguous run of C→A→G→E→D, occurrences 12 frets apart share an id, `fitCount` ∈ {4,5}); random non-standard interval vectors never `'compatible'`; changing only string 6 → `'altered-string'`.
- [X] T005 [P] Write `tests/unit/state/caged-view.test.ts` per contracts/caged-api §2: initial state is C, `'none'`, major; every data-model §4 transition row; no-ops return the same object; spelling scenario D♭ major → C♯ minor → switch → D♭ minor → major stays D♭ major; defaults for all five altered roots × 2 qualities (major D♭ E♭ F♯ A♭ B♭; minor C♯ E♭ F♯ G♯ B♭); `selectRoot` resets override, `setQuality` keeps it.
- [X] T006 [P] Extend `tests/unit/fretboard/fretboard.test.ts`: with `tagsInteractive: false` tags render as non-button spans (no `button` role, not in Tab order, no `aria-pressed`), same placement as the button variant, mirrored in left-handed; default (`undefined`/`true`) keeps button tags (Triads unchanged).
- [X] T007 [P] Update prefs tests per contracts/storage-format.md: add fixture `tests/unit/prefs/fixtures/last-tool-caged.txt` containing `{"version":1,"lastTool":"caged"}`; in `tests/unit/prefs/schema.test.ts` change the `it.each(['caged','home'])` case to `['home','scales']` → null and add `'caged'` → `'caged'`; add the round-trip property with `lastTool` drawn from `TOOL_IDS ∪ {null}`; change the `wrong-types.txt` expectation (file content unchanged) so `lastTool` is `'caged'`; in `tests/unit/state/preferences-store.test.ts` (near line 138) `toolOpened('caged')` is now remembered. Do not delete or rewrite any fixture.
- [X] T008 [P] Update `tests/unit/tools.test.ts` (order Notes, Triads, CAGED; third entry path `/caged`), `tests/unit/screens.test.ts` (`/caged` known, title "CAGED — Fretboard Master", unknown-path cases keep `/Triads`, `/triads/x` and add `/caged/x`) and `tests/unit/routes.test.ts` (`/caged` route exists, prerendered).

### Implementation

- [X] T009 Implement `src/lib/theory/caged.ts` per contracts/caged-api §1 and research R-01/R-02/R-03: types, `CAGED_CYCLE`, `CAGED_SHAPES` (ten shapes as data, strings indexed 6→1, `null` = muted, degrees `R|3|b3|5`), `rootStrings`, `cagedTuningClass` (intervals 6→5…2→1: `[5,5,5,4,5]` compatible; last four `[5,5,4,5]` with first ≠ 5 altered-string; else non-compatible), `cagedOccurrences` (`shift = mod(rootPc − (pitchClass(sixOpen[0]) − 4), 12)`, octave offsets −12, 0, 12, 24, keep iff every chord fret in `0…fretCount`, sort by start), `fitCount`. Import only `./pitch` and `./triad`; every export has an explicit return type; never throws. Makes T003 and T004 pass.
- [X] T010 [P] Implement `src/lib/state/caged-view.ts` per contracts/caged-api §2 and research R-04, reusing `effectiveRootSpelling`, `defaultRootSpelling` and `otherRootSpelling` from `src/lib/theory/triad.ts`; re-export `SpellingOverride` from `triads-view`. Depends on T009 for `CagedQuality`. Makes T005 pass.
- [X] T011 [P] Add optional `tagsInteractive?: boolean` (default `true`) to `DisplayModel` in `src/lib/fretboard/types.ts` and make the tag strip in `src/lib/fretboard/Fretboard.svelte` render `<span class="tag">` instead of `<button>` when it is `false` (same measured width, `layoutTags` placement, tokens, handedness and orientation edge rules; no `aria-pressed`, no click handler; strip keeps `role="group"` and its label). Makes T006 pass.
- [X] T012 [P] Add `'caged'` to `TOOL_IDS` in `src/lib/prefs/schema.ts` (record stays `version: 1`; writer unchanged). Makes T007 pass.
- [X] T013 Register the tool: add `'caged'` to `ToolId` and a third `TOOLS` entry in `src/lib/shell/tools.ts` (`path: '/caged'`, name `tool_caged_name`, question `tool_caged_question`), add the `caged` screen and title "CAGED — Fretboard Master" in `src/lib/shell/screens.ts`, and create `src/routes/caged/+page.svelte` rendering `<ToolLayout tool="caged" />` (mirror `src/routes/triads/+page.svelte`). Makes T008 pass.

**Checkpoint**: `pnpm vitest run tests/unit/theory/caged.test.ts tests/unit/theory/caged.property.test.ts tests/unit/state/caged-view.test.ts tests/unit/fretboard/fretboard.test.ts tests/unit/prefs tests/unit/state/preferences-store.test.ts tests/unit/tools.test.ts tests/unit/screens.test.ts tests/unit/routes.test.ts` passes. `pnpm check` is green except for the `ToolLayout` branch added in US1.

---

## Phase 3: User Story 1 - See the five linked shapes of a chord (Priority: P1) 🎯 MVP

**Goal**: Third home card and nav entry; `/caged` opens on C major and draws C, A, G, E, D with tags, root markers and interval labels, no layer/label/connection controls.

**Independent Test**: Open home, choose the CAGED card, check C, A, G, E, D start at frets 0, 3, 5, 8, 10 with tags "C shape · roots on strings 5, 2" … and square root markers (quickstart Q1–Q5).

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T014 [P] [US1] Write `tests/unit/state/caged-model.test.ts` (contracts/caged-api §3) for C major / AF-1 / 22 frets: five tags with exact texts "C shape · roots on strings 5, 2", "A shape · roots on strings 5, 3", "G shape · roots on strings 6, 3, 1", "E shape · roots on strings 6, 4, 1", "D shape · roots on strings 4, 2"; tag spans 0–3, 3–5, 5–8, 8–10, 10–13; `labelMode: 'interval'`, `tagsInteractive: false`; one marker per `string:fret` (4:5, 3:5, 2:5 shared by A and G appear once, emphasis `normal`); no marker for muted strings (string 6 within frets 0–3 is empty); functions R→`root`, 3→`third`, 5→`fifth`; 24 frets gives nine tags with the frets 0 and 12 tags identical; description lists each occurrence in order ("E shape, frets 8 to 10, roots on strings 6, 4, 1: …"); identical `model` for all four handedness × orientation variants.
- [X] T015 [P] [US1] Write the first part of `tests/unit/state/caged-store.test.ts` (contracts/caged-api §4): initial `state` is C major, `display` derives from the instrument, `activate(p)` plays the note via `playback.note` without changing state.
- [X] T016 [P] [US1] Write `tests/unit/caged/caged-tool.test.ts`: `CagedTool` renders "C major" heading and the fretboard with the CAGED model; no layer, label, connection, focus, Listen or link controls are rendered (FR-019).
- [X] T017 [P] [US1] Update `tests/unit/home-screen.test.ts`, `tests/unit/app-nav.test.ts` and `tests/unit/tool-layout.test.ts`: third card "CAGED" with "How does the whole neck connect?" after Notes and Triads, nav link order Notes, Triads, CAGED with `aria-current="page"` on `/caged`, `ToolLayout tool="caged"` renders `CagedTool`.
- [X] T018 [P] [US1] Write `e2e/caged.spec.ts` US1 cases (quickstart Q1–Q5): home card and nav order, `/caged` loads with title "CAGED — Fretboard Master", "C major", tags in order with start frets 0, 3, 5, 8, 10, no tag boxes intersect, root markers are squares, 24 frets shows nine tags with identical tags at frets 0 and 12. Follow `e2e/triads.spec.ts` helpers in `e2e/support/`.

### Implementation for User Story 1

- [X] T019 [US1] Implement `src/lib/state/caged-model.ts` (`buildCagedModel`, `cagedTagText`, `sixHighestOpen`) per contracts/caged-api §3 and research R-05/R-08/R-11. Markers `{string, fret, function, emphasis: 'normal', interval: degree, spelling from spellTriad(effectiveRoot, quality), id: 'string:fret'}`, duplicates dropped after the first; tags `{id: '{shape}@{start}', start, end, label, name: label, pressed: false}` using `caged_tag_major`/`caged_tag_minor` with literal shape letters (never through `src/lib/notation`); `labelMode: 'interval'`; `tagsInteractive: false`; `description` from the `caged_description_*` and `caged_interval_*` messages with `spokenNote` for the key and "string {s} open {interval}" for fret 0; map shape index `i` to string `6 − i` so string 7 never gets a marker. Compute `keyName` via `noteLabel` + quality name. Return `tuningClass: 'compatible'`, `fitCount: fitCount(occ)`, `fitNote: null`, `switchTo: null` for now (US2, US4 and US5 fill these). Makes T014 pass.
- [X] T020 [US1] Implement `src/lib/state/caged.svelte.ts` store per contracts/caged-api §4, mirroring `src/lib/state/triads.svelte.ts`: module singleton, getters `state`, `instrument`, `display` (`$derived` over `buildCagedModel`), actions `selectRoot`, `setQuality`, `switchSpelling`, `reset`, `applyInstrument` (keeps view, returns `false`), `useInstrument`, `activate`; a changed view calls `playback.stop('view')`, a no-op does nothing; export `resetCagedForTests`. Makes T015 pass.
- [X] T021 [US1] Create `src/lib/tools/caged/CagedTool.svelte`: zones B/C/D on the existing tool grid (`--tool-grid-areas`, see `TriadsTool.svelte`), zone B shows the key heading (`display.keyName`), zone C renders `<Fretboard instrument model onactivate>` with the CAGED model, no layer/label/connection controls. All text from the catalog. Makes T016 pass.
- [X] T022 [US1] Add the `{:else if tool === 'caged'}<CagedTool />` branch to `src/lib/shell/ToolLayout.svelte`. Makes T017 pass.

**Checkpoint**: `pnpm vitest run tests/unit/state/caged-model.test.ts tests/unit/state/caged-store.test.ts tests/unit/caged tests/unit/home-screen.test.ts tests/unit/app-nav.test.ts tests/unit/tool-layout.test.ts`, then `pnpm build:test` and `pnpm test:e2e:fast e2e/caged.spec.ts`. US1 works on its own (MVP): C major, five shapes, home card and nav.

---

## Phase 4: User Story 2 - Choose the key (Priority: P1)

**Goal**: Pick any of 12 keys; shapes move in the same cyclic order; altered roots follow the TM-4.3 spelling and **Switch to {root}** toggles it.

**Independent Test**: Pick G major → G (0), E (3), D (5), C (7), A (10); D♭ → C1 A4 G6 E9 D11; F♯ → E2 D4 C6 A9 G11; spelling scenario (Q6–Q9).

### Tests for User Story 2 ⚠️

- [X] T023 [P] [US2] Extend `tests/unit/state/caged-model.test.ts` with: `switchTo` is `null` for natural roots and the other spelling for the five altered roots; `keyName` uses the effective spelling ("D♭ major", "C♯ minor"); marker spellings follow the effective root; G major has no C-shape occurrence below fret 7 and starts with G at 0 (EC-6.2).
- [X] T024 [P] [US2] Extend `tests/unit/caged/caged-tool.test.ts`: key selector is a labelled single-select radio group of 12 keys in chromatic order from C; the **Switch to {root}** button appears only for altered roots and its label uses `noteLabel` glyphs; selecting a key updates the heading and tags.
- [X] T025 [P] [US2] Extend `e2e/caged.spec.ts` (Q6–Q9): pick G → G0 E3 D5 C7 A10; D♭ → C1 A4 G6 E9 D11; F♯ → E2 D4 C6 A9 G11; spelling scenario C♯/D♭ major "D♭ major", Minor "C♯ minor", Switch "D♭ minor", Major "D♭ major"; G major has no C tag below fret 7.

### Implementation for User Story 2

- [X] T026 [US2] Update `src/lib/state/caged-model.ts` to set `switchTo` (via `otherRootSpelling` for altered roots, `null` otherwise) and ensure `keyName` and marker spellings use `cagedRootSpelling`. Makes T023 pass.
- [X] T027 [US2] Create `src/lib/tools/caged/CagedControls.svelte`: key `NoteSelector` (label `caged_group_key`) and the **Switch to {root}** button (`caged_switch_spelling`, only when `display.switchTo` is non-null, root formatted by `noteLabel`), wired to `caged.selectRoot` and `caged.switchSpelling`. Reuse `src/lib/tools/NoteSelector.svelte`; Tab order key group → Switch button. Embed in zone B of `CagedTool.svelte` above the key heading. Makes T024 and T025 pass.

**Checkpoint**: `pnpm vitest run tests/unit/state/caged-model.test.ts tests/unit/caged`, then `pnpm build:test` and `pnpm test:e2e:fast e2e/caged.spec.ts`. US1 and US2 both pass.

---

## Phase 5: User Story 3 - Switch between major and minor (Priority: P2)

**Goal**: Major/Minor control shows the five minor shapes of the same key in the same order, with "♭3" third labels and "Xm shape" tags.

**Independent Test**: G major → Minor gives Gm 0, Em 3, Dm 5, Cm 7, Am 10; C minor matches TM-7.1 (Q10–Q12).

### Tests for User Story 3 ⚠️

- [X] T028 [P] [US3] Extend `tests/unit/state/caged-model.test.ts`: minor tags read "Cm shape · roots on strings 5, 2" … "Dm shape · roots on strings 4, 2"; third markers have `interval: 'b3'` and function `third`; C minor markers equal TM-7.1 (no marker on string 6 within frets 0–3, none on string 1 within frets 0–2, the Gm shape has the fifth on string 2); G minor order Gm 0, Em 3, Dm 5, Cm 7, Am 10.
- [X] T029 [P] [US3] Extend `tests/unit/caged/caged-tool.test.ts`: the "Quality" `ChoiceGroup` offers "Major" / "Minor", defaults to Major, and changing it updates tags and heading.
- [X] T030 [P] [US3] Extend `e2e/caged.spec.ts` (Q10–Q12): G major → Minor gives Gm 0, Em 3, Dm 5, Cm 7, Am 10 with "Gm shape · …" tags; C minor muted strings stay empty; third markers labelled "♭3".

### Implementation for User Story 3

- [X] T031 [US3] Add the quality `ChoiceGroup` (label `caged_group_quality`, options `caged_quality_major`/`caged_quality_minor` from `CAGED_QUALITIES`) to `src/lib/tools/caged/CagedControls.svelte`, wired to `caged.setQuality`; Tab order key → quality → Switch. Reuse `src/lib/tools/ChoiceGroup.svelte`. Confirm `caged-model.ts` already handles minor (tag message, `b3` interval label "♭3", spellings via `spellTriad(root, 'minor')`) and fix gaps if tests fail. Makes T028–T030 pass.

**Checkpoint**: `pnpm vitest run tests/unit/state/caged-model.test.ts tests/unit/caged`, then `pnpm test:e2e:fast e2e/caged.spec.ts`.

---

## Phase 6: User Story 4 - Fewer frets, fewer shapes (Priority: P2)

**Goal**: Only fully fitting shapes are drawn with a "With n frets, k shapes fit" note; 7-string boards place shapes on strings 6–1; instrument changes redraw immediately keeping key and quality.

**Independent Test**: 12 frets, C major → C A G E, no D, note "With 12 frets, 4 shapes fit on the fretboard" (Q13–Q16).

### Tests for User Story 4 ⚠️

- [X] T032 [P] [US4] Extend `tests/unit/state/caged-model.test.ts`: C major / 12 frets → `fitNote` "With 12 frets, 4 shapes fit on the fretboard" and no D tag; G major / 12 → `null`; D♭ major / 13 → note with count 4; 22 and 24 frets → `null`; AF-21 (7 strings) → no marker with `string === 7` and markers equal AF-1's on strings 6–1.
- [X] T033 [P] [US4] Extend `tests/unit/state/instrument-store.test.ts` and `tests/unit/state/caged-store.test.ts`: `confirm`/`restore` call `caged.applyInstrument`; the view (key, quality, override) is kept, `display` recomputes for strings, frets, handedness and orientation changes, and `applyInstrument` returns `false` so no adjustment notice is raised.
- [X] T034 [P] [US4] Extend `tests/unit/caged/caged-tool.test.ts`: the fit note paragraph has `role="status"` and renders only when `fitNote` is non-null, below the board.
- [X] T035 [P] [US4] Extend `e2e/caged.spec.ts` (Q13–Q16): 12 frets C major shows no D tag and the status text; G/12, any key/22 and any key/24 show no note; AF-21 has no marker on string 7; changing frets, strings, handedness and orientation redraws immediately with the key heading unchanged. Use `e2e/seven-strings.spec.ts` and `e2e/handedness.spec.ts` as references.

### Implementation for User Story 4

- [X] T036 [US4] Set `fitCount` and `fitNote` (`caged_fit_note` with `{frets}` and `{count}`, only when `k < 5`) in `src/lib/state/caged-model.ts`. Makes T032 pass.
- [X] T037 [US4] Call `caged.applyInstrument(inst)` from `confirm` and `restore` in `src/lib/state/instrument.svelte.ts` (alongside the existing tools). Makes T033 pass.
- [X] T038 [US4] Render the `fitNote` as `<p role="status">` below the fretboard in `src/lib/tools/caged/CagedTool.svelte`, only when non-null. Makes T034 and T035 pass.

**Checkpoint**: `pnpm vitest run tests/unit/state tests/unit/caged`, then `pnpm build:test` and `pnpm test:e2e:fast e2e/caged.spec.ts e2e/seven-strings.spec.ts e2e/handedness.spec.ts`.

---

## Phase 7: User Story 5 - Honest behaviour in other tunings (Priority: P2)

**Goal**: Transposed compatible tunings (Half step down) draw correct shapes from real pitches; Drop D, Open G and other non-compatible tunings show the interim message and no shapes.

**Independent Test**: Half step down, C major → C1 A4 G6 E9 D11; Drop D and Open G → exact message, zero markers or tags (Q17–Q19).

### Tests for User Story 5 ⚠️

- [X] T039 [P] [US5] Extend `tests/unit/state/caged-model.test.ts`: AF-2 key C → occurrences C1 A4 G6 E9 D11 with tags "C shape" …; AF-4 and AF-8 → `tuningClass` not compatible, `model === null`, `fitNote === null`, `occurrences` `[]`.
- [X] T040 [P] [US5] Extend `tests/unit/caged/caged-tool.test.ts`: with a non-compatible instrument zone C renders only `<p role="status">` with `caged_tuning_unavailable`, no `<Fretboard>`, no buttons in zone C, and the key and quality controls stay rendered with their values.
- [X] T041 [P] [US5] Extend `e2e/caged.spec.ts` (Q17–Q19): Half step down → C1 A4 G6 E9 D11; Drop D and Open G → exact message, zero markers, zero tags, no fit note, no buttons in zone C, controls visible; switching back to Standard redraws shapes for the kept key and quality.

### Implementation for User Story 5

- [X] T042 [US5] In `src/lib/state/caged-model.ts` compute `tuningClass = cagedTuningClass(sixHighestOpen(instrument))` and, unless it is `'compatible'`, return `occurrences: []`, `fitCount: 0`, `fitNote: null`, `model: null`. Makes T039 pass.
- [X] T043 [US5] In `src/lib/tools/caged/CagedTool.svelte` branch on `display.model`: when `null`, render `<p role="status">{m.caged_tuning_unavailable()}</p>` in zone C with neutral text tokens (never error red) instead of the board. Makes T040 and T041 pass.

**Checkpoint**: `pnpm vitest run tests/unit/state/caged-model.test.ts tests/unit/caged`, then `pnpm test:e2e:fast e2e/caged.spec.ts`.

---

## Phase 8: User Story 6 - The tool behaves like the other tools (Priority: P3)

**Goal**: Session persistence, "Continue" on the home card, no history entries for in-tool changes, **Reset tool**, and no context carry-over to or from other tools.

**Independent Test**: G minor → Triads → CAGED still G minor; home card shows "Continue"; Back leaves `/caged`; Reset tool returns C major (Q20–Q23).

### Tests for User Story 6 ⚠️

- [X] T044 [P] [US6] Extend `tests/unit/state/links-store.test.ts` and `tests/unit/state/caged-store.test.ts`: `linkTools` is a no-op when either side is `caged`; `resetTool('caged')` restores the initial view; `caged.reset()` gives C major with no override and leaves the instrument unchanged; a view change calls `playback.stop('view')`.
- [X] T045 [P] [US6] Extend `tests/unit/tool-layout.test.ts` and `tests/unit/caged/caged-tool.test.ts`: the failure-view reset covers `caged`; the **Reset tool** button (`caged_reset`) sits in zone D and calls `caged.reset()`.
- [X] T046 [P] [US6] Extend `e2e/caged.spec.ts` (Q20–Q23): G minor → Triads → CAGED shows G minor and Triads is still C major; after opening CAGED the home card shows "Continue", also after reload; three key changes then one browser Back leaves `/caged` (`history.length` unchanged by key changes); Reset tool → "C major", no override, instrument summary unchanged.
- [X] T047 [P] [US6] Update `e2e/preferences.spec.ts` (near line 249: stored `lastTool: 'caged'` now marks the CAGED card "Continue") and `e2e/resilience.spec.ts` (`/caged` is now a known route, no longer an unknown-path case); keep `/Triads`, `/triads/x` and add `/caged/x` as unknown paths.

### Implementation for User Story 6

- [X] T048 [US6] Update `src/lib/state/links.svelte.ts`: widen `LinkedTool` to `ToolId`, make `linkTools` a no-op when either side is `caged`, and make `resetTool('caged')` call `caged.reset()`. Makes T044 pass.
- [X] T049 [US6] Add the **Reset tool** button (`caged_reset`) to zone D in `src/lib/tools/caged/CagedTool.svelte` and include `caged` in the failure-view reset in `src/lib/shell/ToolLayout.svelte`. Confirm that opening `/caged` records `lastTool = 'caged'` through the existing `src/routes/+layout.svelte` hook. Makes T045–T047 pass.

**Checkpoint**: `pnpm vitest run tests/unit/state tests/unit/tool-layout.test.ts tests/unit/caged`, then `pnpm build:test` and `pnpm test:e2e:fast e2e/caged.spec.ts e2e/preferences.spec.ts e2e/resilience.spec.ts e2e/navigation.spec.ts e2e/home.spec.ts`.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, screenshots, performance, bundle budget and final gates

- [X] T050 [P] Add axe and keyboard cases to `e2e/caged.spec.ts` (Q24, Q25): zero axe violations for C major (AF-1), G minor on 12 frets (fit note shown), Drop D (message), left-handed with lowest-on-top, 320 px and 2560 px widths; Tab order is key group → quality group → Switch button (when shown) → fretboard grid → Reset tool; tags are not focusable; the fretboard description lists the five occurrences; at 200 % text zoom tags and controls wrap with no truncation.
- [X] T051 [P] Write `e2e/caged-tm9.spec.ts`: "tm9 view 15" screenshot (C major, standard tuning) plus its left-handed variant (the CAGED part of view 22). Generate baselines with `pnpm playwright test e2e/caged-tm9.spec.ts -g "tm9 view 15" --project=phone --project=phone-touch --project=desktop --update-snapshots`, following `e2e/triads-tm9.spec.ts`.
- [X] T052 [P] Extend `e2e/perf.spec.ts` (Q27): "open CAGED ≤ 300 ms", "CAGED key change ≤ 100 ms", and the existing scroll case with 7 strings × 24 frets and nine tags.
- [X] T053 [P] Confirm `tests/unit/no-raw-text.test.ts` passes over the new components, and that `tests/unit/presentation-boundary.test.ts` and the ESLint theory boundary accept `src/lib/theory/caged.ts` (imports only `./pitch` and `./triad`).
- [X] T054 Run the quickstart.md §3 scenario checklist (Q1–Q27) and tick off each mapped automated test; fix any gap found.
- [X] T055 Run `pnpm verify` once (check, lint, format, Vitest with coverage ≥ 95 % lines and branches on `src/lib/theory`, build, bundle ≤ 90 KB, desktop e2e). If `check-bundle-size.mjs` fails, stop and raise a constitution amendment; do not ship over budget.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup; blocks all user stories
- **US1 (Phase 3)**: depends on Foundational; delivers the MVP
- **US2 (Phase 4)**: depends on US1 (`CagedTool.svelte`, model and store)
- **US3 (Phase 5)**: depends on US2 (`CagedControls.svelte`)
- **US4 (Phase 6)**: depends on US1; independent of US2/US3 apart from sharing `caged-model.ts`, `CagedTool.svelte` and the spec files
- **US5 (Phase 7)**: depends on US1; shares the same files as US4, so run after it
- **US6 (Phase 8)**: depends on US1; the Reset button goes in `CagedTool.svelte` after US4/US5 edits
- **Polish (Phase 9)**: depends on all stories

### Within Foundational

- T003–T008 (tests) first, all [P]
- T009 before T010; T011, T012 are independent [P]; T013 after T002

### Within Each Story

- Tests are written first and must fail
- `caged-model.ts` before the store, the store before components
- Stories that edit the same files (`caged-model.ts`, `CagedTool.svelte`, `e2e/caged.spec.ts`) are sequential in priority order

### Parallel Opportunities

- Phase 1: T001, T002
- Phase 2 tests: T003, T004, T005, T006, T007, T008; implementation T011 and T012 alongside T009/T010
- US1 tests: T014–T018 together
- Each later story's test tasks are [P] with each other (different files or different test blocks)
- Phase 9: T050, T051, T052, T053

## Parallel Example: Foundational tests

```text
Task: "Write tests/unit/theory/caged.test.ts"
Task: "Write tests/unit/theory/caged.property.test.ts"
Task: "Write tests/unit/state/caged-view.test.ts"
Task: "Extend tests/unit/fretboard/fretboard.test.ts for tagsInteractive"
Task: "Update prefs tests and add last-tool-caged.txt fixture"
Task: "Update tools, screens and routes tests"
```

## Implementation Strategy

### MVP First (US1)

1. Phase 1 → Phase 2 (theory, view state, flag, registration)
2. Phase 3: US1 shows C major with five shapes
3. **Stop and validate**: `pnpm vitest run` on touched paths, `pnpm build:test`, `pnpm test:e2e:fast e2e/caged.spec.ts`

### Incremental Delivery

1. US2 adds the key picker and spelling switch
2. US3 adds minor
3. US4 adds fit note, 7-string and instrument-change behaviour
4. US5 adds real-tuning correctness and the interim message
5. US6 adds shell behaviour (session, Continue, history, Reset)
6. Phase 9: a11y, screenshots, perf, `pnpm verify` once

## Notes

- Shape letters C A G E D are literal message parameters and never go through `src/lib/notation` (FR-009, FR-015)
- Key, quality and spelling are session-only; the only stored change is `lastTool: "caged"`
- Never add layer, label or connection controls in this slice (FR-019)
- Commit after each task or logical group (Conventional Commits)
- Rebuild (`pnpm build:test`) only after changing `src/`
