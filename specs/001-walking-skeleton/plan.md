# Implementation Plan: Walking Skeleton — Home Screen and Navigation

**Branch**: `001-walking-skeleton` | **Date**: 2026-09-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-walking-skeleton/spec.md`

## Summary

Deliver the first deployed, navigable slice of Fretboard Master: a prerendered home screen with two
equal tool cards (Fretboard Notes, Triads), two placeholder tool screens in the shared five-zone
layout with persistent navigation, an About page showing the build's semantic version, a
home-with-notice response for every unknown address (HTTP 404), and per-tool failure containment
with **Reset tool** / **Go to home**.

Technical approach (details in [research.md](./research.md)): SvelteKit 2 + Svelte 5 with
`adapter-static`, every known screen prerendered (works without JS, never blank); a catch-all
route prerendered and renamed to `404.html` for unknown paths (R-03); `bundleStrategy: 'single'`
so an open session makes zero requests after load, which makes new deploys invisible to it
(R-04); `<svelte:boundary>` around tool zones B–E for containment (R-05); a build-time
`__FM_FAULT_INJECTION__` flag that exists only in test/dev builds (R-06); Paraglide JS catalog for
every string (R-08); CSS custom-property tokens honoring light/dark, contrast and reduced motion
(R-10); Cloudflare Pages with `_headers` for HSTS/security/caching (R-11); CI gates for lint,
types, Vitest, Playwright + axe, Lighthouse, and bundle size (R-13 – R-16).

**Assumptions recorded** (spec left them open; most defensible option chosen):

- The self-hosted font is deferred to the first slice that renders note names; this slice uses a
  system font stack behind a token (R-12; see Complexity Tracking).
- Production URL is the Cloudflare Pages default `fretboard-master.pages.dev` (spec D-13).
- Trailing-slash variants are served by a 308 redirect to the canonical path rather than a direct
  200 — both satisfy FR-022 ("opens the same screen"). Rejected: `trailingSlash: 'always'`, which
  would make `/triads/` canonical, contradicting the spec's addresses.
- Dismissing the notice moves focus to the screen's `h1` so focus is never lost (spec is silent).

## Technical Context

**Language/Version**: TypeScript 5.x (`strict: true`) on Node.js 24 LTS (build/test only); Svelte 5 (runes)

**Primary Dependencies**: Runtime: `svelte` 5, `@sveltejs/kit` 2 (`adapter-static`), `@inlang/paraglide-js` 2 (compiled messages, no runtime weight beyond used messages). Dev: `vite`, `vitest`, `@vitest/coverage-v8`, `@testing-library/svelte`, `jsdom`, `@playwright/test`, `@axe-core/playwright`, `@lhci/cli`, `eslint` + `typescript-eslint` + `eslint-plugin-svelte`, `prettier` + `prettier-plugin-svelte`, `svelte-check`, `wrangler`. Valibot is **not** added yet (no untrusted input parsed in this slice).

**Storage**: N/A — nothing is stored (FR-020); no `localStorage` access in this slice.

**Testing**: Vitest (unit + component, jsdom) with coverage thresholds; Playwright (phone 360 px + desktop Chromium, Firefox/WebKit smoke, no-JS project) with `@axe-core/playwright`; Lighthouse CI; `scripts/check-bundle-size.mjs`, `scripts/check-no-fault-hook.mjs`, `scripts/smoke-delivery.sh`.

**Target Platform**: Last two major versions of evergreen browsers, desktop and mobile; static hosting on Cloudflare Pages.

**Project Type**: Static web application (SvelteKit SPA with full prerendering); single project at repo root.

**Performance Goals**: Home TTI ≤ 3 s and Lighthouse mobile performance ≥ 90; tool open/switch ≤ 300 ms; initial JS ≤ 80 KB gzip (expected ≈ 30–40 KB: Svelte runtime + SvelteKit client + 4 screens).

**Constraints**: No network requests after load; no third-party origins; no storage; no device permissions; no horizontal scroll 320–2560 px and at 200 % text; WCAG 2.2 AA with zero axe violations; works without JS for reading and link navigation.

**Scale/Scope**: 4 screens + 1 not-found view, ~12 Svelte components, ~28 catalog messages, English only. Static CDN delivery — no server-side scale concerns.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Initial check (before Phase 0): **PASS**, one recorded deviation (fonts, Complexity Tracking).
Post-design re-check (after Phase 1): **PASS** — the design artifacts introduced no new deviation.

### I. Musical Correctness (NON-NEGOTIABLE)

- [x] N/A — no notes, spellings, intervals, shapes, or sound exist in this slice; no theory code is written, so the TM table/property test gate is not triggered. `src/lib/theory` is not created.

### II. On-Device, Static, Private by Design

- [x] All logic runs in the browser; Cloudflare Pages only serves static files (R-02, R-11).
- [x] No network dependency after load — zero requests while navigating, asserted by `continuity.spec.ts` (R-04).
- [x] No accounts, sign-up, identifiers, or personal data; failure records go to console only (data-model "Failure record", C-03).
- [x] No third-party trackers/ads/executable content; CSP `'self'` only (contracts/http-delivery.md).
- [x] No device permissions requested; `Permissions-Policy` denies camera/mic/geolocation.
- [x] Preferences: N/A — nothing stored in this slice (FR-020), so nothing to erase.
- [x] Anonymous measurement: N/A — Q-1 not adopted; none built.

### III. Pure Core, Thin Shell

- [x] `src/lib/theory` purity lint rule configured now (R-15) so the boundary exists before the first theory file; no theory code in this slice.
- [x] One-way data flow: N/A for control → view state → display model → fretboard, since there are no controls, view state, or fretboard yet; shell components hold only route/notice/boundary UI state.
- [x] Tools neither calculate theory nor draw a fretboard (placeholders only).
- [x] Handedness/orientation and fretboard events: N/A — no fretboard renderer in this slice.
- [x] View state outside tool components: N/A — tools have no state; `src/lib/state` is introduced by the first slice with tool state (constitution X: no abstraction before a real use).

### IV. Test-First for Logic, Tested Behavior for UI

- [x] Test-first modules in scope: none of theory/instrument/link/prefs/notation exist; shell logic (`tools.ts`, `screens.ts`, `failure.ts`, `fault.ts`) gets unit tests written first anyway.
- [x] Every acceptance scenario (US1–US5, 22 scenarios: 5 + 6 + 2 + 6 + 3) maps to an automated test (quickstart §5–§7): US1-4 safe areas via CDP safe-area-inset emulation in `home.spec.ts`; US4-2 "at most two lines" via a measured line-count assertion in `resilience.spec.ts`; US5-1 via post-deploy `smoke-delivery.sh`; US5-2 via `deploy-availability-probe.mjs` polling the live alias throughout `wrangler pages deploy` in CI; US5-3 via `version-skew.spec.ts`, which swaps the served build to N+1 mid-session and asserts no reload, no failed request, About still N, and N+1 after a full reload.
- [x] TM-9 screenshot fixtures: N/A — no theory views exist.
- [x] Deterministic tests: no audio/timing; perf assertions use median of runs; fault injection is explicit (contracts/test-hooks.md).

### V. Accessible by Default (WCAG 2.2 AA)

- [x] Keyboard-operable cards, nav, Dismiss, Reset tool, Go to home; visible focus token; focus to `h1` after navigation (R-07). Fretboard arrow keys: N/A (no fretboard).
- [x] No color-only information: current nav item has underline + weight; notice/failure use text. Marker shapes: N/A.
- [x] Touch targets ≥ 44×44 px via `--target-min` token (cards, nav links, buttons).
- [x] Text description of fretboard view: N/A — no fretboard; notice uses `role="status"` polite.
- [x] `prefers-reduced-motion` and `prefers-contrast` honored in tokens (R-10).
- [x] Sound-only information: N/A — no sound.
- [x] Accidentals read in full: N/A — no note names displayed.
- [x] axe zero violations in CI on all screens and states, light and dark (R-14).

### VI. Performance Budgets Are Gates

- [x] Home ≤ 3 s TTI + Lighthouse ≥ 90 — `lhci` assertions (R-13).
- [x] Tool open/switch ≤ 300 ms — `perf.spec.ts` (R-13).
- [x] Initial JS ≤ 80 KB gzip — `check-bundle-size.mjs` (R-13).
- [x] Control change / instrument change / tap-to-sound budgets: N/A — no controls, instrument, or sound.
- [x] Sound material not blocking: N/A; scrolling with 7 strings/24 frets: N/A.
- [x] Regressions fail the build (CI `perf` job); no budget raised.

### VII. Design System Fidelity

- [x] Layout follows design §4.1/§4.2/§5.1: fretboard zone largest, controls never cover it, main controls zone always visible, nothing behind a menu (About is a direct link, D-03).
- [x] Note-function marker code and root/third/fifth colors: N/A — no markers; those color tokens are not used for anything else (not defined yet).
- [x] All visual values from `src/lib/styles/tokens.css`, including layout sizing (`--card-min-inline`) and the tool-layout grid templates (`--tool-grid-*`, switched at 1024 px inside the token file); components contain no sizing literals or media queries; breakpoint literals live only in the token file's documented media queries (R-10).
- [x] Emphasis levels: N/A — no positions.
- [x] Notice: non-blocking, dismissible, ≤ 2 lines, no modal, no error red (contracts/ui-shell.md).
- [x] No rewards, confetti, mascots, tutorials, or photorealistic fretboard.
- [x] 320–2560 px with no horizontal page scroll; width sweep test (R-10).
- [x] Motion: none introduced; durations tokenized and zeroed under reduced motion.

### VIII. International From the First Line

- [x] Every string in `messages/en.json` via Paraglide, including accessible names and titles (contracts/ui-shell.md catalog); raw-text scan in lint/test (R-08).
- [x] Note names via `src/lib/notation` and ♯ ♭ 𝄪 𝄫 rendering: N/A — no note names displayed.
- [x] Layouts wrap text (no truncation) and are tested at 200 % text size; pt/es length headroom via wrapping grid.
- [x] Adding a language = new catalog file + `project.inlang/settings.json` locales entry only.

### IX. Untrusted Input, Versioned Formats

- [x] Share links and stored preferences: N/A — neither exists; the only untrusted input is the URL path, which is matched against `KNOWN_PATHS` by the router and never rendered as HTML or executed.
- [x] Format versions and link-compatibility fixtures: N/A — no link or preference format yet.
- [x] Fault hook cannot be reached from any address or input; absent from production build (R-06, `check-no-fault-hook.mjs`).

### X. Simplicity and Incremental Delivery

- [x] First slice of wave 001-mvp; shippable on its own (deployed, reachable, navigable).
- [x] No speculative abstractions: `HomeScreen` is shared by two real uses (home route and 404 route); `ToolLayout` by two tools; no `state`/`prefs`/`link` modules yet.
- [x] Runtime dependencies: svelte, @sveltejs/kit, @inlang/paraglide-js — all MIT, mandated by constitution.
- [x] Never blank: unknown path → home + notice; tool failure → contained view; shell failure → message + Go to home via client-side `goto('/')` (works offline after load; full load only as fallback).

### Stack & Workflow gates

- [x] Stack matches the constitution table (TS strict, Svelte 5 + SvelteKit adapter-static, Vite, Paraglide, plain CSS tokens, Vitest, Playwright + axe, Lighthouse CI, ESLint/Prettier/svelte-check, mise + pnpm, GitHub Actions, Cloudflare Pages). Deviation: self-hosted fonts deferred (Complexity Tracking).
- [x] Tooling via `mise.toml` with exact `major.minor.patch` pins (node, pnpm), so local and CI versions are identical; CI uses `jdx/mise-action` (R-01, R-16).
- [x] Merge gate jobs: typecheck, svelte-check, lint (with boundaries), format, Vitest coverage (80 % overall; 95 % theory threshold configured), Playwright phone + desktop with axe, Lighthouse + bundle size (R-16).
- [x] ADRs 0001–0004 recorded in `docs/adr/` (R-17).
- [x] Conventional Commits; branch `001-walking-skeleton` merged by PR with preview deployment.

## Project Structure

### Documentation (this feature)

```text
specs/001-walking-skeleton/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── http-delivery.md # Addresses, status codes, headers, caching, CSP
│   ├── ui-shell.md      # Roles/names selector contract + message catalog
│   └── test-hooks.md    # Test-only fault injection interface
├── checklists/
│   └── requirements.md  # From /speckit.specify
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

