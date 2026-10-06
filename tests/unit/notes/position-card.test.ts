// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import PositionCard from '../../../src/lib/tools/notes/PositionCard.svelte';
import type { CardInfo } from '../../../src/lib/state/notes-model';

const A3: CardInfo = {
  position: { string: 3, fret: 2 },
  pitchClass: 9,
  spelling: { letter: 'A', accidental: 0 },
  altSpelling: null,
  octave: 3,
  unisons: [
    { string: 4, fret: 7 },
    { string: 5, fret: 12 },
    { string: 6, fret: 17 }
  ],
  selected: false
};

const props = (info: CardInfo, over: Record<string, unknown> = {}) => ({
  info,
  onaddnote: () => {},
  onclose: () => {},
  ontriads: () => {},
  oncaged: () => {},
  ...over
});

describe('PositionCard', () => {
  it('is a labelled section with no dialog role', () => {
    const { container } = render(PositionCard, props(A3));
    const section = container.querySelector('section');
    expect(section?.getAttribute('aria-labelledby')).toBe('notes-card-title');
    expect(container.querySelector('#notes-card-title')?.textContent).toBe('A');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows octave, string, fret and the unison list', () => {
    const { container } = render(PositionCard, props(A3));
    const dl = container.querySelector('dl');
    expect(dl?.textContent).toContain('Octave');
    expect(dl?.textContent).toContain('3');
    expect(dl?.textContent).toContain('String');
    expect(dl?.textContent).toContain('Fret');
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map((li) => li.textContent?.trim())).toEqual([
      'String 4, fret 7',
      'String 5, fret 12',
      'String 6, fret 17'
    ]);
  });

  it('shows "Open" for an open string and the single-position message', () => {
    render(
      PositionCard,
      props({
        ...A3,
        position: { string: 6, fret: 0 },
        spelling: { letter: 'E', accidental: 0 },
        octave: 2,
        unisons: []
      })
    );
    expect(screen.getByText('Open')).toBeTruthy();
    expect(screen.getByText('This pitch exists only at this position')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('names altered notes with both spellings and a spoken heading', () => {
    const { container } = render(
      PositionCard,
      props({
        ...A3,
        pitchClass: 1,
        spelling: { letter: 'C', accidental: 1 },
        altSpelling: { letter: 'D', accidental: -1 }
      })
    );
    const h = container.querySelector('#notes-card-title');
    expect(h?.textContent?.trim()).toBe('C♯ / D♭');
    expect(h?.getAttribute('aria-label')).toBe('C sharp or D flat');
  });

  it('See every occurrence calls onaddnote with the pitch class', async () => {
    const onaddnote = vi.fn();
    render(PositionCard, props(A3, { onaddnote }));
    await fireEvent.click(screen.getByRole('button', { name: 'See every occurrence' }));
    expect(onaddnote).toHaveBeenCalledWith(9);
  });

  it('Close calls onclose', async () => {
    const onclose = vi.fn();
    render(PositionCard, props(A3, { onclose }));
    await fireEvent.click(screen.getByRole('button', { name: 'Close position card' }));
    expect(onclose).toHaveBeenCalledTimes(1);
  });

  it('has a Triads from this note button before Close', () => {
    const { container } = render(PositionCard, props(A3));
    const labels = [...container.querySelectorAll('.actions button')].map((b) =>
      b.textContent?.trim()
    );
    expect(labels.indexOf('Triads from this note')).toBeGreaterThan(-1);
    expect(labels.indexOf('Triads from this note')).toBeLessThan(
      labels.indexOf('Close position card')
    );
  });

  it('Triads from this note calls ontriads with the pitch class and is keyboard focusable', async () => {
    const ontriads = vi.fn();
    render(PositionCard, props(A3, { ontriads }));
    const button = screen.getByRole('button', { name: 'Triads from this note' });
    button.focus();
    expect(document.activeElement).toBe(button);
    await fireEvent.click(button);
    expect(ontriads).toHaveBeenCalledWith(9);
    expect(ontriads).toHaveBeenCalledTimes(1);
  });
});

describe('PositionCard CAGED in this key (019 US4)', () => {
  it('renders after "Triads from this note" and calls oncaged with the pitch class', async () => {
    const oncaged = vi.fn();
    render(PositionCard, props(A3, { oncaged }));
    const names = screen.getAllByRole('button').map((b) => b.textContent?.trim());
    expect(names.indexOf('CAGED in this key')).toBe(names.indexOf('Triads from this note') + 1);
    const btn = screen.getByRole('button', { name: 'CAGED in this key' });
    btn.focus();
    expect(document.activeElement).toBe(btn);
    await fireEvent.click(btn);
    expect(oncaged).toHaveBeenCalledTimes(1);
    expect(oncaged).toHaveBeenCalledWith(9);
  });
});
