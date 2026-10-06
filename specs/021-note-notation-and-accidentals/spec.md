# Feature Specification: Letters or Solfège, Sharps or Flats

**Feature Branch**: `feature/021-note-notation-and-accidentals`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/005-languages-and-notation/002-note-notation-and-accidentals.md (id 002, note-notation-and-accidentals)."

## Clarifications

### Session 2026-10-05 (clarify reviewer)

Resolved from sources (cited) or set as documented defaults (marked **Default**). No item needed a human decision.

- Q: What "language" drives the notation default? → A: The **effective** language (the stored choice, else the device-derived one from FR-8.2/EC-8.2, else English). Before any explicit notation choice, notation is derived from it on every read, so a language change moves the notation (es → solfège, en/pt-BR → letters). Once the user picks a notation in either control, it is stored and language changes no longer move it. Erasing preferences (FR-9.4) returns notation to "follow the language". *(Source: FR-8.4, A-5; mirrors the 020 "stored only when explicit" language pattern.)*
- Q: How are the new preferences stored? → A: **Default**: additive optional fields in the existing v1 preferences record (format version stays 1; records written by slices ≤ 020 load unchanged): notation stored only when explicitly chosen (absent → follow language); accidental preference stored only when not "sharps"; CAGED solfège-note flag stored only when true. Each field is validated against its allowed set on its own; an invalid value falls back to its default without affecting other fields. *(Source: constitution IX; DM-14 "notices already shown"; precedent `rotateHint`, `language`.)*
- Q: Where do the controls live and what do they look like? → A: The language panel (reachable from home and every tool, FR-8.1) gains two groups: **Note names** (Letters / Solfège) and **Accidentals** (Sharps / Flats / Both), as single-choice radio groups; its accessible label becomes "Language and notation". The quick toggle sits in the application bar (zone A, design §107) of Notes, Triads, and CAGED only: one two-option switch whose options read "C D E" and "Do Re Mi" (in PT "Dó Ré Mi"), with accessible name "Note names" and the active option exposed as pressed/checked. The accidental preference has no bar control. Both controls are keyboard-operable, ≥ 44×44 CSS px targets, and reflect one shared state. *(Source: FR-8.1, FR-8.5, UJ-6, design §A; constitution V, VII.)* **Default** for labels and control shape.
- Q: The Notes selector always shows both spellings (FR-4.2). What does "flats" change there? → A: The selector keeps both spellings for each altered note, with the **preferred spelling first**: sharps and both → "C♯ / D♭"; flats → "D♭ / C♯". So with flats the selector's leading names read D♭ E♭ G♭ A♭ B♭. The selector's accessible name reads both spellings in the same order. *(Source: FR-4.2, UJ-2 alt 2a, FR-4.12; breakdown acceptance.)*
- Q: Which surfaces follow the accidental preference? → A: (a) Notes tool: markers, hover hint, position card (both spellings always, preferred first), selector (above), "missing notes" notice, detected-triad name (FR-4.10) — under "both", single-name slots (notice, detected-triad root) use the sharp spelling; (b) open-string names in **every** tool and in the instrument panel (nut labels, string filter, tuning summary), except preset tunings (TM-2 spelling) — under "both", string names use the sharp spelling. Triads and CAGED markers, composition panel, key names, and any of their markers without a theory spelling keep their current spelling (theory, or sharps for unspelled background notes); the preference never touches them. A custom tuning that canonicalizes to a preset uses the preset's spelling. *(Source: FR-8.6, FR-4.12, EC-8.5, TM-2; breakdown scope.)*
- Q: When does a "both" marker have room, and how do labels shrink and abbreviate (EC-3.2)? → A: **Default**, a pure, deterministic fit rule (no DOM text measurement), counting graphemes (accidental glyph = 1, octave digit = 1): a one-line label of ≤ 3 graphemes renders at `--marker-label-size`; 4 graphemes at `--marker-label-min-size`; ≥ 5 graphemes is abbreviated. Under "both", a marker of medium size or larger (`--marker-medium`, `--marker-root`) shows the two spellings stacked (sharp above, flat below) at `--marker-label-min-size` when each line is ≤ 3 graphemes; otherwise (small markers, longer lines) it shows the sharp spelling only. Abbreviation order: (1) the syllable "Sol" becomes "So" (the only three-letter syllable; others are already two letters); (2) the octave digit is dropped. The full, unabbreviated name is always in the position card / hover hint and in the accessible name; abbreviation never applies to spoken text. Example: "Sol♯" → min size; "Sol♯3" → "So♯3"; "Sol𝄪3" → "So𝄪3". *(Source: EC-3.2, FR-4.12, design §3.4 typography, tokens.)*
- Q: How are names spoken? → A: Spoken text uses the active notation's name in place of the letter plus the language's accidental word: en letters "F sharp", en solfège "Fa sharp", pt-BR solfège "Fá sustenido", es solfège "Fa sostenido"; doubles per catalog ("dobrado sustenido", "doble bemol", "double flat"). Under "both", a single altered note in a Notes surface is read with both spellings joined by the locale's "or" ("F sharp or G flat"), preferred first. Never "hash", "#", or a bare "b". *(Source: FR-8.7, NFR-3.9, constitution V/VIII; existing `note_spoken_*` catalog keys.)*
- Q: Do preset tuning names containing note letters ("Drop D", "Open G", "Aberta em G") follow notation? → A: **Default**: yes — a note reference inside a preset tuning name is produced by the notation module and follows notation (solfège: "Drop Re", "Double Drop Re", "Open Sol", "Aberta em Sol", "Abierta en Sol", "Drop La"). "DADGAD" is a proper name and stays literal in every notation, like CAGED shape names. Accidentals in tuning names follow TM-2 spelling. *(Source: FR-8.5 "tuning tags", breakdown "tuning and string names"; EC-8.4 analogy for proper names.)*
- Q: What stays in letters under solfège? → A: CAGED shape tags ("E shape"), the CAGED shape-focus buttons (C A G E D), "DADGAD", and interval labels (♭3, 5, R/T). Everything that names a note — including the CAGED key name ("Do major"), Triads root/quality name, composition panel, enharmonic lines ("Fa𝄪 sounds as Sol"), and pitch-with-octave labels ("Sol♯3") — uses solfège. *(Source: FR-8.8, FR-8.9, EC-8.4.)*
- Q: When exactly does the CAGED explanation show, and how does it coexist with the rotate hint? → A: **Default**: it shows whenever the CAGED tool is displayed with solfège active and the flag is not yet set — on opening CAGED, or on switching to solfège while CAGED is open, regardless of tuning support. It is recorded as shown the moment it appears (same rule as the 016 rotate hint), so a reload, a dismissal, or switching letters → solfège never shows it again. It uses the existing non-blocking, dismissible `Notice` (≤ 2 lines), never a modal. It may appear together with the rotate hint; each is independent. Text is translated; syllables follow the language's solfège (pt-BR: "C (Dó), A (Lá), G (Sol), E (Mi) e D (Ré)"). *(Source: FR-8.9, FR-3.19 precedent, constitution VII.)*
- Q: Performance and scope limits? → A: A notation or accidental change updates the fretboard within 100 ms (NFR-1.3) and adds no runtime dependency; the existing accidentals font subset (ADR 0006) already covers ♯ ♭ 𝄪 𝄫. Keyboard shortcut for "switch notation" (design §154) belongs to slice 007/004 and is out of scope. Share links (006) never carry notation or accidental preference (DM-17). "Reset tool" never changes notation or accidentals (FR-1.11).
- Q: How is "no '#' or 'b' for accidentals" tested? → A: E2E scans each tool's visible text in every language × notation × accidental combination and asserts no "#" character and no note-name-followed-by-"b" token (regex `\b([A-G]|Do|Dó|Re|Ré|Mi|Fa|Fá|Sol|La|Lá|Si)b\b`). Same-weight/alignment of glyphs is verified by screenshot fixtures of F♯, Sol♯, F𝄪, B𝄫 on root and medium markers.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choose how note names are written (Priority: P1)

