# 06 — Non-functional requirements

| Category | Subject |
|---|---|
| NFR-1 | Performance |
| NFR-2 | Compatibility and responsiveness |
| NFR-3 | Accessibility |
| NFR-4 | Internationalization |
| NFR-5 | Privacy and compliance |
| NFR-6 | Security |
| NFR-7 | Availability and scale |
| NFR-8 | Observability |
| NFR-9 | Musical correctness |
| NFR-10 | Evolution |

"Desktop reference profile" is a mid-range laptop on typical broadband, measured with the Lighthouse desktop preset. *[Assumption A-12.]* *[Changed by slice 030: desktop-only target.]*

---

## NFR-1 — Performance

**NFR-1.1** On the desktop reference profile, the home screen is usable within 3 seconds of opening the address. *[Changed by slice 030: desktop-only target.]*

**NFR-1.2** Opening a tool from the home screen, or switching between tools, takes up to 300 milliseconds until the fretboard is interactive.

**NFR-1.3** Every control change (note, root, quality, inversion, set, shape, layer, filter, notation) updates the fretboard within 100 milliseconds. Instrument changes, which recalculate everything, take up to 300 milliseconds.

**NFR-1.4** The sound of a note starts within 100 milliseconds of the tap, once audio has been enabled in the session.

**NFR-1.5** Once loaded, the application does not depend on the network for any function: calculation, drawing, and sound happen on the device.

**NFR-1.6** Scrolling and dragging the fretboard follow the pointer without perceptible stutter on the desktop reference profile, including with 7 strings, 24 frets, and every CAGED layer on. *[Changed by slice 030: desktop-only target.]*

**NFR-1.7** The volume of data transferred on first opening is compatible with NFR-1.1 on typical broadband; the sound material does not block fretboard interactivity and can load after the essentials. *[Changed by slice 030: desktop-only target.]*

---

## NFR-2 — Compatibility and responsiveness

**NFR-2.1** The application works on the two most recent major versions of the desktop browsers in current use. *[Changed by slice 030: desktop-only target.]*

**NFR-2.2** Every function is available in windows from 1024 to 2560 CSS px wide; below 1024 CSS px, content reflows down to 320 CSS px under browser zoom. No function is exclusive to one window size (C-4). *[Changed by slice 030: desktop-only target.]*

**NFR-2.3** The application accepts touch, pointer, and keyboard, alone or combined, without a mode for the user to choose.

**NFR-2.4** The page never scrolls horizontally at any width. The only area with horizontal scrolling is the fretboard (FR-3.12).

**NFR-2.5** *[Changed by slice 030: desktop-only target.]*

**NFR-2.6** The application remains usable with text enlarged up to 200% by the browser.

**NFR-2.7** A fretboard view can be printed or captured with a legible result: the print theme uses a light background and keeps shapes and labels. *[Assumption A-13: serves the teacher who hands out material; a low-cost requirement.]*

---

## NFR-3 — Accessibility

**NFR-3.1** The application meets the international accessibility guidelines for web content, level AA, in the current version.

**NFR-3.2** Every function is keyboard-operable, including the fretboard (FR-3.17), with a logical focus order and focus always visible. There are no focus traps.

**NFR-3.3** No information depends on color alone. The function of the note is distinguishable by shape and by label (FR-3.8); emphasis levels, by opacity and size; comparison, by dashed outline and arrow (FR-5.11). The palettes are checked for the most common types of color blindness.

**NFR-3.4** Every view has an equivalent text description (FR-3.18), updated when the view changes and announced to screen readers unobtrusively. Controls expose their name, role, and state to assistive technologies.

**NFR-3.5** Interactive targets meet WCAG 2.2 SC 2.5.8 (Target Size, Minimum). In "whole fretboard visible" mode, where frets can be smaller, the selection picks the nearest position and the system offers comfortable mode (FR-3.14). *[Changed by slice 030: desktop-only target.]*

**NFR-3.6** With the reduced-motion preference active on the device, fretboard transitions are instantaneous or reduced to a brief fade; the emphasis synchronized with sound (FR-7.6) is kept because it is information, not decoration.

**NFR-3.7** The contrast of text and of essential graphic elements (markers, strings, frets, labels) meets level AA in both themes. Dimmed markers remain perceptible. With the increased-contrast preference active on the device, the system uses a higher-contrast variant.

**NFR-3.8** Sound is never the only carrier of a piece of information: everything heard is also seen.

**NFR-3.9** Screen readers read note names with accidentals in full ("F sharp", not "F hash").

---

## NFR-4 — Internationalization

