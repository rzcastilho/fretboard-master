# Research: Shape Focus and Connections

**Feature**: `016-shape-focus-and-connections` | **Date**: 2026-10-04 | **Plan**: [plan.md](./plan.md)

The spec's clarify session already settled every product question, so Technical Context
carried no `NEEDS CLARIFICATION`. This file records the technical decisions the plan makes
on top of the spec. Each one was checked against the code on `main` as of slice 015.

## R-01 — Where connections are computed

- **Decision**: add a pure `cagedConnections(occurrences)` to `src/lib/theory/caged.ts`. It
  takes the sorted `ShapeOccurrence[]` that `cagedOccurrences` already returns. For each
  adjacent pair `(i, i+1)`, it returns every `(string, fret)` present in both occurrences'
  `notes`, with its degree and the two shape letters. The result is deduplicated by position,
  so a position shared with both neighbors appears once and keeps both pairs.
- **Rationale**: connections are TM-6.3 and TM-7.2 theory. Principle I requires computing them
  from the configured tuning, strings and frets, and requires table tests. Sorting is already
  done, and starts never tie: shape offsets in a key are 0, 3, 5, 8 and 10 mod 12, so they are
  distinct. A plain adjacent-pair walk is therefore exact. This was checked by hand against
  TM-6.3 and TM-7.2, and every listed anchor falls out with no extra positions.
- **Altered string**: synthesized string-6 chord tones (`alteredString === true`, string 6)
  are excluded before the intersection. The spec says string 6 in an altered tuning has "no
  chord markers" and therefore no rings. G and E are adjacent and both get string-6 tones in
  Drop D, so a naive intersection would ring those positions.
- **Alternatives rejected**: a fixed anchor table (forbidden by Principle I and FR-006).
  Computing in `caged-model.ts` (theory leaking into state, and harder to put under the
  Principle I gate).

## R-02 — Focus representation and resolution

- **Decision**: `CagedFocus = { letter: CagedShapeId; ordinal: number }`, where `ordinal` is
  the 0-based index among the drawn occurrences of that letter (0 = nearest the nut), or
  `null`. All resolution lives in a new pure module, `src/lib/state/caged-focus.ts`:
  - `occurrenceIndex(focus, occs)`
  - `focusOfIndex(i, occs)`
  - `focusFromLetter(focus, letter, occs)`
  - `toggleTagFocus(focus, i, occs)`
  - `stepFocus(focus, dir, occs)`
  - `reresolveFocus(prev, nextOccs)`
  - `stepAvailability(focus, occs)`
- **Rationale**: the spec prescribes letter + ordinal, so a later share link can encode it.
  The functions need occurrences, and `caged-view.ts` must stay instrument-free, so they live
  in a sibling module with no Svelte, DOM or i18n. That keeps them under FR-013 as pure,
  unit-tested logic.
- **Re-resolve rule (key, quality, instrument)**:
  1. Keep the same letter and ordinal if they still resolve.
  2. Otherwise take the same letter's drawn occurrence nearest the old start fret.
  3. Otherwise take any drawn occurrence nearest the old start fret, with the nut side
     winning a tie.
  4. With no occurrence at all (non-compatible tuning), focus is `null`.
- **Alternatives rejected**: storing the start fret, which a key change breaks and the spec
  rules out. Storing an index into the occurrence list, which is unstable across fret-count
  changes.

## R-03 — Where re-resolution runs

