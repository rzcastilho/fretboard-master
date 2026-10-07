# Contract: Pure description, legend and announcer modules

All functions are pure (no DOM), exported with explicit return types, and unit-tested
test-first (C-IV). Locale/notation come from the existing Paraglide runtime and
`src/lib/notation` context, as in `describeView` today.

## `src/lib/fretboard/description.ts`

```ts
/** Existing; behaviour tightened (FR-003, FR-004, FR-007). */
export function describeView(instrument: Instrument, model: DisplayModel): string;

/** Existing; unchanged. */
export function positionName(
  instrument: Instrument, position: Position, marker?: Marker,
  policy?: DisplayModel['spellingPolicy']
): string;

/** New: localized "a", "a and b", "a, b, and c" from catalog keys list_and_two / list_and_many. */
export function spokenList(items: readonly string[]): string;

/** New: "string N, fret F, note, function" entries in FR-004 order (used by Triads and describeView). */
export function describeEntries(
  instrument: Instrument,
  markers: readonly Marker[],
  policy?: DisplayModel['spellingPolicy']
): readonly string[];
```

Guarantees:
- `describeView` never returns `''`.
- Entry order: string descending, then fret ascending; independent of handedness/orientation.
- `describeEntries` includes only `highlighted | normal` markers at valid positions; dedupes
  by `positionKey`.

## `src/lib/fretboard/legend.ts`

```ts
export type LegendKind =
  | 'root' | 'third' | 'fifth' | 'degree' | 'neutral' | 'selected' | 'octave'
  | 'arpeggio' | 'triadLayer' | 'extra' | 'connection' | 'comparison'
  | 'wideStretch' | 'alteredString';

export interface LegendGroup {
  readonly label?: string;
  readonly kinds: readonly LegendKind[];
}

/** Kinds drawn by the model at highlighted/normal/dimmed emphasis, in catalogue order. */
export function legendKinds(model: DisplayModel): readonly LegendKind[];

/** model.legendGroups filtered to in-use kinds; flat single group when absent; [] when none in use. */
export function legendGroups(model: DisplayModel): readonly LegendGroup[];
```

Guarantees: hidden markers never contribute; result depends only on `model`.

Table-test fixtures (per tool) that MUST hold:

| View | Expected kinds |
|---|---|
| Triads A major 1st inv 4-3-2 | root, third, fifth |
| Triads + comparison | root, third, fifth, comparison |
| Triads wide shape | root, third, fifth, wideStretch |
| Notes, 3 selected, background naturals | neutral, selected |
| Notes, octave labels | … + octave |
| CAGED default (Chord) | root, third, fifth |
| CAGED Chord + Pentatonic | groups Chord[root,third,fifth], Arpeggio[arpeggio], Pentatonic[degree] |
| CAGED + connections | … + connection |
| CAGED altered sixth string | … + alteredString |
| Empty | [] |

## `src/lib/fretboard/announce.ts`

```ts
export const ANNOUNCE_DELAY_MS = 500;
export interface AnnouncerTimer {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}
export interface Announcer { update(text: string): void; dispose(): void; }
export function createAnnouncer(opts: {
  readonly delayMs: number;
  readonly timer: AnnouncerTimer;
  readonly emit: (text: string) => void;
}): Announcer;
```

Guarantees (see data-model §5): no emit on first update; one emit per settled change, exactly
`delayMs` after the last differing update; no emit when the settled text equals the last
announced text; `dispose` cancels pending emits.

## Tool display models (changed outputs)

| Module | Change |
|---|---|
| `src/lib/state/triads-model.ts` | isolated single-shape `summary` → FR-003 form with entries; sets `wideStretch` |
| `src/lib/state/caged-model.ts` | note entries add `{note}`, sorted FR-004; sets `legendGroups` from drawn layers |
| `src/lib/state/notes-model.ts` | empty selection with no background → `notes_desc_empty` |

## `MarkerSample.svelte` props (extended)

```ts
interface Props {
  fn: NoteFunction;
  layer?: 'arpeggio' | 'triad';
  extra?: boolean;
  emphasis?: 'highlighted';     // selected note sample
  tone?: OctaveTone;            // octave colour sample
  variant?: 'comparison';       // dashed outline
  ring?: boolean;               // connection ring
}
```

Same geometry and tokens as `Fretboard.svelte`; always `aria-hidden="true"`.
