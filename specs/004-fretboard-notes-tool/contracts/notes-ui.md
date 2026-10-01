# Contract: Notes tool UI (roles, names, messages)

**Feature**: `004-fretboard-notes-tool` | Research: R-10, R-11, R-12, R-15 | Spec: FR-002–FR-019a

This is the user-facing interface of `/notes`. Playwright and component tests address controls
only through the roles and accessible names below. English text shown; every string is a
`messages/en.json` key with the `notes_` prefix (Principle VIII). Note names come only from
`notation` (`noteLabel`, `spokenNote`, `flatSpelling`).

## Zones (design §4.2, §4.3)

`ToolLayout` renders `NotesTool` for `tool === 'notes'` (Triads keeps `ToolPlaceholder`). The five
grid areas and their layout tokens are unchanged.

| Zone | Section heading | Content |
|---|---|---|
| B | "Notes" | Note selector |
| C | "Fretboard" | Notices (region notice / empty guidance), then `<Fretboard>` |
| D | "Details" | Position card (when open), String filter, Region filter |
| E | "Actions" | Show, Label, Hide names, Listen, Clear, Reset tool |

## Zone B — Note selector (`src/lib/tools/NoteSelector.svelte`)

- `role="group"`, name "Choose notes". 12 `<button type="button" aria-pressed>` in chromatic order
  from C.
- Visible label: naturals "C"; altered "C♯ / D♭". Accessible name: "C", "C sharp or D flat".
- Naturals: solid fill; altered: outline style + two-spelling label (not color alone).
- ≥ `--target-min` (44 px) each; `< 600 px` → 2 rows × 6; otherwise 1 row × 12; never scrolls.
- Activating toggles the note (FR-003).

## Zone C — Notices

| Condition | Text | Action |
|---|---|---|
| `1 ≤ missing.length ≤ 3` | "There is no {notes} in this region" (`{notes}` = disjunction list of sharp labels, selection order) | button **Widen region** |
| `missing.length > 3` | "{count} selected notes are not in this region" (keeps the notice ≤ 2 lines) | button **Widen region** |
| `emptyGuidance` | "Pick a note or tap a fret" | none |

Both use `Notice.svelte` (`role="status"`, polite, ≤ 2 lines, dismissible). `Notice` gains an
optional `action: { label: string; onclick: () => void }` rendered as a button before Dismiss.
A dismissed notice reappears when its condition becomes false and then true again.

## Zone C — Fretboard

`<Fretboard instrument model={display.model} onactivate={notes.activate} pulses={playback.pulses}
bind:this={board} />`. All markers use the `neutral` function. Escape keydown in zones C or D
closes the card (if open).

## Zone D — Position card (`src/lib/tools/notes/PositionCard.svelte`)

`<section aria-labelledby="notes-card-title">`, no `dialog` role, no focus trap.

| Element | Content |
|---|---|
| Heading | "A" / "C♯ / D♭" (spoken: "C sharp or D flat") |
| `<dl>` | Octave: 3 · String: 3 · Fret: 2 (open: "Open") |
| "Same pitch" list `<ul>` | "String 4, fret 7" … (string ascending) — or "This pitch exists only at this position" |
| Button | **See every occurrence** → `notes.addNote(pc)` |
| Button | **Close** (name "Close position card") → `notes.closeCard()` then `board.focusPosition(card)` |

## Zone D — String filter (`src/lib/tools/notes/StringFilter.svelte`)

`role="group"`, name "Strings". One `<button aria-pressed>` per string in fretboard row order;
label "{n} {openNote}" (e.g. "1 E"), accessible name "String 1, E". When it is the only active
string: `aria-pressed="true"` + `aria-disabled="true"` + description "At least one string stays
on"; activation is a no-op.

## Zone D — Region filter (`src/lib/tools/notes/RegionFilter.svelte`)

`role="group"`, name "Frets".

- Two steppers, names "Start fret" and "End fret": `role="spinbutton"`, `aria-valuemin=0`,
  `aria-valuemax=fretCount`, `aria-valuenow`; ArrowUp/ArrowDown ±1, PageUp/PageDown ±5,
  Home/End → 0 / fretCount; − and + buttons (44 px, names "Lower start fret", "Raise start
  fret", …). Push rule enforced by the store; the other stepper's value updates visibly.
- Shortcut buttons: "0–4", "5–9", "10–14", "Whole neck" (`aria-pressed` when the region equals it).

## Zone E — Actions (`src/lib/tools/notes/NotesActions.svelte`)

| Control | Role / name | Options / behavior |
|---|---|---|
| Show | `radiogroup` "Show" | radios "Natural notes" (default), "All notes", "None" |
| Label | `radiogroup` "Label" | radios "Name" (default), "Octave", "No label" |
| Hide names | `button aria-pressed` "Hide names" | FR-011 |
| Listen | `button` "Listen" | disabled → `aria-disabled="true"`, `aria-describedby` → "Select one to three notes to listen" / "Listen plays up to three notes" / "No position of the selected notes is inside the filters" |
| Clear | `button` "Clear" | FR-013 |
| Reset tool | `button` "Reset tool" | FR-014 |

Radiogroups use roving tabindex: arrows move and select, Tab leaves the group.

## Text description (FR-019a)

Delivered through `model.description` and the fretboard's existing polite live region and "Show
description" disclosure.

| State | Example |
|---|---|
| one note | "G selected: 12 positions highlighted, strings 1 to 6, frets 0 to 22. string 6, fret 3, G2; …" |
| two notes | "C sharp and E selected: 9 positions highlighted, strings 1 to 3, frets 0 to 9. …" |
| nothing selected | "Showing natural notes, strings 1 to 6, frets 0 to 22." (+ "all notes" / "no notes") |
| card open | the summary is followed by "Position card: A3, string 3, fret 2, 3 positions with the same pitch." |

## Message keys (indicative, ≈ 45)

`notes_zone_selector`, `notes_selector_label`, `notes_selector_altered_spoken`,
`notes_notice_missing`, `notes_notice_widen`, `notes_notice_empty`, `notes_card_*` (title, octave,
string, fret, open, unisons_heading, unison_entry, no_unison, see_every, close),
`notes_strings_*`, `notes_region_*`, `notes_show_*`, `notes_label_*`, `notes_hide_names`,
`notes_listen`, `notes_listen_reason_*`, `notes_clear`, `notes_reset`, `notes_desc_*`.
