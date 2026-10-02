# Phase 0 Research: Walking Skeleton — Home Screen and Navigation

**Feature**: `001-walking-skeleton` | **Date**: 2026-09-30 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

The constitution fixes most of the stack (TypeScript strict, Svelte 5 + SvelteKit `adapter-static`,
Vite, Paraglide JS, plain CSS tokens, Vitest, Playwright + axe, Lighthouse CI, ESLint/Prettier,
mise + pnpm, GitHub Actions, Cloudflare Pages). Research therefore resolves *how* the slice's
requirements are met inside that stack, not *which* stack. Each item: Decision / Rationale /
Alternatives considered.

---

## R-01 Toolchain versions and installation

- **Decision**: `mise.toml` at the repo root pins **exact** versions of Node 24 (Active LTS in
  2026-09) and pnpm 10, written as full `major.minor.patch` strings (e.g. `node = "24.x.y"`,
  `pnpm = "10.x.y"`, resolved with `mise latest node@24` / `mise latest pnpm@10` at implementation
  time). A bare major (`"24"`) is not allowed: it would resolve to whatever patch is newest on each
  machine and CI run. Upgrades are explicit commits that edit the pinned strings. App packages (svelte 5, @sveltejs/kit 2, vite, @inlang/paraglide-js 2, valibot is
  **not** added yet, vitest, @playwright/test, @axe-core/playwright, @lhci/cli, eslint,
  prettier, svelte-check, wrangler) live in `package.json` with `pnpm-lock.yaml` committed. CI
  uses `jdx/mise-action` with the same file.
- **Rationale**: Constitution "Tool installation" rule; identical local/CI toolchain. Wrangler is a
  devDependency so it ships in `node_modules` and needs no separate mise entry.
- **Alternatives considered**: Node 22 (maintenance LTS by now, shorter runway); corepack
  (explicitly not supported by constitution); global wrangler (would need a mise entry, more
  moving parts).

## R-02 Prerendered static delivery with real structure (FR-009, D-07)

- **Decision**: `@sveltejs/adapter-static` with `export const prerender = true` and
  `export const trailingSlash = 'never'` in `src/routes/+layout.ts`. Routes `/`, `/notes`,
  `/triads`, `/about` prerender to `index.html`, `notes.html`, `triads.html`, `about.html`. Cards
  and navigation are plain `<a href>` elements, so they work as full page loads without JS.
  No `+page.ts` load functions exist, so client navigation fetches no `__data.json`.
- **Rationale**: Mandated stack; prerendered HTML is the simplest way to be "never blank" and to
  hit TTI ≤ 3 s. Cloudflare Pages serves `/triads` from `triads.html` and redirects `/triads/` to
  `/triads` (308), satisfying "trailing slash opens the same screen" (FR-022).
