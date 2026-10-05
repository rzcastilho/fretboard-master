# Research: CAGED Arpeggio, Pentatonic, and Scale Layers

**Feature**: 017-caged-layers | **Date**: 2026-10-05 | **Plan**: [plan.md](./plan.md)

Every decision below resolves an open technical question in the plan's Technical Context. No
open clarification remains. Each entry lists the decision, its rationale and the
alternatives rejected.

---

## R-01 — Layer templates collapse to one region per shape

**Decision**: a shape's layer template (DM-12) is stored as **one fret window per shape and
quality**, `SCALE_REGIONS[quality][shape] = [lo, hi]`, in the same C-key, standard-tuning
reference frets as `CAGED_SHAPES`. The scale pattern of an occurrence is then **every position
on every string whose fret is inside the window and whose real pitch class belongs to the
scale**. Arpeggio and Pentatonic are subsets of that pattern, filtered by degree.

| Quality | C | A | G | E | D |
|---|---|---|---|---|---|
| major | 0–3 | 2–6 | 4–8 | 7–10 | 9–13 |
| minor | 0–4 | 3–6 | 5–9 | 7–11 | 10–13 |

**Rationale**:

- Checked string by string against TM-6.4 (all five major shapes) and TM-7.4 (all five minor
  shapes): in every row, the listed frets are exactly the scale notes inside the window, with
  no extras and no gaps. TM-6.5 and TM-7.5 are the same rows filtered to R 2 3 5 6 and
  R ♭3 4 5 ♭7. For example, the A shape in C major has the window 2–6. String 6 gives G(3) and
  A(5), and F♯, G♯ and A♯ are excluded. String 3 gives A(2), B(4) and C(5), matching TM-6.4.
- This is what Principle I asks for: notes are **calculated from the real tuning** (pitch
  class of `open + fret`), not looked up. Only the window is reference data, and it is anchored
  the same way as the chord shapes (the `shift + octave` placement from string 5, ADR 0017).
- The same rule covers string 6 in an altered-string tuning and string 7 without any special
  case (R-04, R-05).
- 10 number pairs instead of 40 position tables keeps the bundle small (R-13).

**Alternatives rejected**:

- *Hard-coded per-shape, per-layer position tables (literal DM-12)*: 40 tables, about 1 KB
  more gzip, and they would only hold for compatible tunings. String 6 in Drop D would still
  need the pitch-class rule.
- *Generating the pattern algorithmically from "two or three notes per string, no gaps"*:
  ambiguous (several valid 3-notes-per-string fingerings exist), and harder to prove against
  the tables.

## R-02 — Region is part of the occurrence

**Decision**: `cagedOccurrences` adds `region: { start, end }` to each `ShapeOccurrence`,
computed as `SCALE_REGIONS[q][id] + shift + octave`. The region is **not clipped**, so it can
be below 0 or above `fretCount`. Whether an occurrence is drawn is still decided by the
chord frets alone (FR-006, FR-6.4).

**Rationale**: a single placement computation keeps chord and region in lockstep in every key
and tuning. Clipping happens only when notes are generated, so tests can assert TM-6.6
("notes below fret 0 are omitted") directly.

**Alternatives rejected**: a separate `occurrenceRegion(occ, tuning)` that recomputes the
shift. It duplicates the placement rule and risks drift.

## R-03 — Degrees and layer membership

**Decision**: a new theory module `src/lib/theory/caged-layers.ts` defines:

- `ScaleDegree = 'R' | '2' | '3' | 'b3' | '4' | '5' | '6' | 'b6' | '7' | 'b7'`;
- `degreeOf(pc, rootPc, quality)`, which maps the semitone offset to a degree:
  - major: 0 R, 2 2, 4 3, 5 4, 7 5, 9 6, 11 7;
  - minor: 0 R, 2 2, 3 ♭3, 5 4, 7 5, 8 ♭6, 10 ♭7;
  - anything else gives `null`;
- `LAYER_DEGREES[quality][layer]` for `arpeggio`, `pentatonic` and `scale`;
- `layerNotes(occ, openPitches, rootPc, quality, fretCount)`, which returns every scale note in
  the region, as `{ string, fret, degree }`, with frets clipped to `0…fretCount` and sorted
  low to high by pitch;
- `spellScale(root, quality)`, which uses alternate letters (letter index + n − 1) with
  whatever accidental reaches the interval, like `spellTriad`;
- `LAYER_PRIORITY = ['chord', 'arpeggio', 'pentatonic', 'scale']` and
  `isExtraMarked(degree, quality)`, which is true for 4 and 7 in major and for 2 and ♭6 in
  minor.

