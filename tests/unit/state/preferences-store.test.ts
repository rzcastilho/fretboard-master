import { beforeEach, describe, expect, it, vi } from 'vitest';
import { serializePreferences, DEFAULT_PREFERENCES } from '../../../src/lib/prefs/schema';
import { PREFS_KEY } from '../../../src/lib/prefs/storage';
import { instrument, resetInstrumentForTests } from '../../../src/lib/state/instrument.svelte';
import { caged, resetCagedForTests } from '../../../src/lib/state/caged.svelte';
import { notation, resetNotationForTests } from '../../../src/lib/state/notation.svelte';
import { language } from '../../../src/lib/state/language.svelte';
import { notes, resetNotesForTests } from '../../../src/lib/state/notes.svelte';
import { playback, resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';
import { preferences, resetPreferencesForTests } from '../../../src/lib/state/preferences.svelte';
import { resetTriadsForTests, triads } from '../../../src/lib/state/triads.svelte';
import { FIXTURE_BY_NAME } from '../prefs/fixtures';
import { fakeStorage } from '../prefs/support';

beforeEach(() => {
  vi.restoreAllMocks();
  resetPlaybackForTests();
  resetNotesForTests();
  resetTriadsForTests();
  resetCagedForTests();
  resetInstrumentForTests();
  resetNotationForTests();
  resetPreferencesForTests();
});

const full = () => fakeStorage({ [PREFS_KEY]: FIXTURE_BY_NAME['v1-full'].raw });

describe('preferences.start', () => {
  it('is idempotent: reads storage once', () => {
    const s = full();
    preferences.start(s);
    const reads = s.calls.get;
    preferences.start(s);
    preferences.start(fakeStorage());
    expect(s.calls.get).toBe(reads);
    expect(instrument.active.tuning).toEqual({ kind: 'preset', id: 'AF-3' });
  });

  it('pushes stored values through the restore methods without writing', () => {
    const s = full();
    const before = s.data.get(PREFS_KEY);
    const restore = vi.spyOn(instrument, 'restore');
    const pb = vi.spyOn(playback, 'restore');
    const nl = vi.spyOn(notes, 'restoreLabelType');
    const tl = vi.spyOn(triads, 'restoreLabelType');
    preferences.start(s);
    expect(restore).toHaveBeenCalledWith({
      stringCount: 6,
      tuning: { kind: 'preset', id: 'AF-3' },
      fretCount: 24,
      handedness: 'right',
      orientation: 'highest-top'
    });
    expect(pb).toHaveBeenCalledWith({ muted: true, volume: 35 });
    expect(nl).toHaveBeenCalledWith('octave');
    expect(tl).toHaveBeenCalledWith('name');
    expect(s.data.get(PREFS_KEY)).toBe(before);
    expect(s.calls.set).toBe(1); // probe only
    expect(playback.muted).toBe(true);
    expect(playback.volume).toBe(35);
    expect(notes.state.labelType).toBe('octave');
    expect(triads.state.labelType).toBe('name');
  });

  it('restores a stored custom tuning (US5)', () => {
    const restore = vi.spyOn(instrument, 'restore');
    preferences.start(fakeStorage({ [PREFS_KEY]: FIXTURE_BY_NAME['v1-custom'].raw }));
    expect(restore).toHaveBeenCalledWith({
      stringCount: 6,
      tuning: { kind: 'custom', offsets: [-2, 0, 0, -1, 0, 0] },
      fretCount: 24,
      handedness: 'right',
      orientation: 'highest-top'
    });
    expect(instrument.active.tuning).toEqual({ kind: 'custom', offsets: [-2, 0, 0, -1, 0, 0] });
  });

  it('a stored custom tuning matching a preset loads as that preset', () => {
    preferences.start(fakeStorage({ [PREFS_KEY]: FIXTURE_BY_NAME['v1-custom-drop-d'].raw }));
    expect(instrument.active.tuning).toEqual({ kind: 'preset', id: 'AF-4' });
  });

  it('a damaged customTuning loads the stored preset with no error', () => {
    preferences.start(fakeStorage({ [PREFS_KEY]: FIXTURE_BY_NAME['custom-out-of-range'].raw }));
    expect(instrument.active.tuning).toEqual({ kind: 'preset', id: 'AF-1' });
    expect(preferences.noticeVisible).toBe(false);
  });

  it('seeds lastTool from storage', () => {
    expect(preferences.lastTool).toBeNull();
    preferences.start(full());
    expect(preferences.lastTool).toBe('triads');
  });

  it('empty storage keeps defaults and shows no notice', () => {
    preferences.start(fakeStorage());
    expect(instrument.active.tuning).toEqual({ kind: 'preset', id: 'AF-1' });
    expect(preferences.lastTool).toBeNull();
    expect(preferences.noticeVisible).toBe(false);
  });
});

describe('notice', () => {
  const blocked = () => {
    const s = fakeStorage();
    s.fail.set = true;
    return s;
  };

  it('visible only when the probe fails', () => {
    preferences.start(blocked());
    expect(preferences.noticeVisible).toBe(true);
  });

  it('shown once per session even if start runs again after a test-less reset flag', () => {
    preferences.start(blocked());
    preferences.dismissNotice();
    expect(preferences.noticeVisible).toBe(false);
    preferences.screenChanged();
    expect(preferences.noticeVisible).toBe(false);
  });

  it('screenChanged hides it', () => {
    preferences.start(blocked());
    preferences.screenChanged();
    expect(preferences.noticeVisible).toBe(false);
  });

  it('null storage also raises it', () => {
    preferences.start(null);
    expect(preferences.noticeVisible).toBe(true);
  });
});

describe('toolOpened / remember', () => {
  it('toolOpened remembers lastTool and ignores unknown ids', () => {
    const s = fakeStorage();
    preferences.start(s);
    preferences.toolOpened('notes');
    expect(preferences.lastTool).toBe('notes');
    expect(JSON.parse(s.data.get(PREFS_KEY) as string).lastTool).toBe('notes');
    // @ts-expect-error unknown id
    preferences.toolOpened('scales');
    expect(preferences.lastTool).toBe('notes');
    preferences.toolOpened('caged');
    expect(preferences.lastTool).toBe('caged');
    expect(JSON.parse(s.data.get(PREFS_KEY) as string).lastTool).toBe('caged');
  });

  it('remember forwards to the session', () => {
    const s = fakeStorage();
    preferences.start(s);
    preferences.remember({ muted: true });
    expect(s.data.get(PREFS_KEY)).toBe(
      serializePreferences({ ...DEFAULT_PREFERENCES, muted: true })
    );
  });
});

describe('preferences.erase', () => {
  it('removes prefixed keys, resets lastTool and restores defaults', () => {
    const s = fakeStorage({ [PREFS_KEY]: FIXTURE_BY_NAME['v1-full'].raw, other: 'keep' });
    preferences.start(s);
    expect(preferences.lastTool).toBe('triads');
    const restore = vi.spyOn(instrument, 'restore');
    const pb = vi.spyOn(playback, 'restore');
    const nl = vi.spyOn(notes, 'restoreLabelType');
    const tl = vi.spyOn(triads, 'restoreLabelType');
    const writes = s.calls.set;
    preferences.erase();
    expect([...s.data.keys()].filter((k) => k.startsWith('fretboard-master:'))).toEqual([]);
    expect(s.data.get('other')).toBe('keep');
    expect(s.calls.set).toBe(writes);
    expect(preferences.lastTool).toBeNull();
    expect(restore).toHaveBeenCalledWith({
      stringCount: 6,
      tuning: { kind: 'preset', id: 'AF-1' },
      fretCount: 22,
      handedness: 'right',
      orientation: 'highest-top'
    });
    expect(pb).toHaveBeenCalledWith({ muted: false, volume: 80 });
    expect(nl).toHaveBeenCalledWith('name');
    expect(tl).toHaveBeenCalledWith('interval');
    expect(instrument.active.tuning).toEqual({ kind: 'preset', id: 'AF-1' });
    expect(playback.muted).toBe(false);
    expect(playback.volume).toBe(80);
    expect(preferences.noticeVisible).toBe(false);
  });

  it('restores Standard after a custom tuning was remembered (US5)', () => {
    const s = fakeStorage({ [PREFS_KEY]: FIXTURE_BY_NAME['v1-custom'].raw });
    preferences.start(s);
    expect(instrument.active.tuning.kind).toBe('custom');
    preferences.erase();
    expect(s.data.has(PREFS_KEY)).toBe(false);
    expect(instrument.active.tuning).toEqual({ kind: 'preset', id: 'AF-1' });
    expect(instrument.active.fretCount).toBe(22);
  });

  it('stops any playing note', () => {
    preferences.start(fakeStorage());
    const stop = vi.spyOn(playback, 'stop');
    preferences.erase();
    expect(stop).toHaveBeenCalled();
  });

  it('works silently when storage is unavailable and does not raise the notice again', () => {
    const s = fakeStorage();
    s.fail.get = s.fail.set = s.fail.remove = true;
    preferences.start(s);
    preferences.dismissNotice();
    expect(() => preferences.erase()).not.toThrow();
    expect(preferences.noticeVisible).toBe(false);
    expect(preferences.lastTool).toBeNull();
  });

  it('leaves storage empty until the next remember', () => {
    const s = fakeStorage({ [PREFS_KEY]: FIXTURE_BY_NAME['v1-full'].raw });
    preferences.start(s);
    preferences.erase();
    expect(s.data.has(PREFS_KEY)).toBe(false);
    preferences.remember({ muted: true });
    expect(s.data.has(PREFS_KEY)).toBe(true);
  });
});

describe('left-handed and orientation (013, US4)', () => {
  const raw = () => FIXTURE_BY_NAME['left-lowest-full'].raw;

  it('start passes stored handedness/orientation to instrument.restore', () => {
    const restore = vi.spyOn(instrument, 'restore');
    preferences.start(fakeStorage({ [PREFS_KEY]: raw() }));
    expect(restore).toHaveBeenCalledWith(
      expect.objectContaining({ handedness: 'left', orientation: 'lowest-top', stringCount: 7 })
    );
    expect(instrument.active.handedness).toBe('left');
    expect(instrument.active.orientation).toBe('lowest-top');
  });

  it('confirm of a presentation change performs exactly one write with all five fields', () => {
    const s = fakeStorage();
    preferences.start(s);
    const writes = s.calls.set;
    instrument.open();
    instrument.setHandedness('left');
    instrument.setOrientation('lowest-top');
    instrument.confirm('notes');
    expect(s.calls.set).toBe(writes + 1);
    const stored = JSON.parse(s.data.get(PREFS_KEY) as string);
    expect(stored).toMatchObject({
      handedness: 'left',
      orientation: 'lowest-top',
      tuning: 'AF-1',
      frets: 22
    });
    expect(stored.strings).toBeUndefined();
  });

  it('confirming back to defaults drops both keys', () => {
    const s = fakeStorage({ [PREFS_KEY]: raw() });
    preferences.start(s);
    instrument.open();
    instrument.restoreDefault();
    instrument.confirm('notes');
    const stored = JSON.parse(s.data.get(PREFS_KEY) as string);
    expect(stored.handedness).toBeUndefined();
    expect(stored.orientation).toBeUndefined();
  });

  it('erase removes the key and resets both', () => {
    const s = fakeStorage({ [PREFS_KEY]: raw() });
    preferences.start(s);
    const restore = vi.spyOn(instrument, 'restore');
    preferences.erase();
    expect(s.data.has(PREFS_KEY)).toBe(false);
    expect(restore).toHaveBeenCalledWith(
      expect.objectContaining({ handedness: 'right', orientation: 'highest-top' })
    );
    expect(instrument.active.handedness).toBe('right');
    expect(instrument.active.orientation).toBe('highest-top');
  });

  it('an invalid stored value in one field keeps the other and all other fields', () => {
    preferences.start(fakeStorage({ [PREFS_KEY]: FIXTURE_BY_NAME['bad-handed'].raw }));
    expect(instrument.active.handedness).toBe('right');
    expect(instrument.active.orientation).toBe('lowest-top');
    expect(instrument.active.tuning).toEqual({ kind: 'preset', id: 'AF-2' });
    expect(preferences.noticeVisible).toBe(false);
  });
});

describe('rotate hint (016 US4)', () => {
  it('is false by default and true when the record has rotateHint', () => {
    preferences.start(fakeStorage());
    expect(preferences.rotateHintShown).toBe(false);
    resetPreferencesForTests();
    preferences.start(fakeStorage({ [PREFS_KEY]: '{"version":1,"rotateHint":true}' }));
    expect(preferences.rotateHintShown).toBe(true);
  });

  it('markRotateHintShown is idempotent and persists rotateHint', () => {
    const s = fakeStorage();
    preferences.start(s);
    preferences.markRotateHintShown();
    const writes = s.calls.set;
    preferences.markRotateHintShown();
    expect(s.calls.set).toBe(writes);
    expect(preferences.rotateHintShown).toBe(true);
    expect(JSON.parse(s.data.get(PREFS_KEY) as string).rotateHint).toBe(true);
  });

  it('with storage unavailable it does not throw and the in-load flag holds', () => {
    const s = fakeStorage();
    s.fail.get = s.fail.set = s.fail.remove = true;
    preferences.start(s);
    expect(() => preferences.markRotateHintShown()).not.toThrow();
    expect(preferences.rotateHintShown).toBe(true);
  });

  it('erase clears it', () => {
    const s = fakeStorage();
    preferences.start(s);
    preferences.markRotateHintShown();
    preferences.erase();
    expect(preferences.rotateHintShown).toBe(false);
    expect(s.data.has(PREFS_KEY)).toBe(false);
  });

  it('Reset tool does not clear it', () => {
    const s = fakeStorage();
    preferences.start(s);
    preferences.markRotateHintShown();
    caged.reset();
    expect(preferences.rotateHintShown).toBe(true);
    expect(JSON.parse(s.data.get(PREFS_KEY) as string).rotateHint).toBe(true);
  });
});

describe('CAGED label type (017, US1)', () => {
  it('restore pushes the stored label through caged.restoreLabelType without writing', () => {
    const s = fakeStorage({ [PREFS_KEY]: FIXTURE_BY_NAME['labels-caged-name'].raw });
    const before = s.data.get(PREFS_KEY);
    const cl = vi.spyOn(caged, 'restoreLabelType');
    preferences.start(s);
    expect(cl).toHaveBeenCalledWith('name');
    expect(caged.state.labelType).toBe('name');
    expect(s.data.get(PREFS_KEY)).toBe(before);
  });

  it('erase restores the default label', () => {
    const s = fakeStorage({ [PREFS_KEY]: FIXTURE_BY_NAME['labels-caged-name'].raw });
    preferences.start(s);
    const cl = vi.spyOn(caged, 'restoreLabelType');
    preferences.erase();
    expect(cl).toHaveBeenCalledWith('interval');
    expect(caged.state.labelType).toBe('interval');
  });

  it('setLabelType remembers labels.caged; Reset tool keeps the label', () => {
    const s = fakeStorage();
    preferences.start(s);
    caged.setLabelType('name');
    expect(caged.state.labelType).toBe('name');
    expect(JSON.parse(s.data.get(PREFS_KEY) as string).labels.caged).toBe('name');
    caged.reset();
    expect(caged.state.labelType).toBe('name');
    caged.setLabelType('interval');
    expect(JSON.parse(s.data.get(PREFS_KEY) as string).labels.caged).toBeUndefined();
  });
});

describe('notation, accidentals and CAGED note (021 P-3, P-4)', () => {
  it('start calls notation.start after language.start, with the stored values', () => {
    const order: string[] = [];
    vi.spyOn(language, 'start').mockImplementation(() => void order.push('language'));
    const ns = vi.spyOn(notation, 'start').mockImplementation(() => void order.push('notation'));
    preferences.start(
      fakeStorage({
        [PREFS_KEY]: '{"version":1,"notation":"solfege","accidentals":"flats"}'
      })
    );
    expect(order).toEqual(['language', 'notation']);
    expect(ns).toHaveBeenCalledWith({ notation: 'solfege', accidentals: 'flats' });
  });

  it('start pushes stored values without writing', () => {
    const s = fakeStorage({ [PREFS_KEY]: FIXTURE_BY_NAME['accidentals-flats'].raw });
    const before = s.data.get(PREFS_KEY);
    preferences.start(s);
    expect(notation.accidentals).toBe('flats');
    expect(notation.chosen).toBeNull();
    expect(s.data.get(PREFS_KEY)).toBe(before);
  });

  it('cagedNoteShown is false by default and true when the record has cagedNote', () => {
    preferences.start(fakeStorage());
    expect(preferences.cagedNoteShown).toBe(false);
    resetPreferencesForTests();
    preferences.start(fakeStorage({ [PREFS_KEY]: FIXTURE_BY_NAME['caged-note'].raw }));
    expect(preferences.cagedNoteShown).toBe(true);
  });

  it('markCagedNoteShown is idempotent and persists cagedNote', () => {
    const s = fakeStorage();
    preferences.start(s);
    preferences.markCagedNoteShown();
    const writes = s.calls.set;
    preferences.markCagedNoteShown();
    expect(s.calls.set).toBe(writes);
    expect(preferences.cagedNoteShown).toBe(true);
    expect(JSON.parse(s.data.get(PREFS_KEY) as string).cagedNote).toBe(true);
  });

  it('with storage unavailable it does not throw and the in-load flag holds', () => {
    const s = fakeStorage();
    s.fail.get = s.fail.set = s.fail.remove = true;
    preferences.start(s);
    expect(() => preferences.markCagedNoteShown()).not.toThrow();
    expect(preferences.cagedNoteShown).toBe(true);
  });

  it('erase resets notation, accidentals and cagedNoteShown', () => {
    const s = fakeStorage();
    preferences.start(s);
    notation.choose('solfege');
    notation.chooseAccidentals('both');
    preferences.markCagedNoteShown();
    const restore = vi.spyOn(notation, 'restore');
    preferences.erase();
    expect(restore).toHaveBeenCalledWith(null, 'sharps');
    expect(notation.chosen).toBeNull();
    expect(notation.accidentals).toBe('sharps');
    expect(preferences.cagedNoteShown).toBe(false);
    expect(s.data.has(PREFS_KEY)).toBe(false);
  });

  it('Reset tool does not clear cagedNote', () => {
    const s = fakeStorage();
    preferences.start(s);
    preferences.markCagedNoteShown();
    caged.reset();
    expect(preferences.cagedNoteShown).toBe(true);
    expect(JSON.parse(s.data.get(PREFS_KEY) as string).cagedNote).toBe(true);
  });
});
