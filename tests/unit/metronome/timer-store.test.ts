import { readFileSync } from 'node:fs';

import fc from 'fast-check';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AudioSink } from '../../../src/lib/audio/engine';
import {
  DEFAULT_PLAIN_SETTINGS,
  DEFAULT_SETTINGS,
  DEFAULT_SPEED_SETTINGS
} from '../../../src/lib/state/metronome-settings';
import { metronome, resetMetronomeForTests } from '../../../src/lib/state/metronome.svelte';
import { preferences } from '../../../src/lib/state/preferences.svelte';
import { resetTimerForTests, timer } from '../../../src/lib/state/timer.svelte';
import {
  FLASH_MS,
  formatReadout,
  secondsLeft,
  TICK_SLACK_MS
} from '../../../src/lib/state/timer-model';
import { FakeClock, FakeFrames } from '../audio/support/fake-audio';

const SINK = { port: {}, destination: {} } as unknown as AudioSink;

function rig(
  opts: { sink?: AudioSink | null; chime?: (s: AudioSink, late: number) => boolean } = {}
) {
  const clock = new FakeClock();
  const sink = vi.fn(() => ('sink' in opts ? (opts.sink ?? null) : SINK));
  const chime = vi.fn(opts.chime ?? (() => true));
  resetTimerForTests({ clock, sink, chime });
  return { clock, sink, chime };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('timer store: run', () => {
  it('S1: initial state', () => {
    rig();
    expect(timer.preset).toBe(2);
    expect(timer.status).toBe('stopped');
    expect(timer.readout).toBe('02:00');
    expect(timer.flashing).toBe(false);
  });

  it('S2: toggle unlocks the sink once, counts down and finishes', () => {
    const r = rig();
    timer.toggle();
    expect(r.sink).toHaveBeenCalledTimes(1);
    expect(timer.status).toBe('running');
    r.clock.advance(1000 + TICK_SLACK_MS);
    expect(timer.readout).toBe('01:59');
    r.clock.advance(119_000);
    expect(timer.readout).toBe('00:00');
    expect(timer.status).toBe('finished');
  });

  it('S3: pause holds, resume continues, total equals the preset', () => {
    const r = rig();
    timer.toggle();
    r.clock.advance(10_000);
    timer.toggle();
    expect(timer.status).toBe('paused');
    expect(timer.readout).toBe('01:50');
    r.clock.advance(30_000);
    expect(timer.readout).toBe('01:50');
    timer.toggle();
    r.clock.advance(5000 + TICK_SLACK_MS);
    expect(timer.readout).toBe('01:45');
    r.clock.advance(105_000);
    expect(timer.status).toBe('finished');
  });

  it('S4: restart from finished uses the full duration and clears flashing', () => {
    const r = rig();
    timer.toggle();
    r.clock.advance(120_000);
    expect(timer.flashing).toBe(true);
    timer.toggle();
    expect(timer.status).toBe('running');
    expect(timer.flashing).toBe(false);
    expect(timer.readout).toBe('02:00');
    r.clock.advance(1000 + TICK_SLACK_MS);
    expect(timer.readout).toBe('01:59');
  });
});

describe('timer store: finish', () => {
  it('S8: chimes once, promptly', () => {
    const r = rig();
    timer.toggle();
    r.clock.advance(120_000);
    expect(r.chime).toHaveBeenCalledTimes(1);
    const late = r.chime.mock.calls[0][1];
    expect(late).toBeGreaterThanOrEqual(0);
    expect(late).toBeLessThanOrEqual(2000);
  });

  it('S8: a clock jump past endsAt + 2000 finishes without a chime', () => {
    const r = rig();
    timer.toggle();
    const jump = r.clock as unknown as { t: number };
    jump.t += 130_000; // simulated sleep: time moves, no callback ran
    r.clock.advance(0);
    r.clock.advance(1000);
    expect(timer.status).toBe('finished');
    expect(r.chime).not.toHaveBeenCalled();
  });

  it('S8: a null sink finishes without a chime', () => {
    const r = rig({ sink: null });
    timer.toggle();
    r.clock.advance(120_000);
    expect(timer.status).toBe('finished');
    expect(r.chime).not.toHaveBeenCalled();
  });

  it('S9: a chime that returns false or throws still finishes and flashes', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const chime of [
      () => false,
      () => {
        throw new Error('boom');
      }
    ]) {
      const r = rig({ chime });
      timer.toggle();
      r.clock.advance(120_000);
      expect(timer.status).toBe('finished');
      expect(timer.flashing).toBe(true);
    }
  });

  it('S10: flashing lasts exactly FLASH_MS', () => {
    const r = rig();
    timer.toggle();
    r.clock.advance(120_000);
    expect(timer.flashing).toBe(true);
    r.clock.advance(FLASH_MS - 1);
    expect(timer.flashing).toBe(true);
    r.clock.advance(1);
    expect(timer.flashing).toBe(false);
    expect(timer.status).toBe('finished');
  });
});

