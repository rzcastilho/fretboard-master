---

description: "Task list for Walking Skeleton — Home Screen and Navigation"
---

# Tasks: Walking Skeleton — Home Screen and Navigation

**Input**: Design documents from `/specs/001-walking-skeleton/`

**Prerequisites**: plan.md, spec.md, research.md (R-01…R-17), data-model.md, contracts/ (`ui-shell.md`, `http-delivery.md`, `test-hooks.md`), quickstart.md

**Tests**: INCLUDED. Constitution IV requires every acceptance scenario to become an automated test, and plan.md lists the Vitest/Playwright/Lighthouse suites. Write each test first and confirm it FAILS before its implementation.

**Organization**: Grouped by user story. Paths are relative to the repository root (`/Users/castilho/.autonomous/worktrees/fretboard-master-b17b67/001-walking-skeleton`). Selectors and strings come from `contracts/ui-shell.md`; every user-facing string comes from `messages/en.json` (FR-017).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US5, matching spec.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Toolchain and project skeleton at the repo root (R-01, R-15).

- [X] T001 Create `mise.toml` pinning **exact** versions — `node = "24.<minor>.<patch>"` and `pnpm = "10.<minor>.<patch>"`, resolved once with `mise latest node@24` / `mise latest pnpm@10` and written in full (never a bare major or `latest`), so local and CI install identical versions (constitution, Tool installation; R-01) — and `.gitignore` (node_modules, build, build-next, .svelte-kit, src/lib/paraglide, playwright-report, .lighthouseci)
- [X] T002 Create `package.json` (`"version": "0.1.0"`, `"type": "module"`, scripts: dev, build, `build:test` = `vite build --mode test`, `build:test:skew` (T070), preview, check, lint, format:check, test:unit, test:e2e, test:e2e:nojs, lhci) and install dependencies per plan.md Technical Context (svelte 5, @sveltejs/kit 2, @sveltejs/adapter-static, @inlang/paraglide-js 2, vite, vitest, @vitest/coverage-v8, @testing-library/svelte, jsdom, @playwright/test, @axe-core/playwright, @lhci/cli, eslint, typescript-eslint, eslint-plugin-svelte, prettier, prettier-plugin-svelte, svelte-check, wrangler); commit `pnpm-lock.yaml`
- [X] T003 [P] Create `tsconfig.json` (extends `.svelte-kit/tsconfig.json`, `strict: true`) and `svelte.config.js` (adapter-static with `pages`/`assets` = `build`, `kit.output.bundleStrategy = 'single'`, high `kit.inlineStyleThreshold`, `kit.version.name` from `package.json`, `kit.version.pollInterval = 0`, `kit.csp` `mode: 'hash'` with directives from contracts/http-delivery.md)
- [X] T004 [P] Create `eslint.config.js` (typescript-eslint strict, `no-explicit-any` error, eslint-plugin-svelte, `no-restricted-imports`/`no-restricted-globals` boundary for `src/lib/theory/**` per R-15) and `.prettierrc` with `prettier-plugin-svelte`
- [X] T005 [P] Create `src/app.html` (`<html lang="en">`, viewport `width=device-width, initial-scale=1, viewport-fit=cover`, `%sveltekit.head%`/`%sveltekit.body%`) and `src/app.d.ts` declaring `__APP_VERSION__`, `__FM_FAULT_INJECTION__`, and `var __fmFault: Partial<Record<'notes' | 'triads', number>> | undefined`
- [X] T006 Create `vite.config.ts`: `sveltekit()` and `paraglideVitePlugin` (project `./project.inlang`, outdir `./src/lib/paraglide`, strategy `['baseLocale']`), `define` `__APP_VERSION__` from `package.json` version (or from `process.env.FM_APP_VERSION` only when `mode === 'test'`; the production build fails if that variable is set — used by T070) and `__FM_FAULT_INJECTION__` = `mode === 'test' || mode === 'development'`, Vitest config (jsdom, coverage-v8, thresholds 80 % lines/branches overall, 95 % on `src/lib/theory/**`, tests in `tests/unit/**`)
- [X] T007 [P] Create `project.inlang/settings.json` (`baseLocale: "en"`, `locales: ["en"]`, plugin/module config for Paraglide 2) and `static/robots.txt`
- [X] T008 [P] Create `playwright.config.ts` with projects `phone` (Chromium, 360 px wide), `desktop` (Chromium 1280×800), `firefox` and `webkit` (navigation smoke only), `nojs` (`javaScriptEnabled: false`); `webServer` runs `pnpm preview` on the `--mode test` build; testDir `e2e/`
- [X] T009 [P] Create `lighthouserc.cjs`: mobile preset, simulated throttling, URLs `/`, `/notes`, `/triads`, `/about`, 3 runs each, assertions `categories:performance >= 0.9` (error), `interactive <= 3000` (error), `total-blocking-time <= 200`, `cumulative-layout-shift <= 0.1` (R-13)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Catalog, tokens, screen/tool definitions, root layout, and the test-only fault hook that every story uses.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T010 Create `messages/en.json` with every key and English text from the Message catalog table in `contracts/ui-shell.md` (`app_name`, `title_screen`, `nav_*`, `tool_*`, `card_label`, `zone_*`, `placeholder_*`, `notice_*`, `failure_*`, `about_*`); run the Paraglide compile so `src/lib/paraglide/` is generated (git-ignored)
- [X] T011 [P] Create `src/lib/styles/tokens.css`: custom properties for color roles (surface, text, accent, focus ring, neutral notice), spacing, type scale, radius, motion durations, `--target-min: 44px`, `--font-family-ui` (system stack, R-12), layout sizing tokens `--card-min-inline: 16rem` (home card grid minimum) and the tool-layout grid tokens `--tool-grid-areas` / `--tool-grid-columns` / `--tool-grid-rows` (narrow/medium values on `:root`, wide values `"A A" "B D" "C D" "E D"` with the C track largest set inside `@media (min-width: 1024px)` in this file); light/dark via `prefers-color-scheme`, `prefers-contrast: more` overrides, durations zeroed under `prefers-reduced-motion: reduce`; the only place breakpoint literals 600 px / 1024 px are written, with a comment (R-10)
- [X] T012 [P] Create `src/lib/styles/global.css`: reset, `body` background/text from tokens, `padding: env(safe-area-inset-*)`, visible `:focus-visible` ring from token, `min-width: 0` defaults, wrapping text; no `overflow-x: hidden` (R-10)
- [X] T013 [P] Write failing unit test `tests/unit/screens.test.ts`: `KNOWN_PATHS` is exactly `['/', '/notes', '/triads', '/about']`; `/caged`, `/Triads`, `/triads/x` are not known; `screenTitle('home')` = "Fretboard Master" and `screenTitle('triads')` = "Triads — Fretboard Master"
- [X] T014 [P] Write failing unit test `tests/unit/tools.test.ts`: `TOOLS` has exactly 2 entries, order notes → triads, unique ids and paths, every path in `KNOWN_PATHS`
- [X] T015 Create `src/lib/shell/screens.ts` exporting `SCREENS`, `KNOWN_PATHS`, and `screenTitle(id)` using catalog messages (per data-model.md Screen); make T013 pass
- [X] T016 Create `src/lib/shell/tools.ts` exporting `TOOLS: readonly Tool[]` (`id: 'notes' | 'triads'`, `path`, `name()`, `question()` from catalog); make T014 pass
- [X] T017 [P] Write failing unit test `tests/unit/failure.test.ts`: `recordFailure('triads', new Error('x'))` returns `{ name: 'Error', message: 'x', tool: 'triads' }`; non-Error input gives `name: 'UnknownError'` and `String(error)` truncated to 500 chars; `tool: null` allowed; it calls `console.error('[fretboard-master] failure', record)` once and touches neither `fetch` nor storage
- [X] T018 [P] Write failing unit test `tests/unit/fault.test.ts`: with `__FM_FAULT_INJECTION__ = true` and `globalThis.__fmFault = { notes: 1 }`, first `maybeFault('notes')` throws `Injected fault: notes` and the second does not; `Infinity` always throws; absent or `0` never throws; `triads` unaffected by a `notes` count
- [X] T019 Create `src/lib/shell/failure.ts` (`FailureRecord` type, pure builder, `recordFailure(tool, error)` console-only; no URL, user agent, storage, or network); make T017 pass
- [X] T020 Create `src/lib/shell/fault.ts` (`maybeFault(tool)` guarded by `__FM_FAULT_INJECTION__` so the body is dead-code-eliminated in production; reads only the `globalThis.__fmFault` global); make T018 pass
- [X] T021 First write failing component test `tests/unit/shell-failure.test.ts` (mock `$app/navigation`): `ShellFailure` shows "Something went wrong in this view" and a "Go to home" `link` with `href="/"` and **no** `data-sveltekit-reload`; clicking it calls the supplied `reset` (when given) and then `goto('/')`, with no `location` change; only when `goto` rejects does it fall back to `location.assign('/')`. Then create `src/lib/shell/ShellFailure.svelte` (props: optional `reset`; link click → `preventDefault`, `reset?.()`, `await goto('/')`, fallback `location.assign('/')` in `catch`; plain `href="/"` keeps it working without JS) and make the test pass. Then create `src/routes/+layout.ts` (`export const prerender = true; export const trailingSlash = 'never';`) and `src/routes/+layout.svelte`: import `tokens.css` and `global.css`; `afterNavigate(({ type }) => …)` focuses the screen `h1` (`tabindex="-1"`) for every type except `'enter'` (R-07); wrap `{@render children()}` in a `<svelte:boundary>` whose failed snippet renders `<ShellFailure {reset} />` (client-side recovery, no network needed — D-09, constitution II), with `onerror` calling `recordFailure(null, error)`
- [X] T022 [P] Create `src/hooks.client.ts` with `handleError` calling `recordFailure(null, error)`, and `src/routes/+error.svelte` rendering `<ShellFailure />` inside `main` (client-side `goto('/')`, no `data-sveltekit-reload`)
- [X] T023 [P] Create `e2e/support/helpers.ts`: `injectFault(page, tool, count)` (via `addInitScript`), `trackRequests(page)` (records requests after `load`), `expectNoHorizontalScroll(page)`, `runAxe(page)` using `withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'])` and asserting zero violations (R-14)

