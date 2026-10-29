---

description: "Task list for Desktop-Only Web Application (slice 030)"
---

# Tasks: Desktop-Only Web Application

**Input**: Design documents from `/specs/030-desktop-only-web-app/`

**Prerequisites**: plan.md, spec.md, research.md (R-01..R-17), data-model.md, contracts/ (ui-arrangements, constitution-amendment, governing-docs), quickstart.md

**Tests**: Requested by constitution Principle IV (test-first) and plan.md. Unit tests for `layout.ts`, prefs schema and fit store are written first and MUST fail before implementation. E2E coverage is in `e2e/desktop-only.spec.ts` plus edits to existing specs (research R-11).

**Organization**: Grouped by user story. This slice is mostly deletion; the new `Arrangement` set (`reflow | wide-side | wide-stacked`) is shared by every story, so all code that references the removed arrangement values lives in Phase 2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1..US5 (spec.md user stories)
- Paths are relative to the repository root. Code references are to the tree at `da84ac9`.

## Local verification (CLAUDE.md)

- Unit: `pnpm vitest run <touched test paths>`
- E2E: `pnpm build:test` once after `src/` changes, then `pnpm test:e2e:fast <spec files>`
- Screenshots: `pnpm playwright test <spec> -g "<test name>" --project=desktop --update-snapshots`
- End of slice, once: `pnpm verify`. Do NOT run `pnpm test:e2e` or `pnpm lhci` locally except to reproduce a CI failure.
- Any test file that renders a component or touches `document`/`window`/`localStorage` MUST start with `// @vitest-environment jsdom`.

---

## Phase 1: Setup

**Purpose**: Record the SC-004 baseline before anything changes.

- [X] T001 Run `pnpm playwright test --list | tail -1` and record the total test count in the PR description draft (baseline for SC-004; quickstart step 0)

---

## Phase 2: Foundational (arrangement set, `reflow` rename, landscape removal)

**Purpose**: Replace `narrow | medium | landscape` with `reflow`, remove everything that referenced the old values. Blocks all stories.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests first (must fail before implementation)

- [X] T002 [P] Rewrite `tests/unit/layout.test.ts` for `Arrangement = 'reflow' | 'wide-side' | 'wide-stacked'`: `width ≤ 1023` → `reflow`; `width ≥ 1024` → `wide-side` when `neckWidth ≤ wideLeftColumn(width, chrome)` else `wide-stacked`; fast-check property: no `(width, neckWidth)` ever returns `narrow`, `medium` or `landscape`; there is no `height` input (data-model §1; R-12)
- [X] T003 [P] Update `tests/unit/state/viewport.test.ts` expectations to `reflow`/`wide-*`; `viewport.arrangement` stays `undefined` before mount and `arrangementFor` no longer receives height
- [X] T004 [P] Update `tests/unit/prefs/theme-boot.test.ts` so the provisional arrangement mirrors `arrangementFor`: `w <= 1023 ? 'reflow' : 'wide-side'`, no height read (R-03)
- [X] T005 [P] Update `tests/unit/tool-layout.test.ts` and `tests/unit/headers.test.ts`: drop `data-landscape` and the landscape `sr-only` heading cases; compact bar is keyed on `reflow`; `src/app.html` viewport meta contains no `viewport-fit=cover` (R-12)
- [X] T006 [P] Delete `tests/unit/side-panels.test.ts`

### Implementation

