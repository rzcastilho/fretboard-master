# Implementation Plan: Triads Quality Comparison

**Branch**: `feature/007-quality-comparison` | **Date**: 2026-10-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-quality-comparison/spec.md`

## Summary

This feature adds a **Compare** mode to the Triads tool's Isolated and Full neck views. It
overlays the current triad with a second quality that has the same root, inversion and
string set.
- Shared notes are drawn once.
- Each differing note is drawn at both frets. The comparison note gets a dashed outline, and
  an arrow labelled "N fret(s)" joins the two positions.
- The composition panel shows both formulas side by side, with the change emphasised in bold
  plus a "changed" text tag.
- **Listen to comparison** plays block, rest, block.
- Compare state is session-only view state. **Reset tool** clears it.
- Only changing notes move on a quality change (≤ 300 ms, instant with reduced motion).

Technical approach (details in [research.md](./research.md)):

- **Theory** (R-01, R-02, R-11): new pure helpers in `src/lib/theory/triad-shape.ts`:
  - `comparisonFrets`, which moves each differing note on its own string by its semitone
    difference, so FR-010 holds by construction in any tuning;
  - `noteMoves`;
  - `pairOccurrences`;
  - `ONE_NOTE_PARTNER`.

  The comparison is spelled with `spellTriad(firstRootSpelling, q2)`, which keeps the root
  letter (C2). New table tests (the full SC-001 matrix and TM-9 sample 10) and fast-check
  property tests over random tunings gate the change.
- **State** (R-03 to R-05): `TriadsViewState.compare = { on, quality | null }` with these
  transitions:
  - `setCompare` and `setCompareQuality`, which clamp the occurrence;
  - a swap inside `setQuality` (C5);
  - a pair-aware `occurrenceCount`, so **Octave up/down** steps between octaves where both
    triads fit (C6), with a fallback to first-triad occurrences (C7).

  The store gains a transient `notice` for the swap and for omitted notes, rendered by the
  existing `shell/Notice.svelte`.
- **Display model** (R-06, R-10, R-12, R-13): `buildTriadsModel` adds `compare`,
  `comparison`, `listenComparison` and `composition.comparison/changed`. It also emits:
  - dashed comparison markers;
  - move and off-board arrows;
  - stable marker ids;
  - the C17 description.

  In Full neck, every chain shape gets its own pair in place (C8). The chain, tags and
  auto-scroll are unchanged.
- **Fretboard** (R-07 to R-09, ADR 0010): three optional additions, so Notes is unaffected:
  - `Marker.id` drives a keyed loop with a CSS `transform` transition on
    `--duration-short`, so only changed notes slide;
  - `Marker.variant = 'comparison'` draws the dashed outline with new dash tokens;
  - `DisplayModel.arrows` is drawn from `layout.columns`, so arrows mirror with handedness
    and orientation inside the renderer only.
- **Playback** (R-10): no engine change. `planRequest` already uses index-based onsets and
  skips empty steps, so `[first, [], second]` at 120 bpm produces marks at 0–500 and
  1000–1500 ms. A new unit test pins this. Stop-on-change (FR-015) is already covered by
  `apply()`.
- **UI**: a new `TriadsCompare.svelte` (toggle + quality `ChoiceGroup`, zone E). **Listen to
  comparison** goes in `TriadsSecondary`, and the composition panel gets two columns. There
  are about 17 new catalog keys (R-14).

**Assumptions recorded** (headless run, no clarification possible):

1. **Comparison shape = first shape + interval delta per string** (R-01), rather than running
   `triadShape` again on the comparison triad. Both give the same pitches up to whole
   octaves, as the property test T4 proves. Only the delta version keeps the pair in one
   octave without an alignment step. *Rejected*: recomputing and realigning, which is more
   code for the same result.
2. **With no pair occurrence (C7), the octave commands step through first-triad
   occurrences**, not a single frozen octave. This keeps Octave up/down useful on short
   boards. *Rejected*: disabling the octave commands, which would hide reachable first-triad
   octaves.
3. **"Shown one octave up" is announced only when the shift was forced** (pair occurrence 0
   ≠ first-triad occurrence 0; R-15), not when the user pressed **Octave up**. *Rejected*:
   always announcing a non-zero octave, which would repeat what the user just did.
4. **Plural wording uses separate `_one`/`_other` keys** chosen by `count === 1`, because the
   catalog has no plural variants yet (R-14). *Rejected*: adding Paraglide variants for one
   use (YAGNI, Principle X).
5. **The quality-change slide also applies with Compare off** (FR-013, "with or without
   Compare"). First-triad markers always carry an `id`. *Rejected*: ids only while comparing,
   which would leave US5-1 unmet.
6. **The notice is store state, not view state.** It is a one-off event that must not enter
   future share links (R-04). *Rejected*: deriving it from view state, which cannot tell
   "just swapped" from "was always this way".

## Technical Context

**Language/Version**: TypeScript 5.x with `strict: true`. Node and pnpm are pinned through `mise.toml`.

**Primary Dependencies**: Svelte 5 (runes) + SvelteKit `adapter-static`, Vite, Paraglide JS, and Web Audio (the in-house Karplus-Strong engine). No new runtime dependency.

**Storage**: N/A. Compare state is session-only module state (FR-018, C16). Nothing new is written to `localStorage` or share links.

**Testing**: Vitest + fast-check (unit, component, property), @testing-library/svelte, Playwright (phone 360 px + desktop) + @axe-core/playwright, Lighthouse CI.

**Target Platform**: The last two major evergreen browsers, desktop and mobile. Static hosting on Cloudflare Pages.

**Project Type**: Static single-page web app (SvelteKit, prerendered).

**Performance Goals**: Control change → fretboard update ≤ 100 ms for Compare on/off, comparison-quality change and root change while comparing (FR-021, SC-007). Tap to sound ≤ 100 ms. Quality slide ≤ 300 ms (`--duration-short`).

**Constraints**:
- Initial JS ≤ 80 KB gzip; expected growth is < 2 KB.
- Fully offline after load.
- WCAG 2.2 AA with zero axe violations.
- Not colour alone: dashed outline + arrow.
- 320–2560 CSS px, and only the fretboard scrolls horizontally.
- 200 % text zoom.
- `prefers-reduced-motion` and `prefers-contrast` are honoured.

**Scale/Scope**:
- One tool (Triads), 2 views affected, 12 ordered quality pairs.
- ≤ 8 chain shapes × ≤ 2 arrows on 24 frets.
- About 17 new message keys.
- About 12 source files touched; 2 new files (`TriadsCompare.svelte`, ADR 0010) and 3 new test files.

No `NEEDS CLARIFICATION` remained: the stack is fixed by the constitution, and spec
clarifications C1–C17 settle the behaviour. The one open item the spec delegated to the plan
(C12, "confirm the engine accepts an empty rest step") is resolved in R-10: the engine accepts
it, and no change is needed.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Pre-research and post-design evaluation: both **PASS**, with no violations.

- [x] **I. Musical Correctness**:
  - The comparison is calculated from the configured tuning and fret count by
    `comparisonFrets` (one fret = one semitone on the same string). Nothing is hand-drawn.
  - Spelling comes from `spellTriad` with the first triad's root spelling, so D♭ minor is
    D♭–F♭–A♭ and double accidentals are kept.
  - New table tests (the SC-001 matrix over 12 roots × 3 inversions × every set × 12 quality
    pairs, plus TM-9 sample 10) and NFR-9.3 property tests (rising pitch, correct pitch
    classes, correct bass, same octave offset) are added here.
  - The TM-4.2, TM-4.3, TM-5.5 and chain suites keep gating.
  - Listen plays the displayed positions, so every note sounds at its calculated pitch.
- [x] **II. On-Device, Static, Private**: everything is computed and played in the browser.
  There is no network use, permission, identifier or third-party code. Compare state is not
  persisted (C16).
- [x] **III. Pure Core, Thin Shell**:
  - The new theory helpers live in `src/lib/theory` and import only `./pitch` and `./triad`,
    as the lint boundary enforces.
  - Data flows one way: Compare control → `triads-view` → `buildTriadsModel` →
    `DisplayModel` (markers, arrows in string/fret terms) → `Fretboard`.
  - Arrows and dashed outlines are drawn only by the shared renderer, and their direction
    comes from `layout.columns`, so handedness and orientation stay inside the renderer.
  - Compare state is in `src/lib/state`.
- [x] **IV. Test-First / Tested Behaviour**:
  - Theory, view transitions and the schedule rest step are written test-first.
  - Every acceptance scenario (US1–US6) is mapped to Vitest and/or Playwright in
    [contracts/triads-ui.md](./contracts/triads-ui.md).
  - TM-9 sample 10 becomes a Playwright screenshot.
  - Listen to comparison is tested with the injectable fake engine and clock.
- [x] **V. Accessible by Default**:
  - The comparison is shown by dashed outline plus arrow plus label, as the constitution
    names it, never by colour alone.
  - The composition difference is shown by weight plus a "changed" text tag.
  - The toggle uses `aria-pressed`, the list is a radio group, and all targets are
    ≥ 44×44 px with a logical Tab order.
  - The C17 polite description reads accidentals in full.
  - Motion is instant under reduced motion.
  - Axe runs on the comparison states.
- [x] **VI. Performance Budgets**: the derivation adds a 3-element offset per shape (≤ 8
  shapes), which is far below 100 ms. There is no new dependency and the bundle grows by
  < 2 KB. `e2e/perf.spec.ts` gains Compare on and comparison-quality-change timings.
- [x] **VII. Design System Fidelity**:
  - Compare lives in zone E next to the fretboard and never covers it.
  - The tool still opens simple, with Compare off.
  - Marker shapes and function colours are unchanged. Arrows use `--color-text` and never
    the root, third or fifth colours (the reserved-colors test).
  - New values are tokens (`--marker-dash`, `--marker-dash-gap`, `--arrow-head-size`,
    `--panel-column-min`).
  - Motion explains change: only the changing note slides, within `--duration-short`.
  - The swap and omission notices are one line, non-blocking, dismissible and not
    error-red.
- [x] **VIII. International**:
  - Every new string is a catalog key (R-14).
  - Note names on arrows, notices and the panel come from `src/lib/notation`, with
    accidentals rendered ♯ ♭ 𝄪 𝄫.
  - The panel columns stack, and arrow labels sit in the row band, so pt/es text and 200 %
    zoom do not truncate.
  - `no-raw-text.test.ts` covers the new component.
- [x] **IX. Untrusted Input, Versioned Formats**: N/A for parsing, because this slice adds no
  share-link or preference field (Compare is excluded from links and storage by FR-018). The
  new transitions are total and reject invalid qualities, which keeps the future link decoder
  safe. Labels are catalog or notation text, never rendered as HTML.
- [x] **X. Simplicity and Incremental Delivery**:
  - This is wave 002, slice 002 (`specs/autonomous/breakdown/002-triads-across-the-neck/002-quality-comparison.md`),
    building on 005 and 006.
  - The new abstractions each have two real uses now:
    - `Marker.id` serves the quality slide with Compare off and the comparison markers;
    - `DisplayModel.arrows` serves on-board moves and off-board notes in both Isolated and
      Full neck;
    - `Marker.variant` serves Isolated and Full neck.
  - The "never blank; adjust and tell" rule is respected by the swap notice, the off-board
    arrows and the omitted-notes notice.
- [x] **Workflow gates**:
  - Conventional Commits.
  - CI runs typecheck, svelte-check, lint (boundaries), format, coverage (theory ≥ 95 %),
    Playwright with axe on two profiles, and Lighthouse.
  - ADR 0010 records the renderer additions (arrows, marker identity, comparison variant).

## Project Structure

### Documentation (this feature)

```text
specs/007-quality-comparison/
├── plan.md              # This file
├── research.md          # Phase 0: R-01 … R-17
├── data-model.md        # Phase 1: theory moves, compare state, display model, fretboard arrows
├── quickstart.md        # Phase 1: validation guide
├── contracts/           # Phase 1: deltas against 006 contracts
│   ├── triads-theory-api.md
│   ├── triads-state-api.md
│   ├── fretboard-model.md
│   └── triads-ui.md
├── checklists/          # from /speckit.specify
└── tasks.md             # Phase 2 output (/speckit.tasks; not created here)
```

### Source Code (repository root)

```text
src/lib/
├── theory/
│   └── triad-shape.ts            # + Functions3, NoteMove, ONE_NOTE_PARTNER, comparisonFrets, noteMoves, pairOccurrences
├── state/
│   ├── triads-view.ts            # + compare field, setCompare, setCompareQuality, swap in setQuality, pair-aware occurrenceCount
│   ├── triads-model.ts           # + compare/comparison/listenComparison, dashed markers, arrows, marker ids, C17 description, composition.comparison
│   └── triads.svelte.ts          # + setCompare, setCompareQuality, listenComparison, notice, dismissNotice
├── fretboard/
│   ├── types.ts                  # + Marker.id, Marker.variant, FretboardArrow, DisplayModel.arrows
│   ├── description.ts            # + comparison suffix in positionName
│   └── Fretboard.svelte          # id-keyed markers with CSS transform transition, dashed variant, arrows layer, fades
├── tools/triads/
│   ├── TriadsCompare.svelte      # NEW: Compare toggle + comparison-quality ChoiceGroup
│   ├── TriadsSecondary.svelte    # + Listen to comparison
│   ├── TriadsTool.svelte         # wiring + Notice for swap/omission
│   └── CompositionPanel.svelte   # two-column comparison with "changed" emphasis
└── styles/tokens.css             # + --marker-dash, --marker-dash-gap, --arrow-head-size, --panel-column-min
messages/en.json                  # + ~17 compare keys (research R-14)
docs/adr/0010-fretboard-arrows-and-marker-identity.md   # NEW

