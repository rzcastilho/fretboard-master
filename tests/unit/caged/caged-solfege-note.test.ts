import { must } from '../must';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { caged, resetCagedForTests } from '../../../src/lib/state/caged.svelte';
import { resetInstrumentForTests } from '../../../src/lib/state/instrument.svelte';
import { language, resetLanguageForTests } from '../../../src/lib/state/language.svelte';
import { notation, resetNotationForTests } from '../../../src/lib/state/notation.svelte';
import { preferences, resetPreferencesForTests } from '../../../src/lib/state/preferences.svelte';
import CagedTool from '../../../src/lib/tools/caged/CagedTool.svelte';

const NOTE_EN = /^The shapes are named after the open chords C \(Do\), A \(La\)/;
const note = () =>
  screen.queryByText(/The shapes are named after|Las formas llevan|As formas levam/);

beforeEach(() => {
  resetPreferencesForTests();
  resetLanguageForTests();
  resetNotationForTests();
  resetCagedForTests();
  resetInstrumentForTests();
  notation.start({ notation: null, accidentals: 'sharps' });
});

afterEach(() => {
  resetNotationForTests();
  resetLanguageForTests();
});

const viewport = (w: number, h: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: h });
};

describe('CagedTool: solfège note (021 US5)', () => {
  it('is absent in letters', async () => {
    render(CagedTool);
    await tick();
    expect(note()).toBeNull();
    expect(preferences.cagedNoteShown).toBe(false);
  });

  it('shows in solfège when not yet shown, and is recorded at once', async () => {
    notation.choose('solfege');
    render(CagedTool);
    await tick();
    expect(screen.getByText(NOTE_EN)).toBeTruthy();
    expect(preferences.cagedNoteShown).toBe(true);
  });

  it('uses solfegeName per language (pt-BR: Dó, Lá, Sol, Mi, Ré)', async () => {
    language.start('pt-BR');
    notation.choose('solfege');
    render(CagedTool);
    await tick();
    const el = must(note());
    expect(el.textContent).toContain('C (Dó)');
    expect(el.textContent).toContain('A (Lá)');
    expect(el.textContent).toContain('G (Sol)');
    expect(el.textContent).toContain('E (Mi)');
    expect(el.textContent).toContain('D (Ré)');
  });

  it('shows on a letters → solfège switch while CAGED is open', async () => {
    render(CagedTool);
    await tick();
    expect(note()).toBeNull();
    notation.choose('solfege');
    await tick();
    expect(screen.getByText(NOTE_EN)).toBeTruthy();
  });

  it('never shows again after dismissal or a remount', async () => {
    notation.choose('solfege');
    const first = render(CagedTool);
    await tick();
    await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(note()).toBeNull();
    first.unmount();
    render(CagedTool);
    await tick();
    expect(note()).toBeNull();
  });

  it('does not return on a letters → solfège round trip', async () => {
    notation.choose('solfege');
    render(CagedTool);
    await tick();
    notation.choose('letters');
    await tick();
    notation.choose('solfege');
    await tick();
    await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    notation.choose('letters');
    await tick();
    notation.choose('solfege');
    await tick();
    expect(note()).toBeNull();
  });

  it('is non-modal and independent of the rotate hint; both may show', async () => {
    viewport(390, 844);
    notation.choose('solfege');
    render(CagedTool);
    await tick();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText(NOTE_EN)).toBeTruthy();
    expect(screen.getByText('Turn your phone sideways to see more of the neck.')).toBeTruthy();
    expect(caged.state).toBeTruthy();
  });
});
