---

description: "Task list for 027 About page, privacy policy and keyboard shortcuts"
---

# Tasks: About Page, Privacy, and Keyboard Shortcuts

**Input**: Design documents from `/specs/027-about-privacy-and-shortcuts/`

**Prerequisites**: plan.md, spec.md, research.md (R-01 … R-16), data-model.md, contracts/pure-api.md, contracts/ui.md, quickstart.md

**Tests**: Included. The spec (FR-019, SC-005, SC-006) and constitution Principle IV require automated, test-first checks. Write each test first and see it fail before the code it covers.

**Organization**: Grouped by user story. Phase order follows priority: US1 (P1) → US3 (P1) → US2 (P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 About content and privacy text, US2 keyboard shortcuts, US3 privacy proof
- Paths are from the repository root (single SvelteKit project)

## Verification during implementation (CLAUDE.md "Verification tiers")

- Per task: `pnpm vitest run <touched test paths>`
- E2E: `pnpm build:test` once after `src/` changes, then `pnpm test:e2e:fast <spec files added or edited>`
- Never run `pnpm test:e2e` or `pnpm lhci` locally. `pnpm verify` once, in the Polish phase.
- A test file that renders a component or touches `document`/`window`/`localStorage` MUST start with `// @vitest-environment jsdom`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Catalog keys in three languages (needed by every story) and the bundle baseline.

- [X] T001 Record the bundle baseline: run `pnpm build && node scripts/check-bundle-size.mjs build` and note the gzip total (expected ≈ 136.9 KB, cap 150 KB) in a comment at the top of `docs/adr/0026-character-key-shortcuts.md` (create the file with a title and "Status: Proposed" only; T049 completes it)
- [X] T002 [P] Add the new catalog keys to `messages/en.json` using the English drafts in data-model.md §4: `about_intro_heading`, `about_legend_heading`, `shortcuts_heading`, `shortcuts_listen`, `shortcuts_next`, `shortcuts_previous`, `shortcuts_labels`, `shortcuts_notation`, `shortcuts_key_period`, `shortcuts_key_comma`, `shortcuts_switch`, `shortcuts_switch_hint`, `about_privacy_heading`, `about_privacy_no_data`, `about_privacy_stored`, `about_privacy_erase`, `about_privacy_not_measured`, `about_privacy_no_ads`, `about_privacy_no_permissions`, `about_privacy_hosting`, `about_privacy_share_links`, `about_privacy_all_ages`, `about_version_heading`; reword `about_description` (keep the phrase "interactive fretboard study tools"). Reuse existing `legend_*`, `about_version`, `about_erase*` unchanged. Privacy keys total ≤ 220 words. `shortcuts_next` and `shortcuts_previous` keep the "(Triads) / (CAGED)" wording; `shortcuts_listen` stays "Listen" (applies to Notes, Triads, CAGED per R-14)
- [X] T003 [P] Add the same keys translated to `messages/pt-BR.json` (privacy keys total ≤ 280 words, plain language, no legal jargon: avoid "controlador", "tratamento", "base legal")
- [X] T004 [P] Add the same keys translated to `messages/es.json` (privacy keys total ≤ 280 words, avoid "responsable del tratamiento", "tratamiento", "base jurídica")
- [X] T005 Run `pnpm vitest run tests/unit/i18n/catalogs.test.ts` and fix any key-parity or placeholder error (depends on T002–T004)

**Checkpoint**: All new strings exist in en, pt-BR, es; parity test passes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Preferences field, pure matcher, switch store and dispatcher. US1 needs the switch store; US2 needs everything here. Test-first.

**⚠️ CRITICAL**: No user story work starts until this phase is complete.

### Preferences field `shortcuts`

- [X] T006 [P] Create the fixture `tests/unit/prefs/fixtures/shortcuts-off.txt` holding the stored record with `"shortcuts":false` as the last key after `theme` (model it on the neighbouring fixtures in that folder; data-model.md §1)
- [X] T007 Extend `tests/unit/prefs/schema.test.ts` (write first, must fail): `parsePreferences` gives `shortcuts: true` for no key, `true` for `"shortcuts": true`, `false` for `"shortcuts": false`, and `true` for `"no"`, `0`, `null` with the other fields kept; `serializePreferences` omits the key when `true` (output byte-identical to slice 026) and appends `"shortcuts":false` last, after `theme`, when `false`; `PREFS_VERSION` still `1`; the totality tests still never throw; the `shortcuts-off.txt` fixture round-trips
- [X] T008 Edit `src/lib/prefs/schema.ts`: add `Preferences.shortcuts: boolean` with `DEFAULT_PREFERENCES.shortcuts = true`, schema `v.fallback(v.boolean(), true)`, serialised only when `false` and appended last (type `boolean`, default `true`, "stored only when false", invalid/absent → `true`). Leave `PREFS_VERSION` at `1` (makes T007 pass)
- [X] T009 [P] Edit `src/lib/prefs/session.ts`: doc comment only, noting `PreferencesPatch` covers `shortcuts` through `Partial`

### Pure matcher

- [X] T010 [P] Write `tests/unit/state/shortcuts.test.ts` (node environment, no docblock; must fail first) per contracts/pure-api.md §2: each key P . , L N in lower and upper case and with `shiftKey` returns its action; `ArrowUp|ArrowDown|ArrowLeft|ArrowRight|' '|Enter|Escape|Tab|Home|End|PageUp|PageDown|F1…F12|Dead|Unidentified` return `null`; each of `ctrlKey|metaKey|altKey|getModifierState('AltGraph')` returns `null`; `repeat`, `defaultPrevented`, `isComposing` return `null`; targets `INPUT[text|search|number|email|url|tel|password]`, `TEXTAREA`, `SELECT`, contenteditable return `null`; targets `INPUT[checkbox|radio|range|button]`, `BUTTON`, `DIV`, an svg group and `null` return the action; `cycle` cases (wrap, no wrap at both ends, current not in list → `null`); the `SHORTCUTS` table order is P . , L N; label option orders are pinned to the prefs codec's `NOTES_LABELS`, `TRIADS_LABELS` and `CAGED_LABELS` order (R-05)
- [X] T011 Create `src/lib/state/shortcuts.ts` (pure, DOM-free): export `ShortcutAction`, `SHORTCUTS`, `ShortcutTarget`, `ShortcutEventLike`, `matchShortcut` (guards before the table: Ctrl/Meta/Alt/AltGraph, `repeat`, `defaultPrevented`, `isComposing`, editable target; Shift ignored; letters compared after `toLowerCase()`; multi-character keys never match), `toShortcutEvent(e: KeyboardEvent)` (reads `tagName`, `type?.toLowerCase()`, `isContentEditable`; non-Element target → `null`) and `cycle<T>(list, current, dir, wrap)` (makes T010 pass)

### Switch store, dispatcher and wiring

- [X] T012 [P] Write `tests/unit/state/shortcuts-store.test.ts` (start with `// @vitest-environment jsdom`; must fail first): `enabled` defaults `true`; `start(false)` sets it without writing; `choose(false)` sets it then calls `preferences.remember({ shortcuts: false })`; `restore(true)` sets it without writing; `runShortcut` per screen against the real stores with spies, covering every cell of contracts/pure-api.md §3: `listen` in notes, triads and caged runs the store's `listen()` when its `display.listen.enabled` is true and returns `false` otherwise, never calls `listenComparison`; Triads `next` goes root → first → second → root and `previous` the reverse (wrap), no-op when `display.controls.inversion` is false (All notes view); CAGED `next` and `previous` call `caged.step(±1)` only when `display.steps.next|previous` is true (no wrap at the ends or with no focus); `labels` cycles Notes name → octave → none → name and Triads/CAGED interval ↔ name; `notation` toggles letters ↔ solfège on every screen including `home` and `about`; `home` and `about` return `false` for listen/next/previous/labels; `focus`, `goto` and DOM APIs are never called
- [X] T013 Create `src/lib/state/shortcuts.svelte.ts`: runes store `shortcuts` (`enabled` getter, `start(stored)`, `choose(on)`, `restore(true)`), `runShortcut(action, screen): boolean` as in contracts/pure-api.md §3 (it does not check `enabled` itself), and `resetShortcutsForTests()`. Use the very store methods the on-screen controls call: `notes|triads|caged.listen`, `triads.setInversion` with `cycle(INVERSIONS, …)` from the theory module's own list, `caged.step`, `*.setLabelType`, `notation.choose` (makes T012 pass)
- [X] T014 Extend `tests/unit/state/preferences-store.test.ts` (must fail first): `start()` calls `shortcuts.start(p.shortcuts)` after `theme.start`, and `erase()` calls `shortcuts.restore(true)` after `theme.restore(null)`
- [X] T015 Edit `src/lib/state/preferences.svelte.ts` to wire `shortcuts.start` and `shortcuts.restore(true)` as in T014 (contracts/pure-api.md §4)
- [X] T016 Run `pnpm vitest run tests/unit/state/shortcuts.test.ts tests/unit/state/shortcuts-store.test.ts tests/unit/prefs/schema.test.ts tests/unit/state/preferences-store.test.ts` and fix failures

**Checkpoint**: Foundation ready. Preferences field, matcher, store and dispatcher are green; user stories can begin.

---

## Phase 3: User Story 1 - Read what the app does with my data (Priority: P1) 🎯 MVP

**Goal**: About shows five `h2` sections in order (intro, marker legend, keyboard shortcuts with switch, privacy with Erase, version), all in en, pt-BR and es.

**Independent Test**: Open `/about` in each of the three languages and confirm every section is present, ordered and translated; `/about#privacy` lands on the Privacy section; Erase still works; switching language updates in place.

### Tests for User Story 1 (write first, must fail)

- [X] T017 [P] [US1] Create `tests/unit/i18n/about-catalog.test.ts`: `findMissingKeys` on the `about_*` and `shortcuts_*` subset of `en` against `pt-BR` and `es` returns `[]` and none is empty; the nine `about_privacy_*` statement keys total ≤ 220 words in en and ≤ 280 words in pt-BR and es; none contains the jargon list from R-10 (en: "data controller", "processing", "lawful basis"; pt-BR: "controlador", "tratamento", "base legal"; es: "responsable del tratamiento", "tratamiento", "base jurídica"); a category → `Preferences` field map kept next to `DEFAULT_PREFERENCES` covers every field in the known-keys list of data-model.md §1 so a new preference with no policy category fails (FR-019(f), SC-006)
- [X] T018 [P] [US1] Create `tests/unit/privacy-policy.test.ts` (`// @vitest-environment jsdom`): `PrivacyPolicy` renders a `ul` of exactly nine `li` in each of en, pt-BR, es, one per statement key, covering statements (1)–(8) including "nothing is measured"; text is rendered as text, never HTML
- [X] T019 [P] [US1] Create `tests/unit/shortcut-list.test.ts` (`// @vitest-environment jsdom`): `ShortcutList` renders a `dl` of five rows in order P, `.`, `,`, L, N with localized actions; `.` and `,` use `<kbd><span aria-hidden="true">.</span><span class="sr-only">period</span></kbd>` with the localized sr-only name; the switch is `input[type=checkbox][role=switch]` named "Keyboard shortcuts", checked when `shortcuts.enabled`, and toggling calls `shortcuts.choose`
- [X] T020 [P] [US1] Edit `tests/unit/erase-preferences.test.ts`: `ErasePreferences` renders a `div` (no nested unnamed `section`); it still confirms, erases, closes on Escape and navigates home
- [X] T021 [US1] Edit `e2e/about.spec.ts`: sections in order (h1, then h2: What this app is, Marker legend, Keyboard shortcuts, Privacy, Version); exactly three legend entries root, third, fifth with shape plus name; "about in each language" for en, pt-BR, es; "switch language on About" keeps the page and URL; `/about#privacy` loaded directly scrolls the Privacy section into view; same check after an in-app `goto` (R-15); axe zero violations in light and dark; the old description regex still matches

### Implementation for User Story 1

- [X] T022 [P] [US1] Create `src/lib/shell/PrivacyPolicy.svelte`: `ul` of nine `li` using the nine `about_privacy_*` message functions in the order of data-model.md §4 (no_data, stored, erase, not_measured, no_ads, no_permissions, hosting, share_links, all_ages); tokens only for spacing and type; no raw text
- [X] T023 [P] [US1] Create `src/lib/shell/ShortcutList.svelte`: `dl` of five rows (`dt > kbd`, `dd` localized action) from `SHORTCUTS`, then `<label>` wrapping `input[type=checkbox][role=switch]` (`checked={shortcuts.enabled}`, `onchange` → `shortcuts.choose(checked)`), then the `shortcuts_switch_hint` text; target ≥ `--target-min` (44 px); every visual value a token
- [X] T024 [P] [US1] Edit `src/lib/shell/ErasePreferences.svelte`: outer `<section>` → `<div>`; behaviour unchanged (R-09)
- [X] T025 [US1] Edit `src/routes/about/+page.svelte`: `h1` (keep `tabindex=-1`), then five `<section aria-labelledby>` blocks in FR-001 order, each with an `h2`: intro (`about_description`), legend (`ul` of three `li`: `MarkerSample` root, third, fifth with `aria-hidden` plus existing `legend_*_name` and `legend_*_meaning`), shortcuts (`ShortcutList`), privacy (`id="privacy"`: `PrivacyPolicy` then `ErasePreferences`), version (`about_version` with `__APP_VERSION__`). Single scrolling page at 320–2560 px, no horizontal scroll
- [X] T026 [US1] Edit `src/routes/+layout.svelte` `afterNavigate`: skip the `h1` focus when `to.url.hash` is non-empty and focus the target section's heading instead (R-15)
- [X] T027 [US1] Update `e2e/preferences.spec.ts`: locate **Erase my preferences** inside `#privacy` by role and name (not `section.erase`); after confirm the app is on Home
- [X] T028 [US1] Run `pnpm vitest run tests/unit/i18n/about-catalog.test.ts tests/unit/i18n/catalogs.test.ts tests/unit/privacy-policy.test.ts tests/unit/shortcut-list.test.ts tests/unit/erase-preferences.test.ts`, then `pnpm build:test` and `pnpm test:e2e:fast e2e/about.spec.ts e2e/preferences.spec.ts`

**Checkpoint**: US1 complete and independently testable. About is fully built and translated; this is the MVP (privacy text is the launch blocker).

---

## Phase 4: User Story 3 - Trust the app on first load (Priority: P1)

**Goal**: Automated checks fail the merge gate when the app makes a third-party request, calls a permission API, sets a cookie, uses foreign storage keys, shows identity inputs, stores unknown preference fields, or widens the CSP.

**Independent Test**: Run the new unit and e2e checks. They pass on the current app; breaking any rule (for example adding an external origin to the CSP) makes one fail.

### Tests for User Story 3

- [X] T029 [P] [US3] Create `tests/unit/csp.test.ts` (node): import the CSP from `svelte.config.js`; every directive value is one of `self`, `none`, `data:` (no scheme-host source); `script-src` and `connect-src` are exactly `['self']`. Assert `svelte.config.js` and `static/_headers` stay unchanged by this slice (no edits to either file)
- [X] T030 [P] [US3] Extend `tests/unit/prefs/schema.test.ts` with a known-keys case: for an all-non-default record, the keys of `JSON.parse(serializePreferences(p))` are a subset of `version, strings, tuning, customTuning, frets, muted, volume, lastTool, labels, handedness, orientation, rotateHint, tempo, language, notation, accidentals, cagedNote, theme, shortcuts`, and no key matches `/id|uuid|time|date|stamp|session|user/i` (FR-019(e))
- [X] T031 [US3] Create `e2e/privacy.spec.ts` (fresh context per test, desktop): `context.on('request')` log; `context.addInitScript` spies counting calls to `navigator.mediaDevices.getUserMedia`, `navigator.geolocation.getCurrentPosition`/`watchPosition`, `Notification.requestPermission`, `navigator.permissions.query`, `navigator.requestMIDIAccess` on `window.__permissionCalls`; `page.on('dialog')` fails the test. Pass: `/` → `/notes` (pick a note, Listen) → `/triads` (Listen, Share; accept clipboard or `ShareFallback`, no prompt either way) → `/caged` (Listen, open the instrument panel) → `/about` (open the language panel, switch language, toggle the shortcuts switch). Assert every request origin equals the app origin (ignore `data:` and `blob:`), all spy counts are 0, `context.cookies()` is `[]`, every `localStorage` key starts with `fretboard-master:`, and `input[type=email],input[type=password],input[type=tel]` has count 0 on `/`, `/notes`, `/triads`, `/caged`, `/about`
- [X] T032 [US3] Run `pnpm vitest run tests/unit/csp.test.ts tests/unit/prefs/schema.test.ts tests/unit/headers.test.ts`, then `pnpm build:test` and `pnpm test:e2e:fast e2e/privacy.spec.ts`; fix any app finding the checks reveal (do not weaken the assertions)

**Checkpoint**: US1 and US3 both green. The P1 launch blockers are done.

---

## Phase 5: User Story 2 - Use keyboard shortcuts for frequent actions (Priority: P2)

**Goal**: P, `.`, `,`, L, N act exactly like the matching on-screen control, never clash with browser or screen-reader keys, and can be turned off.

**Independent Test**: On desktop in Triads, CAGED and Notes press each shortcut and compare with the control; type in the custom-tuning field and hold Ctrl/Alt/Meta (nothing fires); turn the switch off, reload (stays off), Erase (on again).

### Tests for User Story 2 (write first, must fail)

- [X] T033 [P] [US2] Edit `tests/unit/triads/choice-group.test.ts`: `ChoiceGroup` with `keyshortcuts="L"` renders `aria-keyshortcuts="L"` on the `role="radiogroup"` element; with the prop omitted the attribute is absent
- [X] T034 [P] [US2] Edit `tests/unit/notation-toggle.test.ts`: `aria-keyshortcuts="N"` present while `shortcuts.enabled`, absent after `shortcuts.choose(false)`; call `resetShortcutsForTests()` in `afterEach`
- [X] T035 [P] [US2] Create `tests/unit/shortcut-attributes.test.ts` (`// @vitest-environment jsdom`): `aria-keyshortcuts` only while on, absent while off: Notes Listen `P`; Triads main Listen `P` (Listen comparison has none); CAGED Listen `P`; CAGED Previous shape `,` and Next shape `.`; Triads inversion radiogroup `. ,`; label-type radiogroups of Notes, Triads and CAGED `L`
- [X] T036 [US2] Create `e2e/shortcuts.spec.ts` (desktop), one test per scenario, comparing against the on-screen control: US2-1 `P` in Triads starts the sequence (existing playback test hook, not real audio); `P` in Notes and CAGED likewise; US2-2 `.`/`,` move the inversion (root → 1st → 2nd → root, and back); US2-3 `.`/`,` step CAGED shapes and stop at the ends with no wrap; US2-4 `L` and `N` switch and persist across reload; US2-5 `p`, `.`, `n` typed in the custom-tuning text field do nothing, and Ctrl/Alt/Meta + key does nothing; US2-7 switch off → no shortcut fires on any screen, stays off after reload, Erase turns it on; US2-8 wrap and no-wrap; US2-9 Notes `L` cycles name → octave → none → name and `N` toggles letters ↔ solfège on Home and About too; `aria-keyshortcuts` present while on and absent while off; focus does not move; no-op keys are not `preventDefault`ed

### Implementation for User Story 2

- [X] T037 [US2] Edit `src/routes/+layout.svelte`: add `<svelte:window onkeydown={…} />` (bubble phase) exactly as contracts/pure-api.md §5: return when `!shortcuts.enabled`; `matchShortcut(toShortcutEvent(e))`; `preventDefault()` only when `runShortcut(action, screen)` returned `true`; use the layout's existing `screen` derived value
- [X] T038 [P] [US2] Edit `src/lib/tools/ChoiceGroup.svelte`: add optional prop `keyshortcuts?: string` rendered as `aria-keyshortcuts` on the `role="radiogroup"` element; omitted when `undefined` (makes T033 pass)
- [X] T039 [P] [US2] Edit `src/lib/shell/NotationToggle.svelte`: `aria-keyshortcuts="N"` while `shortcuts.enabled`, otherwise `undefined` (makes T034 pass)
- [X] T040 [P] [US2] Edit `src/lib/tools/notes/NotesActions.svelte`: Listen button `aria-keyshortcuts="P"` and label-type group `keyshortcuts="L"`, both only while `shortcuts.enabled`
- [X] T041 [P] [US2] Edit `src/lib/tools/triads/TriadsSecondary.svelte`: main Listen button `aria-keyshortcuts="P"` (not Listen comparison) and label-type group `keyshortcuts="L"`, both only while `shortcuts.enabled`
- [X] T042 [P] [US2] Edit `src/lib/tools/triads/TriadsControls.svelte`: inversion `ChoiceGroup keyshortcuts=". ,"` only while `shortcuts.enabled`
- [X] T043 [P] [US2] Edit `src/lib/tools/caged/CagedListen.svelte`: Listen button `aria-keyshortcuts="P"` only while `shortcuts.enabled`
- [X] T044 [P] [US2] Edit `src/lib/tools/caged/CagedTool.svelte`: Previous shape `aria-keyshortcuts=","`, Next shape `aria-keyshortcuts="."`, label-type group `keyshortcuts="L"`, each only while `shortcuts.enabled`
- [X] T045 [US2] Run `pnpm vitest run tests/unit/triads/choice-group.test.ts tests/unit/notation-toggle.test.ts tests/unit/shortcut-attributes.test.ts tests/unit/state/shortcuts.test.ts tests/unit/state/shortcuts-store.test.ts`, then `pnpm build:test` and `pnpm test:e2e:fast e2e/shortcuts.spec.ts e2e/about.spec.ts`

**Checkpoint**: All three stories work independently and together.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T046 Check 320 px and 200 % text in en, pt-BR and es on `/about` (no truncation, no horizontal scroll, switch target ≥ 44 px); fix with tokens only, no hard-coded visual values (Principle VII, VIII)
- [X] T047 Re-measure the bundle: `pnpm build && node scripts/check-bundle-size.mjs build`; expect ≈ 139–140 KB gzip, under 150 KB; record the result in the ADR (R-13)
- [X] T048 [P] Confirm `no-raw-text` lint passes on the new components and that `svelte.config.js` and `static/_headers` have no diff (`rtk git diff --stat`)
- [X] T049 [P] Complete `docs/adr/0026-character-key-shortcuts.md` (R-16): produced-character matching, the guard set, the single window listener in the layout, state-flag gating instead of DOM clicks, the off switch for WCAG 2.1.4, `P` in Notes (R-14), and the bundle numbers from T001/T047
- [X] T050 Walk through quickstart.md §2 manual smoke steps 1–7 on desktop and tick the scenario → test map in §4
- [X] T051 Run all local gates once: `pnpm verify` (full Playwright matrix and Lighthouse run in CI only; do not run `pnpm test:e2e` or `pnpm lhci` locally)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none; start immediately.
- **Foundational (Phase 2)**: needs Setup (catalog keys for T013's consumers; schema work is independent). Blocks all stories.
- **US1 (Phase 3, P1)**: needs Foundational (`shortcuts` store for `ShortcutList`).
- **US3 (Phase 4, P1)**: needs Foundational (schema `shortcuts` field for the known-keys case) and US1 (the `/about` page and language/shortcuts switch exercised by the e2e pass). Its unit tasks (T029, T030) can start after Foundational.
- **US2 (Phase 5, P2)**: needs Foundational; its e2e needs the switch from US1 (T023, T025) for the off/erase scenario.
- **Polish (Phase 6)**: after all stories.

### Within Each Story

- Tests first and failing, then implementation (T007→T008, T010→T011, T012→T013, T014→T015).
- T025 depends on T022, T023, T024. T037 depends on T011 and T013.
- T040–T044 depend on T038 (the `keyshortcuts` prop) where they use `ChoiceGroup`.

### Parallel Opportunities

- Setup: T002, T003, T004 in parallel.
- Foundational: T006, T009, T010, T012 in parallel with each other (different files); the schema chain T007→T008 is separate from the matcher chain T010→T011.
- US1: T017–T020 in parallel; T022, T023, T024 in parallel.
- US3: T029 and T030 in parallel.
- US2: T033–T035 in parallel; T038–T044 in parallel (different files; T040–T044 after T038).
- After Foundational, US1 and US2 implementation can run in parallel by different developers; US3 follows US1.

### Parallel Example: User Story 1

```text
Task: "Create tests/unit/i18n/about-catalog.test.ts"
Task: "Create tests/unit/privacy-policy.test.ts"
Task: "Create tests/unit/shortcut-list.test.ts"
Task: "Create src/lib/shell/PrivacyPolicy.svelte"
Task: "Create src/lib/shell/ShortcutList.svelte"
Task: "Edit src/lib/shell/ErasePreferences.svelte (section → div)"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup, then Phase 2 Foundational.
2. Phase 3 US1: About with privacy text in three languages.
3. **STOP and VALIDATE**: `e2e/about.spec.ts`, catalog tests, axe.
4. Add US3 (privacy proof), also P1 and needed for launch.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 → validate → demo (MVP).
3. US3 → validate; merge gate now proves the privacy promise.
4. US2 → validate; comfort feature for desktop users.
5. Polish → `pnpm verify` once.

---

## Notes

- Spec correction R-14 is already applied: `P` also triggers Listen in Notes (gated by `notes.display.listen.enabled`).
- No new runtime or dev dependency; no change to `svelte.config.js` CSP, `static/_headers` or `PREFS_VERSION`.
- Commit after each task or logical group; stop at any checkpoint to validate a story.
