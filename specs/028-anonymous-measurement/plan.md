# Implementation Plan: Anonymous Usage Measurement and Error Reporting

**Branch**: `028-anonymous-measurement` | **Date**: 2026-10-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/028-anonymous-measurement/spec.md`

**Note**: This plan was produced by the `/speckit-plan` command, following its execution workflow.

## Summary

Fifth slice of wave 007 (comfort and launch readiness). It adopts Q-1: the app sends a few
anonymous, cookieless, identifier-free usage events and failure reports to a same-origin
endpoint, and About says exactly what is sent.

- **Usage events** (US1, P1): `tool-opened` (first one per load carries `start: true`),
  `first-interaction` (whole seconds since navigation start, omitted if the page was ever hidden),
  `sound-played`, `link-shared`, `link-opened`, `instrument-changed`. Each carries only tool,
  device class, language and instrument traits (string count, preset id or `custom`, handedness).
- **Never in the way** (US2, P1): in-memory queue, flushed at 10 items / 5 s / page hidden via
  `sendBeacon` (fallback `fetch` keepalive, no credentials, no redirects); every failure swallowed;
  caps of 50 events and 10 reports per load; DNT or GPC ⇒ nothing sent; empty build-time
  endpoint ⇒ nothing sent.
- **Failure reports** (US3, P2): `recordFailure` keeps its console output and also queues a
  report (kind `calculation` | `drawing` | `audio` | `missing-text`, tool or `shell`, view params
  from the link encoder minus instrument/version, instrument incl. frets, app version, sanitized
  message ≤ 200 chars or text key). De-duplicated per load.
- **About** (US4, P2): `about_privacy_not_measured` replaced by four statements (measured,
  errors, never, DNT) inside the existing 220/280-word caps; a unit test ties the About terms to
  the wire enums.
- **Consumption and health** (US5, P3): Cloudflare Pages Function `functions/m.ts` validates with
  the shared allowlist and writes one Workers Analytics Engine data point per item; SQL for
  M-5/M-6/M-7 in `docs/measurement.md`; scheduled GitHub Actions uptime check every 15 minutes.

Approach (from [research.md](./research.md)):

- **Shared allowlist** (R-01, R-03): `src/lib/measure/wire.ts` (Valibot, relative imports only) is
  imported by both the client queue and the Function, so one schema defines what can ever be
  stored. Fixed AE slots (index = type, blobs for enums/text, doubles for numbers).
- **Function** (R-02): `onRequest`: non-POST → 405; body ≤ 16 KB; parse/validate in `try`; one
  `writeDataPoint` per valid item in `try`; always 204 `no-store`; never reads `request.cf` or
  logs. Binding `MEASURE` declared in a new root `wrangler.toml` that the existing
  `wrangler pages deploy build` step picks up.
- **Build setting** (R-05): `__FM_MEASURE_ENDPOINT__` = `''` for `vite dev` and Vitest, `/m` for
  `build` and `build:test`; `scripts/serve-build.mjs` answers `POST /m` with 204 locally.
- **Hooks** (R-08–R-10): one call per existing behavior point — `ToolLayout` (tool opened), tool
  `onactivate` handlers (first interaction), `playback` store (sound / audio failures), `share`
  store (delivered link), `opening.start` (applied link), instrument store panel actions
  (debounced 1 s, compared to traits after startup restore), `language` store's existing
  `takeUnreported` loop (missing text). Calculation vs drawing is told apart by tagging errors
  thrown from display-model derivation (`markCalculation`).
- **Metrics** (R-04): counts weighted by `_sample_interval`; median with
  `quantileExactWeighted`; a TypeScript mirror test proves SC-005 offline.
- **Monitoring** (R-15): `.github/workflows/uptime.yml` + `scripts/uptime-check.mjs` (home + one
  immutable asset, 200 within 2 s, URL from `vars.PRODUCTION_URL`).
- **Budget** (R-16): ≈ +3–4 KB gzip against ≈ 10 KB headroom under the 150 KB cap.

**Assumptions recorded** (spec ambiguity resolved here, alternatives in research):

- "First fretboard interaction" = first position activation (tap/click/Enter/Space) from the
  shared Fretboard; focus moves, scroll and pinch do not count (R-08). Rejected: counting focus
  moves.
- "Link shared" = the cascade delivered a link (sheet resolved, copied, or manual panel shown); a
  cancelled system sheet sends nothing (R-09). Rejected: counting every Share press.
- Errors reaching a boundary that were not tagged as calculation are reported as `drawing`,
  including shell-level `handleError` failures (R-10). Rejected: a fifth `unknown` kind (spec
  lists four).
- The privacy text needs tightening of five existing 027 statements (same claims) to fit the
  unchanged caps (R-14). Rejected: raising the caps (FR-013 forbids).

## Technical Context

**Language/Version**: TypeScript 5.9 (`strict: true`), Svelte 5 runes, SvelteKit 2 with `adapter-static` (prerendered, single bundle, ADR 0002); Cloudflare Pages Functions (Workers runtime) for `functions/m.ts`.

**Primary Dependencies**: existing only — Valibot (shared wire schema, already in the client bundle), Paraglide JS (catalogs), wrangler (dev, already used for deploy). Workers Analytics Engine is a platform binding, not a package. No new runtime or dev dependency (Function types are a local minimal interface, R-02).

**Storage**: none on the device (FR-003: no localStorage key, cookie, sessionStorage or IndexedDB for measurement). Server: Workers Analytics Engine dataset `fretboard_master_measure`, fixed 3-month retention, sole store (FR-018).

**Testing**:
- Vitest node: `wire`, `sanitize`, `traits`, `device`, `queue` (fake timers), `metrics` mirror, `functions/m.ts` with a fake binding, `uptime-check`, About catalog caps and About ↔ wire term test, `viewParams`.
- Vitest jsdom: `measure.svelte.ts` facade rules and store hooks (`playback`, `share`, `opening`, `instrument`, `language`), `failure.ts`, `PrivacyPolicy`.
- Playwright: new `e2e/measurement.spec.ts` (US1–US3 with `page.route('**/m')`, DNT/GPC, service down), extended `privacy.spec.ts`, `about.spec.ts`, `perf.spec.ts` (with `/m` aborted). Local runs on `desktop` only; CI runs the full matrix.

**Target Platform**: evergreen browsers (last two majors), desktop and mobile, 320–2560 CSS px; Cloudflare Pages edge for `/m`; GitHub Actions for monitoring.

**Project Type**: static single-page web app (SvelteKit, Cloudflare Pages) plus one same-origin Pages Function.

**Performance Goals**: facade calls are O(1) array pushes on the interaction path (no DOM read, no await); serialization and send happen on timer or page-hide only. All Principle VI budgets unchanged with `/m` healthy or down (SC-002).

**Constraints**:
- CSP unchanged (`connect-src 'self'`), no new origin, no third party (FR-014).
- Initial JS ≤ 150 KB gzip (≈ 139–140 KB after 027).
- Body ≤ 16 KB, ≤ 10 items per batch; ≤ 50 events, ≤ 10 reports per page load.
- Privacy text ≤ 220 words (en), ≤ 280 (pt-BR, es), no legal jargon, `about_privacy_no_ads` unchanged.
- Messages ≤ 200 chars with URLs masked; no stack traces.
- Empty `catch` only for the measurement send paths, each with the required comment.

**Scale/Scope**: ~12 new source files (7 in `src/lib/measure/`, `functions/m.ts`, `wrangler.toml`, `scripts/uptime-check.mjs`, `.github/workflows/uptime.yml`, `docs/measurement.md`), ~14 edited files, ~10 new/edited unit test files, 1 new and 3 edited e2e specs, 4 new + 5 reworded catalog keys × 3 languages, ADR 0027. Expected traffic is small; AE sampling only matters at high volume and is handled by weighted queries.

No open unknowns remain; every technical question is resolved in research R-01–R-17.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution v1.11.0. Pre-design result: **PASS** with one recorded exception (Principle II server
role, see Complexity Tracking). Post-design re-check: **PASS**, no new violations.

**I. Musical Correctness**
- [x] N/A — no theory, spelling, shape or pitch code changes; measurement reads the instrument config but never computes notes. Theory suites untouched.

**II. On-Device, Static, Private by Design**
- [x] All calculation, rendering and sound stay in the browser; `/m` only receives anonymous counts (exception recorded in Complexity Tracking: the Function is the measurement service Principle II allows "if Q-1 adopts it").
- [x] No feature depends on the network: send failures are swallowed; offline drops silently (US2, edge case "offline").
- [x] No accounts, identifiers or personal data: wire allowlist has no id field; Function never writes IP, UA, `request.cf`, Ray ID or headers (FR-003, FR-017).
- [x] No third-party trackers or executable content: same-origin `/m` only, CSP unchanged (FR-014).
- [x] No device permissions requested; 027 permission spies keep passing (FR-015).
- [x] Preferences unchanged; measurement writes nothing to storage.
- [x] Measurement is cookieless, aggregate (AE counts), no persistent identifier, fails silently, and honors DNT/GPC.

**III. Pure Core, Thin Shell**
- [x] `src/lib/theory` untouched; new `wire.ts`, `sanitize.ts`, `traits.ts`, `queue.ts`, `device.ts` core are pure with injected deps; lint block keeps `wire.ts`/`sanitize.ts` free of `$lib`, Svelte and `$app`.
- [x] One-way data flow unchanged: hooks observe store actions, never feed back into view state.
- [x] Fretboard still reports `(string, fret)`; the first-interaction hook lives in tool `onactivate` handlers, not in `src/lib/fretboard` (lint boundary respected).
- [x] View state stays outside components; reports read it through `currentSnapshot` + `viewParams`.

**IV. Test-First for Logic, Tested Behavior for UI**
- [x] Pure modules (`wire`, `sanitize`, `queue`, `traits`, `device`, `viewParams`, Function handler) are built test-first; task order in `tasks.md` will put each test before its module.
- [x] Every acceptance scenario US1-1…US5-3 maps to a test in [quickstart.md](./quickstart.md) (FR-016).
- [x] Deterministic: queue/facade use injected timers and clock (`useMeasureForTests`), Function uses a fake binding, e2e uses `page.route`; no real-time waits beyond Playwright auto-wait.
- [x] TM-9 fixtures unaffected (no visual change outside About text).

**V. Accessible by Default**
- [x] Only About text changes (list items in an existing `ul`); no new control, focus or motion. axe run on About in `about.spec.ts` stays at zero violations.

**VI. Performance Budgets Are Gates**
- [x] Interaction path cost is an array push; send deferred to timer/page-hide; perf spec re-run with `/m` aborted (SC-002).
- [x] Initial JS ≈ +3–4 KB gzip, staying under 150 KB; no budget raise needed; bundle-size check unchanged.
- [x] Lighthouse: `serve-build.mjs` answers `POST /m` 204 so no failed-request noise; no blocking work at load.

**VII. Design System Fidelity**
- [x] No visual change: measurement shows no notice, banner or UI (US2); About uses existing list styling and tokens.
- [x] No modal, consent banner, or error red introduced.

**VIII. International From the First Line**
- [x] Four new and five reworded keys in en, pt-BR, es; completeness, caps and jargon enforced by the catalog test.
- [x] Missing-text reporting reuses the existing once-per-locale-and-key detection; adding a language still needs only catalog files (the `Language` enum in `wire.ts` is guarded by a test against `LANGUAGES`, and is the one place a new tag must be added for measurement — recorded in ADR 0027).

**IX. Untrusted Input, Versioned Formats**
- [x] The Function treats every body as untrusted: size cap, safe parse, allowlist schema, invalid items dropped, never throws (always 204).
- [x] Batch carries a format version `v: 1`.
- [x] Link format and fixtures unchanged; `viewParams` reuses the encoder's tokens without altering links. Link-opened only when a link opened a view.
- [x] Nothing input-derived is rendered or executed.

**X. Simplicity and Incremental Delivery**
- [x] Follows wave 007 order (breakdown `007-comfort-and-launch-readiness/005`), shippable on its own.
- [x] No speculative abstraction: one queue, one transport, one Function; `wire.ts` has two real users (client and Function).
- [x] No new dependency (Valibot reused; Function types local).
- [x] Failures keep their existing fallback views; reporting never changes what the user sees (FR-010).

**Technology Stack and Constraints**
- [x] TypeScript strict, no `any`; Valibot for the untrusted body; hosting stays Cloudflare Pages (Functions are part of Pages, ADR 0001); CI stays GitHub Actions with mise. Pages Functions use is recorded in ADR 0027 (architecturally significant, not a stack replacement).

**Development Workflow and Quality Gates**
- [x] Conventional Commits, PR to `main`, preview deploy (Functions deploy with previews; previews write to the same dataset — accepted, documented in ADR 0027; queries can filter by nothing user-level, so preview traffic is minor noise).
- [x] Empty `catch` only in measurement send paths and the Function's write/parse, each commented as the constitution requires.
- [x] ADR `docs/adr/0027-anonymous-measurement-pages-function.md` records the Function, binding, `wrangler.toml` source-of-truth effect and data point layout.
- [x] Pre-launch gate Q-11 legal review remains open; this slice adds no consent flow (spec Assumptions).

## Project Structure

### Documentation (this feature)

```text
specs/028-anonymous-measurement/
├── plan.md              # This file
├── research.md          # Phase 0: R-01 … R-17
├── data-model.md        # Phase 1: events, reports, page-load state, queue, AE point
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── measurement-wire.md   # POST /m, batch/item allowlist, AE slots, server table, SQL shape
│   ├── client-api.md         # build setting, pure modules, facade, call-site changes
│   ├── ui-about.md           # privacy catalog keys, order, caps, About ↔ wire test
│   └── monitoring.md         # uptime workflow and script
├── checklists/          # from /speckit.specify
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
functions/                         # NEW (Cloudflare Pages Functions root)
└── m.ts                           # POST /m → Analytics Engine

