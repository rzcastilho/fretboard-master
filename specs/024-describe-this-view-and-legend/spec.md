# Feature Specification: Describe This View, Legend, and Accessibility Audit

**Feature Branch**: `feature/024-describe-this-view-and-legend`

**Created**: 2026-10-06

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/007-comfort-and-launch-readiness/001-describe-this-view-and-legend.md (id 001, describe-this-view-and-legend)."

## Clarifications

### Session 2026-10-06

Sources: constitution (C), breakdown `007-comfort-and-launch-readiness/001-describe-this-view-and-legend.md` (BD), macro-spec FR-3.7–3.11, FR-3.17, FR-3.18, FR-6.8–6.10, NFR-3.1–3.9, design §3.2, §3.3 and §7, edge users E-1 to E-5 (MS), and existing code/specs (002 data-model §8, 013 research R-05). Items marked **Default** are assumed conventional choices; every one is restated in the requirement it governs.

**What already exists (code survey)**
- Q: What does this slice build on? → A: `src/lib/fretboard/description.ts` (`describeView`, `positionName`) already produces the generic description; Triads, Notes and CAGED models already compose tool-specific summaries/descriptions (`summary` / `description` on the display model); `Fretboard.svelte` already has a "Show/Hide text description" toggle with `aria-expanded`, a visible `<p>` panel, and an `aria-live="polite" aria-atomic="true"` region that announces only when the description text changes and never on first render; `MarkerSample.svelte` already draws legend samples for the CAGED layer list. This slice relabels, extends and audits these; it does not build a second description path (C-III one-directional data flow, C-VIII single spoken form).

**Description content and order**
- Q: In what order are positions listed? → A: Derived from BD's own example ("string 4, fret 11 …; string 3, fret 9 …; string 2, fret 10 …", frets 11 → 9 → 10, so not ascending fret) plus 002 data-model §8 and 013 R-05: **string-major from the lowest-pitched string (highest number) to string 1; within one string, ascending fret, i.e. from the nut toward the body.** Identical in right-/left-handed mode and both string orientations. Testable: Triads A major, first inversion, 4-3-2 → entries in order string 4, string 3, string 2; a CAGED view with two positions on string 5 lists the lower fret first.
- Q: Exact Triads wording? → A: Derived from BD/FR-3.18: the Triads isolated single-shape description MUST read, in English, exactly "A major, first inversion, strings 4, 3, and 2: string 4, fret 11, C sharp, third; string 3, fret 9, E, fifth; string 2, fret 10, A, root." The current summary ("A major: … on strings 4, 3, 2, frets 11, 9, 10.") is realigned to the form "{chord}, {inversion}, strings {list}: {entries}." with a locale-correct list conjunction ("and" / "e" / "y"). A wide-stretch shape appends " Wide stretch." after the entries. Other Triads views (full neck, all notes, comparison) keep their existing composed descriptions, subject to the entry rule below.
- Q: What must each position entry contain, in every tool? → A: Derived from BD/FR-3.18: string number; fret number or the word "open" for fret 0; note name read in full; and function as a word. **Default**: function words are root / third / fifth for triad tones and the spoken degree name (e.g. "second", "flat seventh") for scale degrees; Notes entries, where positions have no function, carry string, fret and note only (current behaviour). Realignment: CAGED position entries ("string 5 fret 3 root") currently omit the note name and MUST add it ("string 5, fret 3, C, root").
- Q: Which positions are listed? → A: Generic rule (002 data-model §8): positions at **highlighted** or **normal** emphasis; dimmed and hidden positions are not listed. Tool-composed descriptions (CAGED layers and connections, Triads comparison/full neck, Notes) keep the content their slice defined. The Legend and the description are derived from the same display model so they never disagree.
- Q: Summary for other tools? → A: Existing summaries stand: Notes = selection or background set, active strings, fret region (+ detected triad); CAGED = tuning, key, shape count, focused shape, active layers, then entries and connections.
- Q: Language, notation and accidentals? → A: BD/C-V/NFR-3.9: description follows language, notation (letters/solfège) and accidental preference exactly as the on-screen labels of that tool do, and spells accidentals in words ("C sharp", "D double sharp"; equivalents in Portuguese and Spanish) via `src/lib/notation` spoken forms only (C-VIII).
- Q: Empty view? → A: Existing `fretboard_description_empty` / tool guidance texts. **Default**: an empty description states that nothing is displayed and names the first action (e.g. Notes: "No notes selected. Pick a note in the note selector."); never empty text.

