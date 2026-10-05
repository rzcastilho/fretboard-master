import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LanguagePanel from '../../src/lib/shell/LanguagePanel.svelte';
import { language, resetLanguageForTests } from '../../src/lib/state/language.svelte';
import { resetPreferencesForTests } from '../../src/lib/state/preferences.svelte';

beforeEach(() => {
  vi.restoreAllMocks();
  resetPreferencesForTests();
  resetLanguageForTests();
  language.start('en');
});

afterEach(() => {
  resetLanguageForTests();
});

const button = () => screen.getByRole('button', { name: 'Language' });

describe('LanguageButton + LanguagePanel', () => {
  it('button exposes aria-expanded and aria-controls; panel is closed at first', () => {
    render(LanguagePanel);
    expect(button().getAttribute('aria-expanded')).toBe('false');
    expect(button().getAttribute('aria-controls')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Language settings' })).toBeNull();
  });

  it('opens a non-modal region (not a dialog) controlled by the button', async () => {
    const { container } = render(LanguagePanel);
    await fireEvent.click(button());
    const panel = screen.getByRole('region', { name: 'Language settings' });
    expect(button().getAttribute('aria-expanded')).toBe('true');
    expect(button().getAttribute('aria-controls')).toBe(panel.id);
    expect(container.querySelector('dialog')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(panel).getAllByRole('radio')).toHaveLength(3);
  });

  it('close button closes and returns focus to the language button', async () => {
    render(LanguagePanel);
    await fireEvent.click(button());
    const panel = screen.getByRole('region', { name: 'Language settings' });
    await fireEvent.click(within(panel).getByRole('button', { name: 'Close language settings' }));
    flushSync();
    expect(screen.queryByRole('region')).toBeNull();
    expect(button().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button());
  });

  it('Escape inside the panel closes it and returns focus to the button', async () => {
    render(LanguagePanel);
    await fireEvent.click(button());
    const panel = screen.getByRole('region', { name: 'Language settings' });
    const radio = within(panel).getAllByRole('radio')[0] as HTMLElement;
    radio.focus();
    await fireEvent.keyDown(radio, { key: 'Escape' });
    flushSync();
    expect(screen.queryByRole('region')).toBeNull();
    expect(document.activeElement).toBe(button());
  });

  it('picking a language leaves the panel open and relabels it', async () => {
    render(LanguagePanel);
    await fireEvent.click(button());
    await fireEvent.click(screen.getByRole('radio', { name: 'Español' }));
    flushSync();
    expect(language.current).toBe('es');
    expect(screen.getByRole('region', { name: 'Ajustes de idioma' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Idioma' }).getAttribute('aria-expanded')).toBe(
      'true'
    );
  });

  it('opening and closing changes no history or URL', async () => {
    const push = vi.spyOn(history, 'pushState');
    const replace = vi.spyOn(history, 'replaceState');
    const href = location.href;
    const length = history.length;
    render(LanguagePanel);
    await fireEvent.click(button());
    await fireEvent.click(screen.getByRole('button', { name: 'Close language settings' }));
    flushSync();
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(location.href).toBe(href);
    expect(history.length).toBe(length);
  });
});
