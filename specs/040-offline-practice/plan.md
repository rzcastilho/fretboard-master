# Implementation Plan: Practise Offline

**Branch**: `040-offline-practice` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/040-offline-practice/spec.md`

## Summary

After one online visit, Fretboard Master opens and works with no network, from its address or a
home-screen icon. An update never interrupts a running session.

The approach uses SvelteKit's built-in service worker (`src/service-worker.ts` with
`$service-worker`, C-01). No dependency is added.

- **Registration** is by hand, after `load` and only in production. Failures are logged, never
  shown (R-01, R-08).
- **Install** stores the whole build output (C-02) in one version-named cache. Files are fetched
  one at a time and stored all together or not at all (R-02, R-04).
- **Fetch handling** is cache-first, with the network as fallback. Navigations are matched by
  pathname with the query ignored, and an unknown path gets the stored `404.html` (R-06).
- **Self-repair**: when the cache has been cleared, the next online navigation fills it again
  (R-07).
- **Updates** follow the standard lifecycle: no `skipWaiting` and no `claim`. A new version takes
  over only after every window of the app has closed (C-05).
- **Install identity**: a same-origin web app manifest and generated PNG icons (R-09).

The pure logic (`precacheList`, `cacheName`, `routeRequest`, `pageReferencesWithin`) lives in
`src/lib/offline/precache.ts` and is built test-first. The worker and the registration are thin
shells around it.

Two refinements of the clarified spec are recorded under Complexity Tracking:

1. **Cache name.** Each cache is named `<version>-<digest>`, not after the version alone. The
   digest is stamped in after the build. `package.json` does not change on every deploy, so
   naming the cache after the version alone would let two deploys share one cache.
2. **Playwright.** Service workers are blocked by default, and only the two offline specs opt in.
   Existing specs keep their current behaviour, which is also the FR-013 "no worker" path.

## Technical Context

**Language/Version**: TypeScript 5.9 (`strict`), Node 24.21.0 (mise) for build scripts.

**Primary Dependencies**: SvelteKit 2 (`adapter-static`, `bundleStrategy: 'single'`,
`$service-worker`), Svelte 5, Vite 8. No new runtime or dev dependency. The icon PNGs are encoded
with `node:zlib` (R-09).

**Storage**: the browser's Cache Storage, one cache named `fm-offline-<version>-<digest>`.
`localStorage` is not touched: the keys and the preferences format are unchanged (FR-008).

**Testing**:

- Vitest (node) for `src/lib/offline/precache.ts`, the stamp script, the manifest and the
  headers.
- Vitest (jsdom) for `register.ts`.
- Playwright on the desktop project (Chrome), with `serviceWorkers: 'allow'` and
  `context.setOffline`, for `e2e/offline.spec.ts` and `e2e/offline-update.spec.ts`.

**Target Platform**: evergreen desktop browsers (Constitution VII, ADR 0029) on Cloudflare Pages
static hosting. Installing on a phone home screen is allowed and checked by hand (C-12).

**Project Type**: static, prerendered single-page web app.

**Performance Goals**: the Constitution VI budgets do not change.

- Initial JS: 160.4 KB now, plus under 0.5 KB, against a 180 KB limit.
- Lighthouse first visit: Home ≤ 3 s, tool ≤ 3.5 s, score ≥ 90, CLS ≤ 0.1.
- Precaching starts after `load` and fetches one file at a time (R-04, R-13).

**Constraints**:

- Handle only same-origin `GET` requests. `POST /m` passes through untouched (C-03).
- No third-party origins and no change to the CSP (R-11).
- No background sync, push, permissions or update prompt (FR-014).
- No reload on update (C-05).
- The no-JS path is unchanged (C-16).

**Scale/Scope**: about 20 precached files, a few hundred KB uncompressed: one JS and one CSS
bundle, 7 pages, `theme-boot.js`, the font, `robots.txt`, the manifest and 4 icons.

The change touches:

- about 2 new source modules plus the worker;
- 3 build scripts;
- `svelte.config.js`, `src/app.html`, `static/_headers`, `scripts/serve-build.mjs` and
  `playwright.config.ts`;
- 2 new e2e specs and about 6 unit test files;
- 1 new ADR.

Every open question is settled in [research.md](research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against Constitution 2.2.0. Pre-design result: **PASS**. Post-design re-check (after
research.md, data-model.md and contracts/): **PASS**, with no new violations. The two refinements
in Complexity Tracking are departures from spec clarifications, not from the constitution.

**I. Musical Correctness**

- [x] N/A. The feature touches no theory code. Sound stays the existing on-device synthesis
  (C-02). The worker stores files and does not change pitch.

**II. On-Device, Static, Private by Design**

- [x] This principle is the point of the feature: "Once loaded, no feature may depend on the
  network" now holds across reloads and relaunches.
- [x] The worker and the manifest are same-origin static files. No third-party origin is added
  (FR-014, R-11).
- [x] No accounts, identifiers or personal data. The install flow has no sign-in step (FR-005).
- [x] No device permissions are requested: no push and no notifications (FR-014).
- [x] Preferences stay in `localStorage`. The worker never touches them, and the user can still
  erase them as before (FR-008).
- [x] Measurement `POST /m` is never intercepted, stored or queued. Offline it fails silently as
  it does today (C-03).

**III. Pure Core, Thin Shell**

- [x] `src/lib/theory` is untouched.
- [x] The new `src/lib/offline/precache.ts` is pure: no DOM, no Svelte, no storage. An ESLint
  `no-restricted-imports` and `no-restricted-globals` block for `src/lib/offline/precache.ts`
  enforces this.
- [x] The worker and `register.ts` are thin shells around it.
- [x] No change to the data flow, the view state or the fretboard.

**IV. Test-First for Logic, Tested Behavior for UI**

- [x] The pure offline module and the stamp script are built test-first (R-12).
- [x] Every acceptance scenario maps to a test:
  - US1: `offline.spec.ts`;
  - US2: the manifest e2e and unit tests, plus offline launch under an active worker;
  - US3: `offline-update.spec.ts`;
  - US4: `offline.spec.ts` (never loaded, cleared cache).
- [x] Sound is checked through the existing injectable audio log, not by ear (C-13). Listening
  checks are "Manual checks".
- [x] The tests are deterministic. The update test waits on worker state (`registration.waiting`,
  the controller), not on timeouts.

**V. Accessible by Default**

- [x] N/A for new UI: the feature adds no visible control, notice or focusable element (no install
  button, no offline indicator, no update prompt). The existing axe suites run unchanged, and the
  offline spec checks that the offline pages show no notice.

**VI. Performance Budgets Are Gates**

- [x] Registration comes after `load` and is under 0.5 KB in the single bundle. The worker file is
  not initial JS.
- [x] Precaching fetches one file at a time, so a first visit (the Lighthouse case) is not
  slowed. No budget is raised, and `lighthouserc.cjs` and `check-bundle-size.mjs` are unchanged
  (R-13, FR-015).

**VII. Design System Fidelity**

- [x] No new UI and no notices.
- [x] The manifest colours come from the surface tokens, and a unit test checks they match
  `tokens.css`.
- [x] The icons use only ink and surface colours, never the reserved root, third or fifth
  colours.
- [x] Phones are not blocked: installing is allowed (C-12).

**VIII. International From the First Line**

- [x] No new user-facing text. The manifest `name` is the brand name, the same in all three
  languages, and there is no `description` (R-09).
- [x] All three catalogs are compiled into the stored bundle, and the offline spec opens every
  tool in en, pt-BR and es.

**IX. Untrusted Input, Versioned Formats**

- [x] Share links and preferences are parsed exactly as before. The worker only chooses which
  stored page to return and ignores the query, so link parsing stays in `src/lib/link`.
- [x] No format changes, and the link-fixture suite is unchanged.
- [x] The worker never renders request data.

**X. Simplicity and Incremental Delivery**

- [x] No new dependency: Workbox and `vite-plugin-pwa` were rejected (R-01).
- [x] One new pure module, used by the worker and by its tests. The stamp script repeats the
  module's path-to-URL mapping in plain Node, because build scripts cannot import `$lib`. This is
  noted, not abstracted.
- [x] Every failure has a fallback: a failed install keeps the previous copy, a missing file
  comes from the network, and a failed registration leaves the app working online.

**Technology Stack and Constraints**

- [x] It stays within the mandated stack: SvelteKit's own service-worker support, plain TS and
  Node scripts.
- [x] A new `src/lib/offline` directory sits beside the existing `src/lib/measure`, which is
  outside the listed layout in the same way.
- [x] The stack choice is recorded as ADR 0031 (C-01). Replacing no mandated choice means no
  constitution amendment is needed.

**Development Workflow and Quality Gates**

- [x] Conventional Commits on `040-offline-practice`.
- [x] Local runs follow the verification tiers in `quickstart.md`, with `pnpm verify` once at the
  end.
- [x] Human-only steps (phone install, listening, maskable preview, preview headers) are
  recorded as "Manual checks" in `quickstart.md`, to be carried into `tasks.md` and the PR.

## Project Structure

### Documentation (this feature)

```text
specs/040-offline-practice/
├── plan.md              # This file
├── research.md          # Phase 0: R-01 … R-14
├── data-model.md        # Phase 1: precache list, offline copy, cache name, routes, registration
├── quickstart.md        # Phase 1: validation commands and manual checks
├── contracts/
│   ├── service-worker.md    # lifecycle, fetch routing, build-time stamp
│   ├── web-app-manifest.md  # manifest fields, icons, app.html links, _headers additions
│   └── registration.md      # registerOffline() and svelte.config.js serviceWorker options
├── checklists/          # from /speckit-specify and /speckit-clarify
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
src/
├── service-worker.ts                 # NEW: install / activate / fetch (contracts/service-worker.md)
├── hooks.client.ts                   # EDIT: init() calls registerOffline(window, import.meta.env.DEV)
├── app.html                          # EDIT: <link rel="manifest">, <link rel="apple-touch-icon">
└── lib/
    └── offline/                      # NEW
        ├── precache.ts               # pure: precacheList, cacheName, isOwnStaleCache, routeRequest, pageReferencesWithin
        └── register.ts               # page-side registration (contracts/registration.md)

