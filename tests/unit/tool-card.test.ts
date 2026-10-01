import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import ToolCard from '../../src/lib/shell/ToolCard.svelte';
import { TOOLS } from '../../src/lib/shell/tools';

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
});
