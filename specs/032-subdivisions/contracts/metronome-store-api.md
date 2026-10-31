# Contract: Metronome state changes (`src/lib/state/`)

Delta against `specs/031-metronome-tool-and-click-engine/contracts/metronome-store-api.md`.

## 1. `metronome-settings.ts` (pure)

```ts
export type Subdivision = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const SUBDIVISIONS: readonly Subdivision[];          // [1, 2, 3, 4, 5, 6, 7, 8]
export const DEFAULT_SUBDIVISION: Subdivision;               // 3
export function toSubdivision(v: unknown): Subdivision | null;

export interface MetronomeSettings {
  readonly bpm: number;
  readonly beats: number;
  readonly subdivision: Subdivision; // NEW
}
export type SettingField = 'bpm' | 'beats'; // was keyof MetronomeSettings
export const DEFAULT_SETTINGS: Readonly<MetronomeSettings>; // { bpm: 85, beats: 4, subdivision: 3 }
```

`toSubdivision`: `3 → 3`, `'5' → 5`, `0 | 9 | 2.5 | NaN | '' | 'x' | null → null`.

## 2. `metronome-subdivision-names.ts`

```ts
/** Translated display name for a subdivision; never an identifier. */
export function subdivisionName(n: Subdivision): string;
/** "{name} ({n})", the option and closed-select label. */
export function subdivisionLabel(n: Subdivision): string;
```

Imports only `$lib/paraglide/messages.js` and the `Subdivision` type.

## 3. `metronome-view.ts` (pure)

```ts
export type StatusParams =
  | { readonly kind: 'beat'; readonly beat: number; readonly beats: number; readonly sub: number }
  | { readonly kind: 'none'; readonly beats: number; readonly sub: number };
export function statusParams(beat: number, beats: number, sub: number): StatusParams;
```

## 4. Store (`metronome.svelte.ts`)

Additions:

```ts
metronome.setSubdivision(v: unknown): void;
```

| # | Rule | Spec |
|---|---|---|
| S1 | `setSubdivision` updates `settings.subdivision` only in the `settings` phase and only when `toSubdivision(v)` is non-null; otherwise no-op. | FR-003, US2-5 |
| S2 | `start()` and `resume()` pass `clicksPerBeat: settings.subdivision` to `live.start(...)`. | FR-004 |
| S3 | Start announcement: `m.metronome_announce_started({ bpm, beats, subdivision: subdivisionName(n) })`. Paused/Resumed/Reset unchanged. | FR-015 |
| S4 | `reset()` keeps `settings.subdivision`. `screenChanged()` and `resetMetronomeForTests()` restore `DEFAULT_SETTINGS`. | FR-012 |
| S5 | `beat`, `dots`, `phase` semantics unchanged: they change only via `onBeat`, which fires per slot (engine E4). | FR-007 |
| S6 | Pause between soft clicks freezes on the slot's beat; Resume starts at `beat % beats + 1` (031 rule, unchanged). | FR-010 |

`metronome-keys.ts`: unchanged. Its `isEditable()` already returns true for `SELECT`, so Space
and Escape on the focused dropdown keep their native meaning (open / close the list) and never
start the run. A unit case is added to `tests/unit/metronome/keys.test.ts` to pin this.
