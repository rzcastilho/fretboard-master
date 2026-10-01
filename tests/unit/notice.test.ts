import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Notice from '../../src/lib/shell/Notice.svelte';

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('Notice', () => {
  it('is a polite status region with the not-found text and a Dismiss button', () => {
    render(Notice, { message: 'We could not find that page', ondismiss: () => {} });
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toContain('We could not find that page');
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
  });

  it('does not use error styling', () => {
    render(Notice, { message: 'We could not find that page', ondismiss: () => {} });
    const status = screen.getByRole('status');
    expect(status.getAttribute('role')).not.toBe('alert');
    expect(status.className).not.toMatch(/error/i);
  });

  it('has no timer: still visible after 60 s', async () => {
    vi.useFakeTimers();
    render(Notice, { message: 'We could not find that page', ondismiss: () => {} });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('Dismiss removes the notice and focuses the screen h1', async () => {
    const h1 = document.createElement('h1');
    h1.tabIndex = -1;
    h1.textContent = 'Fretboard Master';
    document.body.appendChild(h1);
    render(Notice, {
      target: document.body.appendChild(document.createElement('div')),
      props: { message: 'We could not find that page', ondismiss: () => {} }
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).toBeNull();
    expect(document.activeElement).toBe(h1);
  });

  it('renders a generic message prop', () => {
    render(Notice, { message: 'Sound is unavailable', ondismiss: () => {} });
    expect(screen.getByRole('status').textContent).toContain('Sound is unavailable');
  });

  it('calls ondismiss when Dismiss is pressed', async () => {
    const ondismiss = vi.fn();
    render(Notice, { message: 'Hello', ondismiss });
    await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(ondismiss).toHaveBeenCalledTimes(1);
  });

  it('has no Dismiss button without a handler', () => {
    render(Notice, { message: 'Hello' });
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });

  it('renders an optional action button before Dismiss and calls it', async () => {
    const onclick = vi.fn();
    render(Notice, {
      message: 'There is no C♯ in this region',
      ondismiss: () => {},
      action: { label: 'Widen region', onclick }
    });
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Widen region', 'Dismiss']);
    await fireEvent.click(buttons[0]);
    expect(onclick).toHaveBeenCalledTimes(1);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  it('is unchanged without an action', () => {
    render(Notice, { message: 'Hello', ondismiss: () => {} });
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
