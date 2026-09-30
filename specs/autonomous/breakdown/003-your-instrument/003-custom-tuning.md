# 003-your-instrument / 003 — Custom Tuning

**Source:** [§ Area 2 — Instrument configuration](../../fretboard-master/03-functional-requirements.md#area-2--instrument-configuration), [§ Edge cases, Area 2](../../fretboard-master/08-edge-cases-and-error-handling.md#area-2--instrument), [§ Edge cases, Area 5](../../fretboard-master/08-edge-cases-and-error-handling.md#area-5--triads), [§ 2. Assumptions](../../fretboard-master/09-assumptions-and-open-questions.md#2-assumptions), [§ UJ-5 Configure the instrument](../../fretboard-master/02-user-journeys.md#uj-5--configure-the-instrument)

**Prerequisites:** Assumes 003-your-instrument/001-instrument-panel-and-tunings and 003-your-instrument/002-remembered-preferences.

## Prompt

> Some players use tunings no preset covers. They need to set each string themselves and still get correct notes, shapes, and sounds everywhere. Add a "Custom" choice to the instrument panel. Each string moves up or down one semitone at a time, from 7 semitones below to 4 above its standard pitch. String 6 (E2) can go from A1 to G♯2, and string 1 (E4) from A3 to G♯4. For each string, the panel shows the resulting note and octave and can play it. At a limit, that direction's control disables with no error message. When a custom tuning matches a preset, the panel shows the preset's name. Custom tunings are stored like any other preference. Their string names follow the user's accidental preference, since no preset spelling applies. Until 005-languages-and-notation/002 adds that choice, they use sharps.
>
> Unusual set-ups are allowed, not blocked. Two strings can share a pitch. A string can sit lower than its lower-numbered neighbor, and the panel then notes "The strings are not in order from low to high". The tools keep working. When a Triads string set can't hold a close-position shape (unison strings, inverted order, or an interval that needs negative frets in every octave), Triads shows an empty fretboard with "This triad does not close on this string set with the current tuning" and the actions **Another set** and **See all notes**.
>
> Acceptance: when a user lowers string 6 by two semitones from standard, the panel shows D2 and names the tuning "Drop D". When a user lowers string 1 by 7 semitones, the down control for that string disables. When a user tunes string 3 to the same pitch as string 2, the tuning is accepted and Triads on set 3-2-1 shows the "does not close" guidance with both actions. When a user taps any adjusted string in the panel, its new pitch plays.

## Scope boundary

Custom tunings for the 7th string follow the same rules once 003-your-instrument/004 exists. There's no capo support (open question Q-6).