describe('timer store: announcements (US5)', () => {
  it('S11: 10 s … 1 s then finished, in order; nothing above 10 s; actions clear', () => {
    const r = rig();
    timer.selectPreset(1);
    timer.toggle();
    const seen: string[] = [];
    for (let i = 0; i < 125; i++) {
      r.clock.advance(500);
      if (timer.announcement && timer.announcement !== seen[seen.length - 1]) {
        seen.push(timer.announcement);
      }
      if (timer.seconds > 10) expect(timer.announcement).toBe('');
    }
    expect(seen).toEqual([
      '10 seconds',
      '9 seconds',
      '8 seconds',
      '7 seconds',
      '6 seconds',
      '5 seconds',
      '4 seconds',
      '3 seconds',
      '2 seconds',
      '1 second',
      'Timer finished'
    ]);
    timer.toggle();
    expect(timer.announcement).toBe('');
    r.clock.advance(55_000 + TICK_SLACK_MS);
    expect(timer.announcement).toBe('5 seconds');
    timer.toggle();
    expect(timer.announcement).toBe('');
    timer.toggle();
    r.clock.advance(1000);
    timer.selectPreset(3);
    expect(timer.announcement).toBe('');
  });
});

describe('timer store: drift', () => {
  it('S12: late callbacks never delay the end past endsAt + 1000 ms', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 900 }), { minLength: 1, maxLength: 50 }),
        (lates) => {
          const r = rig();
          timer.toggle();
          const total = 120_000;
          let at = 0;
          let i = 0;
          while (timer.status === 'running' && at < total + 5000) {
            const step = 1000 + TICK_SLACK_MS + lates[i++ % lates.length];
            r.clock.advance(step);
            at += step;
            if (timer.status === 'running') {
              expect(timer.readout).toBe(formatReadout(secondsLeft(total - (at - TICK_SLACK_MS))));
            }
          }
          expect(timer.status).toBe('finished');
          expect(at).toBeLessThanOrEqual(total + 1000 + TICK_SLACK_MS + 900);
        }
      )
    );
  });

  it('S12: readout follows the clock at every tick, and finishes by endsAt + 1000', () => {
    const r = rig();
    timer.toggle();
    for (let s = 1; s < 120; s++) {
      r.clock.advance(s === 1 ? 1000 + TICK_SLACK_MS : 1000);
      expect(timer.readout).toBe(formatReadout(120 - s));
    }
    r.clock.advance(1000);
    expect(timer.status).toBe('finished');
  });
});

describe('timer store: restore', () => {
  it('S14: restore(7) and restore("x")', () => {
    rig();
    timer.restore(7);
    expect(timer.preset).toBe(7);
    expect(timer.status).toBe('stopped');
    expect(timer.readout).toBe('07:00');
    timer.restore('x');
    expect(timer.preset).toBe(2);
    expect(timer.readout).toBe('02:00');
  });
});

