import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import { notes, resetNotesForTests } from '../../../src/lib/state/notes.svelte';
import { initialNotesView } from '../../../src/lib/state/notes-view';
import { playback, resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';
import { preferences, resetPreferencesForTests } from '../../../src/lib/state/preferences.svelte';

beforeEach(() => {
  vi.restoreAllMocks();
  resetPlaybackForTests();
  resetPreferencesForTests();
  resetNotesForTests();
});

describe('notes.receive (023 T1)', () => {
  it('state equals the given view', () => {
    const view = {
      ...initialNotesView(STANDARD_GUITAR),
      selection: [0, 4, 7],
      labelType: 'octave' as const,
      hideNames: true
    };
    notes.receive(view);
    expect(notes.state).toEqual(view);
  });

  it('writes nothing and does not stop playback', () => {
    const remember = vi.spyOn(preferences, 'remember');
    const stop = vi.spyOn(playback, 'stop');
    notes.receive({ ...initialNotesView(STANDARD_GUITAR), selection: [2] });
    expect(remember).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  it('leaves the remembered label type alone: reset still uses it', () => {
    notes.restoreLabelType('octave');
    notes.receive({ ...initialNotesView(STANDARD_GUITAR), labelType: 'none' });
    expect(notes.state.labelType).toBe('none');
    notes.reset();
    expect(notes.state.labelType).toBe('octave');
  });

  it('revalidates against the current instrument', () => {
    notes.receive({
      ...initialNotesView(STANDARD_GUITAR),
      region: { start: 0, end: 99 }
    });
    expect(notes.state.region.end).toBeLessThanOrEqual(notes.instrument.fretCount);
  });
});
