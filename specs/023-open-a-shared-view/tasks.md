---

description: "Task list for 023 Open a Shared View"
---

# Tasks: Open a Shared View

**Input**: Design documents from `/specs/023-open-a-shared-view/`

**Prerequisites**: plan.md, spec.md, research.md (R-01…R-11), data-model.md, contracts/open-link-api.md, contracts/link-notices-ui.md, quickstart.md

**Tests**: Included. Constitution C-IV and research R-11 require test-first for `src/lib/link` and state stores, and every acceptance scenario of US1–US4 maps to an e2e test. Write each test, see it fail, then implement.

**Organization**: Grouped by user story. Local verification is targeted (CLAUDE.md): `pnpm vitest run <paths>` per task, `pnpm build:test` once then `pnpm test:e2e:fast e2e/open-link.spec.ts`, `pnpm verify` once at the end. Never run `pnpm test:e2e` or `pnpm lhci` locally.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- **[Story]**: US1–US4 (spec.md)

## Path Conventions

Single SvelteKit project: `src/`, `messages/`, `tests/unit/`, `e2e/`, `docs/adr/`, `scripts/` at repo root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Budget amendment, messages and the shared `Notice` change that every story needs.

- [X] T001 Amend `.specify/memory/constitution.md` 1.8.0 → 1.9.0 (MINOR): raise "Initial JavaScript, gzip" to 128 KB, add Sync Impact Report following the six earlier raises; set the cap to 128 KB in `scripts/check-bundle-size.mjs`; append the cap-history entry (120 → 128 KB, decoder now shipped, R-08) to `docs/adr/0002-*.md`
- [X] T002 [P] Add 5 message keys to `messages/en.json`, `messages/es.json`, `messages/pt-BR.json`: `link_instrument` ("This view uses {tuning}", param `tuning`), `link_instrument_strings` ("This view uses {count} strings: {tuning}", params `count`, `tuning`), `link_use_mine` ("Use mine"), `link_adopt` ("Adopt this one"), `link_incomplete` ("This link was incomplete; we show the closest view possible"); translate es and pt-BR in the same task; note names are never in catalog text
- [X] T003 [P] Change `src/lib/shell/Notice.svelte` prop `action?: {label, onclick}` to `actions?: readonly {label, onclick}[]` rendered before Dismiss (each button ≥ `--target-min`); migrate every existing single-action caller; extend `tests/unit/notice.test.ts` first (multiple actions render in DOM order, Dismiss last, existing single-action cases still pass)
- [X] T004 [P] Write `docs/adr/0022-open-received-links-before-hydration.md`: apply link in `hooks.client.ts` `init` before hydration (R-01), session instrument override in the instrument store (R-03), Any-confirmed-change-ends-override (R-04)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure receive decoding, zero-write store application, override core and opening store. All stories need these.

**⚠️ CRITICAL**: No user story work starts until this phase is complete.

### Tests first

