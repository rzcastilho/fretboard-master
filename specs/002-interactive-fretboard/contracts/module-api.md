# Contract: Library module APIs (`theory`, `instrument`, `notation`, `fretboard` pure helpers)

**Feature**: `002-interactive-fretboard` | Types: [data-model.md](../data-model.md)

Exported functions have explicit return types, never throw for expected input, and are covered by
test-first unit tests. Import boundaries are enforced by `eslint.config.js`.

## `src/lib/theory/pitch.ts` (pure; lint-guarded: no svelte, DOM, i18n, storage, audio, fretboard)

```ts
export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type Accidental = -2 | -1 | 0 | 1 | 2;
export interface Spelling { readonly letter: Letter; readonly accidental: Accidental }
export interface SpelledPitch extends Spelling { readonly octave: number }
export type Pitch = number;       // C4 = 60
export type PitchClass = number;  // 0..11, C = 0

export function pitchClass(p: Pitch): PitchClass;
export function octaveOf(p: Pitch): number;
export function transpose(p: Pitch, semitones: number): Pitch;
export function pitchClassOfSpelling(s: Spelling): PitchClass;
export function pitchOfSpelling(s: SpelledPitch): Pitch;
```

Golden values (table tests): `pitchOfSpelling(E2) = 40`, `E4 = 64`, `C4 = 60`, `B♯3 = 60`,
`C♭4 = 59`; `octaveOf(59) = 3`, `octaveOf(60) = 4`.

## `src/lib/instrument/instrument.ts` (pure; may import `theory`)

```ts
export interface Instrument { /* see data-model §2 */ }
export interface Position { readonly string: number; readonly fret: number }
export const STANDARD_GUITAR: Instrument;
export function isValidPosition(instrument: Instrument, p: Position): boolean;
export function positionPitch(instrument: Instrument, p: Position): Pitch;
export function positionKey(p: Position): string;   // "string:fret"
export function allPositions(instrument: Instrument): readonly Position[]; // string 1..N, fret 0..F
```

Golden values: `positionPitch(STANDARD_GUITAR, {string:2, fret:1}) = 60` (C4);
`{string:6, fret:0} = 40` (E2); full TM-3 table via `pitchClass`.

## `src/lib/notation/notation.ts` (may import `theory` and `$lib/paraglide/messages`)

```ts
export function defaultSpelling(pc: PitchClass): Spelling;   // sharps: C C♯ D D♯ E F F♯ G G♯ A A♯ B
export function noteLabel(s: Spelling): string;               // 'F♯', 'B𝄫', 'E' — glyphs ♯ ♭ 𝄪 𝄫 only
export function spokenNote(s: Spelling): string;              // 'F sharp', 'B double flat' (catalog)
```

Guarantees: output never contains `#` or a lowercase `b` used as an accidental (unit test over all
35 spellings); `spokenNote` never contains a glyph.

## `src/lib/fretboard/geometry.ts` (pure; no DOM)

```ts
export interface FretboardMetrics { /* data-model §5 */ }
export const DEFAULT_METRICS: FretboardMetrics;     // tokens at a 16 px root (prerender)
export const INLAY_FRETS: readonly number[];         // [3,5,7,9,15,17,19,21]
export const DOUBLE_INLAY_FRETS: readonly number[];  // [12,24]
export function layoutFretboard(
  instrument: Instrument, metrics: FretboardMetrics, containerWidth: number,
  variant: 'interactive' | 'thumbnail'
): FretboardLayout;
export function nearestPosition(layout: FretboardLayout, x: number, y: number): Position;
export function visibleColumnCount(layout: FretboardLayout, scrollLeft: number, width: number): number;
```

`nearestPosition` clamps out-of-grid points and breaks exact ties by lower fret, then lower string.

## `src/lib/fretboard/interaction.ts` (pure)

```ts
export const DRAG_THRESHOLD_PX = 10;
export function reduceGesture(state: GestureState, event: GestureEvent): { state: GestureState; effect: GestureEffect };
export function moveFocus(stop: Position, key: string, instrument: Instrument): Position | 'activate' | null;
export function autoScrollTarget(layout: FretboardLayout, highlighted: readonly Position[], viewport: { scrollLeft: number; width: number }): number | null;
export function scrollIntoViewTarget(layout: FretboardLayout, p: Position, viewport: { scrollLeft: number; width: number }): number | null;
```

## `src/lib/fretboard/scroll-animation.ts`

```ts
export interface Clock { now(): number; frame(cb: (t: number) => void): number; cancel(id: number): void }
export const browserClock: Clock;   // performance.now + requestAnimationFrame
export function animateScroll(el: { scrollLeft: number }, to: number, durationMs: number, clock: Clock): () => void; // returns cancel
```

`durationMs = 0` sets `scrollLeft = to` synchronously.

## `src/lib/fretboard/description.ts`

```ts
export function describeView(instrument: Instrument, model: DisplayModel): string;
export function positionName(instrument: Instrument, p: Position, marker?: Marker): string;
```

## Lint boundaries added (`eslint.config.js`)

| Files | May not import |
|---|---|
| `src/lib/theory/**` | (existing) svelte, `$app/*`, paraglide, prefs, audio, fretboard, state + **instrument, notation** |
| `src/lib/instrument/**` | svelte, `$app/*`, paraglide, fretboard, notation, DOM globals |
| `src/lib/notation/**` | svelte, `$app/*`, fretboard, instrument, DOM globals |
| `src/lib/shell/**`, `src/routes/**` | `$lib/theory/*` (tools/screens must not compute theory; they go through instrument/fretboard) |
