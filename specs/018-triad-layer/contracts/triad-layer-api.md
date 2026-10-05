# Contract: CAGED Triad layer — module API

Internal TypeScript contracts between modules; Vitest asserts each one. Types are in
[data-model.md](../data-model.md). Every function is total: it never throws; malformed input
returns `null`, `[]` or the input reference unchanged.

## 1. `src/lib/theory/caged-triad.ts` (new)

Imports only `./pitch`, `./triad`, `./triad-shape`, `./caged` (theory import-boundary lint).

```ts
export interface ShapeTriad {
  readonly set: number;                       // bass string; strings set, set−1, set−2
  readonly inversion: Inversion;
  readonly frets: Frets3;                     // low → high string
  readonly functions: Functions3;
  readonly occurrence: number;                // Triads octave index k
  readonly pitches: readonly [Pitch, Pitch, Pitch];
}

/** Close-position triad of `set` inside `occ`'s clipped region, or null (R-01, R-02). */
export function shapeTriad(
  occ: ShapeOccurrence,
  openPitches: readonly Pitch[],   // string 1 first; length 6 or 7; real tuning
  triad: TriadSpelling,            // spellTriad(root, quality)
  set: number,
  fretCount: number
): ShapeTriad | null;
```

**Table anchors** (standard tuning, 6 strings, 24 frets; full matrix in research R-01):

| Case | Expected |
|---|---|
| C major, A shape, set 3 | root, frets 5-5-3, occurrence 0 |
| C major, A shape, set 5 | null |
| C major, G shape, set 3 | null |
| C major, D shape, set 3 | second, frets 12-13-12, occurrence 1 |
| C major, C shape (fret 0), set 3 | second, frets 0-1-0 (open position, nothing below the nut) |
| C minor, A shape, set 3 | root, frets 5-4-3 |
| C major, E shape, 12 frets | set 6 null; sets needing fret > 12 null |
| Drop D, D major, E shape, set 6 | uses string 6 from the real tuning (D2), or null if no fit |
| AF-21 (7-string standard), set 7 | available for at least one shape; frets from string 7's real pitch |
| Half step down, A shape, set 3 | frets equal the standard-tuning drawing of the same shape (slice 015 placement); names from real pitch |
| Non-ascending custom set (`does-not-close`) | null |

Properties (fast-check, all 12 keys × 2 qualities × each drawn occurrence × fret counts
12/22/24, plus random compatible tunings): invariants T-1 … T-5 of data-model §1.

## 2. `src/lib/state/caged-layers.ts` (extended)

```ts
export type CagedLayer = 'triad' | 'chord' | 'arpeggio' | 'pentatonic' | 'scale';  // re-exported from theory/caged-layers
export const CHORD_ONLY: LayersOn;            // + triad: false
export function isDrawable(l: LayersOn, layer: CagedLayer, hasFocus: boolean): boolean; // triad ⇔ on && focus
export function switchStates(l, hasFocus, hasOccurrences): Readonly<Record<CagedLayer, SwitchState>>; // + triad
export function needsAutoFocus(l, layer, focus): boolean;  // + triad
export interface ResolveInput { /* … */ readonly triad: ShapeTriad | null }
export function resolveCagedPositions(input: ResolveInput): readonly ResolvedPosition[];
export function layerCounts(p): Readonly<Record<CagedLayer, number>>;  // + triad
```

Behavior table, C major, standard tuning, 24 frets, A shape focused, triad = set 3:

| Layers on | Assertion |
|---|---|
| chord + triad | s3 f5, s2 f5, s1 f3 are `triad`; no other `triad`; those keys appear once |
| triad only (chord off) | the three `triad` positions; no `chord` anywhere |
| chord + arpeggio + triad, then arpeggio off | identical `triad` positions (I-10) |
| chord + triad, focus cleared | zero `triad`; chord as slice 016 |
| triad on, triad = null (no set available) | zero `triad`; other layers unchanged |
| all five layers | one entry per key; priority triad > chord > arpeggio > pentatonic > scale |

Toggle sequences (SC-006): only Triad drawable ⇒ its switch `last-layer`; clearing focus with
only Triad on ⇒ `ensureDrawable` restores Chord (`restoredChord = true`), Triad stays on.

## 3. `src/lib/state/caged-triad.ts` (new, pure)

Imports `../theory/*`, `../instrument/*` and `./caged-view` types. No Svelte, DOM, paraglide.

```ts
export interface SetAvailability { readonly set: number; readonly triad: ShapeTriad | null }
export interface TriadsHandoff {
  readonly rootPc: PitchClass; readonly spelling: SpellingOverride; readonly quality: CagedQuality;
  readonly inversion: Inversion; readonly stringSet: StringSetId; readonly occurrence: number;
}
export function triadAvailability(occ: ShapeOccurrence | null, instrument: Instrument,
  root: Spelling, quality: CagedQuality): readonly SetAvailability[];   // [] when occ null
export function defaultTriadSet(avail: readonly SetAvailability[]): StringSetId | null;
export function settleTriadSet(current: StringSetId | null, avail: readonly SetAvailability[]):
  { readonly set: StringSetId | null; readonly moved: boolean };
export function selectedTriad(set: StringSetId | null, avail: readonly SetAvailability[]): ShapeTriad | null;
export function triadRevealIds(t: ShapeTriad | null): readonly string[];   // 'triad:s:f', low → high
export function triadHandoff(view: CagedViewState, t: ShapeTriad | null, temporary: boolean): TriadsHandoff | null;
```

