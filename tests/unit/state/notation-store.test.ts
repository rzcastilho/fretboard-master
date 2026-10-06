// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PREFS_KEY } from '../../../src/lib/prefs/storage';
import { noteLabel, spokenNote } from '../../../src/lib/notation/notation';
import { language, resetLanguageForTests } from '../../../src/lib/state/language.svelte';
import { notation, resetNotationForTests } from '../../../src/lib/state/notation.svelte';
import { preferences, resetPreferencesForTests } from '../../../src/lib/state/preferences.svelte';
import { fakeStorage } from '../prefs/support';

beforeEach(() => {
  vi.restoreAllMocks();
  resetPreferencesForTests();
  resetLanguageForTests();
  resetNotationForTests();
});

afterEach(() => {
  resetNotationForTests();
  resetLanguageForTests();
});

/** Session wired to a fake storage so `remember` writes can be read back. */
function started() {
  const s = fakeStorage();
  preferences.start(s);
  return s;
}
const stored = (s: ReturnType<typeof fakeStorage>) => JSON.parse(s.data.get(PREFS_KEY) ?? '{}');

describe('S-1 effective follows the language until a choice', () => {
  it('es gives solfège; en and pt-BR give letters', () => {
    notation.start({ notation: null, accidentals: 'sharps' });
    language.restore('es');
    expect(notation.effective).toBe('solfege');
    language.restore('en');
    expect(notation.effective).toBe('letters');
    language.restore('pt-BR');
    expect(notation.effective).toBe('letters');
    expect(notation.chosen).toBeNull();
  });

  it('after choose, a language change does not move it', () => {
    started();
    language.restore('en');
    notation.choose('letters');
    language.restore('es');
    expect(notation.effective).toBe('letters');
    notation.choose('solfege');
    language.restore('en');
    expect(notation.effective).toBe('solfege');
  });

  it('a stored choice wins from start', () => {
    language.restore('es');
    notation.start({ notation: 'letters', accidentals: 'flats' });
    expect(notation.chosen).toBe('letters');
    expect(notation.effective).toBe('letters');
    expect(notation.accidentals).toBe('flats');
  });
});

describe('choose and chooseAccidentals', () => {
  it('choose remembers { notation }, also when equal to the effective value', () => {
    const s = started();
    language.restore('en');
    expect(notation.effective).toBe('letters');
    notation.choose('letters');
    expect(stored(s).notation).toBe('letters');
    notation.choose('solfege');
    expect(stored(s).notation).toBe('solfege');
  });

  it('chooseAccidentals remembers { accidentals }', () => {
    const s = started();
    notation.chooseAccidentals('flats');
    expect(notation.accidentals).toBe('flats');
    expect(stored(s).accidentals).toBe('flats');
    notation.chooseAccidentals('both');
    expect(stored(s).accidentals).toBe('both');
    notation.chooseAccidentals('sharps');
    expect(stored(s).accidentals).toBeUndefined();
  });

  it('still switches when storage is unavailable', () => {
    const s = fakeStorage();
    s.fail.set = true;
    preferences.start(s);
    expect(() => notation.choose('solfege')).not.toThrow();
    expect(notation.effective).toBe('solfege');
  });
});

describe('restore', () => {
  it('does not persist', () => {
    const s = started();
    const writes = s.calls.set;
    notation.restore('solfege', 'both');
    expect(notation.chosen).toBe('solfege');
    expect(notation.accidentals).toBe('both');
    notation.restore(null, 'sharps');
    expect(notation.chosen).toBeNull();
    expect(notation.accidentals).toBe('sharps');
    expect(s.calls.set).toBe(writes);
    expect(s.data.has(PREFS_KEY)).toBe(false);
  });
});

describe('start', () => {
  it('is idempotent', () => {
    notation.start({ notation: 'solfege', accidentals: 'flats' });
    notation.start({ notation: 'letters', accidentals: 'both' });
    expect(notation.chosen).toBe('solfege');
    expect(notation.accidentals).toBe('flats');
  });

  it('installs the source: formatters follow the store', () => {
    language.restore('en');
    notation.start({ notation: null, accidentals: 'sharps' });
    const s = { letter: 'F', accidental: 1 } as const;
    expect(noteLabel(s)).toBe('F♯');
    notation.choose('solfege');
    expect(noteLabel(s)).toBe('Fa♯');
    expect(spokenNote(s)).toBe('Fa sharp');
    language.restore('es');
    expect(spokenNote(s)).toBe('Fa sostenido');
  });

  it('S-3: the source follows a language change while unchosen', () => {
    language.restore('en');
    notation.start({ notation: null, accidentals: 'sharps' });
    expect(noteLabel({ letter: 'C', accidental: 0 })).toBe('C');
    language.restore('es');
    expect(noteLabel({ letter: 'C', accidental: 0 })).toBe('Do');
  });

  it('does not write', () => {
    const s = fakeStorage();
    notation.start({ notation: 'solfege', accidentals: 'both' });
    expect(s.data.has(PREFS_KEY)).toBe(false);
  });
});

describe('S-2 no side effects', () => {
  it('never fetches, navigates, touches history or resets another store', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const push = vi.spyOn(history, 'pushState');
    const replace = vi.spyOn(history, 'replaceState');
    started();
    const lang = language.current;
    notation.choose('solfege');
    notation.chooseAccidentals('flats');
    notation.restore(null, 'sharps');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(language.current).toBe(lang);
  });
});
