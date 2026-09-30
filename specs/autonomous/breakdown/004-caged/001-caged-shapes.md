# 004-caged / 001 — The Five CAGED Shapes Along the Neck

**Source:** [§ Area 6 — CAGED tool: Shapes](../../fretboard-master/03-functional-requirements.md#shapes), [§ TM-6 CAGED: major shapes](../../fretboard-master/11-music-theory-reference.md#tm-6--caged-major-shapes), [§ TM-7 CAGED: minor shapes](../../fretboard-master/11-music-theory-reference.md#tm-7--caged-minor-shapes), [§ Edge cases, Area 6](../../fretboard-master/08-edge-cases-and-error-handling.md#area-6--caged), [§ UJ-4 Travel the neck with CAGED](../../fretboard-master/02-user-journeys.md#uj-4--travel-the-neck-with-caged), [§ DM-11 CAGED shape](../../fretboard-master/04-data-model.md#dm-11--caged-shape), [§ Area 1 — Structure and navigation](../../fretboard-master/03-functional-requirements.md#area-1--structure-and-navigation)

**Prerequisites:** Assumes the whole of 001-mvp and 003-your-instrument (instrument panel, 7 strings, handedness).

## Prompt

> An intermediate player stuck in one or two positions needs to see the same chord in five linked shapes across the whole neck. Add the third tool, **CAGED**, with its own home card ("How does the whole neck connect?") and a place in the tool navigation. It opens on C major, all shapes visible, Chord layer, interval labels, connections off.
>
> The user picks a key (twelve notes, with altered roots spelled like in Triads, e.g. D♭ major, F♯ major) and a quality (major or minor). The system draws the chord shapes C, A, G, E, and D. For C major in standard tuning they are C x-3-2-0-1-0, A x-3-5-5-5-3, G 8-7-5-5-5-8, E 8-10-10-9-8-8, and D x-x-10-12-13-12. For minor: Cm x-3-1-0-1-x, Am x-3-5-5-4-3, Gm 8-6-5-5-8-8, Em 8-10-10-8-8-8, Dm x-x-10-12-13-11. Other keys shift every fret by the distance from C. Shapes always run in the cycle C → A → G → E → D toward the body, starting with the shape that fits nearest the nut, and repeat 12 frets higher while frets remain. A shape is drawn only if every chord note fits. Each shape has a tag above its region ("E shape", "Em shape") naming the strings that hold its roots, and roots use the root marker. Shape names always use the letters C A G E D, since they name drawings, not notes. With 7 strings, chord shapes sit on the six higher strings. If a shape appears twice (frets 0 and 12), both get the same tag. On a short fretboard, a note says "With [n] frets, [k] shapes fit on the fretboard". The ten shapes with every layer in C major and C minor are checked automatically against reference tables. This slice assumes a tuning that keeps the standard string intervals. Other tunings come in 004-caged/002.
>
> Acceptance: when the tool opens, the shapes are C (from fret 0), A (3), G (5), E (8), D (10). When a user picks G major, the order becomes G (0), E (3), D (5), C (7), A (10). When a user switches to minor, the five minor shapes of G appear in the same order. When a user sets 12 frets, only the shapes that fully fit are drawn, with the "[k] shapes fit" note.

## Scope boundary

No focus, connections, extra layers, sound, or links to other tools. Those come in 004-caged/003 through 006.

## Open questions

- Q-13: should the Cm and Gm shapes get the same emphasis as the other three minor shapes, given some teachers teach them only as scale regions?
- Q-10: does the name "CAGED" need explaining on the home card for beginners?