- [X] T005 [P] Write `tests/unit/link/receive.test.ts` (must fail first): rules 1–4 of data-model §1 (`none` for bare tool path / `?` / non-tool path without `v`; `unknown-tool` for non-tool path with `v`; trailing `/` stripped); R3 stored defaults (missing `sc`/`tu`/`fr` take stored values; invalid `sc` or `tu`, custom tuning with wrong pitch count or preset invalid for count → both `sc` and `tu` from stored and both reported; invalid `fr` or outside 12..24 → stored fret count, `fr` reported); R4 view-field fallbacks and EC-10.2 clamps (`ss=7` on 6 strings, occurrence past end, region beyond `fr`) reported in `fellBack`; R5 `v` absent / non-integer / `0` / `>1` → `kind: 'tool'`, `forcedNotice: true`; R7 unknown keys not reported, duplicate keys use first occurrence; markup-in-values case
- [X] T006 [P] Write `tests/unit/link/receive.property.test.ts` (fast-check, ≥ 500 runs): R1 `readReceivedLink` never throws for arbitrary paths and query strings; R2 round trip `readReceivedLink(new URL(encodeLink(s, o)), s.instrument)` equals `{ kind: 'tool', snapshot: s, fellBack: [], forcedNotice: false }` using the 022 snapshot arbitraries
- [X] T007 [P] Add receive-layer fixture table `tests/unit/link/fixtures/v1/open.*` (new files only; existing fixtures untouched, C-IX; placed in `fixtures/open/open.table.ts`, since files in `fixtures/v1` are all run as fallback-free 022 fixtures): stored-instrument defaults, paired `sc`/`tu` fallback, version > 1, missing `v`, unknown tool, unknown extra params, duplicate params; wire into a test that runs it through `readReceivedLink`
- [X] T008 [P] Write `tests/unit/state/instrument-override.test.ts` for the override core only: `receive` creates `override` with `notice` true when string count or tuning differs (`equalsTuning`), `notice` false for fret-count-only difference, no-op when musically equal; `receive` calls `preferences.remember` zero times, does not stop playback, changes only the opened tool store's instrument, leaves `adjustedIn` null; CAGED compares preferred `sc`/`tu`/`fr` ignoring `tmp`; `effectiveFor(tool)` returns link for opened tool else stored; `confirm` with `result.changed` and `restore` (startup, erase) set `override = null` before applying; Cancel or no-change confirm keeps the override
- [X] T009 [P] Write receive cases in `tests/unit/state/notes-receive.test.ts`, `tests/unit/state/triads-receive.test.ts`, `tests/unit/state/caged-receive.test.ts` (T1/T2): `state` equals given view, no `preferences.remember`, no `playback.stop`, `preferredLabel` unchanged; triads clears `notice`; CAGED `temporary` true iff requested and tuning class is `non-compatible`, transients cleared

### Implementation

- [X] T010 Refactor `src/lib/link/decode.ts`: introduce exported `DecodeBase { instrument: LinkInstrument; pairInstrument: boolean }` and `decodeToolParams(tool, params, base): { snapshot, fellBack }`; per-tool decoders take the base; `decodeLink` calls them with `{ instrument: FACTORY_LINK_INSTRUMENT, pairInstrument: false }` and keeps its own version handling. Gate: `pnpm vitest run tests/unit/link` stays green with no edits to existing 022 tests or fixtures (R8)
- [X] T011 Create `src/lib/link/receive.ts` (pure, no Svelte/DOM/i18n/storage): `ReceivedLink` type, `readReceivedLink(url, stored)` per data-model §1 rules 1–4 and the catch-all returning `{ kind: 'tool', snapshot: <tool default on stored>, fellBack: ['*'], forcedNotice: true }`, and `isIncomplete(r)` (`unknown-tool`, or tool with `fellBack.length > 0 || forcedNotice`); export both from `src/lib/link/index.ts`. Reuse decoder internals, no new Valibot schemas (bundle, R-02). Makes T005–T007 pass
- [X] T012 [P] Add `notes.receive(view)` in `src/lib/state/notes.svelte.ts`: `view = revalidate(view, instrument)`, assign, no playback stop, no `preferences.remember`, `preferredLabel` untouched (data-model §4)
- [X] T013 [P] Add `triads.receive(view)` in `src/lib/state/triads.svelte.ts`: same as T012, clears `notice`
- [X] T014 [P] Add `caged.receive(view, temporary)` in `src/lib/state/caged.svelte.ts`: assign view, `temporary = temporary && tuningClass === 'non-compatible'`, clear transients, `settleLayers()` / focus re-resolution as existing transitions do. T012–T014 make T009 pass
- [X] T015 Extend `src/lib/state/instrument.svelte.ts` (override core): add `InstrumentOverride`, `override` (`$state.raw`), `overrideDismissed`, `receive(tool, link)`, `effectiveFor(tool)`, `overrideNoticeFor(tool)`; extract the persistence block of `confirm` into one private `persist(config)` helper (reused by `adopt` later, FR-007); `confirm` with `result.changed` and `restore` set `override = null` first; `screenChanged` also resets `overrideDismissed`. Makes T008 pass
- [X] T016 Create `src/lib/state/opening.svelte.ts` with the full `opening` API of data-model §3 and `resetOpeningForTests()`: `start(href)` (idempotent; `readReceivedLink(new URL(href), musicalOf(instrument.active))`; `none` → return; `unknown-tool` → `incomplete = { screen: 'home' }`; `tool` → `instrument.receive(tool, snapshot.instrument)` **then** `<tool>.receive(view)` (CAGED passes `snapshot.temporary`); set `incomplete = { screen: tool }` iff `isIncomplete(r)`), `dismissIncomplete()`, `screenChanged()`; whole of `start` in `try`/`catch` whose non-empty catch leaves the tool normal and sets the incomplete notice (O2)
- [X] T017 Write `tests/unit/state/opening.test.ts` (against T016, in-memory `StorageLike`): `start` on each URL class (none, unknown-tool, tool valid, tool incomplete, newer version); O3 zero storage writes during `start` (instrument, label, presentation keys unchanged); O4 `incomplete` set iff `isIncomplete`, once regardless of number of fallbacks; applies instrument before view; `start` twice is idempotent; thrown store error → incomplete notice, no throw
- [X] T018 Edit `src/hooks.client.ts` `init`: call `opening.start(location.href)` right after `preferences.start()` (O1)
- [X] T019 Edit `src/lib/state/share.svelte.ts`: `currentSnapshot(tool)` reads instrument from `instrument.effectiveFor(tool)`; extend `tests/unit/state/share-store.test.ts` (during an override the snapshot and address describe what is drawn, I6)
- [X] T020 Measure bundle: `pnpm build && node scripts/check-bundle-size.mjs build`; record the number in the PR notes; abort and revisit savings pass (R-08) if over 128 KB

