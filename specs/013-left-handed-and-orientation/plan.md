# Implementation Plan: Left-Handed Mode and String Orientation

**Branch**: `feature/013-left-handed-and-orientation` | **Date**: 2026-10-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-left-handed-and-orientation/spec.md`

## Summary

Give effect to the two presentation fields the `Instrument` model has carried since slice 002
(`handedness`, `orientation`). The instrument panel gains two radio groups — **Handedness**
(Right / Left) and **Strings on top** (Highest / Lowest) — edited as pending state with the
existing confirm/discard/preview flow; `InstrumentConfig` gains both fields, Restore default
resets them, and they are remembered as two optional v1 preference fields written only when
non-default.

Drawing changes live in one place: `screenOrder` (identity until now) becomes the real mapping,
and the pure `layoutFretboard` mirrors **layout coordinates** (`x ↦ width − x`, columns still
indexed by fret) and reorders rows. Every directional element — label column, open column, nut,
fret lines and numbers, inlays, region band, tags and their order, comparison arrows, focus
ring, hover hint, hit-testing, arrow-key navigation — already derives from the layout, so it
follows automatically; the few spots in `Fretboard.svelte` that assumed "label column at x = 0"
or indexed rows by `string − 1` switch to new layout fields / `rowOf`. Orientation also picks
the edges: tags above + numbers below for highest-on-top, the reverse for lowest-on-top.
Horizontal scrolling is expressed as a nut-relative offset so an unscrolled left-handed board
starts at the nut, every existing auto-scroll rule mirrors, and switching keeps the same frets
in view. A presentation-only confirm re-renders without stopping sound, changing view state or
raising the adjustment notice. Screen-reader order (cells in fret order, nut → body) and every
announced text are identical in all four combinations. TM-9 view 22 (view 6 left-handed)
becomes a screenshot fixture. Technical approach and alternatives: [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5 (`strict: true`), Node via mise (`mise.toml`)

**Primary Dependencies**: Svelte 5 (runes) + SvelteKit `adapter-static`, Paraglide JS, Valibot
(all existing; **no new dependency**)

**Storage**: `localStorage` key `fretboard-master:prefs`, v1 record + optional `handedness` /
`orientation` ([contracts/storage-format.md](./contracts/storage-format.md))

**Testing**: Vitest + fast-check (geometry tables, transitions, prefs fixtures/properties,
components); Playwright + @axe-core/playwright (phone 360 px, 320 px case, desktop, 2560 px);
TM-9 view 22 screenshot fixture

**Target Platform**: Evergreen browsers (last two majors), desktop and mobile; static hosting on
Cloudflare Pages

**Project Type**: Static single-page web application (SvelteKit, prerendered)

**Performance Goals**: setting switch → fretboard updated ≤ 100 ms (SC-006); instrument change
≤ 300 ms; smooth scroll with 7 strings × 24 frets in all four combinations (Constitution VI)

**Constraints**: initial JS ≤ 90 KB gzip (constitution 1.4.0; measured +1.3 KB, R-14); fully offline;
320–2560 px with only the fretboard scrolling; 200 % text zoom; WCAG 2.2 AA; default
(right / highest-top) rendering and stored bytes unchanged from slice 012

**Scale/Scope**: 2 × 2 combinations; ≤ 7 × 25 = 175 cells; ~10 source modules touched, 2 new
radio groups, ~8 catalog messages (2 changed), 5 fixture records, 1 new E2E spec, 1 ADR

No open clarification item remained after the spec's Clarifications session; Phase 0 resolved design
questions R-01 … R-15.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Pre-research result: **PASS**. Post-design re-check (after data-model and contracts): **PASS**,
no violations (Complexity Tracking lists assumptions and one spec/repo discrepancy only).

**I. Musical Correctness**

- [x] Notes/pitches match the theory reference — no theory code changes; property test asserts
  the same `(string, fret)` set and pitches in all four combinations (data-model §4 inv. 4,
  SC-002).
- [x] Spelling rules — N/A: spelling is untouched; labels come from the same `notation` calls
  in every combination.
- [x] Shapes from configured tuning — N/A: Triads shapes are computed from the musical
  instrument fields, which `withPresentation` never alters (contracts/orientation-api §1).
- [x] Theory merge gate — N/A: no file in `src/lib/theory` changes; existing TM suites run
  unchanged.
- [x] Each note sounds at its pitch — US2-2 test: top string under lowest-on-top plays E2 and
  reports 6:0 (FR-008).

**II. On-Device, Static, Private**

- [x] Everything stays in the browser; the only persisted data is two optional fields in the
  existing erasable preferences record; no network, accounts or permissions.

**III. Pure Core, Thin Shell**

- [x] Handedness/orientation applied only in the fretboard renderer: `screenOrder` /
  `layoutFretboard` (pure) are the single read point; tools pass the instrument through
  untouched (R-08).
- [x] Theory boundary: ESLint rule already forbids presentation concepts in `src/lib/theory`;
  a new boundary unit test enforces the read allow-list app-wide (contracts/orientation-api §7).
- [x] Events in musical terms: `onactivate` still receives `{string, fret}` from
  `nearestPosition` over a mirrored layout (FR-008).
- [x] One-way flow unchanged: panel → `InstrumentConfig` → `Instrument` → display model →
  renderer; view state stays in stores and never sees either setting.

**IV. Test-First for Logic, Tested Behavior for UI**

- [x] Geometry, interaction, instrument-config and prefs changes are written test-first
  (contracts/orientation-api §1–§6 list the tests).
- [x] Every acceptance scenario mapped to an automated test (quickstart §3, Q1–Q26).
- [x] TM-9 view 22 becomes a Playwright screenshot fixture (FR-020).
- [x] Deterministic: audio asserted through the existing audio log hook; scroll checked by
  numeric `scrollLeft`, reduced motion → no animation.

**V. Accessible by Default**

- [x] Keyboard: arrows follow the drawn direction via `moveFocus`/`screenOrder`; new controls
  are native radios; focus ring drawn from the layout.
- [x] Reading order nut → body in both handedness modes; identical names/descriptions; no
  "left"/"right" in announcements (R-05, FR-009).
- [x] No info by color alone: mirrored view keeps shapes, dashed outlines, arrows; axe zero
  violations in all four combinations (SC-007); targets ≥ 44 px; reduced motion: switching is a
  redraw only.

**VI. Performance Budgets Are Gates**

- [x] Perf suite adds "switch handedness/orientation ≤ 100 ms" and a left-handed 7 × 24 scroll
  case; bundle check stays a hard gate (estimate < 0.6 KB, R-14).

**VII. Design System Fidelity**

- [x] No new visual values: geometry reuses existing `--fb-*` tokens; panel radios reuse the
  Strings-group styles; fretboard never covered; works 320–2560 px with only the board
  scrolling.
- [x] Motion: switching never animates; existing auto-scroll durations reused (mirrored).

**VIII. International From the First Line**

- [x] All new text in the message catalog (contracts/instrument-panel-ui §2); summary uses a
  `{handedness}` parameter instead of hard-coded "right-handed"; layouts wrap at 200 % zoom.
  Only `en` ships today — see Complexity Tracking.

**IX. Untrusted Input, Versioned Formats**

- [x] Both fields parsed with Valibot picklists with independent fallback, never throwing;
  `version` stays 1 under the documented extension rule; 5 fixtures added, none removed.
- [x] Share links: N/A — no link codec exists yet, and FR-013 forbids these fields in links.

**X. Simplicity and Incremental Delivery**

- [x] Vertical slice in wave order (breakdown 003-your-instrument/005); no new abstraction —
  two fields on existing types, one mapping function made real; no new dependency.
- [x] "Never blank; adjust and tell": N/A — presentation can never make a view impossible, so no
  adjustment notice is raised (FR-017).

**Workflow gates**

- [x] ADR planned: `docs/adr/0016-handedness-and-orientation-in-layout.md` (amends 0005, 0009,
  0012) — R-15.
- [x] Conventional Commits, PR to `main`, CI merge gate unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/013-left-handed-and-orientation/
├── plan.md              # This file
├── research.md          # Phase 0: R-01 … R-15
├── data-model.md        # Phase 1: types, config/transitions, layout fields, prefs fields
├── quickstart.md        # Phase 1: validation commands and scenarios Q1–Q26
├── contracts/
│   ├── instrument-panel-ui.md   # panel groups, messages, fretboard surface rules
│   ├── orientation-api.md       # internal module signatures + required tests
│   └── storage-format.md        # handedness/orientation fields, reader/writer rules, fixtures
├── checklists/          # from /speckit.specify
└── tasks.md             # Phase 2 (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
src/lib/
├── instrument/instrument.ts           # Handedness/Orientation aliases, withPresentation
├── fretboard/
│   ├── geometry.ts                    # screenOrder real; mirrored layout; rowOf; numbersEdge
│   ├── interaction.ts                 # nut-relative scroll helpers; spanTarget nut-side align
│   └── Fretboard.svelte               # layout fields instead of x=0 assumptions; rowOf; tag
│                                      #   strip before/after svg; anchor-scroll effect
├── state/
│   ├── instrument-config.ts           # fields, setHandedness/setOrientation, equalsMusical
│   ├── instrument.svelte.ts           # setters; presentation-only confirm path; remember
│   └── preferences.svelte.ts          # restore/erase pass both fields
├── prefs/schema.ts                    # two optional fields, writer omits defaults
└── shell/
    ├── InstrumentPanel.svelte         # Handedness + Strings-on-top radio groups
    └── InstrumentSummary.svelte       # {handedness} segment

messages/en.json                       # 8 keys added, 2 summaries parameterized
docs/adr/0016-handedness-and-orientation-in-layout.md

tests/unit/
├── fretboard/{geometry,interaction,fretboard}.test.ts
├── instrument/instrument.test.ts
├── state/{instrument-config,instrument-store,preferences-store}.test.ts
├── prefs/schema.test.ts + prefs/fixtures/*.txt (5 new)
├── presentation-boundary.test.ts      # NEW
└── instrument-panel.test.ts, home-screen.test.ts, tuning-badge.test.ts, tool-card.test.ts

e2e/
├── handedness.spec.ts                 # NEW: US1–US5 flows, 4 combinations, axe
├── preferences.spec.ts, perf.spec.ts
└── triads-tm9.spec.ts (+ view 22 snapshots)
```

