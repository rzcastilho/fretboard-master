---

description: "Task list for 002-interactive-fretboard"
---

# Tasks: Interactive Fretboard

**Input**: Design documents from `/specs/002-interactive-fretboard/`

**Prerequisites**: plan.md, spec.md, research.md (R-01–R-18), data-model.md, contracts/ (fretboard-component.md, module-api.md, test-hooks.md), quickstart.md

**Tests**: INCLUDED. Constitution IV mandates test-first for `theory`, `instrument`, `notation`, and the fretboard pure helpers, and requires every acceptance scenario to become an automated test (Vitest + Playwright). Write each test task first, run it, see it FAIL, then implement.

**Organization**: Grouped by user story (US1–US5) so each is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US5 (user-story phases only)
- All commands go through `rtk` (e.g. `rtk pnpm test:unit`)

## Path Conventions

Single static SvelteKit project at repo root: `src/lib/{theory,instrument,notation,fretboard,shell,styles}`, `messages/en.json`, `tests/unit/<module>/`, `e2e/`, `scripts/`, `static/`, `docs/adr/`. Existing files are marked (edit).

**Shared-file note**: `src/lib/fretboard/Fretboard.svelte` is touched by every story, so its tasks are sequential (no [P]) and ordered by story.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies, lint boundaries, test projects, catalog keys, tokens.

- [X] T001 Add dev dependencies `fast-check`, `subset-font`, `@fontsource/noto-music` with pnpm in `package.json` (commit `pnpm-lock.yaml`); no runtime dependency added
- [X] T002 [P] Extend import boundaries in `eslint.config.js` per contracts/module-api.md: `src/lib/theory/**` also forbids `instrument` and `notation`; `src/lib/instrument/**` forbids svelte, `$app/*`, paraglide, fretboard, notation, DOM globals; `src/lib/notation/**` forbids svelte, `$app/*`, fretboard, instrument, DOM globals; `src/lib/shell/**` and `src/routes/**` forbid `$lib/theory/*`
- [X] T003 [P] Add `phone-touch` project (320×640, `hasTouch: true`, `isMobile: true`) to `playwright.config.ts`, keeping existing `phone`, `desktop`, `firefox`, `webkit`, `nojs` projects
- [X] T004 [P] Add the 19 keys from contracts/fretboard-component.md §6 to `messages/en.json` (`fretboard_label`, `fretboard_position_name`, `fretboard_position_name_open`, `fretboard_position_function`, `fretboard_function_{root,third,fifth,degree,neutral}`, `fretboard_description_{entry,entry_open,empty,show,hide}`, `note_spoken_{natural,sharp,flat,double_sharp,double_flat}`) and remove `placeholder_fretboard`; keep `tests/unit/no-raw-text.test.ts` passing _(19 keys added; `placeholder_fretboard` removal deferred to T026, since `ToolPlaceholder.svelte` still references it)_
- [X] T005 [P] Add fretboard design tokens to `src/lib/styles/tokens.css` (all listed in contracts/fretboard-component.md §7): geometry in rem (`--fb-row` ≥ 44px equivalent, `--fb-open-col` 44px, `--fb-fret-first` 52px, `--fb-fret-last` 44px, `--fb-label-col`, `--fb-numbers-row`, `--fb-nut-width`, `--fb-string-width-1..6`, thumbnail tokens, `--zone-fretboard-padding-inline: 0`), marker sizes (`--marker-root` > `--marker-medium` > `--marker-small`), `--marker-neutral-stroke-width`, emphasis (`--emph-highlight-scale` ≈1.15, `--emph-dim-scale` ≈0.85, `--emph-dim-opacity` ≈0.4), light/dark/`prefers-contrast: more` colors (`--color-fretboard-wood`, `-line`, `--color-nut`, `--color-inlay`, `--color-root`, `--color-third`, `--color-fifth`, `--color-neutral-note`, `--color-neutral-note-stroke`, `--color-degree-stroke`, `--color-marker-label`, `--color-hint-surface`, `--color-hint-text`), `--duration-short: 300ms` (0s under `prefers-reduced-motion`), `--font-family-notes`
- [X] T006 [P] Add `.sr-only` utility and `@font-face 'FM Accidentals'` (served from `/fonts/fm-accidentals.woff2`, `unicode-range: U+266D-266F, U+1D12A, U+1D12B`, `font-display: swap`) to `src/lib/styles/global.css`
- [X] T007 [P] Declare `__fmFretboardFixture` and `__fmFretboardEvents` globals in `src/app.d.ts` per contracts/test-hooks.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure theory/instrument/notation modules and shared types that every story reads.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests first (must FAIL before implementation)