- **Decision**: the CAGED store (`caged.svelte.ts`) runs it. Before applying a key or quality
  transition, or an instrument change, it remembers the old focused occurrence (from the
  current `display.occurrences`). It then computes the next occurrences with a new exported
  helper, `cagedOccurrencesFor(view, instrument)` in `caged-model.ts`, and stores
  `reresolveFocus(prevOcc, nextOccs)`. `applyInstrument` now returns `true` when the focused
  occurrence's letter or start fret changed. `instrument.svelte.ts` then sets `adjustedIn =
  'caged'` while the CAGED screen is active, and `CagedTool` shows the existing
  `instrument_adjusted` notice.
- **Rationale**: this matches the existing Notes and Triads "adjust and tell" pattern
  (Principle X) and reuses the same message. View transitions stay pure and instrument-free.
- **Presentation-only changes** (handedness, orientation) go through the existing
  `musicalChanged === false` branch, so focus is kept and there is no notice. Restore at
  startup never shows the notice.
- **Spelling switch** does not touch focus, because occurrences are identical.
- **Temporary standard view** (015): `viewInStandard` and `endTemporary` change the effective
  instrument. Focus is `null` on entry, because the non-compatible tuning cleared it. On exit
  the tuning is non-compatible again, so focus is cleared. No notice is shown, because the user
  asked for the change.

## R-04 — Emphasis, ring and band in the display model

- **Decision**: `buildCagedModel` takes three inputs: the focus, the connections flag and the
  current step transition (`{ positions: Set<"s:f"> } | null`). With focus set, a marker is
  `highlighted` when its position belongs to the focused occurrence or to the transition
  pair, and `dimmed` otherwise. A marker gets `ring: true` when `connections` is on and it is
  a connection, or when it is a transition position. `region = { start, end, align: 'center' }`
  is the focused occurrence's `start..end`. `tags[i].pressed` is set when the tag is the
  focused one, and `tagsInteractive` becomes `true`.
- **New renderer fields** (`src/lib/fretboard/types.ts`, both optional so other tools are
  untouched):
  - `Marker.ring?: boolean`: drawn as an extra `<circle class="connection-ring">` around the
    glyph. It sits inside the marker's `<g>`, so it inherits the marker's emphasis opacity and
    scale. The stroke uses a new `--connection-ring` token (text color, never root, third or
    fifth color), and the width uses `--connection-ring-width`.
  - `DisplayModel.region.align?: 'center'`: the band-change effect then calls a new pure
    `centerScrollTarget(layout, start, end, viewportWidth, maxScroll)` in `interaction.ts`
    instead of `autoScrollTarget`. It animates with `--duration-medium`.
- **Rationale**: FR-002 and Principle VII express state only through the four emphasis levels,
  plus the ring "additional ring around the marker" (design §2). The ring is a shape, not a
  color, so focus and connections are not conveyed by color alone. The existing region band
  (Triads) and its change-triggered scroll are reused, and only the target rule differs.
- **Band span**: the band covers the occurrence's chord fret span `start..end`, as the spec's
  Clarifications define it (C-major E shape = frets 8–10). Acceptance scenario US1-1 says
  "frets 7–10", which is the TM-6.4 *scale* region of E, not its chord span. The plan follows
  the normative Clarification and FR-002 ("chord fret span"). Tests assert `start..end` of the
  occurrence. This is recorded as a spec erratum in plan Complexity Tracking.
- **Alternatives rejected**: a new `connection` emphasis level (violates the four-level
  rule). Coloring connections (color alone, and reuse risk with reserved colors).

## R-05 — Centering and motion duration

- **Decision**:
  - Add `--duration-medium: 500ms` to `tokens.css`, set to `0s` in the reduced-motion block
    beside the other durations.
  - Centering target = `clamp(bandCentre − viewport/2, 0, maxScroll)`, mirrored layouts
    included. The layout already gives mirrored column positions, so the centre comes from
    `layout.columns`. When `maxScroll === 0` (the whole board fits), the target is `null` and
    nothing scrolls.
  - The marker `opacity` and `.shape` `transform` transitions switch to `--duration-medium` for
    emphasis changes, which keeps them within the 500 ms cap. A slide (fret change) is
    unaffected: marker ids are stable, and positions do not move on focus.
- **Rationale**: design §3.5 sets "Focus on a CAGED shape … Medium (up to 500 ms)". Principle
  VII requires durations from tokens. `tokenDuration(el, '--duration-medium')` already returns
  0 under reduced motion.
- **Rapid presses**: the band effect already calls `stopAutoScroll()` before animating, so each
  press retargets.
- **Minimap**: no minimap exists in the codebase yet (FR-3.13 is unbuilt). "The minimap window
  follows" has nothing to follow, so it is N/A for this slice. The minimap slice will read the
  same scroll position.

## R-06 — Step-transition window (FR-008)

- **Decision**: the store keeps `transition = { positions: readonly string[] } | null`. On
  `step(dir)`, it computes the shared positions of the departing and arriving occurrences
  (the same intersection helper as R-01, exported as `sharedPositions(a, b)`). It sets
  `transition` and starts `setTimeout(clear, STEP_WINDOW_MS)` after clearing any pending
  timer. `STEP_WINDOW_MS = 500` is exported from `caged-focus.ts`. A unit test reads
  `tokens.css` and asserts it equals `--duration-medium`, so the token stays the single visual
  source and the constant cannot drift. Reduced motion does not shorten the window (spec). Tag
  and selector jumps, reset, key or instrument changes, and **See all** clear the transition
  immediately.
- **Rationale**: the window is a behavioral timer in state, not a CSS animation, so it cannot
  read a computed style. Tests drive it with `vi.useFakeTimers()`, which satisfies Principle IV
  (deterministic, controlled clock). E2E uses `page.clock`.
- **Alternatives rejected**: putting the timer in the renderer (it would mix state into
  drawing, against Principle III). An `animationend` listener (it never fires under reduced
  motion).

## R-07 — Shape selector and controls placement

- **Decision**:
  - **Zone B**: a `ChoiceGroup` named "Shape", with options `C A G E D` and `all` (label **See
    all**). `ChoiceGroup` gains an optional per-option `disabled` flag: `aria-disabled`, still
    focusable, and arrow keys skip it. Choosing the current value is a no-op (already radio
    semantics).
  - **Zone D**: a **Show connections** switch (`<button role="switch" aria-checked>`) next to
    **Reset tool**.
  - **Zone E**: a new `<section class="e">` with **Previous shape** and **Next shape**, always
    rendered and using `aria-disabled`, never `disabled`, so they stay in the tab order. The
    CAGED-adjusted notice and the rotate notice also go in zone E, following TriadsTool's
    pattern.
  - All of these live in a new `CagedFocusControls.svelte` (selector), plus inline markup in
    `CagedTool.svelte` for D and E.
- **Rationale**: design §4.2–4.3 and the spec. The tool grid already defines area `e` for every
  breakpoint (`tokens.css` `--tool-grid-areas`). Reusing `ChoiceGroup` avoids a new
  segmented-control component (Principle X).
- **Non-compatible tuning**: the selector, step buttons and switch render with
  `aria-disabled`. The switch value is kept.

## R-08 — Tags become toggle buttons

- **Decision**: CAGED sets `tagsInteractive: true` and passes `ontag`. The Fretboard already
  renders `<button aria-pressed>` tags. `.tag` already sets `min-inline-size` and
  `min-block-size` to `var(--target-min)` (44 px), so it meets the touch-target rule with no
  CSS change. Tags are emitted in neck order (sorted occurrences), and DOM
  order equals visual order in right-handed layouts. In mirrored layouts DOM order stays neck
  order, which is the logical reading order. Tag id `"<letter>@<start>"` is mapped back to the
  occurrence index by the store.
- **Accessible name**: the tag text (`cagedTagText`), with pressed state exposed by
  `aria-pressed`.

## R-09 — Announcements and text description

- **Decision**: no second live region. The Fretboard already announces the description politely
  whenever it changes. `buildCagedModel` adds two pieces:
  - A leading focus sentence: `caged_focus_status` ("{shape} shape in focus, frets {lo} to
    {hi}."), or `caged_focus_none` ("All shapes.").
  - A trailing list of ringed connections: `caged_description_connection` ("string {string},
    fret {fret}, {interval}, shared by {a} and {b} shapes").
- **Rationale**: one polite announcement per change, with the focus first, so it is heard
  first. Adding another `role=status` would double-announce (Principle V).
- **Rejected**: a separate CAGED status line. It would be redundant and noisy, and would take
  space in zone B.

## R-10 — Rotate notice (FR-010)

- **Pure rule**: `src/lib/state/rotate-hint.ts` exports:
  - `isPhonePortrait(w, h) = w <= 599 && h > w`
  - `shouldShowRotateHint({ width, height, recorded, shownThisLoad }) = isPhonePortrait(width,
    height) && !recorded && !shownThisLoad`
- **Storage**:
  - `Preferences` gains `rotateHintShown: boolean`, default `false`. The schema uses
    `v.fallback(v.boolean(), false)` under key `rotateHint`, serialized only when `true`. The
    v1 record stays byte-identical for everyone else, and the format version is unchanged
    (same additive pattern as 013's `handedness`).
  - The `preferences` store gains `rotateHintShown` and `markRotateHintShown()`. That method
    writes through `session.remember({ rotateHintShown: true })` and sets a module-level
    `rotateHintThisLoad = true`, which covers unavailable storage (FR-9.5).
  - `erase()` resets to the defaults, so the notice can show again.
  - **Reset tool** does not touch it.
- **Display**: `CagedTool` runs `onMount` and reads `innerWidth` / `innerHeight`. If the rule
  holds, it calls `markRotateHintShown()` immediately and shows `Notice` with `m.caged_rotate_hint()`.
  A `resize` listener hides it once `isPhonePortrait` becomes false. Unmounting (leaving CAGED)
  drops it. Nothing is recorded in other contexts.
- **Rationale**: the spec defines "phone in portrait" numerically, so a pure function with
  explicit numbers is testable without media-query mocks. Preferences already go through a
  Valibot schema (Principle IX).

## R-11 — Playback interaction

- **Decision**: focus, connections and step changes are not musical. They do **not** call
  `playback.stop`. Key, quality, instrument and reset keep their existing stop.
- **Rationale**: the existing `apply()` stops playback because notes change. Focus changes only
  emphasis. Listen on the focused shape (FR-6.17) is out of scope.

## R-12 — Bundle budget

- **Current**: about 90.2 KB of the 92 KB gzip cap (constitution 1.6.0 Sync Report), which
  leaves about 1.8 KB.
- **Estimate**: +1.2–1.7 KB gzip. This covers the focus module, the connections function, the
  model additions, the selector and controls markup, the renderer ring and centering, the
  rotate-hint rule and the new catalog strings. No dependency is added.
- **Mitigation**:
  - Reuse `ChoiceGroup`, `Notice` and the region band.
  - Keep the focus functions small.
  - Measure with `pnpm build && node scripts/check-bundle-size.mjs` after US1 and again at
    the end.
  - If the cap is crossed, stop and raise a MINOR constitution amendment with a Sync Impact
    Report, as slices 010, 013 and 015 did. Do not silently trim behavior. This is listed under
    Complexity Tracking as a watched risk, not a current violation.

## R-13 — i18n scope

- **Decision**: new strings go into `messages/en.json`, the only catalog that exists today.
  The spec's "en, pt, es" is satisfied by Principle VIII's rule that every string lives in the
  catalog "even while only English ships". The pt and es catalogs arrive with the localization
  slice, without logic changes. Shape letters stay literal parameters (014).
- **New keys**:
  - `caged_group_shape`
  - `caged_shape_all`
  - `caged_next_shape`
  - `caged_previous_shape`
  - `caged_show_connections`
  - `caged_focus_status`
  - `caged_focus_none`
  - `caged_description_connection`
  - `caged_rotate_hint`

## R-14 — Test strategy

- **Theory (Principle I gate)**: `tests/unit/theory/caged.test.ts` gains the full TM-6.3 and
  TM-7.2 tables, with exact-set equality ("no other position"), plus:
  - 12-fret C major (D undrawn): no D→C pair.
  - 24-fret C major: the second C→A and similar pairs repeat 12 frets up.
  - Drop D: no string-6 connection.
  - F♯ minor: the C-minor pattern shifted by the key offset.

  `caged.property.test.ts` gains properties over random keys, qualities, fret counts and
  compatible tunings:
  - every connection is a note of both adjacent occurrences;
  - no connection is on an altered string 6 or on string 7;
  - the pattern is transposition-invariant modulo 12 in standard tuning.
- **Pure state**:
  - `tests/unit/state/caged-focus.test.ts`: every transition, step availability,
    re-resolution cases and the ordinal rule.
  - `rotate-hint.test.ts`.
  - The `caged-view` tests are extended for reset and the connection toggle.
- **Model**: `caged-model.test.ts` covers emphasis per focus, rings on and off, transition
  positions, region and pressed tags, and the description sentences.
- **Store**: `caged-store.test.ts` uses fake timers for the 500 ms window, restarts, the
  re-resolve path and the `applyInstrument` return value.
- **Renderer**: `fretboard.test.ts` covers ring drawing and the band centre target.
  `interaction.test.ts` covers `centerScrollTarget`: clamped at both ends, `null` when the
  board fits, and mirrored.
- **Prefs**: `schema.test.ts` (`rotateHint` parse, fallback and serialize omission) and
  `preferences-store.test.ts`.
- **Components**: `ChoiceGroup` disabled options (`choice-group.test.ts`) and
  `caged-tool.test.ts` (controls, switch, aria-disabled steps).
- **Tokens**: `STEP_WINDOW_MS` equals `--duration-medium`.
- **E2E**:
  - New `e2e/caged-focus.spec.ts` covers US1–US4, keyboard, axe and the rotate notice on a
    portrait-phone viewport with `page.clock` for the window.
  - A new TM-9 view 18 screenshot (F♯ minor, connections on) in `e2e/caged-tm9.spec.ts`.
