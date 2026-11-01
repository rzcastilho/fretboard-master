import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, serializePreferences } from '../../../src/lib/prefs/schema';
import { PREFS_KEY, PROBE_KEY } from '../../../src/lib/prefs/storage';
import { startSession } from '../../../src/lib/prefs/session';
import { FIXTURE_BY_NAME } from './fixtures';
import {
  DEFAULT_PLAIN_SETTINGS,
  DEFAULT_SETTINGS,
  DEFAULT_SPEED_SETTINGS
} from '../../../src/lib/state/metronome-settings';
import { fakeStorage } from './support';

describe('startSession', () => {
  it('reads once and never writes', () => {
    const s = fakeStorage({ [PREFS_KEY]: FIXTURE_BY_NAME['v1-full'].raw });
    const session = startSession(s);
    expect(session.available).toBe(true);
    expect(session.current).toEqual(FIXTURE_BY_NAME['v1-full'].expected);
    expect(s.data.get(PREFS_KEY)).toBe(FIXTURE_BY_NAME['v1-full'].raw);
    // probe write + remove are the only writes; the record is untouched
    expect(s.data.has(PROBE_KEY)).toBe(false);
  });
  it('empty storage → defaults, nothing stored', () => {
    const s = fakeStorage();
    const session = startSession(s);
    expect(session.current).toEqual(DEFAULT_PREFERENCES);
    expect(s.data.size).toBe(0);
  });
  it('unavailable storage → available=false, defaults, remember still updates current', () => {
    const session = startSession(null);
    expect(session.available).toBe(false);
    expect(session.current).toEqual(DEFAULT_PREFERENCES);
    expect(() => session.remember({ muted: true })).not.toThrow();
    expect(session.current.muted).toBe(true);
  });
  it('blocked storage (probe fails) → unavailable', () => {
    const s = fakeStorage();
    s.fail.set = true;
    const session = startSession(s);
    expect(session.available).toBe(false);
    session.remember({ volume: 10 });
    expect(session.current.volume).toBe(10);
  });
});

describe('remember', () => {
  it('writes the serialization, merging labels', () => {
    const s = fakeStorage();
    const session = startSession(s);
    session.remember({ muted: true });
    session.remember({ labels: { notes: 'octave' } });
    expect(session.current.labels).toEqual({
      notes: 'octave',
      triads: 'interval',
      caged: 'interval'
    });
    expect(s.data.get(PREFS_KEY)).toBe(serializePreferences(session.current));
  });
  it('writes only when the serialization differs', () => {
    const s = fakeStorage();
    const session = startSession(s);
    session.remember({ muted: true });
    const writes = s.calls.set;
    session.remember({ muted: true });
    session.remember({ labels: { notes: 'name' } });
    expect(s.calls.set).toBe(writes);
  });
  it('does not write when values equal what was read and the raw is canonical', () => {
    const canonical = serializePreferences(DEFAULT_PREFERENCES);
    const s = fakeStorage({ [PREFS_KEY]: canonical });
    const session = startSession(s);
    const before = s.calls.set;
    session.remember({ muted: false });
    expect(s.calls.set).toBe(before);
  });
  it('a record of unknown/newer version is replaced by v1 on first changing remember', () => {
    const s = fakeStorage({ [PREFS_KEY]: FIXTURE_BY_NAME.future.raw });
    const session = startSession(s);
    expect(s.data.get(PREFS_KEY)).toBe(FIXTURE_BY_NAME.future.raw);
    session.remember({ muted: true });
    expect(s.data.get(PREFS_KEY)).toBe(serializePreferences(session.current));
    expect(JSON.parse(s.data.get(PREFS_KEY) as string).version).toBe(1);
  });
  it('is silent with a rejecting setItem and current still updates', () => {
    const s = fakeStorage();
    const session = startSession(s);
    s.fail.set = true;
    expect(() => session.remember({ volume: 35 })).not.toThrow();
    expect(session.current.volume).toBe(35);
  });
  it('retries the write after a failed one', () => {
    const s = fakeStorage();
    const session = startSession(s);
    s.fail.set = true;
    session.remember({ volume: 35 });
    s.fail.set = false;
    session.remember({ volume: 35 });
    expect(s.data.get(PREFS_KEY)).toBe(serializePreferences(session.current));
  });
});