Lia learned Do Re Mi at school; Marcos teaches with letters. Each wants every note name in the product to match what they know. A user picks **letters** (C D E F G A B) or **solfège** (fixed do, with Si). Solfège reads "Dó Ré Mi Fá Sol Lá Si" in Portuguese and "Do Re Mi Fa Sol La Si" in Spanish and English. Notation is independent of language: any language and notation combination works. The default is letters in English and Portuguese, solfège in Spanish.

**Why this priority**: Core promise of the slice. Without it, users who think in solfège cannot read any note label.

**Independent Test**: Open Notes in Spanish with no stored choice and read the naturals; switch notation and confirm every note name changes at once.

**Acceptance Scenarios**:

1. **Given** a first-time Spanish user with no stored choice, **When** they open Notes, **Then** the naturals read Do Re Mi Fa Sol La Si.
2. **Given** English with letters, **When** the user switches to solfège, **Then** names read Do Re Mi Fa Sol La Si.
3. **Given** Portuguese with solfège, **When** the notation is shown, **Then** names read Dó Ré Mi Fá Sol Lá Si.
4. **Given** Spanish with letters chosen, **When** the user changes language to English, **Then** the notation stays letters (notation does not follow language once chosen).
5. **Given** English and Portuguese with no stored notation, **When** the app opens, **Then** notation is letters.

