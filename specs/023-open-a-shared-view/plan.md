# Implementation Plan: Open a Shared View

**Branch**: `feature/023-open-a-shared-view` | **Date**: 2026-10-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/023-open-a-shared-view/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Receiver side of sharing (breakdown `006-sharing/002`). A full page load on `/notes`,
`/triads` or `/caged` with a non-empty query opens that tool directly in the shared state,
drawn with the viewer's own presentation settings. Approach (from [research.md](./research.md)):

- **Apply before hydration** (R-01): `src/hooks.client.ts` `init` calls `opening.start(location.href)`
  right after `preferences.start()`. No flash of the default view; client-side navigation never
  re-applies a link. 022's `openToolAddress` then replaces the address with the canonical link
  of the displayed (repaired) state, with no history entry (FR-017).
- **Best-effort decoding with stored defaults** (R-02): a new pure `readReceivedLink(url,
  stored)` in `src/lib/link/receive.ts` reuses the 022 decoder internals with a `DecodeBase`
  (stored instrument as default; invalid `sc` or `tu` → both from stored). Newer/missing/invalid
  `v` still decodes with v1 rules and forces the incomplete notice; a non-tool path with `v`
  is an unknown-tool link. `decodeLink` (022) stays byte-for-byte compatible.
- **Session instrument override** (R-03/R-04): `instrument.svelte.ts` gains
  `override = { tool, link, notice }` with `receive`, `useMine`, `adopt`, `effectiveFor`. Only
  the opened tool's store runs on the link instrument; nothing is written until **Adopt this
  one**, which persists through the same code as the instrument panel. Any confirmed panel
  change, or erase, ends the override.
- **Zero-write application** (R-05): `notes/triads/caged.receive(view)` assign validated views
  without persisting label types or stopping playback; CAGED recomputes `tmp` per FR-6.14.
- **Notices** (R-06/R-07): existing `Notice` (extended to several actions) shows "This view uses
  {tuning}" with Use mine / Adopt this one / Dismiss, and "This link was incomplete; we show the
  closest view possible". Nearest-equivalent reuses `instrument_adjusted`. Five new catalog keys
  in en, es, pt-BR.
- **Bundle** (R-08, measured): the decoder alone adds +2,186 B gzip and the build is at the cap
  today (47 B headroom), so the slice includes a constitution amendment raising the initial-JS
  budget to 128 KB (see Complexity Tracking).

## Technical Context

**Language/Version**: TypeScript 5.x (`strict: true`), Svelte 5 runes, SvelteKit 2 (`adapter-static`, prerendered, `bundleStrategy: 'single'`), Node via mise

**Primary Dependencies**: SvelteKit, Paraglide JS (messages), Valibot (link schemas, already bundled for preferences) — no new runtime dependency

**Storage**: `localStorage` behind `src/lib/prefs` (read once at start; this slice writes only on **Adopt this one**, via the existing `preferences.remember` path). Link state is in memory only

**Testing**: Vitest + fast-check (unit, property, component), Playwright + @axe-core/playwright (e2e; local `desktop` only via `pnpm test:e2e:fast`)

**Target Platform**: Evergreen browsers (last two majors), phone and desktop, 320–2560 CSS px; static hosting on Cloudflare Pages

**Project Type**: Static single-page web application (SvelteKit, single project)

**Performance Goals**: Opening a link meets the normal start budgets: home/tool usable ≤ 3 s, tool open ≤ 300 ms, Lighthouse mobile ≥ 90; decoding is synchronous and sub-millisecond (one URL, ≤ 14 params)

**Constraints**: Initial JS ≤ budget (measured 120.0 KB baseline + ≈ 3.4–4.2 KB this slice → amendment to 128 KB, R-08); offline-capable after load (no network on open); no `{@html}`; zero preference writes on open; no new history entries

**Scale/Scope**: 3 tools × v1 link format (14 param keys max); 2 new pure/state modules, 4 store extensions, 3 component edits, 1 route edit, 5 message keys × 3 languages, ~1 new e2e spec

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against constitution 1.8.0, pre-research and again after Phase 1 design. Result: **PASS
with one recorded violation (VI, bundle cap)**, resolved by a MINOR amendment in this slice.

