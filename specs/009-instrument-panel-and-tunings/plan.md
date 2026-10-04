# Implementation Plan: Instrument Panel and Preset Tunings

**Branch**: `feature/009-instrument-panel-and-tunings` | **Date**: 2026-10-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/009-instrument-panel-and-tunings/spec.md`

## Summary

This slice lets the user configure the instrument: pick one of 11 six-string preset tunings
(TM-2, AF-1 … AF-11) and a fret count of 12–24 in an **instrument panel**, preview it, and
confirm. Every tool (Notes, Triads), the home thumbnails and the new home instrument summary
then use the real tuning and fret count, without a reload. Views made impossible by the change
move to the nearest equivalent and say so ("We adjusted the view to the new instrument").

Technical approach (details in [research.md](./research.md)):

- **Data** (R-01, R-02): new pure `src/lib/instrument/tunings.ts` with the TM-2 preset table
  in the preset's own spelling and a memoized `presetInstrument(id, fretCount)` whose identity
  is stable per configuration (`AF-1/22 === STANDARD_GUITAR`). Gated by a 66-row table test
  (SC-002).
- **State** (R-03, R-04, R-05): pure `src/lib/state/instrument-config.ts` (config, pending
  panel state, transitions) plus a runes singleton `src/lib/state/instrument.svelte.ts`. On
  Confirm it stops playback once (reason `instrument`) only if the configuration changed, then
  calls `applyInstrument` on the `notes` and `triads` stores, which revalidate their views and
  return whether they were adjusted. Notes gains `adaptNotesView` (whole-neck regions follow
  the new last fret silently; other regions clip). Triads now **revalidates** instead of
  resetting (keeps root/quality/inversion/set, clamps the occurrence). The notice shows only in
  the displayed tool, only if that tool was adjusted.
- **UI** (R-06 – R-12):
  - one `InstrumentPanel.svelte` mounted in the root layout: a native modal `<dialog>`, a
    bottom sheet below 1024 px and a side panel from 1024 px, with a native radio group for
    presets, a spinbutton fret stepper, a non-interactive preview (`Fretboard`
    `variant="preview"`), Restore default, Confirm and Close;
  - entry points: home `InstrumentSummary` (new), app-bar `InstrumentButton` and
    `TuningBadge` (shown iff tuning ≠ Standard);
  - Browser Back closes the panel through a SvelteKit shallow-history entry, which is removed
    on every other close;
  - the interactive fretboard animates its scroll back to the new last fret when frets shrink
    (`--duration-short`, instant under reduced motion).
- **Performance** (R-14): no new dependency, ≈ 3–4 KB gzip; instrument change ≤ 300 ms is
  measured in `e2e/perf.spec.ts`.

**Assumptions recorded** (the spec's Clarifications resolved every question; these are plan-level
choices):

- Fixtures `AF_4`/`AF_7` are re-expressed via `presetInstrument` so presets and TM-9 fixtures
  share one source; the test-only `__fmInstrument` hook keeps bypassing the panel store
  (R-13). Rejected: routing fixtures through the store (AF-21 / NC-UNISON aren't presets).
- The adjustment notice is held in the instrument store (`adjustedIn`) and yields to any later
  tool notice. Rejected: a global toast region (a new pattern with only one use).
- The panel uses a native `<dialog>` (`showModal`). Rejected: a hand-rolled focus trap.
- An ADR (`docs/adr/0012-app-wide-instrument-store-and-panel.md`) records the app-wide
  instrument store, the confirm orchestration and the shallow-history Back behavior.

## Technical Context

**Language/Version**: TypeScript 5.9 (`strict: true`), Svelte 5.57 (runes), SvelteKit 2.70 with
`adapter-static`

**Primary Dependencies**: SvelteKit (`$app/navigation` `pushState` shallow routing, `$app/state`
`page.state`), Paraglide JS (catalog), existing `src/lib/{instrument,state,fretboard,notation,
audio}` modules. No new runtime dependency.

**Storage**: N/A. The configuration lives in memory only, for the page session (FR-018). No
`localStorage`, no URL state.

**Testing**: Vitest 5 + @testing-library/svelte + fast-check (unit, component, table tests);
Playwright 1.63 + @axe-core/playwright (phone 360 px, phone-touch, desktop profiles); Lighthouse
CI.

**Target Platform**: Static web app on Cloudflare Pages; last two evergreen browser versions,
desktop and mobile (native `<dialog>` supported).

**Project Type**: Single-project static SPA (SvelteKit, prerendered).

**Performance Goals**: Instrument change ≤ 300 ms (Confirm → redraw, SC-001); control change
≤ 100 ms (pending preview updates); initial JS ≤ 80 KB gzip; Lighthouse mobile ≥ 90.

**Constraints**: Offline once loaded; no network on any panel action; WCAG 2.2 AA; works
from 320 to 2560 CSS px and at 200 % text zoom; motion only via tokens (`--duration-short`),
0 s under `prefers-reduced-motion`.

**Scale/Scope**: 11 presets × 13 fret counts = 143 possible instruments; 2 tools + home;
about 6 new source files, 6 modified, ~25 catalog keys, 1 ADR.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Pre-research result: **PASS**. Post-design re-check (after data-model and contracts):
**PASS**. One process note is recorded in Complexity Tracking (shallow history entry); it is
not a constitution violation.

### I. Musical Correctness (NON-NEGOTIABLE)

- [x] Notes/pitches match `11-music-theory-reference.md`: the presets are copied from TM-2
  with stored spelling, and a 66-row table test asserts letter, accidental, octave and pitch
  for every string (SC-002).
- [x] Spelling rules: preset spellings (E♭… in AF-2, F♯ in AF-9) are stored, never
  re-derived, and never respelled by preference (FR-005, FR-019).
- [x] Shapes are calculated from the configured tuning and fret count: Triads already calls
  `triadShape(setOpenPitches(instrument…), …, fretCount)`. This slice only feeds it the
  active instrument, and SC-003 (Drop D 10-7-5 "wide stretch") is a store-level test.
- [x] Theory merge gate: no `src/lib/theory` code changes. The existing TM-4/TM-5 table suites
  and the NFR-9.3 random-tuning property suites still gate the branch unchanged.
- [x] Each note sounds at its calculated pitch: `playback.note(p, instrument)` already derives
  pitch from `instrument.openStrings`. An E2E checks that Drop D string 6 open is D2 (via the
  existing audio test seam).

### II. On-Device, Static, Private by Design

- [x] Everything runs in the browser, with no network call; the panel is in the single bundle
  (ADR 0002).
- [x] No accounts, identifiers or personal data; the configuration is in memory only.
- [x] No third-party content and no device permissions.
- [x] Preferences in local storage, erasable: N/A this slice. Nothing is stored (FR-018); the
  storage slice comes later.

### III. Pure Core, Thin Shell

- [x] `src/lib/theory` is untouched. `tunings.ts` lives in `src/lib/instrument` (already
  lint-guarded as DOM/Svelte-free), and `instrument-config.ts` is pure (no Svelte, i18n or DOM).
- [x] One-way flow: panel control → instrument store (pending/active) → tool stores
  (`applyInstrument`) → display models → `Fretboard`.
- [x] Tools don't calculate theory or draw the fretboard: the panel preview reuses the shared
  `Fretboard` (`variant="preview"`), and tools only read store getters.
- [x] Handedness/orientation stay renderer-only. This slice doesn't change them; presets set
  `right`/`highest-top`.
- [x] The fretboard reports musical events only. The preview has no events, and the scroll
  correction is internal to the renderer.
- [x] View state lives outside components: active config, pending config and `adjustedIn` are
  in `instrument.svelte.ts`. Only the opener element reference (a DOM handle, not state) stays
  in the component.

### IV. Test-First for Logic, Tested Behavior for UI

- [x] Test-first for the instrument module (`tunings.ts`) and the state transitions
  (`instrument-config.ts`, `adaptNotesView`, `applyInstrument`). Tasks order the tests before
  the code.
- [x] Every acceptance scenario (US1-1 … US5-4) maps to a Vitest or Playwright test (see
  [quickstart.md](./quickstart.md)).
- [x] TM-9 screenshot fixtures stay unchanged and still pass. `AF_4`/`AF_7` keep identical open
  strings, asserted by a unit test.
- [x] No bug fix in scope. Any regression found during implementation starts with a failing
  test.
- [x] Deterministic tests: the scroll animation uses the existing injectable `Clock`, and
  playback uses the existing fake audio context and spy store.

### V. Accessible by Default (WCAG 2.2 AA)

- [x] Keyboard: native radios (arrows), spinbutton (arrows/Home/End), Escape closes, focus
  starts on the checked preset and returns to the opener; `showModal` keeps Tab inside the
  dialog without trapping (Escape always exits).
- [x] Not color alone: the badge is a text button, the checked preset uses the native radio
  plus a selected outline, and disabled stepper ends use the native `disabled` state.
- [x] Targets are ≥ 44 × 44 px (`--target-min`) for radios, stepper buttons, Confirm, Restore,
  Close, badge and summary.
- [x] Text equivalent: the preview is `aria-hidden` (the presets announce their notes), and
  the tool fretboard descriptions follow the new instrument automatically.
- [x] `prefers-reduced-motion` gives an instant scroll correction and no sheet slide-in
  animation; `prefers-contrast` uses the existing token overrides.
- [x] Sound isn't the only carrier: the tuning shows in the badge, summary and preview labels.
- [x] Accidentals are read in full: preset accessible names use `spokenNoteList` ("E flat").
- [x] Axe zero violations: the new E2E spec runs axe with the panel open (phone and desktop)
  and on tools showing the badge.

### VI. Performance Budgets Are Gates

- [x] Instrument change ≤ 300 ms: two display-model rebuilds (each < 100 ms already), asserted
  in `e2e/perf.spec.ts`.
- [x] Control change ≤ 100 ms: pending edits only re-render the preview fretboard.
- [x] Initial JS ≤ 80 KB gzip: about 3–4 KB added and no dependency; the bundle-size check
  gates it.
- [x] Home usable ≤ 3 s / Lighthouse ≥ 90: the summary is one button, and the panel DOM is
  rendered only while open.
- [x] Tap-to-sound and tool switch are unaffected (no new work on those paths).
- [x] Smooth scrolling with 7 strings/24 frets/CAGED: N/A. Neither 7 strings nor CAGED exists
  yet; 24 frets × 6 strings is within the existing renderer's tested range.

### VII. Design System Fidelity

- [x] The fretboard stays the protagonist: the entry points sit in zone A or the home bottom
  zone, never over the fretboard. The panel is the design-§5.5 panel surface, opened only on
  request.
- [x] Simplest state first: the default is Standard/22 and no badge; the panel is closed
  until asked for.
- [x] Main controls aren't behind a menu: "Instrument" is a visible button (the recorded
  default).
- [x] Note-function code and reserved colors: unchanged, and the panel uses no root, third or
  fifth colors (the existing `reserved-colors.test.ts` covers new CSS).
- [x] Tokens only: new component CSS uses `var(--…)`. The 1024 px media query repeats the
  documented breakpoint literal, as `tokens.css` and the existing layout do, because custom
  properties can't appear in media queries.
- [x] The four emphasis levels are unchanged; the preview draws no markers.
- [x] Notices: the adjustment uses the existing `Notice` (non-blocking, dismissible, one line,
  not error red). The panel is not a dialog for a normal situation; it is a requested surface.
- [x] No reward mechanics or photorealism.
- [x] 320–2560 px: the bottom sheet scrolls internally and long names wrap; only the fretboard
  scrolls horizontally (preview included).
- [x] Motion explains change: only the scroll moves, within `--duration-short`.

### VIII. International From the First Line

- [x] All strings are in `messages/en.json` (11 preset names, panel labels, summary, badge,
  notice), and `no-raw-text.test.ts` covers the new components.
- [x] Note names come only from `src/lib/notation` (`noteLabel`, `spokenNoteList`) using the
  preset's spelling.
- [x] Accidentals render as ♯ ♭ glyphs, stored as `accidental` values and never typed as
  `#`/`b`.
