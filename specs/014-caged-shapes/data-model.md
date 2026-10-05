# Data Model: The Five CAGED Shapes Along the Neck

**Feature**: `014-caged-shapes` | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

The model has two parts. Theory types (§1–§3) are pure and live in `src/lib/theory/caged.ts`.
State and presentation types (§4–§6) live in `src/lib/state/caged-*.ts`. The only fretboard
change is one optional field (§7). The only stored change is a widened `lastTool` picklist
(§8).

## 1. `CagedShape` (theory, constant data)

| Field | Type | Rule |
|---|---|---|
| `id` | `'C' \| 'A' \| 'G' \| 'E' \| 'D'` | Literal drawing name, never localized or spelled (FR-009) |
| `quality` | `'major' \| 'minor'` | `CagedQuality = Extract<Quality, 'major' \| 'minor'>` |
| `strings` | `readonly (ShapeNote \| null)[6]` | Index 0 = string 6 … index 5 = string 1. `null` = muted ("x") |

`ShapeNote = { fret: number; degree: 'R' | '3' | 'b3' | '5' }` (the degree is an `IntervalId`
from `./triad`). `fret` is the **C-key, standard-tuning reference fret** from TM-6.1/TM-7.1.

Derived (pure functions, not stored):

- `rootStrings(shape)` → string numbers holding `degree === 'R'`, descending (6 → 1). For
  example, E gives `[6, 4, 1]` and Dm gives `[4, 2]`.
- `referenceSpan(shape)` → `{ lo, hi }` over non-null frets: C 0–3, A 3–5, G 5–8, E 8–10,
  D 10–13 (minor shapes have identical spans).

Constant tables: `CAGED_SHAPES: Readonly<Record<CagedQuality, readonly CagedShape[5]>>` in
cycle order C, A, G, E, D.

Validation (table test, FR-012):

| Shape | Frets 6 → 1 | Degrees 6 → 1 | Root strings |
|---|---|---|---|
| C | x 3 2 0 1 0 | x R 3 5 R 3 | 5, 2 |
| A | x 3 5 5 5 3 | x R 5 R 3 5 | 5, 3 |
| G | 8 7 5 5 5 8 | R 3 5 R 3 R | 6, 3, 1 |
| E | 8 10 10 9 8 8 | R 5 R 3 5 R | 6, 4, 1 |
| D | x x 10 12 13 12 | x x R 5 R 3 | 4, 2 |
| Cm | x 3 1 0 1 x | x R ♭3 5 R x | 5, 2 |
| Am | x 3 5 5 4 3 | x R 5 R ♭3 5 | 5, 3 |
| Gm | 8 6 5 5 8 8 | R ♭3 5 R 5 R | 6, 3, 1 |
| Em | 8 10 10 8 8 8 | R 5 R ♭3 5 R | 6, 4, 1 |
| Dm | x x 10 12 13 11 | x x R 5 R ♭3 | 4, 2 |

## 2. `CagedTuningClass` (theory, derived)

`'compatible' | 'altered-string' | 'non-compatible'`, computed by
`cagedTuningClass(sixOpen: readonly Pitch[6])`. The input is the open pitches of strings
6 → 1, i.e. the six highest strings on a 7-string instrument.

| Intervals 6→5, 5→4, 4→3, 3→2, 2→1 | Class | Presets |
|---|---|---|
| 5, 5, 5, 4, 5 | compatible | AF-1, AF-2, AF-3, AF-21, AF-22, AF-23 |
| ≠5, 5, 5, 4, 5 | altered-string | AF-4, AF-5 |
| anything else | non-compatible | AF-6 … AF-11, most custom tunings |

In this slice, only `compatible` draws shapes (FR-016).

## 3. `ShapeOccurrence` (theory, derived)

Produced by `cagedOccurrences(sixOpen, rootPc, quality, fretCount)`. The precondition is
`cagedTuningClass(sixOpen) === 'compatible'`.

| Field | Type | Rule |
|---|---|---|
| `shape` | `CagedShape` | The drawing |
| `start` | `number` | Lowest chord fret (0 allowed) |
| `end` | `number` | Highest chord fret, ≤ `fretCount` |
| `notes` | `readonly { string: number; fret: number; degree: IntervalId }[]` | String numbers are 1–6, muted strings omitted |

Computation (research R-02):

- `shift = mod(rootPc − (pitchClass(sixOpen[0]) − 4), 12)`.
- The candidate frets are `ref + shift + o` for `o ∈ {−12, 0, 12, 24}`.
- A candidate is kept iff every chord fret is in `0…fretCount` (FR-006).
- Occurrences are sorted by `start`.

Invariants (property-tested):

1. Each note's pitch class is `rootPc + {R:0, 3:4, b3:3, 5:7}[degree]` (mod 12), computed from
   the real open pitch.