- [X] T008 [P] Write `tests/unit/theory/pitch.test.ts`: golden values `pitchOfSpelling` E2=40, E4=64, C4=60, B♯3=60, C♭4=59; `octaveOf(59)=3`, `octaveOf(60)=4`; `pitchClass` for negatives; fast-check properties for octave/pitch-class round-trips and `transpose` (TM-1.3, TM-3)
- [X] T009 [P] Write `tests/unit/instrument/instrument.test.ts`: `STANDARD_GUITAR` (6 strings, 22 frets, E4 B3 G3 D3 A2 E2 for strings 1→6, frozen, right/highest-top), `positionPitch` string 2 fret 1 = 60 (C4) and string 6 fret 0 = 40 (E2), full TM-3 table (6 × 13), frets 13–22 equal frets 1–10 + octave, `isValidPosition`, `positionKey` = `"string:fret"`, `allPositions` returns 138 (SC-001, SC-006)
- [X] T010 [P] Write `tests/unit/notation/notation.test.ts`: `defaultSpelling` sharps for pitch classes 0–11, `noteLabel` uses only ♯ ♭ 𝄪 𝄫 for all 35 spellings (never `#` or accidental `b`), `spokenNote` gives "F sharp", "B double flat" from the catalog with no glyphs

### Implementation

- [X] T011 Implement `src/lib/theory/pitch.ts` per data-model §1 and contracts/module-api.md (pure; `pitchClass`, `octaveOf`, `transpose`, `pitchClassOfSpelling`, `pitchOfSpelling`; types `Letter`, `Accidental` (−2|−1|0|1|2), `Spelling`, `SpelledPitch`, `Pitch` (C4 = 60), `PitchClass` (0–11)); make T008 pass
- [X] T012 Implement `src/lib/instrument/instrument.ts` (depends on T011): `Instrument` (`stringCount`, `fretCount`, `openStrings` index 0 = string 1, `handedness`, `orientation`), frozen `STANDARD_GUITAR`, `Position`, `isValidPosition`, `positionPitch`, `positionKey`, `allPositions`; make T009 pass
- [X] T013 Implement `src/lib/notation/notation.ts` (depends on T011): `defaultSpelling` (sharps: C C♯ D D♯ E F F♯ G G♯ A A♯ B), `noteLabel` (♯ ♭ 𝄪 𝄫), `spokenNote` using the `note_spoken_*` catalog messages from `$lib/paraglide/messages`; make T010 pass
- [X] T014 [P] Create `src/lib/fretboard/types.ts` with `NoteFunction` ('root'|'third'|'fifth'|'degree'|'neutral'), `Emphasis` ('highlighted'|'normal'|'dimmed'|'hidden'), `LabelMode` ('note'|'none'), `Marker` (`string`, `fret`, `function`, `emphasis`, optional `spelling`), `DisplayModel` (`markers`, `labelMode`, optional `summary`), `FretboardProps` per contracts/fretboard-component.md §1, plus `GestureState`/`GestureEvent`/`GestureEffect` per data-model §6
- [X] T015 Run `rtk pnpm lint && rtk pnpm check && rtk pnpm test:unit --coverage`; confirm theory ≥ 95 % lines and branches, overall ≥ 80 %, and a deliberate `$lib/theory/pitch` import in `src/lib/shell/ToolCard.svelte` fails lint (then revert)

**Checkpoint**: Foundation ready; user stories can begin.

---

## Phase 3: User Story 1 - See an accurate, instrument-like fretboard (Priority: P1) 🎯 MVP

**Goal**: A static-correct board (strings, frets, nut, inlays, numbers, string labels, open column, 138 named positions) in zone C of `/notes` and `/triads`, and thumbnails on home cards.

**Independent Test**: Render the board with no tool; string 2 fret 1 is "C", string 6 open is E2, layout elements all present, thumbnails on home cards.

### Tests for User Story 1 (write first, must FAIL)

