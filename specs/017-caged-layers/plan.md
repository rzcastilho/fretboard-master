# Implementation Plan: CAGED Arpeggio, Pentatonic, and Scale Layers

**Branch**: `feature/017-caged-layers` | **Date**: 2026-10-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-caged-layers/spec.md`

## Summary

CAGED gains three melodic layers, **Arpeggio**, **Pentatonic** and **Scale**, next to the
existing **Chord** layer (FR-6.8 to FR-6.10, FR-6.12, FR-6.13, FR-3.7). Each layer is switched
from a zone-D list that doubles as the legend. A player can focus a shape and see the
arpeggio, pentatonic box or full scale inside its region, with the chord still standing out.

Technical approach ([research.md](./research.md)):

- **Theory** (R-01 to R-05): a new pure `src/lib/theory/caged-layers.ts`. The key finding is
  that every TM-6.4 and TM-7.4 scale pattern is exactly **every scale note on every string
  inside one fret window**. This was checked string by string for all 10 shapes. A DM-12
  layer template therefore reduces to one `[lo, hi]` pair per shape and quality.
  - `cagedOccurrences` gains an unclipped `region`.
  - `layerNotes` takes pitch classes from the **real** tuning. That one rule also covers the
    altered string 6 (FR-017) and string 7 (FR-007) with no special case.
  - Degrees map from semitone offsets, and Arpeggio ⊂ Pentatonic ⊂ Scale are degree filters.
  - `spellScale` spells by alternate letters.
  - Table tests reproduce TM-6.4, TM-6.5, TM-7.4 and TM-7.5. Property tests run across
    generated tunings.
- **Layer rules** (R-06, R-07): a new pure `src/lib/state/caged-layers.ts` holds:
  - the drawable-layer (base-layer) rule and switch availability;
  - toggling, auto-focus detection and the automatic Chord restore;
  - `resolveCagedPositions`, which gives one marker per position. Priority is
    chord > arpeggio > pentatonic > scale. The focused region takes precedence, and the extra
    mark is decided here.
- **State** (R-06, R-11): `CagedViewState` gains `layers` (never stored) and `labelType`.
  `labelType` is stored as `labels.caged` and written only when it is `name`, so existing
  prefs fixtures stay byte-identical. The store adds `toggleLayer`, `setLabelType` and
  transient `reveal` and `layerChange`. It calls `ensureDrawable` after every focus clear.
- **Display and renderer** (R-08 to R-10, R-12):
  - Markers gain the optional fields `layer: 'arpeggio'` (scaled and lighter through tokens),
    `extra` (an inner dot) and `appear` (a low-to-high intro fraction).
  - Pentatonic and Scale notes use the existing outlined `degree` glyph.
  - A new `MarkerSample.svelte` draws legend samples with the same tokens.
  - The description gains a change sentence, the layers on, per-layer counts and the
    extra-marked notes, all through the existing polite live region.
- **UI**: the zone-D layers list (`role="switch"` rows) and a zone-E label `ChoiceGroup`
  (Intervals or Note names), following the Triads pattern.

Assumptions and defaults beyond the spec (each detailed in research.md):

- **String 7** (R-05): layer notes come from string 7's real pitch. In AF-21 and AF-22 this
  equals string 2's frets, as TM-6.7 and FR-007 require. *Rejected*: copying string 2's frets
  literally, which would draw notes outside the scale in AF-23 (low A) and break Principle I.
- **Translations** (R-15): strings go into `messages/en.json`, which is today the only
  catalog, following the slice 016 precedent. *Rejected*: creating pt and es catalogs in this
  slice.
- **Playback** (R-16): layer, label, auto-focus and Chord-restore changes do not stop a
  sounding note. *Rejected*: routing them through `apply()`, which would interrupt playback on
  purely visual changes.
- **Legend glyph** (R-09): a standalone `MarkerSample` component shares tokens with the board.
  *Rejected*: refactoring the Fretboard marker markup into a shared component now, which puts
  keyed-each and transition behavior at risk with only two users.
- **Bundle** (R-13): the estimate is +1.6–2.4 KB against about 1.2 KB of headroom. A breach
  is handled by a pre-recorded amendment route (Complexity Tracking), never silently.

## Technical Context

**Language/Version**: TypeScript 5 (`strict: true`). Node and pnpm are pinned through mise
(`mise.toml`).

**Primary Dependencies**: Svelte 5 (runes), SvelteKit `adapter-static`, Paraglide JS and
Valibot, all existing. **No new dependency.**

**Storage**:

- The v1 `localStorage` prefs record gains the optional `labels.caged`, written only when it
  is `"name"`. The version is unchanged.
- The layers on are in-memory CAGED view state only: never stored and never in the URL.

**Testing**:

- **Vitest + fast-check**:
  - theory tables (TM-6.4, TM-6.5, TM-7.4, TM-7.5, TM-6.6, TM-6.7, the Drop D anchor) and
    properties;
  - the pure layer rules and resolution;
  - the view, model and store (fake timers for `REVEAL_WINDOW_MS`);
  - the prefs schema;
  - the renderer classes and intro;
  - the CAGED tool component.
- **Playwright + @axe-core/playwright**:
  - a new `e2e/caged-layers.spec.ts` covering US1–US6, keyboard, reduced motion, storage,
    reload and navigation, and axe;
  - TM-9 views 16, 17 and 20 in `e2e/caged-tm9.spec.ts`;
  - a CAGED all-layers case in `e2e/perf.spec.ts`.

**Target Platform**: evergreen browsers (the last two majors), desktop and mobile, served
statically from Cloudflare Pages.

**Project Type**: a static single-page web application (SvelteKit, prerendered, a single
bundle per ADR 0002).

**Performance Goals**:

- A layer toggle updates the fretboard in ≤ 100 ms.
- The low-to-high reveal completes in ≤ 300 ms (`--duration-short`), and is instant under
  reduced motion.
- Scrolling stays smooth with 7 strings, 24 frets and every layer on (Principle VI).

**Constraints**:

- **Bundle**: initial JS ≤ 94 KB gzip. It is 92.8 KB after slice 016, so the headroom is about
  1.2 KB (R-13).
- **Visual states**: only the four emphasis levels. Layer treatment is a token-driven marker
  style.
- **Accessibility**: 44×44 px targets and zero axe violations.
- **Pure core**: no presentation concepts in `src/lib/theory`.

**Scale/Scope**:

- **Instruments**: one tool (CAGED). 12 keys × 2 qualities × 4 layer flags × focus or no
  focus. 12–24 frets, 6 or 7 strings, compatible and altered-string tunings.
- **Worst case**: at most 9 occurrences × about 7 × 7 region cells, so resolution is trivial.
- **Files**: about 18 new message keys and 3 new source modules (`theory/caged-layers.ts`,
  `state/caged-layers.ts`, `fretboard/MarkerSample.svelte`), plus 1 new tool component
  (`CagedLayerList.svelte`). About 12 existing files are edited.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution v1.7.0. The pre-research and post-design results are identical. The design
introduces no violation. The one contingent item, the bundle budget, is pre-recorded in
Complexity Tracking.

- [x] **I. Musical Correctness**:
  - Layer notes are calculated from the configured key, quality, real tuning, string count and
    fret count (pitch class of `open + fret` inside the region). Only the region window is
    reference data, anchored like the chord shapes.
  - Spelling uses alternate letters (`spellScale`).
  - The new table tests reproduce TM-6.4, TM-6.5, TM-7.4 and TM-7.5 exactly. Property tests
    run across generated compatible and altered tunings.
  - Both join the CAGED gate (R-01, R-03, R-17).
- [x] **II. On-Device, Static, Private**:
  - All computation runs in the browser.
  - The only stored datum is one optional label value in the existing erasable prefs record.
  - There is no network, permission or identifier.
- [x] **III. Pure Core, Thin Shell**:
  - `theory/caged-layers.ts` imports only `./pitch`, `./triad` and `./caged`.
  - Layer rules and resolution are pure (`state/caged-layers.ts`).
  - Data flows switch → view state → display model → renderer.
  - `layers` lives in the module store, outside components.
  - Mirroring and orientation stay in the renderer. "Low to high" is pitch order, computed
    before layout.
- [x] **IV. Test-First / Tested Behavior**:
  - The theory, layer-rule and prefs modules are built test-first.
  - Every acceptance scenario of US1–US6 maps to Vitest or Playwright (quickstart §3, research
    R-17).
  - The reveal timer is driven by fake timers or `page.clock`.
  - TM-9 views 16, 17 and 20 are added as screenshot fixtures.
- [x] **V. Accessible by Default**:
  - The switches are `role="switch"`, keyboard-operable, with visible focus and 44 px targets.
  - Disabled switches use `aria-disabled` plus a described reason and stay in the tab order.
  - The hierarchy uses shape, size and opacity, and the extra mark is a dot, so nothing
    relies on color alone.
  - Changes, counts and extra-marked notes are announced through the existing polite
    description. Accidentals are spoken in full.
  - Reduced motion makes the reveal instant, and contrast mode removes the layer opacity.
  - axe is gated in e2e.
- [x] **VI. Performance Budgets**:
  - No dependency is added, and the computation is O(occurrences × region).
  - A perf e2e case covers 7 strings, 24 frets and all layers.
  - The bundle is measured after US2 and at the end of the slice. A breach goes to an
    amendment, never a silent pass (R-13, Complexity Tracking).
- [x] **VII. Design System Fidelity**:
  - Chord markers keep the fixed note-function code. Pentatonic and Scale use the
    constitution's "scale degree = small outlined circle". Arpeggio uses the function glyphs
    scaled and lighter.
  - No new emphasis level is added, and no reserved color is reused.
  - New sizes and opacities are tokens (`--marker-layer-scale`, `--marker-layer-opacity`,
    `--marker-extra-dot`).
  - The controls sit in zones D and E and never cover the board.
  - The tool still opens in its simplest state (Chord only).
  - Motion stays within `--duration-short`.
- [x] **VIII. International**:
  - Every new string is a catalog key.
  - Note names come only from `src/lib/notation` (`noteLabel`, `spokenNote`, and an extended
    `intervalLabel` for ♭6 and ♭7).
  - Accidentals are glyphs.
  - Rows wrap for pt and es lengths and 200% zoom.
  - `R` stays a catalog string, so T can follow in pt and es.
- [x] **IX. Untrusted Input, Versioned Formats**:
  - `labels.caged` is parsed with `v.fallback(v.picklist(['interval','name']), 'interval')`.
    An invalid value never affects other fields.
  - The record stays at `version: 1`, and existing fixtures are byte-identical (omit when
    default). One fixture is added.
  - There is no share-link change: layer encoding is out of scope.
  - No input-derived HTML is rendered.
- [x] **X. Simplicity and Incremental Delivery**:
  - The slice follows the wave order (004-caged/004 after 001 to 003).
  - One region table replaces 40 position tables.
  - It reuses `ChoiceGroup`, the slice-016 switch styling and focus logic, the description
    region and `tokenDuration`. `MarkerSample` is not an abstraction over the Fretboard
    markers (R-09).
  - Fallbacks: disabled switches carry a reason, Chord auto-restores so the view is never
    empty, and out-of-board notes are omitted silently, as the spec requires.
- [x] **Technology Stack**: Svelte 5 runes store, Valibot, Paraglide, plain CSS tokens and
  inline SVG are all mandated choices. No stack change is needed.
  - **ADR**: no new ADR is required. ADR 0017 (occurrences from the real tuning) already
    covers the placement and real-pitch approach. The region extension is noted there as an
    addendum.
- [x] **Workflow gates**:
  - Local verification follows the tiers: targeted Vitest, `test:e2e:fast` on the touched
    specs, and filtered `--update-snapshots` for views 16, 17 and 20, then one `pnpm verify`.
  - The full matrix and LHCI are left to CI.
  - Commits use Conventional Commits.

## Project Structure

### Documentation (this feature)

```text
specs/017-caged-layers/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R-01…R-17
├── data-model.md        # Phase 1: theory entities, view state, layer rules, display model, prefs
├── quickstart.md        # Phase 1: validation guide and acceptance walkthrough
├── contracts/
│   ├── caged-layers-api.md   # Module API contracts (theory, notation, view, rules, model, store, prefs, renderer)
│   └── caged-layers-ui.md    # Observable UI / a11y / persistence / TM-9 contract
├── checklists/          # From /speckit.specify
└── tasks.md             # Phase 2 (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
src/lib/
├── theory/
│   ├── caged.ts                     # + ShapeOccurrence.region (unclipped scale-pattern window)
│   └── caged-layers.ts              # NEW pure: ScaleDegree, SCALE_REGIONS, LAYER_DEGREES, degreeOf,
│                                    #   layerNotes, spellScale, isExtraMarked, LAYER_PRIORITY
├── notation/notation.ts             # intervalLabel accepts ScaleDegree (♭6, ♭7)
├── state/
│   ├── caged-layers.ts              # NEW pure: CHORD_ONLY, switchStates, toggleLayer, needsAutoFocus,
│                                    #   ensureDrawable, resolveCagedPositions, layerCounts, revealOrder
│   ├── caged-view.ts                # + layers, labelType, setLayers, setLabelType, reset(preferredLabel)
│   ├── caged-model.ts               # resolved markers, labelMode, switches, appear, description sentences
│   ├── caged.svelte.ts              # + toggleLayer, setLabelType/restoreLabelType, reveal, layerChange,
│                                    #   ensureDrawable after focus clears, REVEAL_WINDOW_MS
│   └── preferences.svelte.ts        # restore/erase labels.caged
├── prefs/schema.ts                  # + labels.caged (omit when 'interval')
├── fretboard/
│   ├── types.ts                     # + Marker.layer, Marker.extra, Marker.appear; interval widened
│   ├── Fretboard.svelte             # layer-arpeggio class, extra-dot, appear intro
│   └── MarkerSample.svelte          # NEW legend glyph sharing marker tokens
├── tools/caged/
│   ├── CagedLayerList.svelte        # NEW zone-D layers list (switch rows + samples)
│   └── CagedTool.svelte             # zone D list, zone E label ChoiceGroup
└── styles/tokens.css                # + --marker-layer-scale, --marker-layer-opacity, --marker-extra-dot
messages/en.json                     # + caged_layers_heading … caged_extra_mark

