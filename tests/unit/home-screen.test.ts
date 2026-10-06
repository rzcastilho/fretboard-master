// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it } from 'vitest';

import HomeScreen from '../../src/lib/shell/HomeScreen.svelte';
import { instrument, resetInstrumentForTests } from '../../src/lib/state/instrument.svelte';
import { preferences, resetPreferencesForTests } from '../../src/lib/state/preferences.svelte';
import { TOOLS } from '../../src/lib/shell/tools';

beforeEach(() => {
  resetInstrumentForTests();
  resetPreferencesForTests();
});

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

  it('renders exactly three tool cards in order', () => {
    render(HomeScreen);
    const list = screen.getByRole('list');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    const first = within(items[0]).getByRole('link', {
      name: 'Fretboard Notes — Where is every note?'
    });
    const second = within(items[1]).getByRole('link', {
      name: 'Triads — What is a chord made of?'
    });
    expect(first.getAttribute('href')).toBe('/notes');
    expect(second.getAttribute('href')).toBe('/triads');
    const third = within(items[2]).getByRole('link', {
      name: 'CAGED — How does the whole neck connect?'
    });
    expect(third.getAttribute('href')).toBe('/caged');
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

  it('summary reads "Custom" for an unmatched tuning (3.5)', () => {
    instrument.open();
    instrument.chooseCustom();
    instrument.stepString(1, 1);
    instrument.confirm('home');
    render(HomeScreen);
    expect(screen.getByRole('button', { name: '6 strings · Custom · right-handed' })).toBeTruthy();
  });

  it('summary names a matched custom tuning by its preset (3.4)', () => {
    instrument.open();
    instrument.chooseCustom();
    for (const n of [6, 5, 4, 3, 2, 1] as const) instrument.stepString(n, -1);
    instrument.confirm('home');
    render(HomeScreen);
    expect(
      screen.getByRole('button', { name: '6 strings · Half step down · right-handed' })
    ).toBeTruthy();
  });

  it('activating the summary opens the panel', async () => {
    render(HomeScreen);
    await fireEvent.click(screen.getByRole('button', { name: /^6 strings/ }));
    expect(instrument.panel.open).toBe(true);
  });

  it('marks only the last tool as Continue and keeps TOOLS order', () => {
    preferences.toolOpened('triads');
    render(HomeScreen);
    const links = within(screen.getByRole('list')).getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual(TOOLS.map((t) => t.path));
    expect(links[0].getAttribute('aria-label')).toBe('Fretboard Notes — Where is every note?');
    expect(links[1].getAttribute('aria-label')).toBe('Continue: Triads. What is a chord made of?');
    expect(screen.getAllByText('Continue')).toHaveLength(1);
  });

  it('no Continue badge when there is no last tool', () => {
    render(HomeScreen);
    expect(screen.queryByText('Continue')).toBeNull();
  });
});

describe('HomeScreen summary (handedness)', () => {
  it('shows left-handed after confirming Left-handed', () => {
    instrument.open();
    instrument.setHandedness('left');
    instrument.confirm('home');
    const { container } = render(HomeScreen);
    const zone = container.querySelector('[data-zone="bottom"]') as HTMLElement;
    expect(
      within(zone).getByRole('button', { name: '6 strings · standard tuning · left-handed' })
    ).toBeTruthy();
  });
});
