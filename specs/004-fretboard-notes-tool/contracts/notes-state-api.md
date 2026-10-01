# Contract: Notes view state and model API

**Feature**: `004-fretboard-notes-tool` | Research: R-01, R-02, R-06, R-07, R-08 | Data model: §1–§8

## 1. Modules and import boundaries

| Module | Kind | May import | Must not import |
|---|---|---|---|
| `src/lib/instrument/instrument.ts` (+ `positionsWithPitchClass`, `unisonsOf`) | pure | `theory` | svelte, paraglide, fretboard, notation, state |
| `src/lib/instrument/fixtures.ts` | pure, test-build only | instrument, theory | anything UI |
| `src/lib/notation/notation.ts` (+ `flatSpelling`, `noteList`, `spokenNoteList`, `pitchLabel`) | pure + paraglide | theory, paraglide | instrument, fretboard, svelte |
| `src/lib/state/notes-view.ts` | pure | theory, instrument | svelte, paraglide, DOM, audio |
| `src/lib/state/notes-model.ts` | pure + paraglide (description text) | theory, instrument, notation, fretboard/types | svelte, DOM, audio, shell |
| `src/lib/state/notes.svelte.ts` | runes store | notes-view, `state/playback.svelte` | `audio/engine` (existing rule), shell, components |
| `src/lib/tools/**` (components) | UI | state, fretboard, notation, instrument, shell, paraglide | `theory/*`, `audio/engine` |

ESLint: add a `src/lib/tools/**` block mirroring the shell rule (`$lib/theory/*`,
`$lib/audio/engine` restricted), and a `src/lib/state/notes-view.ts` block restricting
`svelte`, `$lib/paraglide/*`, and DOM globals.

## 2. Pure API (`notes-view.ts`)

```ts
export type LabelType = 'name' | 'octave' | 'none';
export type Background = 'naturals' | 'all' | 'none';
export type RegionShortcut = '0-4' | '5-9' | '10-14' | 'whole';
export interface Region { readonly start: number; readonly end: number }
export interface NotesViewState { /* data-model §1 */ }

export function initialNotesView(instrument: Instrument): NotesViewState;
export function equalsNotesView(a: NotesViewState, b: NotesViewState): boolean;
export function toggleNote(s: NotesViewState, pc: PitchClass): NotesViewState;
export function addNote(s: NotesViewState, pc: PitchClass): NotesViewState;
export function setLabelType(s: NotesViewState, t: LabelType): NotesViewState;
export function setBackground(s: NotesViewState, b: Background): NotesViewState;
export function setHideNames(s: NotesViewState, on: boolean): NotesViewState;
export function toggleString(s: NotesViewState, n: number): NotesViewState;
export function setRegionStart(s: NotesViewState, v: number, i: Instrument): NotesViewState;
export function setRegionEnd(s: NotesViewState, v: number, i: Instrument): NotesViewState;
export function setRegionShortcut(s: NotesViewState, k: RegionShortcut, i: Instrument): NotesViewState;
export function widenRegion(s: NotesViewState, i: Instrument): NotesViewState;
export function openCard(s: NotesViewState, p: Position): NotesViewState;
export function closeCard(s: NotesViewState): NotesViewState;
export function clear(s: NotesViewState, i: Instrument): NotesViewState;
export function revalidate(s: NotesViewState, i: Instrument): NotesViewState;
export function missingNotes(s: NotesViewState, i: Instrument): readonly PitchClass[];
```

All functions are total: invalid inputs (non-integer pc, out-of-range string or fret) are
ignored or clamped, never thrown (constitution: typed results, no throwing for expected input).
No-ops return the **same object** (`Object.is`), which the store uses to skip `stop('view')`.

## 3. Pure API (`notes-model.ts`)

```ts
export function buildNotesModel(s: NotesViewState, i: Instrument): NotesDisplay; // data-model §5
export function listenSteps(s: NotesViewState, i: Instrument): readonly (Position | readonly Position[])[];
export function cardInfo(s: NotesViewState, i: Instrument): CardInfo | null;     // data-model §6
export const LISTEN_BPM = 120;
```

## 4. Store (`notes.svelte.ts`)

```ts
export const notes: {
  readonly state: NotesViewState;
  readonly instrument: Instrument;
  readonly display: NotesDisplay;         // $derived(buildNotesModel(state, instrument))
  toggleNote(pc: PitchClass): void;
  addNote(pc: PitchClass): void;
  setLabelType(t: LabelType): void;
  setBackground(b: Background): void;
  setHideNames(on: boolean): void;
  toggleString(n: number): void;
  setRegionStart(v: number): void;
  setRegionEnd(v: number): void;
  setRegionShortcut(k: RegionShortcut): void;
  widenRegion(): void;
  activate(p: Position): void;            // playback.note(p, instrument) + openCard(p)
  closeCard(): void;
  listen(): void;                         // playback.sequence(steps, LISTEN_BPM, instrument) if enabled
  clear(): void;
  reset(): void;
  useInstrument(i: Instrument): void;     // revalidate; playback.stop('instrument') if changed
};
export function resetNotesForTests(instrument?: Instrument): void;
```

**Playback obligations** (003 contract FR-014, spec FR-012a):

| Action | `playback.stop('view')` |
|---|---|
| toggleNote, addNote (when it changes), setLabelType, setBackground, setHideNames, toggleString, setRegion*, widenRegion, clear, reset | yes, iff state changed |
| activate | no (it calls `playback.note`, which interrupts) |
| closeCard | no |
| listen | no (new `sequence` interrupts and restarts) |
| useInstrument | `stop('instrument')` iff instrument changed |
