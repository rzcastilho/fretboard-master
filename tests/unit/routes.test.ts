import { createRawSnippet } from 'svelte';
import { render, screen, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Nav = { type?: string; from?: unknown; to?: unknown };
type NavCallback = (nav: Nav) => void;
const nav = (path: string) => ({ url: new URL(path, 'http://localhost') });
let navCallback: NavCallback | undefined;
let beforeNavCallback: ((nav: Nav) => void) | undefined;
const replaceState = vi.fn();

vi.mock('$app/navigation', () => ({
  afterNavigate: (cb: NavCallback) => {
    navCallback = cb;
  },
  beforeNavigate: (cb: (nav: unknown) => void) => {
    beforeNavCallback = cb;
  },
  goto: vi.fn(),
  pushState: vi.fn(),
  replaceState: (...args: unknown[]) => replaceState(...args)
}));
vi.mock('$app/paths', () => ({ resolve: (path: string) => path }));

import { handleError } from '../../src/hooks.client';
import { prerender, trailingSlash } from '../../src/routes/+layout';
import ErrorPage from '../../src/routes/+error.svelte';
import Layout from '../../src/routes/+layout.svelte';
import { playback } from '../../src/lib/state/playback.svelte';
import { opening, resetOpeningForTests } from '../../src/lib/state/opening.svelte';
import HomePage from '../../src/routes/+page.svelte';
import NotesPage from '../../src/routes/notes/+page.svelte';
import TriadsPage from '../../src/routes/triads/+page.svelte';
import * as cagedRoute from '../../src/routes/caged/+page.svelte';
import UnknownPage from '../../src/routes/[...unknown]/+page.svelte';
import * as unknownLoad from '../../src/routes/[...unknown]/+page';

const child = createRawSnippet(() => ({ render: () => '<h1 tabindex="-1">Child</h1>' }));
const broken = createRawSnippet(() => ({
  render: () => {
    throw new Error('boom');
  }
}));

beforeEach(() => {
  navCallback = undefined;
  beforeNavCallback = undefined;
  replaceState.mockReset();
  vi.restoreAllMocks();
});

describe('route modules', () => {
  it('prerender everything without trailing slashes', () => {
    expect(prerender).toBe(true);
    expect(trailingSlash).toBe('never');
    expect(unknownLoad.prerender).toBe(true);
    expect(unknownLoad.entries()).toEqual([{ unknown: '__not-found' }]);
  });

  it('handleError records the failure on the console only', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    handleError({ error: new Error('x') } as Parameters<typeof handleError>[0]);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('caged route', () => {
  it('exists as a page component and inherits prerender from the root layout', () => {
    expect(cagedRoute.default).toBeTypeOf('function');
    expect(prerender).toBe(true);
  });
});

describe('pages', () => {
  it('home, notes, and triads render their screens', () => {
    const home = render(HomePage);
    expect(screen.getByRole('heading', { level: 1, name: 'Fretboard Master' })).toBeTruthy();
    home.unmount();
    const notes = render(NotesPage);
    expect(screen.getByRole('heading', { level: 1, name: 'Fretboard Notes' })).toBeTruthy();
    notes.unmount();
    render(TriadsPage);
    expect(screen.getByRole('heading', { level: 1, name: 'Triads' })).toBeTruthy();
  });

  it('error page offers a way home', () => {
    render(ErrorPage);
    expect(screen.getByRole('link', { name: 'Go to home' }).getAttribute('href')).toBe('/');
  });

  it('unknown page shows home with a notice and replaces the address', async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(history, 'replaceState');
    render(UnknownPage);
    expect(within(screen.getByRole('main')).getByRole('status').textContent).toContain(
      'We could not find that page'
    );
    await vi.runAllTimersAsync();
    const home = new URL('/', location.href).href;
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ 'sveltekit:pageurl': home }),
      '',
      home
    );
    spy.mockRestore();
    vi.useRealTimers();
  });
});

describe('unknown page: incomplete link (US3)', () => {
  beforeEach(() => resetOpeningForTests());

  it('shows the incomplete-link notice instead of not-found for an unknown tool link', () => {
    opening.start('http://localhost/scales?v=1&rt=0');
    render(UnknownPage);
    const text = within(screen.getByRole('main')).getByRole('status').textContent;
    expect(text).toContain('This link was incomplete');
    expect(text).not.toContain('We could not find that page');
  });

  it('keeps the not-found notice when the path is not a link', () => {
    opening.start('http://localhost/scales');
    render(UnknownPage);
    const text = within(screen.getByRole('main')).getByRole('status').textContent;
    expect(text).toContain('We could not find that page');
  });
});

describe('root layout', () => {
  it('renders children', () => {
    render(Layout, { children: child });
    expect(screen.getByRole('heading', { name: 'Child' })).toBeTruthy();
  });

  it('focuses the h1 after in-app navigation but not on initial load', () => {
    render(Layout, { children: child });
    const h1 = screen.getByRole('heading', { name: 'Child' });
    navCallback?.({ type: 'enter' });
    expect(document.activeElement).not.toBe(h1);
    navCallback?.({ type: 'link' });
    expect(document.activeElement).toBe(h1);
  });

  it('contains a rendering failure and records it', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(Layout, { children: broken });
    expect(screen.getByText('Something went wrong in this view')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Go to home' })).toBeTruthy();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('layout playback navigation (US4-4)', () => {
  it('beforeNavigate stops playback with reason navigate', () => {
    const stop = vi.spyOn(playback, 'stop');
    render(Layout, { children: child });
    expect(beforeNavCallback).toBeTypeOf('function');
    beforeNavCallback?.({ from: nav('/notes'), to: nav('/triads') });
    expect(stop).toHaveBeenCalledWith('navigate');
  });

  it('beforeNavigate drops the incomplete-link notice on a real screen change', () => {
    resetOpeningForTests();
    opening.start('http://localhost/caged?v=1&q=banana');
    render(Layout, { children: child });
    expect(opening.incomplete).not.toBeNull();
    beforeNavCallback?.({ from: nav('/caged'), to: nav('/notes') });
    expect(opening.incomplete).toBeNull();
  });

  it('beforeNavigate ignores shallow pops that keep the same path', () => {
    const stop = vi.spyOn(playback, 'stop');
    render(Layout, { children: child });
    beforeNavCallback?.({ from: nav('/notes'), to: nav('/notes') });
    expect(stop).not.toHaveBeenCalled();
  });

  it('afterNavigate does not move focus to h1 on a shallow pop', () => {
    render(Layout, { children: child });
    const h1 = screen.getByRole('heading', { name: 'Child' });
    navCallback?.({ type: 'popstate', from: nav('/notes'), to: nav('/notes') });
    expect(document.activeElement).not.toBe(h1);
    navCallback?.({ type: 'popstate', from: nav('/notes'), to: nav('/triads') });
    expect(document.activeElement).toBe(h1);
  });
});
