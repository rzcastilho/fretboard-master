import { describe, expect, it } from 'vitest';
import { missingFromCopy } from '$lib/offline/precache';

describe('missingFromCopy', () => {
  const list = ['/a', '/b', '/c', '/d'];
  it('returns the missing paths in list order', () => {
    expect(missingFromCopy(list, ['/d', '/b'])).toEqual(['/a', '/c']);
  });
  it('returns everything when nothing is stored', () => {
    expect(missingFromCopy(list, [])).toEqual(list);
  });
  it('returns an empty array when the copy is complete', () => {
    expect(missingFromCopy(list, new Set(['/c', '/a', '/b', '/d', '/extra']))).toEqual([]);
  });
});