**NFR-4.1** The three languages have full coverage: there is no untranslated text and no mix of languages on a screen, except the names of the CAGED shapes (FR-8.9) and the proper names of tunings established in English (for example, "Drop D", "DADGAD").

**NFR-4.2** The musical terms of each language are reviewed by a native-speaking musician (trilingual glossary in file 10).

**NFR-4.3** The structure of the texts allows a new language to be added without changing musical rules or behavior.

**NFR-4.4** The interface accommodates the variation in text length across languages without truncation or overlap.

**NFR-4.5** Language, notation, and accidental preference are three independent dimensions (FR-8.4).

---

## NFR-5 — Privacy and compliance

**NFR-5.1** The application does not collect, store on a server, or transmit personal data. There is no sign-up, email, name, or user identifier.

**NFR-5.2** Preferences stay exclusively on the device (FR-9.3) and the user can erase them (FR-9.4).

**NFR-5.3** If usage measurement is adopted (INT-2), it is anonymous and aggregate: no persistent identifier, no individual profile, no cross-referencing with other sources, no sharing with third parties for advertising.

**NFR-5.4** The application complies with the data protection laws applicable to the audience of the three languages, including the Brazilian and the European ones. The "About" page describes, in plain language, what is stored on the device and what (if anything) is measured.

**NFR-5.5** The application shows no advertising and loads no third-party content that tracks the user.

**NFR-5.6** The application is suitable for minors: there is no interaction between users, no user-generated content, and no data collection.

---

## NFR-6 — Security

**NFR-6.1** All communication between the browser and the delivery service is encrypted.

**NFR-6.2** The content of a state link is treated as untrusted data: every value is validated against the accepted sets and ranges before use (EC-10.1); no part of the link is displayed as formatted text or executed.

**NFR-6.3** Data read from local storage is validated in the same way (FR-9.6).

**NFR-6.4** The application embeds no executable content from origins other than its own delivery service, except usage measurement, if adopted.

**NFR-6.5** The application requests no device permissions (microphone, camera, location, notifications).

---

## NFR-7 — Availability and scale

**NFR-7.1** The application is available 99.5% of the time, measured monthly. *[Assumption A-14.]*

**NFR-7.2** Because all processing happens on the device, growth in the number of users affects only the delivery of static content. Delivery withstands peaks of ten times the average without degrading NFR-1.1.

**NFR-7.3** Expected order of magnitude for the first year: tens of thousands of monthly users, distributed mainly across Latin America, the Iberian Peninsula, and English-speaking countries. *[Assumption A-15.]*

**NFR-7.4** A new version is published without downtime. Users with the application open stay on the loaded version until the next opening.

---

## NFR-8 — Observability

**NFR-8.1** Unexpected failures on the device (calculation, drawing, or audio errors) are recorded anonymously, with the view state and the instrument configuration in which they occurred, to allow reproduction. Subject to the same decision as Q-1.

**NFR-8.2** The delivery service is monitored for availability and response time.

**NFR-8.3** The application shows its version on the "About" page.

---

## NFR-9 — Musical correctness

**NFR-9.1** Every view is theoretically correct: notes, spellings, intervals, inversions, and shapes match `11-music-theory-reference.md`.

**NFR-9.2** The musical rules are verified automatically against the reference tables in file 11 on every change to the application. The verification covers, at minimum: the 12 roots × 4 qualities (spelling); the 4 qualities × 3 inversions × every string set in 6-string and 7-string standard tuning (shapes); the 10 CAGED shapes with every layer in C major and C minor.

**NFR-9.3** Every calculated triad shape, in any tuning, satisfies these properties: exactly three positions, on three adjacent strings, one per string; pitches strictly ascending from the lower string to the higher; total extent smaller than one octave; pitch classes equal to those of the triad; lowest note according to the inversion.

**NFR-9.4** The sound of each position matches the calculated pitch, with an imperceptible tuning error.

**NFR-9.5** Before launch, two guitar teachers independently review a sample of views in the three tools, in standard tuning, in an alternate tuning, and on 7 strings (metric M-4).

---

## NFR-10 — Evolution

**NFR-10.1** The musical rules are isolated from presentation, so that new tools (seventh chords, scales, modes) reuse the fretboard and the theory engine without changing them.

**NFR-10.2** The preferences model and the link format are versioned (DM-14, DM-17), allowing additions without breaking existing data or links.

**NFR-10.3** The structure admits the future inclusion of teaching content, exercises, accounts, and progress — out of scope today — without rewriting the three tools: the tools expose their state so that a lesson layer can drive them.
