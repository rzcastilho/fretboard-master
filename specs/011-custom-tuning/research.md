# Research: Custom Tuning (011)

Phase 0 output for [plan.md](./plan.md). Every Technical Context item was known from the
repository (slices 009 and 010 already ship the instrument panel, preset tunings and the
preferences record), so no open unknown remained. The items below record the design
decisions this slice needs, each with the rejected alternatives.

## R-01 — How a tuning is represented in the instrument config

- **Decision**: Replace `InstrumentConfig.tuningId: TuningId` with
  `InstrumentConfig.tuning: Tuning`, where
  `Tuning = { kind: 'preset'; id: TuningId } | { kind: 'custom'; offsets: Offsets }` and
  `Offsets` is a frozen 6-tuple of integers −7…+4 (strings 6 → 1, low → high). A `custom`
  value is **never** created for offsets that match a preset: every constructor goes through
  `tuningFromOffsets(offsets)`, which returns the preset when one matches (canonical form,
  spec Clarification "matched custom tuning is the preset").
- **Rationale**: One representation per tuning makes equality (`equalsConfig`), the badge rule
  ("not Standard"), the summary, storage and the "no-change confirm" rule correct by
  construction. A tagged union keeps the existing preset path untouched and lets TypeScript
  force every consumer (badge, summary, panel, prefs) to handle `custom`.
- **Alternatives considered**:
  - *Keep `tuningId` and add `offsets: Offsets | null`*: two fields that can disagree
    (`tuningId: 'AF-4'` with non-zero offsets); every reader must know which wins. Rejected.
  - *Store only offsets for every tuning (presets included)*: loses the preset's own spelling
    (Half step down must show E♭, not D♯) unless the spelling is re-derived by matching on
    every read. Rejected: spelling is stored per preset (009 FR-005), and the union already
    gives that for free.
  - *Store six absolute `SpelledPitch` values*: forces range validation in pitch space and a
    spelling choice at storage time. Offsets are smaller, trivially range-checked, and map
    1:1 onto the spec's −7…+4 rule.

## R-02 — Matching a custom tuning to a preset

