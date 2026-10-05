# Contract: CAGED internal API delta (slice 015)

This contract extends `specs/014-caged-shapes/contracts/caged-api.md`. Signatures are binding
for implementation. Every listed test MUST exist and be written before the code
(Principle IV).

## §1 `src/lib/theory/caged.ts` (pure; imports `./pitch`, `./triad` only)

```ts
export interface ShapeOccurrence {
  readonly shape: CagedShape;
  readonly start: number;
  readonly end: number;
  readonly notes: readonly OccurrenceNote[];
  readonly alteredString: boolean;               // NEW
}

/** Unchanged signature. Now draws for 'compatible' AND 'altered-string'. */
export function cagedOccurrences(
  sixOpen: readonly Pitch[], rootPc: PitchClass, quality: CagedQuality, fretCount: number
): readonly ShapeOccurrence[];

/** NEW. Chord tones of the key on string 6 at frets lo…hi (inclusive), ascending. Total. */
export function alteredStringNotes(
  open6: Pitch, rootPc: PitchClass, quality: CagedQuality, lo: number, hi: number
): readonly OccurrenceNote[];

/** NEW. rootStrings(shape) minus string 6 when occ.alteredString; descending. */
export function occurrenceRootStrings(occ: ShapeOccurrence): readonly number[];
```

The other functions are unchanged: `cagedTuningClass`, `rootStrings`, `fitCount`,
`CAGED_SHAPES` and `CAGED_CYCLE`.

Required tests, in `tests/unit/theory/caged.test.ts`:

| ID | Case | Expectation |
|---|---|---|
| T1 | Drop D (AF-4), every key × quality | strings 5→1 notes and `start` per shape equal AF-1's |
| T2 | Drop C (AF-5), every key × quality | strings 5→1 notes equal AF-3's (Whole step down) |
| T3 | Drop D, D major, E shape | string 6 = `[{string 6, fret 12, R}]`, span 10–12 |
| T4 | Drop D, D major, G shape | string 6 = `[{string 6, fret 7, '5'}]`, span 7–10, nothing at 10 |
| T5 | Altered, any C/A/D shape (major + minor) | no string-6 note |
| T6 | Region with no chord tone | G/E shape with no string-6 note; occurrence still returned |
| T7 | AF-2, E♭ major | first E occurrence `start` 0; root notes on strings 6, 4, 1 |
| T8 | AF-2, G♭ major | E occurrence `start` 3 |
| T9 | AF-21/AF-22/AF-23 | strings 6→1 equal AF-1/AF-2/AF-1 drawings; string 7 has no note |
| T10 | 7-string AF-4 (`presetStrings('AF-4', 7)`) | class `altered-string`; T3 holds |
| T11 | AF-6 … AF-11, malformed input | `[]` |
| T12 | `occurrenceRootStrings` | E in Drop D → [4, 1]; G → [3, 1]; compatible → table |
| T13 | `alteredStringNotes` table | minor uses `b3`; several notes possible; `lo > hi` → `[]` |
| T14 | Existing TM-6.1, TM-6.2, TM-7.1, fit-count | unchanged and passing |

Required properties, in `tests/unit/theory/caged.property.test.ts` (fast-check, over random
altered-string tunings built as a random compatible base plus a string-6 delta in
`[−11, 11] \ {0}`, all keys, both qualities, 12–24 frets):

| ID | Property |
|---|---|
| P1 | Strings 5→1 notes equal those of the compatible base with the same strings 5→1 |
| P2 | Every string-6 note's real pitch class is a chord tone matching its degree; `start ≤ fret ≤ end` |
| P3 | String-6 notes appear only in G and E shapes |
| P4 | No string-6 note has the table's degree at the table fret (original note never shown) |
| P5 | Every string 5→1 fret is in `0…fretCount`; fit depends on strings 5→1 only |
| P6 | Compatible tunings: output identical to slice-014 behaviour (string-6 shift equivalence) |

## §2 `src/lib/instrument/tunings.ts`

```ts
/** NEW. Same count, frets, handedness, orientation; standard open strings for the count. */
export function standardCounterpart(inst: Instrument): Instrument;
```

Tests (`tests/unit/instrument/tunings.test.ts`):

- AF-8 at 6 strings with 24 frets, left-handed, lowest-top → AF-1 with the same frets,
  handedness and orientation.
- 7-string AF-10 → AF-21.
- Custom → standard for its count.
- Repeated calls with the same input return the same reference.

## §3 `src/lib/state/caged-model.ts`

