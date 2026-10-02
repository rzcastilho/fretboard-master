# Implementation Plan: Fretboard Notes Tool

**Branch**: `feature/004-fretboard-notes-tool` | **Date**: 2026-10-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-fretboard-notes-tool/spec.md`

## Summary

Replace the `/notes` placeholder with the first real tool: a chromatic selector of twelve notes
that highlights every occurrence on the shared fretboard (with same-octave tones and octave
numbers for one note), a non-modal position card with unisons, string and region filters,
Show/Label/Hide-names controls, Listen (a 120 bpm ascending sequence through the 003 playback
API), Clear, and Reset tool. Five TM-9 teacher-review views become Playwright screenshot
fixtures.

Technical approach (details in [research.md](./research.md)):

- **State** (R-01, R-08): a pure `NotesViewState` with total transition functions in
  `src/lib/state/notes-view.ts`, held by a runes store `src/lib/state/notes.svelte.ts` (module
  singleton: survives navigation, resets on reload). Each state-changing action calls
  `playback.stop('view')`, which fulfils the obligation the 003 playback contract recorded.
- **Display model** (R-02, R-05): a pure `buildNotesModel(state, instrument)` in
  `src/lib/state/notes-model.ts` applies the clarified five-step emphasis precedence over all
  positions and derives the missing-note notice, empty guidance, Listen steps and availability,
  card info, and the text description. Pitch queries (`positionsWithPitchClass`, `unisonsOf`) are
  added to `src/lib/instrument`, so tools never compute theory.
- **Renderer** (R-03, R-04): `Fretboard.svelte` gains optional, backwards-compatible model fields:
  `labelMode: 'octave'`, per-marker `label` override, `tone` (1–7) and `octaveBadge`, a
  `region` band with scroll-to-region, `hoverHint: false`, a verbatim `description` override, and
  an exported `focusPosition(p)`. New tokens are `--color-note-highlight`, `--octave-tone-1…7`,
  and `--region-band`.
- **UI** (R-10–R-12): a `NotesTool` in `src/lib/tools/notes/` fills zones B–E, a reusable
  `src/lib/tools/NoteSelector.svelte` is added, `Notice` gains an optional action button
  (**Widen region**), and `ToolLayout` renders `NotesTool` for `notes`. All text is in
  `messages/en.json`.
- **Widen region** (R-06): a deterministic, minimal, terminating extension of the nearer limit,
  covered by a property test.
- **TM-9** (R-09): a test-only `__fmInstrument` global (`'AF-7' | 'AF-21'`, ADR 0004 pattern)
  selects allow-listed instruments from `src/lib/instrument/fixtures.ts`. The production
  build is gated by `check-no-fault-hook.mjs`.

**Assumptions recorded** (the spec is silent here; the most defensible option was chosen, and
the rejected alternative follows each one):

- The spec's Widen example originally said "C♯4 (string 1, fret 9)". By TM-1.3 that position
  is **C♯5** (E4 + 9), and the spec text has been corrected to C♯5. Tests assert the position
  and region (0–9), and the label is computed. Rejected: hard-coding "C♯4" (violates
  Principle I) (R-05).
- Card-highlighted positions use the single highlight token, never octave tones. Rejected: tones
  on unisons (all unisons share one octave by definition, so a tone adds nothing).
- While the card is open, non-hidden positions outside the filters stay unlabeled (filter-dimmed
  rule), and those inside keep their label. Rejected: unlabeling everything except the card
  positions (loses context for learners).
- Opening the card leaves focus on the fretboard cell. The card is reachable by Tab (zone D) and
  announced via the description. Rejected: moving focus into the card (breaks arrow exploration
  and the "tap another position replaces the card" flow) (R-10).
- Escape closes the card when focus is in zone C or D. Rejected: a global Escape listener
  (conflicts with the sound-control disclosure's Escape in zone A).
- With Hide names on, the fretboard **cell accessible names** keep their note names: the spec
  limits the change to labels, hover hint, tones, and the text description, and removing names
  from the grid would make it unusable for screen-reader users. Rejected: blanking cell names.
- The note selector is built as a reusable component (design §4.3 "same component in the three
  tools") but exposes only the props Notes needs. Rejected: a Notes-private selector that Triads
  would duplicate in 005 (Principle X still respected: no speculative props).
- TM-9 instruments use 22 frets, like the default instrument. Rejected: 24 frets for AF-21 (it
  would vary two dimensions in one fixture; the instrument panel slice owns fret counts).
- The region notice and empty guidance render above the fretboard in zone C. Rejected: zone D
  (on narrow screens D is below E and the notice would be off-screen when it matters).

## Technical Context

**Language/Version**: TypeScript 5.9 (`strict: true`) on Node.js 24.21.0 (pinned in `mise.toml`); Svelte 5 (runes)

**Primary Dependencies**: Runtime unchanged: `svelte` 5, `@sveltejs/kit` 2 (`adapter-static`), `@inlang/paraglide-js` 2. Browser APIs: `Intl.ListFormat` (R-12) and the existing Web Audio path through `src/lib/state/playback.svelte.ts`. **No new runtime or dev dependencies.**

**Storage**: N/A. View state is in memory only (FR-019). Persistence and share links are out of scope (006-sharing).

**Testing**: Vitest (jsdom) with fast-check for pure modules (`instrument` occurrences, `notes-view`, widen, `notes-model`, notation lists), the store (with a fake playback engine via `resetPlaybackForTests`), and components (`@testing-library/svelte`). Playwright (phone 360, phone-touch 320, desktop) with `@axe-core/playwright`, the existing `__fmAudioLog` hook, and the new `__fmInstrument` harness. TM-9 screenshot fixtures in `e2e/notes-tm9.spec.ts`.

**Target Platform**: Last two major versions of evergreen browsers, desktop and mobile; static hosting on Cloudflare Pages.

**Project Type**: Static web application (SvelteKit, prerendered), single project at the repository root.

**Performance Goals**: Control change → fretboard update ≤ 100 ms (≤ 175 positions classified per change, R-13); tool open ≤ 300 ms; tap → sound ≤ 100 ms (unchanged 003 path); Listen step interval 500 ms (120 bpm).

**Constraints**: Only four emphasis levels; the neutral marker shape only; no root/third/fifth colors; every visual value is a token; every string is in the catalog; no modals; notices are non-blocking and ≤ 2 lines; 320–2560 px with only the fretboard scrolling horizontally; zero axe violations; initial JS ≤ 80 KB gzip (estimated +4–6 KB); deterministic tests only.

**Scale/Scope**: 5 user stories, 28 acceptance scenarios, 22 FRs. New: 3 state modules, 2 instrument functions + 1 test fixture module, 4 notation helpers, 6 components (`NotesTool`, `NoteSelector`, `PositionCard`, `StringFilter`, `RegionFilter`, `NotesActions`). Edited: `Fretboard.svelte`, `fretboard/types.ts`, `Notice.svelte`, `ToolLayout.svelte`, `tokens.css`, `app.d.ts`, `eslint.config.js`, `check-no-fault-hook.mjs`, `messages/en.json` (≈ 45 keys). One ADR (0008: tool view-state stores and display-model builders). About 9 new or extended unit suites and 2 new e2e specs.

All Technical Context unknowns are resolved in research.md (R-01–R-15). No open unknowns remain.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Initial check (before Phase 0): **PASS**. No principle is violated. The open questions (where
state lives, how the renderer expresses tones and region, how TM-9 obtains non-default
instruments) all had compliant options and were resolved in research.

Post-design re-check (after Phase 1): **PASS**. data-model, contracts, and quickstart introduce no
deviation. Complexity Tracking stays empty.

### I. Musical Correctness (NON-NEGOTIABLE)

- [x] Notes and octaves match the theory reference: pitch = open string + fret, octave changes at
  C (`octaveOf`, TM-1.2/1.3). String 1 fret 9 is C♯5 (spec corrected; R-05).
- [x] Triad spelling: N/A. This slice spells single pitch classes only (sharps in labels, plus the
  flat alternative on the card), with no triads.
- [x] Computed from configuration: occurrences, unisons, Listen steps, and widen all derive from
  the `Instrument` in use. Verified on AF-1, AF-7, and AF-21 and with random-tuning property tests.
- [x] Theory merge gate: `theory` is not modified. New pitch queries live in `instrument` with table
  and property tests; the existing TM-1/TM-3 suites still gate. Triad/CAGED suites are N/A because
  no such code exists yet.
- [x] Each note sounds at its calculated pitch: taps and Listen use the 003 `note`/`sequence` API
  with positions plus the instrument. The audio-log e2e asserts the MIDI pitches (A3 = 57).

### II. On-Device, Static, Private by Design

- [x] All calculation and rendering run in the browser; nothing new on the server.
- [x] No network after load: no new chunks, fonts, or fetches; the continuity e2e re-runs.
- [x] No accounts or identifiers; Hide names records nothing (FR-011).
- [x] No third-party content; `Intl.ListFormat` is a built-in.
- [x] No device permissions requested.
- [x] Preferences in local storage: N/A. Nothing is persisted (FR-019).
- [x] Anonymous measurement: N/A. No events emitted.

### III. Pure Core, Thin Shell

- [x] `theory` untouched. New pure modules (`notes-view.ts`, `notes-model.ts`, instrument
  queries) have no Svelte or DOM imports, enforced by a new ESLint block (contracts/notes-state-api §1).
- [x] One-way flow: control → `notes` store (view state) → `buildNotesModel` (display model) →
  `<Fretboard>` render.
- [x] Tools don't calculate theory or draw: `src/lib/tools/**` gets the shell import restriction
  (`$lib/theory/*` banned); drawing stays in `Fretboard.svelte`.
- [x] Handedness/orientation applied only in the renderer, including the new region band and
  octave badge.
- [x] Fretboard events in musical terms: `onactivate(position)` and `focusPosition(position)`.
- [x] View state outside tool components: `src/lib/state/notes.svelte.ts` singleton (R-01),
  ready for share links and context carry-over.

### IV. Test-First for Logic, Tested Behavior for UI

- [x] Test-first modules: instrument queries, notation list helpers, `notes-view`, widen, and
  `notes-model`. Each suite is written and seen failing first (quickstart §3).
- [x] Every acceptance scenario is automated: US1–US5 (28 scenarios) plus edge cases map to rows
  in quickstart §3–§4.
- [x] TM-9 screenshot fixtures: views 1–5 in `e2e/notes-tm9.spec.ts`, with the test-only instrument
  harness (contracts/test-hooks.md). Views 6+ belong to later slices.
- [x] Deterministic: pure functions; playback through the fake engine and `__fmAudioLog`; no
  real-time waits.
- [x] Bug fixes start with a failing test (standing rule).

### V. Accessible by Default (WCAG 2.2 AA)

- [x] Keyboard: native buttons, radiogroups with roving tabindex, spinbuttons with arrow/Page/Home/End,
  fretboard Enter/Space, and Escape to close the card. No focus trap.
- [x] Focus visible with the existing focus token; Close returns focus to the tapped cell.
- [x] Not color alone: octave tone + octave number; naturals vs altered by fill style + two-spelling
  label; emphasis by opacity + size; pressed state by `aria-pressed` + visual style.
- [x] Touch targets ≥ 44 × 44 px (`--target-min`) for selector, toggles, steppers, and shortcuts.
- [x] Text description: Notes-specific summary + entries via `model.description`, announced
  politely on change (FR-019a).
- [x] `prefers-reduced-motion` (region scroll instant, pulse unchanged) and `prefers-contrast`
  (token variants for highlight, tones, and band) honored.
- [x] Sound never the only carrier: the card and pulses show every tap and Listen step, also when
  muted.
- [x] Accidentals read in full: selector "C sharp or D flat", description "C sharp", all via
  `spokenNote`.
- [x] axe zero violations at 320 px and desktop for every state in the e2e suite (SC-005).

### VI. Performance Budgets Are Gates

- [x] Home ≤ 3 s / Lighthouse ≥ 90: no new load-time work; lhci re-runs.
- [x] Tool open/switch ≤ 300 ms: one `$derived` model build at mount; `perf.spec.ts` re-runs.
- [x] Control change → update ≤ 100 ms: O(175) classification; a new perf case (quickstart #30).
- [x] Instrument change ≤ 300 ms: `revalidate` is O(strings); exercised via the harness.
- [x] Tap → sound ≤ 100 ms: unchanged 003 path.
- [x] Initial JS ≤ 80 KB gzip: about +4–6 KB with no dependency; `check-bundle-size.mjs` gates it.
- [x] Smooth scrolling with 7 strings × 24 frets: the region band is one rect, and the marker count
  is unchanged.

### VII. Design System Fidelity

- [x] Fretboard is the protagonist: the card is in zone D, never covering the board; notices sit
  above the board, not over it.
- [x] Simplest initial state (FR-001); advanced options (filters, Hide names) are off.
- [x] Main controls never behind a menu: the selector is always visible in zone B.
- [x] Note-function code: Notes uses only the `neutral` marker; root/third/fifth shapes are unused.
- [x] Root/third/fifth colors not reused: the new tokens are distinct, and `reserved-colors.test.ts`
  is extended.
- [x] Every visual value from tokens: highlight, tones, band, badge size, and selector sizing.
- [x] Only four emphasis levels (FR-017; data-model §4).
- [x] Notices non-blocking, dismissible, ≤ 2 lines, with no error red; no modal (the card is a
  section). The missing-notes notice names at most three notes and otherwise states the count
  (FR-015), and T064 asserts ≤ 2 lines at 320 px and 200 % zoom.
- [x] No reward mechanics or tutorials; Hide names records nothing.
- [x] 320–2560 px: the selector wraps 6 + 6 below 600 px, and only the fretboard scrolls.
- [x] Motion explains change: the region scroll uses `--duration-short` and is instant under
  reduced motion.

### VIII. International From the First Line

- [x] All strings in `messages/en.json` (`notes_*`); `no-raw-text.test.ts` covers the new
  components.
- [x] Note names only from `src/lib/notation` (`noteLabel`, `spokenNote`, the new `flatSpelling`,
  `pitchLabel` for octave names such as "A3", and list helpers); components and `notes-model`
  never concatenate octave numbers onto names.
- [x] Accidentals as ♯ ♭ glyphs (existing `noteLabel`).
- [x] Text length / 200 % zoom: buttons wrap, grids use `minmax`, and the 320 px e2e at 200 % zoom
  covers it.
- [x] New language = catalog only: lists use `Intl.ListFormat` with the active locale.

### IX. Untrusted Input, Versioned Formats

- [x] Share links / stored preferences: N/A. This slice adds neither (out of scope).
- [x] Format versions: N/A for the same reason.
- [x] Link-compatibility fixtures: N/A; no link format exists yet.
- [x] Input-derived content never rendered as HTML: the only external input is the test-only
  `__fmInstrument`, resolved through an allow-list, and all text is rendered as text nodes.

### X. Simplicity and Incremental Delivery

- [x] Wave order: 001-mvp/004 follows 001–003 and is shippable alone (Triads keeps its placeholder).
- [x] No premature abstraction: no generic tool store and no tuning catalog. `NoteSelector` is
  justified by design §4.3 and has no speculative props.
- [x] No new runtime dependency.
- [x] Never blank: every filter combination yields markers, a dimmed board, the region notice
  with **Widen region**, or "Pick a note or tap a fret" (SC-006).

## Project Structure

### Documentation (this feature)

```text
specs/004-fretboard-notes-tool/
├── plan.md              # This file
├── research.md          # Phase 0: R-01–R-15
├── data-model.md        # Phase 1: view state, classification, display model, card
├── quickstart.md        # Phase 1: gates, unit + e2e validation matrix
├── contracts/
│   ├── notes-state-api.md   # pure + store API, import boundaries, playback obligations
│   ├── fretboard-model.md   # renderer extensions (labels, tones, region, description, focus)
│   ├── notes-ui.md          # roles, names, messages per zone
│   └── test-hooks.md        # __fmInstrument harness + TM-9 views 1–5
├── checklists/          # from /speckit.specify and /speckit.clarify
└── tasks.md             # Phase 2 (/speckit.tasks, not created here)
```

### Source Code (repository root)

```text
src/
├── app.d.ts                         # + __fmInstrument
├── lib/
│   ├── instrument/
│   │   ├── instrument.ts            # + positionsWithPitchClass, unisonsOf
│   │   └── fixtures.ts              # NEW (test-build only): AF-7, AF-21
│   ├── notation/notation.ts         # + flatSpelling, noteList, spokenNoteList, pitchLabel
│   ├── fretboard/
│   │   ├── types.ts                 # + LabelMode 'octave', OctaveTone, Marker.label/tone/octaveBadge,
│   │   │                            #   DisplayModel.region/hoverHint/description
│   │   └── Fretboard.svelte         # octave labels, tones, badge, region band + scroll, focusPosition
│   ├── state/
│   │   ├── notes-view.ts            # NEW: pure NotesViewState + transitions + widen
│   │   ├── notes-model.ts           # NEW: pure buildNotesModel, listenSteps, cardInfo, description
│   │   └── notes.svelte.ts          # NEW: runes store, playback obligations
│   ├── tools/                       # NEW directory (tool UIs)
│   │   ├── NoteSelector.svelte      # reusable chromatic selector
│   │   └── notes/
│   │       ├── NotesTool.svelte     # zones B–E, instrument harness, fault guard
│   │       ├── PositionCard.svelte
│   │       ├── StringFilter.svelte
│   │       ├── RegionFilter.svelte
│   │       └── NotesActions.svelte
│   ├── shell/
│   │   ├── ToolLayout.svelte        # notes → NotesTool, triads → ToolPlaceholder
│   │   └── Notice.svelte            # + optional action button
│   └── styles/tokens.css            # + --color-note-highlight, --octave-tone-1..7, --region-band, --marker-badge-size
└── routes/notes/+page.svelte        # unchanged (ToolLayout tool="notes")

messages/en.json                     # + notes_* keys
eslint.config.js                     # + src/lib/tools/** and notes-view.ts boundaries
scripts/check-no-fault-hook.mjs      # + __fmInstrument needle
docs/adr/0008-tool-view-state-and-display-model.md   # NEW

tests/unit/
├── instrument/occurrences.test.ts   # NEW
├── notation/notation.test.ts        # extended
├── state/notes-view.test.ts         # NEW
├── state/notes-widen.test.ts        # NEW
├── state/notes-model.test.ts        # NEW
├── state/notes-store.test.ts        # NEW
├── fretboard/fretboard.test.ts      # extended
├── notes/*.test.ts                  # NEW component suites
├── notice.test.ts, tool-layout.test.ts, reserved-colors.test.ts   # extended

e2e/
├── notes.spec.ts                    # NEW: US1–US5, keyboard, axe
├── notes-tm9.spec.ts                # NEW: TM-9 views 1–5 screenshots
└── perf.spec.ts                     # + control-change budget case
```

**Structure Decision**: Single SvelteKit project at the repository root, using the existing
directories `src/lib/{instrument,notation,fretboard,state,shell,styles}`, `src/routes/notes`,
`messages/`, `tests/unit/`, `e2e/`, `scripts/`, and `docs/adr/`. The one new directory is
`src/lib/tools/`, which holds tool UIs. It keeps the shell (app chrome shared by every screen)
separate from tool-specific components and gets the same no-theory import rule as the shell. The
constitution's source layout lists library areas, not UI folders. The alternative,
`src/lib/shell/notes/`, was rejected because it would mix tool UI into app chrome.

## Complexity Tracking

No constitution violations. The table is intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