- **Alternatives considered**: `trailingSlash: 'always'` (directory-style URLs — conflicts with the
  spec's canonical `/triads`); SPA-only fallback (blank until JS runs — violates D-07).

## R-03 Unknown addresses: home with notice, 404 status, URL replaced (FR-010, FR-022, D-01)

- **Decision**: A catch-all route `src/routes/[...unknown]/+page.svelte` renders the shared
  `HomeScreen` component with the "not found" notice. Its `+page.ts` sets `prerender = true` and
  `entries = () => [{ unknown: '__not-found' }]`, producing `build/__not-found.html`. A
  post-build script (`scripts/make-404.mjs`) moves it to `build/404.html`. Cloudflare Pages serves
  a top-level `404.html` with HTTP **404** for any path with no matching asset (including
  `/caged`, `/triads/x`). On hydration, the catch-all page calls SvelteKit shallow
  `replaceState('/', {})` from `$app/navigation`, so the address shows `/` with no new history
  entry, while the notice stays rendered. Client-side, SvelteKit's router also matches unknown
  paths to the catch-all, so in-app behavior is identical.
- **Case variants** (`/Triads`): SvelteKit route matching is case-sensitive, so on the client
  `/Triads` hits the catch-all. Hosting lookup is verified by the preview-deployment smoke test
  (quickstart §6); if the host were to serve `triads.html` for `/Triads`, hydration would still
  route to the catch-all, showing home-with-notice. The smoke test asserts the visible outcome.
- **Rationale**: Gives a non-blank 404 page even without JS, correct HTTP status, and keeps the
  four known addresses as the only addressable screens (`/__not-found` does not survive the
  rename).
- **Alternatives considered**: `adapter-static` `fallback: '404.html'` (an empty shell — blank
  without JS, and hydrates to the root error page); `goto('/', { replaceState: true })` plus a
  notice store (renders the real home, but the prerendered 404 HTML would still need the
  home+notice markup — duplicates the path); a client redirect to `/?notice=not-found` (leaves
  state in the URL; reload re-shows a stale notice, which D-01 forbids).

## R-04 Version continuity and zero-downtime publishing (FR-016, D-12, SC-007)

- **Decision**:
  1. `kit.output.bundleStrategy = 'single'` — one JS file and one CSS file per build, so client
     navigation among the four screens requests **no** code after load.
  2. `kit.inlineStyleThreshold` set high enough to inline the (small) CSS, removing a render-
     blocking request.
  3. `kit.version.pollInterval = 0` (default) and no `updated` handling: an open session never
     reloads itself.
  4. Cloudflare Pages deploys are atomic: the production alias switches only after the whole
     deployment is uploaded; files under `/_app/immutable/` are content-hashed.
  5. `static/_headers`: HTML served with `Cache-Control: no-cache` (next full load gets the latest
     version); `/_app/immutable/*` with `Cache-Control: public, max-age=31536000, immutable`.
  6. Self-hosted fonts are not loaded in this slice (see R-12), so no late font request can fail.
- **Verification**: a Playwright test records every request after `load` while navigating
  home → Triads → Notes → About → home and asserts the count is 0 (also covers FR-019 "no network
  requests after load"). `e2e/version-skew.spec.ts` simulates the publish itself: after load
  it serves every request from a version-N+1 build (`build-next/`) and asserts no reload, no
  failed request, About still N, and N+1 after a full reload. During real deploys CI runs
  `scripts/deploy-availability-probe.mjs` against the live alias for the whole `wrangler pages
  deploy` and fails on any failed request (US5 scenario 2).
- **Rationale**: If nothing is fetched after load, a newer deployment cannot break an open
  session — the strongest and simplest guarantee.
- **Alternatives considered**: default `split` bundles + `data-sveltekit-preload-code="eager"`
  (still issues requests after load, racing a deploy); service worker caching (adds offline
  semantics the spec puts out of scope, and lifecycle complexity).

## R-05 Containing tool failures (FR-012, FR-013, D-08, D-09)

- **Decision**: Svelte 5 `<svelte:boundary>` wraps zones B–E in the shared `ToolLayout`. Its
  `failed(error, reset)` snippet renders `FailureView` with "Something went wrong in this view",
  a **Reset tool** button (calls `reset()` — re-creates the tool subtree in place, no reload, no
  history entry) and a **Go to home** link (`<a href="/">`, a normal navigation). `onerror`
  calls `recordFailure({ tool, error })`, which does `console.error` with `{ name, message, tool }`
  only. Zone A (navigation) is outside the boundary. A second boundary in
  `src/routes/+layout.svelte` around `{@render children()}` plus `src/routes/+error.svelte`
  handle failures outside a tool via `ShellFailure.svelte`, showing the message with **Go to home**
  as `<a href="/">` whose click handler calls the boundary's `reset()` (when present) and then
  `goto('/')` — a client-side navigation that needs no network, since the single bundle is
  already loaded (constitution II, FR-019). Only if `goto` rejects does it fall back to
  `location.assign('/')`; without JS the plain `href` works as a normal link (D-09). `src/hooks.client.ts` `handleError`
  uses the same `recordFailure` (tool = `null`).
- **Rationale**: Boundaries are the native Svelte 5 mechanism; `reset()` gives exactly the "re-create
  in place" semantics. A recurring failure simply re-enters the `failed` snippet — no loop because
  re-rendering happens only on the user's click.
- **Alternatives considered**: `window.onerror` + manual state flag (cannot reliably unmount a
  broken subtree); full page reload on reset (violates "no page reload"); full reload
  (`data-sveltekit-reload`) as the primary shell recovery (HTML is `no-cache`, so a device offline
  after load would get the browser's offline page instead of home — violates constitution II and
  the never-blank rule).
- **Known limit**: boundaries catch errors during rendering and effects, not inside event handlers.
  No event handlers exist in tools in this slice; later slices route handler errors through
  state updates. Recorded so `/speckit.tasks` does not over-promise.

## R-06 Test-only fault injection (FR-024, D-10)

- **Decision**: Vite `define` sets a build-time boolean `__FM_FAULT_INJECTION__` = `true` only when
  `mode === 'test'` (`vite build --mode test`), `false` otherwise. `src/lib/shell/fault.ts`
  exports `maybeFault(tool)`; when the constant is `true` it reads
  `globalThis.__fmFault?.[tool]` (a remaining-count set by Playwright `addInitScript` or
  `page.evaluate`), decrements it, and throws `Error('Injected fault: <tool>')`. With the constant
  `false`, the body is dead code that Vite/Rollup removes. The tool placeholder calls
  `maybeFault(tool)` during render.
- **Verification**: `scripts/check-no-fault-hook.mjs` (run in CI after the production build) greps
  `build/` for `__fmFault` and `Injected fault` and fails if found. Addresses/query strings never
  reach the hook (it reads a global only).
- **Rationale**: Every acceptance scenario must be automated (constitution IV) while untrusted input
  must never reach executable paths (constitution IX).
- **Alternatives considered**: query-string trigger (`?fault=triads`) — an address could trigger it
  if accidentally shipped; runtime env check only (`import.meta.env.DEV`) — would not cover the
  E2E build, which is a production-mode build.

## R-07 Focus, titles, and history semantics (FR-007, FR-021, D-03, D-11)

- **Decision**:
  - `src/app.html`: `<html lang="en">`, `<meta name="viewport" content="width=device-width,
    initial-scale=1, viewport-fit=cover">`.
  - Each screen sets `<svelte:head><title>` from catalog messages and renders one `<h1 tabindex="-1">`.
  - `src/routes/+layout.svelte` uses `afterNavigate(({ type }) => …)`; for any type except
    `'enter'` it focuses the `h1` (`preventScroll` not set, so it scrolls into view).
  - The navigation link to the current screen carries `aria-current="page"` and
    `data-sveltekit-replacestate`, so re-selecting it creates no history entry.
  - Dismiss and Reset tool are `<button type="button">` that only change component state.
- **Rationale**: SvelteKit's default focus reset goes to `<body>`; the spec requires the heading.
  `data-sveltekit-replacestate` is a documented link option; deterministic regardless of
  SvelteKit's same-URL heuristics.
- **Alternatives considered**: a live-region route announcer only (SvelteKit's built-in
  announcer is kept, but focus placement is still required by the spec).

## R-08 Messages and i18n (FR-017, constitution VIII)

- **Decision**: Paraglide JS 2 (`@inlang/paraglide-js`) with its Vite plugin,
  `project.inlang/settings.json` (`baseLocale: "en"`, `locales: ["en"]`), catalog
  `messages/en.json`, compiled to `src/lib/paraglide/` (git-ignored, generated). Strategy
  `['baseLocale']` — no locale in URLs, no cookie, no storage (FR-020: nothing stored). Message
  keys are listed in [contracts/ui-shell.md](./contracts/ui-shell.md#message-catalog). An ESLint
  rule (`svelte/no-raw-text`-style check via `eslint-plugin-svelte` `no-restricted-syntax` on text
  nodes, or a Vitest test scanning `.svelte` files for literal text) blocks hard-coded UI text.
- **Rationale**: Mandated; tree-shaken message functions keep the bundle small; adding pt/es later
  needs only `messages/pt.json`, `messages/es.json` and a settings change.
- **Alternatives considered**: URL/cookie strategies (would store or encode a language the slice
  does not offer).

## R-09 Application version (FR-008, C-05)

- **Decision**: `package.json` `version` is the single source of truth. `vite.config.ts` reads it
  and `define`s `__APP_VERSION__`; it is also passed as `kit.version.name` so SvelteKit's
  internal version matches. About renders `m.about_version({ version: __APP_VERSION__ })` →
  "Version X.Y.Z". A Vitest test asserts the About text equals `package.json`'s version; releases
  bump `package.json` and tag `vX.Y.Z` on `main`.
- **Alternatives considered**: git tag at build time (not available in shallow CI clones, and
  differs on PR previews); hard-coded constant (two sources of truth).

## R-10 Layout, tokens, responsive behavior, safe areas (FR-003, FR-005, FR-014, FR-020)

- **Decision**: `src/lib/styles/tokens.css` defines custom properties for color roles (surface,
  text, accent/selection, focus ring, notice), spacing scale, type scale, radius, motion
  durations, min touch target (`--target-min: 44px`) and breakpoints (documented values 600 px and
  1024 px from design §5.1; media queries use the literal values with a comment because CSS custom
  properties cannot be used in media queries — the token file is the single place they are
  written). Light/dark via `prefers-color-scheme`, higher contrast via `prefers-contrast: more`,
  durations zeroed via `prefers-reduced-motion: reduce`. Root and body use
  `padding: env(safe-area-inset-*)`. Overflow is prevented, not hidden (no `overflow-x: hidden`
  on body): every layout uses `min-width: 0`, wrapping text, and CSS grid `minmax(0, 1fr)` so
  nothing can overflow. Home cards: grid `repeat(auto-fit, minmax(min(100%, var(--card-min-inline)), 1fr))`
  with `--card-min-inline: 16rem` defined in `tokens.css`. Tool layout: `ToolLayout.svelte` reads
  `grid-template-areas/columns/rows` only from `--tool-grid-areas`, `--tool-grid-columns`,
  `--tool-grid-rows`; `tokens.css` sets the narrow/medium values (A / B / C / E / D) on `:root`
  and overrides them inside its `@media (min-width: 1024px)` block with `A A / B D / C D / E D`,
  C getting the largest track. Components therefore contain no sizing literals and no media
  queries; every visual value and breakpoint lives in `tokens.css` (constitution VII).
- **Verification**: Playwright sweeps widths 320, 360, 600, 1024, 1280, 2560 asserting
  `document.documentElement.scrollWidth <= innerWidth`, plus a 200% text-zoom pass (CSS
  `font-size: 200%` on `:root` via `page.addStyleTag`, since Playwright cannot set browser zoom).
- **Rationale**: Constitution VII (tokens only), design §5.1.
- **Alternatives considered**: CSS framework (runtime/CSS weight, conflicts with "plain CSS");
  `overflow-x: hidden` on body (hides bugs rather than preventing them).

## R-11 Encrypted delivery and security headers (FR-015, FR-019, constitution II, IX)

- **Decision**: Production on Cloudflare Pages default `*.pages.dev` URL (D-13). Cloudflare Pages
  serves HTTPS and redirects HTTP with 301/308; `.dev` is also on the browser HSTS preload list.
  `static/_headers` adds for `/*`:
  `Strict-Transport-Security: max-age=31536000; includeSubDomains`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`,
  `X-Frame-Options: DENY`. CSP is emitted by SvelteKit `kit.csp` with `mode: 'hash'` and
  directives `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:;
  connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'` (prerendered
  pages get a `<meta http-equiv>` CSP with the inline bootstrap hashes; `frame-ancestors` is
  enforced through `X-Frame-Options` since meta CSP ignores it).
- **Verification**: `scripts/smoke-delivery.sh <base-url>` (run in CI against the PR preview and
  production after deploy) uses `curl -sI` to assert: `http://` → 301/308 to `https://` same
  path; `https://…/` has `strict-transport-security`; `/nope` returns 404; `/triads/` returns
  308 to `/triads` (or 200).
- **Alternatives considered**: custom domain now (operational step outside spec, D-13);
  Cloudflare Worker for headers (more moving parts than `_headers`).

## R-12 Fonts (constitution stack: "Self-hosted fonts")

- **Decision**: Defer the self-hosted font to the first slice that renders note names
  (001-mvp/002 interactive fretboard). This slice uses a system UI font stack exposed as the
  token `--font-family-ui`. Swapping in the self-hosted family later changes only the token and
  adds a preloaded `woff2`.
- **Rationale**: No ♯ ♭ 𝄪 𝄫 or numerals are displayed yet; a font file would cost ~20–40 KB and a
  request that cannot add value, and would be a late-loading asset that could interact with
  version skew (R-04). Constitution X (YAGNI) vs. stack table — recorded in plan Complexity
  Tracking.
- **Alternatives considered**: ship the font now (cost without benefit; still needs glyph
  verification that is only testable when accidentals render).

## R-13 Performance gates (FR-023, SC-001, constitution VI)

- **Decision**:
  - **Lighthouse CI** (`@lhci/cli`, `lighthouserc.cjs`): runs against `pnpm preview` of the
    production build, mobile preset (simulated throttling), URLs `/`, `/notes`, `/triads`,
    `/about`, 3 runs each, assertions `categories:performance >= 0.9` (error),
    `interactive <= 3000` (error), `total-blocking-time <= 200`, `cumulative-layout-shift <= 0.1`.
  - **Bundle size**: `scripts/check-bundle-size.mjs` parses `build/index.html`, collects every
    `<script>`/`modulepreload` JS referenced (with `bundleStrategy: 'single'`, one file plus inline
    bootstrap), gzips them with Node `zlib` level 9 and fails if the total exceeds 80 × 1024 bytes.
  - **Tool open/switch ≤ 300 ms**: Playwright test on Chromium with CDP
    `Emulation.setCPUThrottlingRate(4)` measures from the click to the moment the new `h1` is
    focused (`performance.now()` deltas via `page.evaluate`), median of 5, asserts ≤ 300 ms.
  - Budget breaches fail CI jobs.
- **Rationale**: Uses the constitution's tools; deterministic enough for CI (median of runs).
- **Alternatives considered**: `size-limit` package (extra dependency for a 30-line script);
  WebPageTest (external service).

## R-14 Testing layout and accessibility checks (constitution IV, V; SC-008)

- **Decision**: Vitest (with `@testing-library/svelte` + `jsdom` for components; coverage via
  `@vitest/coverage-v8`, thresholds 80 % lines/branches overall; 95 % on `src/lib/theory/**`
  configured even though the directory is empty in this slice). Playwright projects:
  `phone` (Pixel 7 descriptor narrowed to 360 px width, Chromium) and `desktop` (1280×800,
  Chromium); plus a Firefox and WebKit desktop smoke project for the navigation flow. E2E runs
  against `vite preview` of the `--mode test` build (fault hook present); a separate job runs the
  no-JS project (`javaScriptEnabled: false`) and Lighthouse against the production build.
  `@axe-core/playwright` runs `withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'])` on
  home, home-with-notice, Notes, Triads, About, and the failure view, light and dark
  (`colorScheme`), asserting zero violations.
- **TM-9 screenshot fixtures**: not applicable — no theory views exist yet.
- **Alternatives considered**: Cypress (not mandated).

## R-15 Lint boundaries and code-quality gates (constitution III, merge gate)

- **Decision**: ESLint flat config with `typescript-eslint` (strict, `no-explicit-any` error),
  `eslint-plugin-svelte`, and `no-restricted-imports` scoped to `src/lib/theory/**` forbidding
  `svelte`, `svelte/*`, `$app/*`, `$lib/paraglide/*`, `$lib/prefs/*`, `$lib/audio/*`,
  `$lib/fretboard/*`, `$lib/state/*` and DOM globals via `no-restricted-globals`
  (`window`, `document`, `localStorage`). The rule is configured now so the first theory file is
  born guarded. Prettier with `prettier-plugin-svelte`; `svelte-check --fail-on-warnings`;
  `tsc` via `svelte-check`.
- **Alternatives considered**: `eslint-plugin-boundaries` (heavier config for one rule).

## R-16 CI/CD and hosting

- **Decision**: `.github/workflows/ci.yml` on `pull_request` and `push` to `main`:
  1. `checks`: mise-action → `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm format:check`
     → `pnpm check` → `pnpm test:unit --coverage`.
  2. `e2e`: `pnpm build:test:skew` (N+1 into `build-next/`, then N into `build/`), `pnpm exec playwright install --with-deps chromium firefox webkit`,
     `pnpm test:e2e`.
  3. `perf`: production build → `check-no-fault-hook` → `check-bundle-size` → `lhci autorun`.
  4. `deploy` (needs 1–3): `pnpm exec wrangler pages deploy build --project-name fretboard-master
     --branch ${{ github.head_ref || github.ref_name }}` using secrets `CLOUDFLARE_API_TOKEN`,
     `CLOUDFLARE_ACCOUNT_ID`, with `deploy-availability-probe.mjs` polling the alias in the
     background for the whole deploy; `main` → production, other branches → preview URL; then
     `scripts/smoke-delivery.sh` against the deployed URL.
- **Rationale**: Constitution: GitHub Actions, PR previews, atomic deploys, every gate in CI.
- **Alternatives considered**: Cloudflare Pages Git integration (builds outside our gates; deploys
  could precede failing checks).

## R-17 ADRs to record (constitution: Decisions)

`docs/adr/0001-static-sveltekit-on-cloudflare-pages.md` (R-02, R-11, R-16),
`docs/adr/0002-single-bundle-for-version-continuity.md` (R-04),
`docs/adr/0003-not-found-as-prerendered-404-home.md` (R-03),
`docs/adr/0004-test-only-fault-injection.md` (R-06).

---

All Technical Context items are resolved; no `NEEDS CLARIFICATION` remains.
