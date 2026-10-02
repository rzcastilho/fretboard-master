import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import TriadsCompare from '../../../src/lib/tools/triads/TriadsCompare.svelte';

type Q = 'major' | 'minor' | 'diminished' | 'augmented';
const compare = (
  o: Partial<{ offered: boolean; on: boolean; quality: Q | null; options: Q[] }> = {}
) => ({
  offered: true,
  on: false,
  quality: null as Q | null,
  options: ['minor', 'diminished', 'augmented'] as Q[],
  ...o
});

describe('TriadsCompare (007 US1)', () => {
  it('is not rendered when Compare is not offered', () => {
    const { container } = render(TriadsCompare, {
      compare: compare({ offered: false }),
      onsetcompare: vi.fn(),
      oncomparequality: vi.fn()
    });
    expect(container.textContent?.trim()).toBe('');
    expect(screen.queryByRole('button', { name: 'Compare' })).toBeNull();
  });

  it('renders a Compare toggle with aria-pressed and no list while off', async () => {
    const onsetcompare = vi.fn();
    render(TriadsCompare, { compare: compare(), onsetcompare, oncomparequality: vi.fn() });
    const toggle = screen.getByRole('button', { name: 'Compare' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('radiogroup')).toBeNull();
    await fireEvent.click(toggle);
    expect(onsetcompare).toHaveBeenCalledWith(true);
  });

  it('when on: pressed toggle and a radio group with the options, current checked', async () => {
    const oncomparequality = vi.fn();
    const onsetcompare = vi.fn();
    render(TriadsCompare, {
      compare: compare({ on: true, quality: 'minor' }),
      onsetcompare,
      oncomparequality
    });
    const toggle = screen.getByRole('button', { name: 'Compare' });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    const group = screen.getByRole('radiogroup', { name: 'Compare with' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.textContent?.trim())).toEqual(['minor', 'diminished', 'augmented']);
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    await fireEvent.click(within(group).getByRole('radio', { name: 'augmented' }));
    expect(oncomparequality).toHaveBeenCalledWith('augmented');
    await fireEvent.click(toggle);
    expect(onsetcompare).toHaveBeenCalledWith(false);
  });

  it('the list never contains the current quality', () => {
    render(TriadsCompare, {
      compare: compare({
        on: true,
        quality: 'major',
        options: ['major', 'diminished', 'augmented']
      }),
      onsetcompare: vi.fn(),
      oncomparequality: vi.fn()
    });
    const names = screen.getAllByRole('radio').map((r) => r.textContent?.trim());
    expect(names).toHaveLength(3);
    expect(names).not.toContain('minor');
  });

  it('Tab order is toggle → list: DOM order, one tab stop each, no positive tabindex', () => {
    const { container } = render(TriadsCompare, {
      compare: compare({ on: true, quality: 'minor' }),
      onsetcompare: vi.fn(),
      oncomparequality: vi.fn()
    });
    const stops = [...container.querySelectorAll<HTMLElement>('button')].filter(
      (b) => b.tabIndex >= 0
    );
    expect(stops.map((b) => b.textContent?.trim())).toEqual(['Compare', 'minor']);
    expect(
      container.querySelector('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])')
    ).toBeNull();
  });

  it('returns focus to the toggle when Compare turns off while focus is in the list', async () => {
    const view = render(TriadsCompare, {
      compare: compare({ on: true, quality: 'minor' }),
      onsetcompare: vi.fn(),
      oncomparequality: vi.fn()
    });
    screen.getByRole('radio', { name: 'minor' }).focus();
    await view.rerender({ compare: compare({ on: false, quality: 'minor' }) });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Compare' }));
  });

  it('Escape inside the list turns Compare off', async () => {
    const onsetcompare = vi.fn();
    render(TriadsCompare, {
      compare: compare({ on: true, quality: 'minor' }),
      onsetcompare,
      oncomparequality: vi.fn()
    });
    await fireEvent.keyDown(screen.getByRole('radio', { name: 'minor' }), { key: 'Escape' });
    expect(onsetcompare).toHaveBeenCalledWith(false);
  });
});