**Checkpoint**: Foundation ready — user stories can begin.

---

## Phase 3: User Story 1 — Open the app and see a usable home screen (Priority: P1) 🎯 MVP

**Goal**: Prerendered home at `/` with top zone, two equal tool cards, empty reserved bottom zone, no spinner or auth UI.

**Independent Test**: Open `/` on the 360 px phone project; both cards visible, tappable, equal size, with no horizontal scroll, and axe reports 0 violations.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T024 [P] [US1] Component test `tests/unit/home-screen.test.ts`: `HomeScreen` renders `banner` with `h1` "Fretboard Master" and an "About" link to `/about`; a `list` of exactly 2 `listitem` cards in order Fretboard Notes then Triads; each card is one `link` named "Fretboard Notes — Where is every note?" / "Triads — What is a chord made of?"; bottom zone is a plain `div` with no role, name, or content; no `img`, no `progressbar`
- [X] T025 [P] [US1] Component test `tests/unit/tool-card.test.ts`: `ToolCard` is a single `<a>` with the `card_label` accessible name and the visible name and question, with no truncation class
- [X] T026 [P] [US1] E2E `e2e/home.spec.ts` (US1 scenarios 1–5): cards visible and order; equal bounding-box size; each card ≥ 44×44 px; no `progressbar`/spinner and no sign-up/sign-in UI; widths 320, 360, 600, 1024, 1280, 2560 have no horizontal scroll; safe areas (US1-4): on Chromium, CDP `Emulation.setSafeAreaInsetsOverride` with portrait insets (top 47, bottom 34) and landscape insets (left/right 47) at phone size, the banner, `h1`, both cards and the About link have bounding boxes fully inside the inset rectangle (relies on T005 `viewport-fit=cover` and T012 `env(safe-area-inset-*)` padding); 200 % text zoom (inject `:root { font-size: 200% }`) with no horizontal scroll or overlap; axe = 0 in light and dark `colorScheme`; title is "Fretboard Master"; `<html lang="en">`
- [X] T027 [P] [US1] E2E `e2e/nojs.spec.ts` (nojs project): `/` renders the h1 and both cards; the card links navigate as full page loads to `/notes` and `/triads` content (D-07, FR-009)