- [x] Text length and zoom: the summary, badge and preset rows wrap, and the badge has no
  fixed width; E2E runs at 200 % zoom at 320 px.
- [x] A new language needs only catalog files: the "·" separators live inside the catalog
  strings.

### IX. Untrusted Input, Versioned Formats

- [x] Untrusted input: none parsed in this slice (no share link or storage field). `isTuningId`
  and `clampFrets` still make every entry total (fail-safe defaults).
- [x] Format versions and link fixtures: N/A. The slice adds no link or preference format; the
  storage and share slices will add schema fields with versions.
- [x] No input-derived HTML: preset names come from the catalog and are rendered as text.

### X. Simplicity and Incremental Delivery

- [x] Wave order: this is wave 003 "your instrument", feature 001, and the MVP waves 001–002
  (slices 001–008) are merged. The slice ships on its own (persistence comes later).
- [x] No speculative abstraction: string count, handedness and custom tuning are not fields
  yet; there is one panel component for both layouts (CSS only); there is no generic
  tool-store interface, only the same `applyInstrument` method in the two real stores.
- [x] No new runtime dependency.
- [x] Never blank: impossible views clamp to the nearest equivalent with a one-line notice,
  and a no-shape case falls back to the existing EC-5.1 guidance.

### Workflow gates

