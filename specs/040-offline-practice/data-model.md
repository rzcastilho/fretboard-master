# Data Model: Practise Offline (040)

No server data and no change to `localStorage`. The entities below live in the browser's Cache
Storage, in the service-worker registration, and in two static files. Types are given as
TypeScript for the pure module `src/lib/offline/precache.ts`.

## 1. Precache entry list

The pathnames that make up one version's offline copy (spec entity **Offline copy**; C-02).

```ts
/** Inputs, exactly as `$service-worker` exports them. */
interface PrecacheSources {
  build: readonly string[]; // '/_app/immutable/…', plus '/_app/version.json' when Kit emits it
  files: readonly string[]; // static files, with '_headers' already removed by kit.serviceWorker.files
  prerendered: readonly string[]; // '/', '/notes', …, '/__not-found'
}

/** Sorted, de-duplicated, every entry starts with '/'. */
type PrecacheList = readonly string[];

function precacheList(sources: PrecacheSources): PrecacheList;
```

Rules:

- `'/__not-found'` → `'/404.html'`. No other prerendered path is renamed.
- `'/service-worker.js'` and `'/_headers'` are never in the list. Both are dropped even if an
  input contains them.
- No duplicates. The order is lexicographic, so the output is deterministic for the digest and
  for tests.
- **Invariant (checked in e2e)**: the list equals the files in `build/`, apart from
  `service-worker.js` and `_headers`, with each HTML file mapped to its clean URL:
  - `index.html` → `/`;
  - `<name>.html` → `/<name>`;
  - `404.html` → `/404.html`.

## 2. Offline copy (one cache)

| Field | Value |
|---|---|
| Cache name | `fm-offline-<version>-<digest>` (§3) |
| Keys | `new Request(origin + path)` for each path in the precache list |
| Values | A `Response` rebuilt from the fetched body, with the original `content-type`. Status is 200, except `/404.html`, which is 404 |

States:

```text
(absent) ──install fetches all OK + consistent──▶ complete ──activate (only after all clients closed)──▶ in use
   │                                                                                      │
   └─any fetch/put/check fails──▶ deleted (install rejected; previous copy stays in use)   │
                                                                                          ▼
                                         browser/user clears cache ──▶ missing or partial
                                                                                          │
                                         next online navigation: ensureCopy() fills keys ─┘ ──▶ in use
in use ──newer version activates──▶ deleted (activate removes every other fm-offline-* name)
```

Validation (before any `put`, R-04):

- Every response is `ok`, except `/404.html`, where 200 or 404 is accepted.
- Every stored page (`/`, the clean tool URLs and `/404.html`) references only
  `/_app/immutable/*` paths that are in the list. This is the `pageReferencesWithin(html, list)`
  check.

## 3. Cache name and build digest

```ts
const CACHE_PREFIX = 'fm-offline-';
function cacheName(version: string, digest: string): string; // `${CACHE_PREFIX}${version}-${digest}`
function isOwnStaleCache(name: string, current: string): boolean; // startsWith(prefix) && name !== current
```

- `version` is `$service-worker`'s `version`, which is `kit.version.name`: the `package.json`
  version, or `FM_APP_VERSION` in `--mode test` builds.
- `digest`: 12 lowercase hex characters, the start of SHA-256 over
  `path + '\0' + bytes + '\0'` for each path in the sorted precache list. It is computed by
  `scripts/stamp-service-worker.mjs` after `make-404.mjs` and written into
  `build/service-worker.js` in place of the single `__FM_BUILD_DIGEST__` literal.
- The script exits non-zero when the literal is not found exactly once. A forgotten stamp then
  fails the build instead of shipping a worker whose cache name never changes.

## 4. Request route

```ts
type RequestInfo = { method: string; url: string; mode: RequestMode; origin: string };
type Route =
  | { kind: 'pass' } // not GET, cross-origin, or /service-worker.js — no respondWith
  | { kind: 'redirect'; location: string } // navigation with trailing slash → 308 to path without it (query kept)
  | { kind: 'page'; key: string } // navigation: key = pathname (query ignored)
  | { kind: 'asset'; key: string }; // other same-origin GET: key = pathname
function routeRequest(info: RequestInfo): Route;
```

How each route is answered is set out in [contracts/service-worker.md](contracts/service-worker.md).

## 5. Pending update

The spec entity **Pending update** is the browser's `registration.waiting`: a worker with its own
complete cache that is not yet active. The app keeps no state for it. It becomes active only when
no client of the old worker is left (C-05). Nothing in the page reads it or responds to it. There
is no prompt and no reload.

## 6. Home-screen entry

`static/manifest.webmanifest`. The fields are in
[contracts/web-app-manifest.md](contracts/web-app-manifest.md).

## 7. Registration (page side)

```ts
interface OfflineHost {
  navigator: { serviceWorker?: Pick<ServiceWorkerContainer, 'register'> };
  document: Pick<Document, 'readyState'>;
  addEventListener(type: 'load', fn: () => void, opts: { once: true }): void;
}
function registerOffline(host: OfflineHost, dev: boolean): void; // never throws, returns nothing
```

There is no state in `src/lib/state` and no new preference. `localStorage` keys and the
preferences format version are unchanged (FR-008).
