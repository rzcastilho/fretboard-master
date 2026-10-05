# Implementation Plan: CAGED Triad Layer

**Branch**: `018-triad-layer` | **Date**: 2026-10-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-triad-layer/spec.md`

## Summary

CAGED gains a fifth layer, **Triad** (FR-6.11, FR-6.12, FR-5.5, FR-5.8, FR-1.6, EC-6.7). With a
shape in focus the user picks a string set with the same control as the Triads tool. The
close-position triad on that set that lies inside the shape's arpeggio is drawn with the
highest emphasis, and **Open in Triads** opens that exact triad in the Triads tool.

Technical approach ([research.md](./research.md)):

- **Theory** (R-01, R-02): a new pure `src/lib/theory/caged-triad.ts`, with `shapeTriad`.
  - Candidates come from the Triads tool's own `triadShape` + `occurrences` on the set's real
    open pitches. A candidate is kept when all three frets lie in the occurrence's clipped
    slice 017 `region`.
  - So the found triad equals a Triads shape by construction, and its octave index `k` is the
    hand-off occurrence. String 7 and the altered string 6 need no special case.
  - Ties: smallest `span()`, then the lowest bass fret.
  - Planning computed the full C-key standard-tuning matrix (R-01). It provides the table
    anchors: A shape 3-2-1 = 5-5-3, G shape 3-2-1 unavailable, D shape 3-2-1 = `k = 1`.
- **Layer rules** (R-03, R-04): `CagedLayer` gains `'triad'`, with priority
  `triad > chord > arpeggio > pentatonic > scale`.
  - Triad is drawable only with focus, and it auto-focuses like Pentatonic and Scale.
  - The slice 017 base-layer machinery picks it up through `LAYER_PRIORITY`.
  - `resolveCagedPositions` claims the three triad positions first.
- **Set selection** (R-05, R-06): `CagedViewState.triadSet` stores the effective selection.
  - The pure `state/caged-triad.ts` computes availability, the default (3-2-1, else the first
    available), `settleTriadSet` (keep, else default and announce, and keep if none is
    available) and the hand-off.
  - The store runs `settleTriad()` at the slice 017 `settleLayers()` hook points.
- **Display** (R-07, R-08, R-10): `Marker.layer` widens to `'arpeggio' | 'triad'`.
  - A `layer-triad` class makes the marker larger with a heavier outline, using new tokens. It
    is distinct from the connection `ring`, which still composes.
  - Triad marker ids become `triad:s:f`, so the existing mount-only `appear` intro plays low to
    high on turn-on and on set change.
  - The description and announcements name the notes, inversion, set and frets.
- **UI** (R-09): a new `CagedTriadSets.svelte` reuses `ChoiceGroup` with the Triads
  string-set options. `ChoiceGroup` gains an opt-in `reachDisabled` and a per-option
  `describedby`, so unavailable sets stay keyboard-reachable and explained (EC-6.7).
- **Hand-off** (R-11): a pure `carryCagedTriad` in `links.ts` sets Isolated, quality (keeping
  the Compare swap invariant), root, spelling, inversion, set and occurrence. The orchestrator
  `openTriadsFromCagedTriad()` makes one `goto`. CAGED state is untouched.

Assumptions and defaults beyond the spec (detailed in research.md, approved in Complexity
Tracking):

- **Compare conflict** (R-11): if Triads' Compare is on and the drawn occurrence's comparison
  does not fit the board, Compare is turned off with a one-line notice, so the hand-off still
  lands on the drawn shape. *Rejected*: keeping Compare and landing on a different occurrence.
- **Temporary standard view** (R-11): Open in Triads is not offered while CAGED shows the
  temporary standard tuning, because Triads would use the real, non-compatible tuning.
- **No available set** (R-05): the stored set is kept, not lost, when a shape has no triad.
- **Translations** (R-14): new keys go into `messages/en.json` only, because it is the only
  configured locale. This follows the precedent of slices 016 and 017.

## Technical Context

**Language/Version**: TypeScript 5 (`strict: true`). Node and pnpm are pinned through mise
(`mise.toml`).

**Primary Dependencies**: Svelte 5 (runes), SvelteKit `adapter-static`, Paraglide JS and
Valibot, all existing. **No new dependency.**

**Storage**: none new. Triad on/off and the selected set are in-memory CAGED view state only:
never in `localStorage` and never in the URL. The prefs schema is unchanged.

**Testing**:

- **Vitest + fast-check**:
  - Theory tables (R-01 matrix, open position, fret counts 12/22/24, Drop D, 7-string, Half
    step down, does-not-close).
  - Property tests for invariants T-1 to T-5 across keys, qualities, occurrences, fret counts
    and random compatible tunings.
  - Layer rules and resolution (I-8 to I-10), `caged-triad` state helpers, view, model and
    store (fake timers for the reveal).
  - The `carryCagedTriad` table, `ChoiceGroup` `reachDisabled`, the renderer `layer-triad`
    class and remount, and the CAGED tool component.
- **Playwright + @axe-core/playwright**: a new `e2e/caged-triad.spec.ts` for US1–US5,
  keyboard, reduced motion, navigation and reload persistence, and axe. Plus a hand-off check
  in `e2e/linked-tools.spec.ts`.

**Target Platform**: evergreen browsers (the last two majors), desktop and mobile, served
statically from Cloudflare Pages.

**Project Type**: a static single-page web application (SvelteKit, prerendered, a single
bundle per ADR 0002).

**Performance Goals**:

- A Triad toggle or set change updates the fretboard in ≤ 100 ms. The work is at most
  5 sets × 3 inversions × 2–3 octave copies, which is trivial.
- The reveal finishes within `--duration-short` (300 ms), and is instant under reduced motion.
- Opening Triads takes ≤ 300 ms (tool switch budget).

**Constraints**:

- **Bundle**: initial JS ≤ 120 KB gzip. It is 96.7 KB after slice 017; this slice is estimated
  at +1.2–1.8 KB (R-13).
- **Visual states**: only the four emphasis levels. The triad treatment is size and outline,
  not color.
- **Accessibility**: 44×44 px targets and zero axe violations.
- **Pure core**: `src/lib/theory` takes open pitches, never the `Instrument` or presentation
  concepts.

**Scale/Scope**:

- **Instruments**: one tool (CAGED). 12 keys × 2 qualities × 5 shapes × 4–5 string sets. 6 or
  7 strings, 12–24 frets, compatible, transposed and altered-string tunings.
- **Files**: 3 new source modules (`theory/caged-triad.ts`, `state/caged-triad.ts`,
  `tools/caged/CagedTriadSets.svelte`), about 12 edited files and about 12 new message keys.
- **Tests**: 3 new unit test files and 1 new e2e spec.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution v1.8.0. The pre-research and post-design results are identical. The design
introduces no principle violation. The spec-interpretation defaults are listed in Complexity
Tracking for explicit reviewer approval.

- [x] **I. Musical Correctness**:
  - The triad is calculated from the configured key, quality, real tuning, string count and
    fret count. It comes from the TM-5.3 `triadShape` and `occurrences` already gated by the
    TM-5.5 tables and the NFR-9.3 properties, then filtered by the slice 017 region.
  - Spelling uses `spellTriad` (alternate letters) and `notation`.
  - New table tests (R-01 matrix) and property tests T-1 to T-5 run across generated tunings
    and join the CAGED gate (R-16).
- [x] **II. On-Device, Static, Private**: all computation runs in the browser. Nothing new is
  stored. There is no network, permission or identifier.
- [x] **III. Pure Core, Thin Shell**:
  - `theory/caged-triad.ts` imports only `./pitch`, `./triad`, `./triad-shape` and `./caged`,
    and the existing lint rule enforces this.
  - Availability, default and settle, resolution, and the hand-off live in pure `state/` modules.
  - Data flows switch or set → view state → display model → renderer.
  - `CagedTriadSets` only presents `display.triad`.
  - "Low to high" is pitch order, computed before layout. Mirroring stays in the renderer.
- [x] **IV. Test-First / Tested Behavior**:
  - The theory and state rules are written test-first: tables, then properties, then code.
  - Every acceptance scenario of US1–US5 maps to Vitest or Playwright (quickstart §5, R-16).
  - The reveal uses fake timers or `page.clock`.
  - TM-9 view #19 (CAGED, E major, A shape, Triad layer, 6 strings, AF-2 half step down)
    covers this slice, so it gets a Playwright screenshot fixture `tm9 view 19` in
    `e2e/caged-tm9.spec.ts` with phone, phone-touch and desktop baselines (task T056). Any
    screenshot added is regenerated only for its own test.
- [x] **V. Accessible by Default**:
  - The switch is `role="switch"` and the sets are a radiogroup. Unavailable sets use
    `aria-disabled` and stay reachable (`reachDisabled`), with a visible and described
    explanation.
  - Triad emphasis is size and outline, and function is shown by glyph plus label, so nothing
    relies on color.
  - Changes are announced through the existing polite description, with accidentals spoken in
    full. Reduced motion makes the reveal instant.
  - Targets are 44 px, and axe is gated in e2e.
- [x] **VI. Performance Budgets**:
  - No dependency is added. The computation is O(sets × inversions × octaves) per render.
  - The bundle estimate of +1.2–1.8 KB stays far under 120 KB, and it is measured once in
    `pnpm verify` (R-13).
  - The existing CAGED all-layers perf e2e case still applies.
- [x] **VII. Design System Fidelity**:
  - The root square, third circle and fifth diamond code is unchanged. The triad treatment is a
    token-driven scale and outline (`--marker-triad-scale`, `--marker-triad-stroke`).
  - No new emphasis level is added, and no reserved color is reused.
  - The selector and shortcut sit in zone D under the layer list and never cover the board.
  - CAGED still opens with Chord only.
  - Motion stays within `--duration-short`.
- [x] **VIII. International**:
  - Every new string is a catalog key.
  - Inversion names reuse `triads_inversion_*`, note names come from `src/lib/notation`, and
    accidentals are glyphs.
  - Rows wrap for longer languages and at 200% zoom.
  - pt and es values arrive with the localization slice, with no code change (R-14).
- [x] **IX. Untrusted Input, Versioned Formats**: N/A for new formats. The feature adds no
  share-link or prefs field, and layer encoding in links is out of scope by the spec. The
  existing prefs fixtures stay byte-identical, which e2e asserts. No input-derived HTML is
  rendered.
- [x] **X. Simplicity and Incremental Delivery**:
  - The slice follows the wave order (004-caged/005 after 004).
  - It reuses `triadShape`, `occurrences`, `span`, `layerNotes` regions, `ChoiceGroup`, the
    slice 017 base-layer rule, reveal and description.
  - No new abstraction is added. `ChoiceGroup` gains two opt-in props with default behavior
    unchanged.
  - Fallbacks: unavailable sets are explained, settle-moves are announced, and a Compare
    conflict is adjusted and told.
- [x] **Technology Stack**: Svelte 5 runes store, Paraglide, plain CSS tokens and inline SVG are
  mandated choices, so no stack change is needed.
  - **ADR**: none is required. ADR 0011 (carry at activation) covers the hand-off, and ADR 0010
    (marker identity) covers the `triad:` id prefix.
- [x] **Workflow gates**:
  - Local verification follows the tiers: targeted Vitest, `test:e2e:fast` on the touched specs,
    then one `pnpm verify`. The full matrix and LHCI are left to CI.
  - Commits use Conventional Commits on branch `018-triad-layer`.

## Project Structure

### Documentation (this feature)

```text
specs/018-triad-layer/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R-01…R-16 (incl. reference triad matrix)
├── data-model.md        # Phase 1: ShapeTriad, view state, rules, display model, hand-off
├── quickstart.md        # Phase 1: validation guide and acceptance walkthrough
├── contracts/
│   ├── triad-layer-api.md   # Module API contracts (theory, rules, state, model, store, links, renderer)
│   └── triad-layer-ui.md    # Observable UI / a11y / persistence contract
├── checklists/          # From /speckit.specify
└── tasks.md             # Phase 2 (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
src/lib/
├── theory/
│   ├── caged-layers.ts              # CagedLayer + 'triad'; MelodicLayer explicit; LAYER_PRIORITY triad first
│   └── caged-triad.ts               # NEW pure: ShapeTriad, shapeTriad (triadShape + occurrences ∩ region)
├── state/
│   ├── caged-triad.ts               # NEW pure: triadAvailability, defaultTriadSet, settleTriadSet,
│                                    #   selectedTriad, triadRevealIds, triadHandoff, TriadsHandoff
│   ├── caged-layers.ts              # triad drawable/auto-focus/switch; ResolveInput.triad; claim triad first
│   ├── caged-view.ts                # LayersOn.triad, triadSet, setTriadSet, reset
│   ├── caged-model.ts               # display.triad, triad markers (layer, ids), description, triadChange
│   ├── caged.svelte.ts              # toggleLayer('triad') default set, selectTriadSet, settleTriad, reveal
│   ├── links.ts                     # carryCagedTriad
│   ├── links.svelte.ts              # openTriadsFromCagedTriad
│   └── triads.svelte.ts             # carryCagedTriad + 'compare-off-for-shape' notice
├── fretboard/
│   ├── types.ts                     # Marker.layer: 'arpeggio' | 'triad'
│   ├── Fretboard.svelte             # layer-triad class
│   └── MarkerSample.svelte          # layer 'triad' sample
├── tools/
│   ├── ChoiceGroup.svelte           # option describedby; reachDisabled
│   ├── caged/CagedLayerList.svelte  # Triad row (last)
│   ├── caged/CagedTriadSets.svelte  # NEW selector + summary + Open in Triads
│   ├── caged/CagedTool.svelte       # wiring
│   └── triads/TriadsTool.svelte     # renders the new notice kind
└── styles/tokens.css                # --marker-triad-scale, --marker-triad-stroke
messages/en.json                     # caged_layer_triad, caged_triad_* , triads_notice_compare_off_for_shape

