# Feature Specification: Walking Skeleton — Home Screen and Navigation

**Feature Branch**: `feature/001-walking-skeleton`

**Created**: 2026-09-30

**Status**: Clarified

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/001-mvp/001-walking-skeleton.md (id 001, walking-skeleton)."

**Source**: `specs/autonomous/breakdown/001-mvp/001-walking-skeleton.md` (FR-1.1, FR-1.5, FR-1.8, FR-1.10 partial, FR-1.11 partial, EC-1.1 to EC-1.5, INT-1, NFR-7, constraints)

## Clarifications

### Session 2026-09-30

Resolutions are either **derived** (a source settles them; source cited) or **assumed defaults** (no source settles them; the conventional, constitution-consistent choice was taken). Every item is reflected in the requirements below.

#### Derived from sources

- **C-01 Screen addresses.** Home is `/`, Fretboard Notes is `/notes`, Triads is `/triads`, About is `/about` (constitution, Source layout). `/caged` is **not** a screen in this slice and behaves as an unknown address until the CAGED slice adds it. → FR-022.
- **C-02 "Usable within 3 s" is measured by Lighthouse CI.** On the Lighthouse mobile profile (simulated throttled mid-range phone, median mobile network), home has Time to Interactive ≤ 3 s and a performance score ≥ 90; initial JavaScript ≤ 80 KB gzip; opening or switching a tool ≤ 300 ms; a regression fails the build (constitution VI; NFR-1.1, NFR-1.2). → FR-023, SC-001.
- **C-03 Failure recording is on-device only.** Q-1 (anonymous measurement) is still open, and the constitution allows a measurement service only "if Q-1 adopts it". So a tool failure is recorded only to the browser console (error name, message, and tool identifier), with no network request, nothing persisted to storage, and no personal data (NFR-8.1, constitution II). → FR-012.
- **C-04 Reset tool appears only in the failure view in this slice.** The breakdown marks FR-1.11 as partial, and placeholder tools have no state to reset. The always-available **Reset tool** in the Actions zone arrives with the first tool controls. → FR-013.
- **C-05 About shows description and version only.** The breakdown marks FR-1.10 as partial. The version is the semantic version of the release (constitution, Releases), taken at build time from one source of truth, and displayed as "Version X.Y.Z". → FR-008.
- **C-06 Encrypted delivery.** Requests over plain HTTP are permanently redirected (301 or 308) to the same path over HTTPS, and HTTPS responses carry a Strict-Transport-Security header (constitution, Hosting: HTTPS; FR-015). Deploys are atomic (constitution, Hosting).
- **C-07 Theme and preferences.** The app follows the device's light/dark, reduced-motion, and contrast preferences. There is no theme switcher and nothing is stored (scope boundary; constitution V and VII). → FR-020.
- **C-08 Card layout.** Cards sit side by side on wide screens and stack on narrow screens, in the order Fretboard Notes, then Triads (design §4.1). The context panel sits beside the fretboard zone on wide screens and below it on narrow screens. The fretboard zone is the largest zone (design §4.2). Breakpoints come from design tokens. → FR-003, FR-005.

#### Assumed defaults

