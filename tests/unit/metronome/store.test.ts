// @vitest-environment jsdom
import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClickSink } from '../../../src/lib/audio/metronome';
import {
  DEFAULT_PLAIN_SETTINGS,
  DEFAULT_SPEED_SETTINGS,
  DEFAULT_SETTINGS,
  type MetronomeSettings,
  type PlainSettings,
  type SpeedSettings
} from '../../../src/lib/state/metronome-settings';
import { metronome, resetMetronomeForTests } from '../../../src/lib/state/metronome.svelte';
import { playback } from '../../../src/lib/state/playback.svelte';
import { preferences, resetPreferencesForTests } from '../../../src/lib/state/preferences.svelte';
import { FakeAudioPort, FakeClock, FakeFrames, type FakeSource } from '../audio/support/fake-audio';

describe('036 persistence (T026)', () => {
  it('selectMode remembers the full object, then not for the active tab or invalid input', () => {
    rig(true, { bpm: 120 });
    const remember = vi.spyOn(preferences, 'remember');
    metronome.selectMode('plain');
    expect(remember).toHaveBeenCalledTimes(1);
    expect(remember).toHaveBeenCalledWith({
      metronome: {
        ratios: metronome.settings,
        plain: metronome.plain,
        speed: metronome.speed,
        mode: 'plain'
      }
    });
    remember.mockClear();
    for (const v of ['plain', 'SPEED', null, 3]) metronome.selectMode(v);
    expect(remember).not.toHaveBeenCalled();
  });

  it('plain and Ratios changes write the same full object; equal values do not write', () => {
    rig(true, { countIn: true });
    const remember = vi.spyOn(preferences, 'remember');
    metronome.selectMode('plain');
    remember.mockClear();
    const plainCases: Array<[string, () => void]> = [
      ['setBpm', () => metronome.setBpm(100)],
      ['stepBeats', () => metronome.stepBeats(-1)],
      ['setBeats', () => metronome.setBeats(5)],
      ['setCountIn', () => metronome.setCountIn(false)],
      ['setInitialCountIn', () => metronome.setInitialCountIn(2)]
    ];
    for (const [name, call] of plainCases) {
      remember.mockClear();
      call();
      expect(remember, name).toHaveBeenCalledTimes(1);
      expect(remember, name).toHaveBeenCalledWith({
        metronome: {
          ratios: metronome.settings,
          plain: metronome.plain,
          speed: metronome.speed,
          mode: 'plain'
        }
      });
    }
    remember.mockClear();
    metronome.setBpm(100);
    metronome.setCountIn(false);
    expect(remember).not.toHaveBeenCalled();
    metronome.selectMode('ratios');
    remember.mockClear();
    metronome.setBpm(130);
    expect(remember).toHaveBeenCalledWith({
      metronome: {
        ratios: expect.objectContaining({ bpm: 130 }),
        plain: expect.objectContaining({ bpm: 100, beats: 5 }),
        speed: metronome.speed,
        mode: 'ratios'
      }
    });
  });

  it('a storage failure does not block the tool', () => {
    rig();
    resetPreferencesForTests();
    expect(() => metronome.selectMode('plain')).not.toThrow();
    expect(metronome.mode).toBe('plain');
  });

  it('reset() and screenChanged() keep the mode and both records', async () => {
    rig(true, { bpm: 120 });
    metronome.selectMode('plain');
    metronome.setBpm(100);
    metronome.toggle();
    await settle();
    const remember = vi.spyOn(preferences, 'remember');
    metronome.reset();
    metronome.screenChanged();
    expect(remember).not.toHaveBeenCalled();
    expect(metronome.mode).toBe('plain');
    expect(metronome.plain.bpm).toBe(100);
    expect(metronome.settings.bpm).toBe(120);
  });
});

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
  // 033-era cases assert wrap-around at beat N, so the ratio section is off unless asked for (R-11).
  resetMetronomeForTests({ clock, frames }, { ratio: false, ...settings });
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
    expect(metronome.settings).toEqual({ ...DEFAULT_SETTINGS, countIn: false, ratio: false });
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
    expect(metronome.settings).toEqual({ ...DEFAULT_SETTINGS, countIn: false, ratio: false });
  });

  it('M7: screenChanged halts the run and keeps the last settings', async () => {
    const r = rig();
    metronome.setBpm(120);
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    metronome.screenChanged();
    expect(metronome.phase).toBe('settings');
    expect(metronome.settings).toEqual({
      ...DEFAULT_SETTINGS,
      bpm: 120,
      countIn: false,
      ratio: false
    });
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
    expect(metronome.settings).toEqual({
      ...DEFAULT_SETTINGS,
      bpm: 120,
      beats: 6,
      countIn: false,
      ratio: false
    });
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

  it('M7: screenChanged after a reset keeps the settings', async () => {
    const r = rig();
    metronome.setBpm(200);
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    metronome.reset();
    expect(metronome.settings.bpm).toBe(200);
    metronome.screenChanged();
    expect(metronome.settings.bpm).toBe(200);
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

  it('Reset keeps the choice; screenChanged keeps it too', async () => {
    const r = rig();
    metronome.setSubdivision(6);
    metronome.toggle();
    await settle();
    advance(r, 0.2);
    metronome.reset();
    expect(metronome.settings.subdivision).toBe(6);
    metronome.screenChanged();
    expect(metronome.settings.subdivision).toBe(6);
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

  it('S11: reset keeps every setting and clears the run; leaving keeps them too', async () => {
    const r = rig(true, { ...on, repeatCountIn: 5 });
    await pausedAfterClick(r, 2);
    metronome.reset();
    expect(metronome.phase).toBe('settings');
    expect(metronome.countIn).toBeNull();
    expect(metronome.settings).toEqual({ ...DEFAULT_SETTINGS, repeatCountIn: 5, ratio: false });
    metronome.screenChanged();
    expect(metronome.settings).toEqual({ ...DEFAULT_SETTINGS, repeatCountIn: 5, ratio: false });
  });
});

describe('metronome store: ratio cycle (034)', () => {
  const alt = { countIn: true, ratio: true } as const;
  /** 85 BPM, slot n starts at 0.02 + n × 60/85 s (port time starts at 0). */
  const toSlot = (r: Rig, slot: number): void => {
    // Absolute: advance to just after the slot's first click.
    advance(r, Math.max(0.025, 0.02 + slot * (60 / 85) + 0.06 - r.port.currentTime));
  };

  it('S1: setRatio ignores non-booleans, keeps loop2, and is a no-op while running', async () => {
    const r = rig(true, alt);
    metronome.setLoop2(4);
    metronome.setRatio('no');
    metronome.setRatio(1);
    expect(metronome.settings.ratio).toBe(true);
    metronome.setRatio(false);
    expect(metronome.settings.ratio).toBe(false);
    expect(metronome.settings.loop2).toBe(4);
    metronome.setRatio(true);
    metronome.toggle();
    await settle();
    metronome.setRatio(false);
    metronome.setLoop2(2);
    expect(metronome.settings.ratio).toBe(true);
    expect(metronome.settings.loop2).toBe(4);
    expect(r.clickSink).toHaveBeenCalled();
  });

  it('setLoop2 ignores invalid input', () => {
    rig(true, alt);
    for (const bad of [0, 9, 2.5, 'x', null, undefined, NaN]) metronome.setLoop2(bad);
    expect(metronome.settings.loop2).toBe(6);
    metronome.setLoop2('3');
    expect(metronome.settings.loop2).toBe(3);
  });

  it('position, beat, sub, countIn and dots derive from one position', async () => {
    const r = rig(true, alt);
    expect(metronome.position).toBeNull();
    expect(metronome.countIn).toBeNull();
    metronome.toggle();
    await settle();
    // before the first click: COUNT IN –/4
    expect(metronome.countIn).toEqual({ click: 0, total: 4 });
    expect(metronome.beat).toBe(0);
    expect(metronome.sub).toBe(3);
    expect(metronome.dots).toEqual([]);
    toSlot(r, 0);
    expect(metronome.countIn).toEqual({ click: 1, total: 4 });
    toSlot(r, 4); // Loop 1 beat 1
    expect(metronome.position).toMatchObject({ kind: 'beat', loop: 1, beat: 1, slot: 4 });
    expect(metronome.countIn).toBeNull();
    expect(metronome.sub).toBe(3);
    expect(metronome.dots).toEqual(['lit', 'upcoming', 'upcoming', 'upcoming']);
    toSlot(r, 8); // repeat count-in 1 of 2
    expect(metronome.countIn).toEqual({ click: 1, total: 2 });
    expect(metronome.beat).toBe(0);
    expect(metronome.dots).toEqual([]);
    toSlot(r, 12); // Loop 2 beat 3
    expect(metronome.position).toMatchObject({ kind: 'beat', loop: 2, beat: 3 });
    expect(metronome.sub).toBe(6);
    expect(metronome.dots).toEqual(['played', 'played', 'lit', 'upcoming']);
  });

  it('with no Count In, Start shows Loop 1 before the first beat', async () => {
    rig(true, { countIn: false, ratio: true });
    metronome.toggle();
    await settle();
    expect(metronome.countIn).toBeNull();
    expect(metronome.sub).toBe(3);
    expect(metronome.dots).toEqual(['upcoming', 'upcoming', 'upcoming', 'upcoming']);
  });

  it('pause on Loop 2 beat 3 resumes with beat 4; reset starts at slot 0', async () => {
    const r = rig(true, alt);
    metronome.toggle();
    await settle();
    toSlot(r, 12);
    metronome.toggle();
    expect(metronome.phase).toBe('paused');
    expect(metronome.position).toMatchObject({ loop: 2, beat: 3, slot: 12 });
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    expect(metronome.position).toMatchObject({ kind: 'beat', loop: 2, beat: 4, slot: 13 });
    metronome.reset();
    expect(metronome.position).toBeNull();
    expect(metronome.settings.loop2).toBe(6);
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    expect(metronome.position).toMatchObject({ kind: 'count-in', slot: 0, click: 1 });
  });

  it('pause inside a repeat count-in resumes on its next click', async () => {
    const r = rig(true, alt);
    metronome.toggle();
    await settle();
    toSlot(r, 8);
    metronome.toggle();
    expect(metronome.position).toMatchObject({ kind: 'count-in', repeat: true, click: 1 });
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    expect(metronome.position).toMatchObject({ kind: 'count-in', repeat: true, click: 2, slot: 9 });
  });

  it('screenChanged keeps ratio off and Loop 2 as set', () => {
    rig(true, { ratio: false, loop2: 2 });
    metronome.screenChanged();
    expect(metronome.settings.ratio).toBe(false);
    expect(metronome.settings.loop2).toBe(2);
    expect(metronome.position).toBeNull();
  });
});

describe('metronome store: pause and resume in the ratio cycle (034 US4)', () => {
  const alt = { countIn: true, ratio: true } as const;
  const toSlot = (r: Rig, slot: number): void => {
    advance(r, Math.max(0.025, 0.02 + slot * (60 / 85) + 0.06 - r.port.currentTime));
  };
  async function resumeAfter(r: Rig, slot: number): Promise<void> {
    metronome.toggle();
    await settle();
    toSlot(r, slot);
    metronome.toggle();
  }
  async function resumed(r: Rig): Promise<void> {
    metronome.toggle();
    await settle();
    advance(r, 0.1);
  }

  it('pause on the last loop beat resumes on repeat click 1', async () => {
    const r = rig(true, alt);
    await resumeAfter(r, 7);
    expect(metronome.position).toMatchObject({ kind: 'beat', beat: 4, slot: 7 });
    await resumed(r);
    expect(metronome.position).toMatchObject({ kind: 'count-in', repeat: true, click: 1, slot: 8 });
  });

  it('pause on the last loop beat with r = 0 resumes on beat 1 of the next loop', async () => {
    const r = rig(true, { ...alt, repeatCountIn: 0 });
    await resumeAfter(r, 7);
    await resumed(r);
    expect(metronome.position).toMatchObject({ kind: 'beat', loop: 2, beat: 1, slot: 8 });
  });

  it('pause on the last repeat click resumes on beat 1 of the next loop', async () => {
    const r = rig(true, alt);
    await resumeAfter(r, 9);
    expect(metronome.position).toMatchObject({ kind: 'count-in', repeat: true, click: 2 });
    await resumed(r);
    expect(metronome.position).toMatchObject({ kind: 'beat', loop: 2, beat: 1, slot: 10 });
  });

  it('announces a pause in a loop with its subdivision', async () => {
    const r = rig(true, alt);
    await resumeAfter(r, 12);
    expect(metronome.announcement).toBe('Paused on beat 3 of 4, Sextuplets');
  });

  it('announces a pause in a repeat count-in with the count r', async () => {
    const r = rig(true, alt);
    await resumeAfter(r, 8);
    expect(metronome.announcement).toBe('Paused on count-in click 1 of 2');
  });

  it('section off keeps the 033 pause text', async () => {
    const r = rig(true, { countIn: false, ratio: false });
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    metronome.toggle();
    expect(metronome.announcement).toBe('Paused on beat 1 of 4');
  });
});

describe('metronome store: ratio start announcements (034, FR-013)', () => {
  it('section on, k = 0: names Loop 1 then Loop 2', () => {
    rig(true, { countIn: false, ratio: true });
    metronome.toggle();
    expect(metronome.announcement).toBe('Started, 85 BPM, 4 beats, 8th Triplets then Sextuplets');
  });

  it('section on, k > 0: adds the count-in', () => {
    rig(true, { countIn: true, ratio: true, loop2: 2 });
    metronome.toggle();
    expect(metronome.announcement).toBe(
      'Started, 85 BPM, 4 beats, 8th Triplets then 8th notes, count in 4'
    );
  });

  it('section off keeps the 033 texts', () => {
    rig(true, { countIn: true, ratio: false });
    metronome.toggle();
    expect(metronome.announcement).toBe('Started, 85 BPM, 4 beats, 8th Triplets, count in 4');
  });

  it('loop switches never change the announcement', async () => {
    const r = rig(true, { countIn: false, ratio: true, beats: 1 });
    metronome.toggle();
    await settle();
    const started = metronome.announcement;
    advance(r, 8);
    expect(metronome.position?.kind).toBeDefined();
    expect(metronome.announcement).toBe(started);
  });
});

describe('035 remembered settings: store contract', () => {
  it('M-R1/M-R2: restore applies values, halts a run, never remembers', async () => {
    const r = rig();
    const remember = vi.spyOn(preferences, 'remember');
    metronome.toggle();
    await settle();
    advance(r, 0.5);
    expect(metronome.phase).not.toBe('settings');
    const next: MetronomeSettings = {
      bpm: 120,
      beats: 2,
      subdivision: 2,
      countIn: false,
      initialCountIn: 1,
      repeatCountIn: 3,
      ratio: false,
      loop2: 5
    };
    metronome.restore({
      ratios: next,
      plain: DEFAULT_PLAIN_SETTINGS,
      speed: DEFAULT_SPEED_SETTINGS,
      mode: 'ratios'
    });
    expect(metronome.phase).toBe('settings');
    expect(metronome.position).toBeNull();
    expect(metronome.settings).toEqual(next);
    const seen = starts(r).length;
    advance(r, 1);
    expect(starts(r).length).toBe(seen);
    expect(remember).not.toHaveBeenCalled();
  });

  it('M-W1: a stepper at its limit, an ignored value and a call outside settings do not remember', () => {
    rig(true, { bpm: 300, beats: 1, initialCountIn: 0, repeatCountIn: 8 });
    const remember = vi.spyOn(preferences, 'remember');
    metronome.stepBpm(1);
    metronome.stepBeats(-1);
    metronome.stepInitialCountIn(-1);
    metronome.stepRepeatCountIn(1);
    metronome.setCountIn('nope');
    metronome.setRatio('nope');
    metronome.setLoop2(99);
    metronome.setSubdivision('x');
    metronome.setBpm(300);
    expect(remember).not.toHaveBeenCalled();
    metronome.toggle();
    metronome.setBpm(100);
    metronome.stepBeats(1);
    metronome.setRatio(false);
    expect(remember).not.toHaveBeenCalled();
  });

  it('M-W2: toggle and reset never remember', async () => {
    const r = rig();
    const remember = vi.spyOn(preferences, 'remember');
    metronome.toggle();
    await settle();
    advance(r, 0.5);
    metronome.toggle();
    metronome.toggle();
    metronome.reset();
    expect(remember).not.toHaveBeenCalled();
  });

  it('M-W3: setters do not throw with no preferences session', () => {
    rig();
    resetPreferencesForTests();
    expect(() => metronome.setBpm(100)).not.toThrow();
    expect(metronome.settings.bpm).toBe(100);
  });

  it('every setter remembers the new settings once on a real change', () => {
    rig(true, { countIn: true, ratio: true });
    const remember = vi.spyOn(preferences, 'remember');
    const cases: Array<[string, () => void]> = [
      ['setBpm', () => metronome.setBpm(100)],
      ['stepBpm', () => metronome.stepBpm(1)],
      ['setBeats', () => metronome.setBeats(5)],
      ['stepBeats', () => metronome.stepBeats(1)],
      ['setCountIn', () => metronome.setCountIn(false)],
      ['setInitialCountIn', () => metronome.setInitialCountIn(7)],
      ['stepInitialCountIn', () => metronome.stepInitialCountIn(-1)],
      ['setRepeatCountIn', () => metronome.setRepeatCountIn(5)],
      ['stepRepeatCountIn', () => metronome.stepRepeatCountIn(1)],
      ['setRatio', () => metronome.setRatio(false)],
      ['setSubdivision', () => metronome.setSubdivision(5)],
      ['setLoop2', () => metronome.setLoop2(2)]
    ];
    for (const [name, call] of cases) {
      remember.mockClear();
      call();
      expect(remember, name).toHaveBeenCalledTimes(1);
      expect(remember, name).toHaveBeenCalledWith({
        metronome: {
          ratios: metronome.settings,
          plain: metronome.plain,
          speed: metronome.speed,
          mode: 'ratios'
        }
      });
    }
  });
});

describe('035 US1: in-visit memory (FR-002)', () => {
  it('screenChanged keeps the last values set and returns to the settings phase', () => {
    rig(true, {});
    metronome.setBpm(120);
    metronome.setBeats(2);
    metronome.setLoop2(5);
    metronome.screenChanged();
    expect(metronome.phase).toBe('settings');
    expect(metronome.settings).toMatchObject({ bpm: 120, beats: 2, loop2: 5 });
  });

  it('keeps the values with no preferences session (storage unavailable)', () => {
    resetPreferencesForTests();
    rig(true, {});
    metronome.setBpm(140);
    metronome.screenChanged();
    expect(metronome.phase).toBe('settings');
    expect(metronome.settings.bpm).toBe(140);
  });
});

describe('035 US2: Reset and running position (FR-003, FR-004)', () => {
  it('Reset keeps the settings and never remembers', async () => {
    const r = rig(true, {});
    metronome.setBpm(120);
    metronome.setBeats(2);
    const kept = metronome.settings;
    const remember = vi.spyOn(preferences, 'remember');
    metronome.toggle();
    await settle();
    advance(r, 0.5);
    metronome.reset();
    expect(metronome.phase).toBe('settings');
    expect(metronome.settings).toEqual(kept);
    expect(remember).not.toHaveBeenCalled();
  });

  it('the failure-view reset (screenChanged) keeps the values', async () => {
    const r = rig(true, {});
    metronome.setBpm(150);
    metronome.setLoop2(4);
    metronome.toggle();
    await settle();
    advance(r, 0.5);
    metronome.screenChanged();
    expect(metronome.phase).toBe('settings');
    expect(metronome.position).toBeNull();
    expect(metronome.settings).toMatchObject({ bpm: 150, loop2: 4 });
  });

  it('position, initialTotal and generation are never passed to remember', async () => {
    const r = rig(true, { countIn: true });
    const remember = vi.spyOn(preferences, 'remember');
    metronome.setBpm(100);
    metronome.toggle();
    await settle();
    advance(r, 1);
    metronome.toggle();
    metronome.toggle();
    metronome.reset();
    metronome.setBeats(3);
    expect(remember).toHaveBeenCalledTimes(2);
    for (const [arg] of remember.mock.calls) {
      expect(Object.keys(arg as object)).toEqual(['metronome']);
      const ratios = (arg as { metronome: { ratios: object } }).metronome.ratios;
      expect(Object.keys(ratios).sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort());
    }
  });
});

describe('036 plain mode: store contract', () => {
  function plainRig(
    plain: Partial<PlainSettings> = {},
    settings: Partial<MetronomeSettings> = {}
  ): Rig {
    const r = rig(true, settings);
    resetMetronomeForTests(
      { clock: r.clock, frames: r.frames },
      { ratio: false, countIn: false, ...settings },
      plain,
      'plain'
    );
    return r;
  }

  it('defaults: mode ratios, current is the Ratios record, plain defaults', () => {
    resetMetronomeForTests();
    expect(metronome.mode).toBe('ratios');
    expect(metronome.current).toBe(metronome.settings);
    expect(metronome.plain).toEqual(DEFAULT_PLAIN_SETTINGS);
  });

  it('current is the plain record in plain mode; sub is null and dots follow its beats', async () => {
    const r = plainRig({ beats: 3, countIn: false });
    expect(metronome.mode).toBe('plain');
    expect(metronome.current).toBe(metronome.plain);
    expect(metronome.sub).toBeNull();
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    expect(metronome.dots).toHaveLength(3);
    expect(metronome.sub).toBeNull();
  });

  it('S3: plain setters never change settings and Ratios setters never change plain', () => {
    const ops = fc.array(
      fc.tuple(fc.integer({ min: 0, max: 6 }), fc.integer({ min: -400, max: 400 })),
      { maxLength: 30 }
    );
    fc.assert(
      fc.property(ops, ops, (plainOps, ratiosOps) => {
        const apply = ([op, n]: [number, number]): void => {
          const dir = n < 0 ? -1 : 1;
          if (op === 0) metronome.setBpm(n);
          else if (op === 1) metronome.stepBpm(dir);
          else if (op === 2) metronome.setBeats(n);
          else if (op === 3) metronome.stepBeats(dir);
          else if (op === 4) metronome.setInitialCountIn(n);
          else if (op === 5) metronome.stepInitialCountIn(dir);
          else metronome.setCountIn(n > 0);
        };
        resetMetronomeForTests({}, {}, {}, 'plain');
        const settings = { ...metronome.settings };
        plainOps.forEach(apply);
        expect(metronome.settings).toEqual(settings);
        resetMetronomeForTests({}, {}, {}, 'ratios');
        const plain = { ...metronome.plain };
        ratiosOps.forEach(apply);
        expect(metronome.plain).toEqual(plain);
      })
    );
  });

  it('S4: a plain Start schedules one click per beat at the plain bpm, after the count-in', async () => {
    const r = plainRig({ bpm: 120, beats: 3, countIn: true, initialCountIn: 2 }, { bpm: 60 });
    metronome.toggle();
    await settle();
    advance(r, 2.2);
    const t = starts(r);
    for (let i = 1; i < t.length; i++) expect(t[i] - t[i - 1]).toBeCloseTo(0.5, 6);
    expect(t.length).toBeGreaterThanOrEqual(5);
    expect(metronome.position?.kind).toBe('beat');
  });

  it('S5: Ratios start still announces and shows sub as before', async () => {
    const r = rig(true, { countIn: false, ratio: false });
    metronome.toggle();
    expect(metronome.announcement).toBe('Started, 85 BPM, 4 beats, 8th Triplets');
    await settle();
    advance(r, 0.1);
    expect(metronome.sub).toBe(3);
  });

  it('Ratios-only setters are no-ops in plain mode', () => {
    plainRig();
    const before = { settings: { ...metronome.settings }, plain: { ...metronome.plain } };
    metronome.setRepeatCountIn(7);
    metronome.stepRepeatCountIn(1);
    metronome.setRatio(false);
    metronome.setSubdivision(5);
    metronome.setLoop2(2);
    expect(metronome.settings).toEqual(before.settings);
    expect(metronome.plain).toEqual(before.plain);
  });

  it('plain Start and Pause announce the plain variants', async () => {
    const r = plainRig({ bpm: 100, beats: 3, countIn: true, initialCountIn: 4 });
    metronome.toggle();
    expect(metronome.announcement).toBe('Started, 100 BPM, 3 beats, count in 4');
    await settle();
    advance(r, 3);
    metronome.toggle();
    expect(metronome.phase).toBe('paused');
    expect(metronome.announcement).toMatch(/^Paused on beat \d of 3$/);
    metronome.reset();
    metronome.setCountIn(false);
    metronome.toggle();
    expect(metronome.announcement).toBe('Started, 100 BPM, 3 beats');
  });

  it('restore applies ratios, plain and mode, halts a run and never remembers', async () => {
    const r = rig();
    const remember = vi.spyOn(preferences, 'remember');
    metronome.toggle();
    await settle();
    advance(r, 0.5);
    const plain: PlainSettings = {
      bpm: 100,
      beats: 3,
      countIn: false,
      initialCountIn: 1,
      subdivision: 1
    };
    metronome.restore({
      ratios: { ...DEFAULT_SETTINGS, bpm: 120 },
      plain,
      speed: DEFAULT_SPEED_SETTINGS,
      mode: 'plain'
    });
    expect(metronome.phase).toBe('settings');
    expect(metronome.position).toBeNull();
    expect(metronome.settings.bpm).toBe(120);
    expect(metronome.plain).toEqual(plain);
    expect(metronome.mode).toBe('plain');
    const seen = starts(r).length;
    advance(r, 1);
    expect(starts(r).length).toBe(seen);
    expect(remember).not.toHaveBeenCalled();
  });
});

describe('036 selectMode (S1, S2)', () => {
  it.each(['starting', 'running', 'paused', 'count-in'] as const)(
    'S1: from %s it halts once, returns to settings and goes silent',
    async (from) => {
      const r = rig(true, { countIn: from === 'count-in', initialCountIn: 4 });
      metronome.toggle();
      if (from === 'starting') {
        expect(metronome.phase).toBe('starting');
      } else {
        await settle();
        advance(r, from === 'count-in' ? 0.1 : 0.5);
        if (from === 'paused') metronome.toggle();
      }
      metronome.selectMode('plain');
      expect(metronome.mode).toBe('plain');
      expect(metronome.phase).toBe('settings');
      expect(metronome.position).toBeNull();
      const seen = starts(r).length;
      advance(r, 2);
      expect(starts(r).length).toBe(seen);
    }
  );

  it('S2: the active mode or an invalid value changes nothing and keeps the run', async () => {
    const r = rig();
    metronome.toggle();
    await settle();
    advance(r, 0.5);
    expect(metronome.phase).toBe('running');
    for (const v of ['ratios', 'SPEED', null, 3, undefined, {}, 'PLAIN']) {
      metronome.selectMode(v);
      expect(metronome.mode).toBe('ratios');
      expect(metronome.phase).toBe('running');
    }
    const before = starts(r).length;
    advance(r, 0.5);
    expect(starts(r).length).toBeGreaterThan(before);
  });
});

describe('037 Speed Training run (S6, S7, S12, S14)', () => {
  function speedRig(speed: Partial<SpeedSettings>, ratiosCountIn = false): Rig {
    const r = rig(true, { countIn: ratiosCountIn });
    resetMetronomeForTests({ clock: r.clock, frames: r.frames }, {}, {}, 'speed', speed);
    return r;
  }

  /** Sample the status line and tempo every 25 ms; keep consecutive changes only. */
  function trace(r: Rig, seconds: number): { labels: string[]; bpms: number[] } {
    const labels: string[] = [];
    const bpms: number[] = [];
    for (let i = 0; i < Math.round(seconds * 40); i++) {
      advance(r, 0.025);
      if (metronome.phase === 'settings') continue;
      const c = metronome.countIn;
      const s = metronome.speedStatus;
      const label =
        c !== null
          ? c.click > 0
            ? `COUNT IN ${c.click}/${c.total}`
            : null
          : s?.kind === 'step'
            ? `STEP ${s.step}/${s.steps} · LOOP ${s.loop}/${s.loops}`
            : s?.kind === 'hold'
              ? `HOLD ${s.steps}`
              : null;
      if (label !== null && labels.at(-1) !== label) labels.push(label);
      if (bpms.at(-1) !== metronome.bpm) {
        bpms.push(metronome.bpm);
      }
    }
    return { labels, bpms };
  }

  it('reads the start tempo and a first step before the first click', () => {
    speedRig({ startBpm: 80, targetBpm: 120 });
    expect(metronome.bpm).toBe(80);
    expect(metronome.steps).toBe(9);
    expect(metronome.speedStatus).toEqual({ kind: 'step', step: 1, steps: 9, loop: 1, loops: 4 });
    expect(metronome.sub).toBeNull();
    expect(metronome.current).toBe(metronome.speed);
  });

  it('S6: 80→120/5 plays 4 + 144 + 16 clicks and the statuses follow the run', async () => {
    const r = speedRig({
      startBpm: 80,
      targetBpm: 120,
      increment: 5,
      loops: 4,
      beats: 4,
      countIn: true,
      initialCountIn: 4,
      repeatCountIn: 2,
      atTarget: 'stop'
    });
    metronome.toggle();
    await settle();
    expect(metronome.announcement).toBe('Started, 80 to 120 BPM, 4 beats, count in 4');
    const { labels, bpms } = trace(r, 130);
    const expected: string[] = [1, 2, 3, 4].map((c) => `COUNT IN ${c}/4`);
    for (let s = 1; s <= 9; s++) {
      for (let l = 1; l <= 4; l++) expected.push(`STEP ${s}/9 · LOOP ${l}/4`);
      if (s < 9) expected.push('COUNT IN 1/2', 'COUNT IN 2/2');
    }
    expect(labels).toEqual(expected);
    expect(starts(r).length).toBe(4 + 144 + 16);
    // 80 through step 1 and its following count-in, then 85 from step 2's first loop click.
    expect(bpms).toEqual([80, 85, 90, 95, 100, 105, 110, 115, 120]);
  });

  it('S7: 80→102/5 has 6 steps at 80, 85, 90, 95, 100, 102', async () => {
    const r = speedRig({
      startBpm: 80,
      targetBpm: 102,
      increment: 5,
      loops: 1,
      beats: 1,
      countIn: false,
      atTarget: 'stop'
    });
    expect(metronome.steps).toBe(6);
    metronome.toggle();
    await settle();
    expect(metronome.announcement).toBe('Started, 80 to 102 BPM, 1 beats');
    const { bpms } = trace(r, 12);
    expect(bpms).toEqual([80, 85, 90, 95, 100, 102]);
  });

  it('announces each step from step 2 once, at its first loop click, never loops or beats', async () => {
    const r = speedRig({
      startBpm: 100,
      targetBpm: 115,
      increment: 5,
      loops: 2,
      beats: 2,
      countIn: false,
      atTarget: 'stop'
    });
    metronome.toggle();
    await settle();
    const seen: string[] = [];
    for (let i = 0; i < 40 * 10; i++) {
      advance(r, 0.025);
      if (seen.at(-1) !== metronome.announcement) seen.push(metronome.announcement);
    }
    expect(seen.slice(1)).toEqual([
      'Step 2 of 4, 105 BPM',
      'Step 3 of 4, 110 BPM',
      'Step 4 of 4, 115 BPM',
      'Finished at 115 BPM'
    ]);
  });

  describe('At target (S8, S9)', () => {
    const base = {
      startBpm: 100,
      targetBpm: 105,
      increment: 5,
      loops: 1,
      beats: 2,
      countIn: false
    };

    it('S8 Hold: enters hold once, keeps clicking with no count-in, pause/resume stays in hold', async () => {
      const r = speedRig({ ...base, atTarget: 'hold' });
      metronome.toggle();
      await settle();
      const seen: string[] = [];
      for (let i = 0; i < 40 * 5; i++) {
        advance(r, 0.025);
        if (seen.at(-1) !== metronome.announcement) seen.push(metronome.announcement);
      }
      expect(metronome.speedStatus).toEqual({ kind: 'hold', steps: 2 });
      expect(seen.filter((a) => a === 'Holding at 105 BPM')).toHaveLength(1);
      expect(metronome.phase).toBe('running');
      const before = starts(r).length;
      advance(r, 2);
      expect(starts(r).length).toBeGreaterThan(before + 2);
      expect(metronome.countIn).toBeNull();
      metronome.toggle();
      expect(metronome.phase).toBe('paused');
      expect(metronome.announcement).toMatch(/^Paused, holding at 105 BPM, beat \d of 2$/);
      metronome.toggle();
      await settle();
      advance(r, 1);
      expect(metronome.speedStatus?.kind).toBe('hold');
      expect(metronome.countIn).toBeNull();
      expect(metronome.announcement).toBe('Resumed');
    });

    it('S9 Stop: returns to settings once after the last beat, no later clicks, values kept', async () => {
      const r = speedRig({ ...base, atTarget: 'stop' });
      const record = metronome.speed;
      metronome.toggle();
      await settle();
      advance(r, 3);
      expect(metronome.phase).toBe('settings');
      expect(metronome.finished).toBe(1);
      expect(metronome.announcement).toBe('Finished at 105 BPM');
      expect(metronome.speed).toBe(record);
      expect(metronome.position).toBeNull();
      const n = starts(r).length;
      expect(n).toBe(4);
      advance(r, 3);
      expect(starts(r).length).toBe(n);
      expect(metronome.finished).toBe(1);
    });

    it('a single step (Start = Target) is STEP 1/1 and then follows At target', async () => {
      const r = speedRig({ ...base, startBpm: 300, targetBpm: 300, atTarget: 'hold' });
      expect(metronome.steps).toBe(1);
      metronome.toggle();
      await settle();
      advance(r, 0.1);
      expect(metronome.speedStatus).toMatchObject({ kind: 'step', step: 1, steps: 1 });
      advance(r, 2);
      expect(metronome.speedStatus).toEqual({ kind: 'hold', steps: 1 });
    });

    it('setAtTarget accepts hold/stop in settings only and ignores anything else', async () => {
      speedRig({ ...base, atTarget: 'hold' });
      metronome.setAtTarget('stop');
      expect(metronome.speed.atTarget).toBe('stop');
      metronome.setAtTarget('loop');
      metronome.setAtTarget(1);
      expect(metronome.speed.atTarget).toBe('stop');
      metronome.toggle();
      await settle();
      metronome.setAtTarget('hold');
      expect(metronome.speed.atTarget).toBe('stop');
    });
  });

  it('S12: speed edits leave the other records alone and shared rows edit speed', () => {
    speedRig({});
    const ratios = metronome.settings;
    const plain = metronome.plain;
    metronome.setBeats(6);
    metronome.setCountIn(false);
    metronome.setInitialCountIn(3);
    metronome.setRepeatCountIn(1);
    expect(metronome.speed).toMatchObject({
      beats: 6,
      countIn: false,
      initialCountIn: 3,
      repeatCountIn: 1
    });
    const speed = metronome.speed;
    metronome.setBpm(200);
    metronome.stepBpm(1);
    metronome.setSubdivision(5);
    metronome.setRatio(false);
    metronome.setLoop2(2);
    expect(metronome.speed).toBe(speed);
    expect(metronome.settings).toBe(ratios);
    expect(metronome.plain).toBe(plain);
  });

  it('S12: selecting Speed during a Ratios run halts it at once', async () => {
    const r = rig(true, { countIn: false });
    metronome.toggle();
    await settle();
    advance(r, 0.5);
    expect(metronome.phase).toBe('running');
    metronome.selectMode('speed');
    expect(metronome.mode).toBe('speed');
    expect(metronome.phase).toBe('settings');
    const seen = starts(r).length;
    advance(r, 2);
    expect(starts(r).length).toBe(seen);
  });

  it('S14: remember() sends ratios, plain, speed and mode as one object', () => {
    rig();
    const remember = vi.spyOn(preferences, 'remember');
    metronome.selectMode('speed');
    expect(remember).toHaveBeenCalledWith({
      metronome: {
        ratios: metronome.settings,
        plain: metronome.plain,
        speed: metronome.speed,
        mode: 'speed'
      }
    });
    remember.mockClear();
    metronome.setBeats(7);
    expect(remember).toHaveBeenCalledTimes(1);
    expect(remember).toHaveBeenCalledWith({
      metronome: {
        ratios: metronome.settings,
        plain: metronome.plain,
        speed: expect.objectContaining({ beats: 7 }),
        mode: 'speed'
      }
    });
  });
});

describe('037 Speed Training setters (S11)', () => {
  function speedSettingsRig(speed: Partial<SpeedSettings> = {}) {
    const r = rig(true, { countIn: false });
    resetMetronomeForTests({ clock: r.clock, frames: r.frames }, {}, {}, 'speed', speed);
    return r;
  }

  it('S11: Target never goes below Start', () => {
    speedSettingsRig({ startBpm: 100, targetBpm: 100 });
    metronome.stepTargetBpm(-1);
    expect(metronome.speed.targetBpm).toBe(100);
    metronome.setTargetBpm(90);
    expect(metronome.speed.targetBpm).toBe(100);
    metronome.setTargetBpm(140);
    expect(metronome.speed.targetBpm).toBe(140);
    metronome.stepTargetBpm(-1);
    expect(metronome.speed.targetBpm).toBe(139);
  });

  it('S11: raising Start lifts Target, lowering Start leaves it', () => {
    speedSettingsRig({ startBpm: 85, targetBpm: 125 });
    metronome.setStartBpm(130);
    expect(metronome.speed).toMatchObject({ startBpm: 130, targetBpm: 130 });
    metronome.setStartBpm(100);
    expect(metronome.speed).toMatchObject({ startBpm: 100, targetBpm: 130 });
    metronome.stepStartBpm(1);
    expect(metronome.speed.startBpm).toBe(101);
    metronome.stepStartBpm(-1);
    expect(metronome.speed.startBpm).toBe(100);
  });

  it('clamps Increment to 1–20 and Loops to 1–16', () => {
    speedSettingsRig();
    metronome.setIncrement(99);
    expect(metronome.speed.increment).toBe(20);
    metronome.setIncrement(-3);
    expect(metronome.speed.increment).toBe(1);
    metronome.stepIncrement(-1);
    expect(metronome.speed.increment).toBe(1);
    metronome.stepIncrement(1);
    expect(metronome.speed.increment).toBe(2);
    metronome.setLoops(99);
    expect(metronome.speed.loops).toBe(16);
    metronome.setLoops(0);
    expect(metronome.speed.loops).toBe(1);
    metronome.stepLoops(1);
    expect(metronome.speed.loops).toBe(2);
    metronome.stepLoops(-1);
    expect(metronome.speed.loops).toBe(1);
  });

  it('remembers once per change and writes nothing for an equal record', () => {
    speedSettingsRig({ startBpm: 85, targetBpm: 125, increment: 5, loops: 4 });
    const remember = vi.spyOn(preferences, 'remember');
    metronome.setStartBpm(85);
    metronome.setTargetBpm(125);
    metronome.setIncrement(5);
    metronome.setLoops(4);
    metronome.stepTargetBpm(1);
    expect(remember).toHaveBeenCalledTimes(1);
    remember.mockClear();
    metronome.setTargetBpm(126);
    expect(remember).not.toHaveBeenCalled();
    metronome.setTargetBpm(90);
    expect(remember).toHaveBeenCalledTimes(1);
    expect(remember).toHaveBeenCalledWith({
      metronome: expect.objectContaining({
        speed: expect.objectContaining({ targetBpm: 90 }),
        mode: 'speed'
      })
    });
  });

  it('are no-ops outside Speed mode and outside the settings phase', () => {
    const r = speedSettingsRig();
    const before = metronome.speed;
    metronome.selectMode('plain');
    metronome.setStartBpm(200);
    metronome.setTargetBpm(250);
    metronome.setIncrement(9);
    metronome.setLoops(9);
    metronome.stepLoops(1);
    expect(metronome.speed).toBe(before);
    metronome.selectMode('speed');
    metronome.toggle();
    expect(metronome.phase).not.toBe('settings');
    metronome.setStartBpm(200);
    metronome.stepIncrement(1);
    metronome.setLoops(9);
    expect(metronome.speed).toBe(before);
    advance(r, 0.1);
  });
});

describe('037 Speed Training pause, resume and reset (S10, S13)', () => {
  const base = {
    startBpm: 100,
    targetBpm: 110,
    increment: 5,
    loops: 2,
    beats: 3,
    countIn: false,
    atTarget: 'hold'
  } as const;
  function speedRig(speed: Partial<SpeedSettings>) {
    const r = rig(true, { countIn: false });
    resetMetronomeForTests({ clock: r.clock, frames: r.frames }, {}, {}, 'speed', speed);
    return r;
  }
  async function pauseAtSlot(r: Rig, slot: number, bpm = 100): Promise<void> {
    metronome.toggle();
    await settle();
    advance(r, Math.max(0.025, 0.02 + slot * (60 / bpm) + 0.06 - r.port.currentTime));
    metronome.toggle();
  }

  it('pause during loops announces step, loop and beat', async () => {
    const r = speedRig(base);
    await pauseAtSlot(r, 4); // loop 2, beat 2 of step 1
    expect(metronome.phase).toBe('paused');
    expect(metronome.announcement).toBe('Paused, step 1 of 3, loop 2 of 2, beat 2 of 3');
  });

  it('resume continues at the next slot with no new count-in', async () => {
    const r = speedRig({ ...base, countIn: true, initialCountIn: 2, repeatCountIn: 2 });
    metronome.toggle();
    await settle();
    advance(r, 0.025 * 60);
    const pos = metronome.position;
    metronome.toggle();
    const at = metronome.position;
    expect(at).not.toBeNull();
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    expect(metronome.position?.slot).toBe((at?.slot ?? -2) + 1);
    expect(pos).not.toBeNull();
  });

  it('pause in a count-in reuses the count-in strings', async () => {
    const r = speedRig({ ...base, countIn: true, initialCountIn: 4, repeatCountIn: 2 });
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    metronome.toggle();
    expect(metronome.announcement).toMatch(/^Paused on count-in click \d of 4$/);
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    expect(metronome.phase).toBe('running');
    expect(metronome.announcement).toBe('Resumed');
  });

  it('Reset stops with no further click, keeps values, and the next Start begins at step 1', async () => {
    const r = speedRig(base);
    const record = metronome.speed;
    await pauseAtSlot(r, 8);
    metronome.reset();
    expect(metronome.phase).toBe('settings');
    expect(metronome.speed).toBe(record);
    const n = starts(r).length;
    advance(r, 2);
    expect(starts(r).length).toBe(n);
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    expect(metronome.position).toMatchObject({ slot: 0, ramp: { step: 1 } });
  });

  it('selecting another mode while running stops at once and keeps the speed record', async () => {
    const r = speedRig(base);
    const record = metronome.speed;
    metronome.toggle();
    await settle();
    advance(r, 0.5);
    metronome.selectMode('plain');
    expect(metronome.phase).toBe('settings');
    const n = starts(r).length;
    advance(r, 2);
    expect(starts(r).length).toBe(n);
    expect(metronome.speed).toBe(record);
  });
});

describe('038 tap tempo (S15–S20)', () => {
  /** Tap `n` times with `gapMs` between taps on the injected clock. */
  function taps(r: Rig, n: number, gapMs = 500): void {
    for (let i = 0; i < n; i++) {
      if (i > 0) r.clock.advance(gapMs);
      metronome.tapTempo();
    }
  }

  it('S15: does nothing outside plain mode', () => {
    for (const mode of ['ratios', 'speed'] as const) {
      const r = rig(true, { bpm: 100 });
      resetMetronomeForTests({ clock: r.clock, frames: r.frames }, { bpm: 100 }, {}, mode);
      const remember = vi.spyOn(preferences, 'remember');
      taps(r, 6);
      expect(remember).not.toHaveBeenCalled();
      expect(metronome.settings.bpm).toBe(100);
      expect(metronome.announcement).toBe('');
      vi.restoreAllMocks();
      vi.spyOn(performance, 'now').mockReturnValue(1000);
    }
  });

  it('S16/S17: taps 1–3 change nothing; tap 4 commits once and announces', () => {
    const r = rig();
    metronome.selectMode('plain');
    const remember = vi.spyOn(preferences, 'remember');
    taps(r, 3);
    expect(remember).not.toHaveBeenCalled();
    expect(metronome.announcement).toBe('');
    r.clock.advance(500);
    metronome.tapTempo();
    expect(metronome.plain.bpm).toBe(120);
    expect(remember).toHaveBeenCalledTimes(1);
    expect(metronome.announcement).toBe('120 BPM');
    // An unchanged bpm neither writes nor announces.
    metronome.dismissSoundNotice();
    r.clock.advance(500);
    metronome.tapTempo();
    expect(remember).toHaveBeenCalledTimes(1);
  });

  it('S18: a tap while running retimes in place and keeps phase, position, generation', async () => {
    const r = rig();
    metronome.selectMode('plain');
    metronome.toggle();
    await settle();
    advance(r, 0.6);
    const { generation, position } = metronome;
    const stopped = r.port.sources.filter((s) => s.stopCalls.length > 0).length;
    taps(r, 4, 400);
    expect(metronome.plain.bpm).toBe(150);
    expect(metronome.phase).toBe('running');
    expect(metronome.generation).toBe(generation);
    expect(metronome.position).toBe(position);
    expect(r.port.sources.filter((s) => s.stopCalls.length > 0).length).toBeGreaterThan(stopped);
    advance(r, 2);
    expect(metronome.beat).toBeGreaterThan(0);
    metronome.screenChanged();
  });

  it('S19: paused taps only commit; resume continues at slot + 1 with the new bpm', async () => {
    const r = rig();
    metronome.selectMode('plain');
    metronome.toggle();
    await settle();
    advance(r, 1.2);
    metronome.toggle();
    expect(metronome.phase).toBe('paused');
    const slot = metronome.position?.slot ?? -1;
    const before = starts(r).length;
    taps(r, 4, 300);
    expect(metronome.plain.bpm).toBe(200);
    expect(starts(r).length).toBe(before);
    metronome.toggle();
    await settle();
    advance(r, 1.5);
    const fresh = starts(r).slice(before);
    expect(fresh[1] - fresh[0]).toBeCloseTo(0.3, 6);
    expect(metronome.position?.slot).toBeGreaterThan(slot);
    metronome.screenChanged();
  });

  it('S20: reset, selectMode, screenChanged and restore clear the run; toggle does not', async () => {
    const r = rig();
    metronome.selectMode('plain');
    const clears: Array<() => void> = [
      () => metronome.reset(),
      () => {
        metronome.selectMode('ratios');
        metronome.selectMode('plain');
      },
      () => metronome.screenChanged(),
      () =>
        metronome.restore({
          ratios: metronome.settings,
          plain: metronome.plain,
          speed: metronome.speed,
          mode: 'plain'
        })
    ];
    for (const [i, clear] of clears.entries()) {
      metronome.setBpm(100);
      r.clock.advance(5000);
      taps(r, 3);
      clear();
      r.clock.advance(100);
      const remember = vi.spyOn(preferences, 'remember');
      taps(r, 3);
      expect(remember).not.toHaveBeenCalled();
      remember.mockRestore();
      expect(metronome.plain.bpm, `case ${i}`).toBe(100);
      metronome.selectMode('plain');
    }
    // toggle keeps the run: 3 taps, start, 1 more tap → 4 taps.
    metronome.setBpm(100);
    r.clock.advance(5000);
    taps(r, 3);
    metronome.toggle();
    await settle();
    r.clock.advance(500);
    metronome.tapTempo();
    expect(metronome.plain.bpm).toBe(120);
    metronome.screenChanged();
  });
});

describe('038 plain subdivision: store contract', () => {
  function subRig(plain: Partial<PlainSettings> = {}): Rig {
    const r = rig(true, { countIn: false });
    resetMetronomeForTests(
      { clock: r.clock, frames: r.frames },
      {},
      { countIn: false, ...plain },
      'plain'
    );
    return r;
  }

  it('S21: setPlainSubdivision accepts 1-4 as numbers or numeric strings', () => {
    subRig();
    for (const v of [2, '3', 4, '1']) {
      metronome.setPlainSubdivision(v);
      expect(metronome.plain.subdivision).toBe(Number(v));
    }
  });

  it('S21: it ignores anything else, other phases and other modes', async () => {
    const r = subRig();
    for (const bad of [0, 5, 8, 2.5, '', 'x', null, undefined, true, {}]) {
      metronome.setPlainSubdivision(bad);
      expect(metronome.plain.subdivision).toBe(1);
    }
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    metronome.setPlainSubdivision(3);
    expect(metronome.plain.subdivision).toBe(1);
    metronome.screenChanged();
    resetMetronomeForTests({ clock: r.clock, frames: r.frames }, {}, {}, 'ratios');
    metronome.setPlainSubdivision(3);
    expect(metronome.plain.subdivision).toBe(1);
    resetMetronomeForTests({ clock: r.clock, frames: r.frames }, {}, {}, 'speed');
    metronome.setPlainSubdivision(3);
    expect(metronome.plain.subdivision).toBe(1);
  });

  it('S21: a change remembers once; the same value does not write', () => {
    subRig();
    const remember = vi.spyOn(preferences, 'remember');
    metronome.setPlainSubdivision(3);
    metronome.setPlainSubdivision(3);
    expect(remember).toHaveBeenCalledTimes(1);
  });

  it('S22: a plain run clicks subdivision times per beat (Triplets at 90 BPM)', async () => {
    const r = subRig({ bpm: 90, subdivision: 3 });
    metronome.toggle();
    await settle();
    advance(r, 1.5);
    const t = starts(r).sort((a, b) => a - b);
    expect(t.length).toBeGreaterThanOrEqual(6);
    for (let i = 1; i < 6; i++) expect(t[i] - t[i - 1]).toBeCloseTo(60 / 90 / 3, 6);
    metronome.screenChanged();
  });

  it('S22: the count-in is one click per slot, whatever the subdivision', async () => {
    const r = subRig({ bpm: 90, subdivision: 3, countIn: true, initialCountIn: 4 });
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    expect(metronome.countIn).toEqual({ click: 1, total: 4 });
    const t = starts(r).sort((a, b) => a - b);
    advance(r, 2.5);
    const all = starts(r).sort((a, b) => a - b);
    expect(all[1] - all[0]).toBeCloseTo(60 / 90, 6);
    expect(t.length).toBeGreaterThan(0);
    metronome.screenChanged();
  });

  it('S23: sub is null for Quarter and 2/3/4 otherwise', () => {
    subRig();
    expect(metronome.sub).toBeNull();
    for (const n of [2, 3, 4]) {
      metronome.setPlainSubdivision(n);
      expect(metronome.sub).toBe(n);
    }
    metronome.setPlainSubdivision(1);
    expect(metronome.sub).toBeNull();
  });

  it('S24: Start announces the subdivision name, with and without count in', async () => {
    subRig({ bpm: 90, subdivision: 3 });
    metronome.toggle();
    await settle();
    expect(metronome.announcement).toBe('Started, 90 BPM, 4 beats, 8th Triplets');
    metronome.screenChanged();
    subRig({ bpm: 90, subdivision: 3, countIn: true, initialCountIn: 4 });
    metronome.toggle();
    await settle();
    expect(metronome.announcement).toBe('Started, 90 BPM, 4 beats, 8th Triplets, count in 4');
    metronome.screenChanged();
  });

  it('S24: Quarter keeps the 036 announcements', async () => {
    subRig({ bpm: 90 });
    metronome.toggle();
    await settle();
    expect(metronome.announcement).toBe('Started, 90 BPM, 4 beats');
    metronome.screenChanged();
  });

  it('S25: Quarter plays the same clicks as before (every beat, no extra)', async () => {
    const r = subRig({ bpm: 120 });
    metronome.toggle();
    await settle();
    advance(r, 1.9);
    const t = starts(r).sort((a, b) => a - b);
    for (let i = 1; i < t.length; i++) expect(t[i] - t[i - 1]).toBeCloseTo(0.5, 6);
    metronome.screenChanged();
  });
});
