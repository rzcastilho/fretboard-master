# Data Model: Triads Quality Comparison

This file lists only the changes to the 005/006 data model
(`specs/006-full-neck-and-all-notes/data-model.md`). Section numbers match the layers:
theory → view state → display model → fretboard → playback.

## 1. Theory (`src/lib/theory/triad-shape.ts`, pure)

### NoteMove

| Field | Type | Rule |
|---|---|---|
| `index` | `0 \| 1 \| 2` | Position in the shape, low → high string |
| `function` | `'third' \| 'fifth'` | Never `'root'`: the root interval is 0 in every quality |
| `fromFret` | `number` | Fret of the first triad's note |
| `toFret` | `number` | `fromFret + delta`. May be `< 0` or `> fretCount`; callers decide what fits |
| `delta` | `-2 \| -1 \| 1 \| 2` | `QUALITY_INTERVALS[to][fn] − QUALITY_INTERVALS[from][fn]` |

### New functions

New type alias:
`type Functions3 = readonly [TriadFunction, TriadFunction, TriadFunction]`. It replaces the
three inline copies already in `triad-shape.ts`, and this is a pure rename.

- `comparisonFrets(frets: Frets3, functions: Functions3, from: Quality, to: Quality): Frets3` —
  the first shape with each differing note moved on its own string (R-01).
- `noteMoves(frets, functions, from, to): readonly NoteMove[]` — only the notes with
  `delta ≠ 0`, low → high.
- `pairOccurrences(occs: readonly Frets3[], functions, from, to, fretCount): readonly number[]` —
  indexes `k` into `occs` where every comparison fret lies in `0…fretCount` (R-05).
- `ONE_NOTE_PARTNER: Record<Quality, Quality>` = `{ major: 'minor', minor: 'major', diminished: 'minor', augmented: 'major' }` (C3).

Expected moves by quality pair. Signs are fret deltas: − means toward the nut, + toward the
body.

| from \ to | major | minor | diminished | augmented |
|---|---|---|---|---|
| major | — | 3: −1 | 3: −1, 5: −1 | 5: +1 |
| minor | 3: +1 | — | 5: −1 | 3: +1, 5: +1 |
| diminished | 3: +1, 5: +1 | 5: +1 | — | 3: +1, 5: +2 |
| augmented | 5: −1 | 3: −1, 5: −1 | 3: −1, 5: −2 | — |

## 2. View state (`src/lib/state/triads-view.ts`)

`TriadsViewState` gains one field.

| Field | Type | Initial | Rules |
|---|---|---|---|
| `compare` | `{ readonly on: boolean; readonly quality: Quality \| null }` | `{ on: false, quality: null }` | Invariant: `on ⇒ quality ∉ {null, state.quality}`. Session-only (not in prefs or links) |

### Transitions (all total; a no-op returns the same object)

| Transition | Effect on `compare` | Effect on `occurrence` |
|---|---|---|
| `setCompare(s, true, i)` | `on = true`. `quality` = the remembered one if it is valid, else `ONE_NOTE_PARTNER[s.quality]`. No-op in All notes | Clamped to the last pair occurrence (R-05) |
| `setCompare(s, false, i)` | `on = false`. `quality` is kept | Clamped to the last first-triad occurrence |
| `setCompareQuality(s, q, i)` | `quality = q`. No-op if Compare is off, `q === s.quality`, or `q` is invalid | Clamped |
| `setQuality(s, q)` | If `on && q === compare.quality`: `compare.quality = s.quality` (swap, C5) | 0 (unchanged rule) |
| `selectRoot`, `switchSpelling`, `setInversion`, `setStringSet` | Unchanged | Unchanged rules (0 / kept) |
| `setView(s, v)` | Unchanged (All notes pauses it) | Unchanged |
| `resetTriads(i)` | `{ on: false, quality: null }` | 0 |
| `octaveUp` / `octaveDown` / `revalidate` | Unchanged | Step or clamp through `occurrenceCount`, which counts pair occurrences when Compare is on in Isolated and at least one pair fits (R-05) |

The occurrence index has a different meaning depending on the mode (C6).
- Compare on, Isolated, at least one pair occurrence: it indexes the pair-occurrence list.
- Otherwise: it indexes the first-triad occurrences.

## 3. Store (`src/lib/state/triads.svelte.ts`)

New module state:

| Field | Type | Lifecycle |
|---|---|---|
| `notice` | `{ kind: 'compare-swapped'; quality: Quality } \| { kind: 'compare-omitted'; notes: readonly Spelling[] } \| null` | Set by `setQuality` (when a swap happens) and by `listenComparison` (when notes were omitted). Cleared by the next applied transition, by `dismissNotice()`, and by `reset()` |

New actions: `setCompare(on)`, `setCompareQuality(q)`, `listenComparison()`, and
`dismissNotice()`.

## 4. Display model (`src/lib/state/triads-model.ts`)

### TriadsDisplay additions

| Field | Type | Meaning |
|---|---|---|
| `compare` | `{ offered: boolean; on: boolean; quality: Quality \| null; options: readonly Quality[] }` | `offered = view !== 'all-notes'`. `options` lists the qualities in `QUALITIES` order, without `state.quality` (C4) |
| `comparison` | `ComparisonView \| null` | Non-null iff Compare is on, the view is Isolated or Full neck, and the first triad has a shape |
| `listenComparison` | `{ enabled: boolean; steps: readonly ListenStep[]; omitted: readonly Spelling[] }` | `steps = [first, [], cmpOnBoard]` (C12). In Full neck it uses the selected pair (C13) |

