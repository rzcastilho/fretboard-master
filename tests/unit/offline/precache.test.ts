import { describe, expect, it } from 'vitest';
import { cacheName, isOwnStaleCache, precacheList } from '$lib/offline/precache';

const base = {
  build: ['/_app/immutable/b.js', '/_app/immutable/a.js'],
  files: ['/theme-boot.js', '/favicon.svg'],
  prerendered: ['/', '/notes', '/__not-found']
};

describe('precacheList', () => {
  it('renames /__not-found to /404.html and nothing else', () => {
    const list = precacheList(base);
    expect(list).toContain('/404.html');
    expect(list).not.toContain('/__not-found');
    expect(list).toContain('/notes');
    expect(list).toContain('/');
  });

  it('always holds /_app/version.json, once, even when Kit omits or repeats it', () => {
    expect(precacheList(base).filter((p) => p === '/_app/version.json')).toHaveLength(1);
    const again = precacheList({ ...base, build: [...base.build, '/_app/version.json'] });
    expect(again.filter((p) => p === '/_app/version.json')).toHaveLength(1);
  });

  it('drops the worker and _headers even when given', () => {
    const list = precacheList({
      ...base,
      files: [...base.files, '/service-worker.js', '/_headers']
    });
    expect(list).not.toContain('/service-worker.js');
    expect(list).not.toContain('/_headers');
  });

  it('has no duplicates, is sorted, and every entry starts with /', () => {
    const list = precacheList({ ...base, files: [...base.files, '/notes', '/theme-boot.js'] });
    expect(new Set(list).size).toBe(list.length);
    expect([...list]).toEqual([...list].sort());
    expect(list.every((p) => p.startsWith('/'))).toBe(true);
  });
});

describe('cacheName', () => {
  it('joins prefix, version and digest', () => {
    expect(cacheName('0.1.0', 'abc123def456')).toBe('fm-offline-0.1.0-abc123def456');
  });
  it('changes when only the digest changes', () => {
    expect(cacheName('0.1.0', 'aaaaaaaaaaaa')).not.toBe(cacheName('0.1.0', 'bbbbbbbbbbbb'));
  });
});

describe('isOwnStaleCache', () => {
  const current = 'fm-offline-0.1.0-abc123def456';
  it('is true for other fm-offline- names', () => {
    expect(isOwnStaleCache('fm-offline-0.0.9-000000000000', current)).toBe(true);
  });
  it('is false for the current name', () => {
    expect(isOwnStaleCache(current, current)).toBe(false);
  });
  it('is false for foreign caches', () => {
    expect(isOwnStaleCache('workbox-precache', current)).toBe(false);
  });
});
