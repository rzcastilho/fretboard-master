# Feature Specification: Subdivisions

**Feature Branch**: `feature/032-subdivisions`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/008-ratios-training/002-subdivisions.md (id 002, subdivisions)."

## Clarifications

### Session 2026-10-30 (clarify reviewer)

Sources: constitution (C), breakdown brief 008-ratios-training/002 (B), macro-spec `specs/autonomous/metronome-trainer-spec.md` (M), the 031 Metronome spec and code (X). "Default" marks an assumed conventional choice where no source decides.

- Q: M's sequence says "accented click on each beat plus 2 soft subdivision clicks", but B says "its usual click (accented on beat 1)". Which wins? → A: Derived from B (the feature's stated intent) and X 031: beat 1 of each loop plays the accent click, beats 2…N play the normal click, and only the in-between clicks use the soft sound. M's wording is read as "a beat click on each beat" (FR-004).
- Q: Does each option visibly show its clicks per beat? → A (default, M "The number is clicks per beat"): Yes. Each option's visible label and accessible name is the translated name followed by the count in parentheses, e.g. "8th Triplets (3)". The closed dropdown shows the same label for the chosen option (FR-002).
- Q: What kind of control is the dropdown, and what does "dark" mean in a light theme? → A (default, C VII tokens, X 031 precedent "orange means `--color-accent`"): A native `<select>` (no new dependency, native keyboard and screen-reader support), with the visible label **Loop 1** bound as its accessible name. "Dark" means the theme's input/surface tokens, so it is dark in dark themes and follows the light, high-contrast and forced-colours themes. The chevron is a decorative, `aria-hidden` icon drawn in `currentColor` (the native arrow in forced colours). It spans the full width of the settings content, uses the app's standard focus ring and has a hit target of at least 24 × 24 CSS px (C V) (FR-001, FR-003, FR-014).
- Q: Where does the dropdown sit? → A (default): Below the # of Beats row and above Start Training, matching M's row order (Count In rows will later be inserted between # of Beats and the subdivision section by 003/004) (FR-001).
- Q: What are the Portuguese and Spanish names, and is `SUB` translated? → A (default, standard music terminology): pt-BR: Semínimas, Colcheias, Tercinas de colcheia, Semicolcheias, Quintinas, Sextinas, Septinas, Fusas. es: Negras, Corcheas, Tresillos de corchea, Semicorcheas, Quintillos, Seisillos, Septillos, Fusas. The label **Loop 1** stays "Loop 1" in en and pt-BR and is "Bucle 1" in es. `SUB` stays `SUB` in all three languages (it abbreviates subdivisão / subdivisión too), so the status reads `BEAT 2/4 · SUB 3`, `TEMPO 2/4 · SUB 3`, `TIEMPO 2/4 · SUB 3` (FR-013).
- Q: What does the status line show before the first click and while paused? → A (default, X `metronome_status_beat_none`): The `· SUB n` suffix is always present in the running and paused views: `BEAT –/4 · SUB 3` before the first click, and the frozen `BEAT 3/4 · SUB 3` while paused (FR-006).
- Q: What is the soft sound, concretely? → A (default, M "third, softer sound"; X `click.ts`): A third synthesized click kind, built like the others (sine burst, no sample files, C II). Its peak level is at most half the normal click's peak (normal 0.55 → sub ≤ 0.275), its pitch differs from both the accent (1600 Hz) and normal (1000 Hz) clicks, and its length is at most 20 ms, so consecutive soft clicks at the 25 ms spacing of 300 BPM 32nds never overlap. The accent and normal clicks keep their 031 sound and 30 ms length; each click is its own voice, so a beat click's decayed tail mixes with, and never truncates or is truncated by, the next soft click (FR-005, FR-009).
- Q: How are subdivision click times computed? → A: Derived from X 031 ("click *n* at `anchor + n × 60 / BPM`, never accumulated"). With *n* clicks per beat, grid click *j* of a run segment is at `anchor + j × (60 / BPM) / n`, from integer *j*, so beat *b* (0-based within the segment) is *j* = *b* × *n* and its soft clicks are *j* = *b* × *n* + 1 … *b* × *n* + *n* − 1. Clicks with *j* mod *n* = 0 are beat clicks (accent/normal), all others soft. Verified with the injectable clock/audio context (C IV), not real time (FR-008).
- Q: When do the dots and status line change? → A: Derived from X 031 and B ("dots still move once per beat"). They update when a beat click's audio time is reached; soft clicks never fire a beat update, never light a dot and never change the status text (FR-007).
- Q: Pause between a beat's soft clicks, then Resume? → A: Derived from X 031 (freeze on the last sounded beat; Resume plays the next beat and re-anchors). Pausing after beat 3's beat click, whether or not some of its soft clicks have sounded, freezes on `BEAT 3/4`; unsounded soft clicks are cancelled; Resume plays beat 4's beat click within 50 ms and then its *n* − 1 soft clicks. The rest of beat 3 is never replayed (FR-010).
- Q: Background suspension with subdivisions? → A: Derived from X 031 (skip-forward, no burst). On return the scheduler continues at the next due grid click (beat or soft); missed clicks are not replayed, and the displayed beat is the one whose beat slot was last reached (FR-015).
- Q: Live-region announcement? → A (default, X 031 announcement set): The start announcement names the subdivision: "Started, 85 BPM, 4 beats, 8th Triplets" (translated). Paused, Resumed and Reset announcements are unchanged. Soft clicks never trigger an announcement (FR-015).
- Q: How is the subdivision represented for the later remembered-settings slice (005)? → A (default): As its clicks-per-beat integer 1–8 (8th Triplets = 3, default). The integer is the stable identifier; option names are display-only translations. Nothing is persisted in this slice (FR-012, FR-016).
- Q: Narrow widths? → A: Derived from C V (reflow to 320 CSS px) and X 031. From 320 to 2560 CSS px the dropdown shrinks with the column and its longest option label in any language is fully visible or the select shows it without clipping the control; the status line may wrap at the ` · ` separator but never clips, truncates or scrolls horizontally (FR-014).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hear evenly placed notes inside each beat (Priority: P1)

