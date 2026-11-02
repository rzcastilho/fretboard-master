---

description: "Task list for 040 Practise Offline"
---

# Tasks: Practise Offline

**Input**: Design documents from `/specs/040-offline-practice/`

**Prerequisites**: plan.md, spec.md, research.md (R-01 … R-14), data-model.md, contracts/ (service-worker, registration, web-app-manifest), quickstart.md

**Tests**: Requested. Constitution IV (test-first for logic, tested behaviour for UI) and research R-12 require them. Write each unit test first and see it fail before the implementation.

**Organization**: Grouped by user story. Foundational work (pure module, stamp script, worker, registration, build wiring, Playwright default) comes first, so each story is a small increment on top.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US4, from spec.md
- A unit test file that renders a component or touches `document`, `window` or `localStorage` MUST start with `// @vitest-environment jsdom`. Pure logic tests need no docblock.

## Verification (CLAUDE.md)

- Per task: `pnpm vitest run <touched test paths>`.
- E2E: `pnpm build:test` once after `src/` or `scripts/` changes, then `pnpm test:e2e:fast <spec files added or edited>`.
- Update test (US3): `pnpm build:test:skew`, then `pnpm test:e2e:fast e2e/offline-update.spec.ts e2e/version-skew.spec.ts`.
- This feature adds no screenshot. Do not run `--update-snapshots`.
- `pnpm verify` once at the end. Never run `pnpm test:e2e` or `pnpm lhci` locally.

## Path Conventions

Single SvelteKit project. New directories: `src/lib/offline/`, `static/icons/`, `tests/unit/offline/`.

---

## Phase 1: Setup

**Purpose**: Decision record and lint/config scaffolding that every later task relies on.

- [X] T001 [P] Write `docs/adr/0031-offline-copy-service-worker.md` (R-14, C-01). Record: SvelteKit's built-in worker registered by hand; cache name `fm-offline-<version>-<digest>`; cache-first with network fallback; no `skipWaiting` and no `clients.claim`; Playwright blocks workers by default; rejected alternatives (Workbox, `vite-plugin-pwa`, network-first, `skipWaiting` with a reload prompt). Follow the layout of `docs/adr/0030-metronome-click-scheduler.md`
- [X] T002 [P] Add a "see also: 0031, in-tab continuity is now backed by the worker across reloads" line to `docs/adr/0002-single-bundle-for-version-continuity.md`
- [X] T003 [P] Edit `eslint.config.js`: (a) a `no-restricted-imports` and `no-restricted-globals` block for `src/lib/offline/precache.ts` (no DOM, no Svelte, no storage, no `$app`/`$lib` imports other than types); (b) `webworker` globals for `src/service-worker.ts`
- [X] T004 [P] Edit `svelte.config.js` per contracts/registration.md: `kit.serviceWorker: { register: false, files: (file) => file !== '_headers' }` and `kit.version.name: process.env.FM_APP_VERSION ?? version` (keep `pollInterval: 0`). Leave the `csp` block unchanged (R-11)

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: The pure offline module, the worker, the stamp script, registration and build wiring. No user story can pass its e2e until this phase is done.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests first (write them, see them fail)

