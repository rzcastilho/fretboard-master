import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import NoteSelector from '../../../src/lib/tools/NoteSelector.svelte';

const LABELS = [
  'C',
  'C♯ / D♭',
  'D',
  'D♯ / E♭',
  'E',
  'F',
  'F♯ / G♭',
  'G',
  'G♯ / A♭',
  'A',
  'A♯ / B♭',
  'B'
];

describe('NoteSelector', () => {
  it('is a group named "Choose notes" with 12 buttons in chromatic order from C', () => {
    render(NoteSelector, { selected: [], ontoggle: () => {} });
    const group = screen.getByRole('group', { name: 'Choose notes' });
    const buttons = within(group).getAllByRole('button');
    expect(buttons).toHaveLength(12);
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(LABELS);
    for (const b of buttons) expect(b.getAttribute('aria-pressed')).toBe('false');
  });

  it('uses a custom group label when given', () => {
    render(NoteSelector, { selected: [], ontoggle: () => {}, label: 'Root' });
    expect(screen.getByRole('group', { name: 'Root' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Choose notes' })).toBeNull();
  });

  it('exposes spoken accessible names', () => {
    render(NoteSelector, { selected: [], ontoggle: () => {} });
    expect(screen.getByRole('button', { name: 'C' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'C sharp or D flat' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'A sharp or B flat' })).toBeTruthy();
  });

  it('reflects selection with aria-pressed', () => {
    render(NoteSelector, { selected: [7, 1], ontoggle: () => {} });
    expect(screen.getByRole('button', { name: 'G' }).getAttribute('aria-pressed')).toBe('true');
    expect(
      screen.getByRole('button', { name: 'C sharp or D flat' }).getAttribute('aria-pressed')
    ).toBe('true');
    expect(screen.getByRole('button', { name: 'D' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('calls ontoggle with the pitch class', async () => {
    const ontoggle = vi.fn();
    render(NoteSelector, { selected: [], ontoggle });
    await fireEvent.click(screen.getByRole('button', { name: 'G' }));
    await fireEvent.click(screen.getByRole('button', { name: 'C sharp or D flat' }));
    expect(ontoggle.mock.calls).toEqual([[7], [1]]);
  });

  it('distinguishes naturals from altered notes by a class hook, not color alone', () => {
    render(NoteSelector, { selected: [], ontoggle: () => {} });
    expect(screen.getByRole('button', { name: 'C' }).classList.contains('natural')).toBe(true);
    const altered = screen.getByRole('button', { name: 'C sharp or D flat' });
    expect(altered.classList.contains('altered')).toBe(true);
    expect(altered.classList.contains('natural')).toBe(false);
  });
});