- **D-01 Unknown address.** Home renders in place and the address bar is replaced with `/` without adding a history entry. Reloading then shows plain home, and Back does not return to the bad address. The rule covers any path not in C-01, including subpaths (`/triads/x`) and case variants (`/Triads`). A trailing slash on a known path (`/triads/`) opens that screen. When the server receives an unknown path, it responds with HTTP 404 and a page that shows home with the notice, so the user still never sees a blank page. *Why*: this is the standard SPA/static convention, and it avoids re-showing a stale notice. → FR-010, FR-022.
- **D-02 Notice behavior.** The notice sits above the cards in the main area. It is announced politely (status role), uses a neutral (non-error) style, and has a keyboard-operable **Dismiss** button. It never hides itself on a timer (WCAG 2.2.1). It disappears when dismissed or when the user goes to another screen. Dismissing it creates no history entry. *Why*: this follows constitution VII and WCAG convention. → FR-011.
- **D-03 Persistent navigation.** Zone A on each tool screen and on About holds, in this order, **Home**, **Fretboard Notes**, **Triads**, plus an **About** link. The current screen is marked with `aria-current="page"` and with a visual indicator that does not rely on color alone. Selecting the current tool again creates no history entry. About is a single direct link, not a menu, because it is the only menu item in this slice (constitution X, YAGNI). → FR-006.
- **D-04 Cards are single links.** Each card is one focusable link (one tab stop) whose accessible name includes the tool name and its question. Its touch target is at least 44×44 CSS px. Card text wraps and is never truncated with an ellipsis. → FR-003, FR-018.
- **D-05 Placeholder zones.** Each of the five tool zones is a distinct region with an accessible name from the message catalog: "Application bar", "Main controls", "Fretboard", "Context panel", "Actions". Each placeholder is a short neutral label from the catalog. Nothing is interactive except navigation. → FR-005.
- **D-06 Reserved bottom zone on home.** The bottom zone is present in the layout but holds no text or controls. It is not exposed as a named landmark, so screen readers announce no empty region. → FR-002.
- **D-07 Skeleton = prerendered real structure; works without scripts.** Home, both tools, and About are delivered as prerendered HTML that already contains their structure and text. Home's cards and the navigation are ordinary links that work (as full-page loads) even when scripting is delayed or fails. No spinner element exists anywhere. *Why*: this is the constitution-mandated prerendered static delivery, and it is the simplest way to satisfy "never blank". → FR-009.
- **D-08 Containment of tool failures.** The failure view replaces zones B–E of the failing tool only. Zone A (navigation) stays operable. **Reset tool** re-creates the tool in its initial placeholder state in place, without a page reload or a history entry. If the failure happens again, the failure view shows again, never a blank page and never a loop. **Go to home** is a normal navigation (one history entry). Leaving a failed tool and coming back opens it in its initial state (there is no per-session tool state yet). → FR-012, FR-013.
- **D-09 Failures outside a tool.** A failure on home or About, or in the shell, shows "Something went wrong in this view" with **Go to home** only (an in-app navigation to `/` that needs no network, falling back to a full load of `/` only if that fails). It never shows a blank page. → FR-012.
- **D-10 Forcing a failure for tests.** A fault-injection hook exists only in non-production (test/dev) builds, so automated tests can trigger a tool failure. The production build contains no way for a user or an address to trigger it. *Why*: the constitution requires every acceptance scenario to become an automated test, and it requires untrusted input never to reach executable paths. → FR-024.
- **D-11 Screen titles, language, focus.** The document language is `en`. Each screen has exactly one top-level heading: home "Fretboard Master", tools their tool name, About "About Fretboard Master". Each screen has a title: "Fretboard Master" on home, and "<Screen name> — Fretboard Master" elsewhere. After an in-app screen change, focus moves to the new screen's top-level heading. *Why*: WCAG 2.4.2, 3.1.1, and focus-order convention for client-side navigation. → FR-021.
- **D-12 Version continuity in an open session.** In a session already open, navigating among home, tools, and About never reloads the page and never requests code or assets from a different version, so no request fails after a new version is published. A "next opening" means any full page load (reload, new tab, typed address), and it receives the latest version. → FR-016.
- **D-13 Public address.** The production address is the hosting provider's default production URL for the project. A custom domain is an operational step outside this spec and can be added later without product changes.

No material ambiguities remain; no human escalation is required for this slice.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open the app and see a usable home screen (Priority: P1)

A guitarist opens a public web address on a phone or desktop, in any current browser, with no install, sign-up, or sign-in. A home screen appears with a top zone (product name and an "About" link), a center zone with two tool cards of equal visual weight, and a bottom zone reserved for the instrument summary. The cards are **Fretboard Notes** ("Where is every note?") and **Triads** ("What is a chord made of?"). There are no decorative images, carousel, or intro text: the first possible action is choosing a study.

**Why this priority**: Without a reachable, working entry point nothing else can be delivered. This is the deployed end-to-end slice that every later slice builds on.

**Independent Test**: Open the root address on the reference phone profile and confirm both cards are visible and tappable within 3 seconds.

**Acceptance Scenarios**:

1. **Given** a user with a current browser and no prior visit, **When** they open the root address, **Then** the home screen with both cards is usable within 3 seconds on the reference phone (Lighthouse mobile profile: Time to Interactive ≤ 3 s, performance score ≥ 90).
2. **Given** the home screen is loading, **When** scripts have not yet run (or fail to run), **Then** the prerendered home structure with both cards is already visible, the card links work, and no spinner is ever shown.
3. **Given** the home screen is shown, **When** the user looks at it, **Then** both cards have equal visual weight, each shows its name and one-sentence question, and the bottom zone is present but holds no content.
4. **Given** any device width from 320 to 2560 logical pixels, **When** the home screen is shown, **Then** the page never scrolls horizontally and content respects phone safe areas.
5. **Given** any visit, **When** the user interacts, **Then** no sign-up, sign-in, or profile screen is ever presented.

---

### User Story 2 - Open a tool and move between screens (Priority: P1)