**Rationale**:

- Membership is a pure function of the degree, so Arpeggio ⊂ Pentatonic ⊂ Scale holds by
  construction, and the property tests can check it.
- Spelling through alternate letters gives correct names in every key. For example, the 7 of
  F♯ major is E♯, and in D♯ minor the 2 is E♯ and the ♭6 is B. This is the same rule as the
  triad, where Principle I requires alternate letters.
- The module imports only `./pitch`, `./triad` and `./caged`, so the theory boundary is
  unchanged.

**Alternatives rejected**:

- *Extending `IntervalId` in `triad.ts`*: this would widen every exhaustive switch in Triads
  for no gain.
- *Computing names with `defaultSpelling`*: this gives wrong spellings, such as A♯ for B♭ in
  F major.

## R-04 — Altered string 6 (FR-017)

**Decision**: no special code is needed. With the R-01 rule, string 6 uses its **real open
pitch**, and the region is placed from strings 5→1 (the existing `shift`). In an
altered-string tuning, Arpeggio, Pentatonic and Scale therefore get string-6 notes for every
shape. The Chord layer keeps the slice-015 G-and-E-only `alteredStringNotes` rule unchanged.

**Check**: Drop D, D major, E shape. The window is 7–10 + 2 = **9–12**. On a string 6 open
D: fret 9 is B (6), fret 10 is C (not in the scale), fret 11 is C♯ (7), fret 12 is D (R,
drawn as Chord because the E shape owns it). Pentatonic shows 9 and 12. Arpeggio adds nothing
new, because 12 is already Chord. This matches the clarify-review anchor.

## R-05 — Seventh string (FR-007, TM-6.7)

**Decision**: string 7 gets layer notes by the same R-01 rule, using its **real** open pitch.
Chord never draws on string 7 (unchanged).

**Rationale**:

- In AF-21 (B E A D G B E) and AF-22 (the same tuning a half step down), string 7 has the same
  pitch class as string 2. The real-pitch rule therefore gives exactly string 2's frets,
  which satisfies TM-6.7 and FR-007's test.
- In AF-23 (A E A D G B E, compatible on the six highest strings) and in custom 7-string
  tunings, copying string 2's frets would draw notes that are not in the scale, which violates
  Principle I. The real-pitch rule stays correct.

**Recorded assumption**: FR-007's wording "using the frets of string 2" is read as the TM-6.7
statement for AF-21 and AF-22, where both readings coincide. *Rejected*: copying string 2's
frets literally, because it is musically wrong in AF-23.

## R-06 — Layers state and the drawable-layer rule

**Decision**: `CagedViewState` gains `layers: LayersOn`, an object of four booleans
(`chord`, `arpeggio`, `pentatonic`, `scale`). It starts as `{ chord: true }` with the rest
false. A new pure module `src/lib/state/caged-layers.ts` owns:

- `drawable(layers, hasFocus)`: a layer is drawable when it is on and, for Pentatonic or
  Scale, a shape is in focus;
- `switchAvailability(layers, hasFocus, hasOccurrences)`: per layer, `enabled` or a reason
  (`last-layer` or `no-shapes`). A switch is disabled when turning it **off** would leave no
  drawable layer (FR-002), or when no occurrence is drawn (non-compatible tuning or no fit);
- `toggleLayer(layers, layer, hasFocus)`, which is total: it is a no-op when the switch is
  disabled and returns the same reference;
- `ensureDrawable(layers, hasFocus)`, which returns `{ layers, restoredChord }`. When nothing
  is drawable it turns Chord back on (FR-002 b) and leaves Pentatonic and Scale on;
- `needsAutoFocus(layer, layers, focus)`, which is true when Pentatonic or Scale goes from
  off to on with no focus (FR-012).

**Rationale**: these are the rules the spec requires to be "pure, unit-tested logic separate
from the interface" (FR-016). They follow the `caged-focus.ts` pattern from slice 016, where
an unchanged result returns the same reference.

**Ordering for auto-focus**: the store first commits `focusOfIndex(0, occurrences)`, then
toggles the layer, so the layer toggle runs with `hasFocus = true`. When no occurrence is
drawn the switch is already disabled, so auto-focus never targets an undrawn occurrence.

**Where `ensureDrawable` runs**: in the store, after every focus clear: `chooseShape('all')`,
`toggleTag` to null, `applyInstrument` (re-resolve to null or non-compatible), `viewInStandard`
and `endTemporary`. Key and quality changes keep focus through `reresolveFocus` when any
occurrence fits, and they also call it.

