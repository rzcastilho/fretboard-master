# 001-mvp / 002 — The Interactive Fretboard

**Source:** [§ Area 3 — Interactive fretboard](../../fretboard-master/03-functional-requirements.md#area-3--interactive-fretboard), [§ Edge cases, Area 3](../../fretboard-master/08-edge-cases-and-error-handling.md#area-3--fretboard), [§ 3.3 Markers](../../fretboard-master/12-design-and-experience.md#33-markers), [§ 6. The fretboard in detail](../../fretboard-master/12-design-and-experience.md#6-the-fretboard-in-detail), [§ TM-1 Notes, pitches, and octaves](../../fretboard-master/11-music-theory-reference.md#tm-1--notes-pitches-and-octaves), [§ TM-3 Notes on the fretboard](../../fretboard-master/11-music-theory-reference.md#tm-3--notes-on-the-fretboard), [§ ARCH-5 Interactive fretboard](../../fretboard-master/07-architecture-overview.md#arch-5--interactive-fretboard)

**Prerequisites:** Assumes the app shell and tool screens from 001-mvp/001-walking-skeleton.

## Prompt

> Guitarists need a fretboard on screen that looks and behaves like their instrument, so every later study tool has something accurate to draw on and touch. Build the fretboard that all tools share. For now it assumes a 6-string guitar in standard tuning (E2 A2 D3 G3 B3 E4), 22 frets, right-handed, with the highest string on top as in tablature.
>
> The fretboard draws the strings (lower ones thicker), the frets, a thick light nut, and inlays at frets 3, 5, 7, 9, 15, 17, 19, and 21, with double inlays at 12 and 24. Fret numbers run along the edge. Each string shows its number and open-string note next to the nut. The open string (fret 0) sits in its own column before the nut and behaves like any other position. Each position's pitch is the open-string pitch plus the fret in semitones, with octaves numbered by sounding pitch (middle C4 is string 2, fret 1). Positions carry markers whose shape encodes function, never color alone: root is a filled rounded square (largest), third a filled circle, fifth a filled diamond, other scale degrees a small outlined circle, neutral notes a light filled circle. Every position has an emphasis level: highlighted, normal, dimmed (reduced opacity, no label, still visible), or hidden (not drawn, still tappable). Labels can show the note name or nothing. The same fretboard also draws the thumbnails on the home cards.
>
> Tapping or clicking any position, including hidden ones, puts it in focus and reports it to the tool in musical terms (string, fret). A tap between two positions picks the nearest one. A drag that starts on a marker counts as a scroll once it passes a small threshold. When the fretboard is wider than the screen, it scrolls horizontally by dragging, and a vertical drag still scrolls the page. It also auto-scrolls to bring highlighted positions into view. Arrow keys move focus between neighboring frets and strings, an action key activates the position, and focus is always visible. Hovering with a mouse shows the note name. Touch targets are at least 44×44 logical units at comfortable size. On a 320-wide phone in portrait, 5–7 frets are visible at a time.
>
> Acceptance: when the fretboard is drawn, string 2 fret 1 is C4 and string 6 open is E2. When a user on a 320-wide screen drags horizontally, only the fretboard scrolls. When focus is on string 3, fret 5 and the user presses the key for the next fret, focus moves to string 3, fret 6.

## Scope boundary

No sound (001-mvp/003), no minimap or fit-to-screen (007-comfort-and-launch-readiness/002), and no alternate tunings or left-handed mode (wave 003).