tests/unit/
├── theory/triad-compare.test.ts, triad-compare.property.test.ts   # NEW
├── state/triads-view.test.ts, triads-model.test.ts, triads-store.test.ts
├── fretboard/fretboard.test.ts, description.test.ts
├── audio/schedule.test.ts        # + empty rest step timing
└── triads/triads-compare.test.ts (NEW), triads-secondary.test.ts, composition-panel.test.ts, triads-tool.test.ts

e2e/
├── triads-compare.spec.ts        # NEW: US1–US5 flows, fixtures SHORT-7 / AF-1-12 / AF-8 / NC-UNISON, axe
├── triads-tm9.spec.ts            # + sample 10 (G major vs minor, 2nd inv, 4-3-2)
├── playback.spec.ts              # + Listen to comparison (US6)
└── perf.spec.ts                  # + Compare on, comparison-quality change
```

**Structure Decision**: this is a single SvelteKit project at the repository root, following
the constitution's source layout. The feature extends the existing modules:
- `src/lib/theory/triad-shape.ts`;
- `src/lib/state/triads-{view,model}.ts` and `triads.svelte.ts`;
- `src/lib/fretboard/`;
- `src/lib/tools/triads/`.

All of these exist on this branch. The only new source file is
`src/lib/tools/triads/TriadsCompare.svelte`. Tests go in the existing `tests/unit/{theory,state,fretboard,audio,triads}`
and `e2e/` directories, and the ADR goes in the existing `docs/adr/`. No new package, route
or top-level directory is introduced.

## Complexity Tracking

No constitution violations, so no table entries are needed. The design choices that could
look like added complexity are justified here.

| Item | Why needed | Simpler alternative rejected because |
|---|---|---|
| `DisplayModel.arrows` (new renderer layer) | FR-007 requires an arrow that follows handedness, and Principle III allows only the renderer to draw and orient | Drawing arrows in the tool needs screen coordinates and breaks the boundary. Encoding them as markers cannot express a line between two cells |
| `Marker.id` + CSS transform transition | FR-013/C15: only the changing note may move, and markers keyed by position re-create a moved note | Svelte `animate:flip` does not apply to SVG transforms. A JS tween adds code for the same result |
| Store-level `notice` | C5 and FR-014 need one-line "adjust and tell" messages that are events, not view state | Putting it in view state would leak a transient event into future share links |
