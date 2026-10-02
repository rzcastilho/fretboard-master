# Data Model: Triads Full Neck and All Notes Views

**Feature**: `006-full-neck-and-all-notes` | Base: [005 data model](../005-triads-isolated-view/data-model.md) | Research: [research.md](./research.md)

Only deltas against feature 005 are listed. All types are immutable (`readonly`).

## 1. Theory — inversion chain (`src/lib/theory/triad-shape.ts`)

```ts
export interface ChainShape {
  readonly inversion: Inversion;           // named relative to the chosen root (TM-5.2), never re-rooted
  readonly octave: number;                 // k: 0 = TM-5.3 lowest occurrence of this inversion
  readonly frets: Frets3;                  // low → high string of the set
  readonly functions: readonly [TriadFunction, TriadFunction, TriadFunction];
}

export type ChainResult =
  | { readonly kind: 'chain'; readonly shapes: readonly ChainShape[] } // length ≥ 1
  | { readonly kind: 'beyond' }            // closes, no occurrence fits
  | { readonly kind: 'does-not-close' };
```

**Rules** (C1, C2, R-01, R-02)

- `shapes` = ⋃ over inv ∈ INVERSIONS of `occurrences(triadShape(open, t, inv).frets, fretCount)`
  indexed by k.
- Sorted strictly ascending by `frets[0]` (distinct by construction).
- Every `frets[j] ∈ [0, fretCount]`; `max(frets) ≤ fretCount`.
- `functions` = `INVERSION_ORDER[inversion]`.
- Pattern helper for C16 tests only: `pattern(frets) = frets − min(frets)` (test utility, not
  exported from theory unless a second consumer appears).

## 2. Instrument (`src/lib/instrument/instrument.ts`)

```ts
/** Position sounding `pitch` with the lowest fret; ties → higher string number (thicker). null if none. */
export function lowestPositionOfPitch(instrument: Instrument, pitch: Pitch): Position | null;
```

## 3. View state (`src/lib/state/triads-view.ts`)

```ts
export type TriadsView = 'isolated' | 'full-neck' | 'all-notes';
export const TRIADS_VIEWS: readonly TriadsView[] = ['isolated', 'full-neck', 'all-notes'];

export interface TriadsViewState {
  // …005 fields: rootPc, spellingOverride, quality, inversion, stringSet, labelType, occurrence
  readonly view: TriadsView;               // initial 'isolated' (FR-001, FR-019)
}
```

**Transitions** (total; a no-op returns the same object)

| Function | Effect | No-op when |
|---|---|---|
| `setView(s, v)` | `view = v`; all other fields kept (C8) | invalid `v`, `v === s.view` |
| `seeAllNotes(s)` | `setView(s, 'all-notes')` | already all-notes |
| `selectShape(s, inv, octave, i)` | `inversion = inv`, `occurrence = octave` (C3) | `view !== 'full-neck'`; invalid `inv`; `octave` not an integer in `[0, count(inv) − 1]`; both already equal |
| `setInversion(s, inv)` | 005 + resets `occurrence` to 0 | 005 rules, **or** `view === 'all-notes'` |
| `setStringSet(s, id, i)` | 005 rules | 005 rules, **or** `view === 'all-notes'` |
| `octaveUp/octaveDown(s, i)` | 005 rules | 005 rules, **or** `view !== 'isolated'` (C4; index kept) |
| `resetTriads(i)` | `initialTriadsView(i)` (view `isolated`) | — (returns a new object; the store compares with `equalsTriadsView`) |
| `selectRoot`, `setQuality`, `switchSpelling`, `setLabelType`, `revalidate` | unchanged, `view` kept | unchanged |

`equalsTriadsView` compares `view` too. Not persisted (C14).

**State transitions of `view`** (any → any via the view control; extra edges):

```text
isolated ──See all notes──▶ all-notes
full-neck ──See all notes──▶ all-notes
any ──Reset tool──▶ isolated
Another set: view unchanged (stringSet changes)
```

## 4. Display model (`src/lib/state/triads-model.ts`)

