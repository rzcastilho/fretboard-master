import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Notice from '../../src/lib/shell/Notice.svelte';

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('Notice', () => {
  it('is a polite status region with the not-found text and a Dismiss button', () => {
    render(Notice);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toContain('We could not find that page');
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
  });

  it('does not use error styling', () => {
    render(Notice);
    const status = screen.getByRole('status');
    expect(status.getAttribute('role')).not.toBe('alert');
    expect(status.className).not.toMatch(/error/i);
  });

  it('has no timer: still visible after 60 s', async () => {
    vi.useFakeTimers();
    render(Notice);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('Dismiss removes the notice and focuses the screen h1', async () => {
    const h1 = document.createElement('h1');
    h1.tabIndex = -1;
    h1.textContent = 'Fretboard Master';
    document.body.appendChild(h1);
    render(Notice, { target: document.body.appendChild(document.createElement('div')) });
    await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).toBeNull();
    expect(document.activeElement).toBe(h1);
  });
});
