# Data Model: Seven-String Guitars

**Feature**: `012-seven-strings` | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

Extends the 009 / 011 data models. Pitches are MIDI numbers (C4 = 60, E2 = 40, B1 = 35).
Everything in §1–§3 is pure (`src/lib/instrument`, `src/lib/theory`); §4–§6 live in
`src/lib/state` and `src/lib/prefs`.

---

## 1. StringCount and TuningPreset (`src/lib/instrument/tunings.ts`)

| Entity | Fields | Rules |
|---|---|---|
| `StringCount` | `6 \| 7` | `DEFAULT_STRING_COUNT = 6`. `isStringCount(x)`: exactly 6 or 7. Eight strings out of scope (Q-9). |
| `TuningId` | `'AF-1' … 'AF-11' \| 'AF-21' \| 'AF-22' \| 'AF-23'` | `isTuningId(x)` any of the 14. `isTuningIdFor(x, count)`: in `presetsFor(count)`. |
| `TuningPreset` | `id`, `strings: SpelledPitch[]` (low → high, own spelling) | 6-string presets: 6 entries (unchanged). AF-21/22/23: 7 entries (TM-2). |

New preset data (TM-2, stored spelling):

| Id | Name (catalog key) | Strings 7 → 1 |
|---|---|---|
| AF-21 | 7-string standard (`tuning_af21`) | B1 E2 A2 D3 G3 B3 E4 |
| AF-22 | 7-string half step down (`tuning_af22`) | B♭1 E♭2 A♭2 D♭3 G♭3 B♭3 E♭4 |
| AF-23 | Drop A (`tuning_af23`) | A1 E2 A2 D3 G3 B3 E4 |

Per-count availability and display order:

| Count | `presetsFor(count)` (order = panel order) | Rows |
|---|---|---|
| 6 | AF-1, AF-2, AF-3 … AF-11 | 11 (unchanged) |
| 7 | AF-21, AF-22, AF-23, AF-3, AF-4, … AF-11 | 12 |

`presetStrings(id, count)` → `SpelledPitch[]` low → high, length = count, memoized and frozen:

- `count === 6` and id ∈ AF-1 … AF-11 → the preset's strings (unchanged).
- `count === 7` and id ∈ AF-21 … AF-23 → the preset's strings.
- `count === 7` and id ∈ AF-3 … AF-11 → `[fourthBelow(strings[0]), ...strings]`.
- Any other pair (not canonical) → falls back to the count's standard (AF-1 or AF-21). Never
  reached through public transitions; defensive only.

Derived 7-string rows for AF-3 … AF-11 (acceptance data, US1-3/5/6):

| Id | Strings 7 → 1 on 7 strings |
|---|---|
| AF-3 Whole step down | A1 D2 G2 C3 F3 A3 D4 |
| AF-4 Drop D | A1 D2 A2 D3 G3 B3 E4 |
| AF-5 Drop C | G1 C2 G2 C3 F3 A3 D4 |
| AF-6 DADGBD | A1 D2 A2 D3 G3 B3 D4 |
| AF-7 DADGAD | A1 D2 A2 D3 G3 A3 D4 |
| AF-8 Open G | A1 D2 G2 D3 G3 B3 D4 |
| AF-9 Open D | A1 D2 A2 D3 F♯3 A3 D4 |
| AF-10 Open E | B1 E2 B2 E3 G♯3 B3 E4 |
| AF-11 Open A | B1 E2 A2 E3 A3 C♯4 E4 |

## 2. `fourthBelow` (`src/lib/theory/pitch.ts`)

`fourthBelow(s: SpelledPitch): SpelledPitch` — exact perfect fourth below `s` by the TM-4
letter rule:

- letter = 3 steps down the cycle C D E F G A B (E→B, D→A, C→G, F→C, G→D, A→E, B→F);
- octave = `s.octave − 1` when the new letter is above `s.letter` in the cycle (wrap past C),
  else `s.octave`;
- accidental = `(pitchOfSpelling(s) − 5) − natural pitch of (letter, octave)`. It equals the
  input accidental for every letter except B (B → F needs one more sharp: B → F♯), so only
  B𝄪 would leave the −2 … +2 range; the function returns `null` there rather than throwing.
  Callers pass only preset strings (|accidental| ≤ 1), for which the result is always
  defined.

