# Feature Specification: Anonymous Usage Measurement and Error Reporting

**Feature Branch**: `feature/028-anonymous-measurement`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/007-comfort-and-launch-readiness/005-anonymous-measurement.md (id 005, anonymous-measurement)."

## Clarifications

### Session 2026-10-07

Sources: constitution (Principle II, Development Workflow); breakdown `007-comfort-and-launch-readiness/005`; macro-spec INT-2, DM-18, ARCH-11, NFR-5, NFR-8, M-5 to M-7, Q-1/Q-11; slice 027 spec (About privacy text states "nothing is measured"; word and jargon limits); code: `svelte.config.js` CSP, `src/lib/shell/failure.ts` (`recordFailure` console-only seam), `src/lib/i18n/gaps.ts` (missing-text detection, once per locale and key), ADR 0001 (Cloudflare Pages), ADR 0004 (test-only fault injection). "Derived" = settled by a source; "Default" = assumed conventional choice.

- Q: Is Q-1 decided in favor? → A (derived): yes. The breakdown file says to build this slice only if Q-1 is decided in favor, and the task to implement it is the decision. Slice 027's statement that nothing is measured becomes false and MUST be replaced by this slice.
- Q: Do users get a consent prompt or an opt-out? → A (default, consistent with Q-11 left to pre-launch legal review): no banner and no consent flow, because no personal data, identifier or cookie exists. The About page describes the measurement in plain language. The browser's Do Not Track and Global Privacy Control signals are honored: when either is on, nothing is sent (cheap, privacy-protective, and does not conflict with any source).
- Q: What is a "session" for M-6 and M-7 without a persistent identifier? → A (derived from DM-18 and NFR-5.3): one page load. A restore from the browser's back/forward cache is the same page load, not a new one. No session identifier exists: the first tool-opened event of a page load carries `sessionStart: true` (every other event omits it). Because first-interaction and sound-played are each sent at most once per page load, the service counts without any join: sessions = tool-opened events with `sessionStart`; M-6 = sound-played count ÷ sessions; M-7 = first-interaction count ÷ sessions, per device class. A page load that never opens a tool (home or About only) sends nothing and is not a session. Nothing links two page loads.
- Q: From when is time to first interaction measured? → A (derived, M-5 "after opening the application"): from the start of the page load (navigation start), in whole seconds, capped at 3600. If the page was hidden (background tab) at any moment before the first interaction, the seconds field is omitted from that event so idle background time does not skew the median.
- Q: Where do reports and events go? → A (operator decision, round 1, Q1 option A): a same-origin Cloudflare Pages Function at `POST /m` that writes to Cloudflare Workers Analytics Engine. No new origin, no company beyond the existing host (ADR 0001), CSP `connect-src` stays `'self'`, and the About statement "no content from other companies" stays true. M-5 to M-7 are computed as aggregate counts with Analytics Engine SQL. This Function is the measurement-service exception that constitution Principle II allows. It is the only server-side code in the repo. Also fixed: the endpoint is a build-time setting. The production build sets it to `/m`. When it is empty (dev, unit tests, and any build without the setting), the measurement code sends nothing. E2E builds point it at a path Playwright intercepts. Requests omit credentials (`credentials: 'omit'`), set no cookie, do not follow redirects, and ignore the response body.
- Q: What may the `/m` Function do with a request? → A (default, follows from Principle II "aggregate, no persistent identifier"): it accepts only `POST` with a JSON body of at most 16 KB (any other method gets 405). It validates each item against the same allowlist schema the client uses, a shared module in `src/lib`, and drops unknown fields and invalid items. It writes one Analytics Engine data point per valid item, containing only the permitted fields. It MUST NOT write or log the client IP, user agent, country or other `request.cf` data, Ray ID, any request header, or the raw body. It always answers `204` with `Cache-Control: no-store` and no `Set-Cookie`, even when it rejected items, so the client learns nothing and has nothing to retry. When the Analytics Engine binding is missing or a write throws, it still answers `204` and drops the items silently.
- Q: Retention and querying? → A (default): Analytics Engine is the only store. Its fixed retention (3 months) is the retention policy, and nothing is copied elsewhere. Analytics Engine may sample at high volume. That is acceptable, because M-5 to M-7 are medians and ratios. The repo documents the SQL queries for M-5, M-6 and M-7 (in `docs/`), each computed from the event counts and seconds field described in "What is a session" above. Dashboards are out of scope.
- Q: What do error reports contain? → A (derived, NFR-8.1 and INT-2): failure kind, tool (`notes`, `triads`, `caged`, or `shell` for failures outside a tool), view state as a structured object of the same validated enumerated fields the share-link schema holds (never the encoded link string or any part of the address), instrument configuration (string count, fret count, preset tuning id or `"custom"`, handedness), device class, language, app version, and either the error name plus message or the missing text key. Never the address, free text typed by the user, a stack trace, or a custom tuning's notes.
- Q: How are error messages made safe and bounded? → A (default, conventional): message truncated to 200 characters after replacing anything that looks like a URL (`https?://` or `/`-rooted path with a query or hash) with `<url>`. No stack trace is sent.
- Q: Batching, caps and de-duplication values? → A (default, conventional): events and reports are queued in memory and flushed when 10 are queued, 5 s after the first queued item, or on `pagehide`/`visibilitychange` to hidden (best-effort `sendBeacon`, falling back to `fetch` with `keepalive`). Per page load at most 50 usage events and 10 reports; items beyond the cap are dropped silently. Reports are de-duplicated by (kind, tool, error name, truncated message or text key); missing-text reports reuse the existing once-per-locale-and-key rule (`takeUnreported` in `src/lib/i18n/gaps.ts`).
- Q: What counts as one "instrument changed"? → A (default): a user action in the instrument panel that leaves the instrument traits (string count, preset tuning id or `"custom"`, handedness) different from the last traits sent or seen at page start. Traits are compared after a 1 s quiet period, so a run of edits sends one event with the final traits. Editing a custom tuning's notes without leaving `"custom"` sends nothing. Restoring preferences at startup and opening a shared link never send instrument-changed.
- Q: How is device class derived? → A (default, conventional, no stored or unique value): computed once per page load. `phone` when the primary pointer is coarse and the shorter screen side is under 600 CSS px; `tablet` when the pointer is coarse and the shorter side is 600 CSS px or more; `desktop` otherwise.
- Q: Which language and which tool values? → A (default): language is the active UI language (`en`, `pt-BR`, `es`) at the moment of the event. Tool is `notes`, `triads` or `caged`. Link-shared and link-opened carry the tool of the shared or opened view.
- Q: How is the delivery service monitored (NFR-8.2)? → A (default, uses the mandated CI): a scheduled GitHub Actions workflow runs every 15 minutes and requests the production home page and one immutable asset. It fails when a response is not 200 or takes longer than 2 s. A failed scheduled run notifies maintainers through GitHub's standard workflow-failure notification. The production address is a repository variable. No third-party monitoring service is added.
- Q: Does Do Not Track / GPC also stop error reports? → A (default, privacy-protective): yes. When either signal is on, no usage event and no report is sent; failures still go to the console as today.
- Q: Does a link that fails to parse count as link-opened? → A (derived, constitution IX): link-opened is sent only when a received link opened a view, including when some fields fell back to defaults. A link that opened nothing (home fallback) sends no link-opened event.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The team learns how the product is used, without knowing anyone (Priority: P1)

