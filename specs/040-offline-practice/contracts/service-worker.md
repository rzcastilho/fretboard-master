# Contract: service worker `/service-worker.js`

Source: `src/service-worker.ts`, built by SvelteKit and stamped by
`scripts/stamp-service-worker.mjs`. Scope: `/`. The pure helpers live in
`src/lib/offline/precache.ts` (see [data-model.md](../data-model.md)).

## Lifecycle

| Event | Behaviour | Requirement |
|---|---|---|
| `install` | `waitUntil(precache())`. Fetch every list entry one at a time (`cache: 'no-cache'`, `redirect: 'follow'`). Check every response, then check the stored pages' bundle references. Only after that, `put` all entries into `fm-offline-<version>-<digest>`. On any failure: delete that cache and reject. | C-07, FR-011, FR-015 |
| `install` | Never calls `skipWaiting()`. | C-05, FR-006/007 |
| `activate` | Deletes every cache named `fm-offline-*` other than the current one. Never calls `clients.claim()`. | FR-012, C-05 |
| `message` | No handler. The page never asks the worker to do anything. | C-05 (no update UI) |
| `sync`, `push`, `periodicsync`, `notificationclick` | No handler. | FR-014 |

## Fetch routing

The routes come from `routeRequest` in `src/lib/offline/precache.ts`.

| Request | Route | Response |
|---|---|---|
| Any method other than `GET` (including `POST /m`) | `pass` | The worker does not call `respondWith`. The browser sends it to the network unchanged. |
| Cross-origin URL | `pass` | Same as above (none exist today). |
| `GET /service-worker.js` | `pass` | Same as above. |
| Navigation, path ending in `/` (not `/`) | `redirect` | `Response.redirect(path without the slash + search, 308)` |
| Navigation, any other path | `page` (key: pathname) | 1. `caches.match(key, { cacheName: current, ignoreSearch: true })`. 2. On a miss, `fetch(request)`. 3. If the network fails, answer `/404.html` from the cache (status 404) when present, else `Response.error()`. In every case, `waitUntil(ensureCopy())` runs too. |
| Any other same-origin `GET` | `asset` (key: pathname) | 1. Cache hit. 2. Otherwise `fetch(request)`. 3. If the network fails, `Response.error()`. |

Guarantees:

- The worker never returns a response it made itself, except the trailing-slash redirect and the
  stored `404.html`. Both are exactly what the host returns online (FR-010, C-08).
- A navigation's query string never affects which page is chosen. The page receives the full URL,
  so `opening.start(location.href)` (ADR 0022) still sees the link.
- `ensureCopy()` fetches only the keys missing from the current cache, applies the install checks,
  and stores the missing entries all together or not at all. It fails silently, and the next
  navigation tries again (C-08, FR-009).
- The worker never reads or writes `localStorage` (FR-008). It sends nothing except fetches of
  list entries from its own origin (FR-014).

## Build-time stamping

- `src/service-worker.ts` holds the string literal `'__FM_BUILD_DIGEST__'` exactly once.
- `scripts/stamp-service-worker.mjs [dir=build]` does three things:
  1. It works out the precache list from the files on disk, using the same mapping as the
     invariant in data-model §1.
  2. It computes the digest.
  3. It replaces the literal in `<dir>/service-worker.js`. It exits 1 when the literal is found
     zero times or more than once, or when `<dir>/404.html` is missing.
- It runs from `pnpm build`, `pnpm build:test` and `scripts/build-next-version.mjs`, always after
  `make-404.mjs`.
