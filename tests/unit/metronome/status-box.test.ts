// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import StatusBox from '../../../src/lib/tools/metronome/StatusBox.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

const base = { beat: 2, beats: 4, bpm: 120, sub: null, dots: [] as never[] };

describe('StatusBox tap (038)', () => {
  it('without tap the tempo is plain text with no button', () => {
    const { container } = render(StatusBox, base);
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('.tempo')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      '120 BPM'
    );
  });

  it('with tap the tempo is a button; the visible text is unchanged; click calls the handler', async () => {
    const tap = vi.fn();
    const { container, rerender } = render(StatusBox, { ...base, tap });
    const button = screen.getByRole('button', { name: '120 BPM, tap tempo' });
    expect(button.getAttribute('title')).toBe('Tap tempo');
    expect(button.textContent?.replace(/\s+/g, ' ').trim()).toBe('120 BPM');
    expect(container.querySelector('.digits')?.textContent).toBe('120');
    await fireEvent.click(button);
    expect(tap).toHaveBeenCalledTimes(1);
    await rerender({ ...base, bpm: 90, tap });
    expect(screen.getByRole('button', { name: '90 BPM, tap tempo' })).toBeTruthy();
  });
});
