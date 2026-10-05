# Feature Specification: Shape Focus and Connections

**Feature Branch**: `feature/016-shape-focus-and-connections`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/004-caged/003-shape-focus-and-connections.md (id 003, shape-focus-and-connections)." Source sections: FR-6.5, FR-6.6, FR-6.7, FR-3.19, EC-6.6, TM-6.3, TM-7, §3.5 Motion, UJ-4 (steps 4, 7, 8).

## Clarifications

### Session 2026-10-04

Each answer cites a source or is marked **Default** (conventional choice, no source settles it). No material question remains open, so there is no NEEDS HUMAN section.

#### Focus

- Q: What does "focus" mean? → A: FR-6.5, design §6. Exactly zero or one shape **occurrence** is in focus. Focused occurrence's chord markers use the `highlighted` emphasis level; every marker that belongs only to other occurrences uses `dimmed` (constitution VII: state is expressed only through the four emphasis levels). A marker shared by the focused occurrence and another is `highlighted`. A lit band covers the focused occurrence's chord fret span (lowest to highest chord fret, the same span its tag is centred over; an open shape's band starts at the open-string column). With no focus every marker is `normal` and no band is drawn.
- Q: Centering? → A: FR-6.5, design §3.5. On every focus change the fretboard scrolls so the band's centre is at the viewport centre, clamped to the scroll range (near the nut or last fret it goes as far as possible). When the whole fretboard fits, nothing scrolls. Dimming and scrolling complete within 500 ms (the medium motion token); under `prefers-reduced-motion: reduce` both are instant (existing reduced-motion helper, NFR-3.6). The minimap window follows.
- Q: How is focus entered and left? → A: FR-6.5, design §4.3. Three entry points, all equivalent: (1) tapping/activating a shape tag; (2) choosing a letter in the shape selector; (3) **Next/Previous shape**. Leaving: activating the focused tag again, or choosing **See all**. Selector and tags always show the same state.
- Q: What is the shape selector and where is **See all**? → A: Design §4.2–4.3 (zone B: "shape selector (C A G E D + all)"; segmented control, every option visible). **Default**: a six-option segmented control in zone B — C, A, G, E, D, then an "all" option whose visible label and accessible name is **See all**. **See all** is that option, not a separate button. It is selected when nothing is in focus. A letter with no drawn occurrence (e.g. 12 frets) is shown disabled. Choosing the already-selected option does nothing (radio semantics).
- Q: Which occurrence does a letter pick focus when the shape appears twice? → A: EC-6.6. **Default**: the occurrence nearest the nut, unless focus is already on an occurrence of that letter (then no change). Activating a specific tag focuses exactly that tag's occurrence; the selector shows its letter.
- Q: Are tags interactive? → A: FR-6.5 (014 deferred this here). **Default**: each tag becomes a toggle button (pressed when its occurrence is in focus), keyboard-reachable in neck order, minimum 44×44 px target (constitution V). Its accessible name is the tag text plus pressed state.

#### Next / Previous

- Q: Semantics? → A: FR-6.4, FR-6.6, EC-6.6. Neighbors are the drawn occurrences sorted by start fret (the C→A→G→E→D cycle toward the body). **Next shape** moves to the next higher-fret occurrence, **Previous shape** to the next lower. No wrap-around. A shape drawn twice is visited once per occurrence. "Next" means toward the body (higher frets) in every handedness and orientation.
- Q: Disabled states? → A: FR-6.6. **Default** for the no-focus case: both buttons are always rendered (no layout shift, SC-006) in zone E (design §4.3). They are disabled when nothing is in focus. **Previous shape** is disabled on the first drawn occurrence and **Next shape** on the last. Disabled buttons stay in the tab order with `aria-disabled` so they can be discovered.
- Q: Keyboard shortcuts (design §5.4)? → A: **Default**: out of scope. The app has no global shortcut system yet; the buttons are fully keyboard-operable. Shortcuts arrive with the About-page shortcut list.

#### Connections

- Q: What is a connection? → A: FR-6.7, TM-6.3, TM-7.2, constitution I. A chord-note position (string, fret) drawn in two **adjacent drawn** occurrences (neighbors as defined above). Connections are computed from the occurrences of the configured key, quality and instrument, never looked up in a fixed table. If a shape is not drawn, no connection crosses it. A position is a connection if it is shared with either neighbor.
- Q: Reference anchors (test table, FR-009)? → A: TM-6.3, C major standard tuning: C→A s5f3 (R); A→G s4f5, s3f5, s2f5 (5, R, 3); G→E s6f8, s1f8 (R, R); E→D s4f10 (R); D→C s3f12, s2f13, s1f12 (5, R, 3). TM-7.2, C minor: Cm→Am s5f3 (R); Am→Gm s4f5, s3f5 (5, R); Gm→Em s6f8, s2f8, s1f8 (R, 5, R); Em→Dm s4f10 (R); Dm→Cm s3f12, s2f13 (5, R). No other position is a connection.
- Q: How do connections show? → A: FR-6.1, FR-6.7, design §2 ("an additional ring around the marker"). **Show connections** is a switch in zone D (design §4.3) and is off by default. When on, **every** connection carries the ring, with or without focus. The marker's emphasis level still follows focus (a ring on a dimmed marker stays visible at dimmed emphasis). When off, no ring is drawn except during a step transition (below). A shared position drawn as one marker gets one ring.
- Q: What does "stay emphasized during the move" mean exactly? → A: FR-6.7, UJ-4 step 7. **Default** (testable window): when **Next/Previous shape** is pressed, the positions shared by the departing and arriving occurrences get the connection ring and `highlighted` emphasis as soon as the press happens. The ring stays for the transition window, which equals the medium motion duration (500 ms), and is removed when the window ends unless **Show connections** is on. Under reduced motion the scroll and dim are instant, but the ring still shows for the same window. It appears and disappears without animation, because it is a static emphasis rather than motion. A new press during the window restarts it for the new pair, so no stale ring remains. Tag or selector jumps (not neighbor steps) do not trigger it. Tests drive the window with a controlled clock.
- Q: Altered-string tunings (FR-6.15) and seven strings (FR-6.13)? → A: Connections exist only between drawn chord markers. String 6 in an altered-string tuning and string 7 have no chord markers, so they have no rings. In the temporary standard view (015) connections work normally.

#### State, lifetime, instrument changes

- Q: Where do focus and the toggle live? → A: Data model §CAGED ("shape in focus (optional) and its occurrence; … connections on"), constitution III (view state outside components), FR-9.2. Both are part of the CAGED view state in the existing module store. They survive navigation between tools within a visit, reset on reload, and are **never** written to device storage. **Reset tool** clears focus and turns connections off (FR-6.1 initial state). The focus is stored as the shape letter plus occurrence ordinal (0 = nearest the nut), so share links (area 10, later) can encode it.
- Q: Key, quality or spelling change? → A: **Default**: spelling change keeps focus unchanged. A key or quality change keeps the same letter and ordinal if that occurrence is still drawn. Otherwise it moves to the drawn occurrence of the same letter nearest the old start fret. If that letter is not drawn, focus moves to the drawn occurrence nearest the old start fret (nut side wins a tie). No notice is shown.
- Q: Instrument change (strings, frets, tuning) with a shape in focus? → A: EC-2.3 ("same shape in another octave or neighboring shape" + "We adjusted the view to the new instrument"). Focus is re-resolved by the same rule as a key change. If the resulting occurrence differs from the previous one (letter or start fret), the existing `instrument_adjusted` notice is shown. Handedness or orientation changes keep focus unchanged and show no notice.
- Q: Non-compatible tuning (FR-6.14)? → A: Existing 015 behavior: the message replaces the fretboard. The selector, step buttons and connections switch are shown disabled. **Default**: focus is cleared when the tuning becomes non-compatible. The connections toggle keeps its value.

#### Rotate notice

- Q: Rule? → A: FR-3.19, design §5.3, constitution II/VII/IX. The notice appears when CAGED opens on a **phone in portrait** and the notice has never been shown on this device. **Default** definition of phone in portrait: viewport width ≤ 599 CSS px (the narrow range, design §5.1) and height > width. It is a standard non-blocking notice (at most two lines, dismissible, never modal), for example "Turn your phone sideways to see more of the neck." It is recorded as shown the moment it is displayed. The record is a new boolean in the versioned preferences record (local storage). Reset tool does not clear it. **Erase my preferences** does clear it (FR-9.4), so it may show once more after an erase. If storage is unavailable, it shows at most once per page load (FR-9.5). The notice also disappears when the device rotates to landscape or the user leaves CAGED. It never shows on tablet, desktop or landscape phone, and those contexts do not mark it as shown.

#### Accessibility and text

- Q: Announcements? → A: Constitution V/VIII. **Default**: each focus change is announced politely, e.g. "E shape in focus, frets 7 to 10" or "All shapes". The fretboard text description says which occurrence is in focus and, for each connection with a ring, names the two shapes it joins (e.g. "string 4, fret 10, root, shared by E and D shapes"). Focus and rings are never conveyed by color alone: the band, the ring shape and the pressed state carry them. Every new string is in the message catalog (en, pt, es). Shape letters stay C A G E D in every language (014).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Focus on one shape (Priority: P1)

A player studying the E shape taps its tag. The shape lights up, the others recede, and the neck scrolls to center it.

**Why this priority**: Studying one region at a time is the core of the lesson; everything else builds on focus.

**Independent Test**: Open CAGED in C major, tap the E shape tag, check E highlighted, others dimmed, band over its frets, region centered; tap again and check all return to normal.

**Acceptance Scenarios**:

1. **Given** C major with all shapes, **When** the user taps the E shape tag, **Then** E's markers are highlighted, the markers of the other shapes are dimmed, a lit band covers frets 7–10, the E tag shows pressed, the selector shows E, and the fretboard scrolls the band's centre to the viewport centre (clamped) within 500 ms.
2. **Given** reduced motion is on, **When** focus changes, **Then** dimming and scrolling happen instantly.
3. **Given** E in focus, **When** the user taps the E tag again or chooses **See all**, **Then** focus leaves, all markers return to normal emphasis, the band disappears, and the selector shows **See all**.
4. **Given** the shape selector, **When** the user picks G, **Then** G is focused exactly as if its tag had been tapped, and selector and tags show the same state.
5. **Given** a shape drawn twice (e.g. C major on 24 frets: C at fret 0 and fret 12), **When** the user taps the tag of the second occurrence, **Then** only that occurrence is in focus and the first is dimmed. **When** the user then picks that same letter in the selector, **Then** nothing changes. **When** focus is elsewhere and the user picks that letter, **Then** the occurrence nearest the nut is focused.
6. **Given** a 12-fret instrument where a letter has no drawn occurrence, **When** the selector renders, **Then** that letter is disabled.

---

### User Story 2 - Step to the neighbor shape (Priority: P1)

With a shape in focus, the player steps to the next or previous region and keeps their bearings via the shared notes.

**Why this priority**: Travelling the neck is the stated purpose of CAGED (UJ-4).

**Independent Test**: Focus E in C major, press **Next shape**, check focus on D and string 4 fret 10 ringed and highlighted during the transition window; go to the last shape and check **Next shape** is disabled.

**Acceptance Scenarios**:

1. **Given** E in focus in C major and connections off, **When** the user taps **Next shape**, **Then** focus moves to D, the region recenters, and string 4 fret 10 carries the connection ring and highlighted emphasis from the press until the 500 ms transition window ends, after which the ring is gone.
2. **Given** a shape in focus, **When** the user taps **Previous shape**, **Then** focus moves to the neighbor nearer the nut and the positions the two shapes share carry the ring for the transition window.
3. **Given** focus on the last drawn occurrence, **When** the controls render, **Then** **Next shape** is disabled; likewise **Previous shape** on the first.
4. **Given** no shape in focus, **When** the controls render, **Then** **Next shape** and **Previous shape** are visible but disabled, and **See all** is the selected selector option.
5. **Given** a shape that appears twice, **When** the user presses **Next shape** repeatedly from the first occurrence, **Then** focus visits every drawn occurrence once, in start-fret order, and stops at the last.
6. **Given** reduced motion, **When** the user taps **Next shape**, **Then** scroll and dim are instant and the shared positions still carry the ring for the transition window.
7. **Given** a step in progress, **When** the user presses **Next shape** again within the window, **Then** the ring moves to the new pair and the window restarts. Only the latest pair carries a ring.

---

### User Story 3 - Show connections (Priority: P2)

The player turns on **Show connections** to see which notes tie neighboring shapes together.

**Why this priority**: Anchors make focus-stepping meaningful, but focus works without the toggle.

**Independent Test**: In C major with all shapes visible, turn on connections and check the three A→G notes carry the ring.

**Acceptance Scenarios**:

1. **Given** C major, all shapes visible, **When** the user turns on **Show connections**, **Then** string 4 fret 5 (5), string 3 fret 5 (R) and string 2 fret 5 (3) carry the connection ring, as does every other TM-6.3 anchor in the Clarifications, and no other marker does.
2. **Given** C minor, **When** connections are on, **Then** exactly the TM-7.2 anchors listed in the Clarifications carry the ring (including Am→Gm string 4 fret 5 and string 3 fret 5, and Gm→Em string 2 fret 8).
3. **Given** connections off and no step transition, **When** shapes are shown, **Then** no ring is drawn.
4. **Given** connections on and a shape in focus, **When** the view renders, **Then** every connection still carries its ring. Rings on the focused occurrence are at highlighted emphasis and rings elsewhere are at dimmed emphasis.
5. **Given** a fretboard where only some shapes fit, **When** connections are on, **Then** rings appear only between adjacent occurrences that are both drawn.
6. **Given** any other key (e.g. F♯ minor, TM-9 view 18), **When** connections are on, **Then** rings follow the shared positions computed for that key's occurrences (the C major or C minor anchor pattern shifted by the key offset in standard tuning, modulo 12 frets).

---

### User Story 4 - A hint to rotate on phones (Priority: P3)

A phone user in portrait is told once that landscape gives CAGED more room.

**Why this priority**: Helpful polish; no other function depends on it.

**Independent Test**: On a portrait phone viewport with fresh storage, open CAGED, see the notice, dismiss it, reopen CAGED and reload; it never shows again.

**Acceptance Scenarios**:

1. **Given** a phone in portrait (width ≤ 599, height > width) that has never shown the notice, **When** CAGED opens, **Then** a non-blocking, dismissible notice of at most two lines suggests rotating the device.
2. **Given** the notice was shown, **When** the user dismisses it, ignores it and navigates away, or reloads, **Then** it never appears again on this device.
3. **Given** a tablet, desktop, or phone in landscape, **When** CAGED opens, **Then** no notice shows and none is recorded as shown.
4. **Given** the notice was shown, **When** the user runs **Erase my preferences**, **Then** the record is cleared and the notice may show once more.
5. **Given** storage is unavailable, **When** CAGED opens on a portrait phone, **Then** the notice shows at most once per page load.

---

### Edge Cases

- Only a subset of shapes fits (12 frets): only drawn occurrences can be focused, undrawn letters are disabled in the selector, neighbors skip omitted shapes, and the last drawn occurrence disables **Next shape**.
- Instrument change while in focus (EC-2.3): focus moves to the same letter nearest the old start fret, or to the nearest drawn occurrence. If the occurrence changed, "We adjusted the view to the new instrument" is shown.
- Key or quality change while in focus: same re-resolve rule, no notice. A spelling change keeps focus.
- Tuning becomes non-compatible: focus clears, and the focus controls and connections switch are disabled beside the 015 message.
- Focus near the nut or last fret: centering is clamped to the scroll range.
- Left-handed or mirrored orientation: "Next" still means higher frets. Band, scroll, rings and tag order follow the renderer's mirroring (constitution III).
- Seven strings, or an altered string 6: no chord marker on that string, so no ring there.
- Shared position drawn once as a single marker: one ring on that marker.
- Rapid repeated **Next shape**: each press retargets scroll and ring. The final state is the last neighbor, with no stale ring.
- Keyboard and screen reader: tags, selector, **Previous/Next shape** and **Show connections** are keyboard-operable. Focus changes are announced politely, and the description names each ringed connection's two shapes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to put one shape occurrence in focus by activating its tag (a toggle button), by choosing a letter in the zone-B shape selector (C, A, G, E, D, **See all**), or with **Next/Previous shape**.
- **FR-002**: With an occurrence in focus, the system MUST give its markers `highlighted` emphasis and all other markers `dimmed`. It MUST draw a lit band over the occurrence's chord fret span and scroll the band's centre to the viewport centre, clamped. Dim and scroll MUST complete within 500 ms, and be instant under reduced motion.
- **FR-003**: Activating the focused tag again or choosing **See all** MUST leave focus, restore `normal` emphasis and remove the band.
- **FR-004**: At most one occurrence MUST be in focus. A tag focuses its own occurrence. A letter pick focuses that letter's occurrence nearest the nut, or does nothing if focus is already on that letter. Letters with no drawn occurrence MUST be disabled in the selector.
- **FR-005**: **Next/Previous shape** (zone E, always rendered) MUST move focus to the adjacent drawn occurrence by start fret, toward the body for Next. Previous MUST be disabled on the first drawn occurrence, Next on the last, and both with no focus. There is no wrap-around.
- **FR-006**: The system MUST compute connections as chord-marker positions shared by two adjacent drawn occurrences of the configured key, quality and instrument, never from a fixed table.
- **FR-007**: **Show connections** (zone D switch, off by default) MUST draw a connection ring on every connection marker, regardless of focus. Marker emphasis keeps following focus. When the switch is off, no ring is drawn outside a step transition.
- **FR-008**: On each **Next/Previous shape** press, the positions shared by the departing and arriving occurrences MUST get the ring and `highlighted` emphasis immediately, for a 500 ms transition window (the same window under reduced motion, without animation). A new press MUST restart the window for the new pair.
- **FR-009**: Unit tests MUST verify the full TM-6.3 (C major) and TM-7.2 (C minor) anchor tables as listed in the Clarifications, and that no other position is a connection.
- **FR-010**: The first time CAGED opens on a phone in portrait (width ≤ 599, height > width), the system MUST show a non-blocking, dismissible rotate notice. It MUST record it as shown on display, in the versioned preferences record, and MUST NOT show it again unless preferences are erased. If storage is unavailable, it MUST show at most once per page load. The notice MUST NOT show, or be recorded, in any other context.
- **FR-011**: Focus (letter + occurrence ordinal) and the connections toggle MUST live in the CAGED view state. They survive tool navigation within a visit, reset on reload, and are never stored on the device. **Reset tool** MUST clear focus and turn connections off. Key, quality and instrument changes MUST re-resolve focus per the Clarifications rule, and an instrument change that alters the focused occurrence MUST show the existing "We adjusted the view to the new instrument" notice. A non-compatible tuning MUST clear focus.
- **FR-012**: Focus, band, dimming, rings and the new controls MUST be perceivable without color alone, operable by keyboard and touch (44×44 px targets), and announced politely to assistive technology. The fretboard description MUST name the focused occurrence and the two shapes of each ringed connection. Every new string MUST come from the message catalog in all supported languages.
- **FR-013**: Focus transitions, neighbor resolution, connection computation, focus re-resolution and the notice rule MUST be pure, unit-tested logic separate from the interface.

### Key Entities

- **Shape occurrence**: One drawn instance of a shape (letter, quality, start fret, chord notes), ordered by start fret.
- **Focus**: Either none (**See all**) or one occurrence, identified by letter + ordinal among that letter's drawn occurrences.
- **Connection**: A chord-marker position (string, fret, degree) shared by two adjacent drawn occurrences, labelled with both shapes.
- **Step transition**: The departing/arriving occurrence pair and its 500 ms window, during which their shared positions carry the ring.
- **Rotate notice record**: A boolean in the versioned device preferences. Set when the notice is displayed, and cleared by **Erase my preferences**.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can focus a shape and step to its neighbor in two taps, with the new region centered, and each move completes within 500 ms (instantly under reduced motion).
- **SC-002**: In C major and C minor, 100% of TM-6.3 and TM-7.2 anchors carry the ring when connections are on, and zero other positions do.
- **SC-003**: At the first and last drawn occurrence the matching step command is disabled in 100% of tested keys, qualities and fret counts (12, 22, 24).
- **SC-004**: The rotate notice appears exactly once per device (until preferences are erased) on a portrait phone and zero times elsewhere.
- **SC-005**: Every focus and connection control passes keyboard-only operation and automated axe checks with zero violations at phone, phone-touch and desktop viewports.
- **SC-006**: Focus changes cause no layout shift in the controls, because step buttons are always rendered, and no regression of existing performance budgets.

## Assumptions

- Features 014 (shapes) and 015 (tunings, temporary standard view) are in place. Focus and connections work wherever shapes are drawn, including the temporary standard view.
- Layers beyond Chord, label modes, Listen on the focused shape (FR-6.17), auto-focus from layers (FR-6.12), keyboard shortcuts and share links arrive in later slices and are out of scope.
- The shape selector does not exist yet and is introduced in zone B by this slice. **Show connections** goes in zone D and **Previous/Next shape** in zone E (design §4.3).
- Neighbors are adjacent drawn occurrences by start fret, never wrapping from last to first.
- Reduced motion is the OS `prefers-reduced-motion` preference, read through the existing fretboard motion helper.
- The existing fretboard `region` band and its scroll-into-view behavior are reused for the focus band and centering.
