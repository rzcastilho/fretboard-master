// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PREFS_KEY } from '../../../src/lib/prefs/storage';
import { opening } from '../../../src/lib/state/opening.svelte';
import { preferences, resetPreferencesForTests } from '../../../src/lib/state/preferences.svelte';
import { resetThemeForTests, theme } from '../../../src/lib/state/theme.svelte';
import { fakeStorage } from '../prefs/support';

const attr = () => document.documentElement.getAttribute('data-theme');
const stored = (s: ReturnType<typeof fakeStorage>) => JSON.parse(s.data.get(PREFS_KEY) ?? '{}');

beforeEach(() => {
  vi.restoreAllMocks();
  resetPreferencesForTests();
  resetThemeForTests();
});

afterEach(() => {
  resetThemeForTests();
});

describe('theme store', () => {
  it("choose('dark') sets the attribute and remembers theme dark", () => {
    const s = fakeStorage();
    preferences.start(s);
    theme.choose('dark');
    expect(theme.choice).toBe('dark');
    expect(attr()).toBe('dark');
    expect(stored(s).theme).toBe('dark');
  });

  it("choose('device') removes the attribute and remembers null", () => {
    const s = fakeStorage();
    preferences.start(s);
    theme.choose('dark');
    theme.choose('device');
    expect(theme.choice).toBe('device');
    expect(attr()).toBeNull();
    expect(stored(s).theme ?? null).toBeNull();
  });

  it('still sets the attribute when storage is unavailable', () => {
    const s = fakeStorage();
    s.fail.get = true;
    s.fail.set = true;
    preferences.start(s);
    theme.choose('light');
    expect(attr()).toBe('light');
    expect(theme.choice).toBe('light');
  });

  it('start applies a stored pin', () => {
    theme.start('dark');
    expect(theme.choice).toBe('dark');
    expect(attr()).toBe('dark');
  });

  it('preferences.erase() returns to device and clears the attribute', () => {
    preferences.start(fakeStorage({ [PREFS_KEY]: '{"version":1,"theme":"dark"}' }));
    expect(theme.choice).toBe('dark');
    preferences.erase();
    expect(theme.choice).toBe('device');
    expect(attr()).toBeNull();
  });

  it('opening a share link leaves the choice untouched', () => {
    theme.start('dark');
    opening.start('http://localhost/');
    expect(theme.choice).toBe('dark');
    expect(attr()).toBe('dark');
  });
});