A person opens a tool and starts using it. The product quietly records a few anonymous events (tool opened, first fretboard interaction, sound played, link shared, link opened, instrument changed). Each carries only the tool, device class, language and instrument traits. The person notices nothing.

**Why this priority**: These events are the only way to measure M-5 to M-7 at scale, which is the reason for the feature.

**Independent Test**: Open Triads in a fresh browser, tap a fret, and inspect what the app sends: a tool-opened event and a first-interaction event, each carrying only the permitted fields and no identifier.

**Acceptance Scenarios**:

1. **Given** a fresh browser, **When** the user opens Triads and taps a fret, **Then** a tool-opened event and a first-interaction event are sent, each with only tool, device class, language and instrument traits.
2. **Given** a tool is open, **When** the user plays a sound, **Then** a sound-played event is sent (at most once per page load).
3. **Given** a tool is open, **When** the user shares a link, **Then** a link-shared event is sent that contains no part of the link.
4. **Given** the user opens a received link, **When** the tool appears, **Then** a link-opened event is sent that contains no part of the link.
5. **Given** a tool is open, **When** the user changes the instrument, **Then** an instrument-changed event is sent with the new traits (string count, preset tuning id or "custom", handedness), and never the notes of a custom tuning.
6. **Given** two page loads by the same person, **When** events from both are inspected, **Then** nothing in them links one to the other.

---

### User Story 2 - Measurement never gets in the user's way (Priority: P1)

The measurement service may be slow, blocked by an ad blocker, or down. The person using the product sees no difference: no delay, no error, no notice.