wrangler.toml                      # NEW: pages_build_output_dir + MEASURE binding

src/
├── app.d.ts                       # + __FM_MEASURE_ENDPOINT__
├── hooks.client.ts                # + measure.start()
├── lib/
│   ├── measure/                   # NEW
│   │   ├── wire.ts                # shared allowlist (relative imports + valibot only)
│   │   ├── sanitize.ts
│   │   ├── traits.ts
│   │   ├── device.ts
│   │   ├── queue.ts
│   │   ├── transport.ts
│   │   └── measure.svelte.ts      # facade + test seams
│   ├── link/encode.ts             # + viewParams
│   ├── shell/
│   │   ├── failure.ts             # recordFailure(kind?) → measure.report; markCalculation
│   │   ├── fault.ts               # maybeFault(tool, phase?)
│   │   ├── ToolLayout.svelte      # toolOpened
│   │   └── PrivacyPolicy.svelte   # new statements
│   ├── state/
│   │   ├── playback.svelte.ts     # soundPlayed, audio reports
│   │   ├── share.svelte.ts        # linkShared
│   │   ├── opening.svelte.ts      # linkOpened
│   │   ├── instrument.svelte.ts   # instrumentEdited (panel actions)
│   │   └── language.svelte.ts     # missingText
│   └── tools/{notes,triads,caged}/*Tool.svelte   # firstInteraction, markCalculation
messages/{en,pt-BR,es}.json        # privacy keys
vite.config.ts                     # endpoint define
eslint.config.js                   # measure boundary block, functions/** linted
scripts/
├── serve-build.mjs                # POST /m → 204
└── uptime-check.mjs               # NEW
.github/workflows/uptime.yml       # NEW
docs/
├── measurement.md                 # NEW: SQL for M-5/M-6/M-7, retention, fields
└── adr/0027-anonymous-measurement-pages-function.md   # NEW

tests/unit/
├── measure/                       # NEW: wire, sanitize, traits, device, queue, measure, metrics, about-matches-wire
├── functions/m.test.ts            # NEW
├── uptime-check.test.ts           # NEW
├── link/                          # + viewParams cases
├── failure.test.ts, privacy-policy.test.ts, language-store.test.ts, i18n/about-catalog.test.ts   # edited
e2e/
├── measurement.spec.ts            # NEW
├── privacy.spec.ts, about.spec.ts, perf.spec.ts   # edited
```

**Structure Decision**: single SvelteKit project, as in every earlier slice. Client code goes in
the existing `src/lib/` tree under a new `src/lib/measure/` folder (alongside the existing
`src/lib/{shell,state,link,i18n}` it hooks into); tests follow the existing `tests/unit/` and
`e2e/` layout. The only new top-level directory is `functions/`, which Cloudflare Pages requires
at the project root for Functions; it holds one file and imports the shared allowlist from
`src/lib/measure/wire.ts`. No separate backend project is created.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Principle II bullet 1 ("server's only role is delivering static assets"): a Pages Function `functions/m.ts` runs server-side | Q-1 adopted (spec Clarifications); Principle II itself names the anonymous-measurement service as the one exception; operator chose same-origin Function + Analytics Engine (Q1-A) | Third-party analytics would add an origin, a company and CSP changes (violates bullets 4 and FR-014); client-only measurement cannot aggregate anything |
| `wrangler.toml` becomes the source of truth for Pages project settings | Keeps the AE binding reviewable and identical across preview/production | Dashboard-only binding is invisible to review and drifts; no other dashboard settings exist to lose |
| Enum lists duplicated in `wire.ts` (tunings, handedness, languages) | Function bundling cannot resolve `$lib`; the shared schema must use relative imports only | Importing app modules into the Function pulls the `$lib` graph; an equality unit test prevents drift |
