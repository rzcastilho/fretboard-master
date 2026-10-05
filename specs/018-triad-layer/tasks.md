---

description: "Task list for CAGED Triad Layer (018-triad-layer)"
---

# Tasks: CAGED Triad Layer

**Input**: Design documents from `/specs/018-triad-layer/`

**Prerequisites**: plan.md, spec.md, research.md (R-01…R-16), data-model.md, contracts/triad-layer-api.md, contracts/triad-layer-ui.md, quickstart.md

**Tests**: INCLUDED. The plan and constitution Principle IV require test-first for theory and state rules, and every acceptance scenario maps to Vitest or Playwright (research R-16, quickstart §5). Write each test task first and confirm it FAILS before its implementation task.

**Organization**: Grouped by user story (US1–US5). Foundational work blocks all stories.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on an incomplete task
- **[Story]**: US1…US5 (story phases only)
- All paths relative to repo root. Source in `src/lib/…`, unit tests in `tests/unit/…`, e2e in `e2e/`.

## Verification (per `CLAUDE.md`, constitution "Verification tiers")

- Per task: `pnpm vitest run <touched test paths>`
- E2E: `pnpm build:test` once after `src/` changes, then `pnpm test:e2e:fast <spec files added or edited>`
- New or changed screenshot only: `pnpm playwright test <spec> -g "<name>" --project=phone --project=phone-touch --project=desktop --update-snapshots`
- End of slice, once: `pnpm verify`
- Do NOT run `pnpm test:e2e` or `pnpm lhci` locally.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Tokens and message keys every story uses.

- [X] T001 [P] Add design tokens `--marker-triad-scale` (larger glyph) and `--marker-triad-stroke` (heavier outline) to `src/lib/styles/tokens.css`, including the contrast-mode variant keeping the outline; size and outline only, no new color and no new emphasis level (R-07)
- [X] T002 [P] Add the new message keys to `messages/en.json` only (R-14): `caged_layer_triad`, `caged_triad_sets` ("Triad strings"), `caged_triad_none` ("In this shape there is no close-position triad on these strings"), `caged_triad_set_unavailable` ("Strings {set}, unavailable"), `caged_triad_summary` ("{root} {quality}, {inversion}, strings {set}, frets {frets}"), `caged_triad_selected` ("Strings {set}: {root} {quality} triad, {inversion}, frets {frets}"), `caged_triad_moved` ("Strings {from} unavailable in this shape; showing strings {set}"), `caged_triad_unavailable_set` ("Strings {set}: unavailable in this shape"), `caged_triad_description` ("Triad: {notes} — {inversion}, strings {set}, frets {frets}."), `caged_triad_open` ("Open in Triads"), `triads_notice_compare_off_for_shape` ("Compare is off: this shape's comparison does not fit the fretboard"). Reuse existing `triads_inversion_*` and `caged_layer_now_on/off` keys; no hard-coded text in components

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure theory, layer identity, view state and marker type that every story needs.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Theory (test-first)

- [X] T003 [P] Write failing table tests in `tests/unit/theory/caged-triad.test.ts` for `shapeTriad`: the full R-01 C-key matrix (major and minor × C, A, G, E, D shapes × sets 6-5-4, 5-4-3, 4-3-2, 3-2-1, standard tuning, 6 strings, 24 frets, including nulls and `occurrence`), C major D shape set 3 = `second`, `12-13-12`, `occurrence 1`; C shape set 3 = `0-1-0` (open position); 12-fret E shape (set 6 null, sets needing fret > 12 null); Drop D D major E shape set 6 (string 6 from real tuning or null); AF-21 7-string set 7 available for at least one shape; Half step down A shape set 3 same frets as standard; non-ascending custom set (`does-not-close`) → null
- [X] T004 [P] Write failing property tests in `tests/unit/theory/caged-triad.property.test.ts` (fast-check; 12 keys × 2 qualities × every drawn occurrence × fret counts 12/22/24, plus random compatible tunings) for invariants T-1 (every position is an Arpeggio-layer position via `layerNotes` filtered by `inLayer(d, 'arpeggio', q)`), T-2 (root, third, fifth once each; close position; `pitches` strictly rising and `pitches[2] − pitches[0] < 12`), T-3 (`frets` equals `occurrences(triadShape(open3, triad, inversion).frets, fretCount)[occurrence]`), T-4 (non-null if any close-position triad of the set lies in the window), T-5 (smallest `span(frets)`, then lowest `frets[0]`)
- [X] T005 Implement `src/lib/theory/caged-triad.ts` (pure; imports only `./pitch`, `./triad`, `./triad-shape`, `./caged`): export `ShapeTriad` (`set`, `inversion`, `frets`, `functions`, `occurrence`, `pitches`; fret bounds `[max(0, region.start), min(fretCount, region.end)]`) and `shapeTriad(occ, openPitches, triad, set, fretCount)` following R-01 steps 1–5 and the R-02 tie-break. Make T003 and T004 pass

