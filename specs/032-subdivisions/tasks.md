# Tasks: Subdivisions

**Input**: Design documents from `/specs/032-subdivisions/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (click-engine-api, metronome-store-api, metronome-ui), quickstart.md

**Tests**: Included. The constitution (IV) requires test-first for logic and tested behaviour for UI, and quickstart §1–2 lists the cases. Write each test task first and confirm it fails before the matching implementation task.

**Organization**: Grouped by user story. US1 (hear subdivisions) and US2 (dropdown) are both P1; US3 (exactness at speed, Pause/Resume) is P2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1, US2, US3
- Verification per CLAUDE.md: `pnpm vitest run <paths>` per task; `pnpm build:test` once then `pnpm test:e2e:fast <specs>` for e2e; `pnpm verify` once at the end. Component/DOM unit tests start with `// @vitest-environment jsdom`.

## Path Conventions

Single SvelteKit project: `src/lib/audio`, `src/lib/state`, `src/lib/tools/metronome`, `messages/`, `tests/unit/`, `e2e/`, `docs/`.

---

## Phase 1: Setup

**Purpose**: Confirm the 031 baseline before changing it.

- [X] T001 Run `pnpm vitest run tests/unit/audio tests/unit/metronome tests/unit/i18n` and confirm the 031 baseline is green; read `src/lib/audio/click.ts`, `src/lib/audio/metronome.ts`, `src/lib/audio/types.ts`, `src/lib/state/metronome.svelte.ts` and `src/lib/tools/metronome/*.svelte` to learn the existing shapes (no edits).

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: The `Subdivision` type, translated names and message keys that every story uses.

**⚠️ CRITICAL**: No story work starts until this phase is complete.

- [X] T002 [P] Write failing tests in `tests/unit/metronome/settings.test.ts`: `toSubdivision` returns the integer for `3` and `'5'`, and `null` for `0`, `9`, `2.5`, `NaN`, `''`, `'x'`, `null`, `undefined` (never throws); `SUBDIVISIONS` equals `[1,2,3,4,5,6,7,8]`; `DEFAULT_SUBDIVISION` is `3`; `DEFAULT_SETTINGS` equals `{ bpm: 85, beats: 4, subdivision: 3 }` and is frozen.
- [X] T003 Edit `src/lib/state/metronome-settings.ts`: add `type Subdivision = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8`, `SUBDIVISIONS`, `DEFAULT_SUBDIVISION = 3`, `toSubdivision(v: unknown): Subdivision | null` (accepts a number or numeric string that is one of the eight, otherwise `null`), add `subdivision: Subdivision` to `MetronomeSettings` and `DEFAULT_SETTINGS`, and narrow `SettingField` to `'bpm' | 'beats'`. Fix any compile errors in callers. Make T002 pass.
- [X] T004 [P] Add the 11 new keys to `messages/en.json`, `messages/pt-BR.json` and `messages/es.json` exactly as in `contracts/metronome-ui.md` §4: `metronome_subdivision_label` (Loop 1 / Loop 1 / Bucle 1), `metronome_subdivision_option` (`{name} ({count})`), `metronome_status_sub` (`SUB {count}`), `metronome_subdivision_1`…`_8` (en: Quarter notes, 8th notes, 8th Triplets, 16th notes, Quintuplets, Sextuplets, Septuplets, 32nd notes; pt-BR: Semínimas, Colcheias, Tercinas de colcheia, Semicolcheias, Quintinas, Sextinas, Septinas, Fusas; es: Negras, Corcheas, Tresillos de corchea, Semicorcheas, Quintillos, Seisillos, Septillos, Fusas). Change `metronome_announce_started` to `Started, {bpm} BPM, {beats} beats, {subdivision}` (en), `Iniciado, {bpm} BPM, {beats} tempos, {subdivision}` (pt-BR), `Iniciado, {bpm} BPM, {beats} tiempos, {subdivision}` (es). Run the project's paraglide compile step if messages are not auto-compiled.
- [X] T005 Edit `tests/unit/i18n/identical-allowlist.ts`: add `metronome_subdivision_option` and `metronome_status_sub` to `SHARED`, and `metronome_subdivision_label` to the `pt-BR` list. Run `pnpm vitest run tests/unit/i18n`.
- [X] T006 [P] Write failing test `tests/unit/metronome/subdivision-names.test.ts` (jsdom docblock if the locale runtime needs it): `subdivisionName(n)` returns the en name for each of 1–8, and `subdivisionLabel(3)` is `8th Triplets (3)`.
- [X] T007 Create `src/lib/state/metronome-subdivision-names.ts` exporting `subdivisionName(n: Subdivision): string` (maps 1–8 to `m.metronome_subdivision_1…8()` from `$lib/paraglide/messages.js`) and `subdivisionLabel(n)` (`m.metronome_subdivision_option({ name, count: n })`). Imports only paraglide messages and the `Subdivision` type. Make T006 pass.
- [X] T008 [P] Add the eight subdivision name rows (en / pt-BR / es, draft status like neighbouring rows) to `docs/i18n/glossary.md`.

