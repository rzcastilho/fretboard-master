// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const goto = vi.fn();
vi.mock('$app/navigation', () => ({ goto: (...args: unknown[]) => goto(...args) }));

import ShellFailure from '../../src/lib/shell/ShellFailure.svelte';

const assign = vi.fn();

beforeEach(() => {
  goto.mockReset();
  assign.mockReset();
  vi.stubGlobal('location', { ...window.location, assign });
});

describe('ShellFailure', () => {
  it('shows message and a plain home link without reload attribute', () => {
    render(ShellFailure);
    expect(screen.getByText('Something went wrong in this view')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Go to home' });
    expect(link.getAttribute('href')).toBe('/');
    expect(link.hasAttribute('data-sveltekit-reload')).toBe(false);
  });

  it('calls reset then goto("/") without a location change', async () => {
    goto.mockResolvedValue(undefined);
    const reset = vi.fn();
    render(ShellFailure, { reset });
    await fireEvent.click(screen.getByRole('link', { name: 'Go to home' }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(goto).toHaveBeenCalledWith('/');
    expect(reset.mock.invocationCallOrder[0]).toBeLessThan(goto.mock.invocationCallOrder[0]);
    expect(assign).not.toHaveBeenCalled();
  });

  it('works without a reset prop', async () => {
    goto.mockResolvedValue(undefined);
    render(ShellFailure);
    await fireEvent.click(screen.getByRole('link', { name: 'Go to home' }));
    expect(goto).toHaveBeenCalledWith('/');
  });

  it('falls back to location.assign only when goto rejects', async () => {
    goto.mockRejectedValue(new Error('offline'));
    render(ShellFailure);
    await fireEvent.click(screen.getByRole('link', { name: 'Go to home' }));
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('/'));
  });
});