**Why this priority**: Constitution Principle II requires measurement to fail silently, and Principle VI makes performance a gate.

**Independent Test**: Block or fail every request to the measurement service and run the core flows; behavior, timing budgets and visible output match the case with the service healthy.

**Acceptance Scenarios**:

1. **Given** the measurement service is unreachable or returns errors, **When** the user uses any tool, **Then** the interface behaves identically and shows no error or notice.
2. **Given** events occur in quick succession, **When** they are sent, **Then** they are batched and never delay interaction, drawing or sound.
3. **Given** the user leaves the page, **When** events are still pending, **Then** the app makes a best-effort send and otherwise drops them silently.
4. **Given** the browser signals Do Not Track or Global Privacy Control, **When** the user uses the product, **Then** no event or report is sent.

---

### User Story 3 - Unexpected failures are recorded so the team can reproduce them (Priority: P2)

When a view fails while calculating, drawing or playing sound, or a translation is missing, the user sees the existing fallback ("Something went wrong in this view") or the English fallback text. An anonymous report with the failure kind, view state and instrument configuration reaches the team.

**Why this priority**: It makes defects reproducible after launch, but the core measurement works without it.

**Independent Test**: Force a Triads view to throw while drawing; the user sees the fallback and one anonymous report with the view state and instrument is recorded.

**Acceptance Scenarios**:

1. **Given** a Triads view throws while drawing, **When** the fallback appears, **Then** one anonymous report with view state and instrument configuration is recorded.
2. **Given** a calculation or audio error occurs, **When** it is caught, **Then** a report with the same fields is recorded.
3. **Given** a text is missing in the active language, **When** the English fallback is shown, **Then** a report naming the missing text key and language is recorded, at most once per key per page load.
4. **Given** the same failure repeats, **When** reports are sent, **Then** duplicates within a page load are collapsed so the service is not flooded.
5. **Given** the instrument has a custom tuning, **When** a report is recorded, **Then** it says "custom" and never the tuning's content.

---

### User Story 4 - The About page says exactly what is measured (Priority: P2)

A curious or privacy-minded reader opens About and finds a plain-language, accurate description of what is measured, what is never measured, and how errors are reported, in their own language.

**Why this priority**: Trust and legal transparency (NFR-5.4); the existing text claims nothing is measured and must stop doing so.

**Independent Test**: Open About in each language and compare the listed events and fields with the events actually sent.

**Acceptance Scenarios**:

1. **Given** About is open, **When** the reader opens the privacy section, **Then** it lists the six events, the four kinds of attached traits, the error reports, and the things never collected (identifiers, full link addresses, custom tuning content, personal data).
2. **Given** each of the three languages, **When** About is shown, **Then** the updated text is fully translated and keeps the existing length and plain-language limits.
3. **Given** the text and the sent data, **When** they are compared in an automated test, **Then** the set of events and fields named in the text matches the set the app can send.

---

### User Story 5 - The team can read the three targets and watch service health (Priority: P3)

From the aggregated events the team can compute: median time to first fretboard interaction (target ≤ 15 s), share of sessions with at least one sound (target ≥ 50%), and the gap between phone and desktop sessions with a fretboard interaction (target ≤ 10 points). The delivery service is also monitored for availability and response time.

**Why this priority**: Consumption of the data. It depends on the data existing, and does not change user-facing behavior.

**Independent Test**: Feed a known set of events and confirm each target can be computed from them alone.

**Acceptance Scenarios**:

1. **Given** the first-interaction event, **When** it is sent from a page that stayed visible, **Then** it carries the whole seconds elapsed since the page load started (capped at 3600), enough to compute the median; **and given** the page was hidden before the interaction, the seconds field is omitted.
2. **Given** events from phone, tablet and desktop, **When** grouped by device class, **Then** the share of sessions with a first interaction can be compared between phone and desktop.
3. **Given** the delivery service, **When** it is down or slow, **Then** the team is alerted through availability and response-time monitoring.

### Edge Cases

