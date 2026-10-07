// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NotationSelector from '../../src/lib/shell/NotationSelector.svelte';
import { language, resetLanguageForTests } from '../../src/lib/state/language.svelte';
import { notation, resetNotationForTests } from '../../src/lib/state/notation.svelte';
import { resetPreferencesForTests } from '../../src/lib/state/preferences.svelte';

beforeEach(() => {
  vi.restoreAllMocks();
  resetPreferencesForTests();
  resetLanguageForTests();
  resetNotationForTests();
  language.start('en');
  notation.start({ notation: null, accidentals: 'sharps' });
});

afterEach(() => {
  resetNotationForTests();
  resetLanguageForTests();
});

// Fieldset order is fixed (Note names, Accidentals); indexing survives a language switch.
const groupRadios = (i: number) =>
  within(screen.getAllByRole('group')[i]).getAllByRole('radio') as HTMLInputElement[];
const radios = () => groupRadios(0);
const accidentalRadios = () => groupRadios(1);

describe('NotationSelector (Note names fieldset)', () => {
  it('is a "Note names" group with native radios Letters and Solfège', () => {
    render(NotationSelector);
    expect(screen.getByRole('group', { name: 'Note names' })).toBeTruthy();
    const r = radios();
    expect(r.every((x) => x.type === 'radio')).toBe(true);
    expect(r.map((x) => x.value)).toEqual(['letters', 'solfege']);
    expect(r.map((x) => x.closest('label')?.textContent?.trim())).toEqual(['Letters', 'Solfège']);
  });

  it('checked radio is notation.effective and follows the language until a pick', () => {
    render(NotationSelector);
    expect(radios().find((x) => x.checked)?.value).toBe('letters');
    language.restore('es');
    flushSync();
    expect(radios().find((x) => x.checked)?.value).toBe('solfege');
  });

  it('selecting calls notation.choose', async () => {
    const choose = vi.spyOn(notation, 'choose');
    render(NotationSelector);
    await fireEvent.click(screen.getByRole('radio', { name: 'Solfège' }));
    expect(choose).toHaveBeenCalledWith('solfege');
    expect(notation.effective).toBe('solfege');
    flushSync();
    expect(radios().find((x) => x.checked)?.value).toBe('solfege');
  });

  it('radios share one name so arrow keys move within the group', () => {
    render(NotationSelector);
    const names = new Set(radios().map((x) => x.name));
    expect(names.size).toBe(1);
    expect([...names][0]).toBeTruthy();
  });

  it('each label enforces --target-min', () => {
    render(NotationSelector);
    const css = readFileSync('src/lib/shell/NotationSelector.svelte', 'utf8');
    expect(css).toMatch(/min-block-size:\s*var\(--target-min\)/);
    expect(css).toMatch(/min-inline-size:\s*var\(--target-min\)/);
  });
});

describe('NotationSelector (Accidentals fieldset)', () => {
  it('is an "Accidentals" group with Sharps, Flats and Both radios', () => {
    render(NotationSelector);
    const r = accidentalRadios();
    expect(r.map((x) => x.value)).toEqual(['sharps', 'flats', 'both']);
    expect(r.map((x) => x.closest('label')?.textContent?.trim())).toEqual([
      'Sharps',
      'Flats',
      'Both'
    ]);
    expect(new Set(r.map((x) => x.name)).size).toBe(1);
    expect(new Set([...r, ...radios()].map((x) => x.name)).size).toBe(2);
  });

  it('checked radio follows notation.accidentals', () => {
    render(NotationSelector);
    expect(accidentalRadios().find((x) => x.checked)?.value).toBe('sharps');
    notation.restore(null, 'flats');
    flushSync();
    expect(accidentalRadios().find((x) => x.checked)?.value).toBe('flats');
  });

  it('selecting calls notation.chooseAccidentals', async () => {
    const choose = vi.spyOn(notation, 'chooseAccidentals');
    render(NotationSelector);
    await fireEvent.click(screen.getByRole('radio', { name: 'Both' }));
    expect(choose).toHaveBeenCalledWith('both');
    expect(notation.accidentals).toBe('both');
  });

  it('the bar toggle has no accidentals control', () => {
    const src = readFileSync('src/lib/shell/NotationToggle.svelte', 'utf8');
    expect(src).not.toMatch(/accidentals/i);
  });
});
