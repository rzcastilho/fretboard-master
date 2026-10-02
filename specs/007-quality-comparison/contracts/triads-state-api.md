# Contract delta: Triads state API

**Feature**: `007-quality-comparison` | Base: [006 triads-state-api](../../006-full-neck-and-all-notes/contracts/triads-state-api.md) | Data: [data-model §2–§4](../data-model.md)

## 1. View state (`src/lib/state/triads-view.ts`, pure)

```ts
export interface TriadsCompare { readonly on: boolean; readonly quality: Quality | null }
export interface TriadsViewState { /* …006 fields */ readonly compare: TriadsCompare }

export function setCompare(s: TriadsViewState, on: boolean, i: Instrument): TriadsViewState;
export function setCompareQuality(s: TriadsViewState, q: Quality, i: Instrument): TriadsViewState;
// Changed behaviour (same signatures): setQuality (swap, C5), resetTriads (clears compare),
// equalsTriadsView (compares compare.on and compare.quality), occurrenceCount via
// octaveUp/octaveDown/revalidate (pair-aware, R-05).
```

| # | Rule | Source |
|---|---|---|
| S1 | `initialTriadsView(i).compare` is `{ on: false, quality: null }` | FR-001 |
| S2 | `setCompare(s, true)` in `all-notes` returns `s` | FR-001 |
| S3 | `setCompare(s, true)` uses `s.compare.quality` if it is non-null and `≠ s.quality`, else `ONE_NOTE_PARTNER[s.quality]` | C3 |
| S4 | `setCompareQuality(s, s.quality)` returns `s`. It also returns `s` when Compare is off | EC-5.5 |
| S5 | `setQuality(s, q)` with `s.compare.on && q === s.compare.quality` returns `quality: q, compare.quality: s.quality` | C5 |
| S6 | `selectRoot`, `switchSpelling`, `setInversion`, `setStringSet` and `setView` never change `compare` | FR-011, US2-3 |
| S7 | `resetTriads(i).compare` is `{ on: false, quality: null }` | C16 |
| S8 | With Compare on in Isolated, `octaveUp` and `octaveDown` step through pair occurrences. When none fits, they step through first-triad occurrences. `setCompare` and `setCompareQuality` clamp `occurrence` | C6, C7 |
| S9 | Every transition is total. Invalid input (an unknown quality, a non-boolean) returns `s` | Principle IX readiness |

## 2. Display model (`src/lib/state/triads-model.ts`)

`buildTriadsModel(s, i)` adds `compare`, `comparison`, `listenComparison` and
`composition.comparison` / `composition.changed` (data-model §4).

| # | Rule | Source |
|---|---|---|
| M1 | `compare.options` lists `QUALITIES` without `s.quality`, in product order | C4 |
| M2 | `comparison === null` when Compare is off, in All notes, or when the first shape is `beyond` / `does-not-close` (the guidance stays as in 005/006) | C7, EC guidance |
| M3 | Isolated pair: first-triad occurrence `pairOccurrences[s.occurrence]`, or when none fits, the first-triad occurrence `s.occurrence` with `fits: false` | C6, C7 |
| M4 | Each moved on-board comparison note gives one `variant: 'comparison'` marker. Shared notes are not duplicated | FR-005, FR-006 |
| M5 | One arrow per move. An off-board move gives a `kind: 'off-board'` arrow with `edge` `'nut'` (toFret < 0) or `'end'` (toFret > fretCount) and the note label | FR-004, FR-007 |
| M6 | Full neck: `comparison.pairs.length === shape.shapes.length`. The chain, tags and auto-scroll key are identical with Compare on and off | FR-012, C8 |
| M7 | First-triad markers carry `id` `${scope}:first:${fn}@${shapeKey}` in Isolated and Full neck, with or without Compare, where `shapeKey` = `${s.rootPc}:${s.inversion}:${s.stringSet}`. A quality change keeps every id; a root, inversion or string-set change changes every id (so no marker slides) | FR-013, US5-4 |
| M8 | `model.description` is `triads_desc_compare` (C17) when a comparison is shown | FR-016 |
| M9 | `listenComparison.steps` is `[first, [], cmpOnBoard]`, and `omitted` lists the off-board comparison spellings. In Full neck it uses the shape where `inversion === s.inversion && octave === s.occurrence`, else the lowest shape of that inversion. `enabled` is false when there is no comparison | C12, C13 |
| M10 | The comparison spelling uses the first triad's effective root spelling | C2 |

## 3. Store (`src/lib/state/triads.svelte.ts`)

```ts
triads.setCompare(on: boolean): void
triads.setCompareQuality(q: Quality): void
triads.listenComparison(): void   // playback.sequence(listenComparison.steps, LISTEN_BPM, instrument)
triads.dismissNotice(): void
triads.notice: TriadsNotice | null // getter
```

| # | Rule | Source |
|---|---|---|
| A1 | Every new action goes through `apply()`, so any real change stops playback (`playback.stop('view')`) | FR-015 |
| A2 | `setQuality` sets `notice = { kind: 'compare-swapped', quality }` when the swap rule fired. Any other applied transition clears `notice` | C5 |
| A3 | `listenComparison()` does nothing when `!display.listenComparison.enabled`. When `omitted.length > 0` it sets `notice = { kind: 'compare-omitted', notes }` | FR-014 |
| A4 | `listen()` is unchanged: it plays only the first triad | C14 |
| A5 | `reset()` clears `notice` | C16 |
