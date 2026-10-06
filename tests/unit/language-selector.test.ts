// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LanguageSelector from '../../src/lib/shell/LanguageSelector.svelte';
import { language, resetLanguageForTests } from '../../src/lib/state/language.svelte';
import { resetPreferencesForTests } from '../../src/lib/state/preferences.svelte';
import { LANGUAGES, type LanguageTag } from '../../src/lib/i18n/languages';

const LEGENDS: Record<LanguageTag, string> = { en: 'Language', 'pt-BR': 'Idioma', es: 'Idioma' };

beforeEach(() => {
  vi.restoreAllMocks();
  resetPreferencesForTests();
  resetLanguageForTests();
  language.start('en');
});

afterEach(() => {
  resetLanguageForTests();
});

const radios = () => screen.getAllByRole('radio') as HTMLInputElement[];

describe('LanguageSelector', () => {
  it('has exactly three radios in order English, Português, Español with their own lang', () => {
    render(LanguageSelector);
    const r = radios();
    expect(r).toHaveLength(3);
    expect(r.map((x) => x.value)).toEqual(LANGUAGES.map((l) => l.tag));
    const labels = r.map((x) => x.closest('label') as HTMLLabelElement);
    expect(labels.map((l) => l.textContent?.trim())).toEqual(['English', 'Português', 'Español']);
    expect(labels.map((l) => l.getAttribute('lang'))).toEqual(['en', 'pt-BR', 'es']);
  });

  for (const tag of ['en', 'pt-BR', 'es'] as const) {
    it(`autonyms and order are constant when the active language is ${tag}`, () => {
      language.restore(tag);
      render(LanguageSelector);
      const labels = radios().map((x) => x.closest('label')?.textContent?.trim());
      expect(labels).toEqual(['English', 'Português', 'Español']);
      expect(radios().find((x) => x.checked)?.value).toBe(tag);
      expect(screen.getByRole('group', { name: LEGENDS[tag] })).toBeTruthy();
    });
  }

  it('checked radio follows language.current and legend is translated on switch', () => {
    render(LanguageSelector);
    expect(radios().find((x) => x.checked)?.value).toBe('en');
    language.restore('es');
    flushSync();
    expect(radios().find((x) => x.checked)?.value).toBe('es');
    expect(screen.getByRole('group', { name: 'Idioma' })).toBeTruthy();
  });

  it('change calls language.choose', async () => {
    const choose = vi.spyOn(language, 'choose');
    render(LanguageSelector);
    const es = within(screen.getByRole('group')).getByRole('radio', { name: 'Español' });
    await fireEvent.click(es);
    expect(choose).toHaveBeenCalledWith('es');
    expect(language.current).toBe('es');
  });

  it('keeps the focused radio focused across a re-render without remount', async () => {
    render(LanguageSelector);
    const pt = screen.getByRole('radio', { name: 'Português' }) as HTMLInputElement;
    pt.focus();
    await fireEvent.click(pt);
    flushSync();
    const after = screen.getByRole('radio', { name: 'Português' });
    expect(after).toBe(pt);
    expect(document.activeElement).toBe(pt);
    expect(language.current).toBe('pt-BR');
  });
});
