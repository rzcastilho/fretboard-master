# 004-caged / 003 — Shape Focus and Connections

**Source:** [§ Area 6 — CAGED tool: Shapes](../../fretboard-master/03-functional-requirements.md#shapes), [§ TM-6 CAGED: major shapes](../../fretboard-master/11-music-theory-reference.md#tm-6--caged-major-shapes), [§ TM-7 CAGED: minor shapes](../../fretboard-master/11-music-theory-reference.md#tm-7--caged-minor-shapes), [§ 3.5 Motion](../../fretboard-master/12-design-and-experience.md#35-motion), [§ Area 3 — Interactive fretboard: Interaction](../../fretboard-master/03-functional-requirements.md#interaction), [§ UJ-4 Travel the neck with CAGED](../../fretboard-master/02-user-journeys.md#uj-4--travel-the-neck-with-caged)

**Prerequisites:** Assumes 004-caged/001-caged-shapes.

## Prompt

> Seeing five shapes at once is only half the lesson. The player also needs to study one region, then step to the next without getting lost, anchored by the notes the two shapes share. Tapping a shape tag, or picking a shape in the C A G E D + all selector, puts that shape in focus. It highlights, the others dim, a softly lit band covers its frets, and the fretboard scrolls to center it (up to 500 ms, instant under reduced motion). Tapping the tag again or choosing **See all** leaves focus. With a shape in focus, **Next shape** and **Previous shape** move focus to the neighbor along the neck, and the matching command disables at the end of the fretboard. When a shape appears twice, focus goes to one occurrence at a time.
>
> **Show connections** marks chord notes that belong to two neighboring shapes with a connection ring around the marker. Even when connections are off, those shared notes stay emphasized while focus moves between neighbors. In C major the shared anchors are: C→A string 5 fret 3 (R); A→G string 4 fret 5, string 3 fret 5, string 2 fret 5 (5, R, 3); G→E string 6 fret 8 and string 1 fret 8 (R, R); E→D string 4 fret 10 (R); D→C string 3 fret 12, string 2 fret 13, string 1 fret 12. In C minor: Am→Gm keeps string 4 fret 5 and string 3 fret 5, and Gm→Em adds string 2 fret 8 (the fifth). The first time CAGED opens on a phone in portrait, a dismissible notice suggests rotating the device. It never shows again.
>
> Acceptance: when a user taps the E shape tag in C major, E is highlighted, the others dim, and the region centers. When the user then taps **Next shape**, focus moves to the D shape and string 4 fret 10 stays emphasized during the move. When connections are on with all shapes visible, the three A→G anchors carry the connection ring. When focus is on the last shape on the fretboard, **Next shape** is disabled.

## Scope boundary

Layers beyond Chord arrive in 004-caged/004 and 004-caged/005.
