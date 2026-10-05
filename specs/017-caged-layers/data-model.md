# Data Model: CAGED Arpeggio, Pentatonic, and Scale Layers

**Feature**: 017-caged-layers | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

Entities are listed by module, in the order of the data flow (Principle III):
theory → view state → layer rules → display model → renderer → preferences.

---

## 1. Theory — `src/lib/theory/caged.ts` (extended)

### ShapeOccurrence (DM-13), gains `region`

| Field | Type | Rule |
|---|---|---|
| `shape` | `CagedShape` | unchanged |
| `start`, `end` | integer | chord fret span, unchanged; decides whether the occurrence is drawn (FR-006) |
| `notes` | `OccurrenceNote[]` | chord notes (the Chord layer), unchanged |
| `alteredString` | boolean | unchanged |
| **`region`** | `{ start: integer; end: integer }` | `SCALE_REGIONS[quality][shape.id] + shift + octave` (R-01, R-02). **Not clipped**: it may be < 0 or > `fretCount` |

Invariant: `region.start ≤ start` and `end ≤ region.end`, because the chord lies inside its
scale pattern. A property test checks this.

## 2. Theory — `src/lib/theory/caged-layers.ts` (new)

| Name | Type | Notes |
|---|---|---|
| `CagedLayer` | `'chord' \| 'arpeggio' \| 'pentatonic' \| 'scale'` | Triad comes in slice 005 |
| `MelodicLayer` | `Exclude<CagedLayer, 'chord'>` | |
| `ScaleDegree` | `'R' \| '2' \| '3' \| 'b3' \| '4' \| '5' \| '6' \| 'b6' \| '7' \| 'b7'` | |
| `SCALE_REGIONS` | `Record<CagedQuality, Record<CagedShapeId, readonly [lo, hi]>>` | C-key, standard-tuning reference (R-01 table) |
| `LAYER_PRIORITY` | `readonly CagedLayer[]` | `['chord','arpeggio','pentatonic','scale']` (FR-009) |
| `LAYER_DEGREES` | `Record<CagedQuality, Record<MelodicLayer, ReadonlySet<ScaleDegree>>>` | major: arp `R 3 5`, pent `R 2 3 5 6`, scale `R 2 3 4 5 6 7`; minor: arp `R b3 5`, pent `R b3 4 5 b7`, scale `R 2 b3 4 5 b6 b7` |
| `LayerNote` | `{ string: number; fret: number; degree: ScaleDegree; pitch: Pitch }` | `pitch` is kept for low-to-high ordering |

Functions (total, never throw; malformed input gives `[]` or `null`):

- `degreeOf(pc, rootPc, quality): ScaleDegree | null`
- `layerNotes(occ, openPitches, rootPc, quality, fretCount): readonly LayerNote[]`.
  `openPitches` is in string-1-first order, covering all strings (6 or 7). It returns every
  scale note with `max(0, region.start) ≤ fret ≤ min(fretCount, region.end)`, sorted by
  pitch ascending, with ties going to the higher string number first.
- `inLayer(degree, layer, quality): boolean`. Chord membership is decided by
  `occ.notes`, never by the degree.
- `isExtraMarked(degree, quality): boolean`, which is true for `4` and `7` (major) and for
  `2` and `b6` (minor).
- `spellScale(root: Spelling, quality): Readonly<Record<ScaleDegree, Spelling>>`, which uses
  alternate letters. Only the degrees of that quality are present.

## 3. View state — `src/lib/state/caged-view.ts` (extended)

```ts
interface LayersOn {
  readonly chord: boolean;
  readonly arpeggio: boolean;
  readonly pentatonic: boolean;
  readonly scale: boolean;
}

type CagedLabelType = 'interval' | 'name';

interface CagedViewState {
  rootPc; spellingOverride; quality; focus; connections; // unchanged (014–016)
  readonly layers: LayersOn;          // NEW: initial { chord: true, others false }
  readonly labelType: CagedLabelType; // NEW: initial = preferred label (default 'interval')
}
```

