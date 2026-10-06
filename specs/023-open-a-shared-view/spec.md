# Feature Specification: Open a Shared View

**Feature Branch**: `feature/023-open-a-shared-view`

**Created**: 2026-10-06

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/006-sharing/002-open-a-shared-view.md (id 002, open-a-shared-view)."

## Clarifications

### Session 2026-10-06

Sources: constitution (C), breakdown `006-sharing/002-open-a-shared-view.md` (BD), macro-spec FR-10.x / EC-10.x / UJ-8 / NFR-6 / ARCH-10 (MS), slice 022 spec (022). Items marked **Default** are assumed conventional choices.

- Q: Which link format does opening read? → A: The version-1 format defined by slice 022 (tool in the path, state in the query, first parameter `v=1`). Opening is the inverse of 022's Share. Every link 022 can produce MUST open to exactly the shared state (round trip) when instrument and tool are valid.
- Q: Does a link ever change personal presentation? → A: BD scope boundary + FR-10.3: no. Language, notation, accidental preference, handedness, orientation, theme and sound always come from the viewer's own settings.
- Q: What is "the viewer's stored instrument" vs the link's instrument? → A: Stored = the saved preference (string count, tuning, fret count). Differing = string count or tuning differs. **Default**: a differing fret count alone does not raise the notice; the link's fret count applies to the opened tool as a session override (same lifetime and panel rules as below), nothing stored changes.
- Q: When is the instrument notice shown, and how long? → A: Whenever the link's tuning or string count differs from the stored one, on opening. It is persistent (no auto-hide) and non-blocking, never a modal, and at most two lines plus its actions (C-VII). Per C-VII it is also dismissible: Dismiss only hides it and changes nothing (the override stays, nothing stored changes); **Use mine** and **Adopt this one** resolve it (**Default**). While the override is active (next item), the notice is shown again every time the opened tool is displayed, including after a Dismiss followed by leaving the tool and coming back.
- Q: Scope of "link's instrument applies only to that tool for that session"? → A: Only the opened tool uses it, only in memory, until the page is reloaded or closed (the "session"). Nothing is written to device storage, and other tools keep the stored instrument until **Adopt this one**. **Default**: leaving the tool and coming back in the same session keeps the override and the notice (BD "for that session"), so the user is never left on a foreign instrument without the two actions.
- Q: What if the user changes the instrument in the instrument panel while an override is active? → A: **Default**: the panel always shows and edits the stored instrument. Any instrument change made there is an explicit user choice: it is saved as usual, the override ends, the notice closes, and the view is recalculated on the new instrument with EC-2.3 if needed.
- Q: When does "opening a link" happen? → A: **Default** (SPA convention; 022 address sync): only when the app is entered by a full page load (fresh tab, pasted address, reload) on a tool path whose address has a query string. Client-side navigation inside the running app (home → tool, AppNav, Back/Forward) keeps today's behaviour: the tool shows its in-memory session state, the query is ignored, and address sync rewrites the address to that state. A tool path with no query string at all (`/notes`, `/triads`, `/caged`) is a normal tool open: initial or session state, no link applied, no notice. A reload of the user's own canonical address re-applies it and so reproduces the same view.
- Q: Invalid or missing instrument fields (`sc`, `tu`, `fr`)? → A: **Default** ("tool default" for an instrument = the viewer's stored instrument, which is what the tool opens with otherwise): if `sc` or `tu` is missing or invalid (including a custom tuning with an invalid pitch, or a tuning not valid for the string count), string count and tuning both come from the stored instrument. If `fr` is missing or invalid, the stored fret count is used. Each replacement counts for the incomplete-link notice. The instrument comparison for the instrument notice runs on the result, so a replaced instrument never raises the instrument notice by itself. (The 022 decoder's factory defaults are replaced by stored values at the opening layer.)
- Q: Does applying a link's label type (`lb`) write the per-tool label preference? → A: **Default**: no. Like the instrument, link values are applied to the view in memory only; opening a link causes zero storage writes of preferences (instrument, labels, presentation). Later changes the user makes themselves are saved as usual. Recording the opened tool as the last-used tool is navigation, not a preference, and follows existing tool-visit behaviour.
- Q: Wording of the instrument notice? → A: **Default**: "This view uses {tuning}", where {tuning} is the same tuning label the instrument panel shows in the viewer's language. When the link's string count differs from the stored one, the label is prefixed by the string count ("7-string Standard" style, localized). For a custom tuning, {tuning} is the string notes from lowest to highest string, in the viewer's notation and accidental preference, separated by spaces.
- Q: Which instrument does CAGED compare and adopt when the link has `tmp=1`? → A: Derived from 022 link-format §5: the link's `sc`/`tu`/`fr` are the sharer's preferred instrument. That is what is compared with the stored instrument, what **Adopt this one** stores, and what **Use mine** replaces. The temporary standard-tuning flag is then recomputed by FR-6.14 for whichever instrument is in use.
- Q: Behaviour of the incomplete-link notice? → A: **Default**: shown once per opening, in the existing `Notice` style (polite live region), dismissible, no auto-hide, removed when dismissed or when the user leaves the tool or home screen it appeared on. It never blocks the fretboard.
- Q: Nearest-equivalent message wording? → A: Derived from CODE: reuse the existing catalog message `instrument_adjusted` ("We adjusted the view to the new instrument", all three languages) and the existing per-tool adjustment notices where EC-2.3 already emits them. No new key unless a case has no existing message.
- Q: What does **Adopt this one** persist? → A: Only the instrument (string count, tuning, fret count), through the same path as the instrument panel. Never presentation settings. The notice closes and the view stays unchanged.
- Q: "Nearest equivalent" when a state is impossible on an instrument (EC-2.3)? → A: Reuse the existing EC-2.3 behaviour used when the instrument changes (for example string set 7-6-5 on 6 strings moves to the nearest valid set). A notice names the change (wording: see the nearest-equivalent item below). When the link itself is impossible on its own instrument (EC-10.2), the moved fields also count as replacements, so the incomplete-link notice shows (matches the 022 decoder, which reports clamped `ss`/`oc` in `fellBack`).
- Q: How are invalid values detected and reported? → A: Per value. Each is checked against its allowed set or range. An invalid or missing value is replaced by that tool's default, and valid values are kept. One notice "This link was incomplete; we show the closest view possible" shows if at least one replacement happened (once, not per value). Unknown extra parameters are ignored and do not trigger the notice (**Default**: forward compatibility within the same version).
- Q: Newer format version or unknown tool? → A: Per BD + EC-10.5 ("treated as EC-10.1"): a version greater than the app supports opens the tool; every parameter is read with the newest decoder rules the app has (v1), valid values kept, the rest defaulted, and the incomplete-link notice always shows. On a tool path whose query is non-empty, a missing or non-integer `v` is treated the same way (**Default**). This requires the opening layer to decode best-effort instead of stopping at the 022 decoder's `unsupported-version` / `invalid` results (an additive change to `src/lib/link`; v1 decoding and fixtures are unchanged).
- Q: Unknown tool vs the existing not-found page? → A: **Default**: an unknown path whose query contains a `v` parameter is a link to an unknown tool: home opens (address replaced by `/`, as the existing not-found route does) with the incomplete-link notice instead of the not-found notice. Any other unknown path keeps the existing not-found behaviour.
- Q: Non-compatible tuning in CAGED? → A: EC-10.7 / FR-6.14: CAGED shows the existing temporary standard-tuning fallback, and the instrument notice is still offered.
- Q: Interaction with address sync from 022? → A: Opening applies the link through 022's initialisation hook before sync starts. Afterwards the address is replaced (no history entry) by the canonical link of the state actually shown, so a repaired link is never reproduced verbatim.
- Q: Does **Use mine** change the address? → A: Yes, as a view-state change: the address settles to the canonical link of the recalculated view.
- Q: Security of rendering? → A: NFR-6 / C-IX: link text is never interpreted as markup or code. Nothing is echoed except values from fixed sets. Custom string notes shown in the notice are re-derived from validated pitches, not echoed text.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Land on exactly the shared view (Priority: P1)