### Layer identity

- [X] T006 [P] Write failing tests in `tests/unit/theory/caged-layers.test.ts` for the `'triad'` layer: `LAYER_PRIORITY` equals `['triad','chord','arpeggio','pentatonic','scale']`, `MelodicLayer` excludes `'triad'`, `LAYER_DEGREES` has no triad entry
- [X] T007 Update `src/lib/theory/caged-layers.ts`: `CagedLayer` gains `'triad'`; `MelodicLayer = 'arpeggio' | 'pentatonic' | 'scale'` as an explicit union; `LAYER_PRIORITY` triad first (R-03). Make T006 pass and keep the existing slice 017 tests green

### View state and marker type

- [X] T008 [P] Write failing tests in `tests/unit/state/caged-view.test.ts`: `layers.triad` false and `triadSet` null initially and after `resetCaged`; `setTriadSet` returns the same reference when equal; `equalsLayers` and `equalsCagedView` compare `triad` and `triadSet`; `CHORD_ONLY.triad === false`
- [X] T009 Update `src/lib/state/caged-view.ts`: `LayersOn.triad: boolean`, `CagedViewState.triadSet: StringSetId | null`, `setTriadSet`, `CHORD_ONLY` / initial / reset values, equality functions (data-model §2). Make T008 pass
- [X] T010 [P] Widen `Marker.layer` to `'arpeggio' | 'triad'` in `src/lib/fretboard/types.ts`
- [X] T011 Write failing tests in `tests/unit/state/caged-triad.test.ts` for the pure helpers (contract §3 table): `triadAvailability` (`[]` when occ null; one entry per set, four on six strings and five on seven), `defaultTriadSet` (C major A shape → 3; G shape → 6; 7 strings with 3 unavailable → first available from 7; none → null), `settleTriadSet` (`(3, A-shape)` → `{3,false}`; `(3, G-shape)` → `{6,true}`; `(3, none available)` → `{3,false}`), `selectedTriad`, `triadRevealIds` (ids `triad:s:f`, pitch ascending, ties → higher string first), `triadHandoff` (null when `temporary` or `t` null)
- [X] T012 Implement `src/lib/state/caged-triad.ts` (pure; no Svelte, DOM or paraglide): `SetAvailability`, `TriadsHandoff`, `triadAvailability`, `defaultTriadSet`, `settleTriadSet`, `selectedTriad`, `triadRevealIds`, `triadHandoff` per contract §3 and R-05. Make T011 pass

**Checkpoint**: `pnpm vitest run tests/unit/theory/caged-triad.test.ts tests/unit/theory/caged-triad.property.test.ts tests/unit/theory/caged-layers.test.ts tests/unit/state/caged-view.test.ts tests/unit/state/caged-triad.test.ts` all green. Foundation ready.

---

## Phase 3: User Story 1 - Find the triad inside the shape I am holding (Priority: P1) 🎯 MVP

**Goal**: With a shape in focus, turning on Triad and picking a set highlights the close-position triad with root/third/fifth markers, labels, a distinct triad treatment and a low-to-high reveal.

**Independent Test**: C major, standard tuning, focus the A shape, turn on Triad, pick 3-2-1: frets 5-5-3 (C, E, G) highlighted, nothing else highlighted as triad; Name labels show C, E, G.

### Tests for User Story 1 ⚠️ (write first, confirm they fail)

