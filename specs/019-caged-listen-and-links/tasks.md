---

description: "Task list for 019 CAGED Listen and Links to Other Tools"
---

# Tasks: CAGED Listen and Links to Other Tools

**Input**: Design documents from `/specs/019-caged-listen-and-links/`

**Prerequisites**: plan.md, spec.md, research.md (R-01…R-16), data-model.md, contracts/caged-listen-api.md, contracts/caged-listen-ui.md, quickstart.md

**Tests**: INCLUDED. Constitution Principle IV (test-first) and plan.md require them. Write each test first and see it fail before the implementation.

**Organization**: Grouped by user story. US1 and US2 are P1 and US3 and US4 are P2. All paths are relative to the repository root.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1…US4, only in user-story phases

## Verification (local, constitution "Verification tiers")

- Per task: `pnpm vitest run <touched test paths>`.
- Per e2e checkpoint: `pnpm build:test` once after `src/` changes, then `pnpm test:e2e:fast <spec files>`.
- End of slice, once: `pnpm verify`.
- Never run `pnpm test:e2e` or `pnpm lhci` locally.

---

## Phase 1: Setup

**Purpose**: Constants and message keys that every later phase imports. No new directories are needed.

- [X] T001 Add to `src/lib/state/listen.ts`: `type Tempo = 'slow' | 'medium' | 'fast'`, `TEMPOS` (`['slow','medium','fast']`, UI order), `DEFAULT_TEMPO = 'medium'`, `TEMPO_BPM = { slow: 80, medium: 120, fast: 180 }`, `STRUM_GAP_MS = 250`, `BLOCK_DELAY_MS = 500`, `SHAPE_GAP_MS = 1500`, `RING_MS = 1500`, and `isTempo(x: unknown): x is Tempo`. Keep `LISTEN_BPM = 120`.
- [X] T002 [P] Add a test in `tests/unit/state/listen.test.ts` (create it if absent) asserting `TEMPO_BPM.medium === LISTEN_BPM`, that `RING_MS` equals `NOTE_MS` from `src/lib/audio/schedule.ts`, and that `isTempo` accepts only the three values.
- [X] T003 [P] Add the 12 message keys to `messages/en.json`: `caged_listen` "Listen", `caged_listen_reason_no_shapes`, `caged_listen_reason_no_fit`, `caged_listen_playing_layer` "Playing: {layer}, {shape} shape", `caged_listen_playing_all` "Playing every shape", `caged_tempo_label` "Tempo", `caged_tempo_slow`, `caged_tempo_medium`, `caged_tempo_fast`, `notes_card_caged` "CAGED in this key", `triads_view_in_caged` "View in CAGED", `triads_view_in_caged_unavailable` "CAGED covers major and minor chords". Accidentals stay ♯ ♭ 𝄪 𝄫. `tests/unit/no-raw-text.test.ts` must still pass.
- [X] T004 [P] Add the `--disabled-opacity` token to `src/lib/styles/tokens.css` (a reduced-opacity value used with the existing `--color-disabled-*` tokens).

---

## Phase 2: Foundational (blocks every user story)

**Purpose**: The audio `timeline` kind, the pure planner and `display.listen`.

**⚠️ CRITICAL**: No story work starts until this phase is complete.

### Audio `timeline` request (R-01)

- [X] T005 [P] Write failing tests in `tests/unit/audio/schedule.test.ts` for `planRequest({kind:'timeline', events})`:
  - One `PlannedStep` per surviving event, with its own onset and duration.
  - Onset clamped to `0…MAX_TIMELINE_MS` and duration clamped to `1…MAX_TIMELINE_MS`, where `MAX_TIMELINE_MS = 60_000`.
  - An event with a non-finite onset or duration is dropped.
  - Invalid or duplicate positions inside an event are dropped (`validUnique`), and an event left empty is dropped.
  - `note`, `chord` and `sequence` plans are unchanged.
