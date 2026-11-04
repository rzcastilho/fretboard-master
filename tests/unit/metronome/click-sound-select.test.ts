// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { language, resetLanguageForTests } from '../../../src/lib/state/language.svelte';
import { metronome, resetMetronomeForTests } from '../../../src/lib/state/metronome.svelte';
import { playback } from '../../../src/lib/state/playback.svelte';
import ClickSoundSelect from '../../../src/lib/tools/metronome/ClickSoundSelect.svelte';

beforeEach(() => {
  resetLanguageForTests();
  language.start('en');
  vi.spyOn(playback, 'clickSink').mockReturnValue(null);
  resetMetronomeForTests();
});
afterEach(() => {
  resetLanguageForTests();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('ClickSoundSelect (042)', () => {
  it('is a labelled native select with five localized options in order', () => {
    render(ClickSoundSelect);
    const select = screen.getByLabelText('Click sound') as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    expect(select.id).toBe('metronome-sound');
    expect(Array.from(select.options).map((o) => o.value)).toEqual([
      'click',
      'wood',
      'beep',
      'rim',
      'cowbell'
    ]);
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual([
      'Click',
      'Wood block',
      'Beep',
      'Rim',
      'Cowbell'
    ]);
  });

  it('value follows metronome.sound and change calls setSound', async () => {
    render(ClickSoundSelect);
    const select = screen.getByLabelText('Click sound') as HTMLSelectElement;
    expect(select.value).toBe('click');
    await fireEvent.change(select, { target: { value: 'rim' } });
    expect(metronome.sound).toBe('rim');
    metronome.restoreSound('cowbell');
    await vi.waitFor(() => expect(select.value).toBe('cowbell'));
  });

  it('localizes the names', () => {
    language.restore('es');
    render(ClickSoundSelect);
    const select = screen.getByLabelText('Sonido del clic') as HTMLSelectElement;
    expect(select.options[1].textContent).toBe('Bloque de madera');
  });
});
