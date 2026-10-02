# Contract delta: Triad theory — inversion chain

**Feature**: `006-full-neck-and-all-notes` | Base: [005 triads-theory-api](../../005-triads-isolated-view/contracts/triads-theory-api.md) | Data model: [§1](../data-model.md) | Research: R-01, R-02

Addition to `src/lib/theory/triad-shape.ts` (pure; imports only `./pitch`, `./triad`; Principle III lint boundary unchanged).

```ts
export interface ChainShape {
  readonly inversion: Inversion;
  readonly octave: number;
  readonly frets: Frets3;
  readonly functions: readonly [TriadFunction, TriadFunction, TriadFunction];
}
export type ChainResult =
  | { readonly kind: 'chain'; readonly shapes: readonly ChainShape[] }
  | { readonly kind: 'beyond' }
  | { readonly kind: 'does-not-close' };

/** Every occurrence of every inversion on three open pitches that fits in `fretCount`, ordered by lowest-string fret (C1, C2). */
export function inversionChain(
  open: readonly [Pitch, Pitch, Pitch],
  t: TriadSpelling,
  fretCount: number
): ChainResult;
```

## Behaviour

| Input (standard tuning) | Expected `shapes` (inversion frets) |
|---|---|
| A major, 3-2-1, 22 frets | root 2-2-0, 1st 6-5-5, 2nd 9-10-9, root 14-14-12, 1st 18-17-17, 2nd 21-22-21 |
| C major, 3-2-1, 22 | 2nd 0-1-0, root 5-5-3, 1st 9-8-8, 2nd 12-13-12, root 17-17-15, 1st 21-20-20 |
| C augmented, 3-2-1, 22 | 2nd 1-1-0, root 5-5-4, 1st 9-9-8, 2nd 13-13-12, root 17-17-16, 1st 21-21-20 |
| A major, 3-2-1, 7 frets | root 2-2-0, 1st 6-5-5 |
| any, open pitches not strictly rising | `does-not-close` |
| A major, 3-2-1, 1 fret | `beyond` |

## Tests (Principle I gate — added by this slice, gate all later theory changes)

- `tests/unit/theory/triad-chain.test.ts` (table): rows above; C16 patterns — for every root ×
  quality × inversion, pattern on 6-5-4 = pattern on 5-4-3 and the 4-3-2 vs 3-2-1 examples
  (8-7-5 / 3-2-0 → 3-2-0; 10-9-8 → 2-1-0 vs 5-5-3 → 2-2-0); C17 augmented: consecutive shapes same
  pattern, `frets[0]` deltas exactly 4; SC-002 over 12 roots × 4 qualities × 4 sets × 22 frets.
- `tests/unit/theory/triad-chain.property.test.ts` (fast-check, random strictly rising open
  pitches with adjacent gaps 1–11, fret count 0–30, any root/quality): sorted strictly by
  `frets[0]`; each shape equals `triadShape(...)` + 12·octave; set equality with ⋃ occurrences;
  every shape satisfies NFR-9.3 (rising pitch, span < 12, correct pitch classes, correct bass);
  `beyond` iff closes and no occurrence fits.