Ana, a left-handed student who uses the app in Portuguese, taps her teacher's link on her phone. The app skips home and opens the tool the teacher described, in the exact state the teacher built, drawn for Ana: Portuguese text, her notation, her handedness and string orientation.

**Why this priority**: This is the point of sharing; without it links are useless to the recipient.

**Independent Test**: With stored settings left-handed + Portuguese, open a link for CAGED, D major, E shape. Verify tool, key, quality and focused shape match, and the view is mirrored and in Portuguese.

**Acceptance Scenarios**:

1. **Given** a left-handed Portuguese viewer and a valid CAGED link (D major, E shape), **When** they open it, **Then** CAGED opens directly (no home screen) in that state, mirrored, in Portuguese.
2. **Given** a valid link for Notes or Triads, **When** opened, **Then** that tool opens directly with every state field from the link applied.
3. **Given** a link produced by Share for any view on the viewer's own instrument, **When** opened, **Then** the resulting state equals the shared state and no notice is shown.
4. **Given** any link, **When** opened, **Then** the viewer's language, notation, accidental preference, handedness, orientation, theme and sound are unchanged, and no preference (including label types and instrument) is written to storage.
5. **Given** a bare tool path with no query (e.g. `/caged`), **When** loaded, **Then** the tool opens normally with no link applied and no notice.

