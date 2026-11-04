---

description: "Task list for Digital Time Display and More Metronome Sounds"
---

# Tasks: Digital Time Display and More Metronome Sounds

**Input**: Design documents from `/specs/041-change-the-time-display-to/` (feature id 042)

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (click-sound-api, metronome-sound-store, preferences-record, ui), quickstart.md

**Tests**: Included. The constitution (IV, test-first) and plan.md require unit tests written before implementation and e2e checks for every acceptance scenario.

**Organization**: Grouped by user story (US1 digital readout, US2 switches without state text, US3 five click sounds). The three stories touch different files and are independent. Message-catalog edits in US2 (removals) and US3 (additions) touch the same JSON files, so run those two tasks sequentially.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1, US2, US3
- Verification per CLAUDE.md: per task `pnpm vitest run <paths>`; e2e `pnpm build:test` once, then `pnpm test:e2e:fast <specs>`; `pnpm verify` once at the end. Never run `pnpm test:e2e` or `pnpm lhci` locally. Component tests start with `// @vitest-environment jsdom`.

## Path Conventions

Single SvelteKit project at the repo root: `src/lib/{audio,prefs,state,styles,tools}`, `static/fonts`, `scripts/`, `messages/`, `tests/unit/`, `e2e/`, `docs/adr/`.

---

## Phase 1: Setup

**Purpose**: Confirm baseline and add the dev-only font source.

- [X] T001 Confirm the branch contains PR #65 (timer-link switch): `grep -n "timer_link_label" src/lib/tools/metronome/TimerCard.svelte` must match and `git log --oneline -3` shows the merge. Run `pnpm install`. No file changes.
- [X] T002 Add `dseg` as a devDependency (`pnpm add -D dseg`) and a `"fonts:timer-digits": "node scripts/subset-timer-digits-font.mjs"` script in `package.json`. If `dseg` cannot be installed offline, vendor `DSEG7Classic-Bold.ttf` under `scripts/font-sources/` instead (research R-1) and note it in the commit.

---

## Phase 2: Foundational

**Purpose**: None. The three stories share no blocking prerequisite beyond Phase 1. Go to Phase 3.

---

## Phase 3: User Story 1 - Digital timer readout (Priority: P1) 🎯 MVP

**Goal**: The `88:88` ghost and the `MM:SS` readout use the self-hosted `'FM Timer Digits'` face (DSEG7 Classic Bold subset), fixed width, preloaded only on `/metronome`, precached offline, with a safe fallback.

**Independent Test**: Open `/metronome`: `.time` and `.ghost` computed `font-family` start with `"FM Timer Digits"`, width is constant across idle, running, paused and finished states, it works offline, and axe reports zero violations.

### Tests for User Story 1 (write first, confirm they fail)

- [X] T003 [P] [US1] Extend `tests/unit/metronome/timer-card.test.ts` (jsdom docblock): `.readout` keeps `role="timer"`, `aria-label` from `timer_readout_label`, and the `.ghost` (`88:88`, `aria-hidden`) and `.time` children. The `<svelte:head>` contains `link[rel=preload][as=font][type="font/woff2"][href="/fonts/fm-timer-digits.woff2"][crossorigin]`.
- [X] T004 [P] [US1] Add e2e checks to `e2e/metronome-timer.spec.ts`: (a) `.time` and `.ghost` `getComputedStyle().fontFamily` starts with `"FM Timer Digits"` and `document.fonts.check('1em "FM Timer Digits"')` is true; (b) readout bounding width is equal at `10:00`, after 1 s running, paused and finished; (c) readout `role="timer"` and accessible name unchanged; (d) with `/fonts/fm-timer-digits.woff2` routed to abort, the readout is visible with non-empty text (fallback); (e) with service workers blocked (the `playwright.config.ts` default, stated in a comment in the test), `/` and `/notes` make no page request for `fm-timer-digits.woff2`; the worker's install-time precache fetch is exempt per FR-003 and is covered by T005/offline checks.
- [X] T005 [P] [US1] Add an offline case to `e2e/offline.spec.ts`: after one online visit, go offline and reload `/metronome`; the font check is true and no non-origin request is made.

### Implementation for User Story 1

