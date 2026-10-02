# Research: Linked Tools (008)

Phase 0 output for [plan.md](./plan.md). Every Technical Context unknown is resolved below.
Each entry gives the decision, the rationale, and the alternatives considered.

Inputs read: [spec.md](./spec.md) (with its Clarifications), `.specify/memory/constitution.md`
v1.2.0, `src/lib/state/{notes-view,notes.svelte,notes-model,triads-view,triads.svelte,triads-model}.ts`,
`src/lib/theory/{pitch,triad}.ts`, `src/lib/notation/notation.ts`,
`src/lib/shell/{AppNav,ToolLayout,FailureView,ToolCard,HomeScreen}.svelte`,
`src/lib/tools/notes/{NotesTool,PositionCard}.svelte`, `eslint.config.js`, and
`specs/autonomous/breakdown/002-triads-across-the-neck/003-linked-tools.md`.

---

## R-01 — How a carry-over is triggered (FR-006)

**Decision**: Apply the carry-over **synchronously in the click handler** of the control that
the user activates, *before* SvelteKit navigates. The triggers are:

- the tool links of the persistent navigation (`src/lib/shell/AppNav.svelte`), but only for a
  plain primary click (no Ctrl/Meta/Shift/Alt, `button === 0`) on a tool other than the
  current one;
- the two Notes shortcuts (**View as triad**, **Triads from this note**), which are buttons
  that apply the carry and then call `goto(resolve('/triads'))`.

The carry is a call to one orchestrator, `linkTools(from, to)` in
`src/lib/state/links.svelte.ts` (see [contracts/links-api.md](./contracts/links-api.md)). It
mutates the destination store, which is a module singleton. The destination therefore renders
the carried context on its **first** render (FR-017, SC-005).

**Rationale**:

- Back/Forward, home-screen cards (`ToolCard.svelte`, plain `href`), typed or reloaded URLs and
  deep links never run this handler. FR-006 therefore holds by construction, with no "where
  did I come from" bookkeeping.
- No URL state is added. A reload still opens the tool in its initial state (FR-012), and
  share-link work (Principle IX) is not pre-empted.
- A modified click opens a new tab, which is a separate page load with its own fresh stores.
  Applying the carry in the current tab would silently change a tool the user did not open,
  so modified clicks are skipped.
- Without JavaScript (the `nojs` Playwright project), the links still navigate and no carry
  happens, which is the correct degradation.

**Alternatives considered**:

- *Query parameter (`/triads?root=9`)*: rejected. A reload or a shared URL would re-apply the
  carry (violates FR-006 and FR-012), and it creates an unversioned link format, which
  Principle IX forbids.
- *`beforeNavigate` / `afterNavigate` with `navigation.type === 'link'`*: rejected. A
  home-screen card and the nav link are both `type: 'link'`, so it cannot tell them apart
  without tagging anchors anyway. It also runs after the decision point, which makes
  first-render guarantees harder.
- *A pending "intent" read by the destination's `onMount`*: rejected. It renders once without
  the context (FR-017) and leaves stale intents after Back.

## R-02 — Triad detection algorithm (FR-009, TM-4.5, SC-002)

**Decision**: Add the pure function `detectTriad(selection)` in a new module
`src/lib/theory/triad-detect.ts`. It returns `{ rootPc, quality } | null`.

- It returns `null` unless `selection.length === 3` and the three values are distinct
  integers in 0..11.
- Candidate roots are tried **in selection order**. For each candidate root `r`, it computes
  the set `{(x − r) mod 12}` of the other two notes and matches it against
  `QUALITY_INTERVALS` in `QUALITIES` order. The first match wins.
- Because candidates are tried in selection order, the augmented root (any of the three
  notes fits) is the first-selected note. Major, minor and diminished have exactly one
  matching root, so selection order cannot change the result.

**Rationale**:

- It reuses the existing `QUALITY_INTERVALS` table, so the detector and the speller cannot
  disagree about what a quality is.
- It lives in `src/lib/theory`, so it inherits the theory purity lint (Principle III) and the
  theory coverage gate (≥ 95 %).
- It is O(9) per call. It is cheap enough to run on every selection change inside the
  `$derived` display model.

**Alternatives considered**:

- *Lookup table of 48 pitch-class sets*: rejected. It duplicates `QUALITY_INTERVALS` and still
  needs order logic for augmented.
- *Detection in `notes-model.ts`*: rejected. It is theory and must be tested and
  lint-guarded as theory (Principle I/III).

**Tests (Principle I/IV, written first)**:

- `tests/unit/theory/triad-detect.test.ts`: the full SC-002 table, which is 12 roots × 4
  qualities × 6 selection orders = 288 rows, each checked against the expected root and
  quality. It also covers the four breakdown examples (C–E–G, G♯–C–E, E–G♯–C, C–D–E) and the
  non-three cases (0, 1, 2, 4 notes).