---

### User Story 2 - Different instrument: Use mine or Adopt this one (Priority: P1)

The teacher uses Drop D; Ana's stored tuning is standard. The view opens on Drop D with a persistent notice "This view uses Drop D" and two actions. **Use mine** recalculates the view on Ana's instrument. **Adopt this one** stores Drop D as her preference.

**Why this priority**: Instrument differences are the commonest reason a link looks wrong. The choice must be explicit and non-destructive.

**Independent Test**: Stored tuning standard; open a Drop D link; verify the notice, then each action in separate runs.

**Acceptance Scenarios**:

1. **Given** stored tuning standard and a Drop D link, **When** opened, **Then** the view uses Drop D and a persistent notice reads "This view uses Drop D" with **Use mine** and **Adopt this one**.
2. **Given** that notice with no choice made, **When** the user opens another tool, **Then** the stored instrument is unchanged and that tool uses it.
3. **Given** that notice, **When** the user taps **Use mine**, **Then** the view is recalculated on the stored instrument, the notice closes, and nothing stored changes.
4. **Given** that notice, **When** the user taps **Adopt this one**, **Then** Drop D becomes the stored tuning, the notice closes, and the view is unchanged.
5. **Given** a link with a custom tuning and a different stored instrument, **When** opened, **Then** the notice lists the string notes instead of a name.
6. **Given** the link's instrument equals the stored one, **When** opened, **Then** no instrument notice appears.
7. **Given** **Use mine** makes the view impossible (a 7-6-5 string set on a 6-string instrument), **When** tapped, **Then** the view moves to the nearest equivalent and a notice says so.
8. **Given** a link whose state is impossible on its own instrument, **When** opened, **Then** the same nearest-equivalent move and notice apply.
9. **Given** a link with a non-compatible tuning opened in CAGED, **When** opened, **Then** the standard-tuning fallback shows and the instrument notice names the link's preferred tuning.
10. **Given** the instrument notice with no choice made, **When** the user goes to another tool and back in the same session, **Then** the opened tool still uses the link's instrument and the notice is shown again.
11. **Given** the instrument notice, **When** the user changes the instrument in the instrument panel, **Then** the change is saved, the override ends and the notice closes.
12. **Given** a link whose string count differs from the stored one (7-string Standard link, 6-string stored), **When** opened, **Then** the notice includes the string count.

---

### User Story 3 - Untrusted, incomplete or newer links never break the app (Priority: P1)

Links come from anywhere. Every value is validated. Invalid values fall back to that tool's defaults while valid values stay, and a notice says "This link was incomplete; we show the closest view possible". An unknown tool opens home with the notice. A link from a newer format version opens the closest view with the notice.

**Why this priority**: Security (untrusted input) and robustness. One bad link must never produce a blank or broken app.

**Independent Test**: Open links with an out-of-range fret count and an unknown quality; with an unknown tool; with a newer version; with markup in values.

**Acceptance Scenarios**:

1. **Given** a link with an out-of-range fret count and an unknown quality, **When** opened, **Then** both fall back to defaults, other valid values are kept, and the incomplete-link notice shows once.
2. **Given** a link naming a tool that does not exist, **When** opened, **Then** home opens with the incomplete-link notice.
3. **Given** a link with a format version newer than the app supports, **When** opened, **Then** the closest view opens with the notice.
4. **Given** a link with missing parameters, **When** opened, **Then** missing values take tool defaults and the notice shows.
5. **Given** values containing markup, script text or very long strings, **When** opened, **Then** nothing is rendered as formatted text or executed, and the app works normally.
6. **Given** a link produced by any earlier released format version, **When** opened in a later version, **Then** it opens as originally intended.
7. **Given** a fully valid link with extra unknown parameters, **When** opened, **Then** the view opens and no notice shows.
8. **Given** a link with an invalid custom tuning (`tu=c.` with a wrong pitch count), **When** opened, **Then** the stored string count and tuning are used, the incomplete-link notice shows, and no instrument notice shows.
9. **Given** an unknown path without a `v` parameter, **When** opened, **Then** the existing not-found behaviour applies (not the incomplete-link notice).

