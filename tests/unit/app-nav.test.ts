// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const linkTools = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/state/links.svelte', () => ({ linkTools }));

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
      'CAGED',
      'Metronome',
      'About'
    ]);
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/',
      '/notes',
      '/triads',
      '/caged',
      '/metronome',
      '/about'
    ]);
  });

  it.each([
    ['home', 'Home'],
    ['notes', 'Fretboard Notes'],
    ['triads', 'Triads'],
    ['caged', 'CAGED'],
    ['metronome', 'Metronome'],
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

describe('AppNav carry (US2)', () => {
  beforeEach(() => linkTools.mockClear());

  // jsdom would navigate on an unprevented link click; stop that at the document.
  const click = (name: string, init: MouseEventInit = {}) => {
    const link = screen.getByRole('link', { name });
    const stop = (e: Event) => e.preventDefault();
    document.addEventListener('click', stop);
    const result = fireEvent.click(link, init);
    document.removeEventListener('click', stop);
    return result;
  };

  it('calls linkTools(current, id) for a plain primary click on a different tool', async () => {
    render(AppNav, { current: 'notes' });
    await click('Triads');
    expect(linkTools).toHaveBeenCalledExactlyOnceWith('notes', 'triads');
  });

  it.each([['ctrlKey'], ['metaKey'], ['shiftKey'], ['altKey']] as const)(
    'does not call linkTools with %s',
    async (key) => {
      render(AppNav, { current: 'notes' });
      await click('Triads', { [key]: true });
      expect(linkTools).not.toHaveBeenCalled();
    }
  );

  it('does not call linkTools for a non-primary button', async () => {
    render(AppNav, { current: 'notes' });
    await click('Triads', { button: 1 });
    expect(linkTools).not.toHaveBeenCalled();
  });

  it('does not call linkTools when the click was already default-prevented', async () => {
    render(AppNav, { current: 'notes' });
    const link = screen.getByRole('link', { name: 'Triads' });
    link.addEventListener('click', (e) => e.preventDefault());
    await fireEvent.click(link);
    expect(linkTools).not.toHaveBeenCalled();
  });

  it('does not call linkTools for the current tool', async () => {
    render(AppNav, { current: 'notes' });
    await click('Fretboard Notes');
    expect(linkTools).not.toHaveBeenCalled();
  });

  it('does not call linkTools for Home and About', async () => {
    render(AppNav, { current: 'notes' });
    await click('Home');
    await click('About');
    expect(linkTools).not.toHaveBeenCalled();
  });

  it('does not carry to or from the Metronome', async () => {
    render(AppNav, { current: 'notes' });
    await click('Metronome');
    expect(linkTools).not.toHaveBeenCalled();
  });

  it('does not carry from the Metronome to a tool', async () => {
    render(AppNav, { current: 'metronome' });
    await click('Triads');
    expect(linkTools).not.toHaveBeenCalled();
  });

  it('shows the metronome icon', () => {
    const { container } = render(AppNav, { current: 'home' });
    const link = within(container).getByRole('link', { name: 'Metronome' });
    expect(link.querySelector('svg')).not.toBeNull();
  });

  it('leaves hrefs unchanged', () => {
    render(AppNav, { current: 'notes' });
    expect(screen.getByRole('link', { name: 'Triads' }).getAttribute('href')).toBe('/triads');
  });
});
