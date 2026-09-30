# 001-mvp / 004 — Fretboard Notes Tool

**Source:** [§ Area 4 — Fretboard Notes tool](../../fretboard-master/03-functional-requirements.md#area-4--fretboard-notes-tool), [§ Edge cases, Area 4](../../fretboard-master/08-edge-cases-and-error-handling.md#area-4--fretboard-notes), [§ UJ-2 Locate a note on the fretboard](../../fretboard-master/02-user-journeys.md#uj-2--locate-a-note-on-the-fretboard), [§ 4.3 Controls per tool](../../fretboard-master/12-design-and-experience.md#43-controls-per-tool), [§ TM-9 Sample for teacher review](../../fretboard-master/11-music-theory-reference.md#tm-9--sample-for-teacher-review)

**Prerequisites:** Assumes 001-mvp/002-interactive-fretboard and 001-mvp/003-note-playback.

## Prompt

> Beginners count fret by fret to find a note. Fretboard Notes answers "where is every note?" at a glance. It opens in its simplest state: no note selected, name labels, natural notes shown normally, altered notes hidden, and no filters.
>
> A note selector lists the twelve notes in chromatic order from C, in two rows of six on narrow screens. Naturals and altered notes look different, and each altered note shows both spellings (F♯ / G♭). Selecting 1–12 notes highlights every occurrence and dims the rest. Tapping a selected note again removes it. With exactly one note selected, occurrences in the same octave share a highlight tone and show a small octave number. With more notes, that's off unless the user picks the Octave label type. Label types: Name, Octave, No label. The **Show** control switches the background between naturals only (default), all notes, and none. Selected notes always show. A string filter turns strings on and off, and the last active string can't be turned off. A region filter sets start and end frets, with shortcuts for 0–4, 5–9, 10–14, and whole neck. The two limits push each other rather than cross. Positions outside the filters are dimmed and unlabeled.
>
> Tapping a position plays it and opens a position card: the name (both spellings if altered), octave, string, fret, a list of other positions with the same pitch (emphasized while the card is open), and **See every occurrence**. **Hide names** removes every label and the hover hint, so names appear only on the card. It's for informal self-testing and records nothing. **Listen** plays the highlighted occurrences inside the filters in rising pitch, lighting each one, when 1–3 notes are selected. **Clear** removes the selection and filters but keeps the label type and background. **Reset tool** returns to the initial state. Altered notes use sharps for now, with both spellings on the card.
>
> Acceptance: when a user selects G, every G on all six strings is highlighted with octave tones. When a user taps string 3, fret 2 (A3), the card lists string 4 fret 7, string 5 fret 12, and string 6 fret 17 as unisons. When C♯ is selected with only string 1 active and the region set to 0–4, the tool shows "There is no C♯ in this region" with **Widen region**. When the background is "none" and nothing is selected, it shows "Pick a note or tap a fret".

## Scope boundary

The shortcuts to Triads and CAGED, and "View as triad", come with 002-triads-across-the-neck/003 and 004-caged/006. The accidental preference comes with 005-languages-and-notation/002.