| Case | Expected |
|---|---|
| `defaultTriadSet` C major A shape | 3 |
| `defaultTriadSet` C major G shape | 6 (3 unavailable) |
| `defaultTriadSet` 7 strings, set 3 unavailable | first available from 7 |
| `defaultTriadSet` nothing available | null |
| `settleTriadSet(3, A-shape)` | `{ set: 3, moved: false }` |
| `settleTriadSet(3, G-shape)` | `{ set: 6, moved: true }` |
| `settleTriadSet(3, none available)` | `{ set: 3, moved: false }` |
| `triadHandoff` with `temporary = true` or `t = null` | null |

## 4. `src/lib/state/caged-view.ts` (extended)

```ts
export interface LayersOn { readonly triad: boolean; /* + existing four */ }
export interface CagedViewState { /* … */ readonly triadSet: StringSetId | null }
export function setTriadSet(s: CagedViewState, id: StringSetId | null): CagedViewState; // same ref when equal
// initialCagedView / resetCaged: layers = CHORD_ONLY, triadSet = null
```

## 5. `src/lib/state/caged-model.ts` (extended)

```ts
export interface CagedExtras {
  readonly reveal: { readonly ids: readonly string[] } | null;
  readonly layerChange: { readonly layer: CagedLayer; readonly on: boolean } | null;
  readonly triadChange: { readonly kind: 'selected' | 'moved' | 'unavailable'; readonly set: number; readonly from?: number } | null;
}
export interface CagedTriadDisplay {
  readonly sets: readonly { readonly id: number; readonly label: string; readonly available: boolean; readonly ariaLabel: string }[];
  readonly selected: number | null;
  readonly summary: string | null;
  readonly unavailableNote: string | null;
  readonly handoff: TriadsHandoff | null;
}
// CagedDisplay: + triad: CagedTriadDisplay | null; switches + triad; positions include triad
```

- Exactly three markers have `layer === 'triad'` while a triad is drawn; their ids are
  `triad:s:f`; `ring` is kept when the position is a connection (FR-007).
- C major A shape set 3 with `labelType = 'name'`: labels C, E, G. Half step down E major
  (sounding E♭): names follow the real pitch (SC-005).
- Non-compatible tuning: `switches.triad.disabled === 'no-shapes'`, `triad === null`, state kept.

## 6. `src/lib/state/caged.svelte.ts` (extended store)

```ts
caged.toggleLayer('triad'): void;       // auto-focus, default set, reveal triad ids; no playback stop
caged.selectTriadSet(id: StringSetId): void; // no-op if unavailable or equal; reveal; triadChange 'selected'
caged.reset(): void;                    // + triad off, triadSet null
```

`settleTriad()` runs after every `settleLayers()` call site and after `applyInstrument`,
`viewInStandard`, `endTemporary`, `selectRoot`, `setQuality`, `switchSpelling`; a move sets
`triadChange = { kind: 'moved', set, from }`. No reveal on a settle-move (FR-013).

## 7. `src/lib/state/links.ts` / `links.svelte.ts` / `triads.svelte.ts`

```ts
// links.ts (pure)
export function carryCagedTriad(t: TriadsViewState, h: TriadsHandoff, i: Instrument):
  { readonly state: TriadsViewState; readonly compareOff: boolean };
// triads.svelte.ts
triads.carryCagedTriad(h: TriadsHandoff): void;   // notice 'compare-off-for-shape' when compareOff
// links.svelte.ts
export async function openTriadsFromCagedTriad(): Promise<void>; // reads caged.display.triad?.handoff; one goto('/triads')
```

| Case | Expected Triads state |
|---|---|
| C major A shape set 3 | root 0, major, root, set 3, occurrence 0, view isolated, labelType unchanged |
| C minor A shape set 3 (from All notes view) | minor, root, set 3, isolated |
| C major D shape set 3 | second, set 3, occurrence 1 |
| Compare on (minor), pair fits at k | Compare stays on, `occurrence = pairs.indexOf(k)` |
| Compare on, pair does not fit at k | Compare off (quality remembered), occurrence k, `compareOff = true` |
| CAGED F♯ vs G♭ spelling | `spellingOverride` carried |
| Equal state already | same reference |

`openTriadsFromCaged()` (non-compatible notice) is unchanged.

## 8. Renderer and controls

```ts
// fretboard/types.ts
interface Marker { /* … */ readonly layer?: 'arpeggio' | 'triad' }
// Fretboard.svelte: marker group class `layer-triad` (size/outline tokens); ring drawn as before.
// MarkerSample.svelte: layer?: 'arpeggio' | 'triad'
// tools/ChoiceGroup.svelte: options[i].describedby?: string; reachDisabled?: boolean (default false)
```

`reachDisabled`: arrows/Home/End move focus to the next option including disabled ones and
choose it only if enabled; with `reachDisabled` false the current skip behavior is unchanged
(existing `tests/unit/triads/choice-group.test.ts` stays green).

New tokens in `src/lib/styles/tokens.css`: `--marker-triad-scale`, `--marker-triad-stroke`.
