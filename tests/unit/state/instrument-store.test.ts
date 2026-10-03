import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import { presetInstrument } from '../../../src/lib/instrument/tunings';
import { DEFAULT_CONFIG } from '../../../src/lib/state/instrument-config';
import { instrument, resetInstrumentForTests } from '../../../src/lib/state/instrument.svelte';
import { notes, resetNotesForTests } from '../../../src/lib/state/notes.svelte';
import { playback, resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';
import { preferences, resetPreferencesForTests } from '../../../src/lib/state/preferences.svelte';
import { resetTriadsForTests, triads } from '../../../src/lib/state/triads.svelte';
import { PREFS_KEY } from '../../../src/lib/prefs/storage';
import { fakeStorage } from '../prefs/support';

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
    expect(instrument.active).toEqual({ tuning: { kind: 'preset', id: 'AF-4' }, fretCount: 22 });
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

describe('instrument.restore (010)', () => {
  it('sets active, applies to Notes/Triads, no notice, no stop', () => {
    const s = spies(true, true);
    const config = { tuning: { kind: 'preset', id: 'AF-3' }, fretCount: 24 } as const;
    instrument.restore(config);
    expect(instrument.active).toEqual(config);
    expect(instrument.current).toEqual(presetInstrument('AF-3', 24));
    expect(s.notes).toHaveBeenCalledTimes(1);
    expect(s.triads).toHaveBeenCalledTimes(1);
    expect(instrument.adjustedIn).toBeNull();
    expect(s.stop).not.toHaveBeenCalled();
  });

  it('is a no-op for the active config', () => {
    const s = spies();
    instrument.restore(DEFAULT_CONFIG);
    expect(s.notes).not.toHaveBeenCalled();
  });
});

describe('custom tuning (011 US1)', () => {
  it('chooseCustom + stepString: returns true iff the pitch changed', () => {
    instrument.open();
    instrument.chooseCustom();
    expect(instrument.stepString(6, -1)).toBe(true);
    expect(instrument.stepString(6, 1)).toBe(true);
    for (let i = 0; i < 7; i++) instrument.stepString(6, -1);
    expect(instrument.stepString(6, -1)).toBe(false);
    expect(instrument.panel.open && instrument.panel.customOpen).toBe(true);
  });

  it('stepString on a closed panel returns false', () => {
    expect(instrument.stepString(6, -1)).toBe(false);
  });

  it('preview follows the pending pitches', () => {
    instrument.open();
    instrument.chooseCustom();
    instrument.stepString(6, -1);
    instrument.stepString(6, -1);
    expect(instrument.preview?.openStrings[5]).toMatchObject({
      letter: 'D',
      accidental: 0,
      octave: 2
    });
  });

  it('confirm applies the custom tuning to Notes and Triads (AS 1.2)', () => {
    const s = spies();
    instrument.open();
    instrument.chooseCustom();
    instrument.stepString(1, 1);
    instrument.confirm('notes');
    const inst = instrument.current;
    expect(instrument.active.tuning).toEqual({ kind: 'custom', offsets: [0, 0, 0, 0, 0, 1] });
    expect(s.notes).toHaveBeenCalledWith(inst);
    expect(s.triads).toHaveBeenCalledWith(inst);
  });

  it('close without confirm keeps the previous instrument (AS 1.5)', () => {
    instrument.open();
    instrument.chooseCustom();
    instrument.stepString(6, -1);
    instrument.cancel();
    expect(instrument.active).toEqual(DEFAULT_CONFIG);
    expect(instrument.current).toBe(STANDARD_GUITAR);
  });

  it('confirm with identical pitches rewrites nothing and shows no notice', () => {
    const s = spies(true, true);
    instrument.open();
    instrument.chooseCustom();
    instrument.stepString(6, -1);
    instrument.stepString(6, 1);
    instrument.confirm('notes');
    expect(s.stop).not.toHaveBeenCalled();
    expect(s.notes).not.toHaveBeenCalled();
    expect(instrument.adjustedIn).toBeNull();
  });
});

describe('instrument store: playString (US2, FR-7.9)', () => {
  const note = () => vi.spyOn(playback, 'note').mockReturnValue([]);

  it('plays the open string of the pending preview instrument', () => {
    const n = note();
    instrument.open();
    instrument.chooseCustom();
    instrument.stepString(6, -1);
    instrument.stepString(6, -1);
    instrument.playString(6);
    expect(n).toHaveBeenCalledTimes(1);
    expect(n).toHaveBeenCalledWith({ string: 6, fret: 0 }, instrument.preview);
    expect(instrument.preview?.openStrings[5]).toEqual(
      instrument.rows.find((r) => r.string === 6)?.pitch
    );
  });

  it('is a no-op when the panel is closed', () => {
    const n = note();
    instrument.playString(3);
    expect(n).not.toHaveBeenCalled();
  });

  it('every new request goes through playback.note (engine replaces the previous sound)', () => {
    const n = note();
    instrument.open();
    instrument.chooseCustom();
    instrument.playString(6);
    instrument.playString(5);
    expect(n).toHaveBeenCalledTimes(2);
    expect(n.mock.calls[1][0]).toEqual({ string: 5, fret: 0 });
  });

  it('does not change pending, mute or volume', () => {
    note();
    instrument.open();
    instrument.chooseCustom();
    const before = instrument.panel;
    instrument.playString(2);
    expect(instrument.panel).toBe(before);
    expect(playback.muted).toBe(false);
  });

  it('plays the pitch shown for all 72 positions (SC-002)', () => {
    const n = note();
    for (const string of [1, 2, 3, 4, 5, 6] as const) {
      for (const dir of [-1, 1] as const) {
        resetInstrumentForTests();
        instrument.open();
        instrument.chooseCustom();
        instrument.playString(string);
        while (instrument.stepString(string, dir)) instrument.playString(string);
      }
    }
    expect(n.mock.calls.length).toBeGreaterThan(0);
    for (const [pos, inst] of n.mock.calls) {
      expect(pos.fret).toBe(0);
      expect(inst.openStrings[pos.string - 1]).toBeDefined();
    }
  });
});

describe('instrument store: remembering a custom tuning (011 US5)', () => {
  const stored = (s: ReturnType<typeof fakeStorage>) =>
    JSON.parse(s.data.get(PREFS_KEY) as string) as Record<string, unknown>;

  beforeEach(() => {
    resetPreferencesForTests();
  });

  it('confirming an unmatched tuning writes AF-1 and customTuning', () => {
    const s = fakeStorage();
    preferences.start(s);
    instrument.open();
    instrument.chooseCustom();
    instrument.stepString(6, -1);
    instrument.stepString(4, -1);
    instrument.confirm('notes');
    const r = stored(s);
    expect(r.tuning).toBe('AF-1');
    expect(r.customTuning).toEqual([-1, 0, -1, 0, 0, 0]);
  });

  it('confirming a matched tuning writes the preset id and no customTuning', () => {
    const s = fakeStorage();
    preferences.start(s);
    instrument.open();
    instrument.chooseCustom();
    instrument.stepString(6, -1);
    instrument.stepString(6, -1);
    instrument.confirm('notes');
    const r = stored(s);
    expect(r.tuning).toBe('AF-4');
    expect(r).not.toHaveProperty('customTuning');
  });

  it('going from custom back to a preset drops customTuning', () => {
    const s = fakeStorage();
    preferences.start(s);
    instrument.open();
    instrument.chooseCustom();
    instrument.stepString(6, -1);
    instrument.confirm('notes');
    expect(stored(s)).toHaveProperty('customTuning');
    instrument.open();
    instrument.selectTuning('AF-3');
    instrument.confirm('notes');
    const r = stored(s);
    expect(r.tuning).toBe('AF-3');
    expect(r).not.toHaveProperty('customTuning');
  });

  it('confirming Standard writes AF-1 and no customTuning', () => {
    const s = fakeStorage();
    preferences.start(s);
    instrument.open();
    instrument.chooseCustom();
    instrument.stepString(1, 1);
    instrument.confirm('notes');
    instrument.open();
    instrument.restoreDefault();
    instrument.confirm('notes');
    const r = stored(s);
    expect(r.tuning).toBe('AF-1');
    expect(r).not.toHaveProperty('customTuning');
  });

  it('blocked storage still applies the tuning for the session (AS 5.6)', () => {
    const s = fakeStorage();
    s.fail.set = true;
    preferences.start(s);
    instrument.open();
    instrument.chooseCustom();
    instrument.stepString(2, 1);
    expect(() => instrument.confirm('notes')).not.toThrow();
    expect(instrument.active.tuning).toEqual({ kind: 'custom', offsets: [0, 0, 0, 0, 1, 0] });
  });
});
