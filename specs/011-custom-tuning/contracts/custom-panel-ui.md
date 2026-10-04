# Contract: Instrument Panel — Custom Choice (UI)

**Feature**: `011-custom-tuning` | Extends
[009 instrument-panel-ui.md](../../009-instrument-panel-and-tunings/contracts/instrument-panel-ui.md).
Everything not listed here (dialog, Escape/Back/backdrop close, focus return, fret stepper,
preview, action buttons) is unchanged.

## Structure (inside the tuning `<fieldset>` / right after it)

```text
fieldset "Tuning"
  radio  AF-1 … AF-11                     (unchanged)
  radio  "Custom"                          value="custom", last entry (FR-001)
[when Custom selected]
  group  aria-labelledby="Custom tuning"   six rows, string 6 first … string 1 last
    row n: [button Lower string n] [button String n, <note>] [button Raise string n]
  status (role="status", aria-live="polite")
    line: "<preset name>" | "Custom"        tuning-name line (FR-007)
    line: "The strings are not in order from low to high"   only while inverted (FR-011)
fret stepper, preview (pending pitches, FR-021), actions (Restore default · Confirm · Close)
```

## Controls

| Control | Visible text | Accessible name (catalog) | Behaviour |
|---|---|---|---|
| Custom radio | `Custom` | `instrument_custom_label` → "Custom: set each string" | `instrument.chooseCustom()`; rows appear starting from the pending pitches |
| Lower button | `−` glyph (aria-hidden) | `instrument_string_lower` → "Lower string {string}" | `stepString(n, -1)`; if changed → `playString(n)`. `disabled` at −7 |
| Note button | pitch label, e.g. `D2`, `F♯2` (`pitchLabel`) | `instrument_string_note` → "String {string}, {note} {octave}" with `spokenNote` ("A sharp 3") | `playString(n)`; no state change |
| Raise button | `+` glyph (aria-hidden) | `instrument_string_raise` → "Raise string {string}" | `stepString(n, +1)`; if changed → `playString(n)`. `disabled` at +4 |
| Preset radio | unchanged | unchanged | also hides rows (`customOpen = false`) |
| Restore default | unchanged | unchanged | Standard selected, rows hidden, frets 22 |

Rules:

- **Limits (FR-005)**: native `disabled`; no error text, no error color. Clicking a disabled
  button does nothing and plays nothing.
- **Focus (FR-023)**: if a focused lower/raise button becomes disabled, focus moves to the
  same row's note button after the DOM update.
- **Sound (FR-004)**: plays through `playback.note` with the pending instrument; mute, volume
  and unlock rules unchanged; panel fully usable with sound unavailable.
- **Spelling (FR-007, FR-009)**: row labels come from `tuningStrings(pending.tuning)` — preset
  spelling when matched (Half step down → E♭2 A♭2 D♭3 G♭3 B♭3 E♭4), sharps otherwise.
- **Order note (FR-011)**: muted text colour token, never `--color-error*`; Confirm stays
  enabled.
- **Opening (spec clarification)**: active tuning custom → Custom radio checked and rows shown
  with the confirmed values; active tuning preset → that preset checked, rows hidden. The
  initially focused element stays the checked radio.
- **Targets and layout (FR-019, SC-008)**: every button ≥ `--target-min` (44 px) both ways;
  visible focus ring from global styles; rows wrap without overlap at 320 px and 200 % zoom;
  only the preview fretboard may scroll horizontally. Tokens only (Constitution VII).

## Badge and home summary

| Active tuning | Badge | Summary |
|---|---|---|
| Standard | hidden | "6 strings · standard tuning · right-handed" |
| Preset (incl. matched custom) | preset name | "6 strings · {preset name} · right-handed" |
| Unmatched custom | "Custom" | "6 strings · Custom · right-handed" |

## New catalog messages (`messages/en.json`)

| Key | English |
|---|---|
| `tuning_custom` | Custom |
| `instrument_custom_label` | Custom: set each string |
| `instrument_custom_strings` | Custom tuning |
| `instrument_string_lower` | Lower string {string} |
| `instrument_string_raise` | Raise string {string} |
| `instrument_string_note` | String {string}, {note} {octave} |
| `instrument_tuning_order` | The strings are not in order from low to high |

Existing `triads_does_not_close`, `triads_another_set`, `triads_see_all_notes` are reused
unchanged.

## Test hooks

Stable selectors for Vitest/Playwright: role + accessible name (no new `data-testid`), e.g.
`getByRole('button', { name: 'Lower string 6' })`, `getByRole('radio', { name: /Custom/ })`,
`getByRole('status')` within the dialog.
