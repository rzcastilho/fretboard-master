# Implementation Plan: Desktop-Only Web Application

**Branch**: `030-desktop-only-web-app` | **Date**: 2026-10-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/030-desktop-only-web-app/spec.md`

## Summary

Retarget Fretboard Master to desktop and laptop browsers. Three arrangements remain: `wide-side`
and `wide-stacked` from 1024 CSS px, and `reflow` below 1024 (today's `narrow` rules, kept for
WCAG zoom reflow down to 320 CSS px). The phone-landscape and medium arrangements, the landscape
side panel, the rotate hint, the pinch gesture and safe-area padding are deleted. The stored
`rotateHint` key is ignored silently (format version unchanged). Playwright drops the `phone` and
`phone-touch` projects and their baselines; Lighthouse moves to the desktop preset with tighter
budgets. The constitution goes to 2.0.0 (MAJOR), and the product specification, ADRs and
CLAUDE.md are amended to match. Research: [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.9 (`strict`), Svelte 5 runes, SvelteKit 2 with `adapter-static`

**Primary Dependencies**: Paraglide JS, Valibot; no dependency added or removed

**Storage**: `localStorage` preferences record (version 1, unchanged; `rotateHint` key dropped)

**Testing**: Vitest + fast-check (unit, jsdom where needed), Playwright + @axe-core/playwright, Lighthouse CI

**Target Platform**: last two majors of evergreen desktop browsers; windows 1024–2560 CSS px; zoom reflow to 320 CSS px

**Project Type**: static single-page web application (prerendered)

**Performance Goals**: desktop preset: Home ≤ 3 s, tool ≤ 3.5 s, score ≥ 90; other Principle VI rows unchanged (initial JS ≤ 150 KB, CLS ≤ 0.1)

**Constraints**: link-compatibility fixtures all pass; old preference records load; no desktop behavior or desktop baseline changes except arrangement-specific ones; never blocks phones

**Scale/Scope**: 5 routes, 3 tools; ~25 source files edited, 4 deleted; ~25 e2e specs touched, 2 deleted, 1 added; ~90 phone PNG baselines deleted; 9 product-spec files, constitution, CLAUDE.md, 1–4 ADRs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This slice is itself the amendment PR the Governance section requires. Against constitution
1.12.0 the changes to V, VI and VII and the merge gate are not violations to justify but the
sanctioned amendment route (edit the file, Sync Impact Report, dependent guidance). The check
below is run against the 2.0.0 text in [contracts/constitution-amendment.md](./contracts/constitution-amendment.md).

| Principle | Status | Notes |
|---|---|---|
| I Musical Correctness | PASS | No theory code touched. |
| II On-Device, Static, Private | PASS | No network or permission change. Measurement device class unchanged (R-17). |
| III Pure Core, Thin Shell | PASS | `layout.ts` stays pure; arrangement still derived in state, applied in shell. Data flow unchanged. |
| IV Test-First | PASS | `layout.ts`, prefs schema and fit store changes start with failing unit tests (R-12). Every acceptance scenario maps to `e2e/desktop-only.spec.ts` or an existing spec (R-11). Tests that only ran on phone projects get explicit viewports instead of silently stopping (R-11 row 2). |
| V Accessible | PASS | Keyboard, focus, descriptions untouched. Reflow to 320 CSS px kept and tested at 320×200 / 640×400 with axe. Targets stay 44 px, above SC 2.5.8 (R-09). |
| VI Performance | PASS | Desktop preset, FR-018 values in `lighthouserc.cjs` (R-13). Bundle only shrinks. Risk: tighter targets may fail first CI run → needs amendment, not silent relax. |
| VII Design Fidelity | PASS | Fretboard protagonist, controls never behind a menu at ≥ 1024. Tokens only; deleted landscape token. Notices: rotate hint gone, others unchanged. |
| VIII International | PASS | Messages deleted in all three catalogs together; no new strings. Text zoom 200 % at 1024 still tested. |
| IX Untrusted Input | PASS | Fixtures kept; stripped key never throws (R-06). Format versions unchanged. |
| X Simplicity | PASS | Net deletion. No new abstraction; `reflow` reuses `narrow` rules (R-02). |
| Workflow / gates | PASS | Merge gate and tiers rewritten per amendment; ADR 0029 records the decision; Conventional Commits. |

**Post-design re-check**: PASS. Phase 1 artifacts add no dependency, abstraction, or format
change. No Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/030-desktop-only-web-app/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── ui-arrangements.md          # arrangements, reflow guarantees, removed surface, test profiles
│   ├── constitution-amendment.md   # 2.0.0 clause text and Sync Impact Report
│   └── governing-docs.md           # product-spec, ADR, CLAUDE.md, catalog edits
├── checklists/
└── tasks.md                        # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── app.html                                  # drop viewport-fit=cover
├── lib/shell/layout.ts                       # Arrangement = reflow | wide-side | wide-stacked
├── lib/shell/ToolLayout.svelte               # drop data-landscape, landscape h1; compact = reflow
├── lib/shell/BarIcon.svelte                  # comment only
├── lib/state/viewport.svelte.ts              # arrangementFor without height
├── lib/state/rotate-hint.ts                  # DELETE
├── lib/state/preferences.svelte.ts           # drop rotateHintShown / markRotateHintShown
├── lib/state/fit.svelte.ts                   # drop 'request' case
├── lib/state/context-panel.svelte.ts         # comment: reflow
├── lib/prefs/schema.ts                       # drop rotateHint (read, write, privacy category)
├── lib/fretboard/pinch.ts                    # DELETE
├── lib/fretboard/Fretboard.svelte            # drop pinch effect
├── lib/fretboard/types.ts                    # FitEvent without 'request'
├── lib/tools/SidePanels.svelte               # DELETE
├── lib/tools/ContextZone.svelte              # narrow → reflow
├── lib/tools/NoteSelector.svelte             # narrow → reflow selectors
├── lib/tools/{notes,triads,caged}/*Tool.svelte  # unwrap SidePanels; CagedTool drops rotate hint
├── lib/styles/{tokens,global,controls}.css   # narrow → reflow; delete medium, landscape, safe areas, 600px block
└── routes/about/+page.svelte                 # compact = reflow
static/theme-boot.js                          # provisional reflow / wide-side
messages/{en,pt-BR,es}.json                   # delete caged_rotate_hint, panels_*

tests/unit/                                   # per research R-12
e2e/                                          # per research R-11; new desktop-only.spec.ts; delete phone PNGs
playwright.config.ts, pw.local.config.ts      # desktop, firefox, webkit, nojs
lighthouserc.cjs                              # desktop preset, FR-018 values
.github/workflows/update-snapshots.yml        # --project=desktop

.specify/memory/constitution.md               # 2.0.0
CLAUDE.md
specs/autonomous/fretboard-master/*.md        # per contracts/governing-docs.md
docs/adr/0029-desktop-only-target.md          # NEW; 0023 status line
```

**Structure Decision**: existing single SvelteKit project; no new directories. Work splits into
four independent streams that tasks can order: (1) code removal and the `reflow` rename,
(2) tests and Playwright/Lighthouse config, (3) governing documents, (4) baselines. Stream 1's
unit tests come first (test-first); stream 3 can proceed in parallel.

## Complexity Tracking

No violations.
