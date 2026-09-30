# 001-mvp / 005 — Triads: One Shape, Correctly Spelled

**Source:** [§ Area 5 — Triads tool: Selection](../../fretboard-master/03-functional-requirements.md#selection), [§ Views](../../fretboard-master/03-functional-requirements.md#views), [§ Specific musical cases](../../fretboard-master/03-functional-requirements.md#specific-musical-cases), [§ Shortcuts and sound](../../fretboard-master/03-functional-requirements.md#shortcuts-and-sound), [§ TM-4 Triad spelling](../../fretboard-master/11-music-theory-reference.md#tm-4--triad-spelling), [§ TM-5 Triad shapes](../../fretboard-master/11-music-theory-reference.md#tm-5--triad-shapes), [§ Edge cases, Area 5](../../fretboard-master/08-edge-cases-and-error-handling.md#area-5--triads), [§ UJ-3 Explore a triad and its inversions](../../fretboard-master/02-user-journeys.md#uj-3--explore-a-triad-and-its-inversions), [§ NFR-9 Musical correctness](../../fretboard-master/06-non-functional-requirements.md#nfr-9--musical-correctness)

**Prerequisites:** Assumes 001-mvp/002-interactive-fretboard and 001-mvp/003-note-playback.

## Prompt

> A guitarist who plays chords from memorized shapes wants to see what a chord is made of: which three notes carry the harmony, and where the root, third, and fifth sit. The Triads tool opens on C major, root position, strings 3-2-1, Isolated view, with interval labels (R, 3, ♭3, 5, ♭5, ♯5). The user can switch to note names.
>
> Main controls: root (twelve notes), quality (major, minor, diminished, augmented), inversion (root position, 1st with the third in the bass, 2nd with the fifth in the bass), and string set (6-5-4, 5-4-3, 4-3-2, 3-2-1), each fully visible. Spelling must be correct in theory. Notes use alternate letters, with whatever accidental reaches the exact interval, including double sharps and flats (C augmented is C–E–G♯, never A♭). An altered root defaults to the spelling with fewer accidentals for that quality (A♭ major, G♯ minor, F♯ major), and a command switches spelling. Shapes are always close position (one note per string, within an octave) and are calculated from the tuning, never pre-drawn. Isolated view shows only the lowest occurrence that fits on the fretboard, with **Octave up** / **Octave down** when another occurrence fits. Shapes spanning five or more fretted frets get a "wide stretch" mark and are never hidden. Open strings are fine and don't count toward the span.
>
> A composition panel is always visible. It shows the name ("A major — 1st inversion"), the three notes in root–third–fifth order with their markers, intervals from the root, the stacking of thirds (major third + minor third, and so on), and the low-to-high order in the current inversion. For augmented, it says the triad is symmetric. For diminished, it marks ♭5 as the characteristic note. **Listen** plays the shape arpeggiated low to high, then as a block. Every root × quality spelling and every quality × inversion × set shape is checked automatically against the reference tables.
>
> Acceptance: when the tool opens, it shows frets 5-5-3 on strings 3-2-1 (C, E, G). When a user picks A, 1st inversion, set 4-3-2, it shows string 4 fret 11 C♯ (third), string 3 fret 9 E (fifth), and string 2 fret 10 A (root). When a user picks D♯ major, it shows D♯–F𝄪–A♯, adds "F𝄪 sounds as G", and suggests E♭. When a shape fits only above the last fret and no lower octave exists, it shows "This shape lies beyond fret [n]" (the **See all notes** action joins once that view exists in 002-triads-across-the-neck/001).

## Scope boundary

The Full neck and All notes views, and quality comparison, come in wave 002. The MVP runs in standard tuning only.
