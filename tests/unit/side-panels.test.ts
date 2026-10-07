// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet, tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setViewportForTests } from '../../src/lib/state/viewport.svelte';
import SidePanels from '../../src/lib/tools/SidePanels.svelte';

const actions = createRawSnippet(() => ({
  render: () => '<section data-testid="zone-e">Actions</section>'
}));
const details = createRawSnippet(() => ({
  render: () => '<section data-testid="zone-d">Details</section>'
}));

describe('SidePanels outside landscape (025 US3)', () => {
  it('renders zone E then zone D inside one wrapper', () => {
    render(SidePanels, { actions, details });
    const e = screen.getByTestId('zone-e');
    const d = screen.getByTestId('zone-d');
    expect(e.parentElement).toBe(d.parentElement);
    expect(e.parentElement?.id).toBe('tool-panels');
    expect(e.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('the wrapper adds no box and carries no region role', () => {
    render(SidePanels, { actions, details });
    const wrapper = screen.getByTestId('zone-e').parentElement as HTMLElement;
    expect(wrapper.classList.contains('panels')).toBe(true);
    expect(wrapper.getAttribute('role')).toBeNull();
    expect(wrapper.hidden).toBe(false);
  });

  it('the Panels opener comes first and is hidden', () => {
    const { container } = render(SidePanels, { actions, details });
    const opener = container.querySelector<HTMLButtonElement>('.panels-opener');
    expect(opener?.hidden).toBe(true);
    expect(opener?.getAttribute('aria-controls')).toBe('tool-panels');
    expect(opener?.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Panels' })).toBeNull();
    const wrapper = container.querySelector('#tool-panels');
    if (opener === null || wrapper === null) throw new Error('opener or wrapper missing');
    expect(opener.compareDocumentPosition(wrapper) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('SidePanels in landscape (025 US4)', () => {
  const landscapeActions = createRawSnippet(() => ({
    render: () => '<section data-testid="zone-e"><button type="button">Act</button></section>'
  }));

  beforeEach(() => {
    setViewportForTests({ width: 844, height: 390 });
  });
  afterEach(() => {
    setViewportForTests();
    cleanup();
  });

  const opener = () => screen.getByRole('button', { name: 'Panels' });

  it('starts closed with a visible opener wired to the panel', () => {
    const { container } = render(SidePanels, { actions: landscapeActions, details });
    expect(opener().getAttribute('aria-expanded')).toBe('false');
    expect(opener().getAttribute('aria-controls')).toBe('tool-panels');
    const panel = container.querySelector<HTMLElement>('#tool-panels');
    expect(panel?.hidden).toBe(true);
  });

  it('opening exposes a labelled region and focuses the close button', async () => {
    render(SidePanels, { actions: landscapeActions, details });
    await fireEvent.click(opener());
    await tick();
    expect(opener().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('region', { name: 'Actions and details' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close panels' }));
  });

  it('the close button closes and returns focus to the opener', async () => {
    render(SidePanels, { actions: landscapeActions, details });
    await fireEvent.click(opener());
    await tick();
    await fireEvent.click(screen.getByRole('button', { name: 'Close panels' }));
    await tick();
    expect(opener().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(opener());
  });

  it('Escape closes and returns focus to the opener', async () => {
    render(SidePanels, { actions: landscapeActions, details });
    await fireEvent.click(opener());
    await tick();
    await fireEvent.keyDown(screen.getByRole('button', { name: 'Close panels' }), {
      key: 'Escape'
    });
    await tick();
    expect(opener().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(opener());
  });

  it('the opener toggles the panel closed again', async () => {
    render(SidePanels, { actions: landscapeActions, details });
    await fireEvent.click(opener());
    await tick();
    await fireEvent.click(opener());
    await tick();
    expect(opener().getAttribute('aria-expanded')).toBe('false');
  });

  it('adds no backdrop, no inert and no focus trap', async () => {
    const { container } = render(SidePanels, { actions: landscapeActions, details });
    await fireEvent.click(opener());
    await tick();
    expect(container.querySelector('[inert]')).toBeNull();
    expect(container.querySelector('.backdrop, [aria-modal]')).toBeNull();
    expect(screen.getByRole('region').getAttribute('aria-modal')).toBeNull();
  });

  it('closes on re-entering landscape state: leaving while open closes it', async () => {
    const { container } = render(SidePanels, { actions: landscapeActions, details });
    await fireEvent.click(opener());
    await tick();
    setViewportForTests({ width: 390, height: 844 });
    await tick();
    const panel = container.querySelector<HTMLElement>('#tool-panels');
    expect(panel?.hidden).toBe(false);
    expect(panel?.getAttribute('role')).toBeNull();
    expect(container.querySelector<HTMLElement>('.panels-opener')?.hidden).toBe(true);
  });

  it('leaving landscape with focus inside moves it to the first focusable in zone E', async () => {
    render(SidePanels, { actions: landscapeActions, details });
    await fireEvent.click(opener());
    await tick();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close panels' }));
    setViewportForTests({ width: 390, height: 844 });
    await tick();
    await tick();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Act' }));
  });

  it('re-entering landscape starts closed', async () => {
    const { container } = render(SidePanels, { actions: landscapeActions, details });
    await fireEvent.click(opener());
    await tick();
    setViewportForTests({ width: 390, height: 844 });
    await tick();
    setViewportForTests({ width: 844, height: 390 });
    await tick();
    expect(container.querySelector<HTMLElement>('#tool-panels')?.hidden).toBe(true);
  });
});
