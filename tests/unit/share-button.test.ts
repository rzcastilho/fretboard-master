// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ShareButton from '../../src/lib/shell/ShareButton.svelte';
import { shareTitle } from '../../src/lib/shell/share-title';
import {
  currentSnapshot,
  resetShareForTests,
  share,
  useSharePlatformForTests
} from '../../src/lib/state/share.svelte';
import { resetCagedForTests } from '../../src/lib/state/caged.svelte';
import { resetInstrumentForTests } from '../../src/lib/state/instrument.svelte';

beforeEach(() => {
  resetInstrumentForTests();
  resetCagedForTests();
  resetShareForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
  resetShareForTests();
});

describe('ShareButton', () => {
  it('is a native button of type=button with the visible text "Share"', () => {
    render(ShareButton, { tool: 'notes' });
    const button = screen.getByRole('button', { name: 'Share' });
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.textContent?.trim()).toBe('Share');
  });

  it('is not aria-busy at rest and aria-busy="true" while share.busy', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    useSharePlatformForTests({
      share: () => gate,
      writeText: null,
      coarsePointer: true
    });
    render(ShareButton, { tool: 'notes' });
    const button = screen.getByRole('button', { name: 'Share' });
    expect(button.getAttribute('aria-busy')).not.toBe('true');
    await fireEvent.click(button);
    await tick();
    expect(button.getAttribute('aria-busy')).toBe('true');
    release();
    await vi.waitFor(() => expect(button.getAttribute('aria-busy')).not.toBe('true'));
  });

  it.each(['notes', 'triads', 'caged'] as const)(
    'activation calls share.share(%s, shareTitle(currentSnapshot))',
    async (tool) => {
      const spy = vi.spyOn(share, 'share').mockResolvedValue(undefined);
      render(ShareButton, { tool });
      await fireEvent.click(screen.getByRole('button', { name: 'Share' }));
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(tool, shareTitle(currentSnapshot(tool)));
    }
  );

  it('registers itself as the opener and unregisters on destroy', () => {
    const register = vi.spyOn(share, 'registerOpener');
    const { unmount } = render(ShareButton, { tool: 'triads' });
    const button = screen.getByRole('button', { name: 'Share' });
    expect(register).toHaveBeenCalledWith(button);
    unmount();
    expect(register).toHaveBeenLastCalledWith(null);
  });

  it('declares the 44×44 touch target token', async () => {
    const { readFileSync } = await import('node:fs');
    // The size comes from the shared .link-button family (029).
    expect(readFileSync('src/lib/shell/ShareButton.svelte', 'utf8')).toMatch(
      /class="[^"]*\blink-button\b/
    );
    const family = readFileSync('src/lib/styles/controls.css', 'utf8');
    expect(family).toMatch(/\.link-button \{[^}]*min-block-size: var\(--target-min\)/);
    expect(family).toMatch(/\.link-button \{[^}]*min-inline-size: var\(--target-min\)/);
  });
});
