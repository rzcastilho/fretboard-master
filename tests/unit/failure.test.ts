// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { recordFailure } from '../../src/lib/shell/failure';

afterEach(() => vi.restoreAllMocks());

describe('recordFailure', () => {
  it('builds a record from an Error and logs once to the console', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const record = recordFailure('triads', new Error('x'));
    expect(record).toEqual({ name: 'Error', message: 'x', tool: 'triads' });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('[fretboard-master] failure', record);
  });

  it('maps non-Error input to UnknownError, truncated to 500 chars', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const record = recordFailure(null, 'y'.repeat(600));
    expect(record.name).toBe('UnknownError');
    expect(record.message).toBe('y'.repeat(500));
    expect(record.tool).toBeNull();
  });

  it('touches neither fetch nor storage', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    recordFailure('notes', new Error('z'));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