---

### User Story 2 - Switch notation from anywhere, instantly (Priority: P1)

The user changes notation in the language panel or with a quick toggle in each tool's application bar. The change is instant, reloads nothing, alters no tool state, and reaches every place a note name appears: labels and markers, note selectors, the composition panel, tuning and string names, and text descriptions (including screen-reader text).

**Why this priority**: Teachers switch mid-lesson; a toggle that misses a surface leaves mixed notation on screen.

**Independent Test**: In each tool, flip the bar toggle and confirm no note name remains in the previous notation anywhere on the page.

**Acceptance Scenarios**:

1. **Given** any tool is open, **When** the user uses the bar toggle, **Then** all note names on screen change immediately without a reload and the tool state (selection, position, tuning) is unchanged.
2. **Given** the language panel is open, **When** the user changes notation there, **Then** the bar toggle reflects the same value, and vice versa.
3. **Given** solfège is active, **When** the user inspects tuning/string names, selectors, the composition panel, and text descriptions, **Then** all use solfège.
4. **Given** a choice was made, **When** the user reloads the app, **Then** the choice is remembered.

---

### User Story 3 - Choose sharps, flats, or both for single notes (Priority: P2)

Sharps and flats confuse beginners. For single notes (the Notes tool and string names) the user picks an accidental preference: **sharps** (default), **flats**, or **both**. With "both", markers show both spellings when they fit and the sharp spelling when they don't; the position card always shows both. In Triads and CAGED, theory decides spelling and this preference does not apply. Preset tunings keep their own string spelling (Half step down always shows E♭).

**Why this priority**: Valuable but secondary to notation; the product already works with sharps.

**Independent Test**: Choose flats; check the Notes selector and markers, then open Triads A major and confirm it still reads A–C♯–E.

**Acceptance Scenarios**:

1. **Given** the user picks flats, **When** they view the Notes selector and markers, **Then** markers read D♭ E♭ G♭ A♭ B♭ and the selector's altered notes lead with them ("D♭ / C♯", …).
2. **Given** flats is active, **When** the user opens Triads A major, **Then** it reads A–C♯–E.
3. **Given** "both" is active and a medium/root-size marker, **When** it is drawn, **Then** it shows both spellings stacked; **and** a small marker (or a line > 3 graphemes) shows the sharp spelling only; **and** the position card shows both.
4. **Given** flats is active and the Half step down preset is selected, **When** string names are shown, **Then** the altered string shows E♭.
5. **Given** a non-preset tuning with an altered open string, **When** the preference changes, **Then** the string name follows the preference.

---

### User Story 4 - Real accidental symbols, legible and spoken in full (Priority: P2)

Accidentals always render as real symbols ♯ ♭ 𝄪 𝄫, never "#" or "b", in every language and notation, with the same weight and alignment as letters. Labels that do not fit (e.g. "Sol♯", double accidentals) shrink to a legible minimum, then abbreviate, with the full name available on the card or hint. Screen readers read accidentals in full: "F sharp", "Fá sustenido", never "F hash".

**Why this priority**: Correctness and accessibility of the labels introduced by Stories 1–3.

**Independent Test**: Render F♯ in each language/notation; confirm symbols, alignment, shrink-then-abbreviate behavior, and the screen-reader string.

**Acceptance Scenarios**:

1. **Given** any language and notation, **When** an accidental note is shown, **Then** it uses ♯ ♭ 𝄪 𝄫 and no "#" or "b" character stands for an accidental in visible text.
2. **Given** a narrow marker and the label "Sol♯", **When** it does not fit, **Then** it shrinks to a legible minimum, then abbreviates, and the full name is on the card or hint.
3. **Given** a screen reader reaches F♯ in English, **When** it announces it, **Then** it hears "F sharp"; in Portuguese solfège it hears "Fá sustenido".
4. **Given** a double accidental, **When** announced, **Then** it is read in full (double sharp / double flat in the active language).
5. **Given** text zoom up to 200%, **When** labels render, **Then** none is truncated or overlapping.

---