### Implementation for User Story 1

- [X] T028 [P] [US1] Create `src/lib/shell/ToolCard.svelte`: one `<a href={tool.path}>` with `aria-label` from `m.card_label({ name, question })`, visible name and question, `min-height`/`min-width` from `--target-min`, text wraps, equal weight (make T025 pass)
- [X] T029 [US1] Create `src/lib/shell/HomeScreen.svelte` (props: optional `notice` snippet slot used by US4): `<header>` with `h1` `m.app_name()` (`tabindex="-1"`) and About link `m.nav_about()`; `<main>` with the optional notice area above a `<ul>` grid (`repeat(auto-fit, minmax(min(100%, var(--card-min-inline)), 1fr))` — no literal sizes in the component, `minmax(0, 1fr)` tracks) of `ToolCard` per `TOOLS`; empty bottom `<div>` with no role or name; `<svelte:head><title>` = `screenTitle('home')` (depends on T028; makes T024 pass)
- [X] T030 [US1] Create `src/routes/+page.svelte` rendering `<HomeScreen />`; run `pnpm build:test` and confirm `build/index.html` contains the cards and heading in static markup (D-07); make T026 and T027 pass for home

**Checkpoint**: US1 deployable alone as the MVP — home reachable, never blank, works without JS.

---

## Phase 4: User Story 2 — Open a tool and move between screens (Priority: P1)

