# Research: Practise Offline (040)

Phase 0 of `/speckit-plan`. Each item gives the decision, why it was chosen, and the alternatives
considered. The spec's Clarifications C-01 to C-17 are settled inputs. Where this plan refines one,
it says so and records it in plan.md → Complexity Tracking.

## R-01 Worker mechanism and registration ownership

- **Decision**: SvelteKit's built-in service worker at `src/service-worker.ts`, reading
  `build`, `files`, `prerendered` and `version` from `$service-worker`. Set
  `kit.serviceWorker.register: false` in `svelte.config.js`, and register from a small app module
  (`src/lib/offline/register.ts`) called by `init` in `src/hooks.client.ts`.
- **Rationale**: Kit's automatic registration runs during startup and offers no `load` gate,
  production-only guard or error handling. C-09 requires all three. Managing registration
  ourselves costs about 15 lines in the single bundle.
- **Alternatives**: Kit auto-registration (fails C-09 and FR-013). Workbox or
  `vite-plugin-pwa` (a new dependency and generated code, against Constitution X and C-01). A
  hand-written `static/sw.js` (loses `$service-worker`, so the precache list would have to be
  rebuilt by hand).

## R-02 Precache list (C-02)

- **Decision**: a pure function `precacheList({ build, files, prerendered })` in
  `src/lib/offline/precache.ts` returns the pathnames to store:
  - `build`: every `_app/immutable/*` file, plus `_app/version.json` when Kit emits it.
  - `files`: the static files. `kit.serviceWorker.files` filters out `_headers`, so the
    Cloudflare config is never fetched.
  - `prerendered`: each page path (`/`, `/notes`, `/triads`, `/caged`, `/metronome`, `/about`),
    with `/__not-found` replaced by `/404.html`. `scripts/make-404.mjs` renames
    `__not-found.html` after the build, so `/__not-found` is not a file the host can serve.
- Any file in `build/` that Kit's lists leave out (for example `_app/version.json` on this Kit
  version) is added explicitly. The e2e equality check (R-12) catches drift in either direction.
- **Rationale**: the stored copy must equal the build output: no more and no less (C-02).
  Clean-URL keys (`/notes`, not `/notes.html`) match what the host serves and what navigations
  request.
- **Alternatives**: walk `build/` in a post-build script and inject the list. That duplicates
  `$service-worker` and departs from C-01. Kit's raw `prerendered` list includes the
  `/__not-found` entry, which would fail every install.

## R-03 Cache name and update detection (refines C-07)

- **Decision**: name each cache `fm-offline-<version>-<digest>`:
  - `<version>` is `$service-worker`'s `version` (`kit.version.name`, the `package.json`
    version).
  - `<digest>` is the first 12 hex characters of a SHA-256 over every precached file's path and
    bytes. A post-build script, `scripts/stamp-service-worker.mjs`, computes it and writes it
    into `build/service-worker.js` by replacing the literal `__FM_BUILD_DIGEST__`. The script
    fails the build unless that literal appears exactly once.
  - The script runs in `build`, `build:test` and `build-next-version.mjs`, after `make-404.mjs`,
    because the digest must cover `404.html`.
- `svelte.config.js` also uses `FM_APP_VERSION` for `kit.version.name` when it is set.
  `vite.config.ts` already rejects that variable outside `--mode test`. This way the skew build
  N+1 also has its own version.
- **Rationale**: `package.json` is still `0.1.0` while many deploys ship. If the cache were
  named only after the version, two deploys would share one cache, and installing N+1 would
  overwrite N's pages while N's tabs are still open (breaks C-05 and C-07). The browser looks
  for an update by comparing the worker's bytes:
  - Hashed bundle names already change those bytes whenever the code changes.
  - Unhashed files (`theme-boot.js`, the manifest, the icons, the pages) do not.
  - The digest changes the bytes whenever any stored file changes, and only then. Without it, a
    change to `theme-boot.js` alone would never reach devices that already have a copy.
- **Alternatives**:
  - `kit.version.name = Date.now()`: the worker reinstalls on every deploy even when nothing
    changed, the build is no longer reproducible, and C-07 names the package version.
  - The version alone: wrong, for the reason above.
  - A hash of the `build` list only: misses changes to unhashed static files.

## R-04 Install: atomic, sequential, consistent (C-07, FR-011, edge case "interrupted")

