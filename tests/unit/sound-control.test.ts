// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { playback, resetPlaybackForTests } from '../../src/lib/state/playback.svelte';
import { FakeAudioPort, FakeClock } from './audio/support/fake-audio';
import SoundControl from '../../src/lib/shell/SoundControl.svelte';

const muteButton = (): HTMLElement => screen.getByRole('button', { name: /^(Mute sound)$/ });
const settingsButton = (): HTMLElement => screen.getByRole('button', { name: 'Sound settings' });

const working = () => ({
  createContext: () => new FakeAudioPort(),
  loadSynth: () =>
    Promise.resolve({
      renderVoice: () => new Float32Array(1),
      mixVoices: (v: readonly Float32Array[]) => v[0]
    }),
  clock: new FakeClock()
});

const openPanel = async (): Promise<void> => {
  await fireEvent.click(settingsButton());
};

beforeEach(() => {
  resetPlaybackForTests(working());
});

describe('SoundControl structure', () => {
  it('is a labeled group with mute and settings buttons', () => {
    render(SoundControl);
    const group = screen.getByRole('group', { name: 'Sound' });
    expect(within(group).getByRole('button', { name: 'Mute sound' })).toBeTruthy();
    expect(within(group).getByRole('button', { name: 'Sound settings' })).toBeTruthy();
  });

  it('has an always-present polite status slot for the notice', () => {
    const { container } = render(SoundControl);
    const slot = container.querySelector('.notice-slot');
    expect(slot?.getAttribute('role')).toBe('status');
    expect(slot?.getAttribute('aria-live')).toBe('polite');
  });
});

describe('mute button (S1)', () => {
  it('aria-pressed reflects muted and click toggles via playback.setMuted', async () => {
    const spy = vi.spyOn(playback, 'setMuted');
    render(SoundControl);
    expect(muteButton().getAttribute('aria-pressed')).toBe('false');
    await fireEvent.click(muteButton());
    expect(spy).toHaveBeenLastCalledWith(true);
    expect(playback.muted).toBe(true);
    expect(muteButton().getAttribute('aria-pressed')).toBe('true');
    await fireEvent.click(muteButton());
    expect(spy).toHaveBeenLastCalledWith(false);
    expect(muteButton().getAttribute('aria-pressed')).toBe('false');
    spy.mockRestore();
  });
});

describe('three distinct states (S5)', () => {
  const icon = (container: HTMLElement): string =>
    container.querySelector('button.mute svg')?.innerHTML ?? '';
  const status = (container: HTMLElement): string =>
    container.querySelector('.status')?.textContent?.trim() ?? '';

  it('renders distinct icon markup plus status text for on, muted, unavailable', async () => {
    const { container } = render(SoundControl);
    const on = icon(container);
    expect(status(container)).toBe('Sound on');

    await fireEvent.click(muteButton());
    const muted = icon(container);
    expect(status(container)).toBe('Sound muted');

    // unavailable: drive through a failing engine.
    resetPlaybackForTests({
      createContext: () => {
        throw new Error('no audio');
      }
    });
    playback.setMuted(false);
    await vi.waitFor(() => expect(playback.controlState).toBe('unavailable'));
    const unavailable = icon(container);
    expect(status(container)).toBe('Sound is not available');

    expect(new Set([on, muted, unavailable]).size).toBe(3);
  });
});