**Goal**: `/notes` and `/triads` in the five-zone layout with persistent navigation, correct history semantics, and focus on `h1`.

**Independent Test**: From home open Triads → Notes → home; Back/Forward land on the expected screens; re-selecting the current tool adds no history entry.

### Tests for User Story 2 ⚠️ (write first, must fail)

- [X] T031 [P] [US2] Component test `tests/unit/app-nav.test.ts`: `navigation` named "Tools" lists Home, Fretboard Notes, Triads, About in order with the right `href`s; only the current item has `aria-current="page"` and `data-sveltekit-replacestate`; the current item carries the non-color indicator class
- [X] T032 [P] [US2] Component test `tests/unit/tool-layout.test.ts`: `ToolLayout` renders `banner` "Application bar" containing the nav; regions "Main controls", "Fretboard", "Context panel", "Actions" with the placeholder texts from the catalog; one `h1` with the tool name in `main` before zone B
- [X] T033 [P] [US2] E2E `e2e/navigation.spec.ts` (US2 scenarios 1–6): card → `/triads` shows five named zones; nav order and `aria-current`; Home → Triads → Notes then Back/Forward order; re-selecting the current tool leaves `history.length` unchanged; keyboard-only Tab reaches cards and nav with visible focus, and focus lands on the new `h1` after each in-app change; direct open and reload of `/notes`, `/triads`, `/about`, and `/triads/` (308 → `/triads`) show the right title and heading; fretboard region is the largest; the context panel is beside the fretboard at ≥ 1024 px and below it at narrow widths; axe = 0 on both tools (light and dark); no horizontal scroll on both tools at all widths
- [X] T034 [P] [US2] E2E `e2e/perf.spec.ts`: Chromium with CDP `Emulation.setCPUThrottlingRate(4)`; time from click to the new `h1` being focused for home → tool and tool → tool; median of 5 ≤ 300 ms (FR-023)
- [X] T035 [P] [US2] E2E `e2e/continuity.spec.ts`: after `load`, navigate home → Triads → Notes → About → home; `trackRequests` records 0 requests, no cross-origin request, and the navigation entry count stays 1 (no reload) (FR-016, FR-019)

### Implementation for User Story 2

