// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import FailureView from '../../src/lib/shell/FailureView.svelte';

describe('FailureView', () => {
  it('shows the Tool error region, message, Reset tool button and home link', () => {
    render(FailureView, { reset: vi.fn() });
    const region = screen.getByRole('region', { name: 'Tool error' });
    expect(region.textContent).toContain('Something went wrong in this view');
    expect(screen.getByRole('button', { name: 'Reset tool' })).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Go to home' });
    expect(link.getAttribute('href')).toBe('/');
  });

  it('Reset tool calls the supplied reset', async () => {
    const reset = vi.fn();
    render(FailureView, { reset });
    await fireEvent.click(screen.getByRole('button', { name: 'Reset tool' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
