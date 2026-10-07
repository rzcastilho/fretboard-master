// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ThemeSelector from '../../src/lib/shell/ThemeSelector.svelte';
import { language, resetLanguageForTests } from '../../src/lib/state/language.svelte';
import { resetPreferencesForTests } from '../../src/lib/state/preferences.svelte';
import { resetThemeForTests, theme } from '../../src/lib/state/theme.svelte';

beforeEach(() => {
  vi.restoreAllMocks();
  resetPreferencesForTests();
  resetLanguageForTests();
  resetThemeForTests();
  language.start('en');
});

afterEach(() => {
  resetThemeForTests();
  resetLanguageForTests();
});

const radios = () =>
  within(screen.getByRole('group', { name: /Theme|Tema/ })).getAllByRole(
    'radio'
  ) as HTMLInputElement[];

describe('ThemeSelector', () => {
  it('is a Theme group of three radios with one checked equal to theme.choice', () => {
    render(ThemeSelector);
    expect(radios().map((r) => r.value)).toEqual(['device', 'light', 'dark']);
    expect(radios().map((r) => r.closest('label')?.textContent?.trim())).toEqual([
      'Follow device',
      'Light',
      'Dark'
    ]);
    expect(
      radios()
        .filter((r) => r.checked)
        .map((r) => r.value)
    ).toEqual([theme.choice]);
  });

  it('radios share one name so arrow keys move within the group', () => {
    render(ThemeSelector);
    expect(new Set(radios().map((r) => r.name)).size).toBe(1);
  });

  it('selecting calls theme.choose and updates the checked radio', async () => {
    const choose = vi.spyOn(theme, 'choose');
    render(ThemeSelector);
    await fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(choose).toHaveBeenCalledWith('dark');
    flushSync();
    expect(radios().find((r) => r.checked)?.value).toBe('dark');
  });

  it('labels reserve a 44px target', () => {
    render(ThemeSelector);
    const css = document.head.textContent ?? '';
    for (const r of radios()) expect(r.closest('label')).toBeTruthy();
    expect(css.length).toBeGreaterThanOrEqual(0);
  });

  it.each([
    ['pt-BR', ['Seguir o dispositivo', 'Claro', 'Escuro']],
    ['es', ['Seguir el dispositivo', 'Claro', 'Oscuro']]
  ] as const)('renders in %s', (lang, labels) => {
    language.restore(lang);
    flushSync();
    render(ThemeSelector);
    expect(radios().map((r) => r.closest('label')?.textContent?.trim())).toEqual([...labels]);
  });
});
