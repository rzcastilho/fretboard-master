# Contract: CAGED user interface

**Feature**: `014-caged-shapes` | Model: [data-model.md](../data-model.md) | API: [caged-api.md](./caged-api.md)

This contract defines what the user sees, operates and hears announced. E2E (`e2e/caged.spec.ts`)
and component tests (`tests/unit/caged/*.test.ts`) assert against it.

## §1 Entry points

| Surface | Contract |
|---|---|
| Home card | The third card after Fretboard Notes and Triads. Name "CAGED", description "How does the whole neck connect?", thumbnail drawn with the configured instrument (the existing `ToolCard`). Shows "Continue" when `lastTool === 'caged'`. |
| Tool navigation | The third link, "CAGED", pointing to `/caged`, with `aria-current="page"` on CAGED. |
| Route | `/caged` is prerendered. The document title is "CAGED — Fretboard Master". |
| Taps to the full view | Home → CAGED card = 1 tap (SC-001). |

## §2 Layout (`src/lib/tools/caged/CagedTool.svelte`)

The zones follow the existing tool grid (`--tool-grid-areas`):

- **Zone B — main controls** (`CagedControls.svelte`):
  1. Key: the `NoteSelector` (12 keys, chromatic from C) with the label "Key". It is a
     single-select radio group.
  2. Quality: a `ChoiceGroup` with the label "Quality" and the options "Major" / "Minor".
  3. **Switch to {root}**: a button shown only for altered roots (C♯/D♭, D♯/E♭, F♯/G♭, G♯/A♭,
     A♯/B♭). `{root}` is formatted by `noteLabel` (♯ ♭ glyphs).
  4. The current key heading: for example "D♭ major" (`keyName`).
- **Zone C — fretboard**:
  - *Compatible tuning*: `<Fretboard instrument model ontag=undefined onactivate pulses>`
    with the CAGED model. The tag strip is above the board (below it under lowest-on-top, per
    ADR 0016). Below the board, the `fitNote` paragraph (`role="status"`) appears only when
    k < 5.
  - *Other tuning class*: no `<Fretboard>`. A `<p role="status">` reads exactly "CAGED depends
    on the standard relationship between the strings. It isn't available in this tuning yet."
    It has no buttons and uses neutral colour tokens.
- **Zone D — secondary**: the **Reset tool** button.

These are **not** rendered (FR-019): layer toggles, label-type control, connections toggle,
focus/shape picker, Listen, links to other tools.

## §3 Fretboard drawing

| Element | Contract |
|---|---|
| Markers | Root = filled rounded square, third = filled circle, fifth = filled diamond (product code). All emphasis `normal`. |
| Labels | Interval labels "R", "3" / "♭3", "5". |
| Muted strings | No marker. |
| Open strings | Drawn in the open-string column (fret 0). |
| Shared positions | One marker, no extra emphasis. |
| 7 strings | String 7 has no marker. |
| Tags | Text "{S} shape · roots on strings {list}" (minor "{S}m shape · …"), centred over `start…end`, stacked onto a new row instead of overlapping, never focusable, no `aria-pressed`. A repeated shape (frets 0 and 12) has identical text. |
| Handedness / orientation | Mirrored and flipped by the renderer only. Same markers, tags and texts. Tag order follows the drawn direction. |
| Tap on a position | Sounds the note (existing playback). No state change. |

## §4 Text and announcements

| Item | Text (en) | Role |
|---|---|---|
| Description summary | "{key}: {count} shapes along the neck." | Part of the fretboard description (polite) |
| Description entry | "{S} shape, frets {lo} to {hi}, roots on strings {list}: {notes}" where `{notes}` = "string {s} fret {f} {interval}" joined "; " (open: "string {s} open {interval}") | Same |
| Spoken intervals | "root", "major third", "minor third", "fifth" | Same |
| Fit note | "With {frets} frets, {count} shapes fit on the fretboard" | `role="status"` |
| Tuning message | "CAGED depends on the standard relationship between the strings. It isn't available in this tuning yet." | `role="status"` |

Accidentals are read in full ("D flat major") through `spokenNote`. Shape letters are literal
text and never pass through note formatting.

## §5 Message catalog additions (`messages/en.json`)

`tool_caged_name`, `tool_caged_question`, `caged_group_key`, `caged_group_quality`,
`caged_quality_major`, `caged_quality_minor`, `caged_switch_spelling`, `caged_key_name`,
`caged_tag_major`, `caged_tag_minor`, `caged_fit_note`, `caged_tuning_unavailable`,
`caged_description_summary`, `caged_description_entry`, `caged_description_note`,
`caged_description_note_open`, `caged_interval_root`, `caged_interval_third`,
`caged_interval_flat_third`, `caged_interval_fifth`, `caged_reset`.

This is about 21 keys. `tests/unit/no-raw-text.test.ts` MUST pass over the new components.

## §6 Keyboard and screen reader

- Tab order is: key group → quality group → Switch button (when shown) → fretboard grid →
  Reset tool. Tags are not Tab stops in this slice.
- Arrow keys move within the radio groups and on the fretboard grid (existing behaviour).
- axe reports zero violations for:
  - C major (AF-1);
  - G minor on 12 frets (fit note shown);
  - Drop D (message);
  - left-handed with lowest-on-top;
  - 320 px and 2560 px widths.
- At 200 % text zoom, tags wrap into extra rows and controls wrap, with no truncation.

## §7 Session, history, reset

- Leaving and returning in the same session restores key, quality and override (FR-017).
  Triads' state is not affected.
- Key and quality changes do not change `location` or `history.length`.
- Opening `/caged` records `lastTool = 'caged'` (the existing `+layout.svelte` hook).
- **Reset tool** → C major, no override, no instrument change, playback stopped (a view
  change).
- An instrument change while open recomputes immediately and keeps key, quality and override.
  There is never an adjustment notice from CAGED.