- [x] **I. Musical Correctness** — No theory change. Opened views are computed by the existing theory/model code from the validated tuning, string count and fret count; custom-tuning note names are re-derived from validated pitches via `tuningStrings()` + `noteLabel()`. Existing TM table/property suites keep gating.
- [x] **II. On-Device, Static, Private** — Link read from `location` in the browser; no network request, no server, no identifiers; stored preferences change only on the explicit **Adopt this one** (FR-020, SC-003).
- [x] **III. Pure Core, Thin Shell** — `src/lib/link/receive.ts` is pure (inside the existing lint boundary: no Svelte/DOM/i18n/storage). Flow stays action → view state → display model → render: opening only sets store state; handedness/orientation never touched; view state stays outside components.
- [x] **IV. Test-First / Tested Behavior** — `receive.ts`, decoder refactor, override and opening stores are built test-first (R-11). Every US1–US4 acceptance scenario maps to an e2e test in `e2e/open-link.spec.ts`; property tests for totality and round trip.
- [x] **V. Accessible (WCAG 2.2 AA)** — Reuses `Notice` (`role=status`, polite), keyboard-operable buttons ≥ 44×44 px, no color-only meaning, axe zero violations with both notices (contracts/link-notices-ui §5).
- [x] **VI. Performance Budgets** — VIOLATION recorded: measured decoder +2,186 B gzip on a build already at the 120 KB cap. Resolved by amending the cap to 128 KB (MINOR 1.9.0) with Sync Impact Report, `check-bundle-size.mjs` and ADR 0002 updates; timing budgets and Lighthouse ≥ 90 unchanged. See Complexity Tracking.
- [x] **VII. Design System Fidelity** — Notices are non-blocking, dismissible, ≤ 2 lines, above `<main>` so the fretboard is never covered; notice tokens only (no error red); no modal; tools still open in their simplest state when no link is present.
- [x] **VIII. International** — Five new catalog keys in en, es, pt-BR; tuning names from `tuning-names.ts`, note names only from `src/lib/notation`; ♯/♭ rendering inherited. Layout checked at 320 px and 200 % zoom in all three languages.
- [x] **IX. Untrusted Input, Versioned Formats** — Every field checked by the 022 Valibot schemas + range/cross-field rules; invalid → default, valid kept; never throws (fast-check R1); version handled (FR-014); v1 fixtures untouched, a receive fixture table added (fixtures only grow); nothing rendered as HTML.
- [x] **X. Simplicity and Incremental Delivery** — No new abstraction without two uses (`DecodeBase` serves `decodeLink` and `readReceivedLink`; `Notice` actions serve the new notice and the existing one); no dependency; every failure path lands on a usable tool or home with a one-line notice. Follows wave order (006/002 after 006/001).

Workflow gates: branch `feature/023-open-a-shared-view`; Conventional Commits; ADR 0022 records
"apply received links before hydration + session instrument override" (architecturally
significant: changes the 022 A5 seam's timing and the instrument store's model).

## Project Structure

### Documentation (this feature)

