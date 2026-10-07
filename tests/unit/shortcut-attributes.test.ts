// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetCagedForTests } from '../../src/lib/state/caged.svelte';
import { resetNotesForTests } from '../../src/lib/state/notes.svelte';
import { resetPlaybackForTests } from '../../src/lib/state/playback.svelte';
import { resetPreferencesForTests } from '../../src/lib/state/preferences.svelte';
import { resetShortcutsForTests, shortcuts } from '../../src/lib/state/shortcuts.svelte';
import { resetTriadsForTests } from '../../src/lib/state/triads.svelte';
import CagedTool from '../../src/lib/tools/caged/CagedTool.svelte';
import NotesTool from '../../src/lib/tools/notes/NotesTool.svelte';
import TriadsTool from '../../src/lib/tools/triads/TriadsTool.svelte';

beforeEach(() => {
  resetPlaybackForTests();
  resetPreferencesForTests();
  resetNotesForTests();
  resetTriadsForTests();
  resetCagedForTests();
  resetShortcutsForTests();
});

afterEach(() => resetShortcutsForTests());

const attr = (el: HTMLElement) => el.getAttribute('aria-keyshortcuts');

describe('aria-keyshortcuts while shortcuts are on', () => {
  it('Notes: Listen P, label-type group L', () => {
    render(NotesTool);
    expect(attr(screen.getByRole('button', { name: 'Listen' }))).toBe('P');
    expect(attr(screen.getByRole('radiogroup', { name: 'Label' }))).toBe('L');
  });

  it('Triads: main Listen P (not comparison), inversion ". ,", labels L', () => {
    render(TriadsTool);
    expect(attr(screen.getByRole('button', { name: 'Listen' }))).toBe('P');
    // Listen to comparison (when shown) never carries the shortcut.
    expect(
      screen
        .queryByRole('button', { name: 'Listen to comparison' })
        ?.hasAttribute('aria-keyshortcuts') ?? false
    ).toBe(false);
    expect(attr(screen.getByRole('radiogroup', { name: 'Inversion' }))).toBe('. ,');
    expect(attr(screen.getByRole('radiogroup', { name: 'Labels' }))).toBe('L');
  });

  it('CAGED: Listen P, Previous ",", Next ".", labels L', () => {
    render(CagedTool);
    expect(attr(screen.getByRole('button', { name: 'Listen' }))).toBe('P');
    expect(attr(screen.getByRole('button', { name: 'Previous shape' }))).toBe(',');
    expect(attr(screen.getByRole('button', { name: 'Next shape' }))).toBe('.');
    expect(attr(screen.getByRole('radiogroup', { name: 'Labels' }))).toBe('L');
  });
});

describe('aria-keyshortcuts while shortcuts are off', () => {
  it('Notes, Triads and CAGED carry none', () => {
    shortcuts.choose(false);
    for (const tool of [NotesTool, TriadsTool, CagedTool]) {
      const { container, unmount } = render(tool);
      flushSync();
      expect(container.querySelectorAll('[aria-keyshortcuts]')).toHaveLength(0);
      unmount();
    }
  });
});