**Describe this view control and panel**
- Q: Name and behaviour of the control? → A: Design §7/BD: the existing toggle is relabelled **Describe this view** (constant label in all states; state carried by `aria-expanded`), one per tool, placed directly below the fretboard. Activating it shows/hides a non-modal text panel under the fretboard containing exactly the description text that is announced. It never overlays the fretboard (C-VII). Focus stays on the button when toggled.

**Announcement**
- Q: What is announced, and when? → A: BD + NFR-3.4 + existing behaviour: the **full description text** (same string as the panel) is announced through the existing polite, atomic live region whenever it differs from the last announced text, whether or not the panel is open; nothing on first render. Any change that alters the text counts — control actions, instrument changes, and language/notation/accidental changes (so US2-5 announces in the new language). Focus never moves (FR-009). Moving keyboard focus between positions does not alter the description and therefore announces nothing. **Default** (replaces the earlier "summary plus count" idea, which contradicted BD): no truncation; screen-reader users can interrupt a long announcement with their reader's stop key.
- Q: Debounce? → A: **Default**: trailing debounce of 500 ms — an announcement is made only after the description has been unchanged for 500 ms, and announces the final text once. Tested with Playwright's fake clock (C-IV deterministic timing). Satisfies SC-002 (≤ 1 s after settling). Other polite status messages (notices, copy confirmation, layer on/off) keep their own live regions and are not debounced into the description.

**Legend**
- Q: Where is the Legend and how does it open? → A: **Default**: a **Legend** toggle button next to **Describe this view** in every tool, with `aria-expanded`; it shows a non-modal disclosure panel below the fretboard (C-VII: non-modal, never covers the fretboard). Escape while focus is inside the panel closes it and returns focus to the Legend button; Tab moves out normally (no trap). Legend and description panels open and close independently. Open/closed state is not persisted and not part of share links.
- Q: Which entries exist, and what decides that one is shown? → A: Derived from BD + design §3.2/§3.3 + FR-6.9/6.10, as a closed catalogue. An entry is shown **iff the current display model draws that mark at highlighted, normal or dimmed emphasis** (view-level marks: iff the view shows them); never inferred from control state alone. Catalogue: root (filled rounded square), third (filled circle), fifth (filled diamond), scale degree (small outlined circle), neutral note (light filled circle, Notes), selected note (neutral marker at highlighted emphasis, Notes), octave colour with octave number (Notes, when octave tones are drawn), arpeggio note (smaller translucent marker, CAGED), triad-layer note (CAGED), extra mark (dot on scale notes outside the pentatonic, CAGED), connection ring (CAGED), comparison note (dashed outline + arrow, Triads), wide stretch, altered string. Each entry = sample drawn with `MarkerSample` (same geometry/tokens as the board) + visible name + a short text saying shape and meaning; the sample is `aria-hidden`, the text is the accessible content, entries are a list.
- Q: BD's "chord, arpeggio and outlined pentatonic markers"? → A: In CAGED with Pentatonic on, chord tones draw as root/third/fifth (chord), pentatonic triad tones outside the chord draw in arpeggio style (FR-6.9 intermediate emphasis) and other pentatonic notes as outlined scale-degree markers; the rule above therefore yields root/third/fifth, arpeggio note and scale degree entries. Legend group labels name them "Chord", "Arpeggio", "Pentatonic" in CAGED. Testable per FR-016.
- Q: Relation to the CAGED layer list samples? → A: **Default**: the layer list keeps its samples as switches (design §4 "doubling as the legend"); both use `MarkerSample`, so they never differ visually.
- Q: Empty Legend? → A: **Default**: a one-line text "Nothing is marked on the fretboard." (localized), never an empty panel.

