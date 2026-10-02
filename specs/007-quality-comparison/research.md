# Research: Triads Quality Comparison

**Feature**: `specs/007-quality-comparison/spec.md` | **Date**: 2026-10-02

The stack is fixed by the constitution, so no technology needed choosing. The spec's C1–C17
settle the behaviour. This file records the design decisions the plan depends on, each checked
against the code from features 005 and 006 as it stands on this branch.

---

## R-01 — How the comparison shape is calculated

**Decision**: add a pure function `comparisonFrets(frets, functions, from, to)` to
`src/lib/theory/triad-shape.ts`. It returns the first triad's frets with each differing note
moved on its own string by the semitone difference of its interval
(`QUALITY_INTERVALS[to][fn] − QUALITY_INTERVALS[from][fn]`; the root difference is always 0).
The result may contain frets below 0 or above the fret count, because callers decide what fits.
A second helper, `noteMoves(frets, functions, from, to)`, lists the moves as
`{ index, function, fromFret, toFret, delta }`, with only the notes where `delta ≠ 0`.

**Rationale**:
- One fret is one semitone on any string in any tuning, so moving the fret by the interval
  difference gives exactly the comparison triad's pitch on that string. FR-010 holds by
  construction in every tuning, and the root never moves.
- The TM-5.3 shape is the closest stacking of three distinct pitch classes. Changing the third
  or fifth by at most 2 semitones keeps the three notes in strictly rising order and under one
  octave, because adjacent voices in a closed triad are at least a minor third apart. So the
  result is TM-5.3's comparison shape shifted by a whole number of octaves. This is checked by
  a property test (R-11), not assumed.
- C6, C8 and C10 need "same string, same octave". Running `triadShape` again on the
  comparison triad would give that triad's own *lowest* occurrence, which may sit 12 frets
  away (G minor 2nd inversion on 4-3-2 is 12-12-11, not 0-0-−1), so the pair would have to be
  realigned anyway.

**Alternatives considered**:
- `triadShape(open, comparisonTriad, inv)` and then align octaves. Rejected: it needs two
  searches plus an alignment step, and it hides the "one fret per semitone" lesson the feature
  teaches.
- Computing moves in the state layer. Rejected by Principle III: theory belongs in
  `src/lib/theory`, and Principle I needs table and property tests on it.

## R-02 — Comparison spelling (C2)

**Decision**: the comparison triad is `spellTriad(firstRootSpelling, comparisonQuality)`,
where `firstRootSpelling = effectiveRootSpelling(rootPc, spellingOverride, quality)`. Nothing
new is added to `theory/triad.ts`.

**Rationale**: `spellTriad` already implements TM-4.2 for any root spelling, including double
accidentals (D♭ minor → D♭–F♭–A♭; D♯ augmented → D♯–F𝄪–A𝄪). Sharing the root spelling keeps
the root letter fixed, so only the altered notes differ (EC-5.9).

**Alternatives considered**: using `defaultRootSpelling(rootPc, comparisonQuality)`. Rejected
by C2, because D♭ major compared with minor would read C♯–E–G♯ and the root would look as if
it moved.

## R-03 — Where the Compare state lives (FR-018, C16)

**Decision**: `TriadsViewState` gains
`compare: { readonly on: boolean; readonly quality: Quality | null }`.

- `quality` is kept while Compare is off, so turning it back on can reuse it (C3).
- `resetTriads` returns `{ on: false, quality: null }`.
- `equalsTriadsView` compares both fields.
- The state is not written to local storage or links in this slice.

Invariant: `on ⇒ quality !== null && quality !== state.quality`.

**Rationale**:
- ADR 0008 already puts tool view state in `src/lib/state` as pure transitions. The store
  only applies them.
- Using `null` rather than a sentinel quality lets **Reset tool** really "clear the
  remembered comparison quality".

**Alternatives considered**:
- Component-local `$state` in `TriadsTool`. Rejected by Principle III (view state outside
  tool components) and FR-018.
