# 03 — Functional requirements

Conventions:

- Each requirement has a stable identifier `FR-area.number`.
- "The system" is the application. "The fretboard" is the component described in area 3, used by the three tools.
- Strings are numbered from the highest (1) to the lowest (6 or 7). Fret 0 is the open string.
- The musical rules cited here are detailed in `11-music-theory-reference.md` (sections `TM-n`).
- *[Assumption: …]* marks a decision made without confirmation; all of them are collected in file 09.

| Area | Subject |
|---|---|
| 1 | Structure and navigation |
| 2 | Instrument configuration |
| 3 | Interactive fretboard |
| 4 | Fretboard Notes tool |
| 5 | Triads tool |
| 6 | CAGED tool |
| 7 | Audio |
| 8 | Language and notation |
| 9 | On-device preferences |
| 10 | Sharing by link |

---

## Area 1 — Structure and navigation

**FR-1.1** The application has four destinations: the home screen and the three tools (Fretboard Notes, Triads, CAGED). There is no sign-up, sign-in, or profile screen.

**FR-1.2** The home screen presents the three tools as cards of equal visual weight. Each card shows the tool name, one sentence with the question it answers, and a thumbnail of the fretboard in that mode, drawn with the configured instrument.

| Tool | Card sentence |
|---|---|
| Fretboard Notes | "Where is every note?" |
| Triads | "What is a chord made of?" |
| CAGED | "How does the whole neck connect?" |

**FR-1.3** The home screen shows a summary of the instrument in use (string count, tuning, handedness) with access to the instrument panel.

**FR-1.4** When a local record of the last tool used exists, the home screen marks the corresponding card with "Continue". The three cards remain available and in the same order.

**FR-1.5** Inside a tool, persistent navigation leads to any other tool and to the home screen in a single action. The navigation indicates the current tool.

**FR-1.6** When the user switches tools, the system carries the musical context over:

| From | To | What carries over |
|---|---|---|
| Notes (one note selected) | Triads | The note becomes the root; quality, inversion, and set keep the last value used in Triads |
| Notes (one note selected) | CAGED | The note becomes the key; the quality keeps the last value used in CAGED |
| Triads | CAGED | Root and quality. If the quality is diminished or augmented, only the root carries over and CAGED opens in major |
| Triads | Notes | The three notes of the triad are selected |
| CAGED | Triads | Key and quality become root and quality |
| CAGED | Notes | The three notes of the chord are selected |

With no selection at the origin, the destination tool opens in the last state it was used in during the session or, if there is none, in its initial state.

**FR-1.7** Each tool keeps its state for as long as the session lasts: returning to a tool already visited reopens it as it was left, except when FR-1.6 carries over a new context.

**FR-1.8** The browser's back and forward commands move through the screens visited (home screen and tools). State changes inside a tool do not create history entries.

**FR-1.9** The system offers a light theme and a dark theme. The default follows the device preference; the user can fix either one.

**FR-1.10** An "About" page explains in a few lines what the application is, the marker legend (root, third, fifth), the list of keyboard shortcuts, the application version, and the privacy policy (no personal data is collected).

**FR-1.11** Each tool has the **Reset tool** command, which returns the tool to its initial state without changing instrument, language, or notation.

---

## Area 2 — Instrument configuration

**FR-2.1** The instrument panel is accessible from the home screen and from every tool.

**FR-2.2** The panel configures: string count, tuning, fret count, handedness, and string orientation.

**FR-2.3** String count: **6** (default) or **7**. When the user changes from 6 to 7, the system adds the seventh string a perfect fourth below the sixth and keeps the other six as they were. When the user changes from 7 to 6, the system removes the seventh and keeps the rest.

**FR-2.4** Preset tunings. The list shows the name and the notes of each string, from lowest to highest. When the user selects a tuning, the panel shows a preview of the fretboard.

