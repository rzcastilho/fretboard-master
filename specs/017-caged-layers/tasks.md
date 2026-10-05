# Tasks: CAGED Arpeggio, Pentatonic, and Scale Layers

**Input**: Design documents from `/specs/017-caged-layers/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/caged-layers-api.md, contracts/caged-layers-ui.md, quickstart.md

**Tests**: Included. Constitution IV (test-first) and plan.md require them. Write each test task first and see it fail before the implementation task that follows.

**Organization**: Grouped by user story. Phase order follows plan.md "Implementation Order". US2 (switches) comes before US1 because US1 needs a switch to turn Scale on. Both are P1.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 to US6, from spec.md
- Paths are relative to the repository root

## Verification (CLAUDE.md, constitution "Verification tiers")

- Unit, per task: `pnpm vitest run <touched test paths>`
- E2E, per checkpoint: `pnpm build:test` once (rebuild only after `src/` changes), then `pnpm test:e2e:fast <spec files>`
- Screenshots: `pnpm playwright test <spec> -g "<test name>" --project=phone --project=phone-touch --project=desktop --update-snapshots`
- End of slice, once: `pnpm verify`
- Do NOT run `pnpm test:e2e` or `pnpm lhci` locally.

---

## Phase 1: Setup

**Purpose**: Tokens, strings and fixtures that every story uses.

- [X] T001 [P] Add tokens `--marker-layer-scale: 0.8`, `--marker-layer-opacity: 0.8` (set to `1` under `@media (prefers-contrast: more)`) and `--marker-extra-dot: 0.25rem` in `src/lib/styles/tokens.css`
- [X] T002 [P] Add the new message keys to `messages/en.json` (en is the only catalog, R-15): `caged_layers_heading`, `caged_layer_chord`, `caged_layer_arpeggio`, `caged_layer_pentatonic`, `caged_layer_scale`, `caged_layer_last`, `caged_layer_no_shapes`, `caged_layer_now_on`, `caged_layer_now_off`, `caged_layers_on`, `caged_layers_in_region`, `caged_layers_on_neck`, `caged_layer_counts`, `caged_layer_waiting`, `caged_extra_mark`, `caged_group_labels`, `caged_label_intervals`, `caged_label_note_names`. English text per contracts/caged-layers-ui.md. Reuse the existing `caged_switch_on` and `caged_switch_off`.

---

## Phase 2: Foundational (blocks all stories)

**Purpose**: Pure theory, pure layer rules, view-state fields and renderer types.

**⚠️ CRITICAL**: No story starts before this phase is complete.

### Tests first

- [X] T003 [P] Write failing table tests in `tests/unit/theory/caged-layers.test.ts`, one per shape, as exact `(string, fret, degree)` sets: TM-6.4 (C major scale), TM-6.5 (C major pentatonic), TM-7.4 (C minor scale), TM-7.5 (C minor pentatonic). Also add these anchors: A minor Em-shape pentatonic (s6 5 8 · s5 5 7 · s4 5 7 · s3 5 7 · s2 5 8 · s1 5 8); C major C shape at fret 0 has no fret < 0 (TM-6.6); AF-21 D major C shape has string 7 frets equal to string 2 frets (TM-6.7); AF-4 Drop D, D major, E shape has region 9–12, scale s6 = 9(6) 11(7) 12(R), pentatonic s6 = 9 12. Also test `degreeOf`, `inLayer`, `isExtraMarked` (true for `4`,`7` major; `2`,`b6` minor) and `spellScale` (alternate letters).
- [X] T004 [P] Write failing property tests in `tests/unit/theory/caged-layers.property.test.ts` (fast-check) across generated compatible and altered tunings, 6 or 7 strings, 12/22/24 frets: every `LayerNote` pitch class matches `degreeOf`, notes lie in `0…fretCount` and inside the region, Arpeggio ⊂ Pentatonic ⊂ Scale, and `region.start ≤ start` and `end ≤ region.end`.
- [X] T005 [P] Write failing tests in `tests/unit/state/caged-layers.test.ts` for `isDrawable`, `switchStates`, `toggleLayer`, `needsAutoFocus`, `ensureDrawable`, `layerCounts`, `revealOrder`, and `resolveCagedPositions` (the behavior table in contracts/caged-layers-api.md §4, including the clarify-review overlap test C major E focus s5 f7). Add property tests for invariants I-1 to I-7 (data-model §4), including a random toggle and focus sequence ending in `ensureDrawable` with `drawableCount ≥ 1`.
- [X] T006 [P] Write failing tests in `tests/unit/notation/` (extend the existing `intervalLabel` test file) for `intervalLabel` with `b3`, `b6`, `b7`, `b5`, `#5`, `R` (catalog string).

