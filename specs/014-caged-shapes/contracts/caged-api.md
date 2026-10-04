# Contract: CAGED internal module API

**Feature**: `014-caged-shapes` | Types: [data-model.md](../data-model.md)

These are internal TypeScript module signatures. Every exported function has an explicit
return type. Theory functions are pure, never throw, and import only `./pitch` and `./triad`
(the ESLint boundary). Each section lists the tests that MUST be written first (Principle IV).

## §1 `src/lib/theory/caged.ts` (new)

```ts
export type CagedShapeId = 'C' | 'A' | 'G' | 'E' | 'D';
export type CagedQuality = Extract<Quality, 'major' | 'minor'>;
export type CagedDegree = Extract<IntervalId, 'R' | '3' | 'b3' | '5'>;
export interface ShapeNote { readonly fret: number; readonly degree: CagedDegree }
export interface CagedShape {
  readonly id: CagedShapeId;
  readonly quality: CagedQuality;
  /** Index 0 = string 6 … 5 = string 1; null = muted. C-key, standard-tuning reference. */
  readonly strings: readonly (ShapeNote | null)[];
}
export interface OccurrenceNote { readonly string: number; readonly fret: number; readonly degree: CagedDegree }
export interface ShapeOccurrence {
  readonly shape: CagedShape;
  readonly start: number;
  readonly end: number;
  readonly notes: readonly OccurrenceNote[];
}
export type CagedTuningClass = 'compatible' | 'altered-string' | 'non-compatible';

export const CAGED_CYCLE: readonly CagedShapeId[];                // ['C','A','G','E','D']
export const CAGED_SHAPES: Readonly<Record<CagedQuality, readonly CagedShape[]>>;
export function rootStrings(shape: CagedShape): readonly number[];   // descending, e.g. [6,4,1]
export function cagedTuningClass(sixOpen: readonly Pitch[]): CagedTuningClass;
export function cagedOccurrences(
  sixOpen: readonly Pitch[],     // strings 6 → 1, length 6
  rootPc: PitchClass,
  quality: CagedQuality,
  fretCount: number
): readonly ShapeOccurrence[];   // [] when not compatible or input malformed
export function fitCount(occ: readonly ShapeOccurrence[]): number;  // distinct shape ids
```

**Tests**: `tests/unit/theory/caged.test.ts` (table, test-first)

- TM-6.1 and TM-7.1: the frets, degrees and `rootStrings` of all ten shapes equal the
  data-model §1 table (SC-003).
- TM-6.2: for 12 keys × {major, minor} on standard tuning with 24 frets, the first five
  `(shape.id, start)` pairs equal the TM-6.2 row for that key (SC-002). Minor uses the same
  table (TM-7.2).
- Second cycle: C major, 24 frets → C0 A3 G5 E8 D10 C12 A15 G17 E20 (nine items; D at 22
  omitted).
- EC-6.3:
  - C major, 12 frets → shapes C, A, G, E, and `fitCount` 4;
  - G major, 12 frets → 5;
  - D♭ major, 13 frets → 4;
  - minor gives the same counts.
- Real tuning:
  - AF-2, key C major → C1 A4 G6 E9 D11;
  - AF-21 (strings 6 … 1) and AF-23 → the same as AF-1.
- `cagedTuningClass` per preset, as in data-model §2.
- A malformed input (length ≠ 6) gives `[]` / `'non-compatible'` and never throws.

**Tests**: `tests/unit/theory/caged.property.test.ts` (fast-check)

- Random compatible tuning (string 6 pitch 28…52 with standard intervals above it), random
  key, random quality and fret count 12…24 → the data-model §3 invariants 1–5 hold.
- Random interval vectors ≠ standard → `cagedTuningClass` is never `'compatible'`.
- Changing only string 6 of a compatible tuning → `'altered-string'`.

## §2 `src/lib/state/caged-view.ts` (new, pure)

```ts
export type SpellingOverride = 'none' | 'sharp' | 'flat';   // re-exported from triads-view
export interface CagedViewState {
  readonly rootPc: PitchClass;
  readonly spellingOverride: SpellingOverride;
  readonly quality: CagedQuality;
}
export const CAGED_QUALITIES: readonly CagedQuality[];       // ['major','minor']
export function initialCagedView(): CagedViewState;
export function selectRoot(s: CagedViewState, pc: PitchClass): CagedViewState;
export function setQuality(s: CagedViewState, q: CagedQuality): CagedViewState;
export function switchSpelling(s: CagedViewState): CagedViewState;
export function resetCaged(): CagedViewState;
export function equalsCagedView(a: CagedViewState, b: CagedViewState): boolean;
export function cagedRootSpelling(s: CagedViewState): Spelling;
```

**Tests**: `tests/unit/state/caged-view.test.ts`

