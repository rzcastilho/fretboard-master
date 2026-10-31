# Contract: Metronome settings, view and store API

Delta against `specs/033-count-in/contracts/metronome-store-api.md`.

## 1. `src/lib/state/metronome-settings.ts`

```ts
export interface MetronomeSettings {
  readonly bpm: number;
  readonly beats: number;
  readonly subdivision: Subdivision;   // Loop 1
  readonly countIn: boolean;
  readonly initialCountIn: number;
  readonly repeatCountIn: number;      // now played (when countIn && ratio)
  readonly ratio: boolean;             // new, default true
  readonly loop2: Subdivision;         // new, default 6
}
export const DEFAULT_LOOP2: Subdivision = 6;
export function toRatio(v: unknown): boolean;                       // boolean → v, else true
export function effectiveRepeatCountIn(s: MetronomeSettings): number; // countIn && ratio ? repeatCountIn : 0
export function runPlanFor(s: MetronomeSettings): PlanFields;       // clicksPerBeat, initialCountIn, alternate?
```

| # | Rule | Spec |
|---|---|---|
| S1 | `DEFAULT_SETTINGS` gains `ratio: true`, `loop2: 6`; every other default unchanged. | FR-012, FR-015 |
| S2 | `toRatio` never throws; `toSubdivision(v) ?? DEFAULT_LOOP2` is the Loop 2 parse rule (used by slice 005). | FR-012, C IX |
| S3 | `runPlanFor` omits `alternate` when `ratio` is false; `repeatCountIn` inside it is `effectiveRepeatCountIn`. | FR-005, FR-006 |

## 2. `src/lib/state/metronome.svelte.ts` (`metronome` store)

New members:

```ts
setRatio(v: unknown): void;   // settings phase only; non-booleans ignored; keeps loop2
setLoop2(v: unknown): void;   // settings phase only; toSubdivision, invalid ignored
readonly sub: number;         // clicks per beat of the loop playing (Loop 1 before the first beat)
```

Changed members:

| Member | Rule | Spec |
|---|---|---|
| `toggle()` from settings | Builds `runPlanFor(settings)`, starts at `startSlot: 0`; announces per data-model §8. | FR-004, FR-013 |
| `toggle()` from running | `halt('pause')` → stores the `SlotPosition`; announces the frozen position (loop name when the section is on). | FR-009, FR-013 |
| `toggle()` from paused | Starts at `startSlot = (position?.slot ?? −1) + 1` with the same plan; announces "Resumed". | FR-009, US4 |
| `beat` | `position.kind === 'beat' ? position.beat : 0`. | FR-007 |
| `countIn` | `{ click, total }` while the position is a count-in (initial or repeat) or nothing has sounded and *k* > 0; else `null`. | FR-007 |
| `dots` | `[]` during a count-in or in settings; else `beatDots(beats, beat)`. | FR-006 |
| `reset()` | Halts, `position = null`, settings unchanged; next Start begins at slot 0 (initial count-in, Loop 1). | FR-010 |
| `screenChanged()` | Restores `DEFAULT_SETTINGS` (ratio on, Loop 2 Sextuplets). | Edge Cases |

Unchanged: all 031–033 setters, `phase`, `announcement`, `soundNotice`, `generation`,
`dismissSoundNotice`, `resetMetronomeForTests(deps, settings)` (accepts `ratio` / `loop2`).

## 3. `src/lib/state/metronome-view.ts`

`statusParams`, `beatDots`, `countInDot` unchanged in signature. The panel passes
`metronome.sub` (not `settings.subdivision`) as `sub`.

## 4. `src/lib/state/metronome-keys.ts`

Unchanged: Space on a `[role="switch"]` already toggles the switch, not training.
