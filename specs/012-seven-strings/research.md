# Phase 0 Research: Seven-String Guitars

**Feature**: `012-seven-strings` | **Date**: 2026-10-03 | **Plan**: [plan.md](./plan.md)

The Technical Context had no open clarification entries: the stack is fixed by the
constitution and the spec's Clarifications session settles every product question. Research
therefore covers **how** to fit a string count into the existing code (slices 009–011) without
changing 6-string behavior (FR-019). Each entry: Decision / Rationale / Alternatives considered.

Code surveyed: `src/lib/instrument/{instrument,tunings,custom-tuning,string-sets}.ts`,
`src/lib/state/{instrument-config,instrument.svelte,notes-view,notes.svelte,triads-view,triads.svelte,preferences.svelte}.ts`,
`src/lib/prefs/schema.ts`, `src/lib/fretboard/{geometry,description}.ts` +
`Fretboard.svelte`, `src/lib/shell/{InstrumentPanel,InstrumentSummary,TuningBadge}.svelte`,
`src/lib/shell/tuning-names.ts`, `src/lib/styles/tokens.css`, `messages/en.json`, and the
011 contracts.

---

## R-01 Where the string count lives

- **Decision**: Add `stringCount: 6 | 7` to `InstrumentConfig` (next to `tuning` and
  `fretCount`). `Tuning` keeps its two-variant shape (`preset(id)` | `custom(offsets)`); a
  preset id is resolved **for a count** (`presetStrings(id, count)`), and custom offsets carry
  one entry per string (`offsets.length === stringCount`).
- **Rationale**: AF-3 … AF-11 exist for both counts (FR-003), so a preset id alone cannot
  imply the count. The count is an instrument property in the spec's Key Entities
  ("Instrument: string count, tuning, fret count …") and in DM-5 (`Instrument.stringCount`
  already exists and every consumer — `allPositions`, `stringSets`, `screenOrder`,
  `StringFilter`, `layoutFretboard`, `revalidate` — already loops over it).
- **Alternatives considered**:
  - *Separate 7-string ids for every preset (AF-3/7 …)* — doubles the id space, the message
    catalog and the storage picklist; contradicts the spec's single preset list.
  - *Derive the count from the tuning only* — impossible for AF-3 … AF-11 on 7 strings.

## R-02 Canonical form on seven strings

- **Decision**: Extend 011's canonical form (ADR 0014) per count. The presets **available**
  for a count are: 6 → AF-1 … AF-11; 7 → AF-21, AF-22, AF-23, AF-3 … AF-11 (this is also the
  display order). A `Tuning` is canonical for a count iff a preset id is in that count's list
  and a custom offset array matches none of that list's presets. `tuningFromOffsets(o)` matches
  only against `presetsFor(o.length)`. Hence on 7 strings AF-1/AF-2 never occur (they are
  AF-21/AF-22), and AF-21/22/23 never occur on 6 strings.