- [X] T036 [P] [US2] Create `src/lib/shell/AppNav.svelte`: `<nav aria-label={m.nav_label()}>` with a `<ul>` of Home `/`, `TOOLS` in order, About `/about`; props `current: ScreenId`; current link gets `aria-current="page"`, `data-sveltekit-replacestate`, and underline bar + bold weight from tokens; targets ≥ `--target-min` (makes T031 pass)
- [X] T037 [P] [US2] Create `src/lib/shell/ToolPlaceholder.svelte`: takes `tool` id, calls `maybeFault(tool)` during render, renders the four zone placeholders (B, C, D, E) as `<section aria-labelledby>` regions with names from `zone_*` and text from `placeholder_*`
- [X] T038 [US2] Create `src/lib/shell/ToolLayout.svelte`: `<header>` Zone A ("Application bar") containing `AppNav`; `<main>` with `h1` (`tabindex="-1"`, tool name) then a grid whose `grid-template-areas` / `grid-template-columns` / `grid-template-rows` read only `var(--tool-grid-areas)` / `var(--tool-grid-columns)` / `var(--tool-grid-rows)` from `tokens.css` (narrow/medium order A, B, C, E, D; ≥ 1024 px `A A / B D / C D / E D` with the fretboard track largest — the breakpoint switch lives in `tokens.css`, the component contains no media query and no px/rem literal) (R-10); zones B–E rendered inside a `<svelte:boundary>` (FailureView wired in US4); `<svelte:head><title>` via `screenTitle(tool)` (depends on T036, T037; makes T032 pass)
- [X] T039 [P] [US2] Create `src/routes/notes/+page.svelte` and `src/routes/triads/+page.svelte`, each rendering `<ToolLayout tool="notes|triads" />`
- [X] T040 [US2] Verify `afterNavigate` focus behavior from T021 against T033; adjust `src/routes/+layout.svelte` only if a scenario fails; confirm `pnpm build:test` emits `notes.html` and `triads.html`; make T033–T035 pass

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 — Read About and see the app version (Priority: P2)

**Goal**: `/about` with description and "Version X.Y.Z" from `package.json`.

**Independent Test**: Open About from home; description and version are shown; Home link and Back return home.

### Tests for User Story 3 ⚠️ (write first, must fail)

- [X] T041 [P] [US3] Unit test `tests/unit/version.test.ts`: `__APP_VERSION__` matches `^\d+\.\d+\.\d+$` and equals the `package.json` version; the About component text equals `m.about_version({ version })`
- [X] T042 [P] [US3] E2E `e2e/about.spec.ts`: About link from home opens `/about` with h1 "About Fretboard Master", title "About — Fretboard Master", the description paragraph, and "Version X.Y.Z" equal to `package.json`; persistent nav present with About `aria-current="page"`; Home link and browser Back both return to home; axe = 0

### Implementation for User Story 3

- [X] T043 [US3] Create `src/routes/about/+page.svelte`: `AppNav current="about"` in a header; `<main>` with `h1` `m.about_heading()` (`tabindex="-1"`), `<p>` `m.about_description()`, `<p>` `m.about_version({ version: __APP_VERSION__ })`; `<svelte:head><title>` = `screenTitle('about')`; make T041 and T042 pass

**Checkpoint**: US1–US3 independently functional.

---

## Phase 6: User Story 4 — Never see a blank or broken app (Priority: P2)

**Goal**: Unknown addresses open home-with-notice (HTTP 404, address replaced with `/`); tool failures are contained with Reset tool / Go to home.

**Independent Test**: Open `/nope`; force `__fmFault = { triads: 1 }` on a test build and use both recovery actions.

### Tests for User Story 4 ⚠️ (write first, must fail)