**Checkpoint**: Type, names and messages exist; user stories can start.

---

## Phase 3: User Story 1 — Hear evenly placed notes inside each beat (Priority: P1) 🎯 MVP

**Goal**: Each beat plays its usual click (accent on beat 1, normal on others) followed by *n* − 1 soft clicks at `anchor + j × (60/BPM) / n`; the status line reads `BEAT n/4 · SUB 3`; dots move once per beat.

**Independent Test**: Default settings (85 BPM, 4 beats, 8th Triplets), Start Training: each slot logs one `accent`/`normal` click then two `sub` clicks at +⅓ and +⅔ of 60/85 s; status `BEAT n/4 · SUB 3`; Quarter notes yields no `sub` clicks.

### Tests for User Story 1 (write first, confirm they fail)

- [X] T009 [P] [US1] Extend `tests/unit/audio/click.test.ts`: `renderClick('sub', r).length === Math.round(0.018 * r)` and `≤ Math.round(0.020 * r)`; max abs of `sub` ≤ 0.5 × max abs of `normal` (peak 0.25 vs 0.55); zero-crossing dominant frequency of `sub` is 2400 Hz ± 5 % and differs from 1000 and 1600 Hz; `accent` and `normal` output is unchanged from 031 (length 30 ms, peaks 0.9 / 0.55); invalid sample rate falls back to 48 kHz; `CLICK_LENGTH_S` is `{ accent: 0.03, normal: 0.03, sub: 0.018 }` and `CLICK_S` is `0.03`.
- [X] T010 [P] [US1] Extend `tests/unit/audio/metronome.test.ts` (use `FakeAudioPort`/`FakeClock`/`FakeFrames`): `clickAt` with `perBeat` 3 gives `when = anchor + j·period/3`, `slot = floor(j/3)`, `kind` `'sub'` when `j mod 3 ≠ 0` else `'accent'` for beat 1 and `'normal'` otherwise, `beat` wraps at `beats` and honours `startBeat`; with `clicksPerBeat: 1` the scheduled sequence equals the 031 sequence; `onBeat` fires exactly once per slot and never for a `sub` click; `clicksPerBeat` that is non-integer, 0 or > 8 behaves as 1; buffer used per click matches its kind; `start()` while live is ignored (no doubled stream).
- [X] T011 [P] [US1] Extend `tests/unit/metronome/view.test.ts`: `statusParams(beat, beats, sub)` returns `{ kind: 'beat', beat, beats, sub }` for beat ≥ 1 and `{ kind: 'none', beats, sub }` for beat 0.
- [X] T012 [P] [US1] Extend `tests/unit/metronome/store.test.ts`: `start()` and `resume()` pass `clicksPerBeat: settings.subdivision` to the engine segment; the start announcement is `Started, 85 BPM, 4 beats, 8th Triplets` by default and names the chosen subdivision; `setSubdivision` is covered in T022.
- [X] T013 [P] [US1] Create `e2e/metronome-subdivisions.spec.ts` with the US1 scenarios read from `__fmAudioLog` (`kind`, `slot`, `when`): (1) default → per slot one `accent`/`normal` then two `sub` at +⅓ and +⅔ of 60/85 s (±2 ms) and status `BEAT n/4 · SUB 3`; (2) Quarter notes → no `sub` entries and status `… · SUB 1`; (3) 2 beats → `BEAT 2/2 · SUB 3` on the second beat and two dots; (4) the lit dot changes once per slot, not per `sub` click. Selecting the option uses `getByRole('combobox', { name: 'Loop 1' }).selectOption(...)` (depends on US2 UI, so the spec is run at the US2 checkpoint; US1 cases may use a store/URL-free default for case 1).

### Implementation for User Story 1