| Transition | Rule |
|---|---|
| `initialCagedView(label = 'interval')` | `layers = CHORD_ONLY` |
| `setLayers(s, l)` | same reference when every flag is equal |
| `setLabelType(s, t)` | no-op for an unknown or equal value |
| `resetCaged(preferredLabel)` | key, quality, focus and connections go to their defaults; `layers = CHORD_ONLY`; `labelType = preferredLabel` (same as Triads' `reset`) |
| `equalsCagedView` | also compares `layers` (all four flags) and `labelType` |

Lifetime: module store. It survives tool navigation and resets on reload. **`layers` is never
serialized**: it is in no prefs field and no link. `labelType` is restored from
`labels.caged` at startup.

## 4. Layer rules — `src/lib/state/caged-layers.ts` (new, pure)

| Name | Signature | Rule |
|---|---|---|
| `CHORD_ONLY` | `LayersOn` | frozen `{ chord: true, arpeggio: false, pentatonic: false, scale: false }` |
| `isDrawable` | `(layers, layer, hasFocus) → boolean` | on && (layer ∈ {chord, arpeggio} \|\| hasFocus) |
| `drawableCount` | `(layers, hasFocus) → number` | |
| `SwitchState` | `{ on: boolean; disabled: null \| 'last-layer' \| 'no-shapes' }` | |
| `switchStates` | `(layers, hasFocus, hasOccurrences) → Record<CagedLayer, SwitchState>` | `'no-shapes'` when `!hasOccurrences`. `'last-layer'` when the layer is on, drawable and `drawableCount = 1`. Turning a layer **on** is never blocked by `last-layer` |
| `toggleLayer` | `(layers, layer, hasFocus, hasOccurrences) → LayersOn` | the same reference when disabled |
| `needsAutoFocus` | `(layers, layer, focus) → boolean` | `layer ∈ {pentatonic, scale}`, `!layers[layer]` and `focus === null` |
| `ensureDrawable` | `(layers, hasFocus) → { layers; restoredChord: boolean }` | when `drawableCount = 0`, `chord = true`; the other flags are kept |
| `ResolvedPosition` | `{ string; fret; degree: ScaleDegree; layer: CagedLayer; emphasis: 'highlighted' \| 'normal' \| 'dimmed'; extra: boolean; pitch: Pitch }` | |
| `resolveCagedPositions` | `(input) → readonly ResolvedPosition[]` | one entry per `string:fret` (R-07). The input holds occurrences, focusIndex, layers, rootPc, quality, openPitches and fretCount |
| `layerCounts` | `(positions) → Record<CagedLayer, number>` | the counts in the text description |

Invariants (unit- and property-tested):

- I-1: at most one `ResolvedPosition` per `string:fret` (FR-009, SC-003).
- I-2: when `layers.chord` is false, no position has `layer: 'chord'` (FR-003).
- I-3: when focus is null, no position has `layer ∈ {pentatonic, scale}` (FR-012).
- I-4: when there is a focus, every `arpeggio`, `pentatonic` or `scale` position lies inside
  the focused `region` and has `emphasis: 'highlighted'` (FR-018).
- I-5: `extra` is true only when `layer ∈ {pentatonic, scale}` and both of those layers are on
  (FR-010).
- I-6: a `chord` position never lies on string 7. Positions on string 6 in an altered tuning
  are `chord` only for the G and E shapes (FR-007, FR-017).
- I-7: for any sequence of `toggleLayer` and focus changes followed by `ensureDrawable`,
  `drawableCount ≥ 1` (FR-002, SC-003).

## 5. Store transients — `src/lib/state/caged.svelte.ts` (extended)

These are not part of the view state, are never stored, and are cleared on reset.

| Name | Type | Set by | Cleared by |
|---|---|---|---|
| `reveal` | `{ ids: readonly string[] } \| null` | `toggleLayer` turning a layer on (after any auto-focus): the newly drawn keys, in low-to-high order | any next view or layer change; the `REVEAL_WINDOW_MS` (300) timer |
| `layerChange` | `{ layer: CagedLayer; on: boolean } \| null` | `toggleLayer`; `ensureDrawable` with `restoredChord` | any next change |

New store API: `toggleLayer(layer)`, `setLabelType(t)`, `restoreLabelType(t)`,
`get switches`, `get reveal`. Existing `reset()` keeps the preferred label.

## 6. Display model — `src/lib/state/caged-model.ts` (extended)

`buildCagedModel(view, instrument, context, transition, extras?)`, where
`extras = { reveal, layerChange }`, changes as follows.

### `CagedDisplay` additions

| Field | Type | Rule |
|---|---|---|
| `switches` | `Record<CagedLayer, SwitchState>` | from `switchStates`. In a non-compatible tuning every switch is `'no-shapes'` |
| `extraSampleShown` | boolean | `layers.pentatonic && layers.scale` |
| `positions` | `readonly ResolvedPosition[]` | exposed for tests and the description |

### Marker mapping (per `ResolvedPosition`)

| Resolved `layer` | `Marker.function` | `Marker.layer` | `Marker.extra` |
|---|---|---|---|
| `chord` | root, third or fifth from the degree | — | — |
| `arpeggio` | root, third or fifth from the degree | `'arpeggio'` | — |
| `pentatonic`, `scale` | `'degree'` | — | `true` when `extra` |

All markers keep `id = "s:f"`, `emphasis`, `interval = degree`, `spelling =
spellScale(root)[degree]`, and `ring` when connected (only on positions that have a marker).
They carry `appear = i / n` when the id is in `reveal.ids`.

`model.labelMode` is `'interval'` when `labelType` is `'interval'`, and `'note'` when it is
`'name'`.

### Description additions (R-12, in order)

`[layerChange sentence]` · focus sentence · tuning · altered · summary · **layers sentence** ·
**counts sentence** · **not-drawable sentence(s)** · **extra-mark sentence** · entries ·
connections.

## 7. Renderer — `src/lib/fretboard/types.ts` and `Fretboard.svelte` (extended)

`Marker` gains optional, drawing-only fields:

| Field | Type | Effect |
|---|---|---|
| `layer` | `'arpeggio'` | class `layer-arpeggio`: `.shape` gets `scale(var(--marker-layer-scale))` and `opacity: var(--marker-layer-opacity)` |
| `extra` | `true` | adds `<circle class="extra-dot" r=…>` inside the glyph |
| `appear` | number in `[0, 1)` | `in:` intro with delay `appear × (short − fast)` and duration `fast`; 0 under reduced motion |

`Marker.interval` widens to `IntervalId | ScaleDegree`.

**New tokens** in `src/lib/styles/tokens.css`:

- `--marker-layer-scale: 0.8`;
- `--marker-layer-opacity: 0.8`, set to `1` under `prefers-contrast: more`;
- `--marker-extra-dot: 0.25rem`.

**New component**: `src/lib/fretboard/MarkerSample.svelte`, with props
`{ function: NoteFunction; layer?: 'arpeggio'; extra?: boolean }`. It is an `aria-hidden`
SVG, 44×44.

## 8. Preferences — `src/lib/prefs/schema.ts` (extended)

| Field | Stored as | Parse | Serialize |
|---|---|---|---|
| `labels.caged: CagedLabelType` | `labels.caged` | `v.fallback(v.picklist(['interval','name']), 'interval')`; a missing or invalid value gives `'interval'` (FR-9.6) | written **only when `'name'`**, so existing fixtures stay byte-identical |

`version` stays `1`. `erase()` clears it with the rest of the record. A new fixture,
`tests/unit/prefs/fixtures/labels-caged-name.txt`, is added. Fixtures are only ever added.

## 9. State transitions summary

```text
toggleLayer(L):
  if switches[L].disabled → no-op
  if needsAutoFocus(L) → commitFocus(focusOfIndex(0))     // FR-012, announced as focus change
  before = drawn keys
  layers = toggleLayer(layers, L, hasFocus)
  layerChange = { L, on }
  if turned on → reveal = (drawn keys − before) ordered low→high
focus cleared (See all | tag off | instrument | temporary on/off | key/quality with no fit):
  { layers, restoredChord } = ensureDrawable(layers, hasFocus=false)
  if restoredChord → layerChange = { chord, on: true }   // "Chord layer on"
reset():
  view = resetCaged(preferredLabel)  // layers → CHORD_ONLY
```