- [X] T044 [P] [US4] Component test `tests/unit/notice.test.ts`: `Notice` has `role="status"` with `aria-live="polite"`, text "We could not find that page", a "Dismiss" `button`, no timer (fake timers advance 60 s, still visible), not using error styling, and Dismiss removes it and moves focus to the screen `h1`
- [X] T045 [P] [US4] Component test `tests/unit/failure-view.test.ts`: `FailureView` shows region "Tool error", text "Something went wrong in this view", a "Reset tool" `button` that calls the supplied `reset`, and a "Go to home" link to `/`
- [X] T046 [P] [US4] E2E `e2e/resilience.spec.ts` unknown addresses: `/nope`, `/caged`, `/triads/x`, `/Triads` each show home with "We could not find that page", the URL becomes `/`, and Back does not return to the bad path; the notice text occupies at most two lines (US4-2, FR-011): at 320 px, both at default size and with 200 % text zoom, the text element's height ≤ 2 × its computed `line-height` (+1 px tolerance); Dismiss removes the notice, adds no history entry, and focus moves to the `h1`; navigating to another screen removes the notice; reload of `/` shows no notice; axe = 0 on home-with-notice
- [X] T047 [P] [US4] E2E `e2e/resilience.spec.ts` tool failures: `{ triads: 1 }` shows the failure view in zones B–E with nav still operable; Reset tool restores the placeholder zones with no reload and no history entry; `{ triads: Infinity }` shows the failure view again after Reset (no loop, no blank); Go to home opens `/`; Notes works normally while Triads is failed; console has one `[fretboard-master] failure` record with name, message, tool; `trackRequests` records 0 requests; no `localStorage`/`sessionStorage` write; axe = 0 on the failure view
- [X] T048 [P] [US4] Node test `tests/unit/no-fault-hook.test.ts` (or run via CI) for `scripts/check-no-fault-hook.mjs`: fails when a fixture dir contains `__fmFault` or `Injected fault`, passes when clean
- [X] T049 [P] [US4] E2E in `e2e/nojs.spec.ts` (nojs project, extend T027): the prerendered `404.html` markup shows home with the notice text when scripting is off

### Implementation for User Story 4

- [X] T050 [P] [US4] Create `src/lib/shell/Notice.svelte`: container `role="status"` `aria-live="polite"`, neutral notice tokens (no error red), ≤ 2 lines at 320 px and 200 % zoom, `Dismiss` `<button type="button">` ≥ 44 px that sets `visible = false` and focuses the screen `h1`; no timer, no dialog (makes T044 pass)
- [X] T051 [P] [US4] Create `src/lib/shell/FailureView.svelte`: `<section aria-label={m.failure_region()}>` with `m.failure_message()`, a "Reset tool" `<button type="button">` calling `reset`, and a "Go to home" `<a href="/">`; neutral tokens (makes T045 pass)
- [X] T052 [US4] Update `src/lib/shell/ToolLayout.svelte` so the `<svelte:boundary>` around zones B–E uses `failed={(error, reset) => FailureView}` and `onerror={(e) => recordFailure(tool, e)}`; zone A and `h1` stay outside the boundary (R-05)
- [X] T053 [US4] Create `src/routes/[...unknown]/+page.ts` (`prerender = true`, `entries = () => [{ unknown: '__not-found' }]`) and `src/routes/[...unknown]/+page.svelte` rendering `HomeScreen` with the `Notice` and calling `replaceState('/', {})` from `$app/navigation` after hydration so the URL becomes `/` without a history entry (R-03, D-01); notice also clears on navigation to another screen
- [X] T054 [US4] Create `scripts/make-404.mjs` (moves `build/__not-found.html` to `build/404.html`, fails if the source is missing) and chain it after `vite build` in the `build` and `build:test` scripts in `package.json`; confirm `/__not-found` is no longer served
- [X] T055 [P] [US4] Create `scripts/check-no-fault-hook.mjs`: recursively greps `build/` (or a dir argument) for `__fmFault` and `Injected fault`; prints "OK: no fault hook in build/" or exits 1 (makes T048 pass)
- [X] T056 [US4] Run `pnpm build:test`, `pnpm test:e2e`, then `pnpm build && node scripts/check-no-fault-hook.mjs`; fix any failing scenario from T044–T049

**Checkpoint**: US1–US4 independently functional; never a blank screen.

---

## Phase 7: User Story 5 — Reliable, private delivery and updates (Priority: P3)

**Goal**: HTTPS-only, security headers and caching in `static/_headers`, atomic deploys via CI, smoke checks.

**Independent Test**: `scripts/smoke-delivery.sh <url>` passes against a preview deploy; open session keeps its version across a publish.

