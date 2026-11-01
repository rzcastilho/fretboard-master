// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { language, resetLanguageForTests } from '../../../src/lib/state/language.svelte';
import { METRONOME_MODES } from '../../../src/lib/state/metronome-settings';
import ModeTabs from '../../../src/lib/tools/metronome/ModeTabs.svelte';

beforeEach(() => {
  resetLanguageForTests();
  language.start('en');
});
afterEach(() => {
  resetLanguageForTests();
  document.body.innerHTML = '';
});

describe('ModeTabs', () => {
  it('renders a named tablist with tabs in METRONOME_MODES order', () => {
    render(ModeTabs, { mode: 'ratios', onselect: () => {} });
    const list = screen.getByRole('tablist', { name: 'Metronome modes' });
    const tabs = screen.getAllByRole('tab');
    expect(list).toBeTruthy();
    expect(tabs.map((t) => t.id)).toEqual(METRONOME_MODES.map((m) => `metronome-tab-${m}`));
    expect(tabs.map((t) => t.id)).toEqual([
      'metronome-tab-plain',
      'metronome-tab-speed',
      'metronome-tab-ratios'
    ]);
    expect(tabs.map((t) => t.textContent?.trim())).toEqual([
      'Metronome',
      'Speed Training',
      'Ratios Training'
    ]);
  });

  it('marks the selected tab and uses a roving tabindex', () => {
    render(ModeTabs, { mode: 'ratios', onselect: () => {} });
    const [plain, speed, ratios] = screen.getAllByRole('tab');
    expect(ratios.getAttribute('aria-selected')).toBe('true');
    expect(ratios.getAttribute('tabindex')).toBe('0');
    for (const t of [plain, speed]) {
      expect(t.getAttribute('aria-selected')).toBe('false');
      expect(t.getAttribute('tabindex')).toBe('-1');
    }
    for (const t of [plain, speed, ratios]) {
      expect(t.getAttribute('aria-controls')).toBe('metronome-mode-panel');
    }
  });

  it('hides the icons from assistive tech so the name is the text alone', () => {
    render(ModeTabs, { mode: 'plain', onselect: () => {} });
    for (const t of screen.getAllByRole('tab')) {
      const svg = t.querySelector('svg');
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
      expect(svg?.getAttribute('focusable')).toBe('false');
    }
    expect(screen.getByRole('tab', { name: 'Metronome' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Speed Training' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Ratios Training' })).toBeTruthy();
  });

  it('arrow keys wrap across three tabs, Home/End jump, and none of them select', async () => {
    const onselect = vi.fn();
    render(ModeTabs, { mode: 'ratios', onselect });
    const [plain, speed, ratios] = screen.getAllByRole('tab');
    ratios.focus();
    await fireEvent.keyDown(ratios, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(plain);
    await fireEvent.keyDown(plain, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(speed);
    await fireEvent.keyDown(speed, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(plain);
    await fireEvent.keyDown(plain, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(ratios);
    await fireEvent.keyDown(ratios, { key: 'Home' });
    expect(document.activeElement).toBe(plain);
    await fireEvent.keyDown(plain, { key: 'End' });
    expect(document.activeElement).toBe(ratios);
    expect(onselect).not.toHaveBeenCalled();
  });

  it('click selects the tab', async () => {
    const onselect = vi.fn();
    render(ModeTabs, { mode: 'ratios', onselect });
    await fireEvent.click(screen.getByRole('tab', { name: 'Metronome' }));
    expect(onselect).toHaveBeenCalledWith('plain');
  });
});
