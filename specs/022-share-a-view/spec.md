# Feature Specification: Share the Current View

**Feature Branch**: `feature/022-share-a-view`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/006-sharing/001-share-a-view.md (id 001, share-a-view)."

## Clarifications

### Session 2026-10-05

Sources: constitution (C), breakdown `006-sharing/001-share-a-view.md` (BD), macro-spec FR-10.x / DM-15 / DM-17 / INT-5 / ARCH-10 / EC-10.x / 12-design (MS), existing code (CODE). Items marked **Default** are assumed conventional choices, not source-derived.

- Q: Share sheet or clipboard — how is the path chosen? → A: BD acceptance requires "desktop user taps Share → link copied", and desktop Chrome, Edge and Safari now expose a share API, so pure capability detection would contradict BD. Rule: use the system share sheet only when the share API exists **and** the primary pointer is coarse (`(pointer: coarse)`); otherwise copy to the clipboard. Any failure follows FR-005. Testable: with a stubbed share API, `pointer: fine` copies and never calls share; `pointer: coarse` calls share with `{ url, title }`.
- Q: What counts as "the user canceled the sheet"? → A: **Default** (Web Share convention): a share rejection named `AbortError` means cancel and shows nothing. Any other rejection falls through to clipboard copy, then to the fallback field (FR-005).
- Q: Where does the state live in the address? → A: **Default** (ARCH-1 "interprets the address at opening", C source layout `/notes`, `/triads`, `/caged`): the path picks the tool (`/notes`, `/triads`, `/caged`), and the state goes in URL query parameters on that path. The first parameter is `v=<integer>`, and this slice ships `v=1`. The link is an absolute URL on the current origin. No fragment is used. Home (`/`) and About (`/about`) never get parameters.
- Q: Language-independence of encoded values? → A: Derived from FR-10.3/C-IX. Every encoded value is a fixed ASCII token or integer defined by the codec (for example pitch classes and spelling overrides as stored in view state, enum ids like `full-neck`). Values never come from the message catalog or `src/lib/notation`. Testable: the same state encoded under en/es/pt-BR and letters/solfège/any accidental preference gives byte-identical links.
- Q: Canonical form — are default values left out? → A: **Default** (FR-10.7 safety): no. Every field listed in FR-006 to FR-009 is written explicitly, in a fixed parameter order, even when it equals the tool default. A later change to defaults then can't change what an old link means. Optional fields that are absent (for example no focused shape, no comparison quality, no open card) use one fixed "none" token, so the link stays canonical. Equal states give byte-identical links (FR-012).
- Q: Exact per-tool contents (mapped to current view state)? → A: Derived from DM-15 + CODE:
  - Notes (`NotesViewState`): `selection`, kept in first-selected order; `activeStrings`; `region` start/end; `background`; `hideNames`, which is "hidden mode"; `card`, which is "focused position" as (string, fret) or none; `labelType`.
  - Triads (`TriadsViewState`): `rootPc` + `spellingOverride`, which is "root spelling"; `quality`; `inversion`; `stringSet`; `view`; `occurrence`, which is "octave"; `compare.on` + `compare.quality`, which is "comparison"; `labelType`.
  - CAGED (`CagedViewState`): `rootPc` + `spellingOverride`, which is "key"; `quality`; `focus` letter + ordinal or none; `layers`, all five flags; `connections`; `triadSet` or none; `labelType`; and the temporary-standard-tuning flag (FR-6.14), on or off.
  - Instrument, all tools: `stringCount`, `fretCount`, and the tuning as a preset id when it matches a preset, otherwise each string's pitch listed in string order.
  - Transient UI state (open panels, hover, keyboard cursor, playback, notices) is never encoded.