- [X] T006 [P] Write failing tests in `tests/unit/audio/engine.test.ts` with the fake clock and port:
  - A `timeline` request sets the sequence flag (`onSequenceChange(true)` and then `false` at the end).
  - Stop, a new request and a hidden page interrupt it.
  - Pulses fire per mark.
  - The log entry carries `kind: 'timeline'`.
  - Notes ring past the next onset (not cut).
- [X] T007 Add `TimedStep { positions; onsetMs; durationMs }`, the `{ kind: 'timeline'; events }` member of `PlaybackRequest`, and `'timeline'` for `Plan.kind` and `AudioLogEntry.step.kind` in `src/lib/audio/types.ts`. Export `MAX_TIMELINE_MS = 60_000` from `src/lib/audio/schedule.ts` (or types, per the contract).
- [X] T008 Implement the `timeline` branch of `planRequest` in `src/lib/audio/schedule.ts` per T005 (never throws).
- [X] T009 Set `ActiveRequest.sequence` true for `sequence` and `timeline` in `src/lib/audio/engine.ts`, so `sequencePlaying` and the Stop button apply. Make T006 pass.
- [X] T010 [P] Write a failing test in `tests/unit/state/playback.test.ts` for `playback.timeline(events, instrument)`: it is gesture-only like `sequence` and marks unlocked. Then implement `timeline()` in `src/lib/state/playback.svelte.ts`.

### Planner `state/caged-listen.ts` (R-02…R-07), pure

- [X] T011 Write failing tests in `tests/unit/state/caged-listen.test.ts` (new file). Tables use C, G and A♯ keys; E, A and C shapes; open position; Drop D; 7-string; Half step down; temporary standard view. Property tests use fast-check across keys, qualities, shapes, fret counts 12–24 and generated compatible tunings.
  - `listenSource` order `LISTEN_ORDER = ['scale','pentatonic','arpeggio','triad','chord']`.
    - No focus gives `all-chords`.
    - Triad on with no triad gives `chord`.
    - Chord plays even when the Chord switch is off.
  - `listenRegion` is the highlighted positions filtered by layer degrees (**P-2**: equals `layerNotes(...).filter(inLayer)` as `string:fret` sets).
  - `dedupeUnisons` keeps the first position per pitch, which is the thicker string (**P-3**).
  - `melodicSteps`:
    - Arpeggio is `d[0…n−1]` then `d[n−2…0]`, 2n−1 steps, top once (**P-1**).
    - Pentatonic and scale run from the lowest root index `r`: `d[r…n−1]` then `d[n−2…r]` (**P-4**).
    - A region with no root uses `r = 0`.
  - `chordPositions`:
    - `string ≤ 6`, and not string 6 when `alteredString`.
    - Sorted by pitch ascending, ties to the higher string number (**P-5**).
  - `strumEvents`:
    - Strum `i` has onset `t0 + 250·i` and duration 1500.
    - The block is at `t0 + 250·(k−1) + 500`, duration 1500, with all positions.
    - With no focus, the next shape starts at the previous block onset + 1500.
  - Triad plan: `[low, mid, high, [low, mid, high]]` at `LISTEN_BPM`.
  - **P-6**: every pitch equals the effective instrument's open pitch plus the fret.
  - `buildCagedListen` returns `{kind:'none'}` when `occurrences` is empty.
- [X] T012 Implement `src/lib/state/caged-listen.ts` (new, pure; no Svelte, DOM, paraglide or `audio/` import). Export `LISTEN_ORDER`, `ListenLayer`, `ListenSource`, `RegionNote`, `CagedListenInput`, `CagedListenPlan`, `listenSource`, `listenRegion`, `dedupeUnisons`, `melodicSteps`, `chordPositions`, `strumEvents` and `buildCagedListen` per data-model §3–§4. Re-declare `TimedStep` structurally. Make T011 pass.
- [X] T013 [P] Write failing tests in `tests/unit/state/caged-model.test.ts` for `CagedDisplay.listen = { enabled, reason, source }`:
  - `enabled ⇔ occurrences.length > 0`.
  - `reason` is `caged_listen_reason_no_shapes` for a non-compatible tuning without the temporary view, and `caged_listen_reason_no_fit` when no shape fits the fret count.
  - `source` comes from `listenSource`.
  - Pitches come from the effective instrument (temporary standard tuning while active).
