# Contract: Plain Metronome UI (tap button, `T` key, Subdivision row, About row)

## 1. Settings view (plain mode, `phase = settings`)

The rows appear in this order:

1. BPM: a `ValueRow` with `tap`.
2. # of Beats.
3. **Subdivision**: new, a `SubdivisionSelect` with `options = [1, 2, 3, 4]`.
4. Count In.
5. Start.

- **BPM pill**: `− | <button class="tap" aria-label="{bpm} BPM, tap tempo" title="Tap tempo">{bpm}</button> | +`.
  The slider and the − and + buttons are unchanged.
- **Subdivision select**: `id="metronome-plain-subdivision"`, label "Subdivision", and options
  "Quarter notes (1)", "8th notes (2)", "8th Triplets (3)" and "16th notes (4)". The selected
  option is `plain.subdivision`.
- **Other modes**: Ratios and Speed settings views are unchanged. There is no tap button, the
  pill keeps `<output aria-live="off">`, and no new row is added.

## 2. Running and paused views (plain mode)

- **Tempo**: the `{bpm} BPM` tempo in `StatusBox` is a
  `<button class="tap" aria-label="{bpm} BPM, tap tempo" title="Tap tempo">`. Its visible
  content (digits and unit, styling) is unchanged.
- **Status line**:
  - `BEAT n/N` with Quarter;
  - `BEAT n/N · SUB k` with k ∈ {2, 3, 4};
  - `COUNT IN n/M` unchanged during a count-in.
- **Other modes**: Ratios and Speed `StatusBox` markup is unchanged.

## 3. Interaction

| Input | Effect |
|---|---|
| Pointer or touch click on a tap button | `metronome.tapTempo()` |
| Enter or Space on the focused tap button | `metronome.tapTempo()` (native `click`); Space does not toggle Start/Pause |
| `t` / `T` (Shift allowed) on the Metronome page, plain mode | `metronome.tapTempo()`, `preventDefault()` |
| `T` ignored | Shortcuts off (027), `repeat`, Ctrl/Meta/Alt/AltGraph, `isComposing`, focus in a text input, textarea, select or contenteditable, an app-bar disclosure open, Ratios or Speed mode |
| Changing Subdivision | `metronome.setPlainSubdivision(value)` |

## 4. Announcements (existing `role="status" aria-live="polite"` region)

| Event | Text (en) |
|---|---|
| A tap that changes BPM | `120 BPM` |
| Taps 1–3, or a tap with the same BPM | nothing (the region is untouched) |
| Start with Quarter | unchanged: `Started, 85 BPM, 4 beats[, count in 4]` |
| Start with Triplets | `Started, 90 BPM, 4 beats, 8th Triplets[, count in 4]` |

## 5. About page (`ShortcutList.svelte`)

The Metronome list gains a third row, `<kbd>T</kbd>` "Tap tempo (Metronome mode)", after Space
and Escape. The fretboard list and the switch are unchanged.

## 6. Accessibility and layout

- **Tap button**:
  - `min-block-size` and `min-inline-size` are `var(--target-min)` (WCAG 2.5.8);
  - it has the shared `:focus-visible` ring and an `:active` pressed state, and its contrast
    is unchanged from the current text;
  - `touch-action: manipulation`;
  - in forced colours it keeps a `ButtonText` outline on focus.
- **Accessible name**: it starts with the visible text (WCAG 2.5.3).
- **Width**: at 320 px, in en, pt-BR and es, at 1024 px and at 2560 px, there is no horizontal
  scroll. The Subdivision select fills the row width. The pill keeps `--pill-min-inline`.
- **axe**: zero violations in the settings, running and paused views of plain mode, and in
  About.
- **Tokens**: no new design token is introduced.