```ts
export interface CagedContext {
  readonly tuningName: string;
  readonly temporary: boolean;
}
export function buildCagedModel(
  view: CagedViewState, instrument: Instrument, context: CagedContext
): CagedDisplay;
export function cagedTagText(occ: ShapeOccurrence): string;   // CHANGED: takes the occurrence
```

Tests (`tests/unit/state/caged-model.test.ts`):

| ID | Case | Expectation |
|---|---|---|
| M1 | Open G, C major | `model === null`, `occurrences = []`, `unsupportedNotice` = FR-016 text with "Open G" |
| M2 | Custom non-compatible | notice names "Custom" |
| M3 | Drop D, D major | `stringMarks = [{6, 'altered'}]`; string-6 markers exactly frets 7 (A, '5') and 12 (D, 'R') among E/G; tags "E shape · roots on strings 4, 1", "G shape · roots on strings 3, 1" |
| M4 | Drop D, any key | `stringMarks` present even when no string-6 marker exists |
| M5 | Standard, Half step down | no `stringMarks`; tag text equals Standard's |
| M6 | Half step down, E♭ major | root markers at fret 0 spell E♭; pitches E♭2/E♭3/E♭4 via `positionPitch` |
| M7 | `temporary: true` on a 7-string instrument | `temporaryName = '7-string standard'`; description starts "Temporary tuning: 7-string standard." |
| M8 | Description | tuning sentence first; altered sentence iff altered; string-6 notes listed |
| M9 | Drop D string 6 fret 12 marker | spelling D, and `positionPitch` = D3 (FR-017) |

## §4 `src/lib/state/caged.svelte.ts`

```ts
export const caged: {
  readonly state: CagedViewState;
  readonly instrument: Instrument;              // effective (temporary-aware)
  readonly display: CagedDisplay;
  readonly temporary: boolean;                  // NEW
  readonly temporaryName: string | null;        // NEW
  selectRoot(pc: PitchClass): void;
  setQuality(q: CagedQuality): void;
  switchSpelling(): void;
  reset(): void;
  applyInstrument(next: Instrument, tuningName: string): boolean;   // CHANGED: + tuningName
  useInstrument(next: Instrument, tuningName?: string): void;       // test hook
  viewInStandard(): void;                       // NEW
  endTemporary(): void;                         // NEW
  screenChanged(): void;                        // NEW → endTemporary()
  activate(p: Position): void;                  // sounds on effective instrument
};
export function resetCagedForTests(next?: Instrument, tuningName?: string): void;
```

Tests (`tests/unit/state/caged-store.test.ts`):

- `viewInStandard` is a no-op unless the class is non-compatible.
- `viewInStandard` keeps the view, switches the class to compatible, and stops playback once.
- Key, quality, spelling and `reset` keep `temporary`.
- `screenChanged` and `endTemporary` clear it.
- `applyInstrument` keeps the view (FR-011).
- `activate` plays on the standard instrument while temporary.

## §5 `src/lib/state/instrument.svelte.ts`

- `confirm(screen)` calls `caged.endTemporary()` before computing `result.changed`, so it ends
  the temporary tuning even for an unchanged confirm.
- `confirm` and `restore` call `caged.applyInstrument(inst, tuningLabel(config.tuning))`.
- `cancel()` does not touch CAGED.

Tests (`tests/unit/state/instrument-store.test.ts`):

- Confirm (changed or unchanged) ends the temporary tuning.
- Cancel keeps it.
- `preferences.remember` is never called by `viewInStandard`/`endTemporary` (SC-005).

## §6 `src/lib/state/links.svelte.ts`

```ts
/** NEW. Open Triads under the preferred instrument; no carry (FR-012). */
export async function openTriadsFromCaged(): Promise<void>;
```

Tests (`tests/unit/state/links-store.test.ts`): it calls `goto('/triads')` exactly once and
does not change the `triads` state.

## §7 `src/routes/+layout.svelte`

`beforeNavigate` calls `caged.screenChanged()` beside `instrument.screenChanged()` on a real
path change. Shallow same-path pops are ignored, as today.

## §8 Fretboard renderer

`DisplayModel.stringMarks` is defined in data-model §9. Tests
(`tests/unit/fretboard/fretboard.test.ts`, `tests/unit/fretboard/geometry.test.ts`):

- The mark text renders in the row of string 6 for all four handedness × orientation
  combinations.
- The label column uses the marked width only when marks exist.
- A mark for a string the instrument lacks is ignored.
- The mark is not in the accessibility tree.
