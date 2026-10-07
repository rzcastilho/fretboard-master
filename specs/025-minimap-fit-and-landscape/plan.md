# Implementation Plan: Minimap, Fit to Screen, and Landscape

**Branch**: `feature/025-minimap-fit-and-landscape` | **Date**: 2026-10-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/025-minimap-fit-and-landscape/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Second slice of wave 007 (comfort and launch readiness). A scrolling neck gets a **minimap**
(whole neck in miniature, visible-stretch window, highlighted dots, tap/keys to jump), a
**Fit to screen** toggle and pinch switch between comfortable (≥ 44 px frets, scrolling) and
whole-neck modes, and the tool page gets its finished **responsive arrangements** (narrow,
medium, wide-side, wide-stacked) plus a **phone-landscape** arrangement with an icon-only bar,
a one-row control strip and a non-modal sliding panel. Approach (from [research.md](./research.md)):

- **Fit mode** (R-01–R-03, R-08): session runes store `src/lib/state/fit.svelte.ts` (default
  comfortable, never persisted or linked). The fretboard reports `overflow` (comfortable
  `naturalWidth` > measured zone width) as an event; that single boolean drives both the Fit to
  screen button and the minimap (FR-008), with no feedback loop. Whole mode is a new
  `fit` parameter of the pure `layoutFretboard` (columns compress, rows stay 44 px, markers
  scale). Taps in narrow frets still resolve to the nearest position and raise a one-line
  `Notice` offering comfortable size.
- **Minimap** (R-04, R-05): `Minimap.svelte` child of `Fretboard.svelte`, drawn from layout x so
  mirroring, fret count and text zoom are automatic; `role="slider"` with "Frets {first} to
  {last} of {count}"; pure helpers in `src/lib/fretboard/minimap.ts`.
- **Pinch** (R-06): pure `reducePinch` (two touches, ≥ 20% change, one switch per gesture) fed by
  passive touch events; scroller `touch-action: pan-x pan-y` blocks page zoom only over the
  board.
- **Scroll anchor** (R-07): after any layout change keep highlighted / CAGED-focus groups
  visible, else keep the nut offset; minimap jumps animate except under reduced motion.
- **Arrangement** (R-09): pure `arrangementFor()` in `src/lib/shell/layout.ts` from viewport
  width/height, comfortable neck width (fret count + text zoom) and token chrome; written as
  `data-arrangement` on the tool grid; existing media queries stay as the no-JS fallback.
  1440/24 → wide-stacked (whole neck fits, no Fit to screen); 1440/12 and 2560/24 → wide-side;
  1024/24 → wide-stacked with minimap.
- **Panels without remounting** (R-10, R-11): `SidePanels.svelte` wraps zones E then D
  (`display: contents` normally; fixed trailing panel in landscape, Escape/close/opener, focus
  return, no trap). `ContextZone.svelte` collapses zone D to a one-line summary on narrow;
  summaries are display-model strings built with `src/lib/notation`.
- **CSS-only parts** (R-12, R-13): zone B two rows with per-row scroll strips and an edge-fade
  cue; landscape strip; icon-only bar with tooltip labels that stay the accessible names.
- **Budget** (R-14): ≈ 6–7 KB JS gzip against ≈ 0.1 KB headroom → measure first, trim (icon
  sprite in HTML), then a planned Principle VI amendment 1.9.0 → 1.10.0 (≤ 136 KB).
- The CAGED rotate hint (slice 016) is untouched and regression-tested in landscape (R-15).

## Technical Context

**Language/Version**: TypeScript 5.9 (`strict: true`), Svelte 5 runes, SvelteKit 2 with `adapter-static` (single bundle, ADR 0002)

**Primary Dependencies**: existing only — Paraglide JS (catalog), Valibot (unchanged, untouched), `@axe-core/playwright` and `@testing-library/svelte` (dev). No new runtime or dev dependency.

