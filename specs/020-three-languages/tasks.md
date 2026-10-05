---

description: "Task list for 020 English, Portuguese, and Spanish"
---

# Tasks: English, Portuguese, and Spanish

**Input**: Design documents from `/specs/020-three-languages/`

**Prerequisites**: plan.md, spec.md, research.md (R-01…R-16), data-model.md, contracts/language-api.md, contracts/language-ui.md, quickstart.md

**Tests**: INCLUDED. Constitution IV (test-first) and plan.md require unit tests written first and failing, then e2e specs mapped from quickstart.md.

**Organization**: Grouped by user story. US1 and US2 are both P1; US3/US4 are P2; US5 is P3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- **[Story]**: US1…US5; none for Setup, Foundational, Polish

## Verification during implementation (from CLAUDE.md)

- Unit: `pnpm vitest run <touched test paths>`
- E2E: `pnpm build:test` once (after `src/` changes), then `pnpm test:e2e:fast <spec files>` (desktop project only)
- New or changed screenshot: `pnpm playwright test <spec> -g "<test name>" --project=phone --project=phone-touch --project=desktop --update-snapshots`
- End of slice, once: `pnpm verify`
- Do NOT run `pnpm test:e2e` (full matrix) or `pnpm lhci` locally.
- Commit with Conventional Commits.

---

## Phase 1: Setup

**Purpose**: Locale registration, build-time constants, and lint boundary shared by all stories.

- [X] T001 Register locales `["en", "pt-BR", "es"]` (in that order) in `project.inlang/settings.json`
- [X] T002 [P] Create `messages/pt-BR.json` and `messages/es.json` as copies of `$schema` + the five new keys only for now (`language_label`, `language_open`, `language_close`, `language_panel_label`, `language_autonym`); other keys fall back to English until US3. Add the five keys to `messages/en.json`: `language_label` = "Language", `language_open` = "Language", `language_close` = "Close language settings", `language_panel_label` = "Language settings", `language_autonym` = "English". pt-BR: "Idioma" / "Idioma" / "Fechar configurações de idioma" / "Configurações de idioma" / "Português". es: "Idioma" / "Idioma" / "Cerrar ajustes de idioma" / "Ajustes de idioma" / "Español".
- [X] T003 [P] Add ESLint boundary for `src/lib/i18n/**` in `eslint.config.js` mirroring `src/lib/notation/**` (restrict `navigator`, `window`, `document`, `localStorage`, Svelte and Paraglide imports)
- [X] T004 [P] Declare `__FM_MISSING_TEXT__: Readonly<Record<'en' | 'pt-BR' | 'es', readonly string[]>>` in `src/app.d.ts`
- [X] T005 [P] Set `use.locale: 'en-US'` in `playwright.config.ts`, `pw.local.config.ts`, `playwright.local.config.ts`, and `pw.ff.config.ts` (R-12) so existing English e2e assertions stay deterministic

**Checkpoint**: `pnpm check` compiles three locales.

---

## Phase 2: Foundational (blocking)

**Purpose**: Pure language data, gap logic, prefs field, and the reactive store. All stories need these.

### Tests first (must FAIL before implementation)

- [X] T006 [P] Write `tests/unit/i18n/languages.test.ts`: full `matchDeviceLanguage` table from contracts/language-api.md §1 plus SC-002's ten device cases; `isLanguageTag`; `LANGUAGES` order/unique `primary`; `LANGUAGES` tags equal Paraglide `locales` (from `$lib/paraglide/runtime.js`) and `project.inlang/settings.json` `locales` (R-15)
- [X] T007 [P] Write `tests/unit/i18n/gaps.test.ts`: `findMissingKeys` (absent, empty string, `$schema` ignored, non-string-or-array value) and `takeUnreported` (once per `locale:key`)
- [X] T008 [P] Write prefs tests in `tests/unit/prefs/` for the `language` field plus fixtures `tests/unit/prefs/fixtures/language-pt.txt` (valid `pt-BR`), `language-es.txt`, `bad-language.txt` (`"language":"pt"` → `null`, other fields kept), `language-number.txt` (`"language":3` → `null`). Assert a record without `language` serializes byte-identically to slice 019 output and `language` is serialized after `tempo` only when non-null. Fixtures are add-only.