- **Decision**: `install` uses `event.waitUntil(precache())`:
  1. Fetch every entry in order, one at a time, with `cache: 'no-cache'` (hashed files then
     revalidate cheaply) and `redirect: 'follow'`. Keep the responses in memory.
  2. Check each response. It must be `ok`, except `/404.html`, which may come back as 404
     because both hosts serve that file with a 404 status. Every stored page must reference
     only `/_app/immutable/*` files that are in this list. This catches a deploy that lands in
     the middle of an install.
  3. Only then open `fm-offline-<version>-<digest>` and `put` every entry. A fresh `Response` is
     built from each body, so no redirected response is ever stored, and `/404.html` keeps
     status 404.
  4. If any step throws: delete that cache name and reject. The install fails, and the previous
     worker and its complete cache stay in charge.
- **Rationale**: a failed install never activates, which is what C-07 and FR-011 require.
  Fetching one file at a time keeps background requests to at most one, so on a first visit
  precaching cannot compete with the page, and it cannot hold Lighthouse's TTI window open
  (FR-015, SC-006). The page check closes the race where the host switches from N to N+1
  between two fetches.
- **Alternatives**: `cache.addAll()`, which runs all fetches at once and rejects on a 404
  `404.html`. Parallel fetches with a concurrency cap of 4 (faster, but riskier for the TTI
  budget, and the copy is only about 20 files).

## R-05 Activate and cleanup (FR-012, FR-008)

- **Decision**: `activate` deletes every cache whose name starts with `fm-offline-` and is not
  the current name. It does not call `clients.claim()`. The worker never touches `localStorage`,
  and the worker scope cannot reach it anyway.
- **Rationale**: one copy at a time (FR-012). The prefix leaves alone any cache this app did not
  create. Without `claim`, the page open at first install is never taken over in the middle of
  a session. Every later navigation is controlled, which is what offline launch needs (C-05,
  C-12).
- **Alternatives**: `claim()` on first install (no user benefit, because in-app navigation makes
  no requests).

## R-06 Fetch routing (C-03, C-04, C-08, FR-009/010/016/017)

- **Decision**: one pure classifier, `routeRequest({ method, url, mode, origin })`, returns one
  of the following. The worker only carries out the result.
  - `pass`: any method other than `GET`, any cross-origin URL, and `/service-worker.js`. The
    worker calls no `respondWith`, so the browser handles the request as if no worker existed.
    `POST /m` falls here (C-03).
  - `redirect`: a navigation whose path has a trailing slash (`/triads/`). The worker answers
    with a 308 to the path without the slash, keeping the query, as the host does.
  - `page`: any other navigation. The stored entry for the pathname is matched with
    `ignoreSearch` (C-04).
  - `asset`: every other same-origin `GET`. The stored entry for the pathname is matched with
    `ignoreSearch`.
- Answering `page` and `asset` (worker side):
  1. If the current cache has the key, answer from it.
  2. Otherwise fetch from the network (C-08, FR-009).
  3. If the network fails on a `page` and the cache holds `/404.html`, answer with that page
     (status 404, C-04). Otherwise answer `Response.error()`, so the browser shows its own
     no-connection page (FR-010, US4-AS3).
- **Rationale**: this mirrors the host's routing (`scripts/serve-build.mjs`). Share links with a
  query get the stored tool page, and the pre-hydration link handling (ADR 0022) opens the right
  view. An unknown path offline gets Home plus the not-found notice, exactly as online (ADR 0003).
- **Alternatives**:
  - Network-first for pages: a slow or flaky connection would stall every launch, and a reload
    could change versions in the middle of a session (breaks C-05).
  - Stale-while-revalidate: mixes versions.

## R-07 Self-repair after a cleared or partial copy (C-08, US4-AS2)

- **Decision**: on every `page` fetch, the worker also runs `event.waitUntil(ensureCopy())`.
  `ensureCopy()` compares the current cache's keys with the precache list. If keys are missing,
  it fetches only those, with the R-04 rules, and stores them all together. If that fails, it
  does nothing more. The next navigation tries again. It never runs while offline, because a
  failed fetch just ends it quietly.
- **Rationale**: when the cache has been deleted under an active worker, `install` does not run
  again, so without repair the copy would never be "stored again" (C-08 test). Checking cache
  keys is cheap and happens off the response path.
- **Alternatives**: put each missed response into the cache as it is fetched. That repairs only
  the files the user touches, and offline would still fail for the tools they have not opened.

## R-08 Registration timing and failure handling (C-09, C-17, FR-013, FR-015)

- **Decision**: `registerOffline(win)` does nothing:
  - in `import.meta.env.DEV`;
  - when `!('serviceWorker' in win.navigator)`;
  - in Vitest.
- Otherwise it waits for `load`, or runs at once when `document.readyState === 'complete'`. It
  then calls `navigator.serviceWorker.register('/service-worker.js')` and catches any rejection
  with `console.warn('[fretboard-master] offline unavailable', error)`. The rejection goes to the
  console only and never into the UI.