describe('settings panel (S3)', () => {
  it('toggles aria-expanded with aria-controls="sound-panel"', async () => {
    render(SoundControl);
    const btn = settingsButton();
    expect(btn.getAttribute('aria-controls')).toBe('sound-panel');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    await fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    await fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes on Escape and returns focus to the settings button', async () => {
    render(SoundControl);
    await fireEvent.click(settingsButton());
    const range = screen.getByRole('slider');
    range.focus();
    await fireEvent.keyDown(range, { key: 'Escape' });
    expect(settingsButton().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(settingsButton());
  });

  it('closes on pointerdown outside, without moving focus into a trap', async () => {
    render(SoundControl);
    await fireEvent.click(settingsButton());
    await fireEvent.pointerDown(document.body);
    expect(settingsButton().getAttribute('aria-expanded')).toBe('false');
  });

  it('stays open on pointerdown inside the control', async () => {
    render(SoundControl);
    await fireEvent.click(settingsButton());
    await fireEvent.pointerDown(screen.getByRole('slider'));
    expect(settingsButton().getAttribute('aria-expanded')).toBe('true');
  });

  it('has no focus trap or modal semantics', async () => {
    const { container } = render(SoundControl);
    await fireEvent.click(settingsButton());
    const panel = container.querySelector('#sound-panel');
    expect(panel?.getAttribute('role')).not.toBe('dialog');
    expect(panel?.getAttribute('aria-modal')).toBeNull();
  });
});

describe('volume range (S2)', () => {
  it('is min 0 max 100 step 5, default 80, labeled Volume, with value text', async () => {
    render(SoundControl);
    await openPanel();
    const range = screen.getByRole('slider', { name: 'Volume' }) as HTMLInputElement;
    expect(range.min).toBe('0');
    expect(range.max).toBe('100');
    expect(range.step).toBe('5');
    expect(range.value).toBe('80');
    expect(range.getAttribute('aria-valuetext')).toBe('80 %');
  });

  it('input event calls playback.setVolume and updates the value text', async () => {
    const spy = vi.spyOn(playback, 'setVolume');
    render(SoundControl);
    await openPanel();
    const range = screen.getByRole('slider', { name: 'Volume' }) as HTMLInputElement;
    await fireEvent.input(range, { target: { value: '40' } });
    expect(spy).toHaveBeenCalledWith(40);
    expect(playback.volume).toBe(40);
    expect(range.getAttribute('aria-valuetext')).toBe('40 %');
    spy.mockRestore();
  });
});

describe('help (S7)', () => {
  it('lists silent mode first', () => {
    const { container } = render(SoundControl);
    const items = container.querySelectorAll('#sound-panel li');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe('Check that silent mode is off and the system volume is up.');
    expect(screen.getByText('No sound?')).toBeTruthy();
  });
});

describe('unavailable (S4)', () => {
  it('mute is aria-disabled but focusable and ignores activation; range disabled', async () => {
    resetPlaybackForTests({
      createContext: () => {
        throw new Error('no audio');
      }
    });
    playback.setMuted(false);
    await vi.waitFor(() => expect(playback.controlState).toBe('unavailable'));
    render(SoundControl);
    await openPanel();
    const mute = screen.getByRole('button', { name: 'Sound unavailable' });
    expect(mute.getAttribute('aria-disabled')).toBe('true');
    expect(mute.hasAttribute('disabled')).toBe(false);
    mute.focus();
    expect(document.activeElement).toBe(mute);
    const before = playback.muted;
    await fireEvent.click(mute);
    expect(playback.muted).toBe(before);
    expect((screen.getByRole('slider') as HTMLInputElement).disabled).toBe(true);
  });
});

describe('unavailable notice (S8)', () => {
  const fail = async (): Promise<void> => {
    resetPlaybackForTests({
      createContext: () => {
        throw new Error('no audio');
      }
    });
    playback.setMuted(false);
    await vi.waitFor(() => expect(playback.noticeVisible).toBe(true));
  };

  it('renders the notice text inside the polite status container', async () => {
    await fail();
    const { container } = render(SoundControl);
    const slot = container.querySelector('.notice-slot') as HTMLElement;
    expect(slot.getAttribute('role')).toBe('status');
    expect(slot.getAttribute('aria-live')).toBe('polite');
    expect(within(slot).getByText('Sound is not available on this device right now')).toBeTruthy();
  });

  it('Dismiss calls playback.dismissNotice() and focuses the mute button', async () => {
    await fail();
    const spy = vi.spyOn(playback, 'dismissNotice');
    render(SoundControl);
    await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(playback.noticeVisible).toBe(false);
    expect(screen.queryByText('Sound is not available on this device right now')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Sound unavailable' }));
    spy.mockRestore();
  });

  it('keeps the slot present, empty, when there is nothing to say', () => {
    const { container } = render(SoundControl);
    const slot = container.querySelector('.notice-slot') as HTMLElement;
    expect(slot).toBeTruthy();
    expect(slot.children).toHaveLength(0);
  });
});