- Private browsing, blocked storage or cleared data: measurement does not depend on storage; nothing is written to the device for it.
- Ad blocker or corporate network blocks the service: silent, identical behavior (US2).
- Tab opened in the background: first-interaction omits its seconds field. Page restored from the back/forward cache: same page load, so no once-per-load event is re-sent; tool-opened is sent at most once per tool per page load.
- Rapid repeated triggers (dragging, repeated taps, instrument being edited on every keystroke): first interaction and sound-played are sent once per page load; instrument-changed is sent once after a 1 s quiet period, only if traits differ.
- A shared link that fails to parse: link-opened is not sent for a link that did not open a view.
- A report would carry text typed by the user or a link: those fields are never included; reports are built from a fixed list of permitted fields, and URL-like text in messages becomes `<url>`.
- Very long error messages: truncated to 200 characters.
- Offline after load: events are dropped silently; the app keeps working fully (NFR-1.5).
- Measurement service returns unexpected content or redirects: ignored.
- Event volume spikes (an error loop): per-page-load caps (50 usage events, 10 reports) prevent flooding.
- Build without a measurement endpoint (dev, unit tests, previews without the setting): nothing is sent and behavior is otherwise identical.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST send exactly these usage events, without blocking the interface: tool opened, first fretboard interaction, sound played, link shared, link opened, instrument changed.
- **FR-002**: Every usage event MUST carry only: event type, tool (`notes`, `triads`, `caged`), device class (phone, tablet, desktop), language (`en`, `pt-BR`, `es`), and instrument traits (string count, preset tuning id or the word "custom", handedness). In addition, the first tool-opened event of a page load MUST carry `sessionStart: true`, and the first-interaction event MUST carry the whole seconds since the page load started (capped at 3600) unless the page was hidden before the interaction, in which case the field is omitted.
- **FR-003**: Events and reports MUST NOT contain any identifier of a person, device or persistent session, any cookie, the full or partial address of a shared or received link, or the content of a custom tuning. Nothing MUST be stored on the device for measurement.
- **FR-004**: Events MUST be queued in memory and sent asynchronously in batches, flushed at 10 queued items, 5 s after the first queued item, or when the page is hidden or unloaded (best-effort `sendBeacon`, else `fetch` with `keepalive`). Requests MUST omit credentials, MUST NOT follow redirects, and MUST ignore the response. Any failure to send MUST be ignored silently (empty `catch` with the constitution-required comment) and MUST NOT delay, interrupt or alter the interface, sound or drawing.
- **FR-005**: First fretboard interaction and sound played MUST each be sent at most once per page load (a back/forward-cache restore is the same page load); tool opened at most once per tool per page load; instrument changed only after a user action in the instrument panel leaves the traits different from the last traits sent or seen at page start, compared after a 1 s quiet period. Preference restore at startup and opening a shared link MUST NOT send instrument changed. Link opened MUST be sent only when a received link opened a view.
- **FR-005a**: The measurement endpoint MUST be a build-time setting. When it is empty, the app MUST send nothing; dev and unit-test builds leave it empty.
- **FR-006**: The app MUST send nothing when the browser signals Do Not Track or Global Privacy Control.
- **FR-007**: The app MUST record anonymous failure reports for unexpected on-device failures: calculation, drawing and audio errors, and missing translations, including failures behind the "Something went wrong in this view" fallback.
- **FR-008**: Each report MUST carry the failure kind, tool (`notes`, `triads`, `caged` or `shell`), view state as a structured object of the share-link schema's validated enumerated fields (never the encoded link string or any part of the address), instrument configuration (string count, fret count, preset tuning id or "custom", handedness), device class, language, app version, and either the error name plus sanitized message or the missing text key. It MUST NOT carry a stack trace or anything forbidden by FR-003. Custom tunings appear only as "custom".
- **FR-009**: Reports MUST be de-duplicated within a page load by (kind, tool, error name, sanitized message or text key); missing-text reports keep the existing once-per-language-and-key rule. At most 10 reports and 50 usage events are sent per page load; the rest are dropped silently. Messages MUST have URL-like text replaced by `<url>` and be truncated to 200 characters.
- **FR-010**: Recording a report MUST NOT change what the user sees: the existing fallback view and English text fallback remain exactly as before.
- **FR-011**: The data MUST be usable to compute M-5 (median time to first fretboard interaction), M-6 (share of sessions with at least one sound) and M-7 (phone versus desktop share of sessions with a fretboard interaction) without any user-level join.
- **FR-012**: The delivery service MUST be monitored by a scheduled GitHub Actions workflow every 15 minutes that requests the production home page and one immutable asset and fails when a response is not 200 or takes longer than 2 s; a failed run notifies maintainers through GitHub's workflow-failure notification. The production address MUST come from a repository variable.
- **FR-013**: The About privacy section MUST state, in all three languages and in plain language, what is measured (the six events and four kinds of attached traits), that errors are reported anonymously with view state and instrument, what is never collected, and that nothing is used for profiles, advertising, cross-referencing or third parties. It MUST also say that nothing is sent when the browser's Do Not Track or Global Privacy Control is on. It MUST replace slice 027's statement that nothing is measured (`about_privacy_not_measured`), and keep slice 027's limits: no legal jargon ("data controller", "processing", "lawful basis"), whole privacy text ≤ 220 words in English and ≤ 280 words in pt-BR and es (catalog unit test). The "no content from other companies" statement MUST stay unchanged and true. Data goes only to the app's own site, so the text names no third party.
- **FR-014**: The only network destination besides the app's own static delivery MUST be the same-origin endpoint `POST /m`. The CSP `connect-src` MUST stay `'self'`, and no origin is added. No third-party tracker, advertising or executable content MAY be loaded.
- **FR-015**: Privacy checks from slice 027 (no cookies, only prefixed stored keys, no permission requests, no external origins) MUST keep passing unchanged. Requests to the app's own origin are allowed only for static assets and `/m`.
- **FR-017**: A Cloudflare Pages Function MUST serve `/m` and write to Workers Analytics Engine. It MUST accept only `POST` with a JSON body of at most 16 KB and answer any other method with 405. It MUST validate every item against the shared allowlist schema used by the client, dropping unknown fields and invalid items, and write one data point per valid item with only the permitted fields. It MUST NOT write or log the client IP, user agent, country or other `request.cf` data, Ray ID, request headers, or the raw body. It MUST always answer `204` with `Cache-Control: no-store` and no `Set-Cookie`, including when items are rejected, when the binding is missing, or when a write fails. Unit tests with a fake Analytics Engine binding MUST cover these rules.
- **FR-018**: The repo MUST document the Analytics Engine SQL queries that compute M-5, M-6 and M-7 from the stored data points, without any user-level join. Retention is Analytics Engine's fixed retention. No other store MAY hold the data.
- **FR-016**: Every acceptance scenario above MUST be covered by an automated test; the set of events and fields named in About MUST be checked against the set the app can send.