- [X] T016 [P] [US1] Write `tests/unit/fretboard/geometry.test.ts` (layout part): every column width ≥ `metrics.openCol` (44 px), every row ≥ 44 px, columns contiguous and strictly increasing, fret 1 widest and fret 22 narrowest (52 → 44 linear), `INLAY_FRETS` = [3,5,7,9,15,17,19,21], `DOUBLE_INLAY_FRETS` = [12,24] filtered by `fret ≤ fretCount`, fill `scale = max(1, containerWidth / naturalWidth)` applied to column widths only and `scrolls` false when wider, thumbnail layout = frets 0–12 with no label column and no numbers row
- [X] T017 [P] [US1] Write `tests/unit/fretboard/description.test.ts` (name part): `positionName` gives "C, string 2, fret 1", "E, string 6, open", "F sharp, string 1, fret 2, third" when marked, and no function suffix for a `hidden` marker
- [X] T018 [P] [US1] Write `tests/unit/fretboard/fretboard.test.ts` (static part): 138 `role="gridcell"` in 6 `role="row"` inside `role="grid"` named "Fretboard", gridcell `aria-label`s, thumbnail variant renders `svg.fretboard-thumbnail[aria-hidden="true"]` with no cells/text/listeners (US1-1…6)
- [X] T019 [P] [US1] Write `e2e/fretboard.spec.ts` (US1 part): `/notes` and `/triads` zone C shows grid "Fretboard" with 138 cells; cell "C, string 2, fret 1" exists; inlays and fret numbers 1–22 visible with inlay-fret numbers bold; string labels with number and open note beside the nut; no number under the open column
- [X] T020 [P] [US1] Extend `e2e/home.spec.ts` (edit): each card contains `svg.fretboard-thumbnail[aria-hidden="true"]` and Tab order keeps exactly one stop per card; extend `e2e/nojs.spec.ts` (edit): prerendered `/notes` shows the drawn board SVG without JS; update `tests/unit/tool-layout.test.ts` (edit): zone C contains the grid, other zones keep placeholders; update `tests/unit/tool-card.test.ts` (edit) for the thumbnail

### Implementation for User Story 1

- [X] T021 [US1] Implement layout part of `src/lib/fretboard/geometry.ts` per data-model §5: `FretboardMetrics`, `DEFAULT_METRICS` (tokens at a 16 px root), `FretboardLayout`/`Column`/`Row`, `INLAY_FRETS`, `DOUBLE_INLAY_FRETS`, `layoutFretboard(instrument, metrics, containerWidth, variant)`, `screenOrder(instrument)` identity mapping (the only place handedness/orientation is read); make T016 pass
- [X] T022 [P] [US1] Implement `src/lib/fretboard/metrics.ts`: read the rem tokens from computed style and resolve them to px as `FretboardMetrics` (falls back to `DEFAULT_METRICS` during prerender/SSR)
- [X] T023 [P] [US1] Implement `positionName` in `src/lib/fretboard/description.ts` using `spokenNote`, `fretboard_position_name`, `fretboard_position_name_open`, `fretboard_position_function`, `fretboard_function_*`; hidden markers add no function (plan assumption); make T017 pass
- [X] T024 [US1] Create `src/lib/fretboard/Fretboard.svelte` (interactive drawing): `div.fretboard[data-variant]` → `.scroller` → `svg role="grid" aria-label` with `g.drawing` (wood, inlays incl. double 12, fret lines, thick light nut, strings thicker toward low strings, string labels "number + open note" via `noteLabel`, fret numbers 1–22 below with `font-weight` for inlay frets), 6 `role="row"` × 23 `role="gridcell"` rects with `data-string`/`data-fret`, `aria-label` from `positionName`, exactly one `tabindex="0"` (string 1 fret 0); geometry via SVG attributes and classes only (no inline `style`, CSP `style-src 'self'`); text via numbers/`noteLabel` expressions only; make T018 (interactive part) pass
- [X] T025 [US1] Add the `thumbnail` variant to `src/lib/fretboard/Fretboard.svelte`: single `svg.fretboard-thumbnail` (`aria-hidden="true"`, `focusable="false"`, `pointer-events: none`), frets 0–12, strings/frets/nut/inlays only; no cells, text, markers, live region, toggle, or listeners; `onactivate` ignored
- [X] T026 [US1] Edit `src/lib/shell/ToolPlaceholder.svelte`: replace the zone C placeholder with `<Fretboard instrument={STANDARD_GUITAR} />` (no markers, label mode none, no theory import), apply `--zone-fretboard-padding-inline`, keep other zones' placeholders; pass T020 unit changes
- [X] T027 [US1] Edit `src/lib/shell/ToolCard.svelte`: render `<Fretboard variant="thumbnail" instrument={STANDARD_GUITAR} />` inside the card link without changing the link's `aria-label` or tab stop
- [X] T028 [US1] Run T016–T020 suites (`rtk pnpm test:unit`, `rtk pnpm build:test && rtk pnpm test:e2e e2e/fretboard.spec.ts e2e/home.spec.ts e2e/nojs.spec.ts`); fix until US1 passes

