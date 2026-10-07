# Feature Specification: Themes, Motion, and Print

**Feature Branch**: `feature/026-themes-motion-and-print`

**Created**: 2026-10-06

**Status**: Draft (clarified 2026-10-06)

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/007-comfort-and-launch-readiness/003-themes-motion-and-print.md (id 003, themes-motion-and-print)." Source sections: FR-1.9, FR-9.1, FR-10.3, NFR-2.7 (A-13), NFR-3.3, NFR-3.6, NFR-3.7, INT-6, design §3 (visual language, §3.1 character, §3.2 color roles, §3.3 markers, §3.5 motion), §4 (screen anatomy) and §8 (what the design avoids).

## Clarifications

### Session 2026-10-06

Each answer derives from a cited source, is an assumed default (marked **Default**), or reflects what already ships (marked **Existing**). No material question is open.

- Q: Which themes exist, and what is the default? → A: FR-1.9 and INT-6. Two themes, light and dark. With no stored choice the theme follows the device's light/dark setting. If the device gives no setting, light applies (INT-6 failure rule). Following the device is live: while no theme is pinned, a change of the device setting while the app is open updates the app without reload. **Default**.
- Q: Where does the user pin a theme? → A: Design §4.1 (home top zone: language, theme, about) and §4.2 (zone A menu: instrument, language, theme, about). No app menu exists yet: language and notation sit in a non-modal disclosure in zone A on tool screens and on About, and the language selector sits in the home top zone. **Default**: the theme choice joins that existing disclosure on tool screens and About, and sits beside the language selector on Home. It is a single-choice group of three options, Follow device, Light, Dark, with the current one checked. Pinning takes at most two activations (open the disclosure, choose), and one on Home. The disclosure's button and region names are updated in the catalog so they cover appearance as well as language. A later menu slice may move the group without changing its behavior.
- Q: How is the choice stored? → A: Constitution IX and the existing preferences codec. **Default**: an optional `theme` field in the existing v1 preferences record, with values `light` or `dark`. It is omitted when the choice is Follow device, so records stay byte-identical for users who never pin (the codec's existing "stored only when non-default" pattern). The format version stays 1 because the field is additive. Any other stored value reads as Follow device and leaves the other fields intact. Records written before this slice open as Follow device. When storage fails, the choice holds for the session.
- Q: Does the stored theme travel in share links or reset with other things? → A: FR-10.3 (theme is "not included" in links) and FR-9.1/FR-9.4 (theme is an appearance preference, erased by Erase my preferences). Opening a shared view never changes the recipient's theme. Erase my preferences returns the current tab to Follow device at once.
- Q: Do other open tabs follow a pin live? → A: **Default** (no existing preference syncs across tabs). No. Other open tabs pick the pin up on their next load.
- Q: How is the first paint kept free of a flash of the wrong theme? → A: **Default**. The effective theme is resolved before first paint by a same-origin script that blocks rendering and loads from the app's own origin. The CSP stays as is (`script-src 'self'`, hash mode): no inline script is added and no CSP directive is relaxed. With JavaScript off, the device setting applies through CSS alone, and pinning is not available. The page's `color-scheme` matches the effective theme, so native form controls and scrollbars match too. Verified by checking the first rendered frame with a pinned dark theme on a light device, and the reverse.
- Q: Is a theme switch animated? → A: **Default**. No. Switching theme is an instant change of colors with no transition, does not replay any marker animation, and does not interrupt sound.
- Q: What does the fretboard look like in each theme? → A: Design §3.2 ("a warm, dark tone in both themes, so that the markers have the same contrast in both"). **Default** for how to make that testable: one fretboard palette is shared by both themes. Every color drawn on or inside the fretboard comes from fretboard-scoped tokens that resolve to identical values in light and dark. That covers wood, strings, frets, nut, inlays, fret and string numbering on the board, the root, third, fifth, neutral-note and degree colors, marker labels, comparison outlines and arrows, connection rings, the Notes highlight and octave tones, and the region band. Surface tokens such as the text color are not used on the board. This replaces the light board that ships today in the light theme. Light-theme screenshot baselines, the TM-9 fixtures among them, are regenerated as an intended visual change and none are removed. The board is wood and metal suggested by color and at most a discreet texture, never photorealistic (constitution VII). Its outer boundary, through tone or an edge line, has at least 3:1 contrast against the surrounding surface in both themes.
- Q: What do surfaces and the interface around the fretboard look like? → A: Design §3.1 and §3.2. Neutral, quiet surfaces in both themes, so markers are the liveliest thing on screen. Buttons, panels, links and selection use the neutral and accent tokens, never the root, third or fifth colors. **Existing**: the accent and notice tokens already follow this rule.
- Q: What are the color exclusivity rules? → A: Constitution VII and design §3.2. Root, third and fifth colors belong only to those marker roles and their legend samples, in both themes, in the higher-contrast variant and in print. They are not used for buttons, links, focus rings, selection, notices, toggles or charts. Error red is not used for normal situations (notices, hints, limits reached, fallbacks). Checkable: an automated scan of the style sources finds the role-color tokens referenced only by the marker-fill rules of the fretboard and the legend sample.
- Q: How are the three role colors told apart by color-blind users? → A: NFR-3.3, design §3.2. Shape plus label stay the primary carriers (constitution V). **Default** measurement: each palette (standard, higher-contrast, print) is run through protan, deutan and tritan simulations at full severity. In every simulation, each pair among root, third and fifth keeps a CIEDE2000 difference of at least 10. This is an automated unit check over the token values.
- Q: What contrast is required in the standard themes? → A: NFR-3.7, WCAG 2.2 AA, design §3.2 and §3.3. **Default** thresholds, applied to every role and to identical values in both themes:
  - Text, including fret and string numbers, is at least 4.5:1 against its background, or 3:1 for large text.
  - Marker labels are at least 4.5:1 against their marker fill.
  - Every normal marker (fill, or outline for degree and neutral markers) is at least 3:1 against the fretboard.
  - Dimmed markers, measured with their opacity composited over the board, are at least 3:1 against it. They are smaller and have lower opacity than normal markers (design §3.3).
  - Strings, frets and the nut are at least 3:1 against the fretboard. Each has lower contrast than every normal marker, so the lines "recede behind the markers".
  - Focus indicators are at least 3:1 against adjacent colors.
  - Verification: automated contrast checks over the token values, plus axe in CI with zero violations in light, dark and the higher-contrast variant.
- Q: What does the higher-contrast variant do? → A: NFR-3.7. **Default** numbers, one step up from AA. When the device asks for more contrast (`prefers-contrast: more`), a higher-contrast variant applies on top of the active theme:
  - Light or dark still follows the user's choice.
  - All text, marker labels included, is at least 7:1 against its background.
  - Normal and dimmed markers, strings, frets, the nut, comparison outlines, arrows and connection rings are at least 4.5:1 against the fretboard.
  - Line and stroke widths are at least as wide as in the standard theme.
  - Dimmed markers keep lower opacity and smaller size than normal markers.
  - The fretboard keeps a warm, dark tone, deepened as needed and shared by both themes. This replaces today's mapping of the board to the system `Canvas` color under `prefers-contrast: more`. System colors stay reserved for forced-colors mode.
- Q: What does forced-colors mode (e.g. Windows high contrast) do? → A: **Existing**: forced-colors has its own rules in the design tokens. In this mode, system colors win over the theme and the contrast variant. Marker shapes stay visible through system-color strokes, and labels stay visible.
- Q: Is the motion system new? → A: Partly. **Existing**: durations come from the design tokens (`--duration-fast` 120 ms, `--duration-base` 200 ms, `--duration-short` 300 ms, `--duration-medium` 500 ms). Reduced motion zeroes them. The fretboard already has a slide helper, an animated scroll with an injectable clock, and the playback pulse. This slice makes every situation in design §3.5 behave as specified and adds no duration above those limits.
- Q: Which changes animate, and which are instant? → A: Design §3.5 lists exactly six situations. **Default**: only those animate. These changes are always instant: opening or switching a tool, opening a share link, changing instrument, tuning, string or fret count, handedness or orientation, language or notation, label type, fit mode, and theme.
- Q: How are markers matched for a slide (root, key or note change)? → A: **Default**. On each string, the old and new markers are paired in fret order: the lowest-fret old marker pairs with the lowest-fret new marker, and so on. Each pair slides along its own string to its new fret within `--duration-short` (≤ 300 ms). Old or new markers left without a partner fade out or in over the same transition. Nothing slides across strings. The rule applies to a Triads root change, a CAGED key change and a Notes note change. One rule for one kind of change keeps the visual language consistent.
- Q: What exactly moves on a quality change or a comparison? → A: Design §3.5 ("only the note that changes moves"). **Default**:
  - On a quality change, markers are matched by role (root, third, fifth). A role whose position changed slides along its string to its new fret. Roles whose position did not change get no transform, fade or redraw animation. If a role lands on a different string, that marker fades out and in instead of sliding.
  - Turning comparison on starts each comparison marker at the position of the base note it differs from, then slides it along its string to its own fret. Its dashed outline and arrow fade in during the same transition, and base markers stay still.
  - Turning comparison off fades the comparison markers and arrows out.
  - Every one of these transitions runs within `--duration-short`.
- Q: What does the cross-fade on an inversion or set change look like? → A: **Default**. Within `--duration-short`, the old shape fades out and the new shape fades in, with the two fades overlapping. At the midpoint both shapes are partly visible (each with opacity strictly between 0 and 1). Neither fade lasts the whole 300 ms alone.
- Q: What does CAGED focus do? → A: Design §3.5. The other shapes dim to the dimmed emphasis level, and the fretboard scrolls so the focused region is in view, both within `--duration-medium` (≤ 500 ms). If the region is already fully in view, nothing scrolls. Clearing focus restores emphasis within the same limit, without scrolling.
- Q: How are layer notes revealed? → A: Design §3.5. **Default** order: ascending pitch, with equal pitches ordered from the lowest-pitched string. Start times are spread evenly, so the last note is fully shown within `--duration-short` (≤ 300 ms) after the layer is turned on. Turning a layer off fades all its notes out together within the same limit.
- Q: How does the playback pulse behave? → A: **Existing**: a sounding marker is drawn highlighted and pulses once, for the note's duration. A transient neutral marker appears for an unmarked position. This slice keeps it and verifies it alongside the other motions.
- Q: How do transitions interact with state and with each other? → A: **Default**. A transition never delays state. The view's state, text description, keyboard focus and share link are already final when the animation starts. A new change during a transition starts from the currently drawn position with no jump, and always ends in the latest state. Theme switches and printing during a transition use the final state.
- Q: What does reduced motion do? → A: NFR-3.6 allows "instantaneous or a brief fade". **Default**: instant (0 ms) for every transition in the six situations, since the tokens already resolve to 0 s, and no brief fade is used. CAGED focus jumps straight to the region, so the region is still brought into view. The playback emphasis is kept, because it carries information (FR-7.6). It shows as a plain state change with no pulse animation: the marker is highlighted while the note sounds and returns to its previous emphasis afterward, and this also happens when sound is muted. Changes of the device setting take effect without reload. **Existing**: reduced motion is read live, and the pulse animation is already suppressed under reduced motion.
- Q: Does the user get an in-app motion or contrast setting? → A: No. **Default** (YAGNI; INT-6 reads the device preference). The device setting is the only switch for both.
- Q: Does motion hurt the performance budgets? → A: Constitution VI. Control change to fretboard update stays within 100 ms, measured to the moment the final state is in the DOM; the animation is cosmetic on top of it. Scrolling stays smooth with 7 strings, 24 frets and every CAGED layer on. The initial JavaScript, theme code included, stays within the 136 KB gzip budget. Raising it would need a constitution amendment and is outside this spec.
- Q: What does "print" and "capture" mean here? → A: NFR-2.7 (A-13). **Default**: printing the page, or saving it as PDF, through the browser's own print path, meaning the print media styles. "Capture" means that same path. Operating-system screenshots show the screen as it is and are out of scope. No in-app export button, file format, share image or print dialog is added.
- Q: Which colors does the printed result use? → A: NFR-2.7 ("the print theme uses a light background"). **Default**, conventional for paper handouts and ink-light:
  - Printing uses a dedicated print palette, the same whatever the screen theme, contrast variant or forced-colors state.
  - The page is white.
  - The fretboard is light: white or a very light warm tint, with dark strings, frets, nut and numbering, and an outer edge line. It is not the dark on-screen board.
  - Root, third and fifth print in darker variants of their hues. Every marker is at least 3:1 against the printed board, dimmed markers included. Labels are at least 4.5:1 against their fill. Neutral notes print with a light fill and a dark outline of at least 3:1.
  - Because these ratios are measured on luminance, they also hold in black-and-white printing, where shape and label carry the meaning (constitution V).
  - Markers and the board print even when the browser's "background graphics" option is off.
- Q: What does the printed result contain? → A: NFR-2.7 (shapes and labels kept). **Default**: the screen or tool heading. The fretboard over its whole fret range, with string and fret numbering. Every visible marker, keeping its shape, label and emphasis level, plus comparison dashed outlines and arrows and connection rings. The tool's context description, meaning the view's text description shown as visible text. The tuning shown by the tuning badge. The legend for the markers on the board, printed whatever its on-screen state.
- Q: What does the printed result omit? → A: **Default**. Interactive-only interface: navigation bar, share, instrument, sound, stop and notation buttons, the language and theme disclosure, zone-B controls (their selections are stated by the context description), notices, minimap, instrument and sound panels, and the landscape sliding panel. Nothing in the text description is lost.
- Q: How is the printed page laid out? → A: **Default**. The screen's fit mode, scroll position, layout (phone, landscape, wide) and zoom do not affect the print. The whole fretboard is scaled to the printable width and kept on one page, never split across pages. No page orientation is forced: the user picks portrait or landscape in the browser. For a 7-string, 24-fret neck on A4 or US Letter portrait with the browser's default margins, marker labels and numbering print at 7 pt or larger.
- Q: Does print apply to every screen? → A: Yes. Notes, Triads and CAGED print as above. Home and About print as readable light pages without navigation. Acceptance focuses on views with a fretboard.
- Q: Are custom themes in scope? → A: No. The brief excludes custom color themes and user-picked palettes. Two themes, the device-driven higher-contrast variant, and the print palette only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The app matches my device and my choice (Priority: P1)

A student practices at night and a teacher projects onto a bright classroom screen. The app opens in the theme their device is set to. Either user can pin light or dark, and it stays that way next visit.

**Why this priority**: It is the visible core of the slice and the first thing any user sees on every visit. Without it nothing else about the look matters.

**Independent Test**: Open the app with the device set to dark and no stored theme; confirm dark. Pin light from the theme choice, reload, confirm light. Choose Follow device, confirm the device setting applies again.

**Acceptance Scenarios**:

1. **Given** a device set to dark mode and no stored theme, **When** the user opens the app, **Then** the dark theme applies from the first rendered frame.
2. **Given** a device set to light mode and no stored theme, **When** the user opens the app, **Then** the light theme applies.
3. **Given** a device set to dark mode, **When** the user pins Light, **Then** the app switches to light at once and stays light on the next visit and after reload, with no flash of dark on load.
4. **Given** a pinned theme, **When** the user chooses Follow device, **Then** the stored `theme` field is removed and the app follows the device setting again, including later changes made while the app is open.
5. **Given** no pinned theme, **When** the device setting changes from light to dark while the app is open, **Then** the app switches to dark without reload.
6. **Given** a stored theme value that is unknown or corrupted, **When** the app opens, **Then** it follows the device setting, and the user's other stored preferences are unchanged.
7. **Given** a pinned theme, **When** the user opens a shared view link, **Then** the pinned theme still applies and the link does not change it.
8. **Given** storage is unavailable, **When** the user pins a theme, **Then** the theme applies for the session and nothing breaks.
9. **Given** the three theme choices, **When** the user operates them by keyboard or screen reader, **Then** each is reachable, named in the interface language, and the checked choice is announced.
10. **Given** a pinned theme, **When** the user runs Erase my preferences, **Then** the app returns to Follow device at once.
11. **Given** a tool screen or About, **When** the user opens the language-and-appearance disclosure, **Then** the theme choice is there; **Given** Home, **Then** the theme choice sits beside the language selector.

---

### User Story 2 - Markers read the same in both themes (Priority: P1)

In either theme the fretboard stays a warm, dark object and the markers are the liveliest thing on screen. Root, third and fifth keep their colors only for their roles, and notices are calm.

**Why this priority**: The product's pedagogy is the visual code; a theme that weakens marker contrast or reuses role colors would damage teaching.

**Independent Test**: With each theme in turn, open Notes, Triads and CAGED. Compare the computed fretboard colors between themes, run the contrast and color-vision checks over the tokens, and scan the styles for role-color reuse.

**Acceptance Scenarios**:

1. **Given** either theme, **When** a view is shown, **Then** every color on the fretboard (board, lines, numbering, markers, labels, outlines, arrows, rings, highlights) computes to the same value in light and dark, and the board's outer boundary is at least 3:1 against the surrounding surface.
2. **Given** either theme, **When** text and essential graphics are measured, **Then** text is at least 4.5:1 (3:1 large), marker labels are at least 4.5:1 against their fill, markers, strings, frets and the nut are at least 3:1 against the board, and strings and frets have lower contrast than every normal marker.
3. **Given** a view with dimmed markers, **When** shown in either theme, **Then** the dimmed shapes, with opacity composited, are at least 3:1 against the board and are smaller and lower in opacity than normal markers.
4. **Given** either theme, **When** buttons, links, focus rings, selection and notices are inspected, **Then** none uses the root, third or fifth color, and no notice for a normal situation uses error red.
5. **Given** protan, deutan and tritan simulations, **When** root, third and fifth are compared in the standard, higher-contrast and print palettes, **Then** each pair keeps a CIEDE2000 difference of at least 10.
6. **Given** a notice such as a fallback or a limit reached, **When** it shows, **Then** it is discreet, dismissible, at most two lines, and not error red.
7. **Given** either theme, **When** the automated accessibility checks run on every tool and the about page, **Then** they report zero violations.

---

### User Story 3 - A higher-contrast variant when the device asks (Priority: P2)

A user with low vision has set their device to more contrast. The app respects it in both themes, with markers and lines easier to see.

**Why this priority**: Required by constitution V and NFR-3.7, but it affects a smaller group than the themes themselves.

**Independent Test**: Emulate `prefers-contrast: more` in each theme; check the higher thresholds over the tokens and that shape and label coding is unchanged.

**Acceptance Scenarios**:

1. **Given** the device asks for more contrast, **When** the app is shown in light or in dark, **Then** a higher-contrast variant of that theme applies, and the fretboard keeps a warm, dark tone identical in both.
2. **Given** the variant, **When** text and marker labels are measured, **Then** each reaches at least 7:1 against its background, and line and stroke widths are at least those of the standard theme.
3. **Given** the variant, **When** markers (normal and dimmed), strings, frets, comparison outlines, arrows and connection rings are measured, **Then** each reaches at least 4.5:1 against the board, and dimmed markers remain smaller and lower in opacity than normal markers.
4. **Given** the variant, **When** the user pins a theme, **Then** pinned light or dark still applies, only with the higher contrast.
5. **Given** the device preference changes while the app is open, **When** it changes, **Then** the variant turns on or off without reload.
6. **Given** a system forced-colors mode, **When** the app is shown, **Then** marker shapes and labels remain visible and the system colors are respected.

---

### User Story 4 - Motion that explains change and respects sensitivity (Priority: P2)

When something changes, only what changed moves, and it moves briefly. A user who is sensitive to motion, with the device set to reduced motion, sees every change instantly.

**Why this priority**: Motion makes changes legible for most users, and honoring reduced motion is mandatory for others (constitution V, NFR-3.6).

**Independent Test**: Make each of the six kinds of change with motion on, using an injectable clock, and check start state, end state and duration. Repeat with reduced motion and check that every change is instant and the playback emphasis is a plain state change.

**Acceptance Scenarios**:

1. **Given** a Triads view, **When** the user changes the root, **Then** markers paired per string in fret order slide from their old frets to the new ones in at most 300 ms, only along their own string, and unpaired markers fade.
2. **Given** a CAGED view or a Notes view, **When** the user changes the key or the note, **Then** the same per-string slide rule applies.
3. **Given** a Triads view, **When** the user changes quality, **Then** only the roles whose position changed move, and the others get no animation.
4. **Given** a Triads view, **When** the user turns comparison on, **Then** each comparison marker slides from its base note's position to its own fret while outlines and arrows fade in, and base markers stay still.
5. **Given** a Triads view, **When** the user changes the inversion or the string set, **Then** the old shape fades out while the new one fades in, both partly visible at the midpoint, all within 300 ms.
6. **Given** a CAGED view, **When** the user puts a shape in focus, **Then** the other shapes dim and the fretboard scrolls to the region in at most 500 ms, with no scroll if the region is already in view.
7. **Given** a view with layers, **When** the user turns a layer on, **Then** its notes appear in ascending pitch order (ties from the lowest-pitched string), the last fully shown within 300 ms.
8. **Given** playback, **When** a position sounds, **Then** its marker pulses once for the duration of the note.
9. **Given** a transition in progress, **When** the user changes the view again, **Then** the new transition starts from the currently drawn position with no jump, and the final state is always the latest one.
10. **Given** a transition, **When** it runs, **Then** the text description, keyboard focus and share link already reflect the final state from the start.
11. **Given** the device asks for reduced motion, **When** the user changes the Triads root, **Then** markers jump straight to the new frets.
12. **Given** reduced motion, **When** the user changes inversion, set, quality, comparison, layers or CAGED focus, **Then** each change is instant (0 ms), with no fade and no scrolling animation, and the CAGED region is still brought into view.
13. **Given** reduced motion and a playback, **When** a position sounds, **Then** its marker is shown highlighted while it sounds, with no pulse animation, and returns to its previous emphasis afterward; the emphasis also appears when sound is muted.
14. **Given** the device setting changes while the app is open, **When** the user acts next, **Then** the new setting applies without reload.
15. **Given** any change outside the six situations (tool switch, link opening, instrument, tuning, handedness, orientation, language, notation, label type, fit mode, theme), **When** it happens, **Then** the view updates instantly with no marker animation.

---

### User Story 5 - Print a view for the classroom (Priority: P3)

A teacher prints a view, or saves it to a PDF, to hand out material. It comes out on white paper with every marker shape and label intact, no matter which theme was on screen.

**Why this priority**: A low-cost requirement (A-13) that serves teachers. It is valuable for handing out material but is not needed for daily use.

**Independent Test**: In dark theme open a CAGED view, print to PDF (or emulate print media), and inspect the background, board, markers and labels.

**Acceptance Scenarios**:

1. **Given** a CAGED view in dark theme, **When** the user prints it, **Then** the page and the fretboard are light, and every marker shape and label is kept.
2. **Given** a Triads view with comparison on, **When** printed, **Then** the dashed comparison outlines, arrows, shapes and labels are all kept.
3. **Given** a view printed with the browser's background-graphics option off, **When** the result is inspected, **Then** markers and the board are still present.
4. **Given** a printed view, **When** inspected, **Then** it includes the heading, the fretboard with string and fret numbering, the tuning, the context description and the legend, and omits navigation, the buttons in the app bar, the language and theme disclosure, zone-B controls, notices, minimap and panels.
5. **Given** a 7-string, 24-fret view, **When** printed on A4 or US Letter in portrait or landscape, **Then** the whole neck fits the printable width on one page without being split, and labels and numbering are at least 7 pt.
6. **Given** any screen state (whole or comfortable fit, any scroll position, phone, landscape or wide layout, higher contrast, either theme), **When** printed, **Then** the printed result is the same light, complete view.
7. **Given** the print palette, **When** measured, **Then** every marker is at least 3:1 against the printed board and every label at least 4.5:1 against its fill, so root, third and fifth stay distinguishable by shape and label in black and white.

---

### Edge Cases

- A device with no light/dark setting (older browser): light applies and the theme choice still offers all three options.
- JavaScript off: the device setting applies through CSS; pinning is unavailable; no flash.
- A pinned theme while the device changes its light/dark setting: the pin wins; nothing changes on screen.
- A pin made in one tab while another tab is open: the other tab keeps its theme until its next load.
- Theme change while playback runs or a transition is in progress: the switch is instant, sound continues, no marker or state is lost, and no animation replays.
- Opening the print preview while a transition runs: the printed state is the final state.
- Switching theme in the middle of a CAGED focus: the dimmed shapes keep their emphasis levels and remain perceptible in the new theme.
- Reduced motion on at the same time as high contrast: both apply independently.
- High-contrast variant with a pinned theme and forced colors together: forced colors win for system colors; shapes and labels remain.
- Left-handed mode, 7 strings and non-standard tunings: themes, motion and print behave the same; slides follow the mirrored positions.
- Marker with no partner on its string after a change: it fades in or out rather than sliding across strings.
- A quality change that moves a role to another string: that marker fades out and in instead of sliding.
- A view with no visible markers (for example, everything hidden): print still produces the fretboard with numbering, context and tuning.
- Browser text zoom up to 200%: the theme choice and the notice remain readable without truncation or overlap in en, pt and es.
- Share links, saved preferences from earlier versions and the existing link fixtures keep opening unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST offer a light theme and a dark theme. With no stored choice the theme MUST follow the device's light/dark setting, and MUST be light when the device gives no setting.
- **FR-002**: While no theme is pinned, the system MUST follow changes of the device's light/dark setting live, without reload.
- **FR-003**: The system MUST offer a single-choice group of three options, Follow device, Light and Dark, with the current one checked. On tool screens and About it MUST sit in the existing zone-A language disclosure, whose names are updated to cover appearance. On Home it MUST sit beside the language selector. It MUST be reachable in at most two activations, fully keyboard- and screen-reader-operable, with all text from the message catalog (en, pt, es).
- **FR-004**: Choosing Light or Dark MUST apply immediately and be stored as a preference that applies on the next visit; choosing Follow device MUST clear the pin.
- **FR-005**: The theme MUST be stored as an optional `theme` field (`light` or `dark`) in the existing v1 preferences record and omitted for Follow device. Any other value MUST read as Follow device without affecting other fields. Records without the field MUST open as Follow device. A storage failure MUST NOT break the app, and the choice MUST hold for the session. Other open tabs are not updated live.
- **FR-006**: The theme MUST NOT be part of share links, and opening a shared view MUST NOT change the recipient's theme. Erase my preferences MUST remove the theme and return to Follow device at once.
- **FR-007**: The first rendered frame MUST already use the correct theme (no flash of the other theme), with and without a pinned choice. This MUST be achieved without inline script and without relaxing the CSP. With JavaScript off, the device setting MUST apply. The document's `color-scheme` MUST match the effective theme.
- **FR-008**: The fretboard MUST use one palette shared by both themes: every color drawn on the board MUST come from fretboard-scoped tokens with identical values in light and dark. That covers board, strings, frets, nut, inlays, numbering on the board, role, neutral and degree colors, labels, comparison outlines and arrows, connection rings, Notes highlight and octave tones, and region band. The board MUST be a warm, dark tone suggested by color and at most a discreet texture, never photorealistic, and its outer boundary MUST be at least 3:1 against the surrounding surface.
- **FR-009**: Surfaces and interface chrome MUST be neutral in both themes, so that markers are the liveliest thing on screen.
- **FR-010**: The root, third and fifth colors MUST be used only for those marker roles and their legend samples, in both themes, in the higher-contrast variant and in print. They MUST NOT be reused for buttons, links, focus, selection, toggles or notices. An automated style scan MUST enforce this.
- **FR-011**: Notices MUST be discreet, non-blocking, dismissible and at most two lines, and MUST NOT use error red for normal situations.
- **FR-012**: In the standard, higher-contrast and print palettes, each pair among root, third and fifth MUST keep a CIEDE2000 difference of at least 10 under full-severity protan, deutan and tritan simulation, while shape plus label remain the primary carriers.
- **FR-013**: In both themes these thresholds MUST hold:
  - Text is at least 4.5:1 (3:1 for large text).
  - Marker labels are at least 4.5:1 against their fill.
  - Every normal marker is at least 3:1 against the fretboard.
  - Strings, frets and the nut are at least 3:1 against the fretboard, with lower contrast than every normal marker.
  - Focus indicators are at least 3:1 against adjacent colors.
- **FR-014**: Dimmed markers, with opacity composited, MUST be at least 3:1 against the fretboard. They MUST be smaller and lower in opacity than normal markers in both themes.
- **FR-015**: When the device asks for more contrast, a higher-contrast variant MUST apply on top of the active theme. These thresholds MUST hold:
  - Text and marker labels are at least 7:1.
  - Normal and dimmed markers, strings, frets, the nut, comparison outlines, arrows and connection rings are at least 4.5:1 against the board.
  - Strokes are no thinner than in the standard theme.
  - Dimmed markers are still smaller and lower in opacity than normal ones.

  The board MUST stay a warm, dark tone shared by both themes rather than the system `Canvas` color. The variant MUST follow the device setting live and MUST NOT change which theme (light or dark) is active.
- **FR-016**: In forced-colors mode, marker shapes and labels MUST remain visible and system colors MUST be respected.
- **FR-017**: A Triads root change, a CAGED key change and a Notes note change MUST pair old and new markers per string in fret order and slide each pair along its own string to its new fret within `--duration-short` (≤ 300 ms). Unpaired markers MUST fade in or out instead, and nothing slides across strings.
- **FR-018**: On a quality change, markers MUST be matched by role, and only roles whose position changed may animate. A role that changes string MUST fade out and in rather than slide. Turning comparison on MUST slide each comparison marker from its base note's position to its fret while outlines and arrows fade in, with base markers still. Turning comparison off MUST fade them out. All of this MUST happen within `--duration-short`.
- **FR-019**: An inversion or string-set change MUST cross-fade the old and new shapes within `--duration-short`, with both partly visible at the midpoint.
- **FR-020**: Focusing a CAGED shape MUST dim the other shapes and scroll the fretboard to the region within `--duration-medium` (≤ 500 ms). Nothing scrolls when the region is already in view.
- **FR-021**: Turning a layer on MUST reveal its notes in ascending pitch order, with ties ordered from the lowest-pitched string. Start times MUST be spread evenly so the last note is fully shown within `--duration-short`. Turning a layer off MUST fade its notes out together within the same limit.
- **FR-022**: A sounding marker MUST pulse once for the duration of the note.
- **FR-023**: A transition MUST NOT delay state: the text description, focus and share link MUST reflect the final state from the start. A change during a transition MUST continue from the currently drawn position with no jump and end in the latest state.
- **FR-024**: When the device asks for reduced motion, every transition in FR-017 to FR-021 MUST be instant (0 ms, no fade), with no scrolling animation, and the CAGED region MUST still be brought into view. The setting MUST be read live.
- **FR-025**: With reduced motion, the sound-playback emphasis MUST be kept as a plain state change with no pulse animation. The marker is highlighted while sounding and returns to its previous emphasis afterward, also when sound is muted.
- **FR-026**: All durations MUST come from the design tokens and stay within the limits above, with no new durations beyond them. There MUST be no in-app motion or contrast setting.
- **FR-027**: Only the six situations of design §3.5 MAY animate. Tool open or switch, share-link opening, instrument, tuning, string or fret count, handedness, orientation, language, notation, label type, fit mode and theme changes MUST apply instantly with no marker animation. A theme switch MUST NOT interrupt sound or replay animations.
- **FR-028**: Printing through the browser's print path, including save as PDF, MUST use a dedicated print palette, whatever the screen theme, contrast variant, forced-colors state, layout or fit mode:
  - The page is white.
  - The fretboard is light, with dark strings, frets, nut, numbering and an outer edge line.
  - Role colors print in darker variants of their hues.
  - Every marker, dimmed included, is at least 3:1 against the printed board.
  - Labels are at least 4.5:1 against their fill.
  - Neutral notes have a dark outline of at least 3:1.
  - Markers and board MUST print even when the browser's background-graphics option is off.
- **FR-029**: The printed result MUST contain the heading, the whole fretboard over its fret range with string and fret numbering, and every visible marker with its shape, label and emphasis. It MUST also contain the comparison outlines and arrows, the connection rings, the context description as visible text, the tuning, and the marker legend.
- **FR-030**: The printed result MUST omit interactive-only chrome: navigation, the app-bar buttons, the language and theme disclosure, zone-B controls, notices, minimap and panels. It MUST NOT crop or split the neck. The whole fretboard MUST fit the printable width on one page, in portrait and in landscape, with no forced orientation. For up to 7 strings and 24 frets on A4 or US Letter with default margins, labels and numbering MUST be at least 7 pt.
- **FR-031**: All new user-facing text MUST come from the message catalog in English, Portuguese and Spanish. Notes, Triads and CAGED views, plus Home and About, MUST print as readable light pages.
- **FR-032**: The new interface MUST work from 320 to 2560 px and at 200% text size without truncation or overlap. It MUST be keyboard-operable and have zero automated accessibility violations in both themes and the contrast variant.
- **FR-033**: The feature MUST NOT add custom colors, user-picked palettes or an in-app export. It MUST NOT change theory, sound or share-link contents, and MUST stay within the existing performance budgets, the initial JavaScript gzip cap included (136 KB when specified; raised to 150 KB by constitution 1.11.0 on 2026-10-07, owner decision after T070/T074 recorded a 0.9 KB gap).

### Key Entities *(include if feature involves data)*

- **Theme choice**: the user's appearance preference with three values: follow device, light, dark. Stored as the optional `theme` field (`light` | `dark`) of the v1 preferences record, omitted for follow device. Validated, absent in older records, never in share links, erased with other preferences.
- **Effective theme**: light or dark, derived from the theme choice and the device setting at any moment.
- **Contrast variant**: on or off, derived live from the device's increased-contrast setting, layered over the effective theme. Not stored.
- **Motion mode**: full or reduced, derived live from the device's reduced-motion setting. Not stored.
- **Fretboard palette**: the board and on-board colors, shared by both themes; one standard set and one higher-contrast set.
- **Print palette**: the light page, light board and darker role-color variants used only for print media.
- **Transition**: a short change of the drawn view with a kind (slide, move-only-changed, cross-fade, dim-and-scroll, ordered reveal, pulse), a duration token within its limit, and a final state that is already the view's state.
- **Print view**: the light, complete rendering of the current view for paper, derived from the same view state as the screen.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With the device set to dark and no stored theme, 100% of first visits show the dark theme from the first rendered frame; with a pinned theme, 100% of next visits keep it, with no visible flash of the other theme.
- **SC-002**: Every on-board color computes identically in the two themes. Every text and essential graphic meets the FR-013 thresholds. In the higher-contrast variant, text and labels reach 7:1 and on-board graphics reach 4.5:1.
- **SC-003**: Dimmed markers measure at least 3:1 (4.5:1 in the higher-contrast variant) against the board in all themes, and are smaller and lower in opacity than normal markers in 100% of tested views.
- **SC-004**: A scan of the style sources finds the root, third and fifth colors used only for marker roles and legend samples, and no normal-situation notice using error red.
- **SC-005**: Each of the six motions completes within its limit (300 ms, or 500 ms for CAGED focus), and the final state is correct in 100% of tested changes, including changes made mid-transition.
- **SC-006**: With reduced motion on, 100% of tested view changes show the final state with no animation, and the playback emphasis is shown with no pulse animation, including when sound is muted.
- **SC-007**: Printing a CAGED view from dark theme gives a light page and light board with 100% of marker shapes and labels kept. The same holds for Triads with comparison, and for 7 strings and 24 frets in portrait and landscape, on one page with labels at least 7 pt.
- **SC-008**: A user can pin a theme in at most two activations (open the disclosure, choose) on tool screens and About, and in one on Home, in all three languages.
- **SC-009**: Automated accessibility checks report zero violations on every tool and the about page in light, dark and the higher-contrast variant, and existing performance budgets continue to pass.

## Assumptions

- The fretboard, the Notes, Triads and CAGED tools, tunings, left-handed mode, the message catalog in three languages, the preferences store and the playback emphasis from earlier waves exist.
- No application menu exists yet; the theme choice joins the existing zone-A language disclosure (tool screens, About) and sits beside the language selector on Home. A later menu slice may relocate it without changing behavior.
- Design tokens for light, dark, higher-contrast, forced colors, reduced motion and the four motion durations already exist and are extended, not replaced. The device-driven rules (light/dark, increased contrast, reduced motion, forced colors) plus the user's pin are the only drivers of the variants.
- The light theme's light fretboard shipped by earlier slices is replaced by the shared dark board (design §3.2); light-theme screenshot baselines are regenerated, and no fixture is removed.
- The theme is a per-device appearance preference: it is stored with other preferences, never in share links or view state, and not stored per tool.
- Printing means the browser's own print or save-to-PDF path; no in-app export, image or print dialog is part of this feature.
- No custom themes, palettes, in-app motion setting or in-app contrast setting are part of this feature.
- The home page and the about page print as readable light pages as a courtesy; acceptance focuses on tool views with a fretboard.
