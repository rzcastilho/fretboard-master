# Contract delta: Fretboard display model (interval labels)

**Feature**: `005-triads-isolated-view` | Base: [004 fretboard-model](../../004-fretboard-notes-tool/contracts/fretboard-model.md) | Research: R-10

Backwards-compatible additions to `src/lib/fretboard/types.ts`:

```ts
export type LabelMode = 'note' | 'octave' | 'interval' | 'none';

export interface Marker {
  // …existing fields…
  /** Interval from the root (Triads). Used only when labelMode is 'interval'. */
  readonly interval?: IntervalId;   // re-exported type from $lib/theory/triad via notation
}
```

## Label rule (extends §1 of the base contract)

| labelMode | Labeled marker shows |
|---|---|
| `note` | `noteLabel(mk.spelling ?? default)` (unchanged; Triads passes `spelling`, so F𝄪 shows as F𝄪) |
| `octave` | unchanged |
| `interval` | `intervalLabel(mk.interval)` from `src/lib/notation` (`R`, `3`, `♭3`, `5`, `♭5`, `♯5`); no label when `interval` is absent |
| `none` | unchanged |

- Marker shape per function (root rounded square, third circle, fifth diamond) is unchanged and
  independent of label mode (FR-015, Principle VII).
- Cell accessible names and `describeView` are unchanged: spoken note (from `spelling`) +
  function. Interval mode therefore does not reduce text information.
- `intervalLabel` is added to `src/lib/notation/notation.ts`; "R" comes from the message
  catalog (`interval_root`), accidentals are glyphs, never `b`/`#`.
- Notes tool: no change (never sets `interval` or `'interval'`).

Tests: `tests/unit/fretboard/fretboard.test.ts` gains interval-mode label cases;
`tests/unit/notation/notation.test.ts` gains `intervalLabel` cases.
