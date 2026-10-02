# Implementation Plan: Linked Tools

**Branch**: `feature/008-linked-tools` | **Date**: 2026-10-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/008-linked-tools/spec.md`

## Summary

This feature links Fretboard Notes and Triads so that musical context carries over when the
user switches tools:

- **Notes → Triads**, with exactly one note selected: the note becomes the Triads root. The
  quality, inversion and string set last used in Triads are kept.
- **Triads → Notes**: the main triad's three pitch classes become the Notes selection, in the
  order root, third, fifth.
- **Detected triad in Notes**: three selected notes that form a major, minor, diminished or
  augmented triad are named (for example "G♯ augmented"), and **View as triad** opens Triads
  on that triad.
- **Position card**: gains **Triads from this note**.
- **Session memory**: each tool keeps its state for the session.
- **Reset tool**: resets only the current tool.
- **History**: only screen changes add history entries.

Technical approach (details in [research.md](./research.md)):

- **Theory** (R-02): a new pure module, `src/lib/theory/triad-detect.ts`, with
  `detectTriad(selection)`. It tries candidate roots in selection order against the existing
  `QUALITY_INTERVALS`, so the augmented root is the first-selected note. It is gated by a
  288-row table test (SC-002) and by fast-check property tests.
- **State** (R-03 to R-05): a new pure module, `src/lib/state/links.ts`, with:
  - `carryFromNotes`, `carryFromDetected` and `carryFromTriads`;
  - the transitions `carryRoot` (selectRoot semantics: TM-4.3 default spelling, no-op on the
    same root), `carryTriad` (explicit Notes primary spelling through `spellingOverride`, with
    the 007 Compare swap rule) and `carrySelection` (replaces only `selection`).

  The `notes` and `triads` stores gain matching methods.
- **Trigger** (R-01, ADR 0011): the carry is applied **synchronously in the click handler**
  of the persistent-nav tool link (plain primary click only) and of the two Notes shortcuts,
  before navigation.
  - Back/Forward, home cards, reloads and deep links never run that code, so FR-006 holds by
    construction.
  - No URL state is added.
  - The destination store is a module singleton, so the first render already shows the
    carried context (FR-017).
- **UI** (R-06, R-07):
  - `DetectedTriad.svelte` sits in Notes zone B under the selector. It is never over the
    fretboard, and it shows even in hidden mode.
  - The detected name is fed by the new `NotesDisplay.detected` field and is appended to the
    polite fretboard description.
  - `PositionCard` gets a **Triads from this note** button.
  - There are 4 new catalog keys.
- **Session and reset** (R-09): the stores already persist per session. This slice adds tests
  that guarantee it. It also fixes one gap: the failure view's **Reset tool** now resets the
  tool's store as well as re-mounting the boundary (EC-1.3).

**Assumptions recorded** (the spec was resolved by its Clarifications, so no question is
open):

- The detected-triad root uses Notes' sharp spelling until FR-8.6 ships. It is a single
  constant, `NOTES_PRIMARY_CHOICE`.
- A **View as triad** that lands on the current comparison quality swaps the two qualities
  and shows the existing swap notice. The rejected alternative was turning Compare off,
  because FR-005 says everything that is not carried must be kept.
- A modified click (new tab) on a nav link does not carry. The rejected alternative was
  carrying anyway, which would mutate a tool in the current tab that the user did not open.

## Technical Context

**Language/Version**: TypeScript 5.9 (`strict: true`) on Node 24.21.0 (mise)

**Primary Dependencies**:

- Svelte 5.57 (runes) and SvelteKit 2.70 with `adapter-static`;
- Paraglide JS 2.25 (message catalog);
- no new runtime dependency.

**Storage**: N/A. Tool session state is in memory only (module-singleton stores). No change to
`localStorage` preferences or to share-link formats.

**Testing**:

- Vitest 5 + fast-check 4 (theory tables and properties, pure state, stores, components via
  @testing-library/svelte);
- Playwright 1.63 + @axe-core/playwright (phone 360 px, phone-touch and desktop projects).

**Target Platform**: Evergreen browsers (last two majors), desktop and mobile. The site is a
static SPA on Cloudflare Pages.

**Project Type**: Single-project static web application (SvelteKit).

**Performance Goals**:

- tool switch with a carry ≤ 300 ms to the first carried render;
- control → fretboard update ≤ 100 ms;
- detection is O(9) per selection change.

**Constraints**:

- initial JS ≤ 80 KB gzip; this feature adds about 1 KB;
- no network after load;
- no URL or storage writes for carry-over;
- in-tool changes add no history entries.

**Scale/Scope**:

- 2 tools and 3 entry points (nav link, View as triad, Triads from this note);
- 12 roots × 4 qualities × 6 orders for detection;
- about 4 new source files, about 6 changed files and 4 new catalog keys.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution v1.2.0. **Pre-research: PASS. Post-design re-check: PASS** (no violations; the
Complexity Tracking table is empty).

**I. Musical Correctness**

- [x] Detection follows TM-4.5 and reuses `QUALITY_INTERVALS`. The spelling of the carried and
  detected roots follows TM-4.1 and TM-4.3, and the Clarifications (R-02, R-03).
- [x] The new theory code ships its own table test (288 rows, SC-002) and fast-check property
  suite. All existing TM-4.2, TM-4.3, TM-5.5 and NFR-9.3 suites stay as merge gates.
- [x] No shape is hand-drawn. Triads still computes the shapes from the tuning; carry only
  sets the root and quality.
- [x] Sound is unchanged. Each carry stops playback through the existing `apply()`.

**II. On-Device, Static, Private**

- [x] Everything is computed in the browser.
- [x] There are no network calls, accounts or permissions.
- [x] Session state stays in memory and is never stored (FR-012).

**III. Pure Core, Thin Shell**

- [x] `triad-detect.ts` sits inside the lint-guarded `src/lib/theory`.
- [x] `links.ts` is pure and gets the same purity lint as `notes-view.ts`.
- [x] Tools get detection through the display model, never by importing theory.
- [x] View state stays outside the components.

**IV. Test-First**

- [x] Detector, links and store methods are written test-first.
- [x] Every acceptance scenario (US1–US5) maps to a Vitest unit test or to a Playwright test
  in `e2e/linked-tools.spec.ts`.
- [x] The failure-view reset gap starts with a failing test (bug-fix rule).

**V. Accessible (WCAG 2.2 AA)**

- [x] The new controls are native buttons with visible focus and 44 px targets.
- [x] The detected name has a spoken twin with accidentals read in full, and it is part of
  the polite description.
- [x] axe must report zero violations in the new e2e flows.

**VI. Performance Budgets**

- [x] A carry is an O(1) transition plus the existing derived rebuild.
- [x] `perf.spec.ts` adds a carry-switch timing (≤ 300 ms).
- [x] The bundle grows by about 1 KB, within 80 KB.

**VII. Design System Fidelity**

- [x] The name and button sit in control zone B, never over the fretboard.
- [x] The Notes and Triads simplest states are unchanged.
- [x] Only tokens are used, with no new colors.
- [x] The swap reuses the existing non-blocking notice.

**VIII. International**

- [x] There are 4 new catalog keys.
- [x] Note names come from `notation` (`noteLabel` / `spokenNote`), and quality words reuse
  the `triads_quality_*` keys.
- [x] Accidentals are written ♯ ♭ 𝄪 𝄫.

**IX. Untrusted Input, Versioned Formats**

- [x] N/A. The feature adds no share-link, URL or stored-preference field. The carry context
  is in memory, created only by the app's own state (R-01 rejects a URL param precisely so
  that it does not create an unversioned format).

**X. Simplicity and Incremental Delivery**

- [x] The slice follows breakdown wave 002/003.
- [x] There is no new abstraction without two uses: `carryRoot` serves the nav link and the
  card shortcut, and `spellingOverride` is reused instead of a new field.
- [x] There is no new dependency.
- [x] "Never blank": the existing guidance applies to carried contexts (EC-4.4, beyond-fret).

**Workflow gates**

- [x] Conventional Commits.
- [x] ADR 0011 records the carry-at-activation decision (R-12).
- [x] CI gates are unchanged: typecheck, lint, format, coverage, Playwright with axe, and
  Lighthouse.

## Project Structure

### Documentation (this feature)

```text
specs/008-linked-tools/
├── plan.md              # This file
├── research.md          # Phase 0: R-01 … R-12
├── data-model.md        # Phase 1: entities, transitions, session state diagram
├── quickstart.md        # Phase 1: validation commands + manual scenarios Q1–Q12
├── contracts/
│   ├── triad-detect-api.md   # theory: detectTriad (D1–D8)
│   ├── links-api.md          # state: carry contexts, transitions, orchestrator (L1–L11)
│   └── notes-ui.md           # Notes UI, AppNav, ToolLayout, catalog keys
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
src/lib/
├── theory/
│   └── triad-detect.ts            # NEW  detectTriad (TM-4.5)
├── state/
│   ├── links.ts                   # NEW  pure carry contexts + carryRoot/carryTriad/carrySelection
│   ├── links.svelte.ts            # NEW  linkTools, viewAsTriad, openTriadsFromNote, resetTool
│   ├── notes-model.ts             # CHG  NotesDisplay.detected + description sentence
│   ├── notes.svelte.ts            # CHG  carrySelection()
│   └── triads.svelte.ts           # CHG  carryRoot(), carryTriad()
├── tools/notes/
│   ├── DetectedTriad.svelte       # NEW  name + View as triad (zone B)
│   ├── NotesTool.svelte           # CHG  mounts DetectedTriad, wires card shortcut
│   └── PositionCard.svelte        # CHG  Triads from this note
└── shell/
    ├── AppNav.svelte              # CHG  tool-link onclick → linkTools
    └── ToolLayout.svelte          # CHG  failure Reset tool resets the store (EC-1.3)

