# Contract: Triad theory API (`src/lib/theory/triad.ts`, `src/lib/theory/triad-shape.ts`)

**Feature**: `005-triads-isolated-view` | Data model: [§1–§2](../data-model.md) | Research: R-01–R-06

Pure TypeScript. Imports only `./pitch`. No DOM, Svelte, paraglide, storage, audio, instrument,
handedness, or orientation (ESLint theory boundary). Expected failures are typed results, never
throws.

```ts
// triad.ts
export type Quality = 'major' | 'minor' | 'diminished' | 'augmented';
export type TriadFunction = 'root' | 'third' | 'fifth';
export type IntervalId = 'R' | '3' | 'b3' | '5' | 'b5' | '#5';
export type StackingId = 'M3+m3' | 'm3+M3' | 'm3+m3' | 'M3+M3';
export type RootSpellingChoice = 'sharp' | 'flat';

export interface TriadSpelling {
  readonly root: Spelling;
  readonly third: Spelling;
  readonly fifth: Spelling;
  readonly pitchClasses: readonly [PitchClass, PitchClass, PitchClass];
}

export const QUALITIES: readonly Quality[];                       // display order
export function intervalsOf(q: Quality): readonly [IntervalId, IntervalId, IntervalId];
export function stackingOf(q: Quality): StackingId;
export function rootSpellings(pc: PitchClass): readonly Spelling[];   // 1 or 2 entries
export function isAlteredRoot(pc: PitchClass): boolean;
export function spellTriad(root: Spelling, q: Quality): TriadSpelling;
export function accidentalCount(t: TriadSpelling): number;
export function defaultRootSpelling(pc: PitchClass, q: Quality): Spelling;
export function effectiveRootSpelling(
  pc: PitchClass, override: 'none' | RootSpellingChoice, q: Quality): Spelling;
export function otherRootSpelling(pc: PitchClass, current: Spelling): Spelling | null;
export function choiceOf(pc: PitchClass, s: Spelling): RootSpellingChoice | null;
export function doubleAccidentalNotes(t: TriadSpelling):
  readonly { readonly function: TriadFunction; readonly spelling: Spelling }[];

// triad-shape.ts
export type Inversion = 'root' | 'first' | 'second';
export type Frets3 = readonly [number, number, number];
export type ShapeResult =
  | { readonly kind: 'shape'; readonly frets: Frets3;
      readonly functions: readonly [TriadFunction, TriadFunction, TriadFunction] }
  | { readonly kind: 'does-not-close' };

export const INVERSIONS: readonly Inversion[];
export const INVERSION_ORDER: Readonly<Record<Inversion, readonly [TriadFunction, TriadFunction, TriadFunction]>>;
export const WIDE_STRETCH_SPAN = 5;
export function triadShape(open: readonly [Pitch, Pitch, Pitch], t: TriadSpelling, inv: Inversion): ShapeResult;
export function occurrences(frets: Frets3, fretCount: number): readonly Frets3[];
export function span(frets: Frets3): number;
export function isWideStretch(frets: Frets3): boolean;
```

## Behavioral guarantees (each is a test)

| # | Guarantee | Test |
|---|---|---|
| T1 | `spellTriad` equals TM-4.2 for all 17 root spellings × 4 qualities (68) | table |
| T2 | `defaultRootSpelling` equals TM-4.3 for 5 keys × 4 qualities (20); naturals return the natural | table |
| T3 | `triadShape` on standard-tuning sets for root C equals TM-5.5 (48) | table |
| T4 | Drop D 6-5-4, C major root → 10-7-5, `span` 5, wide stretch (TM-5.7) | example |
| T5 | C diminished root on 5-4-3 standard → 15-13-11; `occurrences(…, 12)` = `[]`, `(…, 22)` = `[15-13-11]` | example |
| T6 | Random strictly rising open pitches (≥ 1,000 runs, fast-check): NFR-9.3 invariants of data-model §2 | property |
| T7 | Random open triples with `open[i] ≥ open[i+1]` somewhere → `does-not-close` | property |
| T8 | `occurrences`: consecutive entries differ by exactly 12 on every string; all ≤ fretCount | property |
| T9 | `span` ignores fret 0 (0-1-0 → 0) | example |
| T10 | C augmented = C–E–G♯ (never A♭) | example |
| T11 | Transposition: for every root pc and every set, the shape equals TM-5.5's root-C shape shifted by the root interval, reduced to the lowest occurrence (TM-5.5 footnote) | property |

Coverage gate: ≥ 95% lines and branches on `src/lib/theory` (constitution merge gate).
