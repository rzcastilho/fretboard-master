// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Notice from '../../src/lib/shell/Notice.svelte';
import { hexToSrgb } from './a11y/color';
import { parseTokenSheet, resolveLightDark } from './a11y/tokens';

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
      actions: [{ label: 'Widen region', onclick }]
    });
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Widen region', 'Dismiss']);
    await fireEvent.click(buttons[0]);
    expect(onclick).toHaveBeenCalledTimes(1);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  it('renders several actions in DOM order with Dismiss last', async () => {
    const first = vi.fn();
    const second = vi.fn();
    render(Notice, {
      message: 'This view uses a different tuning',
      ondismiss: () => {},
      actions: [
        { label: 'Use mine', onclick: first },
        { label: 'Adopt this one', onclick: second }
      ]
    });
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent?.trim())).toEqual([
      'Use mine',
      'Adopt this one',
      'Dismiss'
    ]);
    await fireEvent.click(buttons[1]);
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it('is unchanged without actions or with an empty list', () => {
    render(Notice, { message: 'Hello', ondismiss: () => {}, actions: [] });
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('is unchanged without an action', () => {
    render(Notice, { message: 'Hello', ondismiss: () => {} });
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  describe('calm in both themes (026)', () => {
    const css = readFileSync('src/lib/shell/Notice.svelte', 'utf8');
    const sheet = parseTokenSheet();

    it('is non-blocking: no dialog or alert role, no fixed overlay, no focus trap', () => {
      render(Notice, { message: 'Sound is unavailable', ondismiss: () => {} });
      const status = screen.getByRole('status');
      expect(status.getAttribute('role')).toBe('status');
      expect(status.getAttribute('aria-modal')).toBeNull();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(css).not.toMatch(/position:\s*fixed/);
      expect(css).not.toMatch(/z-index/);
    });

    it('is dismissible', async () => {
      const ondismiss = vi.fn();
      render(Notice, { message: 'Limit reached', ondismiss });
      await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
      expect(ondismiss).toHaveBeenCalledTimes(1);
    });

    it('keeps its text inside two lines of copy (no multi-paragraph body)', () => {
      render(Notice, { message: 'Sound is unavailable', ondismiss: () => {} });
      const status = screen.getByRole('status');
      expect(status.querySelectorAll('p,ul,ol,br').length).toBeLessThanOrEqual(1);
      expect(css).not.toMatch(/min-block-size:\s*\d+(rem|px|vh)/);
    });

    it('uses no error-red token in either theme', () => {
      for (const name of [
        '--color-notice-surface',
        '--color-notice-text',
        '--color-notice-border'
      ]) {
        const value = sheet.root[name];
        expect(value, name).toBeDefined();
        for (const hex of resolveLightDark(value).filter((v) => v.startsWith('#'))) {
          const [r, g, b] = hexToSrgb(hex);
          const redDominant = r > 0.55 && r > g * 1.6 && r > b * 1.6;
          expect(redDominant, `${name} ${hex}`).toBe(false);
        }
      }
      expect(css).not.toMatch(/--color-(error|danger|root)/);
    });
  });
});