### User Story 5 - CAGED keeps letter shape names, with a one-time explanation (Priority: P3)

CAGED shapes are named after open chords, not note names, so they keep letters even in solfège ("E shape"). The first time CAGED opens in solfège, a one-time note explains: "The shapes are named after the open chords C (Do), A (La), G (Sol), E (Mi), and D (Re)".

**Why this priority**: Prevents confusion for solfège users; narrow surface.

**Independent Test**: In solfège, open CAGED for the first time and check tags and the note; reopen and confirm it does not reappear.

**Acceptance Scenarios**:

1. **Given** solfège and the explanation never shown, **When** CAGED opens, **Then** tags read "E shape" etc. and the explanation shows once.
5. **Given** CAGED open in letters and the explanation never shown, **When** the user switches to solfège with the bar toggle, **Then** the explanation shows.
2. **Given** the explanation was shown, **When** CAGED opens again (including after a reload), **Then** it is not shown again.
3. **Given** letters notation, **When** CAGED opens, **Then** no explanation is shown.
4. **Given** the user dismissed or saw the note and later switches to letters and back to solfège, **Then** it does not reappear.

---

### Edge Cases

- A stored notation or accidental value that is missing, unknown, or corrupt is treated as no stored choice (defaults apply) and never breaks the app.
- A language change when the user has never chosen a notation updates the default notation (letters ↔ solfège per language); once the user chooses explicitly, language changes no longer move it.
- "Both" with a natural note shows just the natural name.
- Flats preference with an open string tuned to an altered note: string name follows the preference except preset tunings with their own spelling.
- Double accidentals arising in theory contexts use the single glyphs 𝄪 𝄫 (never "♯♯"/"♭♭") and follow the fit/abbreviation rule if they cannot fit.
- Switching to solfège while CAGED is open, with the explanation never shown, shows it then (and records it).
- Erasing preferences returns notation to "follow the language", accidentals to sharps, and allows the CAGED explanation to show again.
- A custom tuning that matches a preset uses the preset's string spelling; an unmatched custom tuning follows the preference ("both" → sharp).
- Solfège with Triads and CAGED: spelling is theory-driven; only the letter-to-syllable mapping changes.
- Interval labels (♭3, 5, R/T) are unaffected by notation.
- Text zoom 200% and the longest solfège+accidental labels in Portuguese/Spanish: no truncation or overlap.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST offer a note-name notation setting with two values: letters and solfège (fixed do, with Si; no movable do, "Ti", or German H/B).
- **FR-002**: Solfège MUST read "Dó Ré Mi Fá Sol Lá Si" in Portuguese and "Do Re Mi Fa Sol La Si" in Spanish and English.
- **FR-003**: Notation MUST be independent of language; every language/notation combination MUST work.
- **FR-004**: With no stored notation choice, notation MUST be derived from the effective language (stored, else device-derived, else English): letters in English and Portuguese, solfège in Spanish; it MUST re-derive when the language changes. Once the user explicitly picks a notation, it MUST be stored and MUST NOT change when the language changes.
- **FR-005**: Users MUST be able to change notation in the language panel (Note names: Letters / Solfège; panel labeled "Language and notation") and with a two-option quick toggle ("C D E" / "Do Re Mi", accessible name "Note names") in the application bar of Notes, Triads, and CAGED; both controls MUST reflect one shared state, be keyboard-operable, and have ≥ 44×44 CSS px targets. The accidental preference is set only in the language panel (Sharps / Flats / Both).
- **FR-006**: A notation change MUST apply within 100 ms, without reload, without altering tool state, and MUST reach labels, markers, hover hints, position cards, note selectors, the composition panel, key and triad names, notices, string names, preset tuning names (note references inside them, e.g. "Drop Re", "Aberta em Sol"; "DADGAD" stays literal), and text descriptions (including screen-reader text).
- **FR-007**: The system MUST offer an accidental preference: sharps (default), flats, or both. It MUST apply to the Notes tool (markers, hover hint, position card, selector order, missing-notes notice, detected-triad name) and to open-string names in every tool and the instrument panel. Where only one name fits a slot (notices, detected-triad root, string names), "both" MUST use the sharp spelling. The Notes selector MUST always show both spellings of each altered note with the preferred spelling first (flats: "D♭ / C♯"; sharps and both: "C♯ / D♭").
- **FR-008**: Under "both", a marker of medium or root size MUST show both spellings stacked (sharp above flat) at the minimum label size when each line is ≤ 3 graphemes; otherwise (small markers, longer lines) it MUST show the sharp spelling. The position card MUST always show both spellings (preferred first), in every accidental setting.
- **FR-009**: In Triads and CAGED, spelling MUST be decided by theory; the accidental preference MUST NOT affect it.
- **FR-010**: Preset tunings MUST keep their own string spelling regardless of the preference (e.g. Half step down always shows E♭).
- **FR-011**: Accidentals MUST always appear as ♯ ♭ 𝄪 𝄫, never "#" or "b", in every language and notation, drawn with the same weight and alignment as the letters.
- **FR-012**: Marker label fit MUST be decided by a pure grapheme-count rule (accidental glyph and octave digit count as 1): ≤ 3 graphemes at `--marker-label-size`, 4 at `--marker-label-min-size`, ≥ 5 abbreviated — first "Sol" → "So", then the octave digit dropped. The full name MUST remain on the position card / hover hint and in the accessible name; spoken text is never abbreviated.
- **FR-013**: Screen readers MUST read note names in the active notation with accidentals in full in the active language (e.g. "F sharp", "Fa sharp", "Fá sustenido", "Fa sostenido", double sharp/flat per catalog) and MUST NOT read "hash" or "b". Under "both", a single altered note in a Notes surface MUST be read with both spellings joined by the locale's "or", preferred first.
- **FR-014**: CAGED shape tags and the shape-focus buttons MUST keep letter names (C, A, G, E, D) in solfège; interval labels (♭3, 5, R/T) are unaffected by notation. All other note names in CAGED (e.g. the key name) follow notation.
- **FR-015**: When the CAGED tool is displayed with solfège active (on opening, or on switching to solfège while it is open) and the explanation was never shown, the system MUST show the non-blocking, dismissible notice "The shapes are named after the open chords C (Do), A (La), G (Sol), E (Mi), and D (Re)" (translated; syllables in the language's solfège), record it as shown the moment it appears, and MUST NOT show it again (including after reload or a letters → solfège switch). It is independent of the rotate hint; both may show.
- **FR-016**: Notation (only when explicitly chosen), accidental preference (only when not sharps), and the CAGED-note-shown flag (only when true) MUST be stored as additive optional fields of the existing v1 preferences record; records from earlier slices MUST load unchanged; each invalid or absent field MUST fall back to its own default without affecting other fields, and parsing MUST NOT throw. Erasing preferences MUST reset all three.
- **FR-017**: All new text MUST exist in English, Portuguese, and Spanish, following the trilingual glossary.
- **FR-018**: All note names MUST be produced from one notation source, not formatted per screen, so no surface can disagree with another.
- **FR-019**: Note correctness (pitch, spelling, enharmonics) MUST remain per the music theory reference; notation changes only the display.

### Key Entities

- **Notation preference**: letters or solfège; optional explicit choice, otherwise derived from the effective language.
- **Accidental preference**: sharps, flats, or both; default sharps.
- **CAGED solfège note state**: whether the one-time explanation has been shown (stored only when true).
- **Note name**: pitch class plus spelling (letter, accidental) rendered per notation, accidental policy, and language.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time Spanish user opening Notes sees Do Re Mi Fa Sol La Si with no setup.
- **SC-002**: After a notation change, 100% of visible note names in the tool are in the new notation within one interaction (no reload) and tool state is unchanged.
- **SC-003**: With flats chosen, the Notes selector and markers show D♭ E♭ G♭ A♭ B♭ while Triads A major still reads A–C♯–E.
- **SC-004**: Zero visible occurrences of "#" or "b" standing for accidentals across all language/notation/tool combinations.
- **SC-005**: A screen reader announces F♯ as "F sharp" (English) and "Fá sustenido" (Portuguese solfège) in 100% of surfaces.
- **SC-006**: A solfège user opening CAGED the first time sees "E shape"-style tags and the explanation exactly once.
- **SC-007**: At 200% text zoom, no note label is truncated or overlapping in any language/notation combination.
- **SC-008**: Choices persist across reload; corrupt stored values never produce an error screen.

## Assumptions

- Per-language notation defaults (Q-8) are assumptions to be validated with three to five guitarists per language; they do not block this slice.
- Builds on the three-languages slice (020): language selection, language panel, and trilingual catalogs exist.
- Interval labels and root label (R/T) are unchanged (FR-8.8).
- Out of scope: movable do, "Ti", German H/B naming (open question Q-14).
- The explicit notation choice, once made, is kept when the language changes; before any explicit choice, notation follows the language default.
- Notation and accidental choices are never written into share links.