| Id | Name | 6 strings (string 6 → 1) |
|---|---|---|
| AF-1 | Standard | E A D G B E |
| AF-2 | Half step down | E♭ A♭ D♭ G♭ B♭ E♭ |
| AF-3 | Whole step down | D G C F A D |
| AF-4 | Drop D | D A D G B E |
| AF-5 | Drop C | C G C F A D |
| AF-6 | Double Drop D | D A D G B D |
| AF-7 | DADGAD | D A D G A D |
| AF-8 | Open G | D G D G B D |
| AF-9 | Open D | D A D F♯ A D |
| AF-10 | Open E | E B E G♯ B E |
| AF-11 | Open A | E A E A C♯ E |

| Id | Name | 7 strings (string 7 → 1) |
|---|---|---|
| AF-21 | 7-string standard | B E A D G B E |
| AF-22 | 7-string half step down | B♭ E♭ A♭ D♭ G♭ B♭ E♭ |
| AF-23 | Drop A | A E A D G B E |

With 7 strings, tunings AF-1 to AF-11 are also available; the seventh string sits a perfect fourth below the sixth unless adjusted manually. The exact pitches (note and octave) of each tuning are in TM-2.

**FR-2.5** Custom tuning. The user adjusts each string by semitone, between 7 semitones below and 4 semitones above the pitch of that string in standard tuning. The panel shows the resulting note and octave and plays them on request. A custom tuning that matches a preset is displayed with the preset's name. *[Assumption A-7: the −7/+4 limits cover the tunings used in practice and prevent configurations with no physical meaning.]*

**FR-2.6** Handedness. In **right-handed** mode, the nut is on the left and the frets increase to the right. In **left-handed** mode, the fretboard is mirrored horizontally: nut on the right, frets increasing to the left. Everything directional follows the mirroring: fret numbering, shape tags, comparison arrows, minimap, screen-reader reading order (from the nut toward the body), and "next shape" gestures.

**FR-2.7** String orientation. Default: highest string on top, lowest at the bottom (as in tablature). Alternative: lowest string on top (as the player sees the instrument when looking down). The choice is independent of handedness.

**FR-2.8** Fret count: 12 to 24; default 22.

**FR-2.9** When the user confirms the panel, the system applies the configuration to every tool, recalculates the current view without reloading the page, and stores the configuration on the device (FR-9.1).

**FR-2.10** When the tuning differs from AF-1 (or from AF-21, with 7 strings), every tool shows a badge with the tuning name. The badge opens the instrument panel.

**FR-2.11** The **Restore default** command sets 6 strings, AF-1, 22 frets, right-handed, highest string on top.

**FR-2.12** The system classifies the tuning in use for the purposes of the CAGED tool (TM-8):

| Class | Condition | Examples |
|---|---|---|
| Compatible | The six higher strings keep the intervals of standard tuning among themselves | AF-1, AF-2, AF-3, AF-21, AF-22, AF-23 |
| Compatible with an altered string | Strings 5 to 1 keep the standard intervals; string 6 does not | AF-4, AF-5 |
| Non-compatible | Any other case | AF-6 to AF-11 and most custom tunings |

---

## Area 3 — Interactive fretboard

The fretboard is the central component. The three tools use it with the same base behaviors.

### Drawing

**FR-3.1** The fretboard shows the configured number of strings, the configured number of frets, and the nut. Lower strings are drawn thicker than higher strings.

**FR-3.2** The fretboard shows position markers (inlays) at frets 3, 5, 7, 9, 15, 17, 19, and 21 (single) and 12 and 24 (double), limited to the configured fret count.

**FR-3.3** Fret numbers appear along the fretboard. On a narrow screen, the system shows at least the numbers of the frets that have inlays.

**FR-3.4** Next to the nut, each string shows its number and the note of the open string, in the current notation.

**FR-3.5** The open string (fret 0) is a position like any other: it receives a marker, a label, and sound. It is drawn next to the nut, outside the fretted area.

**FR-3.6** Fret spacing narrows slightly toward the body, suggesting a real neck, but no fret has a touch area smaller than the minimum defined in NFR-3.5. *[Assumption A-9.]*

### Markers and labels

**FR-3.7** Each displayed position has a marker with a label. The user picks the label type:

| Type | Content | Available in |
|---|---|---|
| Name | Note name in the current notation | All tools |
| Interval | Relationship to the root: R, ♭3, 3, 5, ♭5, ♯5 (and the other degrees in the scale layers) | Triads, CAGED |
| Octave | Note name with octave number | Notes |
| No label | Empty marker | All |

