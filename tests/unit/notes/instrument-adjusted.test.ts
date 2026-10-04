import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import { instrument, resetInstrumentForTests } from '../../../src/lib/state/instrument.svelte';
import { notes, resetNotesForTests } from '../../../src/lib/state/notes.svelte';
import { resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';
import { resetTriadsForTests } from '../../../src/lib/state/triads.svelte';
import NotesTool from '../../../src/lib/tools/notes/NotesTool.svelte';

const TEXT = 'We adjusted the view to the new instrument';

beforeEach(() => {
  resetPlaybackForTests();
  resetNotesForTests();
  resetTriadsForTests();
  resetInstrumentForTests();
});

function shrinkTo12(screenId: 'notes' | 'triads' = 'notes') {
  if (screenId === 'notes') notes.setRegionShortcut('10-14');
  instrument.open();
  instrument.setFrets(12);
  instrument.confirm(screenId);
}

describe('Notes adjustment notice (US4)', () => {
  it('shows with Dismiss when adjustedIn is notes, and clears on Dismiss', async () => {
    render(NotesTool);
    shrinkTo12();
    expect(await screen.findByText(TEXT)).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(instrument.adjustedIn).toBeNull();
  });

  it('is not shown when adjustedIn is another tool', () => {
    render(NotesTool);
    notes.setRegionShortcut('10-14');
    instrument.open();
    instrument.setFrets(12);
    instrument.confirm('triads');
    expect(screen.queryByText(TEXT)).toBeNull();
  });

  it('is not shown when the view needed no adjustment', () => {
    render(NotesTool);
    instrument.open();
    instrument.setFrets(12);
    instrument.confirm('notes');
    expect(screen.queryByText(TEXT)).toBeNull();
  });

  it('clears on the next confirm', async () => {
    render(NotesTool);
    shrinkTo12();
    expect(await screen.findByText(TEXT)).toBeTruthy();
    instrument.open();
    instrument.setFrets(10);
    instrument.confirm('notes');
    expect(instrument.adjustedIn).toBeNull();
  });

  it('clears when the tool own notice becomes non-null', async () => {
    render(NotesTool);
    shrinkTo12();
    expect(await screen.findByText(TEXT)).toBeTruthy();
    // String 1 only, region 10–12 (D, D#, E): selecting C has no position in view.
    for (const n of [2, 3, 4, 5, 6]) notes.toggleString(n);
    notes.toggleNote(0);
    expect(notes.display.missing).toEqual([0]);
    await Promise.resolve();
    expect(instrument.adjustedIn).toBeNull();
    expect(screen.queryByText(TEXT)).toBeNull();
  });
});
