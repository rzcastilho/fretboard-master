# Feature Specification: Practise Offline

**Feature Branch**: `feature/040-offline-practice`

**Created**: 2026-11-02

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/010-practice-sessions/002-offline-practice.md (id 002, offline-practice)."

## Clarifications

### Session 2026-11-02 (clarify reviewer)

Each item says where it comes from: **[derived]** from a source, or **[default]** for a conventional choice made where no source decides.

- **C-01 Mechanism [derived + default]**: Offline storage uses SvelteKit's built-in service worker (`src/service-worker.ts` with `$service-worker`), so there is no new runtime dependency (Constitution X; stack is SvelteKit with `adapter-static`). The worker and the web app manifest are same-origin static files (Constitution II). The choice is recorded in a new ADR (Constitution "Decisions").
- **C-02 What the offline copy contains [derived]**: every file in the build output: the `_app/immutable/*` bundle (one JS file and one CSS file, ADR 0002), every prerendered page (`/`, `/notes`, `/triads`, `/caged`, `/metronome`, `/about`, and `404.html`), `theme-boot.js`, `static/fonts/*` (the accidentals subset, ADR 0006), the manifest and its icons. All three languages are compiled into the single bundle (Paraglide, ADR 0019), so storing the bundle stores all three. Click, chime and note sounds are synthesized on the device (`src/lib/audio/click.ts`, `chime.ts`, `pluck.ts`; ADR 0007), so there are no sound files to store. FR-002 is met by storing the bundle. *Test*: a unit or build test asserts that the worker's precache list equals the set of files in `build/`, excluding the worker file itself and `_headers`.
- **C-03 Requests the worker leaves alone [derived]**: The worker handles only same-origin `GET` requests. The measurement endpoint `POST /m` (ADR 0027) is never intercepted, stored or queued. Offline it fails silently as it does today (Constitution II: "fail silently"). There are no cross-origin requests to handle.
- **C-04 Offline navigation and deep links [derived from ADR 0003, 0021, 0022]**: A navigation is matched on its pathname alone, ignoring the query, so a share link such as `/triads?v=1&…` gets the stored `/triads` page and the existing pre-hydration link handling (ADR 0022) opens the right view. Offline, any path with no stored page gets the stored `404.html`, which renders the Home screen and the not-found notice exactly as online (ADR 0003). *Test*: e2e, offline after one load: `/triads?v=1&…` (a fixture link) opens that view, and `/does-not-exist` shows Home with the not-found notice.
- **C-05 What "launch" means and when an update takes effect [default]**: This follows the standard service-worker lifecycle, with no `skipWaiting` and no `clients.claim` for updates. A newly fetched version waits until every window and tab of the app has closed. The next time the app is opened, the new version is used. Reloading a tab or navigating in-app while any app window stays open keeps the current version. No page ever calls `location.reload()` because of an update, and the existing `pollInterval: 0` / no `updated` handling stays (ADR 0002). Why this is the default: it is the browser's built-in behaviour, and it is the only one that guarantees FR-007 across several tabs. *Test*: e2e: start a Ratios Training run, deploy version N+1 and trigger an update check. The run's beat counter keeps advancing with no navigation event, and About still shows N. Close every page of the context, open a new one, and About shows N+1.
- **C-06 Update check [default]**: The browser's normal update check runs when the app is opened (a navigation) and is not otherwise triggered. Cloudflare Pages serves the worker file with `Cache-Control: no-cache` (added to `static/_headers`), so a new deploy is seen on the next check. A failed check, offline or partial, shows nothing and leaves the current version (FR-011, US3-AS4).
- **C-07 Atomic install and cleanup [default]**: A version becomes available offline only once every file in its precache list has been stored. If any file fails, that install fails and the previous complete copy stays in use. Each version's files are stored under a cache named after the app version (`kit.version.name`, the `package.json` version). When a new version activates, it deletes every cache from this app with a different name (FR-012). The worker never touches `localStorage`, so preferences and metronome settings survive updates (FR-008).
- **C-08 Cleared or partial cache at runtime [default]**: When a requested file is not in the stored copy, the worker fetches it from the network, and if the network also fails it returns the network error. It never returns an app-made error page (FR-009, FR-010). *Test*: e2e: delete all caches, then reload online. The app loads and the cache is filled again. Offline after the delete, the navigation fails with the browser's own error.
- **C-09 Registration timing and performance [derived from Constitution VI]**: The worker is registered after the window `load` event, only in production builds (not in `vite dev`), and only when `'serviceWorker' in navigator`. Registration failures are caught and logged, never shown (FR-013). Precaching therefore cannot delay the first usable screen, and the Lighthouse budgets (Home ≤ 3 s, tool ≤ 3.5 s, score ≥ 90, CLS ≤ 0.1) and the initial JS budget (≤ 180 KB gzip) must still pass in CI unchanged. The registration code lives in the single bundle and counts toward that budget.
- **C-10 Existing "no requests after load" contract [derived from ADR 0002, `e2e/continuity.spec.ts`]**: That contract covers requests made by the page. The worker's own background precache requests are allowed and are excluded from the assertion, whether filtered by `request.serviceWorker()` or by waiting for the worker to be ready before tracking. Page requests during in-app navigation must still be zero, whether answered from the stored copy or not.
- **C-11 Install identity [default]**: A same-origin `manifest.webmanifest` linked from `src/app.html`, with `name` and `short_name` "Fretboard Master" (the brand name, the same in all three languages, so there is one manifest), `start_url` "/", `scope` "/", `display` "standalone", and `background_color` / `theme_color` copied from the light-theme surface token values. Icons are PNG 192×192 and 512×512 (one of them also `purpose: "maskable"`), plus a 180×180 `apple-touch-icon` link for iOS home screens. The app relies on each browser's own install entry and adds no install button or prompt (Assumptions). The opened language comes from stored preferences or the device as today (ADR 0019). *Test*: e2e/unit: the manifest parses, has these fields, and every icon URL returns 200. `<link rel="manifest">` is present on every prerendered page.
- **C-12 Device target [derived from Constitution VII, ADR 0029]**: Automated acceptance runs on the desktop Playwright project. "Airplane mode" is simulated with `context.setOffline(true)`, and "the home-screen icon" is covered by opening `start_url` offline under an active worker plus the manifest test (C-11). Phone home-screen installs are allowed and must not be blocked, but they are not a tested target. A one-time check of installing on a real phone and opening it in airplane mode is listed under "Manual checks" in `tasks.md`.
- **C-13 Sound in automated tests [derived from Constitution IV]**: "With sound" is checked through the existing injectable audio context and the metronome's scheduled-click and chime log, not by ear: offline, Ratios Training schedules clicks and the timer chime is scheduled. Listening is a "Manual checks" item.
- **C-14 Share and copy-link offline [derived from scope boundary]**: The existing Share / copy-link command works offline because it only builds a string and writes it to the clipboard. The scope boundary ("no offline sharing of links") means nothing new is built: no queueing, no Web Share target, no sync. No offline notice is added to Share.
- **C-15 Content Security Policy [derived from `svelte.config.js`]**: Same-origin worker and manifest are allowed by the existing `default-src 'self'` (covering `worker-src` and `manifest-src`). The CSP is not loosened. If the plan finds a directive must be added, it may only name `'self'`.
- **C-16 No-JS path [derived from Constitution tech stack, `e2e/nojs.spec.ts`]**: With JavaScript off, no worker is registered and the app behaves exactly as today. Offline support needs JavaScript, and the no-JS suite must stay green unchanged.
- **C-17 Storage unavailable [default]**: In private windows, with blocked site data, or when the storage quota is exceeded, registration or install fails silently and the app works online as today (FR-013). Nothing is shown to the user.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open and practise with no connection (Priority: P1)

