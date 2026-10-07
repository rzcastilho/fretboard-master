// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { notes } from '../../src/lib/state/notes.svelte';
import { caged, resetCagedForTests } from '../../src/lib/state/caged.svelte';
import { triads } from '../../src/lib/state/triads.svelte';
import { instrument, resetInstrumentForTests } from '../../src/lib/state/instrument.svelte';
import {
  resetShareForTests,
  share,
  useSharePlatformForTests
} from '../../src/lib/state/share.svelte';
import { opening, resetOpeningForTests } from '../../src/lib/state/opening.svelte';
import ToolLayout from '../../src/lib/shell/ToolLayout.svelte';
import { setViewportForTests } from '../../src/lib/state/viewport.svelte';

describe('ToolLayout', () => {
  beforeEach(() => {
    resetInstrumentForTests();
    resetCagedForTests();
  });

  it('zone A always has the Instrument button and the badge only for non-Standard tuning', () => {
    const { unmount } = render(ToolLayout, { tool: 'notes' });
    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('button', { name: 'Instrument' })).toBeTruthy();
    expect(within(banner).queryByRole('button', { name: /^Tuning:/ })).toBeNull();
    unmount();
    instrument.open();
    instrument.selectTuning('AF-4');
    instrument.confirm('notes');
    render(ToolLayout, { tool: 'triads' });
    const banner2 = screen.getByRole('banner');
    expect(within(banner2).getByRole('button', { name: 'Instrument' })).toBeTruthy();
    expect(
      within(banner2).getByRole('button', { name: 'Tuning: Drop D. Open instrument panel' })
    ).toBeTruthy();
  });

  describe('incomplete-link notice (US3)', () => {
    beforeEach(() => resetOpeningForTests());

    it('shows one notice with Dismiss only on the opened tool', async () => {
      opening.start('http://localhost/caged?v=1&rt=2&q=banana');
      const { unmount } = render(ToolLayout, { tool: 'notes' });
      expect(screen.queryByText(/This link was incomplete/)).toBeNull();
      unmount();
      render(ToolLayout, { tool: 'caged' });
      const notice = screen.getByText(/This link was incomplete/).closest('[role="status"]');
      expect(notice).toBeTruthy();
      const buttons = within(notice as HTMLElement).getAllByRole('button');
      expect(buttons.map((b) => b.textContent)).toEqual(['Dismiss']);
      await fireEvent.click(buttons[0]);
      expect(screen.queryByText(/This link was incomplete/)).toBeNull();
      expect(opening.incomplete).toBeNull();
    });
  });

  it('renders application bar with navigation', () => {
    render(ToolLayout, { tool: 'triads' });
    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('navigation', { name: 'Tools' })).toBeTruthy();
    expect(banner.getAttribute('aria-label')).toBe('Application bar');
  });

  it('puts the sound control in the application bar', () => {
    render(ToolLayout, { tool: 'notes' });
    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('group', { name: 'Sound' })).toBeTruthy();
  });

  it('notes renders the four named zones with the fretboard in zone C', () => {
    render(ToolLayout, { tool: 'notes' });
    for (const name of ['Notes', 'Fretboard', 'Details', 'Actions']) {
      expect(screen.getByRole('region', { name })).toBeTruthy();
    }
    const fretboard = screen.getByRole('region', { name: 'Fretboard' });
    expect(within(fretboard).getByRole('grid', { name: 'Fretboard' })).toBeTruthy();
    expect(within(fretboard).getAllByRole('gridcell')).toHaveLength(138);
    expect(screen.queryByText('Controls will appear here.')).toBeNull();
  });

  it('caged renders the fretboard and key heading instead of the placeholder', () => {
    render(ToolLayout, { tool: 'caged' });
    expect(screen.getByRole('heading', { level: 1, name: 'CAGED' })).toBeTruthy();
    const fretboard = screen.getByRole('region', { name: 'Fretboard' });
    expect(within(fretboard).getByRole('grid', { name: 'Fretboard' })).toBeTruthy();
    expect(screen.getByText('C major')).toBeTruthy();
    expect(screen.queryByText('Controls will appear here.')).toBeNull();
  });

  it('triads renders the composition panel, fretboard and actions instead of the placeholder', () => {
    render(ToolLayout, { tool: 'triads' });
    for (const name of ['Fretboard', 'Composition', 'Actions']) {
      expect(screen.getByRole('region', { name })).toBeTruthy();
    }
    const fretboard = screen.getByRole('region', { name: 'Fretboard' });
    expect(within(fretboard).getByRole('grid', { name: 'Fretboard' })).toBeTruthy();
    expect(screen.queryByText('Controls will appear here.')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Notes' })).toBeNull();
  });

  it('has one h1 with the tool name in main, before zone B', () => {
    render(ToolLayout, { tool: 'triads' });
    const main = screen.getByRole('main');
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe('Triads');
    expect(main.contains(h1s[0])).toBe(true);
    const board = screen.getByRole('region', { name: 'Fretboard' });
    expect(h1s[0].compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  describe('failure containment', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      delete (globalThis as { __fmFault?: unknown }).__fmFault;
    });

    it('shows the failure view in zones B–E while nav and h1 stay', async () => {
      vi.stubGlobal('__FM_FAULT_INJECTION__', true);
      globalThis.__fmFault = { triads: 1 };
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(ToolLayout, { tool: 'triads' });
      expect(screen.getByRole('region', { name: 'Tool error' })).toBeTruthy();
      expect(screen.getByRole('navigation', { name: 'Tools' })).toBeTruthy();
      expect(screen.getByRole('heading', { level: 1, name: 'Triads' })).toBeTruthy();
      expect(spy).toHaveBeenCalledTimes(1);
      await fireEvent.click(screen.getByRole('button', { name: 'Reset tool' }));
      expect(screen.getByRole('region', { name: 'Fretboard' })).toBeTruthy();
    });

    it('Reset tool resets the failed tool store, then the boundary (EC-1.3)', async () => {
      vi.stubGlobal('__FM_FAULT_INJECTION__', true);
      globalThis.__fmFault = { triads: 1 };
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const triadsReset = vi.spyOn(triads, 'reset');
      const notesReset = vi.spyOn(notes, 'reset');
      render(ToolLayout, { tool: 'triads' });
      await fireEvent.click(screen.getByRole('button', { name: 'Reset tool' }));
      expect(triadsReset).toHaveBeenCalledTimes(1);
      expect(notesReset).not.toHaveBeenCalled();
      expect(screen.getByRole('region', { name: 'Fretboard' })).toBeTruthy();
      triadsReset.mockRestore();
      notesReset.mockRestore();
    });

    it('Reset tool resets caged on a failure, then the boundary (US6)', async () => {
      vi.stubGlobal('__FM_FAULT_INJECTION__', true);
      globalThis.__fmFault = { caged: 1 };
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const cagedReset = vi.spyOn(caged, 'reset');
      render(ToolLayout, { tool: 'caged' });
      await fireEvent.click(screen.getByRole('button', { name: 'Reset tool' }));
      expect(cagedReset).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('region', { name: 'Fretboard' })).toBeTruthy();
      cagedReset.mockRestore();
    });
  });
});