**Structure Decision**: Single SvelteKit project at the repository root (the existing layout
mandated by the constitution). Changes land in the existing `src/lib/{instrument,fretboard,
state,prefs,shell}` modules, `messages/`, `docs/adr/`, `tests/unit/` and `e2e/`; no new
directory is created. Tools (`src/lib/tools/**`), theory (`src/lib/theory`), notation and audio
are not modified.

## Complexity Tracking

No constitution violation requires justification. Assumptions and rejected alternatives
recorded for review:

| Item | Decision | Rejected alternative / reason |
|---|---|---|
| Spec says en/pt/es catalogs ship; repo ships only `en` (`project.inlang` locales `["en"]`) | Add keys to every shipped catalog (`en`); future `pt`/`es` catalogs must include them (R-12) | Creating `pt.json`/`es.json` now — adds untranslated locales and glossary-review debt outside this slice |
| Mirroring technique | Pure layout-coordinate mirror (R-01) | SVG `scale(-1,1)` (mirrors text) and CSS `direction: rtl` (negative `scrollLeft`, second scroll code path) |
| Tag strip below the board under lowest-on-top | Render after the `<svg>` so DOM/Tab order = visual order (R-03) | CSS `column-reverse` — focus order would contradict visual order |
| Presentation-only confirm | Re-apply instrument to tools (view unchanged), no playback stop, no notice (R-08) | Separate presentation store read by the renderer — renderer would import app state |
| Writer omits default fields | Default users' stored bytes identical to 012 (R-09) | Always write both — needless churn for every stored record |
| Two placeholder `screenOrder` tests replaced | They pinned the identity mapping this feature is specified to change (R-13) | Keeping them — would contradict FR-003/FR-006 |