- [X] T014 [US1] Edit `src/lib/audio/click.ts`: extend `ClickKind` to `'accent' | 'normal' | 'sub'`; add `CLICK_LENGTH_S: Readonly<Record<ClickKind, number>>` = `{ accent: 0.03, normal: 0.03, sub: 0.018 }`; `CLICK_S` = the max (0.03); `renderClick('sub', sampleRate)` is a 2400 Hz sine burst, peak 0.25, length `round(0.018 × sampleRate)`, same envelope style as the other kinds; accent/normal output sample-identical to 031. Make T009 pass.
- [X] T015 [US1] Edit `src/lib/audio/types.ts`: the `click` log entry gains `slot: number` and `kind: ClickKind` (soft clicks: `beat` is the owning beat, `accent` is `false`).
- [X] T016 [US1] Edit `src/lib/audio/metronome.ts`: add `clicksPerBeat` to `SegmentStart` and `perBeat` to the internal grid (non-integer or outside 1–8 → 1); change `clickAt(seg, j)` to return `{ index, when: anchor + (j × period) / perBeat, slot, beat, kind, accent }` per `data-model.md` §3 (`slot = floor(j/perBeat)`, `beat = ((startBeat − 1 + slot) mod beats) + 1`); change `skipTo(seg, now)` to `max(0, ceil((now + START_LEAD_S − anchor) × perBeat / period))`; create three buffers (accent, normal, sub) and pick by `kind`; one `AudioBufferSourceNode` per click connected to `sink.destination`; report `onBeat` per slot (`floor(k / perBeat) > reportedSlot`) and never for `sub`; prune pending sources using `CLICK_S`; write `slot` and `kind` into the test-build log entry. Keep `src/lib/audio` framework-free. Make T010 pass.
- [X] T017 [P] [US1] Edit `src/lib/state/metronome-view.ts`: `StatusParams` variants gain `sub: number`; `statusParams(beat, beats, sub)`. Make T011 pass.
- [X] T018 [US1] Edit `src/lib/state/metronome.svelte.ts`: pass `clicksPerBeat: this.settings.subdivision` in the segments built by `start()` and `resume()`; build the start announcement with `m.metronome_announce_started({ bpm, beats, subdivision: subdivisionName(settings.subdivision) })`; pass `settings.subdivision` into `statusParams` wherever the status is derived; `reset()` keeps `subdivision`, `screenChanged()` and `resetMetronomeForTests()` restore `DEFAULT_SETTINGS`; update callers of `SettingField` if needed. Make T012 pass.
- [X] T019 [US1] Edit `src/lib/tools/metronome/StatusBox.svelte` (and pass the value from `MetronomePanel.svelte`): render `<p class="position"><span class="part">{beat message}</span><span class="sep">{m.summary_separator()}</span><span class="part">{m.metronome_status_sub({ count: sub })}</span></p>` so `textContent` reads `BEAT 2/4 · SUB 3` (`BEAT –/4 · SUB 3` before the first click, frozen with suffix while paused); `.part { white-space: nowrap }` so wrapping happens only at the separator; tokens only. Extend `tests/unit/metronome/panel.test.ts` (jsdom docblock) to assert `BEAT –/4 · SUB 3` then `BEAT 1/4 · SUB 3`.
- [X] T020 [US1] Run `pnpm vitest run tests/unit/audio tests/unit/metronome tests/unit/i18n` and fix regressions.

**Checkpoint**: Engine, store and status line deliver subdivisions at the default; US1 e2e (T013) is completed at the US2 checkpoint once the select exists.

---

## Phase 4: User Story 2 — Choose the subdivision from a dropdown (Priority: P1)

**Goal**: A full-width **Loop 1** native select between # of Beats and Start Training lists the eight options in order with `{name} ({n})` labels, default 8th Triplets, operable by keyboard, available only in the settings phase.

**Independent Test**: Open the tool, see "8th Triplets (3)", open the select, see eight options in order, choose each in turn, Start, and the status shows the matching `SUB n`.

### Tests for User Story 2 (write first, confirm they fail)

- [X] T021 [P] [US2] Extend `tests/unit/metronome/panel.test.ts` (jsdom): `getByRole('combobox', { name: 'Loop 1' })` exists with eight options in order labelled `Quarter notes (1)` … `32nd notes (8)`, `8th Triplets (3)` selected; the select sits after the # of Beats row and before Start Training in DOM order; selecting `5` then Start shows `SUB 5`; the combobox is absent in the running and paused views.
- [X] T022 [P] [US2] Extend `tests/unit/metronome/store.test.ts`: `setSubdivision(5)` and `setSubdivision('5')` update settings in the `settings` phase; `setSubdivision(9)`, `'x'`, `2.5` are ignored; `setSubdivision` is a no-op in `starting`, `running` and `paused`; Reset keeps the chosen subdivision; `screenChanged()` restores 3.
- [X] T023 [P] [US2] Extend `tests/unit/metronome/keys.test.ts`: Space (and Escape) with a `SELECT` event target returns `null` (no start/pause shortcut).
- [X] T024 [P] [US2] Extend `e2e/metronome-subdivisions.spec.ts`: (5) each of the eight options → status `SUB n` and `n − 1` `sub` entries per slot; (6) keyboard only: Tab to the select, ArrowDown, Enter/Space chooses an option and Start is not triggered; (9) Reset keeps the choice, navigating away and back shows 8th Triplets; (10) pt-BR and es: label `Loop 1` / `Bucle 1`, status `TEMPO 2/4 · SUB 3` / `TIEMPO 2/4 · SUB 3`; (11) 320 px viewport in pt-BR: no horizontal scroll, select and status inside the panel.
- [X] T025 [P] [US2] Edit `e2e/metronome-a11y.spec.ts`: axe zero violations on the settings view (with the select) and the running view in light, dark, high-contrast and forced-colours themes.

