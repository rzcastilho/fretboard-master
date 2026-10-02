# Contract delta: Triads theory API

**Feature**: `007-quality-comparison` | Base: [006 triads-theory-api](../../006-full-neck-and-all-notes/contracts/triads-theory-api.md) | Data: [data-model §1](../data-model.md)

Module: `src/lib/theory/triad-shape.ts`. It stays pure and imports only `./pitch` and
`./triad`; the lint boundary is unchanged. `src/lib/theory/triad.ts` is unchanged (R-02).

## Exports added

```ts
export type Functions3 = readonly [TriadFunction, TriadFunction, TriadFunction];

export interface NoteMove {
  readonly index: 0 | 1 | 2;
  readonly function: 'third' | 'fifth';
  readonly fromFret: number;
  readonly toFret: number;
  readonly delta: -2 | -1 | 1 | 2;
}

export const ONE_NOTE_PARTNER: Readonly<Record<Quality, Quality>>;

/** First shape with each differing note moved on its own string; result may be out of 0…fretCount. */
export function comparisonFrets(frets: Frets3, functions: Functions3, from: Quality, to: Quality): Frets3;

/** Notes whose interval differs between `from` and `to`, low → high; [] when from === to. */
export function noteMoves(frets: Frets3, functions: Functions3, from: Quality, to: Quality): readonly NoteMove[];

/** Indexes k of `occs` where every comparison fret lies in 0…fretCount. */
export function pairOccurrences(
  occs: readonly Frets3[], functions: Functions3, from: Quality, to: Quality, fretCount: number
): readonly number[];
```

## Guarantees (each one is tested)

| # | Guarantee | Test |
|---|---|---|
| T1 | `noteMoves(...).every(m => m.function !== 'root')` | table + property |
| T2 | Major↔minor: exactly `[{function:'third', delta:∓1}]`. Minor↔diminished: exactly the fifth, ∓1. Major↔augmented: exactly the fifth, ±1. This holds for all 12 roots × 3 inversions × every string set of the 6-string standard tuning, and the 7-string (SC-001) | `triad-compare.test.ts` |
| T3 | For random valid tunings (NFR-9.3 generator) and every ordered quality pair: the comparison pitches `open[j] + comparisonFrets[j]` are strictly rising, have the comparison triad's pitch classes, and have the inversion's bass function | `triad-compare.property.test.ts` |
| T4 | `comparisonFrets − triadShape(open, spellTriad(root, to), inv).frets` is the same multiple of 12 on all three strings | property |
| T5 | TM-9 sample 10: G major, 2nd inversion, set 4-3-2, standard, 22 frets → `occurrences` = `[0,0,0]`, `[12,12,12]`; `pairOccurrences` = `[1]`; the comparison at k=1 is `[12,12,11]` | table |
| T6 | `comparisonFrets(f, fn, q, q)` equals `f`, and `noteMoves(f, fn, q, q)` is `[]` | table |
| T7 | Pure functions: same input → same output, and the input is not mutated (frozen-input test) | table |

## Coverage

These functions count toward the ≥ 95 % line and branch coverage gate on `src/lib/theory`.