**Audit and colour**
- Q: Audit scope and automated scan matrix? → A: WCAG 2.2 AA (C-V). **Default** matrix for the axe scan (zero violations): routes `/`, `/notes`, `/triads`, `/caged`, `/about`, the not-found page, and a received share link; each in its default state and with the Legend panel, description panel and instrument panel open; light and dark themes; English, Portuguese and Spanish. Runs on the `desktop` project in CI (merge gate already runs axe on phone + desktop for existing specs). Manual checklist covers names/roles/states, focus order, 320 px and 200% text zoom reflow, status messages, no sound-only information.
- Q: Audit record location and form? → A: **Default**: `docs/accessibility-audit.md`, a table per WCAG 2.2 AA success criterion: criterion, screens checked, result (pass / fixed / deferred), fix reference, deferral reason. Deferred items are allowed only when the fix needs redesign beyond this slice and MUST name the follow-up slice.
- Q: Colour-blindness check method and pass criterion? → A: **Default**: simulate deuteranopia, protanopia and tritanopia (Machado et al. 2009 matrices, severity 1.0) on the root, third and fifth fill tokens and on rendered tool screenshots, in light and dark themes. Pass = (a) root, third and fifth glyphs are distinct shapes and carry labels in every tool (automated DOM check), and (b) each pair of root/third/fifth simulated colours differs by CIEDE2000 ΔE ≥ 10 in each simulation and theme (automated token check; design §3.2 requires third/fifth distinct "also for the most common types of colour blindness"). A failing pair is adjusted via tokens only and recorded in the audit record; screenshot baselines are regenerated. Increased-contrast variants are out of scope (BD → 007/003).
- Q: "Everything heard is also seen"? → A: NFR-3.8/C-V: every sound has a visible counterpart (playing-position pulse, listen-sequence progress). **Default**: no new sound features; verify each sound source and fix gaps.
- Q: Focus ring on positions? → A: Design §7: a high-contrast ring around the focused position, ≥ 3:1 against both the fretboard wood and the marker fill beneath it (WCAG 2.2 SC 1.4.11 / 2.4.7), in both themes and at every emphasis level, including hidden positions.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read the view as text (Priority: P1)

Marta is a blind guitarist using a screen reader. In Triads she sets A major, first inversion, strings 4-3-2. She activates **Describe this view** and reads: "A major, first inversion, strings 4, 3, and 2: string 4, fret 11, C sharp, third; string 3, fret 9, E, fifth; string 2, fret 10, A, root." She gets the same study value as a sighted user.

**Why this priority**: Without a text equivalent, a whole class of users cannot use any tool. This is the core of the slice.

**Independent Test**: In each tool, build a known view, open **Describe this view**, and compare the text to the expected sentence (in all three languages, both notations, both accidental preferences, right- and left-handed).

**Acceptance Scenarios**:

1. **Given** Triads on A major, first inversion, strings 4-3-2 on a standard instrument, **When** the user opens **Describe this view**, **Then** the text is exactly "A major, first inversion, strings 4, 3, and 2: string 4, fret 11, C sharp, third; string 3, fret 9, E, fifth; string 2, fret 10, A, root." (strings from the lowest-pitched to string 1; within a string, from the nut toward the body).
2. **Given** the same view in Portuguese with solfège notation, **When** the description is read, **Then** it is in Portuguese with solfège names and accidentals spelled out in full.
3. **Given** a left-handed viewer with mirrored fretboard, **When** the description is read, **Then** positions are in the same order as for a right-handed viewer.
4. **Given** the Notes tool with three selected notes and one string filtered out, **When** the user opens the description, **Then** it states the selection and the filter and lists each displayed position.
5. **Given** CAGED with a focused shape and the pentatonic layer on, **When** the description is opened, **Then** it states key, quality, focused shape and active layers and lists the displayed positions, each with string, fret, note name and function or degree.
6. **Given** the description is open, **When** the view changes, **Then** the visible text updates to the new description.
7. **Given** an empty view (no notes selected in Notes), **When** the description is opened, **Then** it says nothing is displayed and names the first action (pick a note in the note selector), never a blank panel.

---

### User Story 2 - Hear changes without losing place (Priority: P1)

Marta changes the Triads inversion. The new description is announced quietly by her screen reader; her focus stays on the inversion control.

**Why this priority**: The text only helps if the user finds out the view changed, without extra navigation.

**Independent Test**: With a live-region observer, change inversion and verify one polite announcement with the new description and that the focused element does not change.

**Acceptance Scenarios**:

1. **Given** a screen reader and focus on the inversion control, **When** the user changes inversion, **Then** the full new description is announced politely once, 500 ms after the last change, and focus stays where it was.
2. **Given** several fast control changes, **When** they settle, **Then** exactly one announcement of the final state is made, 500 ms after the last change.
3. **Given** the user moves focus across fretboard positions with the arrow keys, **When** no view content changes, **Then** no description announcement is made.
4. **Given** the description panel is closed, **When** the view changes, **Then** the announcement is still made.
5. **Given** the language changes, **When** the language change settles, **Then** the description is announced once in the new language.

---

### User Story 3 - Legend of what's on screen (Priority: P2)

A student opens CAGED with the Pentatonic layer on and wonders what the outlined markers mean. She opens **Legend**, which lists the chord, arpeggio and outlined pentatonic markers, and nothing else.

