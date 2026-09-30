# 003-your-instrument / 004 — Seven-String Guitars

**Source:** [§ Area 2 — Instrument configuration](../../fretboard-master/03-functional-requirements.md#area-2--instrument-configuration), [§ Area 5 — Triads tool: Selection](../../fretboard-master/03-functional-requirements.md#selection), [§ TM-2 Tunings](../../fretboard-master/11-music-theory-reference.md#tm-2--tunings), [§ TM-5 Triad shapes](../../fretboard-master/11-music-theory-reference.md#tm-5--triad-shapes), [§ 6. The fretboard in detail](../../fretboard-master/12-design-and-experience.md#6-the-fretboard-in-detail), [§ Edge cases, Area 2](../../fretboard-master/08-edge-cases-and-error-handling.md#area-2--instrument)

**Prerequisites:** Assumes 003-your-instrument/001 through 003. The Triads views from 002-triads-across-the-neck gain the new set.

## Prompt

> A 7-string player needs the extra low string on screen and in every calculation. Otherwise they end up mirroring 6-string diagrams in their head. Add a string-count choice to the instrument panel: 6 (default) or 7. Going from 6 to 7 adds a seventh string a perfect fourth below the sixth and leaves the other six alone. Going back removes it. With 7 strings, the preset list adds 7-string standard (B1 E2 A2 D3 G3 B3 E4), 7-string half step down (B♭1 E♭2 A♭2 D♭3 G♭3 B♭3 E♭4), and Drop A (A1 E2 A2 D3 G3 B3 E4). All 6-string presets stay available, with the seventh string a fourth below the sixth unless adjusted, and custom tuning covers the seventh string too. The tuning badge stays hidden for 7-string standard.
>
> The fretboard draws the seventh string visibly thicker, with enough height that markers on neighboring strings never touch. Fretboard Notes covers all seven strings, including filters and unisons. Triads adds the string set 7-6-5 to its set selector, with shapes calculated from the real tuning. Scrolling and dragging stay smooth on the reference phone even with 7 strings and 24 frets. If switching back to 6 strings leaves the view on 7-6-5, Triads moves to 6-5-4 and says "We adjusted the view to the new instrument".
>
> Acceptance: when a user switches to 7 strings in standard, the new string is B1 and plays B1 at fret 0. In 7-string standard, C major root position on set 7-6-5 is frets 13-12-10, and E minor root position on 7-6-5 is 5-3-2. When a user on set 7-6-5 switches back to 6 strings, the set becomes 6-5-4 with the adjustment notice. When a user picks Drop A, string 7 shows and plays A1.

## Scope boundary

How CAGED uses the seventh string is covered in 004-caged/001 and 004-caged/004. Eight-string guitars are out (open question Q-9).