**FR-3.8** The function of the note has a fixed visual identity across the product, by color **and** by shape:

| Function | Marker shape |
|---|---|
| Root | Exclusive shape with the most emphasis (for example, a rounded square) |
| Third | Circle |
| Fifth | A shape distinct from the previous two (for example, a diamond) |
| Other scale degrees | Smaller outlined circle |

The final colors and shapes are defined in `12-design-and-experience.md`. No information is conveyed by color alone.

**FR-3.9** Every position has one of four emphasis levels: **highlighted**, **normal**, **dimmed**, or **hidden**. Each tool sets the level of each position according to its controls.

**FR-3.10** A legend reachable from the tool explains the markers in use in that view.

### Interaction

**FR-3.11** Tapping or clicking any position — including hidden or dimmed ones — plays the note of that position (FR-7.1) and puts it in focus. Each tool defines what focus displays.

**FR-3.12** When the fretboard does not fit the available width, it scrolls horizontally by dragging. Scrolling the fretboard does not scroll the page, and a vertical drag over the fretboard still scrolls the page.

**FR-3.13** A minimap shows the whole fretboard in miniature, with the visible stretch and the highlighted positions. Tapping a point on the minimap takes the fretboard to that point. The minimap appears only when the fretboard does not fit on screen in full.

**FR-3.14** The **Fit to screen** command switches between two modes: whole fretboard visible (narrower frets) and comfortable fret size (with scrolling). On screens where the whole fretboard fits at comfortable size, the command does not appear.

**FR-3.15** When a tool changes what is highlighted, the fretboard scrolls automatically so that the highlighted region becomes visible, if it is off screen.

**FR-3.16** With a pointer (mouse), hovering over a position shows its name even when the label is hidden, except in the hidden mode of the Notes tool (FR-4.8).

**FR-3.17** The fretboard is keyboard-operable: the arrow keys move focus between adjacent positions (previous and next fret, string above and below); an action key plays the note in focus; focus is always visible.

**FR-3.18** Every view has an equivalent text description, available to screen readers and visible on demand. Example: "A major, first inversion, strings 4, 3, and 2: string 4, fret 11, C sharp, third; string 3, fret 9, E, fifth; string 2, fret 10, A, root."

**FR-3.19** On a phone, rotating the device to landscape enlarges the fretboard to fill the width; the tool controls rearrange without losing functions (see file 12). The first time the CAGED tool is opened on a phone in portrait, the system suggests rotating the device, in a dismissible notice that does not repeat.

---

## Area 4 — Fretboard Notes tool

Answers the question: **where is every note?**

**FR-4.1** Initial state: no note selected; Name label type; natural notes at normal emphasis; altered notes hidden; no string or region filter.

**FR-4.2** The note selector presents the twelve notes in chromatic order, starting from C. The seven naturals and the five altered notes are visually distinct. Each altered note shows both spellings (for example, F♯ / G♭).

**FR-4.3** Selecting one or more notes highlights every occurrence of those notes and dims the other visible positions. The selection accepts 1 to 12 notes. Tapping a selected note again removes it from the selection.

**FR-4.4** String filter: the user picks which strings are active (one or several). Inactive strings are dimmed and unlabeled. Default: all active.

**FR-4.5** Region filter: the user sets a start fret and an end fret. Positions outside the region are dimmed and unlabeled. Shortcuts offer the regions "frets 0–4", "5–9", "10–14", and "whole neck"; the limits can also be adjusted freely.

**FR-4.6** When a single note is selected, the system distinguishes the octaves: occurrences in the same octave share the same highlight tone, and a discreet number indicates the octave. With more than one note selected, the octave distinction is off by default and can be turned on through the Octave label type.

**FR-4.7** Putting a position in focus opens the **position card**, with:

- note name (both spellings, if altered) and octave;
- string and fret;
- a list of the other positions with the **same pitch** (unisons), emphasized on the fretboard while the card is open;
- the shortcuts **See every occurrence** (selects the note), **Triads from this note**, and **CAGED in this key** (FR-1.6).

