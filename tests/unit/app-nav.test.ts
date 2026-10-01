import { render, screen, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import AppNav from '../../src/lib/shell/AppNav.svelte';

describe('AppNav', () => {
  it('lists Home, tools, About in order with hrefs', () => {
    render(AppNav, { current: 'home' });
    const nav = screen.getByRole('navigation', { name: 'Tools' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent?.trim())).toEqual([
      'Home',
      'Fretboard Notes',
      'Triads',
      'About'
    ]);
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/', '/notes', '/triads', '/about']);
  });

  it.each([
    ['home', 'Home'],
    ['notes', 'Fretboard Notes'],
    ['triads', 'Triads'],
    ['about', 'About']
  ] as const)('marks only %s as current', (current, name) => {
    render(AppNav, { current });
    const nav = screen.getByRole('navigation', { name: 'Tools' });
    const links = within(nav).getAllByRole('link');
    const marked = links.filter((l) => l.getAttribute('aria-current') === 'page');
    expect(marked).toHaveLength(1);
    expect(marked[0].textContent?.trim()).toBe(name);
    expect(marked[0].hasAttribute('data-sveltekit-replacestate')).toBe(true);
    expect(marked[0].classList.contains('current')).toBe(true);
    for (const l of links.filter((x) => x !== marked[0])) {
      expect(l.hasAttribute('data-sveltekit-replacestate')).toBe(false);
      expect(l.classList.contains('current')).toBe(false);
    }
  });
});