The repository currently holds only `.specify/`, `.claude/`, and `specs/`. This slice creates the
application at the repository root, following the constitution's source layout; only the `src/lib`
subdirectories this slice actually needs are created (others arrive with their slices).

```text
mise.toml                         # exact pins: node 24.x.y, pnpm 10.x.y (R-01)
package.json                      # version 0.1.0 = app version source of truth
pnpm-lock.yaml
svelte.config.js                  # adapter-static, prerender, bundleStrategy 'single', csp hash, version.name
vite.config.ts                    # sveltekit(), paraglideVitePlugin, define __APP_VERSION__/__FM_FAULT_INJECTION__, vitest config
tsconfig.json
eslint.config.js                  # incl. src/lib/theory import boundary
.prettierrc
playwright.config.ts              # phone, desktop, firefox, webkit, nojs projects
lighthouserc.cjs
project.inlang/settings.json      # baseLocale en
messages/
└── en.json
static/
├── _headers                      # HSTS, security headers, cache rules
└── robots.txt
scripts/
├── make-404.mjs                  # build/__not-found.html → build/404.html
├── check-bundle-size.mjs
├── check-no-fault-hook.mjs
├── build-next-version.mjs        # test-only N+1 build into build-next/ for version-skew.spec.ts
├── deploy-availability-probe.mjs # polls the live alias during deploy (US5 scenario 2)
└── smoke-delivery.sh
src/
├── app.html                      # lang="en", viewport-fit=cover
├── app.d.ts                      # __APP_VERSION__, __FM_FAULT_INJECTION__, __fmFault globals
├── hooks.client.ts               # handleError → recordFailure(null, …)
├── lib/
│   ├── shell/
│   │   ├── tools.ts              # TOOLS
│   │   ├── screens.ts            # SCREENS, KNOWN_PATHS, screenTitle
│   │   ├── failure.ts            # recordFailure (console only)
│   │   ├── fault.ts              # maybeFault (test builds only)
│   │   ├── HomeScreen.svelte     # top/center/bottom zones, optional notice
│   │   ├── ToolCard.svelte
│   │   ├── Notice.svelte
│   │   ├── AppNav.svelte         # persistent navigation
│   │   ├── ToolLayout.svelte     # five zones + <svelte:boundary> around B–E
│   │   ├── ToolPlaceholder.svelte
│   │   ├── FailureView.svelte
│   │   └── ShellFailure.svelte   # failure outside a tool: Go to home via reset() + goto('/')
│   ├── styles/
│   │   ├── tokens.css
│   │   └── global.css
│   └── paraglide/                # generated, git-ignored
└── routes/
    ├── +layout.ts                # prerender = true, trailingSlash = 'never'
    ├── +layout.svelte            # global CSS, afterNavigate focus, shell boundary
    ├── +error.svelte             # shell failure view (ShellFailure: client-side Go to home)
    ├── +page.svelte              # home
    ├── notes/+page.svelte
    ├── triads/+page.svelte
    ├── about/+page.svelte
    └── [...unknown]/
        ├── +page.ts              # entries → __not-found
        └── +page.svelte          # HomeScreen + not-found notice, replaceState('/')
tests/
└── unit/                         # Vitest: tools, screens, failure, fault, version, components, raw-text scan
e2e/
├── home.spec.ts
├── navigation.spec.ts
├── about.spec.ts
├── resilience.spec.ts
├── continuity.spec.ts
├── version-skew.spec.ts
├── perf.spec.ts
└── nojs.spec.ts
docs/
└── adr/
    ├── 0001-static-sveltekit-on-cloudflare-pages.md
    ├── 0002-single-bundle-for-version-continuity.md
    ├── 0003-not-found-as-prerendered-404-home.md
    └── 0004-test-only-fault-injection.md
.github/
└── workflows/
    └── ci.yml                    # checks, e2e, perf, deploy + smoke
```

