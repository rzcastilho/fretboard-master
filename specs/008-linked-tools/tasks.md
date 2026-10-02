# Tasks: Linked Tools

**Input**: Design documents from `/specs/008-linked-tools/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (triad-detect-api.md, links-api.md, notes-ui.md), quickstart.md

**Tests**: INCLUDED. Constitution Principle IV (Test-First) and plan.md require tests written first and seen failing. Each story maps to Vitest tests and/or Playwright flows in `e2e/linked-tools.spec.ts`.

**Organization**: Tasks are grouped by user story. Pure theory/state code shared by several stories sits in Phase 2 (Foundational).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US5, from spec.md
- Paths are relative to the repository root. Single SvelteKit project: `src/lib/...`, `tests/unit/...`, `e2e/...`

---

## Phase 1: Setup

**Purpose**: Config and catalog changes every later task relies on

- [X] T001 Add the 4 catalog keys to `messages/en.json`: `notes_triad_name` = `{root} {quality}`, `notes_view_as_triad` = `View as triad`, `notes_card_triads_from_note` = `Triads from this note`, `notes_desc_triad` = `The selected notes form {name}.`; write accidentals as ♯ ♭ 𝄪 𝄫; add the same keys to any other locale file in `messages/` using the English text if no translation exists. Run `pnpm check` to recompile paraglide.
- [X] T002 [P] Extend the purity block in `eslint.config.js` so `src/lib/state/links.ts` gets the same no-Svelte/no-paraglide/no-DOM rules as `src/lib/state/notes-view.ts`.
- [X] T003 [P] Write `docs/adr/0011-tool-links-carry-at-activation.md` (R-01, R-12): carry is applied in the activating control's click handler, never from the URL, history or storage; list the consequences for CAGED links (004-caged/006) and share links; rejected alternatives: query param, `beforeNavigate`, pending-intent read in `onMount`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure detection and carry logic plus store methods used by US1, US2 and US3

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests first (must fail before implementation)

- [X] T004 [P] Write `tests/unit/theory/triad-detect.test.ts`: guarantees D1–D7 from `contracts/triad-detect-api.md`, plus the SC-002 table of 12 roots × 4 qualities × 6 selection orders = 288 rows (expected root; augmented root = first element). Also cover 0, 1, 2 and 4 notes, duplicates, non-integers and values outside 0..11, which return `null` and never throw.
- [X] T005 [P] Write `tests/unit/theory/triad-detect.property.test.ts` (fast-check): for every root and quality and any permutation of `spellTriad(r, q).pitchClasses`, the quality equals `q` and the root is `r`, except augmented where the root is `p[0]`; any accepted 3-set round-trips through `spellTriad(defaultRootSpelling(root, q), q)`; a random 3-set matching no interval pattern returns `null`.
- [X] T006 [P] Write `tests/unit/state/links.test.ts` (pure): guarantees L1–L11 from `contracts/links-api.md`. `carryRoot` same-root returns the same object (`Object.is`); `carryTriad` swap with Compare; `carryFromTriads` ignores `compare.quality`; `carrySelection` changes only `selection`.

### Implementation

- [X] T007 Implement `detectTriad(selection)` in `src/lib/theory/triad-detect.ts` per `contracts/triad-detect-api.md`. Imports only `./pitch` and `./triad`. Return `null` unless the input is exactly 3 distinct integers in 0..11. Try candidate roots in selection order against `QUALITY_INTERVALS` in `QUALITIES` order and return the first match (so the augmented root is `selection[0]`). Makes T004 and T005 pass.
- [X] T008 Implement the pure module `src/lib/state/links.ts` per `contracts/links-api.md` §1 and `data-model.md` §4–5: export `NOTES_PRIMARY_CHOICE = 'sharp'`, `CarryContext`, `carryFromNotes` (non-null only if `selection.length === 1`), `carryFromDetected` (spelling `NOTES_PRIMARY_CHOICE` for an altered root, else `'none'`), `carryFromTriads` (`[r, r+third, r+fifth] mod 12`, main quality only), `carryRoot` (`spellingOverride → 'none'`, `occurrence → 0`, same object if root equal or invalid), `carryTriad` (root, spelling, quality; swap with `compare.quality` as `setQuality` does; occurrence reset and clamped; same object if nothing changes) and `carrySelection` (replaces only `selection`; same object if element-wise equal). Keep inversion, stringSet, view, labelType and `compare.on` unchanged. Depends on T007 only for types. Makes T006 pass.
- [X] T009 [P] Add `carryRoot(pc)` and `carryTriad(pc, q, spelling)` to `src/lib/state/triads.svelte.ts`. Both go through `apply()`. `carryTriad` raises the existing `compare-swapped` notice when the swap happened.
- [X] T010 [P] Add `carrySelection(sel)` to `src/lib/state/notes.svelte.ts`, going through `apply()`.
- [X] T011 Create the orchestrator `src/lib/state/links.svelte.ts` per `contracts/links-api.md` §2 with `LinkedTool`, `linkTools(from, to)`, `viewAsTriad()`, `openTriadsFromNote(pc)` and `resetTool(tool)`. `linkTools`: notes→triads calls `triads.carryRoot` iff `carryFromNotes` is non-null; triads→notes calls `notes.carrySelection(carryFromTriads(...).selection)`; no-op when `from === to` or `from` is home/about. `viewAsTriad` is a no-op without navigation when `notes.display.detected === null`; otherwise it calls `triads.carryTriad` then `goto(resolve('/triads'))`. `openTriadsFromNote` calls `triads.carryRoot(pc)` then `goto(resolve('/triads'))`. `resetTool` calls `notes.reset()` or `triads.reset()`. No URL, storage or history writes other than the single `goto`. Depends on T008, T009, T010.

**Checkpoint**: Detector and carry logic are green. Stories can start.

---

## Phase 3: User Story 1 - Find a triad from the notes I selected (Priority: P1) 🎯 MVP

**Goal**: Notes names a detected triad and offers **View as triad**, which opens Triads on that root and quality.

**Independent Test**: Select note sets in Notes; check the name shown and the Triads state reached through **View as triad** (C–E–G → C major; G♯–C–E → G♯ augmented; C♯–F–G♯ → C♯ major; C–D–E → nothing).

### Tests for User Story 1 (write first, confirm they fail)

- [X] T012 [P] [US1] Write `tests/unit/notes/detected-triad.test.ts` for `DetectedTriad.svelte` (via @testing-library/svelte): renders nothing at all when `detected === null`; shows the visible name with `aria-hidden` plus the visually hidden spoken name ("G sharp augmented"); the button has `aria-describedby="notes-detected-triad"`; clicking calls `onview`; still renders when `hideNames` is on.
- [X] T013 [P] [US1] Extend the notes-model tests (the existing `tests/unit/notes/` model test file, or a new `tests/unit/notes/notes-model-detected.test.ts`): `NotesDisplay.detected` is set only for exactly three notes forming a supported triad; name "C♯ major" and spoken "C sharp major" for C♯–F–G♯; augmented root is the first-selected note; `description` gains `notes_desc_triad` only when detected; no message otherwise (EC-4.7).
- [X] T014 [P] [US1] Add to `tests/unit/state/links-store.test.ts` (create it): `viewAsTriad()` on G♯, C, E leaves `triads` at root G♯ with override `sharp` and quality augmented, keeping inversion and string set; no navigation when nothing is detected; with Compare on and the incoming quality equal to the comparison quality, the qualities swap and the notice is raised. Mock `$app/navigation` `goto`.
- [X] T015 [P] [US1] Create `e2e/linked-tools.spec.ts` with the US1 flows: C–E–G → "C major" → View as triad → Triads C major; G♯, C, E → G♯ augmented (B♯, D𝄪 shown); C–D–E → no button and no message; remove a note → name disappears; E, G♯, C → root E; C♯, F, G♯ → C♯–E♯–G♯. Run axe on the Notes page with the button visible (zero violations).

### Implementation for User Story 1

- [X] T016 [US1] In `src/lib/state/notes-model.ts` add `DetectedTriad` (`rootPc`, `quality`, `rootSpelling`, `name`, `spokenName`) and `NotesDisplay.detected`, built from `detectTriad(view.selection)`. Root spelling is `defaultSpelling(rootPc)` from `src/lib/notation`; name comes from `notes_triad_name` with `noteLabel` and the `triads_quality_*` keys; spoken name from `spokenNote`. Append `notes_desc_triad({ name: spokenName })` to `describe()` when detected. Re-export the `Quality` type for tools. Tools must not import `$lib/theory/*`.
- [X] T017 [US1] Create `src/lib/tools/notes/DetectedTriad.svelte` per `contracts/notes-ui.md` §1: props `{ detected, onview }`; renders nothing when null; `<p id="notes-detected-triad">` with `aria-hidden` visible name and a visually hidden spoken name; `<button type="button" aria-describedby="notes-detected-triad">` labelled `notes_view_as_triad`; tokens only; 44×44 minimum target; visible focus; reflows at 320 px and 200 % text zoom.
- [X] T018 [US1] Mount `DetectedTriad` in `src/lib/tools/notes/NotesTool.svelte` in control zone B directly below `NoteSelector` (never over the fretboard), passing `notes.display.detected` and `viewAsTriad` from `$lib/state/links.svelte`. It must show in hidden mode.
- [X] T019 [US1] Run T012–T015 and fix failures. Confirm the 4 acceptance examples of SC-001 (C–E–G, G♯–C–E, C–D–E) and quickstart Q1–Q3 manually.

**Checkpoint**: US1 works alone. This is the MVP.

---

## Phase 4: User Story 2 - Notes carry into Triads and back (Priority: P1)

**Goal**: Switching tools through the persistent nav carries a single note to Triads and the main triad to Notes; everything else is kept.

**Independent Test**: Set up each origin state, use the nav link, compare the destination with the carry rules (A + 1st inversion 4-3-2 → A major 1st 4-3-2; Triads C major → Notes C, E, G).

### Tests for User Story 2 (write first, confirm they fail)

- [X] T020 [P] [US2] Add to `tests/unit/state/links-store.test.ts`: `linkTools('notes','triads')` with `[9]` keeps quality, inversion and string set and sets root A; with `[8]` and Triads on augmented the root shows as A♭ (override `none`); same-root carry keeps a user-switched D♭; 0, 2 and 3+ selected notes do nothing; `linkTools('triads','notes')` on E augmented sets the Notes selection to `[4, 8, 0]` and keeps filters, label type, background, hidden mode and card; Compare is ignored; `from` home/about is a no-op; `from === to` is a no-op; E augmented → Notes → `viewAsTriad` returns to E augmented.
- [X] T021 [P] [US2] Extend `tests/unit/app-nav.test.ts`: the tool-link click calls `linkTools(current, id)` only for a plain primary click on a different tool; no call with Ctrl/Meta/Shift/Alt, `button !== 0`, `defaultPrevented`, the current tool, or a non-tool item; `href` is unchanged. Home-screen `ToolCard` never calls it.
- [X] T022 [P] [US2] Add US2 flows to `e2e/linked-tools.spec.ts`: A + 1st inversion 4-3-2 → Triads; Triads C major → Notes shows C, E, G and "C major"; nothing selected → Triads opens in its last state; home card opens the tool without a carry (including "Continue"); Back and Forward do not re-apply a carry; reload gives the initial state; G♯ only with augmented → A♭ augmented; D♭ kept when C♯/D♭ is carried; carried notes outside the filters show the EC-4.4 guidance.

### Implementation for User Story 2

- [X] T023 [US2] Change `src/lib/shell/AppNav.svelte`: tool links get an `onclick` that calls `linkTools(current, item.id)` iff `item.id` is a tool, `item.id !== current`, `e.button === 0`, no modifier keys and `!e.defaultPrevented`. Do not change `href`. Do not touch `ToolCard.svelte` or `HomeScreen.svelte`.
- [X] T024 [US2] Add a Playwright timing check in `e2e/perf.spec.ts`: nav click Notes → Triads with a carry shows the carried root within 300 ms of the click (SC-005). The destination must render the carried context on its first paint (FR-017).
- [X] T025 [US2] Run T020–T022 and T024 and fix failures. Check quickstart Q4–Q6, Q8 and Q11.

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Triads from this note (Priority: P2)

**Goal**: The position card opens Triads with the focused note's pitch class as root.

**Independent Test**: Focus an F♯ position, press **Triads from this note**, check root and kept settings.

### Tests for User Story 3 (write first, confirm they fail)

- [X] T026 [P] [US3] Extend `tests/unit/notes/position-card.test.ts`: a **Triads from this note** button (`notes_card_triads_from_note`) is in `.actions` before **Close**; activating it calls `ontriads(info.pitchClass)`; it is keyboard operable with visible focus. The card has no **CAGED in this key** button.
- [X] T027 [P] [US3] Add to `tests/unit/state/links-store.test.ts`: `openTriadsFromNote(6)` sets Triads root F♯ for major, minor and diminished and G♭ for augmented, keeps quality, inversion and string set, and ignores what the Notes selection holds; it calls `goto` exactly once.
- [X] T028 [P] [US3] Add US3 flows to `e2e/linked-tools.spec.ts`: tap an F♯ position → card → **Triads from this note** → Triads root F♯; with a multi-note selection the focused note is still the root; keyboard-only Enter works; axe zero violations on the open card.

### Implementation for User Story 3

- [X] T029 [US3] In `src/lib/tools/notes/PositionCard.svelte` add the prop `ontriads: (pc: PitchClass) => void` and the **Triads from this note** button before **Close**.
- [X] T030 [US3] In `src/lib/tools/notes/NotesTool.svelte` pass `openTriadsFromNote` from `$lib/state/links.svelte` to `PositionCard` as `ontriads`.
- [X] T031 [US3] Run T026–T028 and fix failures. Check quickstart Q7 and Q12.

**Checkpoint**: US1–US3 work independently.

---

## Phase 6: User Story 4 - Each tool remembers its session; Reset tool starts it over (Priority: P2)

**Goal**: Session memory is guaranteed by tests. **Reset tool** resets only the current tool, including from the failure view.

**Independent Test**: Change a tool, leave and return, then reset; check state and settings each time.

### Tests for User Story 4 (write first, confirm they fail)

- [X] T032 [P] [US4] Add to `tests/unit/state/links-store.test.ts`: state survives switching tools without a carry (FR-004); `resetTool('triads')` returns Triads to its initial state and leaves the Notes state untouched; instrument, language and notation are unchanged; after reset, a switch away and back reopens the initial state.
- [X] T033 [P] [US4] Write a failing test first (bug-fix rule) in `tests/unit/tool-layout.test.ts` and/or `tests/unit/failure-view.test.ts`: the failure view's **Reset tool** resets the tool's store (`resetTool(tool)`) and then calls the boundary `reset()` (EC-1.3).
- [X] T034 [P] [US4] Add US4 flows to `e2e/linked-tools.spec.ts`: change Triads, visit Notes, return → Triads as left; **Reset tool** with a non-default instrument, language and notation keeps them and leaves the other tool untouched; quickstart Q9.

### Implementation for User Story 4

- [X] T035 [US4] In `src/lib/shell/ToolLayout.svelte`, change the failure snippet to pass `reset={() => { resetTool(tool); boundaryReset(); }}` to `FailureView`, importing `resetTool` from `$lib/state/links.svelte`.
- [X] T036 [US4] Run T032–T034 and fix failures. Confirm FR-012 to FR-014 hold with no code change beyond T035 (the stores already persist per session).

**Checkpoint**: US1–US4 work independently.

---

## Phase 7: User Story 5 - Browser history only follows screens (Priority: P3)

**Goal**: Back and Forward follow screens only. In-tool changes, carries and resets add no entries.

**Independent Test**: Make many in-tool changes, then use Back and count screens.

### Tests for User Story 5

- [X] T037 [P] [US5] Add US5 flows to `e2e/linked-tools.spec.ts`: 20 mixed in-tool changes, carries and resets (selection, filters, quality, inversion, string set, **Reset tool**) → one Back reaches the previous screen every time (SC-003); Home → Notes → (nav carry) Triads → Back → Notes → Back → Home; each shortcut (**View as triad**, **Triads from this note**) adds exactly one history entry and the carry adds none (FR-015); quickstart Q10.

### Implementation for User Story 5

- [X] T038 [US5] Run T037. No production change is expected (R-08). If a history entry is added anywhere, fix the offending call: only a screen change may push, and the current-tool nav link keeps `data-sveltekit-replacestate`.

**Checkpoint**: All user stories are independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T039 [P] Run `pnpm check`, `pnpm lint` (theory and links purity boundaries) and the formatter; fix findings.
- [X] T040 [P] Run the full `pnpm test:unit` and confirm the theory coverage gate is ≥ 95 % and every existing TM-4.2, TM-4.3, TM-5.5 and NFR-9.3 suite is still green with no TM-9 snapshot change.
- [X] T041 Run `pnpm build:test && pnpm test:e2e` on the phone 360 px, phone-touch and desktop projects, with axe at zero violations (SC-006), and the `nojs` project (nav links still navigate, no carry).
- [X] T042 Check the initial JS bundle stays ≤ 80 KB gzip (this feature adds about 1 KB).
- [X] T043 Walk through quickstart.md Q1–Q12 manually and tick them off.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none. T002 and T003 can run alongside T001.
- **Foundational (Phase 2)**: needs T001 for catalog keys. T004–T006 (tests) first, then T007 → T008, T009 and T010 [P], then T011. Blocks all stories.
- **US1 (Phase 3)**: needs Phase 2. **US2 (Phase 4)**: needs Phase 2, independent of US1. **US3 (Phase 5)**: needs Phase 2; touches `NotesTool.svelte` like US1 (T018 vs T030), so sequence those two edits. **US4 (Phase 6)**: needs T011. **US5 (Phase 7)**: needs US2 and US3 for the shortcuts it exercises.
- **Polish (Phase 8)**: after all wanted stories.

### Story dependencies

- US1: no dependency on other stories.
- US2: none. It shares `links-store.test.ts` with US1, US3 and US4, so edits to that file are sequential.
- US3: none, but it edits `NotesTool.svelte` after T018.
- US4: none.
- US5: verification of the others.

### Within each story

Tests are written and seen failing first, then the model/state change, then the component, then wiring, then the run-and-fix task.

## Parallel Opportunities

- Phase 1: T002, T003 with T001.
- Phase 2 tests: T004, T005, T006 together. Then T009 and T010 together after T008.
- US1 tests: T012, T013, T014, T015 together (T014 and T015 touch different files from T012 and T013).
- After Phase 2, US1, US2 and US4 can go to different developers. Within each story the [P] test tasks run together.

```bash
# Example: Phase 2 tests together
Task: "Write tests/unit/theory/triad-detect.test.ts (D1–D7 + 288-row table)"
Task: "Write tests/unit/theory/triad-detect.property.test.ts (fast-check)"
Task: "Write tests/unit/state/links.test.ts (L1–L11)"

# Example: US1 tests together
Task: "tests/unit/notes/detected-triad.test.ts"
Task: "Notes model detected tests"
Task: "viewAsTriad store tests"
Task: "e2e US1 flows in e2e/linked-tools.spec.ts"
```

## Implementation Strategy

### MVP first (US1)

1. Phase 1 Setup, then Phase 2 Foundational.
2. Phase 3 (US1). **Stop and validate** with quickstart Q1–Q3. Demo.

### Incremental delivery

1. Setup + Foundational.
2. US1 (detect + View as triad), the MVP.
3. US2 (nav carry both ways), the core promise.
4. US3 (position-card shortcut), US4 (session and reset, plus the failure-view fix), US5 (history guarantee).
5. Polish.

## Notes

- Tools must never import `$lib/theory/*`; detection reaches them only through `NotesDisplay.detected`.
- `NOTES_PRIMARY_CHOICE` is a single constant; the accidental-preference slice (FR-8.6) will replace it.
- **CAGED in this key** is out of scope (004-caged/006).
- Commit per task or logical group, in Conventional Commits format.
