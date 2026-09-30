# 007-comfort-and-launch-readiness / 002 — Minimap, Fit to Screen, and Landscape

**Source:** [§ Area 3 — Interactive fretboard: Interaction](../../fretboard-master/03-functional-requirements.md#interaction), [§ 5. Responsiveness](../../fretboard-master/12-design-and-experience.md#5-responsiveness), [§ Edge cases, Area 3](../../fretboard-master/08-edge-cases-and-error-handling.md#area-3--fretboard), [§ Edge cases, Area 1](../../fretboard-master/08-edge-cases-and-error-handling.md#area-1--structure-and-navigation), [§ NFR-2 Compatibility and responsiveness](../../fretboard-master/06-non-functional-requirements.md#nfr-2--compatibility-and-responsiveness), [§ 4.2 Tool screen](../../fretboard-master/12-design-and-experience.md#42-tool-screen)

**Prerequisites:** Assumes the fretboard from 001-mvp/002 and the CAGED tool from 004-caged/001.

## Prompt

> Phone and desktop have equal priority. A player with a phone propped on a music stand needs to know where they are on a 24-fret neck and to use the whole screen when they rotate it. Add a minimap under the fretboard whenever the fretboard doesn't fit on screen. It shows the whole neck in miniature, the visible stretch as a window, and highlighted positions as dots. Tapping a point jumps there. Add **Fit to screen**, which toggles between the whole fretboard visible (narrower frets) and comfortable fret size with scrolling. It's hidden on screens where the whole neck already fits comfortably (from about 1280 logical width on desktop). A pinch on the fretboard toggles the same two modes. There's no free zoom. In the whole-fretboard mode on a narrow screen, where frets fall under 44×44, a tap picks the nearest position and the app offers comfortable mode. With 7 strings and 24 frets on a 320-wide screen, comfortable mode is the default and the minimap is always visible. In left-handed mode, the minimap mirrors too.
>
> Finish the responsive layouts. Narrow (320–599) is one column: bar, controls, fretboard, actions, context panel. Main controls fit in two rows, with overflow in a scrollable strip, and the context panel collapses to a one-line summary ("A major · 1st inversion · C♯ – E – A"). Medium (600–1023) puts the fretboard at full width with the panels side by side below it. Wide (1024+) puts the fretboard in a left column and the context panel on the right. Main controls are never behind a menu. On a phone in landscape, the fretboard fills the width and nearly the full height, the bar shrinks to icons, controls become a thin strip, and the context panel and actions move to a sliding panel. Resizing or rotating never loses state and keeps the highlighted region visible. Everything stays usable at 200% text size.
>
> Acceptance: when a 7-string, 24-fret fretboard shows on a 320-wide phone, comfortable mode and the minimap are on, and tapping the minimap's far end scrolls to fret 24. When a user pinches, the view switches to the whole fretboard. When a user rotates a phone to landscape in CAGED with a shape in focus, the fretboard fills the width, the focus stays, and the panels move into the sliding panel. On a 1440-wide desktop, **Fit to screen** doesn't appear.

## Scope boundary

No free-form zoom or custom layouts.
