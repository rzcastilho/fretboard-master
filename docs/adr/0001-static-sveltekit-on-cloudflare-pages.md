# ADR 0001: Static SvelteKit on Cloudflare Pages

- **Status**: Accepted
- **Source**: research R-02, R-11, R-16 (spec 001-walking-skeleton)

## Context

The app must never show a blank screen, reach TTI ≤ 3 s on a mid-range phone, work for the four
known screens without JavaScript, and be delivered over HTTPS only with zero-downtime publishes.

## Decision

- SvelteKit with `@sveltejs/adapter-static`, `prerender = true`, `trailingSlash = 'never'`. `/`,
  `/notes`, `/triads` and `/about` prerender to `index.html`, `notes.html`, `triads.html` and
  `about.html`. Cards and navigation are plain `<a href>` links, so they work as full page loads
  without JS. No `load` functions exist, so client navigation fetches no `__data.json`.
- Host on Cloudflare Pages (default `*.pages.dev`). It serves HTTPS, redirects HTTP, redirects
  `/triads/` to `/triads` (308), serves a top-level `404.html` with status 404, and publishes
  deployments atomically.
- `static/_headers` sets HSTS, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`
  and `X-Frame-Options: DENY`. CSP comes from `kit.csp` in hash mode.
- GitHub Actions runs every gate (lint, format, check, unit, e2e, no-JS, bundle size, Lighthouse)
  and then deploys with `wrangler pages deploy`. `main` goes to production; other branches get
  preview URLs.

## Consequences

- Static markup is always present, so first paint never depends on JS.
- No server runtime and no server-side state, which matches the privacy posture (no network
  traffic after load).
- Header and redirect behavior depends on Cloudflare; `scripts/smoke-delivery.sh` verifies it
  against each deployment.

## Alternatives considered

- SPA fallback only: blank until JS runs, which violates the never-blank rule.
- Cloudflare Pages Git integration: builds outside our CI gates.
- `trailingSlash: 'always'`: directory-style URLs conflict with the canonical `/triads`.