- Q: CAGED temporary tuning vs slice 015's "never in the URL"? → A: BD lists "temporary tuning" in the CAGED link, and BD outranks the slice-015 default, so this slice supersedes that default. The link carries the temporary flag, and the instrument fields stay the preferred instrument; the standard counterpart is derived from them as in slice 015. The flag is still never written to device storage.
- Q: Share title wording per tool? → A: **Default**, following the BD CAGED example. Pieces come from existing catalog strings and `src/lib/notation`, in the sharer's language, notation and accidental preference:
  - CAGED: "<key> <quality> — CAGED[, <letter> shape]". Quality is lower-case ("A minor — CAGED, E shape"). The shape part is left out when nothing is focused.
  - Triads: "<root> <quality> — Triads, <inversion name>" (for example "C major — Triads, root position").
  - Notes: "<selected note names joined by ', '> — Notes". With an empty selection the title is just "Notes".
  - No title ever contains "undefined", an empty segment, or a dangling separator.
- Q: Confirmation and fallback presentation? → A: Derived from C-VII (non-blocking notices, no modals) and CODE `Notice.svelte`.
  - The copy confirmation is one existing-style notice ("Link copied" + translations) in a polite live region. It is dismissible and hides itself after 4 s. Activating Share again replaces it rather than stacking a second one.
  - The fallback is an inline, non-modal panel under the application bar. It holds the instruction "Copy this address", a read-only text field that gets focus with its whole value selected, and a Dismiss button. It closes on Dismiss, Escape, a view change or a tool change, and focus then returns to the Share button.
  - Neither one uses error red.
- Q: Address-sync throttling? → A: **Default**. Browsers throttle and may throw on frequent `history.replaceState` calls (Safari: more than 100 per 10 s). Address writes are coalesced with a 150 ms trailing debounce: during rapid changes the address may lag, and it settles at most 150 ms after the last change. Every write is wrapped so a failure never reaches the UI. The **Share** command always encodes the current state directly, so it is never stale. SC-007 is realigned to match.
- Q: History mechanics? → A: Derived from BD and FR-014. State changes use replace-in-place navigation (SvelteKit `replaceState`, or the router equivalent that keeps router state consistent) and never push. Screen changes (home ↔ tool, tool ↔ tool, About) keep their existing push behaviour. Existing in-tool `pushState` uses such as the instrument panel stay as they are.
- Q: First load and received links in this slice? → A: Derived from scope (BD: opening is 006/002) and ARCH-10. This slice delivers the codec with both encode and decode as a pure module in `src/lib/link`, and decode is used for round-trip tests. Address sync starts only after the tool's state is initialised, through one initialisation hook that 006/002 will use to apply a received link before sync begins. In this slice, a tool URL that already has parameters opens in the normal initial state, and the address then switches to that state's canonical link with no history entry added.
- Q: Format-version and fixture policy? → A: Derived from C-IX and FR-10.7. Version 1 is defined here, and fixtures are added under `tests/` as (state, link) pairs covering every tool, a preset tuning, a 7-string custom tuning and every optional-none field. Fixtures are only ever added, never removed. Each fixture asserts that encoding gives the exact link and that decoding gives the exact state.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Send exactly this view to someone (Priority: P1)

Marcos, a guitar teacher, builds a view in class (CAGED, A minor, E shape in focus, Chord and Pentatonic layers) and wants the student to see exactly that, through any channel. Every tool (Notes, Triads, CAGED) has a **Share** command in its application bar. It creates a link to the current view. On a device with a system share sheet, the sheet opens with the link and a short title describing the view ("A minor — CAGED, E shape"). Elsewhere, the link is copied to the clipboard and the copy is confirmed.

**Why this priority**: This is the feature. A link that captures the view is the only deliverable the recipient can use.

**Independent Test**: On CAGED with A minor, E shape, Chord and Pentatonic layers, tap **Share**. On a phone the share sheet opens with the link and the title "A minor — CAGED, E shape"; on desktop the link is on the clipboard and a confirmation shows.

**Acceptance Scenarios**:

