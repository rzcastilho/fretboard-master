# Contract: Orientation API (internal modules)

**Feature**: `013-left-handed-and-orientation` | Internal TypeScript signatures the slice adds
or changes, with the tests each MUST have (written first, Constitution IV). Types refer to
[data-model.md](../data-model.md).

## 1. `src/lib/instrument/instrument.ts`

```ts
export type Handedness = Instrument['handedness'];      // 'right' | 'left'
export type Orientation = Instrument['orientation'];    // 'highest-top' | 'lowest-top'
export const HANDEDNESS: readonly Handedness[];         // ['right', 'left']
export const ORIENTATIONS: readonly Orientation[];      // ['highest-top', 'lowest-top']
export function withPresentation(base: Instrument, h: Handedness, o: Orientation): Instrument;
```

Tests: default → returns `base` (same object); non-default → frozen, musical fields equal,
same inputs → same object; `positionPitch` identical for every position in all four.

## 2. `src/lib/fretboard/geometry.ts`

```ts
export function screenOrder(instrument: Instrument): { rows: readonly number[]; reversed: boolean };
export function layoutFretboard(instrument, metrics, containerWidth, variant): FretboardLayout;
//   FretboardLayout += mirrored, labelCenter, board{start,end}, strings{from,to}, numbersEdge
export function rowOf(layout: FretboardLayout, string: number): Row;
export function nearestPosition(layout, x, y): Position;   // ties: lower fret, then lower string
```

Tests (table, 4 combinations × {6, 7} strings × {12, 24} frets × {interactive, thumbnail,
preview}): the data-model §4 invariants 1–5; `nearestPosition(layout, col.center, row.center)`
returns that cell in all combinations; thumbnail/preview mirror like interactive.
Replaces the placeholder tests "screenOrder is identity" and "screenOrder lists string 7 last
for every handedness/orientation".

## 3. `src/lib/fretboard/interaction.ts`

```ts
export function moveFocus(instrument, from, key): Position | 'activate' | null;   // unchanged code
export function nutOffset(layout: FretboardLayout, scrollLeft: number, viewportWidth: number): number;
export function scrollForNutOffset(layout: FretboardLayout, offset: number, viewportWidth: number): number;
export function trailingEdgeScroll(layout, viewportWidth): number;   // mirrored → 0
// spanTarget (internal): a span wider than the viewport aligns its nut side
```

Tests: US1-5 (left: ArrowLeft 3:5 → 3:6, ArrowRight → 3:4), US2-6 (lowest-top: ArrowUp from
string 5 → 6), no wrapping at either edge in all combinations; `scrollForNutOffset(nutOffset(x))
=== x`; left-handed unscrolled = `max`; handedness switch keeps the fret interval in view;
fret-count change keeps the visible frets (mirrored); `autoScrollTarget`/`groupScrollTarget`/
`scrollIntoViewTarget` return the mirror of the right-handed target.

## 4. `src/lib/state/instrument-config.ts`

```ts
export function setHandedness(p: PanelState, h: Handedness): PanelState;
export function setOrientation(p: PanelState, o: Orientation): PanelState;
export function equalsMusical(a: InstrumentConfig, b: InstrumentConfig): boolean;
export function confirmPanel(p, active): { panel; next; changed: boolean; musicalChanged: boolean };
```

Tests: every row of data-model §3 (closed no-op, same-value no-op, invalid no-op, restore,
cancel, confirm flags).

## 5. `src/lib/state/instrument.svelte.ts`

```ts
instrument.setHandedness(h: Handedness): void;
instrument.setOrientation(o: Orientation): void;
instrument.confirm(screen): void;    // presentation-only path (data-model §3)
instrument.restore(config): void;    // config now includes both fields
```

Tests: presentation-only confirm → `playback.stop` not called, `adjustedIn === null`,
`notes.view` / `triads.view` objects unchanged, `notes.instrument.handedness === 'left'`,
preferences patch contains both fields.

## 6. `src/lib/prefs/schema.ts`

`Preferences += { handedness: Handedness; orientation: Orientation }` — rules in
[storage-format.md](./storage-format.md). Tests: every fixture there + round-trip property.

## 7. Boundary test (`tests/unit/presentation-boundary.test.ts`)

Scans `src/**/*.{ts,svelte}`; fails if a property read or object key matching
`/\.(handedness|orientation)\b|\b(handedness|orientation)\s*:/` (comments ignored) occurs
outside the allow-list in research R-08. `src/lib/theory` remains covered by the ESLint boundary rule.