describe('ToolLayout notation toggle (US2)', () => {
  beforeEach(() => {
    resetInstrumentForTests();
    resetCagedForTests();
  });

  it.each(['notes', 'triads', 'caged'] as const)(
    '%s header renders the toggle before the language button',
    (tool) => {
      render(ToolLayout, { tool });
      const banner = screen.getByRole('banner');
      const group = within(banner).getByRole('group', { name: 'Note names' });
      const language = within(banner).getByRole('button', { name: /^Language/ });
      expect(
        group.compareDocumentPosition(language) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    }
  );
});

describe('Home and About do not render the toggle (US2)', () => {
  it.each([
    'src/routes/+page.svelte',
    'src/routes/about/+page.svelte',
    'src/lib/shell/HomeScreen.svelte'
  ])('%s', async (file) => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync(file, 'utf8')).not.toContain('NotationToggle');
  });
});

describe('ToolLayout Share (US1)', () => {
  beforeEach(() => {
    resetInstrumentForTests();
    resetCagedForTests();
    resetShareForTests();
  });
  afterEach(() => resetShareForTests());

  it.each(['notes', 'triads', 'caged'] as const)(
    '%s header has Share right after the tool navigation',
    (tool) => {
      render(ToolLayout, { tool });
      const banner = screen.getByRole('banner');
      const button = within(banner).getByRole('button', { name: 'Share' });
      const nav = within(banner).getByRole('navigation', { name: 'Tools' });
      expect(nav.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      const instrumentButton = within(banner).getByRole('button', { name: 'Instrument' });
      expect(
        button.compareDocumentPosition(instrumentButton) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    }
  );

  it('shows "Link copied" as a status directly under the header after a copy', async () => {
    useSharePlatformForTests({
      share: null,
      writeText: () => Promise.resolve(),
      coarsePointer: false
    });
    render(ToolLayout, { tool: 'caged' });
    expect(screen.queryByText('Link copied')).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    const text = await screen.findByText('Link copied');
    expect(text.closest('[role="status"]')).toBeTruthy();
    const banner = screen.getByRole('banner');
    const status = text.closest('[role="status"]') as HTMLElement;
    expect(banner.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('main').contains(status)).toBe(false);
  });

  it('a second copy keeps exactly one notice in the DOM', async () => {
    useSharePlatformForTests({
      share: null,
      writeText: () => Promise.resolve(),
      coarsePointer: false
    });
    render(ToolLayout, { tool: 'notes' });
    const button = screen.getByRole('button', { name: 'Share' });
    await fireEvent.click(button);
    await screen.findByText('Link copied');
    await fireEvent.click(button);
    await vi.waitFor(() => expect(share.busy).toBe(false));
    expect(screen.getAllByText('Link copied')).toHaveLength(1);
  });

  it('dismissing the notice clears the store', async () => {
    useSharePlatformForTests({
      share: null,
      writeText: () => Promise.resolve(),
      coarsePointer: false
    });
    render(ToolLayout, { tool: 'triads' });
    await fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await screen.findByText('Link copied');
    await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(share.notice).toBeNull();
  });
});

describe('Home and About do not render Share (US1)', () => {
  it.each([
    'src/routes/+page.svelte',
    'src/routes/about/+page.svelte',
    'src/lib/shell/HomeScreen.svelte'
  ])('%s', async (file) => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync(file, 'utf8')).not.toContain('ShareButton');
  });
});

