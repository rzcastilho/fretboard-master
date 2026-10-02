import { render, screen, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import HomeScreen from '../../src/lib/shell/HomeScreen.svelte';

describe('HomeScreen', () => {
  it('renders banner with h1 and About link', () => {
    render(HomeScreen);
    const banner = screen.getByRole('banner');
    expect(
      within(banner).getByRole('heading', { level: 1, name: 'Fretboard Master' })
    ).toBeTruthy();
    const about = within(banner).getByRole('link', { name: 'About' });
    expect(about.getAttribute('href')).toBe('/about');
  });

  it('puts the sound control in header.top', () => {
    render(HomeScreen);
    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('group', { name: 'Sound' })).toBeTruthy();
  });

  it('renders exactly two tool cards in order', () => {
    render(HomeScreen);
    const list = screen.getByRole('list');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    const first = within(items[0]).getByRole('link', {
      name: 'Fretboard Notes — Where is every note?'
    });
    const second = within(items[1]).getByRole('link', {
      name: 'Triads — What is a chord made of?'
    });
    expect(first.getAttribute('href')).toBe('/notes');
    expect(second.getAttribute('href')).toBe('/triads');
  });

  it('has an empty bottom zone without role or name, and no spinner or image', () => {
    const { container } = render(HomeScreen);
    const zone = container.querySelector('[data-zone="bottom"]');
    expect(zone).not.toBeNull();
    expect(zone?.tagName).toBe('DIV');
    expect(zone?.hasAttribute('role')).toBe(false);
    expect(zone?.hasAttribute('aria-label')).toBe(false);
    expect(zone?.hasAttribute('aria-labelledby')).toBe(false);
    expect(zone?.textContent?.trim()).toBe('');
    expect(zone?.children).toHaveLength(0);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
