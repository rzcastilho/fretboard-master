# Implementation Plan: Triads Isolated View

**Branch**: `feature/005-triads-isolated-view` | **Date**: 2026-10-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-triads-isolated-view/spec.md`

## Summary

Replace the `/triads` placeholder with the Triads tool in its Isolated view: four always-visible
main controls (root ×12, quality ×4, inversion ×3, string set ×4), one close-position shape on
the shared fretboard with root/third/fifth markers and interval or note-name labels, a
composition panel (name, notes, intervals, stacking, low-to-high order, sounds-as lines,
simpler-spelling suggestion, spelling switch, symmetry and ♭5 statements), octave up/down
between occurrences, a wide-stretch mark, **Listen** (arpeggio then block), and "never blank"
guidance for beyond-fret and does-not-close cases with an **Another set** action.

Technical approach (details in [research.md](./research.md)):

- **Theory** (R-01–R-06): new pure modules `src/lib/theory/triad.ts` (TM-4.1 alternate-letter
  spelling, TM-4.3 defaults computed by accidental count with a two-entry tie-break) and
  `src/lib/theory/triad-shape.ts` (TM-5.3 over three open-string pitches, typed
  `does-not-close` result, occurrences, span). Table tests for TM-4.2 / TM-4.3 / TM-5.5 and
  NFR-9.3 property tests are added by this slice and gate all later theory changes
  (Principle I). A design spot check already reproduced all 48 TM-5.5 cells and the C7
  figures.
- **Instrument** (R-07): `src/lib/instrument/string-sets.ts` maps a set id (its bass string)
  to strings and open pitches, so theory never sees `Instrument`.
- **State** (R-04, R-08, R-09, R-11, R-12, R-14): `triads-view.ts` (pure view state and
  total transitions with the C1/C9 keep/reset rules), `triads-model.ts` (pure
  `buildTriadsModel` → `DisplayModel` + structured composition + guidance + Listen steps),
  `triads.svelte.ts` (module-singleton store; every change calls `playback.stop('view')`).
  `LISTEN_BPM`/`ListenStep` move to `state/listen.ts` (second user).
- **Renderer** (R-10): backwards-compatible `labelMode: 'interval'` and `Marker.interval`;
  interval glyphs from `notation.intervalLabel`.
- **UI** (R-13, R-17): `src/lib/tools/triads/*` components in the existing tool grid zones;
  `NoteSelector` gains a `label` prop; the radiogroup in `NotesActions` is extracted to a
  shared `ChoiceGroup` (second real use). Guidance is an in-board empty state, not a `Notice`.
- **Tests** (R-15, R-16): unit tests per module, e2e for every acceptance scenario, TM-9
  views 7, 8, 11, 12 as screenshot fixtures; unreachable cases use new allow-listed
  test-only instruments (`AF-4`, `AF-1-12`, `NC-UNISON`) through the existing
  `__fmInstrument` hook.

**Assumptions recorded** (spec silent or ambiguous; most defensible option chosen, rejected
alternative after each):

- "Does not close" means the set's open strings are not strictly rising low→high (unison or
  descending adjacent strings), the case C7 names. Rejected: "TM-5.3 loop finds no
  non-negative frets" — that loop always terminates, so EC-5.1 would be unreachable and
  untestable (R-05).
- The set id is the bass string number (6, 5, 4, 3). Rejected: a three-string tuple, which
  admits non-adjacent invalid states (R-07).
- Octave and Listen buttons that cannot act use `aria-disabled` (focusable, announced) rather
  than `disabled`. Rejected: `disabled`, which removes them from the tab order and hides the
  "why" from keyboard users (R-08).
- Guidance is a non-dismissible in-board empty state, not the dismissible `Notice`
  (spec C14 overrides the Assumptions bullet that cites notice dismissibility). Rejected:
  a non-dismissible `Notice` mode — speculative configurability for one use (R-13).
- Interval root symbol "R" is a catalog message (`interval_root`) so locales may change it;
  degree digits and ♭/♯ glyphs are not translated. Rejected: hard-coded "R" (Principle VIII).
- Tapping a shape marker plays that note (`playback.note`) and changes no state, matching the
  fretboard's existing tap-to-hear behavior; tapping elsewhere does nothing visible.
  Rejected: opening a position card (Notes-only feature, not in this spec).

## Technical Context

**Language/Version**: TypeScript 5.9 (`strict: true`), Svelte 5 (runes), Node and pnpm pinned
in `mise.toml`

**Primary Dependencies**: SvelteKit + `@sveltejs/adapter-static`, Vite 8, Paraglide JS
(messages), Web Audio playback from slice 003 (`src/lib/audio`, via `state/playback.svelte.ts`).
No new runtime dependencies.

**Storage**: N/A — in-memory module-singleton store; nothing persisted (persistence and share
links are later waves).

**Testing**: Vitest + fast-check (unit, table, property), @testing-library/svelte (components),
Playwright phone 360 px + desktop + @axe-core/playwright (e2e, TM-9 screenshots), Lighthouse
CI and bundle-size check.

**Target Platform**: Last two major evergreen browsers, desktop and mobile; static site on
Cloudflare Pages.

**Project Type**: Static single-page web application (SvelteKit, prerendered, SPA fallback).

**Performance Goals**: Control change → fretboard and panel update ≤ 100 ms (FR-031, SC-003);
tool open ≤ 300 ms; tap to sound ≤ 100 ms after unlock.

**Constraints**: Initial JS ≤ 80 KB gzip (route-split `/triads`), offline after load, no
network or permissions, WCAG 2.2 AA, 320–2560 px with only the fretboard scrolling
horizontally, all text from `messages/en.json`, note names from `src/lib/notation`.

**Scale/Scope**: 12 roots × 4 qualities × 3 inversions × 4 sets = 576 selections (17 root
spellings → 68 spelled triads); ≤ 3 markers per view; ~6 new source modules, ~7 components,
~10 test files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Initial check: **PASS**. Post-design re-check (after research, data model, contracts):
**PASS** — one scoped deferral recorded in Complexity Tracking (TM-9 views needing later
views).

**I. Musical Correctness**

- [x] Spelling uses alternate letters with exact accidentals incl. 𝄪/𝄫 — `spellTriad` per
  TM-4.1 (R-02); C augmented = C–E–G♯ is guarantee T10.
- [x] Shapes computed from tuning, string count, fret count — `triadShape` over open pitches +
  `occurrences(fretCount)`; no drawn shapes (R-05, FR-012).
- [x] TM-4.2, TM-4.3, TM-5.5 table tests and NFR-9.3 property tests are introduced by this
  slice (it introduces triad spelling and shape code) and gate later changes — contracts T1–T11.
  TM-6/TM-7 are N/A: CAGED code does not exist yet.
- [x] Notes sound at calculated pitch — Listen uses shape positions through the existing
  003 engine (`positionPitch`), tested with the injectable clock (R-12).

**II. On-Device, Static, Private**

- [x] All calculation, rendering, and audio in-browser; no network calls, accounts,
  trackers, permissions, or new storage — feature adds pure functions and in-memory state only.

**III. Pure Core, Thin Shell**

- [x] `src/lib/theory/triad*.ts` import only `./pitch`; enforced by the existing ESLint
  theory boundary (R-01).
- [x] One-way flow control → `TriadsViewState` → `buildTriadsModel` → `Fretboard` (data-model
  §4–§5).
- [x] Tools do not compute theory or draw: components read `triads.display`; ESLint already
  forbids `$lib/theory/*` in tools.
- [x] Handedness/orientation untouched outside the renderer; events stay `(string, fret)`.
- [x] View state lives in `src/lib/state/triads.svelte.ts`, outside components (R-14).

**IV. Test-First / Tested Behavior**

- [x] Theory, string-set, view-state, and notation additions are written test-first
  (quickstart §1–§2 order).
- [x] Every acceptance scenario (US1–US8, 33 scenarios) maps to a Vitest or Playwright test
  (SC-008; contracts behavior tables).
- [x] TM-9 Triads views reachable in the Isolated view (7, 8, 11, 12) become screenshot
  fixtures (R-16); the rest are deferred — see Complexity Tracking.
- [x] Deterministic audio tests via injectable clock/context (003 harness); no real time.

**V. Accessible by Default**

- [x] All controls keyboard-operable (toggle buttons, `ChoiceGroup` roving arrows, fretboard
  ARIA grid); unavailable commands `aria-disabled` and focusable (R-08).
- [x] Function shown by marker shape + label; wide stretch by text + icon; guidance by text —
  never color alone (FR-015, FR-025).
- [x] 44×44 px targets via existing `--target-min` token.
- [x] Polite text description includes triad, set, positions, guidance; accidentals spoken in
  full via `spokenNote` (FR-029).
- [x] Reduced motion/contrast honored by existing renderer and tokens; sound never sole
  carrier (pulses shown when muted); axe zero violations in e2e.

**VI. Performance Budgets**

- [x] ≤ 3 markers and O(12) shape computation per change; route-split code; existing
  `perf.spec.ts` extended with a triads control-change ≤ 100 ms check (R-18). No budget raised.

**VII. Design System Fidelity**

- [x] Fretboard protagonist; controls in zones B/D/E around it; guidance inside the board area,
  never covering controls.
- [x] Opens in simplest state (C major, root, 3-2-1, intervals); no advanced options shown.
- [x] Main controls always visible, never behind a menu (FR-004).
- [x] Fixed note-function code reused (root square, third circle, fifth diamond); root/third/
  fifth colors used only for markers and the panel's marker glyphs.
- [x] All visual values from tokens; emphasis only `highlighted`/`hidden`.
- [x] Guidance ≤ 2 lines, no modal, no error red (C14); no rewards/mascots.
- [x] 320–2560 px, only fretboard scrolls horizontally (e2e at 320 and 2560).

**VIII. International**

- [x] Every string in `messages/en.json` (`triads_*`, `interval_root`); `no-raw-text` test
  guards components.
- [x] Note names only from `src/lib/notation` (`noteLabel`, `spokenNote`, new
  `intervalLabel`); glyphs ♯ ♭ 𝄪 𝄫 only.
- [x] Layout tolerant of PT/ES lengths and 200% zoom (wrapping groups, e2e zoom check).
- [x] New languages need only catalog files.

**IX. Untrusted Input, Versioned Formats**

- [x] N/A — this slice reads no share links or stored preferences (state is not persisted or
  encoded in URLs). The test-only `__fmInstrument` hook is allow-listed and stripped from
  production builds (ADR 0004).

**X. Simplicity and Incremental Delivery**

- [x] Slice 005 of wave `001-mvp` in `specs/autonomous/breakdown/`; ships independently.
- [x] New abstractions only with two real uses: `ChoiceGroup` (Notes + Triads), shared
  `listen.ts` (Notes + Triads), `NoteSelector.label` (Notes + Triads).
- [x] No new runtime dependencies.
- [x] Never blank: beyond-fret and does-not-close guidance with **Another set** (adjust and
  tell, C11).

**Workflow gates**

- [x] Conventional Commits, `NNN-slug` branch, CI merge gate unchanged (typecheck,
  svelte-check, lint incl. boundaries, format, Vitest coverage ≥ 95% theory / ≥ 80% overall,
  Playwright + axe, Lighthouse, bundle size).
- [x] ADR: none required — no stack change; the view-state/display-model pattern is ADR 0008
  and the test-hook pattern ADR 0004. Shape-closure definition is recorded in research R-05.

## Project Structure

### Documentation (this feature)

```text
specs/005-triads-isolated-view/
├── plan.md              # This file
├── research.md          # Phase 0: R-01 … R-18 + algorithm spot check
├── data-model.md        # Phase 1: theory types, string sets, view state, display model
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── triads-theory-api.md   # theory API + guarantees T1–T11
│   ├── triads-state-api.md    # view state, display model, store
│   ├── fretboard-model.md     # renderer delta: interval labels
│   ├── triads-ui.md           # components, zones, text keys, behavior table
│   └── test-hooks.md          # test-only instruments + TM-9 fixtures
├── checklists/requirements.md # (from /speckit.specify)
└── tasks.md             # Phase 2 (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
src/lib/
├── theory/
│   ├── pitch.ts                    # existing
│   ├── triad.ts                    # NEW spelling, qualities, intervals, default spelling
│   └── triad-shape.ts              # NEW TM-5.3 shape, occurrences, span
├── instrument/
│   ├── instrument.ts               # existing
│   ├── string-sets.ts              # NEW set ids → strings / open pitches / positions
│   └── fixtures.ts                 # + AF-4, AF-1-12, NC-UNISON (test-only)
├── notation/notation.ts            # + intervalLabel
├── fretboard/
│   ├── types.ts                    # + LabelMode 'interval', Marker.interval
│   └── Fretboard.svelte            # + interval label rule
├── state/
│   ├── listen.ts                   # NEW (LISTEN_BPM, ListenStep moved from notes-model)
│   ├── notes-model.ts              # imports listen.ts
│   ├── triads-view.ts              # NEW pure view state + transitions
│   ├── triads-model.ts             # NEW buildTriadsModel, nearestClosingSet
│   └── triads.svelte.ts            # NEW store
├── tools/
│   ├── NoteSelector.svelte         # + optional label prop
│   ├── ChoiceGroup.svelte          # NEW (extracted from notes/NotesActions.svelte)
│   ├── notes/NotesActions.svelte   # uses ChoiceGroup
│   └── triads/                     # NEW
│       ├── TriadsTool.svelte
│       ├── TriadsControls.svelte
│       ├── TriadsSecondary.svelte
│       ├── CompositionPanel.svelte
│       └── TriadsGuidance.svelte
├── shell/ToolLayout.svelte         # renders TriadsTool for 'triads'
src/app.d.ts                        # __fmInstrument union extended
messages/en.json                    # triads_* keys, interval_root

tests/unit/
├── theory/triad.test.ts            # TM-4.2, TM-4.3 tables, T10
├── theory/triad-shape.test.ts      # TM-5.5 table, TM-5.7, span, occurrences
├── theory/triad-shape.property.test.ts   # NFR-9.3 (fast-check)
├── instrument/string-sets.test.ts
├── notation/notation.test.ts       # + intervalLabel
├── fretboard/fretboard.test.ts     # + interval mode
├── state/triads-view.test.ts
├── state/triads-model.test.ts
├── state/triads-store.test.ts
└── triads/*.test.ts                # components

e2e/
├── triads.spec.ts                  # US1–US8 flows, keyboard, axe, 320/2560 px
├── triads-tm9.spec.ts              # TM-9 views 7, 8, 11, 12
└── perf.spec.ts                    # + triads control-change budget
```

**Structure Decision**: Single SvelteKit project, using the directories that already exist and
the constitution's source layout: theory in `src/lib/theory`, instrument queries in
`src/lib/instrument`, state in `src/lib/state`, UI in `src/lib/tools/triads` (new subfolder
beside the existing `src/lib/tools/notes`), renderer changes in `src/lib/fretboard`, unit tests
in `tests/unit/<area>`, e2e in `e2e/`. The `/triads` route (`src/routes/triads/+page.svelte`)
already exists and needs no change; `ToolLayout` switches it from placeholder to tool.

## Complexity Tracking

| Violation / deferral | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Principle IV: TM-9 Triads views 6, 9 (full neck), 10 (quality comparison), 13 (7-string set 7-6-5), 14 (All notes) are not added as screenshot fixtures in this slice | Those views depend on the Full neck view, comparison, 7-string sets, and All notes view, which the spec puts out of scope (wave 002+); they cannot be reached through this slice's UI | Approximating them in the Isolated view (e.g. three separate screenshots for view 6) would produce fixtures that must be replaced, not added to, when the real view ships — and fixtures are add-only by convention. Each deferred view is assigned to the slice that ships its view (contracts/test-hooks.md). |
| Spec ambiguity: definition of "does not close" (EC-5.1) | The TM-5.3 procedure always terminates, so a definition is needed to make FR-020 reachable | Chosen: open strings not strictly rising (C7's own test case). Rejected: "loop fails" (unreachable). Recorded in research R-05. |