A guitarist building speed wants to practise 8th-note triplets, sextuplets and other groupings against an audible grid. In the Ratios Training settings view they pick how many clicks fill each beat, start training, and hear every beat's usual click (accented on beat 1) followed by softer clicks that divide the beat into equal parts.

**Why this priority**: Evenly spaced notes within the beat are what speed work depends on. Without audible subdivisions the metronome only marks the beat.

**Independent Test**: Keep 85 BPM and 4 beats, leave the subdivision on its default (8th Triplets), press Start Training, and check that each beat sounds one beat click and two soft clicks, evenly spaced, and that the status line reads `BEAT n/4 · SUB 3`.

**Acceptance Scenarios**:

1. **Given** the settings view with 8th Triplets, 85 BPM and 4 beats, **When** the user starts training, **Then** each beat sounds one beat click followed by two soft clicks at one third and two thirds of the beat, and the status line reads `BEAT n/4 · SUB 3`.
2. **Given** Quarter notes is selected, **When** the user starts training, **Then** only beat clicks play and the status line reads `BEAT n/4 · SUB 1`.
3. **Given** 8th Triplets and # of Beats set to 2, **When** the user starts training, **Then** the status line reads `BEAT 2/2 · SUB 3` on the second beat and two dots show.
4. **Given** a running session with any subdivision, **When** beats pass, **Then** the dots advance once per beat, never once per subdivision click.
5. **Given** a running session, **When** subdivision clicks sound, **Then** they use a third sound, with a peak at most half the normal click's, a pitch different from both beat clicks and a length of at most 20 ms, so the beat stays easy to pick out.

---

### User Story 2 - Choose the subdivision from a dropdown (Priority: P1)

On the settings view the user sees a **Loop 1** dropdown: a full-width dark control with a chevron. It lists, in this order with clicks per beat: Quarter notes (1), 8th notes (2), 8th Triplets (3), 16th notes (4), Quintuplets (5), Sextuplets (6), Septuplets (7), 32nd notes (8). The default is 8th Triplets.

**Why this priority**: The choice is the feature's only new input. Without it the user cannot practise anything but the default.

**Independent Test**: Open the tool, confirm the dropdown shows "8th Triplets", open it, confirm the eight options and their order, pick each in turn, and confirm the status line shows the matching `SUB` number after starting.

**Acceptance Scenarios**:

1. **Given** the settings view on first open, **Then** Loop 1 shows 8th Triplets.
2. **Given** the dropdown is open, **Then** it lists the eight options in the order above, each labelled with its name and clicks per beat in parentheses, for example "8th Triplets (3)".
3. **Given** any option is picked and training starts, **Then** the status line reads `SUB` followed by that option's clicks per beat (1 to 8).
4. **Given** a keyboard-only user, **When** they focus the dropdown, **Then** they can open it, move through the options and select one without a pointer.
5. **Given** a running or paused session, **Then** the dropdown is not available. The subdivision can be changed only on the settings view.

---

### User Story 3 - Subdivision clicks stay exact at high speed (Priority: P2)

