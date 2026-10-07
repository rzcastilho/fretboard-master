// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (e: { matches: boolean }) => void;

function stubMatchMedia(initial = false) {
  const listeners = new Set<Listener>();
  const mql = {
    matches: initial,
    addEventListener: vi.fn((_t: string, l: Listener) => listeners.add(l)),
    removeEventListener: vi.fn((_t: string, l: Listener) => listeners.delete(l))
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => mql)
  );
  window.matchMedia = globalThis.matchMedia;
  return {
    mql,
    emit(matches: boolean) {
      mql.matches = matches;
      for (const l of [...listeners]) l({ matches });
    }
  };
}

async function freshStore() {
  vi.resetModules();
  return (await import('../../../src/lib/state/print.svelte')).print;
}

describe('print store (026 US5)', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is inactive before start', async () => {
    stubMatchMedia();
    const print = await freshStore();
    expect(print.active).toBe(false);
  });

  it('a matchMedia change to matches activates, back to no match deactivates', async () => {
    const mm = stubMatchMedia();
    const print = await freshStore();
    print.start();
    mm.emit(true);
    expect(print.active).toBe(true);
    mm.emit(false);
    expect(print.active).toBe(false);
  });

  it('starts active when print media already matches', async () => {
    stubMatchMedia(true);
    const print = await freshStore();
    print.start();
    expect(print.active).toBe(true);
  });

  it('beforeprint sets active, afterprint clears it', async () => {
    stubMatchMedia();
    const print = await freshStore();
    print.start();
    window.dispatchEvent(new Event('beforeprint'));
    expect(print.active).toBe(true);
    window.dispatchEvent(new Event('afterprint'));
    expect(print.active).toBe(false);
  });

  it('start() twice registers listeners once', async () => {
    const mm = stubMatchMedia();
    const add = vi.spyOn(window, 'addEventListener');
    const print = await freshStore();
    print.start();
    print.start();
    expect(mm.mql.addEventListener).toHaveBeenCalledTimes(1);
    const printEvents = add.mock.calls.filter(([t]) => t === 'beforeprint' || t === 'afterprint');
    expect(printEvents).toHaveLength(2);
    add.mockRestore();
  });

  it('is a no-op without window', async () => {
    const print = await freshStore();
    vi.stubGlobal('window', undefined);
    expect(() => print.start()).not.toThrow();
    expect(print.active).toBe(false);
  });
});