**Checkpoint**: US1 complete — an accurate static board on tool screens and home thumbnails (MVP).

---

## Phase 4: User Story 2 - Read markers by shape and emphasis (Priority: P1)

**Goal**: Function shapes, four emphasis levels, note-name labels with explicit spellings, text description summary, and the accidentals font.

**Independent Test**: Render the `all-markers` fixture in grayscale; every function and emphasis is distinguishable.

### Tests for User Story 2 (write first, must FAIL)

- [X] T029 [P] [US2] Extend `tests/unit/fretboard/description.test.ts`: `describeView` orders entries string 6→1 then fret ascending, omits dimmed and hidden, prefixes the optional `summary`, uses `entry_open` for fret 0, returns "No positions marked." with none
- [X] T030 [P] [US2] Extend `tests/unit/fretboard/fretboard.test.ts`: marker element classes per function (`root|third|fifth|degree|neutral`) and emphasis (`highlighted|normal|dimmed`), `.marker[data-key="2:1"]` selector, hidden/unmarked draws nothing but cell remains, duplicate markers (first wins) and out-of-range markers ignored without throwing, label shown iff `labelMode==='note'` and emphasis ∈ {highlighted, normal}, explicit spelling E♯/B𝄫 used instead of sharp default; neutral marker circle carries the outline-ring stroke (`stroke-width` from `--marker-neutral-stroke-width`) and the third circle has none, and every function yields a distinct (shape, outline, size) tuple so no two functions differ by color alone (constitution V)
- [X] T031 [P] [US2] Write `tests/unit/reserved-colors.test.ts`: scan `src/**/*.{svelte,css}` and fail if `--color-root`, `--color-third`, or `--color-fifth` are referenced outside marker styles in `Fretboard.svelte` (and their definitions in `tokens.css`)
- [X] T032 [P] [US2] Add US2 cases to `e2e/fretboard.spec.ts`: fixture `all-markers` grayscale screenshot against baseline `e2e/fretboard.spec.ts-snapshots/` (SC-004, US2-1…4); fixture `labels-spelled` shows labels "E♯", "B𝄫" with `document.fonts.check` true; font `/fonts/fm-accidentals.woff2` not requested on `/` or on a plain `/notes`

### Implementation for User Story 2

- [X] T033 [P] [US2] Create `scripts/subset-accidentals-font.mjs` (uses `subset-font` with `@fontsource/noto-music`, glyphs ♭ ♮ ♯ 𝄪 𝄫, output woff2); run it to generate `static/fonts/fm-accidentals.woff2` and add `static/fonts/OFL.txt`; add a `pnpm` script entry in `package.json`
- [X] T034 [P] [US2] Edit `static/_headers`: `/fonts/*` immutable long-cache; update `tests/unit/headers.test.ts` (edit) accordingly
- [X] T035 [P] [US2] Create `src/lib/fretboard/fixtures.ts` (test-build-only, allow-list): `all-markers` (5 functions × 4 emphases on distinct positions, `labelMode: 'note'`), `labels-spelled` (E♯, B𝄫, F𝄪, C♭ plus default-spelled), `highlight-far` (three highlighted at frets 15–17), `highlight-split` (highlighted at frets 2 and 20), `empty` (`{ markers: [], labelMode: 'note' }`)
- [X] T036 [US2] Implement `describeView` in `src/lib/fretboard/description.ts` per data-model §8; make T029 pass
- [X] T037 [US2] Render markers in `src/lib/fretboard/Fretboard.svelte`: index `model.markers` into a `Map` by `positionKey` (first wins; ignore invalid positions); `g.markers` aria-hidden; keyed `{#each}`; shapes — root rounded square (`--marker-root`), third circle, fifth diamond (both `--marker-medium`), neutral light circle with a solid outline ring (`--color-neutral-note-stroke`, `--marker-neutral-stroke-width`; third circle has no outline), degree small outlined circle (`--marker-small`); emphasis via classes (`highlighted`: `--emph-highlight-scale` + elevation stroke; `normal`; `dimmed`: `--emph-dim-opacity` + `--emph-dim-scale`, no label; `hidden`: not rendered); root/third/fifth fills use only the reserved tokens; labels from `noteLabel(spelling ?? defaultSpelling(pitchClass(positionPitch(...))))` using `--font-family-notes` and shrinking to `--marker-label-min-size`; `data-key` on each marker; make T030, T031 pass
- [X] T038 [US2] Wire the fixture hook into `src/lib/shell/ToolPlaceholder.svelte` zone C: when `__FM_FAULT_INJECTION__` is true, read `globalThis.__fmFretboardFixture` once on mount and pass the matching model from `fixtures.ts` (unknown → plain board); the code is dead-code-eliminated in production
- [X] T039 [US2] Run T029–T032 (generate and review the grayscale baseline screenshot); fix until US2 passes

