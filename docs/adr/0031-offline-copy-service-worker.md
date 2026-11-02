# ADR 0031: Offline copy through a hand-registered service worker

- **Status**: Accepted
- **Source**: spec 040-offline-practice (research R-14, contract C-01)

## Context

After one online visit the app should open and practise with no connection, and an update must
never interrupt a running session (ADR 0002). The build is a static, single-bundle SvelteKit site,
so every file the app needs is known at build time.

## Decision

- **Kit's own worker, registered by hand.** `src/service-worker.ts` is SvelteKit's built-in worker.
  `kit.serviceWorker.register` is `false`, and `src/lib/offline/register.ts` registers it after
  `load`, so the registration never competes with first paint. `_headers` is left out of `files`.
- **Versioned cache name.** The cache is called `fm-offline-<version>-<digest>`. `<version>` is
  `kit.version.name` and `<digest>` covers the precache list, so any change to the shipped files
  yields a new cache. On `activate`, the worker deletes every other `fm-offline-*` cache.
- **Cache-first with network fallback.** Precached URLs are answered from the cache. Anything else
  goes to the network and is never added to the cache.
- **No `skipWaiting`, no `clients.claim`.** A new worker waits until every tab running the old one
  is closed. An open session keeps the version it loaded, with the cache that matches it. The page
  has no `updatefound` or `controllerchange` handler and never reloads itself.
- **Playwright blocks workers by default.** `serviceWorkers: 'block'` stays the default in the
  Playwright config, so existing specs see the same network as before. Offline specs opt in.

## Alternatives rejected

- **Workbox** and **`vite-plugin-pwa`**: extra build dependencies and generated code for a precache
  list Kit already provides through `$service-worker`.
- **Network-first**: a slow or flaky connection delays the open, which defeats the feature.
- **`skipWaiting` with a reload prompt**: interrupts a running practice session and breaks the
  rule that a session never reloads itself.

## Consequences

- A second visit opens from the cache with no request to the network for app files.
- A new version takes effect on the next open after all tabs close.
- ADR 0002 still holds: the single bundle keeps a session whole, and the worker now backs that
  continuity across reloads.
