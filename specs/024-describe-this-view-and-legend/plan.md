# Implementation Plan: Describe This View, Legend, and Accessibility Audit

**Branch**: `feature/024-describe-this-view-and-legend` | **Date**: 2026-10-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/024-describe-this-view-and-legend/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

First slice of wave 007 (comfort and launch readiness). Every fretboard view gets a text
equivalent behind a **Describe this view** button, a **Legend** that lists exactly the marker
kinds drawn, and the app passes a WCAG 2.2 AA audit. Approach (from [research.md](./research.md)):

- **One description path** (R-01–R-04): keep `model.description ?? describeView()`; realign the
  Triads single-shape summary to the exact FR-003 sentence ("A major, first inversion, strings
  4, 3, and 2: string 4, fret 11, C sharp, third; …") with catalog list conjunctions, add note
  names to CAGED entries, sort all entries string-descending/fret-ascending, never empty.
- **Debounced announcement** (R-05): new pure `createAnnouncer` with an injectable timer, 500 ms
  trailing debounce, nothing on first render, tested with Vitest fake timers and Playwright
  `page.clock`. The visible panel updates immediately.
- **ViewAids component** (R-06, R-09): extract toggle, panel and live region out of
  `Fretboard.svelte` (1,427 lines) into `ViewAids.svelte`; add the **Legend** disclosure
  (non-modal, Escape closes and returns focus, no trap, state not persisted).
- **Legend from the display model** (R-07, R-08): pure `legendKinds/legendGroups(model)`; a kind
  is shown iff a marker at highlighted/normal/dimmed draws it. `DisplayModel` gains optional
  `wideStretch` and `legendGroups` (CAGED groups Chord / Arpeggio / Pentatonic / Scale / Triad).
  Samples via extended `MarkerSample.svelte`.
- **Audit fixes found while planning (measured)**: the position focus ring is 1.00:1 against the
  third fill (ring colour = third colour) → two-tone ring with new tokens (R-10, min 4.75:1
  light / 6.22:1 dark). Fifth colour fails the ΔE00 ≥ 10 colour-blind check in 3 cases (light
  protan root/fifth 9.4, dark deutan root/fifth 6.3, dark tritan third/fifth 8.7) → adjust
  `--color-fifth` tokens only (R-11), regenerate affected baselines.
- **Audit** (R-12–R-14): desktop-only axe matrix (7 targets × 2 themes × 3 languages × panel
  states), keyboard-only e2e, CVD simulation e2e, sound→visible inventory, and
  `docs/accessibility-audit.md` per WCAG 2.2 A/AA criterion.

## Technical Context

**Language/Version**: TypeScript 5 (`strict: true`), Svelte 5 runes, SvelteKit `adapter-static`

**Primary Dependencies**: existing only — Paraglide JS (catalog), Valibot (unchanged), `@axe-core/playwright` (dev). No new runtime dependency.

**Storage**: N/A — panel open state is component-local; no preference or share-link field changes

**Testing**: Vitest + @testing-library/svelte (units, components, token checks), Playwright desktop locally / full matrix in CI, `@axe-core/playwright`, `page.clock` for debounce

**Target Platform**: evergreen browsers (last two majors), desktop and mobile, 320–2560 CSS px

**Project Type**: static single-page web app (SvelteKit, prerendered)

**Performance Goals**: control → fretboard update ≤ 100 ms unchanged (description is a derived string; announcement is deferred, off the render path); announcement ≤ 1 s after settling (500 ms debounce)

**Constraints**: initial JS ≤ 128 KB gzip (≈ 4 KB headroom after 023; this slice est. +3–4 KB, R-15); WCAG 2.2 AA; tokens only; no overlay over the fretboard; all strings in en/pt-BR/es

**Scale/Scope**: 3 tools + home, about, not-found, shared link; ≈ 35 new/changed catalog keys × 3 locales; 3 new pure modules, 1 new component, ~4 new e2e specs, ~8 edited e2e specs, 1 audit document

All items resolved in research.md; no open unknowns.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Pre-research and post-design results are the same; the post-design notes are folded into each line.

- [x] **I. Musical Correctness** — Description note names come from existing spellings (`marker.spelling`, `spokenNote`); no theory code changes. Triads entries reuse the model's computed `positions`/`spelling`; table tests for A major 1st inversion and double-sharp spelling added. Theory suites still gate.
- [x] **II. On-Device, Static, Private** — Pure client-side strings and SVG; no network, storage, permissions or trackers added.
- [x] **III. Pure Core, Thin Shell** — Flow stays control → view state → display model → render. `legend.ts`, `announce.ts`, `description.ts` live in `src/lib/fretboard`, not `src/lib/theory`; ordering never reads handedness/orientation (renderer-only). Tools do not draw the Legend; the fretboard derives it from the model.
- [x] **IV. Test-First / Tested Behavior** — Pure modules built test-first (description, legend, announcer, token contrast/CVD checks). Every acceptance scenario US1–US6 maps to a Playwright or Vitest test ([quickstart.md](./quickstart.md) §2). Debounce tested via injectable timer / `page.clock` (deterministic).
- [x] **V. Accessible by Default** — This slice is the principle's audit: text description + polite announcement, Legend, keyboard-only e2e, two-tone focus ring ≥ 3:1, colour-independence check, zero-violation axe matrix in CI.
- [x] **VI. Performance Budgets** — No timing budget touched (description already derived; announcer off render path). Bundle est. +3–4 KB within ≈ 4 KB headroom; measured after the Legend task; trim before any amendment (R-15). No amendment planned.
- [x] **VII. Design System Fidelity** — Panels non-modal, below the board, never cover it; function shapes unchanged; root/third/fifth tokens only used in `Fretboard.svelte` and `MarkerSample.svelte` (reserved-colors test); pre-existing reuse of the third colour by `--color-accent`/`--color-focus-ring` fixed in this slice and guarded by a value-equality check in the reserved-colors test (no other token may equal root/third/fifth); colour fixes via tokens only; new ring tokens; hard-coded `6px` radius and `var(--space-2, 0.5rem)` fallbacks in the old toggle replaced with tokens; no animation.
- [x] **VIII. International** — All new text in `messages/{en,pt-BR,es}.json`; list conjunctions are catalog keys (no `Intl.ListFormat` logic per language); note names only via `src/lib/notation`; `no-raw-text` test covers the new component.
- [x] **IX. Untrusted Input, Versioned Formats** — N/A: no change to share-link or preference formats; description renders as text (no `{@html}`), built from catalog phrases only.
- [x] **X. Simplicity, Incremental Delivery** — Extends the existing description path; no new runtime dependency; grouping is optional model data (one real user, CAGED) rather than a new abstraction; `ViewAids` extraction is justified by two features sharing one area (description + Legend).

**Gate result**: PASS — no violations; Complexity Tracking lists only assumptions.

## Project Structure

### Documentation (this feature)

```text
specs/024-describe-this-view-and-legend/
├── plan.md              # This file
├── research.md          # Phase 0 (R-01 … R-16)
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── view-aids-ui.md            # DOM/ARIA/behaviour + message keys
│   └── description-legend-api.md  # pure module signatures + legend fixtures
├── checklists/          # from /speckit.specify
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
src/lib/fretboard/
├── Fretboard.svelte        # EDIT: render <ViewAids>; two-tone focus ring; drop old toggle/live region
├── ViewAids.svelte         # NEW: Describe this view + Legend buttons, panels, live region
├── LegendPanel.svelte      # NEW: list/grouped entries with MarkerSample + text
├── MarkerSample.svelte     # EDIT: emphasis/tone/variant/ring props
├── description.ts          # EDIT: spokenList, describeEntries, empty rule
├── legend.ts               # NEW: LegendKind, legendKinds, legendGroups
├── announce.ts             # NEW: createAnnouncer (500 ms trailing debounce)
└── types.ts                # EDIT: DisplayModel.wideStretch, legendGroups
src/lib/state/
├── triads-model.ts         # EDIT: FR-003 summary + entries, wideStretch
├── caged-model.ts          # EDIT: note names in entries, order, legendGroups
└── notes-model.ts          # EDIT: empty-view first action
src/lib/styles/tokens.css   # EDIT: --color-focus-ring-outer/-inner, --color-focus-ring, --color-accent, --color-fifth (light, dark)
messages/{en,pt-BR,es}.json # EDIT: new/changed keys (contracts/view-aids-ui.md)
tests/unit/fretboard/       # description, legend, announce, view-aids, fretboard (edited)
tests/unit/a11y/            # NEW: color.ts helper, palette-cvd.test.ts, focus-ring.test.ts
tests/unit/caged/, tests/unit/notes/   # model description expectations (edited)
e2e/
├── view-aids.spec.ts       # NEW: US1–US3, SC-008
├── a11y-keyboard.spec.ts   # NEW: US4
├── a11y-audit.spec.ts      # NEW: US6 axe matrix + sound/visible (desktop only)
├── a11y-colour.spec.ts     # NEW: US5 simulation + DOM shape check
└── {fretboard,triads,caged-layers,caged-triad,languages,notation,instrument-panel,open-link}.spec.ts  # EDIT: relabel + debounce
docs/accessibility-audit.md # NEW: audit record (FR-026)
```

**Structure Decision**: Single SvelteKit project at the repository root. New UI and pure logic
go in the existing `src/lib/fretboard/` module (the description and marker samples already live
there); tool-specific description content stays in `src/lib/state/*-model.ts`; tokens in
`src/lib/styles/tokens.css`; catalogs in `messages/`; unit tests under `tests/unit/` (new
`tests/unit/a11y/` folder), e2e under `e2e/`, audit record under `docs/`. All of these
directories exist today except `tests/unit/a11y/`, created by this slice.

## Phase overview (for /speckit-tasks)

1. **Foundations (test-first)**: `announce.ts`, `legend.ts`, `description.ts` helpers, tokens
   checks (CVD + ring) failing first, then token changes.
2. **US1 description**: Triads/CAGED/Notes model realignments + catalog keys; `ViewAids` with
   **Describe this view**; update unit/e2e expectations for the relabel.
3. **US2 announcement**: wire announcer; update existing live-region tests to fake time.
4. **US3 Legend**: `MarkerSample` props, `LegendPanel`, `wideStretch`/`legendGroups` in models;
   bundle-size check.
5. **US4/US5 keyboard + colour**: two-tone ring, keyboard e2e, CVD e2e, screenshot baselines.
6. **US6 audit**: axe matrix spec, sound inventory, manual checklist, `docs/accessibility-audit.md`.
7. `pnpm verify` once.

## Complexity Tracking

No constitution violations. Assumptions and rejected alternatives recorded for reviewers:

| Assumption / decision | Why | Rejected alternative |
|---|---|---|
| `--color-fifth` changes in both themes (candidates light `#188450`, dark `#94ecbc`; final values fixed by the CVD test) | Measured ΔE00 < 10 in three simulation/theme cases; spec says fix via tokens | Changing root or third — root/third pairs already pass with large margins; moving the fifth touches fewest pairs |
| Two-tone focus ring with new tokens | Single ring colour cannot reach 3:1 against both light wood/white neutral and mid-dark fills; current ring equals the third fill (1.00:1) | Thicker single ring; ring outside the cell (cells abut, neighbours sit beneath) |
| Generic `--color-focus-ring`/`--color-accent` equal `--color-third` (light `#0b5cad`; dark accent `#7ab4f0`) — pre-existing C-VII reuse, **fixed in this slice** (T027, T029) | C-VII forbids reusing root/third/fifth for any other purpose. `--color-focus-ring` becomes the neutral outer ring colour (light `#1a1d21`, dark `#ffffff`); `--color-accent` stays in the existing accent hue family (octave-tone ramp) but darker/lighter so it is not equal to and ΔE00 ≥ 10 from every reserved colour in the same theme (candidates light `#13466a`, dark `#a8d2f0`; final values fixed by the test), with `--color-accent-text` ≥ 4.5:1. `reserved-colors.test.ts` rejects any non-marker token whose value equals a reserved colour | Deferring to 007/003 — leaves a constitution violation in the merged slice; re-hueing the accent to a new hue — a redesign beyond this slice |
| Announcement is the full description, no truncation, 500 ms trailing debounce | Spec clarification; users stop long readouts with the reader's stop key | "Summary + count" announcement — contradicts breakdown |
| Grouped Legend only in CAGED via optional `legendGroups` | FR-016 requires groups there only; YAGNI elsewhere | Group metadata for every tool |
| Axe matrix runs on `desktop` only | Spec default; phone already runs axe in existing specs; bounds CI time (42 loads) | Full matrix on every project |
| Bundle stays under 128 KB without amendment | Est. +3–4 KB vs ≈ 4 KB headroom; trimming first if over | Pre-emptive budget amendment |
