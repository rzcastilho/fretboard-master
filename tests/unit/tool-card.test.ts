import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const linkTools = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/state/links.svelte', () => ({ linkTools }));

import ToolCard from '../../src/lib/shell/ToolCard.svelte';
import { TOOLS } from '../../src/lib/shell/tools';
import { instrument, resetInstrumentForTests } from '../../src/lib/state/instrument.svelte';

beforeEach(() => resetInstrumentForTests());

describe('ToolCard', () => {
  it('is a single link with card_label name, visible name and question, no truncation', () => {
    const { container } = render(ToolCard, { tool: TOOLS[0] });
    const link = screen.getByRole('link', { name: 'Fretboard Notes — Where is every note?' });
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/notes');
    expect(container.querySelectorAll('a')).toHaveLength(1);
    expect(screen.getByText('Fretboard Notes')).toBeTruthy();
    expect(screen.getByText('Where is every note?')).toBeTruthy();
    expect(container.innerHTML).not.toMatch(/truncate|ellipsis/);
  });

  it('shows a decorative fretboard thumbnail without changing the link name or tab stops', () => {
    const { container } = render(ToolCard, { tool: TOOLS[0] });
    const link = container.querySelector('a') as HTMLAnchorElement;
    const svg = link.querySelector('svg.fretboard-thumbnail');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(link.getAttribute('aria-label')).toBe('Fretboard Notes — Where is every note?');
    expect(container.querySelectorAll('[tabindex], button, [role="grid"]')).toHaveLength(0);
  });

  it('never applies a carry on click (home card, US2)', async () => {
    render(ToolCard, { tool: TOOLS[1] });
    const link = screen.getByRole('link');
    const stop = (e: Event) => e.preventDefault();
    document.addEventListener('click', stop);
    await fireEvent.click(link);
    document.removeEventListener('click', stop);
    expect(linkTools).not.toHaveBeenCalled();
  });

  it('thumbnail follows the active instrument: Drop D shows D on string 6', () => {
    const labels = () =>
      [...render(ToolCard, { tool: TOOLS[0] }).container.querySelectorAll('.string-label')].map(
        (n) => n.textContent
      );
    expect(labels().at(-1)).toBe('E');
    instrument.open();
    instrument.selectTuning('AF-4');
    instrument.confirm('home');
    expect(labels().at(-1)).toBe('D');
  });
});