tests/unit/
├── theory/caged-triad.test.ts (new), caged-triad.property.test.ts (new), caged-layers.test.ts
├── state/caged-triad.test.ts (new), caged-layers.test.ts, caged-view.test.ts, caged-model.test.ts,
│   caged-store.test.ts, links.test.ts, triads-store.test.ts
├── triads/choice-group.test.ts
├── fretboard/fretboard.test.ts
└── caged/caged-tool.test.ts

e2e/
├── caged-triad.spec.ts              # NEW: US1–US5, keyboard, reduced motion, persistence, axe
└── linked-tools.spec.ts             # + Open in Triads round trip
```

**Structure Decision**: this is the existing single SvelteKit project. Every directory above
already exists in the repository: `src/lib/{theory,state,fretboard,tools,tools/caged,tools/triads,styles}`,
`messages/`, `tests/unit/{theory,state,triads,fretboard,caged}` and `e2e/`. The slice adds
three source files, three unit test files and one e2e spec. It creates no directory and follows
the constitution's source layout.

## Implementation Order (for /speckit.tasks)

1. **Foundation** (blocks every story):
   - Tokens.
   - `theory/caged-triad.ts`, with the R-01 tables and T-1 to T-5 properties written first.
   - The `CagedLayer` and `MelodicLayer` and `LAYER_PRIORITY` change.
   - `state/caged-triad.ts`, with tests first.
   - The `caged-view` fields and the `Marker.layer` widening.
2. **US1 (P1) triad in the shape**:
   - Resolution claims the triad, and the model markers, labels and `layer-triad` render.
   - The store `toggleLayer('triad')` default set, `selectTriadSet` and reveal.
   - The layer row, sample and selector (available sets).
   - The description, then e2e US1.
3. **US2 (P1) unavailable sets**:
   - `ChoiceGroup` `reachDisabled` and `describedby`, the EC-6.7 note, `settleTriad` moves and
     the announcement, and the all-unavailable state.
   - e2e US2.
4. **US3 (P1) Open in Triads**:
   - `carryCagedTriad` (tests first, including the Compare cases), the Triads store method and
     notice, the orchestrator and the button.
   - e2e US3 and the linked-tools round trip.
5. **US4 (P2) focus rules**: auto-focus, focus cleared, See all with Chord restore,
   last-layer disabled, then e2e US4.
6. **US5 (P2) tunings**: Half step down names, Drop D string 6, 7-string 7-6-5,
   non-compatible disabled, then e2e US5.
7. **Polish**: an axe and keyboard pass, a no-raw-text check, and one `pnpm verify` with the
   bundle check.

## Complexity Tracking

There is no constitution violation in the design. The spec-interpretation defaults are listed
so that reviewers can approve them explicitly.

| Item | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Default: Compare in Triads is turned off, with a one-line notice, when the drawn occurrence's comparison does not fit the board (R-11) | FR-009 requires both "lands on the occurrence equal to the drawn triad" and "keeps Compare". They conflict only near the nut or the last fret. Shape equality is the hand-off's purpose, and Principle X says adjust and tell | *Keep Compare and land on another occurrence*: silently breaks FR-009 equality. *Set the raw `k` as `occurrence`*: wrong shape, because Triads indexes pairs while Compare is on |
| Default: Open in Triads is hidden in CAGED's temporary standard view (R-11) | Triads always uses the real tuning, so the drawn standard-tuning shape cannot be reproduced there (FR-009 "in the current tuning") | *Offer it and carry anyway*: lands on a different shape in a non-compatible tuning |
| Default: when no set is available, the stored set is kept (R-05) | It preserves the user's choice for the next shape, and nothing is drawn either way | *Clear it to null*: the next shape would jump to 3-2-1 even when the old set is available |
| Deviation: new strings go into `en.json` only, although FR-014 says en, pt, es (R-14) | `project.inlang/settings.json` configures only `en`, and Principle VIII allows English-only shipping with catalog keys | *Add pt and es locales now*: out of scope (localization slice), and would duplicate strings untranslated |
| `ChoiceGroup` gains opt-in `reachDisabled` and a per-option `describedby` (R-09) | FR-006 requires unavailable sets to be disabled but keyboard-reachable and explained. Today's group skips disabled options | *A new selector component*: duplicates the Triads control the spec says to reuse |