### Implementation

- [X] T007 Extend `src/lib/theory/caged.ts`: add `region: { start: number; end: number }` to `ShapeOccurrence`, computed as `SCALE_REGIONS[quality][shape.id] + shift + octave`, **not clipped** (may be < 0 or > `fretCount`). Existing fields and order unchanged; existing TM-6.1, 6.2, 6.3, 7.1, 7.2 tests stay green. Run `tests/unit/theory/caged.test.ts`.
- [X] T008 Create `src/lib/theory/caged-layers.ts` (imports only `./pitch`, `./triad`, `./caged`): `CagedLayer`, `MelodicLayer`, `ScaleDegree`, `LAYER_PRIORITY`, `SCALE_REGIONS` (R-01 table), `LAYER_DEGREES` (major arp `R 3 5`, pent `R 2 3 5 6`, scale `R 2 3 4 5 6 7`; minor arp `R b3 5`, pent `R b3 4 5 b7`, scale `R 2 b3 4 5 b6 b7`), `LayerNote`, `degreeOf`, `inLayer`, `isExtraMarked`, `layerNotes` (pitch classes from the **real** open pitches, so altered string 6 and string 7 need no special case; clip to `max(0,region.start) ≤ fret ≤ min(fretCount,region.end)`; sort by pitch ascending, ties higher string number first), `spellScale`. Total functions, never throw. Makes T003 and T004 pass.
- [X] T009 [P] Extend `intervalLabel` in `src/lib/notation/notation.ts` to accept `IntervalId | ScaleDegree` (`R` → `m.interval_root()`, `b3`→`♭3`, `b6`→`♭6`, `b7`→`♭7`, `b5`→`♭5`, `#5`→`♯5`, else the id). Makes T006 pass.
- [X] T010 Extend `src/lib/state/caged-view.ts`: add `LayersOn`, `CagedLabelType`, `CAGED_LABEL_TYPES`, `layers` (initial `CHORD_ONLY`) and `labelType` (initial = preferred label, default `'interval'`) to `CagedViewState`; add `setLayers` (same reference when equal), `setLabelType` (no-op for unknown or equal), `equalsLayers`; `initialCagedView(label)`, `resetCaged(preferredLabel)` (layers → `CHORD_ONLY`, labelType → preferredLabel); `equalsCagedView` compares both new fields. Layers are never serialized. Extend `tests/unit/state/caged-view.test.ts` for these transitions.
- [X] T011 Create `src/lib/state/caged-layers.ts` (pure; imports only `../theory/*` and `./caged-view` types): `CHORD_ONLY` (frozen), `SwitchState`, `isDrawable`, `drawableCount`, `switchStates` (`'no-shapes'` when no occurrences; `'last-layer'` when the layer is on, drawable and `drawableCount = 1`; turning on is never blocked), `toggleLayer` (same reference when disabled), `needsAutoFocus`, `ensureDrawable` (`chord = true` when `drawableCount = 0`, other flags kept), `ResolvedPosition`, `resolveCagedPositions` (one entry per `string:fret`; priority chord > arpeggio > pentatonic > scale; focused region first and `highlighted` (FR-018); no Pentatonic or Scale without focus; no Chord layer when off; no chord marker on string 7; string 6 in an altered tuning is chord only for G and E shapes but layer notes for every shape (FR-017); `extra` only when pentatonic and scale are both on and the layer is pentatonic or scale), `layerCounts`, `revealOrder`. Makes T005 pass.
- [X] T012 [P] Extend `src/lib/fretboard/types.ts`: `Marker` gains optional `layer?: 'arpeggio'`, `extra?: boolean`, `appear?: number` (0 ≤ appear < 1); widen `interval` to `IntervalId | ScaleDegree`. Types only. Other tools never set these fields.

**Checkpoint**: Run `pnpm vitest run tests/unit/theory tests/unit/state/caged-layers.test.ts tests/unit/state/caged-view.test.ts tests/unit/notation`. All green. Then user stories can begin.

---