---

### User Story 4 - Address and history after opening (Priority: P2)

After opening a link the address shows the canonical form of what is displayed, with no extra history entries, so Back leaves the tool rather than stepping through repairs.

**Why this priority**: Keeps slice 022's address guarantees true for received links.

**Independent Test**: Open a link with an invalid value; check the address is the canonical repaired link; press Back once.

**Acceptance Scenarios**:

1. **Given** a link repaired during opening, **When** the view appears, **Then** the address equals the canonical link of the displayed view and no history entry was added.
2. **Given** a link opened in a fresh tab, **When** Back is pressed, **Then** the browser leaves the app as normal, with no internal repair step.

---

### Edge Cases

- Duplicate parameters: the first occurrence is used; duplicates never cause markup or errors (**Default**).
- Fret count valid but too small for the shared shape or region: nearest-equivalent move with notice (EC-10.2 / EC-2.3).
- Custom tuning with an invalid note, or any invalid `sc`/`tu`: string count and tuning come from the viewer's stored instrument, the incomplete-link notice shows, and no instrument notice is raised by the replacement. Invalid `fr`: stored fret count, incomplete-link notice.
- Tool path with no query string (in-app link, bookmark of a bare tool path): normal tool open, no link applied, no notice. Tool path with a non-empty query lacking required fields: missing values take defaults and the incomplete-link notice shows.
- Client-side navigation (AppNav, Back/Forward) to a tool address with a query does not re-apply it; the in-memory session state is shown and the address is resynced.
- Unknown path without a `v` parameter: existing not-found behaviour (home with the not-found notice), unchanged.
- Instrument notice and incomplete-link notice can show together. Both are non-blocking and leave fretboard controls reachable.
- Reduced motion, screen reader, high contrast: notices are announced politely, keyboard operable, and do not rely on color alone.
- Opening a link offline works (static app, no network).
- Viewer has no stored instrument yet: the app's default instrument counts as stored.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Opening a link MUST go directly to the described tool and state, skipping the home screen. "Opening a link" means a full page load on a tool path with a non-empty query string; a bare tool path and client-side navigation MUST NOT apply a link or show a link notice.
- **FR-002**: The opened view MUST be drawn with the viewer's own language, notation, accidental preference, handedness and string orientation. Links MUST NOT change any personal presentation setting.
- **FR-003**: Every link produced by slice 022 Share MUST open to exactly the shared state (round trip) when the tool and instrument are valid.
- **FR-004**: When the link's tuning or string count differs from the viewer's stored instrument, the view MUST use the link's instrument and show a persistent (no auto-hide), non-blocking, dismissible notice "This view uses [tuning]" (C-VII); Dismiss only hides it and keeps the override. [tuning] is the instrument panel's tuning label, prefixed by the string count when it differs from the stored one. For a custom tuning it MUST list the string notes from lowest to highest string in the viewer's notation and accidental preference. For CAGED the compared instrument is the link's preferred instrument (`sc`/`tu`/`fr`), regardless of `tmp`.
- **FR-005**: The notice MUST offer **Use mine** (recalculate the view on the stored instrument) and **Adopt this one** (store the link's instrument as the preference).
- **FR-006**: Until one is chosen, the link's instrument MUST apply only to the opened tool, in memory, until the page is reloaded or closed; the notice MUST reappear whenever that tool is shown while the override is active. Opening a link MUST cause zero preference writes to storage (instrument, label types, presentation). An instrument change made in the instrument panel during the override MUST be saved as usual, end the override and close the notice.
- **FR-007**: **Adopt this one** MUST persist only the instrument (string count, tuning, fret count) and close the notice with the view unchanged.
- **FR-008**: When **Use mine**, or the link itself, makes the state impossible on the instrument in use, the system MUST move to the nearest equivalent state (EC-2.3) and show a notice saying so, reusing the existing EC-2.3 messages (e.g. `instrument_adjusted`).
- **FR-009**: A link with a non-compatible tuning opened in CAGED MUST show the standard-tuning fallback (FR-6.14).
- **FR-010**: Link values MUST be treated as untrusted. Each value MUST be checked against its allowed set or range before use, nothing from a link MUST be rendered as formatted text or executed, and invalid values MUST NOT break the app.
- **FR-011**: Missing, unknown or out-of-range values MUST fall back to that tool's defaults while valid values are kept. For instrument fields the default is the viewer's stored value (invalid `sc` or `tu` → stored string count and tuning together; invalid `fr` → stored fret count).
- **FR-012**: If any value was replaced (including fields moved by EC-2.3 because the link is impossible on its own instrument), the system MUST show one notice: "This link was incomplete; we show the closest view possible". It is dismissible, does not auto-hide, and is removed when dismissed or when the user leaves the screen it appeared on.
- **FR-013**: An unknown path carrying a `v` parameter MUST open home (address replaced by `/`, no history entry) with the incomplete-link notice instead of the not-found notice. Unknown paths without `v` keep the existing not-found behaviour.
- **FR-014**: A link with a newer format version than the app supports, or (on a non-empty query) a missing or non-integer `v`, MUST open the named tool with every parameter read by the newest decoder rules the app has (valid values kept, others defaulted) and MUST always show the incomplete-link notice.
- **FR-015**: Links produced by any earlier released format version MUST keep opening as originally intended in later versions, covered by compatibility fixtures that only grow.
- **FR-016**: Unknown extra parameters within a supported version MUST be ignored without a notice.
- **FR-017**: After opening, the address MUST be replaced (not pushed) with the canonical link of the displayed state, and address sync MUST start only after the link is applied.
- **FR-018**: All new text (instrument notice, action labels, custom-tuning listing, nearest-equivalent message, incomplete-link notice) MUST exist in English, Spanish and Brazilian Portuguese. Tuning and note names follow the viewer's notation and accidental preference.
- **FR-019**: Notices MUST be non-modal, keyboard and screen-reader operable (polite announcement), have action targets of at least 44×44 CSS px, and not rely on color alone.
- **FR-020**: Opening and validating a link MUST NOT make a network request or slow first display beyond the app's performance budgets.

### Key Entities

- **Received link**: The address the viewer opened: tool, format version and state values, all untrusted until validated.
- **Validated view**: The tool state actually shown after checking, defaulting and nearest-equivalent moves.
- **Link instrument**: String count, tuning and fret count carried by the link.
- **Stored instrument**: The viewer's saved instrument preference.
- **Session instrument override**: The link instrument applied only to the opened tool for the current session until **Use mine** or **Adopt this one**.
- **Notice**: A non-blocking message: instrument, incomplete-link, or nearest-equivalent.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of links generated by Share in the test matrix (all tools, preset and custom tunings, 6 and 7 strings, every optional-none field) open to the identical state with zero mismatches.
- **SC-002**: A recipient reaches the shared view in one action (opening the link), with zero intermediate screens.
- **SC-003**: With a differing instrument, the notice appears in 100% of cases, and stored preferences stay unchanged until **Adopt this one** is chosen (0 unintended storage writes).
- **SC-004**: In a set of malformed, hostile and truncated links, 0 crashes, 0 blank screens, and 0 values executed or rendered as markup. Every link opens a usable view or home.
- **SC-005**: 100% of links with at least one invalid value show the incomplete-link notice exactly once, and 100% of their valid values are kept.
- **SC-006**: Every previously released format fixture opens to its recorded state after any later change (0 regressions).
- **SC-007**: Notices and actions pass the product's accessibility checks (keyboard, screen reader, contrast, touch target) in all three languages.
- **SC-008**: Opening a link meets the same first-display performance budget as a normal app start.

## Assumptions

- Slice 022 (Share a view) provides the version-1 link format, the encode/decode module and the address-sync initialisation hook. This slice uses them.
- Presentation settings (language, notation, handedness, orientation, theme, sound) are never carried by links (BD scope boundary).
- The stored instrument defaults to the app's default instrument when the viewer has none.
- Existing EC-2.3 nearest-equivalent logic and the FR-6.14 CAGED fallback are reused, not redefined.
- Short links, QR codes and sign-in are out of scope. No server is involved.
- Offline use works because the app is static and on-device.
