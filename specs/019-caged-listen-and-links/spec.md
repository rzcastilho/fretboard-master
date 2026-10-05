# Feature Specification: CAGED Listen and Links to Other Tools

**Feature Branch**: `feature/019-caged-listen-and-links`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/004-caged/006-caged-listen-and-links.md (id 006, caged-listen-and-links)." Source sections: FR-6.17, FR-7.1 to FR-7.11, FR-1.6, FR-4.7, FR-5.16, EC-7.1 to EC-7.7.

## Clarifications

### Session 2026-10-05 (clarify reviewer)

Sources: constitution v1.8.0; breakdown `004-caged/006`; macro-spec FR-1.6, FR-1.7, FR-5.16, FR-6.11–6.17, FR-7.1–7.11, EC-7.1–7.7, data model §"Sound" (`tempo: slow, medium, fast`); existing code (`src/lib/audio`, `src/lib/state/caged*.ts`, `links.ts`, `links.svelte.ts`, `prefs/schema.ts`, `shell/StopButton.svelte`). "Derived" = settled by a source; "Default" = assumed conventional choice.

**Playback content**

- Q: Which layer wins when several are on? → A (derived, FR-6.17): Scale > Pentatonic > Arpeggio > Triad > Chord only. Scale and Pentatonic both on → Scale plays. Triad on but the selected set has no triad in the focused shape → Chord-only playback (Triad is the only layer above Chord, so "next widest" is always Chord).
- Q: What does "the region" contain? → A (derived, 017): exactly the positions the active layer draws for the focused occurrence (including string 7 on seven-string instruments and the altered string 6 notes per FR-6.13/6.15), not the hidden or dimmed positions of other shapes.
- Q: Same pitch at two positions in the region (unison, e.g. string 2 fret 5 and string 1 open)? → A (default, a run plays each pitch once): each pitch sounds once; the position on the lower-pitched (thicker) string is the one that sounds and pulses.
- Q: Arpeggio order? → A (default): every distinct pitch ascending from the region's lowest to its highest, then descending back to the lowest; the top note sounds once (no repeat at the turnaround). Total steps = 2n − 1 for n distinct pitches.
- Q: Pentatonic/Scale order? → A (derived + default): ascending from the region's lowest root to the region's highest note, then descending back to that lowest root; region notes below the lowest root are not played; the top note sounds once. "Root" = pitch class of the key.
- Q: Which notes does the Chord-only strum include? → A (derived, FR-6.13/6.15): exactly the chord markers drawn for the occurrence, ordered lowest pitch to highest. String 7 is never included; on an altered-string-6 tuning string 6 is not included (the chord is drawn on strings 5–1).
- Q: Triad playback? → A (derived, FR-7.3 + existing Triads Listen): the triad of the currently selected Triad string set in the focused occurrence, arpeggiated low to high then as a block, with the same timing Triads' Listen uses today (120 BPM steps, `LISTEN_BPM`). Tempo does not apply.
- Q: No shape in focus? → A (derived, FR-6.17): every drawn occurrence, in fret order from the nut toward the body (repeated letters included), each played as the Chord-only strum + block, regardless of which layers are on (no focus allows only Chord/Arpeggio, FR-6.12).
- Q: Which tuning supplies pitches in CAGED's temporary standard view (FR-6.14)? → A (default, Principle I "sound = what is shown"): the tuning the view currently draws, i.e. the temporary standard tuning while it is active, otherwise the instrument's real tuning.
- Q: When is Listen unavailable? → A (default): when no occurrence is drawn (non-compatible tuning without the temporary view, or no shape fits the fret count). It is shown disabled with a visible reason, not hidden.

**Timing and tempo**