- `tests/unit/theory/triad-detect.property.test.ts` (fast-check) checks three properties:
  - `detectTriad(spellTriad(r, q).pitchClasses permuted)` returns quality `q` and root `r`
    (augmented: the first element);
  - any 3-set that `detectTriad` accepts round-trips through `spellTriad`;
  - a random 3-set that matches no interval pattern returns `null`.
- All existing TM-4.x / NFR-9.3 suites must stay green.

## R-03 — Spelling of carried and detected roots (FR-001, FR-008)

**Decision**:

- **Single-note carry** (Notes → Triads, **Triads from this note**): carry the pitch class
  only. In Triads this is `selectRoot` semantics: `spellingOverride: 'none'` and
  `occurrence: 0`, so the root takes the TM-4.3 default for the **kept** quality. If the
  pitch class equals the current root, the state is returned unchanged (same object), so a
  spelling the user switched survives (spec acceptance 2.9).
- **Detected triad** (name and **View as triad**): the root takes the Notes primary
  spelling. Today that is `defaultSpelling(pc)` from `src/lib/notation`, which uses sharps.
  - In Triads this maps to `spellingOverride: 'sharp'` for an altered root and `'none'` for a
    natural root.
  - The mapping is one constant, `NOTES_PRIMARY_CHOICE = 'sharp'`, in `src/lib/state/links.ts`.
    The accidental-preference slice (FR-8.6) will replace this constant with the preference
    value.
  - `spellTriad` then spells the third and fifth by TM-4.1, so G♯ augmented reads
    G♯–B♯–D𝄪 and C♯ major reads C♯–E♯–G♯.

**Rationale**: these rules follow the Clarifications Q1 and Q2 exactly. `spellingOverride`
already expresses "explicit root spelling", so no new state field is needed (Principle X).

**Alternatives considered**:

- *Store an explicit `rootSpelling: Spelling` in Triads*: rejected. It duplicates
  `spellingOverride` and adds an invalid-state space (a spelling whose pitch class differs
  from `rootPc`).
