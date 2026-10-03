# Contract: Instrument Panel — String Count (UI)

**Feature**: `012-seven-strings` | Extends
[009 instrument-panel-ui.md](../../009-instrument-panel-and-tunings/contracts/instrument-panel-ui.md)
and [011 custom-panel-ui.md](../../011-custom-tuning/contracts/custom-panel-ui.md). Everything
not listed here (dialog, dismissal, focus return, fret stepper, Custom rows behavior, actions)
is unchanged. Tests select by **role and accessible name** (English catalog).

## 1. Panel structure (tab order)

```text
dialog "Instrument"
  fieldset "Strings"                         NEW, first group
    radio "6 strings"   (checked by default)
    radio "7 strings"
  fieldset "Tuning"
    radio <preset rows for the pending count>   11 rows (6) | 12 rows (7), order below
    radio "Custom"                               last (011)
  [Custom open] group "Custom tuning"         rows string <count> first … string 1 last
  status  tuning-name line / inverted-order line (011)
  fret stepper (unchanged, independent of count)
  preview fretboard (pending count + tuning, FR-008)
  Restore default · Confirm · Close
```

## 2. Controls

| Control | Visible text | Accessible name (catalog key → English) | Behavior |
|---|---|---|---|
| Strings group | legend "Strings" | `instrument_strings_legend` → "Strings" | native radio group, arrow keys move/select |
| 6 / 7 radio | "6 strings" / "7 strings" | `instrument_strings_option` → "{count} strings" | `instrument.setStringCount(n)`; pending tuning per data-model §4; list, rows and preview re-render; focus stays on the radio |
| Preset radio (7) | name + seven glyph notes, lowest → highest, e.g. "7-string standard B1 E2 A2 D3 G3 B3 E4" | `instrument_preset_label` "{name}: {notes spoken}" e.g. "Drop A: A, E, A, D, G, B, E" | `selectTuning(id)` |
| String 7 row (Custom) | `−` · "B1" · `+` | "Lower string 7" · "String 7, B 1" · "Raise string 7" | as 011; lower disabled at E1, raise disabled at D♯2, no error text (FR-005) |

Preset list order with 7 strings (FR-003): **7-string standard, 7-string half step down, Drop A,
Whole step down, Drop D, Drop C, DADGBD, DADGAD, Open G, Open D, Open E, Open A** (12 rows;
"Standard" and "Half step down" absent). With 6 strings: unchanged AF-1 … AF-11.

Checked radio after a count change = the canonical result (e.g. Drop D stays checked on
6 → 7; Standard becomes "7-string standard"; with Custom open, Custom stays checked and the
name line shows the matched preset name or "Custom").

## 3. Surfaces outside the panel

| Surface | 6 strings (unchanged) | 7 strings |
|---|---|---|
| Home `InstrumentSummary` | "6 strings · standard tuning · right-handed" / "6 strings · {name} · right-handed" | "7 strings · standard tuning · right-handed" (AF-21) / "7 strings · {name} · right-handed" |
| `TuningBadge` | hidden for Standard | hidden for 7-string standard; shown with the name for every other tuning, e.g. "Drop A", "Drop D", "Custom" (FR-007) |
| Fretboard | 6 rows | 7 rows; string 7 at the bottom (highest-top orientation), stroke `--fb-string-width-7`, label column "7 B" / open note; keyboard: ArrowDown from string 6 reaches string 7 (FR-018) |
| Text description | unchanged | entries for string 7 ("String 7, fret 0, B …"), accidentals spoken in full |
| Adjustment notice | — | `status` "We adjusted the view to the new instrument" + "Dismiss" only when Triads left 7-6-5 or the Notes filter/card had to change (FR-010, FR-013) |

## 4. Tool controls

| Tool | Control | 6 strings | 7 strings |
|---|---|---|---|
| Fretboard Notes | `group` string filter | 6 toggle buttons "String n, note" | 7 buttons; "String 7, B" first-from-bottom per existing order |
| Triads | `radiogroup` string set | 6-5-4, 5-4-3, 4-3-2, 3-2-1 | **7-6-5**, 6-5-4, 5-4-3, 4-3-2, 3-2-1 (FR-011) |

## 5. Non-functional

- Every new target ≥ 44 × 44 CSS px in comfortable mode; colors/spacing from tokens; works
  320–2560 px and 200 % text zoom (legend and options wrap, never truncate).
- Zero axe violations on the panel with 7 strings and on Notes / Triads with 7 strings (SC-008).
- No new URL parameter or share-link field (later wave).