- Storing the full comparison pair. Rejected: it is derived data and belongs in the display
  model.

## R-04 — Transitions and the swap rule (C3, C5, FR-011)

**Decision**: new pure transitions in `triads-view.ts`.

- `setCompare(s, on, i)`:
  - Turning on sets `quality` to `s.compare.quality` when that differs from `s.quality`,
    otherwise to `ONE_NOTE_PARTNER[s.quality]` (major→minor, minor→major, diminished→minor,
    augmented→major).
  - Turning off keeps `quality`.
  - Both directions clamp `occurrence` (R-05).
  - It is a no-op in All notes and when the value is unchanged.
- `setCompareQuality(s, q, i)` rejects `q === s.quality`, invalid values, and calls made
  while Compare is off. Otherwise it clamps `occurrence`.
- `setQuality(s, q)` keeps `occurrence = 0`. When Compare is on and `q === s.compare.quality`,
  it also sets `compare.quality = s.quality`, which is the swap. A swap with Compare off is not
  needed, because C3 re-validates the remembered quality when Compare turns on.
- `selectRoot`, `switchSpelling`, `setInversion` and `setStringSet` leave `compare` alone,
  so the comparison is recalculated from the derived model (US4).
- `setView` leaves `compare` alone. All notes pauses the comparison: the model ignores it
  there (US2-2, US2-3).

The swap notice is not view state, because it is a one-off event. The store detects it by
comparing states (`next.compare.quality === prev.quality && next.quality === prev.compare.quality && next.compare.on`)
and keeps `notice: { kind: 'compare-swapped'; quality } | null` in its own module `$state`.
The notice clears on the next applied transition or when dismissed. It is rendered with the
existing `shell/Notice.svelte` (non-blocking, dismissible, one line, `role="status"`).

**Alternatives considered**:
- Rejecting the quality change. Rejected by C5 and constitution X ("adjust and tell").
- Turning Compare off on a collision. Rejected: US4-2 requires that Compare stays on.

## R-05 — Octave occurrences with Compare on (C6, C7)

**Decision**:
- In `triads-view.ts`, `occurrenceCount(s, i)` becomes Compare-aware.
- When Compare is on and the view is Isolated, the count is the number of **pair
  occurrences**: first-triad occurrences `occs[k]` whose comparison frets
  (`comparisonFrets(occs[k], …)`) all lie in `0…fretCount`.
- When there are no pair occurrences (C7), it falls back to the first-triad occurrence count.
  The octave commands then step through first-triad occurrences, which keeps them useful on
  short boards, and off-board arrows mark the missing notes.
- `octaveUp`, `octaveDown` and `revalidate` already use `occurrenceCount`, so they pick this
  up with no further change.
- The same pair list is exported as a pure helper `pairOccurrences(firstOccs, functions, from, to, fretCount)`
  from `triad-shape.ts`, so the view and the model share one calculation.

**Rationale**:
- Index 0 of the filtered list is the lowest octave where both triads fit. So "if a
  comparison note is below fret 0, show k+1" happens naturally.
  Reference: G major 2nd inversion on 4-3-2 gives occs `0-0-0` and `12-12-12`; the pair at
  k=0 has minor at `0-0-−1` and is dropped; the pair at k=1 has minor at `12-12-11` and is
  kept.
- A pair that fits always satisfies "both in the same octave" (US3-3).

**Alternatives considered**: shifting only the comparison triad up. Rejected by FR-004, which
forbids showing one triad in each octave.

## R-06 — Full neck pairing (C8, FR-012)

**Decision**:
- In `fullNeck()`, every `ChainShapeView` gains `comparison: { frets, moves }`, computed with
  `comparisonFrets` on the shape's own frets. Shapes are never filtered or shifted.
- Comparison notes inside `0…fretCount` become dashed markers and on-board arrows.
- Notes outside the board become off-board arrows (R-08).
- Tags, auto-scroll and the chain itself are unchanged, so Compare does not add or hide
  shapes.