### Implementation for User Story 2

- [X] T026 [US2] Edit `src/lib/state/metronome.svelte.ts`: add `setSubdivision(v: unknown)` that parses with `toSubdivision`, ignores `null`, and updates `settings.subdivision` only when `phase === 'settings'`. Make T022 pass.
- [X] T027 [US2] Create `src/lib/tools/metronome/SubdivisionSelect.svelte` per `contracts/metronome-ui.md` §1: props `value: Subdivision`, `onchange: (v: unknown) => void`; `<div class="field"><label for="metronome-subdivision">{m.metronome_subdivision_label()}</label><div class="control"><select id="metronome-subdivision">…</select><svg class="chevron" aria-hidden="true" focusable="false">…</svg></div></div>`; options 1…8 from `SUBDIVISIONS` with text `subdivisionLabel(n)`; `inline-size: 100%`, `min-inline-size: 0`, `min-block-size: var(--target-min)`; tokens only (`--color-surface-raised`, `--color-text`, `--color-border`, `--radius-md`, `--space-*`), chevron `currentColor` sized with `--bar-icon-size` (add `--metronome-chevron-size` aliasing it in `src/lib/styles/tokens.css` only if needed); never remove `outline`; `@media (forced-colors: active) { select { appearance: auto } .chevron { display: none } }`. Run the style lint.
- [X] T028 [US2] Edit `src/lib/tools/metronome/MetronomePanel.svelte`: in the settings phase mount `<SubdivisionSelect value={metronome.settings.subdivision} onchange={metronome.setSubdivision} />` between the # of Beats row and the Start Training button. Make T021 and T023 pass (edit `src/lib/state/metronome-keys.ts` only if T023 fails; `isEditable()` should already return true for `SELECT`).
- [X] T029 [US2] Run `pnpm build:test`, then `pnpm test:e2e:fast e2e/metronome-subdivisions.spec.ts e2e/metronome.spec.ts e2e/metronome-a11y.spec.ts`. Update `e2e/metronome.spec.ts` for the status suffix (`· SUB 3`) and the new start announcement text; re-baseline the screenshot: `pnpm playwright test e2e/metronome.spec.ts -g "metronome views" --project=desktop --update-snapshots` (settings view gains a row; status line gains a suffix).

**Checkpoint**: US1 and US2 work end to end; this is the MVP.

---

## Phase 5: User Story 3 — Subdivision clicks stay exact at high speed (Priority: P2)

**Goal**: Exact times with no drift, 40 distinct clicks/s at 300 BPM × 32nds, Pause cancels pending soft clicks, Resume starts on the next beat.

**Independent Test**: Fake-clock run at 300 BPM with 32nd notes: every click within 2 ms of ideal, none dropped or merged; Pause mid-beat leaves no click after the pause instant.

### Tests for User Story 3 (write first; fix `metronome.ts` if any fail)

