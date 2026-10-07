// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ShortcutList from '../../src/lib/shell/ShortcutList.svelte';
import { resetPreferencesForTests } from '../../src/lib/state/preferences.svelte';
import { resetShortcutsForTests, shortcuts } from '../../src/lib/state/shortcuts.svelte';

beforeEach(() => {
  resetPreferencesForTests();
  resetShortcutsForTests();
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('ShortcutList', () => {
  it('renders five rows in order P . , L N with localized actions', () => {
    const { container } = render(ShortcutList);
    const rows = [...container.querySelectorAll('dl > div')];
    expect(rows).toHaveLength(5);
    const keys = rows.map((r) => r.querySelector('dt kbd')?.textContent?.trim());
    expect(keys).toEqual(['P', '.period', ',comma', 'L', 'N']);
    expect(rows[0]?.querySelector('dd')?.textContent?.trim()).toBe('Listen');
    expect(rows[4]?.querySelector('dd')?.textContent).toContain('notation');
  });

  it('punctuation keys hide the glyph and speak the name', () => {
    const { container } = render(ShortcutList);
    const kbds = container.querySelectorAll('kbd');
    for (const [i, glyph, name] of [
      [1, '.', 'period'],
      [2, ',', 'comma']
    ] as const) {
      const spans = kbds[i]?.querySelectorAll('span');
      expect(spans).toHaveLength(2);
      expect(spans[0]?.getAttribute('aria-hidden')).toBe('true');
      expect(spans[0]?.textContent).toBe(glyph);
      expect(spans[1]?.classList.contains('sr-only')).toBe(true);
      expect(spans[1]?.textContent).toBe(name);
    }
  });

  it('the switch is a named checkbox with role switch, checked by default', () => {
    render(ShortcutList);
    const sw = screen.getByRole('switch', { name: 'Keyboard shortcuts' }) as HTMLInputElement;
    expect(sw.type).toBe('checkbox');
    expect(sw.checked).toBe(true);
  });

  it('toggling calls shortcuts.choose', async () => {
    const choose = vi.spyOn(shortcuts, 'choose');
    render(ShortcutList);
    const sw = screen.getByRole('switch', { name: 'Keyboard shortcuts' });
    await fireEvent.click(sw);
    expect(choose).toHaveBeenCalledWith(false);
    await fireEvent.click(sw);
    expect(choose).toHaveBeenLastCalledWith(true);
  });
});