### ComparisonView

| Field | Type | Meaning |
|---|---|---|
| `quality` | `Quality` | The second quality |
| `spelling` | `TriadSpelling` | `spellTriad(firstRootSpelling, quality)` (C2) |
| `shifted` | `boolean` | Isolated only: the pair is shown an octave above occurrence 0 because occurrence 0 did not fit (R-15) |
| `fits` | `boolean` | `false` → C7 fallback with off-board arrows |
| `pairs` | `readonly ComparisonPair[]` | One pair in Isolated; one per chain shape in Full neck |

### ComparisonPair

| Field | Type | Meaning |
|---|---|---|
| `scope` | `string` | `'iso'` or the chain shape id (`${inversion}:${octave}`) |
| `firstFrets` | `Frets3` | Low → high |
| `comparisonFrets` | `Frets3` | Low → high. May be out of range |
| `moves` | `readonly NoteMove[]` | One or two entries |
| `offBoard` | `readonly { move: NoteMove; edge: 'nut' \| 'end'; spelling: Spelling }[]` | Moves whose `toFret` is outside `0…fretCount` |

### Composition additions

| Field | Type | Meaning |
|---|---|---|
| `comparison` | `Composition \| null` | Same structure, built from the comparison spelling and quality, with the same inversion |
| `changed` | `readonly TriadFunction[]` | The functions whose interval differs (`['third']` for major↔minor) |

### Markers produced while a comparison is shown

| Marker | `function` | `emphasis` | `variant` | `id` |
|---|---|---|---|---|
| First-triad note | its function | `highlighted` (Isolated, selected Full-neck shapes) or `normal` | — | `${scope}:first:${fn}@${shapeKey}` |
| Comparison note that moved and is on the board | its function | same as its pair | `'comparison'` | `${scope}:cmp:${fn}@${shapeKey}` |
| Shared note | — | — | — | Not emitted twice: the first-triad marker stands for it (FR-005, C10) |

The first triad's markers always carry an `id`, with or without Compare. That makes the R-07
quality-change slide work in plain Isolated and Full neck too (FR-013 "with or without
Compare").

`shapeKey` = `${s.rootPc}:${s.inversion}:${s.stringSet}` is quality-invariant: it is the same before and after a quality or
comparison-quality change, so those changes keep the id and slide. A root, inversion or
string-set change gives a new `shapeKey`, so every marker gets a new id and is re-created
instead of sliding. Those changes keep the motion they have today (US5-4).

### Arrows

There is one `FretboardArrow` per move (section 5). The arrow `id` is
`${scope}:arrow:${fn}`. The label is `m.triads_compare_arrow_one/other({ count: |delta| })`
for an on-board arrow, or `noteLabel(spelling)` for an off-board one.

## 5. Fretboard (`src/lib/fretboard/types.ts`)

```ts
interface Marker {
  // …existing fields
  /** Stable identity across model updates; a changed fret with the same id slides (R-07). */
  readonly id?: string;
  /** Comparison triad note: dashed outline, function fill and shape kept (R-09). */
  readonly variant?: 'comparison';
}

type FretboardArrow =
  | {
      readonly kind: 'move';
      readonly id: string;
      readonly string: number;
      readonly fromFret: number;
      readonly toFret: number;
      readonly label: string;
    }
  | {
      readonly kind: 'off-board';
      readonly id: string;
      readonly string: number;
      readonly fromFret: number;
      readonly edge: 'nut' | 'end';
      readonly label: string;
    };

interface DisplayModel {
  // …existing fields
  /** Drawn above markers, mirrored with the layout; never announced (the description covers them). */
  readonly arrows?: readonly FretboardArrow[];
}
```

Validation: an arrow whose `string` or frets fall outside the instrument is dropped by the
renderer, in the same way `firstPerPosition` ignores invalid markers. A move arrow with
`fromFret === toFret` is never produced.

## 6. Playback

Nothing changes in the data model. `PlaybackRequest.sequence.steps` already accepts
`readonly Position[]`, and an empty array is a rest beat (R-10). The comparison sequence at
120 bpm produces these marks:

| Step | Positions | Onset | End |
|---|---|---|---|
| 0 | first triad (3) | 0 ms | 500 ms |
| 1 | — (rest) | — | — |
| 2 | comparison triad on board (≤ 3) | 1000 ms | 1500 ms |

## 7. State transitions diagram (Compare)

```text
            setCompare(true)                     setCompareQuality(q≠quality)
  ┌──────┐ ─────────────────▶ ┌──────────────┐ ◀──────────────┐
  │ OFF  │                    │ ON(quality)  │ ───────────────┘
  │(q?)  │ ◀───────────────── └──────────────┘
  └──────┘  setCompare(false)        │ setQuality(q == compare.quality)
     ▲   (quality remembered)        ▼
     │                         ON(previous current quality) + notice
     │ resetTriads → OFF(null)
  setView('all-notes') leaves ON/OFF untouched; the model shows no comparison there.
```