- [X] T005 [P] Write `tests/unit/offline/precache.test.ts` for `precacheList`, `cacheName` and `isOwnStaleCache` (data-model §1, §3). Cases: `/__not-found` becomes `/404.html` and no other path is renamed; `/service-worker.js` and `/_headers` are dropped even if an input contains them; no duplicates; lexicographic order; every entry starts with `/`; `cacheName('0.1.0','abc123def456')` is `fm-offline-0.1.0-abc123def456` and changes when only the digest changes; `isOwnStaleCache` is true only for names that start with `fm-offline-` and differ from the current name (a foreign cache name is false)
- [X] T006 [P] Write `tests/unit/offline/route.test.ts` for `routeRequest` (data-model §4, R-06). Table: `POST /m` → `pass`; any non-GET → `pass`; cross-origin GET → `pass`; `GET /service-worker.js` → `pass`; navigation `/triads/` → `{ kind: 'redirect', location: '/triads' }`; navigation `/triads/?v=1&x=2` → redirect keeping the query; navigation `/` → `page` with key `/`; navigation `/triads?v=1&…` → `page` with key `/triads`; navigation `/does-not-exist` → `page` with key `/does-not-exist`; `/_app/immutable/x.js` GET (non-navigation) → `asset` with key as pathname, query ignored
- [X] T007 [P] Write `tests/unit/offline/page-references.test.ts` for `pageReferencesWithin(html, list)` (data-model §2, R-04): true when every `/_app/immutable/*` reference in the HTML is in the list; false when one is missing (a deploy landed mid-install); true for HTML with no such references; references with a query or in `modulepreload`, `script` and `link` tags are all found
- [X] T008 [P] Write `tests/unit/offline/stamp.test.ts` for `scripts/stamp-service-worker.mjs` (contracts/service-worker.md, data-model §3). Run it on a fixture directory built in a temp dir: it replaces the single `__FM_BUILD_DIGEST__` literal in `service-worker.js` with 12 lowercase hex characters; the digest is stable for the same files and changes when any one byte of any precached file changes (including `theme-boot.js` and `404.html`); it exits 1 when the literal is found zero times, more than once, or when `404.html` is missing; `service-worker.js` and `_headers` are excluded from the digest; the file-to-URL mapping is `index.html`→`/`, `<name>.html`→`/<name>`, `404.html`→`/404.html`
- [X] T009 [P] Write `tests/unit/offline/register.test.ts` (start with `// @vitest-environment jsdom`) for `registerOffline` (contracts/registration.md, R-08). Cases: `dev === true` does nothing; no `serviceWorker` in `navigator` does nothing; `readyState !== 'complete'` waits for `load` (listener added with `{ once: true }`, `register` not yet called) and then calls `register('/service-worker.js')`; `readyState === 'complete'` registers at once; a rejected `register()` is logged with `console.warn('[fretboard-master] offline unavailable', error)` and never throws; no `updatefound`, `controllerchange` or `reload` handler is attached

### Implementation

- [X] T010 Create `src/lib/offline/precache.ts` (pure; no DOM, Svelte or storage) exporting `PrecacheSources`, `precacheList`, `CACHE_PREFIX = 'fm-offline-'`, `cacheName`, `isOwnStaleCache`, `routeRequest` and `pageReferencesWithin`, per data-model §1, §3, §4 and R-06. Makes T005, T006 and T007 pass
- [X] T011 [P] Create `src/lib/offline/register.ts` exporting `OfflineHost` and `registerOffline(host, dev)` per data-model §7 and contracts/registration.md. It never throws and returns nothing. Makes T009 pass
- [X] T012 Edit `src/hooks.client.ts`: import `registerOffline` and call `registerOffline(window, import.meta.env.DEV)` in `init`, after `measure.start()`
- [X] T013 Create `scripts/stamp-service-worker.mjs [dir=build]` per contracts/service-worker.md "Build-time stamping". Work out the precache list from the files on disk in plain Node (repeat the path-to-URL mapping; build scripts cannot import `$lib`), compute the digest as the first 12 hex chars of SHA-256 over `path + '\0' + bytes + '\0'` for each sorted path, replace the single `__FM_BUILD_DIGEST__` literal in `<dir>/service-worker.js`, exit 1 when the literal is not found exactly once or when `<dir>/404.html` is missing. Makes T008 pass
- [X] T014 Create `src/service-worker.ts` per contracts/service-worker.md. It reads `build`, `files`, `prerendered`, `version` from `$service-worker` and holds the literal `'__FM_BUILD_DIGEST__'` exactly once. `install`: `waitUntil` of a sequential precache (R-04: fetch each entry with `cache: 'no-cache'` and `redirect: 'follow'`, keep bodies in memory, check each response is `ok` except `/404.html` which may be 200 or 404, check stored pages with `pageReferencesWithin`, then open the cache and `put` a fresh `Response` per entry keeping the original `content-type` and the 404 status of `/404.html`; on any failure delete that cache name and reject). `activate`: delete every cache for which `isOwnStaleCache` is true. `fetch`: apply `routeRequest` (`pass` → no `respondWith`; `redirect` → `Response.redirect(location, 308)`; `page` and `asset` → cache hit with `ignoreSearch: true` and `cacheName: current`, else `fetch(request)`, and on a failed `page` fetch answer the cached `/404.html` if present, else `Response.error()`; a failed `asset` fetch answers `Response.error()`). No `skipWaiting`, no `clients.claim`, no `message`, `sync`, `push`, `periodicsync` or `notificationclick` handler. Never touches `localStorage`
- [X] T015 Edit `package.json` scripts: `build` becomes `vite build && node scripts/make-404.mjs && node scripts/stamp-service-worker.mjs`, and `build:test` becomes `vite build --mode test && node scripts/make-404.mjs && node scripts/stamp-service-worker.mjs`
- [X] T016 Edit `scripts/build-next-version.mjs`: run `node scripts/stamp-service-worker.mjs` after `make-404.mjs` for the N+1 build, before the rename to `build-next/` (the final `pnpm build:test` already stamps `build/`)
- [X] T017 [P] Edit `scripts/serve-build.mjs` (R-10): content types `.webmanifest` → `application/manifest+json`, `.png` → `image/png`, `.woff2` → `font/woff2`; `Cache-Control: no-cache` for `service-worker.js` and `manifest.webmanifest`
- [X] T018 [P] Edit `playwright.config.ts`: set `use.serviceWorkers: 'block'` as the default (R-12). Offline specs opt in with `test.use({ serviceWorkers: 'allow' })`
- [X] T019 Run `pnpm vitest run tests/unit/offline` and `pnpm check`, then `pnpm build:test`. Confirm `grep -c "__FM_BUILD_DIGEST__" build/service-worker.js` prints 0 and `node scripts/check-bundle-size.mjs build` is within the budget

