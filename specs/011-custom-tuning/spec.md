# Feature Specification: Custom Tuning

**Feature Branch**: `feature/011-custom-tuning`

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/003-your-instrument/003-custom-tuning.md (id 003, custom-tuning)." Source sections: FR-2.5 (Area 2), EC-2.1, EC-2.2, EC-2.6 (Area 2 edge cases), EC-5.1 (Area 5 edge cases), A-7, UJ-5 alternate path 3a.

## Clarifications

### Session 2026-10-03

Derived from a source (cited) or assumed default (marked **Default**, with rationale). No material question remains open, so no human escalation is needed.

- Q: What is the adjustment range per string? → A: FR-2.5 and A-7: from 7 semitones below to 4 semitones above that string's standard pitch, one semitone per step (12 positions per string). Limits per string, string 6 → 1: A1–G♯2, D2–C♯3, G2–F♯3, C3–B3, E3–D♯4, A3–G♯4. A string at its limit disables that direction's control with no error message (EC-2.6).
- Q: How is the Custom choice laid out in the panel? → A: **Default** (simplest model consistent with FR-2.4/FR-2.5 and the existing panel): "Custom" is the last entry of the tuning radio list, after AF-11. When the panel opens on a confirmed tuning that matches a preset, that preset is selected and the per-string controls are hidden. Choosing "Custom" selects it and reveals six string rows (string 6 at the top of the list down to string 1, i.e. low → high, matching the preset note order), each with a "lower" button, a note button showing the pitch, and a "raise" button. The rows stay revealed and "Custom" stays selected for the rest of that panel session, even when the pitches come to match a preset.
- Q: What does choosing "Custom" start from? → A: **Default**: the pending tuning at the moment Custom is chosen (a preset or the previous custom tuning), so the user adjusts from a familiar point. Choosing a preset afterwards replaces the pending pitches with the preset's; choosing Custom again starts from that preset. Adjustments are not kept separately (one rule, no hidden state).
- Q: When does a custom tuning take a preset's name? → A: FR-2.5: whenever the six pitches (note and octave) equal a preset's pitches. Matching is by pitch, not spelling. While "Custom" is selected, the panel shows a tuning-name line that reads the matched preset's name (e.g. "Drop D") or "Custom" when nothing matches. All eleven presets (AF-1 … AF-11) are reachable within the limits.
- Q: How is a matched custom tuning stored and shown after confirming? → A: **Default** (canonical form, avoids two representations of one tuning): a confirmed tuning whose pitches match a preset is the preset. It is stored as that preset, the badge and home summary use the preset's name, and reopening the panel selects that preset with the string rows hidden.
- Q: Which spelling applies? → A: Matched tunings use the preset's own spelling (**Default**, presets store their spelling, FR-005 of slice 009), including in the string rows while Custom is selected (Half step down shows E♭2 A♭2 D♭3 G♭3 B♭3 E♭4). Unmatched tunings follow the user's accidental preference (breakdown). Until that preference exists (005-languages-and-notation/002), every unmatched pitch uses sharps: natural letter when the pitch class is natural, otherwise the sharp of the letter below (C C♯ D D♯ E F F♯ G G♯ A A♯ B). The same spelling feeds every tool's open strings.
- Q: What does an unmatched tuning read on the badge and home summary? → A: **Default**: the name "Custom". The badge follows the existing rule (shown iff the confirmed tuning is not Standard), so an unmatched custom tuning always shows the "Custom" badge.
- Q: Does adjusting a string play sound? → A: Source (UJ-5 3a: "each adjustment can be heard") and the breakdown ("can play it"): each press of a lower/raise button plays the string's new open pitch, and activating the note button plays the current pitch without changing it. A new sound stops the previous one (FR-7.9). Existing mute, volume and audio-unlock rules apply; a press on a disabled control plays nothing.
- Q: What does "inverted order" mean? → A: EC-2.2 (macro-spec, authoritative over the breakdown's wording "lower-numbered", which would flag standard tuning itself): string n is inverted when its pitch is strictly lower than string n+1's (string 1 is the thinnest, string 6 the thickest; e.g. string 3 at A2 below string 4 at D3). The note "The strings are not in order from low to high" shows in the panel while any such pair exists in the pending tuning, and disappears when none does. Equal pitches are not inverted (EC-2.1). **Default**: the note is informational (not error red, non-blocking, one line, announced politely, Principle VII) and never disables Confirm.
- Q: How does Triads react when the confirmed tuning makes the current string set unable to close? → A: EC-5.1 + the acceptance criterion: Triads stays on the current set and shows the existing "does not close" guidance (empty fretboard, message, **Another set**, **See all notes**); a tuning change does not move the string set automatically. **Another set** moves to the nearest string set on which the current triad closes (existing slice-005 rule); when no set closes, that action is not offered and only **See all notes** shows. **See all notes** keeps its existing slice-006 C8 meaning: it switches Triads to the All notes view (the source breakdown names the action but no other destination; an earlier draft wording "opens Fretboard Notes" was an erratum, amended here to match the reused action — flagged for reviewer confirmation per Constitution IV).
- Q: How is a custom tuning stored? → A: Source: the stored-preferences contract (specs/010-remembered-preferences/contracts/storage-format.md, "Extension rule") — later slices add a new **optional** field and keep `version` 1. **Default** for the field's shape: `customTuning`, an array of exactly six integers, the semitone offsets from standard for strings 6 → 1 (low → high), each −7…+4. It is written only when the confirmed tuning matches no preset; then `tuning` is written as `AF-1`. On read, a valid `customTuning` wins over `tuning`; a valid one whose pitches match a preset loads as that preset; an invalid one (not an array, wrong length, non-integer or out-of-range element) is ignored, so the tuning falls back to `tuning` (Standard for records this slice writes). New fixtures are added (never removed): a valid custom record, a custom record matching Drop D, wrong length, out of range, non-integer, and non-array.
- Q: What do Restore default and the fret count do with a custom tuning? → A: FR-2.11: Restore default sets Standard (and hides the string rows, Standard selected). Fret count is independent of the tuning (FR-2.8) and keeps its value when the tuning changes.
- Q: Does the panel preview follow the custom pitches? → A: FR-2.4 (preview of the selected tuning): yes, the preview fretboard always reflects the pending pitches, including while adjusting.
- Q: Do custom tunings affect the CAGED classification? → A: Out of scope here; CAGED does not exist yet. The tuning's pitches are the only input a later slice needs.
- Q: Seven strings, capo, share links? → A: Out of scope. Seven strings follow the same rules once 003-your-instrument/004 exists; capo is open question Q-6; share links (EC-10.4) belong to the sharing wave.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Set each string to my own tuning (Priority: P1)

A player uses a tuning no preset covers. They open the instrument panel, choose "Custom", move each string up or down one semitone at a time, see the resulting note and octave per string, confirm, and every tool shows and plays notes from that tuning.

**Why this priority**: This is the whole feature. Without it, players with unlisted tunings get wrong notes everywhere.

**Independent Test**: Open the panel, choose Custom, adjust strings, confirm, and check the fretboard labels and played pitches against the expected notes.

**Acceptance Scenarios**:

1. **Given** standard tuning, **When** the user chooses Custom and lowers string 6 by two semitones, **Then** the panel shows D2 for string 6 and the preview fretboard shows D on string 6's open position.
2. **Given** a custom tuning with strings adjusted and confirmed, **When** the user opens Fretboard Notes or Triads, **Then** note names, octaves, shapes, and sounds are calculated from the custom pitches.
3. **Given** string 1 at its lowest allowed pitch (A3), **When** the user looks at that string's lower button, **Then** it is disabled and no error message appears; the raise button stays enabled.
4. **Given** string 6 at its highest allowed pitch (G♯2), **When** the user looks at its raise button, **Then** it is disabled and no error message appears.
5. **Given** a custom tuning, **When** the user closes the panel without confirming, **Then** the previous instrument remains and the adjustments are discarded.
6. **Given** the Custom choice from Standard, **When** the user lowers string 1 by 7 semitones, **Then** its lower button becomes disabled and the string shows A3.
7. **Given** an unmatched custom tuning with sharps in use (the only option for now), **When** the panel shows a string that needs an accidental, **Then** it is spelled with ♯ (for example, from Standard, string 6 raised one semitone shows F2, raised two shows F♯2).
8. **Given** the panel opened on Standard, **When** the user chooses Custom, **Then** six string rows appear (string 6 first, string 1 last) showing E2 A2 D3 G3 B3 E4, each with a lower button, a note button and a raise button.
9. **Given** Custom chosen with adjustments, **When** the user chooses Restore default, **Then** Standard is selected, the string rows are hidden, and the fret count returns to 22 (FR-2.11).
10. **Given** Half step down confirmed, **When** the user chooses Custom and lowers string 6 by one semitone, **Then** string 6 shows D2 and the other strings switch to sharps (G♯2 C♯3 F♯3 A♯3 D♯4), the tuning-name line reads "Custom".

---

### User Story 2 - Hear each string as I tune it (Priority: P1)

While adjusting, the player can hear what each string will sound like so they can match it to their instrument.

**Why this priority**: Without sound the player has to guess whether the panel matches the guitar in their hands. It is part of the core promise and the acceptance criteria.

**Independent Test**: Adjust a string and tap its note; check the pitch played equals the displayed note and octave.

**Acceptance Scenarios**:

1. **Given** the Custom choice with string 6 lowered by two semitones, **When** the user activates that string's note button, **Then** D2 plays.
2. **Given** any adjusted string, **When** the user activates its note button, **Then** its new pitch plays, and the note on screen and the pitch heard agree.
3. **Given** the user presses a lower or raise button, **When** the string changes pitch, **Then** the new pitch plays, stopping any sound still playing.
4. **Given** a disabled lower or raise button at a limit, **When** the user activates it (click or tap), **Then** nothing changes and nothing plays.
5. **Given** sound is muted or not yet unlocked, **When** the user activates a note button, **Then** behavior follows the existing mute and unlock rules, and the panel still works without sound.
6. **Given** a keyboard-only user, **When** they focus a string's note button and press Enter or Space, **Then** the pitch plays.

---

### User Story 3 - See when my tuning is a known one (Priority: P2)

The player gets confirmation that their adjustments make a named tuning, and that the named tuning is correct.

**Why this priority**: It teaches players the name of what they tuned, and keeps the home summary and badge meaningful. It does not block use.

**Independent Test**: Adjust strings until the pitches equal a preset; check the panel, summary, and badge show the preset's name.

**Acceptance Scenarios**:

1. **Given** the Custom choice from Standard, **When** the user lowers string 6 by two semitones, **Then** the panel's tuning-name line reads "Drop D" while Custom stays selected and the string rows stay visible.
2. **Given** the panel shows "Drop D" for a custom tuning, **When** the user raises string 6 by one semitone, **Then** the name changes to "Custom" (no preset matches).
3. **Given** a custom tuning named "Drop D" is confirmed, **When** the user reopens the panel, **Then** the Drop D preset is selected, the string rows are hidden, and the badge reads "Drop D".
4. **Given** a confirmed custom tuning that matches Half step down, **When** the user views the home summary or the badge, **Then** it reads "Half step down" and the preset's flat spelling is used.
5. **Given** a confirmed custom tuning matching no preset, **When** the user views the home summary or the badge, **Then** it reads "Custom".

---

### User Story 4 - Unusual set-ups are allowed (Priority: P2)

A player sets two strings to the same pitch, or puts a string below its lower-numbered neighbor. The system accepts it, says so when the order is odd, and keeps every tool working.

**Why this priority**: Real players use unusual set-ups; blocking them loses trust. But it affects fewer players than the main flow.

**Independent Test**: Tune string 3 to the pitch of string 2 and confirm; open Triads on set 3-2-1; check the guidance and both actions.

**Acceptance Scenarios**:

1. **Given** the Custom choice, **When** the user tunes string 3 to the same pitch as string 2, **Then** the tuning is accepted with no error and no blocking.
2. **Given** that tuning confirmed, **When** the user opens Triads on string set 3-2-1, **Then** the fretboard is empty and shows "This triad does not close on this string set with the current tuning" with the actions **Another set** and **See all notes**.
3. **Given** the empty-fretboard guidance, **When** the user chooses **Another set**, **Then** Triads moves to the nearest string set on which the triad closes; **When** they choose **See all notes**, **Then** Triads switches to its All notes view (the triad's notes everywhere on the neck), keeping inversion, string set, and occurrence (slice 006 C8).
4. **Given** Triads open on set 3-2-1 under Standard, **When** the user confirms a tuning with string 3 equal to string 2, **Then** Triads stays on set 3-2-1 and shows the guidance (it does not move the set by itself).
5. **Given** the Custom choice from Standard, **When** the user lowers string 3 by 6 semitones to C♯3 (below string 4 at D3), **Then** the panel shows "The strings are not in order from low to high" in a non-error style and Confirm stays enabled.
6. **Given** the order note is showing, **When** the user adjusts the strings back into order, **Then** the note disappears.
7. **Given** a tuning with two strings at the same pitch, **When** the user opens Fretboard Notes, **Then** every note on every string still shows correctly.
8. **Given** a Triads string set that is in order and closes normally on the same custom tuning, **When** the user opens it, **Then** the shape shows normally.

---

### User Story 5 - My custom tuning is remembered (Priority: P2)

Custom tunings are stored like any other preference. On the next visit the instrument is as the user left it.

**Why this priority**: Required for the feature to be useful across sessions, but it builds on the preference storage that already exists.

**Independent Test**: Confirm a custom tuning, reload, and check the instrument and panel show the same tuning.

**Acceptance Scenarios**:

1. **Given** a confirmed custom tuning, **When** the user reloads or returns later, **Then** the same tuning is active and the panel shows the same per-string notes.
2. **Given** stored data whose `customTuning` is not an array, has a length other than six, or has a non-integer or out-of-range (< −7 or > +4) element, **When** the page loads, **Then** the tuning falls back to the record's `tuning` field (Standard for records this feature writes), other valid fields are kept, and nothing throws into the interface.
3. **Given** stored data with a valid `customTuning` whose pitches equal Drop D, **When** the page loads, **Then** the instrument is Drop D with the preset's name and spelling.
4. **Given** a user who erases preferences, **When** the page reloads, **Then** the custom tuning is gone and Standard is active.
5. **Given** preferences stored before this feature existed, **When** the page loads, **Then** they open unchanged.
6. **Given** storage is blocked or full, **When** the user confirms a custom tuning, **Then** it applies for the session and no error appears (the same as other preferences).

---

### Edge Cases

- Every string at its lowest limit or highest limit: allowed; disabled controls follow each string's own limits.
- A custom tuning with all offsets 0 equals Standard: the tuning-name line reads "Standard"; once confirmed it is stored as Standard and no badge shows.
- Spelling never affects matching: pitches reached by adjusting are compared by note and octave, so a tuning that would read G♯ under the sharps rule still matches a preset that spells it A♭, and then shows A♭.
- Panel opened again after confirming an unmatched custom tuning: Custom is selected and the string rows are visible with the confirmed values. After confirming a matched one: the preset is selected and the rows are hidden.
- Switching from Custom to a preset and back inside one open panel: Custom restarts from the preset's pitches; earlier adjustments are not kept.
- Fret count and other panel settings change independently of the tuning.
- Rapid repeated presses on a lower/raise button: each press moves one semitone and plays the new pitch (stopping the previous sound); the button disables at the limit and no press goes beyond it.
- Focus at a limit: when the focused lower/raise button becomes disabled, focus moves to that string's note button, so keyboard focus is never lost.
- Confirming pitches identical to the active tuning is a no-change confirm (existing rule): nothing is rewritten and no adjust notice shows.
- No set closes: when no string set lets the current triad close, the guidance shows only **See all notes**.
- A tuning that makes some Triads sets close and others not: only affected sets show the guidance.
- A tuning change while a tool shows content impossible in the new tuning: the existing adjust-and-tell behavior applies (existing notice).
- Screen reader users: each note button's accessible name includes the string number and the note in full ("String 6, D 2"; "String 2, A sharp 3"), lower/raise buttons are named "Lower string n" / "Raise string n" and announced as disabled at a limit, and the tuning-name line and order note are announced politely when they change.
- Text zoom up to 200% and 320 px width: the six string rows stay readable without overlap, and only the fretboard scrolls horizontally.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The instrument panel MUST offer a "Custom" choice as the last entry of the tuning list, after the eleven presets. Choosing it MUST reveal six string rows (string 6 first, string 1 last), each with a lower button, a note button and a raise button, starting from the pending tuning's pitches. The rows MUST stay revealed, and Custom selected, for the rest of that panel session. Choosing a preset MUST replace the pending pitches with the preset's and hide the rows.
- **FR-002**: In Custom, each of the six strings MUST be adjustable up or down by one semitone per step, from 7 semitones below to 4 semitones above that string's standard pitch.
- **FR-003**: For each string, the panel MUST show the resulting note and octave.
- **FR-004**: Each press of a lower/raise button MUST play the string's new open pitch, and activating a note button MUST play that string's current pitch without changing it. A new sound MUST stop the one playing. Existing mute, volume and audio-unlock rules apply.
- **FR-005**: At a limit, the control for that direction MUST be disabled and MUST NOT show an error message.
- **FR-006**: Adjusting the strings MUST NOT change the confirmed instrument until the user confirms; closing without confirming MUST discard the changes.
- **FR-007**: While Custom is selected, the panel MUST show a tuning-name line reading the name of the preset whose six pitches (note and octave) equal the pending pitches, or "Custom" when none does; the matched preset's own spelling MUST apply to the string rows. A confirmed tuning that matches a preset MUST become that preset: same name on the badge and home summary, same spelling in every tool, and reopening the panel selects that preset with the rows hidden.
- **FR-008**: When the pitches match no preset, the tuning MUST be named "Custom" on the panel, home summary, and tuning badge, and the badge MUST show (the tuning is not Standard).
- **FR-009**: Note names of an unmatched custom tuning MUST follow the user's accidental preference. Until that preference exists, each open string MUST be spelled with its natural letter when the pitch class is natural, otherwise as the sharp of the letter below (C C♯ D D♯ E F F♯ G G♯ A A♯ B), in the panel and in every tool.
- **FR-010**: The system MUST accept two or more strings at the same pitch.
- **FR-011**: The system MUST accept a string pitched lower than its higher-numbered neighbor, and the panel MUST show "The strings are not in order from low to high" while any string n has a strictly lower pitch than string n+1 in the pending tuning, and remove it when none does. The note MUST be informational (no error color), non-blocking, and MUST NOT disable Confirm.
- **FR-012**: All tools MUST calculate notes, shapes, and sound from the custom pitches exactly as they do for presets.
- **FR-013**: When a Triads string set cannot hold a close-position shape (strings in unison, inverted order, or an interval that needs negative frets in every octave), Triads MUST show an empty fretboard with "This triad does not close on this string set with the current tuning" and the actions **Another set** and **See all notes**.
- **FR-014**: **Another set** MUST move Triads to the nearest string set on which the current triad closes, and MUST NOT be offered when no set closes; **See all notes** MUST switch Triads to its All notes view, keeping inversion, string set, and occurrence (existing slice-006 C8 action, reused unchanged). A tuning change MUST NOT move the Triads string set by itself when the set stops closing; the guidance shows instead.
- **FR-015**: A confirmed custom tuning MUST be stored with the other preferences, restored on the next visit, and erased when the user erases preferences.
- **FR-016**: The custom tuning MUST be stored as a new optional field `customTuning` in the existing version-1 preferences record (no version bump, per the 010 storage contract's extension rule): an array of exactly six integers, the offsets from standard for strings 6 → 1, each −7 to +4. It MUST be written only for an unmatched tuning, with `tuning` written as `AF-1`; a matched tuning MUST be written as its preset id with no `customTuning`. On load, a valid `customTuning` MUST take precedence over `tuning` and MUST load as a preset when its pitches match one; an invalid one (non-array, length ≠ 6, any non-integer or out-of-range element) MUST be ignored so the tuning falls back to `tuning`, without disturbing other fields and without throwing. Fixture records for these cases MUST be added to the preferences fixture suite.
- **FR-017**: Preferences stored before this feature MUST keep loading with no change in behavior.
- **FR-018**: All new user-facing text, including the order note and the guidance, MUST come from the message catalog; note names MUST come only from the notation module with ♯ ♭ glyphs.
- **FR-019**: The Custom controls MUST be keyboard-operable with visible focus, touch targets of at least 44×44 CSS px, accessible names that include the string number and note, and no information carried by color alone.
- **FR-020**: Custom tunings MUST NOT include seven-string tunings or capo support.
- **FR-021**: The panel preview fretboard MUST reflect the pending pitches at every adjustment.
- **FR-022**: Restore default MUST set Standard tuning and hide the string rows; the fret count MUST be unaffected by tuning adjustments.
- **FR-023**: When a focused lower/raise button becomes disabled at a limit, focus MUST move to that string's note button.

### Key Entities

- **Custom tuning**: Six per-string offsets in semitones, strings 6 → 1, each an integer from −7 to +4, relative to that string's standard pitch. Determines six absolute pitches. A set of offsets whose pitches equal a preset is that preset (canonical form).
- **Tuning identity**: Either a preset (name and spelling from the preset) or "Custom" (sharps spelling until the accidental preference exists). Derived from the six pitches, never entered separately.
- **String adjustment state**: Pending offsets and whether the string rows are revealed, while the panel is open; discarded if the panel closes without confirming.
- **Stored preference**: The version-1 record's `tuning` (preset id) plus the optional `customTuning` offsets array, written only for an unmatched custom tuning.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From Standard, a user reaches Drop D by choosing Custom and pressing string 6's lower button twice, and sees "Drop D" named.
- **SC-002**: Across all 6 strings, every position from the lower to the upper limit (12 positions per string) shows the correct note and octave and plays that pitch, verified by automated tests against the theory reference.
- **SC-003**: 100% of adjustment controls at a limit are disabled with no error message, for every string and both directions.
- **SC-004**: 100% of custom tunings that equal a preset by pitch are named with the preset's name.
- **SC-005**: Every acceptance scenario above has an automated test, including the unison Triads guidance on set 3-2-1.
- **SC-006**: A custom tuning survives a reload in 100% of runs where storage works, and loading damaged stored data never produces an error screen.
- **SC-007**: The panel's change-to-update time stays within the existing budgets (control change to fretboard update ≤ 100 ms, instrument change ≤ 300 ms) and the initial script size stays within the existing limit.
- **SC-008**: Zero accessibility violations on the panel in Custom state on phone and desktop sizes, and the layout holds at 320 px and 200% text zoom.

## Assumptions

- The instrument panel, preset tunings, and remembered preferences from the earlier slices exist and are reused; this slice adds the Custom choice, per-string controls, the tuning name matching, and storage of custom offsets.
- Seven strings, capo support (open question Q-6), and the accidental-preference choice (languages-and-notation slice) are out of scope; sharps are used until that choice exists.
- Custom tuning applies to six strings only.
- The audio, mute, and unlock behavior of earlier slices apply unchanged to string playback in the panel.
- The existing empty-Triads guidance mechanism and its actions can be reused for the "does not close" case, which this slice must make reachable for custom tunings.
- The format-version rule for stored preferences applies: older stored data keeps opening.