**Checkpoint**: US1 and US2 work independently.

---

## Phase 5: User Story 3 - Tap or click a position (Priority: P1)

**Goal**: Pointer activation reported as `(string, fret)` with nearest-position hit-testing, drag threshold, multi-touch cancel, and mouse hover hint.

**Independent Test**: Click all 138 cell centers in a harness and assert the reported pairs.

### Tests for User Story 3 (write first, must FAIL)

- [X] T040 [P] [US3] Extend `tests/unit/fretboard/geometry.test.ts`: `nearestPosition` by Euclidean distance to cell centers, exact ties → lower fret then lower string, clamping for points left of the open column, right of fret 22, above row 1 and below row 6 (US3-2)
- [X] T041 [P] [US3] Write `tests/unit/fretboard/interaction.test.ts` (gesture part): `DRAG_THRESHOLD_PX = 10`; reducer table from data-model §6 — idle→pending on primary down, other button ignored, pending stays under 10 px, ≥ 10 px → scrolling (hide hover), pending up → activate(nearest), second pointer → cancelled, cancel → idle, scrolling up → no activation, cancelled returns to idle after last pointer up
- [X] T042 [P] [US3] Extend `tests/unit/fretboard/fretboard.test.ts`: pointer tap on any cell calls `onactivate({string, fret})` with no extra payload fields, focus moves to the cell first, repeat taps report again, hover hint shows for `pointerType === 'mouse'` only (including hidden/unmarked) and clears on leave, thumbnail has no handlers
- [X] T043 [P] [US3] Add US3 cases to `e2e/fretboard.spec.ts`: click each of the 138 cell centers → `__fmFretboardEvents` equals all 138 `(string, fret)` in order (SC-006); midpoint between two cells → lower fret; click left of open column → fret 0; mouse down + 12 px move + up → no event and `scrollLeft` changed; hover shows `.hover-hint` with note name and it disappears on leave

### Implementation for User Story 3

- [X] T044 [US3] Implement `nearestPosition` in `src/lib/fretboard/geometry.ts` per contracts/module-api.md; make T040 pass
- [X] T045 [US3] Implement `DRAG_THRESHOLD_PX` and `reduceGesture` in `src/lib/fretboard/interaction.ts` (pure; states and effects per data-model §6); make T041 pass
- [X] T046 [US3] Wire pointer handling in `src/lib/fretboard/Fretboard.svelte`: pointerdown/move/up/cancel on the svg through `reduceGesture`, convert client coordinates to layout coordinates internally (never exposed), on activation focus the cell then call `onactivate({ string, fret })`; non-primary button and second touch ignored; interactive variant only
- [X] T047 [US3] Add mouse hover hint in `src/lib/fretboard/Fretboard.svelte`: `g.hover-hint` (aria-hidden, tokens `--color-hint-surface`/`--color-hint-text`) showing `noteLabel` for the hovered position on `pointermove` with `pointerType === 'mouse'`, hidden on leave and when a drag starts
- [X] T048 [US3] In `src/lib/shell/ToolPlaceholder.svelte`, when `__FM_FAULT_INJECTION__` is true, append each activation to `globalThis.__fmFretboardEvents` (create if absent), per contracts/test-hooks.md
- [X] T049 [US3] Run T040–T043; fix until US3 passes

