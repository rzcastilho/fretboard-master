# 007-comfort-and-launch-readiness / 003 — Themes, Motion, and Print

**Source:** [§ Area 1 — Structure and navigation](../../fretboard-master/03-functional-requirements.md#area-1--structure-and-navigation), [§ 3. Visual language](../../fretboard-master/12-design-and-experience.md#3-visual-language), [§ 3.1 Character](../../fretboard-master/12-design-and-experience.md#31-character), [§ 3.2 Color roles](../../fretboard-master/12-design-and-experience.md#32-color-roles), [§ 3.5 Motion](../../fretboard-master/12-design-and-experience.md#35-motion), [§ NFR-3 Accessibility](../../fretboard-master/06-non-functional-requirements.md#nfr-3--accessibility), [§ NFR-2 Compatibility and responsiveness](../../fretboard-master/06-non-functional-requirements.md#nfr-2--compatibility-and-responsiveness), [§ INT-6 Device preferences](../../fretboard-master/05-integrations.md#int-6--device-preferences), [§ 8. What the design avoids](../../fretboard-master/12-design-and-experience.md#8-what-the-design-avoids)

**Prerequisites:** Assumes the fretboard and tools from waves 001–004 and preferences from 003-your-instrument/002.

## Prompt

> Students practice at night, teachers project onto classroom screens, and some users are sensitive to motion. The app should look right and feel calm in each case. Add a light theme and a dark theme. The default follows the device, and the user can pin either one from the menu, which is stored as a preference. In both themes the fretboard keeps a warm, dark tone (wood and metal suggested, never photorealistic), so markers have the same contrast either way. Surfaces are neutral and the markers are the liveliest thing on screen. Root, third, and fifth colors are exclusive to those roles and never reused for buttons or notices. Notices are discreet and never error red for normal situations. Text and essential graphics (markers, strings, frets, labels) meet AA contrast in both themes, and dimmed markers stay visible. When the device asks for more contrast, a higher-contrast variant applies.
>
> Finish the motion system. A root or key change slides markers to their new frets (up to 300 ms). An inversion or set change cross-fades shapes. CAGED focus scrolls and dims (up to 500 ms). A layer's notes appear from low to high. A sounding marker pulses once. When the device asks for reduced motion, every transition becomes instant (or a brief fade), and the playback pulse becomes a plain state change, kept because it carries information.
>
> Add print support. Printing or capturing a view gives a legible result on a light background, with marker shapes and labels kept, so a teacher can hand out material.
>
> Acceptance: when a device set to dark mode opens the app with no stored theme, the dark theme applies. When a user pins light, it stays light on the next visit. When reduced motion is on and a user changes the Triads root, markers jump straight to the new frets. When a user prints a CAGED view in dark theme, the page has a light background and keeps every marker shape and label.

## Scope boundary

No custom color themes or user-picked palettes.
