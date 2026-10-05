# ADR 0017: CAGED occurrences from the real tuning

- **Status**: Accepted
- **Source**: spec 014-caged-shapes (research R-02, R-03, R-06)
- **Amends**: ADR 0009 (fretboard tags: adds a non-interactive variant)

## Context

The five CAGED shapes (C, A, G, E, D) are fixed drawings. In a tuning whose six highest strings keep
the standard intervals, a shape never changes; only its position on the neck moves with the key.
Later slices (002–006) build on how those positions are computed, and the Fretboard tag strip has to
show shape tags that do nothing yet, because tag focus belongs to a later slice.

## Decision

- **Fixed drawing, start fret from string 6.** `cagedOccurrences(sixOpen, rootPc, quality,
fretCount)` takes the open pitches of strings 6 → 1. It computes `t = pitchClass(sixOpen[0]) − 4`
  (the transposition of string 6 from standard E) and `s = mod(rootPc − t, 12)`. For each shape and
  each octave offset `o ∈ {−12 … +24}` (steps of 12), the candidate frets are `ref + s + o` on the
  non-muted strings. A candidate is kept only when every chord fret lies in `0…fretCount`. Results
  sort by lowest chord fret, which reproduces the cycle C → A → G → E → D. "Below the nut → next
  octave" needs no special case. (R-02)
- **Interval-based tuning class.** `cagedTuningClass(sixOpen)` classifies from the five intervals
  between consecutive strings among the six highest: `[5,5,5,4,5]` is `compatible`; standard
  strings 5 → 1 with a changed string 6 is `altered-string`; anything else is `non-compatible`. It
  takes pitches, not an `Instrument`, so the theory boundary holds. Custom tunings and seven-string
  instruments are covered by the same rule (strings 6 … 1 are passed, string 7 is ignored). Only
  `compatible` draws shapes in this slice. (R-03)
- **Non-interactive tags.** `DisplayModel.tagsInteractive?: boolean` (default `true`). When
  `false`, `Fretboard.svelte` renders each tag as a `<span class="tag">`, not a `<button>`: same
  measured width, `layoutTags` placement, tokens and edge rules (ADR 0016 mirroring and
  orientation), but no `aria-pressed`, no click handler, not in the Tab order. The strip keeps
  `role="group"`. CAGED sets it to `false`; Triads is unchanged. (R-06)

## Consequences

- One pure function fixes every occurrence from string 6's pitch class, so all twelve keys, both
  qualities and the 24-fret second cycle are table-testable without a DOM.
- Custom and seven-string tunings need no preset-id table.
- Slices 002–006 can add altered-string behaviour and tag focus without changing these functions;
  tag focus later flips `tagsInteractive` for CAGED.
- No Tab stop exists that does nothing (an accessibility defect avoided).

## Alternatives considered

- **`triadShape` per string set** (R-02): finds triads, not chord shapes, and cannot express muted strings.
- **Absolute-pitch search from each shape's root string** (R-02): same result, more code, and it depends on the chosen root string.
- **Preset-id lookup for tuning class** (R-03): misclassifies custom tunings.
- **Boolean "compatible"** (R-03): slice 002 would need a second function; the three-way enum costs nothing.
- **CAGED-only tag overlay outside `Fretboard`** (R-06): duplicates the layout and 013 mirroring, and breaks "tools don't draw the fretboard".
- **Disabled buttons** (R-06): announced as unavailable controls, which misleads.

## Addendum: scale region and real-pitch layer notes (spec 017-caged-layers)

- **Source**: spec 017-caged-layers (research R-01, R-02, R-04, R-05)
- **Scale region on occurrences.** `ShapeOccurrence` gains `region: { start; end }`, the fret window
  of the shape's scale pattern. It comes from `SCALE_REGIONS[quality][shape]` plus the same shift and
  octave offset that place the chord frets. It is not clipped to `0…fretCount`, so a region may
  start below the nut or end past the last fret; the renderer omits notes outside the neck and the
  occurrence is still drawn. Chord frets keep their "all inside `0…fretCount`" rule. (R-02)
- **Layer notes from real pitch.** Within a region, a position belongs to a layer when its real
  pitch class (open pitch + fret) is in the scale. Arpeggio and Pentatonic are degree filters of the
  same pattern. Altered string 6 (Drop D) and string 7 of a seven-string instrument need no special
  code: each uses its own open pitch, so string 7 repeats string 2's frets in standard tuning and
  string 6 follows its real tuning. (R-01, R-04, R-05)
- **Boundary.** `src/lib/theory/caged-layers.ts` imports only `./pitch`, `./triad` and `./caged`
  (Principle I).
