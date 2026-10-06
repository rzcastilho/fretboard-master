import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import { playback, resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';
import { preferences, resetPreferencesForTests } from '../../../src/lib/state/preferences.svelte';
import { resetTriadsForTests, triads } from '../../../src/lib/state/triads.svelte';
import { initialTriadsView } from '../../../src/lib/state/triads-view';

beforeEach(() => {
  vi.restoreAllMocks();
  resetPlaybackForTests();
  resetPreferencesForTests();
  resetTriadsForTests();
});

describe('triads.receive (023 T1)', () => {
  it('state equals the given view', () => {
    const view = {
      ...initialTriadsView(STANDARD_GUITAR),
      rootPc: 2,
      quality: 'minor' as const,
      labelType: 'name' as const
    };
    triads.receive(view);
    expect(triads.state).toEqual(view);
  });

  it('writes nothing and does not stop playback', () => {
    const remember = vi.spyOn(preferences, 'remember');
    const stop = vi.spyOn(playback, 'stop');
    triads.receive({ ...initialTriadsView(STANDARD_GUITAR), rootPc: 5 });
    expect(remember).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  it('leaves the remembered label type alone: reset still uses it', () => {
    triads.restoreLabelType('name');
    triads.receive({ ...initialTriadsView(STANDARD_GUITAR), labelType: 'interval' });
    expect(triads.state.labelType).toBe('interval');
    triads.reset();
    expect(triads.state.labelType).toBe('name');
  });

  it('clears the notice', () => {
    triads.setCompare(true);
    triads.setQuality('minor');
    triads.receive(initialTriadsView(STANDARD_GUITAR));
    expect(triads.notice).toBeNull();
  });
});
