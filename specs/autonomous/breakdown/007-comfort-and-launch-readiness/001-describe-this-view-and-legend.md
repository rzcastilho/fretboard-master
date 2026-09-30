# 007-comfort-and-launch-readiness / 001 — Screen-Reader Descriptions, Legend, and Accessibility Audit

**Source:** [§ Area 3 — Interactive fretboard: Markers and labels](../../fretboard-master/03-functional-requirements.md#markers-and-labels), [§ Area 3 — Interactive fretboard: Interaction](../../fretboard-master/03-functional-requirements.md#interaction), [§ NFR-3 Accessibility](../../fretboard-master/06-non-functional-requirements.md#nfr-3--accessibility), [§ 7. Accessibility in the design](../../fretboard-master/12-design-and-experience.md#7-accessibility-in-the-design), [§ 3. Edge users](../../fretboard-master/01-personas-and-jobs.md#3-edge-users)

**Prerequisites:** Assumes all three tools (waves 001–004) and translated texts from 005-languages-and-notation.

## Prompt

> A screen-reader user, a keyboard-only user, and a color-blind user should each get the same study value as everyone else. Every view gets an equivalent text description, generated from what's on the fretboard. A **Describe this view** button shows it, and screen readers get it announced quietly whenever the view changes. For example: "A major, first inversion, strings 4, 3, and 2: string 4, fret 11, C sharp, third; string 3, fret 9, E, fifth; string 2, fret 10, A, root." Descriptions follow language and notation, read accidentals in full, and run from the nut toward the body. Each tool also gets a **Legend** that lists only the markers used in the current view: root, third, fifth, scale degree, neutral, connection ring, dashed comparison outline, "wide stretch", "altered" string.
>
> Then take the whole app to the international web-content accessibility guidelines at level AA. Every control exposes name, role, and state. Keyboard focus order is logical, always visible (a high-contrast ring on fretboard positions), and never trapped. Every function works by keyboard alone. Nothing depends on color alone: function uses shape and label, emphasis uses opacity and size, comparison uses dashed outline and arrow. The marker palette is checked against the common types of color blindness in both themes. Everything heard is also seen.
>
> Acceptance: when a screen-reader user changes the Triads inversion, the new description is announced without stealing focus. When a user tabs through the Notes tool with only a keyboard, they can select notes, set filters, move across the fretboard with arrows, and play a position, all without getting trapped. When the palette runs through a deuteranopia simulation, root, third, and fifth can still be told apart by shape and label. When a user opens the Legend in CAGED with Pentatonic on, it lists the chord, arpeggio, and outlined pentatonic markers.

## Scope boundary

This file doesn't cover theme contrast variants (007-comfort-and-launch-readiness/003).
