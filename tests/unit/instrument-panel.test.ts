import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import InstrumentPanel from '../../src/lib/shell/InstrumentPanel.svelte';
import { instrument, resetInstrumentForTests } from '../../src/lib/state/instrument.svelte';
import { pageState } from './support/page-state.svelte';
import { playback, resetPlaybackForTests } from '../../src/lib/state/playback.svelte';

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

/** Checked radio of the Tuning group (the Strings group has its own checked radio). */
const checkedTuning = () =>
  within(screen.getByRole('group', { name: 'Tuning' }))
    .getAllByRole('radio')
    .find((r) => (r as HTMLInputElement).checked);

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

  it('lists 11 preset radios plus Custom in a Tuning group in preset order with spoken names', async () => {
    await open();
    const group = screen.getByRole('group', { name: 'Tuning' });
    const radios = within(group).getAllByRole('radio').slice(0, 11);
    expect(within(group).getAllByRole('radio')).toHaveLength(12);
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
    const standard = checkedTuning();
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
    expect(instrument.panel.open && instrument.panel.pending.tuning).toEqual({
      kind: 'preset',
      id: 'AF-4'
    });
    expect(instrument.active.tuning).toEqual({ kind: 'preset', id: 'AF-1' });
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
    expect(instrument.active.tuning).toEqual({ kind: 'preset', id: 'AF-4' });
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
    expect(instrument.active.tuning).toEqual({ kind: 'preset', id: 'AF-1' });
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
    const standard = checkedTuning();
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
    expect(instrument.active.tuning).toEqual({ kind: 'preset', id: 'AF-1' });
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
    const checked = checkedTuning();
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
    expect(instrument.active.tuning).toEqual({ kind: 'preset', id: 'AF-4' });
    await fireEvent.click(screen.getByRole('button', { name: 'Restore default' }));
    expect(instrument.panel.open && instrument.panel.pending).toEqual({
      stringCount: 6,
      tuning: { kind: 'preset', id: 'AF-1' },
      fretCount: 22,
      handedness: 'right',
      orientation: 'highest-top'
    });
    expect(instrument.active.tuning).toEqual({ kind: 'preset', id: 'AF-4' });
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
    expect(instrument.active.tuning).toEqual({ kind: 'preset', id: 'AF-1' });
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

describe('InstrumentPanel (custom tuning, US1)', () => {
  const chooseCustom = async () => {
    await fireEvent.click(screen.getByRole('radio', { name: /Custom/ }));
  };
  const btn = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
  const noteText = (n: number) =>
    screen.getByRole('button', { name: new RegExp(`^String ${n},`) }).textContent?.trim();
  const press = async (name: string, times = 1) => {
    for (let i = 0; i < times; i++) await fireEvent.click(btn(name));
  };

  it('Custom radio is last, after AF-11; rows hidden until chosen (1.1)', async () => {
    await open();
    const radios = within(screen.getByRole('group', { name: 'Tuning' })).getAllByRole('radio');
    expect(radios).toHaveLength(12);
    expect(radios[11].getAttribute('value')).toBe('custom');
    expect(radios[10].getAttribute('value')).toBe('AF-11');
    expect(screen.queryByRole('button', { name: 'Lower string 6' })).toBeNull();
  });

  it('shows six rows, string 6 first: E2 A2 D3 G3 B3 E4 (1.1)', async () => {
    await open();
    await chooseCustom();
    const group = screen.getByRole('group', { name: 'Custom tuning' });
    const labels = within(group)
      .getAllByRole('button', { name: /^String \d,/ })
      .map((b) => b.textContent?.trim());
    expect(labels).toEqual(['E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
    expect(
      within(group)
        .getAllByRole('button', { name: /^String \d,/ })
        .map((b) => b.getAttribute('aria-label'))
    ).toEqual(
      [
        'String 6, E 2',
        'String 5, A 2',
        'String 4, D 3',
        'String 3, G 3',
        'String 2, B 3',
        'String 1, E 4'
      ].map((x) => x.replace(/(\w) (\d)$/, '$1 $2'))
    );
  });

  it('lowering string 6 twice shows D2 and the preview follows (1.3, FR-021)', async () => {
    const { container } = await open();
    await chooseCustom();
    await press('Lower string 6', 2);
    expect(noteText(6)).toBe('D2');
    expect(instrument.preview?.openStrings[5]).toMatchObject({ letter: 'D', octave: 2 });
    expect(container.querySelectorAll('svg.fretboard-preview .string-label')).toHaveLength(6);
  });

  it('limits: string 1 lowered 7× → A3, lower disabled, no error text (1.4)', async () => {
    await open();
    await chooseCustom();
    await press('Lower string 1', 7);
    expect(noteText(1)).toBe('A3');
    expect(btn('Lower string 1').disabled).toBe(true);
    expect(screen.queryByRole('alert')).toBeNull();
    await fireEvent.click(btn('Lower string 1'));
    expect(noteText(1)).toBe('A3');
  });

  it('string 6 raised to G♯2 disables raise (1.4)', async () => {
    await open();
    await chooseCustom();
    await press('Raise string 6', 4);
    expect(noteText(6)).toBe('G♯2');
    expect(btn('Raise string 6').disabled).toBe(true);
  });

  it('sharps spelling: F2 then F♯2 (1.6)', async () => {
    await open();
    await chooseCustom();
    await press('Raise string 6');
    expect(noteText(6)).toBe('F2');
    await press('Raise string 6');
    expect(noteText(6)).toBe('F♯2');
    expect(screen.getByRole('button', { name: 'String 6, F sharp 2' })).toBeTruthy();
  });

  it('Half step down then lower string 6 → D2, rest sharps (1.7)', async () => {
    await open();
    await fireEvent.click(screen.getByRole('radio', { name: /^Half step down:/ }));
    await chooseCustom();
    expect([6, 5, 4, 3, 2, 1].map((n) => noteText(n))).toEqual([
      'E♭2',
      'A♭2',
      'D♭3',
      'G♭3',
      'B♭3',
      'E♭4'
    ]);
    await press('Lower string 6');
    expect([6, 5, 4, 3, 2, 1].map((n) => noteText(n))).toEqual([
      'D2',
      'G♯2',
      'C♯3',
      'F♯3',
      'A♯3',
      'D♯4'
    ]);
  });

  it('Restore default → Standard selected, rows hidden, frets 22 (1.8)', async () => {
    await open();
    await chooseCustom();
    await press('Lower string 6');
    await fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Frets' }), { key: 'Home' });
    await fireEvent.click(btn('Restore default'));
    const checked = checkedTuning();
    expect(checked?.getAttribute('value')).toBe('AF-1');
    expect(screen.queryByRole('button', { name: 'Lower string 6' })).toBeNull();
    expect(screen.getByRole('spinbutton', { name: 'Frets' }).getAttribute('aria-valuenow')).toBe(
      '22'
    );
  });

  it('opening on a custom active tuning checks Custom and shows rows (1.9)', async () => {
    await open();
    await chooseCustom();
    await press('Raise string 1');
    await fireEvent.click(btn('Confirm'));
    instrument.open();
    await Promise.resolve();
    await Promise.resolve();
    const checked = checkedTuning();
    expect(checked?.getAttribute('value')).toBe('custom');
    expect(noteText(1)).toBe('F4');
  });

  it('opening on a preset hides rows and checks the preset (1.10)', async () => {
    await open();
    await pickPreset('AF-4');
    await fireEvent.click(btn('Confirm'));
    instrument.open();
    await Promise.resolve();
    await Promise.resolve();
    const checked = checkedTuning();
    expect(checked?.getAttribute('value')).toBe('AF-4');
    expect(screen.queryByRole('button', { name: 'Lower string 6' })).toBeNull();
  });

  it('has accessible names Lower/Raise string n (1.8 a11y)', async () => {
    await open();
    await chooseCustom();
    for (const n of [1, 2, 3, 4, 5, 6]) {
      expect(btn(`Lower string ${n}`)).toBeTruthy();
      expect(btn(`Raise string ${n}`)).toBeTruthy();
    }
  });

  it('focus moves to the row note button when a focused step button becomes disabled (FR-023)', async () => {
    await open();
    await chooseCustom();
    await press('Lower string 1', 6);
    const lower = btn('Lower string 1');
    lower.focus();
    await fireEvent.click(lower);
    await Promise.resolve();
    await Promise.resolve();
    expect(lower.disabled).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^String 1,/ }));
  });

  it('rapid repeated presses never pass the limit (FR-023)', async () => {
    await open();
    await chooseCustom();
    await press('Lower string 6', 20);
    expect(noteText(6)).toBe('A1');
    await press('Raise string 6', 20);
    expect(noteText(6)).toBe('G♯2');
  }, 30000);
});

describe('InstrumentPanel (known tuning name, US3)', () => {
  const chooseCustom = async () => {
    await fireEvent.click(screen.getByRole('radio', { name: /Custom/ }));
  };
  const btn = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
  const press = async (name: string, times = 1) => {
    for (let i = 0; i < times; i++) await fireEvent.click(btn(name));
  };
  const nameLine = () => screen.getByRole('status');

  it('name line is a polite status region reading the matched preset (3.1)', async () => {
    await open();
    await chooseCustom();
    expect(nameLine().getAttribute('aria-live')).toBe('polite');
    expect(nameLine().textContent?.trim()).toBe('Standard');
    await press('Lower string 6', 2);
    expect(nameLine().textContent?.trim()).toBe('Drop D');
    expect((screen.getByRole('radio', { name: /Custom/ }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole('group', { name: 'Custom tuning' })).toBeTruthy();
  });

  it('reads Custom when unmatched, Standard when all offsets are 0 (3.2)', async () => {
    await open();
    await chooseCustom();
    await press('Lower string 6', 2);
    await press('Raise string 6');
    expect(nameLine().textContent?.trim()).toBe('Custom');
    await press('Raise string 6');
    expect(nameLine().textContent?.trim()).toBe('Standard');
  });

  it('matching ignores spelling: all strings down one shows Half step down (3.1)', async () => {
    await open();
    await chooseCustom();
    for (const n of [6, 5, 4, 3, 2, 1]) await press(`Lower string ${n}`);
    expect(nameLine().textContent?.trim()).toBe('Half step down');
    expect(screen.getByRole('button', { name: /^String 6,/ }).textContent?.trim()).toBe('E♭2');
  });

  it('reopening after a matched confirm selects the preset, rows hidden (3.3)', async () => {
    await open();
    await chooseCustom();
    await press('Lower string 6', 2);
    await fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    flushSync(() => instrument.open());
    expect((screen.getByRole('radio', { name: /^Drop D:/ }) as HTMLInputElement).checked).toBe(
      true
    );
    expect(screen.queryByRole('group', { name: 'Custom tuning' })).toBeNull();
  });

  it('reopening after an unmatched confirm selects Custom with confirmed values (3.3)', async () => {
    await open();
    await chooseCustom();
    await press('Raise string 1');
    await fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    flushSync(() => instrument.open());
    expect((screen.getByRole('radio', { name: /Custom/ }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole('button', { name: /^String 1,/ }).textContent?.trim()).toBe('F4');
    expect(nameLine().textContent?.trim()).toBe('Custom');
  });
});

describe('InstrumentPanel (hear each string, US2)', () => {
  const chooseCustom = async () => {
    await fireEvent.click(screen.getByRole('radio', { name: /Custom/ }));
  };
  const btn = (name: string | RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement;
  let note: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    note = vi.spyOn(playback, 'note').mockReturnValue([]);
  });

  it('note button plays its string without changing state (2.1)', async () => {
    await open();
    await chooseCustom();
    await fireEvent.click(btn('Lower string 6'));
    await fireEvent.click(btn('Lower string 6'));
    note.mockClear();
    await fireEvent.click(btn(/^String 6,/));
    expect(note).toHaveBeenCalledTimes(1);
    expect(note.mock.calls[0][0]).toEqual({ string: 6, fret: 0 });
    expect(btn(/^String 6,/).textContent?.trim()).toBe('D2');
  });

  it('lower/raise plays the new pitch when it changed (2.2, 2.3)', async () => {
    await open();
    await chooseCustom();
    await fireEvent.click(btn('Raise string 2'));
    expect(note).toHaveBeenCalledTimes(1);
    expect(note.mock.calls[0][0]).toEqual({ string: 2, fret: 0 });
    expect(note.mock.calls[0][1].openStrings[1]).toBeDefined();
    await fireEvent.click(btn('Lower string 2'));
    expect(note).toHaveBeenCalledTimes(2);
  });

  it('a disabled step button plays nothing (2.4)', async () => {
    await open();
    await chooseCustom();
    for (let i = 0; i < 7; i++) await fireEvent.click(btn('Lower string 1'));
    note.mockClear();
    expect(btn('Lower string 1').disabled).toBe(true);
    await fireEvent.click(btn('Lower string 1'));
    expect(note).not.toHaveBeenCalled();
  });

  it('muted or locked audio leaves the panel working (2.5)', async () => {
    note.mockRestore();
    resetPlaybackForTests({
      createContext: () => {
        throw new Error('locked');
      }
    });
    playback.setMuted(true);
    await open();
    await chooseCustom();
    await fireEvent.click(btn('Lower string 6'));
    expect(btn(/^String 6,/).textContent?.trim()).toBe('D♯2');
    await fireEvent.click(btn(/^String 6,/));
    expect(screen.getByRole('dialog', { name: 'Instrument' })).toBeTruthy();
  });

  it('note button is a native button: Enter and Space activate it (2.6)', async () => {
    await open();
    await chooseCustom();
    const b = btn(/^String 3,/);
    expect(b.tagName).toBe('BUTTON');
    expect(b.type).toBe('button');
    expect(b.disabled).toBe(false);
    note.mockClear();
    await fireEvent.click(b); // native <button> maps Enter/Space to click
    expect(note).toHaveBeenCalledTimes(1);
  });
});

describe('InstrumentPanel (unusual set-ups, US4)', () => {
  const ORDER = 'The strings are not in order from low to high';
  const chooseCustom = async () => {
    await fireEvent.click(screen.getByRole('radio', { name: /Custom/ }));
  };
  const btn = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
  const press = async (name: string, times = 1) => {
    for (let i = 0; i < times; i++) await fireEvent.click(btn(name));
  };

  it('unison is accepted: no error, no order note, Confirm enabled (4.1)', async () => {
    await open();
    await chooseCustom();
    await press('Raise string 3', 4); // G3 → B3, same as string 2
    expect(screen.getByRole('button', { name: /^String 3,/ }).textContent?.trim()).toBe('B3');
    expect(screen.queryByText(ORDER)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(btn('Confirm').disabled).toBe(false);
  });

  it('inverted strings show a muted, non-blocking order note in the status region (4.5, 4.6)', async () => {
    await open();
    await chooseCustom();
    expect(screen.queryByText(ORDER)).toBeNull();
    await press('Lower string 3', 6); // G3 → C♯3, below string 4 (D3)
    const note = screen.getByText(ORDER);
    expect(note.closest('[role="status"]')?.getAttribute('aria-live')).toBe('polite');
    expect(note.closest('[role="status"]')).toBe(screen.getByRole('status'));
    expect(note.tagName).toBe('SPAN');
    expect(note.getAttribute('class') ?? '').toMatch(/order-note/);
    expect(note.outerHTML).not.toMatch(/error|danger/i);
    expect(note.textContent?.trim()).toBe(ORDER);
    expect(btn('Confirm').disabled).toBe(false);
    await press('Raise string 3', 1); // D3 = string 4: equal, not inverted
    expect(screen.queryByText(ORDER)).toBeNull();
  });
});

describe('InstrumentPanel (seven strings, 012 US1)', () => {
  const chooseStrings = async (n: 6 | 7) =>
    fireEvent.click(screen.getByRole('radio', { name: `${n} strings` }));
  const presetOrder = () =>
    within(screen.getByRole('group', { name: 'Tuning' }))
      .getAllByRole('radio')
      .map((r) => r.getAttribute('value'));

  it('has a Strings fieldset first with 6 strings / 7 strings radios (6 checked)', async () => {
    await open();
    const dialog = screen.getByRole('dialog', { name: 'Instrument' });
    const groups = within(dialog).getAllByRole('group');
    expect(groups[0].getAttribute('aria-labelledby') ?? groups[0].textContent).toBeTruthy();
    const strings = screen.getByRole('group', { name: 'Strings' });
    expect(groups[0]).toBe(strings);
    const radios = within(strings).getAllByRole('radio') as HTMLInputElement[];
    expect(radios.map((r) => r.closest('label')?.textContent?.trim())).toEqual([
      '6 strings',
      '7 strings'
    ]);
    expect(radios.map((r) => r.checked)).toEqual([true, false]);
  });

  it('lists the 7-string presets in FR-003 order without Standard / Half step down', async () => {
    await open();
    await chooseStrings(7);
    expect(presetOrder()).toEqual([
      'AF-21',
      'AF-22',
      'AF-23',
      'AF-3',
      'AF-4',
      'AF-5',
      'AF-6',
      'AF-7',
      'AF-8',
      'AF-9',
      'AF-10',
      'AF-11',
      'custom'
    ]);
    const group = screen.getByRole('group', { name: 'Tuning' });
    const names = within(group)
      .getAllByRole('radio')
      .map((r) => r.closest('label')?.querySelector('.name')?.textContent);
    expect(names).not.toContain('Standard');
    expect(names).not.toContain('Half step down');
    expect(names.slice(0, 3)).toEqual(['7-string standard', '7-string half step down', 'Drop A']);
  });

  it('shows the 7-string notes lowest → highest (Drop D = A1 D2 A2 D3 G3 B3 E4)', async () => {
    const { container } = await open();
    await chooseStrings(7);
    const rows = [...container.querySelectorAll('.preset')];
    const drop = rows.find((r) => r.querySelector('input')?.getAttribute('value') === 'AF-4');
    expect(drop?.querySelector('.notes')?.textContent).toBe('A1 D2 A2 D3 G3 B3 E4');
    const std = rows.find((r) => r.querySelector('input')?.getAttribute('value') === 'AF-21');
    expect(std?.querySelector('.notes')?.textContent).toBe('B1 E2 A2 D3 G3 B3 E4');
  });

  it('Standard becomes 7-string standard on 6 → 7; Drop D stays checked', async () => {
    await open();
    await chooseStrings(7);
    expect((checkedTuning() as HTMLElement).getAttribute('value')).toBe('AF-21');
    await chooseStrings(6);
    await pickPreset('AF-4');
    await chooseStrings(7);
    expect(
      (
        screen
          .getAllByRole('radio')
          .find((r) => (r as HTMLInputElement).value === 'AF-4') as HTMLInputElement
      ).checked
    ).toBe(true);
  });

  it('focus stays on the strings radio and the preview shows seven strings', async () => {
    const { container } = await open();
    const seven = screen.getByRole('radio', { name: '7 strings' });
    seven.focus();
    await fireEvent.click(seven);
    expect(document.activeElement).toBe(seven);
    expect(container.querySelectorAll('svg.fretboard-preview .string-label')).toHaveLength(7);
    expect(instrument.active.stringCount).toBe(6);
  });

  it('Custom rows: string 7 first, "Lower string 7" / "Raise string 7" / "String 7, B 1"', async () => {
    await open();
    await chooseStrings(7);
    await fireEvent.click(screen.getByRole('radio', { name: /Custom/ }));
    expect(screen.getByRole('button', { name: 'Lower string 7' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Raise string 7' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'String 7, B 1' })).toBeTruthy();
    const lowers = screen.getAllByRole('button', { name: /^Lower string/ });
    expect(lowers[0].getAttribute('aria-label')).toBe('Lower string 7');
    expect(lowers).toHaveLength(7);
  });

  it('string 7 limits disable the step buttons with no error text', async () => {
    await open();
    await chooseStrings(7);
    await fireEvent.click(screen.getByRole('radio', { name: /Custom/ }));
    const lower = screen.getByRole('button', { name: 'Lower string 7' }) as HTMLButtonElement;
    for (let i = 0; i < 7; i++) await fireEvent.click(lower);
    expect(lower.disabled).toBe(true);
    expect(screen.queryByRole('alert')).toBeNull();
    const raise = screen.getByRole('button', { name: 'Raise string 7' }) as HTMLButtonElement;
    for (let i = 0; i < 11; i++) await fireEvent.click(raise);
    expect(raise.disabled).toBe(true);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('name line reads "Drop A" at A1 and "Custom" at G♯1', async () => {
    const { container } = await open();
    await chooseStrings(7);
    await fireEvent.click(screen.getByRole('radio', { name: /Custom/ }));
    const lower = screen.getByRole('button', { name: 'Lower string 7' });
    await fireEvent.click(lower);
    await fireEvent.click(lower);
    expect(container.textContent).toContain('Drop A');
    await fireEvent.click(lower);
    const line = container.querySelector('[role="status"]');
    expect(line?.textContent).toContain('Custom');
    expect(line?.textContent).not.toContain('Drop A');
  });

  it('Confirm applies 7 strings; close without confirm keeps 6', async () => {
    await open();
    await chooseStrings(7);
    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(instrument.active.stringCount).toBe(6);
    instrument.open();
    await Promise.resolve();
    await Promise.resolve();
    await chooseStrings(7);
    await fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(instrument.active.stringCount).toBe(7);
    expect(instrument.active.tuning).toEqual({ kind: 'preset', id: 'AF-21' });
  });
});

describe('InstrumentPanel (handedness)', () => {
  const radios = () =>
    within(screen.getByRole('group', { name: 'Handedness' })).getAllByRole(
      'radio'
    ) as HTMLInputElement[];

  it('has a Handedness fieldset with Right-handed checked and Left-handed', async () => {
    await open();
    const [right, left] = radios();
    expect(right.closest('label')?.textContent).toContain('Right-handed');
    expect(left.closest('label')?.textContent).toContain('Left-handed');
    expect(right.checked).toBe(true);
    expect(left.checked).toBe(false);
  });

  it('choosing Left changes the preview only; Close discards, Confirm applies', async () => {
    await open();
    await fireEvent.click(radios()[1]);
    expect(instrument.preview?.handedness).toBe('left');
    expect(instrument.current.handedness).toBe('right');
    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(instrument.current.handedness).toBe('right');
    instrument.open();
    await Promise.resolve();
    await fireEvent.click(radios()[1]);
    await fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(instrument.current.handedness).toBe('left');
  });

  it('Restore default re-checks Right-handed', async () => {
    await open();
    await fireEvent.click(radios()[1]);
    expect(radios()[1].checked).toBe(true);
    await fireEvent.click(screen.getByRole('button', { name: 'Restore default' }));
    expect(radios()[0].checked).toBe(true);
  });
});

describe('InstrumentPanel (strings on top, US2)', () => {
  const radios = () =>
    within(screen.getByRole('group', { name: 'Strings on top' })).getAllByRole(
      'radio'
    ) as HTMLInputElement[];

  it('has a Strings on top fieldset with Highest checked and Lowest', async () => {
    await open();
    const [highest, lowest] = radios();
    expect(highest.closest('label')?.textContent).toContain('Highest string on top');
    expect(lowest.closest('label')?.textContent).toContain('Lowest string on top');
    expect(highest.checked).toBe(true);
    expect(lowest.checked).toBe(false);
  });

  it('choosing Lowest changes the preview only; Close discards, Confirm applies', async () => {
    await open();
    await fireEvent.click(radios()[1]);
    expect(instrument.preview?.orientation).toBe('lowest-top');
    expect(instrument.current.orientation).toBe('highest-top');
    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(instrument.current.orientation).toBe('highest-top');
    instrument.open();
    await Promise.resolve();
    await fireEvent.click(radios()[1]);
    await fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(instrument.current.orientation).toBe('lowest-top');
  });

  it('Restore default re-checks Highest string on top', async () => {
    await open();
    await fireEvent.click(radios()[1]);
    expect(radios()[1].checked).toBe(true);
    await fireEvent.click(screen.getByRole('button', { name: 'Restore default' }));
    expect(radios()[0].checked).toBe(true);
  });

  it('is independent of Handedness', async () => {
    await open();
    const hand = within(screen.getByRole('group', { name: 'Handedness' })).getAllByRole(
      'radio'
    ) as HTMLInputElement[];
    await fireEvent.click(hand[1]);
    await fireEvent.click(radios()[1]);
    expect(instrument.preview?.handedness).toBe('left');
    expect(instrument.preview?.orientation).toBe('lowest-top');
    await fireEvent.click(hand[0]);
    expect(instrument.preview?.handedness).toBe('right');
    expect(instrument.preview?.orientation).toBe('lowest-top');
    expect(radios()[1].checked).toBe(true);
  });
});