**Storage**: N/A — fit mode, context-panel expansion and sliding-panel state are in-memory session state; no `localStorage` key, preference field or share-link field is added

**Testing**: Vitest (node for pure modules, jsdom for components) + fast-check not needed (no theory); Playwright `desktop` locally via `pnpm test:e2e:fast`, full matrix (phone 360, phone-touch, desktop, Firefox/WebKit smoke, nojs) in CI; CDP touch for pinch; `page.addInitScript` root font 200% for text zoom; `@axe-core/playwright`

**Target Platform**: evergreen browsers (last two majors), desktop and mobile, 320–2560 CSS px, portrait and phone landscape

**Project Type**: static single-page web app (SvelteKit, prerendered, one JS bundle)

**Performance Goals**: tool switch ≤ 300 ms and control → fretboard ≤ 100 ms unchanged; smooth scrolling at 7 strings × 24 frets with the minimap visible (scroll handler rAF-throttled, writes only the window transform and slider value)

**Constraints**: initial JS ≤ 128 KB gzip today with ≈ 0.1 KB headroom (planned amendment to 136 KB, R-14); WCAG 2.2 AA (44×44 targets in comfortable mode, keyboard, no traps); tokens only; fretboard never covered except by the user-opened landscape panel over at most 50% width; only the fretboard scrolls the page horizontally; no free zoom; page zoom never disabled; all text in en/pt-BR/es; handedness read only inside geometry (`presentation-boundary.test.ts`)

**Scale/Scope**: 3 tools; 5 arrangements; ≈ 16 new catalog keys × 3 locales; 4 new pure modules (`minimap.ts`, `pinch.ts`, `layout.ts`, `context-summary.ts`), 3 new stores, 6 new components (`Minimap`, `FitToggle`, `FitNotice`, `SidePanels`, `ContextZone`, icons in bar items), ~12 edited components; 4 new e2e specs, ~4 edited

All Technical Context items are resolved in research.md; no open unknowns remain.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Pre-research and post-design results are the same; post-design notes are folded into each line.

- [x] **I. Musical Correctness** — No theory code changes; summaries reuse each tool's existing computed spellings via `src/lib/notation` (Triads "C♯ – E – A" test with sharps; solfège variant tested). Theory suites keep gating.
- [x] **II. On-Device, Static, Private** — All logic client-side; no network, no storage writes, no permissions (touch events need none), no third-party code.
- [x] **III. Pure Core, Thin Shell** — `src/lib/theory` untouched. Geometry, minimap, pinch and arrangement logic are pure modules outside theory. The fretboard reports only musical/boolean events (`overflow`, `request`, `small-tap` with a `Position`), never coordinates. Handedness stays inside `geometry.ts`; the minimap draws from layout x and `layout.ts` uses the handedness-independent `naturalWidth` (`presentation-boundary.test.ts` stays green). Tools only render `FitToggle`/`FitNotice` and wrap zones; they do not draw the board.
- [x] **IV. Test-First / Tested Behavior** — Pure modules and stores built test-first (geometry whole mode, minimap, pinch, layout table, summaries, fit store). Every acceptance scenario US1–US5 maps to a Vitest or Playwright test ([quickstart.md](./quickstart.md) §3). Deterministic: no timers in logic; reduced-motion makes jumps instant in e2e.
- [x] **V. Accessible by Default** — Minimap is a keyboard-operable labelled slider; Fit to screen uses `aria-pressed`; panels use `aria-expanded`/`aria-controls`; sliding panel non-modal with Escape and focus return, no trap; comfortable mode keeps 44×44 targets (whole mode is opt-in and offers the way back); window vs dots differ by shape/size; icon-only bar keeps accessible names; reduced motion honoured; axe matrix extended to every new state.
- [x] **VI. Performance Budgets** — Timing budgets unaffected (layout derivations are O(frets); scroll handler rAF-throttled). Bundle: est. +6–7 KB vs ≈ 0.1 KB headroom → **expected violation of the 128 KB gate**, handled by the amendment procedure (measure → trim → MINOR amendment to 136 KB in this PR), recorded in Complexity Tracking. No lazy chunks (ADR 0002).
- [x] **VII. Design System Fidelity** — Fretboard stays protagonist; controls never cover it except the user-opened landscape panel (≤ 50% width, non-modal, uncovered board interactive — design §5.3 sliding panel). Main controls never behind a menu (strips scroll instead). Notice is non-blocking, one line, dismissible, no error red. New visual values as tokens (`--minimap-row`, `--minimap-dot`, `--side-panel-max`, edge-fade width). Every function works 320–2560; only the fretboard scrolls the page horizontally (e2e check). Emphasis levels unchanged; minimap draws only "highlighted".
- [x] **VIII. International** — ≈ 16 new keys in en/pt-BR/es (catalog parity test); summary separators are catalog messages; note names only from `src/lib/notation` with ♯ ♭ 𝄪 𝄫; 200% text-zoom e2e for every arrangement; `no-raw-text` covers new components.
- [x] **IX. Untrusted Input, Versioned Formats** — N/A: no share-link or preference format change (fit mode deliberately session-only); nothing input-derived is rendered as HTML.
- [x] **X. Simplicity, Incremental Delivery** — Follows breakdown wave 007 item 002. No new dependency. New shared components each have three real uses (one per tool); no speculative configuration (no stored fit preference, no free zoom, no drag on the minimap). Fallback: an unavailable mode adopts comfortable silently because nothing is lost (the neck is whole at comfortable size).

