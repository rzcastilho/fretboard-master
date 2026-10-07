---

description: "Task list for 028 Anonymous Usage Measurement and Error Reporting"
---

# Tasks: Anonymous Usage Measurement and Error Reporting

**Input**: Design documents from `/specs/028-anonymous-measurement/`

**Prerequisites**: plan.md, spec.md, research.md (R-01…R-17), data-model.md, contracts/ (`measurement-wire.md`, `client-api.md`, `ui-about.md`, `monitoring.md`), quickstart.md

**Tests**: INCLUDED. FR-016 requires every acceptance scenario to be covered by an automated test, and constitution Principle IV requires logic tests to precede their module. Each test task precedes the implementation it covers; write it, see it fail, then implement.

**Organization**: grouped by user story. Stories US1–US5 map to spec.md (US1/US2 = P1, US3/US4 = P2, US5 = P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1…US5 (user-story phases only)
- All paths are relative to the repo root

## Local verification (CLAUDE.md "Verification during implementation")

- Unit, per task or checkpoint: `pnpm vitest run <touched test paths>`
- E2E, per checkpoint: `pnpm build:test` once (rebuild after any `src/` change), then `pnpm test:e2e:fast <spec files added or edited>` (desktop project only)
- Test files that render components or touch `document`, `window`, `localStorage` MUST start with `// @vitest-environment jsdom`. Pure logic tests need no docblock.
- Do NOT run `pnpm test:e2e` or `pnpm lhci` locally. Run `pnpm verify` once, in the final phase.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: build setting, config, lint boundaries, local server route

- [X] T001 Add the `__FM_MEASURE_ENDPOINT__` define to `vite.config.ts` with R-05 rule (`process.env.VITEST || mode === 'development'` → `''`; otherwise `process.env.FM_MEASURE_ENDPOINT ?? '/m'`) and declare `declare const __FM_MEASURE_ENDPOINT__: string;` in `src/app.d.ts`
- [X] T002 [P] Create `wrangler.toml` at the repo root exactly as in research R-02 (`name = "fretboard-master"`, `pages_build_output_dir = "build"`, `compatibility_date = "2026-10-01"`, `[[analytics_engine_datasets]]` binding `MEASURE`, dataset `fretboard_master_measure`)
- [X] T003 [P] Edit `eslint.config.js`: lint `functions/**`; add a boundary block so `src/lib/measure/wire.ts` and `src/lib/measure/sanitize.ts` cannot import `$lib`, `svelte`, `$app` or `$env` (relative imports and `valibot` only). Confirm `tsconfig.json` / `pnpm check` covers `functions/**`
- [X] T004 [P] Edit `scripts/serve-build.mjs`: answer `POST /m` with `204`, empty body, `Cache-Control: no-store`, so Lighthouse and unstubbed e2e runs see no 404 noise

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: pure modules, shared allowlist, transport, and the inert facade skeleton that every story builds on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests first (pure modules, node environment, no docblock)

- [X] T005 [P] Write `tests/unit/measure/wire.test.ts`: accepts the §3 examples of `contracts/measurement-wire.md`; strips unknown keys (e.g. `ip`); rejects `start` on a non-`tool-opened` event, `secs` > 3600 or on a non-`first-interaction` event, `key` on a `drawing` report, missing `name`+`msg` on a `drawing` report, a batch with `v` ≠ 1 / 0 items / 11 items; `view` limits (≤ 24 keys, key `^[a-z][a-z0-9]{0,15}$`, value `^[A-Za-z0-9._-]{0,48}$`); enum equality tests: `Language` = `LANGUAGES`, `Handedness` = `HANDEDNESS`, `TuningTrait` = `TUNING_PRESETS` ids + `custom`
- [X] T006 [P] Write `tests/unit/measure/sanitize.test.ts`: `"failed https://x.y/a?b"` → `"failed <url>"`; `"/triads?rt=c"` → `<url>`; 500-char input → exactly 200 chars; `reportKey` is `kind|tool|name|msg` for errors and `kind|tool|key` for missing-text
- [X] T007 [P] Write `tests/unit/measure/traits.test.ts`: `traitsOf` returns `{ strings, tuning, hand }` with preset id or `'custom'` and never offsets/notes; `instrumentOf` adds `frets`; `sameTraits` equality; orientation and fret count are not traits
- [X] T008 [P] Write `tests/unit/measure/device.test.ts`: `deviceClass({ coarse, shortSide })` → `phone` (coarse, < 600), `tablet` (coarse, ≥ 600), `desktop` (not coarse); boundary at 599/600
- [X] T009 [P] Write `tests/unit/measure/queue.test.ts` with fake timers and injected `QueueDeps`: flush at 10 items; flush 5000 ms after the first queued item; manual `flush()` (hidden/pagehide) sends and empties; flushing empty is a no-op; 51st usage event dropped; 11th report dropped; duplicate report (same `reportKey`) dropped and counts nothing; caps and de-dup never reset after a flush; serialized body is `{"v":1,"items":[…]}` ≤ 16 KB
- [X] T010 [P] Add `viewParams` cases to the existing link tests under `tests/unit/link/` (new file `tests/unit/link/view-params.test.ts` if no fitting file exists): per tool returns only `PARAM_ORDER[tool]` view tokens, never `v`, `sc`, `tu`, `fr`, and never origin or path; custom tuning snapshot yields no `tu`

### Implementation

- [X] T011 Create `src/lib/measure/wire.ts` (Valibot + relative imports only): enums per data-model §1 (`EVENT_TYPES`, `FAILURE_KINDS`, `TUNING_TRAITS`, `HANDS`, languages, device classes, tools), `UsageEvent` and `FailureReport` schemas exactly as data-model §4/§5 and contract §3 (`start` only literal `true` on `tool-opened`; `secs` integer 0..3600 only on `first-interaction`; `ver` regex `^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]{1,32})?$`; `name` `^[A-Za-z_$][\w$]{0,63}$`; `msg` ≤ 200; `key` `^[a-z0-9_]{1,96}$`; exactly one of `name`+`msg` or `key` matching `kind`), `BatchSchema` (`v: 1`, 1..10 items), `parseItems(body)` returning valid stripped items only, `MAX_BODY_BYTES = 16_384`, `MAX_BATCH = 10`. Makes T005 pass
- [X] T012 [P] Create `src/lib/measure/sanitize.ts`: `sanitizeMessage(raw)` replaces `/https?:\/\/\S+/g` and `/(?:^|\s)\/[^\s?#]*[?#]\S*/g` with `<url>` then truncates to 200 chars; `reportKey(r)`. No `$lib` imports. Makes T006 pass
- [X] T013 [P] Create `src/lib/measure/traits.ts`: `traitsOf`, `instrumentOf`, `sameTraits` per data-model §2/§3 (import `InstrumentConfig` type from `$lib/instrument`). Makes T007 pass
- [X] T014 [P] Create `src/lib/measure/device.ts`: `deviceClass(input)` and `readDeviceClass()` (`matchMedia('(pointer: coarse)')` + `Math.min(screen.width, screen.height)`), computed once, nothing stored. Makes T008 pass
- [X] T015 [P] Create `src/lib/measure/queue.ts`: `createQueue(deps)` with `push`/`flush` per data-model §8 (flush at 10, 5000 ms timer armed by first push into empty queue, caps 50 events / 10 reports, `reportKeys` de-dup, `{v:1,items}` serialization). Makes T009 pass
- [X] T016 [P] Add `export function viewParams(snapshot: ShareSnapshot): Record<string, string>` to `src/lib/link/encode.ts` per R-11 (view tokens of `PARAM_ORDER[tool]` only; never `v`, `sc`, `tu`, `fr`). Makes T010 pass
- [X] T017 [P] Create `src/lib/measure/transport.ts`: `trackingRefused()` (`navigator.globalPrivacyControl === true || navigator.doNotTrack === '1'`) and `createTransport(endpoint)` per `contracts/client-api.md` §3: `sendBeacon(endpoint, Blob text/plain)`, else `fetch` with `keepalive: true`, `credentials: 'omit'`, `redirect: 'error'`, `cache: 'no-store'`, result discarded; everything in `try/catch` with an empty `catch` carrying the constitution-required comment
- [X] T018 Create `src/lib/measure/measure.svelte.ts` skeleton (depends on T011–T017): module state per data-model §7, `enabled = endpoint !== ''` (refusal added in US2), device class read at `start()`, queue built over `createTransport`, internal `emit(item)` helper, the `measure` object with `start()` plus no-op stubs for the other methods in `contracts/client-api.md` §4, and test seams `useMeasureForTests(deps)` / `resetMeasureForTests()`. With an empty endpoint: no queue, timers or listeners (FR-005a)
- [X] T019 Edit `src/hooks.client.ts`: call `measure.start()` after `opening.start(...)` so baseline traits are captured after preference restore and link open

**Checkpoint**: `pnpm vitest run tests/unit/measure tests/unit/link` green. Facade exists but sends nothing yet.

---

## Phase 3: User Story 1 - The team learns how the product is used, without knowing anyone (Priority: P1) 🎯 MVP

**Goal**: the six usage events are sent with only the permitted fields and no identifier.

**Independent Test**: open Triads in a fresh browser, tap a fret, hide the page: one batch with `tool-opened` (`start: true`) and `first-interaction` (`secs`), allowlisted keys only (quickstart §2 rows US1-1…US1-6).

### Tests for User Story 1 ⚠️ write first, confirm they fail

- [X] T020 [P] [US1] Write `tests/unit/measure/measure.test.ts` (start with `// @vitest-environment jsdom`; use `useMeasureForTests`): `toolOpened` once per tool per load and `start: true` only on the first; `firstInteraction` once with whole-seconds `secs` capped at 3600, `secs` omitted when the page was hidden earlier or at start; `soundPlayed` once, tagged with the last opened tool; `linkShared` carries only the tool; `linkOpened` once; `instrumentEdited` ×5 within 1 s sends one event with final traits, nothing when traits return to the baseline, nothing when a custom-notes edit stays `custom`; every sent item parses with `parseItems` and has only allowlisted keys, no id-like field (US1-6); events from two simulated loads share nothing beyond allowed fields
- [X] T021 [P] [US1] Write `tests/unit/measure/hooks.test.ts` (jsdom) driving existing store seams (`resetPlaybackForTests`, `useSharePlatformForTests`, `resetOpeningForTests`): playback scheduling a sound calls `soundPlayed` once; share delivered (sheet resolved, clipboard resolved, manual panel) calls `linkShared`, a cancelled system sheet (`AbortError`) does not; `opening.start` applying a snapshot calls `linkOpened`, unknown-tool/parse-failure branches do not; instrument panel actions call `instrumentEdited`, while `restore`, `receive`, `useMine` do not
- [X] T022 [P] [US1] Write `e2e/measurement.spec.ts` (US1 part; capture with `page.route('**/m', …)` fulfilling 204; reuse helpers from `e2e/support`): US1-1 `/triads` + tap a fret + hide page → `tool-opened` with `start: true` and `first-interaction` with integer `secs`; US1-2 press Listen twice → exactly one `sound-played`; US1-3 Share via clipboard path → `link-shared`, no item value contains `http`, `/triads` or `?`; US1-4 open a shared Triads link → `link-opened` with `tool: triads`, broken link → none; US1-5 preset tuning then custom → `instrument-changed` after 1 s with id then `custom`, no note names; US1-6 two loads share no id-like value

### Implementation for User Story 1

- [X] T023 [US1] Implement in `src/lib/measure/measure.svelte.ts` (after T018): `toolOpened`, `firstInteraction` (`Math.min(3600, Math.floor(performance.now() / 1000))`; `hiddenSeen` initialised from `document.visibilityState === 'hidden'` and set by `visibilitychange` → hidden, R-08), `soundPlayed`, `linkShared`, `linkOpened`, `instrumentEdited` (1000 ms debounce, compare `traitsOf(instrument.active)` with `lastTraits` captured at `start()`), each building a `UsageEvent` with current device, active language, current traits. Makes T020 pass
- [X] T024 [P] [US1] Edit `src/lib/shell/ToolLayout.svelte`: `$effect` calling `measure.toolOpened(tool)` on mount and tool change
- [X] T025 [P] [US1] Edit `src/lib/tools/notes/NotesTool.svelte`: fretboard `onactivate` handler also calls `measure.firstInteraction()`
- [X] T026 [P] [US1] Edit `src/lib/tools/triads/TriadsTool.svelte`: same `measure.firstInteraction()` call in `onactivate`
- [X] T027 [P] [US1] Edit `src/lib/tools/caged/CagedTool.svelte`: same `measure.firstInteraction()` call in `onactivate`
- [X] T028 [P] [US1] Edit `src/lib/state/playback.svelte.ts`: call `measure.soundPlayed()` after `note | chord | sequence | timeline` schedules at least one mark while not muted
- [X] T029 [P] [US1] Edit `src/lib/state/share.svelte.ts`: call `measure.linkShared(tool)` in `run` after the cascade delivers a link (sheet resolved, clipboard resolved, manual panel shown); nothing on `AbortError`
- [X] T030 [P] [US1] Edit `src/lib/state/opening.svelte.ts`: call `measure.linkOpened(s.tool)` after a snapshot is applied (including incomplete links with fallbacks); not in the `unknown-tool` or `catch` branches
- [X] T031 [P] [US1] Edit `src/lib/state/instrument.svelte.ts`: panel-action methods (string count, tuning preset, custom tuning steps, frets, handedness, orientation) call `measure.instrumentEdited()`; `receive`, `restore`, `useMine` do not

**Checkpoint**: `pnpm vitest run tests/unit/measure`, then `pnpm build:test && pnpm test:e2e:fast e2e/measurement.spec.ts`. US1 independently verifiable.

---

## Phase 4: User Story 2 - Measurement never gets in the user's way (Priority: P1)

**Goal**: with the service slow, blocked or down, or DNT/GPC on, the interface behaves identically and nothing is sent when refused.

**Independent Test**: fail every `/m` request and run core flows; output and timing match the healthy case (quickstart §2 US2-1, US2-4; §3).

### Tests for User Story 2 ⚠️ write first

- [X] T032 [P] [US2] Write `tests/unit/measure/transport.test.ts` (jsdom): beacon path used when `sendBeacon` returns `true`; fallback `fetch` options exactly `keepalive: true`, `credentials: 'omit'`, `redirect: 'error'`, `cache: 'no-store'`; absent `sendBeacon`, throwing `sendBeacon`, rejecting `fetch` and throwing `fetch` never throw to the caller; `trackingRefused` true for `globalPrivacyControl === true` and for `doNotTrack === '1'`, false otherwise
- [X] T033 [US2] Extend `tests/unit/measure/measure.test.ts` (after T020, same file): inert when endpoint empty (no queue, timers or listeners) and when `refused`; every facade method never throws even if `send`, timers or `performance` throw; flush on `visibilitychange` → hidden and on `pagehide`; a bfcache restore (`pageshow` with `persisted`) re-sends no once-per-load event
- [X] T034 [US2] Extend `e2e/measurement.spec.ts` (after T022) with US2: `/m` aborted, 500, 30 s delay and 302 → identical visible output, no notice, no app console error; DNT and GPC via `addInitScript` (`navigator.globalPrivacyControl` getter, and `navigator.doNotTrack` `'1'`) → zero requests to `/m` across every screen (SC-004)
- [X] T035 [P] [US2] Edit `e2e/perf.spec.ts`: run the budgets (tool open ≤ 300 ms, control → update ≤ 100 ms, tap → sound ≤ 100 ms) once with `/m` fulfilled 204 and once with `/m` aborted (SC-002)
- [X] T036 [P] [US2] Edit `e2e/privacy.spec.ts`: keep every existing assertion; extend the same-origin check so every same-origin non-GET request is `POST /m` and no cookie or storage key is created by measurement (FR-015, R-17)

### Implementation for User Story 2

- [X] T037 [US2] Edit `src/lib/measure/measure.svelte.ts`: set `enabled = endpoint !== '' && !trackingRefused()` once at `start()`; register `visibilitychange` (hidden → set `hiddenSeen`, `queue.flush()`) and `pagehide` (`queue.flush()`) listeners only when enabled; wrap every public facade method in a try/catch that never rethrows (comment per constitution); no `await`, no DOM reads on the interaction path (array push only). Makes T033 pass
- [X] T038 [US2] Edit `tests/unit/csp.test.ts` only if it asserts anything now invalidated; otherwise add one assertion that `connect-src` is still exactly `'self'` and no origin was added (FR-014). Run `pnpm vitest run tests/unit/csp.test.ts tests/unit/headers.test.ts`

**Checkpoint**: `pnpm vitest run tests/unit/measure tests/unit/csp.test.ts`, then `pnpm test:e2e:fast e2e/measurement.spec.ts e2e/perf.spec.ts e2e/privacy.spec.ts`. US1 + US2 = shippable measurement client.

---

## Phase 5: User Story 3 - Unexpected failures are recorded so the team can reproduce them (Priority: P2)

**Goal**: calculation, drawing, audio and missing-text failures each produce one anonymous report; the user still sees the usual fallback.

**Independent Test**: force a Triads drawing fault; the fallback shows and exactly one `drawing` report with view params and instrument arrives (quickstart §2 US3-1…US3-5).

### Tests for User Story 3 ⚠️ write first

- [X] T039 [P] [US3] Edit `tests/unit/failure.test.ts` (jsdom docblock stays): `recordFailure` still logs to the console exactly as before (FR-010); calls `measure.report` with kind `drawing` by default, `calculation` for errors tagged by `markCalculation` (which rethrows the same error), `audio` when passed `'audio'`; tool `null` → `shell`; non-`Error` values go through the sanitizer
- [X] T040 [P] [US3] Write `tests/unit/measure/reports.test.ts` (jsdom): report carries `kind`, `tool`, `device`, `lang`, `strings`, `tuning`, `hand`, `frets`, `ver`, `view` (from `viewParams(currentSnapshot(tool))`, omitted for `shell`), and either `name`+`msg` or `key`; custom tuning reports `"custom"` and no offsets (US3-5); message with URL → `<url>`, ≤ 200 chars, no stack; same failure twice → one item; 11th distinct report dropped; every item passes `parseItems`
- [X] T041 [P] [US3] Edit `tests/unit/language-store.test.ts`: a missing text key calls `measure.missingText(key)` once per locale and key, beside the existing `console.warn`; English fallback text unchanged
- [X] T042 [P] [US3] Edit `tests/unit/fault.test.ts`: `maybeFault(tool, phase?)` with `'calculation' | 'drawing'` throws only under the existing test/dev fault gate (ADR 0004) and never in a production build
- [X] T043 [US3] Extend `e2e/measurement.spec.ts` (after T034) with US3: `__fmFault` drawing fault in Triads → fallback view and one `drawing` report with `view` and instrument; calculation fault and the existing audio-failure seam from `playback.spec.ts` → one `calculation` / `audio` report each; same fault twice → one report; custom tuning + fault → `tuning: "custom"`, no offsets; missing translation → one `missing-text` report with the key, once per key per load

### Implementation for User Story 3

- [X] T044 [US3] Edit `src/lib/measure/measure.svelte.ts`: implement `report({ kind, tool, error })` and `missingText(key)` (tool = `currentTool ?? 'shell'`): build `FailureReport` from `viewParams(currentSnapshot(tool))`, `instrumentOf(instrument.active)`, device, language, `__APP_VERSION__`, `sanitizeMessage(error.message)`, error `name`; push through the queue (de-dup + 10-report cap). Makes T040 pass
- [X] T045 [US3] Edit `src/lib/shell/failure.ts`: `recordFailure(tool, error, kind?)` keeps its console output and also calls `measure.report`; add `markCalculation(fn)` (module `WeakSet`, rethrows the same error); unmarked errors reaching a boundary or `handleError` are `drawing`. Check `src/hooks.client.ts` `handleError` routes through `recordFailure(null, …)` so shell failures report as `shell`. Makes T039 pass
- [X] T046 [P] [US3] Edit `src/lib/shell/fault.ts`: `maybeFault(tool, phase?)` for `calculation` / `drawing` injection, gated exactly like today (ADR 0004). Makes T042 pass
- [X] T047 [P] [US3] Edit `src/lib/tools/notes/NotesTool.svelte`: wrap display-model derivation with `markCalculation` and add the `maybeFault(tool, 'calculation' | 'drawing')` calls at the matching points
- [X] T048 [P] [US3] Edit `src/lib/tools/triads/TriadsTool.svelte`: same `markCalculation` and `maybeFault` wiring
- [X] T049 [P] [US3] Edit `src/lib/tools/caged/CagedTool.svelte`: same `markCalculation` and `maybeFault` wiring
- [X] T050 [P] [US3] Edit `src/lib/state/playback.svelte.ts`: audio unlock/start failures behind the "sound unavailable" notice call `recordFailure(tool, e, 'audio')`; the notice itself is unchanged
- [X] T051 [P] [US3] Edit `src/lib/state/language.svelte.ts`: call `measure.missingText(key)` inside the existing `takeUnreported` loop. Makes T041 pass

**Checkpoint**: `pnpm vitest run tests/unit/failure.test.ts tests/unit/fault.test.ts tests/unit/language-store.test.ts tests/unit/measure`, then `pnpm build:test && pnpm test:e2e:fast e2e/measurement.spec.ts e2e/resilience.spec.ts`.

---

## Phase 6: User Story 4 - The About page says exactly what is measured (Priority: P2)

**Goal**: the privacy section lists the six events, the four trait kinds, error reports, what is never collected and the DNT/GPC rule, in en, pt-BR and es, within the existing caps.

**Independent Test**: open About in each language and compare the text with the events actually sent (automated by T053).

### Tests for User Story 4 ⚠️ write first

- [X] T052 [P] [US4] Edit `tests/unit/i18n/about-catalog.test.ts`: twelve statements in `contracts/ui-about.md` §2; `about_privacy_not_measured` absent from all catalogs; word caps ≤ 220 (en) and ≤ 280 (pt-BR, es) summed over the twelve; no jargon (en `data controller`/`processing`/`lawful basis`; pt-BR `controlador`/`tratamento`/`base legal`; es `responsable del tratamiento`/`tratamiento`/`base jurídica`); `about_privacy_no_ads` byte-identical to its current value; no third-party name
- [X] T053 [P] [US4] Write `tests/unit/measure/about-matches-wire.test.ts` per `contracts/ui-about.md` §5: per-locale term map keys equal `EVENT_TYPES` and the trait kinds (tool, device, lang, instrument = `strings`, `tuning`, `hand`); every phrase appears in that locale's `about_privacy_measured`; `about_privacy_never` names identifiers, link addresses and custom tuning; `about_privacy_dnt` names both Do Not Track and Global Privacy Control
- [X] T054 [P] [US4] Edit `tests/unit/privacy-policy.test.ts` (jsdom): renders twelve list items in the §2 order, none reading "Nothing is measured"

### Implementation for User Story 4

- [X] T055 [P] [US4] Edit `messages/en.json`: remove `about_privacy_not_measured`; add `about_privacy_measured`, `about_privacy_errors`, `about_privacy_never`, `about_privacy_dnt`; tighten `about_privacy_stored`, `_erase`, `_hosting`, `_share_links`, `_all_ages` (same claims) using the worked draft in `contracts/ui-about.md` §4; whole text ≤ 220 words (research R-14 noted an earlier draft at 224: keep trimming, never raise the cap)
- [X] T056 [P] [US4] Edit `messages/pt-BR.json`: same key changes, natural pt-BR, ≤ 280 words, no jargon
- [X] T057 [P] [US4] Edit `messages/es.json`: same key changes, natural es, ≤ 280 words, no jargon
- [X] T058 [US4] Edit `src/lib/shell/PrivacyPolicy.svelte`: render the twelve statements in the `contracts/ui-about.md` §2 order (measurement block replaces the old `not_measured` position); no new component, control or style. Run `pnpm check` (regenerates Paraglide). Makes T052–T054 pass
- [X] T059 [US4] Edit `e2e/about.spec.ts`: the privacy section lists the new statements in each language; axe stays at zero violations

**Checkpoint**: `pnpm vitest run tests/unit/i18n/about-catalog.test.ts tests/unit/privacy-policy.test.ts tests/unit/measure/about-matches-wire.test.ts`, then `pnpm build:test && pnpm test:e2e:fast e2e/about.spec.ts`.

---

## Phase 7: User Story 5 - The team can read the three targets and watch service health (Priority: P3)

**Goal**: `/m` stores allowlisted data in Analytics Engine; M-5/M-6/M-7 are computable without user-level joins; delivery is monitored.

**Independent Test**: feed a known item set and confirm each metric is computable from counts and `secs` alone; run the uptime script (quickstart §1, §4, §5).

### Tests for User Story 5 ⚠️ write first

- [X] T060 [P] [US5] Write `tests/unit/functions/m.test.ts` with a fake `MEASURE` binding covering every row of `contracts/measurement-wire.md` §5: `GET`/`PUT`/`DELETE`/`OPTIONS` → 405 with `Allow: POST`; valid batch of n → n points; mixed valid/invalid → valid count; extra key `ip` → written point without it; body of 16 385 bytes → 0 writes; invalid JSON → 0; binding undefined → 0; `writeDataPoint` throws on item 1 of 2 → item 2 still attempted; always 204, `Cache-Control: no-store`, no `Set-Cookie`, `console` never called; written points use only the §4 slot layout (index = `type`/`kind`, `blob1`…`blob11`, `double1`…`double4`) and never `request.cf`, headers or IP
- [X] T061 [P] [US5] Write `tests/unit/measure/metrics.test.ts`: a TypeScript mirror of the documented SQL over a known item set (weighted by `_sample_interval`; median via exact weighted quantile) yields hand-computed M-5 median seconds, M-6 sound ÷ sessions (sessions = `tool-opened` with `start`), and M-7 per-device share with the phone-vs-desktop gap (SC-005)
- [X] T062 [P] [US5] Write `tests/unit/uptime-check.test.ts` with a fake `fetch` against `checkSite(base, fetchImpl)`: healthy; status 500; slower than 2000 ms; HTML with no `/_app/immutable/` asset → failure; empty URL → skip notice and exit 0

### Implementation for User Story 5

- [X] T063 [US5] Create `functions/m.ts` exporting `onRequest` per research R-02 and `contracts/measurement-wire.md` §1/§4/§5: non-POST → 405; read body text with a 16 KB cap before parsing; `JSON.parse` in `try`; validate with `parseItems` imported from `../src/lib/measure/wire` (relative import only); one `env.MEASURE.writeDataPoint(...)` per valid item, each in its own `try`; always `204` with `Cache-Control: no-store`; never read `request.cf` or headers other than `content-length` / `content-type`; no `console.*`; local `interface MeasureEnv { MEASURE?: { writeDataPoint(p: DataPoint): void } }` (no new dependency). Empty `catch` blocks carry the constitution-required comment. Makes T060 pass
- [X] T064 [P] [US5] Create `docs/measurement.md`: fields collected, retention (Analytics Engine fixed 3 months, sole store, FR-018), the runnable SQL for sessions, M-5, M-6 and M-7 from `contracts/measurement-wire.md` §6 (`SUM(_sample_interval)`, `quantileExactWeighted(0.5)(double3, _sample_interval)`), the data point slot table, and the note that previews write to the same dataset
- [X] T065 [P] [US5] Create `scripts/uptime-check.mjs` per `contracts/monitoring.md`: exports `checkSite(base, fetchImpl)`; `GET <url>/` must be 200 within 2000 ms (`AbortSignal.timeout(2000)`); first `/_app/immutable/…` URL in the HTML (script `src` or link `href`) must be 200 within 2000 ms; no asset found → exit 1; empty URL → print `uptime-check: PRODUCTION_URL not set, skipping`, exit 0; one line per URL with status and elapsed ms. Makes T062 pass
- [X] T066 [US5] Create `.github/workflows/uptime.yml` per `contracts/monitoring.md`: `schedule: cron '*/15 * * * *'` + `workflow_dispatch`, `permissions: contents: read`, `actions/checkout@v4`, `jdx/mise-action@v2`, step `node scripts/uptime-check.mjs "${{ vars.PRODUCTION_URL }}"`. Depends on T065
- [X] T067 [P] [US5] Create `docs/adr/0027-anonymous-measurement-pages-function.md` (next after `0026-character-key-shortcuts.md`): records the Pages Function `/m` as the Principle II measurement-service exception, the `MEASURE` binding and data point layout, `wrangler.toml` becoming the source of truth for Pages settings, previews writing to the same dataset, and the duplicated enum lists in `wire.ts` guarded by an equality test

**Checkpoint**: `pnpm vitest run tests/unit/functions tests/unit/measure/metrics.test.ts tests/unit/uptime-check.test.ts`; all five stories complete.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: budgets, hygiene, final gates

- [X] T068 [P] Bundle check: `pnpm build && node scripts/check-bundle-size.mjs build` stays ≤ 150 KB gzip initial JS (expected +3–4 KB, R-16); no budget raise
- [X] T069 [P] Hygiene sweep with `rtk grep`: every empty `catch` in `src/lib/measure/**` and `functions/m.ts` carries the constitution-required comment and none exists elsewhere; no `localStorage`, `sessionStorage`, `indexedDB` or `document.cookie` use under `src/lib/measure/`; no `any`; no `console.*` in `functions/m.ts`
- [X] T070 Run quickstart §4 manually: `pnpm build && pnpm exec wrangler pages dev build`, `curl -i -X POST http://localhost:8788/m --data '{…}'` → `204`, `cache-control: no-store`, no `set-cookie`; `curl -i http://localhost:8788/m` → `405`
  - 2026-10-07: workerd does not start on macOS 12.6 (needs 13.5+), so ran `wrangler@4.145.0 pages dev build` in a `node:22-bookworm` container against the production build. `POST /m` → `204`, `Cache-Control: no-store`, no `set-cookie`; `GET /m` → `405`, `Allow: POST`. `MEASURE` binding listed.
- [X] T071 Run all local gates once: `pnpm verify` (the full Playwright matrix, Lighthouse and Firefox/WebKit smoke run in CI only; do not run `pnpm test:e2e` locally)
  - 2026-10-07: check, lint, format, unit + coverage (201 files / 4820 tests), build, bundle size, build:test all green; e2e 1334 passed, 17 failed — all 17 in `e2e/perf.spec.ts` timing budgets while machine load average was 43–84. Rerun `PW_WORKERS=1 pnpm test:e2e:fast e2e/perf.spec.ts` at lower load: 23/23 passed.
- [X] T072 Production enablement notes in the PR description (drafted in `pr-notes.md`; no PR open yet): set repository variable `PRODUCTION_URL`, run `uptime.yml` once via `workflow_dispatch`, confirm green (SC-007); Cloudflare Pages deploys the `MEASURE` binding from `wrangler.toml`; Q-11 legal review remains a pre-launch gate (no consent flow in this slice)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none; T002–T004 parallel after or alongside T001
- **Foundational (Phase 2)**: depends on Phase 1 (T001 for the define; T003 for the lint boundary). Blocks all stories
- **US1 and US2 (P1)**: after Phase 2. US2 implementation (T037) edits the same facade file as US1 (T023), so do US1 first, then US2
- **US3 (P2)**: after Phase 2 and T023 (shares the facade file); touches the same tool files as US1 (T025–T027 before T047–T049) and `playback.svelte.ts` (T028 before T050)
- **US4 (P2)**: after Phase 2 only; independent of US1–US3 except the wire enums (T011)
- **US5 (P3)**: after T011 (wire) for the Function; monitoring tasks (T065, T066) and docs are independent of everything
- **Polish**: after all desired stories

### Within Each Story

- Test tasks before the code they cover; confirm failure first (constitution IV)
- Pure modules before the facade; facade before call sites; call sites before e2e
- `e2e/measurement.spec.ts` is edited by T022, T034, T043 in order (same file, never parallel)
- `src/lib/measure/measure.svelte.ts` is edited by T018, T023, T037, T044 in order

### Story Independence

- US1 alone is a working client (events queued and sent to `/m`)
- US2 adds refusal and resilience guarantees; the privacy claim in About (US4) must not ship before US2's DNT/GPC gating (T037)
- US3 and US4 are independent of each other
- Do not deploy to production before US4 (About text must stop saying nothing is measured, FR-013) and US5's Function (T063) exist; without the Function, `/m` posts are silently dropped (404 ignored)

---

## Parallel Examples

```bash
# Phase 2 tests together (all different files):
Task: "T005 wire.test.ts"   Task: "T006 sanitize.test.ts"   Task: "T007 traits.test.ts"
Task: "T008 device.test.ts" Task: "T009 queue.test.ts"       Task: "T010 view-params.test.ts"

# Phase 2 modules together after their tests:
Task: "T012 sanitize.ts"  Task: "T013 traits.ts"  Task: "T014 device.ts"
Task: "T015 queue.ts"     Task: "T016 viewParams"  Task: "T017 transport.ts"

# US1 call sites together (different files) after T023:
Task: "T024 ToolLayout.svelte"  Task: "T025 NotesTool.svelte"  Task: "T026 TriadsTool.svelte"
Task: "T027 CagedTool.svelte"   Task: "T028 playback.svelte.ts"  Task: "T029 share.svelte.ts"
Task: "T030 opening.svelte.ts"  Task: "T031 instrument.svelte.ts"

# US4 catalogs together:
Task: "T055 en.json"  Task: "T056 pt-BR.json"  Task: "T057 es.json"

# US5 tests together:
Task: "T060 m.test.ts"  Task: "T061 metrics.test.ts"  Task: "T062 uptime-check.test.ts"
```

---

## Implementation Strategy

### MVP First (US1 + US2, both P1)

1. Phase 1 Setup, Phase 2 Foundational
2. Phase 3 US1 → validate with unit tests and `e2e/measurement.spec.ts`
3. Phase 4 US2 → validate DNT/GPC, service-down, perf budgets
4. STOP and validate: events are correct, private and never in the way. Do not release yet (see Story Independence for release gates)

### Incremental Delivery

1. Setup + Foundational → pure core ready
2. US1 → US2 → measurement client done
3. US3 → failure reports
4. US4 → About text accurate (required before release)
5. US5 → Function, SQL docs, uptime monitor (required before release to store anything)
6. Polish → bundle, hygiene, `pnpm verify`, PR

### Notes

- [P] = different files, no dependency on an incomplete task
- Commit after each task or logical group (Conventional Commits)
- Reports never change what the user sees (FR-010); verify the existing fallback and English text fallback tests still pass at every checkpoint
- Never add a persistent identifier, cookie, storage key or new origin; if a task seems to need one, stop