- [X] T007 Rewrite `src/lib/shell/layout.ts`: `type Arrangement = 'reflow' | 'wide-side' | 'wide-stacked'`; `REFLOW_MAX = 1023` (replaces `MEDIUM_MAX`); `arrangementFor({ width, neckWidth, chrome })` without height; delete `NARROW_MAX`, `LANDSCAPE_MAX_HEIGHT`, `isPhoneLandscape`, `'narrow'`, `'medium'`, `'landscape'` (R-01)
- [X] T008 Update `src/lib/state/viewport.svelte.ts`: stop passing height to `arrangementFor`; keep tracking `height` for other readers (depends on T007)
- [X] T009 [P] Update `static/theme-boot.js`: write `w <= 1023 ? 'reflow' : 'wide-side'` to `data-arrangement`; remove the height read and landscape branch (R-03)
- [X] T010 Update `src/lib/shell/ToolLayout.svelte`: compact bar when arrangement is `reflow`; remove the `data-landscape` attribute on the tool header and the landscape `sr-only` heading branch (R-05; depends on T007)
- [X] T011 [P] Delete `src/lib/tools/SidePanels.svelte`
- [X] T012 [P] Unwrap `SidePanels` in `src/lib/tools/notes/NotesTool.svelte` so zones E and D render directly in grid areas `e` and `d` (depends on T011)
- [X] T013 [P] Unwrap `SidePanels` in `src/lib/tools/triads/TriadsTool.svelte` (depends on T011)
- [X] T014 Unwrap `SidePanels` in `src/lib/tools/caged/CagedTool.svelte` (depends on T011; the rotate-hint block in this file is removed in US2)
- [X] T015 [P] Rename `narrow` → `reflow` in `src/lib/tools/ContextZone.svelte` and the reflow selector rules in `src/lib/tools/NoteSelector.svelte`
- [X] T016 [P] Update `src/routes/about/+page.svelte` (compact bar = `reflow`), the comment in `src/lib/state/context-panel.svelte.ts`, and the comment in `src/lib/shell/BarIcon.svelte` (icons are used by the compact reflow bar)
- [X] T017 Update `src/lib/styles/tokens.css`: delete the `@media (min-width: 600px)` block and its "600px: medium" comment, delete `--landscape-bar-height` and every landscape rule, rename the "narrow/medium" token comment to "reflow"; keep the `min-width: 1024px` no-JS fallback (R-04, R-05)
- [X] T018 Update `src/lib/styles/global.css`: every `[data-arrangement='narrow']` → `[data-arrangement='reflow']`; delete all `medium` selectors and all `[data-arrangement='landscape']` / `header[data-landscape]` rules (R-02, R-05). The body safe-area padding is removed in US2
- [X] T019 Update `src/lib/styles/controls.css`: same selector rename and deletions as T018
- [X] T020 Delete `panels_open`, `panels_close`, `panels_region` from `messages/en.json`, `messages/pt-BR.json` and `messages/es.json` together (Principle VIII)
- [X] T021 Run `pnpm check` and `pnpm vitest run tests/unit/layout.test.ts tests/unit/state/viewport.test.ts tests/unit/prefs/theme-boot.test.ts tests/unit/tool-layout.test.ts tests/unit/headers.test.ts tests/unit/no-raw-text.test.ts tests/unit/style-tokens.test.ts`; fix any leftover reference to a removed arrangement or message key

**Checkpoint**: Only `reflow`, `wide-side`, `wide-stacked` exist in code, CSS and boot script. Foundation ready.

---

## Phase 3: User Story 1 - Desktop player uses every tool in one wide layout (Priority: P1) 🎯 MVP

**Goal**: Every route shows only desktop arrangements from 1024 to 2560 CSS px, with today's desktop behavior unchanged.

**Independent Test**: Open each route at 1024×768 and 2560×1440; controls visible, no overflow, axe 0, keyboard works; resizing between the two only toggles `wide-side` / `wide-stacked`.

### Tests for User Story 1

- [X] T022 [US1] Create `e2e/desktop-only.spec.ts` (desktop project) with the US1 section: for each of `/`, `/notes`, `/triads`, `/caged`, `/about` at 1024×768 and 2560×1440 → no page horizontal scroll, every tool control visible without opening a menu, `@axe-core/playwright` zero violations; resize 1024 ↔ 2560 asserts `data-arrangement` ∈ {`wide-side`, `wide-stacked`} at every step; keyboard-only pass through one tool's controls (US1-1..4)
- [X] T023 [US1] Update `e2e/responsive-layout.spec.ts`: rename `narrow` tests and the axe "narrow collapsed and expanded" case to `reflow`; delete the `medium` tests; keep widths unchanged (R-11)
- [X] T024 [P] [US1] Review `e2e/a11y-audit.spec.ts`, `e2e/navigation.spec.ts`, `e2e/print.spec.ts`, `e2e/text-zoom.spec.ts` and `e2e/ui-refinement.spec.ts` for `narrow`/`medium`/`landscape`/`phone` arrangement names or labels; rename to `reflow`, keep widths and assertions (R-11 "Narrow viewport, still-valid behavior")
- [X] T025 [P] [US1] Verify desktop baselines for all unchanged desktop screenshot tests are untouched: `git status e2e/ | grep -v phone` shows only the `responsive-layout` reflow/medium shots as modified