static/
├── _headers                          # EDIT: service-worker.js, manifest, icons, /caged, /metronome
├── manifest.webmanifest              # NEW
└── icons/                            # NEW: icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png

scripts/
├── stamp-service-worker.mjs          # NEW: digest of the precache set → build/service-worker.js
├── make-icons.mjs                    # NEW: dependency-free PNG icon generator (output committed)
├── build-next-version.mjs            # EDIT: run the stamp script for build-next/ and build/
└── serve-build.mjs                   # EDIT: .webmanifest/.png/.woff2 types; no-cache for the worker and the manifest

svelte.config.js                      # EDIT: serviceWorker { register: false, files }, version.name honours FM_APP_VERSION
package.json                          # EDIT: build / build:test append `node scripts/stamp-service-worker.mjs`
eslint.config.js                      # EDIT: purity block for src/lib/offline/precache.ts; webworker globals for src/service-worker.ts
playwright.config.ts                  # EDIT: use.serviceWorkers = 'block' (offline specs opt in)

tests/unit/
├── offline/                          # NEW: precache.test.ts, register.test.ts (jsdom), stamp.test.ts, manifest.test.ts, app-html.test.ts
└── headers.test.ts                   # EDIT: new header rules

e2e/
├── offline.spec.ts                   # NEW: US1, US2 (launch + manifest), US4, C-02, C-04, C-10, FR-008
└── offline-update.spec.ts            # NEW: US3 / C-05 (needs `pnpm build:test:skew`)

