# Feature Specification: Left-Handed Mode and String Orientation

**Feature Branch**: `feature/013-left-handed-and-orientation`

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/003-your-instrument/005-left-handed-and-orientation.md (id 005, left-handed-and-orientation)." Source sections: FR-2.2, FR-2.6, FR-2.7, FR-2.11, design §6 (fretboard in detail), ARCH-5, structural decisions (handedness only at drawing time), TM-9 view 22 (left-handed samples), data model (presentation-only fields), UJ-5.

## Clarifications

### Session 2026-10-03

Each answer derives from a cited source or is an assumed default (marked **Default**, with rationale). No material question remains open.

- Q: What do the two settings mean? → A: FR-2.6/FR-2.7. Handedness: right (default; nut on the left, frets increase to the right) or left (mirrored horizontally; nut on the right, frets increase to the left). String orientation: highest string on top (default, as in tablature) or lowest string on top (as a player sees the neck looking down). The two are independent: four combinations, all valid.
- Q: Do the settings change musical content? → A: No (data model; ARCH-5). They change only where things are drawn. String 3 stays string 3, fret 5 stays fret 5; theory, shapes, sound, spelling, and tool view state are identical in every combination. Tapping string 6 draws at the top under lowest-on-top but still plays E2 in standard tuning.
- Q: Which elements follow the mirroring? → A: Everything with a direction: fret numbers, the nut, the open-string column, the string label column (string number + open-string note, FR-3.4), inlays, shape and inversion tags (and the order they run in), comparison arrows, the region-focus band, keyboard arrow navigation along a string, and the screen-reader reading order. **Default** (design §6 "open strings drawn before the nut, in their own column"; FR-3.4 "next to the nut"): the horizontal order from the outer edge inward is always label column → open-string column → nut → fret 1 → … → last fret; in left-handed mode that order runs from the right edge leftward. Testable: in left-handed mode the label column is the rightmost column and fret N's center is left of fret N−1's.
- Q: Where do fret numbers and tags sit vertically? → A: Design §6: shape/inversion tags "above the fretboard"; fret numbers "below the fretboard (or above, depending on orientation), always on the edge opposite the shape tags"; brief: "whatever the orientation". **Default** (the only reading that honours both "depending on orientation" and the opposition rule): highest-on-top → tags above, fret numbers below (today's layout); lowest-on-top → the vertical layout flips: fret numbers above, tags below. Handedness never changes either edge. Testable: in all four combinations the tag row and fret-number row are on opposite edges, and the fret-number row is below the board iff orientation is highest-on-top.
- Q: What does the screen reader hear? → A: FR-2.6: reading order always runs from the nut toward the body, in both handedness modes. Tabbing or arrowing "forward" moves away from the nut. Position and fret announcements use musical terms (string number, fret number, note), unchanged by either setting.
- Q: What do "next" and "previous" mean when mirrored? → A: FR-2.6, FR-3.17. Musical meaning never changes: "next"/"forward" along a string = one fret higher (away from the nut, toward the body); "previous" = one fret lower. Only the physical key follows the drawing. **Default** (code already routes keys through the single orientation mapping, `moveFocus`/`screenOrder`): right-handed → ArrowRight = fret +1, ArrowLeft = fret −1; left-handed → ArrowLeft = fret +1, ArrowRight = fret −1. ArrowUp/ArrowDown always move to the string drawn above/below (under lowest-on-top, ArrowUp from string 5 goes to string 6). No wrapping at edges (unchanged). The app has no swipe gesture or "next shape/inversion" command today; this feature adds none. Any such command added later (e.g. CAGED Next shape, FR-6.6) MUST take its direction from the same mapping. Screen-reader announcements never say "left"/"right".
- Q: Where is the setting changed? → A: FR-2.2: in the instrument panel, alongside string count, tuning, and frets. Like every panel choice it is pending until confirmed, discarded if the panel is closed without confirming (EC-2.7), and the panel preview shows the pending handedness and orientation.
- Q: Are they stored? → A: Yes, as preferences (brief). Source: stored-preferences contract (specs/010-remembered-preferences/contracts/storage-format.md, "Extension rule"; 011 and 012 extensions). **Default**: two new optional fields `"handedness": "right" | "left"` and `"orientation": "highest-top" | "lowest-top"` (same literals as the instrument model); any other value, type, or absence loads as the default (right, highest-top); each is validated independently so one invalid field never discards the other or any other preference; `version` stays 1 because the change is additive. New fixtures (only added): `left-only` `{"version":1,"handedness":"left"}` → left, highest-top; `lowest-only` `{"version":1,"orientation":"lowest-top"}` → right, lowest-top; `bad-handed` `{"version":1,"handedness":"LEFT","orientation":"lowest-top","tuning":"AF-2"}` → right, lowest-top, AF-2. The existing `future` fixture (version 7, `handedness:"left"`) keeps its expected result (rest defaults).
- Q: Are they in share links? → A: No. Brief scope boundary and data model: links carry no handedness or orientation; whoever opens a link sees it in their own handedness and orientation (FR-10.4). Share links are in any case a later wave.
- Q: What does Restore default do? → A: FR-2.11: sets right-handed and highest string on top, along with the other defaults.
- Q: What about the home-screen instrument summary, thumbnails and panel preview? → A: FR-1.3 / UJ "6 strings · standard tuning · right-handed": the summary's last segment states the handedness in use ("right-handed" or "left-handed", localized in en/pt/es). **Default**: orientation is not added to the summary (FR-1.3 lists only string count, tuning, handedness). DX-6: the home-screen tool-card thumbnails already draw a fretboard (thumbnail variant), so they follow both settings; the panel preview follows the **pending** settings. Testable: with left-handed confirmed, every tool-card thumbnail has its nut on the right and the summary ends in "left-handed".
- Q: What about the minimap? → A: Out of scope (brief): minimap mirroring arrives with 007-comfort-and-launch-readiness/002.
- Q: What about CAGED? → A: Not built yet (a later wave). Everything directional it will need goes through the one drawing rule this feature establishes. TM-9 view 22 (views 6, 15, 16 mirrored) is covered here for view 6; views 15 and 16 are added by the CAGED wave.
- Q: Does the instrument-change adjustment notice interact? → A: No. Handedness and orientation never make a view impossible, so they never produce "We adjusted the view to the new instrument".
- Q: Where does a scrollable fretboard start? → A: FR-2.6 + design §6 (nut = "the start of the neck"). **Default**: an unscrolled view starts with the nut side in view — the left end for right-handed, the right end for left-handed. Existing auto-scroll rules (region band, keyboard focus, comparison, fret-count change preserving the visible stretch) keep their behaviour, measured from the nut, and are mirrored. Testable: left-handed, 320 px, 24 frets, Fretboard Notes with no region → the nut and fret 1 are visible without scrolling.
- Q: When a setting changes while a tool is open, what happens to the visible stretch? → A: **Default**: the same frets stay in view after the redraw (mirrored), no animation (redraw only), tool view state untouched.
- Q: Any escalation needed? → A: No. Every open point has a source or a conventional, easily reversible default; none changes the data model beyond the additive preference fields set by the existing extension rule.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mirror the fretboard for left-handed play (Priority: P1)

A left-handed player opens the instrument panel, chooses left-handed, confirms, and every tool draws the fretboard the way their instrument faces: nut on the right, frets counting up toward the left.

**Why this priority**: This is the core promise. Without it left-handed players keep mirroring diagrams in their heads (persona P-3, job J-10).

**Independent Test**: In the default state, switch to left-handed, confirm, open Fretboard Notes and Triads, and check nut side, fret order, and tag order.

**Acceptance Scenarios**:

1. **Given** the default instrument, **When** the user chooses left-handed and confirms, **Then** the nut is on the right, the open-string column sits beyond the nut on its right, and fret numbers increase toward the left.
2. **Given** left-handed mode and Triads on A major, set 3-2-1, Full neck, **When** the view appears, **Then** the nut is on the right and the inversion tags run right to left in the order root → 1st → 2nd.
3. **Given** left-handed mode and a triad comparison, **When** the arrows between the two positions show, **Then** they point the mirrored way and still state the fret distance.
4. **Given** left-handed mode and a region in focus, **When** the view appears, **Then** the focus band covers the same frets as in right-handed mode, drawn mirrored.
5. **Given** left-handed mode and keyboard focus on string 3, fret 5, **When** the user presses ArrowLeft, **Then** focus moves to string 3, fret 6 (toward the body); ArrowRight moves to fret 4.
6. **Given** left-handed mode with highest string on top, **When** fret numbers show, **Then** they sit below the board, as in right-handed mode, opposite the tags above.
7. **Given** either handedness, **When** the user taps string 3 at fret 5, **Then** the same note plays and the same position is reported.
8. **Given** the panel with an unconfirmed handedness change, **When** the user closes it, **Then** the previous handedness remains (EC-2.7), and while it is open the preview shows the pending handedness.

---

### User Story 2 - Choose which string is on top (Priority: P1)

A player who thinks of the neck as seen looking down chooses lowest string on top; string 6 draws at the top and everything still means what it meant.

**Why this priority**: Equal in value to handedness for players whose mental picture is the view from above; independent of it.

**Independent Test**: Choose lowest on top in standard tuning, confirm, check that string 6 is at the top and tapping it plays E2.

**Acceptance Scenarios**:

1. **Given** the default instrument, **When** the user chooses lowest string on top and confirms, **Then** string 6 draws at the top and string 1 at the bottom.
2. **Given** lowest on top in standard tuning, **When** the user taps the top string at fret 0, **Then** E2 plays and the position is reported as string 6, fret 0.
3. **Given** lowest on top with 7 strings, **When** the fretboard shows, **Then** string 7 draws at the top and string thickness still increases toward the lowest string.
4. **Given** each of the four handedness × orientation combinations, **When** the same musical view is shown, **Then** the set of notes, string numbers, and fret numbers marked is identical; only the drawing differs.
5. **Given** Triads Full neck, **When** orientation changes to lowest on top, **Then** fret numbers move above the board and the inversion tags move below it, staying on opposite edges.
6. **Given** lowest on top and focus on string 5, **When** the user presses ArrowUp, **Then** focus moves to string 6 (the string drawn above).

---

### User Story 3 - A screen reader follows the neck from the nut (Priority: P1)

A left-handed screen-reader user tabs through positions and hears them from the nut toward the body, with the same words a right-handed user hears.

**Why this priority**: Accessibility is non-negotiable (constitution V) and FR-2.6 names reading order explicitly.

**Independent Test**: With left-handed mode, tab through the positions of a view and check the announced order and wording.

**Acceptance Scenarios**:

1. **Given** left-handed mode, **When** the user tabs through positions with a screen reader, **Then** they are read from the nut toward the body.
2. **Given** either handedness, **When** the text description of a view is announced, **Then** it is identical in content and order, and uses only string and fret numbers and note names, never "left" or "right" on screen.
3. **Given** left-handed mode, **When** keyboard focus moves "forward" along a string, **Then** it moves away from the nut, and the arrow key that does so is the one pointing the drawn way.

---

### User Story 4 - The settings are remembered (Priority: P2)

A left-handed user comes back the next day and the fretboard is still mirrored; the same holds for string orientation.

**Why this priority**: Without memory the player re-sets it every visit, which defeats the purpose, but the settings work without it.

**Independent Test**: Set left-handed and lowest on top, confirm, reload, and check both persisted; erase preferences and check both revert.

**Acceptance Scenarios**:

1. **Given** left-handed confirmed, **When** the user reloads or returns another day, **Then** the fretboard is mirrored.
2. **Given** lowest on top confirmed, **When** the user reloads, **Then** string 6 draws at the top.
3. **Given** stored preferences that contain an invalid handedness or orientation, **When** the page loads, **Then** that setting is the default, the other setting and every other preference are kept, and nothing is shown as an error.
4. **Given** stored preferences written before this feature, **When** the page loads, **Then** they load exactly as before with right-handed and highest on top.
5. **Given** the user erases preferences, **When** the page loads next, **Then** both settings are the defaults.
6. **Given** storage unavailable, **When** the user changes the settings, **Then** they apply for the session and the existing storage notice behavior applies.
7. **Given** any non-default instrument, **When** the user chooses Restore default, **Then** right-handed and highest on top are restored together with the other defaults.

---

### User Story 5 - Works on every screen and with every instrument (Priority: P2)

Both settings work from a 320 px phone to a 2560 px desktop and with every string count, tuning, and fret count.

**Why this priority**: Phone and desktop have equal priority (constitution VII).

**Independent Test**: In each of the four combinations, open Notes and Triads at 320, 768, and 2560 px with 6 and 7 strings and 12 and 24 frets.

**Acceptance Scenarios**:

1. **Given** left-handed mode on a 320 px screen, **When** the fretboard is wider than the screen, **Then** only the fretboard scrolls horizontally, and it starts scrolled to the nut side (the right) so the nut is the first thing seen.
2. **Given** any combination, **When** the user plays a note by touch, **Then** touch targets are at least 44×44 CSS px in comfortable mode.
3. **Given** left-handed mode, **When** the fret count changes, **Then** the neck grows toward the left and stays mirrored.
4. **Given** any combination, **When** the view changes, **Then** it updates within the control-change budget and only the notes that change move.

---

### Edge Cases

- Both settings changed together: they apply together on confirm; there is no intermediate frame mixing old and new.
- Storage holds only one of the two fields: the missing one defaults, the present one applies.
- Left-handed with a very narrow screen and 24 frets: only the fretboard scrolls; page and controls do not.
- Reduced motion: switching handedness or orientation does not animate; a redraw only.
- Tag, arrow, or band that would fall outside the visible stretch: behaves as in right-handed mode, mirrored.
- Share link opened by a left-handed user: shown mirrored; a link opened by a right-handed user from a left-handed sender shows right-handed (links carry neither setting).
- An instrument change (strings, frets, tuning) while left-handed: mirroring persists and no adjustment notice appears for it.
- High-contrast and print: the mirrored view keeps the same non-color cues (shape, dashed outline, arrows).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The instrument panel MUST offer handedness with the choices right (default) and left, and string orientation with the choices highest string on top (default) and lowest string on top, as two independent controls whose four combinations are all valid.
- **FR-002**: Both settings MUST follow the panel's confirm-or-discard behavior, and the panel preview MUST show the pending handedness and orientation.
- **FR-003**: In left-handed mode the whole fretboard MUST mirror horizontally: the nut on the right, frets increasing toward the left.
- **FR-004**: Every element with a direction MUST follow handedness: fret numbers, the nut, the open-string column, the string label column, inlays, shape and inversion tags and their running order, comparison arrows, the region-focus band, keyboard arrow navigation along a string, and screen-reader reading order. From the outer edge inward the order MUST be label column → open-string column → nut → fret 1 → … → last fret, starting at the left edge (right-handed) or the right edge (left-handed).
- **FR-005**: Fret numbers MUST always sit on the edge opposite the shape and inversion tags. With highest string on top, tags MUST sit above the board and fret numbers below; with lowest string on top, fret numbers MUST sit above and tags below. Handedness MUST NOT change either edge.
- **FR-006**: With lowest string on top, the lowest-numbered-pitch string (string 6, or 7 with seven strings) MUST draw at the top; with highest on top, string 1 draws at the top. String thickness MUST keep increasing toward the lowest string in both.
- **FR-007**: Handedness and orientation MUST change only how things are drawn. String numbers, fret numbers, notes, spelling, shapes, sound, tool view state, and reported positions MUST be identical across all four combinations.
- **FR-008**: Activating a string or fret MUST play its calculated pitch and report its musical position (string, fret) in every combination; for example, the top string under lowest-on-top in standard tuning plays E2 and reports string 6.
- **FR-009**: Screen-reader reading order MUST always run from the nut toward the body in both handedness modes; text descriptions and announcements MUST be the same in content in every combination and MUST NOT use screen directions.
- **FR-010**: Keyboard navigation MUST follow the drawn direction: right-handed, ArrowRight = one fret higher and ArrowLeft = one fret lower; left-handed, ArrowLeft = one fret higher and ArrowRight = one fret lower; ArrowUp/ArrowDown MUST move to the string drawn above/below in either orientation. "Forward"/"next" along a string MUST always mean one fret higher (away from the nut). Any future next/previous command or gesture MUST use the same mapping; this feature adds no new gesture.
- **FR-011**: Both settings MUST be stored as preferences in optional fields `handedness` (`"right"`|`"left"`) and `orientation` (`"highest-top"`|`"lowest-top"`), validated independently, with invalid or absent values falling back to the defaults without losing any other valid preference, without an error shown, and without changing the preferences format version. Records written before this feature MUST load unchanged.
- **FR-012**: Erasing preferences MUST reset both settings to defaults, and Restore default MUST set right-handed and highest string on top.
- **FR-013**: Share links MUST NOT carry either setting and opening one MUST apply the opener's own settings.
- **FR-014**: Every layout from 320 to 2560 CSS px MUST support both settings, with only the fretboard scrolling horizontally; an unscrolled fretboard MUST start with the nut side in view (right end in left-handed mode), and existing auto-scroll rules MUST apply mirrored. Changing either setting MUST keep the same frets in view.
- **FR-015**: The home-screen instrument summary MUST end with the handedness in use ("right-handed" or "left-handed", localized); orientation is not shown in the summary. Home-screen tool-card thumbnails MUST follow both confirmed settings, and the instrument-panel preview MUST follow the pending ones.
- **FR-016**: All new user-facing text MUST come from the message catalog in every shipped language, and layouts MUST hold at 200% text zoom without truncation.
- **FR-017**: Switching either setting MUST NOT trigger the "We adjusted the view to the new instrument" notice, MUST NOT change the open tool or its view state, and MUST NOT animate under reduced motion.
- **FR-018**: Mirroring and orientation MUST be applied in a single place in the drawing layer; theory, instrument model, tools, and view state MUST NOT depend on either setting.
- **FR-019**: The mirrored and re-oriented views MUST meet the same accessibility rules as the default view: visible focus, no information by color alone, zero automated accessibility violations.
- **FR-020**: The teacher-review sample view 6 (Triads, A major, three inversions, set 3-2-1, full neck, 6 strings, AF-1) MUST exist as a left-handed reference screenshot (TM-9 view 22).

### Key Entities

- **Handedness**: right or left. Presentation-only property of the instrument; stored as a preference; never in share links.
- **String orientation**: highest string on top or lowest string on top. Presentation-only; stored as a preference; independent of handedness.
- **Instrument**: gains these two properties alongside string count, tuning, and fret count; the panel edits them as pending state until confirmed.
- **Stored preferences**: gain two optional fields; absent equals defaults.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A left-handed user can set up a mirrored fretboard from the home screen in under 30 seconds and in at most 3 interactions after opening the panel (choose, confirm).
- **SC-002**: In all four handedness × orientation combinations, 100% of the sampled views (every root, quality, and inversion on every string set of the default tuning) mark exactly the same string and fret positions and play the same pitches.
- **SC-003**: For every sampled left-handed view, 100% of directional elements (nut, fret numbers, tags, arrows, focus band, open-string column) appear mirrored, and none appear in their right-handed position.
- **SC-004**: A screen-reader user hears 100% of positions in a view in nut-to-body order in both handedness modes, with identical wording.
- **SC-005**: Both settings are still applied after reload in 100% of runs, and invalid stored values never prevent the page from loading or lose other saved preferences.
- **SC-006**: Switching either setting updates the fretboard within 100 ms on the reference device profile.
- **SC-007**: All four combinations work at 320, 768, and 2560 px with 6 and 7 strings and 12 and 24 frets, with no horizontal page scroll and no automated accessibility violations.
- **SC-008**: Initial JavaScript stays within the constitution's gzip budget (90 KB since constitution 1.4.0; 85 KB when specified).

## Assumptions

- Primary users are left-handed players (persona P-3) and players who picture the neck as seen from above; they know their own preference and need no explanation beyond the control labels.
- Right-handed and highest-on-top remain the defaults for everyone, including all users with existing stored preferences.
- Key navigation: the arrow key pointing toward the body as drawn moves one fret higher (ArrowLeft when left-handed); Enter/Space and other non-directional keys are unchanged. No swipe or next/previous command exists yet; none is added here.
- The two storage fields use the additive extension rule of the existing preferences contract; no format version bump.
- Minimap mirroring (007-comfort-and-launch-readiness/002) and sharing (006) are out of scope; CAGED views (TM-9 views 15 and 16) are added by the CAGED wave using the same drawing rule.
- Home-screen tool-card thumbnails already draw a fretboard, so they follow both settings.
- Only English, Portuguese, and Spanish catalogs ship; labels for the new controls are added to all.
- The existing fretboard drawing layer already has a single place that reads these settings (`screenOrder` in the fretboard geometry, identity until now) and the instrument model already carries both fields with defaults; this feature gives them effect.
