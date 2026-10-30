// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClickSink } from '../../../src/lib/audio/metronome';
import { language, resetLanguageForTests } from '../../../src/lib/state/language.svelte';
import { metronome, resetMetronomeForTests } from '../../../src/lib/state/metronome.svelte';
import { playback } from '../../../src/lib/state/playback.svelte';
import MetronomePanel from '../../../src/lib/tools/metronome/MetronomePanel.svelte';
import { FakeAudioPort, FakeClock, FakeFrames } from '../audio/support/fake-audio';

beforeEach(() => {
  vi.spyOn(performance, 'now').mockReturnValue(1000);
  resetLanguageForTests();
  language.start('en');
  const port = new FakeAudioPort();
  port.state = 'running';
  const sink: ClickSink = { port, destination: port.destination, running: Promise.resolve(true) };
  vi.spyOn(playback, 'clickSink').mockReturnValue(sink);
  resetMetronomeForTests({ clock: new FakeClock(), frames: new FakeFrames() });
});

afterEach(() => {
  metronome.screenChanged();
  resetLanguageForTests();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const sw = () => screen.getByRole('switch', { name: 'Count In' });
const initial = () => screen.getByRole('slider', { name: 'Initial Count In' }) as HTMLInputElement;
const repeat = () => screen.getByRole('slider', { name: 'Repeat Count In' }) as HTMLInputElement;

describe('Count In settings', () => {
  it('shows the switch on with Initial 4 and Repeat 2', () => {
    render(MetronomePanel);
    expect(sw().getAttribute('aria-checked')).toBe('true');
    expect(initial().value).toBe('4');
    expect(initial().getAttribute('aria-valuetext')).toBe('4');
    expect(repeat().value).toBe('2');
    expect(repeat().getAttribute('aria-valuetext')).toBe('2');
  });

  it('keeps the accessible name "Count In" with an aria-hidden state word', () => {
    render(MetronomePanel);
    const state = sw().querySelector('.state');
    expect(state?.getAttribute('aria-hidden')).toBe('true');
    expect(state?.textContent?.trim()).toBe('On');
  });

  it('names the − and + buttons and disables them at the limits', async () => {
    render(MetronomePanel);
    const fewer = screen.getByRole('button', { name: 'Fewer initial count-in clicks' });
    const more = screen.getByRole('button', { name: 'More initial count-in clicks' });
    expect(screen.getByRole('button', { name: 'Fewer repeat count-in clicks' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'More repeat count-in clicks' })).toBeTruthy();
    await fireEvent.input(initial(), { target: { value: '0' } });
    expect((fewer as HTMLButtonElement).disabled).toBe(true);
    expect((more as HTMLButtonElement).disabled).toBe(false);
    await fireEvent.input(initial(), { target: { value: '8' } });
    expect((fewer as HTMLButtonElement).disabled).toBe(false);
    expect((more as HTMLButtonElement).disabled).toBe(true);
  });

  it('removes both rows when off and restores the kept values when on', async () => {
    render(MetronomePanel);
    await fireEvent.input(initial(), { target: { value: '6' } });
    await fireEvent.input(repeat(), { target: { value: '3' } });
    await fireEvent.click(sw());
    expect(sw().getAttribute('aria-checked')).toBe('false');
    expect(sw().querySelector('.state')?.textContent?.trim()).toBe('Off');
    expect(screen.queryByRole('slider', { name: 'Initial Count In' })).toBeNull();
    expect(screen.queryByRole('slider', { name: 'Repeat Count In' })).toBeNull();
    await fireEvent.click(sw());
    expect(initial().value).toBe('6');
    expect(repeat().value).toBe('3');
  });

  it('is not rendered once the run starts', async () => {
    render(MetronomePanel);
    await fireEvent.click(screen.getByRole('button', { name: 'Start Training' }));
    expect(screen.queryByRole('switch', { name: 'Count In' })).toBeNull();
    expect(screen.queryByRole('slider', { name: 'Initial Count In' })).toBeNull();
  });
});
