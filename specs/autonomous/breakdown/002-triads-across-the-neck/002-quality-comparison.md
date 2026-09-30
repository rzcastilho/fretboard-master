# 002-triads-across-the-neck / 002 — Compare Two Qualities

**Source:** [§ Area 5 — Triads tool: Views](../../fretboard-master/03-functional-requirements.md#views), [§ Area 7 — Audio](../../fretboard-master/03-functional-requirements.md#area-7--audio), [§ Edge cases, Area 5](../../fretboard-master/08-edge-cases-and-error-handling.md#area-5--triads), [§ 3.5 Motion](../../fretboard-master/12-design-and-experience.md#35-motion), [§ 1. Principles](../../fretboard-master/12-design-and-experience.md#1-principles), [§ TM-5 Triad shapes](../../fretboard-master/11-music-theory-reference.md#tm-5--triad-shapes)

**Prerequisites:** Assumes 001-mvp/005-triads-isolated-view and 002-triads-across-the-neck/001-full-neck-and-all-notes.

## Prompt

> Guitarists memorize major and minor as two separate shapes. The lesson that frees them: quality is one altered note. Add **Compare** to the Isolated and Full neck views of the Triads tool. The user picks a second quality from a list that leaves out the current one. The system overlays the two triads with the same root, inversion, and string set. Common notes appear once. Each note that differs shows in both positions, the comparison note with a dashed outline in its function color. A short arrow joins the two positions and gives the direction and size of the move in frets. The composition panel shows both formulas side by side and emphasizes the difference. None of this relies on color alone: the dashed outline and the arrow carry the meaning.
>
> The comparison always stays in one octave. If any comparison note would fall below the open string, both triads move up an octave. If that runs past the last fret, the notes that fit are shown and the missing one gets an arrow pointing off the fretboard, with its name. Changing the root while comparing keeps the comparison and recalculates it. When a quality changes (with or without Compare), only the changing note slides. The rest stay put, because that motion is the lesson. Motion lasts up to 300 ms. **Listen to comparison** plays the first triad as a block, a short pause, then the second as a block.
>
> Acceptance: comparing major with minor moves exactly one note (the third) one fret toward the nut. Minor with diminished moves only the fifth one fret toward the nut. Major with augmented moves only the fifth one fret toward the body. When a user compares G major with G minor, 2nd inversion, set 4-3-2, the minor's B♭ would need a negative fret, so both appear an octave up: major at 12-12-12, minor at 12-12-11, with a one-fret arrow on string 2. When a user changes the root from G to A during that comparison, it recalculates for A.

## Scope boundary

Only triads of the same root, inversion, and set are compared. There's no cross-root or cross-set comparison.
