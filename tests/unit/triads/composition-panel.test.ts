import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import { buildTriadsModel } from '../../../src/lib/state/triads-model';
import {
  initialTriadsView,
  selectRoot,
  setQuality,
  switchSpelling
} from '../../../src/lib/state/triads-view';
import CompositionPanel from '../../../src/lib/tools/triads/CompositionPanel.svelte';

const { composition } = buildTriadsModel(initialTriadsView(STANDARD_GUITAR), STANDARD_GUITAR);

describe('CompositionPanel (US1)', () => {
  it('is a labelled section with the name', () => {
    render(CompositionPanel, { composition });
    const section = screen.getByRole('region', { name: 'Composition' });
    expect(within(section).getByText('C major — Root position')).toBeTruthy();
  });

  it('lists notes with function glyphs and spoken labels', () => {
    render(CompositionPanel, { composition });
    const notes = screen.getByRole('list', { name: 'Notes' });
    const items = within(notes).getAllByRole('listitem');
    expect(items.map((i) => i.textContent?.trim())).toEqual(['C', 'E', 'G']);
    expect(items.map((i) => i.getAttribute('aria-label'))).toEqual([
      'C, root',
      'E, third',
      'G, fifth'
    ]);
    expect(items.map((i) => i.querySelector('svg')?.getAttribute('data-function'))).toEqual([
      'root',
      'third',
      'fifth'
    ]);
  });

  it('shows intervals, stacking and low-to-high order', () => {
    render(CompositionPanel, { composition });
    expect(screen.getByText('R – 3 – 5')).toBeTruthy();
    expect(screen.getByText('major third + minor third')).toBeTruthy();
    expect(screen.getByText('C (root), E (third), G (fifth)')).toBeTruthy();
  });
});

describe('CompositionPanel spelling (US3)', () => {
  const init = initialTriadsView(STANDARD_GUITAR);
  const comp = (state: typeof init) => buildTriadsModel(state, STANDARD_GUITAR).composition;

  it('D♯ major: "F𝄪 sounds as G", suggestion button switches', async () => {
    const onswitch = vi.fn();
    render(CompositionPanel, {
      composition: comp(switchSpelling(selectRoot(init, 3))),
      onswitch
    });
    expect(screen.getByText('F\u{1D12A} sounds as G')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Simpler spelling: E♭' }));
    expect(onswitch).toHaveBeenCalledTimes(1);
  });

  it('D♯ augmented shows two sounds-as lines', () => {
    render(CompositionPanel, {
      composition: comp(setQuality(switchSpelling(selectRoot(init, 3)), 'augmented')),
      onswitch: vi.fn()
    });
    expect(screen.getByText('F\u{1D12A} sounds as G')).toBeTruthy();
    expect(screen.getByText('A\u{1D12A} sounds as B')).toBeTruthy();
  });

  it('A augmented: no sounds-as lines, no suggestion', () => {
    render(CompositionPanel, {
      composition: comp(setQuality(selectRoot(init, 9), 'augmented')),
      onswitch: vi.fn()
    });
    expect(screen.queryByText(/sounds as/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Simpler spelling/ })).toBeNull();
  });

  it('B augmented: sounds-as line but no suggestion and no switch', () => {
    render(CompositionPanel, {
      composition: comp(setQuality(selectRoot(init, 11), 'augmented')),
      onswitch: vi.fn()
    });
    expect(screen.getByText('F\u{1D12A} sounds as G')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Simpler spelling/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Switch to/ })).toBeNull();
  });

  it('altered root shows Switch to X; natural root does not', async () => {
    const onswitch = vi.fn();
    const { unmount } = render(CompositionPanel, {
      composition: comp(selectRoot(init, 3)),
      onswitch
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Switch to D♯' }));
    expect(onswitch).toHaveBeenCalledTimes(1);
    unmount();
    render(CompositionPanel, { composition: comp(init), onswitch });
    expect(screen.queryByRole('button', { name: /Switch to/ })).toBeNull();
  });
});

describe('CompositionPanel (US6)', () => {
  const init = initialTriadsView(STANDARD_GUITAR);
  const comp = (state: typeof init) => buildTriadsModel(state, STANDARD_GUITAR).composition;
  const sym = /Augmented triads are symmetric/;
  const flat5 = /The ♭5 is the characteristic note of a diminished triad\./;
  const show = (q: 'major' | 'minor' | 'diminished' | 'augmented') =>
    render(CompositionPanel, { composition: comp(setQuality(init, q)), onswitch: vi.fn() });

  it('US6-1: augmented shows the symmetry statement only', () => {
    show('augmented');
    expect(screen.getByText(sym)).toBeTruthy();
    expect(screen.queryByText(flat5)).toBeNull();
  });

  it('US6-2: diminished shows the ♭5 statement only', () => {
    show('diminished');
    expect(screen.getByText(flat5)).toBeTruthy();
    expect(screen.queryByText(sym)).toBeNull();
  });

  it('US6-3: major and minor show neither', () => {
    for (const q of ['major', 'minor'] as const) {
      const { unmount } = show(q);
      expect(screen.queryByText(sym)).toBeNull();
      expect(screen.queryByText(flat5)).toBeNull();
      unmount();
    }
  });
});