- [X] T014 Add `listen` to `CagedDisplay` in `src/lib/state/caged-model.ts`. Make T013 pass.

**Checkpoint**: `pnpm vitest run tests/unit/audio tests/unit/state/listen.test.ts tests/unit/state/caged-listen.test.ts tests/unit/state/caged-model.test.ts tests/unit/state/playback.test.ts tests/unit/no-raw-text.test.ts` is green.

---

## Phase 3: User Story 1 - Hear the focused shape (P1) 🎯 MVP

**Goal**: Listen plays the widest layer on, with pulses (also muted).

**Independent Test**: Focus the E shape with only Chord on and press Listen, then repeat with Triad, Arpeggio, Scale, Pentatonic, Scale + Pentatonic and no focus. Check the audio log order and timing.

### Tests for US1 (write first)

- [X] T015 [P] [US1] Write failing tests in `tests/unit/state/caged-store.test.ts` for `caged.listen()` and `caged.listening`:
  - `none` is a no-op.
  - `sequence` goes to `playback.sequence` and `timeline` goes to `playback.timeline`.
  - `listening` holds the `ListenSource` only while `playback.sequencePlaying`, otherwise `null`.
  - Listen pressed again restarts from the beginning (interrupt).
- [X] T016 [P] [US1] Write failing component tests in `tests/unit/caged/caged-tool.test.ts` for the Listen button:
  - It renders `caged_listen`.
  - When disabled it has `aria-disabled="true"`, stays focusable and has `aria-describedby` pointing at the visible reason.
  - The `role="status"` text is `caged_listen_playing_layer` or `caged_listen_playing_all` while playing, and empty otherwise.
- [X] T017 [P] [US1] Write `e2e/caged-listen.spec.ts` (new file) for US1 via `window.__fmAudioLog` and `page.clock`:
  - Chord-only is a `timeline` with deltas of 250 ms between strum notes and 500 ms to the block, and the block entry has all chord pitches.
  - Triad is a `sequence` with 500 ms deltas and 4 steps, the last with 3 pitches.
  - Arpeggio goes up and back with the top note once.
  - Scale starts and ends on the region's lowest root.
  - Pentatonic + Scale plays the scale.
  - No focus plays every occurrence nut→body with a 1500 ms shape gap.
  - `[data-pulse]` appears per note, also when muted.
  - A non-compatible tuning disables Listen with the visible reason, and the temporary standard view plays standard-tuning pitches.

### Implementation for US1

- [X] T018 [US1] Implement `listen()` and the `listening` getter in `src/lib/state/caged.svelte.ts`. `listen()` builds `CagedListenInput` from the display, the focused occurrence, `selectedTriad` and the effective instrument's open pitches, plus `tempo`. Make T015 pass.
- [X] T019 [US1] Create `src/lib/tools/caged/CagedListen.svelte`: the Listen button (`aria-disabled` + `aria-describedby` to the reason, focusable, ≥ 44×44 px) and the polite `role="status"` text. All text comes from catalog keys.
- [X] T020 [US1] Mount `CagedListen` in `src/lib/tools/caged/CagedTool.svelte` beside the focus controls, outside the fretboard, visible in every CAGED state. Make T016 pass.
- [X] T021 [US1] Verify the pulse path: Listen marks drive `applyPulses` with the existing highlighted state, and the muted path pulses identically. Fix only if the T017 pulse assertions fail.

