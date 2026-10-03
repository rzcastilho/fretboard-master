# Research: Instrument Panel and Preset Tunings

**Feature**: 009-instrument-panel-and-tunings | **Date**: 2026-10-02 | **Plan**: [plan.md](./plan.md)

The Technical Context had no open `NEEDS CLARIFICATION` items: the stack is fixed by the
constitution and the spec's Clarifications session resolved every behavioral question. The
items below are the design unknowns found while reading the existing code (slices 001–008),
each resolved with a decision.

---

## R-01 — Where the preset table lives

- **Decision**: New pure module `src/lib/instrument/tunings.ts` holding `TUNING_PRESETS`
  (AF-1 … AF-11, TM-2 order and spelling), the fret-count bounds (`MIN_FRETS = 12`,
  `MAX_FRETS = 24`, `DEFAULT_FRETS = 22`), `DEFAULT_TUNING_ID = 'AF-1'` and
  `presetInstrument(id, fretCount): Instrument`.
- **Rationale**: tunings are instrument data, not theory (no interval or spelling
  calculation), so they belong next to `STANDARD_GUITAR` in `src/lib/instrument`, which is
  already DOM-free and lint-guarded. Each preset stores `SpelledPitch` values exactly as in
  TM-2 (E♭2 is `{letter:'E', accidental:-1, octave:2}`), so the preset's own spelling flows
  through the existing `Fretboard` open-string labels (`instrument.openStrings[string-1]`) and
  `notation.noteLabel/spokenNote` unchanged (FR-005, FR-019). Existing `Instrument.openStrings`
  is indexed string 1 (highest) first; the table is authored low → high (TM-2 order) and
  reversed once in `presetInstrument`, so the table reads like the reference.
