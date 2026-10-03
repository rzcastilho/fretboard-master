import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  KEY_PREFIX,
  PREFS_KEY,
  PROBE_KEY,
  eraseAll,
  probeStorage,
  readRaw,
  resolveStorage,
  writeRaw
} from '../../../src/lib/prefs/storage';
import { fakeStorage } from './support';

afterEach(() => vi.unstubAllGlobals());

describe('keys', () => {
  it('are prefixed', () => {
    expect(KEY_PREFIX).toBe('fretboard-master:');
    expect(PREFS_KEY).toBe('fretboard-master:prefs');
    expect(PROBE_KEY).toBe('fretboard-master:probe');
  });
});

describe('probeStorage', () => {
  it('true on working storage and leaves no probe key', () => {
    const s = fakeStorage();
    expect(probeStorage(s)).toBe(true);
    expect(s.data.has(PROBE_KEY)).toBe(false);
    expect(s.data.size).toBe(0);
  });
  it.each(['get', 'set', 'remove'] as const)('false when %s throws', (m) => {
    const s = fakeStorage();
    s.fail[m] = true;
    expect(probeStorage(s)).toBe(false);
  });
  it('false on read-back mismatch', () => {
    const s = fakeStorage();
    s.getItem = () => 'something else';
    expect(probeStorage(s)).toBe(false);
  });
  it('false for null', () => expect(probeStorage(null)).toBe(false));
});

describe('resolveStorage', () => {
  it('null when accessing localStorage throws', () => {
    vi.stubGlobal('localStorage', undefined);
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('denied', 'SecurityError');
      }
    });
    expect(resolveStorage()).toBeNull();
  });
});

describe('readRaw', () => {
  it('returns stored value', () => {
    const s = fakeStorage({ [PREFS_KEY]: 'x' });
    expect(readRaw(s)).toBe('x');
  });
  it('null when absent', () => expect(readRaw(fakeStorage())).toBeNull());
  it('null on throw', () => {
    const s = fakeStorage({ [PREFS_KEY]: 'x' });
    s.fail.get = true;
    expect(readRaw(s)).toBeNull();
  });
  it('null for values longer than 16 384', () => {
    expect(readRaw(fakeStorage({ [PREFS_KEY]: 'a'.repeat(16_385) }))).toBeNull();
    expect(readRaw(fakeStorage({ [PREFS_KEY]: 'a'.repeat(16_384) }))).toHaveLength(16_384);
  });
});

describe('writeRaw', () => {
  it('writes', () => {
    const s = fakeStorage();
    writeRaw(s, 'v');
    expect(s.data.get(PREFS_KEY)).toBe('v');
  });
  it('swallows quota errors', () => {
    const s = fakeStorage();
    s.fail.set = true;
    expect(() => writeRaw(s, 'v')).not.toThrow();
  });
});

describe('eraseAll', () => {
  it('removes every prefixed key, keeps others', () => {
    const s = fakeStorage({
      [PREFS_KEY]: '1',
      [PROBE_KEY]: '2',
      'fretboard-master:future': '3',
      'fretboard-master:more': '4',
      other: '5',
      'x:fretboard-master:y': '6'
    });
    eraseAll(s);
    expect([...s.data.keys()].sort()).toEqual(['other', 'x:fretboard-master:y']);
  });
  it('swallows throws', () => {
    const s = fakeStorage({ [PREFS_KEY]: '1' });
    s.fail.remove = true;
    expect(() => eraseAll(s)).not.toThrow();
    const t = fakeStorage({ [PREFS_KEY]: '1' });
    t.key = () => {
      throw new Error('x');
    };
    expect(() => eraseAll(t)).not.toThrow();
  });
});
