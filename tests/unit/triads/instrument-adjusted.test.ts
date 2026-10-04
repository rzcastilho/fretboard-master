import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { instrument, resetInstrumentForTests } from '../../../src/lib/state/instrument.svelte';
import { notes, resetNotesForTests } from '../../../src/lib/state/notes.svelte';
import { resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';
import { resetTriadsForTests, triads } from '../../../src/lib/state/triads.svelte';
import TriadsTool from '../../../src/lib/tools/triads/TriadsTool.svelte';

const TEXT = 'We adjusted the view to the new instrument';

beforeEach(() => {
  vi.restoreAllMocks();
  resetPlaybackForTests();
  resetNotesForTests();
  resetTriadsForTests();
  resetInstrumentForTests();
});

/** Confirm a fret change on `screenId` while the stores report the given adjustments. */
function confirm(screenId: 'notes' | 'triads', adjNotes: boolean, adjTriads: boolean) {
  vi.spyOn(notes, 'applyInstrument').mockReturnValue(adjNotes);
  vi.spyOn(triads, 'applyInstrument').mockReturnValue(adjTriads);
  instrument.open();
  instrument.setFrets(12);
  instrument.confirm(screenId);
}

describe('Triads adjustment notice (US4)', () => {
  it('shows with Dismiss iff adjustedIn is triads, and clears on Dismiss', async () => {
    render(TriadsTool);
    confirm('triads', false, true);
    expect(await screen.findByText(TEXT)).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(instrument.adjustedIn).toBeNull();
  });

  it('is hidden when adjustedIn is another tool', () => {
    render(TriadsTool);
    confirm('notes', true, false);
    expect(instrument.adjustedIn).toBe('notes');
    expect(screen.queryByText(TEXT)).toBeNull();
  });

  it('clears on the next confirm', async () => {
    render(TriadsTool);
    confirm('triads', false, true);
    expect(await screen.findByText(TEXT)).toBeTruthy();
    instrument.open();
    instrument.setFrets(10);
    instrument.confirm('triads');
    expect(instrument.adjustedIn).toBeNull();
  });

  it('clears when the tool own notice becomes non-null (R-05)', async () => {
    render(TriadsTool);
    confirm('triads', false, true);
    expect(await screen.findByText(TEXT)).toBeTruthy();
    triads.setCompare(true);
    triads.setQuality('minor'); // swaps with the comparison quality → own notice
    expect(triads.notice).not.toBeNull();
    await Promise.resolve();
    expect(instrument.adjustedIn).toBeNull();
    expect(screen.queryByText(TEXT)).toBeNull();
  });
});
