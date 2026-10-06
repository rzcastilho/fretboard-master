# Data Model: Letters or Solfège, Sharps or Flats

**Feature**: `021-note-notation-and-accidentals` | **Date**: 2026-10-05 | **Research**: [research.md](./research.md)

All entities are client-side and in-memory, except §4, which persists in the v1 `localStorage`
preferences record.

## 1. Notation (`src/lib/notation/policy.ts`, pure)

| Field | Type | Values | Notes |
|---|---|---|---|
| `Notation` | union | `'letters'` \| `'solfege'` | Fixed do, with Si. No movable do, "Ti", or H/B (FR-001) |
| `NOTATIONS` | `readonly Notation[]` | `['letters', 'solfege']` | Feeds the schema picklist and the controls |

Validation: the prefs schema uses `v.picklist(NOTATIONS)`. Anything else is `null`.

## 2. Accidental policy (`src/lib/notation/policy.ts`, pure)

| Field | Type | Values | Default |
|---|---|---|---|
| `AccidentalPolicy` | union | `'sharps'` \| `'flats'` \| `'both'` | `'sharps'` |
| `ACCIDENTAL_POLICIES` | `readonly AccidentalPolicy[]` | in that order | — |

How each policy resolves (see [contracts/notation-api.md §2](./contracts/notation-api.md)):

| Slot | sharps | flats | both |
|---|---|---|---|
| single name (notice, detected-triad root, string name, listen, description) | ♯ | ♭ | ♯ |
| pair (selector, position card), preferred first | ♯ / ♭ | ♭ / ♯ | ♯ / ♭ |
| Notes marker | ♯ | ♭ | ♯ over ♭ if it fits, else ♯ |
| natural note | natural | natural | natural |
| Triads / CAGED / preset string | theory or preset spelling, always | same | same |

## 3. Notation context (`NotationContext`, read by `src/lib/notation/notation.ts`)

```text
NotationContext = { notation: Notation; accidentals: AccidentalPolicy }
```

- It is supplied by a replaceable getter, `overwriteNotationSource(get)`. The default is
  `{ letters, sharps }`.
- At runtime the getter reads the notation store (§5), so every formatter called in a reactive
  scope tracks it.

## 4. Preference fields (v1 preferences record, `src/lib/prefs/schema.ts`)

These are added to the `Preferences` interface and to `DEFAULT_PREFERENCES`:

| `Preferences` field | Stored key | Type | Default | Written when | Invalid / absent → |
|---|---|---|---|---|---|
| `notation` | `notation` | `Notation \| null` | `null` | non-null (explicit pick) | `null` |
| `accidentals` | `accidentals` | `AccidentalPolicy` | `'sharps'` | `!== 'sharps'` | `'sharps'` |
| `cagedNoteShown` | `cagedNote` | `boolean` | `false` | `true` | `false` |

- Serializer order: the keys come after `language`, as `notation`, `accidentals`, `cagedNote`.
- `PREFS_VERSION` stays `1`. A record from slices ≤ 020 parses unchanged and re-serializes
  byte-identically.
- Each field is validated alone with `v.fallback`, so one invalid field never resets another.
  `parsePreferences` stays total.
- `PreferencesPatch` accepts `{ notation }`, `{ accidentals }`, and `{ cagedNoteShown: true }`.
- Never written into share links (DM-17). "Reset tool" never touches them (FR-1.11).

## 5. Notation runtime state (`src/lib/state/notation.svelte.ts`, runes store)

| Field | Kind | Meaning |
|---|---|---|
| `chosen` | `$state<Notation \| null>` | Explicit pick, or `null` = follow the language |
| `accidentals` | `$state<AccidentalPolicy>` | Current policy |
| `effective` | getter, derived | `chosen ?? defaultNotation(language.current)` |

State transitions:

```text
start(stored)          chosen = stored.notation; accidentals = stored.accidentals; install source
choose(n)              chosen = n; remember({ notation: n })          (bar toggle or panel)
chooseAccidentals(a)   accidentals = a; remember({ accidentals: a })  (panel only)
language change        no write; effective re-derives iff chosen === null
restore(null,'sharps') erase: chosen = null; accidentals = 'sharps'   (no write)
```

