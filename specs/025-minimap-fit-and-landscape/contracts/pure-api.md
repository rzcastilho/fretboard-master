# Contract: Pure modules (025)

Signatures the implementation MUST expose. All are pure (no DOM, no Svelte, no i18n unless
stated), have explicit return types, and are built test-first (Principle IV). None lives in
`src/lib/theory`.

## `src/lib/fretboard/geometry.ts` (edit)

```ts
export type FitMode = 'comfortable' | 'whole';

export interface FretboardLayout {
  // …existing fields unchanged…
  /** Comfortable-size width for the instrument's fret count; independent of container and fit. */
  naturalWidth: number;
  /** Marker glyph scale: min(1, narrowest column / markerRoot). 1 in comfortable mode. */
  markerScale: number;
}

export function layoutFretboard(
  instrument: Instrument,
  metrics: FretboardMetrics,
  containerWidth: number,
  variant: FretboardVariant,
  marked?: boolean,
  fit?: FitMode            // default 'comfortable'; ignored for thumbnail/preview
): FretboardLayout;
```

Fixtures (DEFAULT_METRICS, 6-string standard):

| fretCount | container | fit | naturalWidth | scale | scrolls |
|---|---|---|---|---|---|
| 24 | 320 | comfortable | 1220 | 1 | true |
| 24 | 320 | whole | 1220 | (320−24)/1196 ≈ 0.2475 | false |
| 24 | 1400 | whole | 1220 | > 1 (stretch, as today) | false |
| 12 | 1008 | comfortable | 644 ± 1 | > 1 | false |

## `src/lib/fretboard/minimap.ts` (new)

```ts
export interface FretRange { first: number; last: number; count: number }
export interface MinimapWindow { x: number; width: number }
export type MinimapKey = 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End';

export function visibleFretRange(layout: FretboardLayout, viewport: ScrollViewport): FretRange;
export function minimapWindow(layout: FretboardLayout, viewport: ScrollViewport, k: number): MinimapWindow;
export function minimapTapScroll(layout: FretboardLayout, x: number, k: number, viewportWidth: number): number;
export function minimapKeyScroll(layout: FretboardLayout, key: string, viewport: ScrollViewport): number | null;
```

Required cases: tap at x = minimap width (right-handed) → `layout.width − viewportWidth`;
mirrored tap at x = 0 → 0; tap in the middle centres the point; tap near either end clamps;
`ArrowRight` at max scroll returns max (no overshoot); mirrored `Home` → max scroll (nut on
the right); `visibleFretRange` at scroll 0 on a 320 viewport, 24 frets → `{ first: 1, last: ≈5,
count: 24 }`; at max scroll → `last: 24`.

## `src/lib/fretboard/pinch.ts` (new)

```ts
export const PINCH_IN_RATIO = 0.8;
export const PINCH_OUT_RATIO = 1.25;
export function reducePinch(state: PinchState, event: PinchEvent): { state: PinchState; effect: PinchEffect };
```

Required cases: 1 finger moving → never an effect; 2 fingers closing to 79% → one `in`;
continuing to 40% → nothing more; lift all, new pinch apart to 126% → one `out`; 2 → 3 fingers
→ reset without effect; 2 fingers at 90% then back to 100% → nothing.

## `src/lib/shell/layout.ts` (new)

```ts
export const NARROW_MAX = 599;
export const MEDIUM_MAX = 1023;
export const LANDSCAPE_MAX_HEIGHT = 499;
export type Arrangement = 'narrow' | 'medium' | 'wide-side' | 'wide-stacked' | 'landscape';
export interface LayoutChrome { mainPadding: number; gap: number; zoneBorder: number }

export function isPhoneLandscape(width: number, height: number): boolean;
export function wideLeftColumn(width: number, chrome: LayoutChrome): number;
export function arrangementFor(input: {
  width: number; height: number; neckWidth: number; chrome: LayoutChrome;
}): Arrangement;
```

Required table: see [data-model.md](../data-model.md) §5 (all spec examples plus 200% root).
`isPhoneLandscape(844, 390) === true`, `(1024, 768) === false`, `(390, 844) === false`,
`(500, 499) === true`, `(499, 499) === false`.

## `src/lib/state/context-summary.ts` (new; may import the catalog, not the DOM)

```ts
export function joinSummary(parts: readonly string[]): string;   // catalog " · ", empty parts dropped
export function joinNotes(names: readonly string[]): string;     // catalog " – "
```

Tool summary builders are fields of the existing display derivations
(`triads-view.ts`, `caged-view.ts`, `notes-view.ts`) and take note names only from
`src/lib/notation`.

## `src/lib/state/fit.svelte.ts` (new; runes store)

```ts
export const fit: {
  readonly mode: FitMode;
  readonly available: boolean;
  readonly effective: FitMode;
  readonly notice: { position: Position } | null;
  toggle(): void;
  handle(event: FitEvent): void;      // passed to <Fretboard onfit>
  acceptNotice(): void;
  dismissNotice(): void;
  takeAnchor(): Position | null;
};
```

Transitions: [data-model.md](../data-model.md) §1. A test-only reset (`resetFitForTests()`)
is exported for unit tests and guarded like the existing test hooks.

## `src/lib/state/viewport.svelte.ts` (new; runes store)

```ts
export const viewport: { readonly width: number; readonly height: number; readonly rootPx: number;
  readonly arrangement: Arrangement };
```

SSR/prerender default: `{ width: 0, height: 0, rootPx: 16 }` ⇒ arrangement `undefined` is not
written to the DOM (CSS media-query fallback applies until mount).
