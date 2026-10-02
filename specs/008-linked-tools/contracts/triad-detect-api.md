# Contract: Triad detection (theory)

Module: `src/lib/theory/triad-detect.ts`. It is pure and imports only `./pitch` and `./triad`.
The theory ESLint boundary applies to it (Principle III).

```ts
import type { PitchClass } from './pitch';
import type { Quality } from './triad';

export interface TriadMatch {
  readonly rootPc: PitchClass;
  readonly quality: Quality;
}

/**
 * TM-4.5. `selection` is in first-selected order.
 * Returns null unless it is exactly three distinct pitch classes forming
 * major (4,7), minor (3,7), diminished (3,6) or augmented (4,8) above one of them.
 * Augmented: root = selection[0].
 */
export function detectTriad(selection: readonly PitchClass[]): TriadMatch | null;
```

## Guarantees (each one is a test)

| # | Input | Output |
|---|---|---|
| D1 | `[0, 4, 7]` (C E G) | `{ rootPc: 0, quality: 'major' }` |
| D2 | `[8, 0, 4]` (G♯ C E) | `{ rootPc: 8, quality: 'augmented' }` |
| D3 | `[4, 8, 0]` (E G♯ C) | `{ rootPc: 4, quality: 'augmented' }` |
| D4 | `[0, 2, 4]` (C D E) | `null` |
| D5 | `[1, 5, 8]` (C♯ F G♯) | `{ rootPc: 1, quality: 'major' }` |
| D6 | any permutation of a major, minor or diminished triad | the same root and quality |
| D7 | length ≠ 3, duplicates, non-integers, or values outside 0..11 | `null`, never throws |
| D8 | 12 roots × 4 qualities × 6 orders (SC-002) | the expected root; augmented root = first element |

Property tests (fast-check):

- for every root `r` and quality `q`, and any permutation `p` of
  `spellTriad(r,q).pitchClasses`, the result is `detectTriad(p).quality === q`. The root is
  `r` unless the quality is augmented, in which case the root is `p[0]`;
- for any accepted input, the pitch-class set of `spellTriad(defaultRootSpelling(root, q), q)`
  equals the input set.
