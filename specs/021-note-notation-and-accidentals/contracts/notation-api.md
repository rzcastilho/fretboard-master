# Contract: Notation Module APIs

**Feature**: `021-note-notation-and-accidentals` | See [data-model.md](../data-model.md) for the
types, and [research.md](../research.md) for the rationale.

These are internal module contracts. Unit tests (Vitest, written test-first under Constitution
IV) assert each numbered rule.

## 1. `src/lib/notation/policy.ts` (pure; no Paraglide, Svelte, or DOM)

```ts
export type Notation = 'letters' | 'solfege';
export type AccidentalPolicy = 'sharps' | 'flats' | 'both';
export const NOTATIONS: readonly Notation[];               // ['letters', 'solfege']
export const ACCIDENTAL_POLICIES: readonly AccidentalPolicy[]; // ['sharps', 'flats', 'both']
export interface NotationContext { readonly notation: Notation; readonly accidentals: AccidentalPolicy }
export const DEFAULT_NOTATION_CONTEXT: NotationContext;    // { letters, sharps }, frozen
```

## 2. `src/lib/notation/notation.ts` (existing; extended)

### Context

```ts
export function overwriteNotationSource(get: () => NotationContext): void;
export function resetNotationSourceForTests(): void; // back to DEFAULT_NOTATION_CONTEXT
```

N-1. Every formatter below reads the context through the current getter on each call, never
caching it.

### Names

```ts
export function noteName(letter: Letter): string;                 // 'C' | 'Do' | 'Dó' …
export function solfegeName(letter: Letter): string;              // always the syllable (CAGED note)
export function noteLabel(s: Spelling): string;                   // existing; now notation-aware
export function pitchLabel(s: Spelling, octave: number): string;  // existing; notation-aware
export function noteLabelParts(s: Spelling, octave?: number):
  { readonly name: string; readonly accidental: string; readonly octave: string };
export function spokenNote(s: Spelling): string;                  // existing; notation-aware
export function spokenNoteList(ss: readonly Spelling[]): string;  // existing
export function noteList(ss: readonly Spelling[]): string;        // existing
```

- N-2. In letters, `noteName(l) === l`. In solfège it is `m.note_name_solfege_<l>()`:
  - en and es: Do Re Mi Fa Sol La Si
  - pt-BR: Dó Ré Mi Fá Sol Lá Si
- N-3. `noteLabel(s) === name + GLYPH[s.accidental]`, where the glyph is one of `''`, ♯, ♭, 𝄪
  (U+1D12A), or 𝄫 (U+1D12B). The output never contains `#` or an ASCII `b` used as an accidental
  (property test over all spellings × notations × locales).
- N-4. `spokenNote` returns `m.note_spoken_<kind>({ note: noteName(letter) })`. Examples:
  - en letters F♯ gives "F sharp"; en solfège gives "Fa sharp"
  - pt-BR solfège F♯ gives "Fá sustenido"; es solfège gives "Fa sostenido"
  - en B𝄫 gives "B double flat"
- N-5. Interval labels (`intervalLabel`) are unaffected by notation.

### Spelling helpers (accidental policy)

```ts
export function defaultSpelling(pc: PitchClass): Spelling;          // existing: always sharps
export function flatSpelling(pc: PitchClass): Spelling;             // existing
export function singleSpelling(pc: PitchClass): Spelling;           // sharps|both → ♯, flats → ♭
export function spellingPair(pc: PitchClass): readonly Spelling[];  // naturals: [n]; else preferred first
export function markerSpellings(pc: PitchClass): readonly Spelling[]; // sharps [♯], flats [♭], both [♯, ♭]
export function stringSpelling(open: Spelling, fixed: boolean): Spelling; // fixed → open; else singleSpelling
export function spokenPair(pc: PitchClass): string;  // naturals: spokenNote; else note_spoken_either(first, second)
export function labelPair(pc: PitchClass): string;   // naturals: noteLabel; else "first / second"
```

- N-6. `defaultSpelling` ignores the policy. Triads and CAGED and any unspelled marker outside
  Notes keep sharps (FR-009).
- N-7. Under flats, `spellingPair` puts ♭ first: `labelPair(1) === 'D♭ / C♯'`. Under sharps and
  both it puts ♯ first.
- N-8. For naturals, `singleSpelling`, `markerSpellings`, and `spellingPair` all return the natural
  only, under every policy.
- N-9. `stringSpelling(E♭, true)` returns E♭ under every policy. `stringSpelling(D♯, false)`
  returns D♭ under flats and D♯ under sharps and both. The octave is never changed by a respell.

## 3. `src/lib/i18n/languages.ts` (existing; data addition)

```ts
// LANGUAGES entries gain:  notation: Notation
export function defaultNotation(tag: LanguageTag): Notation; // en, pt-BR → letters; es → solfege
```

## 4. `src/lib/state/notation.svelte.ts` (new runes store)

```ts
export const notation: {
  readonly effective: Notation;          // chosen ?? defaultNotation(language.current)
  readonly chosen: Notation | null;
  readonly accidentals: AccidentalPolicy;
  start(stored: { notation: Notation | null; accidentals: AccidentalPolicy }): void; // idempotent; installs source
  choose(n: Notation): void;             // sets chosen, remembers { notation: n } (also when equal)
  chooseAccidentals(a: AccidentalPolicy): void; // remembers { accidentals: a }
  restore(stored: Notation | null, accidentals: AccidentalPolicy): void; // non-persisting (erase)
};
export function resetNotationForTests(): void;
```