**Gate result**: PASS with one recorded, justified item (Principle VI bundle cap, see Complexity Tracking).

## Project Structure

### Documentation (this feature)

```text
specs/025-minimap-fit-and-landscape/
├── plan.md              # This file
├── research.md          # Phase 0 (R-01 … R-16)
├── data-model.md        # Phase 1: fit store, layout fields, minimap, pinch, arrangement, panels, catalog keys
├── quickstart.md        # Phase 1: run, targeted verification, scenario → test map
├── contracts/
│   ├── pure-api.md      # pure module and store signatures + required cases
│   └── ui.md            # DOM/ARIA/behaviour contracts per component and arrangement
├── checklists/          # from /speckit.specify
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
src/lib/fretboard/
├── Fretboard.svelte        # EDIT: fit + onfit props, overflow/small-tap events, touch pinch, anchor rule, renders <Minimap>, marker scale, touch-action pan-x pan-y
├── Minimap.svelte          # NEW: slider + SVG (window, highlighted dots), tap/keys
├── minimap.ts              # NEW: visibleFretRange, minimapWindow, minimapTapScroll, minimapKeyScroll
├── pinch.ts                # NEW: reducePinch
├── geometry.ts             # EDIT: FitMode, fit param, naturalWidth, markerScale
└── types.ts                # EDIT: FitEvent, FretboardProps.fit/onfit
src/lib/state/
├── fit.svelte.ts           # NEW: session fit store
├── viewport.svelte.ts      # NEW: width/height/rootPx + derived arrangement
├── context-panel.svelte.ts # NEW: session expanded flag
├── context-summary.ts      # NEW: joinSummary, joinNotes
├── triads-view.ts          # EDIT: display.summary
├── caged-view.ts           # EDIT: display.summary
└── notes-view.ts           # EDIT: display.summary
src/lib/shell/
├── layout.ts               # NEW: isPhoneLandscape, wideLeftColumn, arrangementFor
├── ToolLayout.svelte       # EDIT: data-arrangement, data-landscape, h1 visually hidden in landscape
└── AppNav.svelte, ShareButton.svelte, InstrumentButton.svelte, NotationToggle.svelte, LanguagePanel.svelte  # EDIT: icon + .bar-label
src/lib/tools/
├── FitToggle.svelte        # NEW
├── FitNotice.svelte        # NEW (wraps shell Notice)
├── SidePanels.svelte       # NEW (zones E + D, landscape sliding panel)
├── ContextZone.svelte      # NEW (narrow collapsed summary)
├── overflow.ts             # NEW: Svelte action setting data-overflow on scroll rows
├── notes/NotesTool.svelte, triads/TriadsTool.svelte, caged/CagedTool.svelte  # EDIT: wire fit, wrap E/D, ContextZone, FitNotice
└── triads/TriadsControls.svelte, caged/CagedControls.svelte, NoteSelector.svelte  # EDIT: two .controls-row groups
src/lib/styles/
├── tokens.css              # EDIT: [data-arrangement] grid tokens, minimap/panel/fade tokens (media queries kept as fallback)
└── global.css              # EDIT: .controls-row, .bar-label tooltip, landscape visually-hidden headings
src/app.html                # EDIT (only if R-14 trimming needs it): inline SVG <symbol> icon sprite
messages/{en,pt-BR,es}.json # EDIT: keys in data-model §8
tests/unit/
├── fretboard/{geometry,minimap,pinch,minimap-component,fretboard}.test.ts  # NEW/EDIT
├── state/{fit,context-summary}.test.ts                                     # NEW
├── triads/, caged/, notes/  # EDIT: summary expectations
└── layout.test.ts, fit-toggle.test.ts, side-panels.test.ts, context-zone.test.ts, tool-layout.test.ts  # NEW/EDIT
e2e/
├── minimap-fit.spec.ts       # NEW: US1, US2 (except pinch)
├── responsive-layout.spec.ts # NEW: US3, arrangement screenshots, no page h-scroll
├── landscape.spec.ts         # NEW: US4, rotate-hint regression
├── text-zoom.spec.ts         # NEW: US5
└── fretboard-touch.spec.ts, a11y-audit.spec.ts, nojs.spec.ts, caged.spec.ts  # EDIT: pinch, new axe targets, fallback, zone order
.specify/memory/constitution.md, scripts/check-bundle-size.mjs, docs/adr/0002-*.md  # EDIT only if the measured bundle exceeds 128 KB after trimming (R-14)
docs/adr/0023-fit-mode-and-adaptive-arrangement.md  # NEW: fit mode as fretboard event + JS-computed arrangement
```

