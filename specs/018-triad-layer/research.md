# Research: CAGED Triad Layer

Phase 0 for [plan.md](./plan.md). The spec's clarification session left no open question, so
every Technical Context field was resolved from the spec and the codebase. Each item below records a design decision
the spec leaves to the plan, its rationale and the alternatives rejected. Code references are
to the state of `main` after slice 017 (`1d882fd`).

## R-01 — How the shape triad is found

**Decision**: a new pure `src/lib/theory/caged-triad.ts` builds candidates with the **Triads
tool's own shape function** and filters them by the occurrence's arpeggio window:

1. For the set with bass string `b` (strings `b, b−1, b−2`), take the three open pitches from
   the real tuning (`openPitches[b−1]`, …).
2. For each inversion in `INVERSIONS`, call `triadShape(open3, spellTriad(root, q), inv)`
   (TM-5.3). `does-not-close` (non-ascending custom strings) → no candidate for that set.
3. Expand every octave copy with `occurrences(frets, fretCount)` (TM-5.3 step 5). The copy
   index `k` is the Triads occurrence index.
4. Keep a copy iff every fret lies in the occurrence's clipped region
   `[max(0, region.start), min(fretCount, region.end)]`. Because `triadShape` produces exactly
   the triad pitch classes, "inside the window" ⇔ "all three are Arpeggio-layer positions"
   (`layerNotes` ∩ `inLayer(…, 'arpeggio')`), so no separate membership pass is needed. A
   property test asserts this equivalence against `layerNotes`.
5. Pick by smallest `span(frets)`, then the lowest bass fret (R-02).

**Rationale**: FR-002 requires the found triad to *equal* a Triads tool shape; deriving it from
`triadShape` + `occurrences` makes that true by construction and gives the hand-off occurrence
`k` for free (FR-009). Close position (TM-5.2/TM-5.3) is exactly what `triadShape` stacks
(each note the next triad tone above). String 7 and the altered string 6 need no special case:
open pitches come from the real tuning, as in slice 017 R-05.

**Alternatives rejected**:
- *Brute force over `layerNotes` triples* then test close position: re-implements TM-5.3
  and needs a second proof that it matches the Triads tool.
- *Lookup table of triads per shape*: forbidden by Principle I (computed from the tuning).

**Reference matrix** (standard tuning, 6 strings, 24 frets, C key; computed while planning, used
as table-test anchors in [contracts/triad-layer-api.md](./contracts/triad-layer-api.md) §1):

| Shape | 6-5-4 | 5-4-3 | 4-3-2 | 3-2-1 |
|---|---|---|---|---|
| C major, C | 2nd 3-3-2 | root 3-2-0 | 1st 2-0-1 | 2nd 0-1-0 |
| C major, A | 2nd 3-3-2 | — | 2nd 5-5-5 | **root 5-5-3** |
| C major, G | root 8-7-5 | 1st 7-5-5 | 2nd 5-5-5 | — |
| C major, E | — | 2nd 10-10-9 | root 10-9-8 | 1st 9-8-8 |
| C major, D | 1st 12-10-10 | 2nd 10-10-9 | — | 2nd 12-13-12 |
| C minor, C | 2nd 3-3-1 | root 3-1-0 | 1st 1-0-1 | — |
| C minor, A | — | 1st 6-5-5 | 2nd 5-5-4 | root 5-4-3 |
| C minor, G | root 8-6-5 | 1st 6-5-5 | — | 1st 8-8-8 |
| C minor, E | 1st 11-10-10 | 2nd 10-10-8 | root 10-8-8 | 1st 8-8-8 |
| C minor, D | 1st 11-10-10 | — | 1st 13-12-13 | 2nd 12-13-11 |

Every shape has at least one unavailable set except C major C shape and C minor E shape, so the
disabled path (US2) is exercised in standard tuning. C major D shape 3-2-1 (12-13-12) is the
Triads occurrence `k = 1` (lowest is 0-1-0): the US3-3 "higher occurrence" anchor. C major G
shape has no 3-2-1 triad: the "default falls back to first available (6-5-4)" anchor.

## R-02 — Tie-break between several triads on one set

