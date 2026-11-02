// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AudioSink } from '../../../src/lib/audio/engine';
import { language, resetLanguageForTests } from '../../../src/lib/state/language.svelte';
import { preferences } from '../../../src/lib/state/preferences.svelte';
import { resetTimerForTests, timer } from '../../../src/lib/state/timer.svelte';
import TimerCard from '../../../src/lib/tools/metronome/TimerCard.svelte';
import { FakeClock } from '../audio/support/fake-audio';

const SINK = { port: {}, destination: {} } as unknown as AudioSink;
let clock: FakeClock;

beforeEach(() => {
  resetLanguageForTests();
  language.start('en');
  clock = new FakeClock();
  resetTimerForTests({ clock, sink: () => SINK, chime: vi.fn(() => true) });
});

afterEach(cleanup);

describe('TimerCard: play button, readout, state', () => {
  it('U3: the name and icon follow the status', async () => {
    const { container } = render(TimerCard);
    const play = screen.getByRole('button', { name: 'Start timer' });
    expect(play.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    const before = play.innerHTML;
    await fireEvent.click(play);
    await tick();
    expect(screen.getByRole('button', { name: 'Pause timer' }).innerHTML).not.toBe(before);
    expect(container.querySelector('.timer')?.getAttribute('data-status')).toBe('running');
    await fireEvent.click(screen.getByRole('button', { name: 'Pause timer' }));
    await tick();
    expect(screen.getByRole('button', { name: 'Start timer' })).toBeTruthy();
    expect(container.querySelector('.timer')?.getAttribute('data-status')).toBe('paused');
  });

  it('U4: the readout is a labelled timer, not a live region; the ghost is hidden', () => {
    const { container } = render(TimerCard);
    const readout = screen.getByRole('timer', { name: 'Time remaining' });
    expect(readout.textContent).toContain('02:00');
    expect(readout.hasAttribute('aria-live')).toBe(false);
    const ghost = container.querySelector('.ghost');
    expect(ghost?.getAttribute('aria-hidden')).toBe('true');
  });

  it('U5: the status region is polite and lives inside the card', () => {
    const { container } = render(TimerCard);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(container.querySelector('.timer')?.contains(status)).toBe(true);
    expect(container.querySelectorAll('[aria-live]').length).toBe(1);
  });

  it('U6: the region shows the store announcement', async () => {
    render(TimerCard);
    timer.selectPreset(1);
    await fireEvent.click(screen.getByRole('button', { name: 'Start timer' }));
    clock.advance(50_000 + 50);
    await tick();
    expect(screen.getByRole('status').textContent).toBe('10 seconds');
  });

  it('U12: data-flash appears only while flashing; finished state is reflected', async () => {
    const { container } = render(TimerCard);
    const root = container.querySelector('.timer') as HTMLElement;
    expect(root.hasAttribute('data-flash')).toBe(false);
    await fireEvent.click(screen.getByRole('button', { name: 'Start timer' }));
    clock.advance(120_000);
    await tick();
    expect(root.getAttribute('data-status')).toBe('finished');
    expect(root.hasAttribute('data-flash')).toBe(true);
    clock.advance(5000);
    await tick();
    expect(root.hasAttribute('data-flash')).toBe(false);
    expect(root.getAttribute('data-status')).toBe('finished');
  });
});

describe('TimerCard: presets', () => {
  it('U1: ten labelled pills in a named group, one pressed, click selects', async () => {
    vi.spyOn(preferences, 'remember').mockImplementation(() => {});
    render(TimerCard);
    const group = screen.getByRole('group', { name: 'Timer length' });
    const pills = within(group).getAllByRole('button');
    expect(pills.map((b) => b.textContent?.trim())).toEqual(
      Array.from({ length: 10 }, (_, i) => `${i + 1}m`)
    );
    expect(pills.filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
    expect(screen.getByRole('button', { name: '2m' }).getAttribute('aria-pressed')).toBe('true');
    await fireEvent.click(screen.getByRole('button', { name: '5m' }));
    await tick();
    expect(timer.preset).toBe(5);
    expect(screen.getByRole('button', { name: '5m' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '2m' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('timer').textContent).toContain('05:00');
  });

  it('U2/U8: the selected pill style and the target size use tokens', () => {
    const src = readFileSync('src/lib/tools/metronome/TimerCard.svelte', 'utf8');
    expect(src).toMatch(/aria-pressed='true'\][\s\S]*?--color-accent-secondary/);
    expect(src).toMatch(/aria-pressed='true'\][\s\S]*?--font-weight-bold/);
    expect(src).toMatch(/aria-pressed='true'\][\s\S]*?calc\(var\(--border-width\) \* 2\)/);
    expect(src).toMatch(/\.pill[\s\S]*?--target-min/);
    expect(src).toMatch(/var\(--color-border\)/);
  });
});