A player has opened Fretboard Master once with a connection. Later, in a practice room with no signal, they open the app's address or its home-screen icon. The home screen appears as usual, every tool works, and the Metronome runs Ratios Training with the click and chime sounds. The app shows no "offline" error for anything that does not need the network.

**Why this priority**: This is the whole point of the feature. A metronome that will not load in a basement is no metronome.

**Independent Test**: Load the app once online, cut the network, reload and open the home screen, each tool, and the Metronome with its timer. Everything renders and sounds as it does online.

**Acceptance Scenarios**:

1. **Given** the app has loaded once with a connection, **When** the device goes offline and the user opens the app's address, **Then** the home screen appears as usual.
2. **Given** the same state, **When** the user opens each tool (Notes, Triads, CAGED, Metronome, About) in each of the three languages, **Then** every page renders fully with no network-error notice.
3. **Given** the same state, **When** the user starts Ratios Training in the Metronome, **Then** the click and chime sounds play and the practice timer runs.
4. **Given** the same state, **When** the user plays note sounds on a fretboard tool, **Then** the notes sound.
5. **Given** the user is offline, **When** they use any feature that needs no network, **Then** no "offline" message is shown.

---

### User Story 2 - Add to the home screen like an installed app (Priority: P2)

A player wants one-tap access. After the first visit with a connection, they add Fretboard Master to their phone's home screen. The icon opens the app in its own window, with its name and icon, and it works offline. No account is required.

