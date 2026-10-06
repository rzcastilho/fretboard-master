// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import InstrumentButton from '../../src/lib/shell/InstrumentButton.svelte';
import InstrumentSummary from '../../src/lib/shell/InstrumentSummary.svelte';
import TuningBadge from '../../src/lib/shell/TuningBadge.svelte';
import type { TuningId } from '../../src/lib/instrument/tunings';
import { AF_8 } from '../../src/lib/instrument/fixtures';
import { caged, resetCagedForTests } from '../../src/lib/state/caged.svelte';
import { instrument, resetInstrumentForTests } from '../../src/lib/state/instrument.svelte';

const applyTuning = (id: 'AF-4' | 'AF-1', frets?: number) => {
  instrument.open();
  instrument.selectTuning(id);
  if (frets !== undefined) instrument.setFrets(frets);
  instrument.confirm('triads');
};

beforeEach(() => {
  resetInstrumentForTests();
  resetCagedForTests();
});

describe('TuningBadge', () => {
  it('is absent for Standard', () => {
    render(TuningBadge, { tool: 'notes' });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('is absent for Standard at a different fret count', () => {
    applyTuning('AF-1', 24);
    render(TuningBadge, { tool: 'notes' });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the preset name with the full accessible name', () => {
    applyTuning('AF-4');
    render(TuningBadge, { tool: 'notes' });
    const badge = screen.getByRole('button', { name: 'Tuning: Drop D. Open instrument panel' });
    expect(badge.textContent?.trim()).toBe('Drop D');
  });

  it('is independent of fret count', () => {
    applyTuning('AF-4', 15);
    render(TuningBadge, { tool: 'notes' });
    expect(screen.getByRole('button', { name: /Drop D/ })).toBeTruthy();
  });

  it('opens the panel on activation', async () => {
    applyTuning('AF-4');
    render(TuningBadge, { tool: 'notes' });
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
    render(TuningBadge, { tool: 'notes' });
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
    render(TuningBadge, { tool: 'notes' });
    expect(screen.getByRole('button', { name: /Custom/ }).textContent?.trim()).toBe('Custom');
  });

  it('is absent when custom offsets are all zero (Standard)', () => {
    instrument.open();
    instrument.chooseCustom();
    instrument.stepString(1, 1);
    instrument.stepString(1, -1);
    instrument.confirm('triads');
    render(TuningBadge, { tool: 'notes' });
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('TuningBadge and summary (seven strings, 012)', () => {
  const apply = (id: TuningId) => {
    instrument.open();
    instrument.setStringCount(7);
    instrument.selectTuning(id);
    instrument.confirm('triads');
  };

  it('is hidden for 6-string standard and for 7-string standard', () => {
    render(TuningBadge, { tool: 'notes' });
    expect(screen.queryByRole('button')).toBeNull();
    apply('AF-21');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it.each([
    ['AF-22', '7-string half step down'],
    ['AF-23', 'Drop A'],
    ['AF-4', 'Drop D'],
    ['AF-11', 'Open A']
  ] as const)('is shown for 7-string %s as "%s"', (id, name) => {
    apply(id);
    render(TuningBadge, { tool: 'notes' });
    expect(
      screen
        .getByRole('button', { name: `Tuning: ${name}. Open instrument panel` })
        .textContent?.trim()
    ).toBe(name);
  });

  it('shows Custom for an unmatched 7-string tuning', () => {
    instrument.open();
    instrument.setStringCount(7);
    instrument.chooseCustom();
    for (let i = 0; i < 3; i++) instrument.stepString(7, -1);
    instrument.confirm('triads');
    render(TuningBadge, { tool: 'notes' });
    expect(screen.getByRole('button', { name: /Custom/ }).textContent?.trim()).toBe('Custom');
  });

  it('summary: "7 strings · standard tuning · right-handed" and with a name', () => {
    apply('AF-21');
    const { unmount } = render(InstrumentSummary);
    expect(screen.getByRole('button').textContent?.trim()).toBe(
      '7 strings · standard tuning · right-handed'
    );
    unmount();
    resetInstrumentForTests();
    apply('AF-23');
    render(InstrumentSummary);
    expect(screen.getByRole('button').textContent?.trim()).toBe(
      '7 strings · Drop A · right-handed'
    );
  });

  it('summary keeps the 6-string text byte-identical', () => {
    render(InstrumentSummary);
    expect(screen.getByRole('button').textContent?.trim()).toBe(
      '6 strings · standard tuning · right-handed'
    );
  });
});

describe('InstrumentButton', () => {
  it('is always rendered and opens the panel', async () => {
    render(InstrumentButton);
    await fireEvent.click(screen.getByRole('button', { name: 'Instrument' }));
    expect(instrument.panel.open).toBe(true);
  });
});

describe('InstrumentSummary (handedness)', () => {
  it('ends "left-handed" after confirming Left-handed, default text unchanged', async () => {
    render(InstrumentSummary);
    expect(screen.getByRole('button').textContent?.trim()).toBe(
      '6 strings · standard tuning · right-handed'
    );
    instrument.open();
    instrument.setHandedness('left');
    instrument.confirm('triads');
    await tick();
    expect(screen.getByRole('button').textContent?.trim()).toBe(
      '6 strings · standard tuning · left-handed'
    );
    instrument.open();
    instrument.selectTuning('AF-4');
    instrument.confirm('triads');
    await tick();
    expect(screen.getByRole('button').textContent?.trim()).toBe('6 strings · Drop D · left-handed');
  });
});

describe('TuningBadge: temporary CAGED variant', () => {
  const temporary = () => {
    resetCagedForTests(AF_8, { kind: 'preset', id: 'AF-8' });
    caged.viewInStandard();
  };

  it('shows the temporary text and accessible name in place of the tuning badge', () => {
    applyTuning('AF-4');
    temporary();
    render(TuningBadge, { tool: 'notes' });
    const badge = screen.getByRole('button', {
      name: 'Temporary tuning: Standard. Open instrument panel'
    });
    expect(badge.textContent?.trim()).toBe('Temporary tuning: Standard');
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('shows even when the stored tuning is Standard, and opens the panel', async () => {
    temporary();
    render(TuningBadge, { tool: 'notes' });
    await fireEvent.click(screen.getByRole('button', { name: /Temporary tuning/ }));
    expect(instrument.panel.open).toBe(true);
  });
});

describe('TuningBadge: link override (023 US2)', () => {
  const DROP_D = {
    stringCount: 6,
    tuning: { kind: 'preset', id: 'AF-4' },
    fretCount: 22
  } as const;

  it('labels the link tuning for the opened tool only', () => {
    instrument.receive('triads', DROP_D);
    const { unmount } = render(TuningBadge, { tool: 'triads' });
    expect(screen.getByRole('button', { name: /Drop D/ })).toBeTruthy();
    unmount();
    render(TuningBadge, { tool: 'notes' });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('keeps the panel on the stored instrument', async () => {
    instrument.receive('triads', DROP_D);
    render(TuningBadge, { tool: 'triads' });
    await fireEvent.click(screen.getByRole('button', { name: /Drop D/ }));
    expect(instrument.panel.open).toBe(true);
    expect(instrument.stringCount).toBe(6);
    expect(instrument.active.tuning).toEqual({ kind: 'preset', id: 'AF-1' });
  });
});