describe('ToolLayout instrument notice (023 US2)', () => {
  const DROP_D = {
    stringCount: 6,
    tuning: { kind: 'preset', id: 'AF-4' },
    fretCount: 22
  } as const;
  const FRETS_ONLY = { ...DROP_D, tuning: { kind: 'preset', id: 'AF-1' }, fretCount: 19 } as const;

  beforeEach(() => {
    resetInstrumentForTests();
    resetCagedForTests();
  });

  it('shows the notice for the opened tool with actions in order', () => {
    instrument.receive('caged', DROP_D);
    render(ToolLayout, { tool: 'caged' });
    const notice = screen.getByText('This view uses Drop D').closest('.notice') as HTMLElement;
    expect(within(notice).getByText('This view uses Drop D')).toBeTruthy();
    expect(
      within(notice)
        .getAllByRole('button')
        .map((b) => b.textContent?.trim())
    ).toEqual(['Use mine', 'Adopt this one', 'Dismiss']);
  });

  it('does not show for another tool', () => {
    instrument.receive('caged', DROP_D);
    render(ToolLayout, { tool: 'notes' });
    expect(screen.queryByRole('button', { name: 'Use mine' })).toBeNull();
  });

  it('does not show for a fret-count-only override', () => {
    instrument.receive('notes', FRETS_ONLY);
    render(ToolLayout, { tool: 'notes' });
    expect(screen.queryByRole('button', { name: 'Use mine' })).toBeNull();
  });

  it('Dismiss hides it and keeps the override', async () => {
    instrument.receive('triads', DROP_D);
    render(ToolLayout, { tool: 'triads' });
    await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('button', { name: 'Use mine' })).toBeNull();
    expect(instrument.override).not.toBeNull();
  });

  it('Use mine and Adopt close the notice and focus the heading', async () => {
    instrument.receive('triads', DROP_D);
    const first = render(ToolLayout, { tool: 'triads' });
    await fireEvent.click(screen.getByRole('button', { name: 'Use mine' }));
    expect(screen.queryByRole('button', { name: 'Use mine' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));
    first.unmount();
    resetInstrumentForTests();
    instrument.receive('triads', DROP_D);
    render(ToolLayout, { tool: 'triads' });
    await fireEvent.click(screen.getByRole('button', { name: 'Adopt this one' }));
    expect(screen.queryByRole('button', { name: 'Adopt this one' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));
  });
});

describe('ToolLayout arrangement (025 US3)', () => {
  beforeEach(() => {
    resetInstrumentForTests();
    resetCagedForTests();
  });
  afterEach(() => setViewportForTests());

  // ToolLayout starts the viewport store on mount, which measures the window: size the window.
  const sizeWindow = (width: number, height: number): void => {
    Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
  };

  const grid = (): HTMLElement => {
    const el = document.querySelector<HTMLElement>('main .grid');
    if (el === null) throw new Error('no grid');
    return el;
  };

  it('has no data-arrangement before the viewport is measured (prerender)', () => {
    sizeWindow(0, 0);
    render(ToolLayout, { tool: 'notes' });
    expect(grid().hasAttribute('data-arrangement')).toBe(false);
  });

  it.each([
    ['narrow', 390, 844],
    ['medium', 800, 1280],
    ['wide-side', 2560, 1440]
  ])('writes %s from the viewport store', (name, width, height) => {
    sizeWindow(width, height);
    render(ToolLayout, { tool: 'notes' });
    expect(grid().getAttribute('data-arrangement')).toBe(name);
  });

  it.each(['notes', 'triads', 'caged'] as const)(
    'renders zones B, C, E, D in that DOM order for %s',
    (tool) => {
      sizeWindow(390, 844);
      render(ToolLayout, { tool });
      const g = grid();
      const order = ['b', 'c', 'e', 'd'].map((zone) => {
        const el = g.querySelector<HTMLElement>(`.${zone}`);
        if (el === null) throw new Error(`no zone ${zone}`);
        return el;
      });
      for (let i = 1; i < order.length; i++) {
        expect(
          order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
      }
      expect(g.querySelector('.panels-opener')?.hasAttribute('hidden')).toBe(true);
    }
  );
});