- Q: Tempo values? → A (default; medium = today's `LISTEN_BPM`): one note per beat at slow 80 BPM (750 ms), medium 120 BPM (500 ms), fast 180 BPM (≈333 ms). Default medium.
- Q: What does tempo apply to? → A (derived, FR-7.5): only CAGED Arpeggio, Pentatonic and Scale playback. Chord strum, Triad playback, and all Notes/Triads playback keep their fixed timing. No tempo control is added to Notes or Triads.
- Q: "Slow strum" timing? → A (default): strum notes start 250 ms apart and keep ringing (they are not cut at the next onset); the block starts 500 ms after the last strum onset and rings for the normal note duration (`NOTE_MS`, 1500 ms). In the no-focus sequence the next shape's strum starts 1500 ms after the previous block onset.
- Q: Where is the tempo control and how is it stored? → A (derived, data model + Principle IX; default placement): a three-option choice group (Slow / Medium / Fast) next to Listen in CAGED, always visible. Stored as a new optional `tempo` field in the existing preferences record (`'slow' | 'medium' | 'fast'`), parsed with a picklist + fallback to `medium`, stored only when not `medium`, with `PREFS_VERSION` unchanged (same additive pattern as `handedness`, `orientation`, `rotateHint`). Included in "erase preferences".
- Q: Tempo changed mid-sequence? → A (default, consistent with EC-7.4): playback stops; the next Listen uses the new tempo.

**Stopping**

- Q: Which state changes stop playback? Slice 016 R-11 and 017 R-16 say focus/layer changes do not stop playback. → A (derived, EC-7.4 / FR-7.9 supersede those for sequences): while a **Listen sequence** is playing, any change of key, quality, spelling, focus (tag, shape selector, See all, Next/Previous, auto-focus), layer switch, Triad string set, tempo, instrument/tuning, temporary-view toggle, or tool/screen stops it. Single-note playback from tapping a position keeps the 016/017 rule (layer and focus changes do not cut it). Label type and Show connections changes do not stop playback (they change no pitch).
- Q: Stop control? → A (derived, existing code): reuse the shared `StopButton` / `playback.stop()`; Stop is visible and focusable only while a sequence plays; activating it ends sound and pulses. Listen pressed again during a sequence restarts from the beginning (new request interrupts, FR-7.9).

**Carry-over (FR-1.6)**

- Q: When does carry apply? → A (derived, ADR 0011 / `links.svelte.ts`): only in the handler of a user-activated tool switch (persistent nav) or a shortcut, never from URL, history or storage. `linkTools` gains the four CAGED pairs below; Notes↔Triads stays unchanged.
- Q: Notes → CAGED? → A (derived): exactly one note selected → CAGED key = that pitch class with `spellingOverride: 'none'`; quality, layers, connections, label unchanged (CAGED's session state; `major` if never used). Same pitch class as the current key → no-op (keeps spelling and focus). Zero or 2+ notes → CAGED reopens as left (FR-1.7).
- Q: CAGED → Notes? → A (derived): Notes selection = [root, third, fifth] pitch classes of the CAGED key and quality, replacing any selection; other Notes state unchanged. CAGED always has a key, so this always applies.
- Q: Triads → CAGED? → A (derived): main triad only (Compare's second quality ignored, as in `carryFromTriads`). Major/minor → CAGED key = Triads root pc + Triads `spellingOverride`, quality = Triads quality. Diminished/augmented → root pc with `spellingOverride: 'none'` and quality `major`. Inversion and string set are not carried.
- Q: CAGED → Triads? → A (derived + default): Triads root = CAGED root pc, quality = CAGED quality, `spellingOverride` = CAGED's; inversion, string set, view and Compare keep their last values (via existing `carryTriad`, which revalidates).
- Q: Focus after a carried key/quality? → A (derived, existing `withResolvedFocus`, R-02): the carry behaves as if the user picked that key/quality in CAGED — a focus is re-resolved to the same letter's nearest occurrence, and cleared only when that letter no longer has an occurrence. (Replaces the earlier "focus is cleared" edge case.) Carry stops any playback.
- Q: Unusual carried spellings (A♯ major)? → A (derived, existing CAGED spelling override + `switchTo` guidance from 014/015): accepted as-is; chord/scale names spell with 𝄪/𝄫 where needed and the existing "Switch to B♭" guidance is offered. No new guidance UI.

**Shortcuts**

- Q: "CAGED in this key" from the position card? → A (derived, mirrors `openTriadsFromNote`): carries the focused position's pitch class as key (rules of Notes → CAGED, regardless of the Notes selection), leaves Notes state unchanged, and navigates with one history entry.
- Q: "View in CAGED" landing? → A (derived FR-5.16 + FR-6.12 + default): key/quality per Triads → CAGED, Triad layer on. If a focus exists after re-resolution it is kept; otherwise the occurrence nearest the nut is focused (FR-6.12 auto-focus). The Triad string set is CAGED's default set (`defaultTriadSet`); matching the Triads string set/inversion is out of scope. Other layers keep their state.
- Q: Disabled "View in CAGED" for diminished/augmented? → A (default, WCAG convention): the button stays visible and focusable with `aria-disabled="true"`, does nothing when activated, and a visible one-line note "CAGED covers major and minor chords" is linked via `aria-describedby`. Disabled styling is not colour-only (also reduced opacity + the visible note).

**Languages and metrics**

- Q: "Every supported language"? → A (derived, constitution VIII, 017 R-15): today only `messages/en.json` ships; every new string is a catalog key there and the no-raw-text test guards it.
- Q: Listen latency target? → A (derived, constitution VI "Tap to sound ≤ 100 ms"): SC-002 aligned to 100 ms.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hear the focused shape (Priority: P1)

A learner who has a CAGED shape in focus taps **Listen** and hears what the fretboard shows. What plays depends on the widest layer that is on.

**Why this priority**: Seeing and hearing together is the core value; the links (Stories 3 to 5) are useful without sound, but sound is what this slice adds to CAGED.

**Independent Test**: Focus the E shape with only Chord on, tap Listen, and check the order and timing of the notes played and lit; repeat with each other layer.

**Acceptance Scenarios**:

1. **Given** the E shape in focus and only Chord on, **When** the user taps Listen, **Then** the chord notes sound slowly from the lowest string to the highest, then all together as a block.
2. **Given** a shape in focus and Triad on with a triad selected, **When** the user taps Listen, **Then** the selected triad plays arpeggiated low to high, then as a block.
3. **Given** a shape in focus and Arpeggio on (no Pentatonic, Scale, Triad), **When** the user taps Listen, **Then** the arpeggio notes of the region play one at a time in steady rhythm from the region's lowest note to its highest, then back down.
4. **Given** a shape in focus and Scale (or Pentatonic) on, **When** the user taps Listen, **Then** the notes of the region play up and back down, starting and ending on the region's lowest root.
5. **Given** several layers on, **When** the user taps Listen, **Then** the widest layer plays (Scale over Pentatonic over Arpeggio over Triad over Chord only).
6. **Given** no shape in focus, **When** the user taps Listen, **Then** each drawn occurrence's chord plays in turn, as in scenario 1, from the occurrence nearest the nut toward the body.
7. **Given** any sequence playing, **When** each note sounds, **Then** that position pulses on the fretboard in sync, including when sound is muted.

---

### User Story 2 - Control playback (Priority: P1)

The learner chooses tempo, stops a sequence, and trusts that playback never lingers after the view changes.

**Why this priority**: Without Stop and predictable interruption, sequences are unusable in a study session.

**Independent Test**: Start a scale sequence, press Stop; start another and change key, layer, or tool; change tempo and replay.

**Acceptance Scenarios**:

1. **Given** a sequence playing, **When** the user activates **Stop**, **Then** sound and pulsing end immediately.
2. **Given** a Listen sequence playing, **When** the shape in focus, key, quality, spelling, layer, Triad string set, tempo, tuning, or tool changes, **Then** playback stops; changing the label type or Show connections does not stop it.
3. **Given** the user picks slow, medium, or fast, **When** an arpeggio or scale sequence plays, **Then** it uses a steady rhythm at that tempo, and the choice is remembered on the device for later sessions.
4. **Given** playback in progress, **When** the user requests any other sound, **Then** the earlier playback is interrupted.
5. **Given** the app becomes hidden, **When** playback is running, **Then** it stops and does not resume on return.

---

### User Story 3 - Carry key and chord between Notes, Triads and CAGED (Priority: P2)

The learner moves between the three tools and the musical context follows.

**Why this priority**: Makes the three tools one study, but depends on tools that already exist.

**Independent Test**: Make each hand-off listed below and check the destination state.

**Acceptance Scenarios**:

1. **Given** Notes with exactly one note selected, **When** the user goes to CAGED, **Then** that note is the key and the quality is CAGED's last-used quality.
2. **Given** CAGED with a key and quality, **When** the user goes to Notes, **Then** the chord's three notes are selected.
3. **Given** Triads with a major or minor triad, **When** the user goes to CAGED, **Then** CAGED opens with that root and quality.
4. **Given** Triads with a diminished or augmented triad, **When** the user goes to CAGED, **Then** only the root carries over and CAGED opens in major.
5. **Given** CAGED with key and quality, **When** the user goes to Triads, **Then** they become the Triads root and quality.
6. **Given** Notes with zero or several notes selected, **When** the user switches tools, **Then** the destination opens in its last session state, or its initial state if never used.
7. **Given** a carried key such as A♯ major, **When** CAGED opens, **Then** it is accepted and shown with double-accidental guidance where the chord needs it.

---

### User Story 4 - Shortcuts: CAGED in this key, View in CAGED (Priority: P2)

Explicit buttons make the links discoverable.

**Why this priority**: Same value as Story 3, as direct commands, plus the Triad-layer landing.

**Independent Test**: Use each shortcut and check the destination; check the diminished and augmented disabled state.

**Acceptance Scenarios**:

1. **Given** a position focused in Notes, **When** the user opens the position card, **Then** it offers **CAGED in this key**, which opens CAGED with that note as key (quality as in Story 3, scenario 1).
2. **Given** Triads on B♭ minor, **When** the user taps **View in CAGED**, **Then** CAGED opens on B♭ minor with the Triad layer on.
3. **Given** Triads on B diminished (or any augmented triad), **When** the user looks at **View in CAGED**, **Then** it is disabled (focusable, `aria-disabled`), with the visible note "CAGED covers major and minor chords" linked to it for assistive technology, and not shown by colour alone.

---

### Edge Cases

- Sound cannot start or fails to load: one notice per session, "Sound is not available on this device right now"; the sound control shows the unavailable state; pulsing still works.
- Device silent or volume at zero: not detected; the sound control's help lists it first.
- Rapid repeated taps on Listen or positions: each interrupts the previous; sounds never pile up.
- App hidden then visible: no automatic resume.
- Audio output switched: playback may stop; the next request works normally.
- Lowest tuned notes (seventh string, low tunings): no special handling beyond the normal timbre.
- Seven-string and altered-string-6 tunings: Arpeggio, Pentatonic and Scale playback include string 7 and altered string 6 notes in the region, from the real tuning; the chord strum plays only the drawn chord markers (never string 7; not string 6 when it is altered).
- Non-compatible tuning (no shapes drawn) or no shape fits the fret count: Listen is disabled with a visible reason. In the temporary standard view, Listen plays in the temporary tuning.
- Triad layer on with no triad available in the selected set (and no wider layer on): Listen plays the Chord-only strum and block.
- Carried key with an uncommon spelling (A♯ major, D♯ major): accepted; spellings follow the accidental preference with doubles shown as 𝄪/𝄫.
- Notes with zero or more than one note selected: no key carried to CAGED; context rule for "no selection" applies.
- Focus after a carried key or quality: re-resolved to the same shape letter's nearest occurrence (as when the key is picked in CAGED); cleared only when that letter has no occurrence.
- Sound muted: Listen still runs and pulses without sound.
- Same pitch at two positions of the region: sounds once, on the thicker string.
- Tempo changed mid-sequence: playback stops; the next Listen uses the new tempo.
- Listen tapped again mid-sequence: restarts from the beginning.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Listen MUST act on the shape in focus and play the widest layer on: Scale, then Pentatonic, then Arpeggio, then Triad (when the selected set has a triad), then Chord only (FR-6.17). The region is exactly the positions the active layer draws for the focused occurrence.
- **FR-002**: Chord-only Listen MUST strum the drawn chord markers from lowest to highest pitch with onsets 250 ms apart, each note ringing on, then play them as a block 500 ms after the last strum onset. String 7 and an altered string 6 are never part of the strum.
- **FR-003**: Triad Listen MUST play the triad of the selected Triad string set in the focused occurrence, arpeggiated low to high then as a block, with Triads' existing Listen timing (120 BPM steps); tempo does not apply.
- **FR-004**: Arpeggio Listen MUST play each distinct pitch of the region's arpeggio once, ascending from lowest to highest then descending to the lowest, without repeating the top note (2n − 1 steps). A pitch present at two positions sounds and pulses on the thicker string.
- **FR-005**: Pentatonic and Scale Listen MUST play the region's distinct pitches from the region's lowest root up to the region's highest note and back down to that root, without repeating the top note; region notes below the lowest root are not played. Unisons as in FR-004.
- **FR-006**: With no shape in focus, Listen MUST play every drawn occurrence as in FR-002, in fret order from the nut toward the body, each next strum starting 1500 ms after the previous block, whatever layers are on.
- **FR-007**: Every pitch MUST come from the tuning the view draws (open string pitch plus fret): the real tuning, or the temporary standard tuning while CAGED's temporary view is active.
- **FR-008**: Arpeggio, Pentatonic and Scale playback MUST use one note per beat at the chosen tempo: slow 80 BPM, medium 120 BPM, fast 180 BPM; default medium. The tempo control (Slow / Medium / Fast) sits next to Listen in CAGED and is always visible; it does not affect chord, triad, Notes or Triads playback. It is stored as optional preference field `tempo` (`slow|medium|fast`, written only when not medium, `PREFS_VERSION` unchanged) and erased with the other preferences.
- **FR-009**: The shared **Stop** control MUST be visible during any Listen sequence and end sound and pulses; a new sound request (including Listen again) MUST interrupt playback in progress.
- **FR-010**: During a Listen sequence, any change of key, quality, spelling, focus (including auto-focus and Next/Previous), layer, Triad string set, tempo, instrument/tuning, temporary view, or tool MUST stop playback; label type and Show connections changes MUST NOT. Single tapped notes keep the existing rule (focus and layer changes do not cut them). Playback MUST stop when the app is hidden and not resume.
- **FR-011**: Each note MUST pulse on the fretboard in sync as it sounds, including when muted, and the pulse MUST NOT rely on colour alone.
- **FR-012**: Audio MUST start only on a user gesture; the existing sound control (mute, volume) applies; failure shows the single-notice behaviour above.
- **FR-013**: Listen, Stop, tempo and playback state MUST be operable by keyboard and announced to assistive technology, with a visible label for each. When no occurrence is drawn, Listen MUST be disabled with a visible reason.
- **FR-014**: On a user tool switch, Notes with exactly one note selected MUST carry to CAGED as the key (spelling override cleared; no-op if it equals the current key), keeping CAGED's quality and other session state (major if never used) (FR-1.6). Carry happens only in the switch/shortcut handler, never from URL, history or storage.
- **FR-015**: CAGED MUST carry its chord's three pitch classes (root, third, fifth) to Notes, replacing the selection.
- **FR-016**: Triads MUST carry the main triad's root, spelling override and quality to CAGED; diminished or augmented carry only the root (spelling override cleared) and CAGED opens in major. Inversion, string set and Compare are not carried. Focus is re-resolved as when the key is picked in CAGED.
- **FR-017**: CAGED MUST carry key, spelling override and quality to Triads as root and quality; Triads' inversion, string set, view and Compare keep their last values (revalidated).
- **FR-018**: When Notes has zero or several notes selected, CAGED MUST open in its last session state or initial state.
- **FR-019**: The Notes position card MUST offer **CAGED in this key**, which carries the focused position's pitch class as in FR-014 (whatever the selection), leaves Notes unchanged, and opens CAGED in one action.
- **FR-020**: Triads MUST offer **View in CAGED**, opening CAGED with the current root, spelling and quality and the Triad layer on (FR-5.16); the existing focus is kept after re-resolution, otherwise the occurrence nearest the nut is focused; the Triad string set is CAGED's default set.
- **FR-021**: **View in CAGED** MUST be disabled (focusable, `aria-disabled`, inert on activation) for diminished and augmented triads, with the visible note "CAGED covers major and minor chords" linked via `aria-describedby`.
- **FR-022**: Carried keys not usual in major (such as A♯ major) MUST be accepted, spelled with 𝄪/𝄫 where needed, and offered CAGED's existing "Switch to …" spelling guidance.
- **FR-023**: All new text MUST be message-catalog keys in every shipped catalog (today `messages/en.json` only); accidental symbols MUST be ♯, ♭, 𝄪, 𝄫.
- **FR-024**: The tempo preference MUST be parsed as untrusted, versioned data (picklist with fallback to medium; other fields unaffected). Carried context is in-memory only and is not serialized.
- **FR-025**: No metronome, backing track, or looping is included.

### Key Entities

- **Playback sequence**: ordered notes, each with position, pitch, timing and step type (strum, block, single); has a state (idle, playing) and a source layer.
- **Tempo preference**: slow (80 BPM), medium (120 BPM, default) or fast (180 BPM); optional `tempo` field in the existing preferences record.
- **Carried context**: key pitch class, spelling override, quality and, for View in CAGED, the Triad-layer-on flag; in memory only.
- **Link shortcut**: an action with a source tool, a destination tool, an availability state and, when unavailable, an explanation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In every layer combination tested, the notes sounded match the layer rules in order, 100% of cases, for standard, seven-string, altered-string and transposed tunings.
- **SC-002**: Playback starts within 100 ms of the Listen gesture once audio is unlocked (constitution VI).
- **SC-003**: Stop silences playback within 100 ms, and every state change listed stops playback, in 100% of tested cases.
- **SC-004**: Each note's pulse starts within 50 ms of its sound, and muted playback pulses identically.
- **SC-005**: The four CAGED hand-offs (Notes→CAGED, CAGED→Notes, Triads→CAGED, CAGED→Triads) and both shortcuts land in the stated destination state for all twelve roots and both CAGED qualities, plus diminished and augmented origins for Triads→CAGED, in 100% of cases.
- **SC-006**: A user can go from Triads to CAGED with the Triad layer on in one action, and from the Notes position card to CAGED in one action.
- **SC-007**: Listen, Stop, tempo and both shortcuts pass the accessibility checks of the product, including the disabled explanation, at phone and desktop widths and in both themes.
- **SC-008**: No new text is shown untranslated in any supported language.

## Assumptions

- Slices 001 to 005 of the CAGED tool and Triads/Notes linked-tools slice are in place: shapes, layers, Triad layer with selected set, focus, and the Triads tool's View in CAGED context.
- The existing audio engine, sound control and Triads/Notes Listen provide the timbre, volume, mute and single-notice behaviour.
- Tempo steps and strum timing are fixed in Clarifications (80/120/180 BPM; strum 250 ms, block +500 ms).
- When Triad is on with Pentatonic or Scale, the wider layer plays; with Triad and Arpeggio, the Arpeggio plays (widest wins).
- Slice 016 R-11 / 017 R-16 ("focus and layer changes do not stop playback") still hold for single tapped notes; for Listen sequences EC-7.4 takes precedence.
- CAGED's last-used quality defaults to major if CAGED was never used.
- Out of scope: metronome, backing tracks, looping.
