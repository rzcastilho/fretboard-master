# Contract: Instrument Panel and Fretboard Surfaces — Handedness & Orientation (UI)

**Feature**: `013-left-handed-and-orientation` | Extends
[012 instrument-panel-ui.md](../../012-seven-strings/contracts/instrument-panel-ui.md) (and
through it 009/011). Everything not listed here (dialog, dismissal, focus return, Strings and
Tuning groups, Custom rows, fret stepper, actions) is unchanged. Tests select by **role and
accessible name** (English catalog).

## 1. Panel structure (tab order)

```text
dialog "Instrument"
  fieldset "Strings"                    (012)
  fieldset "Tuning"                     (009/011)
  [Custom open] group "Custom tuning"   (011)
  fret stepper                          (009)
  fieldset "Handedness"                 NEW
    radio "Right-handed"   (checked by default)
    radio "Left-handed"
  fieldset "Strings on top"             NEW
    radio "Highest string on top"   (checked by default)
    radio "Lowest string on top"
  preview fretboard                     follows PENDING handedness + orientation
  Restore default · Confirm · Close
```

## 2. Controls and messages (new catalog keys, `messages/en.json`)

| Key | English |
|---|---|
| `instrument_handedness_legend` | Handedness |
| `instrument_handedness_right_option` | Right-handed |
| `instrument_handedness_left_option` | Left-handed |
| `instrument_orientation_legend` | Strings on top |
| `instrument_orientation_highest` | Highest string on top |
| `instrument_orientation_lowest` | Lowest string on top |
| `instrument_handedness_right` | right-handed *(summary segment)* |
| `instrument_handedness_left` | left-handed *(summary segment)* |

Changed: `instrument_summary_standard` → `{count} strings · standard tuning · {handedness}`;
`instrument_summary_preset` → `{count} strings · {name} · {handedness}`.

| Control | Behavior |
|---|---|
| Handedness radios | native radios, arrow keys move/select; change **pending** only (`instrument.setHandedness`) |
| Orientation radios | same, `instrument.setOrientation` |
| Restore default | pending ← right-handed, highest on top, plus 6 strings / standard / 22 frets |
| Close / Escape / Back / backdrop | pending discarded; active handedness/orientation unchanged (EC-2.7) |
| Confirm | applies both together with the other fields; no intermediate frame |

Targets ≥ 44 × 44 CSS px; labels wrap (no truncation) at 320 px and 200 % text zoom.

## 3. Interactive fretboard (`Fretboard.svelte`, variant `interactive`)

| Element | Right-handed | Left-handed |
|---|---|---|
| String-label column (`N note`) | leftmost | rightmost |
| Open-string column | right of labels | left of labels |
| Nut | between open column and fret 1 | same, mirrored |
| Fret numbers | increase → | increase ← |
| Inlays, region band, tags, arrows, focus ring, hover hint | at fret x from layout | mirrored by layout |
| Tag running order (Triads Full neck A major 3-2-1) | root → 1st → 2nd left to right | right to left |
| ArrowRight / ArrowLeft | fret +1 / −1 | fret −1 / +1 |
| Unscrolled start (board wider than viewport) | `scrollLeft = 0` | `scrollLeft = max` (nut visible) |

| Element | Highest on top | Lowest on top |
|---|---|---|
| Row order top → bottom | 1 … n | n … 1 |
| ArrowUp / ArrowDown | string drawn above / below | string drawn above / below |
| Tag strip | above board (before `<svg>` in DOM) | below board (after `<svg>`) |
| Fret-number row | below board | above board |

Invariant in all four: label text, `aria-label` of every cell, the text description and live
announcements are **identical**; cells within a grid row are in fret order (nut → body); no
announcement uses "left"/"right". Every cell reports `{string, fret}` (FR-008).

Test hooks (existing, unchanged): `.cell[data-string][data-fret]`, `.fret-number`,
`.string-label`, `.nut`, `.tag`, `.arrow[data-id]`, `.region-band`. E2E asserts geometry with
`boundingBox()` comparisons (e.g. `.nut` x > fret 1 cell x when left-handed).

## 4. Other surfaces

| Surface | Rule |
|---|---|
| Home summary button | ends with `right-handed` / `left-handed` (confirmed); orientation not shown |
| Tool-card thumbnails | follow **confirmed** handedness and orientation |
| Panel preview | follows **pending** handedness and orientation |
| Adjustment notice | never raised by a handedness/orientation-only confirm |
| Sound | presentation-only confirm does not stop playback |