describe('erase', () => {
  it('removes keys, resets current, writes nothing; storage stays empty until next remember', () => {
    const s = fakeStorage({ [PREFS_KEY]: FIXTURE_BY_NAME['v1-full'].raw, other: 'keep' });
    const session = startSession(s);
    const sets = s.calls.set;
    session.erase();
    expect(session.current).toEqual(DEFAULT_PREFERENCES);
    expect(s.data.has(PREFS_KEY)).toBe(false);
    expect(s.data.get('other')).toBe('keep');
    expect(s.calls.set).toBe(sets);
    session.remember({ muted: true });
    expect(s.data.has(PREFS_KEY)).toBe(true);
  });
  it('after erase, remembering defaults still writes (lastWritten reset)', () => {
    const s = fakeStorage({ [PREFS_KEY]: serializePreferences(DEFAULT_PREFERENCES) });
    const session = startSession(s);
    session.erase();
    session.remember({ muted: false });
    // nothing is stored after erase, so the first remember writes even default values
    expect(s.data.get(PREFS_KEY)).toBe(serializePreferences(DEFAULT_PREFERENCES));
  });
  it('is silent when storage is unavailable', () => {
    const session = startSession(null);
    expect(() => session.erase()).not.toThrow();
  });
});

describe('no re-read (FR-005)', () => {
  it('never reads storage after start', () => {
    const s = fakeStorage();
    const session = startSession(s);
    const reads = s.calls.get;
    session.remember({ muted: true });
    session.erase();
    session.remember({ volume: 5 });
    expect(s.calls.get).toBe(reads);
  });
});

describe('two sessions, one storage (US4, FR-015)', () => {
  it('writes from one session are not adopted by the other', () => {
    const s = fakeStorage();
    const a = startSession(s);
    const b = startSession(s);
    a.remember({ muted: true, volume: 20 });
    expect(b.current).toEqual(DEFAULT_PREFERENCES);
    expect(a.current.muted).toBe(true);
  });
  it('the later write overwrites the earlier (last write wins)', () => {
    const s = fakeStorage();
    const a = startSession(s);
    const b = startSession(s);
    a.remember({ volume: 20 });
    b.remember({ volume: 60 });
    expect(JSON.parse(s.data.get(PREFS_KEY) as string).volume).toBe(0.6);
    expect(a.current.volume).toBe(20);
  });
  it('a fresh startSession reads the latest write', () => {
    const s = fakeStorage();
    const a = startSession(s);
    const b = startSession(s);
    a.remember({ volume: 20 });
    b.remember({ volume: 60 });
    expect(startSession(s).current.volume).toBe(60);
  });
  it('registers no storage event listener in src/lib/prefs or the store', () => {
    const root = resolve(__dirname, '../../../src/lib');
    const files = [
      ...readdirSync(join(root, 'prefs')).map((f) => join(root, 'prefs', f)),
      join(root, 'state/preferences.svelte.ts')
    ];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/addEventListener\s*\(\s*['"]storage['"]/);
      expect(src, f).not.toMatch(/onstorage/);
    }
  });
});

describe('metronome (035)', () => {
  const ratios = { ...DEFAULT_SETTINGS, bpm: 120, beats: 2 };
  const rest = {
    plain: DEFAULT_PLAIN_SETTINGS,
    speed: DEFAULT_SPEED_SETTINGS,
    mode: 'ratios'
  } as const;

  it('remember writes once, and is skipped when the record is unchanged', () => {
    const s = fakeStorage();
    const session = startSession(s);
    session.remember({ metronome: { ratios, ...rest } });
    const writes = s.calls.set;
    expect(s.data.get(PREFS_KEY)).toBe(serializePreferences(session.current));
    expect(JSON.parse(s.data.get(PREFS_KEY) as string).metronome.ratios.bpm).toBe(120);
    session.remember({ metronome: { ratios: { ...ratios }, ...rest } });
    expect(s.calls.set).toBe(writes);
  });

  it('leaves the other fields untouched (FR-009), and they leave it untouched', () => {
    const s = fakeStorage({ [PREFS_KEY]: FIXTURE_BY_NAME['v1-full'].raw });
    const session = startSession(s);
    session.remember({ metronome: { ratios, ...rest } });
    expect(session.current).toEqual({
      ...FIXTURE_BY_NAME['v1-full'].expected,
      metronome: { ratios, ...rest }
    });
    session.remember({ muted: false });
    expect(session.current.metronome.ratios).toEqual(ratios);
  });

  it('erase returns the metronome defaults', () => {
    const s = fakeStorage({ [PREFS_KEY]: FIXTURE_BY_NAME['metronome-full'].raw });
    const session = startSession(s);
    expect(session.current.metronome.ratios.bpm).toBe(140);
    session.erase();
    expect(session.current.metronome.ratios).toEqual(DEFAULT_SETTINGS);
  });
});