**Checkpoint**: US1–US3 work independently.

---

## Phase 6: User Story 4 - Navigate a wide fretboard on a phone (Priority: P1)

**Goal**: Native horizontal scroll that leaves vertical page scroll alone, 5–7 visible columns at 320 px, fill-container on wide screens, mouse drag-to-scroll, and auto-scroll to highlighted positions.

**Independent Test**: In the `phone-touch` project, drag horizontally and vertically and load the `highlight-far` fixture.

### Tests for User Story 4 (write first, must FAIL)

- [X] T050 [P] [US4] Extend `tests/unit/fretboard/geometry.test.ts`: `visibleColumnCount(layout, scrollLeft, 320)` ∈ [5, 7] at scroll 0, 25 %, 50 %, 75 %, and max for the zone-C inner width at 320 px (≈ 5.2 at scroll 0, ≈ 6.4 at max, R-05)
- [X] T051 [P] [US4] Extend `tests/unit/fretboard/interaction.test.ts`: `autoScrollTarget` returns null when all highlighted positions are fully visible or none exist, minimal distance when the highlighted fret span fits, lowest highlighted fret aligned to the start when it does not fit (`highlight-split` case)
- [X] T052 [P] [US4] Write `tests/unit/fretboard/scroll-animation.test.ts` with an injected `Clock`: `animateScroll` reaches `to` within `durationMs` ≤ 300, `durationMs = 0` sets `scrollLeft` synchronously, returned cancel stops further frames
- [X] T053 [P] [US4] Extend `tests/unit/fretboard/fretboard.test.ts`: auto-scroll fires once when the highlighted set changes (and on initial render with highlights), not on unrelated re-renders or after manual scroll
- [X] T054 [P] [US4] Write `e2e/fretboard-touch.spec.ts` (`phone-touch`): CDP `Input.synthesizeScrollGesture` horizontal → board `scrollLeft` > 0 and `window.scrollX` = 0 (US4-1, SC-002); vertical → `window.scrollY` > 0 (US4-2); `visibleColumnCount` ∈ [5, 7] at scroll 0, 25/50/75 %, max (US4-3, SC-005); touch tap emits one event, two-finger tap emits none; 4× CPU throttle trace with no long animation frame > 50 ms (SC-009)
- [X] T055 [P] [US4] Add US4 cases to `e2e/fretboard.spec.ts`: `highlight-far` and `highlight-split` fixtures → one auto-scroll to the expected `scrollLeft`; with `emulateMedia({ reducedMotion: 'reduce' })` the target is reached in the first frame; desktop at 2560 px: board fills zone C and `scrollWidth == clientWidth` (US4-5)

### Implementation for User Story 4

- [X] T056 [US4] Implement `visibleColumnCount` in `src/lib/fretboard/geometry.ts`; make T050 pass
- [X] T057 [US4] Implement `autoScrollTarget` (and `scrollIntoViewTarget`, used in US5) in `src/lib/fretboard/interaction.ts`; make T051 pass
- [X] T058 [P] [US4] Implement `src/lib/fretboard/scroll-animation.ts`: `Clock`, `browserClock` (`performance.now` + `requestAnimationFrame`), `animateScroll(el, to, durationMs, clock)` returning a cancel function; make T052 pass
- [X] T059 [US4] Add scroll behavior to `src/lib/fretboard/Fretboard.svelte` and its styles: `.scroller { overflow-x: auto; overscroll-behavior-x: contain; touch-action: auto }` (pinch and vertical pan untouched), fill-container (measure container width, `layoutFretboard` scale ≥ 1, no scrolling when wider), mouse drag-to-scroll using the `scrolling` gesture effect (`scrollLeft -= dx`)
- [X] T060 [US4] Add auto-scroll to `src/lib/fretboard/Fretboard.svelte`: derive the sorted highlighted key list; on change (including initial mount) compute `autoScrollTarget` and call `animateScroll` with duration from `--duration-short` (0 under `prefers-reduced-motion`), cancel any running animation on manual scroll; one scroll per change; make T053 pass
- [X] T061 [US4] Run T050–T055 (`rtk pnpm build:test && rtk pnpm test:e2e --project=phone-touch --project=desktop`); fix until US4 passes

**Checkpoint**: US1–US4 work independently.

---

## Phase 7: User Story 5 - Operate the fretboard by keyboard (Priority: P2)

