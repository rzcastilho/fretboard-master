# Research: Anonymous Usage Measurement and Error Reporting

**Feature**: `028-anonymous-measurement` | **Date**: 2026-10-07 | **Plan**: [plan.md](./plan.md)

The spec's Clarifications already settle the product questions (destination, session unit, caps,
DNT/GPC, retention). This file resolves the remaining technical unknowns found while filling the
plan's Technical Context. Each entry: Decision, Rationale, Alternatives considered.

Codebase facts this research relies on (read during planning):

- `svelte.config.js`: CSP `connect-src 'self'`; `adapter-static`, single bundle (ADR 0002).
- `src/lib/shell/failure.ts`: `recordFailure(tool, error)` is console-only; called from
  `src/hooks.client.ts` (`handleError`), `src/routes/+layout.svelte` (shell boundary) and
  `src/lib/shell/ToolLayout.svelte` (tool boundary).
- `src/lib/state/language.svelte.ts` warns once per locale and key through `takeUnreported`
  (`src/lib/i18n/gaps.ts`), fed by the build-time `__FM_MISSING_TEXT__` define.
- `src/lib/state/opening.svelte.ts`: `opening.start(href)` applies a received link before
  hydration; `kind: 'none' | 'unknown-tool' | snapshot`.
- `src/lib/state/share.svelte.ts`: `share.share(tool, title)` runs sheet → clipboard → manual
  panel; `currentSnapshot(tool)` returns the `ShareSnapshot`.
- `src/lib/state/playback.svelte.ts`: `note | chord | sequence | timeline` are the only entry
  points that start sound.
- `src/lib/fretboard/Fretboard.svelte` reports activations through `onactivate(position)`.
- `.github/workflows/ci.yml` deploys with `pnpm exec wrangler pages deploy build` from the repo
  root (wrangler already a dev dependency). `lighthouserc.cjs` and Playwright serve the build
  with `scripts/serve-build.mjs`.
- `tests/unit/i18n/about-catalog.test.ts` caps the privacy statements at 220 (en) / 280
  (pt-BR, es) words; the current English total is 197.

---

## R-01 Where the measurement code lives and the boundary rules

**Decision**: a new pure-first module folder `src/lib/measure/`:

| File | Role | Purity |
|---|---|---|
| `wire.ts` | Allowlist Valibot schema for one item and for a batch, field enums, limits. Shared by client and the `/m` Function | Pure, **relative imports and `valibot` only** (no `$lib`, no Svelte, no DOM) |
| `sanitize.ts` | `sanitizeMessage` (URL masking + 200-char cut), report de-dup key | Pure, relative imports only |
| `traits.ts` | `traitsOf(config)` and `instrumentOf(config)` → wire shapes | Pure |
| `device.ts` | `deviceClass({ coarse, shortSide })` pure + `readDeviceClass()` DOM reader | Pure core + thin reader |
| `queue.ts` | In-memory batcher: caps, de-dup, flush rules; injected clock and transport | Pure (deps injected) |
| `transport.ts` | `sendBeacon` → `fetch(keepalive)` sender; DNT/GPC reader | DOM, swallow-all |
| `measure.svelte.ts` | App-facing facade (`measure.toolOpened` etc.), page-load state, wiring to stores | Shell glue |

An ESLint `no-restricted-imports` block for `src/lib/measure/wire.ts` and `sanitize.ts` forbids
`$lib/*`, `svelte*` and `$app/*` (so the Function can bundle them), mirroring the existing
`src/lib/i18n/**` block that keeps `gaps.ts` importable from `vite.config.ts`.

**Rationale**: Principle III (pure core, thin shell) and the spec's "same allowlist schema the
client uses, a shared module in `src/lib`". Wrangler's esbuild bundler for Pages Functions does
not know the SvelteKit `$lib` alias, so the shared files must use relative imports.

**Alternatives considered**: put the schema in `functions/` and import it from the client
(rejected: client code reaching outside `src/` breaks the SvelteKit source layout); duplicate the
schema (rejected: two allowlists drift, and FR-017 asks for the same one); configure a `$lib`
alias for wrangler (rejected: extra build config for one import).

## R-02 The `/m` endpoint: Cloudflare Pages Function + Workers Analytics Engine

**Decision**: `functions/m.ts` at the repo root exporting `onRequest` (any method; non-POST →
405). The handler reads `content-length` and the body text with a 16 KB cap, `JSON.parse`s inside
`try`, validates with `wire.ts`, and calls `env.MEASURE.writeDataPoint(...)` once per valid item
inside `try`. Always `204` with `Cache-Control: no-store`. It never reads `request.cf`, headers
other than `content-length`/`content-type`, and never calls `console.*`. The Analytics Engine
binding is declared in a new root `wrangler.toml`:

```toml
name = "fretboard-master"
pages_build_output_dir = "build"
compatibility_date = "2026-10-01"

[[analytics_engine_datasets]]
binding = "MEASURE"
dataset = "fretboard_master_measure"
```

The existing deploy step (`wrangler pages deploy build` from the repo root) picks up `functions/`
automatically; no CI change is needed for deploy.

Types: the Function declares a minimal local interface
(`interface MeasureEnv { MEASURE?: { writeDataPoint(p: DataPoint): void } }`) instead of adding
`@cloudflare/workers-types`.

**Rationale**: operator decision Q1-A in the spec. Same origin keeps CSP `connect-src 'self'`,
no new company (ADR 0001 host), and the About "no content from other companies" claim stays
true. `wrangler.toml` makes the binding reviewable in the repo instead of dashboard-only.
A body-size cap before parse bounds work per request.

**Alternatives considered**: dashboard-only binding (rejected: invisible config, previews drift);
a separate Worker on a subdomain (rejected: new origin, CSP change); `@cloudflare/workers-types`
(rejected: a ~1 MB dev dependency for one method signature; Principle X).

**Risk recorded**: once `wrangler.toml` with `pages_build_output_dir` exists, Cloudflare treats it
as the source of truth for Pages settings and the dashboard's binding/env settings become
read-only. The project has no other dashboard bindings today; ADR 0027 states this.

## R-03 Analytics Engine data point layout

**Decision** (full table in [contracts/measurement-wire.md](./contracts/measurement-wire.md)):

- `indexes: [type]` — the event name or failure kind (sampling key, ≤ 96 bytes).
- Blobs: `blob1` record (`event`|`report`), `blob2` type, `blob3` tool, `blob4` device,
  `blob5` language, `blob6` tuning (preset id or `custom`), `blob7` handedness, then for reports
  `blob8` app version, `blob9` error name, `blob10` sanitized message or text key, `blob11`
  view state as compact JSON (keys sorted).
- Doubles: `double1` string count, `double2` sessionStart (1/0), `double3` seconds to first
  interaction (−1 when absent), `double4` fret count (reports; 0 for events).

**Rationale**: AE allows 20 blobs, 20 doubles, 1 index; fixed positions make the SQL in
`docs/measurement.md` stable. Indexing by type keeps sampling balanced per event type, which is
what the ratios need.

**Alternatives considered**: one JSON blob per item (rejected: SQL cannot filter by field without
string parsing); index by tool (rejected: low-volume event types would be sampled with the
high-volume ones).

## R-04 M-5 / M-6 / M-7 queries under sampling

**Decision**: every count uses `SUM(_sample_interval)`; the median uses
`quantileExactWeighted(0.5)(double3, _sample_interval)` over `blob2 = 'first-interaction' AND
double3 >= 0`. Sessions = weighted count of `tool-opened` with `double2 = 1`. M-6 = weighted
`sound-played` ÷ sessions. M-7 = per `blob4` weighted `first-interaction` ÷ sessions, phone vs
desktop difference in percentage points. Queries live in `docs/measurement.md`; a unit test
(`tests/unit/measure/metrics.test.ts`) computes the same three numbers in TypeScript from a known
item set built with the client builders, so SC-005 is proven without a Cloudflare account.

**Rationale**: AE samples at volume and exposes `_sample_interval` for unbiased totals. Each
once-per-load event equals one session at most, so the ratios need no join (FR-011).

**Alternatives considered**: `COUNT()` (rejected: biased under sampling); storing a session id to
join (rejected: forbidden persistent/linking identifier, FR-003).

## R-05 Endpoint as a build-time setting

**Decision**: new define `__FM_MEASURE_ENDPOINT__` in `vite.config.ts`:

```
process.env.VITEST || mode === 'development' → ''
otherwise → process.env.FM_MEASURE_ENDPOINT ?? '/m'
```

So `pnpm build` (production) and `pnpm build:test` (e2e) both use `/m`; `vite dev` and every
Vitest run send nothing; any build can opt out with `FM_MEASURE_ENDPOINT=`. `scripts/serve-build.mjs`
gains one route: `POST /m` → `204` with no body, mirroring the Function locally so Lighthouse and
unstubbed e2e runs see no 404 console noise. Playwright specs that inspect payloads use
`page.route('**/m', ...)` to capture and fulfil with 204, or to abort/500 for US2.

