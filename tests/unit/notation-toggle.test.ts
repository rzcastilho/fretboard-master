// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NotationToggle from '../../src/lib/shell/NotationToggle.svelte';
import NotationSelector from '../../src/lib/shell/NotationSelector.svelte';
import { language, resetLanguageForTests } from '../../src/lib/state/language.svelte';
import { notation, resetNotationForTests } from '../../src/lib/state/notation.svelte';
import { resetPreferencesForTests } from '../../src/lib/state/preferences.svelte';
import { resetShortcutsForTests, shortcuts } from '../../src/lib/state/shortcuts.svelte';

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
  resetShortcutsForTests();
});

const buttons = () => screen.getAllByRole('button') as HTMLButtonElement[];

describe('NotationToggle', () => {
  it('is a "Note names" group with two buttons: C D E and Do Re Mi', () => {
    render(NotationToggle);
    expect(screen.getByRole('group', { name: 'Note names' })).toBeTruthy();
    expect(buttons().map((b) => b.textContent?.trim())).toEqual(['C D E', 'Do Re Mi']);
  });

  it('pt-BR solfège button reads "Dó Ré Mi"', () => {
    language.restore('pt-BR');
    render(NotationToggle);
    expect(buttons().map((b) => b.textContent?.trim())).toEqual(['C D E', 'Dó Ré Mi']);
  });

  it('aria-pressed follows notation.effective, including a language default', () => {
    render(NotationToggle);
    expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    language.restore('es');
    flushSync();
    expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
  });

  it('click calls choose and updates pressed state', async () => {
    const choose = vi.spyOn(notation, 'choose');
    render(NotationToggle);
    await fireEvent.click(screen.getByRole('button', { name: 'Do Re Mi' }));
    expect(choose).toHaveBeenCalledWith('solfege');
    flushSync();
    expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
    await fireEvent.click(screen.getByRole('button', { name: 'C D E' }));
    expect(choose).toHaveBeenLastCalledWith('letters');
  });

  it('aria-keyshortcuts="N" on the group while shortcuts are on, absent once off', () => {
    render(NotationToggle);
    const group = screen.getByRole('group', { name: 'Note names' });
    expect(group.getAttribute('aria-keyshortcuts')).toBe('N');
    shortcuts.choose(false);
    flushSync();
    expect(group.hasAttribute('aria-keyshortcuts')).toBe(false);
  });

  it('each button enforces --target-min (44×44) and a visible focus ring', () => {
    const css = readFileSync('src/lib/shell/NotationToggle.svelte', 'utf8');
    expect(css).toMatch(/min-block-size:\s*var\(--target-min\)/);
    expect(css).toMatch(/min-inline-size:\s*var\(--target-min\)/);
    expect(css).toMatch(/:focus-visible/);
  });

  it('agrees with the panel radios', async () => {
    render(NotationToggle);
    render(NotationSelector);
    await fireEvent.click(screen.getByRole('radio', { name: 'Solfège' }));
    flushSync();
    expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
    await fireEvent.click(screen.getByRole('button', { name: 'C D E' }));
    flushSync();
    const checked = (screen.getAllByRole('radio') as HTMLInputElement[]).find((r) => r.checked);
    expect(checked?.value).toBe('letters');
  });
});