**Goal**: Roving single tab stop, arrow navigation without wrap, Enter/Space activation, always-visible focus ring, scroll-into-view, polite live description with visible toggle.

**Independent Test**: Tab into the board, press arrows and action keys, assert focus location, events, and announcements.

### Tests for User Story 5 (write first, must FAIL)

- [X] T062 [P] [US5] Extend `tests/unit/fretboard/interaction.test.ts`: `moveFocus` ArrowRight fret+1, ArrowLeft fret−1, ArrowUp string−1, ArrowDown string+1, no change at the four edges, Enter/Space → `'activate'`, other keys → `null` (US5-1, US5-2); `scrollIntoViewTarget` null when visible, target when off-screen
- [X] T063 [P] [US5] Extend `tests/unit/fretboard/fretboard.test.ts`: exactly one `[role="gridcell"][tabindex="0"]` that follows the roving stop, Tab lands on last focused (default string 1 fret 0), `.focus-ring` present iff focus is inside (including hidden/unmarked cells and after a tap), Enter and Space call `onactivate`, arrows never call it, live region empty on first render and updated when the description changes, toggle `aria-expanded` flips with "Show/Hide text description" and the paragraph shows "No positions marked." on a plain board
- [X] T064 [P] [US5] Add US5 cases to `e2e/fretboard.spec.ts`: Tab from the h1 lands on string 1 open; from string 3 fret 5 ArrowRight/Left/Up/Down → fret 6 / 4 / string 2 / string 4; edges stay put; Enter and Space emit events; focus ring visible on an unmarked cell; key → ring visible < 100 ms median of 5 (SC-007); focus on an off-screen cell scrolls it into view; toggle shows description text
- [X] T065 [P] [US5] Add accessibility and responsive cases to `e2e/fretboard.spec.ts`: `@axe-core/playwright` zero violations on `/notes`, `/triads`, home (thumbnails), expanded description, light and dark, `phone` and `desktop` (SC-008); width sweep 320–2560 and 200 % text zoom — no page horizontal scroll, no overlap, only `.scroller` scrolls

### Implementation for User Story 5

- [X] T066 [US5] Implement `moveFocus` in `src/lib/fretboard/interaction.ts` (key mapping read through the single orientation mapping so handedness stays inside `src/lib/fretboard`); make T062 pass
- [X] T067 [US5] Add roving focus to `src/lib/fretboard/Fretboard.svelte`: `FocusState { stop, inside }`, only the stop has `tabindex="0"`, `keydown` on the grid via `moveFocus` (arrows move DOM focus without activating, Enter/Space activate, `preventDefault` only for handled keys), `focusin`/`focusout` toggle `inside`, tap focus updates `stop`
- [X] T068 [US5] Add `.focus-ring` rect (aria-hidden, outline token, drawn independent of markers) shown iff `inside`, and on keyboard focus of an off-screen cell call `scrollIntoViewTarget` + `animateScroll`
- [X] T069 [US5] Add description UI to `src/lib/fretboard/Fretboard.svelte`: `.sr-only` `aria-live="polite" aria-atomic="true"` region updated only after first render and only when `describeView` output changes; toggle `<button aria-expanded aria-controls>` labelled with `fretboard_description_show/hide` and `<p id="{id}-description" hidden>` below the board (wraps, no truncation)
- [X] T070 [US5] Run T062–T065 (`rtk pnpm test:unit` and `rtk pnpm test:e2e`); fix until US5 passes