**Checkpoint**: run T015, T016 and T017 with `pnpm vitest run` and `pnpm build:test && pnpm test:e2e:fast e2e/caged-listen.spec.ts`. US1 works on its own, at the default Medium tempo.

---

## Phase 4: User Story 2 - Control playback (P1)

**Goal**: Tempo, Stop and the stop matrix.

**Independent Test**: Start a Scale sequence and press Stop. Start another and change key, layer, focus and tool. Change tempo and replay. Reload to check the tempo is remembered.

### Tests for US2 (write first)

- [X] T022 [P] [US2] Add fixtures `tests/unit/prefs/fixtures/tempo-fast.txt` (`{"version":1,…,"tempo":"fast"}`) and `tests/unit/prefs/fixtures/bad-tempo.txt` (`"tempo":"allegro"`) and register them in `tests/unit/prefs/fixtures/index.ts`. Existing fixtures are never edited.
- [X] T023 [P] [US2] Write failing tests in `tests/unit/prefs/schema.test.ts`:
  - `tempo` parses with `v.fallback(v.picklist(TEMPOS), 'medium')`.
  - An absent or invalid value gives `medium` and leaves the other fields unaffected.
  - `serializePreferences` writes `tempo` only when not `medium`, after `rotateHint`.
  - `PREFS_VERSION === 1`.
  - Every existing fixture re-serializes byte-identically.
  - `tempo-fast` round-trips and `bad-tempo` gives `medium`.
- [X] T024 [P] [US2] Write failing tests in `tests/unit/state/caged-store.test.ts` for the **stop matrix (R-09)** with the fake engine:
  - Focus changes (tag, shape selector, See all, Next/Previous, auto-focus), layer switch, Triad string set and tempo stop a playing *sequence* only.
  - A tapped single note (kind `note`) survives focus and layer changes.
  - Key, quality, spelling and reset stop any playback.
  - Label type and Show connections never stop.
  - Instrument/tuning and the temporary view stop (`stop('instrument')`).
  - `setTempo` ignores invalid and equal values and calls `preferences.remember({ tempo })`.
  - `restoreTempo` validates and neither stops nor writes.
  - Erase restores `medium`.
- [X] T025 [P] [US2] Write failing component tests in `tests/unit/caged/caged-tool.test.ts` for the Tempo radiogroup:
  - It is labelled `caged_tempo_label` and offers Slow, Medium and Fast.
  - Arrow keys move the selection.
  - Medium is selected by default.
- [X] T026 [P] [US2] Extend `e2e/caged-listen.spec.ts` for US2:
  - Stop button: sound and pulses end, a `stop` log entry is written, and focus moves to the mute control.
  - Matrix: key, quality, spelling, tag, Next, layer, Triad set, tempo, tuning and tool each stop playback. Label type and Show connections do not (no `stop` log entry).
  - Tempo deltas: 750 ms for slow, 500 ms for medium, about 333 ms for fast, on Arpeggio and Scale only. Chord and Triad timing is unchanged.
  - Tempo changed mid-sequence stops playback.
  - Listen twice restarts.
  - `visibilitychange` gives `stop` with reason `hidden` and no resume.
  - A single tapped note survives focus and layer changes.
- [X] T027 [P] [US2] Extend `e2e/preferences.spec.ts`: reload restores Fast and "Erase preferences" returns it to Medium. The stored record has a `tempo` key only for slow or fast.

### Implementation for US2

