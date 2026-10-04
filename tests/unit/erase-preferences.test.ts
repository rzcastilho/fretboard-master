import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const goto = vi.fn();
vi.mock('$app/navigation', () => ({ goto: (...args: unknown[]) => goto(...args) }));

import ErasePreferences from '../../src/lib/shell/ErasePreferences.svelte';
import { preferences, resetPreferencesForTests } from '../../src/lib/state/preferences.svelte';

beforeEach(() => {
  goto.mockReset();
  resetPreferencesForTests();
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

  it('buttons use the --target-min size token', () => {
    render(ErasePreferences);
    // jsdom does not resolve component CSS reliably; assert the rule is in the source.
    const src = import.meta.glob('../../src/lib/shell/ErasePreferences.svelte', {
      query: '?raw',
      import: 'default',
      eager: true
    });
    expect(Object.values(src)[0]).toContain('var(--target-min)');
  });
});