## Phase 3: User Story 2 - Layer switches double as the legend (Priority: P1) 🎯 MVP

**Goal**: Zone D lists Chord, Arpeggio, Pentatonic, Scale with switches and sample markers, with the base-layer rule, persistence behavior and Reset.

**Independent Test**: Open CAGED, check the four rows, toggle each, check the base-layer rule, navigation, reload and Reset (US2-1 to US2-7).

### Tests first

- [X] T013 [P] [US2] Write failing store tests in `tests/unit/state/caged-store.test.ts`: `toggleLayer` obeys the disabled rules; layers survive other-tool navigation; `reset()` returns layers to Chord only and keeps the preferred label; `ensureDrawable` runs after every focus-clear entry point (`chooseShape('all')`, `toggleTag` off, `applyInstrument`, `viewInStandard`, `endTemporary`, `selectRoot`/`setQuality` when focus re-resolves to null) and sets `layerChange = { chord, on: true }` on restore (Chord off, Scale on, focus E, See all → Chord on, Scale still on); `toggleLayer` does not stop playback (R-16); no layer data reaches storage.
- [X] T014 [P] [US2] Write failing model tests in `tests/unit/state/caged-model.test.ts`: `switches` from `switchStates`; in a non-compatible tuning every switch is `'no-shapes'` and layer state is kept; `extraSampleShown` is true only when pentatonic and scale are both on.
- [X] T015 [P] [US2] Write a failing component test in `tests/unit/caged/caged-tool.test.ts` for `CagedLayerList`: four rows in order, `role="switch"` with `aria-checked`, initial Chord on and `aria-disabled` with `aria-describedby` reason `caged_layer_last`, `no-shapes` reason, disabled switch stays focusable and does nothing on activate, sample `.shape` computed `transform` and `opacity` equal to a board marker of the same layer (US2-3). Add a Fretboard/`MarkerSample` test in `tests/unit/fretboard/fretboard.test.ts`.
- [X] T016 [P] [US2] Write the e2e spec `e2e/caged-layers.spec.ts` for US2-1 to US2-7: initial state, enable/disable rules, sample markers present, navigate away and back keeps layers, reload resets to Chord only (and keeps Name label), `localStorage` holds no layer data, Reset tool, base-layer restore on See all with a polite "Chord layer on." announcement.

### Implementation

- [X] T017 [US2] Extend `src/lib/state/caged-model.ts`: `buildCagedModel(view, instrument, context, transition?, extras?)` with `CagedExtras { reveal, layerChange }`; `CagedDisplay` gains `switches`, `extraSampleShown`, `positions`. Non-compatible tuning forces every switch `'no-shapes'`. Makes T014 pass.
- [X] T018 [US2] Extend `src/lib/state/caged.svelte.ts`: `toggleLayer(layer)`, `get switches`, transients `reveal` and `layerChange` (cleared by the next view or layer change and by reset), `export const REVEAL_WINDOW_MS = 300` (a test asserts it equals `--duration-short`), and call `ensureDrawable` after every focus-clear entry point (list in T013). Pass `{reveal, layerChange}` to `buildCagedModel`. Do not route through `apply()` (R-16). Makes T013 pass.
- [X] T019 [P] [US2] Create `src/lib/fretboard/MarkerSample.svelte`: props `{ fn: NoteFunction; layer?: 'arpeggio'; extra?: boolean }`; `aria-hidden` `svg.marker-sample`, 44×44, same `.glyph` geometry and token-driven classes (`layer-arpeggio`, `extra-dot`) as the board (R-09). Do not refactor `Fretboard.svelte` markup.
- [X] T020 [US2] Create `src/lib/tools/caged/CagedLayerList.svelte`: `<fieldset>` with `<legend>` `caged_layers_heading`; four `<button type="button" role="switch">` rows (Chord, Arpeggio, Pentatonic, Scale) each with `MarkerSample`, visible name, aria-hidden state text; Scale row shows a second extra-dot sample only when `extraSampleShown`; disabled rows use `aria-disabled="true"` plus a visually hidden reason (`caged_layer_last` or `caged_layer_no_shapes`), stay in tab order; min size `--target-min` (44×44), `:focus-visible` outline; wraps at 320 px and 200% zoom, no truncation.
- [X] T021 [US2] Wire the list into zone D of `src/lib/tools/caged/CagedTool.svelte` above the existing Show connections switch and Reset tool button. Makes T015 pass.
- [X] T022 [US2] Polite announcements: when `layerChange` is set, add the `caged_layer_now_on`/`caged_layer_now_off` change sentence first in the description in `src/lib/state/caged-model.ts` (restore case reads "Chord layer on."). Extend `tests/unit/fretboard/description.test.ts`.

