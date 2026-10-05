# Data Model: CAGED Triad Layer

Phase 1 for [plan.md](./plan.md). Decisions are referenced as R-xx from
[research.md](./research.md). Existing types (`ShapeOccurrence`, `LayersOn`, `CagedViewState`,
`TriadsViewState`, `Marker`) are extended, not replaced. Nothing here is persisted to device
storage or the URL.

## 1. Theory — `src/lib/theory/caged-triad.ts` (new, pure)

### ShapeTriad

The close-position triad on one string set, inside one occurrence's arpeggio window.

| Field | Type | Rule |
|---|---|---|
| `set` | `number` | Bass string number `b`; strings are `b, b−1, b−2`; `3 ≤ b ≤ stringCount` |
| `inversion` | `Inversion` | From the TM-5.2 order of the found shape |
| `frets` | `Frets3` | Low → high string; each in `[max(0, region.start), min(fretCount, region.end)]` |
| `functions` | `Functions3` | `INVERSION_ORDER[inversion]` |
| `occurrence` | `number` | Triads octave index `k`: `frets = triadShape(…).frets + 12k` |
| `pitches` | `readonly [Pitch, Pitch, Pitch]` | `open + fret`, strictly rising, `pitches[2] − pitches[0] < 12` |

Invariants (property-tested, SC-003):
- T-1: every position is a position of the occurrence's Arpeggio layer (`layerNotes` filtered by
  `inLayer(d, 'arpeggio', q)`).
- T-2: functions are root, third, fifth exactly once; each note is the next triad tone above the
  one below (close position).
- T-3: `frets` equals `occurrences(triadShape(open3, triad, inversion).frets, fretCount)[occurrence]`.
- T-4: if any close-position triad of the set lies in the window, the result is non-null.
- T-5: among several, the smallest `span(frets)`, then the lowest `frets[0]` (R-02).

### SetAvailability

`{ readonly set: number; readonly triad: ShapeTriad | null }` — `triad === null` ⇔ unavailable.
One entry per set in bass → treble order (`stringCount … 3`): four on six strings, five on seven.

## 2. View state — `src/lib/state/caged-view.ts` (extended)

| Field | Type | Initial / reset | Notes |
|---|---|---|---|
| `layers.triad` | `boolean` | `false` | New flag in `LayersOn`; `CHORD_ONLY.triad = false` |
| `triadSet` | `StringSetId \| null` | `null` | Effective selection; `null` while Triad is off |

Transitions:

| Event | `layers.triad` | `triadSet` |
|---|---|---|
| Triad switch → on (no focus) | focus first drawn occurrence, then `true` | `defaultTriadSet(avail)` |
| Triad switch → on (focus) | `true` | `defaultTriadSet(avail)` |
| Triad switch → off (allowed by base-layer rule) | `false` | `null` |
| User picks an available set | — | that set |
| User picks an unavailable set | — | unchanged (no-op) |
| Focus / key / quality / spelling / instrument / tuning / temporary view change | kept | `settleTriadSet`: kept if available; else default + announce; if none available, kept |
| Focus cleared | kept | kept (nothing drawn) |
| Non-compatible tuning | kept (switch disabled `no-shapes`) | kept |
| Reset tool | `false` | `null` |
| Reload | `false` | `null` (module state) |

`equalsLayers` and `equalsCagedView` compare `triad` and `triadSet`.

## 3. Layer rules — `src/lib/state/caged-layers.ts` (extended)

- `CagedLayer = 'triad' | 'chord' | 'arpeggio' | 'pentatonic' | 'scale'`;
  `MelodicLayer = 'arpeggio' | 'pentatonic' | 'scale'` (R-03).
- `LAYER_PRIORITY = ['triad', 'chord', 'arpeggio', 'pentatonic', 'scale']`.
- `isDrawable(l, 'triad', hasFocus) = l.triad && hasFocus` (R-04).
- `needsAutoFocus` true for `'triad'` off → on with no focus.
- `ResolveInput` gains `triad: ShapeTriad | null` (the selected set's triad for the focused
  occurrence, or null).
