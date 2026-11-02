/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
// Offline copy (040). Cache-first with network fallback. No skipWaiting, no clients.claim.
import { build, files, prerendered, version } from '$service-worker';
import {
  cacheName,
  isOwnStaleCache,
  missingFromCopy,
  pageReferencesWithin,
  precacheList,
  routeRequest
} from '$lib/offline/precache';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Replaced once by scripts/stamp-service-worker.mjs.
const DIGEST = '__FM_BUILD_DIGEST__';
const CURRENT = cacheName(version, DIGEST);
const NOT_FOUND = '/404.html';
const LIST = precacheList({ build, files, prerendered });

const isPage = (path: string) => path === NOT_FOUND || !/\.[a-z0-9]+$/i.test(path);

/** Fetch entries one at a time and check them (R-04). Returns path→response, or throws. */
async function fetchEntries(paths: readonly string[]): Promise<Map<string, Response>> {
  const out = new Map<string, Response>();
  for (const path of paths) {
    const res = await fetch(
      new Request(sw.location.origin + path, { cache: 'no-cache', redirect: 'follow' })
    );
    const ok = path === NOT_FOUND ? res.status === 200 || res.status === 404 : res.ok;
    if (!ok) throw new Error(`offline copy: ${path} answered ${res.status}`);
    out.set(path, res);
  }
  // Rebuild each response so no redirected response is stored.
  const rebuilt = new Map<string, Response>();
  for (const [path, res] of out) {
    const body = await res.arrayBuffer();
    if (isPage(path) && !pageReferencesWithin(new TextDecoder().decode(body), LIST)) {
      throw new Error(`offline copy: ${path} references files outside this version`);
    }
    const headers = new Headers();
    const type = res.headers.get('content-type');
    if (type) headers.set('content-type', type);
    rebuilt.set(path, new Response(body, { status: path === NOT_FOUND ? 404 : 200, headers }));
  }
  return rebuilt;
}

async function store(paths: readonly string[]): Promise<void> {
  try {
    const entries = await fetchEntries(paths);
    const cache = await caches.open(CURRENT);
    for (const [path, res] of entries) await cache.put(new Request(sw.location.origin + path), res);
  } catch (error) {
    await caches.delete(CURRENT);
    throw error;
  }
}

sw.addEventListener('install', (event) => {
  event.waitUntil(store(LIST));
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((n) => isOwnStaleCache(n, CURRENT)).map((n) => caches.delete(n)))
      )
  );
});

sw.addEventListener('fetch', (event) => {
  const { request } = event;
  const route = routeRequest({
    method: request.method,
    url: request.url,
    mode: request.mode,
    origin: sw.location.origin
  });
  if (route.kind === 'pass') return;
  if (route.kind === 'redirect') {
    event.respondWith(Response.redirect(sw.location.origin + route.location, 308));
    return;
  }
  event.respondWith(answer(request, route.key, route.kind === 'page'));
  if (route.kind === 'page') event.waitUntil(ensureCopy());
});

async function answer(request: Request, key: string, page: boolean): Promise<Response> {
  const hit = await caches.match(new Request(sw.location.origin + key), {
    cacheName: CURRENT,
    ignoreSearch: true
  });
  if (hit) return hit;
  try {
    return await fetch(request);
  } catch {
    if (page) {
      const fallback = await caches.match(new Request(sw.location.origin + NOT_FOUND), {
        cacheName: CURRENT
      });
      if (fallback) return fallback;
    }
    return Response.error();
  }
}

/** Refill keys missing from the current cache (R-07). Fails silently; the next navigation retries. */
async function ensureCopy(): Promise<void> {
  try {
    const cache = await caches.open(CURRENT);
    const stored = (await cache.keys()).map((r) => new URL(r.url).pathname);
    const missing = missingFromCopy(LIST, stored);
    if (missing.length === 0) return;
    const entries = await fetchEntries(missing);
    for (const [path, res] of entries) await cache.put(new Request(sw.location.origin + path), res);
  } catch {
    /* offline or inconsistent: try again on the next navigation */
  }
}