### Implementation for User Story 1

- [X] T026 [US1] Regenerate changed reflow screenshots only: `pnpm build:test`, then `pnpm playwright test e2e/responsive-layout.spec.ts -g "arrangement screenshot" --project=desktop --update-snapshots`; commit desktop baselines in `e2e/responsive-layout.spec.ts-snapshots/` (depends on T023)
- [X] T027 [US1] Run `pnpm test:e2e:fast e2e/desktop-only.spec.ts e2e/responsive-layout.spec.ts e2e/a11y-audit.spec.ts e2e/navigation.spec.ts e2e/print.spec.ts e2e/text-zoom.spec.ts e2e/ui-refinement.spec.ts`; fix regressions

**Checkpoint**: US1 independently verifiable; the wide layout is proven intact (SC-001).

---

## Phase 4: User Story 2 - Phone-only behaviors no longer appear (Priority: P1)

**Goal**: Rotate hint, pinch, safe-area padding and every phone test profile are gone; tap still equals click.

**Independent Test**: At 390×844, 600×900 and 1280×500 no rotate hint, no landscape arrangement and no Panels button appear; a two-finger pinch on a `hasTouch` desktop context leaves fit mode unchanged; `body` padding is 0; the Playwright matrix has no `phone`/`phone-touch` project.

### Tests for User Story 2 (write first, must fail)

- [ ] T028 [P] [US2] Update `tests/unit/fretboard/fretboard.test.ts`: delete pinch cases; add "two simultaneous touches never emit a fit request" and "single touch tap activates like a click" (R-12, FR-006)
- [ ] T029 [P] [US2] Update `tests/unit/state/fit.test.ts`: remove the `'request'` event cases; keep `overflow` and `small-tap`; `fit.toggle()` still switches modes
- [ ] T030 [P] [US2] Update `tests/unit/caged/caged-tool.test.ts`: delete rotate-hint cases; add "no notice at portrait size (390×844)"
- [ ] T031 [P] [US2] Delete `tests/unit/fretboard/pinch.test.ts` and `tests/unit/state/rotate-hint.test.ts`

### Implementation for User Story 2

