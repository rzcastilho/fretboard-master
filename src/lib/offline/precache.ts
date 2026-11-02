/**
 * Pure helpers for the offline copy (040). No DOM, Svelte or storage: the service worker and the
 * unit tests both import this file.
 */

/** Inputs, exactly as `$service-worker` exports them. */
export interface PrecacheSources {
  build: readonly string[];
  files: readonly string[];
  prerendered: readonly string[];
}

export type PrecacheList = readonly string[];

export const CACHE_PREFIX = 'fm-offline-';

const NEVER_CACHED = new Set(['/service-worker.js', '/_headers']);

/** Sorted, de-duplicated list of the pathnames that make up one version's offline copy. */
export function precacheList(sources: PrecacheSources): PrecacheList {
  // Kit's lists leave out `_app/version.json` here, though it is in the build (R-02).
  const out = new Set<string>(['/_app/version.json']);
  for (const raw of [...sources.build, ...sources.files, ...sources.prerendered]) {
    const path = raw === '/__not-found' ? '/404.html' : raw;
    if (!path.startsWith('/') || NEVER_CACHED.has(path)) continue;
    out.add(path);
  }
  return [...out].sort();
}

export function cacheName(version: string, digest: string): string {
  return `${CACHE_PREFIX}${version}-${digest}`;
}

export function isOwnStaleCache(name: string, current: string): boolean {
  return name.startsWith(CACHE_PREFIX) && name !== current;
}

export interface RequestInfo {
  method: string;
  url: string;
  mode: RequestMode;
  origin: string;
}

export type Route =
  | { kind: 'pass' }
  | { kind: 'redirect'; location: string }
  | { kind: 'page'; key: string }
  | { kind: 'asset'; key: string };

/** Decide how the worker answers a request. The worker only carries out the result. */
export function routeRequest(info: RequestInfo): Route {
  if (info.method !== 'GET') return { kind: 'pass' };
  const url = new URL(info.url);
  if (url.origin !== info.origin) return { kind: 'pass' };
  if (url.pathname === '/service-worker.js') return { kind: 'pass' };
  if (info.mode === 'navigate') {
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      return { kind: 'redirect', location: url.pathname.slice(0, -1) + url.search };
    }
    return { kind: 'page', key: url.pathname };
  }
  return { kind: 'asset', key: url.pathname };
}

/** True when every `/_app/immutable/*` reference in the HTML is in the list. */
export function pageReferencesWithin(html: string, list: PrecacheList): boolean {
  const known = new Set(list);
  for (const match of html.matchAll(/\/_app\/immutable\/[^"'\s?#)<>]+/g)) {
    if (!known.has(match[0])) return false;
  }
  return true;
}

/** The list paths not yet stored, in list order. Empty when the copy is complete. */
export function missingFromCopy(list: PrecacheList, storedPaths: Iterable<string>): string[] {
  const stored = new Set(storedPaths);
  return list.filter((p) => !stored.has(p));
}
