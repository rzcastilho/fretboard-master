# 004-caged / 006 — Hear CAGED and Link It to the Other Tools

**Source:** [§ Area 6 — CAGED tool: Sound](../../fretboard-master/03-functional-requirements.md#sound), [§ Area 7 — Audio](../../fretboard-master/03-functional-requirements.md#area-7--audio), [§ Area 1 — Structure and navigation](../../fretboard-master/03-functional-requirements.md#area-1--structure-and-navigation), [§ Area 5 — Triads tool: Shortcuts and sound](../../fretboard-master/03-functional-requirements.md#shortcuts-and-sound), [§ Area 4 — Fretboard Notes tool](../../fretboard-master/03-functional-requirements.md#area-4--fretboard-notes-tool), [§ Edge cases, Area 7](../../fretboard-master/08-edge-cases-and-error-handling.md#area-7--audio)

**Prerequisites:** Assumes 004-caged/001 through 005 and 002-triads-across-the-neck/003-linked-tools.

## Prompt

> Seeing and hearing go together, and the three tools should work as one study. Make CAGED audible, and connect it to Notes and Triads the same way those two already connect.
>
> **Listen** acts on the shape in focus and plays the widest layer that's on. Chord only: a slow strum from the lowest string to the highest, then a block. Triad: the selected triad, arpeggiated then blocked. Arpeggio: up and back down from the region's lowest note to its highest. Pentatonic or Scale: up and back down the region, starting and ending on its lowest root. With no focus, Listen plays each shape's chord in turn from nut toward body. Arpeggio and scale playback use a steady rhythm at a chosen tempo (slow, medium, or fast), stored as a preference. **Stop** is available during any sequence. A state change mid-sequence stops playback, and each note pulses on the fretboard as it sounds.
>
> Carry-over: Notes with one note selected → CAGED makes it the key and keeps CAGED's last quality. CAGED → Notes selects the chord's three notes. Triads → CAGED brings root and quality, but diminished or augmented bring only the root and CAGED opens in major. CAGED → Triads makes key and quality the root and quality. The Notes position card gains **CAGED in this key**. Triads gains **View in CAGED**, which opens CAGED with the current root and quality and the Triad layer on. It's unavailable for diminished and augmented, with the note that CAGED covers major and minor chords. Unusual carried keys like A♯ major are accepted and shown with double-accidental guidance.
>
> Acceptance: when a user focuses the E shape with only Chord on and taps Listen, the chord strums slowly low to high, then plays as a block. When Scale is on, the scale goes up and back down, starting and ending on the region's lowest root. When a user in Triads on B♭ minor taps **View in CAGED**, CAGED opens on B♭ minor with the Triad layer on. When a user in Triads on B diminished looks at **View in CAGED**, it's disabled with the explanation.

## Scope boundary

No metronome, backing tracks, or looping.