### Tests for User Story 5 ⚠️

- [X] T057 [P] [US5] Create `scripts/smoke-delivery.sh <base-url>` with `PASS`/`FAIL` lines per quickstart §7: `http://` → 301/308 to the same path on `https://`; `strict-transport-security` header; `/`, `/notes`, `/triads`, `/about` return 200; `/triads/` → 308 to `/triads` (or 200); `/nope` is 404 containing "We could not find that page"; `/caged` is 404; `/Triads` is 404 or home-with-notice; exits non-zero on any failure
- [X] T058 [P] [US5] Unit test `tests/unit/headers.test.ts`: parse `static/_headers` and assert the HSTS, nosniff, referrer, permissions, and frame headers match contracts/http-delivery.md exactly, `/_app/immutable/*` is `public, max-age=31536000, immutable`, and HTML is `no-cache`

- [X] T069 [P] [US5] E2E `e2e/version-skew.spec.ts` (US5 scenario 3; uses the `build-next/` output of T070): load `/` from the version-N test build and record `performance.getEntriesByType('navigation').length`; then `page.route('**/*', …)` serves every later request from `build-next/` (version N+1, different content hashes, N's `/_app/immutable/*` files absent → 404) to simulate a publish; move home → Triads → Notes → About → home → About; assert no `requestfailed` event, no response ≥ 400, navigation entry count unchanged (no reload), About shows "Version N"; then `page.reload()` and assert About shows "Version N+1"
- [X] T071 [P] [US5] Create `scripts/deploy-availability-probe.mjs <base-url> --stop-file <path>` (US5 scenario 2) and its failing-first unit test `tests/unit/deploy-availability-probe.test.ts` (local `node:http` fixture: all-200 run exits 0; a single 503, connection reset, or missing `/_app/immutable/*` asset exits 1 with the failing URL printed): every 250 ms it requests `/`, `/notes`, `/triads`, `/about` (expect 200), `/nope` (expect 404) and every `/_app/immutable/*` asset referenced by the fetched HTML, until the stop file exists; prints `availability: N requests, 0 failed` and exits 1 on any failure. If the base URL is not yet serving (very first deploy) it prints `SKIP: no prior deployment` and exits 0

### Implementation for User Story 5

- [X] T059 [US5] Create `static/_headers` per contracts/http-delivery.md: for `/*` the five security headers; `no-cache` for `/`, `/*.html`, and extensionless screen paths including `/404.html`; `/_app/immutable/*` immutable one-year cache (makes T058 pass)
- [X] T060 [P] [US5] Create `scripts/check-bundle-size.mjs`: parse `build/index.html`, collect every referenced `<script>`/`modulepreload` JS plus inline bootstrap, gzip level 9, print "initial JS gzip: NN.N KB ≤ 80 KB", exit 1 above 80 × 1024 bytes (R-13)
- [X] T070 [US5] Create `scripts/build-next-version.mjs` and the `build:test:skew` script: runs `vite build --mode test` with `FM_APP_VERSION` = `package.json` version with patch + 1, runs `make-404.mjs`, moves `build/` to `build-next/`, then runs the normal `pnpm build:test` so `build/` holds version N; the preview server keeps serving `build/` (makes T069 runnable)
- [X] T061 [US5] Create `.github/workflows/ci.yml` (on `pull_request` and push to `main`): `checks` (mise-action, `pnpm install --frozen-lockfile`, lint, format:check, check, `test:unit --coverage`); `e2e` (`pnpm build:test:skew`, install Playwright browsers, `pnpm test:e2e` — includes `version-skew.spec.ts`); `perf` (production build, `check-no-fault-hook`, `check-bundle-size`, `test:e2e:nojs`, `lhci autorun`); `deploy` (needs all three; `wrangler pages deploy build --project-name fretboard-master --branch ${{ github.head_ref || github.ref_name }}` with secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, while `scripts/deploy-availability-probe.mjs` runs in the background against the branch/production alias from before the deploy starts until after it finishes (stop file touched after `wrangler` exits; the job fails if the probe exits non-zero); then `scripts/smoke-delivery.sh` against the deployed URL) (R-16)
- [X] T062 [US5] Verify the version-continuity guarantee: confirm T035 and T069 pass and that `build/_app/` has a single JS and a single CSS bundle; quickstart §8 remains an optional manual confirmation on top of the automated T069/T071 checks

**Checkpoint**: All five stories complete.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T063 [P] Add `tests/unit/no-raw-text.test.ts` scanning `src/**/*.svelte` for literal user-facing text nodes and `aria-label`/`title` strings outside Paraglide calls (FR-017, R-08); fix any violations
- [X] T064 [P] Write ADRs in `docs/adr/`: `0001-static-sveltekit-on-cloudflare-pages.md`, `0002-single-bundle-for-version-continuity.md`, `0003-not-found-as-prerendered-404-home.md`, `0004-test-only-fault-injection.md` (R-17)
- [X] T065 [P] Add Firefox and WebKit navigation smoke coverage by tagging key tests in `e2e/navigation.spec.ts` so the `firefox` and `webkit` projects run them
- [X] T066 Run all static gates and fix findings: `pnpm lint`, `pnpm format:check`, `pnpm check` (0 errors, 0 warnings), `pnpm test:unit --coverage` (≥ 80 %)
- [X] T067 Run quickstart.md §3–§6 end to end on a clean checkout (`mise install`, `pnpm install --frozen-lockfile`, builds, e2e, nojs, `pnpm lhci`) and confirm every expected output; confirm Lighthouse TTI ≤ 3000 ms, performance ≥ 0.90, initial JS ≤ 80 KB
- [X] T068 Complexity-tracking follow-up: record the deferred self-hosted font (R-12) as a note in the PR description for reviewer approval per plan.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)** → **Foundational (2)** (blocks all stories) → **US1 (3)** → **US2 (4)** → **US3 (5)** / **US4 (6)** → **US5 (7)** → **Polish (8)**
- US3 depends only on Foundational plus `AppNav` (T036). US4 depends on `HomeScreen` (T029), `ToolLayout` (T038), and the root layout (T021). US5 depends on a built site (T030 onward) and can start in parallel with US3/US4 for its scripts and headers.