- [X] T013 [P] [US1] Resolution tests in `tests/unit/state/caged-layers.test.ts`: contract §2 behavior table (chord + triad: s3f5, s2f5, s1f3 are `triad`, each key once; triad only with Chord off; Arpeggio on then off gives identical triad positions (I-10); focus cleared gives zero triad; triad null gives zero triad; all five layers one entry per key with priority triad > chord > arpeggio > pentatonic > scale); invariants I-8 (exactly three triad positions) and I-9 (never also another layer); `layerCounts` has `triad`
- [X] T014 [P] [US1] Model tests in `tests/unit/state/caged-model.test.ts`: exactly three markers with `layer === 'triad'`, ids `triad:s:f`, function glyphs root/third/fifth; `ring` kept when the position is a connection; Name labels give C, E, G; `display.triad` has `sets`, `selected`, `summary` "C major, root position, strings 3-2-1, frets 5-5-3"; description contains "Triad: C, E, G — root position, strings 3-2-1, frets 5-5-3." with spoken accidentals; `triadChange 'selected'` is announced first; `appear` set for ids in `extras.reveal`; Triad row is last in layer order
- [X] T015 [P] [US1] Store tests in `tests/unit/state/caged-store.test.ts` (fake timers): `toggleLayer('triad')` on sets the default set and reveals the three triad ids low to high; `selectTriadSet` reveals and sets `triadChange 'selected'`; picking an unavailable or equal set is a no-op; toggling Arpeggio does not change triad positions; rapid toggling leaves no stale markers; reset turns Triad off and clears `triadSet`
- [X] T016 [P] [US1] Renderer tests in `tests/unit/fretboard/fretboard.test.ts`: marker with `layer: 'triad'` gets class `layer-triad`; the ring still renders when `ring` is set; a triad marker remounts with `appear` when its id changes from `s:f` to `triad:s:f`
- [X] T017 [P] [US1] Component tests in `tests/unit/caged/caged-tool.test.ts`: Triad switch is the last row, `role="switch"`, named "Triad"; selector appears only when Triad is on and a shape is focused; `MarkerSample layer="triad"` in the row; summary line shown
- [X] T018 [P] [US1] Write `e2e/caged-triad.spec.ts` US1 cases: A shape + Triad + 3-2-1 highlights exactly three `g.marker.layer-triad` at frets 5-5-3; Name labels C, E, G; another set moves the highlight and is announced; Arpeggio off keeps the triad; one marker per position; reveal low to high and instant under `prefers-reduced-motion: reduce`

### Implementation for User Story 1

- [X] T019 [US1] Update `src/lib/state/caged-layers.ts`: `isDrawable('triad') = on && hasFocus`, `needsAutoFocus` true for triad, `switchStates` and `layerCounts` include triad, `ResolveInput.triad: ShapeTriad | null`, `resolveCagedPositions` claims the three triad positions first with emphasis `highlighted`, degree R/3|b3/5 (R-04, data-model §3). Make T013 pass
- [X] T020 [US1] Update `src/lib/state/caged-model.ts`: add `CagedTriadDisplay` and `display.triad`, triad markers (`layer: 'triad'`, id `triad:s:f`, function glyph, label from `spellTriad(root, quality)` with real-pitch spelling, keep `ring`), `triadChange` in `CagedExtras`, triad summary and description sentence (inversion names from `triads_inversion_*` lower-cased, accidentals spoken via `spokenNote`), Triad row last in `LAYER_ORDER`, `switches.triad`. Compute availability via `triadAvailability` and use `triadRevealIds` for reveal. Make T014 pass
- [X] T021 [US1] Update `src/lib/state/caged.svelte.ts`: `toggleLayer('triad')` (auto-focus first drawn occurrence, default set from `defaultTriadSet`, reveal triad ids low to high, off → `triadSet = null`), `selectTriadSet(id)` (no-op if unavailable or equal; reveal; `triadChange 'selected'`), `reset()` clears Triad; no playback stop (R-15); pass `triad` into resolution. Make T015 pass
- [X] T022 [P] [US1] Update `src/lib/fretboard/Fretboard.svelte` to add class `layer-triad` using `--marker-triad-scale` and `--marker-triad-stroke`, composing with the connection ring; update `src/lib/fretboard/MarkerSample.svelte` to accept `layer: 'triad'`. Make T016 pass
- [X] T023 [US1] Create `src/lib/tools/caged/CagedTriadSets.svelte`: a `ChoiceGroup` radiogroup named `caged_triad_sets` with the Triads string-set options (same labels via `setLabel`, same order, bass to treble), selected set `aria-checked`, and the summary line from `display.triad`; render only when `display.triad !== null`. In this task unavailable options are plain `disabled` (the reachable and explained behavior is US2)
- [X] T024 [US1] Update `src/lib/tools/caged/CagedLayerList.svelte` (Triad row last with `MarkerSample layer="triad"`, switch wired to `toggleLayer('triad')`) and `src/lib/tools/caged/CagedTool.svelte` (mount `CagedTriadSets` under the layer list, wire `selectTriadSet`). Make T017 pass
- [X] T025 [US1] Run `pnpm vitest run tests/unit/state tests/unit/fretboard tests/unit/caged`, then `pnpm build:test` and `pnpm test:e2e:fast e2e/caged-triad.spec.ts` (US1 cases) until green

