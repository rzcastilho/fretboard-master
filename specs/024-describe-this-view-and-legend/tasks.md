---

description: "Task list for 024 Describe This View, Legend, and Accessibility Audit"
---

# Tasks: Describe This View, Legend, and Accessibility Audit

**Input**: Design documents from `/specs/024-describe-this-view-and-legend/`

**Prerequisites**: plan.md, spec.md, research.md (R-01…R-16), data-model.md, contracts/view-aids-ui.md, contracts/description-legend-api.md, quickstart.md

**Tests**: INCLUDED. Constitution IV (test-first) and the plan require pure modules built test-first and every acceptance scenario mapped to a Vitest or Playwright test. Write each test first and see it fail before the implementation task.

**Organization**: Grouped by user story. Story order follows priority: US1, US2, US4 (P1), then US3, US5, US6 (P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1…US6 from spec.md
- Paths are relative to the repository root

## Verification during implementation (CLAUDE.md)

- Unit per task: `pnpm vitest run <touched test paths>`
- E2E per checkpoint: `pnpm build:test` once (rebuild only after `src/` changes), then `pnpm test:e2e:fast <spec files added or edited>` (desktop only)
- Screenshots that change: `pnpm playwright test <spec> -g "<test name>" --project=phone --project=phone-touch --project=desktop --update-snapshots`
- `pnpm verify` once at the end. Do NOT run `pnpm test:e2e` or `pnpm lhci` locally.

---

## Phase 1: Setup

**Purpose**: Baseline and scaffolding

- [X] T001 Record the baseline initial-JS gzip size by running `pnpm build:test` and the bundle-size check; note the number at the top of `specs/024-describe-this-view-and-legend/research.md` R-15 section (headroom is about 4 KB of the 128 KB budget)
- [X] T002 [P] Confirm `tests/unit/a11y/` (new folder, first file in T007) is matched by the Vitest include glob in `vitest.config.ts`; fix the glob if not

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, list helpers, catalog keys and colour helper used by several stories

**⚠️ CRITICAL**: No user story starts until this phase is complete

- [X] T003 Extend `DisplayModel` in `src/lib/fretboard/types.ts` with optional `wideStretch?: boolean` and `legendGroups?: readonly LegendGroup[]` (types only; `LegendGroup`/`LegendKind` are imported from `src/lib/fretboard/legend.ts`, created as a types-only stub here and filled in T037)
- [X] T004 [P] Write failing unit tests for `spokenList` (0/1/2/3+ items, en/pt-BR/es conjunctions) and `describeEntries` (order `b.string - a.string || a.fret - b.fret`, fret 0 → "open", only highlighted/normal markers, dedupe by `positionKey` first wins, same output for left-handed and strings-on-top) in `tests/unit/fretboard/description.test.ts`
- [X] T005 Add catalog keys `list_and_two` ("{a} and {b}") and `list_and_many` ("{head}, and {last}") plus the `fretboard_description_empty` text "Nothing is displayed." to `messages/en.json`, `messages/pt-BR.json`, `messages/es.json` (pt-BR "e", es "y"; no `Intl.ListFormat`)
- [X] T006 Implement `spokenList` and `describeEntries` in `src/lib/fretboard/description.ts` per contracts/description-legend-api.md (note names via `src/lib/notation` only; function word root/third/fifth or `intervalName`; none for Notes); make `describeView` never return `''` (FR-007). T004 passes
- [X] T007 [P] Create `tests/unit/a11y/color.ts`: helpers for hex → linear sRGB, WCAG contrast ratio, Machado 2009 matrices (deuteranopia, protanopia, tritanopia, severity 1.0), and CIEDE2000 ΔE. Add a small self-test in `tests/unit/a11y/color.test.ts` with known reference values

**Checkpoint**: Helpers and keys ready. Verify with `pnpm vitest run tests/unit/fretboard/description.test.ts tests/unit/a11y/color.test.ts`

---

## Phase 3: User Story 1 - Read the view as text (Priority: P1) 🎯 MVP

**Goal**: Every tool shows an exact text description behind **Describe this view**, in order, localized, never empty.

**Independent Test**: In each tool, build a known view, open **Describe this view**, compare the text with the expected sentence (3 languages, both notations, both handednesses).

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T008 [P] [US1] Triads description tests in `tests/unit/triads/` (existing triads model test file; add cases): A major, 1st inversion, strings 4-3-2 → exactly `A major, first inversion, strings 4, 3, and 2: string 4, fret 11, C sharp, third; string 3, fret 9, E, fifth; string 2, fret 10, A, root.`; wide stretch appends ` Wide stretch.`; pt-BR + solfège; double-sharp spelling ("D double sharp"); left-handed and strings-on-top give the identical string
- [X] T009 [P] [US1] CAGED description tests in `tests/unit/caged/` (existing model test file): entries read `string 5, fret 3, C, root` / `string 5, open, E, root`, sorted string-descending then fret-ascending (two positions on string 5 list the lower fret first)
- [X] T010 [P] [US1] Notes empty-view test in `tests/unit/notes/` (existing model test file): no selection and no background → `notes_desc_empty` ("No notes selected. Pick a note in the note selector."); with selection + string filter the text states selection and filter and lists positions without function
- [X] T011 [P] [US1] Component test `tests/unit/fretboard/view-aids.test.ts` (new): the button is named **Describe this view** in both states, `aria-expanded` flips, `aria-controls` points to the panel, panel text equals the description, focus stays on the button, panel updates when the description changes, old "Show/Hide text description" labels absent
- [X] T012 [P] [US1] E2E `e2e/view-aids.spec.ts` (new, desktop): US1-1…US1-7 (Triads exact sentence; Portuguese + solfège; left-handed order; Notes selection + filter; CAGED with pentatonic; panel updates on change; empty Notes view)

### Implementation for User Story 1

- [X] T013 [P] [US1] Add catalog keys in `messages/{en,pt-BR,es}.json`: `fretboard_describe`, `triads_desc_shape` (changed to `{chord}, {inversion}, strings {strings}: {entries}.`), `triads_desc_inversion_{root,first,second}`, `caged_description_note` and `caged_description_note_open` (changed to include `{note}`), `notes_desc_empty`; remove `fretboard_description_show` and `fretboard_description_hide`
- [X] T014 [US1] Update `src/lib/state/triads-model.ts`: isolated single-shape `summary` uses the FR-003 form via `spokenList` + `describeEntries`; append " Wide stretch." and set `wideStretch` when the shape is wide (full neck: set when any shown tag is wide). Depends on T006, T013
- [X] T015 [P] [US1] Update `src/lib/state/caged-model.ts`: add `{note}` to position entries and sort per FR-004 (depends on T006, T013)
- [X] T016 [P] [US1] Update `src/lib/state/notes-model.ts`: empty selection with no background returns the `notes_desc_empty` description (depends on T013)
- [X] T017 [US1] Create `src/lib/fretboard/ViewAids.svelte` with the description half only: **Describe this view** button (constant label, `aria-expanded`, `aria-controls`), `<p id="{uid}-description" hidden>` panel, no animation, tokens only (`--space-*`, `--radius-md`, `--border-width`, `--color-*`), buttons ≥ 44×44 CSS px, wrapping row. Props: `instrument`, `model`, locale-reactive description string
- [X] T018 [US1] Edit `src/lib/fretboard/Fretboard.svelte`: render `<ViewAids>` directly below the scroller when `variant === 'interactive'`; remove the old toggle, its panel and its hard-coded `6px` radius / `var(--space-2, 0.5rem)` fallbacks; keep the existing live region wiring temporarily until T023
- [X] T019 [US1] Update every existing unit and e2e expectation of the old toggle label ("Show text description" / "Hide text description") and old Triads/CAGED sentences: `tests/unit/fretboard/fretboard.test.ts`, `e2e/fretboard.spec.ts`, `e2e/triads.spec.ts`, `e2e/caged-layers.spec.ts`, `e2e/caged-triad.spec.ts`, `e2e/languages.spec.ts`, `e2e/notation.spec.ts`, `e2e/instrument-panel.spec.ts`, `e2e/open-link.spec.ts`
- [X] T020 [US1] Run `pnpm vitest run tests/unit/fretboard tests/unit/triads tests/unit/caged tests/unit/notes tests/unit/no-raw-text.test.ts tests/unit/reserved-colors.test.ts`, then `pnpm build:test` and `pnpm test:e2e:fast e2e/view-aids.spec.ts` plus the specs edited in T019; fix failures

**Checkpoint**: US1 works alone. Every tool has a correct, localized, ordered description. Screenshots of the relabelled button are updated in T048.

---

## Phase 4: User Story 2 - Hear changes without losing place (Priority: P1)

**Goal**: Full description announced politely once, 500 ms after the last change, focus never moves, nothing on first render.

**Independent Test**: With a live-region observer and `page.clock`, change Triads inversion; verify one announcement and unchanged `document.activeElement`.

### Tests for User Story 2 ⚠️

- [X] T021 [P] [US2] Failing unit tests `tests/unit/fretboard/announce.test.ts` with fake timers: first update silent; 3 differing updates within 500 ms → one emit exactly 500 ms after the last; same text again → no-op; settled text equals last announced → no emit; `dispose()` cancels pending emit
- [X] T022 [P] [US2] Extend `e2e/view-aids.spec.ts` using `page.clock`: live region empty at 499 ms and final text at 501 ms (US2-1/2); arrow keys across positions leave the live region unchanged (US2-3); announcement with the panel closed (US2-4); one announcement in Portuguese after a language change (US2-5); `document.activeElement` unchanged throughout

### Implementation for User Story 2

- [X] T023 [US2] Create `src/lib/fretboard/announce.ts` exporting `ANNOUNCE_DELAY_MS = 500`, `AnnouncerTimer`, `Announcer`, `createAnnouncer({delayMs, timer, emit})` per contracts (pure, injectable timer). T021 passes
- [X] T024 [US2] Wire the announcer in `src/lib/fretboard/ViewAids.svelte`: `<div class="sr-only" aria-live="polite" aria-atomic="true">{liveText}</div>`; feed `description` through `createAnnouncer` with `setTimeout`/`clearTimeout`; call `dispose` on destroy; panel text still updates immediately. Remove the old live region from `Fretboard.svelte`; other polite regions (notices, copy confirmation, layer on/off) stay untouched
- [X] T025 [US2] Update existing tests that asserted immediate announcement to fake time: `tests/unit/fretboard/fretboard.test.ts`, `tests/unit/fretboard/view-aids.test.ts`, and any e2e in T019's list that reads the live region (use `page.clock`)
- [X] T026 [US2] Run `pnpm vitest run tests/unit/fretboard`, `pnpm build:test`, `pnpm test:e2e:fast e2e/view-aids.spec.ts` plus edited specs

**Checkpoint**: US1 + US2 work. Announcements are debounced and non-intrusive.

---

## Phase 5: User Story 4 - Whole app by keyboard alone (Priority: P1)

**Goal**: Everything operable by keyboard, visible high-contrast focus ring on positions, no trap, off-screen positions scroll into view.

**Independent Test**: Scripted keyboard-only e2e through each tool, home, instrument panel, notices, description panel (Legend added in US3).

### Tests for User Story 4 ⚠️

- [X] T027 [P] [US4] Failing unit test `tests/unit/a11y/focus-ring.test.ts`: two-tone ring (`--color-focus-ring-outer` over `--color-focus-ring-inner`) has contrast ≥ 3:1 against the fretboard wood and every marker fill token (root, third, fifth, neutral, scale degree, octave tones), light and dark themes; ring colour is not equal to any marker fill. Same task: extend `tests/unit/reserved-colors.test.ts` with a failing value check — in the light, dark and more-contrast blocks of `tokens.css`, no token other than `--color-root|third|fifth` may equal a reserved value (catches today's `--color-accent`/`--color-focus-ring` = `--color-third`), and `--color-accent` is ΔE00 ≥ 10 from root/third/fifth in the same theme (using the `tests/unit/a11y/color.ts` helper) with `--color-accent-text` contrast ≥ 4.5:1
- [X] T028 [P] [US4] E2E `e2e/a11y-keyboard.spec.ts` (new, desktop): US4-1…US4-5 — Notes: tab, select notes, set filters, arrow across positions, play a position; Triads: change inversion; CAGED: change shape; home; instrument panel; share and shared-view notices; description panel opens/closes with focus on its button; focus order follows reading order; no trap; two ring rects present on a focused position (including a hidden position); focus on an off-screen position scrolls it into view

### Implementation for User Story 4

- [X] T029 [US4] Add tokens in `src/lib/styles/tokens.css`: `--color-focus-ring-outer` (light `#1a1d21`, dark `#ffffff`, contrast-more `CanvasText`) and `--color-focus-ring-inner` (light `#ffffff`, dark `#101317`, contrast-more `Canvas`). Fix the pre-existing C-VII reuse: set `--color-focus-ring` to light `#1a1d21` / dark `#ffffff`, and move `--color-accent` off the third colour within the accent hue family (candidates light `#13466a`, dark `#a8d2f0`; adjust `--color-accent-text` if needed). T027 passes, including the extended reserved-colors test (adjust values only if the test says so)
- [X] T030 [US4] Edit `src/lib/fretboard/Fretboard.svelte`: draw the position focus ring as two stacked strokes using the new tokens (outer wide, inner narrow) on every emphasis level including hidden positions; remove the single ring that equals the third colour. Keep tokens-only styling
- [X] T031 [US4] Fix any keyboard gaps the e2e finds in `src/lib/fretboard/Fretboard.svelte` or the tool screens under `src/routes/`; record each fix for the audit record (T054)
- [X] T032 [US4] Run `pnpm vitest run tests/unit/a11y/focus-ring.test.ts tests/unit/reserved-colors.test.ts tests/unit/fretboard`, `pnpm build:test`, `pnpm test:e2e:fast e2e/a11y-keyboard.spec.ts`

**Checkpoint**: Keyboard-only use and focus visibility verified for the three P1 stories.

---

## Phase 6: User Story 3 - Legend of what's on screen (Priority: P2)

**Goal**: **Legend** disclosure lists exactly the marker kinds drawn, grouped in CAGED, localized, keyboard-friendly.

**Independent Test**: Per tool, build views with different features and verify the Legend lists exactly the kinds in use (table in contracts/description-legend-api.md).

### Tests for User Story 3 ⚠️

- [X] T033 [P] [US3] Failing unit tests `tests/unit/fretboard/legend.test.ts` for the contract fixture table: Triads 4-3-2 → root, third, fifth; + comparison; wide shape → + wideStretch; Notes 3 selected → neutral, selected; octave labels → + octave; CAGED default → root, third, fifth; CAGED Chord + Pentatonic → groups Chord[root,third,fifth], Arpeggio[arpeggio], Pentatonic[degree]; + connections; altered sixth string → + alteredString; empty → `[]`; hidden markers never count; dimmed markers count; unknown/empty groups dropped; a kind keeps only its first group; in-use kinds in no group go to a trailing unlabeled group
- [X] T034 [P] [US3] Extend `tests/unit/fretboard/view-aids.test.ts`: **Legend** button (`aria-expanded`, `aria-controls`), entries are a `<ul>` with `aria-hidden` sample + name + meaning, grouped `<h3>` labels in CAGED, empty text "Nothing is marked on the fretboard.", Escape inside panel closes it and focuses the Legend button, Tab leaves without trap, description and Legend panels open independently, state not persisted
- [X] T035 [P] [US3] Extend `e2e/view-aids.spec.ts`: US3-1…US3-6 (CAGED Pentatonic groups; connection ring / wide stretch / altered string entries; Triads comparison entry; Notes neutral/selected/octave; Legend updates while open; Escape + Tab), and SC-008 at 320 px and 200% text zoom with both panels open (`expectNoTruncationOrOverlap`)

### Implementation for User Story 3

- [X] T036 [P] [US3] Add catalog keys in `messages/{en,pt-BR,es}.json`: `fretboard_legend`, `legend_empty`, `legend_<kind>_name` ×14 and `legend_<kind>_meaning` ×14 (kinds: root, third, fifth, degree, neutral, selected, octave, arpeggio, triadLayer, extra, connection, comparison, wideStretch, alteredString; English names per contracts/view-aids-ui.md). Group labels reuse `caged_layer_chord`, `caged_layer_arpeggio`, `caged_layer_pentatonic`, `caged_layer_scale`, `caged_layer_triad`
- [X] T037 [US3] Implement `src/lib/fretboard/legend.ts`: `LegendKind` union (display order), `LegendGroup`, `legendKinds(model)` (marker counts iff emphasis ∈ highlighted/normal/dimmed; per-kind predicates from research R-07; view-level `comparison` from `arrows.length > 0`, `wideStretch` from `model.wideStretch`, `alteredString` from `stringMarks.length > 0`), `legendGroups(model)`. T033 passes
- [X] T038 [P] [US3] Extend `src/lib/fretboard/MarkerSample.svelte` with props `emphasis?: 'highlighted'`, `tone?: OctaveTone`, `variant?: 'comparison'`, `ring?: boolean` (same geometry and tokens as `Fretboard.svelte`, always `aria-hidden="true"`); extend its unit test coverage in `tests/unit/fretboard/fretboard.test.ts` or a new `tests/unit/fretboard/marker-sample.test.ts`
- [X] T039 [US3] Create `src/lib/fretboard/LegendPanel.svelte`: flat `<ul>` or per-group `<h3>` + `<ul>`; each `<li>` = `MarkerSample` + `.name` + `.meaning`; text-only samples for wideStretch and alteredString; empty paragraph `legend_empty`; heading level chosen so axe `heading-order` passes
- [X] T040 [US3] Extend `src/lib/fretboard/ViewAids.svelte`: **Legend** button next to **Describe this view**, `<section class="legend" aria-labelledby=… hidden>` hosting `LegendPanel`; Escape inside the panel closes it and moves focus to the Legend button; no trap; `legendOpen` component-local, not persisted
- [X] T041 [US3] Set `legendGroups` in `src/lib/state/caged-model.ts` from drawn layers (Chord / Arpeggio / Pentatonic / Scale / Triad); confirm `wideStretch` from T014 reaches the Legend
- [X] T042 [US3] Check that root/third/fifth tokens are still used only in `Fretboard.svelte` and `MarkerSample.svelte` (`pnpm vitest run tests/unit/reserved-colors.test.ts tests/unit/no-raw-text.test.ts`; extend those tests to cover `ViewAids.svelte` and `LegendPanel.svelte`)
- [X] T043 [US3] Run `pnpm build:test` and re-run the bundle-size check; compare with the T001 baseline (estimate +3–4 KB, limit 128 KB gzip). Trim before any budget amendment (R-15)
- [X] T044 [US3] Run `pnpm vitest run tests/unit/fretboard tests/unit/caged tests/unit/triads tests/unit/notes` and `pnpm test:e2e:fast e2e/view-aids.spec.ts e2e/caged-layers.spec.ts`

**Checkpoint**: US1–US4 work; Legend is correct and accessible.

---

## Phase 7: User Story 5 - Nothing depends on color alone (Priority: P2)

**Goal**: root/third/fifth distinct by shape and label in every tool; fills pass the CVD check; palette fixed via tokens if not.

**Independent Test**: CVD unit test plus e2e DOM shape check and simulation screenshots.

### Tests for User Story 5 ⚠️

- [X] T045 [P] [US5] Failing unit test `tests/unit/a11y/palette-cvd.test.ts`: for light and dark, each pair of root/third/fifth fills has CIEDE2000 ΔE ≥ 10 under deuteranopia, protanopia and tritanopia (Machado 2009, severity 1.0); label text contrast ≥ 4.5 against each fill. Currently fails in light protan root/fifth (9.4), dark deutan root/fifth (6.3), dark tritan third/fifth (8.7)
- [X] T046 [P] [US5] E2E `e2e/a11y-colour.spec.ts` (new, desktop): US5-1…US5-5 — in each tool and both themes, root, third and fifth render as `rect` / `circle` / `polygon` glyphs with a label; emphasis levels differ by opacity and size; Triads comparison has dashed outline plus arrow; Legend entries carry shape text; apply CSS/SVG filter simulations for the three CVD types and assert shapes/labels remain present

### Implementation for User Story 5

- [X] T047 [US5] Adjust only `--color-fifth` in `src/lib/styles/tokens.css` for light and dark (candidates light `#188450`, dark `#94ecbc`; final values fixed by T045); keep root/third unchanged. T045 passes. Update the Complexity Tracking row in `plan.md` if the final values differ
- [X] T048 [US5] Regenerate affected screenshot baselines with `pnpm playwright test <spec> -g "<test name>" --project=phone --project=phone-touch --project=desktop --update-snapshots` for the specs whose pixels change (fifth colour, two-tone ring, relabelled button): `e2e/fretboard.spec.ts`, `e2e/notation.spec.ts`, `e2e/playback.spec.ts`, `e2e/triads-compare.spec.ts`, `e2e/caged-tm9.spec.ts`, `e2e/notes-tm9.spec.ts`, `e2e/triads-tm9.spec.ts`. Review each diff visually before accepting
- [X] T049 [US5] Run `pnpm vitest run tests/unit/a11y` and `pnpm test:e2e:fast e2e/a11y-colour.spec.ts`

**Checkpoint**: Colour independence verified; palette fixed and baselines updated.

---

## Phase 8: User Story 6 - Controls say what they are (Priority: P2)

**Goal**: Zero axe violations on every screen/state, names/roles/states on every control, every sound has a visible counterpart, audit record written.

**Independent Test**: `e2e/a11y-audit.spec.ts` plus manual checklist in `docs/accessibility-audit.md`.

### Tests for User Story 6 ⚠️

- [X] T050 [P] [US6] E2E `e2e/a11y-audit.spec.ts` (new, desktop only, `@axe-core/playwright`): matrix of 7 targets (`/`, `/notes`, `/triads`, `/caged`, `/about`, not-found, received share link) × 2 themes × 3 languages × panel states (default, Legend open, description open, instrument panel open) → zero violations; assert name/role/state on toggles, selectors, steppers, tabs, panels; polite status messages (notice, adjusted view, copy confirmation) announced without focus move
- [X] T051 [P] [US6] Extend `e2e/a11y-audit.spec.ts` with the sound → visible inventory: tap a position, Triads listen, CAGED listen each show a pulse or progress element during playback (extend `e2e/playback.spec.ts` only if the element is already covered there)

### Implementation for User Story 6

- [X] T052 [US6] Fix every axe violation and name/role/state gap found by T050 within the existing design (files named by the violation; tokens only; no new runtime dependency). The pre-existing `--color-focus-ring` / `--color-accent` = third-colour reuse is already fixed by T029; record it in the audit as "fixed"
- [X] T053 [US6] Fix any sound without a visible counterpart found by T051; add no new sound features
- [X] T054 [US6] Write `docs/accessibility-audit.md`: table per WCAG 2.2 A/AA success criterion (criterion, screens checked, method, result pass/fixed/deferred, fix reference, deferral reason + follow-up slice required iff deferred), plus the colour-blindness table (ΔE per pair/simulation/theme, before → after), the focus-ring contrast table, and the sound → visible inventory
- [X] T055 [US6] Run the manual checklist from quickstart.md §4 (screen reader if available, keyboard-only pass, 320 px and 200% zoom with both panels open, status messages, accessibility tree names) and record results in `docs/accessibility-audit.md`
- [X] T056 [US6] Run `pnpm build:test` and `pnpm test:e2e:fast e2e/a11y-audit.spec.ts`

**Checkpoint**: All six stories complete; audit record written.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T057 [P] Verify no dead catalog keys remain and all new keys exist in en, pt-BR and es (`pnpm vitest run tests/unit/i18n tests/unit/no-raw-text.test.ts`); remove unused `fretboard_description_show/_hide` references anywhere in `src/` and `e2e/`
- [X] T058 [P] Confirm reduced-motion behaviour (no animation on panel open/close) and 320 px / 200% reflow screenshots stay within existing layout specs (`e2e/languages-layout.spec.ts`, `e2e/notation-layout.spec.ts`)
- [X] T059 Final bundle check: initial JS ≤ 128 KB gzip; if over, trim first (R-15); amend the constitution budget only as a last resort
- [X] T060 Run `quickstart.md` §1–§2 commands end to end and tick every row of the scenario table
- [X] T061 Run all local gates once: `pnpm verify` (full Playwright matrix — phone, phone-touch, Firefox/WebKit smoke, no-JS, Lighthouse — runs in CI only; do not run `pnpm test:e2e` locally)
  - Result: check, lint, format, unit + coverage (157 files, 97.7% lines), build, bundle (127.9 KB ≤ 128 KB) pass. Desktop e2e: 1117 pass; failures under machine load (load avg up to 192) all pass in isolation — `perf.spec` 20/20 with `PW_WORKERS=1`. T052 reload test was stale after ADR 0021 address sync; updated (5c05973).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)**: none
- **Foundational (2)**: after Setup; blocks all stories
- **US1 (3)**: after Foundational. **MVP**
- **US2 (4)**: after US1 (needs `ViewAids.svelte`, T017)
- **US4 (5)**: after Foundational; ring work is independent of US1–US3, but its e2e uses the description panel from US1
- **US3 (6)**: after US1 (needs `ViewAids.svelte`) and T014 (`wideStretch`)
- **US5 (7)**: after US4 (ring tokens) and best after US3 (Legend colour check); the CVD token work (T045, T047) can start after Foundational (T007)
- **US6 (8)**: after US1–US5 so the audit covers the final UI
- **Polish (9)**: last

### Task-level notes

- T014 depends on T006, T013; T015 on T006, T013; T016 on T013
- T017 → T018 → T019 → T020
- T023 → T024 → T025
- T029 → T030; T037 → T039 → T040; T038 → T039
- T047 follows T045; T048 follows T047 and T030
- T054 and T055 need T052/T053 done

### Parallel Opportunities

- Foundational: T004 and T007 in parallel
- US1 tests T008–T012 all [P]; T013, T015, T016 [P] once T006 is done
- US2 tests T021, T022 [P]
- US3 tests T033–T035 [P]; T036 and T038 [P]
- US4 tests T027, T028 [P]; US5 tests T045, T046 [P]; US6 tests T050, T051 [P]
- After Foundational, US4 (ring) and US5 (CVD token test) can run in parallel with US1 by another developer (different files)

### Parallel Example: User Story 1

```bash
Task: "Triads description tests in tests/unit/triads/"
Task: "CAGED description tests in tests/unit/caged/"
Task: "Notes empty-view test in tests/unit/notes/"
Task: "ViewAids component test in tests/unit/fretboard/view-aids.test.ts"
Task: "E2E US1 scenarios in e2e/view-aids.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup, Phase 2 Foundational
2. Phase 3 US1: correct descriptions and **Describe this view**
3. **STOP and VALIDATE**: `pnpm vitest run` on touched paths, `pnpm test:e2e:fast e2e/view-aids.spec.ts`

### Incremental Delivery

1. Foundation → US1 (text equivalent) → US2 (announcement) → US4 (keyboard + ring)
2. Then US3 (Legend) → US5 (colour) → US6 (audit record)
3. `pnpm verify` once at the end; each story leaves earlier stories working

---

## Notes

- [P] = different files, no dependency on an incomplete task
- Tests come first and must fail before implementation
- No change to share-link or preference formats; panel open state is component-local
- All new text goes through `messages/{en,pt-BR,es}.json`; note names only through `src/lib/notation`
- Commit after each task or logical group
