# Contract: Tuning, Instrument Config and Store API (custom tuning)

**Feature**: `011-custom-tuning` | Extends
[009 instrument-config-api.md](../../009-instrument-panel-and-tunings/contracts/instrument-config-api.md).
Types and semantics are defined in [data-model.md](../data-model.md); this file fixes the
public signatures other modules and tests rely on.

## 1. `src/lib/theory/pitch.ts` (pure; additions)

```ts
export function sharpSpelling(pc: PitchClass): Spelling;     // C C♯ D D♯ E F F♯ G G♯ A A♯ B
export function spellSharp(p: Pitch): SpelledPitch;          // octave = octaveOf(p)
```

`notation.defaultSpelling(pc)` MUST return `sharpSpelling(pc)` (unchanged results; existing
notation tests keep passing).

## 2. `src/lib/instrument/custom-tuning.ts` (new, pure; may import only `../theory/*` and `./*`)

```ts
export type Offsets = readonly [number, number, number, number, number, number];
export const OFFSET_MIN: -7;
export const OFFSET_MAX: 4;
export const STANDARD_OFFSETS: Offsets;
export type StringNumber = 1 | 2 | 3 | 4 | 5 | 6;

export function isOffsets(x: unknown): x is Offsets;
export function presetOffsets(id: TuningId): Offsets;
export function matchPreset(o: Offsets): TuningId | null;
export function offsetPitches(o: Offsets): readonly Pitch[];          // strings 6 → 1
export function invertedStrings(o: Offsets): boolean;
export function canStep(o: Offsets, string: StringNumber, delta: 1 | -1): boolean;
export function stepOffsets(o: Offsets, string: StringNumber, delta: 1 | -1): Offsets;
```

Guarantees: all functions total; `stepOffsets` returns the same reference when the step is
refused; returned arrays are frozen.

## 3. `src/lib/instrument/tunings.ts` (additions)

```ts
export type Tuning =
  | { readonly kind: 'preset'; readonly id: TuningId }
  | { readonly kind: 'custom'; readonly offsets: Offsets };

export const STANDARD_TUNING: Tuning;                       // { kind: 'preset', id: 'AF-1' }
export function tuningFromOffsets(o: Offsets): Tuning;     // canonical: preset when matched
export function offsetsOfTuning(t: Tuning): Offsets;
export function equalsTuning(a: Tuning, b: Tuning): boolean;
export function isStandard(t: Tuning): boolean;
export function tuningStrings(t: Tuning): readonly SpelledPitch[];   // low → high
export function tuningInstrument(t: Tuning, fretCount: number): Instrument; // memoized, frozen
```

Invariant tested by property: for every valid `o`,
`tuningFromOffsets(o).kind === 'custom'` ⇔ `matchPreset(o) === null`, and
`offsetsOfTuning(tuningFromOffsets(o))` equals `o`. `tuningInstrument(STANDARD_TUNING, 22)` is
`STANDARD_GUITAR` (reference equality, as today).

## 4. `src/lib/state/instrument-config.ts` (changed)

```ts
export interface InstrumentConfig { readonly tuning: Tuning; readonly fretCount: number; }
export type PanelState =
  | { readonly open: false }
  | { readonly open: true; readonly pending: InstrumentConfig; readonly customOpen: boolean };

export function chooseCustom(p: PanelState): PanelState;
export function stepString(p: PanelState, string: StringNumber, delta: 1 | -1): PanelState;
// existing: openPanel, selectTuning, setFrets, stepFrets, restoreDefault, cancelPanel,
// confirmPanel, equalsConfig, instrumentOf — semantics per data-model §3.
```

**Breaking change** (internal only): `InstrumentConfig.tuningId` is removed. Every caller in
`src/` and `tests/` is migrated in this slice (badge, summary, panel, preferences store, the
009/010 unit tests' fixtures).

## 5. `src/lib/state/instrument.svelte.ts` (additions)

```ts
instrument.chooseCustom(): void;
/** Returns true iff the pending pitch changed (then the caller plays it). */
instrument.stepString(string: StringNumber, delta: 1 | -1): boolean;
/** Plays the pending open string (no-op when the panel is closed). */
instrument.playString(string: StringNumber): void;
```

- `confirm(screen)`: on change writes
  `preferences.remember({ tuningId, customTuning, fretCount })` per storage-format writer rules;
  everything else (stop playback once, apply to Notes and Triads, adjust notice) unchanged.
- `restore(config)`: unchanged contract (config now carries `tuning`).

## 6. `src/lib/prefs/schema.ts` (additions)

```ts
interface Preferences { /* …010 fields… */ readonly customTuning: Offsets | null; }
export function tuningOfPreferences(p: Preferences): Tuning;
```

`DEFAULT_PREFERENCES.customTuning = null`. `PreferencesPatch` accepts `customTuning`.

## 7. `src/lib/shell/tuning-names.ts` (addition)

```ts
export function tuningLabel(t: Tuning): string;  // preset → tuningName(id); custom → m.tuning_custom()
```

Badge: shown iff `!isStandard(active.tuning)`, text `tuningLabel(active.tuning)`.
Summary: `isStandard` → `instrument_summary_standard`, else
`instrument_summary_preset({ name: tuningLabel(...) })`.