1. **Given** CAGED showing A minor, E shape in focus, Chord and Pentatonic layers, on a phone (share API present, coarse primary pointer), **When** the user taps **Share**, **Then** the sheet opens with the link and the title "A minor — CAGED, E shape".
2. **Given** the same view on a desktop (fine primary pointer, even if a share API exists) with a working clipboard, **When** the user activates **Share**, **Then** the link is copied and a confirmation is announced and shown.
3. **Given** Notes or Triads is open, **When** the user looks at the application bar, **Then** **Share** is present and works the same way, with a title that describes that view (tool, key or root, quality, and the focused item where one exists).
4. **Given** the share sheet is dismissed by the user, **When** it closes, **Then** no error is shown and the view is unchanged.
5. **Given** the interface language is Spanish or Portuguese, **When** the user shares, **Then** the title and the confirmation are in that language, while the link itself stays language-independent.

---

### User Story 2 - Fall back to a manual copy (Priority: P1)

When automatic copy or share is unavailable, blocked, or declined, the user still gets the link: it appears in a selectable field with the instruction "Copy this address".

**Why this priority**: Clipboard and share permissions fail often (insecure context, denied permission, embedded browsers). Without a fallback the feature silently does nothing.

**Independent Test**: Make clipboard and share unavailable, activate **Share**, and select and copy the address from the field.

**Acceptance Scenarios**:

1. **Given** neither sharing nor clipboard access is available, **When** the user activates **Share**, **Then** the link appears in a selectable, read-only field labelled "Copy this address", pre-selected, with no false "copied" confirmation.
2. **Given** the clipboard write is refused, **When** the user activates **Share**, **Then** the same field appears.
3. **Given** the field is shown, **When** the user dismisses it or changes the view, **Then** it closes without leaving stale links, and it is reachable and operable with keyboard and screen reader.

---

### User Story 3 - The link describes the full view and nothing personal (Priority: P1)

The link carries the tool, the tool's complete musical state, the label type, and the instrument (string count, tuning, fret count). It leaves out personal and device preferences.

- **Notes**: selected notes, active strings, region, background, hidden mode, focused position.
- **Triads**: root spelling, quality, inversion, string set, view, octave, comparison.
- **CAGED**: key, quality, focused shape occurrence, layers, connections, Triad-layer string set, temporary tuning.
- **Instrument**: string count, tuning (preset, or each custom string), fret count.
- **Never included**: language, notation, accidental preference, handedness, orientation, theme, sound, scroll position, or anything that identifies a person or device.

**Why this priority**: Whether the recipient sees "the same view" depends on completeness; whether the sender is safe depends on exclusion.

**Independent Test**: Build a non-default view in each tool, read the generated link, and verify that decoding it yields the same state; change each excluded preference and verify the link does not change.

**Acceptance Scenarios**:

1. **Given** two views that differ only in one included field (for example Triads inversion), **When** links are generated, **Then** the links differ; **Given** two views that differ only in an excluded setting (language, notation, accidentals, handedness, orientation, theme, sound, scroll), **Then** the links are identical.
2. **Given** a custom tuning with different notes on each string, **When** shared, **Then** each string's note is in the link.
3. **Given** any link, **When** inspected, **Then** it holds no name, email, device identifier, timestamp, or random per-person token.
4. **Given** a link, **When** inspected, **Then** it carries a format version number.
5. **Given** a view that is the tool's default on the default instrument, **When** shared, **Then** the link still opens that tool (it is a valid link, not an empty one).

---

### User Story 4 - The address bar follows the view (Priority: P2)

The browser address always reflects the current tool and its state, so bookmarking the page or copying the address is equivalent to **Share**. Changing the view updates the address without adding history entries, so browser back and forward move only between screens (for example from a tool to home).

**Why this priority**: Makes sharing work through the browser's own controls, but the explicit **Share** command already delivers the core value.

**Independent Test**: On Triads, change the inversion; the address changes; press browser back and land on the previous screen, not the previous inversion.

**Acceptance Scenarios**:

1. **Given** Triads is open, **When** the user changes the inversion, **Then** the address updates and browser back returns to the previous screen.
2. **Given** a user changes the view many times in a tool, **When** they press back once, **Then** they leave the tool rather than stepping through view states.
3. **Given** the user copies the address manually, **When** compared to the **Share** link for the same view, **Then** both are equal.
4. **Given** the user switches from one tool to another, **When** the address updates, **Then** it describes the new tool only, with no state from the old one.
5. **Given** rapid state changes (dragging a region, repeated taps), **When** the address updates, **Then** the interface is not slowed and the final address matches the final view.

---

### Edge Cases

- Share is activated twice quickly: while a share or copy attempt is pending, further activations are ignored, so there are no stacked sheets. A repeated copy replaces the confirmation notice instead of adding another.
- The view contains values the link format cannot represent (for example transient, unsaved UI state): they are omitted, never guessed.
- The share sheet is canceled by the user: treated as a normal outcome, not an error and not a fallback trigger.
- The share sheet is available but fails for a reason other than cancel: fall back to copy, then to the selectable field.
- The title is built for a view with no focused item: CAGED with no focused shape gives "A minor — CAGED", and Notes with nothing selected gives "Notes". A title is never empty and never contains "undefined" or a dangling separator.
- Titles use the user's notation and accidental preference (display), while the link content does not depend on them.
- Very long custom tuning plus rich Notes selection: the link stays within common messaging and browser address length limits (see SC-006).
- Reduced motion, high contrast, and screen reader: the confirmation is announced politely and does not rely on motion or color alone.
- Address sync starts only after tool state is initialised, through a single initialisation hook that 006/002 uses to apply a received link first. In this slice, a parameterised URL opens in the initial state, and its address is replaced (not pushed) with that state's canonical link.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every tool (Notes, Triads, CAGED) MUST show a **Share** command in its application bar, operable by keyboard, touch, and pointer, with a target of at least 44×44 CSS px and an accessible name in the active language.
- **FR-002**: **Share** MUST generate a link to the current view of the current tool.
- **FR-003**: When the share API exists and the primary pointer is coarse, **Share** MUST open the system share sheet with the link and a short title describing the view, for example "A minor — CAGED, E shape". If the user cancels (`AbortError`), nothing is shown.
- **FR-004**: Otherwise (no share API, or a fine primary pointer such as a desktop), **Share** MUST copy the link to the clipboard. It MUST confirm the copy with one dismissible notice in a polite live region that hides itself after 4 s and is replaced, never stacked, by the next Share.
- **FR-005**: If the share sheet fails for any reason other than `AbortError`, Share MUST try the clipboard. If the clipboard is unavailable, fails, or is refused, the link MUST appear in an inline, non-modal panel. The panel holds the instruction "Copy this address" and a read-only field that gets focus with its whole value selected. It closes on Dismiss, Escape, a view change or a tool change, and focus then returns to Share. No success confirmation may be shown on this path.
- **FR-006**: The link MUST include: the tool; the tool's complete musical state; the label type; and the instrument's string count, tuning (preset, or each custom string), and fret count.
- **FR-007**: For Notes, the musical state MUST include selected notes, active strings, region, background, hidden mode, and focused position.
- **FR-008**: For Triads, the musical state MUST include root spelling, quality, inversion, string set, view, octave, and comparison.
- **FR-009**: For CAGED, the musical state MUST include key, quality, focused shape occurrence, layers, connections, Triad-layer string set, and the temporary-standard-tuning flag (FR-6.14). This supersedes slice 015's "never in the URL" default. The flag is still never written to storage.
- **FR-010**: The link MUST NOT include language, notation, accidental preference, handedness, orientation, theme, sound, or scroll position, and MUST NOT contain anything that identifies a person or device.
- **FR-011**: The link MUST have the form `<origin>/<tool>?v=<integer>&…`, with the tool in the path, the state in query parameters, and no fragment. This slice ships `v=1`. The link MUST carry this format version number, and the format MUST be extensible so that later versions can add fields without invalidating links created now.
- **FR-012**: The same state MUST always produce the same link (deterministic, canonical encoding), so equal views have equal links. Every field is written explicitly in a fixed order, including values equal to defaults, and absent optional values use a fixed "none" token. Encoded values are codec-defined ASCII tokens or integers and never catalog or notation text.
- **FR-013**: The browser address MUST follow the current tool and its state, settling at most 150 ms after the last change (trailing debounce). Once settled, it MUST equal the **Share** link for the same view. Sync starts only after the tool's state is initialised. In this slice, incoming parameters are not applied (006/002 adds that), and the address switches to the initial state's canonical link. Home and About carry no parameters.
- **FR-014**: Address updates MUST replace the current history entry and MUST NOT add entries. Back and forward MUST move only between screens, and existing screen navigation and in-tool panel history stay unchanged.
- **FR-015**: The share title MUST be produced in the user's language, notation, and accidental preference, and MUST be derived from the same state as the link.
- **FR-016**: Link generation and address updates MUST NOT block or visibly slow interaction, and MUST NOT throw into the interface.
- **FR-017**: All text added by this feature (command label, title pieces, confirmation, field instruction) MUST exist in English, Spanish, and Brazilian Portuguese.
- **FR-018**: No data about sharing leaves the device; generating a link makes no network request.
- **FR-019**: Link generation MUST be covered by compatibility fixtures that only grow over time, so any link produced by a released format version keeps decoding later.

