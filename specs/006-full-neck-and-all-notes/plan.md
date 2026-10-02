# Implementation Plan: Triads Full Neck and All Notes Views

**Branch**: `feature/006-full-neck-and-all-notes` | **Date**: 2026-10-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-full-neck-and-all-notes/spec.md`

## Summary

Add two views to the Triads tool next to Isolated, chosen with a segmented **View** control:
**Full neck** shows every occurrence of every inversion on the chosen string set (TM-5.3 lowest
occurrence + 12k while it fits), ordered by lowest-string fret, each with a tappable tag above
the fretboard; the selected inversion's shapes are highlighted, the rest normal. **All notes**
shows every root, third and fifth on every string by function, and disables the inversion and
string-set controls. The guidance from 005 gains **See all notes**. **Listen** follows the view.
The view is a new field of the Triads view state (session only; **Reset tool** returns it to
Isolated).

Technical approach (details in [research.md](./research.md)):

- **Theory** (R-01, R-02): one new pure function `inversionChain(open, triad, fretCount)` in
  `src/lib/theory/triad-shape.ts`, built from the existing `triadShape` + `occurrences`, so
  Full neck and Isolated share one calculation (FR-003). New table tests (C1, C16, C17, SC-002)
  and fast-check property tests gate it (Principle I).
- **State** (R-03, R-04, R-07, R-08, R-10, R-11): `view` field plus `setView`, `seeAllNotes`,
  `selectShape`, `resetTriads` in `triads-view.ts`, with guards so octave commands only act in
  Isolated and inversion and set changes do nothing in All notes. `buildTriadsModel` derives
  markers, tags, keyed auto-scroll, C18 descriptions, per-view Listen steps (24 steps for
  A major 3-2-1; All notes A2/C♯3/E3) and the C10 composition variant. The store's existing
  "stop playback on any real change" rule covers C13 with no extra code.
- **Fretboard** (R-05, R-06): backwards-compatible `DisplayModel.tags` and
  `DisplayModel.autoScroll`, plus an `ontag` event. Tags are HTML buttons in a strip inside the
  board's scroller, so they scroll with the board. A pure `layoutTags` puts each tag on the
  first row where it does not overlap, and `groupScrollTarget` implements C15: tapping a tag
  never scrolls the board.
- **UI** (R-09, R-12): `ChoiceGroup` gains `disabled` (`aria-disabled`, greyed, inert, still
  focusable, with a hint text). The **View** group, **See all notes**, the octave-disabled hint,
  **Reset tool** and the composition-name variant all use new catalog keys.
- **Tests**: every acceptance scenario is mapped to Vitest and/or Playwright in
  [contracts/triads-ui.md](./contracts/triads-ui.md). This slice adds TM-9 views 6, 9 and 14,
  plus the fixture instruments `AF-8` and `SHORT-7`.

**Assumptions recorded** (headless run, no clarification possible):

1. The Triads tool has no **Reset tool** yet (005 never shipped one). FR-019 and FR-1.11 need
   it, so this slice adds a minimal one that mirrors Notes. *Rejected*: a store-only reset with
   no user path, which would make FR-019 untestable through the UI.
2. C15's auto-scroll rule ("keep if any highlighted shape is visible, else scroll the lowest
   one") also runs when root, quality, set or fret count change *inside* Full neck. It does
   not run for inversion or occurrence changes, so tag taps and the inversion control never
   scroll. *Rejected*: scrolling on every highlight change (the 005 default), which breaks
   "tag activation never scrolls".
3. Disabled controls use `aria-disabled` and stay focusable, as 005's octave buttons do.
   *Rejected*: native `disabled`, which removes them from the tab order so the reason is
   never announced.
4. All notes Listen with an unreachable note (only possible on very short boards) plays the
   reachable prefix, and disables Listen when the root is unreachable. *Rejected*: transposing
   up an octave, which plays a pitch the board does not show.

## Technical Context

**Language/Version**: TypeScript 5.x, `strict: true` (Node and pnpm pinned through `mise.toml`)

**Primary Dependencies**: Svelte 5 (runes) + SvelteKit `adapter-static`, Vite, Paraglide JS, Web Audio (in-house Karplus-Strong engine). No new runtime dependency.

**Storage**: N/A. The view is session-only module state (FR-019); no `localStorage` write in this slice.

**Testing**: Vitest + fast-check (unit, component, property), @testing-library/svelte, Playwright (phone 360 px + desktop + phone-touch) + @axe-core/playwright, Lighthouse CI

**Target Platform**: Last two major evergreen browsers, desktop and mobile; static hosting on Cloudflare Pages

**Project Type**: Static single-page web app (SvelteKit, prerendered)

**Performance Goals**: control change → fretboard update ≤ 100 ms (view switch, tag tap; FR-021, SC-006); tap to sound ≤ 100 ms; smooth scroll at 24 frets

**Constraints**: initial JS ≤ 80 KB gzip; fully offline after load; WCAG 2.2 AA (zero axe violations); 320–2560 CSS px with only the fretboard scrolling horizontally; 200 % text zoom; `prefers-reduced-motion`

**Scale/Scope**: one tool (Triads), 2 new views; chain ≤ 6 shapes on 22 frets (≤ 8 on 24); All notes ≤ 7 strings × 25 frets markers; ~15 new message keys; ~10 source files touched, 1 new (`fretboard/tags.ts`)

No `NEEDS CLARIFICATION` remained: the stack is fixed by the constitution and the spec's
C1–C18 settle the behaviour. [research.md](./research.md) records the design decisions
R-01 to R-14.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Pre-research and post-design evaluation (both **PASS**; no violations):

- [x] **I. Musical Correctness**: the chain is computed by `inversionChain` from
  `triadShape` + `occurrences` over the configured tuning and fret count, never hand-drawn.
  New table tests (C1, C16, C17, all 12×4×4 cells for SC-002) and NFR-9.3 property tests
  over random tunings are added here and gate all later theory changes. The TM-4.2, TM-4.3
  and TM-5.5 suites from 005 stay in place. Spelling comes from `spellTriad`, so F𝄪 shows
  as F𝄪.
- [x] **II. On-Device, Static, Private**: everything is computed in the browser. No network
  use, permissions, identifiers or third-party code. The view is not persisted at all
  (FR-019).
- [x] **III. Pure Core, Thin Shell**: theory stays pure (`triad-shape.ts` imports only
  `./pitch` and `./triad`, enforced by lint). Data flows one way: control → `triads-view` →
  `buildTriadsModel` → `DisplayModel` → `Fretboard`. Tags are drawn by the shared renderer
  and reported in musical terms (`ontag(id)` → inversion and octave). View state lives in
  `src/lib/state`.
- [x] **IV. Test-First / Tested Behaviour**: theory, view transitions and tag layout are
  written test-first. Every acceptance scenario (US1–US5) maps to a test in
  [contracts/triads-ui.md](./contracts/triads-ui.md). TM-9 views 6, 9 and 14 become
  Playwright screenshots. Listen is tested with the injectable fake engine and clock.
- [x] **V. Accessible by Default**: tags are native buttons with `aria-pressed`, full
  accessible names and chain-order focus. Disabled controls use `aria-disabled` plus a hint
  text, never colour alone. Emphasis is shown by opacity plus size. Each new view gets a C18
  text description in the polite live region, with accidentals read in full. Tags are
  ≥ 44×44 px. Reduced motion makes the scroll instant. Axe runs on both views.
- [x] **VI. Performance Budgets**: the chain is ≤ 3 `triadShape` calls and All notes is
  ≤ 175 positions, far under 100 ms. There is no new dependency, and the bundle grows only by
  a few hundred bytes. `e2e/perf.spec.ts` adds view-switch and tag-tap checks.
- [x] **VII. Design System Fidelity**: tags sit above the board as the design spec places
  them. Controls stay always visible and never cover the board. Only the four emphasis
  levels are used (highlighted, normal, hidden). Tokens are used throughout, including new
  disabled tokens if missing. Guidance is not error-red and the shape-fits case shows no
  message. Markers are keyed per position, so only the notes that change animate.
- [x] **VIII. International**: every new string is a key in `messages/en.json` (R-12), and
  note names come from `src/lib/notation`. Tag widths are measured, so longer pt/es text and
  200 % zoom wrap to a second row and are never truncated. `no-raw-text.test.ts` still guards
  against hard-coded text.
- [x] **IX. Untrusted Input, Versioned Formats**: N/A for parsing, because this slice adds no
  share-link or preference format (C14 defers view encoding to the share-link feature). Total
  transitions with guards (`setView`, `selectShape` range check) keep any future
  decoder-driven state safe. Tag text comes from the catalog, never rendered as HTML.
- [x] **X. Simplicity and Incremental Delivery**: this is wave 002 slice 001, as the breakdown
  orders it. The new abstractions have two real uses: `DisplayModel.tags` (Triads now, CAGED
  shape tags in wave 004) and `ChoiceGroup.disabled` (inversion and string-set groups). Both
  failure states keep the "never blank" guidance and now add **See all notes**.
- [x] **Workflow gates**: Conventional Commits; CI typecheck, svelte-check, lint, format,
  coverage, Playwright with axe on two profiles, Lighthouse. ADR 0009 records the shared
  fretboard tag strip and keyed auto-scroll (architecturally significant, R-05/R-06).

## Project Structure

### Documentation (this feature)

```text
specs/006-full-neck-and-all-notes/
├── plan.md              # This file
├── research.md          # Phase 0: R-01 … R-14
├── data-model.md        # Phase 1: chain, view state, display model, fretboard tags
├── quickstart.md        # Phase 1: validation guide
├── contracts/           # Phase 1: deltas against 005 contracts
│   ├── triads-theory-api.md
│   ├── triads-state-api.md
│   ├── fretboard-model.md
│   ├── triads-ui.md
│   └── test-hooks.md
├── checklists/          # from /speckit.specify
└── tasks.md             # Phase 2 output (/speckit.tasks; not created here)
```

### Source Code (repository root)

```text
src/lib/
├── theory/
│   └── triad-shape.ts            # + ChainShape, ChainResult, inversionChain()
├── instrument/
│   ├── instrument.ts             # + lowestPositionOfPitch()
│   └── fixtures.ts               # + AF-8 (Open G), SHORT-7 (7 frets)
├── state/
│   ├── triads-view.ts            # + view field, setView, seeAllNotes, selectShape, resetTriads, guards
│   ├── triads-model.ts           # + chain / all-notes derivation, tags, autoScroll, descriptions, listen steps, tagTarget
│   └── triads.svelte.ts          # + setView, seeAllNotes, selectTag, reset actions
├── fretboard/
│   ├── types.ts                  # + FretboardTag, DisplayModel.tags/autoScroll, FretboardProps.ontag
│   ├── tags.ts                   # NEW: pure layoutTags()
│   ├── interaction.ts            # + groupScrollTarget()
│   └── Fretboard.svelte          # tag strip inside scroller; keyed auto-scroll
├── tools/
│   ├── ChoiceGroup.svelte        # + disabled prop
│   └── triads/
│       ├── TriadsTool.svelte     # wiring: ontag, view, see all notes, reset
│       ├── TriadsControls.svelte # + View group; disabled inversion/set + hint
│       ├── TriadsGuidance.svelte # + See all notes
│       ├── TriadsSecondary.svelte# octave disabled outside Isolated + hint; Reset tool
│       └── CompositionPanel.svelte # name without inversion; hide low-to-high in All notes
├── styles/tokens.css             # + disabled-state tokens if absent
└── app.d.ts (src/)               # + 'AF-8' | 'SHORT-7' in __fmInstrument union
messages/en.json                  # + view, tag, hint, action, description keys
docs/adr/0009-fretboard-tags-and-keyed-auto-scroll.md   # NEW

