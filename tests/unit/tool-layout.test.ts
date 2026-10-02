import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { notes } from '../../src/lib/state/notes.svelte';
import { triads } from '../../src/lib/state/triads.svelte';
import ToolLayout from '../../src/lib/shell/ToolLayout.svelte';

describe('ToolLayout', () => {
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
  });
});
