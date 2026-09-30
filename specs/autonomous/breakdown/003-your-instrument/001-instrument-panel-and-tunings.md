# 003-your-instrument / 001 — Instrument Panel and Preset Tunings

**Source:** [§ Area 2 — Instrument configuration](../../fretboard-master/03-functional-requirements.md#area-2--instrument-configuration), [§ TM-2 Tunings](../../fretboard-master/11-music-theory-reference.md#tm-2--tunings), [§ UJ-5 Configure the instrument](../../fretboard-master/02-user-journeys.md#uj-5--configure-the-instrument), [§ Edge cases, Area 2](../../fretboard-master/08-edge-cases-and-error-handling.md#area-2--instrument), [§ ARCH-3 Instrument model](../../fretboard-master/07-architecture-overview.md#arch-3--instrument-model), [§ UJ-1 First visit and choice of study](../../fretboard-master/02-user-journeys.md#uj-1--first-visit-and-choice-of-study)

**Prerequisites:** Assumes the whole of 001-mvp. Triads views from 002-triads-across-the-neck are recalculated too.

## Prompt

> A guitarist who tunes down or plays in Drop D shouldn't have to translate diagrams in their head. Every view should match what's under their fingers. Add an instrument panel, reachable from the home screen's instrument summary ("6 strings · standard tuning · right-handed") and from every tool's application bar. It opens as a bottom sheet on narrow screens and a side panel on wide ones.
>
> The panel sets tuning and fret count (12–24, default 22). It lists 6-string presets by name with each string's note from low to high: Standard (E A D G B E), Half step down (E♭ A♭ D♭ G♭ B♭ E♭), Whole step down (D G C F A D), Drop D (D A D G B E), Drop C (C G C F A D), Double Drop D (D A D G B D), DADGAD, Open G (D G D G B D), Open D (D A D F♯ A D), Open E (E B E G♯ B E), and Open A (E A E A C♯ E). Exact octaves follow the tuning reference, for example Drop D is D2 A2 D3 G3 B3 E4. Preset string names keep their own spelling (flats in Half step down, F♯ in Open D). Picking a tuning shows a preview fretboard. **Confirm** applies the configuration to every tool, recalculates the current view without a reload (within 300 ms), and updates the home thumbnails. Closing without confirming discards changes. **Restore default** returns to 6 strings, Standard, 22 frets. Whenever the tuning isn't Standard, every tool shows a badge with the tuning name, and the badge opens the panel. Notes, triad shapes, and sounds all follow the real tuning.
>
> If a change makes the current view impossible (for example, a region filter past the new last fret), the system moves to the nearest equivalent (clipped region, same shape in another octave) and says "We adjusted the view to the new instrument". If the fretboard is scrolled past a reduced last fret, it scrolls back to the last fret.
>
> Acceptance: when a user picks Drop D and confirms, string 6 shows and plays D2 and a "Drop D" badge appears. Triads C major root position on 6-5-4 becomes 10-7-5 with "wide stretch", where standard is 8-7-5. When a user sets Notes to region 10–14 and cuts frets to 12, the region clips to 10–12 with the adjustment notice. When a user changes the tuning and closes the panel without confirming, the previous tuning remains.

## Scope boundary

No custom tuning (003), 7 strings (004), handedness or orientation (005), or storage between visits (002).