Invariant (property-tested): `pitchOfSpelling(fourthBelow(s)) === pitchOfSpelling(s) − 5`.

## 3. Offsets and Tuning (`src/lib/instrument/custom-tuning.ts`, `tunings.ts`)

| Entity | Shape | Rules |
|---|---|---|
| `Offsets` | `readonly number[]` | Length = string count (6 or 7). Order: lowest string → string 1. Each integer, `OFFSET_MIN = −7` ≤ x ≤ `OFFSET_MAX = 4`. Frozen. |
| `StringNumber` | `1 … 7` | String 7 only valid when count = 7. |
| Reference pitches | 6: `[40,45,50,55,59,64]`; 7: `[35,40,45,50,55,59,64]` | `referencePitches(count)`. |
| `Tuning` | `{kind:'preset', id}` \| `{kind:'custom', offsets}` | Unchanged union. Count of a custom tuning = `offsets.length`. |

Functions (all pure, count-aware):

| Function | Behavior |
|---|---|
| `isOffsets(x, count)` | array, length = count, every element integer in −7 … 4. |
| `presetOffsets(id, count)` | `pitchOfSpelling(presetStrings(id,count)[i]) − referencePitches(count)[i]`. |
| `matchPreset(o)` | First preset of `presetsFor(o.length)` whose offsets equal `o`; pitch only, never spelling. On 7 strings AF-21/AF-22 therefore win (AF-1/AF-2 are not in the list). |
| `tuningFromOffsets(o)` | Canonical constructor (unchanged contract): preset when matched, else custom. |
| `offsetsOfTuning(t, count)` | preset → `presetOffsets(id, count)`; custom → `t.offsets`. |
| `tuningStrings(t, count)` | preset → `presetStrings(id, count)`; custom → `offsetPitches(o).map(spellSharp)`. |
| `isStandard(t)` | `preset` and id ∈ {AF-1, AF-21} (badge rule FR-007). |
| `canStep(o, string, delta)` / `stepOffsets` | Index = `o.length − string`; refused when `string > o.length` or result out of range. |
| `invertedStrings(o)` | Unchanged rule, loop to `o.length − 1` (covers pair 7/6, EC-2.1). |
| `addSeventh(o)` | `[o[0], ...o]` (6 → 7, R-04). Precondition length 6. |
| `dropSeventh(o)` | `o.slice(1)` (7 → 6). Precondition length 7. |
| `tuningInstrument(t, count, frets)` | Memoized frozen `Instrument` with `stringCount = count`, `openStrings` = `tuningStrings(t, count)` reversed (string 1 first). |

String 7 custom range: offsets −7 … +4 over B1 → **E1 (28) … D♯2 (39)** (FR-005).

Canonical-form invariant (property-tested): for every count and every valid `Offsets` `o` of
that length, `tuningFromOffsets(o)` is a preset iff some preset in `presetsFor(o.length)` has
pitches `o`; and `offsetsOfTuning(tuningFromOffsets(o), o.length)` equals `o`.

## 4. InstrumentConfig and PanelState (`src/lib/state/instrument-config.ts`)

```text
InstrumentConfig {
  stringCount: StringCount      // NEW, default 6
  tuning: Tuning                // canonical for stringCount
  fretCount: number             // 12 … 24, independent of stringCount (FR-2.8)
}
DEFAULT_CONFIG = { stringCount: 6, tuning: AF-1, fretCount: 22 }
```

Invariant: `tuning` is canonical for `stringCount` (preset id ∈ `presetsFor(stringCount)`;
custom offsets length = `stringCount` and match no preset of that count).

`equalsConfig` adds `a.stringCount === b.stringCount`.

Panel transitions (pure, no-op returns the same object):

| Transition | Effect on `pending` |
|---|---|
| `setStringCount(p, n)` (NEW) | closed / invalid n / n = current → same object. Otherwise offsets of pending tuning → `addSeventh` or `dropSeventh` → `tuningFromOffsets`. `fretCount` unchanged. `customOpen` unchanged. |
| `selectTuning(p, id)` | refused unless `isTuningIdFor(id, pending.stringCount)`. |
| `chooseCustom(p)` | unchanged (rows from current pending pitches, count-aware). |
| `stepString(p, s, d)` | refused when `s > pending.stringCount`. |
| `restoreDefault(p)` | → `DEFAULT_CONFIG` (6 strings, AF-1). |
| `confirmPanel` / `cancelPanel` | unchanged; `changed` includes the count. |

