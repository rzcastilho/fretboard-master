# Contract: String-Count and Tuning API (internal modules)

**Feature**: `012-seven-strings` | Extends
[011 tuning-api.md](../../011-custom-tuning/contracts/tuning-api.md) and
[009 instrument-config-api.md](../../009-instrument-panel-and-tunings/contracts/instrument-config-api.md).
Types and semantics: [data-model.md](../data-model.md). All functions pure, deterministic,
frozen/memoized results, explicit return types; expected failures return the input or `null`,
never throw.

## 1. `src/lib/theory/pitch.ts`

```ts
export function fourthBelow(s: SpelledPitch): SpelledPitch | null;
```

## 2. `src/lib/instrument/tunings.ts`

```ts
export type StringCount = 6 | 7;
export const DEFAULT_STRING_COUNT: 6;
export function isStringCount(x: unknown): x is StringCount;

export type TuningId = 'AF-1' | … | 'AF-11' | 'AF-21' | 'AF-22' | 'AF-23';
export function isTuningId(x: unknown): x is TuningId;               // any of 14
export function isTuningIdFor(x: unknown, count: StringCount): x is TuningId;
export function presetsFor(count: StringCount): readonly TuningId[];   // panel order
export function presetStrings(id: TuningId, count: StringCount): readonly SpelledPitch[]; // low → high
export function standardTuningId(count: StringCount): 'AF-1' | 'AF-21';
export function normalizePresetId(id: TuningId, count: StringCount): TuningId;
//   7: AF-1 → AF-21, AF-2 → AF-22;  6: AF-21/22/23 → AF-1;  otherwise id

export function tuningFromOffsets(o: Offsets): Tuning;                 // count = o.length
export function offsetsOfTuning(t: Tuning, count: StringCount): Offsets;
export function tuningStrings(t: Tuning, count: StringCount): readonly SpelledPitch[];
export function isStandard(t: Tuning): boolean;                        // AF-1 | AF-21
export function tuningInstrument(t: Tuning, count: StringCount, fretCount: number): Instrument;
```

Removed/changed signatures (all call sites updated in the same slice):
`presetInstrument(id, frets)` gains `count`; `offsetsOfTuning`, `tuningStrings`,
`tuningInstrument` gain `count`. `TUNING_PRESETS` stays exported (catalog/test use) and now
holds 14 entries; consumers that render a list use `presetsFor(count)`.

## 3. `src/lib/instrument/custom-tuning.ts`

```ts
export type Offsets = readonly number[];            // length 6 | 7
export type StringNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export function referencePitches(count: StringCount): readonly Pitch[];
export function isOffsets(x: unknown, count: StringCount): x is Offsets;
export function standardOffsets(count: StringCount): Offsets;
export function presetOffsets(id: TuningId, count: StringCount): Offsets;
export function matchPreset(o: Offsets): TuningId | null;       // searches presetsFor(o.length)
export function offsetPitches(o: Offsets): readonly Pitch[];
export function invertedStrings(o: Offsets): boolean;
export function canStep(o: Offsets, string: StringNumber, delta: 1 | -1): boolean;
export function stepOffsets(o: Offsets, string: StringNumber, delta: 1 | -1): Offsets;
export function addSeventh(o: Offsets): Offsets;   // [o[0], ...o]; same ref if length ≠ 6
export function dropSeventh(o: Offsets): Offsets;  // o.slice(1);  same ref if length ≠ 7
```

## 4. `src/lib/state/instrument-config.ts`

```ts
export interface InstrumentConfig {
  readonly stringCount: StringCount;
  readonly tuning: Tuning;
  readonly fretCount: number;
}
export function setStringCount(p: PanelState, n: number): PanelState;   // NEW
// selectTuning refuses ids not in presetsFor(pending.stringCount)
// stepString refuses string > pending.stringCount
// equalsConfig compares stringCount; instrumentOf uses tuningInstrument(t, count, frets)
```

## 5. `src/lib/state/instrument.svelte.ts` (store)

```ts
instrument.setStringCount(n: StringCount): void;
instrument.stringCount: StringCount;           // pending while open, else active
instrument.presets: readonly { id: TuningId; strings: readonly SpelledPitch[] }[];
instrument.rows: readonly StringRow[];         // string count … 1
```

## 6. `src/lib/state/notes-view.ts`

```ts
export function adaptNotesView(s: NotesViewState, prev: Instrument, next: Instrument):
  { view: NotesViewState; adjusted: boolean };   // string-filter rules: data-model §6
```

## 7. Required tests (Principle IV — written first)

| Suite | Asserts |
|---|---|
| `tests/unit/theory/pitch.test.ts` (+ property) | `fourthBelow` table (E→B, D→A, C→G, E♭→B♭, B→F♯, F→C) and pitch − 5 invariant |
| `tests/unit/instrument/tunings.test.ts` | `presetsFor(6)` = AF-1…AF-11, `presetsFor(7)` = 12 ids in FR-003 order; AF-21/22/23 spelling; derived rows table (data-model §1); `normalizePresetId` |
| `tests/unit/instrument/custom-tuning.test.ts` (+ property) | string-7 limits E1/D♯2; `matchPreset` on 7 never returns AF-1/AF-2; `addSeventh`/`dropSeventh` round trip; canonical-form property for both counts |
| `tests/unit/state/instrument-config.test.ts` | every transition row of data-model §4; Restore default → 6/AF-1 |
| `tests/unit/state/notes-adapt.test.ts` | every string-filter row of data-model §6; card on string 7 closes with `adjusted` |
| `tests/unit/state/triads-view.test.ts` | 7 → 6 on 7-6-5 → 6-5-4 adjusted; other sets not adjusted; 6 → 7 never adjusted |
| `tests/unit/theory/triad-shape.test.ts` | TM-5.5 7-6-5 table (12 shapes, AF-21, root C); NFR-9.3 property extended to 7-string tunings |
| `tests/unit/fretboard/fretboard.test.ts` | 7 rows; `.string-7` present; row pitch ≥ root marker size; `screenOrder` with 7 for each handedness/orientation value |
