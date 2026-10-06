import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AF_8 } from '../../../src/lib/instrument/fixtures';
import { caged, resetCagedForTests } from '../../../src/lib/state/caged.svelte';
import { initialCagedView } from '../../../src/lib/state/caged-view';
import { playback, resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';
import { preferences, resetPreferencesForTests } from '../../../src/lib/state/preferences.svelte';

beforeEach(() => {
  vi.restoreAllMocks();
  resetPlaybackForTests();
  resetPreferencesForTests();
  resetCagedForTests();
});

const view = () => ({
  ...initialCagedView('interval'),
  rootPc: 2,
  quality: 'major' as const,
  focus: { letter: 'E' as const, ordinal: 0 },
  labelType: 'name' as const
});

describe('caged.receive (023 T2)', () => {
  it('state equals the given view and temporary is false for a compatible tuning', () => {
    caged.receive(view(), true);
    expect(caged.state).toEqual(view());
    expect(caged.temporary).toBe(false);
  });

  it('writes nothing and does not stop playback', () => {
    const remember = vi.spyOn(preferences, 'remember');
    const stop = vi.spyOn(playback, 'stop');
    caged.receive(view(), false);
    expect(remember).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  it('leaves the remembered label type alone: reset still uses it', () => {
    caged.restoreLabelType('interval');
    caged.receive(view(), false);
    expect(caged.state.labelType).toBe('name');
    caged.reset();
    expect(caged.state.labelType).toBe('interval');
  });

  describe('non-compatible tuning', () => {
    beforeEach(() => resetCagedForTests(AF_8, { kind: 'preset', id: 'AF-8' }));

    it('temporary is true iff requested', () => {
      expect(caged.display.tuningClass).toBe('non-compatible');
      caged.receive({ ...view(), focus: null }, true);
      expect(caged.temporary).toBe(true);
      caged.receive({ ...view(), focus: null }, false);
      expect(caged.temporary).toBe(false);
    });
  });

  it('clears transients', () => {
    caged.toggleLayer('scale');
    caged.receive({ ...view(), focus: null }, false);
    expect(caged.reveal).toBeNull();
    expect(caged.transition).toBeNull();
    expect(caged.triadChange).toBeNull();
  });
});