**Rationale**: FR-005a. Vitest runs with `mode === 'test'`, the same mode as `build:test`, so the
`VITEST` env var is the reliable discriminator. Pointing e2e at the real path also exercises the
production path shape.

**Alternatives considered**: a dedicated `/__test-measure` path for e2e (rejected: the spec allows
it, but `/m` with `page.route` is simpler and keeps one path in the privacy allowlist);
runtime config (rejected: adapter-static has no server env).

## R-06 Sending: batching, `sendBeacon`, `fetch` fallback, never in the way

**Decision**: `queue.ts` holds items in an array with counters `events` (≤ 50) and `reports`
(≤ 10) per page load and a `Set` of report de-dup keys. Flush when 10 items are queued, when a
5 s timer (started by the first queued item) fires, or on `visibilitychange` → hidden and
`pagehide`. Transport: `navigator.sendBeacon(endpoint, new Blob([json], { type: 'text/plain' }))`
(text/plain keeps the beacon a CORS-simple request; same origin anyway). If `sendBeacon` is
missing or returns `false`, `fetch(endpoint, { method: 'POST', body: json, keepalive: true,
credentials: 'omit', redirect: 'error', cache: 'no-store', headers: { 'content-type':
'text/plain' } })` with `.then(noop, noop)`. Every call is in `try { } catch { /* fire-and-forget
measurement write (constitution: empty catch allowed) */ }`. Timers use `setTimeout`; no work
runs in the input handler path beyond an array push (measured by the existing perf spec).
Batch body: `{ "v": 1, "items": [...] }`; one batch ≤ 10 items, far below 16 KB.

`sendBeacon` cannot set `credentials` or `redirect`; it sends cookies for the origin, but the app
sets no cookie (027 privacy test) and the Function never sets one, so nothing is attached. The
Function never redirects.

**Rationale**: FR-004 and US2. `sendBeacon` is the only API that reliably survives page unload;
`keepalive` fetch is the standard fallback. Text/plain avoids a preflight on any browser quirk.

**Alternatives considered**: `requestIdleCallback` scheduling (rejected: unsupported in Safari,
adds nothing for an array push); IndexedDB retry queue (rejected: FR-003 "nothing stored on the
device" and offline drop is specified).

## R-07 Page load, session start, bfcache

**Decision**: all per-load state is module state in `measure.svelte.ts` (created once per JS
realm). A bfcache restore keeps the realm, so once-per-load flags survive by construction; no
`pageshow` handler resets anything. `sessionStart: true` is set on the first `tool-opened` sent
in the realm. Home/About alone never call `toolOpened`, so they send nothing.

**Rationale**: spec clarification "a back/forward-cache restore is the same page load". Zero
code is the simplest correct implementation.

**Alternatives considered**: `sessionStorage` flag (rejected: FR-003 nothing stored).

## R-08 Time to first interaction and "hidden before interaction"

**Decision**: seconds = `Math.min(3600, Math.floor(performance.now() / 1000))` at the first
fretboard activation (`performance.now()` is relative to `timeOrigin`, the navigation start).
A `hiddenSeen` flag starts as `document.visibilityState === 'hidden'` at facade start and is set
by any `visibilitychange` to hidden; if set, `seconds` is omitted. "First fretboard interaction"
= the first `onactivate` from the shared Fretboard (tap, click, Enter/Space on a position) in any
tool; arrow-key focus moves, scrolling and pinch are not interactions. The facade is called from
each tool's existing `onactivate` handler (Notes, Triads, CAGED), not from `Fretboard.svelte`,
because `src/lib/fretboard/**` must not import state (lint boundary).

**Rationale**: M-5 "after opening the application"; an activation is the unambiguous "used the
fretboard" signal; `performance.now()` avoids `Date` clock skew.

**Alternatives considered**: measure from hydration (rejected: M-5 says after opening);
count focus moves (rejected: keyboard users tab through the board without "using" it).

## R-09 Sound played, link shared, link opened, instrument changed: hook points

**Decision**:

- **sound-played**: in `playback.svelte.ts`, after `note | chord | sequence | timeline` schedules
  at least one mark while not muted, call `measure.soundPlayed()`; the facade sends once per page
  load, tagged with the last opened tool.
- **link-shared**: in `share.svelte.ts` `run`, after the cascade *delivers* a link (system sheet
  resolved, clipboard write resolved, or manual-copy panel shown). A system sheet the user
  cancels (`AbortError`) sends nothing. Payload: tool of the shared view only.
- **link-opened**: in `opening.start`, after a snapshot was applied (`s.tool` known), including
  incomplete links with fallbacks; not in the `unknown-tool` or `catch` branches (FR-005,
  constitution IX). Recorded before hydration into the in-memory queue.
- **instrument-changed**: the instrument store's panel-action methods (those called only by
  `InstrumentPanel.svelte`: string count, tuning preset, custom tuning steps, frets, handedness,
  orientation) call `measure.instrumentEdited()`, which restarts a 1 s timer; on expiry it compares
  `traitsOf(instrument.active)` to the last traits sent/seen and sends only when they differ.
  Baseline traits are captured at facade start, i.e. after `preferences.start()` and
  `opening.start()`, so restore and received links never count. `receive`, `restore`, `useMine`
  do not call it.