describe('timer store: presets', () => {
  it('S5: selectPreset resets from any status, including the selected preset mid-run', () => {
    const r = rig();
    vi.spyOn(preferences, 'remember').mockImplementation(() => {});
    timer.toggle();
    r.clock.advance(20_000);
    timer.selectPreset(5);
    expect(timer.status).toBe('stopped');
    expect(timer.readout).toBe('05:00');
    expect(timer.flashing).toBe(false);
    r.clock.advance(60_000);
    expect(timer.readout).toBe('05:00');
    timer.toggle();
    r.clock.advance(20_000);
    timer.selectPreset(5);
    expect(timer.status).toBe('stopped');
    expect(timer.readout).toBe('05:00');
    timer.toggle();
    r.clock.advance(300_000);
    expect(timer.flashing).toBe(true);
    timer.selectPreset(3);
    expect(timer.flashing).toBe(false);
    expect(timer.readout).toBe('03:00');
  });

  it('S6: an invalid value changes nothing and writes nothing', () => {
    rig();
    const remember = vi.spyOn(preferences, 'remember').mockImplementation(() => {});
    timer.selectPreset(4);
    remember.mockClear();
    for (const bad of [0, 11, 2.5, '3', null, NaN]) timer.selectPreset(bad as number);
    expect(timer.preset).toBe(4);
    expect(timer.readout).toBe('04:00');
    expect(remember).not.toHaveBeenCalled();
  });

  it('S7: each valid call writes once; nothing else writes', () => {
    const r = rig();
    const remember = vi.spyOn(preferences, 'remember').mockImplementation(() => {});
    timer.selectPreset(5);
    timer.selectPreset(5);
    expect(remember).toHaveBeenCalledTimes(2);
    expect(remember).toHaveBeenLastCalledWith({ metronome: { timer: 5 } });
    remember.mockClear();
    timer.toggle();
    r.clock.advance(300_000);
    timer.toggle();
    timer.restore(7);
    expect(remember).not.toHaveBeenCalled();
  });
});

describe('timer store: independence (US3)', () => {
  const snapshot = () => ({
    preset: timer.preset,
    status: timer.status,
    readout: timer.readout,
    flashing: timer.flashing
  });
  const restoreArg = () => ({
    ratios: { ...DEFAULT_SETTINGS },
    plain: { ...DEFAULT_PLAIN_SETTINGS },
    speed: { ...DEFAULT_SPEED_SETTINGS },
    mode: 'speed' as const
  });

  it('S13: metronome actions leave every timer field unchanged', () => {
    const r = rig();
    resetMetronomeForTests({ clock: new FakeClock(), frames: new FakeFrames() });
    timer.selectPreset(5);
    timer.toggle();
    r.clock.advance(10_000);
    const before = snapshot();
    metronome.toggle();
    expect(metronome.phase).not.toBe('settings');
    metronome.reset();
    metronome.selectMode('speed');
    metronome.screenChanged();
    metronome.restore(restoreArg());
    expect(snapshot()).toEqual(before);
    r.clock.advance(5000 + TICK_SLACK_MS);
    expect(timer.status).toBe('running');
    expect(timer.readout).toBe('04:45');
    metronome.screenChanged();
    resetMetronomeForTests();
  });

  it('S15: timer actions never change the metronome phase or mode', () => {
    const r = rig();
    resetMetronomeForTests();
    const before = { phase: metronome.phase, mode: metronome.mode };
    timer.selectPreset(1);
    timer.toggle();
    r.clock.advance(30_000);
    timer.toggle();
    timer.toggle();
    r.clock.advance(60_000);
    expect(timer.status).toBe('finished');
    timer.restore(7);
    expect({ phase: metronome.phase, mode: metronome.mode }).toEqual(before);
    expect(metronome.phase).toBe('settings');
  });

  it('S15: the timer and metronome stores do not import each other', () => {
    const read = (f: string) => readFileSync(`src/lib/state/${f}`, 'utf8');
    const imports = (src: string) =>
      src.match(/^\s*(?:import|export)[^;]*?from\s+['"][^'"]+['"]/gm) ?? [];
    for (const f of ['timer.svelte.ts', 'timer-model.ts']) {
      expect(imports(read(f)).join('\n')).not.toMatch(/metronome/);
    }
    expect(imports(read('metronome.svelte.ts')).join('\n')).not.toMatch(/timer/);
  });
});