## 6. Language data addition (`src/lib/i18n/languages.ts`)

Each `LANGUAGES` entry gains `notation: Notation`: en → `letters`, pt-BR → `letters`,
es → `solfege`. A new pure helper, `defaultNotation(tag): Notation`, reads it.

## 7. CAGED solfège note state

| Field | Owner | Meaning |
|---|---|---|
| `cagedNoteShown` | preferences store (`$state<boolean>`) | Recorded value, or set for this load when storage is unavailable |
| `noteOpen` | `CagedTool.svelte` local `$state` | Visible now. Dismissing sets it to false |

Trigger: CAGED is displayed, `notation.effective === 'solfege'`, and `!cagedNoteShown`. The
effect sets `noteOpen = true` and calls `markCagedNoteShown()` at once. Erase sets
`cagedNoteShown` back to `false`.

## 8. Instrument addition (`src/lib/instrument/instrument.ts`)

| Field | Type | Meaning |
|---|---|---|
| `fixedSpelling` | `boolean` | `true` when built from a preset (including a custom tuning that canonicalizes to one), so open strings keep their TM-2 spelling. `false` for an unmatched custom tuning, whose open-string names follow the accidental policy |

This is set in `tuningInstrument` and the presets builder. It is part of the memoized instrument
identity, which does not change, because the tuning kind already keys the cache.

## 9. Display model addition (`src/lib/fretboard/types.ts`)

| Field | Type | Meaning |
|---|---|---|
| `DisplayModel.spellingPolicy` | `'preference' \| undefined` | Set only by the Notes model. Unspelled markers, the hover hint, and description names then follow the accidental policy. When absent, behavior is unchanged (`spelling` or `defaultSpelling`) |

## 10. Note name (rendered value)

A rendered note name is a pure function of
`(Spelling, octave?, NotationContext.notation, locale)`:

- `name` = the letter, or the catalog syllable (`note_name_solfege_<letter>`);
- `accidental` = `''`, ♯, ♭, 𝄪, or 𝄫 (never `#` or `b`);
- `octave` = an optional integer.

The spoken form is `note_spoken_<kind>({ note: name })`. The pair form is
`note_spoken_either({ first, second })`. It is never abbreviated.

## 11. Marker label fit (`src/lib/fretboard/label-fit.ts`, pure)

```text
input:  lines: string[] (1 or 2), markerSize: 'small' | 'medium' | 'root'
output: { lines: string[]; size: 'normal' | 'min' }
```

Rules (FR-012, FR-008), counting graphemes as code points:

1. Two lines are kept only when the marker is `medium` or `root` and each line is ≤ 3. They then
   render at size `min`. Otherwise keep line 1 (the sharp spelling) only.
2. One line: ≤ 3 → `normal`; 4 → `min`; ≥ 5 → abbreviate.
3. Abbreviate in order, re-testing after each step:
   - (a) shorten the note-name part to 2 graphemes ("Sol" → "So");
   - (b) drop the octave digits.

   The result renders at `min`.
4. Examples:
   - "F♯" → normal
   - "Sol♯" → min
   - "Sol♯3" → "So♯3" at min
   - "Sol𝄪3" → "So𝄪3" at min
   - both, medium, "C♯" and "D♭" → two lines at min
   - both, medium, "Do♯" and "Re♭" → two lines at min
   - both, small → "C♯" at normal

## Relationships

```text
LANGUAGES.notation ──► defaultNotation ──┐
prefs.notation (chosen) ─────────────────┼─► notation store.effective ─┐
prefs.accidentals ──────────────────────────► notation store.accidentals ┤
                                                                       ▼
                                            NotationContext (getter) ─► notation.ts formatters
                                                                       ▼
        Notes model (spellingPolicy) ─► Fretboard ─► label-fit ─► SVG labels
        Instrument.fixedSpelling ─► stringSpelling ─► nut labels, string filter, panel
        tuning-names (Drop {note}) ─► badge, panel, CAGED notice
prefs.cagedNote ─► preferences.cagedNoteShown ─► CagedTool notice
```