- **Rationale**: Gives FR-006 ("pitch equality decides the name; AF-21/AF-22 win over
  AF-1/AF-2") as a structural guarantee instead of a precedence check, keeps `equalsTuning`
  a plain structural compare, and keeps the badge rule trivial (R-07).
- **Alternatives considered**: *Allow AF-1 on 7 strings and rename at display time* — two
  representations of one tuning, breaks `equalsConfig` (Confirm would report a change that is
  none) and the "two rows that select the same pitches" convention violation the spec forbids.

## R-03 Offsets for seven strings

- **Decision**: `Offsets` becomes `readonly number[]` whose length is the string count (6 or
  7), ordered lowest string → string 1, relative to the count's standard pitches:
  6 → E2 A2 D3 G3 B3 E4 (`[40,45,50,55,59,64]`), 7 → B1 E2 A2 D3 G3 B3 E4
  (`[35,40,45,50,55,59,64]`). Range stays −7 … +4 per string, so string 7 spans E1 (28) …
  D♯2 (39) (FR-005). `isOffsets(x, count)` checks length and range. Step functions take a
  `StringNumber` 1 … 7 and are refused for a string above the count.
- **Rationale**: Re-using the 011 integer-offset model keeps custom tuning, matching,
  storage and the property tests unchanged in shape. Because the seventh string is a perfect
  fourth below the sixth in **both** the reference standard (B1 vs E2) and in the 6 → 7 rule,
  adding string 7 is exactly "prepend a copy of string 6's offset" and removing it is "drop
  the first offset" (R-04) — no pitch arithmetic at the boundary.
- **Alternatives considered**:
  - *Absolute MIDI pitches instead of offsets* — would change the 011 storage format and its
    fixtures (forbidden: fixtures only ever added).
  - *Keep the 6-tuple type and add a separate `seventh` field* — two code paths everywhere a
    tuning is iterated; violates "no speculative abstraction" in the other direction (special
    case instead of general array).

## R-04 String-count change semantics

- **Decision**: Pure transition `setStringCount(panel, n)` on the pending config:
  - 6 → 7: `offsets7 = [offsets6[0], ...offsets6]` (string 7 a fourth below the pending
    string 6), then `tuningFromOffsets` (canonical, R-02). Preset spelling for strings 1–6 is
    kept because the result re-matches the same preset (or AF-21/AF-22 for AF-1/AF-2).
  - 7 → 6: `offsets6 = offsets7.slice(1)`, then `tuningFromOffsets`.
  - Same count / invalid n / panel closed → same object (011 no-op convention).
  - `customOpen` is preserved (the string rows simply gain or lose string 7).
  - String 7 is never remembered across 7 → 6 → 7 (clarification).
- **Rationale**: Reproduces every clarification row: Standard → AF-21, Half step down →
  AF-22, Drop D → Drop D (A1 D2 A2 D3 G3 B3 E4), AF-23 → Standard, AF-21 → Standard. Range
  safety: string 6 offset is already in −7 … +4, so the copied string-7 offset is in range —
  no clamping (spec edge case "no clamping is ever needed").
- **Alternatives considered**: *Reset to the count's standard on every switch* — contradicts
  FR-002/UJ-5 3b ("keeps the other six as they were").

## R-05 Spelling string 7 of a 6-string preset

- **Decision**: For AF-3 … AF-11 on 7 strings, string 7 is computed once (memoized) by the TM-4
  letter rule: letter three steps down the letter cycle from string 6's letter (E→B, D→A,
  C→G, …), octave lowered when the cycle wraps below C, accidental = target pitch
  (string-6 pitch − 5) minus that letter's natural pitch. A pure helper
  `fourthBelow(s: SpelledPitch): SpelledPitch` in `src/lib/theory/pitch.ts` does it. AF-21,
  AF-22, AF-23 store their own TM-2 spelling (including B♭1) like the 6-string presets.
  Custom tunings spell with sharps (011 R-03) on every string, string 7 included.
