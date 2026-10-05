# Contract: CAGED focus and connections — module API

Internal TypeScript interfaces between layers. Types are defined in
[data-model.md](../data-model.md). Every function listed here is pure and total unless it is
marked *store*.

## §1 Theory — `src/lib/theory/caged.ts` (additions)

```ts
export interface CagedConnection { string; fret; degree; pairs }      // data-model §1
export function sharedPositions(a: ShapeOccurrence, b: ShapeOccurrence): readonly OccurrenceNote[];
export function cagedConnections(occs: readonly ShapeOccurrence[]): readonly CagedConnection[];
```

- Imports stay limited to `./pitch` and `./triad` (Principle III lint boundary).
- `sharedPositions` ignores a synthesized altered string-6 note on either side.
- Table contract (FR-009), C standard tuning, 22 frets:

| Key | Expected connection set `(string, fret, degree)` |
|---|---|
| C major | (5,3,R) (4,5,5) (3,5,R) (2,5,3) (6,8,R) (1,8,R) (4,10,R) (3,12,5) (2,13,R) (1,12,3), plus the same set +12 for each further adjacent pair drawn at 22 frets (C@12→A@15→G@17→E@20) |
| C minor | (5,3,R) (4,5,5) (3,5,R) (6,8,R) (2,8,5) (1,8,R) (4,10,R) (3,12,5) (2,13,R), plus the +12 repeats for pairs drawn |

- Tests also pin a 12-fret board (frets 0–12, C@0 A@3 G@5 E@8): pairs C→A, A→G and G→E only.
  E→D is absent because D (10–13) is not drawn, so (4,10,R) is not a connection.

## §2 Focus — `src/lib/state/caged-focus.ts` (new)

```ts
export const STEP_WINDOW_MS = 500;
export type FocusChoice = CagedShapeId | 'all';
export function occurrenceIndex(f: CagedFocus | null, occs: readonly ShapeOccurrence[]): number | null;
export function focusOfIndex(i: number, occs: readonly ShapeOccurrence[]): CagedFocus | null;
export function focusFromLetter(f: CagedFocus | null, c: FocusChoice, occs: readonly ShapeOccurrence[]): CagedFocus | null;
export function toggleTagFocus(f: CagedFocus | null, i: number, occs: readonly ShapeOccurrence[]): CagedFocus | null;
export function stepFocus(f: CagedFocus | null, dir: 1 | -1, occs: readonly ShapeOccurrence[]): CagedFocus | null;
export function stepAvailability(f: CagedFocus | null, occs: readonly ShapeOccurrence[]): { readonly previous: boolean; readonly next: boolean };
export function drawnLetters(occs: readonly ShapeOccurrence[]): ReadonlySet<CagedShapeId>;
export function reresolveFocus(prev: ShapeOccurrence | null, prevFocus: CagedFocus | null, next: readonly ShapeOccurrence[]): CagedFocus | null;
```

- No imports from Svelte, the DOM or Paraglide. It may import `../theory/caged` types.
- Any function that returns an unchanged focus returns the same object reference, so the store
  can detect a no-op with `===`.

## §3 View — `src/lib/state/caged-view.ts` (additions)

```ts
export function setFocus(s: CagedViewState, f: CagedFocus | null): CagedViewState;
export function setConnections(s: CagedViewState, on: boolean): CagedViewState;
// initialCagedView/resetCaged: focus null, connections false; equalsCagedView compares both.
```

## §4 Model — `src/lib/state/caged-model.ts` (changes)

```ts
export function cagedOccurrencesFor(view: CagedViewState, instrument: Instrument): readonly ShapeOccurrence[];
export function buildCagedModel(
  view: CagedViewState,
  instrument: Instrument,
  context: CagedContext,
  transition?: { readonly positions: readonly string[] } | null
): CagedDisplay;   // + focusIndex, focused, steps, drawnLetters, connections (data-model §4)
```

## §5 Store — `src/lib/state/caged.svelte.ts` (*store*, additions)

| Member | Behavior |
|---|---|
| `chooseShape(c: FocusChoice)` | `focusFromLetter`. Clears the transition. Does not stop playback |
| `toggleTag(id: string)` | Maps `"<letter>@<start>"` to an index, then `toggleTagFocus`. Clears the transition. Unknown id is a no-op |
| `step(dir: 1 \| -1)` | `stepFocus`. If focus moved: sets transition = `sharedPositions(departing, arriving)` and (re)starts the `STEP_WINDOW_MS` timer |
| `setConnections(on: boolean)` | Toggles the switch. Transition untouched |
| `transition` (getter) | Current `StepTransition \| null` (tests and model) |
| `selectRoot`, `setQuality` | Existing behavior, plus `reresolveFocus` before commit. Clears the transition |
| `reset()` | `resetCaged()` (focus null, connections off). Clears the transition |
| `applyInstrument(next, name): boolean` | Re-resolves focus and returns `true` iff a focused occurrence existed and the re-resolved one differs in letter or start. Clearing focus because the tuning became non-compatible returns `false`: no notice, because 015's message already replaces the board |
| `viewInStandard()`, `endTemporary()` | Clear focus when the resulting tuning is non-compatible |
| `resetCagedForTests()` | Also clears the transition and its timer |

## §6 Instrument orchestration — `src/lib/state/instrument.svelte.ts`

```ts
const adjCaged = caged.applyInstrument(inst, tuningLabel(tuning));
adjustedIn = screen === 'notes' && adjNotes ? 'notes'
           : screen === 'triads' && adjTriads ? 'triads'
           : screen === 'caged' && adjCaged ? 'caged' : null;
```

The presentation-only branch and `restore` never set `'caged'`.

## §7 Renderer — `src/lib/fretboard`

```ts
// types.ts
interface Marker { /* … */ readonly ring?: boolean }
interface DisplayModel { /* … */ readonly region?: { start: number; end: number; align?: 'center' } }
// interaction.ts
export function centerScrollTarget(
  layout: FretboardLayout, start: number, end: number, viewport: ScrollViewport
): number | null;
```

- Other tools never set `ring` or `align`, so their render output is unchanged. Existing
  snapshot tests guard this.

## §8 Preferences — `src/lib/prefs/schema.ts`, `src/lib/state/preferences.svelte.ts`

```ts
interface Preferences { /* … */ readonly rotateHintShown: boolean }   // stored as "rotateHint": true
// preferences store
get rotateHintShown(): boolean;
markRotateHintShown(): void;   // session.remember({ rotateHintShown: true }) + per-load flag
```

- Unknown or invalid `rotateHint` gives `false`. Other fields are unaffected (Principle IX).
- `serializePreferences` omits the key when it is `false`. Existing fixtures in
  `tests/unit/prefs/fixtures` stay byte-identical.

## §9 Rotate rule — `src/lib/state/rotate-hint.ts` (new)

```ts
export const PHONE_MAX_WIDTH = 599;
export function isPhonePortrait(width: number, height: number): boolean;
export function shouldShowRotateHint(i: { width: number; height: number; recorded: boolean }): boolean;
```
