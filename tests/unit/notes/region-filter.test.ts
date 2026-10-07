// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import RegionFilter from '../../../src/lib/tools/notes/RegionFilter.svelte';

const setup = (region = { start: 5, end: 9 }, over: Record<string, unknown> = {}) => {
  const handlers = {
    onstart: vi.fn(),
    onend: vi.fn(),
    onshortcut: vi.fn()
  };
  const view = render(RegionFilter, { fretCount: 22, region, ...handlers, ...over });
  return { ...handlers, ...view };
};

describe('RegionFilter', () => {
  it('is a group named Frets with two spinbuttons carrying value semantics', () => {
    setup();
    const group = screen.getByRole('group', { name: 'Frets' });
    const start = within(group).getByRole('spinbutton', { name: 'Start fret' });
    const end = within(group).getByRole('spinbutton', { name: 'End fret' });
    for (const [el, now] of [
      [start, '5'],
      [end, '9']
    ] as const) {
      expect(el.getAttribute('aria-valuemin')).toBe('0');
      expect(el.getAttribute('aria-valuemax')).toBe('22');
      expect(el.getAttribute('aria-valuenow')).toBe(now);
    }
  });

  it('maps keys to values', async () => {
    const { onstart, onend } = setup();
    const start = screen.getByRole('spinbutton', { name: 'Start fret' });
    await fireEvent.keyDown(start, { key: 'ArrowUp' });
    expect(onstart).toHaveBeenLastCalledWith(6);
    await fireEvent.keyDown(start, { key: 'ArrowDown' });
    expect(onstart).toHaveBeenLastCalledWith(4);
    await fireEvent.keyDown(start, { key: 'PageUp' });
    expect(onstart).toHaveBeenLastCalledWith(10);
    await fireEvent.keyDown(start, { key: 'PageDown' });
    expect(onstart).toHaveBeenLastCalledWith(0);
    await fireEvent.keyDown(start, { key: 'Home' });
    expect(onstart).toHaveBeenLastCalledWith(0);
    const end = screen.getByRole('spinbutton', { name: 'End fret' });
    await fireEvent.keyDown(end, { key: 'End' });
    expect(onend).toHaveBeenLastCalledWith(22);
    await fireEvent.keyDown(end, { key: 'ArrowDown' });
    expect(onend).toHaveBeenLastCalledWith(8);
  });

  it('has − / + buttons for both limits', async () => {
    const { onstart, onend } = setup();
    await fireEvent.click(screen.getByRole('button', { name: 'Lower start fret' }));
    expect(onstart).toHaveBeenLastCalledWith(4);
    await fireEvent.click(screen.getByRole('button', { name: 'Raise start fret' }));
    expect(onstart).toHaveBeenLastCalledWith(6);
    await fireEvent.click(screen.getByRole('button', { name: 'Lower end fret' }));
    expect(onend).toHaveBeenLastCalledWith(8);
    await fireEvent.click(screen.getByRole('button', { name: 'Raise end fret' }));
    expect(onend).toHaveBeenLastCalledWith(10);
  });

  it('offers four shortcuts, pressed when equal to the region', async () => {
    const { onshortcut } = setup({ start: 5, end: 9 });
    const names = ['0–4', '5–9', '10–14', 'Whole neck'];
    const buttons = names.map((n) => screen.getByRole('button', { name: n }));
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
      'false'
    ]);
    await fireEvent.click(buttons[0]);
    expect(onshortcut).toHaveBeenLastCalledWith('0-4');
    await fireEvent.click(buttons[2]);
    expect(onshortcut).toHaveBeenLastCalledWith('10-14');
    await fireEvent.click(buttons[3]);
    expect(onshortcut).toHaveBeenLastCalledWith('whole');
  });

  it('marks whole neck pressed for 0..fretCount and updates visibly when the region changes', async () => {
    const view = setup({ start: 0, end: 22 });
    expect(screen.getByRole('button', { name: 'Whole neck' }).getAttribute('aria-pressed')).toBe(
      'true'
    );
    await view.rerender({ fretCount: 22, region: { start: 12, end: 12 } });
    const start = screen.getByRole('spinbutton', { name: 'Start fret' });
    const end = screen.getByRole('spinbutton', { name: 'End fret' });
    expect(start.getAttribute('aria-valuenow')).toBe('12');
    expect(end.getAttribute('aria-valuenow')).toBe('12');
    expect(start.textContent?.trim()).toBe('12');
    expect(end.textContent?.trim()).toBe('12');
  });
});