**Checkpoint**: US1 fully functional and testable alone (MVP).

---

## Phase 4: User Story 2 - Know which string sets have no triad (Priority: P1)

**Goal**: Unavailable sets are disabled but keyboard-reachable and explained; the selection moves with an announcement when its set becomes unavailable; the all-unavailable state is handled.

**Independent Test**: C major G shape: set 3-2-1 disabled with the EC-6.7 explanation, reachable by arrow keys, not selectable.

### Tests for User Story 2 ⚠️

- [X] T026 [P] [US2] Add `reachDisabled` and `describedby` cases to `tests/unit/triads/choice-group.test.ts`: with `reachDisabled`, arrows, Home and End move focus onto disabled options without choosing them; option `describedby` renders `aria-describedby`; default behavior (disabled skipped) unchanged and existing cases stay green
- [X] T027 [P] [US2] Add settle cases to `tests/unit/state/caged-store.test.ts`: focus change from A shape (set 3) to G shape moves to 6 and sets `triadChange {kind:'moved', set:6, from:3}` with no reveal; key, quality, spelling, instrument and tuning change keep or move per `settleTriadSet`; no set available keeps the stored set and `triadChange` unavailable; the moved announcement text is `caged_triad_moved`
- [X] T028 [P] [US2] Add model cases to `tests/unit/state/caged-model.test.ts`: `sets[i].available`, `ariaLabel` "Strings 5-4-3, unavailable", `unavailableNote` present only when any set is unavailable; all-unavailable gives `selected === null`, no triad markers and `handoff === null`
- [X] T029 [P] [US2] Add US2 cases to `e2e/caged-triad.spec.ts`: disabled set has `aria-disabled="true"` and `aria-describedby` to the visible note; keyboard arrows reach it and Space or Enter does not select it; focusing G shape moves 3-2-1 to 6-5-4 with the announcement; a shape with no available set shows every option disabled, no triad drawn and no Open in Triads

### Implementation for User Story 2

- [X] T030 [US2] Update `src/lib/tools/ChoiceGroup.svelte`: optional per-option `describedby` (→ `aria-describedby`) and optional `reachDisabled` (default false; arrows, Home and End move focus across disabled options and choose only enabled ones). Make T026 pass without changing Triads or CAGED shape-selector behavior
- [X] T031 [US2] Update `src/lib/tools/caged/CagedTriadSets.svelte`: pass `reachDisabled`, per-option `aria-label` (`caged_triad_set_unavailable`) and `describedby` pointing at one visible note `caged_triad_none` rendered when any set is unavailable; unavailable options greyed and struck or labelled (not color alone)
- [X] T032 [US2] Update `src/lib/state/caged.svelte.ts` and `src/lib/state/caged-model.ts`: add `settleTriad()` run after every `settleLayers()` call site and after `applyInstrument`, `viewInStandard`, `endTemporary`, `selectRoot`, `setQuality`, `switchSpelling`; a move sets `triadChange {kind:'moved', set, from}` without reveal; announce moved and unavailable text through the description. Make T027 and T028 pass
- [X] T033 [US2] Run targeted Vitest (`tests/unit/triads/choice-group.test.ts tests/unit/state tests/unit/caged`), `pnpm build:test`, then `pnpm test:e2e:fast e2e/caged-triad.spec.ts`

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Jump to the Triads tool (Priority: P1)