- [ ] T032 [P] [US2] Delete `src/lib/fretboard/pinch.ts` and remove the pinch `$effect` from `src/lib/fretboard/Fretboard.svelte` (R-07)
- [ ] T033 [US2] Change `FitEvent` in `src/lib/fretboard/types.ts` to `{ kind: 'overflow'; value: boolean } | { kind: 'small-tap'; position: Position }` and delete the `'request'` case in `src/lib/state/fit.svelte.ts` (data-model §4; depends on T032)
- [ ] T034 [P] [US2] Delete `src/lib/state/rotate-hint.ts`; remove the rotate-hint block and its imports from `src/lib/tools/caged/CagedTool.svelte`; delete `caged_rotate_hint` from `messages/en.json`, `messages/pt-BR.json`, `messages/es.json` (R-06; stored-field removal is in US4)
- [ ] T035 [P] [US2] Remove the four `padding-*: env(safe-area-inset-*)` lines from `body` in `src/lib/styles/global.css`, and `viewport-fit=cover` from the viewport meta in `src/app.html` (keep `width=device-width, initial-scale=1`) (R-08)
- [ ] T036 [P] [US2] Edit `playwright.config.ts`: projects become `desktop` (1280×800), `firefox` and `webkit` (`@smoke`), `nojs`; delete `phone` and `phone-touch` (R-10)
- [ ] T037 [P] [US2] Edit `pw.local.config.ts`: project filter becomes `['desktop', 'nojs']`
- [ ] T038 [P] [US2] Edit `.github/workflows/update-snapshots.yml` to run `--project=desktop` only (R-16)
- [ ] T039 [P] [US2] Delete `e2e/landscape.spec.ts` and `e2e/fretboard-touch.spec.ts`
- [ ] T040 [US2] In `e2e/caged-focus.spec.ts` delete the rotate-hint describe block (≈ lines 450–600)
- [ ] T041 [P] [US2] In `e2e/fretboard.spec.ts` replace the `project.name === 'desktop'` skips (≈ lines 211, 245, 270, 412) and the `isMobile` skip (≈ line 78) with explicit viewports (320×800 or 640×400) so those tests run on `desktop` (R-11 row 2)
- [ ] T042 [P] [US2] In `e2e/custom-tuning.spec.ts` replace the "once per project" logic with an explicit reflow viewport so it runs on `desktop`
- [ ] T043 [P] [US2] Remove rotate-hint workarounds: filter in `e2e/measurement.spec.ts` (≈ lines 189–194), comment in `e2e/open-link.spec.ts` (≈ line 569), comment in `e2e/share.spec.ts` (≈ line 133); retitle "phone sends the view through the system sheet" in `e2e/share.spec.ts` to a desktop-neutral title, behavior unchanged
- [ ] T044 [US2] Delete every `*-phone-darwin.png`, `*-phone-linux.png`, `*-phone-touch-darwin.png`, `*-phone-touch-linux.png` under `e2e/*-snapshots/` (≈ 90 files); confirm `find e2e -name '*phone*' | wc -l` prints 0 (FR-015)
- [ ] T045 [US2] Extend `e2e/desktop-only.spec.ts` with the US2 section: no rotate hint on CAGED at 390×844 and 600×900 with empty storage; 1280×500 is `wide-*` and has no Panels button; `hasTouch` context two-touch pinch leaves fit mode unchanged; tap on a fretboard position behaves like click; `getComputedStyle(body)` padding is 0 at all four sides (depends on T022)
- [ ] T046 [US2] Run `pnpm vitest run tests/unit/fretboard tests/unit/state/fit.test.ts tests/unit/caged/caged-tool.test.ts tests/unit/headers.test.ts`, then `pnpm build:test` and `pnpm test:e2e:fast e2e/desktop-only.spec.ts e2e/caged-focus.spec.ts e2e/fretboard.spec.ts e2e/custom-tuning.spec.ts e2e/measurement.spec.ts e2e/share.spec.ts e2e/open-link.spec.ts`

**Checkpoint**: SC-002 holds; no automated check exercises a phone profile.

---

## Phase 5: User Story 3 - Governing documents reflect the desktop-only target (Priority: P2)

**Goal**: Constitution 2.0.0, product specification, ADRs, CLAUDE.md and Lighthouse config all say desktop-only.

**Independent Test**: The quickstart step 4 grep finds only lines carrying the slice-030 note, device-class values in `04-data-model.md` and the Sync Impact Report history.

Each product-spec clause edit ends with `*[Changed by slice 030: desktop-only target.]*`; removed clauses are replaced by that note alone so IDs stay stable (contracts/governing-docs.md).