- `--mode test` builds register, because they are production builds. The e2e suite needs that.
- **Rationale**: registering after `load` keeps the first usable screen free of worker work. A
  private window, blocked storage or a full quota rejects at register or install time, and the
  app carries on online (C-17). Logging rather than an empty `catch` follows the constitution's
  code-quality rule.
- **Alternatives**: `requestIdleCallback` (Safari lacks it, and `load` is already late enough).

## R-09 Web app manifest and icons (C-11, FR-005, SC-007)

- **Decision**: add `static/manifest.webmanifest` with `id` and `start_url` "/", `scope` "/",
  `name` and `short_name` "Fretboard Master", `display` "standalone", `background_color` and
  `theme_color` set from the tokens, and three icons:
  - `icons/icon-192.png`, 192×192, `purpose: "any"`;
  - `icons/icon-512.png`, 512×512, `purpose: "any"`;
  - `icons/icon-maskable-512.png`, 512×512, `purpose: "maskable"`, drawn inside the 80% safe
    zone.
- Add `static/icons/apple-touch-icon.png` (180×180).
- `src/app.html` gains `<link rel="manifest" href="/manifest.webmanifest">` and
  `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">`, so every prerendered page
  carries both.
- Colours:
  - `background_color` is `#ffffff`, the light value of `--color-surface`.
  - `theme_color` is `#f3f4f6`, the light value of `--color-surface-raised`, which is the bar
    surface.
  - A unit test parses `tokens.css` and checks that both still match.
- No `description` field. It is optional for installing, and it would be user-facing text
  outside the message catalog (Constitution VIII). The brand name is the same in all three
  languages.
- Icons come from `scripts/make-icons.mjs`, a dependency-free Node PNG encoder (`node:zlib` +
  CRC32). The script draws a neutral fretboard glyph: ink-coloured strings and frets on the
  surface colour. It uses no root, third or fifth colour (Constitution VII, reserved colours).
  The PNGs are committed, and the script is kept so they can be made again.
- **Rationale**: these are the minimum Chromium installability fields (SC-007). iOS uses
  `apple-touch-icon` for home-screen icons. Generating the icons needs no image library
  (Constitution X).
- **Alternatives**:
  - SVG icons: Chromium's installability check wants PNG sizes, and iOS ignores SVG touch icons.
  - The `sharp` package (a native dependency).
  - One manifest per locale: the name is the brand, so there is nothing to translate.

## R-10 HTTP delivery (C-06)

- **Decision**: `static/_headers` gains:
  - `Cache-Control: no-cache` on `/service-worker.js`, `/manifest.webmanifest`, `/caged` and
    `/metronome`. The last two have been missing next to the other pages since slices 016 and
    031.
  - `Content-Type: application/manifest+json` on `/manifest.webmanifest`.
  - `Cache-Control: public, max-age=86400` on `/icons/*`. The icons are not hashed, so they get
    no long immutable max-age.
- `scripts/serve-build.mjs` mirrors this:
  - content types for `.webmanifest`, `.png` and `.woff2`;
  - `no-cache` for `service-worker.js` and the manifest.
- `tests/unit/headers.test.ts` gets matching cases.
- **Rationale**: the browser looks for a new worker without the HTTP cache (`updateViaCache`
  defaults to `imports`). `no-cache` makes the CDN and any proxy revalidate too, so a deploy is
  seen on the next launch.
- **Alternatives**: rely on the browser's 24-hour cap on worker freshness (too slow for C-06).

## R-11 CSP (C-15)

- **Decision**: no change. A same-origin worker is allowed by `script-src 'self'`, which is the
  fallback for `worker-src`. A same-origin manifest is allowed by `default-src 'self'`, which is
  the fallback for `manifest-src`. `tests/unit/csp.test.ts` already pins the policy and stays as
  it is. The worker script is served with no CSP header of its own, and it runs no inline code.
- **Alternatives**: add explicit `worker-src 'self'` and `manifest-src 'self'` (allowed by C-15,
  but it would change a policy pinned by tests and add no protection).

## R-12 Test strategy (Constitution IV, C-02/04/05/08/10/11/12/13)