- [X] T028 [US2] Add `tempo` to `Preferences` and `DEFAULT_PREFERENCES.tempo = 'medium'`, then implement the parse and serialize in `src/lib/prefs/schema.ts`. Make T023 pass.
- [X] T029 [US2] Add the `tempo` `$state`, `setTempo` and `restoreTempo` to `src/lib/state/caged.svelte.ts`.
- [X] T030 [US2] Call `caged.restoreTempo(p.tempo)` from `preferences.start()` and `erase()` in `src/lib/state/preferences.svelte.ts`.
- [X] T031 [US2] In `src/lib/state/caged.svelte.ts` add private `stopListen()` (`if (playback.sequencePlaying) playback.stop('view')`). Call it from `commitFocus`, `toggleLayer`, `selectTriadSet` and `setTempo`. Change `setLabelType` to bypass the stop in `apply()`. Make T024 pass.
- [X] T032 [US2] Add the Tempo `ChoiceGroup` (radiogroup `caged_tempo_label`; options Slow, Medium and Fast) to `src/lib/tools/caged/CagedListen.svelte`. Make T025 pass.
- [X] T033 [US2] Confirm the existing app-bar `src/lib/shell/StopButton.svelte` appears for `timeline` (via `sequencePlaying`) and needs no change. Fix only if T026 fails.

**Checkpoint**: run T022–T027. US1 and US2 both work on their own.

---

## Phase 5: User Story 3 - Carry key and chord between tools (P2)

**Goal**: Notes ↔ CAGED and Triads ↔ CAGED carry on a user tool switch only.

**Independent Test**: Make each hand-off and check the destination for all 12 roots × 2 qualities, plus dim/aug origins.

### Tests for US3 (write first)

- [X] T034 [P] [US3] Write failing tables in `tests/unit/state/links.test.ts` (SC-005):
  - `carryFromCaged` gives `{kind:'notes', selection:[root, third, fifth]}` for 12 roots × 2 qualities.
  - `carryTriadsToCaged` keeps root, quality and spelling override for major and minor, and gives root, `major` and `'none'` for diminished and augmented.
  - `carryIntoCaged` sets root, spelling and quality, and returns the same object when all are equal.
  - `cagedCanShow` is true only for major and minor.
  - The Notes → CAGED carry is `{ rootPc, quality: caged.quality, spelling: 'none' }`.
- [X] T035 [P] [US3] Write failing tests in `tests/unit/state/links-store.test.ts`:
  - `linkTools` handles the four CAGED pairs. Notes with exactly one note carries, and zero or two or more do not. Notes ↔ Triads is unchanged.
  - Carry happens only in the handler and never from URL, history or storage.
  - A carry equal to the current key is a no-op that keeps spelling and focus.
  - Focus is re-resolved after the carry: the same letter's nearest occurrence is kept, and focus is cleared only when that letter has no occurrence.
  - A carry stops playback.
  - CAGED → Triads uses `triads.carryTriad` and keeps inversion, string set, view and Compare.
  - A carried A♯ major is accepted and offers the "Switch to B♭" guidance.
- [X] T036 [P] [US3] Extend `e2e/linked-tools.spec.ts` with the plain primary click on a nav link for each hand-off:
  - Notes (B♭ only) → CAGED B♭ with the previous quality.
  - CAGED A minor → Notes with A, C and E selected.
  - Triads B diminished → CAGED B major.
  - CAGED D major → Triads D major with inversion and set unchanged.
  - Notes with two notes → CAGED as left.
  - Reload, Back/Forward and deep links never carry.
  - A♯ major shows 𝄪 where needed and the "Switch to B♭" guidance.

### Implementation for US3

- [X] T037 [US3] Add the `CagedCarry` type, `carryFromCaged`, `carryTriadsToCaged`, `carryIntoCaged`, `cagedCanShow` and `cagedTriadCarry` to `src/lib/state/links.ts`, pure. Make T034 pass.
- [X] T038 [US3] Add `carry(k: CagedCarry)` to `src/lib/state/caged.svelte.ts` as `apply(withResolvedFocus(carryIntoCaged(view, k)))`.
- [X] T039 [US3] In `src/lib/state/links.svelte.ts` drop the `from === 'caged' || to === 'caged'` guard in `linkTools` and add the four CAGED pairs, leaving Notes ↔ Triads unchanged. Make T035 pass.