- S-1. Before any `choose`, a language change moves `effective` (es gives solfège; en and pt-BR
  give letters). After `choose`, it never does (US1-4).
- S-2. `choose` and `chooseAccidentals` never reload, navigate, fetch, or reset another store
  (US2-1).
- S-3. The installed source returns `{ notation: effective, accidentals }`, read reactively.

## 5. Preferences (`src/lib/prefs/schema.ts`, `src/lib/state/preferences.svelte.ts`)

- P-1. `parsePreferences` reads `notation` (picklist or `null`), `accidentals` (picklist, else
  `'sharps'`), and `cagedNote` (boolean, else `false`), each with its own fallback.
- P-2. `serializePreferences` writes:
  - `notation` only when non-null;
  - `accidentals` only when not `'sharps'`;
  - `cagedNote: true` only when true.

  These go after `language`. Every pre-existing fixture round-trips byte-identically.
- P-3. `preferences.start` calls `notation.start(...)` after `language.start(...)`.
  `preferences.erase` calls `notation.restore(null, 'sharps')` and resets `cagedNoteShown`.
- P-4. `preferences.cagedNoteShown` and `preferences.markCagedNoteShown()` are idempotent and
  fire-and-forget. They mirror the rotate hint.
- P-5. New add-only fixtures in `tests/unit/prefs/fixtures/`:
  - `notation-solfege.txt`, `notation-letters.txt`
  - `accidentals-flats.txt`, `accidentals-both.txt`
  - `bad-notation.txt`, `bad-accidentals.txt`
  - `caged-note.txt`

## 6. Fretboard (`src/lib/fretboard/types.ts`, `label-fit.ts`, `Fretboard.svelte`, `description.ts`)

```ts
// DisplayModel gains
readonly spellingPolicy?: 'preference';
// label-fit.ts (pure)
export type MarkerSize = 'small' | 'medium' | 'root';
export function fitMarkerLabel(
  lines: readonly { name: string; accidental: string; octave: string }[],
  size: MarkerSize
): { readonly lines: readonly string[]; readonly size: 'normal' | 'min' };
```

- F-1. When `spellingPolicy` is absent, every label, hint, and description is byte-identical to
  slice 020 for an unchanged notation context (the existing snapshot and description tests stay
  green).
- F-2. With `'preference'`, an unspelled marker uses `markerSpellings` for its drawn label,
  `singleSpelling` for the hover hint, and `spokenPair` for the description and cell name.
- F-3. `fitMarkerLabel` follows the data-model §11 rules and examples exactly. It is
  deterministic and DOM-free.
- F-4. The nut labels use `stringSpelling(open, instrument.fixedSpelling)`.

## 7. Instrument (`src/lib/instrument/instrument.ts`, `tunings.ts`)

- I-1. `Instrument.fixedSpelling` is `true` for every preset instrument and `false` for an
  unmatched custom one. A custom tuning whose offsets equal a preset builds the preset instrument
  (`true`).

## 8. Tuning names (`src/lib/shell/tuning-names.ts`, catalogs)

- T-1. The following take `{note}`, filled with `noteLabel({ letter, accidental: 0 })`:
  - `tuning_af4`, `af5`, `af6`, and `af23` (Drop D/C, Double Drop D, Drop A);
  - `tuning_af8`–`af11` (Open G/D/E/A).

  `tuning_af7` "DADGAD" stays literal.
- T-2. `caged.applyInstrument(next, tuning: Tuning)` stores the `Tuning`. The label is derived in
  the display `$derived`, never stored as a string.

## 9. Catalog contract (`messages/{en,pt-BR,es}.json`)

| Key | en | pt-BR | es |
|---|---|---|---|
| `note_name_solfege_{c,d,e,f,g,a,b}` | Do Re Mi Fa Sol La Si | Dó Ré Mi Fá Sol Lá Si | Do Re Mi Fa Sol La Si |
| `note_spoken_*` | param renamed `{letter}` → `{note}` | same | same |
| `note_spoken_either` | `{first} or {second}` | `{first} ou {second}` | `{first} o {second}` |
| `notation_label` | Note names | Nomes das notas | Nombres de las notas |
| `notation_letters` | Letters | Letras | Letras |
| `notation_solfege` | Solfège | Solfejo | Solfeo |
| `accidentals_label` | Accidentals | Acidentes | Alteraciones |
| `accidentals_sharps` / `_flats` / `_both` | Sharps / Flats / Both | Sustenidos / Bemóis / Ambos | Sostenidos / Bemoles / Ambos |
| `language_panel_label` | Language and notation | Idioma e notação | Idioma y notación |
| `language_close` | Close language and notation settings | Fechar idioma e notação | Cerrar idioma y notación |
| `caged_solfege_note` | The shapes are named after the open chords C ({c}), A ({a}), G ({g}), E ({e}), and D ({d}) | As formas levam o nome dos acordes abertos C ({c}), A ({a}), G ({g}), E ({e}) e D ({d}) | Las formas llevan el nombre de los acordes abiertos C ({c}), A ({a}), G ({g}), E ({e}) y D ({d}) |
| `tuning_af4/5/6/8/9/10/11/23` | "Drop {note}", "Open {note}" … | "Drop {note}", "Aberta em {note}" … | "Drop {note}", "Abierta en {note}" … |

- `notes_selector_altered_spoken` is removed and replaced by `note_spoken_either`.
- The glossary (`docs/i18n/glossary.md`) gains the notation terms.
- The identical-text allowlist gains the es/en-identical syllables and "Drop {note}".
