import { beforeEach, describe, expect, it, vi } from 'vitest';
import { serializePreferences, DEFAULT_PREFERENCES } from '../../../src/lib/prefs/schema';
import { PREFS_KEY } from '../../../src/lib/prefs/storage';
import { instrument, resetInstrumentForTests } from '../../../src/lib/state/instrument.svelte';
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
  resetInstrumentForTests();
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
    expect(instrument.active.tuningId).toBe('AF-3');
  });

  it('pushes stored values through the restore methods without writing', () => {
    const s = full();
    const before = s.data.get(PREFS_KEY);
    const restore = vi.spyOn(instrument, 'restore');
    const pb = vi.spyOn(playback, 'restore');
    const nl = vi.spyOn(notes, 'restoreLabelType');
    const tl = vi.spyOn(triads, 'restoreLabelType');
    preferences.start(s);
    expect(restore).toHaveBeenCalledWith({ tuningId: 'AF-3', fretCount: 24 });
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

  it('seeds lastTool from storage', () => {
    expect(preferences.lastTool).toBeNull();
    preferences.start(full());
    expect(preferences.lastTool).toBe('triads');
  });

  it('empty storage keeps defaults and shows no notice', () => {
    preferences.start(fakeStorage());
    expect(instrument.active.tuningId).toBe('AF-1');
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
    preferences.toolOpened('caged');
    expect(preferences.lastTool).toBe('notes');
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
    expect(restore).toHaveBeenCalledWith({ tuningId: 'AF-1', fretCount: 22 });
    expect(pb).toHaveBeenCalledWith({ muted: false, volume: 80 });
    expect(nl).toHaveBeenCalledWith('name');
    expect(tl).toHaveBeenCalledWith('interval');
    expect(instrument.active.tuningId).toBe('AF-1');
    expect(playback.muted).toBe(false);
    expect(playback.volume).toBe(80);
    expect(preferences.noticeVisible).toBe(false);
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