describe('CompositionPanel in All notes (US2, C10)', () => {
  const init = initialTriadsView(STANDARD_GUITAR);
  const comp = buildTriadsModel(
    { ...init, rootPc: 9, view: 'all-notes' },
    STANDARD_GUITAR
  ).composition;

  it('name omits the inversion and the low-to-high line is hidden', () => {
    render(CompositionPanel, { composition: comp });
    expect(screen.getByText('A major')).toBeTruthy();
    expect(screen.queryByText(/inversion|Root position/)).toBeNull();
    expect(screen.queryByText('Low to high')).toBeNull();
  });

  it('still shows notes, intervals and stacking', () => {
    render(CompositionPanel, { composition: comp });
    expect(screen.getByText('R – 3 – 5')).toBeTruthy();
    expect(screen.getByText('major third + minor third')).toBeTruthy();
    expect(
      within(screen.getByRole('list', { name: 'Notes' })).getAllByRole('listitem')
    ).toHaveLength(3);
  });
});

describe('CompositionPanel comparison (007 US1)', () => {
  const init = initialTriadsView(STANDARD_GUITAR);
  const withCompare = (
    o: Partial<typeof init> = {},
    q: 'minor' | 'diminished' | 'augmented' = 'minor'
  ) =>
    buildTriadsModel({ ...init, ...o, compare: { on: true, quality: q } }, STANDARD_GUITAR)
      .composition;

  it('renders two columns when a comparison exists', () => {
    render(CompositionPanel, { composition: withCompare() });
    expect(screen.getByRole('group', { name: 'C major — Root position' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'C minor — Root position' })).toBeTruthy();
  });

  it('renders one column and no changed tag without a comparison', () => {
    const { container } = render(CompositionPanel, { composition });
    expect(screen.queryAllByRole('group')).toHaveLength(0);
    expect(container.querySelectorAll('.changed-tag')).toHaveLength(0);
    expect(container.querySelectorAll('strong')).toHaveLength(0);
  });

  it('marks the changed note and interval in both columns with strong + the visible tag', () => {
    render(CompositionPanel, { composition: withCompare() });
    for (const [name, note, interval] of [
      ['C major — Root position', 'E', '3'],
      ['C minor — Root position', 'E♭', '♭3']
    ] as const) {
      const col = screen.getByRole('group', { name });
      const strongs = [...col.querySelectorAll('strong')].map((s) => s.textContent?.trim());
      expect(strongs).toContain(note);
      expect(strongs).toContain(interval);
      expect(within(col).getAllByText('changed')).toHaveLength(2);
      // Unchanged notes are not emphasised.
      expect(strongs).not.toContain('C');
      expect(strongs).not.toContain('G');
    }
  });

  it('changed notes also say so in their accessible name', () => {
    render(CompositionPanel, { composition: withCompare() });
    const col = screen.getByRole('group', { name: 'C minor — Root position' });
    const names = within(within(col).getByRole('list', { name: 'Notes' }))
      .getAllByRole('listitem')
      .map((i) => i.getAttribute('aria-label'));
    expect(names).toEqual(['C, root', 'E flat, third, changed', 'G, fifth']);
  });

  it('shows both fifth and third as changed for major vs diminished', () => {
    render(CompositionPanel, { composition: withCompare({}, 'diminished') });
    const col = screen.getByRole('group', { name: 'C diminished — Root position' });
    expect(
      [...col.querySelectorAll('.interval-list strong')].map((s) => s.textContent?.trim())
    ).toEqual(['♭3', '♭5']);
  });

  it('the comparison heading has an aria-hidden dashed swatch; the first does not', () => {
    render(CompositionPanel, { composition: withCompare() });
    const first = screen.getByRole('group', { name: 'C major — Root position' });
    const second = screen.getByRole('group', { name: 'C minor — Root position' });
    expect(first.querySelector('.swatch')).toBeNull();
    const swatch = second.querySelector('.swatch');
    expect(swatch?.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps symmetry and characteristic notes in their own column', () => {
    render(CompositionPanel, {
      composition: withCompare({ quality: 'augmented' }, 'diminished')
    });
    const aug = screen.getByRole('group', { name: 'C augmented — Root position' });
    const dim = screen.getByRole('group', { name: 'C diminished — Root position' });
    expect(within(aug).queryByText(/characteristic note/)).toBeNull();
    expect(within(dim).getByText(/characteristic note/)).toBeTruthy();
    expect(within(aug).getByText(/are symmetric/)).toBeTruthy();
    expect(within(dim).queryByText(/are symmetric/)).toBeNull();
  });
});