tests/unit/
├── theory/triad-chain.test.ts, triad-chain.property.test.ts     # NEW
├── state/triads-view.test.ts, triads-model.test.ts, triads-store.test.ts
├── fretboard/tags.test.ts (NEW), interaction.test.ts, fretboard.test.ts
├── instrument/instrument.test.ts
└── triads/choice-group.test.ts, triads-controls.test.ts, triads-guidance.test.ts,
          triads-secondary.test.ts, composition-panel.test.ts, triads-tool.test.ts

e2e/
├── triads-full-neck.spec.ts      # NEW: US1, US3-4, US5
├── triads-all-notes.spec.ts      # NEW: US2, US3-1..3
├── triads-tm9.spec.ts            # + views 6, 9, 14
├── playback.spec.ts              # + US4
└── perf.spec.ts                  # + view switch, tag tap
```

**Structure Decision**: Single SvelteKit project, using the layout the constitution mandates
and that already exists in this repository: `src/lib/{theory,instrument,state,fretboard,tools}`,
`messages/`, `tests/unit/`, `e2e/`, `docs/adr/`. The only new source file is
`src/lib/fretboard/tags.ts`. Everything else extends the 005 modules listed above.

## Phase 0 / Phase 1 outputs

- [research.md](./research.md): R-01 to R-14, each with Decision, Rationale and Alternatives.
- [data-model.md](./data-model.md): `ChainShape`/`ChainResult`, `TriadsView` and the transition
  table, per-view display derivation, `FretboardTag`/`layoutTags`, and the validation rules.
- [contracts/](./contracts/): five delta contracts (theory, state, fretboard model, UI, test
  hooks), each with its test obligations.
- [quickstart.md](./quickstart.md): automated gates, focused runs, a 10-step manual
  walkthrough, fixture-instrument checks, and responsive and accessibility spot checks.
- Agent context: no agent-specific context file is maintained in this repository beyond
  `CLAUDE.md`, and nothing in this plan changes it.

## Complexity Tracking

No constitution violations. The table records the assumptions taken in this headless run, as
the run instructions require.

| Decision | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Add a Triads **Reset tool** button in this slice | FR-019 requires Reset to return the view to Isolated, FR-1.11 requires it in every tool, and 005 did not ship it | A store-only `reset()` leaves FR-019 with no user path and no e2e test |
| Generic `DisplayModel.tags` + `ontag` in the shared fretboard | Principle III forbids tools drawing on the fretboard; tags must scroll with the board | Tool-side overlay synced to `scrollLeft` duplicates geometry in a tool and jitters; SVG tags break the ARIA grid (ADR 0005) |
| Keyed `DisplayModel.autoScroll` | C15 needs "tag tap never scrolls", but the 005 trigger scrolls on every highlight change | A store-set "suppress scroll" flag would make the display model depend on how a state was reached, not on the state itself |
| `ChoiceGroup.disabled` via `aria-disabled` (focusable) | FR-010 says disabled and conveyed to assistive tech, and the reason must be discoverable | Native `disabled` drops focus, so screen-reader users never hear the hint |