### Key Entities

- **Usage event**: event type (six values), tool, device class, language, instrument traits, `sessionStart` (first tool-opened of a page load only), optional seconds since page load (first-interaction only). No identifier.
- **Instrument traits**: string count, preset tuning id or "custom", handedness.
- **Failure report**: failure kind (calculation, drawing, audio, missing translation), tool, structured view state, instrument configuration (traits plus fret count), device class, language, app version, error name plus sanitized message (≤ 200 chars) or missing text key.
- **Measurement service**: the single destination that receives batches of events and reports and stores them in aggregate form: the same-origin Cloudflare Pages Function `POST /m` writing to Workers Analytics Engine.
- **Page load (session)**: the only unit of grouping; carries no identifier; counted by tool-opened events with `sessionStart`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of automated runs, opening a tool and tapping a fret produces a tool-opened and a first-interaction event, and no sent payload contains an identifier, a link, or custom tuning content.
- **SC-002**: With the measurement service unreachable, 100% of core flows complete with identical visible output and no performance-budget regression relative to the service being healthy.
- **SC-003**: 100% of forced drawing, calculation, audio and missing-translation failures in tests produce exactly one anonymous report with view state and instrument configuration, and the user still sees the usual fallback.
- **SC-004**: With Do Not Track or Global Privacy Control on, 0 requests reach the measurement service across a full pass of every screen.
- **SC-005**: From a known test set of events, the team can compute median time to first interaction, share of sessions with sound, and the phone-versus-desktop interaction gap, each without any user-level data.
- **SC-006**: In each of the 3 languages, the About text is fully translated, within the existing word limits, and matches the events and fields the app can send (automated check).
- **SC-007**: Service availability and response time are monitored with alerts in place before launch.

## Assumptions

- Q-1 is decided in favor by the request to implement this slice (see Clarifications). The Q-11 legal review remains a pre-launch gate; if it requires a notice or consent, a later change handles it.
- Depends on all tools (waves 001-004), sharing (wave 006) and the About page (slice 027).
- The measurement service is the same-origin Pages Function `/m` plus Workers Analytics Engine (operator decision Q1-A). It needs an Analytics Engine dataset binding configured on the Cloudflare Pages project. Without the binding the Function still answers 204 and stores nothing. Retention is Analytics Engine's fixed 3 months. Dashboards are out of scope; documented SQL queries are enough.
- Time to first interaction is measured from the start of the page load (M-5 "after opening the application").
- Device class is derived once per page load from pointer type and the shorter screen side (600 CSS px threshold), never from a stored or unique value.
- Scope boundary: no individual profiles, no cross-referencing with other sources, no advertising use, no third-party sharing.