- **Rationale**: Principle I + VIII: spelling is stored per preset or derived by a tested
  theory rule, never formatted by components. For AF-3 … AF-11 the rule yields A1, G1, B1
  (naturals only), matching the clarification. Table test: every AF-3 … AF-11 7-string row
  vs the spec's expected values; property test: `pitchOfSpelling(fourthBelow(s)) ===
  pitchOfSpelling(s) − 5` and letter index differs by 3 for every spelling with |accidental|
  ≤ 1.
- **Alternatives considered**: *`spellSharp` for string 7* — would give A♯1 for a B♭ context
  (AF-22-like custom shapes are custom anyway, but a preset row must not mix spellings).

## R-06 Preset list on the panel

- **Decision**: `presetsFor(count)` returns the ordered list (R-02); `InstrumentPanel.svelte`
  renders it instead of `TUNING_PRESETS`. Each row's notes come from `presetStrings(id,
  count)` (seven notes lowest → highest on 7 strings). New catalog keys `tuning_af21`,
  `tuning_af22`, `tuning_af23` ("7-string standard", "7-string half step down", "Drop A").
- **Rationale**: FR-003 order and the 12-row list are exactly the data; no special rendering
  branch.
- **Alternatives considered**: *Hide AF-1/AF-2 in the component* — puts a domain rule in the
  UI (Principle III).

## R-07 Tuning badge and summary

- **Decision**: `isStandard(t)` becomes "preset AF-1 or AF-21". With canonical form (R-02)
  AF-1 only occurs on 6 strings and AF-21 only on 7, so the badge rule FR-007 needs no count
  argument. `instrument_summary_standard` / `instrument_summary_preset` gain a `{count}`
  parameter; English output for 6 strings is byte-identical ("6 strings · standard tuning ·
  right-handed"), protecting FR-019 and existing tests/snapshots.
- **Rationale**: Smallest change that satisfies FR-007/FR-008 and the summary.
- **Alternatives considered**: *New message keys per count* — duplicate strings for
  translators (Principle VIII prefers parameters).

## R-08 Fretboard rendering of string 7

- **Decision**: Add token `--fb-string-width-7: 0.375rem` (one step thicker than
  `--fb-string-width-6: 0.3125rem`, continuing the existing progression) and a `.string-7`
  rule in `Fretboard.svelte`. Row height stays `--fb-row: 2.75rem` with root markers at
  `--marker-root: 2.25rem`, so neighboring markers keep a 0.5 rem gap regardless of string
  count (FR-009); the board grows by one row (≈ 44 px). Preview and thumbnail rows already
  size by `markerSmall` / `thumbRow` and scale with `stringCount`. `screenOrder` and
  `layoutFretboard` are already count-generic; handedness/orientation are applied only there
  (Principle III), so string 7 follows them automatically.
- **Rationale**: Design §6 "thickness increases from highest to lowest"; tokens only
  (Principle VII). No layout algorithm change → no 6-string screenshot change.
- **Alternatives considered**: *Shrink rows to keep total height* — would make markers touch
  on 6 strings too and break every screenshot fixture.

## R-09 Fretboard Notes string filter on count change

- **Decision**: `adaptNotesView(s, prev, next)` gets a string-count step before its existing
  region/card logic:
  - 6 → 7: if `activeStrings` lists all of `1 … prev.stringCount`, append 7; otherwise leave
    the filter unchanged (string 7 off). Not an adjustment.
  - 7 → 6: drop 7. If that empties the filter, turn on `1 … 6` and mark **adjusted**.
    Dropping 7 from a non-empty filter is not an adjustment.
  - `adjusted` becomes `regionClamped || cardClosed || filterForced`; the current non-whole
    path's `view !== s` test is replaced by those explicit flags so a silent string-7 drop does
    not raise the notice.
- **Rationale**: FR-010 and US2-5/6 exactly; Principle X "never blank; adjust and tell". The
  existing `revalidate` already drops strings beyond the count and re-enables all when empty.
- **Alternatives considered**: *Always add string 7 on* — overrides a deliberate user filter.

## R-10 Triads string set on count change

- **Decision**: No algorithm change. `stringSets(instrument)` already yields
  `[stringCount … 3]` (7-6-5 first on 7 strings), `validSet` accepts `id ≤ stringCount`, and
  `revalidate` clamps an invalid set with `min(set, stringCount)` → 7 becomes 6 (6-5-4) and
  `triads.applyInstrument` reports `adjusted`, which the store turns into the existing notice.
  6 → 7 keeps the set (3 … 6 stay valid). Work is **tests** pinning FR-011 … FR-013, TM-5.5
  7-6-5 table (12 shapes), and the beyond-fret guidance for 7-6-5 at 12 frets.
- **Rationale**: Shapes are computed by `triadShape(setOpenPitches(i, set), …)` from the real
  open pitches (Principle I); verified by hand: AF-21 B1 E2 A2 → C3/E3/G3 = frets 13-12-10;
  E minor E2/G2/B2 = 5-3-2.
- **Alternatives considered**: none needed.

## R-11 Stored preferences

- **Decision**: Add optional `strings` (6 | 7; absent or invalid → 6) to the v1 record
  (010 "Extension rule", 011 precedent); `version` stays 1. Read order: `strings` → `tuning`
  normalized for that count (AF-1/AF-2 with 7 → AF-21/AF-22; AF-21/22/23 with 6 → AF-1) →
  `customTuning` valid only with length = count (else ignored). Writer omits `strings` when 6,
  so every 6-string record is byte-identical to slice 011 output. With 7 and an unmatched custom
  tuning: `"tuning":"AF-21"` + 7 offsets. Details and fixtures in
  [contracts/storage-format.md](./contracts/storage-format.md).
- **Rationale**: Principle IX (per-field fallback, never throw, fixtures only added), FR-016,
  SC-006. Omitting `strings: 6` keeps pre-012 records and new 6-string records identical.
- **Alternatives considered**: *Version 2 record* — unnecessary: the extension rule allows
  optional fields, and a v2 would force a migration path.
- **Version skew**: an older bundle reading a 7-string record ignores `strings`, rejects
  `AF-21` (falls back to AF-1) and rejects a 7-long `customTuning` → loads 6-string standard
  without error. Acceptable and consistent with ADR 0002.

## R-12 Sound

- **Decision**: No audio change. `positionPitch` → `frequencyOf` already covers any MIDI
  pitch; B1 ≈ 61.7 Hz, E1 ≈ 41.2 Hz. Karplus-Strong buffer length grows with lower frequency
  (sampleRate / f ≈ 1 070 samples at 44.1 kHz for E1) — trivial. Test: `playback.note({string:
  7, fret: 0}, AF-21)` requests pitch 35; Drop A → 33 (FR-014).
- **Alternatives considered**: low-frequency boost — out of scope (EC-7.6).

## R-13 Performance (NFR-1.6, Constitution VI)

- **Decision**: Keep the single SVG; 7 × 25 cells = 175 grid cells vs 150 today (+17 %).
  Add a 7-string × 24-fret case to `e2e/perf.spec.ts` (control change ≤ 100 ms, instrument
  change ≤ 300 ms) and to the scroll smoothness check under the throttled phone profile.
  Bundle impact estimated < 1 KB gzip (three presets, one helper, a few messages) against the
  85 KB cap.
- **Rationale**: Constitution explicitly names "7 strings, 24 frets" for scroll smoothness.
- **Alternatives considered**: *Canvas rendering* — forbidden by stack (inline SVG) and
  unnecessary at this scale.

## R-14 Handedness and orientation

- **Decision**: No new work beyond tests. The renderer is the only reader of handedness and
  orientation (`screenOrder`, Principle III) and is generic over `stringCount`; the product
  still ships right-handed / highest-string-on-top only (the summary says "right-handed").
  Unit tests assert `screenOrder` with 7 strings for every handedness/orientation value the
  `Instrument` type admits, so string 7 mirrors correctly when those controls ship.
- **Rationale**: FR-018 is satisfied at the layer where it applies; no speculative UI.
- **Alternatives considered**: *Add handedness controls now* — belongs to a different slice.

## R-15 Architecture record

- **Decision**: Write `docs/adr/0015-string-count-and-seven-string-canonical-form.md`:
  `InstrumentConfig.stringCount`, presets per count, variable-length offsets, the `strings`
  storage field. It amends the contracts of ADR 0012 (store), 0013 (record) and 0014
  (canonical form).
- **Rationale**: Constitution "architecturally significant decisions MUST be recorded as ADRs".