**Checkpoint**: `pnpm vitest run tests/unit/state tests/unit/caged tests/unit/fretboard`, then `pnpm build:test` and `pnpm test:e2e:fast e2e/caged-layers.spec.ts e2e/caged.spec.ts e2e/caged-focus.spec.ts`. Then **measure the bundle**: `pnpm build && node scripts/check-bundle-size.mjs` (plan R-13). Record the result in the PR.

---

## Phase 4: User Story 1 - See the scale inside the shape (Priority: P1)

**Goal**: Scale draws inside the focused region with degree or name labels, string 7, altered string 6 and low-to-high reveal; the CAGED label control exists.

**Independent Test**: C major, focus E, Scale on, Interval label; compare with TM-6.4 (US1-1 to US1-6).

### Tests first

- [X] T023 [P] [US1] Write failing prefs tests: `tests/unit/prefs/schema.test.ts` (`labels.caged` parse with `v.fallback(v.picklist(['interval','name']), 'interval')`; missing or invalid → `'interval'` without affecting other fields; serialize writes it **only when `'name'`**; existing fixtures byte-identical), new fixture `tests/unit/prefs/fixtures/labels-caged-name.txt` registered in `tests/unit/prefs/fixtures/index.ts` (fixtures are only added, never edited), and `tests/unit/state/preferences-store.test.ts` (`restore` calls `caged.restoreLabelType`; `erase` restores default; `setLabelType` calls `session.remember`).
- [X] T024 [P] [US1] Write failing model and renderer tests: `tests/unit/state/caged-model.test.ts` (markers per the data-model §6 mapping: `degree` function for pentatonic/scale, `interval = degree`, `spelling = spellScale(root)[degree]`, `labelMode` `'interval'` vs `'note'` from `labelType`, `appear = i/n` only for ids in `reveal.ids`, `ring` only on positions with a marker, Drop D D major E shape string 6 = 9, 11, 12 with 12 as Chord, 7-string string 7 has no chord markers) and `tests/unit/fretboard/fretboard.test.ts` (`appear` intro delay `appear × (short − fast)`, 0 under reduced motion; only on mount).
- [X] T025 [P] [US1] Add US1-1 to US1-6 cases to `e2e/caged-layers.spec.ts` (TM-6.4 frets and degree labels; Name labels; 7 strings string 7 equals string 2 and no chord marker; 12-fret omission with no notice; open-position C shape has nothing below the nut; reduced-motion shows all notes in one frame via `page.emulateMedia`). Add the Interval/Name label control and persistence after reload.

### Implementation

- [X] T026 [US1] Extend `src/lib/prefs/schema.ts` with `labels.caged: CagedLabelType` (default `'interval'`; `DEFAULT_PREFERENCES.labels.caged`), parse and serialize rules from T023, version stays `1`. Update `src/lib/state/preferences.svelte.ts` (`restore`, `erase`).
- [X] T027 [US1] Extend `src/lib/state/caged.svelte.ts`: `setLabelType(t)` (remembers `labels.caged`), `restoreLabelType(t)` (no remember). Set `reveal` in `toggleLayer` when a layer turns on: newly drawn keys via `revealOrder`, computed after any auto-focus. Reveal clears after `REVEAL_WINDOW_MS` and on any next change. Other redraws never stagger (FR-013). Drive with fake timers in `tests/unit/state/caged-store.test.ts`.
- [X] T028 [US1] In `src/lib/state/caged-model.ts` map `ResolvedPosition` to `Marker` (data-model §6) using `resolveCagedPositions` with real open pitches, and set `model.labelMode` from `view.labelType`. Remove the hard-coded `labelMode: 'interval'`. Makes T024 model tests pass.
- [X] T029 [US1] Update `src/lib/fretboard/Fretboard.svelte`: `appear` intro (`in:` with delay `appear × (tokenDuration('--duration-short') − tokenDuration('--duration-fast'))`, duration `fast`, 0 delay under reduced motion). Removing markers has no stagger. Verify existing Notes and Triads screenshots are unaffected.
- [X] T030 [US1] Add the zone-E label `ChoiceGroup` (`caged_group_labels`; `caged_label_intervals` default, `caged_label_note_names`) before Previous/Next shape in `src/lib/tools/caged/CagedTool.svelte`, following the Triads pattern. Applies to chord and layer markers.
- [X] T031 [US1] Add the TM-9 view 20 case (D major, C shape in focus, Scale with Chord, AF-21, 7 strings) to `e2e/caged-tm9.spec.ts`, file `tm9-caged-20-d-c-scale-7.png`. Generate with `pnpm playwright test e2e/caged-tm9.spec.ts -g "layers" --project=phone --project=phone-touch --project=desktop --update-snapshots`.

