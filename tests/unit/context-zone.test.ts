// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { contextPanel, resetContextPanelForTests } from '../../src/lib/state/context-panel.svelte';
import { resetInstrumentForTests } from '../../src/lib/state/instrument.svelte';
import { setViewportForTests } from '../../src/lib/state/viewport.svelte';
import ContextZone from '../../src/lib/tools/ContextZone.svelte';

const SUMMARY = 'A major · 1st inversion · C♯ – E – A';
const children = createRawSnippet(() => ({ render: () => '<p>Zone D content</p>' }));

const mount = () => render(ContextZone, { summary: SUMMARY, children });

beforeEach(() => {
  resetInstrumentForTests();
  resetContextPanelForTests();
});
afterEach(() => {
  setViewportForTests();
  resetContextPanelForTests();
});

describe('ContextZone (025 US3)', () => {
  it('narrow: shows the summary and a collapsed Show details button by default', () => {
    setViewportForTests({ width: 390, height: 844 });
    mount();
    expect(screen.getByText(SUMMARY)).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Show details' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    const content = document.getElementById(button.getAttribute('aria-controls') ?? '');
    expect(content?.hidden).toBe(true);
  });

  it('narrow: the button expands and collapses the content', async () => {
    setViewportForTests({ width: 390, height: 844 });
    mount();
    await fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
    const hide = screen.getByRole('button', { name: 'Hide details' });
    expect(hide.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(hide.getAttribute('aria-controls') ?? '')?.hidden).toBe(false);
    await fireEvent.click(hide);
    expect(screen.getByRole('button', { name: 'Show details' })).toBeTruthy();
  });

  it('keeps the choice across tools for the session', async () => {
    setViewportForTests({ width: 390, height: 844 });
    const first = mount();
    await fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
    first.unmount();
    mount();
    expect(screen.getByRole('button', { name: 'Hide details' })).toBeTruthy();
    expect(contextPanel.expanded).toBe(true);
  });

  it.each([
    ['medium', 800, 1280],
    ['wide', 1440, 900]
  ])('%s: no summary row and the content is visible', (_name, width, height) => {
    setViewportForTests({ width, height });
    mount();
    expect(screen.queryByText(SUMMARY)).toBeNull();
    expect(screen.queryByRole('button', { name: /details/ })).toBeNull();
    expect(screen.getByText('Zone D content').closest('[hidden]')).toBeNull();
  });

  it('before mount (no arrangement): content visible, no summary row', () => {
    mount();
    expect(screen.queryByRole('button', { name: /details/ })).toBeNull();
    expect(screen.getByText('Zone D content').closest('[hidden]')).toBeNull();
  });
});