## R-07 — Position resolution (FR-009, FR-018, EC-3.1)

**Decision**: `resolveCagedPositions(occurrences, focusIndex, layers, ctx)` in
`caged-layers.ts` returns one `ResolvedPosition` per `string:fret`:
`{ string, fret, degree, layer, emphasis, extra }`.

Algorithm:

1. **Focused region first**. When there is a focus, every chord note and layer note of the
   focused occurrence is resolved by priority over the layers that are **on**, among
   `chord > arpeggio > pentatonic > scale`. Its emphasis is `highlighted`. These keys are
   claimed.
2. **Other occurrences**. Their chord notes are drawn only when Chord is on, as `dimmed` with
   focus or `normal` without, and only on keys not already claimed.
3. **Arpeggio without focus**. Each drawn occurrence contributes its arpeggio notes. A key is
   drawn as Chord if **any** occurrence draws it as Chord. Otherwise it is drawn as Arpeggio
   (clarify-review "Without focus, a position in two occurrences' regions").
4. **Pentatonic and Scale** are drawn only from the focused occurrence (FR-012).
5. `extra = layer ∈ {pentatonic, scale} && layers.pentatonic && layers.scale &&
   isExtraMarked(degree)`. Because the layer must be pentatonic or scale, a 4th or 7th drawn as
   Chord or Arpeggio never gets the mark (FR-010).