- [X] T030 [P] [US3] Extend `tests/unit/audio/metronome.test.ts` with a fast-check property over BPM 30–300 × n 1–8: for `j` up to 10 minutes `|clickAt(...).when − (anchor + j·60/(bpm·n))| < 2 ms`, and every scheduled `source.start(when)` equals the ideal time (no accumulation). Add a 60 s run at 300 BPM × 8 asserting 2400 ± 1 starts, consecutive starts 25 ms apart, no skipped or duplicate `(run, index)`.
- [X] T031 [P] [US3] Extend `tests/unit/audio/metronome.test.ts`: `halt()` mid-beat stops every pending source with `when > now`, soft clicks included, and returns the beat of the last audible slot (0 if none), for each n in 1–8 (SC-005); after `halt()` no later `start(when)` occurs; pausing after a beat click with 0 or some soft clicks sounded returns that beat; resume at `beat % beats + 1` begins with that beat's `normal`/`accent` click ≤ 50 ms after the press (`START_LEAD_S`) followed by its `sub` clicks.
- [X] T032 [P] [US3] Extend `tests/unit/audio/metronome.test.ts`: after a pump gap (clock jump simulating background suspension) scheduling resumes at `skipTo(seg, now)`, the next due grid click (beat or soft), nothing earlier is scheduled, no catch-up burst, and the displayed beat is the one whose slot was last reached; `skipTo` returns the expected index for several `now` values at n = 1, 3, 8.
- [X] T033 [P] [US3] Extend `e2e/metronome-subdivisions.spec.ts`: (7) 300 BPM × 32nds for 2 s → consecutive `when` deltas 25 ms ± 2 ms and no duplicate `(run, index)`; (8) Pause between soft clicks → a `click-cancel` entry with `count > 0` and no entry with `when` after the pause instant; Resume → first new entry is `kind: 'normal'` (or `'accent'`) of the next beat ≤ 50 ms after the press, followed by its `sub` clicks; rapid Start/Pause/Resume/Space presses never produce doubled streams.

### Implementation for User Story 3

- [X] T034 [US3] Run `pnpm vitest run tests/unit/audio/metronome.test.ts`; fix any defect in `src/lib/audio/metronome.ts` the new tests expose (halt of soft sources, `skipTo`, pruning with `CLICK_S`, resume anchoring, log `click-cancel` count), keeping `n = 1` identical to 031.
- [X] T035 [US3] Run `pnpm build:test` (only if `src/` changed since T029) and `pnpm test:e2e:fast e2e/metronome-subdivisions.spec.ts`; fix failures.

**Checkpoint**: All three stories verified independently.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T036 [P] Edit `docs/adr/0030-metronome-click-scheduler.md`: add a "Revision (032)" section covering the integer click-index grid `anchor + j × (60/BPM) / n`, the per-slot `onBeat`, halt of soft sources, skip-forward to the next due grid click, and the third `sub` click kind (2400 Hz / 0.25 / 18 ms) (research R-11).
- [X] T037 [P] Manual listen per quickstart §4 (`pnpm dev`, `/metronome`): each option at 85 BPM and at 300 BPM × 32nds; beat click stays clearly louder and lower than the ticks and nothing smears. Note the result in the PR description.
- [X] T038 Run `pnpm verify` once (typecheck, lint with import boundaries and style lint, format, full Vitest with coverage, build, bundle-size ≤ 150 KB gzip, full desktop Playwright). Fix any failures and re-run only the failing step until green, then `pnpm verify` a final time.

**Manual checks** (human-only, not run in this session): T037 — listen per quickstart §4 (`pnpm dev`, `/metronome`): each option at 85 BPM and at 300 BPM × 32nds; the beat click stays clearly louder and lower than the ticks and nothing smears. Record the result in the PR description.

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2 → stories → Polish.**
- **Phase 2**: T002→T003; T004→T005; T006→T007 (T007 also needs T003 and T004). T002, T004, T006 and T008 can start in parallel.
- **US1** needs Phase 2. Within it: T009–T013 (tests) first; T014 (click) → T016 (needs T014, T015); T017 independent; T018 needs T003, T016, T017; T019 needs T017, T018; T020 last. T013's later cases complete after US2.
- **US2** needs Phase 2 and the US1 store/status work (T018, T019). T026 → T027 → T028 → T029.
- **US3** needs US1 engine (T016); its unit tests (T030–T032) can be written as soon as T016 is done, in parallel with US2. T033 needs US2's select (T028).
- **Polish** after all stories.

### Story completion order

US1 → US2 (MVP = US1 + US2, since the dropdown is the only way to vary the default) → US3. US3 unit work may overlap with US2.

## Parallel Examples

- **Phase 2**: T002, T004, T006, T008 together.
- **US1 tests**: T009, T010, T011, T012, T013 together (different files).
- **US2 tests**: T021, T022, T023, T024, T025 together.
- **US3 tests**: T030, T031, T032 touch the same file, so write them in one pass or sequentially; T033 is parallel to them.

## Implementation Strategy

1. **MVP**: Phases 1–2, US1, US2 (T001–T029). Stop and validate: pick each of the eight options and hear soft clicks, status `SUB n`.
2. **Increment**: US3 hardens exactness and Pause/Resume (T030–T035); most of its behaviour is built in T016, so these tasks are mainly proof and fixes.
3. **Finish**: ADR revision, manual listen, `pnpm verify` once (T036–T038).
