import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import InstrumentButton from '../../src/lib/shell/InstrumentButton.svelte';
import TuningBadge from '../../src/lib/shell/TuningBadge.svelte';
import { instrument, resetInstrumentForTests } from '../../src/lib/state/instrument.svelte';

const applyTuning = (id: 'AF-4' | 'AF-1', frets?: number) => {
  instrument.open();
  instrument.selectTuning(id);
  if (frets !== undefined) instrument.setFrets(frets);
  instrument.confirm('triads');
};

beforeEach(() => resetInstrumentForTests());

describe('TuningBadge', () => {
  it('is absent for Standard', () => {
    render(TuningBadge);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('is absent for Standard at a different fret count', () => {
    applyTuning('AF-1', 24);
    render(TuningBadge);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the preset name with the full accessible name', () => {
    applyTuning('AF-4');
    render(TuningBadge);
    const badge = screen.getByRole('button', { name: 'Tuning: Drop D. Open instrument panel' });
    expect(badge.textContent?.trim()).toBe('Drop D');
  });

  it('is independent of fret count', () => {
    applyTuning('AF-4', 15);
    render(TuningBadge);
    expect(screen.getByRole('button', { name: /Drop D/ })).toBeTruthy();
  });

  it('opens the panel on activation', async () => {
    applyTuning('AF-4');
    render(TuningBadge);
    await fireEvent.click(screen.getByRole('button', { name: /Drop D/ }));
    expect(instrument.panel.open).toBe(true);
  });
});

describe('TuningBadge (custom tuning, US3)', () => {
  it('names a matched Half step down in its flat spelling (3.4)', () => {
    instrument.open();
    instrument.chooseCustom();
    for (const n of [6, 5, 4, 3, 2, 1] as const) instrument.stepString(n, -1);
    instrument.confirm('triads');
    render(TuningBadge);
    expect(
      screen
        .getByRole('button', { name: 'Tuning: Half step down. Open instrument panel' })
        .textContent?.trim()
    ).toBe('Half step down');
    expect(instrument.active.tuning).toEqual({ kind: 'preset', id: 'AF-2' });
  });

  it('shows Custom for an unmatched tuning (3.5)', () => {
    instrument.open();
    instrument.chooseCustom();
    instrument.stepString(1, 1);
    instrument.confirm('triads');
    render(TuningBadge);
    expect(screen.getByRole('button', { name: /Custom/ }).textContent?.trim()).toBe('Custom');
  });

  it('is absent when custom offsets are all zero (Standard)', () => {
    instrument.open();
    instrument.chooseCustom();
    instrument.stepString(1, 1);
    instrument.stepString(1, -1);
    instrument.confirm('triads');
    render(TuningBadge);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('InstrumentButton', () => {
  it('is always rendered and opens the panel', async () => {
    render(InstrumentButton);
    await fireEvent.click(screen.getByRole('button', { name: 'Instrument' }));
    expect(instrument.panel.open).toBe(true);
  });
});