**Goal**: **Open in Triads** opens Triads on the exact drawn triad (root, quality, inversion, set, occurrence, Isolated view), keeping other Triads settings and CAGED state.

**Independent Test**: C major, A shape, set 3-2-1, activate Open in Triads: Triads on C major, root position, 3-2-1, Isolated; Back returns CAGED unchanged.

### Tests for User Story 3 ⚠️

- [X] T034 [P] [US3] Add `carryCagedTriad` table tests to `tests/unit/state/links.test.ts` (contract §7): C major A shape set 3 (root 0, major, root position, set 3, occurrence 0, isolated, `labelType` unchanged); C minor A shape set 3 starting from All notes view (minor, isolated); C major D shape set 3 (second inversion, occurrence 1); Compare on with fitting pair (`occurrence = pairs.indexOf(k)`, Compare stays on); Compare on with no fitting pair (Compare off, remembered quality kept, occurrence k, `compareOff = true`); F♯ vs G♭ spelling carried; equal state returns the same reference
- [X] T035 [P] [US3] Add to `tests/unit/state/triads-store.test.ts`: `triads.carryCagedTriad(h)` applies the carry and raises notice `compare-off-for-shape` only when `compareOff`
- [X] T036 [P] [US3] Add to `tests/unit/caged/caged-tool.test.ts`: "Open in Triads" button shown iff `display.triad.handoff !== null`, absent when no triad is drawn and in the temporary standard view; activation calls `openTriadsFromCagedTriad` once; min 44×44 px target class
- [X] T037 [P] [US3] Add US3 cases to `e2e/caged-triad.spec.ts` and a round trip to `e2e/linked-tools.spec.ts`: major, minor, higher occurrence (C major D shape 3-2-1 → Triads shows 12-13-12, Octave up) and Back returns to CAGED with Triad on, same set and same focus (FR-1.7)

### Implementation for User Story 3

- [X] T038 [US3] Implement pure `carryCagedTriad(t, h, instrument)` in `src/lib/state/links.ts` following R-11 steps 1–5 (`setView` isolated first, `setQuality` with Compare swap invariant, root, `spellingOverride`, inversion, string set, occurrence mapping by pair index or raw `k` or Compare off, `revalidate`; label type untouched; same reference when unchanged). Make T034 pass
- [X] T039 [US3] Add `carryCagedTriad(h)` to `src/lib/state/triads.svelte.ts` raising the new notice kind `compare-off-for-shape` when `compareOff`; render that kind with `triads_notice_compare_off_for_shape` in `src/lib/tools/triads/TriadsTool.svelte`. Make T035 pass
- [X] T040 [US3] Add `openTriadsFromCagedTriad()` to `src/lib/state/links.svelte.ts` (reads `caged.display.triad?.handoff`, calls `triads.carryCagedTriad(h)`, one `goto('/triads')`, CAGED state untouched); leave `openTriadsFromCaged()` unchanged. Ensure `triadHandoff` and the model return `handoff = null` in the temporary standard view
- [X] T041 [US3] Add the "Open in Triads" button (`caged_triad_open`, ≥ 44×44 px, visible focus) under the selector in `src/lib/tools/caged/CagedTriadSets.svelte`, rendered only when `display.triad.handoff !== null`. Make T036 pass
- [X] T042 [US3] Run targeted Vitest (`tests/unit/state/links.test.ts tests/unit/state/triads-store.test.ts tests/unit/caged`), `pnpm build:test`, then `pnpm test:e2e:fast e2e/caged-triad.spec.ts e2e/linked-tools.spec.ts`

**Checkpoint**: US1, US2, US3 independently functional.

---

## Phase 6: User Story 4 - Turn on Triad without a shape in focus (Priority: P2)

**Goal**: Triad follows the product-wide focus and base-layer rules.

**Independent Test**: With all shapes visible, turn on Triad: first drawn occurrence takes focus and the default set shows.

### Tests for User Story 4 ⚠️