**Why this priority**: The code of shapes and layers is only learnable if explained in context; a short, relevant list keeps it light.

**Independent Test**: Per tool, build views with different features on and verify the Legend lists exactly the kinds in use.

**Acceptance Scenarios**:

1. **Given** CAGED with Pentatonic on, **When** the user opens the Legend, **Then** it lists the chord markers (root, third, fifth), the arpeggio marker and the outlined pentatonic (scale-degree) marker, grouped as Chord, Arpeggio and Pentatonic, and nothing else.
2. **Given** a view with connection rings, wide-stretch shapes or an altered string, **When** the Legend is opened, **Then** each of those appears with its sample and name, and any not in use does not.
3. **Given** Triads comparison is on, **When** the Legend is opened, **Then** the dashed comparison outline (with the arrow) is listed.
4. **Given** the Notes tool, **When** the Legend is opened, **Then** it lists neutral note, selected note and octave colour each only if drawn in the current view.
5. **Given** the view changes while the Legend is open, **When** the set of markers in use changes, **Then** the Legend updates.
6. **Given** a keyboard or screen-reader user, **When** they open the Legend, **Then** it is reachable in logical order, entries are readable as text (name plus shape and function in words), and it closes with Escape (focus returns to the Legend button) or its button, and Tab leaves it without trapping focus.

---

### User Story 4 - Whole app by keyboard alone (Priority: P1)

Dan uses only a keyboard. In the Notes tool he tabs through controls, selects notes, sets filters, moves across the fretboard with arrows, and plays a position, with a visible high-contrast focus ring and no trap.

**Why this priority**: Constitution V and WCAG AA make this a hard requirement, and it is an acceptance criterion in the brief.

**Independent Test**: Scripted keyboard-only run through each tool, home screen, instrument panel, notices, Legend and description panel, asserting reachability, order, visible focus and no trap.

**Acceptance Scenarios**:

1. **Given** the Notes tool and only a keyboard, **When** the user tabs through, **Then** they can select notes, set filters, move across the fretboard with arrows, and play a position, and never get stuck.
2. **Given** focus on a fretboard position, **When** it is rendered, **Then** a high-contrast ring is visible on both themes and over every marker emphasis level.
3. **Given** the same checks for Triads, CAGED, home, instrument panel, share and shared-view notices, **When** run, **Then** every function is operable and focus order follows reading order.
4. **Given** any non-modal panel or notice, **When** it opens or closes, **Then** focus is never lost to the page body or trapped.
5. **Given** a fretboard that scrolls horizontally, **When** focus moves to an off-screen position, **Then** it scrolls into view.

---

### User Story 5 - Nothing depends on color alone (Priority: P2)

Lia has deuteranopia. Under a simulation of her vision, root, third and fifth in every tool and in both themes can still be told apart by shape and label.

**Why this priority**: Required for the colour-blind users (E-1); the shape code already exists, this slice verifies it and closes gaps.

**Independent Test**: Render each tool in both themes under deuteranopia, protanopia and tritanopia simulations and check by an automated image check plus review that function can be identified without color.

**Acceptance Scenarios**:

1. **Given** deuteranopia simulation in light and dark themes, **When** a triad is shown, **Then** root, third and fifth are told apart by shape and label.
2. **Given** any view, **When** emphasis levels are compared, **Then** they differ by opacity and size, not hue alone.
3. **Given** Triads comparison, **When** shown, **Then** it is marked by dashed outline plus arrow, not color only.
4. **Given** the Legend, **When** viewed under the simulations, **Then** every entry is identifiable by shape and text.
5. **Given** a palette color pair that is hard to tell apart under a simulation where color matters, **When** found, **Then** it is adjusted and recorded.

---

### User Story 6 - Controls say what they are (Priority: P2)

Every control across the app exposes name, role and state; every screen passes the WCAG 2.2 AA audit; everything heard is also seen.

**Why this priority**: Launch-readiness gate; reaches beyond the three flows above.

**Independent Test**: Automated accessibility scan on every screen and state with zero violations, plus a manual checklist (names, roles, states, focus order, reflow at 320 px and 200% zoom, status messages, no sound-only information).

**Acceptance Scenarios**:

