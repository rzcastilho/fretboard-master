# Contract: CAGED layers — module API

Internal TypeScript contracts between modules. Vitest asserts each one. Types are in
[data-model.md](../data-model.md). Every function is total: it never throws, and malformed
input returns `[]`, `null` or the input reference unchanged.

## 1. `src/lib/theory/caged-layers.ts` (new)

Imports only `./pitch`, `./triad` and `./caged`. Enforced by the existing theory import-boundary
lint rule.

```ts
export type CagedLayer = 'chord' | 'arpeggio' | 'pentatonic' | 'scale';
export type MelodicLayer = Exclude<CagedLayer, 'chord'>;
export type ScaleDegree = 'R' | '2' | '3' | 'b3' | '4' | '5' | '6' | 'b6' | '7' | 'b7';

export const LAYER_PRIORITY: readonly CagedLayer[];            // chord > arpeggio > pentatonic > scale
export const SCALE_REGIONS: Readonly<Record<CagedQuality, Readonly<Record<CagedShapeId, readonly [number, number]>>>>;
export const LAYER_DEGREES: Readonly<Record<CagedQuality, Readonly<Record<MelodicLayer, ReadonlySet<ScaleDegree>>>>>;

export interface LayerNote {
  readonly string: number;   // 1 … stringCount (7 allowed)
  readonly fret: number;     // 0 … fretCount
  readonly degree: ScaleDegree;
  readonly pitch: Pitch;
}

export function degreeOf(pc: PitchClass, rootPc: PitchClass, q: CagedQuality): ScaleDegree | null;
export function inLayer(d: ScaleDegree, layer: MelodicLayer, q: CagedQuality): boolean;
export function isExtraMarked(d: ScaleDegree, q: CagedQuality): boolean;
/** Every scale note of the occurrence's region on every string, clipped to 0…fretCount, low→high. */
export function layerNotes(
  occ: ShapeOccurrence,
  openPitches: readonly Pitch[],  // string 1 first; length 6 or 7
  rootPc: PitchClass,
  q: CagedQuality,
  fretCount: number
): readonly LayerNote[];
export function spellScale(root: Spelling, q: CagedQuality): Readonly<Partial<Record<ScaleDegree, Spelling>>>;
```

**Table anchors**: these are exact sets of `(string, fret, degree)` for C (major, TM-6.4 and
TM-6.5) and C minor (TM-7.4 and TM-7.5), standard tuning, 6 strings, 24 frets, one test per
shape:

| Anchor | Expected |
|---|---|
| C major, E shape, scale | s6 7(7) 8(R) 10(2) · s5 7(3) 8(4) 10(5) · s4 7(6) 9(7) 10(R) · s3 7(2) 9(3) 10(4) · s2 8(5) 10(6) · s1 7(7) 8(R) 10(2) |
| A minor, Em shape (5-fret occurrence), pentatonic | s6 5 8 · s5 5 7 · s4 5 7 · s3 5 7 · s2 5 8 · s1 5 8 |
| C major, C shape at fret 0 | no fret < 0 (TM-6.6) |
| AF-21, D major, C shape, scale | the s7 frets equal the s2 frets (TM-6.7) |
| AF-4 (Drop D), D major, E shape | region 9–12; scale s6 = 9(6) 11(7) 12(R); pentatonic s6 = 9 12 |

`cagedOccurrences` (in `caged.ts`) adds `region` to every occurrence. Existing fields and order
are unchanged, and the existing TM-6.1, TM-6.2, TM-6.3, TM-7.1 and TM-7.2 tests stay green.

## 2. `src/lib/notation/notation.ts` (extended)

```ts
export function intervalLabel(id: IntervalId | ScaleDegree): string;
// 'R' → m.interval_root(); 'b3' → '♭3'; 'b6' → '♭6'; 'b7' → '♭7'; 'b5' → '♭5'; '#5' → '♯5'; else id
```

## 3. `src/lib/state/caged-view.ts` (extended)

```ts
export interface LayersOn { readonly chord: boolean; readonly arpeggio: boolean; readonly pentatonic: boolean; readonly scale: boolean }
export type CagedLabelType = 'interval' | 'name';
export const CAGED_LABEL_TYPES: readonly CagedLabelType[];

export function initialCagedView(label?: CagedLabelType): CagedViewState;   // layers = CHORD_ONLY
export function setLayers(s: CagedViewState, l: LayersOn): CagedViewState;  // same ref when equal
export function setLabelType(s: CagedViewState, t: CagedLabelType): CagedViewState;
export function resetCaged(preferredLabel?: CagedLabelType): CagedViewState;
export function equalsLayers(a: LayersOn, b: LayersOn): boolean;
```

## 4. `src/lib/state/caged-layers.ts` (new, pure)

Imports `../theory/*` and `./caged-view` types only. No Svelte, DOM or paraglide.

