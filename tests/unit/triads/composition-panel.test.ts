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