1. **Given** every screen in both themes and all three languages, **When** an automated scan runs, **Then** it reports zero violations.
2. **Given** toggles, selectors, steppers, tabs and panels, **When** inspected, **Then** each exposes an accessible name, a role and its current state (pressed, selected, expanded, disabled).
3. **Given** playback or any sound, **When** it happens, **Then** a visible counterpart shows the same information.
4. **Given** a status change (notice, adjusted view, copy confirmation), **When** it occurs, **Then** it is announced politely without moving focus.
5. **Given** the audit finds a defect, **When** it is fixable within existing design, **Then** it is fixed; otherwise it is listed in the audit report with the reason.

---

### Edge Cases

- A view with many positions (7 strings, 24 frets, all CAGED layers): the description is long; the full text is announced (no truncation) and the screen-reader user can stop it at any time with the reader's stop key.
- Open string positions (fret 0): described as "open" with the note; listed first within their string (nearest the nut).
- Custom tunings and seven strings: note names come from the instrument as configured.
- Double sharps and flats: spoken in full ("D double sharp").
- Instrument changes while the description is open: description updates, and any adjusted-view notice is announced separately.
- View with no markers in use: Legend shows "Nothing is marked on the fretboard." (localized), not an empty panel.
- Language or notation switch while the Legend or description is open: both re-render in the new language.
- Reduced-motion preference: panels appear without animation.
- Browser zoom to 200% and a 320 px wide screen: panels and Legend reflow without overlap or horizontal page scroll.
- Both description and Legend open at once on a phone: neither covers the fretboard controls permanently; both can be closed.
- Rapid keyboard repeat on a control: announcements collapse.

## Requirements *(mandatory)*

### Functional Requirements

**Description**

- **FR-001**: Every view of every tool MUST have an equivalent text description generated from what is on the fretboard.
- **FR-002**: Each tool MUST provide a **Describe this view** button (constant label, state via `aria-expanded`) directly below the fretboard that shows the description as visible text in a non-modal panel under the fretboard and hides it again; toggling keeps focus on the button. It replaces the existing "Show/Hide text description" toggle.
- **FR-003**: A description MUST contain a summary of the view's state followed by every listed position as "string N, fret F (or open), note in full, function or degree word". The Triads single-shape description MUST take the form "{chord}, {inversion}, strings {list}: {entries}." (English example: "A major, first inversion, strings 4, 3, and 2: string 4, fret 11, C sharp, third; string 3, fret 9, E, fifth; string 2, fret 10, A, root."), plus " Wide stretch." when applicable. CAGED entries MUST include the note name. Notes entries carry no function. Listed positions are those at highlighted or normal emphasis, except where a tool's composed description defines its content.
- **FR-004**: Positions MUST be listed by string from the lowest-pitched (highest number) to string 1, and within a string by ascending fret (from the nut toward the body), regardless of handedness or string orientation.
- **FR-005**: The description MUST follow the viewer's language, notation and accidental preference and MUST spell accidentals in full.
- **FR-006**: The description text MUST be generated from the same view data as the fretboard, so the two never disagree.
- **FR-007**: A view with nothing displayed MUST produce a short description stating that nothing is displayed and naming the first action to take.

**Announcement**

- **FR-008**: Whenever the description text changes (control action, instrument change, or language/notation/accidental change), the full new description MUST be announced through a polite, atomic live region, whether or not the visible panel is open. Nothing is announced on first render.
- **FR-009**: The announcement MUST NOT move or steal focus.
- **FR-010**: Announcements MUST be debounced: the description is announced only after it has been unchanged for 500 ms, so rapid successive changes produce exactly one announcement of the final state.
- **FR-011**: Moving keyboard focus across positions MUST NOT change the description or trigger a description announcement.

**Legend**

- **FR-012**: Each tool MUST provide a **Legend** button (state via `aria-expanded`) next to **Describe this view** that opens a non-modal disclosure panel below the fretboard. Legend and description panels open independently; their open state is neither persisted nor carried in share links.
- **FR-013**: The Legend MUST show an entry iff the current display model draws that mark at highlighted, normal or dimmed emphasis (view-level marks: iff shown), from this closed catalogue: root, third, fifth, scale degree, neutral note, selected note, octave colour, arpeggio note, triad-layer note, extra mark, connection ring, comparison (dashed outline + arrow), wide stretch, altered string. Each entry shows a `MarkerSample`-drawn sample (aria-hidden) and a visible text naming the mark, its shape and its meaning.
- **FR-014**: The Legend MUST update when the view changes and show "Nothing is marked on the fretboard." (localized) when nothing qualifies.
- **FR-015**: The Legend MUST be fully readable and operable by keyboard and screen reader; entries MUST be a list; Escape inside the panel MUST close it and return focus to the Legend button; Tab MUST leave it normally (no trap).
- **FR-016**: In CAGED with Pentatonic on, the Legend MUST list the chord markers (root, third, fifth), the arpeggio marker and the outlined pentatonic (scale-degree) marker, grouped as Chord, Arpeggio and Pentatonic.

