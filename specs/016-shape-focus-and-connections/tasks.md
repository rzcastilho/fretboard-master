---

description: "Task list for 016 Shape Focus and Connections"
---

# Tasks: Shape Focus and Connections

**Input**: Design documents from `/specs/016-shape-focus-and-connections/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/caged-focus-api.md, contracts/caged-focus-ui.md, quickstart.md

**Tests**: INCLUDED. Constitution IV (test-first) and plan.md require it: pure modules are built test-first, and every acceptance scenario maps to Vitest or Playwright. Write each test task first and confirm it FAILS before the implementation task that follows it.

**Organization**: Tasks are grouped by user story. US1, US2 and US3 each build on the shared foundation but are independently testable. US2 and US3 both touch `caged-model.ts`, `Fretboard.svelte` and `CagedTool.svelte`, so run the stories sequentially in priority order (the plan's Implementation Order) unless the files are split among developers.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US4 (maps to spec.md user stories)
- Paths are repo-root relative. Single SvelteKit project: `src/lib/...`, `tests/unit/...`, `e2e/...`, `messages/en.json`.

## Verification (CLAUDE.md "Verification tiers")

- Per task: `pnpm vitest run <touched test paths>`.
- E2E: `pnpm build:test` once after changing `src/`, then `pnpm test:e2e:fast <spec files added or edited>`.
- New screenshot: `pnpm playwright test <spec> -g "<test name>" --project=phone --project=phone-touch --project=desktop --update-snapshots`.
- End of slice, once: `pnpm verify`. Do NOT run `pnpm test:e2e` (full matrix) or `pnpm lhci` locally.
- All new strings go ONLY into `messages/en.json` (plan: pt/es arrive with the localization slice). Keys: `caged_group_shape`, `caged_shape_all`, `caged_next_shape`, `caged_previous_shape`, `caged_show_connections`, `caged_focus_status`, `caged_focus_none`, `caged_description_connection`, `caged_rotate_hint`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline and design tokens used by every story.

- [X] T001 Record baseline: run `pnpm vitest run tests/unit/theory/caged.test.ts tests/unit/state/caged-store.test.ts tests/unit/caged/caged-tool.test.ts` (must pass) and `pnpm build && node scripts/check-bundle-size.mjs`, noting the current initial JS gzip size (headroom about 1.8 KB under the 92 KB cap, plan R-12).
- [X] T002 [P] Add tokens to `src/lib/styles/tokens.css`: `--duration-medium: 500ms` (set to `0s` under the existing `prefers-reduced-motion: reduce` block, like the other durations), `--connection-ring` (text color in every theme and in forced-colors), `--connection-ring-width`, `--connection-ring-gap`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure theory, focus logic, view state and renderer types that every story consumes.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests first (confirm they FAIL)

- [X] T003 [P] Add connection table tests to `tests/unit/theory/caged.test.ts`: C major, standard tuning, 22 frets must equal exactly the set (string, fret, degree) (5,3,R) (4,5,5) (3,5,R) (2,5,3) (6,8,R) (1,8,R) (4,10,R) (3,12,5) (2,13,R) (1,12,3) plus the +12 repeats for pairs drawn at 22 frets (C@12→A@15→G@17→E@20); C minor must equal (5,3,R) (4,5,5) (3,5,R) (6,8,R) (2,8,5) (1,8,R) (4,10,R) (3,12,5) (2,13,R) plus the +12 repeats; no other position is a connection (FR-009, SC-002). Also pin: 12-fret board (C@0 A@3 G@5 E@8) has pairs C→A, A→G, G→E only and (4,10,R) is NOT a connection; Drop D has no string-6 connection; seven-string has no string-7 connection; fewer than 2 occurrences gives `[]`; output sorted by fret then string descending; `pairs.length` is 1 or 2; `sharedPositions(a, b)` returns the pair intersection and ignores synthesized altered string-6 notes.
- [X] T004 [P] Add connection property tests to `tests/unit/theory/caged.property.test.ts` (fast-check over random key, quality, fret count 12–24 and compatible tunings): every connection's position appears in both occurrences of each listed pair, degree agrees, string never 7, never an altered string 6, deterministic order, and results equal a brute-force intersection of adjacent occurrences.
- [X] T005 [P] Create `tests/unit/state/caged-focus.test.ts` covering every function in contracts/caged-focus-api.md §2: `occurrenceIndex`/`focusOfIndex` round trip (ordinal 0 = nearest the nut); `focusFromLetter` ('all' gives `null`, already-focused letter returns the same object reference, otherwise ordinal 0, undrawn letter returns `f` unchanged); `toggleTagFocus` (focused index gives `null`); `stepFocus` (no wrap, returns `f` unchanged at either end or with `null` focus, a letter drawn twice is visited once per occurrence); `stepAvailability` (both `false` with `null` focus; previous false at index 0; next false at last); `drawnLetters` on 12 frets omits D; `reresolveFocus` rules 1–5 (null stays null, empty gives null, keep same letter+ordinal, nearest same-letter start, else nearest start with the lower start winning a tie); quickstart cases (C major E focused → G major keeps E; 24→12 frets with A@15 ordinal 1 → A@3). Add a test asserting `STEP_WINDOW_MS === 500` and equals the `--duration-medium` value read from `src/lib/styles/tokens.css`.
- [X] T006 [P] Extend `tests/unit/state/caged-view.test.ts`: `initialCagedView()` and `resetCaged()` give `focus: null`, `connections: false`; `setFocus` and `setConnections` return the same object for an equal value; `selectRoot`/`setQuality` keep prior behavior; `switchSpelling` leaves focus untouched; `equalsCagedView` compares focus (letter and ordinal) and connections.

### Implementation

- [X] T007 Implement `sharedPositions` and `cagedConnections` plus the `CagedConnection` interface in `src/lib/theory/caged.ts` per data-model §1 (exclude `occ.alteredString && note.string === 6` first; pure; imports only `./pitch` and `./triad`; sort by fret then string descending). Make T003 and T004 pass: `pnpm vitest run tests/unit/theory/caged.test.ts tests/unit/theory/caged.property.test.ts`.
- [X] T008 Create `src/lib/state/caged-focus.ts` per data-model §3 and contracts §2: export `STEP_WINDOW_MS = 500`, `FocusChoice`, `occurrenceIndex`, `focusOfIndex`, `focusFromLetter`, `toggleTagFocus`, `stepFocus`, `stepAvailability`, `drawnLetters`, `reresolveFocus`. No Svelte, DOM or Paraglide imports (may import `../theory/caged` types). Unchanged-focus results return the same object reference. Make T005 pass.
- [X] T009 Extend `src/lib/state/caged-view.ts` per data-model §2: add `CagedFocus { letter: CagedShapeId; ordinal: number }`, `focus: CagedFocus | null` and `connections: boolean` to `CagedViewState`, `setFocus`, `setConnections`, defaults in `initialCagedView`/`resetCaged`, and compare both in `equalsCagedView`. Make T006 pass.
- [X] T010 [P] Extend `src/lib/fretboard/types.ts`: add optional `Marker.ring?: boolean` and `DisplayModel.region.align?: 'center'` (both optional so other tools are unaffected).

**Checkpoint**: `pnpm vitest run tests/unit/theory/caged.test.ts tests/unit/theory/caged.property.test.ts tests/unit/state/caged-focus.test.ts tests/unit/state/caged-view.test.ts` passes and `pnpm check` has no type errors.

---

## Phase 3: User Story 1 - Focus on one shape (Priority: P1) 🎯 MVP

**Goal**: Tag, zone-B selector or letter pick puts one occurrence in focus: highlighted markers, dimmed others, lit band, pressed tag, centred scroll (≤ 500 ms, instant under reduced motion). Leaving focus restores normal. Focus re-resolves on key, quality and instrument change.

**Independent Test**: Open `/caged` in C major, activate the E tag: E highlighted, others dimmed, band over frets 8–10 (plan erratum; spec text says 7–10), tag `aria-pressed=true`, selector E checked, board centred; activate again and everything returns to normal.

### Tests for User Story 1 (write first, confirm FAIL)

- [X] T011 [P] [US1] Extend `tests/unit/state/caged-model.test.ts` for focus: `cagedOccurrencesFor(view, instrument)` is exported and sorted; with focus set, focused occurrence notes are `highlighted` (shared markers too) and all others `dimmed`; no focus is all `normal`; `region` is `{ start, end, align: 'center' }` for the focused occurrence and absent without focus (open shape band starts at the open-string column); `tags[i].pressed === (i === focusIndex)`, `tagsInteractive` true and tag id stays `"<letter>@<start>"`; `focusIndex`, `focused`, `steps`, `drawnLetters` fields (12 frets omits D); description starts with `caged_focus_status` ("{shape} shape in focus, frets {lo} to {hi}.") or `caged_focus_none` ("All shapes."); non-compatible tuning gives `focusIndex: null`, steps both false, empty `drawnLetters`.
- [X] T012 [P] [US1] Add `centerScrollTarget` tests to `tests/unit/fretboard/interaction.test.ts`: `clamp((colStart + colEnd)/2 − width/2, 0, layout.width − width)`; `null` when the board fits or the target is within 0.5 px of current scroll; clamps near the nut and the last fret; mirrored layouts (left-handed/orientation via `layout.columns`) still centre the band.
- [X] T013 [P] [US1] Extend `tests/unit/fretboard/fretboard.test.ts`: a `region` with `align: 'center'` renders `.region-band` and scrolls via `centerScrollTarget` using the `--duration-medium` duration (instant when reduced motion); regions without `align` and models without focus render exactly as before (existing snapshots unchanged).
- [X] T014 [P] [US1] Extend `tests/unit/triads/choice-group.test.ts`: a per-option `disabled` renders `aria-disabled="true"`, stays focusable, is skipped by arrow keys, and activating it does nothing; choosing the already-checked option does nothing; a group-level disabled sets `aria-disabled` on the group.
- [X] T015 [P] [US1] Extend `tests/unit/state/caged-store.test.ts`: `chooseShape` (letter focuses ordinal 0, no change when focus already on that letter, `'all'` clears); `toggleTag("<letter>@<start>")` toggles that exact occurrence and an unknown id is a no-op; `selectRoot`/`setQuality` re-resolve focus; spelling change keeps focus; `reset()` clears focus; `applyInstrument` returns `true` iff a focused occurrence existed and the re-resolved one differs in letter or start (24→12 frets with A@15 focused returns `true`; handedness/orientation change keeps focus and returns `false`); a tuning becoming non-compatible clears focus and returns `false`; `viewInStandard()`/`endTemporary()` clear focus when the resulting tuning is non-compatible; focus is never written to storage.
- [X] T016 [P] [US1] Extend `tests/unit/state/instrument-store.test.ts`: `adjustedIn` becomes `'caged'` on the caged screen when `applyInstrument` returns `true`; presentation-only changes and `restore` never set `'caged'`.
- [X] T017 [P] [US1] Extend `tests/unit/caged/caged-tool.test.ts`: tags render as buttons with `aria-pressed` and accessible name equal to the tag text, in neck order; zone-B shape selector radiogroup labelled `caged_group_shape` with radios C, A, G, E, D, then "See all" (checked when nothing is focused, otherwise the focused letter); undrawn letters `aria-disabled`; whole group `aria-disabled` for a non-compatible tuning; tag activation and selector choice show the same state; the `instrument_adjusted` notice shows when `adjustedIn === 'caged'`.
- [X] T018 [P] [US1] Create `e2e/caged-focus.spec.ts` with US1 cases from quickstart §2: focus via tag (markers `highlighted`/`dimmed`, `.region-band` over frets 8–10, `aria-pressed=true`, selector E checked, `scrollLeft` reaches the clamped centre within 500 ms using `page.clock`); leave via second tap and via **See all**; selector G equals tapping the G tag; 22-fret second C tag focuses only that occurrence and picking **C** changes nothing; 12-fret instrument disables **D**; reduced motion (`page.emulateMedia({ reducedMotion: 'reduce' })`) scrolls in the same frame; focus survives Notes → CAGED navigation, resets on reload, and `localStorage` `fretboard-master:prefs` is unchanged; axe has zero violations with focus on; keyboard-only operation of tags and selector.

### Implementation for User Story 1

- [X] T019 [P] [US1] Add `centerScrollTarget(layout, start, end, viewport): number | null` to `src/lib/fretboard/interaction.ts` per data-model §5. Make T012 pass.
- [X] T020 [P] [US1] Add per-option `disabled` (`aria-disabled`, focusable, skipped by arrow navigation, activation ignored; group-level `disabled`) to `src/lib/tools/ChoiceGroup.svelte`. Make T014 pass.
- [X] T021 [US1] Extend `src/lib/state/caged-model.ts` per data-model §4: export `cagedOccurrencesFor`; add `focusIndex`, `focused`, `steps`, `drawnLetters` (and `connections: []` placeholder until US3) to `CagedDisplay`; map focus to `highlighted`/`normal`/`dimmed` marker emphasis, `region` with `align: 'center'`, `tags[i].pressed`, `tagsInteractive: true`, and the leading focus description sentence using `caged_focus_status` / `caged_focus_none`; non-compatible tuning returns the empty focus fields. Add `caged_focus_status` and `caged_focus_none` to `messages/en.json`. Make T011 pass.
- [X] T022 [US1] Update `src/lib/fretboard/Fretboard.svelte`: when `region.align === 'center'` use `centerScrollTarget` with the existing rAF `animateScroll` and `--duration-medium`; emphasis (opacity and size) transitions use `--duration-medium`; instant under reduced motion. Make T013 pass.
- [X] T023 [US1] Extend `src/lib/state/caged.svelte.ts` per contracts §5: add `chooseShape(c)`, `toggleTag(id)`, focus re-resolution (`reresolveFocus`) in `selectRoot`/`setQuality`, `applyInstrument(next, name): boolean` re-resolving focus and reporting an occurrence change, focus clearing on non-compatible tuning in `applyInstrument`/`viewInStandard()`/`endTemporary()`, `reset()` clearing focus, and focus/connections never persisted. Make T015 pass.
- [X] T024 [US1] Update `src/lib/state/instrument.svelte.ts` so `adjustedIn` may be `'caged'`: `adjCaged = caged.applyInstrument(inst, tuningLabel(tuning))` and `screen === 'caged' && adjCaged ? 'caged'` per contracts §6 (presentation-only branch and `restore` never set it). Make T016 pass.
- [X] T025 [P] [US1] Create `src/lib/tools/caged/CagedFocusControls.svelte`: the zone-B shape selector as a `ChoiceGroup` (`role="radiogroup"`, label `caged_group_shape`, options C, A, G, E, D with undrawn letters disabled, then `caged_shape_all` "See all" checked when no focus; whole group disabled for a non-compatible tuning; letters are literal parameters in every language). Add `caged_group_shape` and `caged_shape_all` to `messages/en.json`.
- [X] T026 [US1] Update `src/lib/tools/caged/CagedTool.svelte`: render `CagedFocusControls` below the Quality group and above the key heading (wired to `chooseShape`), make fretboard tags interactive toggle buttons wired to `toggleTag` (≥ 44×44 px via `--target-min`, neck-order tab order), and show the existing `Notice` with `instrument_adjusted` when `instrument.adjustedIn === 'caged'`. Make T017 pass.
- [X] T027 [US1] Run `pnpm vitest run` on every US1 test file, `pnpm build:test`, then `pnpm test:e2e:fast e2e/caged-focus.spec.ts e2e/caged.spec.ts`; fix failures.
- [X] T028 [US1] Measure the bundle (`pnpm build && node scripts/check-bundle-size.mjs`) and note the delta against T001. If the 92 KB cap is crossed, STOP and follow plan Complexity Tracking (MINOR constitution amendment with Sync Impact Report), never trim required behavior. _Measured after US1: initial JS 91.5 KB gzip (baseline about 90.2 KB, delta about +1.3 KB), under the 92 KB cap with about 0.5 KB headroom left for US2–US4._

**Checkpoint**: US1 is fully functional and testable on its own (MVP).

---

## Phase 4: User Story 2 - Step to the neighbor shape (Priority: P1)

**Goal**: **Previous/Next shape** (zone E, always rendered) moves focus to adjacent drawn occurrences with no wrap; the positions shared by departing and arriving occurrences carry the connection ring and `highlighted` emphasis for a 500 ms window (also under reduced motion), restarting on each press.

**Independent Test**: Focus E in C major, press **Next shape**: focus on D, string 4 fret 10 ringed and `highlighted` until 500 ms pass; on the last occurrence **Next shape** is disabled.

### Tests for User Story 2 (write first, confirm FAIL)

- [X] T029 [P] [US2] Extend `tests/unit/state/caged-model.test.ts` for the transition: `buildCagedModel(..., transition)` marks positions in `transition.positions` (`"s:f"` keys) `highlighted` with `ring: true` even with connections off; non-transition positions keep the focus-driven emphasis; null transition changes nothing.
- [X] T030 [P] [US2] Extend `tests/unit/state/caged-store.test.ts` with fake timers: `step(1)` from E (C major) moves focus to D and sets `transition.positions` to `sharedPositions(E, D)` (contains `"4:10"`); the transition is present at t = 0 and 499 ms and gone at 500 ms; a second `step` within the window replaces the pair and restarts the 500 ms window (no stale positions); `step` at either end or with no focus is a no-op with no transition; `step(-1)` moves to the neighbor nearer the nut; a letter drawn twice is visited once per occurrence; the transition is cleared immediately by `chooseShape`, `toggleTag`, `reset`, `selectRoot`, `setQuality`, `applyInstrument`, and `resetCagedForTests()` (which also clears the timer).
- [X] T031 [P] [US2] Extend `tests/unit/fretboard/fretboard.test.ts`: `Marker.ring === true` renders a `<circle class="connection-ring">` inside the marker group (so emphasis opacity/scale applies), is `aria-hidden`, and never animates; markers without `ring` render exactly as before.
- [X] T032 [P] [US2] Extend `tests/unit/caged/caged-tool.test.ts`: zone-E buttons `caged_previous_shape` then `caged_next_shape` are always rendered in that order; with no focus both have `aria-disabled="true"` and stay in the tab order; Previous disabled at index 0 and Next at the last index (checked for 12, 22 and 24 frets, SC-003); labels never flip for left-handed/orientation; pressing Next moves the focus and shows the ring for the window.
- [X] T033 [P] [US2] Extend `e2e/caged-focus.spec.ts` with US2 cases using `page.clock`: E focused, connections off, **Next shape** → D focused, `s4f10` has `.connection-ring` and `highlighted`, ring gone after +500 ms; **Previous shape** shows the shared pair; ends disabled (last → Next, first → Previous, none → both); pressing Next twice within 500 ms rings only the second pair; reduced motion still shows the ring for the window; axe clean; keyboard operation of both buttons.

### Implementation for User Story 2

- [X] T034 [US2] Add the transition to `src/lib/state/caged-model.ts`: `buildCagedModel(view, instrument, context, transition?)` sets `highlighted` and `ring: true` for positions in `transition.positions`. Make T029 pass.
- [X] T035 [US2] Extend `src/lib/state/caged.svelte.ts`: `step(dir)` using `stepFocus`; when focus moved set `transition = { positions: sharedPositions(departing, arriving) as "s:f" keys }`, clear any pending timer then `setTimeout(clear, STEP_WINDOW_MS)`; expose the `transition` getter; clear transition and timer on any non-step focus change, `reset`, key/quality/instrument change, and `resetCagedForTests()`/teardown. Make T030 pass.
- [X] T036 [P] [US2] Render `<circle class="connection-ring">` for `Marker.ring` inside the marker group in `src/lib/fretboard/Fretboard.svelte`, styled with `--connection-ring`, `--connection-ring-width` and `--connection-ring-gap` (a ring shape, never color alone; no animation). Make T031 pass.
- [X] T037 [US2] Update `src/lib/tools/caged/CagedTool.svelte`: add a zone-E section with **Previous shape** and **Next shape** buttons (`aria-disabled` driven by `display.steps`, both disabled with no focus or a non-compatible tuning, ≥ 44×44 px, always rendered so there is no layout shift) wired to `step(-1)`/`step(1)`, and pass `caged.transition` into `buildCagedModel`. Add `caged_previous_shape` and `caged_next_shape` to `messages/en.json`. Make T032 pass.
- [X] T038 [US2] Run targeted Vitest for US2 files, `pnpm build:test`, then `pnpm test:e2e:fast e2e/caged-focus.spec.ts`; fix failures.

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Show connections (Priority: P2)

**Goal**: A zone-D **Show connections** switch (off by default) rings every computed connection with or without focus; rings follow focus emphasis; the description names each ringed connection's two shapes.

**Independent Test**: In C major with all shapes, turn the switch on: the TM-6.3 anchors (A→G: s4f5, s3f5, s2f5, plus the rest) carry the ring and no other marker does.

### Tests for User Story 3 (write first, confirm FAIL)

- [X] T039 [P] [US3] Extend `tests/unit/state/caged-model.test.ts`: `connections` is `cagedConnections(occurrences)`; with `view.connections` true every connection marker has `ring: true` (one ring for a shared position drawn as one marker) with or without focus; with it false no ring appears outside a transition; with focus on, rings on the focused occurrence stay `highlighted` and rings elsewhere `dimmed`; partial fits ring only between adjacent drawn occurrences; each ringed connection adds a `caged_description_connection` sentence ("String {string}, fret {fret}, {interval}, shared by {a} and {b} shapes.") after the existing sentences; non-compatible tuning has no connections; TM-6.3 (C major) and TM-7.2 (C minor) ringed sets equal the anchor tables exactly (SC-002); F♯ minor rings equal the C-minor pattern shifted by 6 frets modulo 12.
- [X] T040 [P] [US3] Extend `tests/unit/state/caged-store.test.ts`: `setConnections(on)` toggles the flag, leaves any transition untouched, is never persisted, `reset()` turns it off, and a non-compatible tuning keeps its value.
- [X] T041 [P] [US3] Extend `tests/unit/caged/caged-tool.test.ts`: zone-D `<button role="switch" aria-checked>` labelled `caged_show_connections`, placed before **Reset tool**, off by default, visible on/off position (not color alone), `aria-disabled` with value kept for a non-compatible tuning, **Reset tool** turns it off.
- [X] T042 [P] [US3] Extend `e2e/caged-focus.spec.ts` with US3 cases: C major connections on rings exactly the TM-6.3 anchors (s4f5, s3f5, s2f5 etc.); C minor rings exactly TM-7.2 (Gm→Em includes s2f8); off and no step shows no `.connection-ring`; connections on plus focus keeps every ring; the switch and focus survive Notes → CAGED, reset on reload, and `localStorage` prefs unchanged; axe clean with connections on. Add a TM-9 view 18 test (F♯ minor, five shapes, connections on, AF-1) to `e2e/caged-tm9.spec.ts`.

### Implementation for User Story 3

- [X] T043 [US3] Extend `src/lib/state/caged-model.ts`: compute `connections = cagedConnections(occurrences)` (empty for non-compatible tuning), set `Marker.ring` when `view.connections` and the position is in `connections`, and append one `caged_description_connection` sentence per ringed connection naming `occs[lower].shape.id` and `occs[upper].shape.id`. Add `caged_description_connection` to `messages/en.json`. Make T039 pass.
- [X] T044 [US3] Make sure `setConnections(on)` in `src/lib/state/caged.svelte.ts` (contracts §5) calls the view's `setConnections`, leaves the transition untouched and never persists. Make T040 pass.
- [X] T045 [US3] Update `src/lib/tools/caged/CagedTool.svelte`: add the zone-D `role="switch"` **Show connections** button before **Reset tool**, with a visible on/off position, `aria-checked`, and `aria-disabled` (value kept) for a non-compatible tuning. Add `caged_show_connections` to `messages/en.json`. Make T041 pass.
- [X] T046 [US3] Run targeted Vitest for US3 files, `pnpm build:test`, `pnpm test:e2e:fast e2e/caged-focus.spec.ts e2e/caged-tm9.spec.ts`, then generate the new snapshots: `pnpm playwright test e2e/caged-tm9.spec.ts -g "tm9 view 18" --project=phone --project=phone-touch --project=desktop --update-snapshots`. Check the rings sit on the C-minor anchor pattern shifted by 6 frets modulo 12 before committing the images.

**Checkpoint**: US1, US2 and US3 all work independently.

---

## Phase 6: User Story 4 - A hint to rotate on phones (Priority: P3)

**Goal**: A one-time, non-blocking, dismissible notice on a portrait phone (width ≤ 599, height > width), recorded in the versioned preferences record, cleared by **Erase my preferences**, shown at most once per load if storage is unavailable.

**Independent Test**: On a 390×844 viewport with empty storage open `/caged`, see the notice, then reopen CAGED and reload; it never appears again. At 1280×800 it never appears and nothing is recorded.

### Tests for User Story 4 (write first, confirm FAIL)

- [X] T047 [P] [US4] Create `tests/unit/state/rotate-hint.test.ts`: `isPhonePortrait(390, 844)` true; `isPhonePortrait(844, 390)` and `isPhonePortrait(768, 1024)` false; boundary width 599 true and 600 false; square (599, 599) false; `shouldShowRotateHint` false when `recorded` is true.
- [X] T048 [P] [US4] Extend `tests/unit/prefs/schema.test.ts`: a record without `rotateHint` parses to `rotateHintShown: false`; an invalid `rotateHint` value falls back to `false` without affecting other fields (`v.fallback(v.boolean(), false)`); `serializePreferences` writes `"rotateHint": true` only when true, `version` stays `1`, and existing fixtures in `tests/unit/prefs/fixtures` serialize byte-identical.
- [X] T049 [P] [US4] Extend `tests/unit/state/preferences-store.test.ts`: `markRotateHintShown()` is idempotent, sets `rotateHintShown` and persists `"rotateHint": true`; with storage unavailable it does not throw and the in-load flag still makes `rotateHintShown` true; `erase()` clears it; Reset tool does not.
- [X] T050 [P] [US4] Extend `tests/unit/caged/caged-tool.test.ts`: the `caged_rotate_hint` Notice ("Turn your phone sideways to see more of the neck.") shows on a portrait phone with nothing recorded, is recorded on display, is dismissible and non-modal, hides on rotation to landscape and on unmount, never shows (and is never recorded) for tablet, desktop or landscape phone.
- [X] T051 [P] [US4] Extend `e2e/caged-focus.spec.ts` with US4 cases: 390×844 with empty storage shows the notice and writes `"rotateHint":true` with `version` 1, a reload shows none; 1280×800 shows none and records nothing; blocked storage shows at most once per page load; **Erase my preferences** clears the record so it may show again; Reset tool keeps it; axe clean.

### Implementation for User Story 4

- [X] T052 [P] [US4] Create `src/lib/state/rotate-hint.ts` with `PHONE_MAX_WIDTH = 599`, `isPhonePortrait(width, height)` and `shouldShowRotateHint({ width, height, recorded })`. Make T047 pass.
- [X] T053 [P] [US4] Add `rotateHintShown` (stored as `rotateHint`, `v.fallback(v.boolean(), false)` on read, written only when `true`, version unchanged) to `src/lib/prefs/schema.ts`. Make T048 pass.
- [X] T054 [US4] Update `src/lib/state/preferences.svelte.ts`: expose `rotateHintShown`, add idempotent fire-and-forget `markRotateHintShown()` (`session.remember({ rotateHintShown: true })` plus a per-load flag), and have `erase()` clear it. Make T049 pass.
- [X] T055 [US4] Update `src/lib/tools/caged/CagedTool.svelte`: show a `Notice` with `caged_rotate_hint` when `shouldShowRotateHint` holds for the live viewport size, call `markRotateHintShown()` the moment it is displayed, hide it when the viewport stops being a portrait phone or on unmount. Add `caged_rotate_hint` to `messages/en.json`. Make T050 pass.
- [X] T056 [US4] Run targeted Vitest for US4 files, `pnpm build:test`, then `pnpm test:e2e:fast e2e/caged-focus.spec.ts`; fix failures.

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T057 [P] Keyboard and axe pass over tags, selector, switch and step buttons in `e2e/caged-focus.spec.ts` at phone, phone-touch and desktop viewports (focus visible, 44×44 px targets, zero axe violations with and without focus and connections), edit only if gaps remain.
- [X] T058 [P] Check `messages/en.json` contains all nine new keys and that no hard-coded user-visible string was added in `src/lib/tools/caged/`; no note names are formatted outside `src/lib/notation`.
- [X] T059 Re-measure the bundle at the end of the slice (`pnpm build && node scripts/check-bundle-size.mjs`, cap 92 KB gzip); if crossed, follow plan Complexity Tracking. _Measured at end of slice: initial JS 92.8 KB gzip. Crosses the old 92 KB cap by about 0.8 KB; constitution 1.7.0 already raised the cap to 94 KB, so the gate passes._
- [X] T060 Run quickstart.md sections 1–3 as the validation walkthrough (unit, targeted e2e, screenshot) and confirm every acceptance scenario in spec.md maps to a passing test.
- [X] T061 Run all local gates once: `pnpm verify` (check, lint, format, full Vitest with coverage — theory ≥ 95% —, build and bundle-size check). The full Playwright matrix and Lighthouse run in CI only; do not run `pnpm test:e2e` or `pnpm lhci` locally. _Result: `pnpm verify` passes. 102 test files, 2768 tests, initial JS 92.8 KB gzip (cap 94 KB). One earlier run had load-induced 5 s timeouts; they passed on rerun._

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none, start immediately.
- **Foundational (Phase 2)**: depends on Setup; BLOCKS all user stories.
- **US1 (Phase 3)**: depends on Foundational.
- **US2 (Phase 4)**: depends on Foundational and uses US1's focus store, model and `CagedTool` wiring (step needs a focused occurrence).
- **US3 (Phase 5)**: depends on Foundational; reuses the ring renderer from T036 (US2). It is testable on its own once that task exists.
- **US4 (Phase 6)**: depends on Foundational only (independent of US1–US3 except for editing `CagedTool.svelte`).
- **Polish (Phase 7)**: after all desired stories.

### Within Each Story

- Tests first and failing, then implementation.
- Pure modules before store, store before components, components before e2e.

### Task-level Notes

- T007 → T008 (focus uses `ShapeOccurrence` types only, but T021/T035 use connections) → T009.
- T021 → T022, T023, T026; T023 → T024; T025, T020 → T026.
- T034 → T035 → T037; T036 → T037.
- T043 → T044 → T045.
- T052, T053 → T054 → T055.
- Same-file edits are sequential across stories: `caged-model.ts` (T021, T034, T043), `caged.svelte.ts` (T023, T035, T044), `CagedTool.svelte` (T026, T037, T045, T055), `Fretboard.svelte` (T022, T036), `messages/en.json` (T021, T025, T037, T043, T045, T055), `e2e/caged-focus.spec.ts` (T018, T033, T042, T051).

### Parallel Opportunities

- Setup: T002 alongside T001.
- Foundational tests T003–T006 and T010 in parallel; then T007, T008 and T009 touch separate files (T008 can run alongside T007).
- US1 tests T011–T018 in parallel (different files, except T018 which only creates the e2e file); implementation T019, T020 and T025 in parallel.
- US2 tests T029–T033 in parallel; T036 parallel with T034/T035.
- US3 tests T039–T042 in parallel.
- US4 tests T047–T051 and implementation T052, T053 in parallel; US4 can proceed in parallel with US2/US3 if `CagedTool.svelte` conflicts are merged carefully.

---

## Parallel Example: User Story 1

```bash
# Launch the US1 test tasks together:
Task: "T011 caged-model focus tests in tests/unit/state/caged-model.test.ts"
Task: "T012 centerScrollTarget tests in tests/unit/fretboard/interaction.test.ts"
Task: "T014 ChoiceGroup disabled-option tests in tests/unit/triads/choice-group.test.ts"
Task: "T018 e2e US1 cases in e2e/caged-focus.spec.ts"

# Then these implementation tasks together:
Task: "T019 centerScrollTarget in src/lib/fretboard/interaction.ts"
Task: "T020 per-option disabled in src/lib/tools/ChoiceGroup.svelte"
Task: "T025 CagedFocusControls in src/lib/tools/caged/CagedFocusControls.svelte"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup, then Phase 2 Foundational (connections theory and focus logic are needed by later stories but are cheap and test-first).
2. Phase 3 US1, then STOP and validate (quickstart §2, US1 rows) and measure the bundle (T028).

### Incremental Delivery

1. Foundation → US1 (focus) → US2 (step + transition ring) → US3 (Show connections + TM-9 view 18) → US4 (rotate notice) → Polish.
2. Each story adds value without breaking earlier stories; each ends with a targeted Vitest and `test:e2e:fast` run, never the full matrix.

### Notes

- Plan erratum: the C-major E band spans frets 8–10 (chord span, FR-002), not the 7–10 in US1 scenario 1; assert 8–10 in tests.
- Minimap "window follows" is N/A (no minimap exists); pt/es catalogs are out of scope.
- Commit after each task or logical group.
