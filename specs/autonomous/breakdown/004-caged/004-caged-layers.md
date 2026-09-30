# 004-caged / 004 — Arpeggio, Pentatonic, and Scale Layers

**Source:** [§ Area 6 — CAGED tool: Layers](../../fretboard-master/03-functional-requirements.md#layers), [§ TM-6 CAGED: major shapes](../../fretboard-master/11-music-theory-reference.md#tm-6--caged-major-shapes), [§ TM-7 CAGED: minor shapes](../../fretboard-master/11-music-theory-reference.md#tm-7--caged-minor-shapes), [§ Edge cases, Area 3](../../fretboard-master/08-edge-cases-and-error-handling.md#area-3--fretboard), [§ Edge cases, Area 6](../../fretboard-master/08-edge-cases-and-error-handling.md#area-6--caged), [§ DM-12 Layer template](../../fretboard-master/04-data-model.md#dm-12--layer-template), [§ DM-13 CAGED shape occurrence](../../fretboard-master/04-data-model.md#dm-13--caged-shape-occurrence)

**Prerequisites:** Assumes 004-caged/003-shape-focus-and-connections.

## Prompt

> Bruna wants to link chord and melody in the same region, seeing the arpeggio, the pentatonic, and the scale inside the shape she's holding. Add layer switches to the CAGED context panel. Each has a sample marker, so the list doubles as a legend. **Chord** is the base and can't be turned off while it's the only layer on. **Arpeggio** adds every triad note (R, 3, 5, or R, ♭3, 5 in minor) in the shape's region that isn't already in the chord. **Pentatonic** adds the major pentatonic (R 2 3 5 6) for major shapes or the minor pentatonic (R ♭3 4 5 ♭7) for minor shapes. **Scale** adds the major or natural minor scale. A shape's region is the fret range of its scale pattern, with two or three notes per string and no gaps.
>
> Visual hierarchy keeps the chord readable with everything on. Chord notes get the most emphasis, arpeggio-only notes get medium, and pentatonic and scale notes outside the triad get outlined markers. When a position belongs to several layers, one marker shows the highest priority: chord > arpeggio > pentatonic > scale. With Pentatonic and Scale both on, the scale-only notes (4 and 7 in major, 2 and ♭6 in minor) get an extra mark. Label types add scale degrees. Without focus, only Chord and Arpeggio can show across the whole neck. Turning on Pentatonic or Scale without focus puts the first shape in focus. Layer notes appear from low to high. Notes past the last fret, or below the open string in an open-position shape, are simply left out. With 7 strings, the Arpeggio, Pentatonic, and Scale layers extend onto string 7 using string 2's frets.
>
> Acceptance: when a user focuses C major's E shape and turns on Scale, the region shows 7-8-10 on string 6 through 7-8-10 on string 1, with degrees. When a user shows A minor, Em shape, with Pentatonic, the familiar box at frets 5–8 appears around the chord. When Pentatonic and Scale are both on in C major, F and B carry the extra mark. When a user turns on Pentatonic with all shapes visible, the first shape takes focus.

## Scope boundary

The Triad layer is covered in 004-caged/005. No modes or other scales.