- [ ] T047 [US3] Amend `.specify/memory/constitution.md` to 2.0.0 per `contracts/constitution-amendment.md`: prepend the Sync Impact Report (current report moves under "Prior amendments"); replace Principle V touch-target bullet; replace Principle VI opening line, budget table (Home ≤ 3 s, tool ≤ 3.5 s, score ≥ 90, other rows unchanged) and rationale; replace Principle VII device bullet; update Technology Stack E2E and Browsers rows; update merge gate, screenshot and CI-matrix bullets; footer `**Version**: 2.0.0 | **Ratified**: 2026-09-30 | **Last Amended**: <merge date>`
- [ ] T048 [P] [US3] Edit `CLAUDE.md`: screenshot row becomes `pnpm playwright test <spec> -g "<test name>" --project=desktop --update-snapshots`; the `test:e2e` warning line reads "(full desktop, Firefox, WebKit, no-JS matrix)"; no phone-profile guidance remains (FR-021)
- [ ] T049 [P] [US3] Edit `lighthouserc.cjs`: `collect.settings` = `{ preset: 'desktop' }`; `categories:performance` `minScore: 0.9`; `interactive` ≤ 3000 for `/` and `/about`, ≤ 3500 for `/notes` and `/triads`; CLS ≤ 0.1 and TBT warning unchanged; URL list unchanged (R-13)
- [ ] T050 [P] [US3] Edit `specs/autonomous/fretboard-master/00-overview.md`: remove M-7 (phone sessions metric); restate C-4 as "Desktop and laptop browsers are the target; every function works from 1024 to 2560 CSS px."
- [ ] T051 [P] [US3] Edit `specs/autonomous/fretboard-master/01-personas-and-jobs.md`: "phone propped on the amplifier" → laptop on a desk or stand beside the instrument; remove the "phone at rehearsal" clause; restate E-5 as a user zoomed to 400 % (320 CSS px) with no feature lost and the fretboard scrolling horizontally
- [ ] T052 [P] [US3] Edit `specs/autonomous/fretboard-master/02-user-journeys.md`: "opens the link on a phone" → "opens the link on another computer"
- [ ] T053 [P] [US3] Edit `specs/autonomous/fretboard-master/03-functional-requirements.md`: remove FR-3.19 (rotate to landscape)
- [ ] T054 [P] [US3] Edit `specs/autonomous/fretboard-master/06-non-functional-requirements.md`: reference-phone definition → desktop reference profile (Lighthouse desktop preset); NFR-1.1 Home ≤ 3 s; NFR-1.6 "follow the pointer"; NFR-1.7 "typical broadband"; NFR-2.1 desktop browsers only; NFR-2.2 1024–2560 CSS px with zoom reflow to 320 CSS px and no orientation clause; remove NFR-2.5 (safe areas); NFR-3.5 → WCAG 2.2 SC 2.5.8 target size, whole-mode small-target notice kept
- [ ] T055 [P] [US3] Edit `specs/autonomous/fretboard-master/08-edge-cases-and-error-handling.md`: remove EC-3.5 (pinch); EC-3.6 "320-wide screen" → "1024-wide window"
- [ ] T056 [P] [US3] Edit `specs/autonomous/fretboard-master/09-assumptions-and-open-questions.md`: "Devices" row → desktop and laptop browsers; A-12 reference phone → desktop reference profile
- [ ] T057 [P] [US3] Edit `specs/autonomous/fretboard-master/12-design-and-experience.md`: marker-label legibility "on a phone" → "at normal viewing distance"; §5.1 breakpoint table rows become Reflow (< 1024, zoom only) and Wide (≥ 1024, side or stacked); remove §5.2 and §5.3 bodies (headings kept with the note); touch-target line → target size per NFR-3.5, note selector wraps in reflow
- [ ] T058 [P] [US3] Create `docs/adr/0029-desktop-only-target.md`: Context (owner decision, 2026-10-29), Decision (arrangements per `contracts/ui-arrangements.md`; pinch, rotate hint and safe-area removal; Lighthouse desktop preset; Playwright projects), Consequences (smaller matrix, reflow still WCAG, phones best effort), Supersedes ADR 0023 (landscape arrangement and pinch sections)
- [ ] T059 [US3] Set `docs/adr/0023-fit-mode-and-adaptive-arrangement.md` status to "Partially superseded by 0029 (landscape arrangement, pinch)"; body untouched. Check `docs/adr/0001-*`, `0005-*`, `0025-*` for phone mentions; add a superseded status line and pointer only if a decision (not an example) exists for phones (depends on T058)
- [ ] T060 [US3] Run `grep -nEi "phone|portrait|landscape|safe.area|pinch|44 ?× ?44|360 px|320 to 2560" .specify/memory/constitution.md CLAUDE.md specs/autonomous/fretboard-master/*.md`; every remaining hit must be a slice-030 note, a `04-data-model.md` device-class value, or Sync Impact Report history (SC-007); fix the rest
- [ ] T061 [P] [US3] Check `messages/en.json`, `messages/pt-BR.json`, `messages/es.json` and `src/routes/about/+page.svelte` for any user-facing text about phones, rotating the device or pinching; remove any found. "tap" / "toque" wording stays (FR-023)