messages/en.json                   # CHG  4 keys
eslint.config.js                   # CHG  purity block covers src/lib/state/links.ts
docs/adr/0011-tool-links-carry-at-activation.md   # NEW

tests/unit/
├── theory/triad-detect.test.ts            # NEW
├── theory/triad-detect.property.test.ts   # NEW
├── state/links.test.ts                    # NEW  pure
├── state/links-store.test.ts              # NEW  orchestrator + session/reset isolation
├── notes/detected-triad.test.ts           # NEW
├── notes/position-card.test.ts            # CHG
├── app-nav.test.ts                        # CHG  carry only on plain click of other tool
└── failure-view.test.ts / tool-layout.test.ts  # CHG  reset clears store
e2e/
├── linked-tools.spec.ts                   # NEW  US1–US5, history counts, axe
└── perf.spec.ts                           # CHG  carry switch timing
```

**Structure Decision**: This is a single SvelteKit project, and the existing layout is kept.
- Theory goes in `src/lib/theory`.
- Pure and store state goes in `src/lib/state`.
- Notes UI goes in `src/lib/tools/notes`.
- Navigation and layout go in `src/lib/shell`.
- Unit tests go in `tests/unit`, and flows in `e2e`.

All these directories already exist. No new top-level directory or route is added; `/notes`
and `/triads` stay as they are.

## Complexity Tracking

No constitution violations, so nothing needs justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — (none) | — | — |

Design choices with a rejected alternative (for reviewers):

| Choice | Rejected alternative | Why rejected |
|---|---|---|
| Carry in the click handler (R-01) | `?root=` query param, or `beforeNavigate` | A URL re-applies on reload or deep link (FR-006/012) and creates an unversioned format (IX). `beforeNavigate` cannot tell home cards from nav links. |
| Reuse `spellingOverride` for the explicit root spelling (R-03) | A new `rootSpelling` field | It would duplicate state and add invalid combinations. |
| Swap with the comparison quality on **View as triad** (R-05) | Turn Compare off | FR-005 says to keep all non-carried state. |
| Fix the failure-view Reset tool to reset the store (R-09) | Leave it as a boundary re-mount | EC-1.3 requires the initial state, and the failing state would recur. |