**Structure Decision**: Single SvelteKit project at the repository root (existing layout from
the constitution's source-layout rule). Renderer-side logic (whole-mode geometry, minimap,
pinch) goes in the existing `src/lib/fretboard/`; session stores and summary helpers in
`src/lib/state/`; the arrangement rule next to `ToolLayout` in `src/lib/shell/`; components
shared by the three tools in `src/lib/tools/` (where `ChoiceGroup` and `NoteSelector` already
live); tokens and global CSS in `src/lib/styles/`; catalogs in `messages/`; unit tests in
`tests/unit/` (existing `fretboard/` and `state/` subfolders, shell/tool component tests flat
as today); e2e in `e2e/`; the ADR in `docs/adr/`. All of these directories exist today.

## Phase overview (for /speckit-tasks)

1. **Setup**: measure bundle baseline (R-14); add catalog keys (en/pt-BR/es) and tokens.
2. **Foundations (test-first, blocking)**: `geometry` fit/naturalWidth/markerScale;
   `minimap.ts`; `pinch.ts`; `layout.ts`; `fit.svelte.ts`; `viewport.svelte.ts`.
3. **US1 minimap (P1)**: `Minimap.svelte` in `Fretboard.svelte`, overflow event, scroll sync,
   keys, mirroring; wire `onfit` in the three tools; `e2e/minimap-fit.spec.ts` US1 cases.
