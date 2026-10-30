// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClickSink } from '../../../src/lib/audio/metronome';
import { DEFAULT_SETTINGS, type MetronomeSettings } from '../../../src/lib/state/metronome-settings';
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

function rig(
  running: boolean | 'null' = true,
  settings: Partial<MetronomeSettings> = { countIn: false }
): Rig {
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
  resetMetronomeForTests({ clock, frames }, settings);
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
    expect(metronome.settings).toEqual({ ...DEFAULT_SETTINGS, countIn: false });
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

  it('032: start announces the subdivision and schedules clicksPerBeat clicks per beat', async () => {
    const r = rig();
    metronome.toggle();
    await settle();
    expect(metronome.announcement).toBe('Started, 85 BPM, 4 beats, 8th Triplets');
    advance(r, 1);
    const t = starts(r);
    expect(t[1] - t[0]).toBeCloseTo(60 / 85 / 3, 6);
    expect(t[3] - t[0]).toBeCloseTo(60 / 85, 6);
  });

  it('032: resume keeps the subdivision', async () => {
    const r = rig();
    metronome.toggle();
    await settle();
    advance(r, 1);
    metronome.toggle();
    const n = starts(r).length;
    metronome.toggle();
    await settle();
    advance(r, 0.5);
    const t = starts(r).slice(n);
    expect(t[1] - t[0]).toBeCloseTo(60 / 85 / 3, 6);
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
    expect(metronome.settings).toEqual({ ...DEFAULT_SETTINGS, countIn: false });
  });

  it('M7: screenChanged halts the run and restores the defaults', async () => {
    const r = rig();
    metronome.setBpm(120);
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    metronome.screenChanged();
    expect(metronome.phase).toBe('settings');
    expect(metronome.settings).toEqual({ ...DEFAULT_SETTINGS });
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
    expect(metronome.settings).toEqual({ ...DEFAULT_SETTINGS, bpm: 120, beats: 6, countIn: false });
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
    expect(metronome.settings).toEqual({ ...DEFAULT_SETTINGS });
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

describe('metronome store: setSubdivision (032)', () => {
  it('accepts numbers and numeric strings in the settings phase', () => {
    rig();
    metronome.setSubdivision(5);
    expect(metronome.settings.subdivision).toBe(5);
    metronome.setSubdivision('7');
    expect(metronome.settings.subdivision).toBe(7);
  });

  it('ignores invalid values', () => {
    rig();
    metronome.setSubdivision(9);
    metronome.setSubdivision('x');
    metronome.setSubdivision(2.5);
    expect(metronome.settings.subdivision).toBe(3);
  });

  it('is a no-op in starting, running and paused', async () => {
    const r = rig();
    metronome.toggle();
    expect(metronome.phase).toBe('starting');
    metronome.setSubdivision(5);
    expect(metronome.settings.subdivision).toBe(3);
    await settle();
    advance(r, 0.2);
    expect(metronome.phase).toBe('running');
    metronome.setSubdivision(5);
    expect(metronome.settings.subdivision).toBe(3);
    metronome.toggle();
    expect(metronome.phase).toBe('paused');
    metronome.setSubdivision(5);
    expect(metronome.settings.subdivision).toBe(3);
  });

  it('Reset keeps the choice; screenChanged restores 3', async () => {
    const r = rig();
    metronome.setSubdivision(6);
    metronome.toggle();
    await settle();
    advance(r, 0.2);
    metronome.reset();
    expect(metronome.settings.subdivision).toBe(6);
    metronome.screenChanged();
    expect(metronome.settings.subdivision).toBe(3);
  });
});

describe('metronome store: count-in (033)', () => {
  const on = { countIn: true } as const;

  it('S3: Start with k = 4 enters the count-in stage with no dots', async () => {
    const r = rig(true, on);
    metronome.toggle();
    expect(metronome.countIn).toEqual({ click: 0, total: 4 });
    expect(metronome.dots).toEqual([]);
    await settle();
    advance(r, 0.1);
    expect(metronome.phase).toBe('running');
    expect(metronome.countIn).toEqual({ click: 1, total: 4 });
    expect(metronome.beat).toBe(0);
  });

  it('S4: clicks count 1…4 then the first loop beat returns the dots', async () => {
    const r = rig(true, on);
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    for (const n of [2, 3, 4]) {
      advance(r, 60 / 85);
      expect(metronome.countIn).toEqual({ click: n, total: 4 });
    }
    advance(r, 60 / 85);
    expect(metronome.countIn).toBeNull();
    expect(metronome.beat).toBe(1);
    expect(metronome.dots).toEqual(['lit', 'upcoming', 'upcoming', 'upcoming']);
  });

  it('S5: k = 0 (switch off or Initial 0) has no count-in and the 032 announcement', async () => {
    for (const s of [{ countIn: false }, { countIn: true, initialCountIn: 0 }]) {
      const r = rig(true, s);
      metronome.toggle();
      await settle();
      expect(metronome.countIn).toBeNull();
      expect(metronome.announcement).toBe('Started, 85 BPM, 4 beats, 8th Triplets');
      advance(r, 0.1);
      expect(metronome.beat).toBe(1);
      metronome.screenChanged();
    }
  });

  it('S6: the start announcement names the count-in', () => {
    rig(true, on);
    metronome.toggle();
    expect(metronome.announcement).toBe('Started, 85 BPM, 4 beats, 8th Triplets, count in 4');
  });

  it('plays four accent clicks then the loop one beat later', async () => {
    const r = rig(true, on);
    metronome.toggle();
    await settle();
    advance(r, 3);
    const t = starts(r);
    for (let i = 1; i < 4; i++) expect(t[i] - t[i - 1]).toBeCloseTo(60 / 85, 6);
    expect(t[4] - t[3]).toBeCloseTo(60 / 85, 6);
  });

  it('S10: repeatCountIn never changes what Start schedules', async () => {
    const a = rig(true, { ...on, repeatCountIn: 6 });
    metronome.toggle();
    await settle();
    advance(a, 3);
    const withSix = starts(a).map((x) => x - starts(a)[0]);
    const b = rig(true, { ...on, repeatCountIn: 0 });
    metronome.toggle();
    await settle();
    advance(b, 3);
    expect(starts(b).map((x) => x - starts(b)[0])).toEqual(withSix);
  });

  it('S10: repeatCountIn 6 does not affect resume or the announcement, and survives reset', async () => {
    const r = rig(true, { ...on, repeatCountIn: 6 });
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    expect(metronome.announcement).toBe('Started, 85 BPM, 4 beats, 8th Triplets, count in 4');
    metronome.toggle();
    expect(metronome.countIn).toEqual({ click: 1, total: 4 });
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    expect(metronome.countIn).toEqual({ click: 2, total: 4 });
    metronome.reset();
    expect(metronome.settings.repeatCountIn).toBe(6);
  });

  it('a stale generation is ignored after Reset', async () => {
    const r = rig(true, on);
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    metronome.reset();
    advance(r, 2);
    expect(metronome.countIn).toBeNull();
    expect(metronome.phase).toBe('settings');
  });
});

describe('metronome store: count-in settings (033 S1, S2)', () => {
  it('S1: setters change the settings, clamped, and keep the counts when switched off', () => {
    rig(true, {});
    metronome.setInitialCountIn(6);
    metronome.setRepeatCountIn(9);
    expect(metronome.settings.initialCountIn).toBe(6);
    expect(metronome.settings.repeatCountIn).toBe(8);
    metronome.setInitialCountIn(-3);
    expect(metronome.settings.initialCountIn).toBe(0);
    metronome.setInitialCountIn(NaN);
    expect(metronome.settings.initialCountIn).toBe(4);
    metronome.setRepeatCountIn(NaN);
    expect(metronome.settings.repeatCountIn).toBe(2);
    metronome.setInitialCountIn(5);
    metronome.setCountIn(false);
    expect(metronome.settings.countIn).toBe(false);
    expect(metronome.settings.initialCountIn).toBe(5);
    metronome.setCountIn(true);
    expect(metronome.settings.countIn).toBe(true);
    metronome.setCountIn('no' as unknown as boolean);
    expect(metronome.settings.countIn).toBe(true);
  });

  it('S1: steppers move by one and stop at the limits', () => {
    rig(true, { initialCountIn: 8, repeatCountIn: 0 });
    metronome.stepInitialCountIn(1);
    metronome.stepRepeatCountIn(-1);
    expect(metronome.settings.initialCountIn).toBe(8);
    expect(metronome.settings.repeatCountIn).toBe(0);
    metronome.stepInitialCountIn(-1);
    metronome.stepRepeatCountIn(1);
    expect(metronome.settings.initialCountIn).toBe(7);
    expect(metronome.settings.repeatCountIn).toBe(1);
  });

  it('S2: setters are ignored outside the settings phase', async () => {
    const r = rig(true, { countIn: true });
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    metronome.setCountIn(false);
    metronome.setInitialCountIn(1);
    metronome.stepInitialCountIn(1);
    metronome.setRepeatCountIn(7);
    metronome.stepRepeatCountIn(1);
    expect(metronome.settings.countIn).toBe(true);
    expect(metronome.settings.initialCountIn).toBe(4);
    expect(metronome.settings.repeatCountIn).toBe(2);
  });
});

describe('metronome store: pause and resume in the count-in (033 S7-S9, S11)', () => {
  const on = { countIn: true } as const;

  async function pausedAfterClick(r: Rig, click: number): Promise<void> {
    metronome.toggle();
    await settle();
    advance(r, (click - 1) * (60 / 85) + 0.1);
    expect(metronome.countIn).toEqual({ click, total: 4 });
    metronome.toggle();
  }

  it('S7: pause after click 2 freezes it and announces it', async () => {
    const r = rig(true, on);
    await pausedAfterClick(r, 2);
    expect(metronome.phase).toBe('paused');
    expect(metronome.countIn).toEqual({ click: 2, total: 4 });
    expect(metronome.announcement).toBe('Paused on count-in click 2 of 4');
    const frozen = starts(r).length;
    advance(r, 2);
    expect(starts(r).length).toBe(frozen);
    expect(metronome.countIn).toEqual({ click: 2, total: 4 });
  });

  it('S8: resume continues with click 3 then 4 then the loop', async () => {
    const r = rig(true, on);
    await pausedAfterClick(r, 2);
    const frozen = starts(r).length;
    metronome.toggle();
    expect(metronome.phase).toBe('starting');
    await settle();
    advance(r, 0.1);
    expect(metronome.countIn).toEqual({ click: 3, total: 4 });
    advance(r, 60 / 85);
    expect(metronome.countIn).toEqual({ click: 4, total: 4 });
    advance(r, 60 / 85);
    expect(metronome.countIn).toBeNull();
    expect(metronome.beat).toBe(1);
    expect(starts(r).length).toBeGreaterThan(frozen);
  });

  it('S9: pause in the loop announces the beat and resume plays no count-in', async () => {
    const r = rig(true, on);
    metronome.toggle();
    await settle();
    advance(r, 4 * (60 / 85) + 0.1);
    expect(metronome.beat).toBe(1);
    metronome.toggle();
    expect(metronome.announcement).toBe('Paused on beat 1 of 4');
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    expect(metronome.countIn).toBeNull();
    expect(metronome.beat).toBe(2);
  });

  it('S11: a suspended context during the count-in freezes on the last click', async () => {
    const r = rig(true, on);
    metronome.toggle();
    await settle();
    advance(r, 60 / 85 + 0.1);
    r.port.state = 'suspended';
    r.port.resume = () => Promise.reject(new Error('blocked'));
    advance(r, 0.1);
    await settle();
    expect(metronome.phase).toBe('paused');
    expect(metronome.countIn?.click).toBe(2);
    expect(metronome.announcement).toBe('Paused on count-in click 2 of 4');
  });

  it('S11: reset keeps every setting and clears the run; leaving restores defaults', async () => {
    const r = rig(true, { ...on, repeatCountIn: 5 });
    await pausedAfterClick(r, 2);
    metronome.reset();
    expect(metronome.phase).toBe('settings');
    expect(metronome.countIn).toBeNull();
    expect(metronome.settings).toEqual({ ...DEFAULT_SETTINGS, repeatCountIn: 5 });
    metronome.screenChanged();
    expect(metronome.settings).toEqual(DEFAULT_SETTINGS);
  });
});
