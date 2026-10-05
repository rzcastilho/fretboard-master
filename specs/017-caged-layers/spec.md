# Feature Specification: CAGED Arpeggio, Pentatonic, and Scale Layers

**Feature Branch**: `feature/017-caged-layers`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/004-caged/004-caged-layers.md (id 004, caged-layers)." Source sections: FR-6.8 to FR-6.10, FR-6.12, FR-6.13, FR-3.7, EC-3.1, EC-6.4, EC-6.5, TM-6.4 to TM-6.7, TM-7.1, TM-7.4, TM-7.5, DM-12, DM-13, design §3.5 (turning a layer on), §4.3, §4.4 (layers list).

## Clarifications

### Session 2026-10-05

Each answer cites a source or is marked **Default** (conventional choice, no source settles it). No material question remains open, so there is no NEEDS HUMAN section.

#### Layers and switches

- Q: Which layers does this slice add? → A: FR-6.8. **Arpeggio**, **Pentatonic** and **Scale**, next to the existing **Chord** layer. **Triad** is out of scope (slice 005). Modes and other scales are out of scope.
- Q: Where are the switches? → A: Design §4.3 and §4.4: zone D (context panel) of CAGED holds "a list of switches with a sample of each layer's marker, doubling as the legend". **Default**: four rows in the order Chord, Arpeggio, Pentatonic, Scale. Each row shows the layer's name, a switch, and a sample marker drawn in the same style as that layer's notes on the fretboard (the Scale row also shows the extra-mark sample once explained below). Initial state: only Chord on (FR-6.1).
- Q: Chord can't be turned off? → A: FR-6.8. While Chord is the only layer on, its switch is disabled (kept in the tab order, announced as unavailable, with the reason available to assistive technology). If any other layer is on, Chord may be turned off; turning off the last remaining non-Chord layer while Chord is off is **not** possible for the same reason: the rule is "at least one layer is always on", so the last layer on is the one that cannot be switched off.
- Q: What happens to the chord shape markers when Chord is off? → A: FR-6.8, FR-6.9. **Default**: chord positions that are also arpeggio, pentatonic or scale notes still show (as a single marker at the highest-priority layer that is on, see priority below); chord-only information is never drawn for a layer that is off. The shape tags, band and focus keep working regardless of which layers are on.
- Q: Where do layers live and how long? → A: Data model §CAGED ("layers on"), constitution III (view state outside components), FR-9.2. Layers on is part of the CAGED view state in the existing module store. It survives navigation between tools within a visit, resets on reload, and is **never** written to device storage. **Reset tool** returns to Chord only (FR-6.1).

#### What each layer contains

