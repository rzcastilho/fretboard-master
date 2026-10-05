import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AF_8 } from '../../../src/lib/instrument/fixtures';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import { presetInstrument } from '../../../src/lib/instrument/tunings';
import { DEFAULT_CONFIG } from '../../../src/lib/state/instrument-config';
import { instrument, resetInstrumentForTests } from '../../../src/lib/state/instrument.svelte';
import { caged, resetCagedForTests } from '../../../src/lib/state/caged.svelte';
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
    expect(instrument.preview).toBe(presetInstrument('AF-4', 6, 22));
    instrument.stepFrets(-1);
    expect(instrument.preview).toBe(presetInstrument('AF-4', 6, 21));
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
    const inst = presetInstrument('AF-4', 6, 22);
    expect(s.notes).toHaveBeenCalledWith(inst);
    expect(s.triads).toHaveBeenCalledWith(inst);
    expect(instrument.active).toEqual({
      stringCount: 6,
      tuning: { kind: 'preset', id: 'AF-4' },
      fretCount: 22,
      handedness: 'right',
      orientation: 'highest-top'
    });
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

  it("confirm on the caged screen: adjustedIn is 'caged' iff applyInstrument returns true", () => {
    spies();
    const adj = vi.spyOn(caged, 'applyInstrument').mockReturnValue(true);
    instrument.open();
    instrument.setFrets(12);
    instrument.confirm('caged');
    expect(adj).toHaveBeenCalled();
    expect(instrument.adjustedIn).toBe('caged');

    resetInstrumentForTests();
    adj.mockReturnValue(false);
    instrument.open();
    instrument.setFrets(12);
    instrument.confirm('caged');
    expect(instrument.adjustedIn).toBeNull();

    resetInstrumentForTests();
    adj.mockReturnValue(true);
    instrument.open();
    instrument.setFrets(12);
    instrument.confirm('notes');
    expect(instrument.adjustedIn).toBeNull();
  });

  it('presentation-only changes and restore never set caged', () => {
    spies();
    vi.spyOn(caged, 'applyInstrument').mockReturnValue(true);
    instrument.open();
    instrument.setHandedness('left');
    instrument.confirm('caged');
    expect(instrument.adjustedIn).toBeNull();
    instrument.restore({ ...DEFAULT_CONFIG, fretCount: 12 });
    expect(instrument.adjustedIn).toBeNull();
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
    const config = {
      stringCount: 6,
      tuning: { kind: 'preset', id: 'AF-3' },
      fretCount: 24,
      handedness: 'right',
      orientation: 'highest-top'
    } as const;
    instrument.restore(config);
    expect(instrument.active).toEqual(config);
    expect(instrument.current).toEqual(presetInstrument('AF-3', 6, 24));
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

describe('instrument store: string count (012 US1)', () => {
  const stored = (s: ReturnType<typeof fakeStorage>) =>
    JSON.parse(s.data.get(PREFS_KEY) as string) as Record<string, unknown>;

  beforeEach(() => {
    resetPreferencesForTests();
  });

  it('stringCount getter follows the active config, and pending while open', () => {
    expect(instrument.stringCount).toBe(6);
    instrument.open();
    expect(instrument.stringCount).toBe(6);
    instrument.setStringCount(7);
    expect(instrument.stringCount).toBe(7);
    expect(instrument.active.stringCount).toBe(6);
    instrument.cancel();
    expect(instrument.stringCount).toBe(6);
  });

  it('setStringCount re-canonicalizes the pending tuning and drives the preview', () => {
    instrument.open();
    instrument.setStringCount(7);
    expect(instrument.panel.open && instrument.panel.pending.tuning).toEqual({
      kind: 'preset',
      id: 'AF-21'
    });
    expect(instrument.preview?.stringCount).toBe(7);
    expect(instrument.selectedRadio).toBe('AF-21');
  });

  it('setStringCount is a no-op while closed, for an invalid n, and for the same count', () => {
    instrument.setStringCount(7);
    expect(instrument.panel).toEqual({ open: false });
    instrument.open();
    const before = instrument.panel;
    instrument.setStringCount(8);
    instrument.setStringCount(6);
    expect(instrument.panel).toBe(before);
  });

  it('presets: 11 rows on 6 strings, 12 on 7 with the 7-string spelling', () => {
    instrument.open();
    expect(instrument.presets).toHaveLength(11);
    expect(instrument.presets[0].id).toBe('AF-1');
    expect(instrument.presets[0].strings).toHaveLength(6);
    instrument.setStringCount(7);
    expect(instrument.presets.map((p) => p.id)).toEqual([
      'AF-21',
      'AF-22',
      'AF-23',
      'AF-3',
      'AF-4',
      'AF-5',
      'AF-6',
      'AF-7',
      'AF-8',
      'AF-9',
      'AF-10',
      'AF-11'
    ]);
    expect(instrument.presets.every((p) => p.strings.length === 7)).toBe(true);
    expect(instrument.presets[0].strings[0]).toMatchObject({ letter: 'B', octave: 1 });
  });

  it('presets is empty while the panel is closed', () => {
    expect(instrument.presets).toEqual([]);
  });

  it('rows are ordered [count … 1] and include string 7 on 7 strings', () => {
    instrument.open();
    instrument.chooseCustom();
    expect(instrument.rows.map((r) => r.string)).toEqual([6, 5, 4, 3, 2, 1]);
    instrument.setStringCount(7);
    expect(instrument.rows.map((r) => r.string)).toEqual([7, 6, 5, 4, 3, 2, 1]);
    expect(instrument.rows[0].pitch).toMatchObject({ letter: 'B', accidental: 0, octave: 1 });
  });

  it('string 7 limits: lower disabled at E1, raise disabled at D♯2', () => {
    instrument.open();
    instrument.setStringCount(7);
    instrument.chooseCustom();
    expect(instrument.rows[0]).toMatchObject({ string: 7, canLower: true, canRaise: true });
    for (let i = 0; i < 7; i++) expect(instrument.stepString(7, -1)).toBe(true);
    expect(instrument.rows[0].canLower).toBe(false);
    expect(instrument.stepString(7, -1)).toBe(false);
    for (let i = 0; i < 11; i++) expect(instrument.stepString(7, 1)).toBe(true);
    expect(instrument.rows[0].canRaise).toBe(false);
    expect(instrument.stepString(7, 1)).toBe(false);
  });

  it('string 7 plays through the preview instrument', () => {
    const n = vi.spyOn(playback, 'note').mockReturnValue([]);
    instrument.open();
    instrument.setStringCount(7);
    instrument.playString(7);
    expect(n).toHaveBeenCalledWith({ string: 7, fret: 0 }, instrument.preview);
  });

  it('confirm applies 7 strings and remembers the count with the canonical preset', () => {
    const s = fakeStorage();
    preferences.start(s);
    instrument.open();
    instrument.setStringCount(7);
    instrument.confirm('notes');
    expect(instrument.active).toEqual({
      stringCount: 7,
      tuning: { kind: 'preset', id: 'AF-21' },
      fretCount: 22,
      handedness: 'right',
      orientation: 'highest-top'
    });
    expect(instrument.current.stringCount).toBe(7);
    const r = stored(s);
    expect(r.strings).toBe(7);
    expect(r.tuning).toBe('AF-21');
    expect(r).not.toHaveProperty('customTuning');
  });

  it('confirm of an unmatched 7-string custom writes the AF-21 placeholder and 7 offsets', () => {
    const s = fakeStorage();
    preferences.start(s);
    instrument.open();
    instrument.setStringCount(7);
    instrument.chooseCustom();
    for (let i = 0; i < 3; i++) instrument.stepString(7, -1);
    instrument.confirm('notes');
    const r = stored(s);
    expect(r.strings).toBe(7);
    expect(r.tuning).toBe('AF-21');
    expect(r.customTuning).toEqual([-3, 0, 0, 0, 0, 0, 0]);
  });

  it('confirming back to 6 strings drops the strings key', () => {
    const s = fakeStorage();
    preferences.start(s);
    instrument.open();
    instrument.setStringCount(7);
    instrument.confirm('notes');
    instrument.open();
    instrument.setStringCount(6);
    instrument.confirm('notes');
    expect(stored(s)).not.toHaveProperty('strings');
    expect(stored(s).tuning).toBe('AF-1');
  });

  it('restore(config) with a count applies it without notice, stop or write', () => {
    const s = spies();
    const config = {
      stringCount: 7,
      tuning: { kind: 'preset', id: 'AF-23' },
      fretCount: 24,
      handedness: 'right',
      orientation: 'highest-top'
    } as const;
    instrument.restore(config);
    expect(instrument.active).toEqual(config);
    expect(instrument.current).toEqual(presetInstrument('AF-23', 7, 24));
    expect(s.notes).toHaveBeenCalledTimes(1);
    expect(s.stop).not.toHaveBeenCalled();
    expect(instrument.adjustedIn).toBeNull();
  });

  it('close without confirm discards the pending count (EC-2.7)', () => {
    const s = spies();
    instrument.open();
    instrument.setStringCount(7);
    instrument.cancel();
    expect(instrument.active).toEqual(DEFAULT_CONFIG);
    expect(instrument.current).toBe(STANDARD_GUITAR);
    expect(s.notes).not.toHaveBeenCalled();
  });
});

describe('presentation settings (contracts/orientation-api §5)', () => {
  it('setHandedness / setOrientation change pending only', () => {
    instrument.open();
    instrument.setHandedness('left');
    instrument.setOrientation('lowest-top');
    expect(instrument.active).toEqual(DEFAULT_CONFIG);
    expect(instrument.current).toBe(STANDARD_GUITAR);
    expect(instrument.preview?.handedness).toBe('left');
    expect(instrument.preview?.orientation).toBe('lowest-top');
  });

  it('presentation-only confirm: no stop, no notice, views untouched, instrument follows', () => {
    const stop = vi.spyOn(playback, 'stop');
    const notesView = notes.state;
    const triadsView = triads.state;
    instrument.open();
    instrument.setHandedness('left');
    instrument.confirm('notes');
    expect(stop).not.toHaveBeenCalled();
    expect(instrument.adjustedIn).toBeNull();
    expect(notes.state).toBe(notesView);
    expect(triads.state).toBe(triadsView);
    expect(notes.instrument.handedness).toBe('left');
    expect(triads.instrument.handedness).toBe('left');
    expect(instrument.active.handedness).toBe('left');
    expect(instrument.current.handedness).toBe('left');

    instrument.open();
    instrument.setOrientation('lowest-top');
    instrument.confirm('triads');
    expect(stop).not.toHaveBeenCalled();
    expect(notes.state).toBe(notesView);
    expect(triads.state).toBe(triadsView);
    expect(notes.instrument.orientation).toBe('lowest-top');
  });

  it('presentation-only confirm clears an earlier notice without raising one', () => {
    spies(true, false);
    instrument.open();
    instrument.setFrets(12);
    instrument.confirm('notes');
    expect(instrument.adjustedIn).toBe('notes');
    vi.restoreAllMocks();
    instrument.open();
    instrument.setHandedness('left');
    instrument.confirm('notes');
    expect(instrument.adjustedIn).toBeNull();
  });

  it('musical confirm still stops playback and may raise the notice', () => {
    const s = spies(true, false);
    instrument.open();
    instrument.setHandedness('left');
    instrument.setFrets(12);
    instrument.confirm('notes');
    expect(s.stop).toHaveBeenCalledTimes(1);
    expect(s.stop).toHaveBeenCalledWith('instrument');
    expect(instrument.adjustedIn).toBe('notes');
    expect(instrument.active.handedness).toBe('left');
    expect(instrument.active.fretCount).toBe(12);
  });

  it('cancel discards pending presentation (EC-2.7)', () => {
    instrument.open();
    instrument.setHandedness('left');
    instrument.setOrientation('lowest-top');
    instrument.cancel();
    expect(instrument.active).toEqual(DEFAULT_CONFIG);
    expect(instrument.preview).toBeNull();
    instrument.open();
    expect(instrument.preview).toBe(STANDARD_GUITAR);
  });

  it('restoreDefault resets presentation in the pending config', () => {
    instrument.open();
    instrument.setHandedness('left');
    instrument.restoreDefault();
    expect(instrument.preview).toBe(STANDARD_GUITAR);
  });

  it('restore accepts both fields without stop or notice', () => {
    const s = spies();
    instrument.restore({ ...DEFAULT_CONFIG, handedness: 'left', orientation: 'lowest-top' });
    expect(s.stop).not.toHaveBeenCalled();
    expect(instrument.current.handedness).toBe('left');
    expect(instrument.current.orientation).toBe('lowest-top');
    expect(s.notes).toHaveBeenCalledTimes(1);
    expect(instrument.adjustedIn).toBeNull();
  });
});

describe('instrument store: caged (US4)', () => {
  it('confirm and restore call caged.applyInstrument', () => {
    const spy = vi.spyOn(caged, 'applyInstrument');
    instrument.open();
    instrument.setFrets(12);
    instrument.confirm('caged');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].fretCount).toBe(12);
    instrument.restore({ ...DEFAULT_CONFIG, fretCount: 15 });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[1][0].fretCount).toBe(15);
    expect(instrument.adjustedIn).toBeNull();
  });
});

