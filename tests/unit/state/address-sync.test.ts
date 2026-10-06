import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const replaceState = vi.hoisted(() => vi.fn());
const pushState = vi.hoisted(() => vi.fn());
const goto = vi.hoisted(() => vi.fn());
const pageState = vi.hoisted(() => ({ state: { panel: true } as Record<string, unknown> }));
vi.mock('$app/navigation', () => ({ replaceState, pushState, goto }));
vi.mock('$app/state', () => ({ page: pageState }));
vi.mock('$app/paths', () => ({ resolve: (p: string) => p }));

import { createAddressSync } from '../../../src/lib/state/address';
import {
  ADDRESS_DEBOUNCE_MS,
  cancelAddress,
  openToolAddress,
  resetAddressForTests,
  scheduleAddress
} from '../../../src/lib/state/address.svelte';
import { currentLink } from '../../../src/lib/state/share.svelte';
import { resetTriadsForTests, triads } from '../../../src/lib/state/triads.svelte';

describe('createAddressSync (A4)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function make(write = vi.fn()) {
    const sync = createAddressSync({
      write,
      delayMs: 150,
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>)
    });
    return { sync, write };
  }

  it('writes once, with the last href, 150 ms after the last call', () => {
    const { sync, write } = make();
    sync.schedule('a');
    vi.advanceTimersByTime(100);
    sync.schedule('b');
    vi.advanceTimersByTime(100);
    expect(write).not.toHaveBeenCalled();
    sync.schedule('c');
    vi.advanceTimersByTime(149);
    expect(write).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith('c');
  });

  it('collapses a burst of 200 schedules into one write', () => {
    const { sync, write } = make();
    for (let i = 0; i < 200; i++) {
      sync.schedule(`h${i}`);
      vi.advanceTimersByTime(1);
    }
    vi.advanceTimersByTime(150);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith('h199');
  });

  it('flush writes pending now; cancel drops it', () => {
    const { sync, write } = make();
    sync.schedule('x');
    sync.flush();
    expect(write).toHaveBeenCalledWith('x');
    vi.advanceTimersByTime(500);
    expect(write).toHaveBeenCalledTimes(1);
    sync.schedule('y');
    sync.cancel();
    vi.advanceTimersByTime(500);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('never propagates a throwing write', () => {
    const { sync } = make(
      vi.fn(() => {
        throw new Error('boom');
      })
    );
    sync.schedule('x');
    expect(() => vi.advanceTimersByTime(200)).not.toThrow();
    expect(() => sync.flush()).not.toThrow();
  });
});

describe('SvelteKit binding (A1–A3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    replaceState.mockReset();
    pushState.mockClear();
    goto.mockClear();
    resetAddressForTests();
    resetTriadsForTests();
    history.replaceState(null, '', '/triads');
  });
  afterEach(() => {
    resetAddressForTests();
    vi.useRealTimers();
  });

  it('debounces at 150 ms', () => {
    expect(ADDRESS_DEBOUNCE_MS).toBe(150);
  });

  it('openToolAddress replaces at once with the canonical link, keeping page.state', async () => {
    openToolAddress('triads');
    await Promise.resolve();
    expect(replaceState).toHaveBeenCalledTimes(1);
    const [url, state] = replaceState.mock.calls[0] as [URL, unknown];
    expect(url.href).toBe(currentLink('triads'));
    expect(state).toBe(pageState.state);
  });

  it('skips a write whose href equals location.href (A2)', async () => {
    openToolAddress('triads');
    await Promise.resolve();
    history.replaceState(null, '', new URL(currentLink('triads')));
    replaceState.mockClear();
    scheduleAddress(currentLink('triads'));
    vi.advanceTimersByTime(200);
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('skips a write whose pathname differs from location.pathname (A2)', () => {
    scheduleAddress(`${location.origin}/caged?v=1`);
    vi.advanceTimersByTime(200);
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('writes the scheduled link with replaceState only (A1)', () => {
    scheduleAddress(`${location.origin}/triads?v=1&inv=second`);
    vi.advanceTimersByTime(200);
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect((replaceState.mock.calls[0][0] as URL).search).toBe('?v=1&inv=second');
    expect(pushState).not.toHaveBeenCalled();
    expect(goto).not.toHaveBeenCalled();
  });

  it('follows a store change through the link builder', () => {
    openToolAddress('triads');
    const before = currentLink('triads');
    triads.setInversion('second');
    expect(currentLink('triads')).not.toBe(before);
  });

  it('a throwing replaceState disables sync until openToolAddress (A3)', async () => {
    replaceState.mockImplementation(() => {
      throw new Error('router not ready');
    });
    expect(() => {
      scheduleAddress(`${location.origin}/triads?v=1&a=1`);
      vi.advanceTimersByTime(200);
    }).not.toThrow();
    expect(replaceState).toHaveBeenCalledTimes(1);
    scheduleAddress(`${location.origin}/triads?v=1&a=2`);
    vi.advanceTimersByTime(200);
    expect(replaceState).toHaveBeenCalledTimes(1);
    replaceState.mockImplementation(() => {});
    openToolAddress('triads');
    await Promise.resolve();
    expect(replaceState).toHaveBeenCalledTimes(2);
  });

  it('cancelAddress drops the pending write', () => {
    scheduleAddress(`${location.origin}/triads?v=1&inv=first`);
    cancelAddress();
    vi.advanceTimersByTime(200);
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('re-schedules the latest link after a popstate', () => {
    scheduleAddress(`${location.origin}/triads?v=1&inv=first`);
    vi.advanceTimersByTime(200);
    openToolAddress('triads'); // registers the listener
    replaceState.mockClear();
    const href = `${location.origin}/triads?v=1&inv=second`;
    scheduleAddress(href);
    vi.advanceTimersByTime(200);
    replaceState.mockClear();
    history.replaceState(null, '', '/triads');
    window.dispatchEvent(new PopStateEvent('popstate'));
    vi.advanceTimersByTime(200);
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect((replaceState.mock.calls[0][0] as URL).href).toBe(href);
  });
});