**Checkpoint**: All user stories independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T071 [P] Write `docs/adr/0005-fretboard-as-single-svg-aria-grid.md` and `docs/adr/0006-accidentals-font-subset.md`; amend `docs/adr/0004-test-only-fault-injection.md` with the fixture hook note (R-18)
- [X] T076 [P] Amend `.specify/memory/constitution.md` to 1.2.0 with a Sync Impact Report: MINOR stack change of the "Fonts" row (self-hosted accidentals subset + system UI stack with tabular numerals, paired with ADR 0006 in T071) and PATCH clarification that each Principle I table/property suite is added by the slice introducing the theory code it tests
- [X] T072 [P] Edit `scripts/check-no-fault-hook.mjs` to also fail when `build/` contains `__fmFretboardFixture` or `__fmFretboardEvents`; extend `tests/unit/no-fault-hook.test.ts` (edit)
- [X] T073 Run production gates from quickstart §5: `rtk pnpm build`, `node scripts/check-no-fault-hook.mjs build`, `node scripts/check-bundle-size.mjs build` (initial JS ≤ 80 KB gzip), `rtk pnpm lhci` (mobile perf ≥ 90, home ≤ 3 s); confirm `build/fonts/fm-accidentals.woff2` exists; re-run `e2e/perf.spec.ts` for tool open/switch ≤ 300 ms with the SVG in zone C
- [X] T074 Run static gates and the full suite: `rtk pnpm lint`, `rtk pnpm format:check`, `rtk pnpm check`, `rtk pnpm test:unit --coverage`, `rtk pnpm build:test:skew && rtk pnpm test:e2e` across `phone`, `desktop`, `phone-touch`, `firefox`, `webkit`, `nojs`
- [X] T075 Walk through `specs/002-interactive-fretboard/quickstart.md` §1–§6 and the 26 acceptance scenarios (US1 1–6, US2 1–5, US3 1–4, US4 1–5, US5 1–6) to confirm each maps to a passing automated test; fix gaps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none — start immediately
- **Foundational (Phase 2)**: depends on Setup (T001, T004 for notation messages) — BLOCKS all stories
- **US1 (Phase 3)**: depends on Foundational; delivers the MVP
- **US2–US5**: each depends on Foundational and on `Fretboard.svelte` from US1 (T024); within that file tasks run in story order
- **Polish (Phase 8)**: after all desired stories

### User Story Dependencies

- **US1 (P1)**: no story dependencies
- **US2 (P1)**: builds on the US1 component; markers independently testable via fixtures
- **US3 (P1)**: builds on the US1 component; `nearestPosition`/reducer are pure and testable alone
- **US4 (P1)**: builds on US1 (geometry, scroller); mouse drag-to-scroll reuses the US3 gesture reducer (T045)
- **US5 (P2)**: builds on US1; uses `scrollIntoViewTarget` (T057) and `animateScroll` (T058) from US4

### Within Each Story

- Tests first and failing → pure helpers → `Fretboard.svelte` edits → shell wiring → run suites
- Same-file tasks (`Fretboard.svelte`, `geometry.ts`, `interaction.ts`, `fretboard.test.ts`, `e2e/fretboard.spec.ts`) are sequential

### Parallel Opportunities

- Setup: T002–T007 together after T001
- Foundational: T008–T010 together, then T011 → T012/T013 (T012 and T013 parallel once T011 done), T014 any time
- US1 tests T016–T020 together; T022 and T023 parallel
- US2 tests T029–T032 together; T033, T034, T035 parallel
- US3 tests T040–T043 together; US4 tests T050–T055 together; T058 parallel to T056/T057
- US5 tests T062–T065 together
- Polish: T071, T072, T076 parallel

---

## Parallel Example: User Story 1

```bash
# Tests together (different files):
Task: "geometry layout tests in tests/unit/fretboard/geometry.test.ts"
Task: "positionName tests in tests/unit/fretboard/description.test.ts"
Task: "static component tests in tests/unit/fretboard/fretboard.test.ts"
Task: "US1 e2e in e2e/fretboard.spec.ts"

# Then helpers together:
Task: "metrics.ts in src/lib/fretboard/metrics.ts"
Task: "positionName in src/lib/fretboard/description.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → Phase 2 Foundational (pure theory/instrument/notation, test-first)
2. Phase 3 US1 → STOP and validate: accurate static board on `/notes`, `/triads`, and home thumbnails
3. Demo/merge if ready

### Incremental Delivery

1. Setup + Foundational → pitch/instrument/notation proven by TM-1/TM-3 tables
2. + US1 → accurate board (MVP)
3. + US2 → marker vocabulary and accidentals font
4. + US3 → tap/click events to tools
5. + US4 → phone scrolling and auto-scroll
6. + US5 → keyboard and screen-reader operation
7. Polish → ADRs, production gates, full quickstart

### Notes

- [P] = different files, no dependency on incomplete tasks
- Constitution I merge gate here = TM-1/TM-3 tables + pitch properties, per the gate-scope clause of constitution 1.2.0 (TM-4–TM-7 tables and NFR-9.3 properties are added by the triad/CAGED slices that introduce the code they test)
- No inline `style` attributes anywhere (CSP); every visual value is a token; every string is in the catalog
- Commit after each task or logical group (Conventional Commits)