- The initial state is C, `'none'`, major.
- Each data-model §4 transition row, including that no-ops return the same object.
- The spelling scenario from the spec: D♭ major → C♯ minor → D♭ minor → D♭ major.
- The defaults for all five altered roots × 2 qualities.

## §3 `src/lib/state/caged-model.ts` (new)

```ts
export interface CagedDisplay {
  readonly keyName: string;
  readonly tuningClass: CagedTuningClass;
  readonly occurrences: readonly ShapeOccurrence[];
  readonly fitCount: number;
  readonly fitNote: string | null;
  readonly model: DisplayModel | null;
  readonly switchTo: Spelling | null;
}
export function buildCagedModel(view: CagedViewState, instrument: Instrument): CagedDisplay;
export function cagedTagText(shape: CagedShape): string;
export function sixHighestOpen(instrument: Instrument): readonly Pitch[];  // strings 6 → 1
```

**Tests**: `tests/unit/state/caged-model.test.ts`

- C major / AF-1 / 22 frets:
  - 5 tags with the exact texts "C shape · roots on strings 5, 2", "A shape · roots on
    strings 5, 3", "G shape · roots on strings 6, 3, 1", "E shape · roots on strings 6, 4, 1"
    and "D shape · roots on strings 4, 2";
  - the tag `start`/`end` spans are 0–3, 3–5, 5–8, 8–10, 10–13;
  - `labelMode: 'interval'`, `tagsInteractive: false`.
- Minor tags read "Cm shape · …" and the third markers have `interval: 'b3'`.
- Shared positions: there is exactly one marker per `string:fret` (for example 4:5, 3:5 and
  2:5 for A → G in C major), with emphasis `normal`.
- Muted strings carry no marker. The C shape has no marker on string 6 at fret 3; this is
  asserted by checking the marker set of string 6 within frets 0–3.
- 7 strings (AF-21): no marker has `string === 7`, and the markers equal those from AF-1.
- 12 frets, C major: `fitNote` = "With 12 frets, 4 shapes fit on the fretboard". With 22
  frets: `null`.
- AF-4 and AF-8: `tuningClass` is not compatible, `model === null`, `fitNote === null`, and
  `occurrences` is `[]`.
- The description contains each occurrence in order, as "E shape, frets 8 to 10, roots on
  strings 6, 4, 1".
- Handedness and orientation variants of the instrument produce an identical `model`.

## §4 `src/lib/state/caged.svelte.ts` (new store)

```ts
export const caged: {
  readonly state: CagedViewState;
  readonly instrument: Instrument;
  readonly display: CagedDisplay;
  selectRoot(pc: PitchClass): void;
  setQuality(q: CagedQuality): void;
  switchSpelling(): void;
  reset(): void;
  applyInstrument(next: Instrument): boolean;   // keeps view; returns false
  useInstrument(next: Instrument): void;        // test hook
  activate(p: Position): void;                  // playback.note
};
export function resetCagedForTests(next?: Instrument): void;
```

**Tests**: `tests/unit/state/caged-store.test.ts`

- A view change stops playback once, and a no-op does nothing.
- `applyInstrument` keeps key, quality and override, recomputes `display`, and returns
  `false`.
- `reset()` gives C major with no override and leaves the instrument unchanged.

## §5 Shell changes (existing modules)

| Module | Change | Tests updated / added |
|---|---|---|
| `src/lib/shell/tools.ts` | `ToolId` adds `'caged'`; `TOOLS[2] = { id: 'caged', path: '/caged', … }` | `tests/unit/tools.test.ts` (order Notes, Triads, CAGED) |
| `src/lib/shell/screens.ts` | `ScreenId`/`SCREENS` add `caged`; `screenTitle('caged')` = "CAGED — Fretboard Master" | `tests/unit/screens.test.ts` (`/caged` becomes known; the unknown-path cases keep `/Triads`, `/triads/x`, add `/caged/x`) |
| `src/lib/shell/ToolLayout.svelte` | `caged` branch; failure reset covers it | `tests/unit/tool-layout.test.ts` |
| `src/lib/state/links.svelte.ts` | `LinkedTool = ToolId`; `linkTools` no-op when either side is `caged`; `resetTool('caged')` | `tests/unit/state/links-store.test.ts` |
| `src/lib/state/instrument.svelte.ts` | `confirm`/`restore` call `caged.applyInstrument` | `tests/unit/state/instrument-store.test.ts` |
| `src/lib/prefs/schema.ts` | `TOOL_IDS` adds `'caged'` | see [storage-format.md](./storage-format.md) |
| `src/lib/fretboard/types.ts` + `Fretboard.svelte` | `DisplayModel.tagsInteractive?: boolean` | `tests/unit/fretboard/fretboard.test.ts` (span tags: no button role, not in Tab order, same placement; mirrored in left-handed) |
| `src/routes/caged/+page.svelte` | new: `<ToolLayout tool="caged" />` | `tests/unit/routes.test.ts` |
