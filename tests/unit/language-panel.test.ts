import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LanguagePanel from '../../src/lib/shell/LanguagePanel.svelte';
import { language, resetLanguageForTests } from '../../src/lib/state/language.svelte';
import { notation, resetNotationForTests } from '../../src/lib/state/notation.svelte';
import { resetPreferencesForTests } from '../../src/lib/state/preferences.svelte';

beforeEach(() => {
  vi.restoreAllMocks();
  resetPreferencesForTests();
  resetLanguageForTests();
  resetNotationForTests();
  language.start('en');
  notation.start({ notation: null, accidentals: 'sharps' });
});

afterEach(() => {
  resetNotationForTests();
  resetLanguageForTests();
});

const button = () => screen.getByRole('button', { name: 'Language' });

describe('LanguageButton + LanguagePanel', () => {
  it('button exposes aria-expanded and aria-controls; panel is closed at first', () => {
    render(LanguagePanel);
    expect(button().getAttribute('aria-expanded')).toBe('false');
    expect(button().getAttribute('aria-controls')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Language and notation' })).toBeNull();
  });

  it('opens a non-modal region (not a dialog) controlled by the button', async () => {
    const { container } = render(LanguagePanel);
    await fireEvent.click(button());
    const panel = screen.getByRole('region', { name: 'Language and notation' });
    expect(button().getAttribute('aria-expanded')).toBe('true');
    expect(button().getAttribute('aria-controls')).toBe(panel.id);
    expect(container.querySelector('dialog')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    // 3 languages + 2 notations (accidentals arrive with US3)
    expect(within(panel).getAllByRole('radio').length).toBeGreaterThanOrEqual(5);
    expect(within(panel).getByRole('group', { name: 'Note names' })).toBeTruthy();
  });

  it('close button closes and returns focus to the language button', async () => {
    render(LanguagePanel);
    await fireEvent.click(button());
    const panel = screen.getByRole('region', { name: 'Language and notation' });
    await fireEvent.click(
      within(panel).getByRole('button', { name: 'Close language and notation settings' })
    );
    flushSync();
    expect(screen.queryByRole('region')).toBeNull();
    expect(button().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button());
  });

  it('Escape inside the panel closes it and returns focus to the button', async () => {
    render(LanguagePanel);
    await fireEvent.click(button());
    const panel = screen.getByRole('region', { name: 'Language and notation' });
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
    expect(screen.getByRole('region', { name: 'Idioma y notación' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Idioma' }).getAttribute('aria-expanded')).toBe(
      'true'
    );
  });

  it('renders NotationSelector under the language selector', async () => {
    render(LanguagePanel);
    await fireEvent.click(button());
    const panel = screen.getByRole('region', { name: 'Language and notation' });
    const groups = within(panel).getAllByRole('group');
    expect(groups[0]).toBe(within(panel).getByRole('group', { name: 'Language' }));
    expect(groups[1]).toBe(within(panel).getByRole('group', { name: 'Note names' }));
  });

  it('opening and closing changes no history or URL', async () => {
    const push = vi.spyOn(history, 'pushState');
    const replace = vi.spyOn(history, 'replaceState');
    const href = location.href;
    const length = history.length;
    render(LanguagePanel);
    await fireEvent.click(button());
    await fireEvent.click(
      screen.getByRole('button', { name: 'Close language and notation settings' })
    );
    flushSync();
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(location.href).toBe(href);
    expect(history.length).toBe(length);
  });
});
