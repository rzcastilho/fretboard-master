import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import TriadsSecondary from '../../../src/lib/tools/triads/TriadsSecondary.svelte';

function mount(octave: { up: boolean; down: boolean; applies?: boolean }) {
  const onoctaveup = vi.fn();
  const onreset = vi.fn();
  const onoctavedown = vi.fn();
  render(TriadsSecondary, {
    labelType: 'interval',
    onlabeltype: vi.fn(),
    octave: { applies: true, ...octave },
    onoctaveup,
    onoctavedown,
    listen: { enabled: true },
    onlisten: vi.fn(),
    onreset
  });
  return { onoctaveup, onoctavedown, onreset };
}

describe('TriadsSecondary octave commands (US4)', () => {
  it('disabled commands are aria-disabled, still rendered and focusable, no error styling', () => {
    mount({ up: true, down: false });
    const down = screen.getByRole('button', { name: 'Octave down' });
    expect(down.getAttribute('aria-disabled')).toBe('true');
    expect(down.hasAttribute('disabled')).toBe(false);
    expect(down.getAttribute('tabindex')).not.toBe('-1');
    expect(down.getAttribute('aria-invalid')).toBeNull();
    expect(down.className).not.toMatch(/error/i);
    down.focus();
    expect(document.activeElement).toBe(down);
    expect(screen.getByRole('button', { name: 'Octave up' }).getAttribute('aria-disabled')).toBe(
      'false'
    );
  });

  it('activating a disabled command does nothing', async () => {
    const { onoctaveup, onoctavedown } = mount({ up: false, down: false });
    await fireEvent.click(screen.getByRole('button', { name: 'Octave up' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Octave down' }));
    expect(onoctaveup).not.toHaveBeenCalled();
    expect(onoctavedown).not.toHaveBeenCalled();
  });

  it('activating an enabled command calls its handler', async () => {
    const { onoctaveup, onoctavedown } = mount({ up: true, down: true });
    await fireEvent.click(screen.getByRole('button', { name: 'Octave up' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Octave down' }));
    expect(onoctaveup).toHaveBeenCalledTimes(1);
    expect(onoctavedown).toHaveBeenCalledTimes(1);
  });
});

describe('TriadsSecondary outside Isolated and Reset tool (US2)', () => {
  it('octave buttons are aria-disabled with the hint when the octave does not apply', async () => {
    const { onoctaveup, onoctavedown } = mount({ up: true, down: true, applies: false });
    for (const name of ['Octave up', 'Octave down']) {
      const b = screen.getByRole('button', { name });
      expect(b.getAttribute('aria-disabled')).toBe('true');
      expect(b.hasAttribute('disabled')).toBe(false);
      const hint = b.getAttribute('aria-describedby');
      expect(hint).toBeTruthy();
      expect(document.getElementById(hint as string)?.textContent).toBe('Only in Isolated');
      await fireEvent.click(b);
    }
    expect(onoctaveup).not.toHaveBeenCalled();
    expect(onoctavedown).not.toHaveBeenCalled();
  });

  it('no octave hint when it applies', () => {
    mount({ up: true, down: true });
    expect(
      screen.getByRole('button', { name: 'Octave up' }).getAttribute('aria-describedby')
    ).toBeNull();
    expect(screen.queryByText('Only in Isolated')).toBeNull();
  });

  it('Reset tool button calls onreset', async () => {
    const { onreset } = mount({ up: true, down: true });
    await fireEvent.click(screen.getByRole('button', { name: 'Reset tool' }));
    expect(onreset).toHaveBeenCalledTimes(1);
  });
});
