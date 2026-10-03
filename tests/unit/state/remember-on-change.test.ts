import { beforeEach, describe, expect, it, vi } from 'vitest';
import { instrument, resetInstrumentForTests } from '../../../src/lib/state/instrument.svelte';
import { notes, resetNotesForTests } from '../../../src/lib/state/notes.svelte';
import { playback, resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';
import { preferences } from '../../../src/lib/state/preferences.svelte';
import { resetTriadsForTests, triads } from '../../../src/lib/state/triads.svelte';

let remember: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.restoreAllMocks();
  resetPlaybackForTests();
  resetNotesForTests();
  resetTriadsForTests();
  resetInstrumentForTests();
  remember = vi.spyOn(preferences, 'remember');
});

describe('remember on change (FR-019)', () => {
  it('instrument.confirm remembers tuning and frets only when changed', () => {
    instrument.open();
    instrument.confirm('home');
    expect(remember).not.toHaveBeenCalled();
    instrument.open();
    instrument.selectTuning('AF-4');
    instrument.setFrets(16);
    expect(remember).not.toHaveBeenCalled(); // pending panel edits are not written
    instrument.confirm('home');
    expect(remember).toHaveBeenCalledTimes(1);
    expect(remember).toHaveBeenCalledWith({
      stringCount: 6,
      tuningId: 'AF-4',
      customTuning: null,
      fretCount: 16
    });
  });

  it('cancelling the panel writes nothing', () => {
    instrument.open();
    instrument.selectTuning('AF-4');
    instrument.cancel();
    expect(remember).not.toHaveBeenCalled();
  });

  it('playback.setMuted and setVolume remember (volume on the control scale)', () => {
    playback.setMuted(true);
    expect(remember).toHaveBeenLastCalledWith({ muted: true });
    playback.setVolume(40);
    expect(remember).toHaveBeenLastCalledWith({ volume: 40 });
  });

  it('notes and triads setLabelType remember their own label', () => {
    notes.setLabelType('octave');
    expect(remember).toHaveBeenLastCalledWith({ labels: { notes: 'octave' } });
    triads.setLabelType('name');
    expect(remember).toHaveBeenLastCalledWith({ labels: { triads: 'name' } });
  });

  it('view actions, carries and restores do not remember', () => {
    notes.toggleNote(7);
    notes.setHideNames(true);
    triads.restoreLabelType('name');
    notes.restoreLabelType('name');
    playback.restore({ muted: true, volume: 20 });
    instrument.restore({ stringCount: 6, tuning: { kind: 'preset', id: 'AF-4' }, fretCount: 12 });
    expect(remember).not.toHaveBeenCalled();
  });
});