**Rationale**: the chain already contains every +12 occurrence (006 C1), so shifting would
duplicate a shape.

## R-07 — Marker identity and motion (FR-013, C15)

**Decision**:
- `Marker` gains an optional `id`, a stable identity. Triads sets it to
  `${scope}:${role}:${function}@${shapeKey}`, where `scope` is `'iso'` or the chain shape id,
  `role` is `'first'` or `'cmp'`, and `shapeKey` is `${s.rootPc}:${s.inversion}:${s.stringSet}`.
  `shapeKey` does not depend on quality, so a quality change keeps the id and the marker slides.
  A root, inversion or string-set change changes the id, so markers are re-created as today
  (US5-4: those changes keep their existing motion rules).
- In `Fretboard.svelte`, the keyed `{#each}` keys on `mk.pulse?.id ?? mk.id ?? key`.
- The marker `<g>` moves its position from the SVG `transform` attribute into
  `style:transform="translate(xpx, ypx)"`, with `transition: transform var(--duration-short) var(--ease-standard)`.
- Result: a marker whose identity survives a quality change but whose fret changed slides
  from its old cell to the new one, and markers whose position did not change are neither
  re-created nor moved.
- Comparison markers and arrows fade with Svelte `fade`. The duration comes from the existing
  `scrollDuration()` token reader, generalised to `tokenDuration('--duration-short')`, which
  returns 0 under `prefers-reduced-motion`.
- Arrows and dashed outlines of a *changed* comparison appear after the slide. This uses
  `delay = duration`, which is 0 with reduced motion.

**Rationale**:
- Today markers are keyed by position, so a note that moves is destroyed and re-created. That
  breaks C15 ("only the note that changes moves").
- CSS transitions on `transform` are compositor-friendly, and the token already becomes `0s`
  under reduced motion (tokens.css), so no hard-coded durations are needed (FR-020).
- Markers without an `id` (Notes tool, All notes) keep today's position keys, so this change
  is backwards compatible.

**Alternatives considered**:
- Svelte `animate:flip`. Rejected: it works on HTML layout boxes, not SVG transforms.
- A JS tween per marker. Rejected: it adds code with no gain over a CSS transition.

## R-08 — Arrows in the display model (FR-007, FR-004, FR-2.6)

**Decision**: `DisplayModel` gains `arrows?: readonly FretboardArrow[]`, a union of two kinds.

- On-board: `{ kind: 'move', id, string, fromFret, toFret, label }`.
- Off-board: `{ kind: 'off-board', id, string, fromFret, edge: 'nut' | 'end', label }`,
  where `label` is the note name produced by `notation.noteLabel`.

The renderer draws them, so handedness and orientation stay inside the renderer
(Principle III):
- An on-board arrow is a line between the two cell centres, offset above the marker row and
  inside the string's row. Its arrowhead points at the `toFret` cell, and the label is
  centred above it.
- An off-board arrow runs from the first-triad marker to the layout edge of that string. With
  `edge: 'nut'` it points to the open-string column side; with `edge: 'end'` it points past
  the last column. The note name sits at the edge.
- Because positions come from `layout.columns`, a mirrored layout (left-handed) flips the
  arrowheads automatically.

Arrow stroke and arrowhead use the existing `--color-text` and `--marker-stroke` tokens, and
the label uses the marker-label type tokens. None of the root, third or fifth colours are used
(FR-020, reserved-colors test).

**Rationale**:
- The model speaks in musical terms (string, fret), as the constitution requires.
- `geometry.screenOrder` is still the single place orientation is read, so the
  "toward the nut / body" wording in descriptions stays orientation-independent (C9).

**Alternatives considered**:
- Drawing arrows in `TriadsTool` over the SVG. Rejected: it breaks Principle III (tools must
  not draw the fretboard) and would need screen coordinates.
- Encoding arrows as special markers. Rejected: one marker per position cannot express a line
  between two positions.