State transition examples (pending, 22 frets):

| From | Action | To |
|---|---|---|
| 6, AF-1 | count 7 | 7, AF-21 |
| 6, AF-2 | count 7 | 7, AF-22 |
| 6, AF-4 (Drop D) | count 7 | 7, AF-4 (A1 D2 A2 D3 G3 B3 E4) |
| 6, custom [−2,0,0,−1,0,0] | count 7 | 7, custom [−2,−2,0,0,−1,0,0] |
| 7, AF-21 | count 6 | 6, AF-1 |
| 7, AF-23 (Drop A) | count 6 | 6, AF-1 |
| 7, AF-22 | count 6 | 6, AF-2 |
| 7, AF-21, custom open | lower string 7 twice | 7, AF-23 |
| 7, AF-23, custom open | lower string 7 once | 7, custom [−3,0,0,0,0,0,0] (G♯1) |
| 7, any | Restore default | 6, AF-1, 22 frets |

## 5. App store (`src/lib/state/instrument.svelte.ts`)

| Member | Change |
|---|---|
| `setStringCount(n)` | NEW: `panel = setStringCount(panel, n)`. |
| `stringCount` getter | NEW: pending count while open, else active count (panel radio). |
| `presets` getter | NEW: `presetsFor(pending.stringCount)` with each row's spelled strings, for the panel list. |
| `rows` (custom editor) | Row order `[count, …, 1]` instead of the fixed `[6 … 1]`. |
| `confirm(screen)` | `preferences.remember` also receives `stringCount`; tuning id written canonical (`AF-21` placeholder for an unmatched 7-string custom tuning). Notes and Triads `applyInstrument` unchanged in call shape. |
| `restore(config)` | unchanged shape; config now carries `stringCount`. |

## 6. Tool view adjustments (`src/lib/state/notes-view.ts`, `triads-view.ts`)

**Notes string filter** (`adaptNotesView(s, prev, next)`), applied before the existing region /
card steps:

| prev → next | `activeStrings` before | After | `filterForced` |
|---|---|---|---|
| 6 → 7 | `[1…6]` (all) | `[1…7]` | false |
| 6 → 7 | any subset | unchanged (7 off) | false |
| 7 → 6 | contains 7 and others | without 7 | false |
| 7 → 6 | `[7]` only | `[1…6]` | **true** |
| same count | any | unchanged | false |

`adjusted = regionClamped || cardClosed || filterForced`. A card open on string 7 closes on
7 → 6 (`cardClosed`, existing EC-2.3 rule).

**Triads string set** — unchanged code: `revalidate` maps an invalid set to
`min(set, stringCount)` (7 → 6), the store reports `adjusted`, the notice shows; 6 → 7 never
changes the set.

**View adjustment** entity = `adjustedIn: ToolId | null` in the instrument store (existing);
message `instrument_adjusted` ("We adjusted the view to the new instrument").

## 7. Preferences (`src/lib/prefs/schema.ts`)

`Preferences` gains `stringCount: StringCount` (default 6). `customTuning: Offsets | null` now
has length = `stringCount`. Parsing/serializing rules: [contracts/storage-format.md](./contracts/storage-format.md).
`tuningOfPreferences(p)` → canonical `Tuning` for `p.stringCount`; the store restores
`{ stringCount, tuning, fretCount }`.

## 8. Rendering tokens (`src/lib/styles/tokens.css`)

| Token | Value | Use |
|---|---|---|
| `--fb-string-width-7` | `0.375rem` | NEW; `.string-7` stroke in `Fretboard.svelte`. Progression 1 → 7: 0.0625, 0.09375, 0.125, 0.1875, 0.25, 0.3125, 0.375 rem. |
| `--fb-row` | `2.75rem` (unchanged) | ≥ `--marker-root` 2.25rem + gap → neighboring markers never touch (FR-009). |