**Checkpoint**: `pnpm vitest run tests/unit/link tests/unit/state` green. Foundation ready.

---

## Phase 3: User Story 1 - Land on exactly the shared view (Priority: P1) 🎯 MVP

**Goal**: A full page load on a tool path with a query opens that tool in exactly the shared state, drawn with the viewer's own presentation, with zero preference writes.

**Independent Test**: Stored left-handed + Portuguese; open a CAGED D major, E shape link; tool, key, quality and shape match, view mirrored and in Portuguese, no home screen, no storage change.

### Tests for User Story 1

- [X] T021 [US1] Create `e2e/open-link.spec.ts` with US1 tests (fail first): (a) Ana scenario: seed prefs left-handed + pt-BR, load a CAGED D-major E-shape link on the viewer's own (standard) instrument, assert tool, key, quality, focused shape, mirrored layout and Portuguese UI, no home screen; (b) valid Notes link and Triads link apply every state field; (c) round trip: for each tool, a Share-produced link opened in a fresh page shows identical state and no notice; (d) language, notation, accidental, handedness, orientation, theme, sound unchanged and `localStorage` preference keys identical before/after (only `lastTool` may change); (e) bare `/caged` opens normally with no notice
- [X] T022 [P] [US1] Add a round-trip matrix test `tests/unit/state/opening-roundtrip.test.ts` (SC-001): all three tools, preset and custom tunings, 6 and 7 strings, every optional-none field; `opening.start(encodeLink(snapshot))` followed by `currentSnapshot(tool)` equals the original snapshot

### Implementation for User Story 1

- [X] T023 [US1] Verify and fix the wiring from T016/T018 so that the first rendered frame is the shared view: check `openToolAddress(tool)` in `ToolLayout.svelte` `onMount` does not re-apply or overwrite state, and client-side navigation (AppNav, Back/Forward to a tool address with a query) never calls `opening.start` and keeps in-memory session state (FR-001); add the navigation case to `e2e/open-link.spec.ts`
- [X] T024 [US1] Run `pnpm build:test`, then `pnpm test:e2e:fast e2e/open-link.spec.ts` and `pnpm vitest run tests/unit/state tests/unit/link`; fix failures in the files touched above

**Checkpoint**: US1 independently functional. Valid links on the viewer's own instrument open exactly, no notices.

---

## Phase 4: User Story 2 - Different instrument: Use mine or Adopt this one (Priority: P1)

**Goal**: A link whose string count or tuning differs from the stored instrument opens on the link's instrument with a persistent non-blocking notice offering Use mine, Adopt this one and Dismiss.

**Independent Test**: Stored tuning standard; open the Drop D CAGED link; verify notice text and actions, then Use mine and Adopt this one in separate runs.

### Tests for User Story 2