### Within Each Story

- Tests first and failing; models/config before components; components before routes; story checkpoint before the next priority.
- T029 needs T028. T038 needs T036 and T037. T052 needs T051 and T038. T053 needs T029 and T050. T054 needs T053. T069 needs T070 (and T043 for About). T061 needs T070 and T071. T021 creates `ShellFailure.svelte`, which T022 reuses.

### Parallel Opportunities

- Setup: T003, T004, T005, T007, T008, T009 after T002.
- Foundational: T011, T012, T013, T014, T017, T018, T022, T023 in parallel; T015, T016, T019, T020 follow their tests.
- Each story's test tasks (all `[P]`) can be written together, and so can its independent components.
- After US2, US3, US4 and the US5 scripts can proceed in parallel.

### Parallel Example: User Story 1

```text
Task: "Component test tests/unit/home-screen.test.ts"            (T024)
Task: "Component test tests/unit/tool-card.test.ts"              (T025)
Task: "E2E e2e/home.spec.ts"                                     (T026)
Task: "E2E e2e/nojs.spec.ts"                                     (T027)
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 Setup → Phase 2 Foundational → Phase 3 US1.
2. STOP and validate: home on phone project, no-JS, axe, width sweep.
3. Optionally deploy the preview (requires T061) before continuing.

### Incremental Delivery

1. Foundation → US1 (home) → US2 (tools + nav) → US3 (About) → US4 (resilience) → US5 (delivery gates) → Polish.
2. Each story adds value without breaking earlier ones; run the full e2e suite after each.

---

## Notes

- `[P]` = different files, no dependency on an incomplete task.
- Do not create `src/lib/theory`, `state`, `prefs`, `link`, or other later-slice modules (constitution X).
- Do not add Valibot or a font file in this slice (plan.md).
- Tests that need the fault hook run on the `--mode test` build only; production must pass `check-no-fault-hook`.
- Commit after each task or logical group using Conventional Commits.