- [x] Spec Kit flow: specify → clarify (session 2026-10-02) → plan (this file) → tasks →
  implement.
- [x] Conventional Commits, PR to `main`, CI merge gate unchanged.
- [x] ADR for an architecturally significant decision: ADR 0012 is planned (app-wide
  instrument store, confirm orchestration, shallow-history Back).

## Project Structure

### Documentation (this feature)

```text
specs/009-instrument-panel-and-tunings/
├── plan.md              # This file
├── research.md          # Phase 0: R-01 … R-14
├── data-model.md        # Phase 1: presets, config, panel state, adaptation rules, catalog keys
├── quickstart.md        # Phase 1: validation scenarios and gates
├── contracts/
│   ├── instrument-config-api.md   # TS module contracts (tunings, config, store, tool stores, fretboard)
│   └── instrument-panel-ui.md     # UI contract: entry points, dialog, roles/names, effects
├── checklists/
│   └── requirements.md  # From /speckit.specify
└── tasks.md             # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── instrument/
│   │   ├── instrument.ts            # unchanged (STANDARD_GUITAR kept; identity reused)
│   │   ├── tunings.ts               # NEW: TM-2 presets AF-1…AF-11, fret bounds, presetInstrument
│   │   └── fixtures.ts              # MOD: AF_4 / AF_7 derived from presetInstrument
│   ├── state/
│   │   ├── instrument-config.ts     # NEW: pure config + panel transitions
│   │   ├── instrument.svelte.ts     # NEW: runes store, confirm orchestration, adjustedIn
│   │   ├── notes-view.ts            # MOD: adaptNotesView (whole-neck rule)
│   │   ├── notes.svelte.ts          # MOD: applyInstrument
│   │   └── triads.svelte.ts         # MOD: applyInstrument (revalidate, no reset)
│   ├── fretboard/
│   │   ├── Fretboard.svelte         # MOD: variant "preview"; scroll correction on fret shrink
│   │   ├── geometry.ts              # MOD: preview fret cap, trailingEdgeScroll
│   │   └── types.ts                 # MOD: variant union
│   ├── shell/
│   │   ├── InstrumentPanel.svelte   # NEW: <dialog> sheet/side panel
│   │   ├── FretStepper.svelte       # NEW: spinbutton stepper
│   │   ├── InstrumentButton.svelte  # NEW: app-bar entry point
│   │   ├── TuningBadge.svelte       # NEW: badge (button) iff tuning ≠ Standard
│   │   ├── InstrumentSummary.svelte # NEW: home summary button
│   │   ├── ToolLayout.svelte        # MOD: button + badge in zone A
│   │   ├── HomeScreen.svelte        # MOD: summary in bottom zone
│   │   └── ToolCard.svelte          # MOD: thumbnails use active instrument
│   ├── tools/notes/NotesTool.svelte    # MOD: adjustment notice
│   ├── tools/triads/TriadsTool.svelte  # MOD: adjustment notice
│   └── styles/tokens.css            # MOD: panel tokens (side-panel inline size, sheet max block size)
├── routes/+layout.svelte            # MOD: mount InstrumentPanel; guard nav hooks for shallow pops
messages/en.json                     # MOD: ~25 keys (data-model §7)
docs/adr/0012-app-wide-instrument-store-and-panel.md   # NEW
tests/unit/
├── instrument/tunings.test.ts       # NEW (table, SC-002)
├── instrument/fixtures.test.ts      # MOD (fixtures == presets)
├── state/instrument-config.test.ts  # NEW
├── state/instrument-store.test.ts   # NEW
├── state/notes-adapt.test.ts        # NEW
├── state/notes-store.test.ts        # MOD
├── state/triads-store.test.ts       # MOD (SC-003, clamp)
├── fretboard/geometry.test.ts       # MOD (preview, trailingEdgeScroll)
├── instrument-panel.test.ts         # NEW (component)
├── fret-stepper.test.ts             # NEW
├── tuning-badge.test.ts             # NEW
├── home-screen.test.ts              # MOD (summary)
└── tool-card.test.ts                # MOD (active instrument)
e2e/
├── instrument-panel.spec.ts         # NEW (US1–US5, axe, phone/desktop)
└── perf.spec.ts                     # MOD (instrument change ≤ 300 ms)
```