- [X] T043 [P] [US4] Add toggle-sequence tests (SC-006) to `tests/unit/state/caged-layers.test.ts` and `tests/unit/state/caged-store.test.ts`: no focus → on auto-focuses the first drawn occurrence and sets the default set; focus cleared with another layer on keeps the switch on and draws no triad, refocus draws it; only Triad on and focus cleared → `ensureDrawable` restores Chord (`restoredChord = true`) and Triad stays on; only drawable layer → switch disabled `last-layer`; Triad on with focus cleared hides the selector (`display.triad === null`)
- [X] T044 [P] [US4] Add US4 cases to `e2e/caged-triad.spec.ts`: auto-focus on turn-on, focus cleared keeps switch on, See all with Chord off and only Triad on restores Chord with announcement and Triad stays on, last-layer switch is `aria-disabled` with the described reason

### Implementation for User Story 4

- [X] T045 [US4] Fix any gaps found by T043 in `src/lib/state/caged-layers.ts`, `src/lib/state/caged.svelte.ts` and `src/lib/state/caged-model.ts` (auto-focus announcement like Pentatonic and Scale, restore-Chord announcement, selector hidden without focus per R-06) and make T043 pass
- [X] T046 [US4] Run targeted Vitest (`tests/unit/state`), `pnpm build:test`, then `pnpm test:e2e:fast e2e/caged-triad.spec.ts`

**Checkpoint**: US1–US4 independently functional.

---

## Phase 7: User Story 5 - Right notes in any tuning (Priority: P2)

**Goal**: Correct names and positions in transposed, altered-string, 7-string and non-compatible tunings.

**Independent Test**: E major A shape in Half step down shows names from the real pitch with the same drawing as standard; Drop D string 6 and 7-string 7-6-5 behave per spec.

### Tests for User Story 5 ⚠️

- [X] T047 [P] [US5] Add tuning cases to `tests/unit/state/caged-model.test.ts`: Half step down E major names follow real pitch (SC-005: every key) and the frets match the standard drawing; Drop D set 6 availability; 7-string selector lists 7-6-5 first and default falls to the first available when 3-2-1 is unavailable; non-compatible tuning gives `switches.triad.disabled === 'no-shapes'`, `display.triad === null` and state kept
- [X] T048 [P] [US5] Add US5 cases to `e2e/caged-triad.spec.ts`: Half step down, Drop D D major E shape set 6-5-4, 7-string selector, non-compatible tuning (switch disabled beside the existing message and state kept on return)

### Implementation for User Story 5

- [X] T049 [US5] Fix any gaps found by T047 in `src/lib/state/caged-triad.ts`, `src/lib/state/caged-model.ts` and `src/lib/state/caged.svelte.ts` (open pitches from the real tuning, spelling from real pitch, seven-string set list, non-compatible handling per R-06) and make T047 pass; theory-level tuning anchors already live in T003
- [X] T050 [US5] Run targeted Vitest (`tests/unit/theory/caged-triad.test.ts tests/unit/state`), `pnpm build:test`, then `pnpm test:e2e:fast e2e/caged-triad.spec.ts`

