import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ToolLayout from '../../src/lib/shell/ToolLayout.svelte';

describe('ToolLayout', () => {
  it('renders application bar with navigation', () => {
    render(ToolLayout, { tool: 'triads' });
    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('navigation', { name: 'Tools' })).toBeTruthy();
    expect(banner.getAttribute('aria-label')).toBe('Application bar');
  });

  it('renders the four zones with placeholders', () => {
    render(ToolLayout, { tool: 'notes' });
    const zones: Array<[string, string]> = [
      ['Main controls', 'Controls will appear here.'],
      ['Fretboard', 'The fretboard will appear here.'],
      ['Context panel', 'Details will appear here.'],
      ['Actions', 'Actions will appear here.']
    ];
    for (const [name, text] of zones) {
      const region = screen.getByRole('region', { name });
      expect(within(region).getByText(text)).toBeTruthy();
    }
  });

  it('has one h1 with the tool name in main, before zone B', () => {
    render(ToolLayout, { tool: 'triads' });
    const main = screen.getByRole('main');
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe('Triads');
    expect(main.contains(h1s[0])).toBe(true);
    const controls = screen.getByRole('region', { name: 'Main controls' });
    expect(
      h1s[0].compareDocumentPosition(controls) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
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
  });
});
