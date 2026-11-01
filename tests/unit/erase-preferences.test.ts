// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const goto = vi.fn();
vi.mock('$app/navigation', () => ({ goto: (...args: unknown[]) => goto(...args) }));

import ErasePreferences from '../../src/lib/shell/ErasePreferences.svelte';
import {
  DEFAULT_PLAIN_SETTINGS,
  DEFAULT_SETTINGS,
  DEFAULT_SPEED_SETTINGS
} from '../../src/lib/state/metronome-settings';
import { metronome, resetMetronomeForTests } from '../../src/lib/state/metronome.svelte';
import { preferences, resetPreferencesForTests } from '../../src/lib/state/preferences.svelte';

beforeEach(() => {
  goto.mockReset();
  resetPreferencesForTests();
  resetMetronomeForTests();
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const opener = () => screen.getByRole('button', { name: 'Erase my preferences' });

describe('ErasePreferences', () => {
  it('idle shows only the opener', () => {
    render(ErasePreferences);
    expect(opener()).toBeTruthy();
    expect(screen.queryByText('Erase all preferences on this device?')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('renders a div, not a nested section', () => {
    const { container } = render(ErasePreferences);
    expect(container.querySelector('section')).toBeNull();
    expect(container.querySelector('div.erase')).toBeTruthy();
  });

  it('confirming shows question, Erase and Cancel inline with focus on Cancel', async () => {
    render(ErasePreferences);
    await fireEvent.click(opener());
    expect(screen.getByText('Erase all preferences on this device?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Erase' })).toBeTruthy();
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    await vi.waitFor(() => expect(document.activeElement).toBe(cancel));
    expect(document.querySelector('dialog')).toBeNull();
  });

  it('Cancel returns to idle, focuses the opener, changes nothing', async () => {
    const erase = vi.spyOn(preferences, 'erase');
    render(ErasePreferences);
    await fireEvent.click(opener());
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    await vi.waitFor(() => expect(document.activeElement).toBe(opener()));
    expect(erase).not.toHaveBeenCalled();
    expect(goto).not.toHaveBeenCalled();
  });

  it('Escape behaves like Cancel', async () => {
    const erase = vi.spyOn(preferences, 'erase');
    render(ErasePreferences);
    await fireEvent.click(opener());
    await fireEvent.keyDown(screen.getByRole('button', { name: 'Cancel' }), { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    await vi.waitFor(() => expect(document.activeElement).toBe(opener()));
    expect(erase).not.toHaveBeenCalled();
  });

  it('Erase calls preferences.erase() and navigates home', async () => {
    const erase = vi.spyOn(preferences, 'erase');
    render(ErasePreferences);
    await fireEvent.click(opener());
    await fireEvent.click(screen.getByRole('button', { name: 'Erase' }));
    expect(erase).toHaveBeenCalledTimes(1);
    expect(goto).toHaveBeenCalledWith('/');
  });

  it('buttons use the --target-min size token', async () => {
    render(ErasePreferences);
    // jsdom does not resolve component CSS reliably; assert the rule is in the source.
    const src = import.meta.glob('../../src/lib/shell/ErasePreferences.svelte', {
      query: '?raw',
      import: 'default',
      eager: true
    });
    expect(Object.values(src)[0]).toContain('class="btn"');
    // The size comes from the shared .btn family (029).
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('src/lib/styles/controls.css', 'utf8')).toMatch(
      /\.btn,\s*\.option \{[^}]*min-block-size: var\(--target-min\)/
    );
  });
});

describe('Erase and the metronome settings (035)', () => {
  it('Erase resets the in-memory metronome settings to the defaults', async () => {
    metronome.setBpm(200);
    render(ErasePreferences);
    await fireEvent.click(opener());
    await fireEvent.click(screen.getByRole('button', { name: 'Erase' }));
    expect(metronome.settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe('Erase and the metronome mode (036)', () => {
  it('Erase returns both records to the defaults and the mode to Ratios', async () => {
    metronome.selectMode('plain');
    metronome.setBpm(100);
    render(ErasePreferences);
    await fireEvent.click(opener());
    await fireEvent.click(screen.getByRole('button', { name: 'Erase' }));
    expect(metronome.mode).toBe('ratios');
    expect(metronome.plain).toEqual(DEFAULT_PLAIN_SETTINGS);
    expect(metronome.settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe('Erase and the Speed Training record (037)', () => {
  it('Erase returns the speed record to the defaults and the mode to Ratios', async () => {
    metronome.restore({
      ratios: DEFAULT_SETTINGS,
      plain: DEFAULT_PLAIN_SETTINGS,
      speed: { ...DEFAULT_SPEED_SETTINGS, startBpm: 80, targetBpm: 120, atTarget: 'stop' },
      mode: 'speed'
    });
    render(ErasePreferences);
    await fireEvent.click(opener());
    await fireEvent.click(screen.getByRole('button', { name: 'Erase' }));
    expect(metronome.mode).toBe('ratios');
    expect(metronome.speed).toEqual(DEFAULT_SPEED_SETTINGS);
  });
});