**Checkpoint**: run `pnpm vitest run tests/unit/state/links.test.ts tests/unit/state/links-store.test.ts` and `pnpm test:e2e:fast e2e/linked-tools.spec.ts`.

---

## Phase 6: User Story 4 - Shortcuts (P2)

**Goal**: **CAGED in this key** and **View in CAGED**, including the disabled state.

**Independent Test**: Use each shortcut and check the destination and the history entry count. Check the diminished and augmented disabled state.

### Tests for US4 (write first)

- [X] T040 [P] [US4] Write failing tests in `tests/unit/state/caged-store.test.ts` for `showTriadLayer()`:
  - Triad off: it toggles the layer on, auto-focuses the occurrence nearest the nut if there is no focus, and sets `defaultTriadSet`.
  - Triad already on: it sets `defaultTriadSet` and focuses index 0 when there is no focus.
  - An existing focus is kept after re-resolution.
  - In a non-compatible tuning it is a no-op.
  - Other layers keep their state.
- [X] T041 [P] [US4] Write failing tests in `tests/unit/state/links-store.test.ts`:
  - `openCagedFromNote(pc)` carries the position card's pitch class with quality unchanged and leaves Notes unchanged. It does one `goto('/caged')`, and when the pitch class equals the current key there is no key change.
  - `openCagedFromTriads()` carries, calls `showTriadLayer`, does one `goto`, and is a no-op for diminished and augmented.
- [X] T042 [P] [US4] Write failing tests in `tests/unit/state/triads-model.test.ts` for `display.viewInCaged.enabled` (true only for major and minor).
- [X] T043 [P] [US4] Write failing component tests:
  - `tests/unit/notes/` position card: **CAGED in this key** is rendered after "Triads from this note" and calls `oncaged`.
  - `tests/unit/triads/` secondary row: **View in CAGED** is enabled for major and minor. For diminished and augmented it has `aria-disabled="true"`, stays focusable, ignores activation and has `aria-describedby` pointing at the visible `triads_view_in_caged_unavailable` note.
- [X] T044 [P] [US4] Extend `e2e/linked-tools.spec.ts`:
  - Notes position card on a G → **CAGED in this key** → CAGED in G, and Back returns to Notes in one step.
  - Triads B♭ minor → **View in CAGED** → CAGED B♭ minor, Triad layer on and a shape focused.
  - Triads C augmented (and B diminished) → the button is focusable and does nothing, with the note visible.
  - axe is clean on the Notes position card, and on Triads with View in CAGED enabled and disabled, at phone and desktop in both themes.

### Implementation for US4

- [X] T045 [US4] Add `showTriadLayer()` to `src/lib/state/caged.svelte.ts` (R-12). Make T040 pass.
- [X] T046 [US4] Add `openCagedFromNote` and `openCagedFromTriads` to `src/lib/state/links.svelte.ts`, each doing one `goto(resolve('/caged'))` (one history entry). Make T041 pass.
- [X] T047 [P] [US4] Add `display.viewInCaged: { enabled }` to `src/lib/state/triads-model.ts`, derived from `cagedCanShow(quality)`. Make T042 pass.
- [X] T048 [P] [US4] Add the `oncaged` prop and the **CAGED in this key** button (`notes_card_caged`) after "Triads from this note" in `src/lib/tools/notes/PositionCard.svelte`. Wire it in `src/lib/tools/notes/NotesTool.svelte` to `openCagedFromNote`.
- [X] T049 [P] [US4] Add the **View in CAGED** button (`triads_view_in_caged`) after Listen in `src/lib/tools/triads/TriadsSecondary.svelte`, with the visible `triads_view_in_caged_unavailable` note, `aria-disabled` and `aria-describedby` when disabled, and styling from `--color-disabled-*` and `--disabled-opacity` plus the note (not colour alone). Wire it in `src/lib/tools/triads/TriadsTool.svelte` to `openCagedFromTriads`. Make T043 pass.

