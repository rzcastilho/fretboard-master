import { fireEvent, render, screen } from '@testing-library/svelte';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ShareFallback from '../../src/lib/shell/ShareFallback.svelte';
import {
  resetShareForTests,
  share,
  useSharePlatformForTests
} from '../../src/lib/state/share.svelte';

const HREF = 'https://fretboard.example/caged?v=1&rt=9&sp=none&q=minor';

let opener: HTMLButtonElement;

/** Open the fallback through the store (no clipboard), then render the panel for it. */
async function open() {
  useSharePlatformForTests({ share: null, writeText: null, coarsePointer: false });
  await share.share('notes', 'x');
  expect(share.fallback).not.toBeNull();
  return render(ShareFallback, { href: HREF });
}

beforeEach(() => {
  resetShareForTests();
  opener = document.createElement('button');
  opener.textContent = 'Share';
  document.body.append(opener);
  share.registerOpener(opener);
});

afterEach(() => {
  opener.remove();
  resetShareForTests();
});

describe('ShareFallback', () => {
  it('is a section labelled by a <label for> that names the input', async () => {
    await open();
    const section = screen.getByRole('region', { name: 'Share link' });
    expect(section.tagName).toBe('SECTION');
    const input = screen.getByLabelText('Copy this address') as HTMLInputElement;
    const label = document.querySelector<HTMLLabelElement>(`label[for="${input.id}"]`);
    expect(label?.textContent?.trim()).toBe('Copy this address');
    const regionName = document.getElementById(section.getAttribute('aria-labelledby') ?? '');
    expect(regionName?.textContent).toBe('Share link');
  });

  it('shows the href in a read-only text input', async () => {
    await open();
    const input = screen.getByLabelText('Copy this address') as HTMLInputElement;
    expect(input.tagName).toBe('INPUT');
    expect(input.type).toBe('text');
    expect(input.readOnly).toBe(true);
    expect(input.value).toBe(HREF);
  });

  it('focuses the field with its whole value selected on mount', async () => {
    await open();
    const input = screen.getByLabelText('Copy this address') as HTMLInputElement;
    await vi_tick();
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(HREF.length);
  });

  it('Dismiss closes the panel and returns focus to the opener', async () => {
    const { unmount } = await open();
    await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(share.fallback).toBeNull();
    expect(document.activeElement).toBe(opener);
    unmount();
  });

  it('Escape inside the section closes it and returns focus to the opener', async () => {
    await open();
    const input = screen.getByLabelText('Copy this address');
    await fireEvent.keyDown(input, { key: 'Escape' });
    expect(share.fallback).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('other keys leave it open and Tab is never prevented (no focus trap)', async () => {
    await open();
    const input = screen.getByLabelText('Copy this address');
    const notPrevented = await fireEvent.keyDown(input, { key: 'Tab' });
    expect(notPrevented).toBe(true);
    expect(share.fallback).not.toBeNull();
  });

  it('is not a modal and uses no error styling', async () => {
    await open();
    const section = screen.getByRole('region', { name: 'Share link' });
    expect(section.getAttribute('role')).toBeNull();
    expect(section.getAttribute('aria-modal')).toBeNull();
    expect(section.className).not.toMatch(/error/i);
    const source = readFileSync('src/lib/shell/ShareFallback.svelte', 'utf8');
    expect(source).not.toMatch(/color-error|color-danger/);
    expect(source).toContain('min-inline-size: 0');
    expect(source).toContain('inline-size: 100%');
  });
});

async function vi_tick(): Promise<void> {
  const { tick } = await import('svelte');
  await tick();
}