**Structure Decision**: Keep the existing single-project SvelteKit layout mandated by the
constitution (`src/lib/{instrument,state,fretboard,shell,tools,notation}`, `src/routes`,
`messages/`, `tests/unit`, `e2e/`, `docs/adr/`); all of these directories exist today. Instrument
data goes in `src/lib/instrument`. App-wide state goes in `src/lib/state`, following the
ADR 0008 pattern (pure transitions plus a runes singleton). Shell-level UI shared by home and
tools goes in `src/lib/shell`. The fretboard changes stay in the single shared renderer in
`src/lib/fretboard`. No new top-level directory.

## Complexity Tracking

No constitution principle is violated. These are the decisions reviewers should look at
explicitly:

| Item | Why Needed | Simpler Alternative Rejected Because |
|------|------------|-------------------------------------|
| Temporary shallow-history entry while the panel is open (spec 008 says only screen changes add history entries) | FR-009 requires browser Back to close the panel and keep the user on the same screen, which needs a history entry to pop | No entry: Back would leave the screen. A hash URL: changes the URL, and 008 forbids URL state. The entry is removed by `history.back()` on every other close, so net history is unchanged |
| Fret-shrink scroll "hold" (content `min-inline-size` kept for one animation) | FR-014 clarification requires the documented motion duration, and browsers clamp `scrollLeft` instantly when content shrinks | Accepting the instant browser clamp ignores the motion requirement; CSS smooth scrolling isn't token-driven or testable with the injectable clock |
| `Fretboard` gains a third variant (`preview`) | FR-006 needs a non-interactive board with the full pending fret count; `thumbnail` caps at 12 frets | A second mini-renderer would break "one shared fretboard component"; reusing `thumbnail` would draw a 24-fret tuning wrong |
