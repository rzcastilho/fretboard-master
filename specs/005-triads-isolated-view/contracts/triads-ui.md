# Contract: Triads tool UI

**Feature**: `005-triads-isolated-view` | State: [triads-state-api](./triads-state-api.md) | Design: `specs/autonomous/fretboard-master/12-design-and-experience.md`

`ToolLayout` renders `TriadsTool` for `tool === 'triads'` (replacing `ToolPlaceholder`).
Zones follow the existing tool grid tokens (`--tool-grid-areas`): A app bar (existing),
B main controls, C fretboard, D composition panel, E secondary controls.

## Components (`src/lib/tools/triads/`)

| Component | Zone | Content | Accessible pattern |
|---|---|---|---|
| `TriadsTool.svelte` | — | wires store → children; reads `__fmInstrument` on mount (test builds only) | |
| `TriadsControls.svelte` | B | Root (`NoteSelector`, label "Root", single selection), Quality, Inversion, String set (`ChoiceGroup` ×3). All visible at once, never in a menu (FR-004) | toggle buttons / `radiogroup` with roving arrow keys |
| `Fretboard` (shared) | C | `display.model`, `pulses`, `onactivate → triads.activate` | existing ARIA grid (ADR 0005) |
| `TriadsGuidance.svelte` | C (inside the board area) | beyond-fret or does-not-close text, optional **Another set** button | `role="status"` not used (description already announces); plain text + button; no error colors; not dismissible |
| `WideStretchMark.svelte` (or inline) | C caption | "Wide stretch" text + icon when `shape.wideStretch` | text, not color alone |
| `CompositionPanel.svelte` | D | name, notes with marker glyphs, intervals, stacking, low→high line, sounds-as lines, simpler-spelling suggestion button, **Switch to X** command, symmetry / ♭5 statements | `<section aria-labelledby>`; note names have spoken `aria-label`s |
| `TriadsSecondary.svelte` | E | Label type (`ChoiceGroup`: Intervals / Note names), **Octave down**, **Octave up**, **Listen** | buttons with `aria-disabled` when unavailable (stay focusable) |

Shared, generalized (R-17):

- `src/lib/tools/NoteSelector.svelte`: new optional `label?: string` prop (defaults to the
  existing Notes label).
- `src/lib/tools/ChoiceGroup.svelte`: extracted from `NotesActions.svelte`
  (`role="radiogroup"`, `role="radio"` items, arrow/Home/End roving focus); `NotesActions` uses
  it with no behavior change (existing Notes unit + e2e tests guard this).

## Text (all in `messages/en.json`; FR-030)

Keys prefixed `triads_`: control group labels; quality names; inversion names ("Root
position", "1st inversion", "2nd inversion"); name pattern `{root} {quality} — {inversion}`;
stacking phrases; low-to-high entry `{note} ({function})`; `triads_sounds_as` "{written} sounds
as {sounds}"; suggestion "Simpler spelling: {root}"; switch "Switch to {root}"; symmetry and
characteristic-note statements; "Wide stretch"; guidance `triads_beyond_fret` "This shape lies
beyond fret {fret}"; `triads_does_not_close` "This triad does not close on this string set with
the current tuning"; "Another set"; "Octave up", "Octave down", "Listen"; label type
"Intervals" / "Note names"; description summary sentences. Plus `interval_root` ("R").
Spoken variants use `spokenNote` for accidentals in full.

## Behavior table (each row → test)

| Interaction | Result |
|---|---|
| Open `/triads` | C major, root position, 3-2-1, interval labels, frets 5-5-3 (US1) |
| Pick root/quality/inversion/set | fretboard + panel update; only that choice changes (US2-4); occurrence → 0; playback stops |
| Root with two spellings | panel shows **Switch to {other}**; naturals: absent (US3-5) |
| Double accidental | sounds-as line(s); suggestion when C4 holds (US3-1, -6, -7) |
| Octave buttons at ends / single occurrence | `aria-disabled="true"`, focusable, neutral style (US4) |
| Beyond fret / does not close | empty board + guidance; Listen + octaves disabled; panel populated (US8) |
| **Another set** | selects C11 set; description announces new set |
| **Listen** | 4-step sequence, pulses even when muted (US7) |
| Keyboard | every control reachable by Tab, groups by arrow keys; visible focus; no traps |
| Width 320–2560 px, text zoom 200% | no truncation/overlap; only the fretboard scrolls horizontally |

Not present in this slice (FR-028a, Assumptions): view selector, Full neck, All notes, quality
comparison, View in CAGED, See all notes, 7-string sets.