**Checkpoint**: The worker builds, is stamped, and registers after `load`. Unit tests pass. Existing e2e specs are unaffected because workers are blocked by default.

---

## Phase 3: User Story 1 - Open and practise with no connection (Priority: P1) 🎯 MVP

**Goal**: After one online load, the home screen, every tool in all three languages, Ratios Training with click and chime, and note sounds all work with the network off.

**Independent Test**: Load once online, call `context.setOffline(true)`, reload, open Home and each tool in en, pt-BR and es, run Ratios Training and play notes.

### Tests for User Story 1

> **NOTE: Write these first and see them fail or skip for the right reason.**

- [X] T020 [US1] Create `e2e/offline.spec.ts` (`test.use({ serviceWorkers: 'allow' })`) with a shared helper that loads `/`, waits for `navigator.serviceWorker.ready`, waits until the offline cache is complete, then sets `context.setOffline(true)`. Add the C-02 test: the cache keys equal the files in `build/`, apart from `service-worker.js` and `_headers`, with each HTML file mapped to its clean URL (`index.html`→`/`, `<name>.html`→`/<name>`, `404.html`→`/404.html`)
- [X] T021 [US1] In `e2e/offline.spec.ts`, add the US1-AS1/AS2/AS5, SC-001 and FR-004 test: offline, reload `/`, then open Notes, Triads, CAGED, Metronome and About in en, pt-BR and es. Assert each page renders its heading, no failure view and no offline or network-error notice, and no failed page request
- [X] T022 [US1] In `e2e/offline.spec.ts`, add the US1-AS3 and C-13 test: offline, start Ratios Training on `/metronome` (`page.clock.install()` as in `e2e/metronome-timer.spec.ts`), read the audio log with `readAudioLog` from `e2e/support/helpers.ts` and assert clicks are scheduled; start the practice timer and assert the chime is scheduled (`type === 'chime'`)
- [X] T023 [US1] In `e2e/offline.spec.ts`, add the US1-AS4 test: offline, play a note on Notes and assert a pluck entry is logged in the audio log
- [X] T024 [US1] In `e2e/offline.spec.ts`, add the C-04 / FR-017 test: offline, a share link `/triads?v=1&…` taken from the existing link fixtures (find them under `tests/unit/link` or `e2e/open-link.spec.ts`) opens that view, `/does-not-exist` shows Home plus the not-found notice, and `/triads/` redirects to `/triads`
- [X] T025 [US1] In `e2e/offline.spec.ts`, add the C-10 / FR-018 test: with the worker active, in-app navigation across every tool makes zero page requests (use `trackRequests` from `e2e/support/helpers.ts`, started after the worker is ready, and ignore requests whose `request.serviceWorker()` is set)
- [X] T026 [US1] In `e2e/offline.spec.ts`, add the C-03 / FR-016 test: offline, `POST /m` is not intercepted. It fails the way it does without a worker and nothing is shown to the user