**Checkpoint**: No governing document requires phone support.

---

## Phase 6: User Story 4 - Existing links and preferences keep working (Priority: P2)

**Goal**: Records saved with `rotateHint` load with all other fields intact; the field is no longer read or written; all link fixtures pass.

**Independent Test**: A record containing `"rotateHint": true` (and one with an invalid value) loads with every other preference identical; first write omits `rotateHint`; every link-compatibility fixture opens the expected view.

### Tests for User Story 4 (write first, must fail)

- [ ] T062 [P] [US4] Update `tests/unit/prefs/schema.test.ts`: delete `rotateHint` read/write cases; add property tests that a record with `rotateHint` true, false, invalid or absent parses with every other field identical to today's result and never throws; serialization omits `rotateHint` and keeps the remaining key order; `PRIVACY_CATEGORIES.hints` is `['cagedNoteShown']`; drop the field from arbitraries (data-model §2)
- [ ] T063 [P] [US4] Update `tests/unit/state/preferences-store.test.ts`: remove `rotateHintShown` / `markRotateHintShown` cases; `erase()` and session memory no longer carry the field
- [ ] T064 [P] [US4] Update `tests/unit/prefs/fixtures/index.ts`: keep every fixture that carries `rotateHint` (fixtures are append-only in spirit), but drop the field from expected results

### Implementation for User Story 4

- [ ] T065 [US4] Edit `src/lib/prefs/schema.ts`: remove `rotateHintShown` from `Preferences` and `DEFAULT_PREFERENCES`, `rotateHint` from `recordSchema` and `serializePreferences`, and `rotateHintShown` from `PRIVACY_CATEGORIES.hints`; format version stays `1` (R-06)
- [ ] T066 [US4] Edit `src/lib/state/preferences.svelte.ts`: remove `rotateHintShown` and `markRotateHintShown()`; update `erase()` and session memory (depends on T065)
- [ ] T067 [US4] Extend `e2e/desktop-only.spec.ts` with the US4 section: seed `localStorage` with a stored record including `"rotateHint":true`, load, assert other preferences applied with no error or notice; every share-link fixture opens the expected view (reuse the fixtures in `e2e/open-link.spec.ts`)
- [ ] T068 [US4] Run `pnpm vitest run tests/unit/prefs tests/unit/state/preferences-store.test.ts tests/unit/link tests/unit/privacy-policy.test.ts tests/unit/erase-preferences.test.ts`, then `pnpm test:e2e:fast e2e/desktop-only.spec.ts e2e/open-link.spec.ts e2e/preferences.spec.ts e2e/privacy.spec.ts`

**Checkpoint**: SC-003 holds; old records and links load.

---

## Phase 7: User Story 5 - Small screens are not supported, but not blocked (Priority: P3)

**Goal**: Narrow windows and zoomed-in desktops get the `reflow` arrangement with all content reachable and no blocking UI.

**Independent Test**: At 320×200 (400 % zoom of 1280×800) and 640×400 (200 %), every route lays out as `reflow` with no page horizontal scroll, no blocking dialog, and axe 0.

- [ ] T069 [US5] Extend `e2e/desktop-only.spec.ts` with the US5/SC-008 section: for each of `/`, `/notes`, `/triads`, `/caged`, `/about` at 320×200 and 640×400 → `data-arrangement="reflow"`, `document.documentElement.scrollWidth <= innerWidth`, only the fretboard scroller scrolls horizontally, no `dialog` / `[role=dialog]` / `[aria-modal]` present, fretboard reachable, axe zero violations; also run one tool at 1024×768 with 200 % text zoom in en, pt-BR and es with no truncation or overlap (R-10 browser zoom note; ui-arrangements §2)
- [ ] T070 [US5] Run `pnpm test:e2e:fast e2e/desktop-only.spec.ts e2e/responsive-layout.spec.ts e2e/languages-layout.spec.ts e2e/notation-layout.spec.ts e2e/text-zoom.spec.ts`; fix any reflow regression using the existing `reflow` rules only (no new design, R-02)

