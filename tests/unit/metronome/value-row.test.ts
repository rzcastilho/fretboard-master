// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ValueRow from '../../../src/lib/tools/metronome/ValueRow.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

function props(over: Record<string, unknown> = {}) {
  return {
    id: 'row',
    label: 'Row',
    min: 30,
    max: 300,
    value: 85,
    valuetext: '85 BPM',
    decreaseLabel: 'Less',
    increaseLabel: 'More',
    onset: vi.fn(),
    onstep: vi.fn(),
    ...over
  };
}

describe('ValueRow floor (037)', () => {
  it('disables − at value <= floor, and defaults the floor to min', () => {
    const { unmount } = render(ValueRow, props({ value: 85, floor: 85 }));
    expect((screen.getByRole('button', { name: 'Less' }) as HTMLButtonElement).disabled).toBe(true);
    unmount();
    render(ValueRow, props({ value: 86, floor: 85 }));
    expect((screen.getByRole('button', { name: 'Less' }) as HTMLButtonElement).disabled).toBe(
      false
    );
    document.body.innerHTML = '';
    render(ValueRow, props({ value: 30 }));
    expect((screen.getByRole('button', { name: 'Less' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('writes the value prop back into the input after a clamped commit', async () => {
    const onset = vi.fn();
    render(ValueRow, props({ value: 85, floor: 85, onset }));
    const input = screen.getByRole('slider') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: '60' } });
    expect(onset).toHaveBeenCalledWith(60);
    expect(input.value).toBe('85');
  });
});

describe('ValueRow tap (038)', () => {
  it('without tap the pill is a non-interactive <output aria-live="off">', () => {
    const { container } = render(ValueRow, props());
    const out = container.querySelector('output');
    expect(out?.getAttribute('aria-live')).toBe('off');
    expect(out?.textContent).toBe('85');
    expect(container.querySelector('button.tap')).toBeNull();
  });

  it('with tap the value is a button named "{bpm} BPM, tap tempo"; click calls the handler', async () => {
    const tap = vi.fn();
    const { container, rerender } = render(ValueRow, props({ tap }));
    const button = screen.getByRole('button', { name: '85 BPM, tap tempo' });
    expect(button.classList.contains('tap')).toBe(true);
    expect(button.getAttribute('title')).toBe('Tap tempo');
    expect(button.textContent).toBe('85');
    expect(container.querySelector('output')).toBeNull();
    await fireEvent.click(button);
    expect(tap).toHaveBeenCalledTimes(1);
    await rerender(props({ tap, value: 120 }));
    expect(screen.getByRole('button', { name: '120 BPM, tap tempo' }).textContent).toBe('120');
  });
});