### Implementation for User Story 1

- [X] T027 [US1] Run `pnpm build:test`, then `pnpm test:e2e:fast e2e/offline.spec.ts`. Fix any gap in `src/service-worker.ts` or `src/lib/offline/precache.ts` the tests expose (for example a build file missing from Kit's `build`, `files` or `prerendered` lists, such as `_app/version.json`: add it explicitly in `precacheList` per R-02)
- [X] T028 [US1] Run `pnpm test:e2e:fast e2e/continuity.spec.ts e2e/measurement.spec.ts e2e/privacy.spec.ts e2e/version-skew.spec.ts`. All must pass unchanged (workers are blocked by default, C-16). The no-JS project is part of the CI-only matrix and is not run locally; CI's `nojs` run is the check for it

**Checkpoint**: User Story 1 works on its own. Verify with `pnpm vitest run tests/unit/offline` and `pnpm test:e2e:fast e2e/offline.spec.ts`.

---

## Phase 4: User Story 2 - Add to the home screen like an installed app (Priority: P2)

**Goal**: The app offers an install identity (name, icons, standalone window) with no account, and opens from `start_url` offline.

**Independent Test**: The manifest parses with the C-11 fields, every icon returns 200, every prerendered page links the manifest, and `/` opens offline under an active worker.

### Tests for User Story 2

- [X] T029 [P] [US2] Write `tests/unit/offline/manifest.test.ts` per contracts/web-app-manifest.md. Assert: `name`, `short_name`, `start_url`, `scope`, `display: standalone` and `id` exactly as in the contract; the key set is exactly `id, name, short_name, start_url, scope, display, background_color, theme_color, icons` (no `description`, `shortcuts`, `share_target`, `protocol_handlers`, `related_applications`); `background_color` equals the light value of `--color-surface` and `theme_color` equals the light value of `--color-surface-raised`, both parsed from `src/lib/styles/tokens.css`; each icon file exists under `static/`, is a PNG, and its IHDR width and height match `sizes`; the 192 and 512 `any` icons and the 512 `maskable` icon are present; `static/icons/apple-touch-icon.png` is 180×180
- [X] T030 [P] [US2] Write `tests/unit/offline/app-html.test.ts`: `src/app.html` contains `<link rel="manifest" href="/manifest.webmanifest" />` and `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />`
- [X] T031 [P] [US2] Edit `tests/unit/headers.test.ts` with matching cases for the new `static/_headers` rules (see T036): `no-cache` on `/service-worker.js`, `/manifest.webmanifest`, `/caged` and `/metronome`; `Content-Type: application/manifest+json` on `/manifest.webmanifest`; `Cache-Control: public, max-age=86400` on `/icons/*` (and not `immutable`)
- [X] T032 [US2] In `e2e/offline.spec.ts`, add the SC-007 / C-11 test: `/manifest.webmanifest` parses and has the C-11 fields, every icon URL returns 200 with `image/png`, `<link rel="manifest">` is present on `/`, `/notes`, `/triads`, `/caged`, `/metronome`, `/about` and `404.html`, an active worker controls the page after reload, and no sign-in or sign-up step appears
- [X] T033 [US2] In `e2e/offline.spec.ts`, add the US2-AS2 / C-12 test: after one load, offline, open the manifest's `start_url` (`/`) in a new page of the same context. Home appears, and Ratios Training runs with scheduled clicks and a scheduled chime. Install `page.clock.install()` on the new page before starting (as in T022) and advance the practice timer with `page.clock` rather than waiting in real time

### Implementation for User Story 2

- [X] T034 [US2] Create `scripts/make-icons.mjs`, a dependency-free PNG encoder (`node:zlib` plus CRC32, R-09). It draws a neutral fretboard glyph (ink-coloured strings and frets on the surface colour) using only ink and surface token values, never the reserved root, third or fifth colours. The maskable icon keeps the glyph inside the central 80% circle. It writes `static/icons/icon-192.png` (192×192), `static/icons/icon-512.png` (512×512), `static/icons/icon-maskable-512.png` (512×512) and `static/icons/apple-touch-icon.png` (180×180, opaque, on the surface colour). Run it and commit the four PNGs
- [X] T035 [US2] Create `static/manifest.webmanifest` exactly as in contracts/web-app-manifest.md (`id` and `start_url` "/", `scope` "/", `name` and `short_name` "Fretboard Master", `display` "standalone", `background_color` "#ffffff", `theme_color` "#f3f4f6", three icons with `purpose` any, any, maskable)
- [X] T036 [US2] Edit `static/_headers` per contracts/web-app-manifest.md: add `/service-worker.js` (`Cache-Control: no-cache`), `/manifest.webmanifest` (`Cache-Control: no-cache`, `Content-Type: application/manifest+json`), `/icons/*` (`Cache-Control: public, max-age=86400`), `/caged` and `/metronome` (`Cache-Control: no-cache`)
- [X] T037 [US2] Edit `src/app.html`: add `<link rel="manifest" href="/manifest.webmanifest" />` and `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />` to the head
- [X] T038 [US2] Run `pnpm vitest run tests/unit/offline tests/unit/headers.test.ts tests/unit/csp.test.ts` (the CSP test must pass unchanged), then `pnpm build:test` and `pnpm test:e2e:fast e2e/offline.spec.ts`. The precache set now also includes the manifest and the four icons, so the C-02 equality test from T020 must still pass

**Checkpoint**: User Stories 1 and 2 both work. Verify with the commands in T038.

---

## Phase 5: User Story 3 - Updates never interrupt a running session (Priority: P2)

**Goal**: A newer version installs in the background and waits. A running metronome in any tab is untouched, the new version takes over on the next launch, and saved values are unchanged.

**Independent Test**: Start a run, switch the server to N+1, call `registration.update()`, confirm the run continues and About still shows N, then close every page, open a new one and confirm About shows N+1.

### Tests for User Story 3

- [X] T039 [US3] Create `e2e/offline-update.spec.ts` (`test.use({ serviceWorkers: 'allow' })`; skip when `build-next/` is missing and for non-chromium, like `e2e/version-skew.spec.ts`). Use `context.route('**/*')` to serve `build/` (N) or `build-next/` (N+1) from a switch, because Chromium routes worker requests through the context. Copy the content-type table and the path resolver from `e2e/version-skew.spec.ts`, and add `.webmanifest`, `.png` and `.woff2`
- [X] T040 [US3] In `e2e/offline-update.spec.ts`, add the C-05 / FR-006 / FR-007 / SC-003 test. Steps: install `page.clock.install()` (as in T022) and start Ratios Training; flip the switch; `await registration.update()`; wait until `registration.waiting` is set (no timeouts); advance time with `page.clock` and assert clicks keep being scheduled (via `readAudioLog`), the navigation entry count is unchanged, no `location.reload` happened, and About, reached in-app, shows N; reload and assert it still shows N; close every page of the context, open a new one, wait for the new worker to be the controller, and assert About shows N+1
- [X] T041 [US3] In `e2e/offline-update.spec.ts`, add the FR-008 / SC-004 test: preferences and metronome settings written to `localStorage` before the update are byte-identical after the new version takes over
- [X] T042 [US3] In `e2e/offline-update.spec.ts`, add the FR-012 / C-07 test: after the new version activates, `caches.keys()` holds exactly one `fm-offline-*` name, and it differs from the previous one
- [X] T043 [US3] In `e2e/offline-update.spec.ts`, add the FR-011 / US3-AS4 test: with the network off, `registration.update()` rejects, the current version keeps working and nothing is shown. Add a second case where one file of N+1 returns a 500 during install: the install fails, no `waiting` worker appears, and N's cache is intact and in use

### Implementation for User Story 3

- [X] T044 [US3] Run `pnpm build:test:skew`, then `pnpm test:e2e:fast e2e/offline-update.spec.ts e2e/version-skew.spec.ts`. Fix any gap in `src/service-worker.ts` the tests expose (the lifecycle rules are already in T014: no `skipWaiting`, no `claim`, activate cleanup, atomic install). Confirm no page code reacts to `updatefound` or `controllerchange` (`grep -rn "updatefound\|controllerchange\|location.reload" src`)
- [X] T045 [US3] Rebuild with `pnpm build:test` so `build/` is version N again, and confirm `build-next/` is not tracked by git (`git status --short build-next`)

**Checkpoint**: User Stories 1 to 3 work. An update never interrupts a session.

---

## Phase 6: User Story 4 - Never loaded, and cleared storage (Priority: P3)

**Goal**: A never-loaded offline device gets the browser's own error page. A device whose stored copy was cleared recovers on the next online load.

**Independent Test**: Open the address offline in a fresh profile; then delete all caches and reload online and offline.

### Tests for User Story 4

- [X] T046 [P] [US4] Extend `tests/unit/offline/precache.test.ts` (or add `tests/unit/offline/missing-keys.test.ts`) for the pure helper that `ensureCopy()` uses to find missing keys: given a list and the keys already stored, it returns exactly the missing paths in list order, and an empty array when the copy is complete. Add the helper to `src/lib/offline/precache.ts` as `missingFromCopy(list, storedPaths)`
- [X] T047 [US4] In `e2e/offline.spec.ts`, add the US4-AS1 / FR-010 test: in a fresh context, offline, `page.goto('/')` rejects with the browser's network error (`net::ERR_INTERNET_DISCONNECTED`), and the app shows no page of its own
- [X] T048 [US4] In `e2e/offline.spec.ts`, add the US4-AS2 / C-08 / FR-009 test: after one load, delete every cache (`caches.keys()` then `caches.delete`), reload online, assert the app loads, then poll until the cache keys equal the full precache set again
- [X] T049 [US4] In `e2e/offline.spec.ts`, add the US4-AS3 test: after deleting all caches, go offline and reload. `page.goto` rejects with the browser's own error. Then go online, reload, and the app recovers
- [X] T050 [US4] In `e2e/offline.spec.ts`, add the FR-013 / C-17 test: when `navigator.serviceWorker.register` rejects (override it with an init script), the app loads and works online exactly as without the feature, shows no notice, and a `console.warn` with `[fretboard-master] offline unavailable` is the only trace

### Implementation for User Story 4

- [X] T051 [US4] Implement `missingFromCopy` in `src/lib/offline/precache.ts` (T046) and `ensureCopy()` in `src/service-worker.ts` per R-07: on every `page` fetch call `event.waitUntil(ensureCopy())`; it compares the current cache's keys with the precache list, fetches only the missing keys with the R-04 rules (`ok` check, `/404.html` may be 404, `pageReferencesWithin` check), and stores them all together or not at all; it fails silently, so a failed or offline attempt ends quietly and the next navigation tries again
- [X] T052 [US4] Run `pnpm vitest run tests/unit/offline`, `pnpm build:test` and `pnpm test:e2e:fast e2e/offline.spec.ts`

**Checkpoint**: All four stories work independently.

---

## Phase 7: Polish & cross-cutting concerns

**Purpose**: Manual checks, a final scan and the end-of-slice gate.

- [X] T053 [P] Confirm the **Manual checks** section at the end of this file still matches `quickstart.md`, and list the same steps in the PR description. Do not run them; they need a human
- [X] T054 [P] Confirm the budgets are unchanged: `node scripts/check-bundle-size.mjs build` stays within 180 KB gzip, and `lighthouserc.cjs` and `scripts/check-bundle-size.mjs` have no diff (`git diff --stat lighthouserc.cjs scripts/check-bundle-size.mjs`) (FR-015, SC-006)
- [X] T055 [P] Run the existing axe suites unchanged (`pnpm test:e2e:fast e2e/a11y-audit.spec.ts e2e/a11y-colour.spec.ts e2e/a11y-keyboard.spec.ts`) and confirm this feature adds no visible control, notice or focusable element (Constitution V)
- [X] T056 Walk through `specs/040-offline-practice/quickstart.md` sections 1 to 5 once and fix any command or expectation that no longer matches
- [X] T057 Run all local gates once: `pnpm verify` (the full Playwright matrix, Firefox/WebKit smoke, no-JS and Lighthouse run in CI only; do not run `pnpm test:e2e` or `pnpm lhci` locally)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies. T001 to T004 are all [P].
- **Foundational (Phase 2)**: depends on T004 (Kit config) and T003 (lint) for a clean `pnpm check`. It blocks every story.
  - T005 to T009 (tests) before T010, T011 and T013.
  - T010 before T014 (the worker imports the pure module).
  - T013 and T014 before T015, T016 and T019.
- **User Stories (Phase 3+)**: all depend on Phase 2.
  - US1 → US2 → US3 → US4 in priority order, or US2 and US3 in parallel after US1.
  - US2 and US4 edit `e2e/offline.spec.ts` as well as US1, so run their e2e tasks in order within that file.
- **Polish (Phase 7)**: depends on every story being complete.

### User Story Dependencies

- **US1 (P1)**: starts after Phase 2. No dependency on other stories.
- **US2 (P2)**: starts after Phase 2. The C-02 equality test (T020) covers the manifest and icons once US2 adds them, so run T038 after T035 and T034.
- **US3 (P2)**: starts after Phase 2. It needs `build-next/` from `pnpm build:test:skew` (T016).
- **US4 (P3)**: starts after Phase 2. `ensureCopy` (T051) edits the worker file also edited in T014.

### Within Each Story

- Unit tests first, and they fail before the implementation.
- The pure module before the worker. The worker before the e2e specs.
- Build once (`pnpm build:test`) before every e2e run after a `src/` or `scripts/` change.

### Parallel Opportunities

- Setup: T001, T002, T003 and T004 together.
- Foundational tests: T005, T006, T007, T008 and T009 together (separate files).
- Foundational code: T011 (register.ts), T017 (serve-build.mjs) and T018 (playwright.config.ts) are independent of T010, T013 and T014.
- US2 tests: T029, T030 and T031 together.
- Polish: T053, T054 and T055 together.

## Parallel Example: Foundational tests

```bash
Task: "Write tests/unit/offline/precache.test.ts for precacheList, cacheName, isOwnStaleCache"
Task: "Write tests/unit/offline/route.test.ts for routeRequest"
Task: "Write tests/unit/offline/page-references.test.ts for pageReferencesWithin"
Task: "Write tests/unit/offline/stamp.test.ts for scripts/stamp-service-worker.mjs"
Task: "Write tests/unit/offline/register.test.ts (jsdom) for registerOffline"
```

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1: Setup.
2. Phase 2: Foundational (blocks all stories).
3. Phase 3: US1.
4. **Stop and validate**: `pnpm test:e2e:fast e2e/offline.spec.ts`. The app already opens and practises offline after one visit.

### Incremental Delivery

1. Setup + Foundational → worker and registration exist.
2. US1 → offline works (MVP).
3. US2 → installable identity.
4. US3 → proven safe across updates.
5. US4 → boundary and recovery behaviour.
6. Polish → `pnpm verify`, then CI runs Lighthouse.

## Notes

- [P] tasks touch different files and have no dependency on an incomplete task.
- The cache name is `fm-offline-<version>-<digest>`, not the version alone (plan.md Complexity Tracking).
- The feature adds no UI, no catalog key and no screenshot.
- Commit after each task or logical group (Conventional Commits on `040-offline-practice`).

## Manual checks (for the PR description)

These need a human. A task that depends on one is done once its automatable part passes.

1. On a real phone, open the PR preview once online and add it to the home screen. Check that the icon and the name "Fretboard Master" appear (US2-AS1).
2. Turn on airplane mode and open the icon. Check that Home appears, the app opens in its own window, and Ratios Training plays a click and a chime that you can hear (US2-AS2, SC-002, C-13).
3. On a desktop browser, open the preview offline after one visit and listen to the click, chime and notes on each tool.
4. Look at the maskable icon in Chrome DevTools → Application → Manifest with the circle mask on. The glyph must not be clipped.
5. On the Cloudflare preview, run `curl -sI <preview>/service-worker.js` and `curl -sI <preview>/manifest.webmanifest`. Check that both show `cache-control: no-cache` and that the manifest's content type is `application/manifest+json`. Also check that `<preview>/404.html` redirects to `/404` and serves the not-found page (plan.md Assumptions).