- **Decision**: `matchPreset(offsets): TuningId | null` compares the six offsets with each
  preset's offsets (`presetOffsets(id)`, derived once from `pitchOfSpelling(preset string) −
  pitchOfSpelling(standard string)`). Comparison is by pitch (semitone integers), never by
  spelling. First match in display order AF-1 … AF-11 wins (presets are pairwise distinct, so
  at most one matches; a unit test asserts that).
- **Rationale**: Offsets are already pitch differences, so matching is an integer tuple
  compare — trivially fast (11 × 6 comparisons) and independent of notation.
- **Alternatives considered**: comparing spelled pitches (would miss G♯ vs A♭ — explicitly
  forbidden by the edge case "spelling never affects matching"); a lookup map keyed by the
  joined offsets string (no measurable gain for 11 entries; one more structure to keep in
  sync).

## R-03 — Spelling of an unmatched tuning (sharps until the accidental preference exists)

- **Decision**: Move the sharp-spelling table now private to `src/lib/notation/notation.ts`
  (`SHARP_SPELLINGS`, used by `defaultSpelling`) into `src/lib/theory/pitch.ts` as
  `sharpSpelling(pc: PitchClass): Spelling`, plus `spellSharp(p: Pitch): SpelledPitch`
  (octave = `octaveOf(p)`; the table never uses B♯/C♭ so the letter octave equals the sounding
  octave). `notation.defaultSpelling` delegates to it, keeping its public behaviour. The
  custom instrument's `openStrings` use `spellSharp`; a matched tuning uses the preset's own
  `SpelledPitch` values.
- **Rationale**: `src/lib/instrument/**` may not import `$lib/notation/*` (eslint
  `no-restricted-imports`), and must produce `SpelledPitch` values for `Instrument.openStrings`.
  The spelling *data* (letter + accidental) is theory; turning it into text stays in
  `notation` (Constitution VIII). With two real users (notation and instrument) the shared
  function satisfies Principle X's "two uses" rule.
- **Alternatives considered**: duplicating the 12-entry table in `instrument` (two sources of
  truth for the sharp rule); letting `instrument` import `notation` (breaks the lint boundary
  and drags Paraglide into a pure module); spelling at render time in components (violates
  "same spelling feeds every tool's open strings").
- **Future hook**: when the accidental preference ships (005-languages-and-notation/002), the
  spelling function becomes a parameter of `customInstrument`; this slice does not add that
  parameter (YAGNI).

## R-04 — Pending state while the panel is open

- **Decision**: `PanelState` open variant gains `customOpen: boolean`.
  `pending.tuning` holds the canonical tuning (so the tuning-name line is simply
  `pending.tuning.kind === 'preset' ? presetName : 'Custom'`). New pure transitions in
  `src/lib/state/instrument-config.ts`:
  `chooseCustom(p)` (sets `customOpen: true`, keeps the pending tuning),
  `stepString(p, string, delta)` (no-op outside Custom or past a limit),
  and the existing `selectTuning(p, id)` sets `customOpen: false`. `restoreDefault` sets
  Standard and `customOpen: false`. `openPanel` sets `customOpen` to
  `active.tuning.kind === 'custom'` (reopening an unmatched tuning shows the rows; a matched
  one selects the preset with rows hidden).
- **Rationale**: "Custom stays selected for the rest of the panel session even when the
  pitches match a preset" cannot be derived from the tuning alone, so it is one explicit flag.
  Adjustments live only in `pending`, so Cancel/Escape/Back discard them through the existing
  `cancelPanel` (FR-006) with no new code path.
- **Alternatives considered**: keeping separate "custom offsets" alongside a preset selection
  (the spec rejects hidden state: choosing Custom again restarts from the preset); storing the
  flag in the component (breaks Principle III "view state outside components" and makes the
  transitions untestable without a DOM).

## R-05 — Playing a string from the panel

- **Decision**: The panel calls `playback.note({ string: n, fret: 0 }, instrument.preview)`
  from the click/keydown handler of the lower/raise/note button, after the state transition,
  using the **pending** instrument (so the sound is the new pitch). A transition that is a no-op
  (disabled control at a limit, defensive double-check) plays nothing. `playback.note` already
  interrupts the previous sound (FR-7.9), applies mute/volume, and unlocks audio on the gesture.
- **Rationale**: Reuses the single playback entry point; no engine change, no new audio code.
  The pending instrument is a fully valid `Instrument`, so `positionPitch` gives the exact
  pitch shown (`pitchOfSpelling(openStrings[n-1])`), satisfying "note on screen and pitch heard
  agree".
- **Alternatives considered**: a dedicated `playback.pitch(pitch)` API (a new engine request
  kind for one caller; Principle X); playing on `pointerdown` (keyboard parity is simpler with
  `click`, which fires for Enter/Space on buttons).
- **Note**: the preview `Fretboard` (variant `preview`) is not interactive and does not render
  pulses; the main fretboard is inert behind the modal dialog, so a pulse there is never seen.
  No pulse work is planned.

## R-06 — Storage of a custom tuning

- **Decision**: Add the optional field `customTuning` to the v1 record per the 010 extension
  rule (no version bump). `Preferences` gains `customTuning: Offsets | null` (in memory the
  tuning is `tuningId` + `customTuning`, mirroring the record). Valibot schema:
  `v.fallback(v.optional(v.pipe(v.array(v.pipe(v.number(), v.integer(), v.minValue(-7),
  v.maxValue(4))), v.length(6))), undefined)` → invalid becomes `undefined`, i.e. ignored,
  without touching other fields. Read precedence lives in one pure helper,
  `tuningOfPreferences(p): Tuning` (valid `customTuning` → `tuningFromOffsets`, which may yield
  a preset; otherwise `{ kind: 'preset', id: p.tuningId }`). Write: `instrument.confirm`
  calls `preferences.remember({ tuningId, customTuning })` with `tuningId: 'AF-1',
  customTuning: offsets` for a custom tuning and `customTuning: null` (field omitted from the
  serialized record) for a preset. Erase already removes the whole key.
- **Rationale**: Matches the 010 contract exactly; old records have no `customTuning` and load
  unchanged (FR-017); `tuning: 'AF-1'` makes a v1 reader that ignores the new field (a
  downgrade or an older tab) fall back to Standard, which is the spec's stated fallback.
- **Canonical-record check**: `startSession` treats a raw record as "already written" only if
  it re-serializes identically. A stored record with a valid `customTuning` matching Drop D
  re-serializes as `tuning:"AF-4"` without `customTuning`, so the next `remember` rewrites it in
  canonical form — desired.
- **Alternatives considered**: bumping to `version: 2` (forbidden: no existing field changes
  meaning); writing `tuning: "custom"` (an old reader would treat it as invalid and fall back
  anyway, but it changes the meaning of an existing field — the contract forbids that);
  storing absolute pitches (see R-01).

## R-07 — Triads "does not close" for custom tunings

- **Decision**: No new theory or state code. `triadShape` already returns `does-not-close`
  when the three open pitches are not strictly rising (unison or inverted, triad-shape.ts:43),
  `nearestClosingSet` implements **Another set** (005 C11) and returns `null` when no set
  closes (the button is then hidden), and `revalidate` only moves the string set when the set
  id is invalid for the string count (always valid with 6 strings), so a tuning change never
  moves the set by itself. This slice adds tests that pin these behaviours under custom
  tunings (US4 scenarios 2–4, 7–8; SC-005).
- **Rationale**: Reuse is what the spec's assumption asks for; the code paths are already
  covered by the 005/006 property tests on random tunings (NFR-9.3).

## R-08 — "See all notes" destination (spec wording vs shipped behaviour)

- **Decision**: Keep the shipped behaviour from 006 C8: **See all notes** switches Triads to
  its **All notes** view (the triad's notes everywhere on the neck), keeping inversion, set and
  occurrence. Tests for US4 scenario 3 assert that behaviour.
- **Rationale**: The spec says the existing guidance mechanism "and its actions" are reused,
  and EC-5.1 / 006 C8 define **See all notes** as the All notes view. FR-014's original draft phrase "open
  Fretboard Notes" contradicts a shipped, tested feature; changing it here would alter the
  beyond-fret guidance too (same button) and widen this slice beyond its source sections.
- **Alternatives considered**: navigating to `/notes` (the Fretboard Notes tool) from the
  guidance — rejected for the reasons above. The spec (FR-014, US4 scenario 3,
  clarification) was amended to this behaviour, so spec, plan and tests agree; the amendment is
  flagged in plan.md Complexity Tracking for reviewer confirmation.

## R-09 — Focus when a control hits its limit (FR-023)

- **Decision**: In the panel component, after a lower/raise click, if the clicked button is
  now `disabled` and was `document.activeElement`, focus that string's note button
  (`tick()` then `.focus()`). Buttons use the real `disabled` attribute (announced as
  "dimmed/unavailable" by screen readers, removed from tab order, click ignored natively).
- **Rationale**: A disabled element loses focus to `<body>` in most browsers, which would drop
  the user out of the dialog flow; the note button is the nearest stable control in the same
  row. `aria-disabled` was rejected because it keeps the button clickable and needs manual
  guards.

## R-10 — Announcements and layout

- **Decision**: The tuning-name line and the order note live in one `role="status"`
  (`aria-live="polite"`) container under the string rows; text from the catalog. The order note
  uses `--color-text-muted` plus an info glyph-free sentence (no error red; not color-only
  because it is text). Each row is a three-column grid (`auto 1fr auto`) with 44 px minimum
  buttons from `--target-min`; at 320 px and 200% zoom the rows wrap the label above the
  buttons via `flex-wrap`, not truncation. Accessible names:
  `m.instrument_string_note_label({ string, note })` → "String 6, D 2" (note via
  `spokenNote` + octave, read in full: "A sharp 3"), `m.instrument_string_lower({ string })`,
  `m.instrument_string_raise({ string })`.
- **Rationale**: Constitution V (polite announcements, accidentals read in full, 44 px
  targets), VII (tokens only, no error red), VIII (catalog only).

## R-11 — Performance and bundle budget

- **Decision**: No new dependency. Added code ≈ 1.5–2.5 KB min+gzip (pure offsets/matching
  module, panel rows, schema field, ~10 catalog messages). Current initial JS is 82.2 KB of the
  85 KB cap (constitution 1.3.0 sync report), so the slice must stay under ≈ 2.8 KB gzip.
  `customInstrument` is memoized like `presetInstrument` (key = offsets + frets) so the preview
  `$derived` does not allocate on every render; one adjustment = one pure transition + one
  preview re-render, far inside the 100 ms budget.
- **Mitigation if the bundle gate fails**: the string-row block is only rendered when Custom
  is chosen, so it can move to a lazily imported `CustomStrings.svelte` without changing any
  contract (dynamic `import()` in the panel). Not planned up front (YAGNI); `pnpm build &&
  node scripts/check-bundle-size.mjs` is run in the quickstart.

## R-12 — ADR

- **Decision**: Record ADR `docs/adr/0014-custom-tuning-canonical-form.md`: tuning as a
  preset | custom union with canonical matching, offsets as the stored form, sharp spelling
  moved to `theory/pitch`. It changes the app-wide instrument store contract from ADR 0012 and
  the preferences record from ADR 0013, so it is architecturally significant.