**Why this priority**: The home-screen icon is how most players will reach the app in a room with no signal, but the offline behaviour of Story 1 is useful without it.

**Independent Test**: Inspect that the app offers an install option with a name, icon and standalone display, then open it from the installed entry in airplane mode.

**Acceptance Scenarios**:

1. **Given** the user has visited once with a connection, **When** they choose to add the app to the home screen, **Then** an icon with the app's name is added.
2. **Given** the app is added to the home screen and the device is in airplane mode, **When** the user opens the icon, **Then** the home screen appears and the Metronome runs Ratios Training with sound.
3. **Given** the user has never created an account, **When** they add the app to the home screen, **Then** no sign-in or sign-up step appears.

---

### User Story 3 - Updates never interrupt a running session (Priority: P2)

When a newer version is published, the device fetches it in the background. A running metronome keeps going untouched. The new version is used on the next launch, and saved preferences and metronome settings are intact.

**Why this priority**: Silent mid-run reloads would break a practice session and the trust that makes offline use worthwhile.

**Independent Test**: Start a run, publish a new version, confirm the run continues without reload or glitch, then relaunch and confirm the new version loads with preferences kept.

**Acceptance Scenarios**:

1. **Given** a metronome run is in progress, **When** a newer version is published and fetched in the background, **Then** the run continues with no reload, pause, timing change or prompt.
2. **Given** a newer version has been fetched, **When** the user next launches the app, **Then** the new version is used.
3. **Given** the user has saved preferences and metronome settings, **When** an update is applied, **Then** all saved values are unchanged.
4. **Given** a device is offline during an update check, **When** the check fails, **Then** the current version keeps working and nothing is shown.

---

### User Story 4 - Never loaded, and cleared storage (Priority: P3)

A user who has never loaded the app and is offline gets the browser's normal no-connection page. A user whose device has cleared the stored copy (for example under storage pressure) while online simply loads from the network as on a first visit and the app is stored again.

**Why this priority**: These are the boundary behaviours. They must not be worse than a plain website.

**Independent Test**: Open the address offline in a fresh browser profile, then clear the stored copy and reload online.

**Acceptance Scenarios**:

1. **Given** the app has never been loaded on the device and there is no connection, **When** the user opens the address, **Then** the browser's own no-connection page shows.
2. **Given** the stored copy has been cleared and the device is online, **When** the user opens the app, **Then** it loads from the network as on a first visit and is stored again.
3. **Given** the stored copy has been cleared and the device is offline, **When** the user opens the app, **Then** the browser's own no-connection page shows, and the app recovers on the next online visit.

---

### Edge Cases

