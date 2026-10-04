import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import PrefsNotice from '../../src/lib/shell/PrefsNotice.svelte';
import { preferences, resetPreferencesForTests } from '../../src/lib/state/preferences.svelte';
import type { StorageLike } from '../../src/lib/prefs/storage';

function working(): StorageLike {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k)
  };
}

function broken(): StorageLike {
  const fail = (): never => {
    throw new Error('blocked');
  };
  return { length: 0, key: fail, getItem: fail, setItem: fail, removeItem: fail };
}

beforeEach(() => resetPreferencesForTests());
afterEach(() => {
  document.body.innerHTML = '';
  resetPreferencesForTests();
});

describe('PrefsNotice', () => {
  it('renders nothing when storage works', () => {
    preferences.start(working());
    render(PrefsNotice);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows a polite one-line status with Dismiss when storage is blocked', () => {
    preferences.start(broken());
    render(PrefsNotice);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toContain("Preferences won't be remembered on this device.");
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
  });

  it('Dismiss hides it and it does not return', async () => {
    preferences.start(broken());
    render(PrefsNotice);
    await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).toBeNull();
    expect(preferences.noticeVisible).toBe(false);
    preferences.start(broken());
    expect(preferences.noticeVisible).toBe(false);
  });

  it('is not shown after Erase or after a failed write alone', () => {
    const base = working();
    const failing: StorageLike = {
      ...base,
      setItem: (k, v) => {
        if (k === 'fretboard-master:prefs') throw new Error('quota');
        base.setItem(k, v);
      }
    };
    preferences.start(failing);
    preferences.remember({ muted: true });
    preferences.erase();
    render(PrefsNotice);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
