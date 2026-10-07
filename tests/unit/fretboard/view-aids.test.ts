// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import Fretboard from '../../../src/lib/fretboard/Fretboard.svelte';
import type { DisplayModel } from '../../../src/lib/fretboard/types';

const model = (description: string): DisplayModel => ({
  markers: [],
  labelMode: 'note',
  description
});

function mount(description = 'First text.') {
  return render(Fretboard, { instrument: STANDARD_GUITAR, model: model(description) });
}

describe('Describe this view (US1)', () => {
  it('button is named Describe this view in both states and flips aria-expanded', async () => {
    mount();
    const button = screen.getByRole('button', { name: 'Describe this view' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    await fireEvent.click(button);
    const again = screen.getByRole('button', { name: 'Describe this view' });
    expect(again.getAttribute('aria-expanded')).toBe('true');
    await fireEvent.click(again);
    expect(
      screen.getByRole('button', { name: 'Describe this view' }).getAttribute('aria-expanded')
    ).toBe('false');
  });

  it('aria-controls points to the panel, which holds the description', async () => {
    mount('Exact description.');
    const button = screen.getByRole('button', { name: 'Describe this view' });
    const panel = document.getElementById(button.getAttribute('aria-controls') as string);
    expect(panel).not.toBeNull();
    expect(panel?.hasAttribute('hidden')).toBe(true);
    await fireEvent.click(button);
    expect(panel?.hasAttribute('hidden')).toBe(false);
    expect(panel?.textContent).toBe('Exact description.');
  });

  it('keeps focus on the button after activation', async () => {
    mount();
    const button = screen.getByRole('button', { name: 'Describe this view' });
    button.focus();
    await fireEvent.click(button);
    expect(document.activeElement).toBe(button);
  });

  it('updates the panel when the description changes', async () => {
    const { rerender } = mount('First text.');
    const button = screen.getByRole('button', { name: 'Describe this view' });
    await fireEvent.click(button);
    await rerender({ instrument: STANDARD_GUITAR, model: model('Second text.') });
    await tick();
    const panel = document.getElementById(button.getAttribute('aria-controls') as string);
    expect(panel?.textContent).toBe('Second text.');
  });

  it('no longer offers the old Show/Hide labels', async () => {
    mount();
    expect(screen.queryByRole('button', { name: /show text description/i })).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Describe this view' }));
    expect(screen.queryByRole('button', { name: /hide text description/i })).toBeNull();
  });
});

describe('Announcements (US2)', () => {
  afterEach(() => vi.useRealTimers());

  it('is silent on first render, then announces once 500 ms after the change', async () => {
    vi.useFakeTimers();
    const view = mount('First text.');
    const live = view.container.querySelector('[aria-live="polite"]') as HTMLElement;
    vi.advanceTimersByTime(2000);
    expect(live.textContent).toBe('');
    await view.rerender({ instrument: STANDARD_GUITAR, model: model('Second text.') });
    await tick();
    vi.advanceTimersByTime(499);
    await tick();
    expect(live.textContent).toBe('');
    vi.advanceTimersByTime(1);
    await tick();
    expect(live.textContent).toBe('Second text.');
  });

  it('keeps the panel text current immediately and leaves focus on the button', async () => {
    vi.useFakeTimers();
    const view = mount('First text.');
    const button = screen.getByRole('button', { name: 'Describe this view' });
    await fireEvent.click(button);
    button.focus();
    await view.rerender({ instrument: STANDARD_GUITAR, model: model('Second text.') });
    await tick();
    const panel = view.container.querySelector(`#${button.getAttribute('aria-controls')}`);
    expect(panel?.textContent).toBe('Second text.');
    vi.advanceTimersByTime(600);
    await tick();
    expect(document.activeElement).toBe(button);
  });
});

describe('Legend (US3)', () => {
  const marked = (extra: Partial<DisplayModel> = {}): DisplayModel => ({
    markers: [
      { string: 4, fret: 2, function: 'root', emphasis: 'highlighted' },
      { string: 3, fret: 2, function: 'third', emphasis: 'highlighted' },
      { string: 2, fret: 2, function: 'fifth', emphasis: 'highlighted' }
    ],
    labelMode: 'note',
    description: 'Text.',
    ...extra
  });
  const mountMarked = (extra: Partial<DisplayModel> = {}) =>
    render(Fretboard, { instrument: STANDARD_GUITAR, model: marked(extra) });
  const legendButton = () => screen.getByRole('button', { name: 'Legend' });
  const panelOf = (c: HTMLElement) =>
    c.querySelector(`#${legendButton().getAttribute('aria-controls')}`) as HTMLElement;

  it('Legend button has aria-expanded and aria-controls, panel hidden by default', async () => {
    const { container } = mountMarked();
    expect(legendButton().getAttribute('aria-expanded')).toBe('false');
    const panel = panelOf(container);
    expect(panel.hasAttribute('hidden')).toBe(true);
    await fireEvent.click(legendButton());
    expect(legendButton().getAttribute('aria-expanded')).toBe('true');
    expect(panel.hasAttribute('hidden')).toBe(false);
  });

  it('lists entries as <ul><li> with aria-hidden sample, name and meaning', async () => {
    const { container } = mountMarked();
    await fireEvent.click(legendButton());
    const items = panelOf(container).querySelectorAll('ul > li');
    expect(items.length).toBe(3);
    const first = items[0];
    expect(first.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(first.querySelector('.name')?.textContent).toBe('Root');
    expect(first.querySelector('.meaning')?.textContent).toBeTruthy();
  });

  it('shows grouped <h3> labels when the model has legendGroups', async () => {
    const { container } = mountMarked({
      legendGroups: [
        { label: 'Chord', kinds: ['root', 'third'] },
        { label: 'Other', kinds: ['fifth'] }
      ]
    });
    await fireEvent.click(legendButton());
    const labels = [...panelOf(container).querySelectorAll('h3')].map((h) => h.textContent);
    expect(labels).toEqual(['Chord', 'Other']);
  });

  it('empty view shows the empty text', async () => {
    const { container } = render(Fretboard, {
      instrument: STANDARD_GUITAR,
      model: { markers: [], labelMode: 'note', description: 'Nothing.' }
    });
    await fireEvent.click(legendButton());
    expect(panelOf(container).textContent).toContain('Nothing is marked on the fretboard.');
    expect(panelOf(container).querySelector('li')).toBeNull();
  });

  it('Escape inside the panel closes it and focuses the Legend button', async () => {
    const { container } = mountMarked();
    await fireEvent.click(legendButton());
    const panel = panelOf(container);
    await fireEvent.keyDown(panel.querySelector('li') as HTMLElement, { key: 'Escape' });
    expect(panel.hasAttribute('hidden')).toBe(true);
    expect(legendButton().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(legendButton());
  });

  it('Escape outside the panel does nothing', async () => {
    const { container } = mountMarked();
    await fireEvent.click(legendButton());
    await fireEvent.keyDown(legendButton(), { key: 'Escape' });
    expect(panelOf(container).hasAttribute('hidden')).toBe(false);
  });

  it('description and Legend panels open independently', async () => {
    const { container } = mountMarked();
    const describe = screen.getByRole('button', { name: 'Describe this view' });
    await fireEvent.click(legendButton());
    expect(describe.getAttribute('aria-expanded')).toBe('false');
    await fireEvent.click(describe);
    expect(legendButton().getAttribute('aria-expanded')).toBe('true');
    await fireEvent.click(legendButton());
    expect(describe.getAttribute('aria-expanded')).toBe('true');
    expect(panelOf(container).hasAttribute('hidden')).toBe(true);
  });

  it('state is not persisted: a fresh mount starts closed', async () => {
    const first = mountMarked();
    await fireEvent.click(legendButton());
    first.unmount();
    const { container } = mountMarked();
    expect(legendButton().getAttribute('aria-expanded')).toBe('false');
    expect(panelOf(container).hasAttribute('hidden')).toBe(true);
  });

  it('updates while open when the model changes', async () => {
    const view = mountMarked();
    await fireEvent.click(legendButton());
    await view.rerender({
      instrument: STANDARD_GUITAR,
      model: {
        markers: [{ string: 1, fret: 3, function: 'degree', emphasis: 'highlighted' }],
        labelMode: 'note',
        description: 'x'
      }
    });
    await tick();
    const names = [...panelOf(view.container).querySelectorAll('.name')].map((n) => n.textContent);
    expect(names).toEqual(['Scale degree']);
  });
});