**FR-4.8** Hidden mode: the **Hide names** command sets the label to No label on every position and suppresses the hover hint. The name appears only on the position card, after the user taps the fret. The system records neither hits nor misses.

**FR-4.9** The **Show** control switches between three background sets: naturals only (default), all notes, none (only the selected ones). Selected notes always appear, even when altered and with the background on "naturals only".

**FR-4.10** When the selection has exactly three notes that form a major, minor, diminished, or augmented triad, the system shows the triad name and the **View as triad** shortcut, which opens the Triads tool with the corresponding root and quality. For the augmented triad, which admits three roots, the system uses the first note selected as the root.

**FR-4.11** The **Clear** command removes the note selection and the string and region filters, keeping the label type and the background set.

**FR-4.12** The spellings of altered notes follow the accidental preference (FR-8.6). With the "both" option, the marker shows both spellings when there is room and, when there is not, the sharp spelling, with both on the position card.

**FR-4.13** The **Listen** command plays, in ascending order of pitch, the highlighted occurrences within the active filters, lighting up each one. It is available when 1 to 3 notes are selected.

---

## Area 5 — Triads tool

Answers the question: **what is a chord made of, and where is it?**

### Selection

**FR-5.1** Initial state: root C, major quality, root position, string set 3-2-1, Isolated view, Interval label.

**FR-5.2** Root: the user picks one of the twelve notes. The system calculates the three notes of the triad with the correct spelling (TM-4).

**FR-5.3** Spelling of an altered root: for the five roots with two spellings, the system defaults to the spelling that yields fewer accidentals for the chosen quality (table in TM-4.3) and offers a command to switch. The spelling chosen by the user holds until the user changes the root. When theory requires a double sharp or a double flat, the system displays it.

**FR-5.4** Quality: major, minor, diminished, or augmented. Inversion: root position (root in the bass), 1st inversion (third in the bass), or 2nd inversion (fifth in the bass).

**FR-5.5** String set: three adjacent strings.

| Instrument | Available sets |
|---|---|
| 6 strings | 6-5-4, 5-4-3, 4-3-2, 3-2-1 |
| 7 strings | 7-6-5, 6-5-4, 5-4-3, 4-3-2, 3-2-1 |

**FR-5.6** Every triad is shown in **close position**: the three notes on adjacent strings, one per string, within one octave. The system calculates the shape from the tuning in use (TM-5); there are no fixed, pre-drawn shapes.

### Views

**FR-5.7** Composition panel. Always visible, it shows:

- the triad name (for example, "A major — 1st inversion");
- the three notes, in the order root, third, fifth, with their markers;
- the intervals from the root and the stacking of thirds;
- the order of the notes from low to high in the current inversion.

| Quality | Intervals from the root | Stacking |
|---|---|---|
| Major | R – 3 – 5 | major third + minor third |
| Minor | R – ♭3 – 5 | minor third + major third |
| Diminished | R – ♭3 – ♭5 | minor third + minor third |
| Augmented | R – 3 – ♯5 | major third + major third |

**FR-5.8** **Isolated** view: the fretboard shows a single shape — that of the chosen root, quality, inversion, and set — at the lowest occurrence that fits on the fretboard. The other positions are hidden. When the same shape exists an octave higher within the fret count, the **Octave up** and **Octave down** commands switch between the occurrences.

**FR-5.9** **Full neck** view: the fretboard shows, on the chosen string set, every inversion of the triad that fits on the fretboard, in order along the frets. Each shape has a tag with the inversion name. The inversion selected in FR-5.4 is highlighted; the others are at normal emphasis. Tapping a tag selects that inversion.

**FR-5.10** **All notes** view: the fretboard shows every occurrence of the three notes on every string, with their function markers, without outlining shapes. The inversion and set controls are disabled in this view.

**FR-5.11** **Compare**: available in the Isolated and Full neck views. The user picks a second quality. The system overlays the two triads of the same root, inversion, and set:

- the common notes appear once;
- each note that differs appears in both positions, the one from the comparison triad with a dashed outline;
- an arrow links the two positions and shows the direction and size of the movement in frets;
- the composition panel shows the two formulas side by side, with the difference emphasized.

