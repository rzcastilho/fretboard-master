# 002-triads-across-the-neck / 001 — Full Neck and All Notes Views

**Source:** [§ Area 5 — Triads tool: Views](../../fretboard-master/03-functional-requirements.md#views), [§ Shortcuts and sound](../../fretboard-master/03-functional-requirements.md#shortcuts-and-sound), [§ TM-5 Triad shapes](../../fretboard-master/11-music-theory-reference.md#tm-5--triad-shapes), [§ Edge cases, Area 5](../../fretboard-master/08-edge-cases-and-error-handling.md#area-5--triads), [§ UJ-3 Explore a triad and its inversions](../../fretboard-master/02-user-journeys.md#uj-3--explore-a-triad-and-its-inversions)

**Prerequisites:** Assumes the Triads tool from 001-mvp/005-triads-isolated-view.

## Prompt

> An intermediate player knows a triad in one spot but can't find its inversions in real time. They want to see how the three inversions link up along one string set, so they can grab the one nearest their hand. Add two views to the Triads tool next to Isolated: **Full neck** and **All notes**, picked with a segmented control.
>
> **Full neck** shows every inversion of the current triad that fits on the chosen string set, in order along the frets, all the way up the neck. Each shape gets a tappable tag above the fretboard with its inversion name. The currently selected inversion is highlighted and the others are normal. Tapping a tag selects that inversion. The view should make visible what teachers point out: the inversions chain root position → 1st → 2nd → root position an octave up. Sets 6-5-4 and 5-4-3 share shapes, while 4-3-2 and 3-2-1 differ because of the major third between strings 3 and 2. The three augmented inversions have the same drawing, four frets apart, and their tags still name inversions relative to the chosen root. If only one or two inversions fit (a short fretboard, say), show those with no message.
>
> **All notes** shows every occurrence of the three triad notes on every string, with function markers, without outlining shapes. Inversion and string-set controls are disabled here. This view is also the target of the **See all notes** action in the "shape lies beyond fret [n]" guidance and in the "triad does not close on this string set" guidance, which also offers **Another set**.
>
> **Listen** follows the view: Full neck plays the inversions one after another from lowest to highest, each arpeggiated then blocked. All notes plays the three notes once, in the lowest available octave.
>
> Acceptance: when a user shows A major on set 3-2-1 in Full neck with 22 frets, the fretboard shows root position at 2-2-0, 1st inversion at 6-5-5, 2nd inversion at 9-10-9, and root position again at 14-14-12, each tagged. When the user taps the "2nd" tag, 2nd inversion becomes selected and highlighted. When the user switches to All notes, inversion and set controls grey out and every A, C♯, and E is marked by function.

## Scope boundary

Comparing qualities is covered in 002-triads-across-the-neck/002.
