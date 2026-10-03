# Contract: Instrument configuration API

**Feature**: 009-instrument-panel-and-tunings | Types: [data-model.md](../data-model.md)

Module-level TypeScript contracts consumed by UI components and tests. Every exported function
has an explicit return type and never throws for expected input.

## 1. `src/lib/instrument/tunings.ts` (pure, DOM-free, lint-guarded)

```ts
export type TuningId = 'AF-1' | 'AF-2' | 'AF-3' | 'AF-4' | 'AF-5' | 'AF-6'
                     | 'AF-7' | 'AF-8' | 'AF-9' | 'AF-10' | 'AF-11';
export interface TuningPreset { readonly id: TuningId; readonly strings: readonly SpelledPitch[] }

export const TUNING_PRESETS: readonly TuningPreset[];     // display order AF-1 … AF-11
export const MIN_FRETS: 12;
export const MAX_FRETS: 24;
export const DEFAULT_FRETS: 22;
export const DEFAULT_TUNING_ID: 'AF-1';

export function isTuningId(x: unknown): x is TuningId;
export function tuningPreset(id: TuningId): TuningPreset;
export function clampFrets(n: number): number;            // non-integer → round; NaN → DEFAULT_FRETS
export function presetInstrument(id: TuningId, fretCount: number): Instrument; // memoized, frozen
```

Guarantees:

- `presetInstrument('AF-1', 22) === STANDARD_GUITAR`.
- `presetInstrument(id, n) === presetInstrument(id, n)` (identity).
- `presetInstrument(id, n).openStrings[k]` = `tuningPreset(id).strings[5 - k]` (string 1 first).
- `fretCount` argument is clamped with `clampFrets`.

## 2. `src/lib/state/instrument-config.ts` (pure, no Svelte/DOM/i18n)

```ts
export interface InstrumentConfig { readonly tuningId: TuningId; readonly fretCount: number }
export type PanelState =
  | { readonly open: false }
  | { readonly open: true; readonly pending: InstrumentConfig };

export const DEFAULT_CONFIG: InstrumentConfig;
export const CLOSED: PanelState;

export function equalsConfig(a: InstrumentConfig, b: InstrumentConfig): boolean;
export function instrumentOf(c: InstrumentConfig): Instrument;
export function openPanel(p: PanelState, active: InstrumentConfig): PanelState;
export function selectTuning(p: PanelState, id: TuningId): PanelState;
export function stepFrets(p: PanelState, delta: 1 | -1): PanelState;
export function setFrets(p: PanelState, n: number): PanelState;
export function restoreDefault(p: PanelState): PanelState;
export function cancelPanel(p: PanelState): PanelState;
export function confirmPanel(p: PanelState, active: InstrumentConfig):
  { readonly panel: PanelState; readonly next: InstrumentConfig; readonly changed: boolean };
```

Rules: no-op transitions return the same object (`Object.is`). `confirmPanel` on a closed
panel returns `{ panel: p, next: active, changed: false }`.

## 3. `src/lib/state/instrument.svelte.ts` (runes singleton)

```ts
export const instrument: {
  readonly active: InstrumentConfig;
  readonly current: Instrument;               // instrumentOf(active)
  readonly panel: PanelState;
  readonly preview: Instrument | null;        // instrumentOf(pending) while open
  readonly adjustedIn: ToolId | null;
  open(): void;                               // panel only; opener focus handled by the component
  selectTuning(id: TuningId): void;
  stepFrets(delta: 1 | -1): void;
  setFrets(n: number): void;
  restoreDefault(): void;
  cancel(): void;
  confirm(screen: ScreenId): void;            // orchestration per data-model §4
  dismissAdjusted(): void;
};
export function resetInstrumentForTests(): void;
```

Confirm guarantees (unit-tested with a spy playback store):

| Case | `playback.stop('instrument')` | tool stores called | `adjustedIn` |
|---|---|---|---|
| pending equals active | not called | no | unchanged |
| changed, view still valid | once | both `applyInstrument` | `null` |
| changed, current tool adjusted | once | both | current tool |
| changed, only other tool adjusted | once | both | `null` |

## 4. Tool stores (additions)

```ts
// src/lib/state/notes.svelte.ts and src/lib/state/triads.svelte.ts
applyInstrument(next: Instrument): boolean;   // returns adjusted; never stops playback

// src/lib/state/notes-view.ts
export function adaptNotesView(s: NotesViewState, prev: Instrument, next: Instrument):
  { readonly view: NotesViewState; readonly adjusted: boolean };
```

`triads.applyInstrument` uses the existing `revalidate` and no longer resets the view
(replaces the 005 placeholder behavior of `useInstrument`). `useInstrument` remains for test
hooks: `playback.stop('instrument')` then `applyInstrument`.

## 5. Fretboard additions (`src/lib/fretboard`)

```ts
// types.ts
variant?: 'interactive' | 'thumbnail' | 'preview';
// geometry.ts
export function trailingEdgeScroll(layout: FretboardLayout, viewportWidth: number): number;
```

`preview`: draws `instrument.fretCount` frets, open-string labels from
`instrument.openStrings`, no markers, no handlers, root `aria-hidden="true"`, no description.
Interactive variant: when `fretCount` shrinks and `scrollLeft` exceeds the new maximum, scroll
to `trailingEdgeScroll(...)` over `--duration-short` (instant when reduced motion).