tests/unit/
├── theory/caged-layers.test.ts (new), caged-layers.property.test.ts (new), caged.test.ts
├── state/caged-layers.test.ts (new), caged-view.test.ts, caged-model.test.ts, caged-store.test.ts,
│   preferences-store.test.ts
├── notation/ (intervalLabel)
├── prefs/schema.test.ts, prefs/fixtures/labels-caged-name.txt (new) + index.ts
├── fretboard/fretboard.test.ts, description.test.ts
└── caged/caged-tool.test.ts

e2e/
├── caged-layers.spec.ts             # NEW: US1–US6, keyboard, reduced motion, persistence, axe
├── caged-tm9.spec.ts                # + TM-9 views 16, 17, 20 snapshots
└── perf.spec.ts                     # + CAGED 7 strings × 24 frets × all layers

docs/adr/0017-caged-occurrences-from-real-tuning.md   # addendum: scale region + real-pitch layer notes
```

**Structure Decision**: this is the existing single SvelteKit project. Every directory above
already exists in the repository: `src/lib/{theory,notation,state,prefs,fretboard,tools/caged,styles}`,
`messages/`, `tests/unit/{theory,state,notation,prefs,fretboard,caged}`, `e2e/` and
`docs/adr/`. The slice adds four source files and three test files, plus one e2e spec and one
prefs fixture. It creates no new directory and follows the constitution's source layout.

## Implementation Order (for /speckit.tasks)

1. **Foundation** (blocks every story):
   - Tokens.
   - `theory/caged-layers.ts` and `caged.ts` `region`, with the TM tables and properties
     written first.
   - The `notation.intervalLabel` extension.
   - `state/caged-layers.ts`, with tests first: rules, resolution, invariants I-1 to I-7.
   - The `caged-view` fields.
   - The `Marker` type fields.
2. **US2 (P1) switches and legend**:
   - The model switches, the store `toggleLayer` and `ensureDrawable` hooks, and
     `MarkerSample`.
   - `CagedLayerList` and the zone-D wiring.
   - Persistence: the navigation, reload and reset behavior.
   - e2e US2.
   - **Then measure the bundle.**
3. **US1 (P1) scale in shape**:
   - Resolved markers in the model, with labels (interval and name), `spellScale` and the
     zone-E label control.
   - The prefs field.
   - The renderer degree markers on string 7 and altered string 6.
   - The `appear` reveal (store, model and renderer).
   - e2e US1.
   - The TM-9 view 20 screenshot.
4. **US3 (P1) arpeggio**:
   - The `layer-arpeggio` styling.
   - The no-focus, whole-neck resolution and the Chord-off path.
   - e2e US3.
5. **US4 (P2) pentatonic**: auto-focus (FR-012), not drawn without focus, e2e US4, and the
   TM-9 view 16 screenshot.
6. **US5 (P2) extra mark**: the `extra` dot, the Scale-row extra sample, the description
   sentence, and e2e US5.
7. **US6 (P2) readability**:
   - Description counts and the all-layers hierarchy test.
   - The TM-9 view 17 screenshot.
   - The perf e2e case.
8. **Polish**:
   - An axe and keyboard pass.
   - The ADR 0017 addendum.
   - `pnpm verify` and the bundle check, with the amendment if needed.

## Complexity Tracking

There is no constitution violation in the design. One contingent item and the recorded
spec-interpretation defaults are listed so that reviewers can approve them explicitly.

| Item | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| **Contingent**: initial JS may exceed 94 KB gzip (estimate +1.6–2.4 KB against about 1.2 KB of headroom). If `check-bundle-size` fails at the end of the slice, ship a MINOR amendment 1.7.0 → 1.8.0 (94 → 96 KB) with a Sync Impact Report, an updated `scripts/check-bundle-size.mjs` and the ADR 0002 cap history | FR-001 to FR-018 are required behavior. The same route was taken by slices 010, 013, 015 and 016 | *Lazy-loading CAGED layers*: forbidden by ADR 0002 (single bundle). *Dropping the reveal motion or the legend samples*: required by FR-013 and FR-001 |
| **Outcome (T052)**: initial JS measured 96.7 KB gzip (+3.9 KB), above the 96 KB contingency. Maintainer approved amendment 1.7.0 → 1.8.0 with a 120 KB cap instead | Same as above; the estimate missed by about 1.5 KB | *Trimming ≥ 0.7 KB to fit 96 KB*: offered and declined |
| Default: string 7 layer notes come from string 7's real pitch, not copied from string 2's frets (R-05) | Identical in AF-21 and AF-22 (TM-6.7), and musically correct in AF-23 and custom 7-string tunings (Principle I) | *Literal copy of string 2's frets*: draws notes outside the scale on a low-A 7th string |
| Default: new strings in `en.json` only (R-15) | `en` is the only catalog today; Principle VIII allows English-only shipping | *Adding pt and es catalogs*: belongs to the localization slice |
| Default: legend glyph is a separate `MarkerSample` sharing tokens (R-09) | Keeps the Fretboard's keyed-each and transitions untouched | *Shared glyph component extracted from Fretboard*: higher regression risk for two users |
