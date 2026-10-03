import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it } from 'vitest';

import HomeScreen from '../../src/lib/shell/HomeScreen.svelte';
import { instrument, resetInstrumentForTests } from '../../src/lib/state/instrument.svelte';

beforeEach(() => resetInstrumentForTests());

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

  it('bottom zone holds a single instrument summary button, no spinner or image', () => {
    const { container } = render(HomeScreen);
    const zone = container.querySelector('[data-zone="bottom"]') as HTMLElement;
    expect(zone).not.toBeNull();
    expect(zone.tagName).toBe('DIV');
    expect(zone.children).toHaveLength(1);
    expect(
      within(zone).getByRole('button', { name: '6 strings · standard tuning · right-handed' })
    ).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('summary names the preset for Drop D and never shows the fret count', () => {
    instrument.open();
    instrument.selectTuning('AF-4');
    instrument.setFrets(16);
    instrument.confirm('home');
    const { container } = render(HomeScreen);
    const zone = container.querySelector('[data-zone="bottom"]') as HTMLElement;
    const button = within(zone).getByRole('button', {
      name: '6 strings · Drop D · right-handed'
    });
    expect(button.textContent).not.toMatch(/16|fret/i);
  });

  it('activating the summary opens the panel', async () => {
    render(HomeScreen);
    await fireEvent.click(screen.getByRole('button', { name: /^6 strings/ }));
    expect(instrument.panel.open).toBe(true);
  });
});
