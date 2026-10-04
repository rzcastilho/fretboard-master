# Data Model: Left-Handed Mode and String Orientation

**Feature**: `013-left-handed-and-orientation` | **Plan**: [plan.md](./plan.md) |
**Research**: [research.md](./research.md)

Both settings are **presentation-only**: they never change a string number, fret number, pitch,
spelling, shape, tool view state or reported position (FR-007). They are read for drawing only
by `screenOrder` / `layoutFretboard` in `src/lib/fretboard/geometry.ts` (FR-018).

## 1. Value types (`src/lib/instrument/instrument.ts`)

| Type | Values | Default | Notes |
|---|---|---|---|
| `Handedness` | `'right'` \| `'left'` | `'right'` | Alias of `Instrument['handedness']` (field exists) |
| `Orientation` | `'highest-top'` \| `'lowest-top'` | `'highest-top'` | Alias of `Instrument['orientation']` (field exists) |

The four combinations are all valid. No other values exist in memory; untrusted values are
rejected at the preferences boundary (§5).

## 2. `Instrument` (unchanged shape)

`{ stringCount, fretCount, openStrings, handedness, orientation }`. `tuningInstrument` /
`presetInstrument` keep building right / highest-top instruments (memoized). A presentation is
applied by `withPresentation(base, handedness, orientation): Instrument`:

- returns `base` itself when both are default (identity preserved: `STANDARD_GUITAR` stays
  `STANDARD_GUITAR`);
- otherwise a frozen `{ ...base, handedness, orientation }`, memoized per `base` and key, so the
  same inputs always return the same object.

Validation: musical fields are identical to `base` (`equalsMusicalInstrument(a, b)` helper for
tests).

## 3. `InstrumentConfig` and `PanelState` (`src/lib/state/instrument-config.ts`)

```text
InstrumentConfig {
  stringCount: 6 | 7
  tuning: Tuning                 // canonical per count (011/012)
  fretCount: 12…24
  handedness: Handedness         // NEW, default 'right'
  orientation: Orientation       // NEW, default 'highest-top'
}
```

`DEFAULT_CONFIG` gains `handedness: 'right'`, `orientation: 'highest-top'`.

| Function | Rule |
|---|---|
| `equalsConfig(a, b)` | all five fields equal |
| `equalsMusical(a, b)` | `stringCount`, `tuning`, `fretCount` equal (presentation ignored) |
| `instrumentOf(c)` | `withPresentation(tuningInstrument(c.tuning, c.stringCount, c.fretCount), c.handedness, c.orientation)` |
| `setHandedness(p, h)` | closed → `p`; invalid `h` or same value → `p`; else pending with `handedness = h` (custom rows state kept) |
| `setOrientation(p, o)` | same rule for `orientation` |
| `restoreDefault(p)` | pending ← `DEFAULT_CONFIG` (now includes right / highest-top) — FR-012 |
| `cancelPanel(p)` | `CLOSED`; pending discarded (EC-2.7) |
| `confirmPanel(p, active)` | `{ panel: CLOSED, next: pending, changed: !equalsConfig, musicalChanged: !equalsMusical }` |

Changing string count, tuning or frets never touches the two fields, and vice versa.

### State transitions (panel)

```text
closed ──open──▶ open(pending = active)
open ──setHandedness/setOrientation/…──▶ open(pending')       # preview shows pending'
open ──restoreDefault──▶ open(pending = DEFAULT_CONFIG)
open ──cancel / Escape / Back / backdrop──▶ closed            # active unchanged
open ──confirm──▶ closed; active = pending
        ├─ musicalChanged      → stop playback, tools.applyInstrument, maybe adjustment notice
        ├─ presentation only   → tools.applyInstrument (view unchanged), no stop, no notice
        └─ no change           → nothing
        (any change)           → preferences.remember({...all five fields})
```

## 4. Fretboard layout (`src/lib/fretboard/geometry.ts`)

`screenOrder(instrument)` — the single read point:

| handedness | orientation | `rows` (top → bottom) | `reversed` |
|---|---|---|---|
| right | highest-top | 1, 2, …, n | false |
| left | highest-top | 1, 2, …, n | true |
| right | lowest-top | n, …, 2, 1 | false |
| left | lowest-top | n, …, 2, 1 | true |

`FretboardLayout` additions (existing fields keep their meaning; all x in layout px):

| Field | Meaning | Right-handed | Left-handed |
|---|---|---|---|
| `mirrored` | `screenOrder(...).reversed` | false | true |
| `columns[f]` | still indexed by fret; `start < end` | fret 0 leftmost | fret 0 rightmost |
| `labelCenter` | x centre of the string-label column | `labelCol / 2` | `width − labelCol / 2` |
| `board` `{start, end}` | wood extent (excludes label column) | `{labelCol, width}` | `{0, width − labelCol}` |
| `strings` `{from, to}` | string line extent (open-column centre → far end) | `{columns[0].center, width}` | `{0, columns[0].center}` |
| `nutX` | nut centre (between open column and fret 1) | `columns[0].end` | `columns[0].start` |
| `numbersEdge` | edge of the fret-number row | `'bottom'` if highest-top, `'top'` if lowest-top | same (handedness never changes it) |
| `boardTop` / `boardBottom` | board y extent | `0 / rows·rowH` when numbers below; `numbersRow / numbersRow + rows·rowH` when above | same |
| `rows[i]` | `screenOrder.rows[i]` at `boardTop + i·rowH` | — | — |

Derived invariants (unit-tested for every combination, 6/7 strings, 12/24 frets):

1. From the outer edge inward: label column → open column → nut → fret 1 → … → last fret,
   starting at x = 0 (right) or x = width (left). In mirrored layouts `columns[f].center <
   columns[f − 1].center` for every f ≥ 1.
2. `rowOf(layout, s).string === s` for every string; row order equals `screenOrder.rows`.
3. Tags edge is always the opposite of `numbersEdge` (tags rendered before the svg when
   `numbersEdge === 'bottom'`, after it otherwise).
4. The set `{(row.string, col.fret)}` and the pitch at each is identical across the four
   combinations (SC-002).
5. Mirrored layout = right-handed layout with `x ↦ width − x`; lowest-top = highest-top with
   `y ↦ boardTop + boardBottom − y` inside the board (inlays included, R-04).

New pure helpers: `rowOf(layout, string): Row`; `nearestPosition` ties: lower fret, then lower
string number (explicit, independent of row order).

## 5. Stored preferences (`src/lib/prefs/schema.ts`)

`Preferences` gains:

| Field | Type | Default | Reader | Writer |
|---|---|---|---|---|
| `handedness` | `Handedness` | `'right'` | `v.fallback(v.picklist(['right','left']), 'right')` | key only when `'left'` |
| `orientation` | `Orientation` | `'highest-top'` | `v.fallback(v.picklist(['highest-top','lowest-top']), 'highest-top')` | key only when `'lowest-top'` |

Each field falls back alone; other fields unaffected; never throws; `version` stays 1. Full
format in [contracts/storage-format.md](./contracts/storage-format.md). `PreferencesPatch`
accepts both fields; `preferences.start` / `erase` pass them to `instrument.restore`.

## 6. Not in any data structure

- Share links / view state / display models: carry neither field (FR-013). `NotesViewState`,
  `TriadsViewState`, `DisplayModel` are unchanged.
- Minimap (later wave), CAGED (later wave): will consume `screenOrder` only.
