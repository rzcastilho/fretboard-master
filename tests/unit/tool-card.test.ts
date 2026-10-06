// @vitest-environment jsdom
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

  it('continued shows a text badge and the continue accessible name; others keep card_label', () => {
    const { container } = render(ToolCard, { tool: TOOLS[1], continued: true });
    const link = screen.getByRole('link', {
      name: 'Continue: Triads. What is a chord made of?'
    });
    expect(link.textContent).toContain('Continue');
    expect(container.querySelectorAll('a')).toHaveLength(1);
  });

  it('not continued has no badge', () => {
    render(ToolCard, { tool: TOOLS[0] });
    expect(screen.queryByText('Continue')).toBeNull();
    expect(screen.getByRole('link').getAttribute('aria-label')).toBe(
      'Fretboard Notes — Where is every note?'
    );
  });
});

describe('ToolCard thumbnail (handedness)', () => {
  it('follows the confirmed handedness: string labels move to the right of the nut', () => {
    const x = (el: Element | null) => Number(el?.getAttribute('x'));
    const probe = () => {
      const { container } = render(ToolCard, { tool: TOOLS[0] });
      return {
        label: x(container.querySelector('.string-label')),
        nut: x(container.querySelector('.nut'))
      };
    };
    const right = probe();
    expect(right.label).toBeLessThan(right.nut);
    instrument.open();
    instrument.setHandedness('left');
    instrument.confirm('home');
    const left = probe();
    expect(left.label).toBeGreaterThan(left.nut);
  });
});