```ts
export interface ChainShapeView {
  readonly id: string;                     // `${inversion}:${octave}` — stable tag id
  readonly inversion: Inversion;
  readonly octave: number;
  readonly positions: readonly [Position, Position, Position];
  readonly functions: readonly [TriadFunction, TriadFunction, TriadFunction];
  readonly frets: Frets3;
  readonly span: number;
  readonly wideStretch: boolean;           // span ≥ 5 (C6)
  readonly selected: boolean;              // inversion === state.inversion (C3)
}

export type ShapeView =
  | /* 005 */ { kind: 'shown'; … }
  | { readonly kind: 'chain'; readonly shapes: readonly ChainShapeView[] }  // Full neck
  | { readonly kind: 'all-notes' }
  | { readonly kind: 'beyond'; readonly fretCount: number }
  | { readonly kind: 'does-not-close' };

export interface Composition {
  // …005 fields, with:
  readonly name: { readonly root: Spelling; readonly quality: Quality; readonly inversion: Inversion | null }; // null in All notes (C10)
  readonly lowToHigh: readonly [NoteEntry, NoteEntry, NoteEntry] | null;                                    // null in All notes
}

export interface TriadsDisplay {
  // …005 fields, plus:
  readonly view: TriadsView;
  readonly controls: { readonly inversion: boolean; readonly stringSet: boolean }; // enabled flags (FR-010)
  readonly octave: { up: boolean; down: boolean; index: number; count: number; applies: boolean }; // applies = view === 'isolated'
  readonly seeAllNotes: boolean;           // true iff guidance shown (beyond / does-not-close) and view !== 'all-notes'
}
```

**Per-view derivation** (`buildTriadsModel(s, instrument)`)

| | Isolated (005) | Full neck | All notes |
|---|---|---|---|
| Markers | one shape, highlighted | every chain shape; selected inversion highlighted, others normal; highlighted first (R-07) | every position with pc ∈ {R,3,5}, normal, `spelling` + `interval` (C9) |
| `model.tags` | — | one per chain shape, chain order (§5) | — |
| `model.autoScroll` | absent | key `full-neck\|set\|root\|quality\|frets`, groups = selected shapes (R-06) | `{ key: 'all-notes', groups: [] }` |
| `model.description` | 005 summary | C18 full-neck text | C18 all-notes text |
| Guidance (`shape.kind`) | beyond / does-not-close | beyond / does-not-close when chain not `chain` (C7) | never |
| `anotherSet` | 005 C11 | 005 C11 when does-not-close | `null` |
| `listenSteps` | 4 steps | 4 × shapes (C11) | ≤ 3 single notes (C12) |
| `listen.enabled` | shape shown | chain non-empty | lowest root reachable |
| `controls` | both true | both true | both false |
| `octave.applies` | true | false (buttons `aria-disabled`, hint) | false |
| Wide-stretch | `WideStretchMark` | per tag (`detail`) + description | none |

## 5. Fretboard model (`src/lib/fretboard/types.ts`)

```ts
export interface FretboardTag {
  readonly id: string;
  readonly start: number;                  // lowest fret of the shape (0 allowed)
  readonly end: number;                    // highest fret of the shape
  readonly label: string;                  // visible short text ("Root position" | "1st" | "2nd")
  readonly name: string;                   // accessible name ("2nd inversion, frets 9-10-9[, wide stretch]")
  readonly pressed: boolean;               // aria-pressed
  readonly detail?: string;                // visible secondary line (e.g. "Wide stretch")
}

export interface DisplayModel {
  // …existing fields, plus:
  readonly tags?: readonly FretboardTag[];
  readonly autoScroll?: { readonly key: string; readonly groups: readonly (readonly Position[])[] };
}

export interface FretboardProps {
  // …existing, plus:
  ontag?: (id: string) => void;
}
```

**Tag layout** (`src/lib/fretboard/tags.ts`, pure)

```ts
export interface TagBox { readonly center: number; readonly width: number }
export interface PlacedTag { readonly x: number; readonly row: number }
export function layoutTags(items: readonly TagBox[], boardWidth: number, gap: number): readonly PlacedTag[];
```

Invariants: same length/order as input; `0 ≤ x ≤ boardWidth − width`; no two tags on the same
row overlap (including `gap`); each item takes the lowest row where it fits; row count ≥ 1 when
items exist.

## 6. Validation rules from requirements

| Rule | Source | Enforced in |
|---|---|---|
| Chain = exactly {TM-5.3 lowest + 12k that fits} per inversion, sorted by low-string fret | FR-002, SC-002 | `inversionChain` + table/property tests |
| Tags name inversion relative to chosen root | FR-004, FR-008, C17 | `ChainShape.inversion` from `triadShape` input, not bass note |
| All-notes set = all positions with pc ∈ triad, nothing else | FR-009, SC-003 | `buildTriadsModel` + 12×4 test |
| Controls disabled iff All notes | FR-010, SC-004 | `display.controls` + component test |
| Occurrence index preserved outside Isolated | C4 | `octaveUp/Down` guard |
| View not persisted; reset → isolated | FR-019 | `resetTriads`, no prefs import |