- [X] T006 [P] [US1] Write ADR `docs/adr/0032-timer-readout-digit-font.md` (follow ADR 0006's format): DSEG7 Classic Bold subset `0`–`9` and `:`, SIL OFL 1.1, self-hosted, used only by the timer readout, `font-display: swap`, preloaded only on `/metronome`.
- [X] T007 [P] [US1] Amend `.specify/memory/constitution.md`: update the Technology Stack "Fonts" row to allow a second self-hosted subset used only by the timer readout, bump 2.2.0 → 2.3.0 (MINOR), and add a Sync Impact Report entry that references ADR 0032.
- [X] T008 [US1] Create `scripts/subset-timer-digits-font.mjs`. It uses `subset-font` on the `dseg` DSEG7 Classic Bold source (`fonts/DSEG7-Classic/DSEG7Classic-Bold.woff2`) with text `0123456789:` and writes `static/fonts/fm-timer-digits.woff2`. Output must be deterministic and the script prints the byte count. Run `pnpm fonts:timer-digits`, commit the generated woff2 (< 4 KB) and add `static/fonts/OFL-DSEG.txt` (SIL OFL 1.1 text with the DSEG copyright line). Depends on T002.
- [X] T009 [P] [US1] Declare `@font-face { font-family: 'FM Timer Digits'; src: url('/fonts/fm-timer-digits.woff2') format('woff2'); font-weight: 700; font-display: swap; }` in `src/lib/styles/global.css`, and add `--font-family-timer: 'FM Timer Digits', var(--font-family-ui);` to `src/lib/styles/tokens.css`.
- [X] T010 [US1] In `src/lib/tools/metronome/TimerCard.svelte`: set `.readout` `font-family: var(--font-family-timer)` and keep `font-variant-numeric: tabular-nums`, with no other element using the token. Add `<svelte:head>` with the preload link from T003. Check that the fixed width holds, with the ghost sizing the box. Depends on T008 and T009.
- [X] T011 [US1] Confirm the service worker precaches `/fonts/fm-timer-digits.woff2`. If the precache list is explicit (check `src/service-worker.ts`), add the file. If it is built from `static/`, add no code, but keep T005 as proof.
- [X] T012 [US1] Run `pnpm vitest run tests/unit/metronome/timer-card.test.ts`. Then run `pnpm build:test` and `pnpm test:e2e:fast e2e/metronome-timer.spec.ts e2e/offline.spec.ts e2e/a11y-audit.spec.ts`. Update the readout screenshot: `pnpm playwright test e2e/metronome-timer.spec.ts -g "<readout snapshot test name>" --project=desktop --update-snapshots`.

**Checkpoint**: US1 works alone. Record "Manual checks: readout in light, dark and high-contrast themes, all four timer states (SC-001)" under a Manual checks note at the end of this file.

---

## Phase 4: User Story 2 - Switches without state text (Priority: P2)

**Goal**: No `role="switch"` control shows On/Off text. State remains in the thumb, the bold label and `aria-checked`.

**Independent Test**: On `/metronome` and `/caged`, no `.switch .state` exists, each switch's text equals its label, and `aria-checked` flips.

### Tests for User Story 2 (write first, confirm they fail)

- [X] T013 [P] [US2] Update `tests/unit/metronome/timer-card.test.ts` (timer-link switch), `tests/unit/metronome/count-in-settings.test.ts` and `tests/unit/metronome/ratio-settings.test.ts`: assert there is no `.state` element, `textContent` equals the label only, and `aria-checked` toggles. Remove assertions on On/Off text.
- [X] T014 [P] [US2] Update `tests/unit/caged/caged-tool.test.ts`, and the layer-list tests if a separate file exists (`grep -rl CagedLayerList tests/unit`): same assertions for the connections switch and each layer switch.
- [X] T015 [P] [US2] Update e2e assertions from state text to `aria-checked` and "no `.switch .state`" in `e2e/metronome-timer-link.spec.ts`, `e2e/metronome-count-in.spec.ts`, `e2e/metronome-ratios.spec.ts` and `e2e/caged-layers.spec.ts`. Also check `grep -rn "metronome_switch\|caged_switch" e2e tests src` for any other users.

### Implementation for User Story 2

- [X] T016 [P] [US2] Remove the `<span class="state" aria-hidden="true">` and its unused CSS from `src/lib/tools/metronome/TimerCard.svelte`.
- [X] T017 [P] [US2] Same removal in `src/lib/tools/metronome/CountInSettings.svelte`.
- [X] T018 [P] [US2] Same removal in `src/lib/tools/metronome/RatioSettings.svelte`.
- [X] T019 [P] [US2] Same removal in `src/lib/tools/caged/CagedTool.svelte` (connections switch).
- [X] T020 [P] [US2] Same removal in `src/lib/tools/caged/CagedLayerList.svelte` (each layer switch).
- [X] T021 [US2] Delete `metronome_switch_on`, `metronome_switch_off`, `caged_switch_on` and `caged_switch_off` from `messages/en.json`, `messages/es.json` and `messages/pt-BR.json`. Run the Paraglide compile (`pnpm check` or the repo's message build) and confirm nothing references the keys. Run before T024's message additions, or merge the JSON carefully. Depends on T016–T020.
- [X] T022 [US2] Run `pnpm vitest run tests/unit/metronome/timer-card.test.ts tests/unit/metronome/count-in-settings.test.ts tests/unit/metronome/ratio-settings.test.ts tests/unit/caged/caged-tool.test.ts`. Then run `pnpm build:test` and `pnpm test:e2e:fast e2e/metronome-timer-link.spec.ts e2e/metronome-count-in.spec.ts e2e/metronome-ratios.spec.ts e2e/caged-layers.spec.ts e2e/a11y-audit.spec.ts`.

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Five click sounds (Priority: P3)

**Goal**: Five synthesized sounds (`click`, `wood`, `beep`, `rim`, `cowbell`) selectable from a native "Click sound" select in all modes and phases. The choice is global and persisted as `metronome.sound`. A mid-run change applies only to clicks not yet scheduled, and a stopped change plays one accent preview.

**Independent Test**: Choose each sound, start the metronome and hear the change. Reload and the choice remains. A mid-run change keeps click times on the grid.

### Tests for User Story 3 (write first, confirm they fail)

- [X] T023 [P] [US3] Extend `tests/unit/audio/click.test.ts`. For 5 sounds × 3 kinds: length `round(CLICK_LENGTH_S[kind] × rate)` (min 1, ≤ `CLICK_S` = 0.03 s); peak 0.9 / 0.55 / 0.25 (accent > normal > sub); finite samples; deterministic (two renders equal); first and last samples near 0. `renderClick(kind, rate)` and `renderClick(kind, rate, 'click')` equal the pre-change golden sample for sample. Unknown sound falls back to `click`. `toClickSound` maps non-members to `'click'`. Invalid sample rate falls back to 48 000.
- [X] T024 [P] [US3] Create `tests/unit/audio/click-preview.test.ts` with a fake audio port. A running port plays one accent buffer at `currentTime` through `sink.destination` and logs `{ type: 'click-preview', sound, when, contextTime }`. A non-running port or a thrown error returns `false`, plays nothing and does not throw.
- [X] T025 [P] [US3] Extend `tests/unit/audio/metronome.test.ts` with the injectable clock. `SegmentStart.sound` is used (absent or invalid → `click`). `setSound` mid-run leaves every click time identical to a run without it, and only clicks scheduled after the call carry the new `sound` in the log. Invalid values are ignored. It works before anchoring and when not live. Buffers are cached per sink per sound.
- [X] T026 [P] [US3] Extend `tests/unit/prefs/schema.test.ts` with every row of the contracts/preferences-record.md table. Add fixtures `tests/unit/prefs/fixtures/metronome-sound.txt` (`{"sound":"wood"}`), `metronome-sound-full.txt` (`{"timer":5,"timerLink":true,"sound":"cowbell"}`) and `metronome-sound-invalid.txt` (`{"mode":"speed","sound":"gong"}`). Also test that serialization writes `sound` last, only when not `click`, and that an all-default record has no `metronome` key (byte-identical to the previous version). `PREFS_VERSION` stays 1.
- [X] T027 [P] [US3] Extend `tests/unit/metronome/store.test.ts` per contracts/metronome-sound-store.md. In `settings`, `setSound('wood')` sets state, calls `remember` and plays one preview (via the `overrides` seam), with nothing when muted or when audio is unavailable. In `starting`, `running` and `paused` it calls `scheduler.setSound`, plays no preview, and leaves phase, beat, tempo and `generation` unchanged. `setSound('x')` and `setSound(3)` are ignored. `restoreSound` has no write and no sound and also applies to the live scheduler. `selectMode` keeps `sound`. `beginSegment` passes `sound`. Also extend `tests/unit/erase-preferences.test.ts`: erase restores `click`, and apply restores the stored sound.
- [X] T028 [P] [US3] Create `tests/unit/metronome/click-sound-select.test.ts` (jsdom). It checks a labelled native `<select id="metronome-sound">` with 5 options in `CLICK_SOUNDS` order and localized text. `value` follows `metronome.sound`, and `change` calls `setSound`. Extend `tests/unit/metronome/panel.test.ts`: the select is rendered once in `#metronome-mode-panel` in all three modes and every phase.
- [X] T029 [P] [US3] Create `e2e/metronome-sound.spec.ts` covering quickstart rows US3-1…7. `#metronome-sound` lists Click, Wood block, Beep, Rim, Cowbell, with Click selected; es and pt-BR names are translated. Selecting `rim` mid-run switches audio-log `click` entries to `sound:"rim"` within 1.5 s with `when` diffs equal to the period. Stopped + `wood` → one `click-preview` entry, muted → entry logged with mute gain 0, running → none. Reload keeps `wood`. Seeded `sound:"gong"` → `click` selected and other settings kept. The change is shared across Ratios, Plain and Speed. axe reports zero violations on `/metronome`.

### Implementation for User Story 3

- [X] T030 [US3] In `src/lib/audio/click.ts` export `CLICK_SOUNDS`, `ClickSound`, `DEFAULT_CLICK_SOUND` and `toClickSound`, and add the `sound` parameter to `renderClick`. `click` output is unchanged; implement `wood`, `beep`, `rim` and `cowbell` with research R-7 parameters, using seeded `mulberry32` only (no `Math.random`), per-kind lengths and peaks as in the contract. Framework-free (lint rule). Makes T023 pass.
- [X] T031 [US3] In `src/lib/audio/types.ts` add `sound: ClickSound` to the `click` log entry and a `click-preview` entry `{ type; sound; when; contextTime }`. Depends on T030.
- [X] T032 [US3] In `src/lib/audio/metronome.ts` add `SegmentStart.sound?`, `ClickScheduler.setSound(sound: unknown)` and a `WeakMap<ClickSink, Map<ClickSound, Record<ClickKind, AudioBuffer>>>` buffer cache rendered lazily, and log `sound` per click. `setSound` must not touch `anchor`, `period`, `next`, `pending`, `live` or beat reporting. Makes T025 pass. Depends on T030 and T031.
- [X] T033 [P] [US3] Create `src/lib/audio/click-preview.ts` with `playClickPreview(sink, sound): boolean` per contracts/click-sound-api.md §3. Makes T024 pass. Depends on T030 and T031.
- [X] T034 [P] [US3] In `src/lib/prefs/schema.ts`, import `CLICK_SOUNDS` from `$lib/audio/click` and add `metronome.sound` to the types, default (`'click'`), parse (`isPlainObject` then `v.fallback(v.picklist(CLICK_SOUNDS), 'click')`) and serialize (last key, only when ≠ `click`). Makes T026 pass. Depends on T030.
- [X] T035 [US3] In `src/lib/state/metronome.svelte.ts` add `sound` state, `setSound` and `restoreSound`, per the contract table and data-model §3. `beginSegment` passes `sound`, and a new `overrides.preview` (or the existing seam) is injectable. In `src/lib/state/preferences.svelte.ts`, `apply` calls `metronome.restoreSound(p.metronome.sound)` and erase calls `metronome.restoreSound('click')`. Makes T027 pass. Depends on T032, T033 and T034.
- [X] T036 [US3] Add the six keys `metronome_sound_label`, `metronome_sound_click`, `metronome_sound_wood`, `metronome_sound_beep`, `metronome_sound_rim` and `metronome_sound_cowbell` to `messages/en.json`, `messages/es.json` and `messages/pt-BR.json` with the data-model §5 table values. Run after T021 (same files).
- [X] T037 [US3] Create `src/lib/tools/metronome/ClickSoundSelect.svelte`. It is a sibling of `SubdivisionSelect`: `<label for="metronome-sound">` plus a native `<select id="metronome-sound">` with five options in `CLICK_SOUNDS` order, localized text, `value = metronome.sound` and `change` → `metronome.setSound(e.currentTarget.value)`. Same field, chevron and forced-colors styling, tokens only, target ≥ `--target-min`. Depends on T035 and T036.
- [X] T038 [US3] Render `<ClickSoundSelect />` once in `src/lib/tools/metronome/MetronomePanel.svelte` inside `#metronome-mode-panel`, below the settings/run block, so it shows in every mode and phase (plan "Select visible while running"). Confirm the metronome shortcuts are inert while the select has focus (existing `isEditable` rule for `SELECT`). Makes T028 pass. Depends on T037.
- [X] T039 [US3] Run `pnpm vitest run tests/unit/audio/click.test.ts tests/unit/audio/click-preview.test.ts tests/unit/audio/metronome.test.ts tests/unit/prefs/schema.test.ts tests/unit/metronome/store.test.ts tests/unit/metronome/click-sound-select.test.ts tests/unit/metronome/panel.test.ts tests/unit/erase-preferences.test.ts`. Then run `pnpm build:test` and `pnpm test:e2e:fast e2e/metronome-sound.spec.ts e2e/a11y-audit.spec.ts`.

**Checkpoint**: All three stories work independently. Record "Manual checks: listening — accent, normal and sub are told apart for each sound and none is harsh at volume 100 (SC-005)".

---

## Phase 6: Polish & Cross-Cutting

- [X] T040 [P] Check bundle growth: initial JS stays ≤ 180 KB gzip (expected < 2 KB growth), and the woff2 is < 4 KB.
- [X] T041 [P] Run `grep -rn "metronome_switch_\|caged_switch_\|class=\"state\"" src e2e tests messages` and confirm no stale references remain. Check that a `docs/` or README mention of the readout font or sounds is updated if one exists.
- [X] T042 Add a "Manual checks" section at the end of this file with the two human steps (themes, SC-001; listening, SC-005), tick the tasks, and list them in the PR description.
- [X] T043 Walk through `specs/041-change-the-time-display-to/quickstart.md` sections 1–3.
- [X] T044 Run all local gates once: `pnpm verify`. Screenshot assertions and `e2e/perf.spec.ts` are skipped outside CI, and Linux baselines come from `update-snapshots.yml`. Do not run `pnpm test:e2e` locally.

---

## Dependencies & Execution Order

- **Phase 1** → everything. **Phase 2** is empty.
- **US1, US2, US3** are independent after Phase 1 and can run in parallel. Shared files: `messages/*.json` (T021 before T036) and `TimerCard.svelte` (T010 and T016 are different regions but not parallel; do T010 first), and `timer-card.test.ts` (T003 and T013).
- Within US1: T008 → T010. T006, T007 and T009 are parallel. T011 → T012.
- Within US2: tests T013–T015 → T016–T020 (parallel) → T021 → T022.
- Within US3: T030 → (T031) → T032, T033 and T034 (T033 and T034 are parallel, T032 depends on T031) → T035 → T036 → T037 → T038 → T039.

## Parallel Examples

```text
US1: T003, T004, T005 (tests) together; then T006, T007, T009 together.
US2: T013, T014, T015 together; then T016–T020 together.
US3: T023–T029 together; then T033 and T034 together after T030/T031.
```

## Implementation Strategy

- **MVP**: Phase 1 + US1 (digital readout), then validate.
- **Incremental**: US2 (a small removal, low risk), then US3 (the largest slice: audio, prefs, store, UI).
- Commit per task or group (Conventional Commits). Run `pnpm verify` once at the end.
- The synthesis parameters for `wood`, `beep`, `rim` and `cowbell` (research R-7) are a starting point. A listening pass may tune them without changing the contracts.

---

## Manual checks

Human steps that cannot be automated here (list them in the PR description):

- [ ] **Visual (SC-001)**: check the digital readout in light, dark and high-contrast themes, in all four timer states.
- [ ] **Listening (SC-005)**: for each click sound, accent / normal / sub are told apart, and none is harsh at volume 100.

## Phase 6 notes

- Initial JS: 162.7 KB gzip (≤ 180 KB). Font woff2 is under 4 KB.
- Stale-reference grep: only `caged_switch_spelling` ("Switch to {root}") matches, a live button label and not state text.
- `pnpm verify`: check, lint, format, unit, build, bundle size pass. Desktop e2e: 1648 passed. Unrelated axe tests in `handedness.spec.ts`, `shortcuts.spec.ts` and `triads-compare.spec.ts` timed out at 30 s under local load. The shortcuts and triads-compare ones passed on rerun. The handedness axe ones still time out locally and need a CI run.
