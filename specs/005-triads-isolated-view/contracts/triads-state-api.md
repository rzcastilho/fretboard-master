# Contract: Triads state API

**Feature**: `005-triads-isolated-view` | Data model: [§3–§6](../data-model.md) | Pattern: ADR 0008, [004 notes-state-api](../../004-fretboard-notes-tool/contracts/notes-state-api.md)

## 1. Pure view state — `src/lib/state/triads-view.ts`

No Svelte, DOM, or paraglide. Every function is total; a no-op returns the same object.

```ts
export type TriadsLabelType = 'interval' | 'name';
export type SpellingOverride = 'none' | 'sharp' | 'flat';

export interface TriadsViewState {
  readonly rootPc: PitchClass;
  readonly spellingOverride: SpellingOverride;
  readonly quality: Quality;
  readonly inversion: Inversion;
  readonly stringSet: StringSetId;
  readonly labelType: TriadsLabelType;
  readonly occurrence: number;
}

export function initialTriadsView(i: Instrument): TriadsViewState;          // FR-001
export function equalsTriadsView(a: TriadsViewState, b: TriadsViewState): boolean;
export function selectRoot(s: TriadsViewState, pc: PitchClass): TriadsViewState;
export function switchSpelling(s: TriadsViewState): TriadsViewState;
export function setQuality(s: TriadsViewState, q: Quality): TriadsViewState;
export function setInversion(s: TriadsViewState, inv: Inversion): TriadsViewState;
export function setStringSet(s: TriadsViewState, id: StringSetId, i: Instrument): TriadsViewState;
export function setLabelType(s: TriadsViewState, t: TriadsLabelType): TriadsViewState;
export function octaveUp(s: TriadsViewState, i: Instrument): TriadsViewState;
export function octaveDown(s: TriadsViewState, i: Instrument): TriadsViewState;
export function revalidate(s: TriadsViewState, i: Instrument): TriadsViewState;
```

Keep/reset rules: data-model §4 table (C1, C9, FR-018).

## 2. Display model — `src/lib/state/triads-model.ts`

```ts
export function buildTriadsModel(s: TriadsViewState, i: Instrument): TriadsDisplay;
export function nearestClosingSet(s: TriadsViewState, i: Instrument): StringSetId | null;  // C11
```

`TriadsDisplay`, `ShapeView`, `Composition`: data-model §5. Guarantees:

| # | Guarantee |
|---|---|
| M1 | Default state → markers at (3,5) root, (2,5) third, (1,3) fifth; labelMode `interval`; name C major — Root position |
| M2 | Shown shape has exactly 3 markers, all `highlighted`, with `spelling` and `interval`; no other markers |
| M3 | `beyond` iff lowest occurrence max fret > fretCount; markers `[]`; octave up/down false; listen disabled; composition populated |
| M4 | `does-not-close` → markers `[]`; `anotherSet` = C11 order result or `null` |
| M5 | `soundsAs` only for double accidentals, R–3–5 order; `suggestion` per C4 |
| M6 | `listenSteps` = `[low, mid, high, [low, mid, high]]` for the shown occurrence |
| M7 | `octave.down` false at index 0, `octave.up` false at last index |
| M8 | Description contains the guidance text when no shape is shown |

## 3. Store — `src/lib/state/triads.svelte.ts`

Module singleton (survives navigation, resets on reload; FR-032). Imports only
`triads-view`, `triads-model`, `listen` and `playback.svelte` (never `audio/engine`).

```ts
export const triads: {
  readonly state: TriadsViewState;
  readonly instrument: Instrument;
  readonly display: TriadsDisplay;
  selectRoot(pc: PitchClass): void;
  switchSpelling(): void;            // also used by the simpler-spelling suggestion
  setQuality(q: Quality): void;
  setInversion(inv: Inversion): void;
  setStringSet(id: StringSetId): void;
  anotherSet(): void;                // setStringSet(display.anotherSet) when non-null
  setLabelType(t: TriadsLabelType): void;
  octaveUp(): void;
  octaveDown(): void;
  listen(): void;                    // no-op when !display.listen.enabled; sequence at LISTEN_BPM
  useInstrument(next: Instrument): void;  // test hook path; stop('instrument') + revalidate
  activate(p: Position): void;       // fretboard tap: playback.note(p); no state change
};
export function resetTriadsForTests(next?: Instrument): void;
```

Every mutating method goes through `apply(next)`: if `!equalsTriadsView(next, view)` →
`playback.stop('view')` then assign (FR-028). `listen()` never calls `stop` (a new `sequence`
interrupts the old one, 003 contract).

## 4. Shared Listen constants — `src/lib/state/listen.ts`

`LISTEN_BPM = 120` and `ListenStep` move here from `notes-model.ts` (now two users);
`notes-model.ts` re-imports them. No behavior change for Notes.
