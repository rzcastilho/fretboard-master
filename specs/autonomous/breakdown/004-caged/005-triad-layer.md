# 004-caged / 005 — Triad Layer Inside a Shape

**Source:** [§ Area 6 — CAGED tool: Layers](../../fretboard-master/03-functional-requirements.md#layers), [§ Edge cases, Area 6](../../fretboard-master/08-edge-cases-and-error-handling.md#area-6--caged), [§ TM-5 Triad shapes](../../fretboard-master/11-music-theory-reference.md#tm-5--triad-shapes), [§ UJ-4 Travel the neck with CAGED](../../fretboard-master/02-user-journeys.md#uj-4--travel-the-neck-with-caged)

**Prerequisites:** Assumes 004-caged/004-caged-layers and the Triads tool from 001-mvp/005-triads-isolated-view.

## Prompt

> A full barre shape can hide the fact that three notes carry the harmony. The Triad layer shows which close-position triads live inside the shape the player is already holding, and connects CAGED back to the Triads tool. Add a **Triad** layer to the CAGED layer list. It requires a shape in focus, and turning it on without focus puts the first shape in focus. For each set of three adjacent strings, the system finds the close-position triad (one note per string, within an octave) whose three notes all belong to the shape's arpeggio, if there is one. With the layer on, the user picks a string set with the same small string diagram used in Triads, and that triad is highlighted inside the shape with function markers. Sets with no such triad appear unavailable in the selector with "In this shape there is no close-position triad on these strings". An **Open in Triads** shortcut opens the Triads tool on that root, quality, inversion, and set.
>
> The layer respects the tuning rules from 004-caged/002: it works in compatible and altered-string tunings, and in transposed tunings the note names follow the real pitch.
>
> Acceptance: when a user focuses C major's A shape, turns on Triad, and picks set 3-2-1, frets 5-5-3 (C, E, G, root position) are highlighted. **Open in Triads** then opens C major, root position, 3-2-1. When a user shows E major, A shape, Triad layer in Half step down, the notes are spelled from the real pitch. When a set holds no triad inside the focused shape, it's disabled with the explanation.

## Scope boundary

It doesn't show triads that cross the shape's region, or open-voiced triads.