**Checkpoint**: `pnpm vitest run tests/unit/prefs tests/unit/state tests/unit/fretboard`, then `pnpm build:test` and `pnpm test:e2e:fast e2e/caged-layers.spec.ts`. US1 and US2 work together.

---

## Phase 5: User Story 3 - Arpeggio around the chord (Priority: P1)

**Goal**: Arpeggio shows all triad notes in the region, with and without focus, with the Chord-off path.

**Independent Test**: C major, all shapes, Arpeggio on; check R, 3, 5 not in chord (US3-1 to US3-4).

### Tests first

- [X] T032 [P] [US3] Add failing tests to `tests/unit/state/caged-layers.test.ts` and `tests/unit/state/caged-model.test.ts`: no-focus arpeggio across the whole neck resolved per position across occurrences (chord wins, else arpeggio `normal`); A minor gives R, ♭3, 5 only; with focus arpeggio only in the focused region; Chord off → chord positions drawn as arpeggio and no dimmed chord markers anywhere; markers carry `layer: 'arpeggio'` and chord/arpeggio markers keep root/third/fifth functions.
- [X] T033 [P] [US3] Add US3-1 to US3-4 and quickstart rows 2 and 3 to `e2e/caged-layers.spec.ts` (marker classes `.marker.root|third|fifth.layer-arpeggio`, at most one `.marker` per `data-key`).

### Implementation

- [X] T034 [US3] Update `src/lib/fretboard/Fretboard.svelte` and `src/lib/styles/tokens.css` usage: class `layer-arpeggio` on the marker group when `layer === 'arpeggio'`; `.shape` gets `transform: scale(var(--marker-layer-scale))` and `opacity: var(--marker-layer-opacity)`. Differences are by shape, size and opacity, never color alone.
- [X] T035 [US3] Verify the no-focus and Chord-off paths of `resolveCagedPositions` in `src/lib/state/caged-layers.ts` and the marker mapping in `src/lib/state/caged-model.ts` (fix gaps found by T032). Connection rings are drawn only on positions that have a marker.

**Checkpoint**: `pnpm vitest run tests/unit/state tests/unit/fretboard`, then `pnpm test:e2e:fast e2e/caged-layers.spec.ts`.

---

## Phase 6: User Story 4 - Pentatonic box around the chord (Priority: P2)

**Goal**: Pentatonic draws the box, auto-focuses the first drawn occurrence when there is no focus, and is not drawn without focus.

**Independent Test**: A minor, Em shape in focus, Pentatonic on, frets 5 to 8 (US4-1 to US4-4).

### Tests first

- [X] T036 [P] [US4] Add failing tests in `tests/unit/state/caged-store.test.ts`: turning on Pentatonic or Scale with no focus focuses the first drawn occurrence (nearest the nut, as a tag activation: band, dimming, centring, announced focus change) and then turns the layer on; reveal is computed after the focus move; never targets an undrawn occurrence; clearing focus keeps the switch on and draws nothing for it.
- [X] T037 [P] [US4] Add US4-1 to US4-4 and quickstart rows 7, 9, 10 to `e2e/caged-layers.spec.ts`, including that keyboard focus stays on the switch when auto-focus happens (contracts UI "Keyboard and touch").

### Implementation

- [X] T038 [US4] In `src/lib/state/caged.svelte.ts` `toggleLayer`: when `needsAutoFocus` is true, `commitFocus(focusOfIndex(0))` before toggling (data-model §9), reusing the slice-016 focus logic. Makes T036 pass.
- [X] T039 [US4] Add the TM-9 view 16 case (A minor, Em shape in focus, Chord + Pentatonic, AF-1, 6 strings) to `e2e/caged-tm9.spec.ts`, file `tm9-caged-16-am-em-pentatonic.png`. Generate with the filtered `--update-snapshots` command from Verification.

