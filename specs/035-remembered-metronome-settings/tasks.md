---

description: "Task list for Remembered Metronome Settings (035)"
---

# Tasks: Remembered Metronome Settings

**Input**: Design documents from `/specs/035-remembered-metronome-settings/`

**Prerequisites**: plan.md, spec.md, research.md (R-01…R-11), data-model.md, contracts/preferences-record.md (C1–C8), contracts/metronome-store-api.md (M-R*, M-W*), quickstart.md

**Tests**: Included. Constitution IV makes preferences a test-first module, and the plan maps every acceptance scenario to a unit or e2e test. Write each test task before the code it covers and confirm it fails.

**Organization**: Grouped by user story. The codec and store wiring (Foundational) serve every story, so the stories mostly add tests plus small behaviour changes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US5 from spec.md
- Verification per CLAUDE.md: `pnpm vitest run <paths>` per task, `pnpm build:test` once then `pnpm test:e2e:fast <specs>` for e2e, `pnpm verify` once at the end. Do NOT run `pnpm test:e2e` or `pnpm lhci` locally.
- Unit tests that touch `document`, `window` or `localStorage` start with `// @vitest-environment jsdom`.

## Path Conventions

Single SvelteKit project. Code in `src/lib/prefs`, `src/lib/state`, `messages/`. Unit tests in `tests/unit/{prefs,metronome,state,i18n}`, e2e in `e2e/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Fixtures and a baseline. No new dependencies or directories.

- [X] T001 Run the baseline `pnpm vitest run tests/unit/prefs tests/unit/metronome tests/unit/state/preferences-store.test.ts tests/unit/erase-preferences.test.ts tests/unit/i18n/about-catalog.test.ts` and confirm it is green before any change. Then read `src/lib/prefs/schema.ts`, `src/lib/state/metronome.svelte.ts`, `src/lib/state/preferences.svelte.ts`, `src/lib/state/metronome-settings.ts` and `tests/unit/prefs/fixtures/index.ts` to learn the existing patterns.
- [X] T002 [P] Add the seven fixtures to `tests/unit/prefs/fixtures/` and register them in `tests/unit/prefs/fixtures/index.ts` (existing fixtures stay unchanged): `metronome-ratios.txt` (bpm 120, beats 2, loop2 5, others default), `metronome-full.txt` (all eight non-default), `metronome-bad-bpm.txt` (bpm 900, others valid non-default), `metronome-wrong-types.txt` (`"120"`, 2.5, `null`, `"yes"`, 9 across the fields), `metronome-array.txt` (`"metronome": []`), `metronome-null-ratios.txt` (`"metronome": {"ratios": null}`), `metronome-other-mode.txt` (a `speed` entry next to `ratios`). All use `"version": 1`; `metronome` is the last key.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The codec and the store wiring that every story relies on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests first (must FAIL before implementation)

- [X] T003 [P] Extend `tests/unit/prefs/schema.test.ts` with contract tests C1–C7: (C1) `serializePreferences(DEFAULT_PREFERENCES)` is byte-identical to the 034 output with no `metronome` key; (C2) fast-check round trip over the eight fields; (C3) every existing fixture parses with `metronome.ratios` deep-equal to the defaults and other fields unchanged; (C4) for each of the eight fields, an invalid value (out of range, fraction 2.5, numeric string `"120"`, `null`, wrong type, `NaN`-like) resets only that field and no non-metronome field; (C5) `metronome` as `null`, array, string, or `ratios` as one of those gives all defaults and does not throw; (C6) an extra `speed` entry is ignored and dropped on re-serialize; (C7) parity: `METRONOME_RATIOS_DEFAULTS` equals `DEFAULT_SETTINGS`, and `METRONOME_LIMITS` equals `MIN_BPM/MAX_BPM`, `MIN_BEATS/MAX_BEATS`, `MIN_COUNT_IN/MAX_COUNT_IN` and `SUBDIVISIONS` from `$lib/state/metronome-settings` and `$lib/audio/schedule`. Also assert W1–W3: omitted when all eight are default, otherwise all eight in the order `bpm, beats, countIn, initialCountIn, repeatCountIn, ratio, loop1, loop2`, `metronome` last after `shortcuts`, Loop 1 stored as `loop1`.
- [X] T004 [P] Extend `tests/unit/prefs/session.test.ts`: `remember({ metronome: { ratios } })` writes once, is skipped when the serialized record is unchanged, leaves other fields untouched (FR-009), and `erase()` returns the metronome defaults.
- [X] T005 [P] Extend `tests/unit/metronome/store.test.ts` with the new contract tests: M-R1/M-R2 (`restoreSettings` sets `phase === 'settings'`, `position === null`, halts a running scheduler, deep-equals the given settings, never calls `preferences.remember`); M-W1 (a stepper at its limit, an ignored invalid value, and a call outside the settings phase do not call `remember`); M-W2 (`toggle()` and `reset()` never call `remember`); M-W3 (no throw when no preferences session exists). Each setter in the contract list (`setBpm`, `stepBpm`, `setBeats`, `stepBeats`, `setCountIn`, `setInitialCountIn`, `stepInitialCountIn`, `setRepeatCountIn`, `stepRepeatCountIn`, `setRatio`, `setSubdivision`, `setLoop2`) calls `remember({ metronome: { ratios: <new settings> } })` once on a real change.
- [X] T006 [P] Extend `tests/unit/state/preferences-store.test.ts` and `tests/unit/erase-preferences.test.ts` (jsdom docblock): `start()` restores stored metronome values into the metronome store; `erase()` resets the in-memory metronome settings to the defaults, with and without a session.

### Implementation

- [X] T007 Implement the codec in `src/lib/prefs/schema.ts` (R-01…R-04): type-only import of `MetronomeSettings` from `$lib/state/metronome-settings`; export `METRONOME_RATIOS_DEFAULTS` (`satisfies MetronomeSettings`, frozen) and `METRONOME_LIMITS` (`bpm [30,300]`, `beats [1,16]`, `count [0,8]`, `loop [1,8]`); add `metronome: { readonly ratios: MetronomeSettings }` to `Preferences` and `DEFAULT_PREFERENCES`; add a Valibot sub-schema where each field is validated on its own with `v.fallback` and never clamped (`bpm` `v.pipe(v.number(), v.integer(), v.minValue(30), v.maxValue(300))` → 85; `beats` integer 1–16 → 4; `initialCountIn` integer 0–8 → 4; `repeatCountIn` integer 0–8 → 2; `countIn` and `ratio` `v.boolean()` → true; `loop1` integer 1–8 → 3 mapped to `subdivision`; `loop2` integer 1–8 → 6); check `isPlainObject` on `metronome` and `metronome.ratios` before parsing so non-objects give all eight defaults; unknown keys dropped. Serializer appends `metronome` last (after `shortcuts`) only when a value differs from the defaults, with all eight fields in the fixed order and `subdivision` written as `loop1`; `version` stays 1. Add `PRIVACY_CATEGORIES.metronome = ['metronome']`. Make T003 and T004 pass: `pnpm vitest run tests/unit/prefs`.
- [X] T008 Implement the store wiring in `src/lib/state/metronome.svelte.ts` (R-05, R-06): add a private `commit(next)` that assigns `state.settings` and calls `preferences.remember({ metronome: { ratios: next } })` only when `next !== state.settings`; route every settings mutation listed in the contract through it; add `restoreSettings(s)` (halt a live run with the `'leave'` reason, return to the settings phase, clear the position, apply `s` without writing); change `screenChanged()` to halt and return to the settings phase but keep `state.settings` (stop resetting to `DEFAULT_SETTINGS`). `toggle`, `reset` and `resetMetronomeForTests` never write.
- [X] T009 Wire `src/lib/state/preferences.svelte.ts` (R-07): `start()` calls `metronome.restoreSettings(p.metronome.ratios)`; `erase()` calls `metronome.restoreSettings(session.current.metronome.ratios)` after `session.erase()`, or `DEFAULT_PREFERENCES.metronome.ratios` when there is no session. `src/lib/prefs/*` stays imported only here. Make T005 and T006 pass: `pnpm vitest run tests/unit/metronome/store.test.ts tests/unit/state/preferences-store.test.ts tests/unit/erase-preferences.test.ts`.

**Checkpoint**: Codec, store and preferences wiring done. `pnpm vitest run tests/unit/prefs tests/unit/metronome tests/unit/state tests/unit/erase-preferences.test.ts` is green except the superseded 031–034 assertions fixed in T012.

---

## Phase 3: User Story 1 - Settings survive a reload (Priority: P1) 🎯 MVP

**Goal**: All eight settings are kept on the device and restored when the Metronome tool opens (reload, leaving and returning, defaults when nothing is stored).

**Independent Test**: Set 120 BPM, 2 beats and Loop 2 Quintuplets, reload, open the Metronome tool: the settings view shows those values and the rest are default.

### Tests for User Story 1

- [X] T010 [P] [US1] Create `e2e/metronome-remembered.spec.ts` with the US1 scenarios (model the setup on `e2e/preferences.spec.ts`): US1-1 / SC-001 (set 120 / 2 / Loop 2 Quintuplets, reload, check the view); US1-2 (change all eight, turning the ratio off last so Loop 2 is hidden, reload, turn the ratio on, all eight restored including the hidden Loop 2); US1-3 (change BPM, go to Notes, come back, BPM kept); US1-4 (fresh context shows 85 / 4 / Count In on 4·2 / ratio on / 8th Triplets / Sextuplets). Also assert the stored record ends with `metronome.ratios` in key order, and has no `metronome` key once every value is set back to its default.
- [X] T011 [P] [US1] Add a unit test in `tests/unit/metronome/store.test.ts` for FR-002 in-visit memory: set values, call `screenChanged()`, assert the settings are the last values set and `phase === 'settings'`, including when no preferences session exists (storage unavailable).

### Implementation for User Story 1

- [X] T012 [US1] Update the tests that encoded the superseded 031 FR-017 "leaving restores the defaults" rule (R-09): `tests/unit/metronome/store.test.ts` M7 (×2), "Reset keeps the choice; screenChanged restores 3" and S11 now assert that `screenChanged` keeps the last values and clears the run. Run `grep -rn screenChanged tests/unit` and fix any equivalents in `tests/unit/metronome/count-in-settings.test.ts`, `ratio-settings.test.ts` and `panel.test.ts`. Rename the "FR-017: … comes back at 85/4" test title in `e2e/metronome.spec.ts` to say it keeps the settings (behaviour unchanged).
- [X] T013 [US1] Run `pnpm vitest run tests/unit/metronome tests/unit/prefs tests/unit/state`, then `pnpm build:test` and `pnpm test:e2e:fast e2e/metronome-remembered.spec.ts e2e/metronome.spec.ts`.

**Checkpoint**: US1 works on its own. This is the MVP.

---

## Phase 4: User Story 2 - Reset and running position (Priority: P1)

**Goal**: Reset keeps the settings, and a reload mid-run always lands on the settings view with no position restored.

**Independent Test**: Change settings, Start, Pause, Reset, reload: the settings view shows the changed values.

### Tests for User Story 2

- [X] T014 [P] [US2] Add to `e2e/metronome-remembered.spec.ts`: US2-1 (change settings, Start, Pause, Reset, then reload, settings view with the changed values both times); US2-2 / SC-006 (Start, reload mid-run, `data-phase="settings"`, Start begins at `COUNT IN –/k`).
- [X] T015 [P] [US2] Add unit assertions in `tests/unit/metronome/store.test.ts`: Reset keeps the settings and calls no `remember` (FR-003); the failure-view reset (which calls `screenChanged()`) keeps the values; position, `initialTotal` and generation are never part of anything passed to `remember` (FR-004).

### Implementation for User Story 2

- [X] T016 [US2] Verify the behaviour with `pnpm vitest run tests/unit/metronome/store.test.ts` and `pnpm test:e2e:fast e2e/metronome-remembered.spec.ts`. T008 already provides the behaviour, so fix `src/lib/state/metronome.svelte.ts` only if a test fails.

**Checkpoint**: US1 and US2 work.

---

## Phase 5: User Story 3 - Invalid stored values fall back safely (Priority: P2)

**Goal**: A bad stored value replaces only itself, a bad `metronome` entry gives all defaults, and storage failure never shows a new notice.

**Independent Test**: Seed `metronome.ratios.bpm = 900` with other valid values: BPM is 85 and the other seven are as seeded.

### Tests for User Story 3

- [X] T017 [P] [US3] Add to `e2e/metronome-remembered.spec.ts`, seeding the record with `addInitScript`: US3-1 / SC-003 (`bpm` 900 gives 85 and the other seven as seeded); US3-3 (`metronome: []` gives defaults and no notice); US3-4 (`"120"` and 2.5 give the defaults); US3-5 (block `localStorage` with the existing helper from `e2e/preferences.spec.ts`, change BPM, leave and return: BPM kept, no new notice beyond the existing one-time storage notice).
- [X] T018 [P] [US3] Add to `tests/unit/prefs/schema.test.ts` a case that a whole record over 16,384 characters gives all preferences their defaults including the metronome (R5), and that reading `metronome` never alters other fields and writing other preferences never alters `metronome` (FR-009, R6).

### Implementation for User Story 3

- [X] T019 [US3] Run `pnpm vitest run tests/unit/prefs` and `pnpm test:e2e:fast e2e/metronome-remembered.spec.ts`. Fix `src/lib/prefs/schema.ts` only if a test fails.

**Checkpoint**: US1–US3 work.

---

## Phase 6: User Story 4 - Erase clears the metronome settings (Priority: P2)

**Goal**: Erase removes the stored settings, resets the in-memory ones and the privacy text names them in en, pt-BR and es.

**Independent Test**: Set non-default values, use Erase, open the Metronome tool: defaults, also after a reload.

### Tests for User Story 4

- [X] T020 [P] [US4] Add to `e2e/metronome-remembered.spec.ts`: US4-1 / SC-005 (set values, About → Erase → open Metronome shows defaults without a reload, then reload and defaults again). Extend `e2e/privacy.spec.ts` if it asserts the stored list, so it covers the metronome wording.
- [X] T021 [P] [US4] Confirm `tests/unit/i18n/about-catalog.test.ts` and `tests/unit/privacy-policy.test.ts` fail for the new `metronome` category before T022 (C8: every `Preferences` key appears in `PRIVACY_CATEGORIES` and has a privacy statement). Adjust them only if they hard-code the category list.

### Implementation for User Story 4

- [X] T022 [P] [US4] Update `about_privacy_stored` in `messages/en.json` per research R-08: "…sound, volume, tempo; theme; labels, last tool; hints shown; the shortcuts switch; and metronome settings. No cookies are used." (use the exact existing wording for the other items; only the two "and"s become commas, so the twelve statements stay at ≤ 220 words).
- [X] T023 [P] [US4] Update `about_privacy_stored` in `messages/pt-BR.json` so the list ends "…; dicas já mostradas; a chave dos atalhos de teclado; e configurações do metrônomo. Não usamos cookies." (≤ 280 words).
- [X] T024 [P] [US4] Update `about_privacy_stored` in `messages/es.json` so the list ends "…; avisos ya mostrados; el interruptor de atajos de teclado; y ajustes del metrónomo. No se usan cookies." (≤ 280 words).
- [X] T025 [US4] Run `pnpm vitest run tests/unit/i18n/about-catalog.test.ts tests/unit/privacy-policy.test.ts tests/unit/erase-preferences.test.ts`, then `pnpm build:test` and `pnpm test:e2e:fast e2e/metronome-remembered.spec.ts e2e/privacy.spec.ts e2e/preferences.spec.ts`. If Paraglide output needs regenerating, use the project's usual build step.

**Checkpoint**: US1–US4 work.

---

## Phase 7: User Story 5 - Settings are kept per mode (Priority: P3)

**Goal**: Ratios values live under `metronome.ratios`, and entries for other modes neither affect them nor survive a write.

**Independent Test**: Seed `metronome: { ratios: {...}, speed: {...} }`: only the `ratios` values show.

### Tests for User Story 5

- [X] T026 [P] [US5] Add to `e2e/metronome-remembered.spec.ts`: US5-1 (seed a `speed` entry next to `ratios`, only the `ratios` values show). US5-2 (seed an invalid `speed` entry, the tool opens, change a setting, and the stored record no longer has `speed`).
- [X] T027 [US5] Confirm C6 in `tests/unit/prefs/schema.test.ts` uses `metronome-other-mode.txt` (T002/T003). Run `pnpm vitest run tests/unit/prefs/schema.test.ts` and `pnpm test:e2e:fast e2e/metronome-remembered.spec.ts`.

**Checkpoint**: All user stories work.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T028 [P] Check that existing a11y and metronome specs still pass with restored values: `pnpm test:e2e:fast e2e/metronome-a11y.spec.ts e2e/metronome.spec.ts` (R-09: the `countInOff`/`ratioOff` helpers are idempotent).
- [X] T029 [P] Review the diff against FR-013 and FR-014: no change to ranges, defaults, click timing, announcements or shortcuts; metronome settings are not in share links (confirm no link code reads `Preferences.metronome`); `src/lib/prefs/*` is imported only by `preferences.svelte.ts` and tests (`pnpm lint`).
- [X] T030 Run the quickstart §2 scenario table against `e2e/metronome-remembered.spec.ts` and confirm every row has a test.
- [X] T031 Run all local gates once: `pnpm verify` (outside CI it skips screenshot assertions and `e2e/perf.spec.ts`; the bundle-size check must stay ≤ 160 KB gzip and the record well under 16,384 chars). Do not run `pnpm test:e2e` or `pnpm lhci` locally.

> **Run results (T028, T031)**: `pnpm lint`, unit tests, build and the bundle-size check pass. `e2e/metronome-a11y.spec.ts` and `e2e/metronome.spec.ts` pass except the `metronome views` screenshot (Linux baseline only comes from the CI snapshot workflow) and one flaky `US1-2` that passes when rerun alone. `pnpm verify` e2e: 1501 passed; `caged-layers` US1-6 was flaky (passes on rerun); `print.spec.ts` "printed DOM is the same" (CAGED, unrelated to the metronome) still fails locally. Confirm on CI.

> **Manual checks** (record in the PR description; do not block ticking): optional smoke from quickstart §3, with `pnpm dev`: change BPM on `/metronome`, reload, and check `fretboard-master:prefs` in DevTools → Application → Local Storage ends with `"metronome":{"ratios":{…}}`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none. T002 is parallel with T001's reading.
- **Foundational (Phase 2)**: depends on Setup (T002 fixtures feed T003). Blocks all stories. Inside it, tests T003–T006 come first (in parallel), then T007 (codec) → T008 (store) → T009 (preferences store).
- **User Stories (Phase 3–7)**: depend on Phase 2. They share `e2e/metronome-remembered.spec.ts`, so the e2e test tasks (T010, T014, T017, T020, T026) edit the same file and should run in sequence, not in parallel with each other.
- **Polish (Phase 8)**: after all stories.

### User Story Dependencies

- **US1 (P1)**: after Phase 2. T012 (updating the superseded tests) must be done before the Phase 2 checkpoint is fully green.
- **US2 (P1)**: after Phase 2. Independent of US1 except for the shared e2e file.
- **US3 (P2)**: after Phase 2. Independent.
- **US4 (P2)**: after Phase 2. The messages tasks T022–T024 are independent of the other stories. T007 adds the `metronome` privacy category, so the catalog tests fail until they are done.
- **US5 (P3)**: after Phase 2. Independent.

### Parallel Opportunities

- T002 with T001's reading; T003, T004, T005, T006 together (different files).
- T022, T023, T024 together (different catalog files).
- Unit-test tasks T011, T015, T018 edit `store.test.ts` / `schema.test.ts` that Phase 2 also edits, so run them after T003/T005 are committed.

---

## Parallel Example: Foundational tests

```bash
Task: "Extend tests/unit/prefs/schema.test.ts with C1–C7"                 # T003
Task: "Extend tests/unit/prefs/session.test.ts"                           # T004
Task: "Extend tests/unit/metronome/store.test.ts with M-R*/M-W*"          # T005
Task: "Extend tests/unit/state/preferences-store.test.ts + erase test"    # T006
```

## Parallel Example: User Story 4 copy

```bash
Task: "Update about_privacy_stored in messages/en.json"      # T022
Task: "Update about_privacy_stored in messages/pt-BR.json"   # T023
Task: "Update about_privacy_stored in messages/es.json"      # T024
```

---

## Implementation Strategy

### MVP First (US1, plus the shared foundation)

1. Phase 1 → Phase 2 (codec, store, preferences wiring; tests first).
2. Phase 3 (US1): reload and leave-and-return memory, plus the superseded-test updates.
3. **Stop and validate**: `pnpm vitest run` on the touched tests and `pnpm test:e2e:fast e2e/metronome-remembered.spec.ts`.

### Incremental Delivery

1. Add US2 (Reset and run position), then US3 (invalid values), both mostly tests over the foundation.
2. Add US4 (Erase and privacy copy), then US5 (per-mode shape).
3. Polish and a single `pnpm verify`.

---

## Notes

- `[P]` = different files, no dependencies.
- Commit per task or logical group with Conventional Commits.
- Never clamp stored values: out-of-range gives the field's default (900 → 85, not 300).
- The in-memory name of Loop 1 is `subdivision`; the stored key is `loop1`.
