# Phase 1 Data Model: CAGED Across Tunings

This slice extends the slice-014 model (`specs/014-caged-shapes/data-model.md`). Only new or
changed entities are listed. Nothing is persisted: storage and the URL are unchanged.

## 1. Tuning class (theory, unchanged type)

```ts
type CagedTuningClass = 'compatible' | 'altered-string' | 'non-compatible';
```

| Class | Rule on six highest strings (6→1) | Presets (6-string) | Behaviour |
|---|---|---|---|
| `compatible` | intervals 6→5…2→1 = 5,5,5,4,5 | AF-1, AF-2, AF-3; 7-str AF-21, AF-22, AF-23 | Standard drawing, real notes |
| `altered-string` | 5→1 = 5,5,4,5 and 6→5 ≠ 5 | AF-4 Drop D, AF-5 Drop C (and their 7-string variants) | Strings 5→1 normal; string 6 region notes + "altered" mark |
| `non-compatible` | anything else, or malformed input | AF-6 … AF-11, most custom | Notice + two actions, no shapes |

Derived only from open pitches (FR-001). A custom tuning matching a rule takes that class.

## 2. Shape occurrence (theory, extended)

```ts
interface ShapeOccurrence {
  readonly shape: CagedShape;
  /** Inclusive chord-fret span on the strings that position the shape (5→1 when altered). */
  readonly start: number;
  readonly end: number;
  /** Strings 5→1 from the table; string 6 from the table (compatible) or region notes (altered). */
  readonly notes: readonly OccurrenceNote[];
  /** NEW: true iff the tuning class is 'altered-string'. */
  readonly alteredString: boolean;
}
```

Placement rules:

- **Shift**: `shift = mod12(rootPc − (pc(open[string 5]) − 9))`. For a compatible tuning this
  is the same shift slice 014 computed.
- **Candidates**: each shape is tried at octave offsets −12, 0, +12, +24.
- **Fit**: the occurrence is kept iff every table note on the *positioning strings* lies in
  `0…fretCount`. Positioning strings are 6→1 when compatible and 5→1 when altered.
- **String 6 when altered**: the table cell is discarded. For G and E shapes,
  `alteredStringNotes(open6, rootPc, quality, start, end)` is appended. C, A and D shapes get
  nothing on string 6.
- **Order**: occurrences sort by `start` ascending (unchanged).

Validation:

- non-compatible or malformed input → `[]`;
- never throws.

## 3. Altered-string note (theory, new function output)

`OccurrenceNote { string: 6; fret; degree }` for each fret `f ∈ [start, end]` with
`pc(open6 + f) ∈ { root, third, fifth }` of the key:

| pc offset from root | degree |
|---|---|
| 0 | `R` |
| 4 (major) / 3 (minor) | `3` / `b3` |
| 7 | `5` |

Zero, one or several notes. Zero is valid (FR-006).

## 4. Root strings for tags (theory, new helper)

`occurrenceRootStrings(occ)` returns `rootStrings(occ.shape)` without string 6 when
`occ.alteredString`, descending. It is used by the tag text and the description
(FR-003: E → "4, 1", G → "3, 1" in Drop D).

## 5. CAGED view state (unchanged)

`CagedViewState { rootPc, spellingOverride, quality }`. The temporary tuning is **not** part
of the view state: key, quality, spelling and Reset never change it (FR-010).

## 6. CAGED store (state, extended)

| Field | Kind | Source / rule |
|---|---|---|
| `preferred` (was `instrument`) | `$state.raw<Instrument>` | `applyInstrument(next, tuningName)` from instrument orchestration |
| `tuningName` | `$state<string>` | Same call; `tuningLabel(config.tuning)` (preset name or "Custom") |
| `temporary` | `$state<boolean>` | `false` initially and after reload |
| `instrument` (getter) | `$derived` | `temporary ? standardCounterpart(preferred) : preferred` |
| `display` | `$derived` | `buildCagedModel(view, instrument, { tuningName, temporary })` |
| `temporaryName` (getter) | `string \| null` | `display.temporaryName` |

Transitions (all no-ops when they would not change anything):

| Action | Precondition | Effect |
|---|---|---|
| `viewInStandard()` | `display.tuningClass === 'non-compatible'` and `!temporary` | `temporary = true`; `playback.stop('instrument')` |
| `endTemporary()` | `temporary` | `temporary = false`; `playback.stop('instrument')` |
| `screenChanged()` | any | `endTemporary()` (called by `+layout` `beforeNavigate` on a real path change) |
| `applyInstrument(next, name)` | any | set `preferred`, `tuningName`; returns `false` (view kept, FR-011) |
| `selectRoot` / `setQuality` / `switchSpelling` / `reset` | — | view only; `temporary` kept |

Ending events: leaving CAGED (`screenChanged`), reload (module state), instrument
**Confirm** (`instrument.confirm` calls `caged.endTemporary()` before its unchanged early
return). Panel **Cancel** does not end it.

## 7. Standard counterpart (instrument, new pure function)

`standardCounterpart(inst: Instrument): Instrument` in `src/lib/instrument/tunings.ts` returns
`withPresentation(presetInstrument(standardTuningId(inst.stringCount), inst.stringCount,
inst.fretCount), inst.handedness, inst.orientation)`.

- It is memoized through `presetInstrument`.
- The string count, fret count, handedness and orientation are kept, so only the tuning
  changes.

## 8. CAGED display (state model, extended)

```ts
interface CagedDisplay {
  readonly keyName: string;
  readonly tuningClass: CagedTuningClass;          // class of the *effective* instrument
  readonly tuningName: string;                     // NEW: name shown (temporary → standard name)
  readonly temporaryName: string | null;           // NEW: non-null iff temporary is active
  readonly unsupportedNotice: string | null;       // NEW: FR-016 text iff non-compatible
  readonly occurrences: readonly ShapeOccurrence[];
  readonly fitCount: number;
  readonly fitNote: string | null;
  readonly model: DisplayModel | null;             // null iff non-compatible
  readonly switchTo: Spelling | null;
}
```

`model` changes only when shapes are drawn:

- **Markers**: string-6 markers from region notes use the same function, spelling (from
  `spellTriad`) and interval label as other markers. Ids stay `"string:fret"` and are
  deduplicated across occurrences.
- **`tags[].label`**: built from `occurrenceRootStrings`.
- **`stringMarks`** (NEW): `[{ string: 6, label: m.caged_altered_mark() }]` iff the class is
  `altered-string`, otherwise absent.
- **`description`**: three parts, in order:
  1. a tuning sentence, either `caged_description_tuning` or `caged_description_temporary`;
  2. `caged_description_altered` when the class is altered-string;
  3. the slice-014 summary and entries (root strings from `occurrenceRootStrings`, string-6
     notes included).

## 9. Fretboard display model (renderer, extended)

```ts
interface DisplayModel {
  // …existing fields
  /** NEW: visible text marks drawn beside a string's label (CAGED "altered"). */
  readonly stringMarks?: readonly { readonly string: number; readonly label: string }[];
}
```

Renderer rules:

- Draw `label` as SVG text in the label column of the row for `string`, below the
  string-number/open-note label.
- When `stringMarks` is non-empty, the label column width is `--fb-label-col-marked` instead of
  `--fb-label-col`.
- Placement follows `labelCenter`, which is already mirrored for handedness and orientation.
- The mark is `aria-hidden`; the description carries the meaning.
- Marks for strings not on the instrument are ignored.

## 10. Persisted data

None changes. The `fretboard-master:prefs` v1 record is untouched, the temporary tuning is
never written (SC-005), and there is no URL state.
