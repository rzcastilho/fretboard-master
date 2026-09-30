# 003-your-instrument / 005 — Left-Handed Mode and String Orientation

**Source:** [§ Area 2 — Instrument configuration](../../fretboard-master/03-functional-requirements.md#area-2--instrument-configuration), [§ 6. The fretboard in detail](../../fretboard-master/12-design-and-experience.md#6-the-fretboard-in-detail), [§ ARCH-5 Interactive fretboard](../../fretboard-master/07-architecture-overview.md#arch-5--interactive-fretboard), [§ 5. Structural decisions and rationale](../../fretboard-master/07-architecture-overview.md#5-structural-decisions-and-rationale), [§ TM-9 Sample for teacher review](../../fretboard-master/11-music-theory-reference.md#tm-9--sample-for-teacher-review)

**Prerequisites:** Assumes 003-your-instrument/001-instrument-panel-and-tunings and 003-your-instrument/002-remembered-preferences.

## Prompt

> Left-handed players are usually handed right-handed diagrams and left to mirror them in their heads. Give them a fretboard that faces the way their instrument does. Add handedness (right, the default, or left) and string orientation (highest string on top, the default as in tablature, or lowest string on top, as a player sees the neck looking down) to the instrument panel. The two settings are independent, and both are stored as preferences.
>
> In left-handed mode, the whole fretboard mirrors horizontally: the nut moves to the right and frets count up toward the left. Everything with a direction follows: fret numbers, the open-string column, shape and inversion tags, comparison arrows, the region-focus band, "next" and "previous" gestures, and the screen-reader reading order, which always runs from the nut toward the body. Fret numbers always sit on the edge opposite the tags, whatever the orientation. Handedness and orientation change only how things are drawn, never the musical content: a string is still string 3 and a fret is still fret 5, so theory, sound, and stored or shared state don't depend on them. Every screen size supports both settings.
>
> Acceptance: when a left-handed user opens Triads on A major, set 3-2-1, Full neck, the nut sits on the right, the inversion tags run right to left in the order root → 1st → 2nd, and comparison arrows point the mirrored way. When a user sets lowest string on top, string 6 draws at the top, and tapping it still plays E2 in standard tuning. When a left-handed user tabs through positions with a screen reader, they're read from the nut toward the body. When a left-handed user comes back the next day, the fretboard is still mirrored.

## Scope boundary

The minimap mirroring comes with 007-comfort-and-launch-readiness/002. Handedness is deliberately left out of shared links (006-sharing).
