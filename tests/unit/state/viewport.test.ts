// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { instrument, resetInstrumentForTests } from '../../../src/lib/state/instrument.svelte';
import { setViewportForTests, viewport } from '../../../src/lib/state/viewport.svelte';

afterEach(() => {
  setViewportForTests();
  resetInstrumentForTests();
});

describe('viewport store', () => {
  it('prerender default has no arrangement', () => {
    expect(viewport.width).toBe(0);
    expect(viewport.rootPx).toBe(16);
    expect(viewport.arrangement).toBeUndefined();
  });

  it('derives the arrangement from size and the active instrument', () => {
    setViewportForTests({ width: 390, height: 844 });
    expect(viewport.arrangement).toBe('reflow');
    setViewportForTests({ width: 844, height: 390 });
    expect(viewport.arrangement).toBe('reflow');
    setViewportForTests({ width: 1023, height: 1280 });
    expect(viewport.arrangement).toBe('reflow');
    expect(instrument.current.fretCount).toBeGreaterThan(0);
    setViewportForTests({ width: 2560, height: 1440 });
    expect(viewport.arrangement).toBe('wide-side');
  });
});
