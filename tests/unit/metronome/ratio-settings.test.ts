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

const sw = () => screen.getByRole('switch', { name: 'Subdivision ratio' });
const loop1 = () => screen.getByRole('combobox', { name: 'Loop 1' }) as HTMLSelectElement;
const loop2 = () => screen.getByRole('combobox', { name: 'Loop 2' }) as HTMLSelectElement;
const optionLabels = (s: HTMLSelectElement) => Array.from(s.options).map((o) => o.textContent);

describe('Subdivision ratio settings', () => {
  it('shows an h3 heading and the switch on', () => {
    render(MetronomePanel);
    expect(screen.getByRole('heading', { level: 3, name: 'Subdivision ratio' })).toBeTruthy();
    expect(sw().getAttribute('aria-checked')).toBe('true');
    expect(metronome.settings.ratio).toBe(true);
  });

  it('lists the same eight options for Loop 2 as Loop 1; Loop 2 defaults to Sextuplets', () => {
    render(MetronomePanel);
    expect(optionLabels(loop2())).toHaveLength(8);
    expect(optionLabels(loop2())).toEqual(optionLabels(loop1()));
    expect(loop2().selectedOptions[0]?.textContent).toBe('Sextuplets (6)');
  });

  it('toggles on click, Enter and Space', async () => {
    render(MetronomePanel);
    await fireEvent.click(sw());
    expect(sw().getAttribute('aria-checked')).toBe('false');
    expect(metronome.settings.ratio).toBe(false);
    await fireEvent.click(sw());
    expect(sw().getAttribute('aria-checked')).toBe('true');
    // A native button turns Enter and Space into a click; the panel must not start training.
    await fireEvent.keyDown(sw(), { key: ' ' });
    await fireEvent.keyDown(sw(), { key: 'Enter' });
    expect(metronome.phase).toBe('settings');
  });

  it('removes Loop 2 when off, keeps Loop 1, and restores the kept Loop 2 value', async () => {
    render(MetronomePanel);
    await fireEvent.change(loop2(), { target: { value: '4' } });
    const kept = metronome.settings.loop2;
    await fireEvent.click(sw());
    expect(screen.queryByRole('combobox', { name: 'Loop 2' })).toBeNull();
    expect(loop1()).toBeTruthy();
    await fireEvent.click(sw());
    expect(metronome.settings.loop2).toBe(kept);
    expect(loop2().value).toBe(String(kept));
  });

  it('changes Loop 1 and Loop 2 independently', async () => {
    render(MetronomePanel);
    await fireEvent.change(loop1(), { target: { value: '2' } });
    await fireEvent.change(loop2(), { target: { value: '8' } });
    expect(metronome.settings.subdivision).toBe(2);
    expect(metronome.settings.loop2).toBe(8);
  });

  it('renders nothing of the section outside the settings phase', async () => {
    render(MetronomePanel);
    metronome.toggle();
    await vi.waitFor(() => expect(metronome.phase).not.toBe('settings'));
    expect(screen.queryByRole('switch', { name: 'Subdivision ratio' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});