From home, the user picks a card and lands on a tool screen laid out in the shared five zones (application bar, main controls, fretboard, context panel, actions), filled with placeholders. Persistent navigation inside the tool reaches home or the other tool in one action and shows which tool is current. Browser back and forward move between screens only.

**Why this priority**: Navigation across the two tools and home is the skeleton's core proof; later tools plug into this layout.

**Independent Test**: From home open Triads, switch to Fretboard Notes, return home, then use browser back and forward and confirm each lands on the expected screen.

**Acceptance Scenarios**:

1. **Given** the home screen, **When** the user selects the Triads card, **Then** the Triads tool screen opens at `/triads`, showing the five named zones with placeholder content.
2. **Given** a tool screen, **When** the user looks at the persistent navigation, **Then** it lists Home, Fretboard Notes, and Triads, marks the current tool (`aria-current="page"` plus a non-color indicator), and offers one-action access to home and to the other tool.
3. **Given** the user is in Triads after arriving from home, **When** they press browser back, **Then** they return to home.
4. **Given** the user has visited home, Notes, and Triads, **When** they use browser back and forward, **Then** they move through those screens in order; selecting the current tool again, dismissing a notice, and Reset tool create no history entries.
5. **Given** the user is on a tool, **When** they navigate using only the keyboard, **Then** all navigation and cards are reachable with visible focus, and after each screen change focus lands on the new screen's top-level heading.
6. **Given** the user opens `/notes`, `/triads`, or `/about` directly (or reloads it), **When** the page loads, **Then** that screen opens, with its title and heading.

---

### User Story 3 - Read About and see the app version (Priority: P2)

The user opens "About" from home and sees a short description of the app and the current application version.

**Why this priority**: Required by the home design and release process, but no other flow depends on it.

**Independent Test**: Open About from home and verify the description and a version string are shown and the user can return home.

**Acceptance Scenarios**:

1. **Given** the home screen, **When** the user selects "About", **Then** the `/about` page opens with a short description of Fretboard Master and the text "Version X.Y.Z", matching the release's semantic version.
2. **Given** the About page, **When** the user uses the Home link or browser back, **Then** they return to home.

---

### User Story 4 - Never see a blank or broken app (Priority: P2)

Unknown addresses lead gracefully to home, and a failure inside one tool is contained to that tool.

**Why this priority**: The product promise is "never blank"; it protects trust on every later slice.

**Independent Test**: Open a nonexistent address; force a failure in a tool (test-build hook) and use its recovery actions.

**Acceptance Scenarios**:

1. **Given** an address that does not exist (for example `/nope`, `/triads/x`, `/caged`), **When** the user opens it, **Then** home opens with the notice "We could not find that page" and the address bar shows `/`.
2. **Given** that notice, **When** the user presses Dismiss or goes to another screen, **Then** the notice disappears; it is non-blocking, at most two lines, announced politely, not styled as an error, and never hides itself on a timer.
3. **Given** a tool hits an unexpected failure, **When** the failure occurs, **Then** the tool's zones B–E show "Something went wrong in this view" with **Reset tool** and **Go to home**, the navigation stays operable, the failure is written to the console only, and no network request is made.
4. **Given** the failure view, **When** the user chooses **Reset tool**, **Then** the tool returns to its initial placeholder state with no page reload and no history entry; **When** the user chooses **Go to home**, **Then** home opens.
5. **Given** a failure in one tool, **When** the user opens the other tool, **Then** it works normally.
6. **Given** the production build, **When** any address or interaction is tried, **Then** there is no way to trigger the test fault-injection hook.

---

### User Story 5 - Reliable, private delivery and updates (Priority: P3)

The app is delivered over an encrypted connection, publishes new versions without downtime, and sessions already open keep the version they loaded.

**Why this priority**: Operational quality that users notice only when it fails.

**Independent Test**: Verify plain-HTTP requests are redirected to HTTPS; publish a new version while a session is open and confirm the open session is unchanged and new visits get the new version.

**Acceptance Scenarios**:

1. **Given** a request for the app over plain HTTP, **When** it is made, **Then** it is permanently redirected (301/308) to the same path over HTTPS, and HTTPS responses carry a Strict-Transport-Security header.
2. **Given** a new version is published, **When** users open the address during publishing, **Then** the app remains available throughout (no failed requests).
3. **Given** a session open on version N, **When** version N+1 is published and the user then moves among home, both tools, and About, **Then** the page does not reload, no asset request fails, and About still shows version N; the next full page load receives N+1.

---

### Edge Cases