- The first visit is interrupted before everything is stored: the app is only treated as available offline once everything needed has been stored, and an incomplete copy never replaces a complete one.
- A language is switched while offline: all three languages are available.
- A page reached by a deep link (for example a tool address, or a share link) is opened offline after a prior visit: it opens the right view.
- Several tabs or windows are open during an update: none of them reloads or changes version. A reload in any of them keeps the current version until every app window has closed (C-05).
- The device's storage is full or storage is blocked (for example a private window): the app still works online exactly as today; offline availability is simply absent.
- Note sounds never played before work offline, because all sound is synthesized on the device (C-02).
- A previous version's stored files remain after an update: old files are discarded once the new version takes over, so storage does not grow with each release.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: After one successful load with a connection, the app MUST open and work fully with no network, from its address and from a home-screen icon.
- **FR-002**: The device MUST keep everything needed to run the app: every file in the build output (all prerendered pages, the single JS/CSS bundle that carries every tool and all three languages, `theme-boot.js`, the accidentals font, the manifest and icons). Click, chime and note sounds are synthesized on the device and need no stored files (C-02).
- **FR-003**: Offline, every tool MUST work, including the Metronome and its practice timer and Ratios Training with sound.
- **FR-004**: The app MUST NOT show an "offline" error or notice for any feature that does not need the network.
- **FR-005**: The app MUST be installable to the home screen with a name, an icon and its own window, and MUST NOT require an account, sign-in or personal data.
- **FR-006**: When a newer version is published, the device MUST fetch it in the background when the app is next opened, and MUST use it only on the next launch, meaning the first opening after every window and tab of the app has closed (C-05, C-06).
- **FR-007**: An update MUST NOT reload, interrupt, restart or alter a running session, including a running metronome, in any open tab or window.
- **FR-008**: Updates MUST NOT change or erase saved preferences or metronome settings.
- **FR-009**: If the stored copy, or any file in it, is missing, the app MUST fall back to loading from the network as on a first visit and store itself again (C-08).
- **FR-010**: A user who has never loaded the app and is offline MUST see the browser's normal no-connection page; the app MUST NOT replace it with its own error page.
- **FR-011**: A partial or failed fetch of a new version MUST leave the current complete version in place and working.
- **FR-012**: When a new version takes over, every stored copy from earlier versions MUST be deleted, so only one version's copy remains (C-07).
- **FR-013**: If storing for offline use is unavailable or fails, the app MUST keep working online exactly as it does without this feature.
- **FR-014**: The feature MUST NOT add background sync, push notifications, device permission requests or offline sharing of links, and MUST NOT introduce third-party origins.
- **FR-015**: Offline support MUST NOT delay the first usable screen on a first visit. Storing starts only after the page has loaded (C-09), and every Constitution VI budget MUST still pass in CI unchanged.
- **FR-016**: The offline layer MUST handle only same-origin `GET` requests. It MUST NOT intercept, store or queue the measurement `POST /m` (C-03).
- **FR-017**: Offline, a navigation MUST be matched on its pathname with the query ignored, so tool addresses and share links open the right view. A path with no stored page MUST get the stored not-found page (Home plus notice), as online (C-04).
- **FR-018**: Page-initiated requests during in-app navigation MUST remain zero. The offline layer's own background storing is exempt from that check (C-10).

### Key Entities

- **Offline copy**: the complete set of app files stored on the device (pages, tool code, three language catalogs, click and chime sounds, note sounds), tied to one app version.
- **Pending update**: a newer offline copy fetched in the background and waiting for the next launch; it never takes effect mid-session.
- **Home-screen entry**: the installable identity of the app (name, icon, standalone window).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After one online load, with the network disabled, 100% of the app's pages and tools open in all three languages with no network-error notice.
- **SC-002**: After one online load and switching to airplane mode, opening the home-screen icon shows the home screen, and the Metronome runs Ratios Training with audible click and chime, in 100% of test runs.
- **SC-003**: With a newer version published during a run, the run continues with zero reloads and zero audible or timing interruptions, and the next launch shows the new version.
- **SC-004**: Saved preferences and metronome settings are identical before and after an update, for every saved field.
- **SC-005**: A device that has never loaded the app and is offline shows the browser's own no-connection page, and a device whose stored copy was cleared recovers fully on the next online load.
- **SC-006**: The Constitution VI Lighthouse budgets (first visit, no stored copy) pass in CI unchanged, and in e2e an offline launch under an active stored copy shows the Home screen with no failed requests.
- **SC-007**: The app meets the browser installability requirements: the manifest has `name`, `start_url`, `display: standalone` and 192 px and 512 px icons, every icon loads, and an active worker controls the page. The flow has no account, sign-in or personal-data step.

## Assumptions

- Install and home-screen behaviour follows what each browser offers; the app supplies the name, icon and standalone window and does not build its own install prompt.
- The constitution's desktop target still applies. Phone home-screen use is allowed and must not be blocked, but automated acceptance runs on the desktop project with simulated offline, and the real-phone airplane-mode check is a Manual check (C-12).
- Click, chime and note sounds are synthesized on the device (C-02), so there are no sound files to store.
- A "launch" means opening the app after all of its windows and tabs have closed. Reloading, or navigating in-app, while any app window stays open is not a launch and keeps the current version (C-05).
- Evergreen browsers' normal limits on stored data apply; the app's total stored size is modest relative to them.
- The existing hosting continues to serve only static files over HTTPS.
- Out of scope: background sync, push notifications, offline sharing of links, an in-app "update available" prompt, and any offline status indicator.