- [X] T025 [US2] Extend `tests/unit/state/instrument-override.test.ts` (fail first): I2 `useMine` writes nothing, stops playback with `'instrument'`, afterwards every store is on `instrumentOf(active)`, sets `adjustedIn = tool` only when the opened store reports an adjustment (7-6-5 on 6 strings), CAGED `endTemporary()` unless stored tuning is non-compatible; I3 `adopt` calls `preferences.remember` exactly once with only `stringCount`, `tuningId`, `customTuning`, `fretCount` changed (handedness/orientation kept), opened view unchanged by `equals*View`, other stores updated; `dismissOverrideNotice` keeps the override; I5 `screenChanged` resets dismissal and override survives navigation; panel change ends override and closes the notice
- [X] T026 [P] [US2] Write `tests/unit/link-notice.test.ts` for `src/lib/shell/link-notice.ts` (fail first): preset → `tuningLabel(tuning)`; custom → `tuningStrings(tuning, count)` lowest → highest through `noteLabel()` joined by a space, honoring notation and accidental preference in en, es, pt-BR; string-count prefix selection (`link_instrument_strings` iff `link.stringCount !== stored.stringCount`); output never contains link text
- [X] T027 [P] [US2] Extend `tests/unit/tool-layout.test.ts` and create `tests/unit/tuning-badge.test.ts` cases (fail first): instrument notice visible iff `override?.tool === tool && override.notice && !overrideDismissed`; actions in DOM order Use mine, Adopt this one, Dismiss; not shown for other tools or for fret-count-only override; `TuningBadge` labels `instrument.effectiveFor(tool).tuning`
- [X] T028 [US2] Add US2 e2e tests to `e2e/open-link.spec.ts`: Drop D notice with stored standard; no notice when instrument equal; open another tool keeps stored instrument; Use mine recalculates and closes notice and writes nothing; Adopt this one stores Drop D, closes notice, view unchanged; custom tuning lists string notes; 7-string link on 6 stored shows "7 strings" and Use mine on a 7-6-5 triad set moves to nearest with `instrument_adjusted` notice; link impossible on its own instrument; non-compatible tuning in CAGED shows standard-tuning fallback plus notice naming the link tuning; leave tool and come back shows notice again; panel instrument change saves and closes notice; focus moves to tool `h1` after Use mine / Adopt

### Implementation for User Story 2

- [X] T029 [US2] Finish `src/lib/state/instrument.svelte.ts`: `useMine()` (stop playback `'instrument'`, apply `instrumentOf(active)` to opened store, CAGED `endTemporary()` unless stored tuning non-compatible, set `adjustedIn` when adjusted, clear override, no write), `adopt()` (`active = { ...override.link, handedness, orientation from active }`, `persist(active)`, apply to other stores without notice, opened store unchanged, clear override), `dismissOverrideNotice()`; makes T025 pass
- [X] T030 [P] [US2] Create `src/lib/shell/link-notice.ts`: pure helper returning the instrument-notice text inputs (preset name via `tuningLabel`, custom notes via `tuningStrings` + `noteLabel`; picks `link_instrument` vs `link_instrument_strings`); no `{@html}`; makes T026 pass
- [X] T031 [US2] Edit `src/lib/shell/ToolLayout.svelte`: render instrument notice between header and `<main>` in the `.share-notice` slot pattern using `Notice` with `actions` (Use mine, Adopt this one) and Dismiss; wire to `instrument.overrideNoticeFor(tool)`; after Use mine / Adopt move focus to the tool `h1`; ≤ 2 lines at 320 px and 200 % zoom (buttons wrap below text)
- [X] T032 [P] [US2] Edit `src/lib/shell/TuningBadge.svelte`: add `tool` prop and label `instrument.effectiveFor(tool).tuning`; update all call sites; panel still shows and edits the stored instrument
- [X] T033 [US2] Extend `tests/unit/` no-raw-text style check (existing `no-raw-text` pattern) to the new notice component and `link-notice.ts` (no `{@html}`); then `pnpm vitest run tests/unit/state/instrument-override.test.ts tests/unit/link-notice.test.ts tests/unit/tool-layout.test.ts tests/unit/tuning-badge.test.ts tests/unit/notice.test.ts`
- [X] T034 [US2] `pnpm build:test`, then `pnpm test:e2e:fast e2e/open-link.spec.ts`; if any e2e screenshot is added or changed, update it with `pnpm playwright test e2e/open-link.spec.ts -g "<test name>" --project=phone --project=phone-touch --project=desktop --update-snapshots`

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Untrusted, incomplete or newer links never break the app (Priority: P1)

