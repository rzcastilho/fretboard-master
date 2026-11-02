import { describe, expect, it } from 'vitest';
import { pageReferencesWithin } from '$lib/offline/precache';

const list = ['/', '/_app/immutable/a.js', '/_app/immutable/b.css'];

describe('pageReferencesWithin', () => {
  it('is true when every reference is listed', () => {
    const html = '<script src="/_app/immutable/a.js"></script><link href="/_app/immutable/b.css">';
    expect(pageReferencesWithin(html, list)).toBe(true);
  });
  it('is false when one is missing', () => {
    const html = '<script src="/_app/immutable/a.js"></script><script src="/_app/immutable/c.js">';
    expect(pageReferencesWithin(html, list)).toBe(false);
  });
  it('is true with no references', () => {
    expect(pageReferencesWithin('<p>hi</p>', list)).toBe(true);
  });
  it('finds references with queries and in modulepreload, script and link tags', () => {
    expect(
      pageReferencesWithin('<link rel="modulepreload" href="/_app/immutable/z.js?x=1">', list)
    ).toBe(false);
    expect(
      pageReferencesWithin('<link rel="modulepreload" href="/_app/immutable/a.js?x=1">', list)
    ).toBe(true);
    expect(pageReferencesWithin('<script type="module" src="/_app/immutable/q.js">', list)).toBe(
      false
    );
    expect(pageReferencesWithin('<link rel="stylesheet" href="/_app/immutable/q.css">', list)).toBe(
      false
    );
  });
});