**Checkpoint**: All five stories independently verified.

---

## Phase 8: Polish & Cross-Cutting

- [ ] T071 Run the quickstart steps in `specs/030-desktop-only-web-app/quickstart.md` (1 unit, 2 e2e, 3 screenshots, 4 grep) and tick off each expected result
- [ ] T072 Re-run `pnpm playwright test --list | tail -1` and confirm ≥ 30 % fewer tests than the T001 baseline (SC-004); record both numbers in the PR description
- [ ] T073 Confirm no dead references remain: `grep -rnE "SidePanels|rotate-hint|rotateHint|pinch|landscape-bar|isPhoneLandscape|NARROW_MAX|MEDIUM_MAX|LANDSCAPE_MAX|'narrow'|'medium'|\"landscape\"|safe-area-inset|viewport-fit" src static messages e2e tests playwright.config.ts pw.local.config.ts` returns only the intentional backward-compat fixtures/tests for `rotateHint` (T062, T064, T067)
- [ ] T074 Run all local gates once: `pnpm verify` (CLAUDE.md; do not run `pnpm test:e2e` or `pnpm lhci` locally)
- [ ] T075 Open the PR with Conventional Commit title (e.g. `feat!: target desktop browsers only`), body noting the constitution 2.0.0 MAJOR bump, the Lighthouse desktop-preset risk (R-13: first CI run may miss the tighter budgets; relaxing needs another amendment, not a silent change) and the SC-004 numbers

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (1)**: none.
- **Foundational (2)**: after Setup. Blocks all stories because the old arrangement values are referenced by shell, tools and CSS.
- **US1 (3)**, **US2 (4)**: after Foundational; US2's T045 extends the file US1's T022 creates, so run US1 → US2 or merge in order.
- **US3 (5)**: after Foundational for correctness of text; independent of US1/US2 code (can run in parallel with them).
- **US4 (6)**: after US2 T034 (CagedTool no longer calls `markRotateHintShown`), otherwise independent.
- **US5 (7)**: after Foundational; shares `e2e/desktop-only.spec.ts` with US1/US2/US4 (sequential edits).
- **Polish (8)**: after all stories.

### Within each story

- Failing unit tests before implementation (Principle IV).
- Same-file edits are sequential: `global.css` (T018 → T035), `CagedTool.svelte` (T014 → T034), `messages/*.json` (T020 → T034 → T061), `e2e/desktop-only.spec.ts` (T022 → T045 → T067 → T069), `e2e/share.spec.ts` (T043 only).

### Parallel opportunities

- Phase 2 tests T002–T006 together; T009, T011, T015, T016 together.
- US2: T028–T031 together; T032, T034, T035–T039, T041–T043 together.
- US3: T048–T058, T061 are separate files and run together; T047 is independent but large.
- US3 can proceed entirely in parallel with US1/US2 by a second contributor.

### Parallel example: User Story 3

```bash
Task: "Edit specs/autonomous/fretboard-master/00-overview.md ..."        # T050
Task: "Edit specs/autonomous/fretboard-master/06-non-functional-requirements.md ..."  # T054
Task: "Create docs/adr/0029-desktop-only-target.md ..."                  # T058
Task: "Edit lighthouserc.cjs ..."                                        # T049
```

---

## Implementation Strategy

### MVP first

1. Phase 1 → Phase 2 (arrangement set and removal of landscape/medium).
2. Phase 3 (US1): desktop layout proven intact. **Stop and validate.**
3. Phase 4 (US2): delete phone-only behaviors and test profiles. This completes the code change.

### Incremental delivery

1. US3 governing documents (can merge-ready in parallel; required before the PR is accepted because it is the amendment PR the constitution's Governance section requires).
2. US4 compatibility proof, then US5 reflow proof.
3. Polish: SC-004 numbers, `pnpm verify`, PR.

### Notes

- Do not change desktop behavior or desktop baselines except reflow/medium shots (FR-009); keep `--target-min: 44px` and control sizes (R-09).
- Never relax a Lighthouse budget silently if CI misses the new values; amend the constitution instead (R-13).
- Commit after each task or logical group; Conventional Commits.
