# Tasks: Remembered Preferences, No Account

**Input**: Design documents from `/specs/010-remembered-preferences/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (storage-format.md, preferences-api.md, preferences-ui.md), quickstart.md

**Tests**: INCLUDED. Constitution IV and plan R-14 require the preferences modules test-first (codec table, fast-check properties, fake-`Storage` tests) and every acceptance scenario of US1–US4 mapped to a Vitest or Playwright test. Write each test first and confirm it FAILS before the implementation task.

**Organization**: Grouped by user story. The shared preferences library and runes store are Foundational because every story reads or writes through them.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US4 (user story phases only)
- Paths are relative to the repository root (single SvelteKit project)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependency, lint boundary, catalog strings, fixtures.

- [X] T001 Add Valibot as a runtime dependency (`pnpm add valibot@^1`) in `package.json` and `pnpm-lock.yaml` (R-01; MIT; ~1–2 KB gzip)
- [X] T002 [P] Add an ESLint import-boundary block for `src/lib/prefs/**` in `eslint.config.js`: forbid value imports of `svelte`, `svelte/*`, `$app/*`, `$lib/paraglide/*`, `$lib/state/*`, `$lib/shell/*` (type-only imports allowed); only `src/lib/state/preferences.svelte.ts` and tests may import `$lib/prefs/*` (contracts/preferences-api.md §6, R-12)
- [X] T003 [P] Add the seven catalog messages to `messages/en.json` exactly as in contracts/preferences-ui.md: `prefs_not_remembered` ("Preferences won't be remembered on this device."), `home_continue` ("Continue"), `card_label_continue` ("Continue: {name}. {question}"), `about_erase` ("Erase my preferences"), `about_erase_question` ("Erase all preferences on this device?"), `about_erase_confirm` ("Erase"), `about_erase_cancel` ("Cancel"); regenerate Paraglide output with the project's existing command
- [X] T004 [P] Create the eight fixture records from contracts/storage-format.md as files under `tests/unit/prefs/fixtures/` (`v1-full`, `bad-volume`, `garbage`, `array`, `future`, `wrong-types`, `markup`, `oversize` = 16 385 × `a`) with their expected `Preferences` in `tests/unit/prefs/fixtures/index.ts`. Fixtures are only ever added, never removed

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure codec, guarded storage adapter, in-memory session, runes store, and startup hook. No user story can work until these exist.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests first (must FAIL before implementation)

- [X] T005 [P] Write codec tests in `tests/unit/prefs/schema.test.ts`: table over all fixtures from T004; FR-018 defaults; each US2 scenario-6 value (`volume: 3` → 80, `frets: 99` → 22, `frets: 13.5` → 22, `tuning: "AF-99"` → `AF-1`, `muted: "true"` → `false`, `lastTool: "caged"`/`"home"` → `null`, `labels.triads: "octave"` → `interval`); volume mapping `round(x·20)·5` for finite x in [0,1], else 80; valid tuning with invalid frets keeps tuning (and reverse); raw length > 16 384 is not parsed; `serializePreferences` writes exactly `version, tuning, frets, muted, volume, lastTool?, labels.notes, labels.triads` in that order with `lastTool` omitted when null and `volume / 100`; fast-check properties: `parsePreferences(x)` returns a valid `Preferences` for every string `x` and never throws, and `parsePreferences(serializePreferences(p))` deep-equals `p` for every valid `p`; unit test that the `ToolId` picklist equals the ids in `TOOLS` (`src/lib/shell/tools.ts`)
- [X] T006 [P] Write adapter tests in `tests/unit/prefs/storage.test.ts` with a fake `StorageLike`: `probeStorage` true on working storage and leaves no `fretboard-master:probe` key; false when `setItem`/`getItem`/`removeItem` throws, on read-back mismatch, and for `null`; `resolveStorage` returns `null` when accessing `globalThis.localStorage` throws; `readRaw` returns `null` on throw and for values longer than 16 384; `writeRaw` swallows quota errors; `eraseAll` removes every `fretboard-master:` key (iterating safely while removing), leaves other keys, and swallows throws
- [X] T007 [P] Write session tests in `tests/unit/prefs/session.test.ts` with a fake `StorageLike`: `startSession` reads once and never writes; unavailable storage → `available=false`, defaults, `remember` still updates `current` without throwing; `remember` writes only when the serialization differs from the last written one (no-op on identical value); a record read from an unknown/newer version is replaced by a v1 record on the first changing `remember`; `remember` with a rejecting `setItem` is silent and `current` still updates; `erase` removes the keys, resets `current` to defaults, writes nothing, and after `erase` storage stays empty until the next `remember`; storage is never re-read after start (FR-005)

### Implementation

- [X] T008 Implement `src/lib/prefs/schema.ts` per contracts/preferences-api.md §1 and data-model.md §1–§2: `Preferences`, `PREFS_VERSION = 1`, `MAX_RAW_LENGTH = 16_384`, frozen `DEFAULT_PREFERENCES`, Valibot schema with a per-field `fallback`, total `parsePreferences(raw: string | null)` (null/oversize/throw/non-object → defaults), stable `serializePreferences`. Reuse `isTuningId` and `DEFAULT_FRETS` from `src/lib/state/instrument-config.ts` via type/constant imports allowed by the T002 boundary (pass the picklist ids in if a value import would violate it). Makes T005 pass
- [X] T009 Implement `src/lib/prefs/storage.ts` per contracts/preferences-api.md §2: `PREFS_KEY`, `PROBE_KEY`, `KEY_PREFIX`, `StorageLike`, `resolveStorage`, `probeStorage` (guarded write+read+remove of the probe key), `readRaw`, `writeRaw`, `eraseAll`. Every empty catch carries the comment `// fire-and-forget storage access (FR-010 / EC-9.3)`. This is the only module that touches `localStorage`. Makes T006 pass (depends on T008 for `MAX_RAW_LENGTH`)
- [X] T010 Implement `src/lib/prefs/session.ts` per contracts/preferences-api.md §3 and the state diagram in data-model.md §3: `PrefsSession`, `startSession(storage?)`, `remember(patch)` (merge, change-detect against `lastWritten`, guarded write), `erase()`. Makes T007 pass (depends on T008, T009)
- [X] T011 [P] Write store tests in `tests/unit/state/preferences-store.test.ts` (use `resetPreferencesForTests`): `start` is idempotent; `start` with stored values pushes them through `instrument.restore`, `playback.restore`, `notes.restoreLabelType`, `triads.restoreLabelType` without writing; `lastTool` seeded from storage; `noticeVisible` true only when the probe fails and only once per session (module flag); `dismissNotice`, `screenChanged`; `toolOpened('notes')` remembers `lastTool` and ignores unknown ids; `remember` forwards to the session
- [X] T012 [P] Write restore tests extending the existing suites: `tests/unit/audio/engine.test.ts` (new `restore(muted, volume)` assigns values and never creates an `AudioContext`; ramps only if a context already exists), and new cases in the existing instrument/playback/notes/triads state tests under `tests/unit/` for `instrument.restore(config)` (sets `active`, applies to Notes/Triads views, no "instrument adjusted" notice, no playback stop), `playback.restore({ muted, volume })` (no unlock), `notes/triads.restoreLabelType` (no write), and `reset()` keeping the remembered label type
- [X] T013 Add non-persisting restore methods: `restore(muted, volume)` in `src/lib/audio/engine.ts` (never calls `ensureContext`); `restore({ muted, volume })` in `src/lib/state/playback.svelte.ts`; `restore(config: InstrumentConfig)` in `src/lib/state/instrument.svelte.ts` (same `instrumentOf` + `applyInstrument` path as Confirm, no notice, no stop); `restoreLabelType(t)` in `src/lib/state/notes.svelte.ts` and `src/lib/state/triads.svelte.ts`, with `reset()` and the initial view using defaults plus the preferred label type (R-07, plan "Assumptions"). Makes T012 pass
- [X] T014 Implement `src/lib/state/preferences.svelte.ts` per contracts/preferences-api.md §4 and data-model.md §4: reactive `lastTool` and `noticeVisible`, `start(storage?)` (idempotent; starts session, applies loaded values via the T013 restore methods, sets the one-per-session notice flag when unavailable), `toolOpened`, `dismissNotice`, `screenChanged`, `erase`, `remember`, and `resetPreferencesForTests`. Makes T011 pass (depends on T010, T013)
- [X] T015 Export `init` from `src/hooks.client.ts` calling `preferences.start()` so the record is read once, synchronously, before hydration (R-04, FR-005)

**Checkpoint**: Foundation ready. `parsePreferences`, the adapter, the session, and the store pass their unit tests, and the app starts with defaults when nothing is stored.

---

## Phase 3: User Story 1 - Come back and find my instrument and sound as I left them (Priority: P1) 🎯 MVP

**Goal**: Tuning, fret count, mute, volume, Notes/Triads label type and last tool survive a reload; the last tool's card shows "Continue"; tools open in their initial musical state.

**Independent Test**: Set Drop D, mute, change frets/volume/label types, open Triads, reload: summary shows Drop D, mute is on, other values are restored, the Triads card says "Continue" with card order unchanged, and Triads opens with no root/quality/layers selected.

### Tests for User Story 1 (write first, confirm they FAIL)

- [X] T016 [P] [US1] Extend `tests/unit/tool-card.test.ts` and `tests/unit/home-screen.test.ts`: `continued` prop renders a visible text badge `home_continue` and the accessible name `card_label_continue`; other cards keep `card_label`; `HomeScreen` passes `continued={tool.id === preferences.lastTool}`; with `lastTool = null` no card has the badge; card order always equals `TOOLS`
- [X] T017 [P] [US1] Add remember-on-change tests to the existing state suites: `instrument.confirm` calls `preferences.remember` only when the config changed (tuning and frets), `playback.setMuted` and `playback.setVolume` remember (volume on the control scale), `notes/triads.setLabelType` remember, while `carryRoot`, `carrySelection` and view actions do not (FR-019); pending unapplied panel edits are not written
- [X] T018 [P] [US1] Write `e2e/preferences.spec.ts` US1 scenarios (phone 360 px and desktop projects, axe on Home with Continue): US1-1 Drop D + muted survive reload; US1-2 Triads card shows Continue, order unchanged; US1-3 root/quality/layers are not restored (opens in initial state, SC-005); US1-4 frets, volume, Notes label, Triads label restored and no control shows a default once interactive; US1-5 first visit has defaults and no Continue; Notes "hide names" starts off; opening About/Home/404 does not change `lastTool`

### Implementation for User Story 1

- [X] T019 [P] [US1] Call `preferences.remember(…)` in the user-action methods: `instrument.confirm` (when changed) in `src/lib/state/instrument.svelte.ts`; `setMuted` and `setVolume` in `src/lib/state/playback.svelte.ts`; `setLabelType` in `src/lib/state/notes.svelte.ts` and `src/lib/state/triads.svelte.ts` (contracts/preferences-api.md §4). Makes T017 pass
- [X] T020 [P] [US1] Add the `continued` prop and text badge (text plus border, not color alone, existing tokens only, wraps at 320 px / 200 % zoom) with the `card_label_continue` accessible name in `src/lib/shell/ToolCard.svelte`
- [X] T021 [US1] Pass `continued={tool.id === preferences.lastTool}` from `src/lib/shell/HomeScreen.svelte`, keeping `TOOLS` order (depends on T020). Makes T016 pass
- [X] T022 [US1] In `src/routes/+layout.svelte`, record the last tool in `afterNavigate` by matching the destination path against `TOOLS` and calling `preferences.toolOpened(id)` for any route (card, nav, carry, direct address); Home, About and not-found must not call it (FR-014)
- [X] T023 [US1] Run T018 against the built app and fix gaps until US1 passes on both profiles with zero axe violations

**Checkpoint**: US1 works alone. A returning user finds instrument, sound, labels and the Continue mark with no setup. This is the MVP.

---

## Phase 4: User Story 2 - Works when storage is blocked, damaged, or full (Priority: P1)

**Goal**: Blocked, corrupt, partial, out-of-range, future-format, oversize or full storage never breaks the app; blocked storage gets one dismissible notice per session.

**Independent Test**: Load with storage blocked, with a record that has a valid tuning and corrupt volume, with garbage, with a future-format record, with an oversize value, and with a rejecting `setItem`; the app is usable each time and the notice appears only for blocked storage, once.

### Tests for User Story 2 (write first, confirm they FAIL)

- [X] T024 [P] [US2] Write `tests/unit/prefs-notice.test.ts` for `PrefsNotice.svelte`: renders only when `preferences.noticeVisible`; uses the existing `Notice` (`role="status"`, polite, Dismiss, one line); text is the `prefs_not_remembered` message; Dismiss hides it and it does not return; not shown when storage works, after Erase, or after a failed write alone
- [X] T025 [P] [US2] Add US2 scenarios to `e2e/preferences.spec.ts` using `addInitScript` storage stubs: US2-1 blocked storage → defaults, one notice, none after navigating; US2-2 valid tuning + invalid volume; US2-3 garbage and non-record text → defaults, no notice; US2-4 future/unknown version keeps recognizable items; US2-5 rejecting `setItem` → nothing visible fails and the setting holds for the session; US2-6 each out-of-range value from the spec resets that item only; US2-7 value > 16 384 chars → all defaults; markup in a stored value is never rendered; axe on a screen showing the notice; assert zero network requests for preferences (SC-007, FR-021)

### Implementation for User Story 2

- [X] T026 [US2] Create `src/lib/shell/PrefsNotice.svelte` wrapping the existing `Notice` with `m.prefs_not_remembered()` and `preferences.dismissNotice()` (contracts/preferences-ui.md §1)
- [X] T027 [US2] In `src/routes/+layout.svelte`, render `<PrefsNotice />` above the page content and call `preferences.screenChanged()` from `beforeNavigate` so the notice clears on a real screen change (R-10; depends on T026). Makes T024 pass
- [X] T028 [US2] Run T025 and fix gaps until all seven scenarios pass on both profiles with zero axe violations

**Checkpoint**: US1 and US2 both work. The app never shows an error or blank screen because of stored data.

---

## Phase 5: User Story 3 - Erase my preferences (Priority: P2)

**Goal**: About offers an inline Erase with one-line confirmation that removes every stored key, restores defaults, stops sound, and lands on Home with no Continue.

**Independent Test**: Set non-default preferences, open About, choose Erase, confirm: defaults, Home shown, focus on its `h1`, no Continue, no `fretboard-master:` key remains, and a reload still shows defaults.

### Tests for User Story 3 (write first, confirm they FAIL)

- [X] T029 [P] [US3] Write `tests/unit/erase-preferences.test.ts` for `ErasePreferences.svelte`: idle shows only **Erase my preferences**; activating shows the question, **Erase** and **Cancel** inline (no `<dialog>`) with focus on Cancel; Cancel and Escape return to idle with focus on the opener and change nothing; Erase calls `preferences.erase()` and navigates to `/`; buttons meet `--target-min`
- [X] T030 [P] [US3] Extend `tests/unit/state/preferences-store.test.ts` for `erase()`: removes all prefixed keys, resets `lastTool` to `null`, restores defaults through the restore methods (tuning `AF-1`, 22 frets, unmuted, volume 80, labels `name`/`interval`), stops any playing note, writes no record, does not show the notice, and works silently when storage is unavailable; in-session musical state is otherwise untouched
- [X] T031 [P] [US3] Add US3 scenarios to `e2e/preferences.spec.ts`: US3-1 erase → defaults, Home, no Continue; US3-2 Cancel changes nothing; US3-3 reload after erase still shows defaults and storage has no `fretboard-master:` key; US3-4 keyboard-only confirm and cancel with the focus rules; axe on About idle and confirming (phone and desktop); SC-004 two actions only

### Implementation for User Story 3

- [X] T032 [US3] Finish `preferences.erase()` in `src/lib/state/preferences.svelte.ts`: call `session.erase()`, apply defaults via `instrument.restore`, `playback.restore`, and `notes/triads.restoreLabelType`, stop playback, set `lastTool = null`, never raise the notice (R-11, FR-017). Makes T030 pass
- [X] T033 [US3] Create `src/lib/shell/ErasePreferences.svelte` per the state table in contracts/preferences-ui.md §3 (idle → confirming → idle/home; initial focus on Cancel; Escape closes; navigate with `goto('/')` so the layout focuses the home `h1`; catalog strings only, existing tokens only). Makes T029 pass
- [X] T034 [US3] Mount `<ErasePreferences />` on `src/routes/about/+page.svelte`
- [X] T035 [US3] Run T031 and fix gaps until it passes on both profiles with zero axe violations

**Checkpoint**: US1–US3 independently functional. Users control and can clear what the device holds.

---

## Phase 6: User Story 4 - Two tabs stay predictable (Priority: P3)

**Goal**: Last write wins; a running tab never changes because of another tab; a new opening shows the latest write.

**Independent Test**: Open two pages on the same storage, change a setting in each; neither changes live; a third new page shows the most recent write.

- [X] T036 [P] [US4] Add unit coverage in `tests/unit/prefs/session.test.ts`: two sessions on one fake storage, writes from one are not adopted by the other, the later write overwrites the earlier, a fresh `startSession` reads the latest; assert no `storage` event listener exists in `src/lib/prefs` and `src/lib/state/preferences.svelte.ts`
- [X] T037 [US4] Add US4 scenarios to `e2e/preferences.spec.ts` with two pages in one browser context: US4-1 other tab unchanged after a change; US4-2 a newly opened page shows the most recent write
- [X] T038 [US4] If T036 or T037 fail, remove any cross-tab reaction found (no code is expected here by design, FR-015)

**Checkpoint**: All four stories pass.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T039 [P] Add `docs/adr/0013-preferences-record-and-startup-restore.md` recording the client-`init` restore, the v1 record format, explicit synchronous writes, the Valibot dependency, and the add-only extension rule (Development Workflow)
- [X] T040 [P] Extend `tests/unit/no-raw-text.test.ts` coverage (or confirm it already scans) so the new components `PrefsNotice.svelte`, `ErasePreferences.svelte` and the `ToolCard.svelte` badge contain no hard-coded text
- [X] T041 Run `scripts/check-bundle-size.mjs` and confirm initial JS ≤ 80 KB gzip with Valibot tree-shaken (only the actions used) — measured 82.2 KB (78.9 KB before this slice); budget raised to 85 KB by constitution amendment 1.3.0
- [X] T042 Run `e2e/perf.spec.ts` with a seeded record: control change → fretboard update ≤ 100 ms (SC-006) and home usable ≤ 3 s (SC-008); no `AudioContext` created at startup
- [X] T043 [P] Verify layout from 320 to 2560 px and at 200 % zoom for the Continue badge, notice and Erase row; confirm no hard-coded values and no reuse of root/third/fifth colors (`tests/unit/reserved-colors.test.ts`)
- [X] T044 Run the full gate set from quickstart.md (lint, type check, unit, e2e, Lighthouse CI) and the manual walkthrough in `specs/010-remembered-preferences/quickstart.md`; fix anything that fails

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none; T001 first for imports to resolve, T002–T004 in parallel
- **Foundational (Phase 2)**: depends on Setup; blocks all stories
- **US1, US2, US3 (Phases 3–5)**: depend on Foundational. US1 is the MVP. US2 and US3 do not require US1 code except the shared `+layout.svelte` edits (T022, T027), so do those edits in sequence
- **US4 (Phase 6)**: depends on Foundational (verification only)
- **Polish (Phase 7)**: after the desired stories are done

### Within Foundational

T005–T007 and T011–T012 (tests) → T008 → T009 → T010 → T013 → T014 → T015

### Within Each Story

Tests first and failing → store/state changes → components → route wiring → e2e run.

### Cross-story file overlap

- `src/routes/+layout.svelte`: T022 (US1), T027 (US2). Do not run in parallel
- `e2e/preferences.spec.ts`: T018, T025, T031, T037 each add a describe block. Do not run in parallel
- `src/lib/state/preferences.svelte.ts`: T014, T032

## Parallel Opportunities

- Setup: T002, T003, T004 together
- Foundational tests: T005, T006, T007 together; T011 and T012 together
- US1: T016, T017, T018 together; then T019 and T020 together
- US2: T024 and T025 together
- US3: T029, T030, T031 together
- Polish: T039, T040, T043 together

### Parallel Example: Foundational tests

```text
Task: "Codec tests in tests/unit/prefs/schema.test.ts"
Task: "Adapter tests in tests/unit/prefs/storage.test.ts"
Task: "Session tests in tests/unit/prefs/session.test.ts"
```

## Implementation Strategy

### MVP First (US1)

1. Phase 1 Setup → Phase 2 Foundational
2. Phase 3 (US1) → **stop and validate**: reload keeps instrument, sound, labels, Continue
3. Demo; US1 alone already removes re-configuring on each visit

### Incremental Delivery

1. Foundation → US1 (MVP) → US2 (hardening, ships with US1 ideally since both are P1) → US3 (erase) → US4 (verification) → Polish
2. Each story adds value without breaking the earlier ones

## Notes

- Out of scope in this slice (join the record in later slices): custom tuning, string count, handedness, orientation, tempo, one-time notices, language, notation, accidentals, theme, CAGED.
- Only `src/lib/prefs/storage.ts` may touch `localStorage`; empty catches carry the fire-and-forget comment.
- Commit after each task or logical group using Conventional Commits.