- Loading in progress: prerendered home structure is visible first; no full-screen or other spinner exists (EC-1.1, D-07).
- Address of a nonexistent screen (including `/caged` in this slice, subpaths, case variants): home opens with "We could not find that page", address replaced with `/`, server status 404 (EC-1.2, D-01).
- Unexpected tool failure: contained to zones B–E, with **Reset tool** and **Go to home**; navigation and other tools unaffected; recorded to the console only, without personal data or network traffic (EC-1.3, C-03, D-08).
- Failure that recurs after Reset tool: the failure view shows again; never blank, never a loop (D-08).
- Failure outside a tool (home, About, shell): "Something went wrong in this view" with **Go to home** (D-09).
- Window resized or device rotated mid-use: layout rearranges without losing the current screen (EC-1.4).
- New version published with the app open: nothing changes in the running session (EC-1.5, D-12).
- Narrow (320) and very wide (2560) widths, text zoom to 200%, and phone notches: no horizontal page scroll, no truncation or overlap, safe areas respected.
- Direct opening of a tool or About address (deep link / refresh) or a trailing-slash variant: that screen opens, not a blank page.
- Browser with scripting delayed or failing to load: prerendered screens remain readable and links still navigate (D-07).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST be reachable at a public address (D-13) in any current evergreen desktop or mobile browser without install, sign-up, or sign-in.
- **FR-002**: The home screen MUST have a top zone (product name and "About" link), a center zone with tool cards, and a bottom zone reserved for the instrument summary. In this slice the bottom zone MUST hold no text or controls and MUST NOT be exposed as a named landmark.
- **FR-003**: The home screen MUST show exactly two cards of equal visual weight in this order: **Fretboard Notes** ("Where is every note?") and **Triads** ("What is a chord made of?"), side by side on wide screens and stacked on narrow screens. Each card MUST be a single link (one tab stop) whose accessible name includes the tool name and question, with a touch target of at least 44×44 CSS px. Card text MUST wrap, never truncate. The home screen MUST NOT show decorative images, a carousel, or intro text.
- **FR-004**: Selecting a card MUST open the corresponding tool screen.
- **FR-005**: Each tool screen MUST use the shared five-zone layout as distinct regions with catalog-sourced accessible names ("Application bar", "Main controls", "Fretboard", "Context panel", "Actions"), each holding a short neutral placeholder label. The fretboard zone MUST be the largest. The context panel MUST sit beside the fretboard on wide screens and below it on narrow screens.
- **FR-006**: Zone A of each tool screen, and the About page, MUST show persistent navigation with **Home**, **Fretboard Notes**, **Triads** (in that order), and an **About** link. Each destination MUST be reachable in one action. The current screen MUST be marked with `aria-current="page"` and a non-color visual indicator.
- **FR-007**: Browser back and forward MUST move only between screens (home, tools, About). Selecting the current screen again, dismissing a notice, and **Reset tool** MUST NOT create history entries.
- **FR-008**: The About page MUST show a short description of the app and the text "Version X.Y.Z", where X.Y.Z is the release's semantic version taken at build time from a single source of truth.
- **FR-009**: Home, both tool screens, and About MUST be delivered as prerendered HTML containing their structure and text. Card and navigation links MUST work as plain links when scripts are delayed or fail. No spinner MUST be shown at any time.
- **FR-010**: The app MUST never present a blank screen. Any address not listed in FR-022 MUST open home with the notice "We could not find that page" and MUST replace the address with `/` without adding a history entry. A server request for such an address MUST return HTTP 404 with a page that shows that home-with-notice view.
- **FR-011**: Notices MUST be non-blocking, at most two lines, announced politely to assistive technology, and styled neutrally (never error red). Each notice MUST have a keyboard-operable **Dismiss** button. A notice MUST NOT hide itself on a timer, and MUST disappear on dismiss or on navigation to another screen. Modal dialogs MUST NOT be used for notices.
- **FR-012**: An unexpected failure in a tool MUST replace only that tool's zones B–E with "Something went wrong in this view", **Reset tool**, and **Go to home**, and navigation and other screens MUST keep working. The failure MUST be recorded only to the browser console (error name, message, tool identifier), with no network request, no storage write, and no personal data. A failure outside a tool MUST show the same message with **Go to home** only. A blank screen MUST never result.
- **FR-013**: **Reset tool** MUST re-create the tool in its initial placeholder state, in place, with no page reload or history entry. If the failure recurs, the failure view MUST show again. In this slice **Reset tool** appears only in the failure view.
- **FR-014**: The page MUST NOT scroll horizontally at any logical width from 320 to 2560 and MUST respect phone safe areas.
- **FR-015**: All traffic MUST be encrypted. Plain-HTTP requests MUST be permanently redirected (301/308) to HTTPS, and HTTPS responses MUST include a Strict-Transport-Security header.
- **FR-016**: Publishing a new version MUST cause no downtime. In a session already open, moving among home, tools, and About MUST NOT reload the page or request code or assets of a different version. Any full page load MUST receive the latest version.
- **FR-017**: Every user-facing string (including zone names, placeholder labels, notices, page titles, and button labels) MUST come from the message catalog (English only in this release).
- **FR-018**: All functions MUST be operable by keyboard with visible focus and a logical order, and MUST meet WCAG 2.2 AA with zero automated accessibility violations.
- **FR-019**: The app MUST NOT collect personal data, use accounts or user identifiers, load third-party executable content, make network requests after load, or request device permissions.
- **FR-020**: Visual values MUST come from shared design tokens. The layout MUST follow the device's light/dark, reduced-motion, and contrast preferences. No theme switcher is offered and no preference is stored.
- **FR-021**: The document language MUST be `en`. Each screen MUST have exactly one top-level heading (home "Fretboard Master", tools their name, About "About Fretboard Master") and a title ("Fretboard Master" on home, "<Screen name> — Fretboard Master" elsewhere). After an in-app screen change, focus MUST move to the new screen's top-level heading.
- **FR-022**: Screen addresses MUST be: home `/`, Fretboard Notes `/notes`, Triads `/triads`, About `/about`. A trailing slash on these (`/triads/`) MUST open the same screen. Every other path (including `/caged`, subpaths, and case variants) is unknown (FR-010).
- **FR-023**: CI MUST enforce, on the Lighthouse mobile profile: home Time to Interactive ≤ 3 s, performance score ≥ 90, initial JavaScript ≤ 80 KB gzip, and tool open or switch ≤ 300 ms. A regression MUST fail the build.
- **FR-024**: A fault-injection hook that forces a tool failure MUST exist only in non-production builds, for automated tests. The production build MUST contain no way to trigger it.