- *Use TM-4.3 for the detected triad too*: rejected by Clarification Q2 (breakdown: "G♯, C, E
  → G♯ augmented").

## R-04 — Triads → Notes payload (FR-002)

**Decision**: Use `QUALITY_INTERVALS` to compute
`[rootPc, (rootPc + third) mod 12, (rootPc + fifth) mod 12]`. This is equivalent to
`spellTriad(...).pitchClasses`, but it does not depend on the spelling. The result replaces
`NotesViewState.selection` and nothing else.

- Compare state is ignored: only `state.quality` is used, never `compare.quality`.
- If the new selection equals the current one (same order), the state is returned unchanged
  (same object).
- Card, filters, label type, background and hide-names are kept (FR-005). EC-4.4 guidance
  appears through the existing `missing` notice when the carried notes fall outside the
  filters.

**Rationale**: The root comes first, so an augmented triad round-trips to the same root
through **View as triad** (acceptance 2.8). Notes re-spells with its own rules (FR-4.12),
which is the accepted D♭ → C♯ round trip.

**Alternatives considered**: *Merge the triad notes into the existing selection*. Rejected,
because the spec says to replace the selection.

## R-05 — Applying a detected triad in Triads when Compare is on (FR-008 × FR-018 of 007)

**Decision**: `carryTriad` applies the root first (`selectRoot` + spelling override) and then
the quality, **with the same swap rule as `setQuality`**. If Compare is on and the incoming
quality equals the comparison quality, the two swap, and the store raises the existing
`compare-swapped` notice ("adjust and tell", Principle X).

- Inversion, string set, view, label type and the Compare on/off flag are kept.
- `occurrence` resets to 0 when the root or the quality changes, as a normal change does.
- If root, spelling and quality all already match, the result is a same-object no-op.

**Rationale**: It keeps the 007 invariant `compare.on ⇒ compare.quality ≠ quality` without
inventing a second rule.

**Alternatives considered**: *Turn Compare off on carry*. Rejected, because FR-005 says to keep
everything that is not carried.

## R-06 — Where the detection is surfaced (FR-008, FR-010, FR-016; constitution III/VII)

**Decision**:

- `NotesDisplay` gains `detected: DetectedTriad | null`. `buildNotesModel` computes it from
  `detectTriad(view.selection)`. Tools may not import `$lib/theory/*` (ESLint boundary), so
  the display model is the only path for the result.
- A new component, `src/lib/tools/notes/DetectedTriad.svelte`, renders inside Notes zone **B**
  under `NoteSelector`. It holds:
  - a text line: the visible name "G♯ augmented", built from the catalog message
    `notes_triad_name({ root, quality })`, with a visually hidden spoken twin "G sharp
    augmented";
  - a **View as triad** button (`aria-describedby` → the name).
- It renders nothing when `detected === null`, with no message (FR-010). It ignores
  `hideNames`, which follows Clarification Q7.
- `describe()` in `notes-model.ts` appends `notes_desc_triad({ name })` with the spoken name
  when a triad is detected. The fretboard's existing polite live region then announces it.

**Rationale**: Zone B is a control zone, not the fretboard, so it follows "controls never
cover the fretboard" (VII). Reusing the fretboard's description keeps a single polite region
(Principle V).

**Alternatives considered**:

- *A Notice*: rejected. Notices are for guidance and are dismissible, but this is persistent
  state.
- *Overlay on the fretboard*: forbidden by VII.

## R-07 — Position card shortcut (FR-007)

**Decision**: `PositionCard.svelte` gains a third button, **Triads from this note**
(`notes_card_triads_from_note`), and a new prop `ontriads(pc)`. `NotesTool` wires it to
`openTriadsFromNote(pc)`, which calls `triads.carryRoot(pc)` and then
`goto(resolve('/triads'))`. **CAGED in this key** is out of scope.

**Rationale**: It reuses the same `carryRoot` transition as the nav carry (Principle X: two
real uses justify the shared function).

## R-08 — History behavior (FR-015, SC-003)

**Decision**: No new history mechanism.

- In-tool changes and carries never touch the URL. This is already true: tool state lives in
  stores, not in the URL.
- A nav link click is a normal SvelteKit push, which adds one entry. The current-tool link
  already uses `data-sveltekit-replacestate`.
- Shortcuts use `goto(resolve('/triads'))` with default push semantics, which adds one entry.
- **Reset tool** is a store call with no navigation.

Playwright verifies the behavior with `page.goBack()` counts after 20 mixed changes (SC-003),
and with Home → Notes → (carry) Triads → Back → Notes → Back → Home.

**Alternatives considered**: `replaceState` for shortcuts. Rejected, because Clarification Q10
asks for one entry per screen change.

## R-09 — Session memory and Reset tool (FR-012–FR-014, EC-1.3)

**Decision**:

- Session memory already exists: `notes` and `triads` are module-singleton stores that
  survive client navigation and reset on reload. This slice adds tests that **guarantee** it
  (store tests, plus e2e "leave and return").
- **Reset tool** already calls `reset(instrument)` / `resetTriads(instrument)`. Neither touches
  the instrument, locale or notation. Tests pin FR-014: the other store is untouched and the
  instrument is kept.
- **Gap found**: the failure view's **Reset tool** (`FailureView.svelte`, wired in
  `ToolLayout.svelte`) only re-mounts the boundary. It does not reset the tool's state, so a
  state that caused the failure would fail again. Fix: `ToolLayout` passes
  `() => { resetTool(tool); boundaryReset(); }`, where `resetTool` lives in
  `links.svelte.ts` and dispatches to `notes.reset()` / `triads.reset()`. This satisfies
  EC-1.3.

## R-10 — Performance (FR-017, SC-005, Principle VI)

**Decision**: No new budget work is needed.

- A carry is one pure transition (O(1)) plus the destination's existing `$derived` model
  rebuild, which already runs on any root change within the 100 ms control budget.
- `detectTriad` is O(9) per selection change.
- No new runtime dependency. The bundle grows by roughly 1 KB of gzip (detector, links and one
  component), well inside 80 KB.
- `e2e/perf.spec.ts` gets one measurement: nav-click Notes → Triads with a carry, under 300 ms
  to first carried render.

## R-11 — Import boundaries for the new modules (Principle III)

**Decision**:

- `src/lib/theory/triad-detect.ts` imports only `./pitch` and `./triad`.
- `src/lib/state/links.ts` is pure: it imports `theory`, `notes-view` and `triads-view`, and
  no Svelte, paraglide or DOM. The ESLint purity block for `notes-view.ts` is extended to
  cover it.
- `src/lib/state/links.svelte.ts` is the orchestrator. It imports `links.ts`,
  `notes.svelte`, `triads.svelte` and `$app/navigation` (`goto`), and `$app/paths`
  (`resolve`) for the shortcut path.
- `AppNav.svelte` (shell) imports `links.svelte`, which is allowed because shell may import
  state, as `StopButton` does with `playback`.
- `quality` crosses into tools only as the `Quality` type, re-exported from the state layer.
  Tools must not import theory, and type imports count for `no-restricted-imports`.

## R-12 — Architectural record

**Decision**: Add `docs/adr/0011-tool-links-carry-at-activation.md`. It records that carry-over
is applied at the activating control and never from the URL or history, and lists the
consequences for the future CAGED links (004-caged/006) and for share links.
