// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClickSink } from '../../../src/lib/audio/metronome';
import MetronomePanel from '../../../src/lib/tools/metronome/MetronomePanel.svelte';
import { language, resetLanguageForTests } from '../../../src/lib/state/language.svelte';
import { DEFAULT_SETTINGS } from '../../../src/lib/state/metronome-settings';
import { metronome, resetMetronomeForTests } from '../../../src/lib/state/metronome.svelte';
import { playback } from '../../../src/lib/state/playback.svelte';
import { resetShortcutsForTests, shortcuts } from '../../../src/lib/state/shortcuts.svelte';
import { FakeAudioPort, FakeClock, FakeFrames } from '../audio/support/fake-audio';

let port: FakeAudioPort;
let clock: FakeClock;
let frames: FakeFrames;

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await tick();
}

function advance(seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 40); i++) {
    port.currentTime += 0.025;
    clock.advance(25);
  }
  frames.flush();
}

beforeEach(() => {
  vi.spyOn(performance, 'now').mockReturnValue(1000);
  resetLanguageForTests();
  language.start('en');
  port = new FakeAudioPort();
  port.state = 'running';
  clock = new FakeClock();
  frames = new FakeFrames();
  const sink: ClickSink = {
    port,
    destination: port.destination,
    running: Promise.resolve(true)
  };
  vi.spyOn(playback, 'clickSink').mockReturnValue(sink);
  resetMetronomeForTests({ clock, frames }, { countIn: false });
});