**Rationale**: each hook sits at the single place the behavior already happens, so tests can
drive them through existing store seams (`resetPlaybackForTests`, `useSharePlatformForTests`,
`resetOpeningForTests`).

**Alternatives considered**: a generic store-change observer (rejected: cannot tell user action
from restore); hooking component click handlers (rejected: duplicates across three tools).

## R-10 Failure kinds and reports

**Decision**: extend `recordFailure(tool, error, kind?)` in `src/lib/shell/failure.ts`; it still
logs to the console exactly as today (FR-010) and additionally calls `measure.report(...)`.
Kind resolution:

- `audio`: playback/engine failures already caught in `playback.svelte.ts` (unlock/start
  failures behind the "sound unavailable" notice) call `recordFailure(tool, e, 'audio')`.
- `calculation`: each tool's display-model derivation is wrapped by `markCalculation(fn)` in
  `failure.ts`, which rethrows the same error after adding it to a module `WeakSet`. The boundary's
  `recordFailure` sees the mark → `calculation`.
- `drawing`: any other error reaching a `<svelte:boundary>` or `handleError`.
- `missing-text`: `language.svelte.ts` calls `measure.missingText(key)` inside the existing
  `takeUnreported` loop, so the once-per-locale-and-key rule is reused unchanged.

Tool is the boundary's `tool`, or `shell` when `null`. The report's view state comes from
`viewStateOf(tool)` (R-11); instrument from `instrumentOf(instrument.active)`; app version from
`__APP_VERSION__`. Message: `sanitizeMessage(error.message)` — replace
`/https?:\/\/\S+/g` and `/(?:^|\s)\/[^\s?#]*[?#]\S*/g` with `<url>`, then cut to 200 chars. No
stack. The 500-char `MAX_MESSAGE` path for non-`Error` values goes through the same sanitizer.
Fault injection (ADR 0004): `maybeFault` gains an optional second argument
(`'calculation' | 'drawing'`) so e2e can force each kind; the `audio` kind reuses the existing
audio-failure seam used by `playback.spec.ts`.

**Rationale**: SC-003 needs exactly one report per forced failure kind; tagging at the source is
cheaper and more accurate than parsing stacks.

**Alternatives considered**: classify by stack frames (rejected: no stack may leave the device,
and minified names are unreliable); a fifth `unknown` kind (rejected: spec enumerates four).

## R-11 View state in reports without any part of the address

**Decision**: export a pure `viewParams(snapshot): Record<string, string>` from
`src/lib/link/encode.ts` that returns only the **view** parameters of `PARAM_ORDER[tool]` (the
validated enumerated tokens already produced for links) and never the instrument parameters
(`sc`, `tu`, `fr` — `tu` can hold custom offsets), the version `v`, the origin or the path.
Example for Triads: `{ rt, sp, q, inv, ss, vw, oc, cmp, cq, lb }`. Reports carry it as an object. The wire schema bounds it:
≤ 24 keys, key `^[a-z][a-z0-9]{0,15}$`, value `^[A-Za-z0-9.\-_]{0,48}$`.

**Rationale**: FR-008 "structured object of the share-link schema's validated enumerated
fields"; reusing the encoder's tokens means the team can reproduce a view by pasting the params
into a link locally, and the encoder's existing fixtures guard the tokens.

**Alternatives considered**: send `ShareSnapshot.view` as-is (rejected: nested objects and
theory types harder to bound server-side); send the encoded link minus origin (rejected:
forbidden, it *is* part of the address).

## R-12 Device class

**Decision**: `deviceClass({ coarse, shortSide })` → `phone` if coarse && shortSide < 600,
`tablet` if coarse && ≥ 600, else `desktop`; reader uses `matchMedia('(pointer: coarse)')` and
`Math.min(screen.width, screen.height)`. Computed once at facade start, memoized for the load.

**Rationale**: spec clarification; `screen` (not viewport) keeps it stable across rotation and
split views.