The comparison always happens in the same octave: if any note of the comparison triad falls below the open string, the system shows both triads an octave higher; if that exceeds the last fret, EC-5.4 applies.

Acceptance criterion: when comparing major with minor, exactly one note (the third) moves one fret toward the nut; when comparing minor with diminished, exactly one note (the fifth) moves one fret toward the nut; when comparing major with augmented, exactly one note (the fifth) moves one fret toward the body.

### Specific musical cases

**FR-5.12** Augmented triad: the composition panel states that the triad is symmetric — the three inversions have the same shape, and each of the three notes can be the root. In the Full neck view, the inversion tags still refer to the chosen root.

**FR-5.13** Diminished triad: the composition panel identifies the diminished fifth (♭5) as the characteristic note.

**FR-5.14** Span: the system calculates the span of the shape (distance between the lowest and the highest fretted fret, not counting open strings). Shapes with a span of five frets or more receive the "wide stretch" mark. The system does not hide shapes for difficulty.

**FR-5.15** Open strings: when the calculated shape uses fret 0, the system displays it normally.

### Shortcuts and sound

**FR-5.16** The **View in CAGED** shortcut opens the CAGED tool with the current root and quality (major or minor) and the Triad layer on (FR-1.6). It is unavailable for diminished and augmented, with the explanation that CAGED deals with major and minor chords.

**FR-5.17** The **Listen** command plays the displayed shape according to FR-7.3. In the Full neck view, it plays the inversions in sequence, from lowest to highest. In the All notes view, it plays the three notes once, in the lowest available octave.

---

## Area 6 — CAGED tool

Answers the question: **how does the whole neck connect?**

### Shapes

**FR-6.1** Initial state: key of C, major quality, all shapes visible, Chord layer, Interval label, connections off.

**FR-6.2** The user picks the key (twelve notes, spelled according to FR-5.3) and the quality (major or minor). The system shows the five shapes of the chord — C, A, G, E, and D — defined in TM-6 (major) and TM-7 (minor).

**FR-6.3** Each shape is identified by a tag next to its region of the fretboard ("C shape", "A shape"…; for minor, "Cm shape", "Am shape"…). The roots use the root marker. The tag also states the strings on which the shape has a root.

**FR-6.4** The shapes always appear along the fretboard in the cyclic order C → A → G → E → D → C…, toward the body. For each key, the first shape is the one that fits closest to the nut. The cycle continues to the last fret; a shape is drawn only if every note of the chord fits on the fretboard.

**FR-6.5** Focus on a shape: tapping the tag puts the shape in focus. The shape in focus is highlighted, the others are dimmed, and the fretboard centers the region. Tapping the tag again, or the **See all** command, leaves focus.

**FR-6.6** With a shape in focus, the **Next shape** and **Previous shape** commands move focus to the neighboring shape along the fretboard. At the end of the fretboard, the corresponding command is disabled.

**FR-6.7** **Show connections**: when on, the chord notes that belong to two neighboring shapes are emphasized with a connection marker. When moving from a shape in focus to its neighbor (FR-6.6), those notes stay highlighted during the transition, even with the control off. The connections between shapes are in TM-6.3.

### Layers

**FR-6.8** The user turns layers on and off over the shapes. The **Chord** layer is the base and cannot be turned off while it is the only one active.

| Layer | What it shows | Rule |
|---|---|---|
| Chord | The notes of the chord shape | TM-6, TM-7 |
| Triad | Close-position triads on three adjacent strings contained in the region of the shape | FR-6.11 |
| Arpeggio | Every triad note in the region of the shape | TM-6.4, TM-7.4 |
| Pentatonic | Major pentatonic (major shapes) or minor pentatonic (minor shapes) in the region | TM-6.5, TM-7.5 |
| Scale | Major scale (major shapes) or natural minor scale (minor shapes) in the region | TM-6.4, TM-7.4 |

**FR-6.9** Visual hierarchy of layers: chord notes always have the most emphasis; arpeggio notes not in the chord, intermediate emphasis; pentatonic and scale notes that do not belong to the triad, the least emphasis (outlined marker). The chord therefore stays readable with every layer on.