**Checkpoint**: All user stories independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T051 [P] Add axe checks to `e2e/caged-triad.spec.ts` (`@axe-core/playwright`): CAGED with Triad on, a disabled set present and Open in Triads shown, zero violations; keyboard-only pass over switch, set entries and shortcut; 200% zoom wrap check
- [X] T052 [P] Add persistence checks to `e2e/caged-triad.spec.ts`: CAGED → Triads → CAGED keeps Triad on and the set; reload turns Triad off (Chord only); Reset tool turns it off; prefs record in `localStorage` byte-identical (no new key or field)
- [X] T053 [P] Add a no-raw-text check (or extend the existing i18n test) so every new user-facing string comes from the message catalog; confirm `src/lib/theory/caged-triad.ts` obeys the theory import-boundary lint
- [X] T056 Add TM-9 view #19 fixture (constitution IV) to `e2e/caged-tm9.spec.ts`: test `tm9 view 19 layers: E major, A shape in focus, Triad, 6 strings, half step down` sets a 6-string instrument in Half step down (AF-2), key E major, focuses the A shape, turns Triad on (default set) and takes a full-board screenshot like views 16–18. Run `pnpm build:test`, `pnpm test:e2e:fast e2e/caged-tm9.spec.ts`, then generate the baselines: `pnpm playwright test e2e/caged-tm9.spec.ts -g "tm9 view 19" --project=phone --project=phone-touch --project=desktop --update-snapshots`. Check the three triad markers, real-pitch names and the AF-2 drawing before committing the images
- [X] T054 Walk through `specs/018-triad-layer/quickstart.md` §4 (manual rows 1–16) against `pnpm dev` and fix any discrepancy
- [X] T055 Run all local gates once: `pnpm verify` (theory coverage ≥ 95%, overall ≥ 80%, bundle ≤ 120 KB gzip with estimate +1.2–1.8 KB over 96.7 KB, desktop e2e). Do not run `pnpm test:e2e` or `pnpm lhci` locally

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none; T001 and T002 in parallel
- **Foundational (Phase 2)**: after Setup; BLOCKS all stories. Order: T003/T004 → T005; T006 → T007; T008 → T009; T010; T011 → T012 (T012 needs T005 and T009)
- **US1 (Phase 3)**: after Phase 2. Order: tests T013–T018 → T019 → T020 → T021; T022 parallel with T019–T021; T023 → T024 → T025
- **US2 (Phase 4)**: after US1 (extends the selector, store and model)
- **US3 (Phase 5)**: after US1 (needs the selected triad and the selector); independent of US2 except that T041 edits the same component as T031, so do US2 first when sequential
- **US4 (Phase 6)**: after US1; mostly verifies rules from T019 and T021
- **US5 (Phase 7)**: after US1; theory support already in Phase 2
- **Polish (Phase 8)**: after the desired stories

### Same-file conflicts (do not mark [P] across these)

- `src/lib/state/caged-layers.ts`: T019, T045
- `src/lib/state/caged-model.ts`: T020, T032, T045, T049
- `src/lib/state/caged.svelte.ts`: T021, T032, T045, T049
- `src/lib/tools/caged/CagedTriadSets.svelte`: T023, T031, T041
- `e2e/caged-triad.spec.ts`: T018, T029, T037, T044, T048, T051, T052 (add test blocks sequentially)
- `e2e/caged-tm9.spec.ts`: T056 only (after US1 and US5, since view #19 needs the Triad layer in AF-2)

### Parallel Opportunities

- Phase 1: T001 ‖ T002
- Phase 2: T003 ‖ T004 ‖ T006 ‖ T008 ‖ T010
- US1 tests: T013 ‖ T014 ‖ T015 ‖ T016 ‖ T017 ‖ T018; T022 ‖ T019–T021
- US2 tests: T026 ‖ T027 ‖ T028 ‖ T029
- US3 tests: T034 ‖ T035 ‖ T036 ‖ T037
- Polish: T051 ‖ T052 ‖ T053 ‖ T056

### Parallel Example: User Story 1

```text
Task: "Resolution tests in tests/unit/state/caged-layers.test.ts"        (T013)
Task: "Model tests in tests/unit/state/caged-model.test.ts"              (T014)
Task: "Store tests in tests/unit/state/caged-store.test.ts"              (T015)
Task: "Renderer tests in tests/unit/fretboard/fretboard.test.ts"         (T016)
Task: "Component tests in tests/unit/caged/caged-tool.test.ts"           (T017)
Task: "US1 e2e in e2e/caged-triad.spec.ts"                               (T018)
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup, Phase 2 Foundational
2. Phase 3 US1 → STOP and validate (`pnpm vitest run …`, `pnpm test:e2e:fast e2e/caged-triad.spec.ts`)

### Incremental Delivery

1. Foundation → US1 (MVP) → US2 (explained disabled sets) → US3 (Open in Triads) → US4 (focus rules) → US5 (tunings) → Polish
2. Each story adds value without breaking the previous; commit after each task or logical group (Conventional Commits on `018-triad-layer`)

---

## Notes

- Out of scope: Listen (FR-6.17), share-link layer encoding, triads crossing the region, open-voiced triads, Triads → CAGED "View in CAGED" with Triad (slice 004-caged/006), changing the existing CAGED "Go to Triads" button
- Complexity Tracking defaults (Compare turned off with a notice, hidden in temporary standard view, kept set when none available, `en.json` only) are implemented as written in plan.md
- Triad state is never written to `localStorage` or the URL
