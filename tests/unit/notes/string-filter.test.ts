import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import StringFilter from '../../../src/lib/tools/notes/StringFilter.svelte';

const props = (active: number[], ontoggle = () => {}) => ({
  instrument: STANDARD_GUITAR,
  active,
  ontoggle
});

describe('StringFilter', () => {
  it('is a group named Strings with one button per string in row order', () => {
    render(StringFilter, props([1, 2, 3, 4, 5, 6]));
    const group = screen.getByRole('group', { name: 'Strings' });
    const buttons = within(group).getAllByRole('button');
    expect(buttons.map((b) => b.textContent?.trim())).toEqual([
      '1 E',
      '2 B',
      '3 G',
      '4 D',
      '5 A',
      '6 E'
    ]);
    expect(screen.getByRole('button', { name: 'String 1, E' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'String 6, E' })).toBeTruthy();
    for (const b of buttons) expect(b.getAttribute('aria-pressed')).toBe('true');
  });

  it('reflects inactive strings and toggles on activation', async () => {
    const ontoggle = vi.fn();
    render(StringFilter, props([1, 2], ontoggle));
    const s3 = screen.getByRole('button', { name: 'String 3, G' });
    expect(s3.getAttribute('aria-pressed')).toBe('false');
    expect(s3.getAttribute('aria-disabled')).toBeNull();
    await fireEvent.click(s3);
    expect(ontoggle).toHaveBeenCalledWith(3);
  });

  it('marks the only active string pressed, aria-disabled, described, and inert', async () => {
    const ontoggle = vi.fn();
    render(StringFilter, props([4], ontoggle));
    const only = screen.getByRole('button', { name: 'String 4, D' });
    expect(only.getAttribute('aria-pressed')).toBe('true');
    expect(only.getAttribute('aria-disabled')).toBe('true');
    expect(only).toHaveProperty('disabled', false);
    const describedBy = only.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy ?? '')?.textContent?.trim()).toBe(
      'At least one string stays on'
    );
    await fireEvent.click(only);
    expect(ontoggle).not.toHaveBeenCalled();
  });
});