2. `0 ≤ fret ≤ fretCount` for every note. No partial occurrence exists.
3. The sequence of `shape.id` is a contiguous run of the cycle C → A → G → E → D → C … .
4. If an occurrence at `start` and another at `start + 12` exist, they have the same
   `shape.id` (EC-6.6).
5. `fitCount = |{ shape.id }|` ∈ {4, 5} for `fretCount` in 12…24.

## 4. `CagedViewState` (state, pure transitions in `caged-view.ts`)

| Field | Type | Initial (FR-002) | Notes |
|---|---|---|---|
| `rootPc` | `PitchClass` (0–11) | `0` (C) | |
| `spellingOverride` | `'none' \| 'sharp' \| 'flat'` | `'none'` | Meaningful only for altered roots |
| `quality` | `CagedQuality` | `'major'` | |

The layer, label and connection settings are **not** fields. They are fixed in this slice
(FR-019) and arrive with 003–005.

Transitions (each total; a no-op returns the same object):

| Transition | Effect |
|---|---|
| `selectRoot(s, pc)` | `rootPc = pc`, `spellingOverride = 'none'` (same root → no-op) |
| `setQuality(s, q)` | `quality = q`; override kept (FR-003) |
| `switchSpelling(s)` | Altered root only: override = the choice of `otherRootSpelling(pc, effective)`; natural root → no-op |
| `resetCaged()` | Initial state (FR-017 Reset tool) |
| `equalsCagedView(a, b)` | Field equality |

Effective root spelling is `effectiveRootSpelling(rootPc, quality, override)` from
`theory/triad.ts` (TM-4.3 defaults: major D♭ E♭ F♯ A♭ B♭; minor C♯ E♭ F♯ G♯ B♭).

Spec trace: C♯/D♭ major → "D♭ major"; minor → "C♯ minor"; switch → "D♭ minor"; major →
"D♭ major" (the override `flat` persists until `selectRoot`).

Lifetime: a module singleton in `caged.svelte.ts`. It survives navigation in the session
(FR-017) and is reset on reload. It is never persisted to storage and never appears in a
link.

## 5. `CagedDisplay` (state, `buildCagedModel(view, instrument)` in `caged-model.ts`)

| Field | Type | Rule |
|---|---|---|
| `keyName` | `string` | For example "D♭ major", via `noteLabel` + quality name |
| `tuningClass` | `CagedTuningClass` | From strings 6 … 1 of `instrument` |
| `occurrences` | `readonly ShapeOccurrence[]` | `[]` unless compatible |
| `fitCount` | `number` | k (FR-011) |
| `fitNote` | `string \| null` | `"With {frets} frets, {count} shapes fit on the fretboard"` iff compatible and k < 5 |
| `model` | `DisplayModel \| null` | `null` unless compatible (the tool shows the interim message) |
| `switchTo` | `Spelling \| null` | Target of **Switch to {root}**; `null` for natural roots |

`model` content when compatible:

- `markers`: for each occurrence in order and each note, one `Marker`:
  - `{ string, fret, function, emphasis: 'normal', interval: degree, spelling, id: 'string:fret' }`;
  - `function` is R → `root`, 3/♭3 → `third`, 5 → `fifth`;
  - `spelling` comes from `spellTriad(effectiveRoot, quality)`.

  Duplicate positions (TM-6.3 shared notes) are dropped after the first, so each is drawn
  once with no extra emphasis.
- `labelMode: 'interval'`.
- `tags`: one `FretboardTag` per occurrence:
  - `{ id: '{shape}@{start}', start, end, label, name: label, pressed: false }`;
  - `label` is `caged_tag_major` / `caged_tag_minor` with `{shape}` = the literal letter and
    `{strings}` = the root strings joined ", ".
- `tagsInteractive: false` (§7).
- `description`: the summary plus one entry per occurrence (contracts/caged-ui §4).

## 6. `caged` store (`src/lib/state/caged.svelte.ts`)

The surface is the same as `triads`:

- getters: `state`, `instrument`, `display`;
- actions: `selectRoot`, `setQuality`, `switchSpelling`, `reset`, `applyInstrument(next):
  boolean` (always `false`: no CAGED view can become invalid), `useInstrument` (test hook),
  `activate(p)` (tap sounds the note, like the other tools; no state change).

A changed view stops playback (`playback.stop('view')`), which is consistent with the other
tools.

## 7. Fretboard model extension

`DisplayModel.tagsInteractive?: boolean`. The default is `true`, which keeps the current
button tags (Triads). When it is `false`, tags render as non-focusable text with the same
layout, the same mirroring and orientation edge, and no `aria-pressed`.

## 8. Stored preferences

`TOOL_IDS` becomes `['notes', 'triads', 'caged']`, so `lastTool: "caged"` is now kept. The
record stays at `version: 1`. No other field is added: key, quality and spelling are
session-only (FR-017). See [contracts/storage-format.md](./contracts/storage-format.md).