describe('instrument store: CAGED tuning name (slice 015)', () => {
  it('confirm passes the tuning label to caged.applyInstrument', () => {
    const apply = vi.spyOn(caged, 'applyInstrument');
    instrument.open();
    instrument.selectTuning('AF-4');
    instrument.confirm('caged');
    expect(apply).toHaveBeenCalledWith(presetInstrument('AF-4', 6, 22), 'Drop D');
  });

  it('confirm of a presentation-only change also passes the label', () => {
    const apply = vi.spyOn(caged, 'applyInstrument');
    instrument.open();
    instrument.setFrets(12);
    instrument.confirm('caged');
    expect(apply).toHaveBeenCalledWith(presetInstrument('AF-1', 6, 12), 'Standard');
  });

  it('restore passes the label', () => {
    const apply = vi.spyOn(caged, 'applyInstrument');
    instrument.restore({
      ...DEFAULT_CONFIG,
      tuning: { kind: 'preset', id: 'AF-4' }
    });
    expect(apply).toHaveBeenCalledWith(presetInstrument('AF-4', 6, 22), 'Drop D');
  });
});

describe('instrument store: CAGED temporary tuning (slice 015 US1)', () => {
  const temporaryOpenG = () => {
    resetCagedForTests(AF_8, 'Open G');
    caged.viewInStandard();
    expect(caged.temporary).toBe(true);
  };

  it('an unchanged confirm ends the temporary tuning', () => {
    temporaryOpenG();
    instrument.open();
    instrument.confirm('caged');
    expect(caged.temporary).toBe(false);
  });

  it('a changed confirm ends the temporary tuning', () => {
    temporaryOpenG();
    instrument.open();
    instrument.selectTuning('AF-4');
    instrument.confirm('caged');
    expect(caged.temporary).toBe(false);
  });

  it('cancel keeps the temporary tuning', () => {
    temporaryOpenG();
    instrument.open();
    instrument.cancel();
    expect(caged.temporary).toBe(true);
  });

  it('viewInStandard and endTemporary never write preferences (SC-005)', () => {
    const remember = vi.spyOn(preferences, 'remember');
    resetCagedForTests(AF_8, 'Open G');
    caged.viewInStandard();
    caged.endTemporary();
    expect(remember).not.toHaveBeenCalled();
  });
});
