import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import { presetInstrument } from '../../../src/lib/instrument/tunings';
import { DEFAULT_CONFIG } from '../../../src/lib/state/instrument-config';
import { instrument, resetInstrumentForTests } from '../../../src/lib/state/instrument.svelte';
import { notes, resetNotesForTests } from '../../../src/lib/state/notes.svelte';
import { playback, resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';
import { resetTriadsForTests, triads } from '../../../src/lib/state/triads.svelte';

beforeEach(() => {
  vi.restoreAllMocks();
  resetPlaybackForTests();
  resetNotesForTests();
  resetTriadsForTests();
  resetInstrumentForTests();
});

function spies(adjNotes = false, adjTriads = false) {
  return {
    stop: vi.spyOn(playback, 'stop'),
    notes: vi.spyOn(notes, 'applyInstrument').mockReturnValue(adjNotes),
    triads: vi.spyOn(triads, 'applyInstrument').mockReturnValue(adjTriads)
  };
}

describe('instrument store (contracts §3)', () => {
  it('starts at DEFAULT_CONFIG (FR-018)', () => {
    expect(instrument.active).toEqual(DEFAULT_CONFIG);
    expect(instrument.current).toBe(STANDARD_GUITAR);
    expect(instrument.panel).toEqual({ open: false });
    expect(instrument.preview).toBeNull();
    expect(instrument.adjustedIn).toBeNull();
  });

  it('preview is non-null only while open and follows pending', () => {
    instrument.open();
    expect(instrument.preview).toBe(STANDARD_GUITAR);
    instrument.selectTuning('AF-4');
    expect(instrument.preview).toBe(presetInstrument('AF-4', 22));
    instrument.stepFrets(-1);
    expect(instrument.preview).toBe(presetInstrument('AF-4', 21));
    instrument.setFrets(12);
    expect(instrument.preview?.fretCount).toBe(12);
    instrument.restoreDefault();
    expect(instrument.preview).toBe(STANDARD_GUITAR);
    instrument.cancel();
    expect(instrument.preview).toBeNull();
  });

  it('cancel keeps active (SC-005)', () => {
    instrument.open();
    instrument.selectTuning('AF-9');
    instrument.cancel();
    expect(instrument.active).toEqual(DEFAULT_CONFIG);
    expect(instrument.current).toBe(STANDARD_GUITAR);
  });

  it('confirm with pending equal to active: nothing called, adjustedIn unchanged', () => {
    const s = spies();
    instrument.open();
    instrument.confirm('notes');
    expect(s.stop).not.toHaveBeenCalled();
    expect(s.notes).not.toHaveBeenCalled();
    expect(s.triads).not.toHaveBeenCalled();
    expect(instrument.adjustedIn).toBeNull();
    expect(instrument.panel).toEqual({ open: false });
  });

  it('confirm changed and valid: stop once, both stores, adjustedIn null', () => {
    const s = spies();
    instrument.open();
    instrument.selectTuning('AF-4');
    instrument.confirm('triads');
    expect(s.stop).toHaveBeenCalledTimes(1);
    expect(s.stop).toHaveBeenCalledWith('instrument');
    const inst = presetInstrument('AF-4', 22);
    expect(s.notes).toHaveBeenCalledWith(inst);
    expect(s.triads).toHaveBeenCalledWith(inst);
    expect(instrument.active).toEqual({ tuningId: 'AF-4', fretCount: 22 });
    expect(instrument.current).toBe(inst);
    expect(instrument.adjustedIn).toBeNull();
  });

  it('confirm: current tool adjusted → adjustedIn is that tool', () => {
    spies(true, false);
    instrument.open();
    instrument.setFrets(12);
    instrument.confirm('notes');
    expect(instrument.adjustedIn).toBe('notes');

    resetInstrumentForTests();
    vi.restoreAllMocks();
    spies(false, true);
    instrument.open();
    instrument.setFrets(12);
    instrument.confirm('triads');
    expect(instrument.adjustedIn).toBe('triads');
  });

  it('confirm: only the other tool adjusted → adjustedIn null', () => {
    spies(false, true);
    instrument.open();
    instrument.setFrets(12);
    instrument.confirm('notes');
    expect(instrument.adjustedIn).toBeNull();
  });

  it('confirm on a non-tool screen never sets adjustedIn', () => {
    spies(true, true);
    instrument.open();
    instrument.setFrets(12);
    instrument.confirm('home');
    expect(instrument.adjustedIn).toBeNull();
  });

  it('dismissAdjusted clears; resetInstrumentForTests resets', () => {
    spies(true, false);
    instrument.open();
    instrument.setFrets(12);
    instrument.confirm('notes');
    expect(instrument.adjustedIn).toBe('notes');
    instrument.dismissAdjusted();
    expect(instrument.adjustedIn).toBeNull();

    instrument.open();
    instrument.selectTuning('AF-2');
    instrument.confirm('notes');
    resetInstrumentForTests();
    expect(instrument.active).toEqual(DEFAULT_CONFIG);
    expect(instrument.panel).toEqual({ open: false });
    expect(instrument.adjustedIn).toBeNull();
  });
});

describe('adjustedIn lifecycle (US4, R-05)', () => {
  it('is cleared at the start of the next confirm', () => {
    spies(true, false);
    instrument.open();
    instrument.setFrets(12);
    instrument.confirm('notes');
    expect(instrument.adjustedIn).toBe('notes');
    instrument.open();
    instrument.setFrets(15);
    vi.spyOn(notes, 'applyInstrument').mockReturnValue(false);
    instrument.confirm('notes');
    expect(instrument.adjustedIn).toBeNull();
  });

  it('a confirm with no change also clears a previous notice', () => {
    spies(true, false);
    instrument.open();
    instrument.setFrets(12);
    instrument.confirm('notes');
    expect(instrument.adjustedIn).toBe('notes');
    instrument.open();
    instrument.confirm('notes');
    expect(instrument.adjustedIn).toBeNull();
  });

  it('screenChanged clears the notice', () => {
    spies(true, false);
    instrument.open();
    instrument.setFrets(12);
    instrument.confirm('notes');
    instrument.screenChanged();
    expect(instrument.adjustedIn).toBeNull();
  });
});
