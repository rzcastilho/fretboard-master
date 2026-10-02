# ADR 0003: Not found as a prerendered 404 home

- **Status**: Accepted
- **Source**: research R-03 (spec 001-walking-skeleton)

## Context

Unknown addresses must show the home screen with a short notice, return HTTP 404, and leave the
address bar at `/` without an extra history entry. Reloading must not show a stale notice, and
the page must make sense without JS.

## Decision

- A catch-all route `src/routes/[...unknown]/+page.svelte` renders the shared `HomeScreen` with
  the `Notice`. Its `+page.ts` sets `prerender = true` and `entries = () => [{ unknown:
'__not-found' }]`, which emits `build/__not-found.html`.
- `scripts/make-404.mjs` moves that file to `build/404.html`, and fails if it is missing.
  Cloudflare Pages serves a top-level `404.html` with status 404 for any path with no asset.
- On hydration the page calls `replaceState('/', {})`, so the address becomes `/` with no new
  history entry while the notice stays visible. Client-side routing reaches the same catch-all,
  so in-app behavior matches.
- Matching is case-sensitive, so `/Triads` also ends up on the catch-all.

## Consequences

- Correct 404 status and non-blank markup even with scripting off.
- Known addresses remain the only addressable screens; `/__not-found` does not survive the
  rename.
- No state in the URL, so a reload shows plain home.

## Alternatives considered

- `adapter-static` `fallback: '404.html'`: an empty shell, blank without JS.
- `goto('/', { replaceState: true })` plus a notice store: the prerendered 404 would still need
  its own home-with-notice markup.
- Redirect to `/?notice=not-found`: leaves state in the URL and re-shows a stale notice on reload.
