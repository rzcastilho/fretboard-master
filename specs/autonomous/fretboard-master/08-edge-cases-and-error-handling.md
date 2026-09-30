# 08 — Edge cases and error handling

The identifiers `EC-area.number` follow the areas of file 03.

## Principles

1. **The application never goes blank.** Every error has a fallback view that is still useful.
2. **Adjust and tell.** When a choice is no longer possible, the system adopts the nearest equivalent and says what changed, in one line.
3. **No technical language.** Messages say what happened in terms of the instrument and offer an action.
4. **Notices do not block.** No notice in this list is a window that prevents use; all of them are discreet, dismissible bars or notes.

---

## Area 1 — Structure and navigation

| Id | Situation | Behavior |
|---|---|---|
| EC-1.1 | Loading in progress | The home screen appears first as a skeleton (cards without thumbnails); no full-screen progress indicator |
| EC-1.2 | Address of a screen that does not exist | The home screen opens with the notice "We could not find that page" |
| EC-1.3 | Unexpected failure in a tool | The tool shows "Something went wrong in this view" with the actions **Reset tool** and **Go to home**; the other tools and the preferences are not affected. The failure is recorded (NFR-8.1) |
| EC-1.4 | Window resized or device rotated during use | The layout rearranges without losing state; the fretboard keeps the highlighted region visible |
| EC-1.5 | New version published with the application open | Nothing changes in the session in progress (NFR-7.4) |

## Area 2 — Instrument

| Id | Situation | Behavior |
|---|---|---|
| EC-2.1 | Custom tuning with two strings at the same pitch | Allowed. The tools work; in Triads, sets that include both strings may have no close-position shape (EC-5.1) |
| EC-2.2 | Custom tuning with a string lower than its higher-numbered neighbor (inverted order) | Allowed, with a note in the panel: "The strings are not in order from low to high". Triads applies EC-5.1 to the affected sets |
| EC-2.3 | An instrument change makes the current view impossible (a set with string 7 when moving to 6 strings; a shape in focus that no longer fits after reducing the frets; a region filter beyond the last fret) | The system adjusts to the nearest equivalent — neighboring string set, same shape in another octave or neighboring shape, clipped region — and states: "We adjusted the view to the new instrument" |
| EC-2.4 | Fret count reduced with the fretboard scrolled beyond the new limit | The fretboard scrolls to the last fret |
| EC-2.5 | Change to a non-compatible tuning with CAGED open | The tool moves to the state of FR-6.14 |
| EC-2.6 | Adjustment limit reached in the custom tuning | The up or down control is disabled on that string; no error message |
| EC-2.7 | Panel closed without confirming | The changes are discarded; the previous instrument remains |

## Area 3 — Fretboard

| Id | Situation | Behavior |
|---|---|---|
| EC-3.1 | Two markers on the same position (comparison; overlapping layers) | A single marker, with the function of highest priority: chord > arpeggio > pentatonic > scale. For comparison, see FR-5.11 |
| EC-3.2 | Label that does not fit in the marker (double accidentals, dual spelling, long names such as "Sol♯") | The text shrinks to a minimum legible size; below it, the label abbreviates and the full name appears on the card or in the hint |
| EC-3.3 | Tap between two positions | Selects the position whose center is nearest |
| EC-3.4 | Drag that starts on a marker | Treated as scrolling if the finger moves beyond a small threshold; otherwise, as a tap |
| EC-3.5 | Pinch gesture on the fretboard | Switches between the two modes of FR-3.14; there is no free zoom. *[Assumption A-10.]* |
| EC-3.6 | Fretboard with 24 frets and 7 strings on a 320-wide screen | Comfortable mode is the default; the minimap is always visible |
| EC-3.7 | No position to display | The fretboard appears empty, with one overlaid guidance line specific to the tool (EC-4.1, EC-5.2, EC-6.1) |

## Area 4 — Fretboard Notes

| Id | Situation | Behavior |
|---|---|---|
| EC-4.1 | Background "none" with no notes selected | Empty fretboard with the guidance "Pick a note or tap a fret" |
| EC-4.2 | Every string turned off in the filter | Not allowed: the last active string cannot be turned off |
| EC-4.3 | Region with a start fret greater than the end fret | The limits correct each other: moving one past the other pushes the other |
| EC-4.4 | Selected note with no occurrence within the active filters | Guidance "There is no [note] in this region" with the action **Widen region** |
| EC-4.5 | Twelve notes selected | Equivalent to "all notes" highlighted; the Listen command is unavailable (FR-4.13) |
| EC-4.6 | Position in focus with no unison on another string | The card states "This pitch exists only at this position" |
| EC-4.7 | Three notes selected that do not form a supported triad | The "View as triad" shortcut does not appear; no message |

## Area 5 — Triads

| Id | Situation | Behavior |
|---|---|---|
| EC-5.1 | Tuning in which the string set does not admit the close-position shape (strings in unison, inverted order, or an interval so large that the shape would require negative frets in every octave of the fretboard) | Empty fretboard with the guidance "This triad does not close on this string set with the current tuning" and the actions **Another set** and **See all notes** |
| EC-5.2 | The requested shape exists only above the last fret | The system looks for the same shape an octave lower; if there is none, it shows the guidance "This shape lies beyond fret [n]" with the action **See all notes** |
| EC-5.3 | Full neck view with only one or two inversions fitting on the fretboard | Shows the ones that fit; no message |
| EC-5.4 | Comparison in which the second triad fits neither in the same octave nor in the octave above | The notes of the second triad that fit are displayed; the one that does not fit is indicated by an arrow pointing off the fretboard, with the note name |
| EC-5.5 | Comparison of a quality with itself | Not offered: the comparison list excludes the current quality |
| EC-5.6 | Spelling with a double accidental (for example, D♯ major: D♯–F𝄪–A♯) | Displayed as theory requires; the composition panel adds a line with the equivalent sound ("F𝄪 sounds as G") and suggests the simpler enharmonic spelling of the root |
| EC-5.7 | Shape that uses open strings | Displayed normally; the span is calculated from fretted notes only (FR-5.14) |
| EC-5.8 | Two inversions of the augmented triad with the same shape | Expected; handled by FR-5.12 |
| EC-5.9 | Root changed with comparison active | The comparison stays, recalculated for the new root |