**FR-6.10** The Pentatonic and Scale layers can be on at the same time; in that case, the scale notes that do not belong to the pentatonic (the 4th and 7th degrees in major; the 2nd and 6th in minor) receive an additional mark that distinguishes them.

**FR-6.11** **Triad** layer: for each set of three adjacent strings, the system highlights the close-position triad whose three notes belong to the arpeggio of the shape, when one exists. With the layer on and a shape in focus, the user picks the string set; the **Open in Triads** shortcut leads to the Triads tool with the corresponding root, quality, inversion, and set.

**FR-6.12** With all shapes visible (no focus), only the Chord and Arpeggio layers can be displayed for the whole neck. The Triad, Pentatonic, and Scale layers require a shape in focus; if the user turns them on without focus, the system puts the first shape in focus. *[Assumption A-11: five scale patterns overlaid across the whole neck produce an unreadable view.]*

### Instrument

**FR-6.13** Seven strings: the chord shapes are drawn on the six higher strings. The Arpeggio, Pentatonic, and Scale layers include the seventh string, with the layer notes that lie within the fret region of the shape.

**FR-6.14** Non-compatible tuning (FR-2.12): the tool does not draw the shapes. In their place, it states that CAGED depends on the standard relationship between the strings and offers:

- **View in standard tuning** — displays the tool with AF-1 (or AF-21) in this view only, without changing the instrument preference, with a permanent badge stating the temporary tuning;
- **Go to Triads** — which works in any tuning.

**FR-6.15** Tuning compatible with an altered string (FR-2.12): the shapes are drawn normally on strings 5 to 1. On string 6, the system does not draw the original note of the shape; it displays, within the fret region of the shape, the notes of the active layer calculated from the real tuning, and marks the string as "altered".

**FR-6.16** In transposed compatible tunings (AF-2, AF-3, AF-22), the shapes have the same drawing as in standard tuning and the notes are calculated from the real tuning: the E shape played at fret 3 in AF-2 is a G♭ chord.

### Sound

**FR-6.17** The **Listen** command acts on the shape in focus and plays the widest layer that is on:

| Layer on | What plays |
|---|---|
| Chord only | The chord, from the lowest string to the highest, as a slow strum and then as a block |
| Triad | The selected triad (FR-7.3) |
| Arpeggio | The arpeggio ascending and descending, from the lowest to the highest note of the region |
| Pentatonic or Scale | The scale ascending and descending in the region, starting and ending on the lowest root of the region |

With no shape in focus, the command plays the chord of each shape in sequence, from the nut toward the body.

---

## Area 7 — Audio

**FR-7.1** Tapping a fretboard position produces the note at the real pitch of that position: the pitch of the open string in the tuning in use plus the fret number, in semitones (TM-1).

**FR-7.2** Every sound reflects the configured tuning. The same fret sounds different in different tunings.

**FR-7.3** Triad playback: first arpeggiated, from low to high, one note at a time; then the three notes as a block.

**FR-7.4** Comparison playback (FR-5.11): the first triad as a block, a short pause, the second triad as a block.

**FR-7.5** Arpeggio and scale playback: one note at a time, in a regular rhythm, ascending and then descending. The user picks one of three tempos: slow, medium, and fast.

**FR-7.6** During any playback, the position that sounds is emphasized on the fretboard in sync with the sound. The emphasis also occurs when the sound is muted.

**FR-7.7** Audio is enabled on the first user gesture that asks for sound. The system emits no sound before a user gesture.

**FR-7.8** A sound control, present in every tool, mutes and adjusts the volume. The state is stored on the device.

**FR-7.9** A new request for sound interrupts the playback in progress. A **Stop** command is available during sequence playback.

**FR-7.10** The timbre resembles a clean guitar string, with a defined attack and natural decay. Every note of the configured instrument — from the lowest open string to the highest fret of string 1 — sounds in tune and at a balanced perceived volume.

**FR-7.11** Playback stops when the application is no longer visible (tab switch, screen lock).

---

## Area 8 — Language and notation

**FR-8.1** The language and notation preferences are accessible from the home screen and from every tool.

**FR-8.2** Languages: English, Portuguese (Brazil), and Spanish. On the first visit, the system adopts the device language if supported; otherwise, English.

