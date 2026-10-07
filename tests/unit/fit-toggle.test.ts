// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { fit, resetFitForTests } from '../../src/lib/state/fit.svelte';
import FitToggle from '../../src/lib/tools/FitToggle.svelte';

afterEach(() => resetFitForTests());

describe('FitToggle (025 US2)', () => {
  it('is absent when fit is unavailable', () => {
    fit.handle({ kind: 'overflow', value: false });
    render(FitToggle);
    expect(screen.queryByRole('button', { name: 'Fit to screen' })).toBeNull();
  });

  it('is a toggle button, pressed only in whole mode', async () => {
    fit.handle({ kind: 'overflow', value: true });
    render(FitToggle);
    const button = screen.getByRole('button', { name: 'Fit to screen' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    await fireEvent.click(button);
    expect(fit.effective).toBe('whole');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    await fireEvent.click(button);
    expect(fit.effective).toBe('comfortable');
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps focus on the button after a click', async () => {
    fit.handle({ kind: 'overflow', value: true });
    render(FitToggle);
    const button = screen.getByRole('button', { name: 'Fit to screen' });
    button.focus();
    await fireEvent.click(button);
    expect(document.activeElement).toBe(button);
  });

  it('disappears when the neck stops overflowing', async () => {
    fit.handle({ kind: 'overflow', value: true });
    render(FitToggle);
    expect(screen.queryByRole('button', { name: 'Fit to screen' })).not.toBeNull();
    fit.handle({ kind: 'overflow', value: false });
    await Promise.resolve();
    expect(screen.queryByRole('button', { name: 'Fit to screen' })).toBeNull();
  });
});