- Q: What is a shape's region? → A: TM-6.4, TM-6.6, task text. The region of an occurrence is the fret range of its scale pattern (two or three notes per string, no gaps, lowest to highest note across the strings). Layer notes are only ever drawn inside the focused occurrence's region (or, for Arpeggio without focus, inside each drawn occurrence's own region).
- Q: Arpeggio? → A: FR-6.8, TM-6.4, TM-7.4. Every triad note (R, 3, 5 in major; R, ♭3, 5 in minor) inside the region, excluding positions that are already chord-shape notes of that occurrence (those are drawn as Chord).
- Q: Pentatonic? → A: FR-6.8, TM-6.5, TM-7.5. Major pentatonic (R 2 3 5 6) for major shapes, minor pentatonic (R ♭3 4 5 ♭7) for minor shapes, inside the region.
- Q: Scale? → A: FR-6.8, TM-6.4, TM-7.4. The major scale (major shapes) or natural minor scale (minor shapes), inside the region.
- Q: Computed or looked up? → A: Constitution I, FR-6.16, DM-12. Layer positions are computed from the configured key, quality, tuning, string count and fret count (relative templates per shape and layer, applied to the real tuning). The tables TM-6.4, TM-6.5, TM-7.4 and TM-7.5 are the test anchors for C major and C minor in standard tuning, and other keys are the same pattern shifted by the key offset (modulo the 12-fret cycle).
- Q: Notes outside the instrument? → A: EC-6.4, EC-6.5, TM-6.6. Layer notes past the last fret, or below the open string in an open-position occurrence, are simply left out, with no notice. Whether an occurrence is drawn is still decided by the chord shape (FR-6.4), never by its layer notes.
- Q: Seven strings? → A: FR-6.13, TM-6.7. Chord shapes stay on the six higher strings. Arpeggio, Pentatonic and Scale also draw on string 7, using exactly the frets that string 2 has in that region (same pitch classes, two octaves lower), within the region. Chord never draws on string 7.
- Q: Altered string 6 (FR-6.15) interplay? → *Superseded by the clarify-review answer below ("Altered string 6 with layers").*

#### Without and with focus

*(See also clarify-review answers on overlap with neighbouring occurrences and on the empty-view case, below.)*

- Q: What shows without focus? → A: FR-6.12. With no shape in focus, only Chord and Arpeggio can show, across the whole neck (each drawn occurrence contributes its own arpeggio notes). The Pentatonic and Scale switches remain visible.
- Q: Turning on Pentatonic or Scale without focus? → A: FR-6.12. The first drawn occurrence (nearest the nut) is put in focus exactly as if its tag had been activated (band, dimming, centring, announcement), then the layer turns on. If Pentatonic or Scale is already on and focus is cleared (**See all** or tag toggled off), those two layers are not drawn while there is no focus. Their switches keep their on state, so focusing a shape shows them again. **Default**: this keeps the user's choice without ever showing an unreadable five-pattern overlay.
- Q: With focus, where do layer notes appear? → A: FR-6.5, FR-6.12. Only in the focused occurrence's region. Other occurrences show their chord markers as dimmed, as defined by the focus slice, and show no layer notes except Arpeggio rules above (**Default**: with focus, Arpeggio notes appear in the focused region only, to keep the focus readable).

#### Visual hierarchy

- Q: Emphasis per layer? → A: FR-6.9, constitution V and VII. Chord notes keep the strongest treatment (filled markers with the product-wide note-function shape: root square, third circle, fifth diamond). Arpeggio-only notes use a medium treatment: filled note-function markers at reduced size and opacity. Pentatonic-only and scale-only notes (not part of the triad) are small outlined circles (the "scale degree" marker of constitution VII). Differences are carried by shape, size and opacity, never by color alone. The four emphasis levels (highlighted, normal, dimmed, hidden) remain the only position states; layer treatment is a marker style, not a new level.
- Q: Which marker wins when positions overlap? → A: EC-3.1. One marker per position, taking the highest-priority layer that is **on** and contains it: chord > arpeggio > pentatonic > scale. A scale note that is also a triad note is therefore drawn as arpeggio when Arpeggio is on, and as an outlined scale-degree marker otherwise. Triad notes that are not drawn as chord or arpeggio (those layers off) keep the root, third, fifth identity only when drawn by Chord or Arpeggio.
- Q: Extra mark with Pentatonic and Scale both on? → A: FR-6.10. Scale-only notes (not in the pentatonic): 4th and 7th degree in major, 2nd and ♭6th in minor. They get an extra mark that is perceivable without color (**Default**: a small secondary dot inside or beside the outlined marker). The mark shows only for positions drawn as scale notes, so a 4th or 7th that is also a chord note does not get it. In C major, F and B carry it. The mark has a sample in the Scale row of the layers list while Pentatonic and Scale are both on.
- Q: Labels? → A: FR-3.7. The Name and Interval label types (the CAGED label control is added by this slice, see clarify-review answer "Label control" below) apply to layer notes. Interval labels extend to the scale degrees; the set is R, 2, 3, 4, 5, 6, 7 for major and R, 2, ♭3, 4, 5, ♭6, ♭7 for minor, formatted by the notation module (R in English; T in Portuguese and Spanish, FR-8.8). Name labels follow the notation and accidental preference.
- Q: Motion? → A: Design §3.5 ("Turning a layer on: the layer notes appear from low to high", short). **Default**: newly shown layer notes appear in order from the lowest pitch to the highest, within the short motion duration token. Under `prefers-reduced-motion: reduce` they appear at once. Turning a layer off removes its notes without staggering.

#### Interaction with other CAGED state

- Q: Key, quality, spelling, instrument or tuning changes? → A: **Default**: layers on is unchanged; layer notes are recomputed. Focus follows the focus slice's re-resolve rules. When focus is cleared (including by a non-compatible tuning), Pentatonic and Scale stay on but are not drawn without focus. In the non-compatible tuning view the layer switches are shown disabled, beside the existing message.
- Q: Connections, band, tags? → A: The focus slice's connection rings, band and tags are unchanged. A connection ring stays on its chord marker.
- Q: Listen? → A: FR-6.17 is out of scope (a later slice), as is the Triad layer.

#### Accessibility and text

- Q: Announcements and description? → A: Constitution V and VIII. Each switch change is announced politely (for example "Scale layer on"). Auto-focus caused by FR-6.12 is announced like any focus change. The fretboard text description lists, for the focused occurrence (or the whole neck without focus), the layers on and a count of notes per layer, and names the extra-marked notes. Every new string is in the message catalog (en, pt, es). Switches are keyboard-operable with visible focus and at least 44×44 px targets. The sample markers have text equivalents (the layer name is always visible beside the sample).

### Session 2026-10-05 (clarify review)

Review against the constitution, breakdown 004-caged/004, the macro-spec (FR-3.7, FR-6.8 to FR-6.15, FR-9.1, TM-6.4 to TM-6.7, TM-7.4, TM-7.5) and the code from slices 014 to 016. These answers override anything above that conflicts with them.

- Q: Label control — does CAGED already have one? → A: No. Code check: `caged-model.ts` hard-codes `labelMode: 'interval'`, and slice 014 deferred label controls ("those arrive in 003–005"); slice 016 lists label modes as out of scope. The breakdown for this slice says "Label types add scale degrees", and design §4.3 places **label** in CAGED zone E. **Derived + Default**: this slice adds the CAGED label control in zone E, with the same two options and the same control pattern as the Triads tool: **Interval** (default, FR-6.1) and **Name**. "No label" is not offered, matching the Triads precedent. The choice is the per-tool preferred label type (FR-9.1): it is stored on the device as `labels.caged` in the existing preferences schema (default `interval`, unknown stored values fall back to `interval` per FR-9.6), and it applies to chord and layer markers alike. It is a preference, not musical state, so **Reset tool** treats it exactly as Triads' reset treats the Triads label (no special rule). It is excluded from the "layers on" view state, which is never stored.
- Q: Altered string 6 with layers (Drop D, Drop C)? → A: FR-6.15 ("displays, within the fret region of the shape, the notes of the active layer calculated from the real tuning"), TM-6.4 (every scale pattern covers all six strings), TM-8.3. The slice-015 rule that only G and E shapes show string-6 notes is kept **for the Chord layer only** (its rationale was not inventing a chord voicing). For Arpeggio, Pentatonic and Scale, string 6 shows, for **every** shape, each note of that layer whose real-tuning fret lies inside the occurrence's region, and the "altered" mark stays. The region in an altered-string tuning is the same fret range the occurrence's scale pattern has in Standard for the same key (it is positioned from strings 5 to 1, as occurrences are in slice 015). Priority, emphasis and the extra mark apply to string 6 as to any string. Test anchor: Drop D, D major, E shape in focus (region frets 9 to 12), Scale on: string 6 shows fret 9 (6), fret 11 (7) and fret 12 (R, drawn as Chord); Pentatonic only: frets 9 and 12; Arpeggio adds nothing on string 6 (fret 12 is already Chord).
- Q: Chord off — what exactly disappears? → A: Derived from FR-6.8 and FR-009 (one marker per position). With Chord off, no Chord-layer marker is drawn anywhere, including the dimmed chord markers of non-focused occurrences and the string-6 chord notes in an altered-string tuning. Chord positions that belong to a layer that is on are drawn with that layer's treatment (for example a chord root is drawn as an arpeggio marker when Arpeggio is on). Tags, the band, focus, the shape selector, Next/Previous shape and connection rings for positions that are still drawn keep working. A connection ring is drawn only on a position that has a marker.
- Q: Can the fretboard end up with no drawn layer (Chord off, only Pentatonic or Scale on, then focus cleared)? → A: **Default** (extends FR-6.8's "base layer" intent and FR-6.12's focus requirement; the conventional rule is that the view is never empty). The base-layer rule is applied to **drawable** layers: a layer is drawable when it is on and, for Pentatonic or Scale, a shape is in focus. (a) A switch is disabled when turning it off would leave no drawable layer. (b) When focus is cleared (See all, tag toggled off, a tuning change) and no drawable layer remains, Chord is turned back on automatically, announced politely ("Chord layer on"); Pentatonic and Scale keep their on state. Test: Chord off, Scale on, focus E; choose See all → Chord is on, Scale switch still on, no scale notes drawn.
- Q: Overlap between the focused region and other occurrences' chord markers? → A: **Default** (FR-009 one marker per position; slice 016 already draws a position shared with the focused occurrence as highlighted). Inside the focused occurrence's region, each position is resolved from the focused occurrence's layers first: if the position belongs to any layer that is on for the focused occurrence, it is drawn once, at that layer's treatment and `highlighted` emphasis, and a non-focused occurrence's dimmed chord marker at the same position is not drawn. Test: C major, E shape in focus, Arpeggio on: string 5 fret 7 (the 3rd of the E region, also a chord note of the G shape) shows one highlighted arpeggio marker. Outside the focused region, non-focused occurrences show only their dimmed chord markers (when Chord is on).
- Q: Without focus, a position in two occurrences' regions? → A: Derived from FR-009. Priority is resolved per position across all drawn occurrences: if any occurrence draws it as Chord, it is a chord marker; otherwise an arpeggio marker. Never two markers.
- Q: Arpeggio set vs Chord set? → A: Derived from FR-6.8 ("every triad note in the region") and FR-009. The Arpeggio layer contains **all** triad notes in the region; the "not already in the chord" wording is the drawing result of priority (Chord wins while it is on). With Chord off, the chord positions are drawn as arpeggio.
- Q: When does the low-to-high stagger play? → A: **Default** (design §3.5 names only "turning a layer on"). The stagger plays only for the notes newly added when a layer switch is turned on (including the auto-focus case of FR-6.12, after the focus move). Key, quality, spelling, tuning, instrument or focus changes redraw layer notes with the existing transitions, without stagger. Turning a layer off removes its notes at once.
- Q: What counts as a "note count per layer" in the text description? → A: **Default**: the number of markers drawn with that layer's treatment after priority resolution (so a chord root counts once, under Chord), within the focused region, or across the neck without focus. Layers that are on but not drawable are named as "on, shown when a shape is in focus".
- Q: No occurrence drawn at all? → A: **Default**: when no occurrence is drawn (non-compatible tuning, or none fits), the layer switches are shown disabled, keeping their state. FR-6.12 auto-focus never targets an undrawn occurrence.

No question met the materiality test, so there is no NEEDS HUMAN section.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the scale inside the shape (Priority: P1)

Bruna focuses a shape and turns on Scale to see every scale note around the chord she is holding, with its degree.

**Why this priority**: Linking chord and melody in one region is the point of the slice. Scale also exercises the whole pipeline (region, priority, labels, seven strings).

**Independent Test**: Open CAGED in C major, focus the E shape, turn on Scale with the Interval label, and compare against TM-6.4.

**Acceptance Scenarios**:

1. **Given** C major, standard tuning, 6 strings and the E shape in focus, **When** the user turns on Scale, **Then** the region shows 7-8-10 on string 6 through 7-8-10 on string 1 exactly as in TM-6.4, with scale degrees as labels, chord notes still drawn as chord markers, and non-chord scale notes as outlined markers.
2. **Given** the same state, **When** the user changes the label to Name, **Then** every layer note shows its note name in the current notation.
3. **Given** a 7-string instrument, **When** Scale is on for a focused shape, **Then** string 7 shows the same frets as string 2 in that region, and Chord shows nothing on string 7.
4. **Given** a shape whose region extends past the last fret, **When** Scale is on, **Then** the notes beyond the last fret are left out without a notice and the occurrence is still drawn.
5. **Given** an open-position occurrence (for example C major, C shape), **When** Scale is on, **Then** notes that would fall below the open string are omitted.
6. **Given** layers just turned on, **When** the notes appear, **Then** they appear from low to high (instantly under reduced motion).

---

### User Story 2 - Layer switches double as the legend (Priority: P1)

The context panel lists the layers, each with a switch and a sample marker.

**Why this priority**: No layer can be shown without the switches, and the legend is how users decode the markers.

**Independent Test**: Open CAGED, check the four rows, toggle each, and check the base-layer rule.

**Acceptance Scenarios**:

1. **Given** CAGED opened fresh, **When** the panel renders, **Then** Chord is on, Arpeggio, Pentatonic and Scale are off, each row has a sample marker, and Chord's switch is disabled.
2. **Given** only Chord on, **When** the user turns on Arpeggio, **Then** Chord's switch becomes enabled, and turning Chord off leaves Arpeggio on with its switch now disabled.
3. **Given** the layers list, **When** the user compares sample markers with the fretboard, **Then** each sample matches the style of that layer's notes (filled, medium, outlined).
4. **Given** layers on, **When** the user navigates to another tool and back, **Then** layers are as left. After a reload, only Chord is on. **Reset tool** returns to Chord only.
5. **Given** layers on, **When** device storage is inspected, **Then** no layer state is stored.
6. **Given** CAGED with Name labels chosen, **When** the page is reloaded, **Then** labels are still Name (stored preference) while layers are back to Chord only.
7. **Given** Chord off, only Scale on and a shape in focus, **When** the user chooses **See all**, **Then** Chord turns back on and is announced, the Scale switch stays on, and no scale notes are drawn.

---

### User Story 3 - Arpeggio around the chord (Priority: P1)

The player adds Arpeggio to see the triad notes the shape does not already play.

**Why this priority**: It works with and without focus and is the simplest extension of the chord.

**Independent Test**: C major, all shapes, turn on Arpeggio, and check TM-6.4 R, 3 and 5 positions not in the chord.

**Acceptance Scenarios**:

1. **Given** C major with all shapes visible, **When** Arpeggio is turned on, **Then** every R, 3 and 5 in each drawn occurrence's region that is not a chord note of that occurrence is drawn with the arpeggio treatment, across the whole neck.
2. **Given** A minor, **When** Arpeggio is on, **Then** the notes are R, ♭3 and 5 and no major third appears.
3. **Given** Arpeggio with a shape in focus, **When** the view renders, **Then** arpeggio notes appear only in the focused region.
4. **Given** a position that is a chord note, **When** Arpeggio is on, **Then** exactly one marker shows there, drawn as Chord.

---

### User Story 4 - Pentatonic box around the chord (Priority: P2)

The player turns on Pentatonic to find the familiar box.

**Why this priority**: The best-known melodic pattern, and it triggers auto-focus.

**Independent Test**: A minor, Em shape in focus, turn on Pentatonic, check frets 5 to 8.

**Acceptance Scenarios**:

1. **Given** A minor and the Em shape in focus, **When** Pentatonic is turned on, **Then** the familiar minor pentatonic box appears at frets 5 to 8 around the chord (TM-7.5 shifted to A: strings 6 to 1 at 5-8, 5-7, 5-7, 5-7, 5-8, 5-8).
2. **Given** C major with all shapes visible and no focus, **When** the user turns on Pentatonic, **Then** the first drawn occurrence takes focus and the pentatonic notes of that region show (TM-6.5).
3. **Given** Pentatonic on and focus then cleared, **When** the view renders, **Then** no pentatonic notes are drawn, the switch stays on, and focusing a shape shows them again.
4. **Given** a major shape, **When** Pentatonic is on, **Then** the notes are R, 2, 3, 5, 6; for a minor shape R, ♭3, 4, 5, ♭7.

---

### User Story 5 - See the notes that are only scale (Priority: P2)

With Pentatonic and Scale on together, the notes outside the pentatonic stand out.

**Why this priority**: It answers "what do I add to the box to get the full scale".

**Independent Test**: C major, a focused shape that contains F and B, with both layers on.

**Acceptance Scenarios**:

1. **Given** C major with Pentatonic and Scale on and a shape in focus, **When** the view renders, **Then** every F and B in the region carries the extra mark and no other note does.
2. **Given** minor, **When** both layers are on, **Then** the 2nd and ♭6th carry the extra mark.
3. **Given** only Scale on, **When** the view renders, **Then** no extra mark is shown.
4. **Given** a 4th or 7th that is also drawn as a chord or arpeggio marker, **When** both layers are on, **Then** it has no extra mark.

---

### User Story 6 - Readable with everything on (Priority: P2)

With every layer on, the chord still stands out.

**Why this priority**: The hierarchy keeps the tool usable.

**Independent Test**: Turn on all layers on a focused shape, check marker styles and overlap resolution.

**Acceptance Scenarios**:

1. **Given** all layers on and a shape in focus, **When** the view renders, **Then** chord markers are the strongest, arpeggio-only markers medium, and pentatonic or scale notes outside the triad are outlined, distinguishable without color.
2. **Given** a position in several layers, **When** drawn, **Then** a single marker shows at the highest priority: chord > arpeggio > pentatonic > scale.
3. **Given** all layers on, **When** the text description is read, **Then** it lists the layers on and note counts for the focused region.

---

### Edge Cases

- Without focus, Pentatonic and Scale are never drawn; turning either on moves focus to the first drawn occurrence.
- Fewer frets (for example 12): only drawn occurrences carry layers; layer notes past the last fret disappear without a notice.
- Open-position occurrences and keys where part of the region falls below the nut: those notes are omitted.
- Seven strings: layers extend to string 7 with string 2's frets; Chord does not.
- Altered string 6 and transposed tunings: layer notes come from the real tuning. In an altered-string tuning, Arpeggio, Pentatonic and Scale draw on string 6 for every shape inside the region; the Chord layer keeps the slice-015 rule (G and E shapes only).
- Chord off, only Pentatonic or Scale on, focus cleared: Chord turns back on automatically so the view is never empty.
- Focused region overlapping a neighbour's chord note: one highlighted marker from the focused occurrence's layers.
- Non-compatible tuning: layer switches are disabled beside the existing message, layers on is kept.
- Spelling change (for example F♯ to G♭): layers stay on and note names respell.
- Same position in several layers: one marker only.
- Chord off with other layers on: chord positions still show at the highest on-layer priority; switching Chord back on restores chord markers.
- Rapid toggling of layers: each change retargets the low-to-high appearance, with no stale markers.
- Left-handed and mirrored orientation: "low to high" refers to pitch, and rendering mirrors as for any marker (constitution III).
- Keyboard and screen reader: switches are operable, announced politely, with visible focus.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The CAGED context panel MUST list the layers Chord, Arpeggio, Pentatonic and Scale, each with a switch and a sample marker that matches how the layer's notes are drawn, so the list is also the legend. Only Chord is on initially.
- **FR-002**: At least one drawable layer MUST remain (a layer is drawable when it is on and, for Pentatonic or Scale, a shape is in focus). A switch whose change would leave no drawable layer MUST be disabled (Chord, while it is the only one on). When focus is cleared and no drawable layer remains, Chord MUST turn back on automatically and be announced, with Pentatonic and Scale keeping their on state.
- **FR-003**: The Arpeggio layer MUST contain every triad note (R, 3, 5 in major; R, ♭3, 5 in minor) in the shape's region; positions that are chord notes are drawn as Chord while Chord is on (FR-009), and as Arpeggio when Chord is off. With Chord off, no Chord-layer marker MUST be drawn anywhere, including dimmed markers of non-focused occurrences.
- **FR-004**: Pentatonic MUST draw the major pentatonic (R 2 3 5 6) for major shapes and the minor pentatonic (R ♭3 4 5 ♭7) for minor shapes. Scale MUST draw the major scale for major shapes and the natural minor scale for minor shapes.
- **FR-005**: A shape's region MUST be the fret range of its scale pattern (two or three notes per string, no gaps). Layer notes MUST be calculated from the configured key, quality, tuning, string count and fret count, and verified against TM-6.4, TM-6.5, TM-7.4 and TM-7.5.
- **FR-006**: Layer notes past the last fret, or below the open string in an open-position occurrence, MUST be omitted without a notice. The chord shape alone MUST decide whether an occurrence is drawn.
- **FR-007**: With seven strings, Arpeggio, Pentatonic and Scale MUST also draw on string 7, using the frets of string 2 inside the region. Chord MUST NOT draw on string 7.
- **FR-008**: Visual hierarchy: chord notes MUST have the most emphasis, arpeggio-only notes medium emphasis, and pentatonic or scale notes outside the triad MUST be outlined markers. The hierarchy MUST be perceivable without color and MUST NOT add emphasis levels beyond highlighted, normal, dimmed, hidden.
- **FR-009**: A position that belongs to several layers that are on MUST show a single marker for the highest-priority one: chord > arpeggio > pentatonic > scale.
- **FR-010**: With Pentatonic and Scale both on, scale-only notes (4th and 7th in major; 2nd and ♭6th in minor) MUST carry an extra mark perceivable without color. In C major, F and B MUST carry it. Notes drawn as chord or arpeggio MUST NOT carry it.
- **FR-011**: CAGED MUST offer a label control in zone E with **Interval** (default) and **Name**, stored as the per-tool label preference `labels.caged` (FR-9.1, FR-9.6 fallback to `interval`). The Interval label MUST show scale degrees for layer notes (R, 2, 3, 4, 5, 6, 7 in major; R, 2, ♭3, 4, 5, ♭6, ♭7 in minor), and the Name label MUST show note names, both through the notation module.
- **FR-012**: With no shape in focus, only Chord and Arpeggio MUST be drawn, across the whole neck. Turning on Pentatonic or Scale without focus MUST put the first drawn occurrence in focus. Pentatonic and Scale MUST NOT be drawn while there is no focus, and MUST reappear when a shape is focused, because their switches keep their state.
- **FR-013**: Notes added by turning a layer switch on MUST appear from low to high pitch within the short motion duration, and instantly under reduced motion. Other redraws (key, quality, spelling, tuning, instrument, focus) MUST NOT stagger.
- **FR-017**: In an altered-string tuning, Arpeggio, Pentatonic and Scale MUST draw on string 6, for every shape, each layer note whose real-tuning fret lies in the occurrence's region (the region the scale pattern has in Standard for that key, positioned from strings 5 to 1); the Chord layer MUST keep slice 015's G-and-E-only rule. Drop D, D major, E shape, Scale on: string 6 frets 9, 11, 12.
- **FR-018**: Each position MUST be resolved once. Inside the focused region the focused occurrence's layers take precedence and the position is drawn `highlighted`, replacing any non-focused occurrence's dimmed chord marker there. Without focus, priority is resolved across all drawn occurrences.
- **FR-014**: Layers on MUST live in the CAGED view state, survive tool navigation within a visit, reset on reload, never be stored on the device, and be reset to Chord only by **Reset tool**. Key, quality, spelling, instrument and tuning changes MUST recompute layer notes and keep layers on. A non-compatible tuning MUST show the switches disabled.
- **FR-015**: Switches, sample markers and the extra mark MUST be operable by keyboard and touch (44×44 px targets), announced politely, and described in the fretboard text description (layers on, note counts, extra-marked notes). Every new string MUST come from the message catalog in all supported languages.
- **FR-016**: Region computation, layer note calculation, priority resolution, the extra-mark rule, the drawable-layer (base-layer) rule, focused-region overlap resolution, the altered-string-6 layer rule and the focus requirement MUST be pure, unit-tested logic separate from the interface, with table tests reproducing TM-6.4, TM-6.5, TM-7.4 and TM-7.5 and property tests across generated tunings, per constitution I.

### Key Entities

- **Layer**: One of Chord, Arpeggio, Pentatonic or Scale, with an on or off state. Triad is a later slice.
- **Layer template**: For a shape and layer, the relative positions (string, fret offset) with the degree of each note (DM-12), applied to the real tuning.
- **Shape region**: The fret range of an occurrence's scale pattern; the boundary of its layer notes (DM-13).
- **Layer note**: A position (string, fret) with degree, belonging to one or more layers, drawn once at the highest-priority layer that is on.
- **Extra mark**: The distinguishing mark on scale-only notes when Pentatonic and Scale are both on.
- **CAGED label preference**: Interval or Name, stored on the device per tool (`labels.caged`, default Interval); not part of the CAGED view state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from the initial state to a focused shape with the scale showing in two actions (focus a shape, turn on Scale), and the layer notes appear within the short motion duration.
- **SC-002**: In C major and C minor, standard tuning, 100% of positions in TM-6.4, TM-6.5, TM-7.4 and TM-7.5 are drawn for the corresponding layer and no other layer positions appear inside the region.
- **SC-003**: In every tested key, quality and fret count (12, 22, 24), the base-layer rule holds in 100% of toggle sequences, and no position ever shows more than one marker.
- **SC-004**: With Pentatonic and Scale on in C major, F and B carry the extra mark in 100% of regions that contain them, and no other note does.
- **SC-005**: Turning on Pentatonic or Scale with all shapes visible always ends with the first drawn shape in focus.
- **SC-006**: Every layer control passes keyboard-only operation and automated accessibility checks with zero violations at phone, phone-touch and desktop viewports, and existing performance budgets do not regress, including smooth scrolling with 7 strings, 24 frets and every layer on.

## Assumptions

- Features 014 (shapes), 015 (tunings), and 016 (focus, shape selector, connections) are in place. The band, tags, dimming, scroll centring, notices and view-state store from those slices are reused.
- The Triad layer, Listen on layers (FR-6.17), share-link encoding of layers and modes or other scales are out of scope.
- CAGED currently has no label control (labels fixed to Interval since slice 014); this slice adds it (Interval, Name) and extends Interval to scale degrees.
- "Low to high" means ascending pitch, with ties between strings broken by lower string first.
- Where this spec chooses a default (marker styling details, extra-mark form, Chord-off behavior), tests assert the observable rule, not the exact pixel styling.