**FR-8.3** The language change is immediate, does not reload the page, and does not alter the tool state.

**FR-8.4** Note-name notation:

| Notation | Notes | Default in |
|---|---|---|
| Letters | C D E F G A B | English, Portuguese |
| Solfège | Dó Ré Mi Fá Sol Lá Si (Portuguese) · Do Re Mi Fa Sol La Si (Spanish and English) | Spanish |

Notation is independent of language: any combination is allowed. *[Assumption A-5 on the defaults per language.]*

**FR-8.5** The notation can be switched from a control in the bar of each tool, in addition to the preferences panel. The change is immediate and affects labels, selectors, the composition panel, tuning tags, and text descriptions.

**FR-8.6** Accidental preference for single notes (Notes tool and string names): sharps (default), flats, or both. In the Triads and CAGED tools, theory determines the spelling (TM-4), not this preference.

**FR-8.7** The accidental symbols are ♯ and ♭ (and the doubles 𝄪 and 𝄫), never "#" and "b", in every language and notation.

**FR-8.8** Interval labels use numbers and accidentals (♭3, 3, 5, ♭5, ♯5…), identical in the three languages. The root is labeled "R" in English and "T" in Portuguese and Spanish.

**FR-8.9** The names of the CAGED shapes always use the letters C, A, G, E, and D, in any notation, because they are names of shapes and not of notes. With the solfège notation, the system shows an explanation the first time the tool is opened: "The shapes are named after the open chords C (Do), A (La), G (Sol), E (Mi), and D (Re)".

**FR-8.10** Every interface text, including screen-reader descriptions, tuning names, notices, and empty states, exists in the three languages. Musical terms follow the current usage among guitarists of each language (trilingual glossary in file 10).

---

## Area 9 — On-device preferences

**FR-9.1** The system stores on the user's own device, without an account:

| Group | Items |
|---|---|
| Instrument | String count, tuning (preset or custom), fret count, handedness, string orientation |
| Language and notation | Language, notation, accidental preference |
| Appearance | Theme |
| Sound | Muted or not, volume, tempo |
| Navigation | Last tool used |
| Per tool | Preferred label type |

**FR-9.2** The system does not store the musical state of the tools (note, root, key, shape in focus, layers) between visits. Each visit starts in the initial state of the tool, except when opened by link (area 10). *[Assumption A-4.]*

**FR-9.3** No preference is sent to any server.

**FR-9.4** The "About" page offers the **Erase my preferences** command, which removes everything the application stored on the device and restores the defaults.

**FR-9.5** If the device does not allow data to be stored, the application works normally with the defaults and states, once per session, that preferences will not be remembered.

**FR-9.6** If the stored data is unreadable or belongs to an old, unrecognized format, the system keeps the valid items, discards the rest, and uses the defaults in their place, without showing an error.

---

## Area 10 — Sharing by link

**FR-10.1** Every tool has the **Share** command.

**FR-10.2** The command generates a link to the current view. On devices with their own sharing mechanism, the system triggers it; on the others, it copies the link and confirms the copy.

**FR-10.3** The link describes:

| Included | Not included |
|---|---|
| Tool | Language |
| Musical state of the tool (selections, filters, view, shape in focus, layers, comparison) | Notation and accidental preference |
| Label type | Handedness and string orientation |
| Instrument: string count, tuning, and fret count | Theme, sound, scroll position |

**FR-10.4** Opening a link leads directly to the tool in the described state, without passing through the home screen, applying the language, notation, handedness, and orientation of the person who opens it.

**FR-10.5** If the instrument in the link differs from the preferred instrument of the person who opens it, the system shows the view with the instrument from the link and a persistent notice with two actions: **Use mine** (recalculates the view with the local instrument) and **Adopt this one** (stores the instrument from the link as the preference). While neither action is taken, the instrument from the link applies only to that tool in that session and does not change the stored preference.

**FR-10.6** The address shown by the browser follows the state of the tool, so bookmarking the page or copying the address is equivalent to using the Share command.

**FR-10.7** Links generated by one version of the application remain valid in later versions. When a value no longer exists, the invalid-link handling applies (EC-10.1).

**FR-10.8** The link contains no data that identifies the person or the device.