docs/adr/
├── 0031-offline-copy-service-worker.md   # NEW
└── 0002-single-bundle-for-version-continuity.md  # EDIT: see-also line
```

**Structure Decision**: this is the existing single SvelteKit project. Every directory named
above already exists: `src/`, `src/lib/`, `static/`, `scripts/`, `tests/unit/`, `e2e/` and
`docs/adr/`. The only new directories are `src/lib/offline/`, `static/icons/` and
`tests/unit/offline/`. `src/service-worker.ts` sits at the path SvelteKit expects for its
built-in worker.

## Complexity Tracking

There are no Constitution violations. The table records where this plan refines a spec
clarification, which the reviewer should approve.

| Refinement | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| The cache name is `fm-offline-<version>-<digest>`, not the version alone (C-07 refined, R-03). A post-build script stamps the digest into `build/service-worker.js`. | `package.json` stays at `0.1.0` across many deploys. Two deploys with the same version would share a cache: installing N+1 would overwrite N's pages under open N tabs (breaks C-05 and C-07), and a change to an unhashed file (`theme-boot.js`, manifest, icons) would never change the worker's bytes, so no update would be seen. | Version only: wrong, as described. `kit.version.name = Date.now()`: reinstalls on every deploy and makes the build non-reproducible. A hash of `$service-worker`'s `build` list: misses unhashed static files. |
| Playwright blocks service workers by default (`use.serviceWorkers: 'block'`), and only `offline*.spec.ts` opt in (R-12). | `version-skew.spec.ts` asserts that a reload picks up N+1, but under the worker a reload now keeps N on purpose (C-05). Workers also change how `page.route` stubs (`/m`) are seen. Blocking keeps 60+ specs deterministic, and the blocked run is the FR-013 "no worker" path. | Workers allowed everywhere: version-skew would have to be rewritten to contradict its own contract, and every route-stubbing spec could become flaky. A per-spec opt-out list: easy to forget when a spec is added. |
| `kit.version.name` honours `FM_APP_VERSION` (test-mode builds only, already guarded in `vite.config.ts`). | The skew build N+1 must have its own version in `$service-worker`, as it does in `__APP_VERSION__`, so the C-05 e2e test works with distinct caches. | Leaving `kit.version.name` as `package.json`: the digest alone would still tell the versions apart, but the cache name would then misstate the version during the update test. |

Assumptions:

- `/404.html` is precached by fetching that path and accepting a 404 status. `serve-build.mjs`
  serves it with 404, and Cloudflare redirects `/404.html` to `/404`, which serves `404.html`.
  Manual check 5 in `quickstart.md` confirms this on the preview.
- Rejected alternative: fetching a reserved missing path. It gives the same body, but the
  intent is less clear.