### Implementation

- [X] T009 [P] Implement `src/lib/i18n/languages.ts`: `LANGUAGES`, `LanguageTag`, `LANGUAGE_TAGS`, `BASE_LANGUAGE`, `isLanguageTag`, `matchDeviceLanguage` (trim; skip tags not matching `/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/`; case-insensitive primary subtag; first hit wins; default `en`; never throws) per data-model §1 and R-03
- [X] T010 [P] Implement `src/lib/i18n/gaps.ts`: `findMissingKeys`, `takeUnreported`, `GAP_WARNING = '[fretboard-master] missing text'` per contracts/language-api.md §2
- [X] T011 Add `language` field to `src/lib/prefs/schema.ts`: `language: v.fallback(v.nullable(v.picklist(LANGUAGE_TAGS)), null)`, `DEFAULT_PREFERENCES.language = null`, serialize `...(p.language === null ? {} : { language: p.language })` after `tempo`; `PREFS_VERSION` stays `1` (depends on T009)
- [X] T012 Define `__FM_MISSING_TEXT__` in `vite.config.ts` (build and Vitest): read `messages/*.json`, call `findMissingKeys` per non-base locale via relative import of `src/lib/i18n/gaps.ts`; `en` always `[]` (depends on T010)
- [X] T013 [P] Write `tests/unit/language-store.test.ts` (test-first): `start(null)` with device `['pt-PT']` → `pt-BR` and no storage write; `start('es')` → `es`; `choose('es')` writes `"language":"es"` including when re-picking the active language; `restore(null)` re-resolves from device with no write; storage unavailable → switch still holds; sets `document.documentElement.lang`; never calls `fetch`, `history.pushState/replaceState`, or reloads
- [X] T014 Implement `src/lib/state/language.svelte.ts` per contracts/language-api.md §3: `$state` `current` and `chosen`; first `start` installs `overwriteGetLocale(() => current)` and `overwriteSetLocale` from `$lib/paraglide/runtime.js`; device tags from `navigator.languages` else `[navigator.language]` else `[]` (guard missing `navigator`); apply sets `document.documentElement.lang` and reports gaps; export `resetLanguageForTests` (depends on T009, T010, T012, T013)
- [X] T015 Wire `src/lib/state/preferences.svelte.ts`: `start()` calls `language.start(p.language)` after existing restores (before hydration via `src/hooks.client.ts`); `erase()` calls `language.restore(null)` (depends on T011, T014)
- [X] T016 Make `Intl.ListFormat` in `src/lib/notation/notation.ts` use the reactive `getLocale()` so `spokenNoteList` follows the active language; add a unit assertion in `tests/unit/` for es/pt-BR list joining

**Checkpoint**: `pnpm vitest run tests/unit/i18n tests/unit/language-store.test.ts tests/unit/prefs` green; `pnpm check` green.

---

## Phase 3: User Story 1 - First visit speaks my language (P1) 🎯 MVP

**Goal**: With no stored choice, interface appears in the device language (en/pt/es by primary subtag), else English; detection never writes storage.

**Independent Test**: Open with device locales pt-PT, fr, es-MX, `["fr-FR","es-MX"]`; check `<html lang>` and absence of stored `language`.

### Tests (write first)

- [X] T017 [US1] Write `e2e/languages.spec.ts` detection block: `test.use({ locale })` for pt-PT, pt-BR, es-ES, es-MX, es-419, en-GB, en-US, fr, ja expecting `<html lang>` pt-BR, pt-BR, es, es, es, en, en, en, en (SC-002); `addInitScript` defining `navigator.languages = ['fr-FR','es-MX']` → `es`; pt-PT with no stored record → `localStorage` has no `language` (US1-5); first load in es/pt-BR emits no `hydration_mismatch` console message (FR-014)

### Implementation

- [X] T018 [US1] Confirm `src/hooks.client.ts` `init` calls `preferences.start()` before hydration so the first interactive render, `<html lang>`, and `<title>` are in the resolved language; adjust only if not already so (depends on T015). Keep `src/app.html` `lang="en"` for prerender.
- [X] T019 [US1] Run `pnpm build:test` then `pnpm test:e2e:fast e2e/languages.spec.ts`; fix hydration warnings if any (mirror ADR 0013 restore pattern)

