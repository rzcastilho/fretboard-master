// @vitest-environment jsdom
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

describe('TriadsSecondary Listen to comparison (007 US6)', () => {
  const props = (compareOn: boolean, enabled: boolean, onlistencomparison = vi.fn()) => ({
    labelType: 'interval' as const,
    onlabeltype: vi.fn(),
    octave: { up: true, down: true, applies: true },
    onoctaveup: vi.fn(),
    onoctavedown: vi.fn(),
    listen: { enabled: true },
    onlisten: vi.fn(),
    compareOn,
    listenComparison: { enabled },
    onlistencomparison,
    onreset: vi.fn()
  });

  it('is hidden when Compare is off or not offered', () => {
    render(TriadsSecondary, props(false, true));
    expect(screen.queryByRole('button', { name: 'Listen to comparison' })).toBeNull();
  });

  it('renders after Listen, aria-disabled when not enabled, and does nothing', async () => {
    const fn = vi.fn();
    render(TriadsSecondary, props(true, false, fn));
    const names = screen.getAllByRole('button').map((b) => b.textContent?.trim());
    // View in CAGED (019) sits directly after Listen, so the comparison command follows it.
    expect(names.indexOf('Listen to comparison')).toBe(names.indexOf('Listen') + 2);
    const b = screen.getByRole('button', { name: 'Listen to comparison' });
    expect(b.getAttribute('aria-disabled')).toBe('true');
    await fireEvent.click(b);
    expect(fn).not.toHaveBeenCalled();
  });

  it('activates when enabled', async () => {
    const fn = vi.fn();
    render(TriadsSecondary, props(true, true, fn));
    await fireEvent.click(screen.getByRole('button', { name: 'Listen to comparison' }));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('TriadsSecondary View in CAGED (019 US4)', () => {
  function mountCaged(enabled: boolean) {
    const onviewincaged = vi.fn();
    render(TriadsSecondary, {
      labelType: 'interval',
      onlabeltype: vi.fn(),
      octave: { applies: true, up: true, down: true },
      onoctaveup: vi.fn(),
      onoctavedown: vi.fn(),
      listen: { enabled: true },
      onlisten: vi.fn(),
      viewInCaged: { enabled },
      onviewincaged,
      onreset: vi.fn()
    });
    return onviewincaged;
  }

  it('is enabled for major and minor, with no note, after Listen', async () => {
    const onviewincaged = mountCaged(true);
    const names = screen.getAllByRole('button').map((b) => b.textContent?.trim());
    expect(names.indexOf('View in CAGED')).toBe(names.indexOf('Listen') + 1);
    const btn = screen.getByRole('button', { name: 'View in CAGED' });
    expect(btn.getAttribute('aria-disabled')).toBe('false');
    expect(screen.queryByText('CAGED covers major and minor chords')).toBeNull();
    await fireEvent.click(btn);
    expect(onviewincaged).toHaveBeenCalledTimes(1);
  });

  it('disabled: aria-disabled, focusable, ignores activation, described by the visible note', async () => {
    const onviewincaged = mountCaged(false);
    const btn = screen.getByRole('button', { name: 'View in CAGED' });
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect(btn.hasAttribute('disabled')).toBe(false);
    btn.focus();
    expect(document.activeElement).toBe(btn);
    const note = screen.getByText('CAGED covers major and minor chords');
    expect(btn.getAttribute('aria-describedby')).toBe(note.id);
    await fireEvent.click(btn);
    expect(onviewincaged).not.toHaveBeenCalled();
  });
});