**Checkpoint**: `pnpm vitest run tests/unit/state`, then `pnpm test:e2e:fast e2e/caged-layers.spec.ts`.

---

## Phase 7: User Story 5 - See the notes that are only scale (Priority: P2)

**Goal**: With Pentatonic and Scale both on, scale-only notes carry an extra dot.

**Independent Test**: C major, focused shape containing F and B, both layers on (US5-1 to US5-4).

### Tests first

- [X] T040 [P] [US5] Add failing tests: `tests/unit/state/caged-layers.test.ts` (`extra` true only for `4`/`7` major or `2`/`b6` minor when drawn as scale and both layers on; never for chord or arpeggio; C major E focus: F at s5 f8 and s3 f10, B at s6 f7, s4 f9, s1 f7), `tests/unit/fretboard/fretboard.test.ts` (`circle.extra-dot` inside `.marker.degree` when `extra`), and `tests/unit/state/caged-model.test.ts` (extra-mark description sentence).
- [X] T041 [P] [US5] Add US5-1 to US5-4 and quickstart row 6 to `e2e/caged-layers.spec.ts` (including the Scale-row extra sample visible only while both layers are on).

### Implementation

- [X] T042 [US5] Render `circle.extra-dot` (radius `--marker-extra-dot`) in `src/lib/fretboard/Fretboard.svelte` and `src/lib/fretboard/MarkerSample.svelte` when `extra`; map `extra` in `src/lib/state/caged-model.ts`.
- [X] T043 [US5] Add the `caged_extra_mark` sentence ("Extra mark: {notes}.", spoken names via `spokenNote`) to the description in `src/lib/state/caged-model.ts`, shown only when the extra mark is shown.

**Checkpoint**: `pnpm vitest run tests/unit/state tests/unit/fretboard`, then `pnpm test:e2e:fast e2e/caged-layers.spec.ts`.

---

## Phase 8: User Story 6 - Readable with everything on (Priority: P2)

**Goal**: Hierarchy is clear with every layer on; the description reports layers and counts; performance holds.

**Independent Test**: All layers on, shape in focus; check styles, one marker per position, description (US6-1 to US6-3).

### Tests first

- [X] T044 [P] [US6] Add failing description tests in `tests/unit/fretboard/description.test.ts` and `tests/unit/state/caged-model.test.ts`: order is change sentence · focus · tuning · altered · summary · layers sentence (`caged_layers_on`, `Intl.ListFormat`) · counts (`caged_layers_in_region` with focus or `caged_layers_on_neck` without; count = markers drawn per layer after priority, chord root counted once) · not-drawable (`caged_layer_waiting`) · extra-mark · entries · connections.
- [X] T045 [P] [US6] Add US6-1 to US6-3 to `e2e/caged-layers.spec.ts` (chord strongest, arpeggio medium, outlined degree markers, distinguishable without color; single marker per position; description text) and a CAGED 7 strings × 24 frets × all layers case to `e2e/perf.spec.ts`.

### Implementation

- [X] T046 [US6] Implement the layers, counts and not-drawable sentences in `src/lib/state/caged-model.ts` using `layerCounts`, and add all strings through the message catalog (no literals). Makes T044 pass.
- [X] T047 [US6] Add the TM-9 view 17 case (G major, E shape in focus, Chord + Arpeggio + Scale, AF-1) to `e2e/caged-tm9.spec.ts`, file `tm9-caged-17-g-e-arp-scale.png`. Generate with the filtered `--update-snapshots` command.

