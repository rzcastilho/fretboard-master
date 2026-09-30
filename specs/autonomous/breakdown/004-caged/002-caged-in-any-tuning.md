# 004-caged / 002 — CAGED Across Tunings

**Source:** [§ Area 6 — CAGED tool: Instrument](../../fretboard-master/03-functional-requirements.md#instrument), [§ Area 2 — Instrument configuration](../../fretboard-master/03-functional-requirements.md#area-2--instrument-configuration), [§ TM-8 CAGED and tunings](../../fretboard-master/11-music-theory-reference.md#tm-8--caged-and-tunings), [§ Edge cases, Area 6](../../fretboard-master/08-edge-cases-and-error-handling.md#area-6--caged), [§ Edge cases, Area 2](../../fretboard-master/08-edge-cases-and-error-handling.md#area-2--instrument)

**Prerequisites:** Assumes 004-caged/001-caged-shapes, 003-your-instrument/001-instrument-panel-and-tunings, and 003-your-instrument/003-custom-tuning.

## Prompt

> Caio tunes a half step down and sometimes to Drop D. Open-tuning players exist too. CAGED has to be honest about where the model holds and never make up shapes. The system sorts the tuning into one of three classes. **Compatible**: the six higher strings keep standard intervals (Standard, Half step down, Whole step down, and the three 7-string presets). **Compatible with an altered string**: strings 5 to 1 keep standard intervals but string 6 doesn't (Drop D, Drop C). **Non-compatible**: everything else (Double Drop D, DADGAD, the open tunings, most custom tunings).
>
> In compatible transposed tunings, shapes are drawn as in standard tuning and the notes come from the real tuning. The shape name describes the drawing, not the sound: in Half step down, the E shape at the nut sounds E♭, and the E shape at fret 3 is a G♭ chord. With an altered string, shapes are drawn normally on strings 5 to 1. String 6 doesn't show the shape's original note. It shows the active layer's notes inside the shape's region, calculated from the real tuning, and is marked "altered". In Drop D those notes sit two frets higher than in standard. If no layer note falls in the region, the string has no markers but keeps the mark. In a non-compatible tuning, no shapes are drawn. The tool explains that CAGED depends on the standard relationship between strings and offers **View in standard tuning**, which shows Standard (or 7-string standard) in this view only, with a permanent badge for the temporary tuning and no change to the stored preference, and **Go to Triads**, which works in any tuning. Switching to a non-compatible tuning while CAGED is open moves to this state, and the temporary tuning is dropped when the user leaves the tool.
>
> Acceptance: when a user in Open G opens CAGED, no shapes appear and both actions show. **View in standard tuning** shows C major's shapes with a "temporary tuning" badge while the preference stays Open G. When a user in Half step down picks the E shape at the nut, it's tagged "E shape" and sounds E♭. When a user in Drop D shows D major, E shape, string 6 is marked "altered" and its notes come from the real D tuning.

## Scope boundary

No custom CAGED model for open tunings (open question Q-5).