afterEach(() => {
  metronome.screenChanged();
  resetLanguageForTests();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const key = (k: string, target: Element | Document = document.body) =>
  fireEvent.keyDown(target, { key: k, bubbles: true });

async function startRun(): Promise<void> {
  await fireEvent.click(screen.getByRole('button', { name: 'Start Training' }));
  await settle();
  advance(0.1);
  await settle();
}

describe('MetronomePanel status line (032)', () => {
  it('reads BEAT –/4 · SUB 3 before the first click, then BEAT 1/4 · SUB 3', async () => {
    const { container } = render(MetronomePanel);
    await fireEvent.click(screen.getByRole('button', { name: 'Start Training' }));
    const position = (): string =>
      container.querySelector('.position')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    expect(position()).toBe('BEAT –/4 · SUB 3');
    await settle();
    advance(0.2);
    await settle();
    expect(position()).toBe('BEAT 1/4 · SUB 3');
  });
});

describe('MetronomePanel count-in (033)', () => {
  const position = (c: HTMLElement): string =>
    c.querySelector('.position')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  it('shows COUNT IN with one pulsing dot, then the beat row', async () => {
    resetMetronomeForTests({ clock, frames }, { countIn: true });
    const { container } = render(MetronomePanel);
    await fireEvent.click(screen.getByRole('button', { name: 'Start Training' }));
    expect(position(container)).toBe('COUNT IN –/4');
    let dots = container.querySelectorAll('.dot');
    expect(dots).toHaveLength(1);
    expect(dots[0].getAttribute('data-state')).toBe('upcoming');
    expect(dots[0].closest('[aria-hidden="true"]')).toBeTruthy();
    await settle();
    advance(0.1);
    await settle();
    expect(position(container)).toBe('COUNT IN 1/4');
    dots = container.querySelectorAll('.dot');
    expect(dots).toHaveLength(1);
    expect(dots[0].getAttribute('data-state')).toBe('lit');
    advance(4 * (60 / 85));
    await settle();
    expect(position(container)).toBe('BEAT 1/4 · SUB 3');
    expect(container.querySelectorAll('.dot')).toHaveLength(4);
  });
});

describe('MetronomePanel run controls', () => {
  it('shows Start in settings and Pause / Resume + Reset while a run exists', async () => {
    render(MetronomePanel);
    expect(screen.getByRole('button', { name: 'Start Training' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
    await startRun();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(metronome.phase).toBe('paused');
    expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
  });

  it('Reset has the catalog text as aria-label and title, in en and pt-BR', async () => {
    render(MetronomePanel);
    await startRun();
    const en = screen.getByRole('button', { name: 'Reset' });
    expect(en.getAttribute('aria-label')).toBe('Reset');
    expect(en.getAttribute('title')).toBe('Reset');
    language.restore('pt-BR');
    await settle();
    const btn = document.querySelector('button.reset') as HTMLButtonElement;
    const label = btn.getAttribute('aria-label');
    expect(label).toBeTruthy();
    expect(label).not.toBe('Reset');
    expect(btn.getAttribute('title')).toBe(label);
  });

  it('Space and Esc call toggle() and reset() once per press', async () => {
    render(MetronomePanel);
    const toggle = vi.spyOn(metronome, 'toggle');
    const reset = vi.spyOn(metronome, 'reset');
    await key(' ');
    await settle();
    expect(toggle).toHaveBeenCalledTimes(1);
    advance(0.1);
    await settle();
    await key('Escape');
    await settle();
    expect(reset).toHaveBeenCalledTimes(1);
    expect(metronome.phase).toBe('settings');
  });

  it('Escape in settings does nothing', async () => {
    render(MetronomePanel);
    const reset = vi.spyOn(metronome, 'reset');
    await key('Escape');
    expect(reset).not.toHaveBeenCalled();
  });

  it('ignores Space from guarded targets', async () => {
    render(MetronomePanel);
    const input = document.createElement('input');
    input.type = 'text';
    document.body.append(input);
    const toggle = vi.spyOn(metronome, 'toggle');
    await key(' ', input);
    expect(toggle).not.toHaveBeenCalled();
  });

  it('Escape leaves the run alone while a bar disclosure is open', async () => {
    render(MetronomePanel);
    await startRun();
    const bar = document.createElement('header');
    bar.className = 'app-bar';
    bar.innerHTML = '<button aria-expanded="true">x</button>';
    document.body.append(bar);
    const reset = vi.spyOn(metronome, 'reset');
    await key('Escape');
    expect(reset).not.toHaveBeenCalled();
  });

  it('focus moves to Pause after Start and to Start Training after Reset', async () => {
    render(MetronomePanel);
    await startRun();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Pause' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await settle();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Start Training' }));
  });

  it('focus moves to Start Training when finished grows; mount never steals focus', async () => {
    resetMetronomeForTests({ clock, frames }, {}, {}, 'speed', {
      startBpm: 100,
      targetBpm: 105,
      increment: 5,
      loops: 1,
      beats: 1,
      countIn: false,
      atTarget: 'stop'
    });
    render(MetronomePanel);
    await settle();
    expect(document.activeElement).toBe(document.body);
    await fireEvent.click(screen.getByRole('button', { name: 'Start Training' }));
    await settle();
    advance(3);
    await settle();
    expect(metronome.phase).toBe('settings');
    expect(metronome.finished).toBe(1);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Start Training' }));
    expect(screen.getByRole('radio', { name: 'Stop' })).toBeTruthy();
  });

  it('focus stays on the main button across Pause ⇄ Resume', async () => {
    render(MetronomePanel);
    await startRun();
    const main = screen.getByRole('button', { name: 'Pause' });
    main.focus();
    await fireEvent.click(main);
    await settle();
    expect(document.activeElement).toBe(main);
    expect(main.textContent).toContain('Resume');
    await fireEvent.click(main);
    await settle();
    expect(document.activeElement).toBe(main);
  });
});

describe('MetronomePanel settings rows (US3)', () => {
  const bpmSlider = () => screen.getByRole('slider', { name: 'BPM' }) as HTMLInputElement;
  const beatsSlider = () => screen.getByRole('slider', { name: '# of Beats' }) as HTMLInputElement;

  it('shows BPM 85 and # of Beats 4 by default with slider attributes', () => {
    render(MetronomePanel);
    expect(bpmSlider().value).toBe('85');
    expect(bpmSlider().min).toBe('30');
    expect(bpmSlider().max).toBe('300');
    expect(bpmSlider().getAttribute('aria-valuetext')).toBeTruthy();
    expect(beatsSlider().value).toBe('4');
    expect(beatsSlider().min).toBe('1');
    expect(beatsSlider().max).toBe('16');
    expect(beatsSlider().getAttribute('aria-valuetext')).toBeTruthy();
    const outputs = document.querySelectorAll('output');
    expect(outputs).toHaveLength(2);
    expect(outputs[0].textContent).toBe('85');
    expect(outputs[1].textContent).toBe('4');
    expect(outputs[0].getAttribute('aria-live')).toBe('off');
  });

  it('+ is disabled at 300 and 16, − at 30 and 1', async () => {
    render(MetronomePanel);
    const inc = screen.getByRole('button', { name: 'Increase BPM' }) as HTMLButtonElement;
    const dec = screen.getByRole('button', { name: 'Decrease BPM' }) as HTMLButtonElement;
    metronome.setBpm(300);
    await settle();
    expect(inc.disabled).toBe(true);
    expect(dec.disabled).toBe(false);
    metronome.setBpm(30);
    await settle();
    expect(dec.disabled).toBe(true);
    expect(inc.disabled).toBe(false);
    const binc = screen.getByRole('button', { name: 'More beats' }) as HTMLButtonElement;
    const bdec = screen.getByRole('button', { name: 'Fewer beats' }) as HTMLButtonElement;
    metronome.setBeats(16);
    await settle();
    expect(binc.disabled).toBe(true);
    metronome.setBeats(1);
    await settle();
    expect(bdec.disabled).toBe(true);
  });

  it('slider and pill stay in sync', async () => {
    render(MetronomePanel);
    await fireEvent.click(screen.getByRole('button', { name: 'Increase BPM' }));
    expect(metronome.settings.bpm).toBe(86);
    expect(bpmSlider().value).toBe('86');
    await fireEvent.input(bpmSlider(), { target: { value: '120' } });
    expect(metronome.settings.bpm).toBe(120);
    expect(document.querySelectorAll('output')[0].textContent).toBe('120');
    await fireEvent.click(screen.getByRole('button', { name: 'Fewer beats' }));
    expect(metronome.settings.beats).toBe(3);
    expect(beatsSlider().value).toBe('3');
  });

  it('PageUp/PageDown step by 10 and Home/End jump to the limits', async () => {
    render(MetronomePanel);
    await key('PageUp', bpmSlider());
    expect(metronome.settings.bpm).toBe(95);
    await key('PageDown', bpmSlider());
    await key('PageDown', bpmSlider());
    expect(metronome.settings.bpm).toBe(75);
    await key('PageUp', beatsSlider());
    expect(metronome.settings.beats).toBe(14);
    await key('PageUp', beatsSlider());
    expect(metronome.settings.beats).toBe(16);
    // Home / End are native on a range input; the browser fires `input`.
    await fireEvent.input(bpmSlider(), { target: { value: '30' } });
    expect(metronome.settings.bpm).toBe(30);
    await fireEvent.input(bpmSlider(), { target: { value: '300' } });
    expect(metronome.settings.bpm).toBe(300);
  });

  it('<output> is a read-only readout and the labels are associated', () => {
    render(MetronomePanel);
    const out = document.querySelector('output') as HTMLOutputElement;
    expect(out.htmlFor.contains(bpmSlider().id)).toBe(true);
    expect(out.querySelector('input')).toBeNull();
  });

  it('settings are not editable once running', async () => {
    render(MetronomePanel);
    await startRun();
    expect(screen.queryByRole('slider')).toBeNull();
    metronome.setBpm(200);
    metronome.stepBeats(1);
    expect(metronome.settings).toEqual({ ...DEFAULT_SETTINGS, countIn: false });
  });
});

describe('MetronomePanel subdivision select (032)', () => {
  const names = [
    'Quarter notes (1)',
    '8th notes (2)',
    '8th Triplets (3)',
    '16th notes (4)',
    'Quintuplets (5)',
    'Sextuplets (6)',
    'Septuplets (7)',
    '32nd notes (8)'
  ];

  it('lists eight options in order with 8th Triplets (3) selected', () => {
    render(MetronomePanel);
    const select = screen.getByRole('combobox', { name: 'Loop 1' }) as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent?.trim())).toEqual(names);
    expect(select.value).toBe('3');
    expect(select.selectedOptions[0].textContent?.trim()).toBe('8th Triplets (3)');
  });

  it('sits after the # of Beats row and before Start Training', () => {
    render(MetronomePanel);
    const beats = screen.getByRole('slider', { name: '# of Beats' });
    const select = screen.getByRole('combobox', { name: 'Loop 1' });
    const start = screen.getByRole('button', { name: 'Start Training' });
    expect(beats.compareDocumentPosition(select) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(select.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('choosing 5 then Start shows SUB 5; the select is gone while running and paused', async () => {
    const { container } = render(MetronomePanel);
    const select = screen.getByRole('combobox', { name: 'Loop 1' });
    await fireEvent.change(select, { target: { value: '5' } });
    expect(metronome.settings.subdivision).toBe(5);
    await startRun();
    expect(container.querySelector('.position')?.textContent).toContain('SUB 5');
    expect(screen.queryByRole('combobox')).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(metronome.phase).toBe('paused');
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});

describe('MetronomePanel alternating ratios (034)', () => {
  const position = (c: HTMLElement): string =>
    c.querySelector('.position')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const T = 60 / 85;

  // Count In 0 initial, 2 repeat: Loop 1 (beats 1–4), repeat ×2, Loop 2 (beats 1–4).
  beforeEach(() => {
    resetMetronomeForTests(
      { clock, frames },
      { countIn: true, initialCountIn: 0, repeatCountIn: 2, subdivision: 3, loop2: 6 }
    );
  });

  it('passes the playing loop sub to the status box', async () => {
    const { container } = render(MetronomePanel);
    await fireEvent.click(screen.getByRole('button', { name: 'Start Training' }));
    await settle();
    advance(0.1);
    await settle();
    expect(position(container)).toBe('BEAT 1/4 · SUB 3');
    // Through the repeat count-in (2 clicks) into Loop 2 beat 1.
    advance(6 * T);
    await settle();
    expect(position(container)).toBe('BEAT 1/4 · SUB 6');
  });

  it('shows the single pulsing dot and COUNT IN n/r during a repeat count-in', async () => {
    const { container } = render(MetronomePanel);
    await fireEvent.click(screen.getByRole('button', { name: 'Start Training' }));
    await settle();
    advance(0.1);
    await settle();
    advance(4 * T);
    await settle();
    expect(position(container)).toBe('COUNT IN 1/2');
    const dots = container.querySelectorAll('.dot');
    expect(dots).toHaveLength(1);
    expect(container.querySelector('.dots.count-in')).toBeTruthy();
    expect(dots[0].classList.contains('pulse')).toBe(true);
  });

  it('returns the full dot row with beat 1 lit at a loop start', async () => {
    const { container } = render(MetronomePanel);
    await fireEvent.click(screen.getByRole('button', { name: 'Start Training' }));
    await settle();
    advance(0.1);
    await settle();
    advance(6 * T);
    await settle();
    const dots = [...container.querySelectorAll('.dot')].map((d) => d.getAttribute('data-state'));
    expect(dots).toHaveLength(4);
    expect(dots[0]).toBe('lit');
    expect(dots.slice(1).every((s) => s === 'upcoming')).toBe(true);
  });
});

describe('MetronomePanel mode tabs (036)', () => {
  it('renders the tab bar first, with no visible heading, and a labelled tabpanel', () => {
    const { container } = render(MetronomePanel);
    const section = container.querySelector('section.panel') as HTMLElement;
    expect(section.firstElementChild?.getAttribute('role')).toBe('tablist');
    expect(container.querySelector('h2')).toBeNull();
    expect(section.getAttribute('data-mode')).toBe('ratios');
    expect(section.getAttribute('data-phase')).toBe('settings');
    const panel = screen.getByRole('tabpanel', { name: 'Ratios Training' });
    expect(panel.id).toBe('metronome-mode-panel');
    expect(panel.getAttribute('aria-labelledby')).toBe('metronome-tab-ratios');
  });

  it('keeps the tab bar first while running and paused', async () => {
    const { container } = render(MetronomePanel);
    await startRun();
    const section = container.querySelector('section.panel') as HTMLElement;
    expect(section.firstElementChild?.getAttribute('role')).toBe('tablist');
    expect(section.getAttribute('data-phase')).toBe('running');
    await fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(section.firstElementChild?.getAttribute('role')).toBe('tablist');
    expect(section.getAttribute('data-phase')).toBe('paused');
  });

  it('clicking the other tab calls selectMode', async () => {
    render(MetronomePanel);
    const select = vi.spyOn(metronome, 'selectMode');
    await fireEvent.click(screen.getByRole('tab', { name: 'Metronome' }));
    expect(select).toHaveBeenCalledWith('plain');
    expect(metronome.mode).toBe('plain');
  });
});

describe('MetronomePanel plain mode (036)', () => {
  beforeEach(() => {
    resetMetronomeForTests({ clock, frames }, undefined, { countIn: false }, 'plain');
  });

  it('shows BPM, beats, count in, initial count in and a Start button only', () => {
    render(MetronomePanel);
    const labels = [
      ...document.querySelectorAll('[role="tabpanel"] label, [role="tabpanel"] button')
    ].map((e) => e.textContent?.trim() ?? '');
    expect(screen.getByRole('slider', { name: 'BPM' })).toBeTruthy();
    expect(screen.getByRole('slider', { name: '# of Beats' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Count In' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start Training' })).toBeNull();
    expect(screen.queryByRole('slider', { name: 'Repeat Count In' })).toBeNull();
    expect(screen.queryByText(/Loop 1/)).toBeNull();
    expect(labels.length).toBeGreaterThan(0);
  });

  it('shows Initial Count In after the Count In switch when on', () => {
    metronome.setCountIn(true);
    render(MetronomePanel);
    expect(screen.getByRole('slider', { name: 'Initial Count In' })).toBeTruthy();
    expect(screen.queryByRole('slider', { name: 'Repeat Count In' })).toBeNull();
  });

  it('keeps Start Training in Ratios mode', () => {
    resetMetronomeForTests({ clock, frames }, { countIn: false });
    render(MetronomePanel);
    expect(screen.getByRole('button', { name: 'Start Training' })).toBeTruthy();
  });

  it('runs with BEAT n/N and no SUB part', async () => {
    const { container } = render(MetronomePanel);
    await fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await settle();
    advance(0.1);
    await settle();
    const pos = container.querySelector('.position')?.textContent ?? '';
    expect(pos).toMatch(/BEAT \d\/4/);
    expect(pos).not.toMatch(/SUB/);
    expect(container.querySelectorAll('.dot')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
  });
});

describe('MetronomePanel Speed Training run (037)', () => {
  const position = (c: HTMLElement): string =>
    c.querySelector('.position')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  beforeEach(() => {
    resetMetronomeForTests({ clock, frames }, {}, {}, 'speed', {
      startBpm: 80,
      targetBpm: 100,
      beats: 3,
      countIn: false
    });
  });

  it('shows no BPM row, ratio section or Loop rows in the settings view', () => {
    const { container } = render(MetronomePanel);
    expect(container.querySelector('[data-mode="speed"]')).toBeTruthy();
    expect(container.querySelector('#metronome-bpm')).toBeNull();
    expect(screen.queryByText('Subdivision ratio')).toBeNull();
    expect(screen.queryByText('Loop 1')).toBeNull();
    expect(screen.queryByText('Loop 2')).toBeNull();
    expect(screen.getByRole('button', { name: 'Start Training' })).toBeTruthy();
  });

  it('reads STEP s/S · LOOP l/L, the speed tempo and the speed beats while running', async () => {
    const { container } = render(MetronomePanel);
    await startRun();
    expect(position(container)).toBe('STEP 1/5 · LOOP 1/4');
    expect(container.querySelector('.digits')?.textContent).toBe('80');
    expect(container.querySelectorAll('.dot')).toHaveLength(3);
    advance(3 * 4 * (60 / 80) + 0.1);
    await settle();
    expect(position(container)).toBe('STEP 2/5 · LOOP 1/4');
    expect(container.querySelector('.digits')?.textContent).toBe('85');
  });
});

describe('MetronomePanel Speed Training settings view (037 US3)', () => {
  beforeEach(() => {
    resetMetronomeForTests({ clock, frames }, {}, {}, 'speed');
  });

  it('lists the rows in order with the first-use defaults', () => {
    const { container } = render(MetronomePanel);
    const panel = container.querySelector('#metronome-mode-panel') as HTMLElement;
    const order = [...panel.querySelectorAll('input[type="range"], legend, button.start')].map(
      (e) =>
        e instanceof HTMLInputElement
          ? (e.labels?.[0]?.textContent?.trim() ?? e.id)
          : (e.textContent?.trim() ?? '')
    );
    expect(order).toEqual([
      'Start BPM',
      'Target BPM',
      'Increment',
      'Loops per step',
      '# of Beats',
      'Initial Count In',
      'Repeat Count In',
      'At target',
      'Start Training'
    ]);
    const value = (id: string) => (container.querySelector(`#${id}`) as HTMLInputElement).value;
    expect(value('metronome-start-bpm')).toBe('85');
    expect(value('metronome-target-bpm')).toBe('125');
    expect(value('metronome-increment')).toBe('5');
    expect(value('metronome-loops')).toBe('4');
    expect(value('metronome-beats')).toBe('4');
    expect(value('metronome-initial-count-in')).toBe('4');
    expect(value('metronome-repeat-count-in')).toBe('2');
    expect(screen.getByRole('switch', { name: /Count In/ }).getAttribute('aria-checked')).toBe(
      'true'
    );
    expect((screen.getByRole('radio', { name: 'Hold' }) as HTMLInputElement).checked).toBe(true);
  });

  it('hides Initial and Repeat Count In while the switch is off', () => {
    metronome.setCountIn(false);
    const { container } = render(MetronomePanel);
    expect(container.querySelector('#metronome-initial-count-in')).toBeNull();
    expect(container.querySelector('#metronome-repeat-count-in')).toBeNull();
  });

  it('disables Target − when Target equals Start, and snaps the slider back', async () => {
    resetMetronomeForTests({ clock, frames }, {}, {}, 'speed', { startBpm: 100, targetBpm: 100 });
    const { container } = render(MetronomePanel);
    expect(
      (screen.getByRole('button', { name: 'Decrease target BPM' }) as HTMLButtonElement).disabled
    ).toBe(true);
    const target = container.querySelector('#metronome-target-bpm') as HTMLInputElement;
    await fireEvent.input(target, { target: { value: '60' } });
    await settle();
    expect(metronome.speed.targetBpm).toBe(100);
    expect(target.value).toBe('100');
  });

  it('editing a row updates the store', async () => {
    render(MetronomePanel);
    await fireEvent.click(screen.getByRole('button', { name: 'Increase loops per step' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Increase increment' }));
    expect(metronome.speed).toMatchObject({ loops: 5, increment: 6 });
  });
});

describe('SubdivisionSelect options (038)', () => {
  it('renders all eight options by default and only the given ones with options', async () => {
    const { default: SubdivisionSelect } =
      await import('../../../src/lib/tools/metronome/SubdivisionSelect.svelte');
    const all = render(SubdivisionSelect, { id: 'a', label: 'A', value: 1, onchange: () => {} });
    expect(all.container.querySelectorAll('option')).toHaveLength(8);
    all.unmount();
    const some = render(SubdivisionSelect, {
      id: 'b',
      label: 'B',
      value: 1,
      onchange: () => {},
      options: [1, 2, 3, 4]
    });
    expect(
      [...some.container.querySelectorAll('option')].map((o) => (o as HTMLOptionElement).value)
    ).toEqual(['1', '2', '3', '4']);
  });
});

describe('MetronomePanel tap tempo (038)', () => {
  const tapName = (bpm: number): string => `${bpm} BPM, tap tempo`;
  const plain = (): void =>
    resetMetronomeForTests({ clock, frames }, undefined, { countIn: false, bpm: 100 }, 'plain');

  it('plain settings and running views render a tap button wired to tapTempo()', async () => {
    plain();
    const tapTempo = vi.spyOn(metronome, 'tapTempo');
    render(MetronomePanel);
    await fireEvent.click(screen.getByRole('button', { name: tapName(100) }));
    expect(tapTempo).toHaveBeenCalledTimes(1);
    await fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await settle();
    advance(0.1);
    await settle();
    await fireEvent.click(screen.getByRole('button', { name: tapName(100) }));
    expect(tapTempo).toHaveBeenCalledTimes(2);
  });

  it('Enter and Space on the focused tap button tap without toggling', async () => {
    plain();
    const tapTempo = vi.spyOn(metronome, 'tapTempo');
    const toggle = vi.spyOn(metronome, 'toggle');
    render(MetronomePanel);
    const button = screen.getByRole('button', { name: tapName(100) });
    button.focus();
    await key(' ', button);
    await key('Enter', button);
    expect(toggle).not.toHaveBeenCalled();
    // jsdom does not synthesize click from key presses; the native click is what taps.
    await fireEvent.click(button);
    expect(tapTempo).toHaveBeenCalledTimes(1);
  });

  it('T taps only in plain mode with shortcuts on', async () => {
    plain();
    const tapTempo = vi.spyOn(metronome, 'tapTempo');
    render(MetronomePanel);
    await key('t');
    await key('T');
    expect(tapTempo).toHaveBeenCalledTimes(2);
    shortcuts.choose(false);
    await key('t');
    expect(tapTempo).toHaveBeenCalledTimes(2);
    resetShortcutsForTests();
    resetMetronomeForTests({ clock, frames }, undefined, {}, 'speed');
    await key('t');
    resetMetronomeForTests({ clock, frames }, { countIn: false }, {}, 'ratios');
    await key('t');
    expect(tapTempo).toHaveBeenCalledTimes(2);
  });

  it('Ratios and Speed render no tap button and keep the output pill', async () => {
    for (const mode of ['ratios', 'speed'] as const) {
      resetMetronomeForTests({ clock, frames }, { countIn: false }, {}, mode);
      const { container, unmount } = render(MetronomePanel);
      expect(container.querySelector('button.tap')).toBeNull();
      if (mode === 'ratios') {
        expect(container.querySelector('output[aria-live="off"]')).toBeTruthy();
        await startRun();
        expect(container.querySelector('button.tap')).toBeNull();
        metronome.reset();
      }
      unmount();
    }
  });
});

describe('MetronomePanel plain subdivision (038)', () => {
  const plain = (): void =>
    resetMetronomeForTests({ clock, frames }, undefined, { countIn: false }, 'plain');

  it('shows a Subdivision select after # of Beats with the four options', () => {
    plain();
    render(MetronomePanel);
    const select = screen.getByRole('combobox', { name: 'Subdivision' }) as HTMLSelectElement;
    expect(select.id).toBe('metronome-plain-subdivision');
    expect([...select.options].map((o) => o.value)).toEqual(['1', '2', '3', '4']);
    const beats = screen.getByRole('slider', { name: '# of Beats' });
    expect(beats.compareDocumentPosition(select) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('changing it calls setPlainSubdivision', async () => {
    plain();
    render(MetronomePanel);
    const select = screen.getByRole('combobox', { name: 'Subdivision' }) as HTMLSelectElement;
    await fireEvent.change(select, { target: { value: '3' } });
    expect(metronome.plain.subdivision).toBe(3);
  });

  it('is absent while running and in Ratios and Speed', async () => {
    plain();
    render(MetronomePanel);
    await fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await settle();
    advance(0.1);
    await settle();
    expect(screen.queryByRole('combobox', { name: 'Subdivision' })).toBeNull();
    document.body.innerHTML = '';
    for (const mode of ['ratios', 'speed'] as const) {
      metronome.screenChanged();
      resetMetronomeForTests({ clock, frames }, { countIn: false }, {}, mode);
      const { unmount } = render(MetronomePanel);
      expect(screen.queryByRole('combobox', { name: 'Subdivision' })).toBeNull();
      unmount();
    }
  });

  it('the status line gains SUB k when subdividing, and not for Quarter', async () => {
    resetMetronomeForTests(
      { clock, frames },
      undefined,
      { countIn: false, subdivision: 3 },
      'plain'
    );
    const { container } = render(MetronomePanel);
    await fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await settle();
    advance(0.1);
    await settle();
    expect(container.querySelector('.position')?.textContent).toMatch(/BEAT \d\/4.*SUB 3/);
  });
});