The Chord layer keeps its own note set (the shape plus the altered string-6 chord tones for G
and E). A chord note always has a triad degree, so the Chord-off fallback ("drawn as Arpeggio
when Arpeggio is on") comes straight out of priority.

**Rationale**: one pass with a claimed-key set gives exactly one marker per position (FR-009),
which `DisplayModel.markers` already requires ("at most one per position"). Unit tests can
enumerate every combination of 4 booleans × focus or no focus.

**Alternatives rejected**: emitting duplicates and relying on the renderer's "first wins".
That hides priority bugs and makes counts in the description wrong.

## R-08 — Marker styling (FR-008, Principle VII)

**Decision**: `Marker` gains two optional drawing-only fields:

- `layer?: 'arpeggio'`: the same function glyph (square, circle, diamond), drawn at a reduced
  scale and opacity through two new tokens, `--marker-layer-scale: 0.8` and
  `--marker-layer-opacity: 0.8`. It is applied as a CSS `transform: scale()` and `opacity` on
  the inner `.shape` group, so geometry, hit areas and the existing emphasis classes stay as
  they are.
- `extra?: true`: a small filled dot of radius `--marker-extra-dot` (0.25rem) inside the
  outlined circle, in `--color-degree-stroke`. It is visible without color because it is a
  shape difference.

Pentatonic and Scale notes use the existing `function: 'degree'` glyph, the small outlined
circle that constitution VII names "scale degree".

**Rationale**:

- The four emphasis levels stay the only position states. The layer treatment is a style,
  not a level (spec clarification).
- Size plus opacity plus shape carry the hierarchy without color. No reserved root, third or
  fifth color is reused.
- In `prefers-contrast: more`, the existing contrast tokens apply, and
  `--marker-layer-opacity` is overridden to `1` so arpeggio markers keep the contrast ratio.
  Size alone still separates them.

**Alternatives rejected**:

- *A new emphasis level "secondary"*: forbidden by Principle VII.
- *A distinct color for arpeggio*: forbidden as the only carrier, and it would compete with
  the reserved function colors.

## R-09 — Legend samples

**Decision**: a new presentational component `src/lib/fretboard/MarkerSample.svelte` draws
one marker glyph as a 44×44 inline SVG, with props `function`, `layer?` and `extra?`. It uses
the **same tokens and class names** as the Fretboard markers: the same radius tokens from
`metrics.ts`, `--marker-layer-scale`, `--marker-layer-opacity` and `--marker-extra-dot`. It is
`aria-hidden`, because the layer name beside it is the text equivalent.

**Rationale**: the sample must match the board (US2-3). Putting it under `src/lib/fretboard`
keeps glyph knowledge in the renderer module, and tools still do not draw the fretboard.
Chord shows a root square, Arpeggio a scaled root square, Pentatonic an outlined circle, and
Scale an outlined circle. The Scale row adds a second sample with the extra dot while
Pentatonic and Scale are both on.

**Alternatives rejected**: extracting the Fretboard's marker `{#if}` into a shared glyph
component used by both. It is the "right" long-term shape, but it risks the Fretboard's
keyed-each and transition behavior for little gain. Revisit when a third consumer appears
(Principle X: two real uses before abstraction).

## R-10 — Low-to-high appearance (FR-013, design §3.5)

**Decision**:

- The store keeps a transient `reveal: { ids: readonly string[] } | null`, never part of the
  view state. When a layer switch turns on (including after the auto-focus of FR-012), the
  store diffs the drawn keys before and after and stores the **newly drawn** ids, ordered by
  pitch ascending. Ties go to the lower (thicker) string first, so string number descends.
- The model sets `Marker.appear = index / count` (from 0 to under 1) on those markers only.
- The renderer adds an `in:` transition on markers with `appear`: a fade and scale-in of
  `--duration-fast`, delayed by `appear × (--duration-short − --duration-fast)`. The whole
  sequence finishes within `--duration-short` (300 ms).
- Under reduced motion, `tokenDuration` returns 0, so the notes appear at once.
- `reveal` is cleared on the next view change or layer change, and by a timer after
  `REVEAL_WINDOW_MS = 300`, asserted equal to `--duration-short`.
- Turning a layer off, or any other redraw, carries no `appear`, so nothing staggers. Removal
  uses the existing 1 ms `markerFade` outro.

**Rationale**: Svelte `in:` transitions run only when a keyed item mounts, so markers that
were already on the board never re-animate. The fraction keeps timing in the renderer, where
tokens are read. Rapid toggling recomputes `reveal` from the current board, so no stale
marker remains (edge case "rapid toggling").

**Alternatives rejected**: a CSS `animation-delay` custom property per marker. It would also
re-run on re-keyed markers and cannot be tested with the existing transition tests.

## R-11 — CAGED label control (FR-011)

**Decision**:

- `CagedViewState` gains `labelType: CagedLabelType`, where `CagedLabelType` is
  `'interval' | 'name'` (the same values as `TriadsLabelType`).
- `Preferences.labels` gains `caged`, with default `'interval'`. It is parsed with
  `v.fallback(v.picklist(['interval','name']), 'interval')`, so an unknown value falls back
  (FR-9.6).
- It is **serialized only when `'name'`**. Every existing prefs fixture therefore stays
  byte-identical, following the slice 013 and 016 precedent, and the record keeps `version: 1`.
- The store gets `setLabelType` (which remembers `labels.caged` through the session) and
  `restoreLabelType`, mirroring Triads. `reset()` keeps the preferred label, exactly as
  `triads.reset()` does.
- The model maps `labelType` to `labelMode` (`'interval'` → `'interval'`, `'name'` →
  `'note'`). Every marker carries both `interval` (a degree) and `spelling` (from
  `spellScale`).
- `notation.intervalLabel` widens to `IntervalId | ScaleDegree` and adds `b6` → `♭6` and
  `b7` → `♭7`. `R` still comes from the catalog (`m.interval_root()`), so it can become T in
  Portuguese and Spanish later (FR-8.8).
- The control is a `ChoiceGroup` in zone E, as in Triads.

**Alternatives rejected**:

- *A new `labels.caged` key always written*: it would change every existing fixture's bytes.
- *Offering "No label"*: there is no Triads precedent, and the spec rejects it.

## R-12 — Announcements and text description (FR-015)

**Decision**: there is no new live region. The Fretboard's existing polite `liveText` announces
the description. The model's description gains:

1. A **lead sentence for the change** when the store holds a transient `layerChange`
   (`{ layer, on }`, set by a layer toggle or by the automatic Chord restore, and cleared on
   the next change), for example "Scale layer on." For the auto-focus case it is followed by
   the existing focus sentence.
2. A **layers sentence**: "Layers on: Chord, Scale." It is followed by per-layer counts in the
   focused region or across the neck, for example "In this region: 6 chord notes, 9 scale
   notes." Layers that are on but not drawable get "Pentatonic is on and shows when a shape is
   in focus."
3. An **extra-mark sentence** when the mark is shown: "Extra mark: F, B". It uses
   `spokenNote`, so accidentals are read in full.

The switches are `role="switch"` buttons with `aria-checked`. When disabled they use
`aria-disabled="true"` and `aria-describedby` pointing to a visually hidden reason, so they
stay in the tab order (spec: "kept in the tab order, announced as unavailable").

**Rationale**: this is the slice 016 R-09 precedent (one live region, no double announcement).
Counts come from the resolved positions, so they match what is drawn (clarify-review "note
count").

## R-13 — Bundle budget

**Facts**:

- Initial JS after slice 016 is **92.8 KB** gzip, against a cap of 94 KB. That leaves about
  1.2 KB of headroom.
- The estimate for this slice is about **+1.6–2.4 KB** gzip:
  - theory, about 0.4 KB;
  - layers rules and resolution, about 0.5 KB;
  - model and description, about 0.3 KB;
  - list, sample and label UI, about 0.5 KB;
  - renderer, about 0.2 KB;
  - messages, about 0.3 KB.

**Decision**:

- Minimize first: one region table (R-01), no new dependency, reuse `ChoiceGroup` and the
  switch styling from slice 016, and keep messages short.
- Measure with `pnpm build && node scripts/check-bundle-size.mjs` after US2 and again at the
  end of the slice.
- If the cap is exceeded, the slice ships a MINOR constitution amendment (1.7.0 → 1.8.0,
  94 → 96 KB) with a Sync Impact Report, updating `scripts/check-bundle-size.mjs` and ADR
  0002. This is the same route as slices 010, 013, 015 and 016, and it is pre-recorded in the
  plan's Complexity Tracking.
- The budget is never raised silently, and required behavior is not trimmed to fit.

**Alternatives rejected**: lazy-loading the CAGED layers code. ADR 0002 mandates a single
bundle for version continuity.

## R-14 — Performance with every layer on

**Facts**: in the worst case (7 strings × 25 frets), at most 175 positions exist, so
resolution is O(occurrences × region cells), which is about 9 × 7 × 6 = 378 checks.

**Decision**:

- No memoization beyond the store's `$derived`.
- The existing `e2e/perf.spec.ts` scroll-smoothness check gains a CAGED case: 7 strings,
  24 frets, all layers on, a shape in focus.
- The control-to-update ≤ 100 ms budget is asserted for a layer toggle in the same spec.

## R-15 — Translations

**Decision**: new strings go into `messages/en.json`, which is today the only catalog (the
same decision as slice 016). Principle VIII allows English-only shipping, as long as every
string is a catalog key. `tests/unit/no-raw-text.test.ts` already guards against hard-coded
text.

**Recorded assumption**: the spec says "all supported languages". The supported set today is
English, and the pt and es catalogs arrive with the localization slice. *Rejected*: creating
pt and es catalogs here, which is out of scope and adds untranslated duplicate strings.

## R-16 — Playback interaction

**Decision**: layer toggles, label changes, the automatic Chord restore and auto-focus **do
not stop playback**. They change only the drawing, not the musical state. This matches slice
016's R-11 for focus. Key, quality and instrument changes keep stopping playback, as today.

## R-17 — Test plan mapping (Principle IV)

| Layer | File | Covers |
|---|---|---|
| Theory table | `tests/unit/theory/caged-layers.test.ts` | TM-6.4, TM-6.5, TM-7.4 and TM-7.5 for all 10 shapes (exact sets with degrees); TM-6.6 clipping; TM-6.7 on AF-21; the Drop D anchor; `spellScale` for all 12 roots × 2 qualities |
| Theory property | `tests/unit/theory/caged-layers.property.test.ts` | random compatible and altered tunings, keys and frets 12–24: every note's pitch class is in the scale; frets stay within the clipped region; 2–3 notes per string on strings 5→1 when not clipped; arpeggio ⊂ pentatonic ⊂ scale; the chord notes are a subset of the arpeggio set; string 7's notes have its real pitch class |
| State rules | `tests/unit/state/caged-layers.test.ts` | every toggle sequence over 4 layers × focus: never zero drawable (SC-003); disabled reasons; `ensureDrawable`; auto-focus; resolution priority; one marker per key; extra-mark rule; focused-overlap rule |
| View / model / store | existing `caged-view`, `caged-model` and `caged-store` tests, extended | layers in view and reset; labelType; description sentences; `appear` ordering; `reveal` cleared; `layerChange` lead; label preference remember and restore |
| Prefs | `tests/unit/prefs/schema.test.ts` + new fixture `labels-caged-name.txt` | parse, fallback and serialize omit-when-default; old fixtures unchanged |
| Renderer | `tests/unit/fretboard/*` | `layer-arpeggio` and `extra` classes; the `appear` intro delay; `MarkerSample` |
| Component | `tests/unit/caged/caged-tool.test.ts` | the layers list, switch ARIA, the label control |
| E2E | new `e2e/caged-layers.spec.ts` | US1–US6 acceptance scenarios, keyboard, reduced motion, storage inspection, reload and navigation, axe |
| Screenshots | `e2e/caged-tm9.spec.ts` | TM-9 views 16, 17 and 20 (phone, phone-touch, desktop) |
