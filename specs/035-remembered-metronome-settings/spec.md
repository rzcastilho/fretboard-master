# Feature Specification: Remembered Metronome Settings

**Feature Branch**: `feature/035-remembered-metronome-settings`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/008-ratios-training/005-remembered-metronome-settings.md (id 005, remembered-metronome-settings)."

## Clarifications

### Session 2026-10-30 (clarify reviewer)

- Q: Does this override 031's "reopening the tool starts at defaults" (031 FR-017, Clarification "no remembered settings")? → A (derived, metronome-trainer-spec § Run states and controls: "Settings edited in the settings view persist across Reset, tab switches and page reloads (local storage)"): Yes. 031 FR-017 is superseded only for the values. Leaving the Metronome route still stops the click and returns to the settings view, but the settings now show the last values set, not 85 / 4 (FR-002, FR-004).
- Q: Is the in-visit memory (leave and come back) tied to storage? → A (default, matches the source line above and the other tools' in-load state): No. Within one page load, leaving and returning shows the last values set even when device storage is unavailable or blocked. Only a reload with no usable storage starts from the defaults (FR-002, FR-011).
- Q: When is a value written? → A (default, follows the existing store's "write on change, skip when unchanged" rule): A value is written as soon as it changes in the settings view: each stepper step, each typed value once it is committed and clamped, each switch flip and each Loop 1 / Loop 2 choice. It is not tied to Start. Writes are synchronous, fire-and-forget and skipped when the serialized record has not changed. No debounce is needed, and a held stepper ends with the last value stored (FR-001, FR-011).
- Q: What goes into the stored record, and where? → A (default, matches how every earlier slice added fields under v1): The `fretboard-master:prefs` record gets one optional key, `metronome`. It is an object keyed by mode, and today has one entry, `ratios`, holding the eight fields in this fixed order: `bpm`, `beats`, `countIn`, `initialCountIn`, `repeatCountIn`, `ratio`, `loop1`, `loop2`. Loop 1 and Loop 2 are stored as clicks per beat (whole numbers 1–8), not as translated names. The `metronome` key is omitted when all eight values equal the defaults. A record for a user who never changed the metronome therefore stays byte-identical to what 034 writes. When any value differs, all eight are written (FR-005, FR-006).
- Q: Does the format version change? → A (derived, Constitution IX and the existing store): No. The record keeps `version: 1`. The new key is optional and an older record without it gives the defaults (FR-006).
- Q: What are the exact validation rules on read? → A (derived from the settings view limits in `metronome-settings`): `bpm` is a whole number from 30 to 300 (default 85). `beats` is a whole number from 1 to 16 (default 4). `initialCountIn` is a whole number from 0 to 8 (default 4). `repeatCountIn` is a whole number from 0 to 8 (default 2). `countIn` and `ratio` are JSON booleans (default true). `loop1` is a JSON number, a whole number from 1 to 8 (default 3, 8th Triplets). `loop2` follows the same rule (default 6, Sextuplets). Numeric strings, fractional numbers, `NaN`/`Infinity`, `null` and other types are invalid, and only that field is reset to its default. Out-of-range values are replaced by the default, never clamped. For example a stored BPM of 900 gives 85, not 300 (FR-007).
- Q: What does a malformed or oversized metronome record mean? → A (derived, existing store): If `metronome` or `metronome.ratios` is missing, `null`, an array or a non-object, all eight settings take their defaults. Unknown keys inside them, other mode entries included, are ignored on read and are not kept when the record is next written. That is the same rule the store applies to unknown top-level keys. Size is bounded by the existing whole-record limit (16,384 characters): a larger record gives all preferences their defaults, as it does today. No separate metronome limit is added (FR-008).
- Q: What does Erase do while metronome values are in memory? → A (default, follows 027's erase, which resets every restored store): Erase removes the stored record and also resets the in-memory metronome settings to the defaults, so the next time the Metronome tool opens it shows the defaults without a reload. Erase already stops any playback (FR-010).
- Q: Does an unavailable storage add any new notice? → A (default, FR-013 / existing store): No. The existing one-time "preferences can't be saved" notice behaves exactly as today. Changing metronome settings never shows an error or a notice (FR-011).
- Q: What does the privacy text say? → A (default, follows 027's category list): A new privacy category, `metronome`, names the metronome settings in `about_privacy_stored` in en, pt-BR and es. en: "…the shortcuts switch; and metronome settings." pt-BR: "configurações do metrônomo". es: "ajustes del metrónomo". The unit test that requires every stored field to belong to a privacy category covers the new field (FR-012).
- Q: Which entry point restores the values? → A (derived, existing store): The preferences store reads the record once at app start (as today) and passes the eight values to the metronome. The record is never re-read during a visit, so a second tab picks up changes on its next load (Edge Cases).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Settings survive a reload (Priority: P1)

A player who practises daily should not have to dial in 85 BPM, 4 beats, a 4/2 count-in and triplets ↔ sextuplets every time. Every value set in the Ratios Training settings view is kept on the device, with no account, and is shown again the next time the Metronome tool opens.

**Why this priority**: This is the whole value of the feature; everything else protects or bounds it.

**Independent Test**: Set 120 BPM, 2 beats and Loop 2 to Quintuplets, reload the page, open the Metronome tool and read the settings view.

**Acceptance Scenarios**:

1. **Given** the user sets 120 BPM, 2 beats and Loop 2 to Quintuplets, **When** the page is reloaded and the Metronome tool opened, **Then** the settings view shows 120 BPM, 2 beats and Loop 2 Quintuplets, with the other settings unchanged.
2. **Given** the user changes each of BPM, # of Beats, Count In on/off, Initial Count In, Repeat Count In, Subdivision ratio on/off, Loop 1 and Loop 2, **When** the page is reloaded, **Then** every one of these eight kinds of value is restored as set (including values hidden because a section is off, such as Loop 2 while the ratio is off).
3. **Given** the user leaves the Metronome for another tool and returns in the same visit, **Then** the settings view shows the last values set.
4. **Given** no settings were ever stored, **When** the tool opens, **Then** it shows the defaults (85 BPM, 4 beats, Count In on with 4 initial and 2 repeat clicks, Subdivision ratio on, Loop 1 8th Triplets, Loop 2 Sextuplets).

---

### User Story 2 - Reset and running position (Priority: P1)

Settings outlive a Reset, but the running position never does. Reopening the tool always lands on the settings view, never on a run in progress.

**Why this priority**: Remembering must not change how runs start or stop.

**Independent Test**: Change settings, start training, pause, press Reset, reload, and check the view and values.

**Acceptance Scenarios**:

1. **Given** changed settings and a run in progress or paused, **When** the user presses Reset, **Then** the settings view shows with the changed values still in place, and they are still there after a reload.
2. **Given** a run in progress or paused, **When** the page is reloaded and the tool opens, **Then** the settings view shows (not the running view), starting again begins from the initial count-in, and no beat or loop position is restored.

---

### User Story 3 - Invalid stored values fall back safely (Priority: P2)

A stored value can be corrupt, hand-edited, or written by an older or newer version. The tool still opens, replacing only what is wrong.

**Why this priority**: Stored data is untrusted, and one bad value must not lose the rest or break the tool.

**Independent Test**: Store BPM 900 with other valid values and open the tool.

**Acceptance Scenarios**:

1. **Given** a stored BPM of 900, **When** the tool opens, **Then** BPM shows 85 and the other stored values are intact.
2. **Given** any single stored metronome value is out of range, of the wrong type, or an unknown option (for example 0 beats, a count-in of 99, a Loop 2 name that does not exist, a non-boolean switch), **When** the tool opens, **Then** only that value takes its default and the tool opens normally.
3. **Given** the stored `metronome` entry or its `ratios` entry is missing, `null`, an array or not an object (or the whole preferences record is over the existing 16,384-character limit), **When** the tool opens, **Then** all metronome settings take their defaults and no error is shown.
4. **Given** a stored value that is a number but not a whole number (for example 2.5 beats), or a numeric string such as `"120"`, **Then** it is treated as invalid and replaced by its default. It is never rounded or clamped.
5. **Given** the device storage is unavailable or full, **When** the user changes settings, **Then** the tool keeps working, no new error or notice appears, and leaving and returning within the same page load still shows the last values set.

---

### User Story 4 - Erase clears the metronome settings (Priority: P2)

The existing **Erase** command, which removes the user's stored preferences, also removes the stored metronome settings, and the metronome returns to its defaults.

**Why this priority**: The privacy promise is that everything stored can be erased in one place.

**Independent Test**: Set non-default metronome values, use Erase, open the Metronome tool.

**Acceptance Scenarios**:

1. **Given** stored non-default metronome settings, **When** the user erases their preferences and then opens the Metronome tool (without reloading), **Then** it shows the defaults, and still does after a reload.
2. **Given** the privacy information listing what the app stores, **Then** it names the metronome settings in English, Portuguese and Spanish.

---

### User Story 5 - Settings are kept per mode (Priority: P3)

Settings belong to the mode they were set in. Ratios Training keeps its own set, so later modes (Metronome, Speed Training) can each keep theirs without overwriting these.

**Why this priority**: It protects later work; today there is only one mode, so users see no difference.

**Independent Test**: Verify the stored form keeps the Ratios Training values under their own mode entry, and that an entry for another mode does not change them.

**Acceptance Scenarios**:

1. **Given** stored values under `metronome.ratios`, **When** an entry for another mode key is present under `metronome`, **Then** the Ratios Training settings view shows only the `ratios` values.
2. **Given** an unknown or invalid entry for another mode, **Then** Ratios Training settings are unaffected, the tool opens, and the unknown entry is not kept when the record is next written.

---

### Edge Cases

- Defaults are not special: a user who sets a value back to its default sees that default after reload either way.
- Settings changed while a run is going cannot occur (the settings view is the only place to edit them); the values in force at Start are the ones remembered.
- Rapidly changing a value (holding a stepper) writes on each step, with unchanged writes skipped. The last value is remembered and the control is never blocked.
- A stored record from a newer or unknown version is read like any other preferences record: valid fields kept, the rest defaulted, no crash.
- Storing a metronome setting must not change or lose any other stored preference (language, theme, instrument, and so on), and erasing or changing those must not change the metronome settings.
- Settings are not part of share links and not synced between devices or tabs-in-other-browsers; a second tab reflects them on its next load.
- Private browsing or blocked storage: the tool behaves as with defaults each visit.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST remember on the device, without an account, each of these Ratios Training settings: BPM, # of Beats, Count In on/off, Initial Count In, Repeat Count In, Subdivision ratio on/off, Loop 1 and Loop 2.
- **FR-002**: The remembered values MUST be restored into the settings view each time the Metronome tool opens: after a page reload, after Reset, and after leaving the route and returning in the same visit. This supersedes the 031 FR-017 rule that reopening shows 85 / 4. Within one page load the last values set are kept in memory even when storage is unavailable.
- **FR-003**: Reset MUST leave the remembered settings unchanged.
- **FR-004**: The running position (current beat, loop, count-in click, paused or running state) MUST NOT be remembered; opening the tool MUST always show the settings view.
- **FR-005**: Settings MUST be kept per mode. The Ratios Training values MUST live under `metronome.ratios` in the preferences record, so that other modes can store theirs under their own key without overwriting them. Values MUST be written whenever they change in the settings view, not only on Start.
- **FR-006**: The settings MUST live in the app's existing preferences record (`version: 1`, unchanged) and MUST NOT be written outside it. The `metronome` key MUST be omitted when all eight values equal the defaults, and otherwise MUST hold all eight fields in the fixed order `bpm`, `beats`, `countIn`, `initialCountIn`, `repeatCountIn`, `ratio`, `loop1`, `loop2`. Loop 1 and Loop 2 are stored as clicks per beat (1–8).
- **FR-007**: Each stored value MUST be validated on read with the settings view limits: BPM a whole number from 30 to 300; # of Beats from 1 to 16; Initial Count In and Repeat Count In from 0 to 8, whole numbers; Count In and Subdivision ratio JSON booleans; Loop 1 and Loop 2 whole JSON numbers from 1 to 8. A value that fails, including numeric strings, fractions, non-finite numbers and out-of-range values, MUST be replaced by its own default (never clamped), leaving every other stored value intact, and the tool MUST still open.
- **FR-008**: A missing, `null`, array or non-object `metronome` or `metronome.ratios` entry MUST give all eight defaults without an error message. A record over the existing whole-record size limit gives all preferences their defaults, as today. Unknown keys inside `metronome` are ignored on read.
- **FR-009**: Reading the metronome settings MUST NOT alter other stored preferences, and writing other preferences MUST NOT alter the metronome settings.
- **FR-010**: The existing **Erase** command MUST also clear the stored metronome settings and reset the in-memory metronome settings to the defaults, so the next opening of the tool shows the defaults without a reload.
- **FR-011**: Failure to write to device storage MUST NOT stop the tool from working and MUST NOT show any new error or notice. The existing one-time storage notice is unchanged.
- **FR-012**: The app's privacy information (`about_privacy_stored`) MUST name the metronome settings among the stored items in en, pt-BR and es, under a new privacy category that covers the new stored field.
- **FR-013**: Existing metronome behaviour (ranges, defaults, click timing, announcements, shortcuts, and stopping the click on route leave) MUST be unchanged, apart from the settings now starting from the remembered values.
- **FR-014**: Metronome settings MUST NOT be included in share links and MUST NOT be synced between devices.

### Key Entities

- **Remembered metronome settings (per mode)**: The values the user set for one mode: BPM, # of Beats, Count In on/off, Initial Count In, Repeat Count In, Subdivision ratio on/off, Loop 1, Loop 2. Today one mode exists (Ratios Training); each later mode owns a separate entry.
- **Preferences store**: The device-local record of the user's preferences, with a format version, per-field validation with defaults, and an Erase command. The metronome settings become a part of it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After setting 120 BPM, 2 beats and Loop 2 Quintuplets and reloading, the settings view shows exactly those values in 100% of attempts.
- **SC-002**: A returning user reaches a run with their usual settings with zero re-entry of values, versus up to eight values each visit before.
- **SC-003**: With a stored BPM of 900 and other valid values, the tool opens with BPM 85 and the other seven values unchanged in 100% of attempts.
- **SC-004**: For each of the eight settings, an invalid stored value replaces only that setting, in 100% of cases tested.
- **SC-005**: After Erase, the Metronome tool shows the defaults for all eight settings, including after a reload.
- **SC-006**: Reopening the tool after a reload during a run always shows the settings view, never a running view.
- **SC-007**: Saving or loading the settings adds no perceptible delay: the tool opens and controls respond as before.

## Assumptions

- The existing preferences store (010, with the Erase command from 027 and its privacy list) is the single home; this feature adds to it and follows its rules (untrusted input, format version, per-field fallback, only non-default values need be written).
- The format version stays 1 because the new key is optional and defaults when absent; an older record simply gives the defaults (see Clarifications).
- A value is remembered when it is set, not only on Start, so leaving without starting still keeps it.
- Reset keeps settings today (034); this feature only makes that survive a reload.
- Per-mode granularity is a storage-shape requirement only; no mode selector is added here, and the Metronome and Speed Training modes are out of scope.
- Settings are not shared by link and not synced between devices.
- Prerequisites 031–034 (metronome tool, subdivisions, count-in, alternating ratios) and the preferences store exist.