## R-09 — Dashed comparison markers (FR-006, FR-008)

**Decision**:
- `Marker` gains `variant?: 'comparison'`. The renderer adds class `comparison`, which keeps
  the function fill and shape and draws the glyph outline with `stroke-dasharray` built from
  a new token pair, `--marker-dash` and `--marker-dash-gap`.
- In the `prefers-contrast` block, the stroke width rises to the existing contrast width.
- The emphasis stays `highlighted` for the selected pair, or `normal` for other Full neck
  shapes.
- First-triad markers are listed before comparison markers. With C10, shared notes coincide,
  so `firstPerPosition` keeps one solid marker per shared position (FR-005).

**Rationale**: the dashed outline plus the arrow carry the meaning without colour
(Principle V). New tokens are allowed: FR-020 forbids *hard-coded* values, not new tokens.

## R-10 — Listen to comparison (FR-014, C12–C14)

**Decision**:
- The model exposes `listenComparison: { enabled, steps, omitted }`, where
  `steps = [firstPositions, [], comparisonPositionsOnBoard]`.
- The store calls `playback.sequence(steps, LISTEN_BPM, instrument)` and, when `omitted` is
  non-empty, sets the notice `{ kind: 'compare-omitted', notes }`.
- In Full neck the pair is the chain shape with `inversion === s.inversion` and
  `octave === s.occurrence`. If that shape is not shown, the lowest shape of that inversion
  is used (C13).
- Plain `listen()` is unchanged (C14).

**Engine check (C12 "confirm the engine accepts an empty rest step")**: confirmed, and no
engine change is needed. `audio/schedule.ts` `planRequest` computes each step's onset as
`i × beat` from the step *index*. `buildStep` returns `null` for an empty position list, and
`add` skips it. At 120 bpm (`beat = 500 ms`) the plan therefore has two steps:
- onset 0, duration 500;
- onset 1000, duration 500.

Its marks run 0–500 and 1000–1500 ms. A new schedule unit test pins this, so a later refactor
cannot compact the rest away.

**Playback stop (FR-015)**: every transition that changes the view state already goes through
`apply()`, which calls `playback.stop('view')`. Compare on/off and comparison-quality changes
are view-state changes, so they stop playback with no extra code.

## R-11 — Test strategy for theory (Principle I)

**Decision**:
- **Table tests** (`tests/unit/theory/triad-compare.test.ts`):
  - The SC-001 matrix: 12 roots × 3 inversions × 4 string sets (6-string standard) × the
    12 ordered quality pairs. Major↔minor moves exactly the third, ±1. Minor↔diminished moves
    exactly the fifth, ±1. Major↔augmented moves exactly the fifth, ±1. The other pairs move
    the notes their intervals imply (dim↔aug: third +1 and fifth +2).
  - The TM-9 sample 10 reference: G major 2nd inversion on 4-3-2 gives the pairs 12-12-12 and
    12-12-11.
  - C2 spellings: D♭ minor is D♭–F♭–A♭, and D♯ major vs augmented gives A♯→A𝄪.
- **Property tests** (`triad-compare.property.test.ts`, fast-check) use the existing
  random-tuning generator (three adjacent strings, strictly rising, span < 12). For every
  quality pair:
  - comparison pitches are strictly rising;
  - they have the comparison triad's pitch classes;
  - the bass is the inversion's bass function;
  - `comparisonFrets − triadShape(cmp).frets` is the same multiple of 12 on all three strings;
  - the root delta is 0.
- The existing TM-4.2, TM-4.3, TM-5.5 and chain suites keep gating.

## R-12 — Screen-reader description (FR-016, C17)

**Decision**:
- When a comparison is shown, the model replaces `DisplayModel.description` with
  `triads_desc_compare`. This is built from catalog fragments: names, shared notes, the
  changed notes with direction ("toward the nut" / "toward the body" from the sign of
  `delta`) and size (plural rules), "shown one octave up" when the pair index > 0 for a
  reason other than the user's octave command, and off-board notes ("below the nut" / "past
  the last fret").