**Accessibility audit**

- **FR-017**: The app MUST meet WCAG 2.2 level AA on every screen and state.
- **FR-018**: Every control MUST expose an accessible name, role and state.
- **FR-019**: Focus order MUST be logical and follow reading order; focus MUST always be visible; there MUST be no focus trap.
- **FR-020**: Every function MUST be operable by keyboard alone, including selecting notes, filters, arrow movement across the fretboard and playing a position.
- **FR-021**: Keyboard focus on fretboard positions MUST show a ring with at least 3:1 contrast against both the fretboard background and the marker fill beneath it, in both themes and on every emphasis level, including hidden positions.
- **FR-022**: Nothing MUST depend on color alone: note function uses shape and label, emphasis uses opacity and size, comparison uses dashed outline and arrow.
- **FR-023**: The marker palette MUST be checked against deuteranopia, protanopia and tritanopia (Machado 2009, severity 1.0) in both themes: root, third and fifth MUST be distinct glyph shapes with labels in every tool, and each pair of their simulated fill colours MUST differ by CIEDE2000 ΔE ≥ 10; a failing pair is fixed through design tokens and recorded in the audit record.
- **FR-024**: Everything heard MUST also be shown visibly.
- **FR-025**: All new text (description phrases, Legend names, control labels, announcements) MUST exist in English, Portuguese and Spanish.
- **FR-026**: The audit MUST produce `docs/accessibility-audit.md`: per WCAG 2.2 AA success criterion, the screens checked, result (pass / fixed / deferred), fix reference, and for deferrals the reason and the follow-up slice.

### Key Entities

- **View description**: The text equivalent of a tool's current view. Has a summary part and an ordered list of position entries; changes whenever the view changes.
- **Position entry**: One displayed position: string, fret (or open), note name, function.
- **Legend entry**: One marker kind in use: sample shape, name, and the function or meaning it carries.
- **Audit record**: The list of accessibility checks, results, fixes and any deferred items.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In all three tools, 100% of tested views (covering each tool's states, all three languages and both notations) yield a description with the expected content and order.
- **SC-002**: When a control changes the view, exactly one polite announcement of the new description is made 500 ms (≤ 1 s) after the change settles, and focus stays on the same element in 100% of tested cases.
- **SC-003**: A keyboard-only user can complete each core task (select notes, set filters, move across the fretboard, play a position, change a triad inversion, change CAGED shape, open Legend and description) in every tool with no focus trap and with visible focus at every step.
- **SC-004**: The axe scan reports zero violations on `/`, `/notes`, `/triads`, `/caged`, `/about`, the not-found page and a received share link, each in its default state and with the Legend, description and instrument panels open, in light and dark themes and in English, Portuguese and Spanish.
- **SC-005**: Under deuteranopia, protanopia and tritanopia simulation in both themes, root, third and fifth are distinct shapes with labels in 100% of sample views (automated), and every root/third/fifth simulated colour pair has CIEDE2000 ΔE ≥ 10.
- **SC-006**: The Legend lists exactly the marker kinds in use in 100% of tested views, including CAGED with Pentatonic on.
- **SC-007**: Every sound the product makes has a visible counterpart in 100% of reviewed cases.
- **SC-008**: The description and Legend panels work at 320 px width and 200% text zoom without overlap, truncation or horizontal page scroll.

## Assumptions

- Earlier slices already provide per-position spoken names, the marker shapes, the layer samples and the fretboard keyboard movement; this slice extends and verifies them rather than rebuilding them.
- WCAG 2.2 AA is the target level; AAA criteria are not required.
- Contrast variants for increased-contrast preference are out of scope (007-comfort-and-launch-readiness/003). Contrast of markers in the standard themes is verified as part of the audit but the variants are not built here.
- Screen reader coverage is verified with automated live-region checks plus manual checks on the common platform readers; exact spoken output varies by reader and is not tested.
- The description is language-specific text assembled from catalog phrases, never from user-supplied text.
- No new sound features are added; "everything heard is also seen" is satisfied by verification and gap fixes.
- The Legend and description are non-modal panels, consistent with the design rule against blocking windows.
- Preferences for open or closed Legend and description panels are not remembered between visits.