```ts
export const CHORD_ONLY: LayersOn;
export interface SwitchState { readonly on: boolean; readonly disabled: null | 'last-layer' | 'no-shapes' }

export function isDrawable(l: LayersOn, layer: CagedLayer, hasFocus: boolean): boolean;
export function switchStates(l: LayersOn, hasFocus: boolean, hasOccurrences: boolean): Readonly<Record<CagedLayer, SwitchState>>;
export function toggleLayer(l: LayersOn, layer: CagedLayer, hasFocus: boolean, hasOccurrences: boolean): LayersOn;
export function needsAutoFocus(l: LayersOn, layer: CagedLayer, focus: CagedFocus | null): boolean;
export function ensureDrawable(l: LayersOn, hasFocus: boolean): { readonly layers: LayersOn; readonly restoredChord: boolean };

export interface ResolveInput {
  readonly occurrences: readonly ShapeOccurrence[];   // drawn, sorted by start
  readonly focusIndex: number | null;
  readonly layers: LayersOn;
  readonly rootPc: PitchClass;
  readonly quality: CagedQuality;
  readonly openPitches: readonly Pitch[];             // string 1 first
  readonly fretCount: number;
}
export function resolveCagedPositions(input: ResolveInput): readonly ResolvedPosition[];
export function layerCounts(p: readonly ResolvedPosition[]): Readonly<Record<CagedLayer, number>>;
/** Keys of `next` not in `prev`, ordered by pitch ascending, ties → higher string number first. */
export function revealOrder(prev: readonly ResolvedPosition[], next: readonly ResolvedPosition[]): readonly string[];
```

Behavior table for `resolveCagedPositions`, C major, standard tuning, 24 frets:

| Layers on | Focus | Assertion |
|---|---|---|
| chord | none | identical markers to slice 016 (regression) |
| chord + arpeggio | none | every R, 3 and 5 in every drawn region; chord keys are `chord`; others are `arpeggio`, `normal` |
| chord + scale | E | s5 f7 (a G-shape chord note inside the E region, degree 3) is one `scale` `highlighted` marker; the G shape's dimmed chord marker is not drawn there (FR-018) |
| chord + arpeggio | E | s5 f7 is one `arpeggio` `highlighted` marker (clarify-review overlap test) |
| chord + pentatonic + scale | E | F (s5 f8, s3 f10) and B (s6 f7, s4 f9, s1 f7) have `extra = true`; nothing else does |
| scale only (chord off) | E | no `chord` layer anywhere; chord positions are `scale` |
| arpeggio only (chord off) | none | chord positions are `arpeggio`; no dimmed markers |
| chord + pentatonic | none | no pentatonic positions (FR-012) |

## 5. `src/lib/state/caged-model.ts` (extended)

```ts
export interface CagedExtras {
  readonly reveal: { readonly ids: readonly string[] } | null;
  readonly layerChange: { readonly layer: CagedLayer; readonly on: boolean } | null;
}
export function buildCagedModel(
  view: CagedViewState, instrument: Instrument, context: CagedContext,
  transition?: StepTransition | null, extras?: CagedExtras
): CagedDisplay;   // + switches, extraSampleShown, positions
```

- `model.labelMode` is `'interval'` or `'note'`, following `view.labelType`.
- Markers follow the data-model §6 mapping. `appear` is present only for ids in
  `extras.reveal`.
- In a non-compatible tuning, `switches.*.disabled === 'no-shapes'` and the layer state is
  kept.

## 6. `src/lib/state/caged.svelte.ts` (extended store)

```ts
caged.toggleLayer(layer: CagedLayer): void;      // FR-002, FR-012; no playback stop
caged.setLabelType(t: CagedLabelType): void;     // remembers prefs labels.caged
caged.restoreLabelType(t: CagedLabelType): void; // startup; no remember
caged.reveal: { ids: readonly string[] } | null;
caged.reset(): void;                             // layers → CHORD_ONLY, label → preferred
```

Focus-clearing entry points (`chooseShape('all')`, `toggleTag` off, `applyInstrument`,
`viewInStandard`, `endTemporary`, `selectRoot` and `setQuality` when the focus re-resolves to
null) call `ensureDrawable`. When it restores Chord, they set
`layerChange = { chord, on: true }`.

`export const REVEAL_WINDOW_MS = 300;` must equal `--duration-short` (asserted by a test).

## 7. `src/lib/prefs/schema.ts` and `src/lib/state/preferences.svelte.ts`

- `Preferences.labels` is `{ notes; triads; caged: CagedLabelType }`, and
  `DEFAULT_PREFERENCES.labels.caged` is `'interval'`.
- `parsePreferences` uses a missing-or-invalid fallback to `'interval'`.
- `serializePreferences` writes `labels.caged` only when it is `'name'`.
- `preferences.restore` calls `caged.restoreLabelType(p.labels.caged)`, and `erase` restores
  the default.
- `session.remember({ labels: { …, caged } })` is called from `caged.setLabelType`.

## 8. `src/lib/fretboard/types.ts`, `Fretboard.svelte`, `MarkerSample.svelte`

```ts
interface Marker {
  // … existing
  readonly interval?: IntervalId | ScaleDegree;
  readonly layer?: 'arpeggio';
  readonly extra?: boolean;
  /** 0 ≤ appear < 1: fraction of the reveal sequence. Drawing only. */
  readonly appear?: number;
}
```

- The marker group gets class `layer-arpeggio` when `layer === 'arpeggio'`, and contains
  `circle.extra-dot` when `extra`.
- An `appear` intro runs only on mount. Its delay is `appear × (tokenDuration('--duration-short')
  − tokenDuration('--duration-fast'))`, which is 0 under reduced motion.
- `MarkerSample.svelte` takes props `{ fn: NoteFunction; layer?: 'arpeggio'; extra?: boolean }`
  and renders an `aria-hidden` `svg.marker-sample` containing the same `.glyph` geometry and
  token-driven classes.
- Other tools never set the new fields, so their output is unchanged (regression: existing
  Notes and Triads screenshots unchanged).