**Alternatives considered**: user-agent parsing (rejected: fingerprinting-adjacent, brittle).

## R-13 DNT / GPC

**Decision**: `trackingRefused()` = `navigator.globalPrivacyControl === true ||
navigator.doNotTrack === '1' || (window as { doNotTrack?: string }).doNotTrack === '1'`,
read once at facade start. When true the facade is inert: no queue, no timers, no listeners.
Console logging of failures is unchanged.

**Rationale**: FR-006, SC-004. Reading once is enough; the signals are per-browser settings.

**Alternatives considered**: honoring only GPC (rejected: spec names both).

## R-14 About text inside the word caps

**Decision**: replace `about_privacy_not_measured` with four keys — `about_privacy_measured`,
`about_privacy_errors`, `about_privacy_never`, `about_privacy_dnt` — and tighten
`about_privacy_stored`, `about_privacy_erase`, `about_privacy_hosting`,
`about_privacy_share_links`, `about_privacy_all_ages` without dropping a claim, keeping
`about_privacy_no_ads` byte-identical. A worked English draft (in
[contracts/ui-about.md](./contracts/ui-about.md)) totals 220 words against the 220 cap. pt-BR
and es currently run 1.02×/1.10× the English count, leaving room under 280. The catalog test's
`STATEMENTS` list becomes the twelve keys; a new unit test
(`tests/unit/measure/about-matches-wire.test.ts`) asserts the six event names and four trait
kinds named in a fixed per-locale term map appear in `about_privacy_measured`, and that the
term map's events/traits equal the `wire.ts` enums (FR-016, SC-006).

**Rationale**: the current text is 197 of 220 English words; adding ~80 words of required
disclosure forces trimming elsewhere. The caps are spec requirements (FR-013), so they are not
raised.

**Alternatives considered**: raise the caps (rejected: FR-013 keeps 027's limits); one long
measurement statement (rejected: per-claim keys make each requirement testable per language,
the 027 pattern).

## R-15 Delivery monitoring (NFR-8.2)

**Decision**: new `.github/workflows/uptime.yml`: `on: schedule: - cron: '*/15 * * * *'` plus
`workflow_dispatch`; one job with no checkout of dependencies beyond the repo, running
`node scripts/uptime-check.mjs "$PROD_URL"` where `PROD_URL: ${{ vars.PRODUCTION_URL }}`. The
script fetches `/` (expects 200), extracts the first `/_app/immutable/...` asset URL from the
HTML, fetches it (expects 200), and fails (exit 1) when either status ≠ 200 or either request
takes > 2000 ms (`AbortSignal.timeout(2000)`). It is pure Node 22 `fetch`, no dependency, and
unit-tested with an injected fetch (`tests/unit/uptime-check.test.ts`), like the existing
`deploy-availability-probe` test. A failed scheduled run notifies through GitHub's standard
workflow-failure email. Missing `vars.PRODUCTION_URL` → the job prints a notice and exits 0, so
forks stay green.

**Rationale**: FR-012, SC-007; reuses mandated CI and Node from mise (setup through
`jdx/mise-action` to keep the constitution's tool-installation rule).

**Alternatives considered**: third-party uptime service (rejected by spec); Cloudflare health
checks (rejected: paid plan feature and dashboard-only config).

## R-16 Bundle and performance budget

**Decision**: estimated +3–4 KB gzip in the initial bundle (facade, queue, wire schema reuse of
the already-bundled Valibot, sanitizer, catalog text). Budget after 027 ≈ 139–140 KB of 150 KB.
The perf spec (`e2e/perf.spec.ts`) runs unchanged with `/m` aborted to prove SC-002. The Function
is not part of the client bundle.

**Rationale**: Principle VI gate; ADR 0002 single bundle means no lazy chunk.

**Alternatives considered**: hand-written validator instead of Valibot on the client to save
bytes (rejected: Valibot is already in the bundle, so the marginal cost is the schema only).

## R-17 Privacy test updates (FR-015)

**Decision**: `e2e/privacy.spec.ts` keeps every existing assertion; its "same-origin only" check
additionally asserts that every same-origin non-GET request is `POST /m`. A new
`e2e/measurement.spec.ts` covers US1/US2/US3 flows with `page.route('**/m')` capture, DNT/GPC via
`addInitScript` (`Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true })`
and a second case for `doNotTrack`), and failure modes (abort, 500, 30 s delay, redirect).

**Rationale**: FR-015, FR-016, SC-001, SC-002, SC-004.

**Alternatives considered**: assert on the server side only (rejected: client-side payload is the
privacy contract).