## Area 6 — CAGED

| Id | Situation | Behavior |
|---|---|---|
| EC-6.1 | Non-compatible tuning | The state described in FR-6.14, in place of the fretboard |
| EC-6.2 | Shape whose lowest occurrence would require frets below the nut | The shape appears in the next octave; the first shape on the fretboard becomes the next in the cycle (FR-6.4) |
| EC-6.3 | Fretboard with 12 frets, where not all five shapes fit | Shows the ones that fit; a note states "With [n] frets, [k] shapes fit on the fretboard" |
| EC-6.4 | Shape in focus that partly exceeds the last fret with scale layers on | The chord shape determines whether the occurrence is drawn (FR-6.4); layer notes beyond the last fret simply do not appear |
| EC-6.5 | Shape in open position with a layer note that would fall below the open string | The note is omitted in that occurrence (TM-6.6, TM-7.1) |
| EC-6.6 | Two occurrences of the same shape on the fretboard (for example, fret 0 and fret 12) | Both receive the same tag; focus applies to one occurrence at a time |
| EC-6.7 | Triad layer on a string set with no close-position triad inside the shape | The set appears as unavailable in the selector, with the explanation "In this shape there is no close-position triad on these strings" |
| EC-6.8 | Root carried over from Triads with a double-accidental spelling or an unusual key (for example, A♯ major) | Accepted; EC-5.6 applies |
| EC-6.9 | Temporary tuning (FR-6.14) and the user leaves the tool | The temporary tuning is discarded; the preferred instrument applies again |
| EC-6.10 | Altered string (FR-6.15) with no layer note inside the region | The string has no markers in the region; the "altered" mark remains |

## Area 7 — Audio

| Id | Situation | Behavior |
|---|---|---|
| EC-7.1 | Audio cannot start or the sound material did not load | A single notice in the session: "Sound is not available on this device right now". The sound control shows the unavailable state; the visual emphasis of playback keeps working (FR-7.6) |
| EC-7.2 | Device in silent mode or system volume at zero | The application does not detect it; the help of the sound control lists this cause as the first check |
| EC-7.3 | Fast, successive taps on positions | Each tap interrupts the previous one (FR-7.9); sounds do not pile up |
| EC-7.4 | Sequence playback and a state change in the middle | Playback stops |
| EC-7.5 | Application becomes visible again after FR-7.11 | Sound does not resume automatically |
| EC-7.6 | Very low pitch (seventh string in a low tuning) on a small speaker | No special handling beyond FR-7.10; the timbre contains enough harmonics for the note to be recognizable |
| EC-7.7 | Audio output switched during use (headphones connected or removed) | The playback in progress may stop; the next sound request works normally |

## Area 8 — Language and notation

| Id | Situation | Behavior |
|---|---|---|
| EC-8.1 | Device language not supported | English (FR-8.2) |
| EC-8.2 | Regional variant (European Portuguese, Spanish of any country, any variant of English) | Uses the available base language |
| EC-8.3 | Text missing in one language through a content failure | Shows the English text at that point; the absence is recorded (NFR-8.1) |
| EC-8.4 | Solfège notation with CAGED shapes | The shapes stay named by letters (FR-8.9) |
| EC-8.5 | "Flats" preference and an open string tuned to an altered note | The string name uses the preference (for example, E♭), except when the preset tuning has its own spelling defined in TM-2 |

## Area 9 — Preferences

| Id | Situation | Behavior |
|---|---|---|
| EC-9.1 | Local storage unavailable or blocked | FR-9.5: works with defaults; a single notice per session |
| EC-9.2 | Stored data unreadable or partly invalid | FR-9.6: keeps what is valid, defaults for the rest, no notice |
| EC-9.3 | Storage full | The write fails silently; the preferences hold until the end of the session |
| EC-9.4 | Two tabs open with different preferences | The last write wins; the other tab adopts the change at its next opening, not during use |
| EC-9.5 | Private browsing | Equivalent to EC-9.1 or to preferences that last only for the session, depending on the browser |
| EC-9.6 | "Erase my preferences" | Asks for confirmation in one line; after confirmation, restores the defaults and returns to the home screen |

## Area 10 — Link

| Id | Situation | Behavior |
|---|---|---|
| EC-10.1 | Link with missing, unknown, or out-of-range values | Each invalid value is replaced with the tool default; the valid ones are kept. If a replacement happened, notice: "This link was incomplete; we show the closest view possible". Unrecognized tool → home screen with the same notice |
| EC-10.2 | Link with a musical state that is impossible on the instrument in the link (nonexistent string set, shape beyond the frets) | EC-2.3 applies |
| EC-10.3 | Automatic copy or sharing unavailable or declined | The link appears in a selectable field with the instruction "Copy this address" |
| EC-10.4 | Link with a custom tuning | Accepted; the notice of FR-10.5 lists the string notes instead of a name |
| EC-10.5 | Link with a format version newer than the open application | Treated as EC-10.1 |
| EC-10.6 | The user picks "Use mine" and the view is impossible on their instrument | EC-2.3 applies |
| EC-10.7 | Link with a non-compatible tuning opened in the CAGED tool | State of FR-6.14 |