- Notes are spelled with `spokenNote`, so accidentals are read in full.
- The Fretboard already announces only when the description string changes, so the comparison
  is announced once per change, not per animation frame.

## R-13 — Composition panel (FR-009, C11)

**Decision**:
- `Composition` gains `comparison: Composition | null` and
  `changed: readonly TriadFunction[]`.
- `CompositionPanel` renders two columns, with CSS grid
  `repeat(auto-fit, minmax(min(100%, var(--panel-column-min)), 1fr))`. They stack at narrow
  widths or 200 % zoom with no media query.
- Changed intervals and notes are `<strong>` and carry a visible `m.triads_compare_changed()`
  text marker. The comparison column heading carries an inline dashed-swatch SVG built from
  the same tokens.
- FR-5.12 (augmented symmetry) and FR-5.13 (characteristic ♭5) render in the column whose
  quality they concern, from the existing `symmetric` and `characteristic` fields.

## R-14 — Message catalog additions (FR-019)

**Decision**: add new keys to `messages/en.json`.
- The catalog has no Paraglide plural variants yet. Singular and plural are separate keys
  (`…_one` / `…_other`), chosen by `count === 1` in the model. That rule is correct for
  English, Portuguese and Spanish.
- A variants-based plural is rejected for now under YAGNI (Principle X), because no second
  use exists.
- Portuguese and Spanish need only the existing glossary process (Principle VIII).

```
triads_compare_toggle                 "Compare"
triads_compare_group                  "Compare with"
triads_compare_listen                 "Listen to comparison"
triads_compare_changed                "changed"
triads_compare_arrow_one              "{count} fret"
triads_compare_arrow_other            "{count} frets"
triads_compare_swapped                "Now comparing with {quality}"
triads_compare_omitted_one            "{notes} is off the fretboard and was not played"
triads_compare_omitted_other          "{notes} are off the fretboard and were not played"
triads_compare_toward_nut             "toward the nut"
triads_compare_toward_body            "toward the body"
triads_compare_off_nut                "below the nut"
triads_compare_off_end                "past the last fret"
triads_desc_compare                   "Comparing {first} with {second}, {inversion}, strings {strings}{shift}. Shared: {shared}. Changed: {changed}.{off}"
triads_desc_compare_shift             ", shown one octave up"
triads_desc_compare_move              "the {function}, {from} on string {string} fret {fromFret} moves {size} {direction} to {to} on fret {toFret}"
triads_desc_compare_off               " {note} is off the fretboard, {edge}."
triads_desc_compare_shared_entry      "{note} on string {string} fret {fret}"
fretboard_comparison_note             "comparison"          (cell-name suffix, contracts/fretboard-model.md F8)
```

The Compare control is not rendered in All notes, so no hint key is needed there (C16).

## R-15 — "Shown one octave up" wording (C17)

**Decision**: the description adds `triads_desc_compare_shift` when the pair is displayed at
first-triad occurrence `k > 0` *and* the first triad's occurrence 0 has no pair, that is when
the octave shift was forced by the comparison (C6). An octave the user chose with **Octave up**
is not described as a shift, which matches the existing Isolated description.

## R-16 — Performance (FR-021, SC-007)

**Decision**: no special work is needed. A comparison adds one `spellTriad` call, a 3-element
fret offset per shape (≤ 8 shapes on 24 frets), and at most 2 arrows per shape. The model
derivation stays well below 1 ms. `e2e/perf.spec.ts` gains a "Compare on" and a
"comparison quality change" timing under the existing 100 ms budget. There is no new
dependency, and the expected bundle growth is under 2 KB gzip.

## R-17 — ADR

**Decision**: write `docs/adr/0010-fretboard-arrows-and-marker-identity.md`. It records the
architecturally significant renderer changes (R-07, R-08, R-09): `DisplayModel.arrows`,
`Marker.id` as the motion identity, and `Marker.variant`.