```text
specs/023-open-a-shared-view/
├── plan.md              # This file
├── research.md          # Phase 0: R-01…R-11 (incl. bundle measurement)
├── data-model.md        # Phase 1: ReceivedLink, InstrumentOverride, opening store, notices
├── quickstart.md        # Phase 1: manual URLs + targeted commands
├── contracts/
│   ├── open-link-api.md     # receive.ts, instrument/tool store additions, opening store, messages
│   └── link-notices-ui.md   # notice placement, actions, a11y, tuning badge
├── checklists/          # from /speckit.specify / clarify
└── tasks.md             # Phase 2 (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
src/
├── hooks.client.ts                     # EDIT: init → preferences.start(); opening.start(location.href)
├── lib/
│   ├── link/
│   │   ├── decode.ts                   # EDIT: internals take DecodeBase; decodeLink unchanged
│   │   ├── receive.ts                  # NEW: readReceivedLink, isIncomplete (pure)
│   │   └── index.ts                    # EDIT: export receive API
│   ├── state/
│   │   ├── instrument.svelte.ts        # EDIT: override, receive/useMine/adopt/effectiveFor, persist()
│   │   ├── opening.svelte.ts           # NEW: start, incomplete notice lifecycle
│   │   ├── notes.svelte.ts             # EDIT: receive(view)
│   │   ├── triads.svelte.ts            # EDIT: receive(view)
│   │   ├── caged.svelte.ts             # EDIT: receive(view, temporary)
│   │   └── share.svelte.ts             # EDIT: currentSnapshot uses instrument.effectiveFor(tool)
│   └── shell/
│       ├── Notice.svelte               # EDIT: actions[] (migrate single-action callers)
│       ├── ToolLayout.svelte           # EDIT: instrument + incomplete notices
│       ├── TuningBadge.svelte          # EDIT: tool prop, effective tuning
│       └── link-notice.ts              # NEW: tuning text for the notice (preset name / custom notes)
├── routes/
│   ├── +layout.svelte                  # EDIT: beforeNavigate → opening.screenChanged()
│   └── [...unknown]/+page.svelte       # EDIT: incomplete notice for unknown-tool links
messages/{en,es,pt-BR}.json             # EDIT: 5 keys
tests/unit/
├── link/receive.test.ts, receive.property.test.ts, fixtures/v1/open.*   # NEW
├── state/instrument-override.test.ts, opening.test.ts                   # NEW
└── notice.test.ts, tool-layout.test.ts, tuning-badge.test.ts, state/share-store.test.ts  # EDIT
e2e/open-link.spec.ts                   # NEW
docs/adr/0022-open-received-links-before-hydration.md                    # NEW
.specify/memory/constitution.md, scripts/check-bundle-size.mjs, docs/adr/0002-*.md     # EDIT (budget amendment)
```

**Structure Decision**: Single SvelteKit project, existing layout. Pure link logic stays in
`src/lib/link` (lint-bounded), runes stores in `src/lib/state`, shell components in
`src/lib/shell`, routes in `src/routes`, unit tests in `tests/unit`, e2e in `e2e`, ADRs in
`docs/adr` — all directories that exist today. No new top-level directory.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| VI: initial JS exceeds 120 KB gzip (measured +2,186 B for the decoder alone on a build at 122,833 / 122,880 B; slice estimate +3.4–4.2 KB) → amend constitution 1.8.0 → 1.9.0, cap 128 KB | Opening a link requires the v1 decoder in the shipped bundle; 022 shipped only the encoder. Valibot link schemas are mandated (C-IX, stack table) | Lazy-loading the decoder: impossible under `bundleStrategy: 'single'` and contrary to ADR 0002. Hand-written validation: violates the mandated Valibot choice. Trimming earlier slices: regresses shipped behaviour and exceeds scope. Raising only to ~124 KB: forces another amendment in wave 007, which the maintainer wanted to stop. A savings pass still runs first (R-08) |

### Recorded assumptions (headless plan; no clarification possible)

| Assumption | Chosen | Rejected alternative |
|---|---|---|
| Where to apply the link | `hooks.client` `init`, before hydration (R-01) | Inside `openToolAddress` on mount (022 A5 literal): draws the default view first, then jumps |
| Panel change during override | Any confirmed change ends the override, including handedness/orientation only (R-04) | Only musical changes end it: needs a second `confirm` path for a rare case |
| String-count wording | `link_instrument_strings`: "This view uses {count} strings: {tuning}" (R-07) | Adjective prefix "7-string {tuning}": does not translate cleanly to es/pt-BR, redundant with 7-string preset names |
| Fret-count-only difference | Silent session override, no notice (spec default) | Instrument notice: spec excludes it |
| Tuning badge during override | Shows the tuning actually drawn (`effectiveFor`) | Stored tuning: would contradict the fretboard on screen |
| Nearest-equivalent on opening | Covered by the incomplete-link notice via `fellBack` (one notice per cause) | Also showing `instrument_adjusted`: two notices for one cause |
| Budget figure | 128 KB | Exact need (~124 KB) |