**Checkpoint**: `pnpm vitest run tests/unit`, then `pnpm test:e2e:fast e2e/caged-layers.spec.ts e2e/perf.spec.ts`.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T048 [P] Add axe checks (`@axe-core/playwright`, zero violations), keyboard-only operation of all four switches and 44×44 target checks to `e2e/caged-layers.spec.ts` (SC-006); check wrapping at 320 px and 200% zoom.
- [X] T049 [P] Add an addendum to `docs/adr/0017-caged-occurrences-from-real-tuning.md`: scale region on occurrences and real-pitch layer notes (plan Structure).
- [X] T050 [P] Confirm the Principle I theory import boundary (`src/lib/theory/caged-layers.ts` imports only `./pitch`, `./triad`, `./caged`) with the existing lint rule: `pnpm lint`.
- [X] T051 Run the quickstart.md §3 walkthrough rows 1–20 (manual or via the e2e spec); fix gaps.
- [X] T052 Run all local gates once: `pnpm verify`. Expect coverage ≥ 95% on `src/lib/theory` and ≥ 80% overall, bundle ≤ 94 KB gzip, zero axe violations. If the bundle is over, follow plan Complexity Tracking row 1 (amendment 1.7.0 → 1.8.0: 94 → 96 KB, Sync Impact Report, updated `scripts/check-bundle-size.mjs`, ADR 0002 cap history) and do not pass silently. _Result: check, lint, format, unit (105 files, 2929 tests; coverage 96.94% overall, 98.25% on `src/lib/theory`) pass. Bundle 96.7 KB gzip (92.8 → 96.7, +3.9 KB), over both 94 KB and the planned 96 KB contingency; the maintainer chose amendment 1.7.0 → 1.8.0 with a 120 KB cap (constitution Sync Impact Report, `scripts/check-bundle-size.mjs`, ADR 0002 cap history). Desktop e2e: 3 stale TM-9 baselines (views 15, 15 left-handed, 18 predate the layer list) re-recorded on phone, phone-touch and desktop. Remaining local failures (perf latency at 4× throttle, triads US5-3 `"0s, 0s"`, CAGED nine-tags perf) also fail on the slice base `6105e0d` on this machine, so they are pre-existing and environment-related; playback US4-4 was flaky and passed on rerun._

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)**: none. T001 and T002 in parallel.
- **Foundational (2)**: after Setup. Tests T003 to T006 first (parallel), then T007 → T008, T009, T010, T011 (needs T008, T010), T012. Blocks all stories.
- **US2 (3)**: after Phase 2. MVP.
- **US1 (4)**: after US2 (needs a switch to turn Scale on and the store reveal hooks).
- **US3 (5)**: after US1 (shares marker mapping in `caged-model.ts`).
- **US4 (6)**: after US1 and US2 (`toggleLayer` auto-focus).
- **US5 (7)**: after US1.
- **US6 (8)**: after US3 and US5 (counts and extra sentence).
- **Polish (9)**: after all stories.

### Within a story

Failing tests → pure logic → store/model → renderer/component → e2e/snapshot.

### Same-file conflicts (do not mark [P])

`src/lib/state/caged-model.ts` (T017, T022, T028, T035, T042, T043, T046), `src/lib/state/caged.svelte.ts` (T018, T027, T038), `src/lib/fretboard/Fretboard.svelte` (T029, T034, T042), `src/lib/tools/caged/CagedTool.svelte` (T021, T030), `e2e/caged-layers.spec.ts` (T016, T025, T033, T037, T041, T045, T048), `e2e/caged-tm9.spec.ts` (T031, T039, T047). Run the tasks that touch the same file in order.

## Parallel Examples

```text
# Phase 2 tests together:
T003 tests/unit/theory/caged-layers.test.ts
T004 tests/unit/theory/caged-layers.property.test.ts
T005 tests/unit/state/caged-layers.test.ts
T006 tests/unit/notation/ (intervalLabel)

# US2 tests together:
T013 tests/unit/state/caged-store.test.ts
T014 tests/unit/state/caged-model.test.ts
T015 tests/unit/caged/caged-tool.test.ts
T016 e2e/caged-layers.spec.ts

# Polish together:
T048 e2e/caged-layers.spec.ts   T049 docs/adr/0017-…md   T050 pnpm lint
```

## Implementation Strategy

### MVP first

1. Phase 1 and Phase 2.
2. Phase 3 (US2) and Phase 4 (US1): switches plus Scale in a focused shape. **Stop and validate** with the US1 and US2 e2e tests and the bundle measurement.
3. Add US3 (arpeggio), which completes all P1 stories.

### Incremental delivery

US4 (pentatonic and auto-focus) → US5 (extra mark) → US6 (readability, description, perf) → Polish. Each story is independently testable and does not break the earlier ones. Commit after each task or logical group (Conventional Commits).

## Notes

- Layers on are never stored or put in a URL. Only `labels.caged` is stored, and only when `'name'`.
- Tests assert the observable rule, not pixel styling, except TM-9 snapshots.
- Triad layer, Listen on layers (FR-6.17), share-link encoding and other scales are out of scope.