- **Alternatives considered**: putting presets in `theory/` (rejected: theory must not know
  instruments' tuning catalog, and it would force the TM table gates on non-theory data);
  a JSON data file (rejected: loses `as const` typing of ids, no size gain).

## R-02 — Identity of the active `Instrument`

- **Decision**: `presetInstrument(id, fretCount)` memoizes by `${id}|${fretCount}` and returns
  frozen objects; `presetInstrument('AF-1', 22) === STANDARD_GUITAR`.
- **Rationale**: both stores' `useInstrument` and `Fretboard` effects compare instruments by
  identity (`next === instrument`). A stable identity per configuration makes "Confirm with
  nothing changed" a no-op for free and keeps existing fixture code (`inst !== STANDARD_GUITAR`)
  valid. 11 × 13 = 143 possible objects, negligible memory.
- **Alternatives considered**: structural equality checks in every consumer (rejected: touches
  many files, easy to miss one).

## R-03 — Shape of the app-wide instrument state

- **Decision**: Pure module `src/lib/state/instrument-config.ts` (types `InstrumentConfig`,
  `PanelState`, transitions `openPanel`, `selectTuning`, `stepFrets`, `setFrets`,
  `restoreDefault`, `cancel`, `confirm`) plus a runes singleton
  `src/lib/state/instrument.svelte.ts` that holds `{ active, panel, adjustedIn }` and
  orchestrates confirm across the `notes` and `triads` stores.
- **Rationale**: mirrors ADR 0008 (pure transitions + thin runes store), keeps view state out
  of components (Principle III), survives in-app navigation and resets on reload as a module
  singleton (FR-018) with no storage write. The store is the single owner of the active
  instrument; tool stores receive it via an `applyInstrument` call, never read it themselves,
  so their existing unit tests stay valid.
- **Alternatives considered**: a Svelte context provided from `+layout.svelte` (rejected: tool
  stores are module singletons and cannot read context); each tool store owning its own
  instrument copy driven by an effect (rejected: effects make the "adjusted" flag and the
  single `playback.stop('instrument')` racy).

## R-04 — Revalidation and the "adjusted" signal (FR-013)

- **Decision**:
  - Notes: new pure `adaptNotesView(s, prev, next): { view, adjusted }` in `notes-view.ts`.
    If `s.region` was the whole neck of `prev` (`start === 0 && end === prev.fretCount`) the
    region becomes `0..next.fretCount` with `adjusted = false`; otherwise the existing
    `revalidate(s, next)` runs and `adjusted = (result !== s)`. Region extension on a fret
    count increase never adjusts. A card on a position past the new last fret closes
    (adjusted).
  - Triads: `triads.useInstrument` stops resetting the view (current placeholder behavior
    from 005) and calls the existing `revalidate(s, next)`, which keeps root, quality,
    inversion, string set and view and clamps `occurrence` to the highest remaining one;
    `adjusted = (result !== s)`. With no shape at all, occurrence becomes 0 and the
    model's existing EC-5.1 guidance renders.
  - Both stores expose `applyInstrument(next): boolean` (returns `adjusted`), which does not
    call `playback.stop` itself; the orchestrator stops playback once with reason
    `instrument`, only when the configuration actually changed.
- **Rationale**: re-uses the clamps already written and tested in 004–007; the only new rule
  is the whole-neck carry-over, which needs the previous instrument and so gets a new
  function rather than a flag on `revalidate`.
- **Alternatives considered**: diffing display models to decide "adjusted" (rejected: a new
  fret layout for the same view would count as adjusted, contrary to the clarification).

## R-05 — Where and how long the adjustment notice shows

- **Decision**: the instrument store keeps `adjustedIn: ToolId | null`. On confirm, it is set
  to the currently displayed tool iff that tool's `applyInstrument` returned `true`; tools not
  displayed are revalidated silently. `NotesTool` and `TriadsTool` render the existing
  `Notice.svelte` (role `status`, polite) with "We adjusted the view to the new instrument"
  while `adjustedIn === tool`. It clears on Dismiss, on the next confirm, on navigation away
  (`beforeNavigate` in the layout already runs on every screen change), and whenever the
  tool's own notice (region notice, compare notices) becomes non-null, so "replaced by any
  later notice" holds and only one notice line is shown at a time.
- **Rationale**: reuses the only notice component (Constitution VII: non-blocking,
  dismissible, ≤ 2 lines, not error red).
- **Alternatives considered**: a global toast region (rejected: new pattern, one use).

## R-06 — Panel surface: native `<dialog>` + responsive CSS

- **Decision**: one `InstrumentPanel.svelte` (in `src/lib/shell/`) mounted once in
  `src/routes/+layout.svelte`, rendering a native `<dialog>` opened with `showModal()` and
  labelled by its heading (`aria-labelledby`). CSS places it as a bottom sheet by default and
  as an inline-end side panel under `@media (min-width: 1024px)` (the same literal used in
  `tokens.css`; custom properties cannot be used in media queries, as `tokens.css` notes).
  - Escape: the dialog's `cancel` event → discard.
  - Outside activation: `click` whose target is the `<dialog>` element itself (backdrop) →
    discard.
  - Close button → discard.
  - Focus: on open, focus the selected preset radio; on close, the store's `opener` element
    gets focus back (the element reference is held in the component, not in state).
  - Tab containment: `showModal()` makes the rest of the page inert, so Tab cycles within the
    dialog (and the browser chrome), Escape always exits (no keyboard trap, WCAG 2.1.2).
- **Rationale**: the native modal dialog provides top layer, inert background, focus
  containment and Escape handling with zero JavaScript dependencies and is supported by the
  last two evergreen versions (constitution "Browsers"). It is the "panel surface" of design
  §5.5, not an interrupting modal for a normal situation: it opens only on explicit request.
- **Alternatives considered**: a hand-rolled focus trap on a `div[role=dialog]` (rejected:
  more code, more a11y risk); separate sheet and side-panel components (rejected: same
  content, only layout differs — CSS is enough, Principle X).

## R-07 — Browser Back closes the panel (FR-009)

- **Decision**: opening calls SvelteKit shallow routing `pushState('', { instrumentPanel: true })`
  from `$app/navigation`; the panel is open iff `page.state.instrumentPanel` is true *and*
  the store's `panel.open` is true. A Back press pops the shallow entry, `page.state` loses the
  flag, and an effect calls `instrument.cancel()`. Every other close (Confirm, Escape, close,
  backdrop) calls the store action and then `history.back()` to remove the shallow entry, so
  after any close the history is exactly as before opening; the URL never changes.
- **Rationale**: the only way to make Back close an overlay without leaving the screen is a
  history entry. Shallow routing does not run the route's `load`, does not change the URL and
  does not count as a screen change. The layout's `afterNavigate` focus-to-`h1` and
  `beforeNavigate` playback stop are guarded so they ignore navigations whose URL path does not
  change (shallow pops), letting focus return to the opener.
- **Alternatives considered**: no history entry (rejected: Back would leave the screen,
  violating FR-009); a `#instrument` hash (rejected: changes the URL, and 008 forbids URL
  state). The temporary shallow entry is recorded in plan Complexity Tracking because spec
  008 says only screen changes add history entries; net history after close is unchanged.

## R-08 — Fret-count control (FR-007)

- **Decision**: `FretStepper.svelte` (in `src/lib/shell/`): a `role="spinbutton"` element with
  `aria-valuemin=12`, `aria-valuemax=24`, `aria-valuenow`, labelled "Frets", flanked by − / +
  buttons (≥ `--target-min` = 44 px). Keys: ArrowUp/ArrowDown ±1, Home → 12, End → 24. The
  − button is `disabled` at 12, + at 24. All changes go through the pure `stepFrets`/`setFrets`
  transitions, which clamp.
- **Rationale**: matches the clarification exactly; no text entry means no invalid input.
- **Alternatives considered**: `<input type="number">` (rejected: allows free text and
  out-of-range typing); a range slider (rejected: poor precision on phones).

## R-09 — Tuning list (FR-003, FR-015)

- **Decision**: a native radio group (`<fieldset>` + `<legend>` "Tuning", one
  `<input type="radio">` per preset). Visible label: preset name + string notes low → high in
  preset spelling ("Half step down · E♭ A♭ D♭ G♭ B♭ E♭"). Accessible name: name plus the notes
  read in full via `spokenNoteList` ("Half step down: E flat, A flat, …"), using a visually
  hidden span; the glyph line is `aria-hidden`. Arrow keys move selection natively (updates
  pending only).
- **Rationale**: native radios give roving focus, checked state and announcement for free;
  focus on open lands on the checked radio, satisfying "focus moves to the selected preset".
- **Alternatives considered**: `role="listbox"` (rejected: more ARIA, same behavior).

## R-10 — Preview fretboard (FR-006)

- **Decision**: reuse the shared `Fretboard.svelte` with a new `variant="preview"` that draws
  the full pending fret count (unlike `thumbnail`, capped at 12), compact metrics, no markers,
  no pointer/keyboard handling, `aria-hidden="true"`, and no description region. Open-string
  labels already come from `instrument.openStrings` (preset spelling).
- **Rationale**: Principle III/"one shared fretboard component" (stack table: Inline SVG, one
  shared component); tools/panel must not draw fretboards. `thumbnail` already proves a
  non-interactive branch exists; the new variant changes only fret cap and label visibility.
- **Alternatives considered**: using `thumbnail` (rejected: caps at 12 frets, so a 24-fret
  preview would be wrong); a separate mini SVG (rejected: second renderer).

## R-11 — Scroll correction when the fret count shrinks (FR-014)

- **Decision**: in `Fretboard.svelte` (interactive variant), a `$effect.pre` records
  `scrollLeft` and the old total width when `instrument.fretCount` changes; after layout, if
  the old `scrollLeft` exceeds the new maximum (`scrollWidth − clientWidth`), the content's
  `min-inline-size` is held at the old width for one animation, `animateScroll` (existing,
  injectable clock) moves to the new maximum over `--duration-short`, then the hold is
  released. Under `prefers-reduced-motion` the token duration is `0s`, so `animateScroll`
  jumps synchronously and no hold is applied. The target is computed by a new pure helper
  `trailingEdgeScroll(layout, viewportWidth)` in `geometry.ts` (unit-tested).
- **Rationale**: without the hold the browser clamps `scrollLeft` instantly when content
  shrinks, so no motion could be shown; with it, motion explains the change (Principle VII)
  and stays within documented durations. Scroll correction never sets the notice (FR-014).
- **Alternatives considered**: accepting the browser clamp (rejected: violates "documented
  motion duration" in the clarification); animating via CSS `scroll-behavior: smooth`
  (rejected: not driven by tokens, not testable with the injectable clock).

## R-12 — Home summary, thumbnails, app-bar entry points

- **Decision**:
  - `InstrumentSummary.svelte` in the home `data-zone="bottom"` slot: one `<button>` with the
    text from `m.instrument_summary_standard()` or `m.instrument_summary_preset({ name })`
    (FR-017). Fret count is not shown.
  - `ToolCard.svelte` passes `instrumentStore.instrument` instead of `STANDARD_GUITAR`
    (FR-008 thumbnails).
  - `ToolLayout.svelte` app bar (zone A) gains `InstrumentButton.svelte` ("Instrument") and
    `TuningBadge.svelte` (a button showing the preset name, rendered iff
    `active.tuningId !== 'AF-1'`; accessible name "Tuning: Drop D. Open instrument panel").
  - All three call `instrument.open(openerElement)`.
- **Rationale**: matches FR-001/FR-011/FR-017; a visible button instead of a bar menu is the
  recorded default (Principle X, no menu for one item).
- **Alternatives considered**: badge as static text plus separate button (rejected: FR-011
  requires the badge itself to open the panel).

## R-13 — Test hooks and fixtures

- **Decision**: keep the existing test-only `__fmInstrument` fixture hook (AF-7, AF-21,
  NC-UNISON, … used by TM-9 screenshots); it keeps calling the tool stores directly and does
  not touch the instrument store, so TM-9 fixtures are unaffected. New E2E tests drive the
  real panel UI instead of hooks. `AF_4` and `AF_7` fixtures are re-expressed as
  `presetInstrument('AF-4', 22)` / `('AF-7', 22)` so fixtures and presets cannot drift
  (a unit test asserts equality of open strings).
- **Rationale**: no change to the released fixture contract (ADR 0004); presets have one
  source of truth.
- **Alternatives considered**: routing fixtures through the panel store (rejected: AF-21 and
  NC-UNISON are not presets in this slice).

## R-14 — Performance and bundle

- **Decision**: no new runtime dependency. Estimated added gzip JS ≈ 3–4 KB (preset table,
  two pure modules, four small components, 25 catalog strings). Confirm recomputes at most two
  display models (already < 100 ms per control change) — inside the 300 ms instrument-change
  budget. `e2e/perf.spec.ts` gains an "instrument change ≤ 300 ms" measurement (Confirm click →
  fretboard re-rendered with new open-string label).
- **Rationale**: Principle VI gates; the instrument-change budget becomes measurable for the
  first time in this slice.
- **Alternatives considered**: lazy-loading the panel (rejected: adds a network dependency
  on first open, conflicts with Principle II "once loaded, no feature depends on network"
  under ADR 0002 single bundle).
