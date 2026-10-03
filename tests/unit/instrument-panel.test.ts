import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import InstrumentPanel from '../../src/lib/shell/InstrumentPanel.svelte';
import { instrument, resetInstrumentForTests } from '../../src/lib/state/instrument.svelte';
import { pageState } from './support/page-state.svelte';
import { playback } from '../../src/lib/state/playback.svelte';

const pushState = vi.hoisted(() => vi.fn());
vi.mock('$app/navigation', () => ({ pushState, afterNavigate: vi.fn(), beforeNavigate: vi.fn() }));
vi.mock('$app/state', async () => (await import('./support/page-state.svelte')).mock);

// jsdom has no <dialog> modal API: minimal stand-in that tracks `open`.
beforeAll(() => {
  const proto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

beforeEach(() => {
  resetInstrumentForTests();
  pushState.mockReset();
  pageState.value = {};
});

const open = async () => {
  const utils = render(InstrumentPanel);
  instrument.open();
  await Promise.resolve();
  await Promise.resolve();
  return utils;
};

describe('InstrumentPanel (tuning radio group)', () => {
  it('is a dialog named Instrument with an h2', async () => {
    await open();
    const dialog = screen.getByRole('dialog', { name: 'Instrument' });
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Instrument' })).toBeTruthy();
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
  });

  it('lists 11 radios in a Tuning group in preset order with spoken names', async () => {
    await open();
    const group = screen.getByRole('group', { name: 'Tuning' });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(11);
    expect(
      radios[0].getAttribute('aria-label') ?? radios[0].closest('label')?.textContent
    ).toBeTruthy();
    expect(
      screen.getByRole('radio', {
        name: 'Half step down: E flat, A flat, D flat, G flat, B flat, and E flat'
      })
    ).toBeTruthy();
    const names = radios.map((r) => (r.closest('label')?.querySelector('.name') ?? r).textContent);
    expect(names.slice(0, 4)).toEqual(['Standard', 'Half step down', 'Whole step down', 'Drop D']);
  });

  it('shows glyph notes aria-hidden', async () => {
    const { container } = await open();
    const notes = [...container.querySelectorAll('.notes')];
    expect(notes).toHaveLength(11);
    expect(notes[1].textContent).toBe('E♭ A♭ D♭ G♭ B♭ E♭');
    expect(notes[1].getAttribute('aria-hidden')).toBe('true');
  });

  it('checks the pending tuning and focuses it on open', async () => {
    await open();
    const standard = screen.getAllByRole('radio').find((r) => (r as HTMLInputElement).checked);
    expect(standard?.getAttribute('value')).toBe('AF-1');
    expect(document.activeElement).toBe(standard);
  });

  it('selecting a preset only changes the pending preview', async () => {
    const stop = vi.spyOn(playback, 'stop');
    await open();
    const drop = screen
      .getAllByRole('radio')
      .find((r) => r.getAttribute('value') === 'AF-4') as HTMLInputElement;
    await fireEvent.click(drop);
    expect(instrument.panel.open && instrument.panel.pending.tuningId).toBe('AF-4');
    expect(instrument.active.tuningId).toBe('AF-1');
    expect(stop).not.toHaveBeenCalled();
    expect(drop.checked).toBe(true);
    stop.mockRestore();
  });

  it('renders a labelled non-interactive preview', async () => {
    const { container } = await open();
    expect(screen.getByText('Preview')).toBeTruthy();
    const svg = container.querySelector('svg.fretboard-preview');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('Confirm is always enabled, applies the tuning and closes', async () => {
    await open();
    const confirm = screen.getByRole('button', { name: 'Confirm' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
    const drop = screen
      .getAllByRole('radio')
      .find((r) => r.getAttribute('value') === 'AF-4') as HTMLInputElement;
    await fireEvent.click(drop);
    await fireEvent.click(confirm);
    expect(instrument.active.tuningId).toBe('AF-4');
    expect(instrument.panel.open).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Close cancels without applying', async () => {
    await open();
    const drop = screen
      .getAllByRole('radio')
      .find((r) => r.getAttribute('value') === 'AF-4') as HTMLInputElement;
    await fireEvent.click(drop);
    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(instrument.active.tuningId).toBe('AF-1');
    expect(instrument.panel.open).toBe(false);
  });

  it('returns focus to the opener on close', async () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    render(InstrumentPanel);
    instrument.open();
    await Promise.resolve();
    await Promise.resolve();
    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});

describe('InstrumentPanel (fret count)', () => {
  it('opens with Standard checked, 6 strings and 22 frets (US2-3)', async () => {
    const { container } = await open();
    const standard = screen.getAllByRole('radio').find((r) => (r as HTMLInputElement).checked);
    expect(standard?.getAttribute('value')).toBe('AF-1');
    expect(screen.getByRole('spinbutton', { name: 'Frets' }).getAttribute('aria-valuenow')).toBe(
      '22'
    );
    expect(container.querySelectorAll('svg.fretboard-preview .string-label')).toHaveLength(6);
  });

  it('places the stepper after the tuning group and before the preview', async () => {
    await open();
    const group = screen.getByRole('group', { name: 'Tuning' });
    const spin = screen.getByRole('spinbutton', { name: 'Frets' });
    const preview = screen.getByText('Preview');
    expect(group.compareDocumentPosition(spin) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(spin.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('the stepper edits pending only and the preview re-renders', async () => {
    const { container } = await open();
    const lines = () => container.querySelectorAll('svg.fretboard-preview .fret-line').length;
    const before = lines();
    await fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Frets' }), { key: 'Home' });
    expect(instrument.panel.open && instrument.panel.pending.fretCount).toBe(12);
    expect(instrument.active.fretCount).toBe(22);
    expect(lines()).toBeLessThan(before);
    expect(lines()).toBe(12);
  });
});

const pickPreset = async (value: string) => {
  const radio = screen
    .getAllByRole('radio')
    .find((r) => r.getAttribute('value') === value) as HTMLInputElement;
  await fireEvent.click(radio);
};

describe('InstrumentPanel (cancel and restore)', () => {
  const withOpener = async () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    await open();
    return opener;
  };

  const expectDiscarded = (opener: HTMLElement) => {
    expect(instrument.panel.open).toBe(false);
    expect(instrument.active.tuningId).toBe('AF-1');
    expect(instrument.active.fretCount).toBe(22);
    expect(document.activeElement).toBe(opener);
    opener.remove();
  };

  it('Escape (cancel event) discards pending edits and returns focus', async () => {
    const opener = await withOpener();
    await pickPreset('AF-4');
    await fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expectDiscarded(opener);
  });

  it('Close discards pending edits and returns focus', async () => {
    const opener = await withOpener();
    await pickPreset('AF-4');
    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expectDiscarded(opener);
  });

  it('a click on the dialog itself (backdrop) discards; inner clicks do not', async () => {
    const opener = await withOpener();
    await pickPreset('AF-4');
    await fireEvent.click(screen.getByRole('heading', { level: 2 }));
    expect(instrument.panel.open).toBe(true);
    await fireEvent.click(screen.getByRole('dialog'));
    expectDiscarded(opener);
  });

  it('reopening shows the active config with its preset checked (FR-009)', async () => {
    await open();
    await pickPreset('AF-4');
    await fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    instrument.open();
    await Promise.resolve();
    await Promise.resolve();
    await pickPreset('AF-3');
    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    instrument.open();
    await Promise.resolve();
    await Promise.resolve();
    const checked = screen.getAllByRole('radio').find((r) => (r as HTMLInputElement).checked);
    expect(checked?.getAttribute('value')).toBe('AF-4');
  });

  it('Restore default resets pending to Standard/22 without applying (FR-010)', async () => {
    await open();
    await pickPreset('AF-4');
    await fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Frets' }), { key: 'Home' });
    instrument.confirm('home');
    instrument.open();
    await Promise.resolve();
    await Promise.resolve();
    expect(instrument.active.tuningId).toBe('AF-4');
    await fireEvent.click(screen.getByRole('button', { name: 'Restore default' }));
    expect(instrument.panel.open && instrument.panel.pending).toEqual({
      tuningId: 'AF-1',
      fretCount: 22
    });
    expect(instrument.active.tuningId).toBe('AF-4');
    expect(instrument.active.fretCount).toBe(12);
    expect(screen.getByRole('spinbutton', { name: 'Frets' }).getAttribute('aria-valuenow')).toBe(
      '22'
    );
  });

  it('Restore default comes before Confirm in tab order and is a full-size target', async () => {
    await open();
    const restore = screen.getByRole('button', { name: 'Restore default' });
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    expect(
      restore.compareDocumentPosition(confirm) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});

describe('InstrumentPanel (Back closes the panel, R-07)', () => {
  it('opening pushes one shallow entry', async () => {
    await open();
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(pushState).toHaveBeenCalledWith('', { instrumentPanel: true });
  });

  it('a Back pop (flag removed) cancels the panel', async () => {
    await open();
    pageState.value = { instrumentPanel: true };
    flushSync();
    await fireEvent.click(screen.getByRole('radio', { name: /^Drop D:/ }));
    pageState.value = {};
    flushSync();
    expect(instrument.panel.open).toBe(false);
    expect(instrument.active.tuningId).toBe('AF-1');
  });

  it('closing any other way removes the entry with history.back()', async () => {
    const back = vi.spyOn(history, 'back').mockImplementation(() => {});
    await open();
    pageState.value = { instrumentPanel: true };
    flushSync();
    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(back).toHaveBeenCalledTimes(1);
    back.mockRestore();
  });
});