4. **US2 fit + pinch (P1)**: whole-mode rendering, `FitToggle` in zone E, anchor rule, pinch,
   small-fret `FitNotice`; e2e US2 + `fretboard-touch` pinch.
5. **US3 responsive (P2)**: `data-arrangement` + grid tokens, `SidePanels` (E then D order),
   `ContextZone` + summaries, zone B rows/strips; `e2e/responsive-layout.spec.ts` + screenshots.
6. **US4 landscape (P2)**: landscape arrangement, sliding panel behaviour, icon-only bar with
   tooltips, hidden headings; `e2e/landscape.spec.ts` incl. rotate-hint regression.
7. **US5 200% text (P3)**: `e2e/text-zoom.spec.ts`; fix any wrap/clip found.
8. **Polish**: axe targets, ADR 0023, bundle measure → trim → amendment if still > 128 KB,
   `pnpm verify` once.

## Risks and mitigations

- **Bundle over 128 KB** (near certain): see R-14 and Complexity Tracking.
- **`presentation-boundary.test.ts` regex** flags `orientation:` in `src/` files: landscape
  detection is in JS (`isPhoneLandscape`), and no Svelte `<style>` may use `@media
  (orientation: …)`; the media-query fallback for landscape is not needed (no-JS keeps the
  portrait arrangements).
- **7-string board taller than a 390 px landscape viewport** (bar + strip + 7 × 44 + numbers +
  minimap > 390): rows stay 44 px (touch target); the page may scroll vertically, never
  horizontally. Recorded as an assumption.
- **Existing e2e selectors relying on DOM order of zones D/E** (CAGED renders E before D today,
  Notes/Triads D before E): `SidePanels` normalises to E then D; affected specs are updated in
  the US3 phase.
- **Synthetic touch in local desktop runs**: pinch e2e lives in `fretboard-touch.spec.ts`
  (phone-touch, CI); local coverage comes from the pure reducer tests.

## Complexity Tracking

| Violation / assumption | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| **Principle VI**: initial JS expected ≈ 134 KB > 128 KB gzip; planned MINOR amendment 1.9.0 → 1.10.0 (≤ 136 KB) with Sync Impact Report, `check-bundle-size.mjs` and ADR 0002 history, applied only if the measured size after trimming still exceeds 128 KB | Spec-required behaviour (minimap, fit, pinch, five arrangements, sliding panel, summaries, icon bar) with ≈ 0.1 KB headroom left by slice 024 | Lazy-loading violates ADR 0002 version continuity; cutting features fails FR-001–FR-024; CSS-only work is already maximised (CSS is not counted) |
| **Assumption**: fit "fits" is measured by the fretboard and reported upward as an event (R-02) | Exact match between the button/minimap and the real scrolling state | Viewport formula can disagree by a few px and show a scrolling board without minimap |
| **Assumption**: wide-side/wide-stacked use a JS-computed `data-arrangement`; media queries remain as no-JS fallback (R-09) | Arrangement depends on fret count and text zoom, which CSS cannot read | Container queries cannot see fret count; measuring the grid creates a feedback loop |
| **Assumption**: whole mode omits marker labels when markers shrink below 75% (R-03) | Labels cannot fit in ~11 px columns at 320 px; shape still carries function, description unchanged | Overlapping labels would be unreadable; keeping full-size markers overlaps neighbours |
| **Assumption**: landscape rows stay 44 px; a 7-string board may scroll the page vertically at 390 px height | Constitution 44×44 touch targets in comfortable mode | Shrinking rows would break the touch-target rule |
| **Assumption**: Panels opener sits in DOM after zone C (visually beside the strip) | Keeps E and D inside one wrapper without moving nodes | Placing it inside zone B would require each tool's controls to render a shell button |
| **Assumption**: pinch thresholds ratio ≤ 0.8 (in) / ≥ 1.25 (out) | "≥ 20% change" symmetric in both directions; one switch per gesture | A single ±20% linear band makes "out" easier than "in" |