**Checkpoint**: US1 works with English fallback text (catalogs finished in US3).

---

## Phase 4: User Story 2 - Switch language anywhere without losing work (P1)

**Goal**: Selector inline on home; "Language" app-bar button and non-modal panel on `/notes`, `/triads`, `/caged`, `/about`. Switch is instant, no reload/URL/network change, state preserved, choice remembered.

**Independent Test**: Set up a Triads comparison, switch English → Español through the panel; comparison stays, text Spanish, root label "T", URL and `history.length` unchanged, zero requests.

### Tests (write first)

- [X] T020 [P] [US2] Write `tests/unit/language-selector.test.ts`: exactly three radios in order English, Português, Español with `lang` `en`/`pt-BR`/`es`; autonyms (from `language_autonym` in each option's own locale) and order constant under all three active languages; checked radio = `language.current`; legend translated; `change` calls `language.choose`; re-render without remount keeps the focused radio focused
- [X] T021 [P] [US2] Write `tests/unit/language-panel.test.ts`: `LanguageButton` has `aria-expanded`/`aria-controls`; panel is `role="region"` with `aria-label`, not `<dialog>`; Escape inside panel and close button close it and return focus to the button; picking a language leaves it open; no history/URL change
- [X] T022 [US2] Extend `e2e/languages.spec.ts` with: US2-1 (Triads comparison survives English → Español, root "T"); US2-2/SC-008 (every tool: open panel, pick; same URL, `history.length`, zero requests via `page.on('request')`, focus/scroll/playback unchanged); US2-3 (pick Português, reload with device en-US stays Portuguese); US2-4 (home inline selector with `lang`s); US2-5 (`<html lang>` and `document.title` update, e.g. Triads title in new language); US2-6 (instrument panel/notice stays open with updated text); erase preferences in About returns to device language immediately (R-14)

### Implementation

- [X] T023 [P] [US2] Create `src/lib/shell/LanguageSelector.svelte`: `<fieldset>` + translated `<legend>` (`m.language_label()`), three native radios from `LANGUAGES`, labels `m.language_autonym({}, { locale: tag })` (catalog, never literals), per-label `lang`, `change` → `language.choose(value)`, targets ≥ `--target-min`, tokens only (contracts/language-ui.md §1)
- [X] T024 [P] [US2] Create `src/lib/shell/LanguageButton.svelte`: `<button aria-expanded aria-controls>` labelled `m.language_open()`
- [X] T025 [US2] Create `src/lib/shell/LanguagePanel.svelte`: non-modal disclosure in header flow, `role="region"` `aria-label={m.language_panel_label()}`, contains `LanguageSelector` and a close button (`m.language_close()`); Escape and close return focus to the button; component-local `$state` open flag; no trap, backdrop, or history entry (depends on T023, T024)
- [X] T026 [US2] Render inline `LanguageSelector` in the top bar of `src/lib/shell/HomeScreen.svelte` (also the 404 home) (depends on T023)
- [X] T027 [P] [US2] Add `LanguageButton` + `LanguagePanel` to the header in `src/lib/shell/ToolLayout.svelte` (depends on T025)
- [X] T028 [P] [US2] Add `LanguageButton` + `LanguagePanel` to the header in `src/routes/about/+page.svelte` (depends on T025)
- [X] T029 [US2] Audit `m.*()` call sites for module-top-level constants or non-reactive caches under `src/lib/` and `src/routes/` (e.g. `rg 'm\.' src | rg -v '\$derived|\{'`); move any such string into `$derived` or a function so it re-evaluates on switch
- [X] T030 [US2] Run `pnpm vitest run tests/unit/language-selector.test.ts tests/unit/language-panel.test.ts`, then `pnpm build:test` and `pnpm test:e2e:fast e2e/languages.spec.ts`

**Checkpoint**: US1 + US2 deliver the mechanism end to end (MVP). Text beyond the new keys is still English until US3.

---

## Phase 5: User Story 3 - Every text and term is correct in each language (P2)

**Goal**: All ~357 messages exist in pt-BR and es, follow the glossary, no mixed languages; fragments and concatenations replaced by parameterized messages; glossary list for native review.

**Independent Test**: Run catalog completeness test; visit each screen per language and compare against glossary.

### Tests (write first)

- [X] T031 [P] [US3] Write `tests/unit/i18n/catalogs.test.ts` (R-08): identical key sets (ignore `$schema`); non-empty values; identical `{placeholder}` sets per key; non-English value ≠ English unless in allowlist; allowlist entries must exist and be identical (no stale); `settings.json` locales equal `LANGUAGES` tags; `interval_root` = `R`/`T`/`T`; `note_spoken_sharp` keeps `{letter}`
- [X] T032 [P] [US3] Create `tests/unit/i18n/identical-allowlist.ts` seeded per data-model §4: `app_name`, `title_screen`, `tuning_af4`, `tuning_af5`, `tuning_af6`, `tuning_af7`, `tuning_af23`, `sound_volume_value`, `note_spoken_natural`, `card_label`, plus non-root interval keys and any other symbol-only value discovered while drafting
- [X] T033 [P] [US3] Write `tests/unit/i18n/glossary.test.ts`: every key cited in `docs/i18n/glossary.md` exists in all three catalogs
- [X] T034 [P] [US3] Add tests for fragment-concatenation removal in `tests/unit/` for `src/lib/state/triads-model.ts` and `src/lib/state/caged-model.ts` (chain-wide suffix and `caged_layer_counts` produce single-message output in es and pt-BR, e.g. pt "notas da pentatônica")

### Implementation

- [X] T035 [US3] Fragment audit (R-07): in `src/lib/state/triads-model.ts` replace `${name}${m.triads_desc_chain_wide()}` and `m.triads_desc_chain_entry(...) + m.triads_desc_chain_wide()` with single parameterized messages; in `src/lib/state/caged-model.ts` replace `caged_layer_counts` `"{count} {layer} notes"` (translated layer word inserted) with per-variant messages; update `messages/en.json` accordingly; grep other `m.*` results being concatenated or joined and fix; keep `list.join(', ')` for fret lists. Keep `_one`/`_other` pairs for counts, selected by `count === 1`; add a pair for any new count message.
- [X] T036 [US3] Draft `messages/pt-BR.json`: every key in `messages/en.json`, Brazilian Portuguese, "você", calm-teacher voice, glossary terms from `specs/autonomous/fretboard-master/10-glossary.md` §4; `interval_root` = "T"; `note_spoken_sharp` = "{letter} sustenido" (and flat, double variants); tuning names: keep Drop D/Drop C/Double Drop D/Drop A/DADGAD, translate others ("Afinação padrão", "Aberta em G", "Meio tom abaixo", …); `app_name` unchanged; same `{placeholders}` as English
- [X] T037 [P] [US3] Draft `messages/es.json`: same rules, neutral Latin-American-friendly Spanish, "tú", "diapasón", "cuerda al aire", ordinals "1.ª"; `interval_root` = "T"; `note_spoken_sharp` = "{letter} sostenido"; tuning names ("Afinación estándar", "Abierta en G", "Medio tono abajo", …) (T036 and T037 can proceed in parallel)
- [X] T038 [US3] Make notices fit two lines at 320 px / 100 % text: shorten any pt-BR/es notice copy that wraps beyond two lines (measured in US4's e2e; adjust copy here)
- [X] T039 [P] [US3] Create `docs/i18n/glossary.md` per R-13 / data-model §6: columns English, Português (Brasil), Español, Keys, Review (`draft`); one row per musical term used in the UI; include the translated tuning-name family flagged for native review
- [X] T040 [US3] Run `pnpm check` and `pnpm vitest run tests/unit/i18n tests/unit/` touched models; fix until zero missing/empty/extra/identical entries (SC-001)
- [X] T041 [US3] Measure bundle right after catalogs land: `pnpm build && node scripts/check-bundle-size.mjs build`; expect ≈115–117 KB ≤ 120 KB. If it fails: shorten verbose catalog prose in all three languages first; only then raise an amendment (R-06).
- [X] T042 [US3] Extend `e2e/languages.spec.ts` with per-screen sample (contracts/language-ui.md §6): for each language visit `/`, `/notes`, `/triads`, `/caged`, `/about`; assert `<html lang>` and texts read from `messages/<tag>.json` by key (`nav_home`, `nav_about`, `tool_notes_name`, `tool_triads_question`, `about_heading`, `fretboard_description_show`, `language_label`, `tuning_af1`, plus `tuning_af4` = "Drop D"); assert root label R/T/T and that letter note names and ♯ ♭ 𝄪 𝄫 are unchanged

**Checkpoint**: US3 complete; every screen is single-language per active language.

---

## Phase 6: User Story 4 - Layout survives longer text (P2)

**Goal**: No truncation or overlap at 320 px width and 200 % root text in any language; only the fretboard scrolls horizontally; notices ≤ 2 lines at 100 %.

**Independent Test**: Run `e2e/languages-layout.spec.ts` across 7 views × 3 languages × {100 %, 200 %}.

### Tests (write first)

- [X] T043 [US4] Add helpers `expectNoTruncationOrOverlap(page)` and `setTextScale(page, pct)` to `e2e/support/helpers.ts` per R-11 (scrollWidth/scrollHeight overflow with non-visible overflow, `text-overflow: ellipsis`, pairwise interactive bounding-box intersection, `documentElement.scrollWidth ≤ innerWidth`; fretboard scroller excluded)
- [X] T044 [US4] Write `e2e/languages-layout.spec.ts`: viewport 320×640; for each language × {100 %, 200 % via `document.documentElement.style.fontSize = '200%'`} × {home, Notes, Triads, CAGED, About, instrument panel open, language panel open} run the helper; at 100 % assert each visible notice's text height ≤ 2 × computed `line-height` (SC-004, SC-005) (depends on T043)

### Implementation

- [X] T045 [US4] Run `pnpm build:test` then `pnpm test:e2e:fast e2e/languages-layout.spec.ts`; record failures
- [X] T046 [P] [US4] Fix layout failures in `src/lib/shell/*.svelte` and component CSS: `flex-wrap` on bars, `min-inline-size: 0` and `overflow-wrap: anywhere` on long labels, remove fixed `ch` widths for translated text, no `text-overflow: ellipsis` on translatable text; use existing tokens, add none unless required
- [X] T047 [US4] Re-run `pnpm test:e2e:fast e2e/languages-layout.spec.ts` until green; add axe checks on the new specs (`@axe-core/playwright`) for selector and language panel (WCAG 3.1.1/3.1.2)

**Checkpoint**: SC-004 and SC-005 satisfied.

---

## Phase 7: User Story 5 - Missing text falls back gracefully (P3)

**Goal**: A missing text in the active non-English language shows English, with exactly one console warning per key per locale per session; a key missing from English fails `pnpm check`.

**Independent Test**: Fixture catalog with one key removed from `pt-BR`.

### Tests (write first)

- [X] T048 [P] [US5] Write `tests/unit/i18n/paraglide-fallback.test.ts` (R-04): compile a fixture inlang project into a temp dir with `paraglide-js compile --strategy baseLocale` (key removed from `pt-BR`); assert English text for `pt-BR` and Portuguese for others
- [X] T049a [P] [US5] Write `tests/unit/i18n/missing-base-key.test.ts` (US5-2): reuse T048's temp-dir fixture compile, add a `.ts` file calling `m.not_a_key()` from the compiled messages, type-check it in-process with the TypeScript compiler API (`ts.createProgram` + `getPreEmitDiagnostics`, project `tsconfig` options), and assert a TS2339 diagnostic containing "Property 'not_a_key' does not exist"; a control file calling an existing key yields zero diagnostics
- [X] T049 [P] [US5] Extend `tests/unit/language-store.test.ts`: with `__FM_MISSING_TEXT__` stubbed (`{ 'pt-BR': ['some_key'] }`), activating `pt-BR` emits exactly one `console.warn('[fretboard-master] missing text', { key, locale })`; repeat activation and re-render emit none; `fetch` and `localStorage.setItem` spies uncalled (SC-007)

### Implementation

- [X] T050 [US5] Verify `reportGaps` in `src/lib/state/language.svelte.ts` (T014) meets T049; fix if not
- [X] T051 [US5] Make T049a pass (no product code expected: Paraglide's typed message exports already reject unknown keys); `pnpm check` type-checks the same way, so the test proves a key missing from English fails `pnpm check`

**Checkpoint**: All five stories independently functional.

---

## Phase 8: Polish & Cross-Cutting

- [X] T052 [P] Write ADR `docs/adr/0019-reactive-locale-and-device-language.md` covering R-01, R-02, R-03, and R-04 (reactive locale via `overwriteGetLocale`, init-time resolution, activation-time gap warnings)
- [X] T053 [P] Add the fourth-language check to `tests/unit/i18n/languages.test.ts` if not already covered: `LANGUAGES`, `settings.json`, and Paraglide `locales` agree (FR-013, R-15); document the "add a language" steps (catalog file + `locales` entry + `LANGUAGES` row) in `docs/i18n/glossary.md` or the ADR
- [X] T054 [P] Update `CLAUDE.md`/README or docs index only if existing docs list i18n behavior; keep note names and accidental notation untouched (slice 002)
- [X] T055 Re-run `rg 'm\.' src` grep review for module top-level constants and new raw English text; confirm the no-raw-text test still passes
- [X] T056 Add or update screenshot baselines only if a new test added one (command in "Verification during implementation")
- [X] T057 Run quickstart.md validation: unit list (§1), `pnpm build:test` + `pnpm test:e2e:fast e2e/languages.spec.ts e2e/languages-layout.spec.ts` (§3), bundle budget (§5)
- [X] T058 Run all local gates once: `pnpm verify` (full Playwright matrix, Lighthouse run in CI only)

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (1)**: none
- **Foundational (2)**: after Setup; BLOCKS all stories
- **US1 (3)** and **US2 (4)**: after Foundational. US2 UI needs only the store; US1 e2e needs the store wired (T015). They can run in parallel.
- **US3 (5)**: after Foundational; best after US2 so the per-screen e2e can run, but catalogs (T036/T037) have no code dependency on US2
- **US4 (6)**: after US2 (panel exists) and US3 (real translated text)
- **US5 (7)**: after Foundational (T014); independent of US2–US4
- **Polish (8)**: after all desired stories

### Within stories

- Tests first and failing, then implementation
- T009/T010 before T011/T012/T014; T014 before T015
- T023/T024 before T025; T025 before T027/T028
- T035 before T036/T037 (catalog keys must be final before translating)
- T043 before T044; T045 before T046

### Parallel opportunities

- Setup: T002–T005 together
- Foundational tests T006, T007, T008, T013 together; T009 and T010 together
- US2: T020, T021 together; T023, T024 together; T027, T028 together
- US3: T031–T034 together; T036 and T037 together; T039 alongside
- US5 tests T048, T049a, T049 together; US5 can run alongside US3/US4

```bash
# Example: Foundational tests in parallel
Task: "tests/unit/i18n/languages.test.ts"
Task: "tests/unit/i18n/gaps.test.ts"
Task: "tests/unit/prefs language field + fixtures"
Task: "tests/unit/language-store.test.ts"

# Example: both catalogs in parallel
Task: "Draft messages/pt-BR.json"
Task: "Draft messages/es.json"
```

---

## Implementation Strategy

### MVP first (US1 + US2)

1. Setup → Foundational
2. US1 (detection) and US2 (selector, panel, persistence, switch)
3. STOP and validate: switch works with no reload, URL change, or request; choice persisted. Text beyond the language UI is still English via fallback, so ship only behind US3 for user-facing release.

### Incremental delivery

1. Add US3 (real translations), measure bundle (T041) before layout work
2. Add US4 (layout fixes)
3. Add US5 (gap logging) and Polish
4. `pnpm verify` once at the end; CI runs the full matrix

### Notes

- Native-speaker glossary review is a pre-launch gate, not a merge gate
- Do not change note names or accidental notation (slice 002); language never enters share links or URLs
- No `src/lib/theory` changes
