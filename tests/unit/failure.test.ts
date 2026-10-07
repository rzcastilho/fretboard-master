// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { measure } from '../../src/lib/measure/measure.svelte';
import { markCalculation, recordFailure } from '../../src/lib/shell/failure';

afterEach(() => vi.restoreAllMocks());

describe('recordFailure reporting', () => {
  it('reports drawing by default, calculation when marked, audio when passed', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const report = vi.spyOn(measure, 'report').mockImplementation(() => {});
    const plain = new Error('p');
    recordFailure('triads', plain);
    const calc = new Error('c');
    expect(() =>
      markCalculation(() => {
        throw calc;
      })
    ).toThrow(calc);
    recordFailure('notes', calc);
    const aud = new Error('a');
    recordFailure('caged', aud, 'audio');
    expect(report.mock.calls.map(([r]) => [r.kind, r.tool, r.error])).toEqual([
      ['drawing', 'triads', plain],
      ['calculation', 'notes', calc],
      ['audio', 'caged', aud]
    ]);
  });

  it('passes a null tool through (the facade maps it to shell) and any non-Error value', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const report = vi.spyOn(measure, 'report').mockImplementation(() => {});
    recordFailure(null, 'boom');
    expect(report).toHaveBeenCalledWith({ kind: 'drawing', tool: null, error: 'boom' });
  });

  it('markCalculation returns the value when nothing throws', () => {
    expect(markCalculation(() => 7)).toBe(7);
  });
});

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