**Structure Decision**: Single static web project at the repository root (the directory that
currently contains `.specify/`, `.claude/`, and `specs/`), matching the constitution's source
layout: application code under `src/` (`src/routes` for the four screens plus the catch-all, and
`src/lib/shell` + `src/lib/styles` for this slice's shared UI), catalogs in `messages/`, unit tests
in `tests/`, browser tests in `e2e/`, decisions in `docs/adr/`. Shell components live in
`src/lib/shell` (constitution ARCH-1 "Shell and navigation"); the constitution's other `src/lib`
modules (`theory`, `instrument`, `audio`, `fretboard`, `state`, `link`, `prefs`, `notation`) are not
created until a slice uses them (Principle X). No backend, no workspace packages.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Stack table says "Fonts: self-hosted"; this slice ships a system font stack (token `--font-family-ui`) | No accidentals or numerals are displayed yet; a font file adds ~20–40 KB and a late request that buys nothing and could interact with deploy skew (R-12). The self-hosted font lands with the first slice that renders note names (001-mvp/002), changing only the token. | Shipping the font now: cost without benefit, and its ♯ ♭ 𝄪 𝄫 glyph coverage cannot be verified until note names render. Needs reviewer approval per Governance. |
| Lint boundary for `src/lib/theory` configured before the directory exists | Constitution III requires the rule; configuring it first means the first theory file is guarded from its first commit. | Adding it in the first theory slice risks an unguarded first merge. Cost is a few config lines; not a speculative abstraction. |