**Checkpoint**: all four stories pass their own tests.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T050 [P] Add a one-paragraph addendum on the `timeline` request kind to the Consequences of `docs/adr/0007-main-thread-karplus-strong-playback.md` (R-15).
- [X] T051 [P] Extend `e2e/caged-listen.spec.ts` with a keyboard and axe pass: Tab reaches Listen (also when disabled), Tempo, Stop, CAGED in this key and View in CAGED, and Enter/Space activate them. Check zero axe violations for Listen idle, playing and disabled at phone and desktop widths in both themes, with 44×44 px targets and wrapping at 320 px and 200 % zoom.
- [X] T052 Run `pnpm vitest run tests/unit/no-raw-text.test.ts`, which guards all 12 new keys.
- [X] T053 Walk through `specs/019-caged-listen-and-links/quickstart.md` §3 steps 1–15 manually with `pnpm dev`, and fix any divergence.
- [X] T054 Run all local gates once: `pnpm verify`. Check the initial JS stays ≤ 120 KB gzip (estimate +2–3 KB). If any screenshot was touched, regenerate it only with the scoped `--update-snapshots -g` command from CLAUDE.md. The full matrix and Lighthouse run in CI only.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (1)**: no dependencies. T002, T003 and T004 are parallel after T001, where T002 needs T001.
- **Foundational (2)**: depends on T001. It blocks every story.
- **US1 (3)** and **US2 (4)** are P1. US2 builds on US1's `CagedListen.svelte` and `caged.svelte.ts` (T032 edits the same component as T019), so run US1 first.
- **US3 (5)** is independent of US1 and US2, except that its stop-on-carry assertion uses the Foundational and US1 playback.
- **US4 (6)** needs T037–T039 (carry functions, `caged.carry` and the pairs) for T046 and T045.
- **Polish (7)**: after the stories you want.

### Within a story

- Tests first, and see them fail.
- Pure functions, then store, then components, then e2e.

### Same-file serialization

- `src/lib/state/caged.svelte.ts` is edited by T018, T029, T031, T038 and T045. Do these in order.
- `tests/unit/state/caged-store.test.ts` is edited by T015, T024 and T040.
- `tests/unit/state/links-store.test.ts` is edited by T035 and T041.
- `e2e/linked-tools.spec.ts` is edited by T036 and T044.
- `e2e/caged-listen.spec.ts` is edited by T017, T026 and T051.
- `src/lib/tools/caged/CagedListen.svelte` is edited by T019 and T032.
- `src/lib/state/links.svelte.ts` is edited by T039 and T046.

## Parallel Examples

```text
Phase 1:  T002, T003, T004 together
Phase 2:  T005, T006, T010, T013 (tests) together; T011 before T012
US1:      T015, T016, T017 together
US2:      T022, T023, T024, T025, T026, T027 together
US3:      T034, T035, T036 together
US4:      T040–T044 together; then T047, T048, T049 together
Polish:   T050, T051 together
```

## Implementation Strategy

### MVP first (US1)

1. Phases 1 and 2.
2. US1, then stop and validate: Listen plays every layer at Medium tempo with pulses.
3. Add US2 before shipping anything user-facing (Stop and the stop matrix make sequences usable).

### Incremental delivery

1. Foundation, then US1, then US2 (P1 complete).
2. US3, then US4 (P2).
3. Polish and one `pnpm verify`.

## Notes

- The spec changes earlier slices' behaviour in two ways: focus, layer and Triad-set changes now stop a playing Listen sequence, and the label type no longer stops playback. See plan.md Complexity Tracking.
- Notes and Triads playback must stay byte-identical, and the existing tests are not edited.
- `state/` imports `audio/` only in `playback.svelte.ts`.
- Commit per task or logical group on `019-caged-listen-and-links` using Conventional Commits.