- **Decision**:
  - **Unit (node)**, `tests/unit/offline/`:
    - `precacheList`;
    - `cacheName`;
    - `routeRequest`, with a table of methods, origins, modes, paths and queries;
    - `pageReferencesWithin`, the consistency check from R-04;
    - the stamping script, run on a fixture directory.
  - **Unit (jsdom)**: `registerOffline`:
    - waits for `load`;
    - does nothing without `serviceWorker` or in DEV;
    - a rejected promise is logged and does not throw.
  - **Unit (node)**:
    - `manifest.test.ts`: fields, icon files exist with the right PNG sizes, colours match the
      tokens;
    - `app-html.test.ts`: the manifest link and the apple-touch-icon link are present;
    - additions to `headers.test.ts`.
  - **E2E (desktop, Chrome)**: one new spec, `e2e/offline.spec.ts`, with
    `test.use({ serviceWorkers: 'allow' })`. After one load and `navigator.serviceWorker.ready`:
    1. Cache keys equal the files in `build/`, apart from `service-worker.js` and `_headers`,
       mapped to clean URLs (C-02).
    2. Offline reload of `/`, then every tool and About in en, pt-BR and es, with no failure
       view or notice and no failed page request (US1, SC-001).
    3. Offline Ratios Training: the audio log shows scheduled clicks, and the timer chime is
       scheduled (US1-AS3, C-13). Note playback on Notes logs a pluck (US1-AS4).
    4. Offline deep link `/triads?v=1&…` taken from the link fixtures, and `/does-not-exist`
       shows Home plus the not-found notice (C-04).
    5. In-app navigation under the worker makes zero page requests (C-10).
    6. Never loaded and offline: `page.goto` rejects with the browser's network error
       (US4-AS1).
    7. Caches deleted, online reload: the app loads and the cache list is complete again.
       Caches deleted, offline reload: the network error (US4-AS2/3).
    8. Manifest: it parses, has the C-11 fields, every icon returns 200, and every prerendered
       page has `<link rel="manifest">` (SC-007).
    9. Preferences and metronome settings stored before an update are byte-identical after it
       (FR-008, SC-004).
  - **E2E update (C-05)**: `e2e/offline-update.spec.ts` needs `build-next/`
    (`pnpm build:test:skew`) and skips without it, like `version-skew.spec.ts`. It uses
    `context.route('**/*')` to serve `build/` or `build-next/` depending on a switch, because
    Chromium routes worker requests through the context:
    1. Start Ratios Training.
    2. Flip the switch and `await registration.update()`.
    3. Wait until `registration.waiting` is set.
    4. Check that clicks keep being scheduled, that the navigation entry count is unchanged, and
       that About, reached in-app, shows N.
    5. Reload: still N (C-05).
    6. Close every page, open a new one: About shows N+1. Wait for the new worker to be the
       controller before the check, so the result does not depend on timing.
    7. A failed update check (offline): `update()` rejects, and the current version is still
       used with no notice (US3-AS4).
  - **Existing specs**: `playwright.config.ts` gets `use.serviceWorkers: 'block'` as the
    default, and only the two offline specs opt in. Every existing spec then runs exactly as
    before, which is also the FR-013 "no worker" path. Without the block:
    - `version-skew.spec.ts` would get N from the cache on reload, which is now the intended
      behaviour (C-05);
    - a worker that does not answer `POST /m` could change how `page.route` stubs are seen.
    `continuity.spec.ts` stays as it is, and item 5 above covers the same contract under the
    worker. `nojs.spec.ts` stays as it is (C-16).
- **Rationale**: the pure logic is tested first in node, and only behaviour that needs a real
  worker goes to Chrome. The block-by-default setting keeps 60+ existing specs deterministic.
- **Alternatives**:
  - Leave workers on everywhere (version-skew breaks by design, and `/m` stubs may get flaky).
  - Test the worker by loading it in jsdom (not realistic, because jsdom has no Cache Storage).

## R-13 Performance and budgets (Constitution VI, FR-015, SC-006)

- **Decision**: no budget changes.
  - Registration code in the single bundle is under 0.5 KB gzip, against a measured 160.4 KB
    with a 180 KB limit.
  - `service-worker.js` is not initial JS. `check-bundle-size.mjs` counts only scripts that
    `index.html` references, so it is not counted.
  - Lighthouse runs every pass on a fresh profile, so it measures a first visit, where the
    worker registers after `load` and fetches one file at a time (R-04).
  - CI's existing `lhci` job is the gate. Nothing about it changes.
- **Alternatives**: postpone registration to the second visit (offline then needs two loads,
  against FR-001).

## R-14 ADR

- **Decision**: add `docs/adr/0031-offline-copy-service-worker.md`. It records:
  - the hand-registered Kit worker;
  - the cache name with the digest;
  - cache-first with a network fallback;
  - no `skipWaiting` and no `claim`;
  - the default block in Playwright;
  - the rejected alternatives: Workbox, `vite-plugin-pwa`, network-first, `skipWaiting` with
    a reload prompt.
- ADR 0002 gets a "see also" line: in-tab continuity is now backed by the worker across reloads.

## Unknowns

None remain. Every Technical Context item is settled.