**Decision**: smallest `span()` from `triad-shape.ts` (fretted notes only; open strings
ignored, the product's existing definition of stretch), then lowest bass fret. Deterministic
and total.

**Rationale**: in standard tuning no set has two candidates (matrix above), but custom and
altered tunings can. Reusing `span()` keeps one definition of "fret span" in the product.

**Alternatives rejected**: raw `max − min` including open strings (a second definition of
span); preferring root position (not what the spec's default says).

## R-03 — Layer identity and priority

**Decision**: `CagedLayer` gains `'triad'`. `LAYER_PRIORITY` becomes
`['triad', 'chord', 'arpeggio', 'pentatonic', 'scale']`. `MelodicLayer` is redefined as the
explicit union `'arpeggio' | 'pentatonic' | 'scale'` (it was `Exclude<CagedLayer, 'chord'>`,
which would now wrongly include `triad` in `LAYER_DEGREES`). The list/legend order
(`LAYER_ORDER` in `caged-model.ts`, rows in `CagedLayerList`) puts Triad **last** (FR-001),
which is independent of priority.

**Rationale**: FR-007 priority Triad > Chord > …; FR-001 row after Scale.

## R-04 — Drawable rule, auto-focus and Chord restore

**Decision**: in `state/caged-layers.ts`:
- `isDrawable(l, 'triad', hasFocus)` ⇔ `l.triad && hasFocus` (same rule as Pentatonic/Scale).
  Availability of a set does **not** affect drawability (spec: "Triad is a drawable layer only
  while a shape is in focus").
- `needsAutoFocus` returns true for `'triad'` like Pentatonic/Scale (FR-003, US4-1).
- `switchStates`, `toggleLayer`, `ensureDrawable` and `drawableCount` iterate
  `LAYER_PRIORITY`, so they pick up Triad without new branches; `switchStates` returns a
  `triad` entry. `CHORD_ONLY` gains `triad: false`.

**Rationale**: reuses the slice 017 base-layer machinery unchanged (FR-004, US4-2..4).

**Alternative rejected**: treating "on but no available set" as not drawable — would trigger an
automatic Chord restore whenever the user focuses a shape with no triad, contradicting US2-4
("the layer stays on").

## R-05 — Where the selected set lives and how it settles

**Decision**: `CagedViewState` gains `triadSet: StringSetId | null` (null when Triad is off or
after reset). Pure helpers in a new `src/lib/state/caged-triad.ts`:
- `defaultTriadSet(avail)`: `3` (strings 3-2-1) if available, else the first available in
  `stringSets(instrument)` order (bass → treble: 7-6-5 first on seven strings), else `null`.
- `settleTriadSet(current, avail)` → `{ set, moved }`: keep `current` when available; else the
  default and `moved = true`; when **no** set is available, keep `current` unchanged and
  `moved = false` (nothing drawn; the selection is not lost for the next shape).
- Turn-on (`toggleLayer` to on): `triadSet = defaultTriadSet(avail)` for the (possibly
  auto-focused) shape. Turn-off: `triadSet = null`.

The store calls a `settleTriad()` step after every transition that can change availability
(focus, key, quality, spelling, instrument/tuning, temporary view) — the same hook points as
slice 017's `settleLayers()`. A move sets the transient `triadChange = { kind: 'moved', set }`
for the announcement (FR-005, US2-3).

**Rationale**: storing the *effective* selection matches the spec ("selection moves to the
default"): a later shape where the original set is available again does not jump back.

**Alternatives rejected**: storing only the requested set and deriving the effective one each
render — the "moved" announcement would then have no state transition to hang on and the set
could silently flip back.

## R-06 — Without focus, and in a non-compatible tuning

**Decision**: with no focus, `availability` is empty, the triad is not drawn and the selector is
not rendered; `layers.triad` and `triadSet` are kept (US4-2). In a non-compatible tuning the
existing `switchStates(…, hasOccurrences=false)` disables the Triad switch with `no-shapes`
and keeps the state (FR-010). Focus there is already cleared by slice 016/017 code.

## R-07 — Display: the triad treatment marker

**Decision**: widen `Marker.layer` from `'arpeggio'` to `'arpeggio' | 'triad'`. The renderer
adds class `layer-triad` to the marker group: a larger glyph and heavier outline from new
tokens `--marker-triad-scale` and `--marker-triad-stroke` (contrast mode keeps the outline;
it is shape/size, not color). `ring` keeps its connection meaning and composes with
`layer: 'triad'` (FR-007). `MarkerSample` accepts `layer: 'triad'` for the legend row (FR-001).

The three triad markers carry ids `triad:${string}:${fret}` instead of `${string}:${fret}`.

**Rationale**: the spec requires a distinct, color-independent treatment carried by exactly
three positions and tested in the display model (`layer === 'triad'`). The id change makes the
renderer's keyed `{#each}` remount those markers, so the existing mount-only `appear` intro
plays even when the position was already drawn as a chord note (FR-013). ADR 0010 already
defines marker identity as the animation key.

**Alternatives rejected**:
- *Reusing `ring`*: forbidden by the spec (ring = connection, slice 016).
- *A new emphasis level*: Principle VII allows only four.
- *Keeping ids and adding an update transition*: touches the shared Fretboard transition code
  for one use (Principle X).

## R-08 — Reveal on turn-on and on set change

**Decision**: when Triad turns on, or a set is chosen, the store starts the existing reveal with
the **three triad ids** ordered low → high (pitch ascending, ties → higher string number, the
`byPitch` comparator from slice 017), plus any other newly drawn ids from `revealOrder`. Other
redraws (focus moves, key change, settle-moves) do not reveal (FR-013 "other redraws MUST NOT
stagger"). Reduced motion zeroes the delay through the existing `tokenDuration` path.

## R-09 — The set selector component

**Decision**: a new `src/lib/tools/caged/CagedTriadSets.svelte` renders, under the Triad row
while the layer is on and a shape is in focus, a `ChoiceGroup` with the **same options as the
Triads string-set control** (`stringSets(instrument)` labels `setLabel(id)`, same order, same
component and styling) — the "same small string diagram" of FR-6.11. Unavailable options pass
`disabled: true` and a per-option `describedby` pointing at a visible note
"In this shape there is no close-position triad on these strings" (EC-6.7), rendered once below
the group when any option is unavailable, plus the option's `aria-label` "Strings 5-4-3,
unavailable".

`ChoiceGroup` gains two optional, backwards-compatible inputs:
- per-option `describedby?: string` (→ `aria-describedby` on that radio);
- `reachDisabled?: boolean` (default false): arrow keys / Home / End move **focus** onto
  disabled options without choosing them, so unavailable sets stay keyboard-reachable and are
  announced (FR-006). Default behavior (skip disabled) is unchanged for Triads and the CAGED
  shape selector.

**Rationale**: reuses the Triads control rather than inventing a diagram; satisfies "disabled
but reachable" with the APG-sanctioned focusable-disabled pattern.

**Alternatives rejected**:
- *A new SVG mini string diagram*: the Triads tool has no SVG diagram; "same as Triads" means
  the same control.
- *Plain toggle buttons each in the tab order*: diverges from the Triads control and its
  radiogroup semantics.

## R-10 — Text, inversion and frets reported

**Decision**: pure `triadSummary` data (`root`, `quality`, `inversion`, `set`, `frets`,
`positions`) from `state/caged-triad.ts`; `caged-model.ts` formats it through the catalog:
- panel text and description: "C major, root position, strings 3-2-1, frets 5-5-3" (notes
  named in the description, spoken accidentals via `spokenNote`);
- set-change announcement: "Strings 3-2-1: C major triad, root position, frets 5-5-3", or
  "Strings 5-4-3: unavailable in this shape";
- moved announcement: "Strings 3-2-1 unavailable in this shape; showing strings 6-5-4".

Inversion names reuse the existing Triads catalog keys `triads_inversion_root|first|second`
("Root position", "1st inversion", "2nd inversion"), lower-cased in running text. Frets are listed low → high string, like Triads.

## R-11 — Open in Triads hand-off

**Decision**: pure `carryCagedTriad(t: TriadsViewState, h: TriadsHandoff, i: Instrument)` in
`src/lib/state/links.ts`, next to the existing carries:
1. `setView(t, 'isolated')` first (so `setStringSet` / `setInversion` are not blocked by
   All notes);
2. `setQuality(…, h.quality)` (keeps the Compare swap invariant, as `carryTriad`);
3. root, `spellingOverride` (CAGED's override, so the key's spelling carries), inversion,
   string set;
4. occurrence: with Compare effectively on and at least one pair fitting, the Triads
   `occurrence` value indexes the **pair list** (triads-model M3), so it is set to
   `pairs.indexOf(h.occurrence)`. If the drawn occurrence has no fitting pair, Compare is
   turned off (its remembered quality kept, as `setCompare(false)` does) so the drawn shape is
   shown, and the Triads store raises its existing notice channel (`compare-swapped`, `compare-omitted`)
   with a new kind `compare-off-for-shape` ("Compare is off: this shape's comparison does not fit the
   fretboard"). Otherwise `occurrence = h.occurrence`;
5. `revalidate` and same-reference no-op as the other carries.

Label type is untouched. The orchestrator `openTriadsFromCagedTriad()` in
`links.svelte.ts` reads `caged.display.triad.handoff`, calls `triads.carryCagedTriad(h)` and does
one `goto('/triads')` (ADR 0011: carry at activation). CAGED state is not modified.

The shortcut is offered only while `handoff !== null`: layer on, focus, drawn triad, **and not
in CAGED's temporary standard view** (Triads would use the real, non-compatible tuning, so the
drawn shape could not be equal — FR-009 "in the current tuning").

**Rationale**: FR-009 makes both "lands on the occurrence equal to the drawn triad" and "keeps
Compare" MUSTs; they conflict only when the drawn occurrence's comparison falls off the board.
Shape equality is the hand-off's purpose, and Principle X says adjust and tell.

**Alternatives rejected**: keeping Compare on and landing on a different occurrence (breaks
FR-009 equality silently); setting `occurrence = k` regardless (wrong shape when pairs are
indexed).

## R-12 — State lifetime and reset

**Decision**: `layers.triad` and `triadSet` live in the CAGED module store like `layers`:
never in prefs or URL (no schema change), kept across navigation, lost on reload.
`resetCaged` returns `layers = CHORD_ONLY` (triad false) and `triadSet = null` (FR-012).
`equalsCagedView` and `equalsLayers` compare the new fields.

## R-13 — Bundle

**Decision**: estimate +1.2–1.8 KB gzip (one theory module ≈ 0.3 KB, rules/model ≈ 0.6 KB, one
small component ≈ 0.5 KB, ~20 messages ≈ 0.4 KB). After slice 017 the bundle is 96.7 KB
against the 120 KB cap: no contingency needed. Measure once at the end (`pnpm verify`).

## R-14 — Translations

**Decision**: new strings go into `messages/en.json` only. `project.inlang/settings.json` lists
`"locales": ["en"]`; there are no pt or es catalogs to add to. Same decision as slices 016 and
017 (R-15).

**Recorded deviation**: FR-014 says "(en, pt, es)". The keys are catalog-only (Principle VIII),
so the pt and es values drop in with the localization slice with no code change. *Rejected*:
creating pt/es catalogs and locales in this slice (out of scope; untranslated duplicates).

## R-15 — Playback

**Decision**: Triad toggle, set selection and settle-moves do not stop a sounding note, like the
other layer switches (slice 017 R-16). Key/quality changes still go through `apply()`.

## R-16 — Test mapping

| Spec item | Test |
|---|---|
| FR-002, SC-003 (detection, equality with Triads, availability) | `tests/unit/theory/caged-triad.test.ts` (matrix R-01, Drop D, AF-21 7-string, 12/22 frets, open position) + `caged-triad.property.test.ts` (all keys × qualities × shapes × fret counts 12/22/24 and random compatible tunings: notes ⊂ arpeggio, close position, equals `triadShape` occurrence `k`, no false "unavailable") |
| FR-003–FR-005, FR-008, FR-012, SC-006 | `tests/unit/state/caged-layers.test.ts`, `caged-triad.test.ts`, `caged-view.test.ts`, `caged-store.test.ts` (toggle sequences, auto-focus, settle-move, reset) |
| FR-007, SC-006 one marker per position | `caged-layers.test.ts` resolution table + `caged-model.test.ts` (exactly three `layer: 'triad'`, ring composes) |
| FR-009, US3 | `tests/unit/state/links.test.ts` (`carryCagedTriad` incl. Compare on/pair/off cases, k = 1) |
| FR-010, SC-005 | theory tests (Half step down names, Drop D string 6, 7-string 7-6-5) + `caged-model.test.ts` spelling |
| FR-006, FR-014 UI | `tests/unit/caged/caged-tool.test.ts`, `tests/unit/triads/choice-group.test.ts` cases for `reachDisabled` |
| FR-013 | `tests/unit/fretboard/fretboard.test.ts` (triad ids remount with `appear`), store fake-timer test |
| US1–US5 flows, axe, SC-007 | new `e2e/caged-triad.spec.ts` (desktop locally; full matrix in CI) |