### Key Entities

- **State link**: A transportable, versioned representation of a view: format version, tool, tool view state, label type, and instrument (string count, tuning, fret count). Contains no personal or device data.
- **View state**: The musical state of the current tool, as listed per tool in FR-007 to FR-009.
- **Instrument**: String count, tuning (preset or per-string notes), and fret count.
- **Share title**: A short human-readable description of the view, localized, used by the share sheet.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from a built view to a shared link in one action (one tap or press) on all three tools.
- **SC-002**: For every tool, a link generated from a state and decoded again reproduces that state exactly, for all combinations covered by the test matrix, with zero mismatches.
- **SC-003**: Changing any excluded setting (language, notation, accidentals, handedness, orientation, theme, sound, scroll) changes the link in 0% of cases; changing any included field changes it in 100% of cases.
- **SC-004**: After any number of view changes in a tool, one browser-back action leaves that tool (history entries added by view changes: 0).
- **SC-005**: When sharing or copying is unavailable, 100% of attempts end with the link visible in a selectable field; no attempt ends silently.
- **SC-006**: The link for the largest supported view (7 strings, custom tuning, full Notes selection) stays under 1,000 characters.
- **SC-007**: Control-to-fretboard updates stay within the 100 ms budget (C-VI) with address sync on. The address settles to the final state within 150 ms of the last change, and no `replaceState` error ever reaches the UI, including under 200 rapid changes.
- **SC-008**: The Share command, confirmation, and fallback field pass the accessibility checks used elsewhere in the product (keyboard, screen reader, contrast, touch target) in all three languages.

## Assumptions

- Opening, validating, and applying a received link (including the "different instrument" notice and invalid-link handling) is a separate slice (006-sharing/002). This slice defines the format so that slice can read it, and the address-bar sync must not break opening a link.
- Short links, QR codes, and social-network integrations are out of scope.
- "System share sheet" means the device's own sharing mechanism. It is used when the browser exposes the share API **and** the primary pointer is coarse, so desktops copy as the BD acceptance requires (see Clarifications).
- The user canceling the share sheet is not a failure and shows nothing.
- Wording of the confirmation and fallback field follows existing copy conventions; "Copy this address" is required text in English and translated for es and pt-BR.
- Share titles follow the exact per-tool patterns fixed in Clarifications (CAGED "A minor — CAGED, E shape"; Triads "C major — Triads, root position"; Notes "C, E, G — Notes", or "Notes" when nothing is selected).
- Link content is independent of language and notation, so a link shared by one user reads correctly for any recipient.
- Prerequisites exist: the three tools and the instrument settings from earlier slices; the application bar is where tool commands live.
- The home screen has no view state and no Share command; its address stays the base address.
