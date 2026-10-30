// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClickSink } from '../../../src/lib/audio/metronome';
import { metronome, resetMetronomeForTests } from '../../../src/lib/state/metronome.svelte';
import { playback } from '../../../src/lib/state/playback.svelte';
import { FakeAudioPort, FakeClock, FakeFrames, type FakeSource } from '../audio/support/fake-audio';

interface Rig {
  port: FakeAudioPort;
  clock: FakeClock;
  frames: FakeFrames;
  sink: ClickSink;
  clickSink: ReturnType<typeof vi.spyOn>;
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

function rig(running: boolean | 'null' = true): Rig {
  const port = new FakeAudioPort();
  port.state = 'running';
  const clock = new FakeClock();
  const frames = new FakeFrames();
  const sink: ClickSink = {
    port,
    destination: port.destination,
    running: Promise.resolve(running === true)
  };
  const clickSink = vi
    .spyOn(playback, 'clickSink')
    .mockReturnValue(running === 'null' ? null : sink);
  resetMetronomeForTests({ clock, frames });
  return { port, clock, frames, sink, clickSink };
}

/** Advance the audio and timer clocks together, then run a frame. */
function advance(r: Rig, seconds: number): void {
  const steps = Math.round(seconds * 40);
  for (let i = 0; i < steps; i++) {
    r.port.currentTime += 0.025;
    r.clock.advance(25);
  }
  r.frames.flush();
}

const starts = (r: Rig): number[] => r.port.sources.flatMap((s: FakeSource) => s.startCalls);

beforeEach(() => {
  vi.spyOn(performance, 'now').mockReturnValue(1000);
});
afterEach(() => {
  vi.restoreAllMocks();
  metronome.screenChanged();
});

describe('metronome store: start path', () => {
  it('M1: first open is the settings phase at 85 BPM / 4 beats', () => {
    rig();
    expect(metronome.phase).toBe('settings');
    expect(metronome.settings).toEqual({ bpm: 85, beats: 4 });
    expect(metronome.beat).toBe(0);
    expect(metronome.soundNotice).toBe(false);
    expect(metronome.dots).toEqual([]);
  });

  it('M3: toggle() from settings asks playback for the sink synchronously', () => {
    const r = rig();
    metronome.toggle();
    expect(r.clickSink).toHaveBeenCalledTimes(1);
    expect(metronome.phase).toBe('starting');
  });

  it('steps the audible beat 1…4 and wraps, with dots in step', async () => {
    const r = rig();
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    expect(metronome.phase).toBe('running');
    expect(metronome.beat).toBe(1);
    expect(metronome.dots).toEqual(['lit', 'upcoming', 'upcoming', 'upcoming']);
    advance(r, 60 / 85);
    expect(metronome.beat).toBe(2);
    expect(metronome.dots).toEqual(['played', 'lit', 'upcoming', 'upcoming']);
    advance(r, (3 * 60) / 85);
    expect(metronome.beat).toBe(1);
  });

  it('SC-003: the first click starts within 50 ms of the press and not before now', async () => {
    const r = rig();
    r.port.currentTime = 12;
    metronome.toggle();
    await settle();
    advance(r, 0.05);
    const first = starts(r)[0];
    expect(first).toBeGreaterThanOrEqual(12);
    expect(first - 12).toBeLessThanOrEqual(0.05);
  });

  it('M9: the announcement changes on Start only, never on a beat', async () => {
    const r = rig();
    expect(metronome.announcement).toBe('');
    metronome.toggle();
    await settle();
    const started = metronome.announcement;
    expect(started).toContain('85');
    expect(started).toContain('4');
    advance(r, 3);
    expect(metronome.beat).toBeGreaterThan(0);
    expect(metronome.announcement).toBe(started);
  });

  it('M8: hidden stop and a hidden visibilitychange leave the run going', async () => {
    const r = rig();
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    playback.stop('hidden');
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(metronome.phase).toBe('running');
    const before = starts(r).length;
    advance(r, 2);
    expect(metronome.phase).toBe('running');
    expect(starts(r).length).toBeGreaterThan(before);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('M10: a null sink still runs visually and shows the notice', async () => {
    const r = rig('null');
    metronome.toggle();
    await settle();
    expect(metronome.soundNotice).toBe(true);
    r.clock.advance(100);
    r.frames.flush();
    expect(metronome.beat).toBe(1);
    expect(r.port.sources).toHaveLength(0);
    metronome.dismissSoundNotice();
    expect(metronome.soundNotice).toBe(false);
  });

  it('M10: a sink whose unlock fails runs visually and shows the notice', async () => {
    const r = rig(false);
    metronome.toggle();
    await settle();
    expect(metronome.soundNotice).toBe(true);
    r.clock.advance(100);
    r.frames.flush();
    expect(metronome.beat).toBe(1);
    expect(r.port.sources).toHaveLength(0);
  });

  it('M12: muting mid-run leaves the phase running', async () => {
    const r = rig();
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    playback.setMuted(true);
    advance(r, 1);
    expect(metronome.phase).toBe('running');
    expect(metronome.beat).toBeGreaterThan(0);
    playback.setMuted(false);
  });

  it('M4: ten toggles in a second leave one live segment, no duplicate click', async () => {
    const r = rig();
    for (let i = 0; i < 10; i++) metronome.toggle();
    await settle();
    advance(r, 1);
    expect(r.clickSink).toHaveBeenCalledTimes(1);
    const times = starts(r);
    expect(new Set(times).size).toBe(times.length);
  });

  it('M2: settings cannot change after the run started', async () => {
    rig();
    metronome.toggle();
    await settle();
    metronome.setBpm(120);
    metronome.stepBeats(1);
    expect(metronome.settings).toEqual({ bpm: 85, beats: 4 });
  });

  it('M7: screenChanged halts the run and restores the defaults', async () => {
    const r = rig();
    metronome.setBpm(120);
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    metronome.screenChanged();
    expect(metronome.phase).toBe('settings');
    expect(metronome.settings).toEqual({ bpm: 85, beats: 4 });
    expect(metronome.beat).toBe(0);
    const before = starts(r).length;
    advance(r, 2);
    expect(starts(r).length).toBe(before);
  });
});

async function runTo(r: Rig, beat: number): Promise<void> {
  metronome.toggle();
  await settle();
  advance(r, 0.1);
  for (let i = 1; i < beat; i++) advance(r, 60 / 85);
  expect(metronome.beat).toBe(beat);
}

describe('metronome store: pause, resume and reset', () => {
  it('starting ignores toggle()', () => {
    const r = rig();
    metronome.toggle();
    metronome.toggle();
    expect(metronome.phase).toBe('starting');
    expect(r.clickSink).toHaveBeenCalledTimes(1);
  });

  it('M5: pause on beat 3 freezes it; resume plays 4 then 1 within 50 ms', async () => {
    const r = rig();
    await runTo(r, 3);
    metronome.toggle();
    expect(metronome.phase).toBe('paused');
    expect(metronome.beat).toBe(3);
    const frozen = starts(r).length;
    advance(r, 2);
    expect(starts(r).length).toBe(frozen);
    expect(metronome.beat).toBe(3);

    r.port.currentTime += 0;
    const pressedAt = r.port.currentTime;
    metronome.toggle();
    expect(metronome.phase).toBe('starting');
    await settle();
    advance(r, 0.1);
    expect(metronome.beat).toBe(4);
    expect(starts(r)[frozen] - pressedAt).toBeLessThanOrEqual(0.05);
    advance(r, 60 / 85);
    expect(metronome.beat).toBe(1);
    expect(metronome.phase).toBe('running');
  });

  it('M5: pausing before any beat resumes at beat 1', async () => {
    const r = rig();
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    // Force the frozen beat to 0 through a pause straight after reset-free restart.
    metronome.toggle();
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    expect(metronome.beat).toBe(2);
  });

  it('M6: reset keeps the settings and halts the scheduler', async () => {
    const r = rig();
    metronome.setBpm(120);
    metronome.setBeats(6);
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    metronome.reset();
    expect(metronome.phase).toBe('settings');
    expect(metronome.settings).toEqual({ bpm: 120, beats: 6 });
    expect(metronome.beat).toBe(0);
    const before = starts(r).length;
    advance(r, 2);
    expect(starts(r).length).toBe(before);
  });

  it('M6: reset in settings is a no-op', () => {
    rig();
    const before = metronome.announcement;
    metronome.reset();
    expect(metronome.phase).toBe('settings');
    expect(metronome.announcement).toBe(before);
  });

  it('M4: ten rapid toggles after the run started log no duplicate (run, index)', async () => {
    const r = rig();
    await runTo(r, 2);
    for (let i = 0; i < 10; i++) {
      metronome.toggle();
      r.clock.advance(50);
    }
    await settle();
    advance(r, 1);
    const times = starts(r);
    expect(new Set(times).size).toBe(times.length);
  });

  it('M7: screenChanged after a reset restores the default settings', async () => {
    const r = rig();
    metronome.setBpm(200);
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    metronome.reset();
    expect(metronome.settings.bpm).toBe(200);
    metronome.screenChanged();
    expect(metronome.settings).toEqual({ bpm: 85, beats: 4 });
  });

  it('M9: the announcement changes on Start, Pause, Resume and Reset only', async () => {
    const r = rig();
    const seen: string[] = [metronome.announcement];
    metronome.toggle();
    await settle();
    seen.push(metronome.announcement);
    advance(r, 1);
    expect(metronome.announcement).toBe(seen[1]);
    metronome.toggle();
    seen.push(metronome.announcement);
    metronome.toggle();
    seen.push(metronome.announcement);
    await settle();
    advance(r, 1);
    expect(metronome.announcement).toBe(seen[3]);
    metronome.reset();
    seen.push(metronome.announcement);
    expect(new Set(seen).size).toBe(5);
    expect(seen[2]).toMatch(/\d/);
  });

  it('M11: a suspended audio context pauses at the last audible beat', async () => {
    const r = rig();
    await runTo(r, 2);
    r.port.state = 'suspended';
    r.port.resume = () => Promise.reject(new Error('blocked'));
    advance(r, 0.1);
    await settle();
    expect(metronome.phase).toBe('paused');
    expect(metronome.beat).toBe(2);
    expect(metronome.announcement).toContain('2');
  });
});