At fast tempos with dense subdivisions the user must still hear every click distinctly and on time. At 300 BPM with 32nd notes the metronome plays 40 clicks a second.

**Why this priority**: Subdivisions are most useful at speed, and an uneven grid teaches the wrong feel. It builds on the other two stories.

**Independent Test**: Run a measured session at 300 BPM with 32nd notes against a controllable clock, and check each click's scheduled time against its ideal time and that no two clicks merge or are skipped.

**Acceptance Scenarios**:

1. **Given** any BPM from 30 to 300 and any subdivision, **When** a session runs, **Then** each subdivision click is scheduled within 2 ms of its ideal time, and the last click after 10 minutes is within 2 ms of its ideal time (no drift).
2. **Given** 300 BPM with 32nd notes, **When** a session runs, **Then** all 40 clicks each second sound distinctly, with none dropped, merged or cut off by the next.
3. **Given** a session is paused, **When** Pause is pressed mid-beat, **Then** subdivision clicks not yet sounded are cancelled and none sounds after the Pause instant.
4. **Given** a session paused on beat 3 (after its beat click, with some or none of its soft clicks sounded), **When** the user resumes, **Then** the next click is beat 4's beat click within 50 ms, followed by its subdivision clicks evenly across that beat; the rest of beat 3 is not replayed.

---

### Edge Cases

- Quarter notes (1 click per beat): no soft clicks play, the status line reads `SUB 1`, and behaviour matches the metronome before this feature.
- # of Beats = 1 with a subdivision: one dot, every beat click accented, soft clicks still fill the beat, status `BEAT 1/1 · SUB n`.
- Mute: the app-wide mute and volume control also governs subdivision clicks, and muting does not pause the run, as for beat clicks.
- Reset: returns to the settings view and keeps the chosen subdivision, as it keeps BPM and # of Beats.
- Leaving the tool and reopening it, by navigation or reload, shows the default (8th Triplets).
- Rapid Start, Pause, Resume or Space presses never produce overlapping click streams or doubled subdivision clicks.
- Background suspension: missed clicks, including subdivision clicks, are not replayed. The grid continues at the next due grid click (beat or soft), and the dots show the beat whose slot was last reached.
- Web Audio unavailable: the run proceeds visually with the existing notice, and the status line still shows `SUB n`.
- Narrow widths (down to 320 CSS px at zoom) and every theme: the dropdown and the longer status line must not be cut off or overflow; the status line may wrap at ` · `.
- Before the first click the status reads `BEAT –/4 · SUB 3`; while paused it keeps the `· SUB n` suffix.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Ratios Training settings view MUST show a **Loop 1** dropdown (a native select), full width of the settings content, styled with the theme's input/surface tokens (dark in dark themes), with a decorative chevron, placed below the # of Beats row and above Start Training.
- **FR-002**: The dropdown MUST offer these options in this order, with clicks per beat: Quarter notes (1), 8th notes (2), 8th Triplets (3), 16th notes (4), Quintuplets (5), Sextuplets (6), Septuplets (7), 32nd notes (8). Each option's label MUST be its translated name followed by its clicks per beat in parentheses (e.g. "8th Triplets (3)"). The default MUST be 8th Triplets.
- **FR-003**: The dropdown MUST be changeable only in the settings view, and MUST be fully operable by keyboard, with the visible label "Loop 1" as its accessible name, the app's standard focus ring, and a target of at least 24 × 24 CSS px.
- **FR-004**: While running, each beat MUST play its usual click, accented on beat 1, followed by the remaining subdivision clicks (clicks per beat minus 1), evenly spaced across the beat. Beat 1 uses the accent click and beats 2…N the normal click, as in 031; only the in-between clicks use the soft sound.
- **FR-005**: Subdivision clicks MUST use a third synthesized sound (no sample files) with a peak level at most half the normal click's peak, a pitch different from both the accent and normal clicks, and a length of at most 20 ms. The accent and normal clicks keep their 031 sound. For Quarter notes no subdivision click plays.
- **FR-006**: The status line MUST show the clicks per beat of the playing loop after the beat position, in the form `BEAT 2/4 · SUB 3`, and MUST stay real text in the page. The suffix MUST also show before the first click (`BEAT –/4 · SUB 3`) and while paused. `SUB` is not translated; the `BEAT` word uses the existing translations.
- **FR-007**: The dots and status line MUST update when a beat click's audio time is reached, and never on a subdivision click.
- **FR-008**: With *n* clicks per beat, grid click *j* of a run segment MUST be scheduled at `anchor + j × (60 / BPM) / n` on the audio clock, from the integer *j*; clicks with *j* mod *n* = 0 are beat clicks, the others subdivision clicks. Times MUST NOT be computed by accumulating intervals. Each click MUST be within 2 ms of its ideal time, with no cumulative drift over 10 minutes at any BPM from 30 to 300.
- **FR-009**: At 300 BPM with 32nd notes (40 clicks a second), every click MUST still sound distinctly, with none dropped, merged or cut off: each click is its own voice, and consecutive subdivision clicks never overlap.
- **FR-010**: Pause MUST cancel every click not yet sounded, subdivision clicks included. Pause freezes on the last beat whose beat click sounded, even if some of its subdivision clicks also sounded. Resume MUST start on the next beat with its beat click (within 50 ms) followed by its subdivision clicks, as before this feature; the rest of the paused beat is not replayed.
- **FR-011**: The app-wide mute and volume MUST apply to subdivision clicks, and muting MUST NOT pause the run.
- **FR-012**: Reset MUST keep the chosen subdivision. Reopening the tool MUST show the default.
- **FR-013**: The dropdown label and option names MUST be available in English, Portuguese and Spanish: pt-BR Semínimas, Colcheias, Tercinas de colcheia, Semicolcheias, Quintinas, Sextinas, Septinas, Fusas; es Negras, Corcheas, Tresillos de corchea, Semicorcheas, Quintillos, Seisillos, Septillos, Fusas. The label is "Loop 1" (en, pt-BR) and "Bucle 1" (es). `SUB` is the same in all three.
- **FR-014**: The dropdown MUST follow the app's themes, including high contrast and forced colours, and use only design tokens for colour. The settings view and status line MUST not be cut off from 320 to 2560 CSS px wide; the status line may wrap at ` · ` but never truncates or scrolls horizontally.
- **FR-015**: Existing behaviour MUST be unchanged: BPM and # of Beats ranges and defaults, beat click timing, first click within 50 ms of Start, background and hidden-page behaviour, Space and Esc shortcuts, and the live region announcements. The live-region start announcement MUST also name the subdivision ("Started, 85 BPM, 4 beats, 8th Triplets", translated); other announcements are unchanged and subdivision clicks never trigger one. After a background suspension the grid continues at the next due grid click with no catch-up burst.
- **FR-016**: Out of scope: a second loop, alternating between two subdivisions (a later brief), a remembered subdivision, a dedicated subdivision volume and a user choice of sound.

