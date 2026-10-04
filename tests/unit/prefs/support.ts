import type { StorageLike } from '../../../src/lib/prefs/storage';

export interface FakeStorage extends StorageLike {
  data: Map<string, string>;
  fail: { get: boolean; set: boolean; remove: boolean };
  calls: { get: number; set: number; remove: number };
  setItem(k: string, v: string): void;
}

/** In-memory Storage double with switchable failures and call counters. */
export function fakeStorage(initial: Record<string, string> = {}): FakeStorage {
  const data = new Map(Object.entries(initial));
  const fail = { get: false, set: false, remove: false };
  const calls = { get: 0, set: 0, remove: 0 };
  return {
    data,
    fail,
    calls,
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem(k: string) {
      calls.get++;
      if (fail.get) throw new Error('blocked');
      return data.get(k) ?? null;
    },
    setItem(k: string, v: string) {
      calls.set++;
      if (fail.set) throw new DOMException('full', 'QuotaExceededError');
      data.set(k, v);
    },
    removeItem(k: string) {
      calls.remove++;
      if (fail.remove) throw new Error('blocked');
      data.delete(k);
    }
  };
}
