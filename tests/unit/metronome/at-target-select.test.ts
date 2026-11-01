// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { language, resetLanguageForTests } from '../../../src/lib/state/language.svelte';
import AtTargetSelect from '../../../src/lib/tools/metronome/AtTargetSelect.svelte';

beforeEach(() => {
  resetLanguageForTests();
  language.start('en');
});

afterEach(() => {
  resetLanguageForTests();
  document.body.innerHTML = '';
});

describe('AtTargetSelect', () => {
  it('is a fieldset with a legend and two native radios', () => {
    render(AtTargetSelect, { value: 'hold', onchange: vi.fn() });
    const group = screen.getByRole('group', { name: 'At target' });
    expect(group.tagName).toBe('FIELDSET');
    expect(group.querySelector('legend')?.textContent).toBe('At target');
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios.map((r) => r.type)).toEqual(['radio', 'radio']);
    expect(radios.map((r) => r.value)).toEqual(['hold', 'stop']);
    expect(screen.getByRole('radio', { name: 'Hold' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Stop' })).toBeTruthy();
  });

  it('shows the checked option with a glyph as well as fill', async () => {
    const { container, rerender } = render(AtTargetSelect, { value: 'hold', onchange: vi.fn() });
    expect((screen.getByRole('radio', { name: 'Hold' }) as HTMLInputElement).checked).toBe(true);
    const glyphs = () =>
      Array.from(container.querySelectorAll('label')).map(
        (l) => l.querySelector('svg.check path') !== null
      );
    expect(glyphs()).toEqual([true, false]);
    await rerender({ value: 'stop', onchange: vi.fn() });
    expect(glyphs()).toEqual([false, true]);
  });

  it('reports a click on the other radio', async () => {
    const onchange = vi.fn();
    render(AtTargetSelect, { value: 'hold', onchange });
    await fireEvent.click(screen.getByRole('radio', { name: 'Stop' }));
    expect(onchange).toHaveBeenCalledWith('stop');
  });
});