**Goal**: Every value validated; invalid values default, valid ones stay, exactly one "This link was incomplete…" notice; unknown tool opens home with that notice; newer or malformed versions open the closest view; hostile input never renders or executes.

**Independent Test**: Open links with out-of-range fret count plus unknown quality; unknown tool; newer version; markup values; each yields a usable view and one notice.

### Tests for User Story 3

- [X] T035 [US3] Add US3 e2e tests to `e2e/open-link.spec.ts` (fail first): `/caged?v=1&rt=2&q=banana&fr=99` keeps `rt`, defaults quality and frets, one notice; `/scales?v=1&rt=0` opens home, address `/`, incomplete notice not not-found; `/scales` keeps the existing not-found notice; `/notes?v=9&sel=0.4.7` opens Notes with selection kept and notice; missing parameters take defaults with notice; unknown extra params with otherwise valid link show no notice; invalid custom tuning `tu=c.` wrong pitch count uses stored sc/tu, incomplete notice only, no instrument notice; markup/script/very long values (quickstart "Hostile" row): no dialog, no injected element, usable view; both notices together keep the fretboard reachable
- [X] T036 [P] [US3] Extend `tests/unit/state/opening.test.ts`: notice lifecycle (`dismissIncomplete`, `screenChanged` drops it, never re-shown in the session), unknown-tool sets `{ screen: 'home' }`, exactly one notice for many fallbacks (SC-005)
- [X] T037 [P] [US3] Extend `tests/unit/` for `src/routes/[...unknown]/+page.svelte` (or its existing test): `link_incomplete` rendered instead of `notice_not_found` iff `opening.incomplete?.screen === 'home'`; address rewrite to `/` unchanged

### Implementation for User Story 3

- [X] T038 [US3] Edit `src/lib/shell/ToolLayout.svelte`: render the incomplete-link notice after the instrument notice when `opening.incomplete?.screen === tool`, `Notice` with Dismiss only calling `opening.dismissIncomplete()`, text `link_incomplete()`
- [X] T039 [P] [US3] Edit `src/routes/+layout.svelte` `beforeNavigate` to call `opening.screenChanged()` alongside the existing screen-scoped notice hooks
- [X] T040 [P] [US3] Edit `src/routes/[...unknown]/+page.svelte`: show `link_incomplete` in the `HomeScreen` `notice` snippet when `opening.incomplete?.screen === 'home'`, else existing `notice_not_found`
- [X] T041 [US3] Add a SC-004 hostile-link corpus unit test `tests/unit/link/receive-hostile.test.ts` (truncated, oversized, percent-encoded, markup, null bytes, duplicated keys, unknown tool): 0 throws, result kind always `none` / `unknown-tool` / `tool`, no returned string field outside fixed sets
- [X] T042 [US3] `pnpm vitest run tests/unit/link tests/unit/state tests/unit/tool-layout.test.ts`; `pnpm build:test`; `pnpm test:e2e:fast e2e/open-link.spec.ts`

**Checkpoint**: US1–US3 independently functional.

---

## Phase 6: User Story 4 - Address and history after opening (Priority: P2)

**Goal**: After opening, the address is the canonical link of the displayed state with no extra history entries.

**Independent Test**: Open a link with an invalid value; address equals canonical repaired link; Back once leaves the app.

### Tests for User Story 4

- [X] T043 [US4] Add US4 e2e tests to `e2e/open-link.spec.ts`: repaired link → `location.href` equals `encodeLink` of the displayed state and `history.length` unchanged; fresh tab, Back once leaves the app (no internal repair step); reload of own canonical address reproduces the same view

### Implementation for User Story 4

- [X] T044 [US4] Fix any gap found by T043 in `src/lib/shell/ToolLayout.svelte` / `openToolAddress` (first `replaceState` must carry the canonical link of the repaired state, FR-017; sync starts only after the link is applied); if T043 passes without changes, record "no change needed" in the PR notes — no change needed (T043 passes; PR notes: first replaceState already canonical)
- [X] T045 [US4] `pnpm build:test`; `pnpm test:e2e:fast e2e/open-link.spec.ts`

