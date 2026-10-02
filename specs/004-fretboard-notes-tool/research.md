# Research: Fretboard Notes Tool

**Feature**: `004-fretboard-notes-tool` | **Date**: 2026-10-01 | **Plan**: [plan.md](./plan.md)

Every Technical Context unknown is resolved below. Each entry gives the decision, the rationale,
and the alternatives considered. The codebase facts cited come from the state of `main` after
001–003 (walking skeleton, interactive fretboard, note playback).

---

## R-01 — Where the Notes view state lives

**Decision**: A pure, framework-free view-state module `src/lib/state/notes-view.ts` (types,
initial state, reducer-style transition functions, instrument re-validation) plus a thin runes
store `src/lib/state/notes.svelte.ts` that holds one `NotesViewState` in `$state`, exposes
getters and action methods, and calls `playback.stop('view')` on every view-state change
(FR-012a). The store is a module singleton, so it survives in-app navigation away from `/notes`
and back, and a reload starts fresh (FR-019, clarification "View state lives in an in-memory
store").

**Rationale**: Constitution III requires view state outside tool components, and the
constitution's stack table puts state in "Svelte runes-based stores in `src/lib/state`". The
existing `playback.svelte.ts` already follows this pattern (module `$state` + exported object +
`reset…ForTests`). Splitting the pure transitions out keeps them unit-testable test-first
without Svelte, and makes them reusable by the future share-link codec (Principle III rationale).

**Alternatives considered**:

- Component-local `$state` in the Notes tool: violates Principle III and loses state on
  navigation.
- SvelteKit `page.state` / URL search params: share links are out of scope (006-sharing), and the
  link codec would need schema versioning (Principle IX) that does not exist yet.
- A generic "tool store" factory: only one tool has view state now; Principle X forbids the
  abstraction before a second real use (Triads is 005).

---

## R-02 — Where the position classification and display model are computed

**Decision**: A pure module `src/lib/state/notes-model.ts` exports
`buildNotesModel(state, instrument, card) → NotesDisplay`, which returns the fretboard
`DisplayModel` (markers with emphasis, label visibility, octave tone) plus derived facts the
controls need: `missing` notes for the region notice, `listenSteps`, `listenAvailability`,
`highlightedCount`, and the text description. It applies the five-step precedence from the
clarifications (card → hidden → filter-dimmed → highlighted → background normal/dimmed) in
exactly that order over `allPositions(instrument)`.

Instrument-level queries that are pure pitch arithmetic go into `src/lib/instrument/instrument.ts`:
`positionsWithPitchClass(instrument, pc)` and `unisonsOf(instrument, position)` (ordered by string
ascending, then fret). They use `positionPitch` + `pitchClass` from `theory`, so tools never do
pitch math (Principle III "Tools MUST NOT calculate theory").

**Rationale**: Data flows control action → view state → display model → fretboard render
(Principle III). The model builder is the single place where Notes rules live, so every
acceptance example (G octave tones, A3 unisons, C♯ widen, empty guidance) is a table test on one
pure function. The instrument additions are the "two real uses" test passed already (Notes card +
Notes highlighting; Triads will also need occurrences).

**Alternatives considered**:

- Classifying inside `Fretboard.svelte`: the renderer must stay tool-agnostic (ADR 0005); Triads
  and CAGED use different rules.
- Putting classification in `theory`: `theory` must not know presentation concepts such as
  emphasis or filters (Principle III).

---

## R-03 — Fretboard renderer extensions needed

The current `DisplayModel` (`markers`, `labelMode: 'note' | 'none'`, `summary?`) cannot express
five clarified behaviors. **Decision**: extend the model with optional, backwards-compatible
fields; every existing caller keeps working unchanged.

| Need (spec) | Current renderer | Extension |
|---|---|---|
| Octave label type "A3" on every labeled position (FR-005) | `labelMode` only `'note' \| 'none'` | `LabelMode` adds `'octave'`: label = `notation.pitchLabel(spelling, octaveOf(pitch))` |
| Selection-dimmed positions keep their label, filter-dimmed never (FR-003) | label only on `highlighted`/`normal` | `Marker.label?: boolean` overrides the default rule (`true` → labeled even when dimmed, `false` → never) |
| Same-octave tone + small octave number (FR-004) | none | `Marker.tone?: OctaveTone` (1–7) → class `tone-N` using `--octave-tone-N`; `Marker.octaveBadge?: boolean` draws the small octave number beside a Name label |
| Hide names suppresses the hover hint (FR-011) | hover hint always on | `DisplayModel.hoverHint?: boolean` (default `true`) |
| Region shown as a lit band and scrolled into view (FR-008) | none | `DisplayModel.region?: { start; end }` → a `rect.region-band` behind markers in the `drawing` layer; a change of region runs `autoScrollTarget` over the region's two end columns |
| Notes-specific text description (FR-019a) | `describeView` lists highlighted + normal with function names | `DisplayModel.description?: string` replaces the computed description verbatim when present |
| Focus returns to the tapped position when the card closes (FR-010) | roving focus is internal | `Fretboard` exports `focusPosition(p: Position): void` (component export, called through `bind:this`) |

Neutral `highlighted` markers fill with the new `--color-note-highlight` token (design §3.2
"Selection: the accent color of the interface"). `tone-N` overrides the fill. Neither token may
equal `--color-root/third/fifth` (extended `reserved-colors.test.ts`).

**Rationale**: Every addition is drawing-only data in musical terms, so handedness and
orientation still apply only in the renderer (Principle III), and the renderer stays one shared
component (constitution stack). `description` as a verbatim override is simpler than
parameterising `describeView`; Notes is its only user.

**Alternatives considered**:

- A Notes-specific fretboard component: forbidden (one shared SVG component, ADR 0005).
- Putting the label string into each marker (`labelText`): moves note-name formatting into the
  model builder, which is allowed (it can call `notation`), but makes the renderer's existing
  spelling/label path dead for Notes and duplicates `noteLabel` calls. Rejected for a boolean +
  `labelMode`.
- Encoding the region as dimmed markers only: the design requires a lit band (design §6), and
  `background: none` would leave the region invisible.

---

## R-04 — Octave tone tokens and the octave ramp

**Decision**: Seven tokens `--octave-tone-1` … `--octave-tone-7` in `tokens.css` (light, dark,
and `prefers-contrast: more` variants), a fixed lightness ramp of the accent hue, assigned by
octave number clamped to 1–7 (`tone = min(7, max(1, octave))`). Sounding range on supported
instruments is B1 (AF-21 string 7) to E6 (string 1, fret 24), so octaves 1–6 are used; 7 is
reserve for future higher tunings. Every highlighted label carries the octave number whenever
tones are on, so tone is never the only carrier (Principle V). Contrast of the label against
each tone is checked by axe (color-contrast rule) in the TM-9 views.

**Rationale**: "Same octave always gets the same token" (clarification) means a fixed mapping,
not a palette assigned in selection order. A single hue ramp avoids clashes with root/third/fifth
hues (Principle VII).

**Alternatives considered**: Distinct hues per octave (risk of resembling the reserved function
colors and of color-blind confusion); computing colors at runtime (forbidden, tokens only).

---

## R-05 — Octave numbering (string 1 fret 9 = C♯5)

**Decision**: Octave = `octaveOf(positionPitch(...))` from `theory/pitch.ts` (C4 = 60, changes
at C; TM-1.3). In the Widen region example (Clarifications, US3-4), string 1 open is E4 (64),
so fret 9 is 73 = **C♯5**; the spec text was corrected from an earlier "C♯4" typo. Tests
assert the position (string 1, fret 9) and the region result (0–9), and the label is computed
(C♯5). The theory reference is the single source of truth (Principle I).

Verified examples (standard tuning, 22 frets): G2 s6f3; G3 s6f15 s5f10 s4f5 s3f0; G4 s5f22
s4f17 s3f12 s2f8 s1f3; G5 s2f20 s1f15 (12 positions, 4 tones). A3 = s3f2 with unisons s4f7,
s5f12, s6f17.

**Alternatives considered**: Changing the spec text in this phase (the plan phase must not edit
the spec; flagged for `/speckit.analyze`).

---

## R-06 — Widen region algorithm

**Decision**: Pure `widenRegion(state, instrument) → Region` in `notes-view.ts`:

```text
loop:
  missing = selected notes (selection order) with no position on active strings inside region
  if missing is empty: return region
  candidates = positions of missing notes on active strings (frets 0..fretCount)
  pick c minimizing distance = (c.fret < start ? start - c.fret : c.fret - end); ties → c.fret > end
  if c.fret > end: end = c.fret else start = c.fret
```

Each iteration includes at least one new position, so it terminates within fretCount + 1 steps.
**Implementation note (T097)**: the greedy walk above is not minimal (a start extension can become
redundant after a later end extension). The implementation instead enumerates every
`(start' ≤ start, end' ≥ end)` pair and picks the smallest total growth, ties preferring the end.
With fretCount ≥ 12 every string holds all twelve pitch classes, so it always succeeds. Never
touches strings or selection. Property test: for random selections, active-string sets, and
regions, the result contains every selected note, contains the original region, and is minimal
in the sense that shrinking either moved limit by one fret drops a note.

**Alternatives considered**: Jump to whole neck (loses the user's focus); widen symmetrically
(moves limits that need not move).

---

## R-07 — Listen steps and playback integration

**Decision**: `listenSteps(state, instrument) → (Position | Position[])[]` in `notes-model.ts`:
positions of selected notes on active strings within the region, grouped by pitch, sorted by
ascending pitch; equal-pitch positions form one chord step ordered by string number; single
positions are bare `Position`s. The Listen button calls
`playback.sequence(steps, 120, instrument)` (003 contract, 0.5 s per step). Enabled iff
1 ≤ selection ≤ 3 and steps non-empty; otherwise `aria-disabled="true"` with the reason in
`aria-describedby` (`notes_listen_disabled_none`, `…_too_many`, `…_no_positions`). Pressing it
while playing simply issues a new `sequence`, which the engine already treats as interrupt +
restart (FR-7.9). Pulses come from `playback.pulses` as today, so muted Listen still pulses.

**Rationale**: Reuses the 003 API unchanged; no new audio code.

**Alternatives considered**: One position per step even for unisons (the spec says unisons
sound together).

---

## R-08 — Stop-on-change obligation

**Decision**: Every store action that changes selection, label type, background, Hide names,
strings, region, Clear, Reset, and Widen region calls `playback.stop('view')` first (the
obligation recorded by 003 contract `playback-api.md` FR-014). Card open/replace/close does not
call stop; the tap that opens the card calls `playback.note`, which already interrupts a
sequence. No-op actions (e.g. turning off the last string, Clear on a cleared state) do not stop
playback because no state changed.

**Alternatives considered**: An `$effect` watching state and stopping playback (indirect,
fires on mount, harder to test deterministically).

---

## R-09 — Instrument source and the TM-9 test harness

**Decision**: There is no instrument store yet (003-your-instrument). The Notes tool reads
`STANDARD_GUITAR` by default. A test-only global `__fmInstrument: 'AF-7' | 'AF-21' | undefined`,
read once on mount behind `__FM_FAULT_INJECTION__` (ADR 0004 pattern), selects an allow-listed
instrument from `src/lib/instrument/fixtures.ts` (test-build only, like
`src/lib/fretboard/fixtures.ts`). `scripts/check-no-fault-hook.mjs` gains `__fmInstrument` as a
needle so a production build fails CI if it leaks. When the instrument changes (now only via
the harness, later via the instrument panel), the store's `revalidate(instrument)` drops strings
above `stringCount` (all strings if none remain), clamps the region, then applies the push rule
(clarification).

Fixture instruments: AF-7 DADGAD = D2 A2 D3 G3 A3 D4, 6 strings, 22 frets. AF-21 = B1 E2 A2 D3
G3 B3 E4, 7 strings, 22 frets (TM-2). Fret count 22 matches the default instrument, so only the
tuning/string count varies.

**Alternatives considered**: Shipping a tuning catalog now (belongs to 003-your-instrument;
Principle X); a URL parameter (reachable in production, violates ADR 0004).

---

## R-10 — Position card: non-modal panel and focus

**Decision**: `PositionCard.svelte` renders in zone D (grid area `d`, beside the fretboard on
wide screens, below on narrow; the layout tokens already exist). It is a `<section
aria-labelledby>` with a heading (spoken note name), a definition list (octave, string, fret),
the unison list, **See every occurrence**, and **Close**. When it opens from an activation,
focus stays on the fretboard cell (the user may keep exploring with arrows); the card's content
is announced through the fretboard's polite live region via the description. Escape pressed in
zone C or zone D closes the card; Close or Escape returns focus to the tapped cell via
`Fretboard.focusPosition`. No focus trap, no `dialog` role (constitution VII: no modals).

**Alternatives considered**: `<dialog>` (modal semantics forbidden); moving focus into the card
on open (breaks fretboard exploration and the "tap another position replaces the card" flow).

---

## R-11 — Controls: component and ARIA patterns

**Decision**:

| Control | Element | Semantics |
|---|---|---|
| Note selector (zone B) | 12 `<button aria-pressed>` in a `role="group"` | ≥ 44 × 44 px; naturals solid fill, altered outlined + two-spelling label "F♯ / G♭", accessible name "F sharp or G flat"; CSS grid `repeat(6, …)` below 600 px, `repeat(12, …)` above |
| Label type, Show (zone E) | segmented control: `role="radiogroup"` of `role="radio"` buttons with roving tabindex | ≤ 5 options, all visible (design §4.3) |
| Hide names (zone E) | `<button aria-pressed>` | |
| Listen, Clear, Reset tool (zone E) | `<button>`; Listen uses `aria-disabled` + `aria-describedby` | |
| String filter (zone D) | one `<button aria-pressed>` per string, label "1 E" etc.; last active → `aria-disabled="true"` | order follows `screenOrder(instrument)` rows |
| Region filter (zone D) | two `role="spinbutton"` steppers (`aria-valuemin/max/now`, ArrowUp/Down, Home/End) with −/+ buttons; four shortcut buttons | push rule in the store |
| Notices (zone C, above the board) | existing `Notice.svelte` (non-blocking, dismissible, ≤ 2 lines) | region notice carries **Widen region**; empty guidance "Pick a note or tap a fret" |

The note selector is a generic component (`selected`, `ontoggle`) because design §4.3 says "the
same component in the three tools", but it ships in `src/lib/tools/NoteSelector.svelte` with only
the props Notes needs (Principle X).

**Alternatives considered**: native `<input type="radio">` (harder to style as 44 px segmented
buttons consistently; both are acceptable ARIA); `<input type="number">` for frets (spinner
buttons are under 44 px on most browsers).

---

## R-12 — Locale list format and spoken names

**Decision**: The region notice joins missing note names with `Intl.ListFormat(locale,
{ type: 'disjunction' })` ("C♯ or D"), wrapped in a `notation`-level helper
`noteList(spellings)` that uses `noteLabel` for glyphs; spoken variants (description) use
`spokenNote` and `{ type: 'conjunction' }` ("C sharp and E"). `Intl.ListFormat` is available in
all target browsers (last two evergreen majors). Locale = Paraglide `getLocale()`.

**Alternatives considered**: Hand-written "and"/"or" joining (breaks pt/es; Principle VIII).

---

## R-13 — Performance

**Decision**: `buildNotesModel` is O(strings × frets) = at most 7 × 25 = 175 positions; a
`$derived` recompute plus a keyed SVG update is far below the 100 ms control-change budget.
`e2e/perf.spec.ts` gains a "select a note → highlighted markers present" timing under 4× CPU
throttle (constitution VI). Bundle: about 4–6 KB gzip of new JS (store, model, 8 small
components); the existing 80 KB gate in `check-bundle-size.mjs` covers it. No new dependency.

---

## R-14 — Testing strategy

**Decision**:

- Test-first Vitest suites (pure): `instrument` occurrence/unison functions (table + fast-check
  property: every unison has equal pitch, none omitted), `notes-view` transitions (push rule,
  clamp, last-string no-op, Clear/Reset, revalidate, widen), `notes-model` (precedence table over
  the four acceptance examples and every edge case, octave-tone ON/OFF matrix, listen steps,
  description strings).
- Component tests (`@testing-library/svelte`): `NoteSelector`, `StringFilter`, `RegionFilter`,
  `PositionCard`, `NotesActions`, `Fretboard` extensions (octave label, label override, tone
  class, badge, region band, hover-hint off, description override, `focusPosition`).
- Store test: every action calls `playback.stop('view')` exactly when the state changes
  (spy via `resetPlaybackForTests` with a fake engine).
- Playwright `e2e/notes.spec.ts`: every acceptance scenario (US1–US5, 28 scenarios), keyboard-only
  run, axe at 320 px and desktop, and `e2e/notes-tm9.spec.ts` with five screenshot fixtures (TM-9
  views 1–5) per project.
- Deterministic: audio via the existing `__fmAudioLog` hook (assert `sequence` steps and
  pitches), no real-time waits.

---

## R-15 — Message catalog

**Decision**: All new text goes in `messages/en.json` under the `notes_` prefix (≈ 45 keys:
selector names, control labels, card fields, notices, listen reasons, description templates).
`tests/unit/no-raw-text.test.ts` already guards components. Spoken accidental names come only
from `notation.spokenNote` (Principle VIII).

---

## Summary of unknowns

| Technical Context item | Resolved in |
|---|---|
| State location & lifetime | R-01 |
| Display model ownership | R-02 |
| Renderer gaps | R-03 |
| Octave tone tokens | R-04 |
| Octave arithmetic / spec typo | R-05 |
| Widen region | R-06 |
| Listen | R-07 |
| Stop obligation | R-08 |
| Non-default instruments for TM-9 | R-09 |
| Card focus/non-modal | R-10 |
| Control semantics | R-11 |
| List formatting | R-12 |
| Performance | R-13 |
| Testing | R-14 |
| i18n | R-15 |

No NEEDS CLARIFICATION remains.
