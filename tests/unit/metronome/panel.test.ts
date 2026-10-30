// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClickSink } from '../../../src/lib/audio/metronome';
import MetronomePanel from '../../../src/lib/tools/metronome/MetronomePanel.svelte';
import { language, resetLanguageForTests } from '../../../src/lib/state/language.svelte';
import { metronome, resetMetronomeForTests } from '../../../src/lib/state/metronome.svelte';
import { playback } from '../../../src/lib/state/playback.svelte';
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
  resetMetronomeForTests({ clock, frames });
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
    expect(metronome.settings).toEqual({ bpm: 85, beats: 4 });
  });
});