### Key Entities

- **Tool**: A study screen reachable from home (Fretboard Notes `/notes`, Triads `/triads`); has a name, a one-sentence question, and an address. CAGED is added by a later slice.
- **Screen**: A navigable destination (home `/`, a tool, About `/about`); tracked by browser history; has one top-level heading and a title.
- **Notice**: A short, dismissible, non-blocking message shown on a screen (for example, page not found); lives only until dismissed or until the user leaves the screen.
- **Application version**: The release's semantic version (X.Y.Z), fixed at build time and shown on About.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the Lighthouse mobile profile (reference phone), home reaches Time to Interactive within 3 seconds of opening the root address, with a performance score ≥ 90.
- **SC-002**: A first-time user reaches a tool screen from the root address in a single selection, with no sign-up or sign-in step.
- **SC-003**: From any tool, the user reaches home or the other tool in one action, 100% of the time.
- **SC-004**: At every tested width from 320 to 2560 logical pixels, and at 200% text zoom, 0 screens scroll horizontally or have truncated or overlapping content.
- **SC-005**: 100% of nonexistent addresses tested (including `/caged`, subpaths, and case variants) open home with the "We could not find that page" notice; 0 produce a blank screen.
- **SC-006**: A forced failure in one tool leaves the other tool, home, and the navigation fully working in 100% of tested cases, makes 0 network requests, and the recovery actions each succeed.
- **SC-007**: Publishing a new version causes 0 failed requests during publishing, and open sessions remain on their loaded version (0 reloads, 0 failed asset requests while navigating).
- **SC-008**: 0 accessibility violations are reported on home, both tool screens, About, and the home-with-notice and failure views; every function is reachable by keyboard.

## Assumptions

- Scope boundary: no fretboard, sound, preferences, instrument summary content, theme switcher, or languages other than English; these come in later slices. The bottom zone of home is reserved but empty.
- Tool screens contain placeholders only; the "Continue" marker, context carry-over, per-session tool state, and the always-available Reset tool in the Actions zone are later slices.
- About in this slice contains only the description and version; marker legend, keyboard shortcut list, and privacy statement are added by later slices.
- Failure recording is console-only on the device (C-03) until Q-1 is decided; no personal data is sent anywhere.
- The reference phone is the Lighthouse mobile profile (a throttled mid-range phone about four years old on a median mobile network).
- Supported browsers are the last two major versions of evergreen browsers, desktop and mobile.
- Technology choices (static delivery, framework, hosting) are decided in the plan under the project constitution, not in this spec.