- `ResolvedPosition.layer` may be `'triad'`; its `degree` is `R`, `3`/`b3` or `5`;
  emphasis `highlighted`.

Resolution order (one entry per `string:fret`, first claim wins):
1. If focus, `layers.triad` and `triad`: claim the three triad positions as `triad`.
2. Unchanged slice 017 order: focused chord (`highlighted`), focused melodic layers, other
   occurrences' chord (`dimmed`); or the no-focus path.

Invariants added to slice 017's I-1…I-7:
- I-8: exactly three `layer === 'triad'` positions when Triad is drawn with a selected
  available set; zero otherwise.
- I-9: a triad position is never also emitted as another layer (one marker per position).
- I-10: with Arpeggio off, the triad positions are identical to those with Arpeggio on (FR-008).

## 4. Triad layer rules — `src/lib/state/caged-triad.ts` (new, pure)

| Function | Result |
|---|---|
| `triadAvailability(occ, instrument, rootPc, spelling, quality)` | `readonly SetAvailability[]` (calls `shapeTriad` per set) |
| `defaultTriadSet(avail)` | `3` if available, else first available, else `null` |
| `settleTriadSet(current, avail)` | `{ set, moved }` (R-05) |
| `selectedTriad(set, avail)` | `ShapeTriad \| null` |
| `triadRevealIds(t)` | the three ids `triad:s:f`, pitch ascending, ties → higher string first |
| `triadHandoff(view, t)` | `TriadsHandoff \| null` (§6) |

## 5. Display model — `src/lib/state/caged-model.ts` (extended)

`CagedDisplay` gains:

```text
triad: null | {
  sets: readonly { id: number; label: string; available: boolean; ariaLabel: string }[];
  selected: number | null;          // the set drawn, null when none available
  summary: string | null;           // "C major, root position, strings 3-2-1, frets 5-5-3"
  unavailableNote: string | null;   // EC-6.7 text when any set is unavailable
  handoff: TriadsHandoff | null;    // null ⇒ "Open in Triads" not offered
}
```

`triad` is `null` when the layer is off or no shape is in focus (selector hidden).

Markers: the three triad positions get `layer: 'triad'`, `id: 'triad:s:f'`, the function glyph
(`root` / `third` / `fifth`), the current label (interval or spelled name from
`spellTriad(root, quality)`, real-pitch spelling in transposed tunings) and keep `ring` if the
position is a connection or step-shared (R-07). `appear` is set for ids in `extras.reveal`.

`CagedExtras` gains `triadChange: null | { kind: 'selected' | 'moved' | 'unavailable'; set: number; from?: number }`,
announced first in the description, like `layerChange`.

Description additions (polite live region): the layer list and per-layer counts include
"triad" (3); a triad sentence "Triad: C, E, G — root position, strings 3-2-1, frets 5-5-3."
(spoken accidentals) while drawn.

## 6. Hand-off — `TriadsHandoff` and `carryCagedTriad`

| Field | Type | Source |
|---|---|---|
| `rootPc` | `PitchClass` | `view.rootPc` |
| `spelling` | `SpellingOverride` | `view.spellingOverride` |
| `quality` | `'major' \| 'minor'` | `view.quality` |
| `inversion` | `Inversion` | `ShapeTriad.inversion` |
| `stringSet` | `StringSetId` | `ShapeTriad.set` |
| `occurrence` | `number` | `ShapeTriad.occurrence` (raw octave index `k`) |

Null while: layer off, no focus, no drawn triad, or CAGED's temporary standard view (R-11).

`carryCagedTriad(t, h, instrument) → { state: TriadsViewState; compareOff: boolean }` applies
view = isolated, quality (via `setQuality`), root, spelling, inversion, set, then the occurrence
mapping of R-11 (pair index when Compare is effectively on and the pair fits; Compare off and
`compareOff = true` when it does not; raw `k` otherwise), then `revalidate`. Label type and
Compare's remembered quality are untouched. Same reference when nothing changes.