**Checkpoint**: All user stories functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T046 [P] Accessibility e2e in `e2e/open-link.spec.ts`: axe zero violations with both notices visible; Tab order Use mine → Adopt this one → Dismiss, Enter/Space activate; polite single announcement; 320 px no horizontal scroll and notice ≤ 2 lines in en, es, pt-BR; 200 % zoom; offline load of a link makes no network request (FR-020)
- [X] T047 [P] Confirm catalog-parity test passes for the 5 new keys (`pnpm vitest run` on the existing parity test) and update `docs/` or README sharing notes if a user-facing doc mentions links
- [X] T048 Final bundle check `pnpm build && node scripts/check-bundle-size.mjs build` (≤ 128 KB) and record in the PR; savings pass (R-08) if the estimate was exceeded — 123.4 KB ≤ 128 KB, savings pass not needed
- [X] T049 Walk the quickstart.md URL table by hand against `pnpm preview`, including the localStorage-unchanged check — walked via scripted browser on serve-build (host 404 routing); all rows match, stored tuning stays AF-1
- [X] T050 Run all local gates once: `pnpm verify` (full Playwright matrix, Lighthouse and Firefox/WebKit run in CI only; do not run `pnpm test:e2e` or `pnpm lhci` locally)
  - Result: check, lint, format, unit+coverage, build, bundle size pass. 11 pre-023 e2e tests asserted "reload resets" / "incoming link ignored", now superseded by spec Clarification (reload of the canonical address re-applies it): updated to a fresh open of the bare tool path, or to wait for the settled address. `perf.spec.ts` budgets fail locally at load avg ~40-50 on 8 cores; `main` fails the same 10 budgets at similar magnitudes, so not a regression. CI is the gate.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none. T001 must land before T020/T048 can pass the budget check.
- **Foundational (Phase 2)**: depends on Phase 1 (T002 messages and T003 Notice are consumed later; T001 for bundle). Blocks all stories.
- **US1 (Phase 3)**: after Phase 2.
- **US2 (Phase 4)**: after Phase 2; builds on the override core (T015) and `ToolLayout` slot. Can proceed in parallel with US1 except shared `e2e/open-link.spec.ts` and `ToolLayout.svelte`.
- **US3 (Phase 5)**: after Phase 2; T038 edits the same `ToolLayout.svelte` as T031, so sequence after US2 or coordinate.
- **US4 (Phase 6)**: after US1.
- **Polish (Phase 7)**: after all desired stories.

### Within Phase 2

T005–T009 (tests) → T010 → T011; T012/T013/T014 parallel; T015 → T016 → T017/T018; T019 after T015; T020 last.

### User Story Dependencies

- US1: no dependency on other stories.
- US2: independent of US1 logic; shares the opened-tool path.
- US3: independent; the incomplete notice and unknown-tool route are separate from instrument notice.
- US4: verifies behaviour from US1.

### Parallel Opportunities

- Phase 1: T002, T003, T004 together.
- Phase 2 tests: T005, T006, T007, T008, T009 together; T012, T013, T014 together.
- US2: T026, T027, T030, T032 together.
- US3: T036, T037, T039, T040 together.

## Parallel Example: Phase 2

```bash
# Tests first, all in parallel (different files):
Task: "tests/unit/link/receive.test.ts"
Task: "tests/unit/link/receive.property.test.ts"
Task: "tests/unit/state/instrument-override.test.ts"
Task: "tests/unit/state/{notes,triads,caged}-receive.test.ts"

# Then the three tool-store receive methods in parallel:
Task: "notes.receive in src/lib/state/notes.svelte.ts"
Task: "triads.receive in src/lib/state/triads.svelte.ts"
Task: "caged.receive in src/lib/state/caged.svelte.ts"
```

## Implementation Strategy

### MVP First (US1)

1. Phase 1 → Phase 2 (checkpoint, bundle measured).
2. Phase 3: US1. Stop and validate: valid links open exactly, zero writes.
3. Note: US1 alone ships links whose instrument differs without the notice/actions. Do not release before US2 (both P1); US1 is the validation milestone, US1+US2+US3 the release set.

### Incremental Delivery

1. Setup + Foundational → decoder and stores ready.
2. US1 → validate. 3. US2 → validate. 4. US3 → validate. 5. US4 → validate. 6. Polish, `pnpm verify`.

## Notes

- Tests before implementation; see them fail.
- Existing 022 tests and fixtures are never edited (fixtures only grow).
- Commit after each task or logical group (Conventional Commits).
- No `{@html}`; all text from the catalog; note names only through `src/lib/notation`.