### Key Entities

- **Subdivision**: A named grouping identified by its clicks-per-beat integer from 1 to 8 (the stable identifier a later remembered-settings slice will store); the name is a display translation. The settings view offers eight, with 8th Triplets (3) as the default.
- **Run settings**: The BPM, # of Beats and subdivision that define one run. The subdivision stays fixed for the whole run.
- **Click**: One scheduled sound, either a beat click (accented on beat 1) or a softer subdivision click, each with an exact time on the audio clock.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every one of the eight options at 85 BPM and 4 beats, a user hears the expected number of clicks per beat (1 beat click plus the rest soft), evenly spaced, and the status line shows the matching `SUB` number.
- **SC-002**: Every click, at any BPM from 30 to 300 and any option, lands within 2 ms of its ideal time, and the last click of a 10-minute run is within 2 ms of its ideal time.
- **SC-003**: At 300 BPM with 32nd notes, 100% of the 40 clicks each second are scheduled and sound distinctly, over a 60-second run.
- **SC-004**: A user can pick a subdivision and start training in under 10 seconds from opening the tool, with keyboard or pointer.
- **SC-005**: After Pause, no click, soft or beat, sounds after the Pause instant, in every option.
- **SC-006**: The dropdown and status line remain fully visible and usable at every width from 320 to 2560 CSS px in every theme, with no accessibility violations on the settings or running view.

## Assumptions

- This builds on the Metronome tool from `specs/031-metronome-tool-and-click-engine` (running view, status line, dots, Pause/Resume/Reset, click engine and the timing guarantees), and changes only what the brief lists.
- "Softer" means a peak at most half the normal click's, and the subdivision sound is a synthesized tick of at most 20 ms made on the device, with no sample files, like the other clicks, so 25 ms spacing stays distinct (see Clarifications).
- The subdivision resets to 8th Triplets when the tool is reopened, like BPM and # of Beats, because the metronome keeps no remembered settings.
- Clicks that are not yet sounded when Pause is pressed are dropped, and Resume starts on a fresh beat rather than the middle of a beat.
- The status line keeps the same text on every beat of a run, since the subdivision is fixed for the run.
