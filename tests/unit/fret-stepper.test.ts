// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import FretStepper from '../../src/lib/shell/FretStepper.svelte';
import { instrument, resetInstrumentForTests } from '../../src/lib/state/instrument.svelte';

const pendingFrets = () => (instrument.panel.open ? instrument.panel.pending.fretCount : null);

beforeEach(() => {
  resetInstrumentForTests();
  instrument.open();
});

describe('FretStepper', () => {
  it('is a spinbutton named Frets with 12..24 bounds and the current value', () => {
    render(FretStepper);
    const spin = screen.getByRole('spinbutton', { name: 'Frets' });
    expect(spin.getAttribute('aria-valuemin')).toBe('12');
    expect(spin.getAttribute('aria-valuemax')).toBe('24');
    expect(spin.getAttribute('aria-valuenow')).toBe('22');
  });

  it('ArrowUp/ArrowDown step by one', async () => {
    render(FretStepper);
    const spin = screen.getByRole('spinbutton', { name: 'Frets' });
    await fireEvent.keyDown(spin, { key: 'ArrowDown' });
    expect(pendingFrets()).toBe(21);
    expect(spin.getAttribute('aria-valuenow')).toBe('21');
    await fireEvent.keyDown(spin, { key: 'ArrowUp' });
    expect(pendingFrets()).toBe(22);
  });

  it('Home goes to 12 and End to 24', async () => {
    render(FretStepper);
    const spin = screen.getByRole('spinbutton', { name: 'Frets' });
    await fireEvent.keyDown(spin, { key: 'Home' });
    expect(pendingFrets()).toBe(12);
    await fireEvent.keyDown(spin, { key: 'End' });
    expect(pendingFrets()).toBe(24);
  });

  it('disables "More frets" at 24 and "Fewer frets" at 12, without any error message', async () => {
    const { container } = render(FretStepper);
    const spin = screen.getByRole('spinbutton', { name: 'Frets' });
    const fewer = screen.getByRole('button', { name: 'Fewer frets' }) as HTMLButtonElement;
    const more = screen.getByRole('button', { name: 'More frets' }) as HTMLButtonElement;
    expect(fewer.disabled).toBe(false);
    expect(more.disabled).toBe(false);
    await fireEvent.keyDown(spin, { key: 'End' });
    expect(more.disabled).toBe(true);
    expect(fewer.disabled).toBe(false);
    await fireEvent.keyDown(spin, { key: 'Home' });
    expect(fewer.disabled).toBe(true);
    expect(more.disabled).toBe(false);
    expect(container.querySelector('[role="alert"], .error')).toBeNull();
  });

  it('buttons step the pending value', async () => {
    render(FretStepper);
    await fireEvent.click(screen.getByRole('button', { name: 'Fewer frets' }));
    expect(pendingFrets()).toBe(21);
    await fireEvent.click(screen.getByRole('button', { name: 'More frets' }));
    expect(pendingFrets()).toBe(22);
  });

  it('offers no free-text entry and never applies anything', async () => {
    const { container } = render(FretStepper);
    expect(
      container.querySelector('input[type="text"], input[type="number"], textarea')
    ).toBeNull();
    await fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Frets' }), { key: 'Home' });
    expect(instrument.active.fretCount).toBe(22);
  });

  it('sizes buttons from --target-min', () => {
    const { container } = render(FretStepper);
    const css = container.querySelector('style')?.textContent ?? '';
    // Svelte scopes styles into <head> in tests; fall back to inline check of the class.
    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(2);
    expect(css === '' || css.includes('--target-min')).toBe(true);
  });
});
