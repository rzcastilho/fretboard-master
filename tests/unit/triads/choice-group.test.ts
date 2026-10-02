import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import ChoiceGroup from '../../../src/lib/tools/ChoiceGroup.svelte';

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' }
] as const;

function setup(current = 'a') {
  const onchoose = vi.fn();
  render(ChoiceGroup, { name: 'Letters', options, current, onchoose });
  return onchoose;
}

describe('ChoiceGroup', () => {
  it('renders a named radiogroup with one checked radio and roving tabindex', () => {
    setup('b');
    expect(screen.getByRole('radiogroup', { name: 'Letters' })).toBeTruthy();
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(radios.map((r) => r.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
  });

  it('click chooses', async () => {
    const onchoose = setup();
    await fireEvent.click(screen.getByRole('radio', { name: 'Gamma' }));
    expect(onchoose).toHaveBeenCalledWith('c');
  });

  it('arrows move and wrap; Home/End jump', async () => {
    const onchoose = setup('a');
    const first = screen.getByRole('radio', { name: 'Alpha' });
    await fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(onchoose).toHaveBeenLastCalledWith('b');
    await fireEvent.keyDown(first, { key: 'ArrowLeft' });
    expect(onchoose).toHaveBeenLastCalledWith('c');
    await fireEvent.keyDown(first, { key: 'End' });
    expect(onchoose).toHaveBeenLastCalledWith('c');
    await fireEvent.keyDown(first, { key: 'Home' });
    expect(onchoose).toHaveBeenLastCalledWith('a');
  });

  it('moves focus to the chosen radio and ignores modified keys and other keys', async () => {
    const onchoose = setup('a');
    const first = screen.getByRole('radio', { name: 'Alpha' });
    await fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Beta' }));
    onchoose.mockClear();
    await fireEvent.keyDown(first, { key: 'ArrowRight', ctrlKey: true });
    await fireEvent.keyDown(first, { key: 'x' });
    expect(onchoose).not.toHaveBeenCalled();
  });

  it('disabled: aria-disabled on group and radios, interactions ignored, checked radio focusable', async () => {
    const onchoose = vi.fn();
    render(ChoiceGroup, { name: 'Letters', options, current: 'b', onchoose, disabled: true });
    const group = screen.getByRole('radiogroup', { name: 'Letters' });
    expect(group.getAttribute('aria-disabled')).toBe('true');
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-disabled'))).toEqual(['true', 'true', 'true']);
    expect(radios.every((r) => !r.hasAttribute('disabled'))).toBe(true);
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(radios[1].getAttribute('tabindex')).toBe('0');
    radios[1].focus();
    expect(document.activeElement).toBe(radios[1]);
    await fireEvent.click(radios[2]);
    for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) {
      await fireEvent.keyDown(radios[1], { key });
    }
    expect(onchoose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(radios[1]);
  });

  it('enabled by default: no aria-disabled attribute on the group', () => {
    setup();
    expect(screen.getByRole('radiogroup').hasAttribute('aria-disabled')).toBe(false);
  });
});
