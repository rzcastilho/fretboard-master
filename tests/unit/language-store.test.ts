import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PREFS_KEY } from '../../src/lib/prefs/storage';
import { GAP_WARNING } from '../../src/lib/i18n/gaps';
import { language, resetLanguageForTests } from '../../src/lib/state/language.svelte';
import { preferences, resetPreferencesForTests } from '../../src/lib/state/preferences.svelte';
import { getLocale } from '../../src/lib/paraglide/runtime.js';
import { fakeStorage } from './prefs/support';

function device(langs: readonly string[] | undefined, single = 'en-US'): void {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(langs as readonly string[]);
  vi.spyOn(navigator, 'language', 'get').mockReturnValue(single);
}

beforeEach(() => {
  vi.restoreAllMocks();
  resetPreferencesForTests();
  resetLanguageForTests();
});

afterEach(() => {
  resetLanguageForTests();
});

describe('language.start', () => {
  it('null stored + device pt-PT → pt-BR, no storage write', () => {
    device(['pt-PT']);
    const s = fakeStorage();
    preferences.start(s);
    expect(language.current).toBe('pt-BR');
    expect(language.chosen).toBeNull();
    expect(s.data.has(PREFS_KEY)).toBe(false); // the availability probe may write; the record never
    expect([...s.data.keys()].filter((k) => k === PREFS_KEY)).toEqual([]);
  });

  it('stored es wins over the device', () => {
    device(['pt-PT']);
    language.start('es');
    expect(language.current).toBe('es');
    expect(language.chosen).toBe('es');
  });

  it('falls back to navigator.language, then to English without navigator languages', () => {
    device([], 'es-MX');
    language.start(null);
    expect(language.current).toBe('es');
    resetLanguageForTests();
    device([], '');
    language.start(null);
    expect(language.current).toBe('en');
  });

  it('is idempotent', () => {
    device(['es-ES']);
    language.start(null);
    language.start('pt-BR');
    expect(language.current).toBe('es');
  });

  it('makes Paraglide follow the active language', () => {
    device(['pt-BR']);
    language.start(null);
    expect(getLocale()).toBe('pt-BR');
    language.choose('es');
    expect(getLocale()).toBe('es');
  });

  it('sets document.documentElement.lang', () => {
    device(['pt-PT']);
    language.start(null);
    expect(document.documentElement.lang).toBe('pt-BR');
    language.choose('en');
    expect(document.documentElement.lang).toBe('en');
  });
});

describe('language.choose', () => {
  it('writes the language, including when re-picking the active one', () => {
    device(['es-MX']);
    const s = fakeStorage();
    preferences.start(s);
    expect(language.current).toBe('es');
    language.choose('es');
    expect(language.chosen).toBe('es');
    expect(JSON.parse(s.data.get(PREFS_KEY) ?? '{}').language).toBe('es');
  });

  it('writes a different pick', () => {
    device(['en-US']);
    const s = fakeStorage();
    preferences.start(s);
    language.choose('pt-BR');
    expect(language.current).toBe('pt-BR');
    expect(s.data.get(PREFS_KEY)).toContain('"language":"pt-BR"');
  });

  it('still switches when storage is unavailable', () => {
    device(['en-US']);
    const s = fakeStorage();
    s.fail.set = true;
    preferences.start(s);
    expect(() => language.choose('es')).not.toThrow();
    expect(language.current).toBe('es');
    expect(document.documentElement.lang).toBe('es');
  });

  it('never fetches, navigates or touches history', () => {
    device(['en-US']);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const push = vi.spyOn(history, 'pushState');
    const replace = vi.spyOn(history, 'replaceState');
    preferences.start(fakeStorage());
    language.choose('es');
    language.choose('pt-BR');
    language.restore(null);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe('language.restore', () => {
  it('null re-resolves from the device and writes nothing', () => {
    device(['en-GB']);
    const s = fakeStorage();
    preferences.start(s);
    language.choose('es');
    const writes = s.calls.set;
    language.restore(null);
    expect(language.current).toBe('en');
    expect(language.chosen).toBeNull();
    expect(s.calls.set).toBe(writes);
  });

  it('a tag applies without persisting', () => {
    device(['en-GB']);
    const s = fakeStorage();
    preferences.start(s);
    language.restore('pt-BR');
    expect(language.current).toBe('pt-BR');
    expect(s.data.has(PREFS_KEY)).toBe(false);
  });
});

describe('gap reporting', () => {
  it('warns once per locale:key for missing text, never for English', () => {
    device(['en-US']);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    language.start(null);
    expect(warn).not.toHaveBeenCalled();
    language.choose('es');
    const first = warn.mock.calls.filter((c) => c[0] === GAP_WARNING).length;
    language.choose('en');
    language.choose('es');
    expect(warn.mock.calls.filter((c) => c[0] === GAP_WARNING).length).toBe(first);
  });
});

describe('gap reporting with stubbed missing text (SC-007)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('warns exactly once for the missing key; repeats stay silent; no fetch or storage write', () => {
    vi.stubGlobal('__FM_MISSING_TEXT__', { en: [], 'pt-BR': ['some_key'], es: [] });
    device(['en-US']);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    language.start(null);
    expect(warn).not.toHaveBeenCalled();

    language.restore('pt-BR');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(GAP_WARNING, { key: 'some_key', locale: 'pt-BR' });

    language.restore('pt-BR');
    language.restore('en');
    language.restore('pt-BR');
    expect(language.current).toBe('pt-BR');
    expect(warn).toHaveBeenCalledTimes(1);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });
});

describe('preferences integration', () => {
  it('erase re-resolves from the device', () => {
    device(['pt-PT']);
    const s = fakeStorage();
    preferences.start(s);
    language.choose('es');
    preferences.erase();
    expect(language.current).toBe('pt-BR');
    expect(language.chosen).toBeNull();
  });
});
