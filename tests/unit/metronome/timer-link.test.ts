// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AudioSink } from '../../../src/lib/audio/engine';
import type { ClickSink } from '../../../src/lib/audio/metronome';
import { metronome, resetMetronomeForTests } from '../../../src/lib/state/metronome.svelte';
import { playback } from '../../../src/lib/state/playback.svelte';
import { preferences } from '../../../src/lib/state/preferences.svelte';
import { resetTimerForTests, timer } from '../../../src/lib/state/timer.svelte';
import { resetTimerLinkForTests, timerLink } from '../../../src/lib/state/timer-link.svelte';
import { FakeAudioPort, FakeClock, FakeFrames } from '../audio/support/fake-audio';

const TIMER_SINK = { port: {}, destination: {} } as unknown as AudioSink;

interface Rig {
  port: FakeAudioPort;
  clock: FakeClock;
  frames: FakeFrames;
  timerClock: FakeClock;
}

/** Real metronome and timer stores on fake audio, frames and clocks, the link reconnected. */
function rig(settings: Parameters<typeof resetMetronomeForTests>[1] = { countIn: false }): Rig {
  const port = new FakeAudioPort();
  port.state = 'running';
  const clock = new FakeClock();
  const frames = new FakeFrames();
  const timerClock = new FakeClock();
  const sink: ClickSink = {
    port,
    destination: port.destination,
    running: Promise.resolve(true)
  };
  vi.spyOn(playback, 'clickSink').mockReturnValue(sink);
  resetMetronomeForTests({ clock, frames }, { ratio: false, ...settings });
  resetTimerForTests({ clock: timerClock, sink: () => TIMER_SINK, chime: vi.fn(() => true) });
  resetTimerLinkForTests();
  return { port, clock, frames, timerClock };
}

/** Advance the audio and timer clocks together, then run a frame (as store.test.ts does). */
function advance(r: Rig, seconds: number): void {
  const steps = Math.round(seconds * 40);
  for (let i = 0; i < steps; i++) {
    r.port.currentTime += 0.025;
    r.clock.advance(25);
    r.timerClock.advance(25);
  }
  r.frames.flush();
}

/** Start the metronome and let the first click play. */
async function startMetronome(r: Rig): Promise<void> {
  metronome.toggle();
  await settle();
  advance(r, 0.1);
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

beforeEach(() => {
  vi.spyOn(performance, 'now').mockReturnValue(1000);
});
afterEach(() => {
  vi.restoreAllMocks();
  metronome.screenChanged();
});

describe('timer link: the switch (US2)', () => {
  it('is off by default', () => {
    rig();
    expect(timerLink.enabled).toBe(false);
  });

  it('with the switch off, metronome start, pause and reset leave the timer alone (SC-004)', async () => {
    const r = rig();
    await startMetronome(r);
    expect(metronome.phase).toBe('running');
    expect(timer.status).toBe('stopped');
    metronome.toggle();
    expect(metronome.phase).toBe('paused');
    expect(timer.status).toBe('stopped');
    metronome.reset();
    expect(timer.status).toBe('stopped');
    expect(timer.readout).toBe('02:00');
  });

  it('with the switch off, timer play, pause and zero leave the metronome alone', async () => {
    const r = rig();
    await startMetronome(r);
    timer.toggle();
    r.timerClock.advance(1000);
    timer.toggle();
    expect(metronome.phase).toBe('running');
    timer.toggle();
    r.timerClock.advance(200_000);
    expect(timer.status).toBe('finished');
    expect(metronome.phase).toBe('running');
    metronome.reset();
    expect(timer.status).toBe('finished');
  });

  it.each([1, 'true', null, undefined, {}])('setEnabled(%j) is ignored', (v) => {
    rig();
    const remember = vi.spyOn(preferences, 'remember');
    timerLink.setEnabled(v);
    expect(timerLink.enabled).toBe(false);
    expect(remember).not.toHaveBeenCalled();
  });

  it('setEnabled remembers the value; restore writes nothing', () => {
    rig();
    const remember = vi.spyOn(preferences, 'remember');
    timerLink.setEnabled(true);
    expect(timerLink.enabled).toBe(true);
    expect(remember).toHaveBeenLastCalledWith({ metronome: { timerLink: true } });
    timerLink.setEnabled(false);
    expect(remember).toHaveBeenLastCalledWith({ metronome: { timerLink: false } });
    remember.mockClear();
    timerLink.restore(true);
    expect(timerLink.enabled).toBe(true);
    timerLink.restore('yes');
    expect(timerLink.enabled).toBe(false);
    expect(remember).not.toHaveBeenCalled();
  });

  it('toggling the switch never starts, stops, pauses or resets anything (FR-016)', async () => {
    const r = rig();
    timerLink.setEnabled(true);
    expect(timer.status).toBe('stopped');
    expect(metronome.phase).toBe('settings');
    timerLink.setEnabled(false);
    await startMetronome(r);
    timer.toggle();
    r.timerClock.advance(5000);
    const reading = timer.readout;
    timerLink.setEnabled(true);
    timerLink.setEnabled(false);
    timerLink.setEnabled(true);
    expect(metronome.phase).toBe('running');
    expect(timer.status).toBe('running');
    expect(timer.readout).toBe(reading);
  });
});

describe('timer link: one press starts both and the run ends itself (US1)', () => {
  const BEAT = 60 / 85;

  it('count-in 4: the timer holds the full duration, then runs on the first beat (FR-003/004, SC-002)', async () => {
    const r = rig({ countIn: true });
    timerLink.setEnabled(true);
    metronome.toggle();
    expect(timer.status).toBe('stopped');
    expect(timer.readout).toBe('02:00');
    await settle();
    advance(r, 0.1);
    expect(metronome.countIn).toEqual({ click: 1, total: 4 });
    for (let i = 0; i < 3; i++) {
      advance(r, BEAT);
      expect(timer.status).toBe('stopped');
      expect(timer.readout).toBe('02:00');
    }
    advance(r, BEAT);
    expect(metronome.countIn).toBeNull();
    expect(timer.status).toBe('running');
  });

  it.each([{ countIn: false }, { countIn: true, initialCountIn: 0 }])(
    'no count-in %j: the countdown starts with the first click',
    async (s) => {
      const r = rig(s);
      timerLink.setEnabled(true);
      metronome.toggle();
      await settle();
      expect(timer.status).toBe('stopped');
      advance(r, 0.1);
      expect(metronome.beat).toBe(1);
      expect(timer.status).toBe('running');
    }
  );

  it.each(['running', 'paused', 'finished'] as const)(
    'a %s timer is replaced by a fresh full countdown when the metronome starts (FR-004)',
    async (before) => {
      const r = rig();
      timerLink.setEnabled(true);
      timer.toggle();
      r.timerClock.advance(5000);
      if (before === 'paused') timer.toggle();
      if (before === 'finished') r.timerClock.advance(200_000);
      expect(timer.status).toBe(before);
      metronome.toggle();
      expect(timer.status).toBe('stopped');
      expect(timer.readout).toBe('02:00');
      await settle();
      advance(r, 0.1);
      expect(timer.status).toBe('running');
      expect(timer.seconds).toBeGreaterThan(115);
    }
  );

  it('zero halts a running metronome to settings, values kept, one announcement (US1-3, FR-006)', async () => {
    const r = rig();
    metronome.setBpm(100);
    timerLink.setEnabled(true);
    timer.selectPreset(1);
    await startMetronome(r);
    expect(timer.status).toBe('running');
    const bpm = metronome.settings.bpm;
    const before = metronome.announcement;
    advance(r, 61);
    expect(timer.status).toBe('finished');
    expect(metronome.phase).toBe('settings');
    expect(metronome.settings.bpm).toBe(bpm);
    expect(metronome.announcement).toBe(before);
    expect(metronome.announcement).not.toMatch(/reset/i);
    expect(timer.announcement).toBe('Timer finished');
  });

  it('zero halts a metronome in its count-in', async () => {
    const r = rig({ countIn: true });
    timerLink.setEnabled(true);
    timer.selectPreset(1);
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    expect(metronome.countIn).not.toBeNull();
    timer.toggle(); // the timer's own play cancels the pending start
    r.timerClock.advance(61_000);
    expect(timer.status).toBe('finished');
    expect(metronome.phase).toBe('settings');
  });

  it('zero halts a paused metronome', async () => {
    const r = rig();
    timerLink.setEnabled(true);
    timer.selectPreset(1);
    await startMetronome(r);
    metronome.toggle();
    expect(metronome.phase).toBe('paused');
    if (timer.status !== 'running') timer.toggle(); // run the countdown by hand
    r.timerClock.advance(61_000);
    expect(timer.status).toBe('finished');
    expect(metronome.phase).toBe('settings');
  });

  it('zero with the metronome already stopped does nothing extra', () => {
    const r = rig();
    timerLink.setEnabled(true);
    const before = metronome.announcement;
    timer.toggle();
    r.timerClock.advance(200_000);
    expect(timer.status).toBe('finished');
    expect(metronome.phase).toBe('settings');
    expect(metronome.announcement).toBe(before);
  });

  it('zero with the switch off leaves the metronome running', async () => {
    const r = rig();
    timer.selectPreset(1);
    await startMetronome(r);
    timer.toggle();
    r.timerClock.advance(61_000);
    expect(timer.status).toBe('finished');
    expect(metronome.phase).toBe('running');
  });

  it("the timer's own play reaching zero halts a running metronome while linked", async () => {
    const r = rig();
    await startMetronome(r);
    timerLink.setEnabled(true);
    timer.selectPreset(1);
    timer.toggle();
    r.timerClock.advance(61_000);
    expect(timer.status).toBe('finished');
    expect(metronome.phase).toBe('settings');
  });

  it('a late finish (hidden tab) halts the metronome in the same call', async () => {
    const r = rig();
    timerLink.setEnabled(true);
    timer.selectPreset(1);
    await startMetronome(r);
    // one big jump, as a throttled hidden tab delivers
    r.timerClock.advance(600_000);
    expect(timer.status).toBe('finished');
    expect(metronome.phase).toBe('settings');
  });

  it('ratio repeat count-ins, tempo changes and Speed Training steps do not restart the countdown (FR-009)', async () => {
    const r = rig({ countIn: true, ratio: true, repeatCountIn: 2 });
    timerLink.setEnabled(true);
    metronome.toggle();
    await settle();
    advance(r, 0.1);
    advance(r, BEAT * 4);
    expect(timer.status).toBe('running');
    const seen: number[] = [];
    for (let i = 0; i < 20; i++) {
      advance(r, 1);
      seen.push(timer.seconds);
    }
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeLessThan(seen[i - 1]);
    expect(timer.status).toBe('running');
  });
});

describe('timer link: stopping early stays predictable (US3)', () => {
  const BEAT = 60 / 85;

  /** Linked, running metronome with the timer counting a few seconds in. */
  async function linkedRun(r: Rig, seconds = 5): Promise<void> {
    await startMetronome(r);
    expect(timer.status).toBe('running');
    advance(r, seconds);
  }

  describe('early stops reset the timer (T023)', () => {
    it('Reset mid-run stops the metronome and returns the timer to the full duration (US3-1)', async () => {
      const r = rig();
      timerLink.setEnabled(true);
      metronome.toggle();
      await settle();
      advance(r, 0.1);
      advance(r, 5);
      expect(timer.status).toBe('running');
      metronome.reset();
      expect(metronome.phase).toBe('settings');
      expect(timer.status).toBe('stopped');
      expect(timer.readout).toBe('02:00');
    });

    it('Reset during the count-in: the timer never starts and shows the full duration (US3-2, FR-007)', async () => {
      const r = rig({ countIn: true });
      timerLink.setEnabled(true);
      metronome.toggle();
      await settle();
      advance(r, 0.1);
      expect(metronome.countIn).not.toBeNull();
      metronome.reset();
      expect(timer.status).toBe('stopped');
      expect(timer.readout).toBe('02:00');
      advance(r, 5);
      expect(timer.status).toBe('stopped');
      expect(timer.readout).toBe('02:00');
    });

    it.each([
      ['selectMode', () => metronome.selectMode('speed')],
      ['screenChanged', () => metronome.screenChanged()],
      [
        'restore',
        () =>
          metronome.restore({
            ratios: metronome.settings,
            plain: metronome.plain,
            speed: metronome.speed,
            mode: 'plain'
          })
      ]
    ])('%s mid-run resets the timer to the full duration (US3-6, SC-005)', async (_n, stop) => {
      const r = rig();
      timerLink.setEnabled(true);
      await linkedRun(r);
      stop();
      expect(metronome.phase).toBe('settings');
      expect(timer.status).toBe('stopped');
      expect(timer.readout).toBe('02:00');
    });

    it('Speed Training ending by itself resets the timer to the full duration (SC-005)', async () => {
      const r = rig();
      resetMetronomeForTests(
        { clock: r.clock, frames: r.frames },
        { ratio: false, countIn: false },
        {},
        'speed',
        {
          startBpm: 100,
          targetBpm: 105,
          increment: 5,
          loops: 1,
          beats: 2,
          countIn: false,
          atTarget: 'stop'
        }
      );
      resetTimerLinkForTests();
      timerLink.setEnabled(true);
      timer.selectPreset(10);
      await startMetronome(r);
      expect(timer.status).toBe('running');
      advance(r, 10);
      expect(metronome.phase).toBe('settings');
      expect(timer.status).toBe('stopped');
      expect(timer.readout).toBe('10:00');
    });

    it('a stop with the switch off leaves the timer alone', async () => {
      const r = rig();
      await startMetronome(r);
      timer.toggle();
      r.timerClock.advance(5000);
      metronome.reset();
      expect(timer.status).toBe('running');
    });

    it('a tab switch with the metronome already stopped does not reset a timer started by hand', () => {
      const r = rig();
      timerLink.setEnabled(true);
      timer.toggle();
      r.timerClock.advance(5000);
      metronome.selectMode('speed');
      metronome.screenChanged();
      expect(timer.status).toBe('running');
    });

    it('the reset after a stop uses the selected preset', async () => {
      const r = rig();
      timerLink.setEnabled(true);
      timer.selectPreset(5);
      await linkedRun(r);
      metronome.reset();
      expect(timer.status).toBe('stopped');
      expect(timer.readout).toBe('05:00');
    });
  });

  describe('pause, resume and control precedence (T024)', () => {
    it('pausing the metronome pauses the timer; resuming resumes it from the same reading (US3-5, FR-015)', async () => {
      const r = rig();
      timerLink.setEnabled(true);
      await linkedRun(r);
      metronome.toggle();
      expect(metronome.phase).toBe('paused');
      expect(timer.status).toBe('paused');
      const frozen = timer.seconds;
      r.timerClock.advance(30_000);
      expect(timer.seconds).toBe(frozen);
      metronome.toggle();
      expect(timer.status).toBe('paused'); // held until the first resumed click
      await settle();
      advance(r, 0.1);
      expect(timer.status).toBe('running');
      expect(timer.seconds).toBeGreaterThan(frozen - 1);
      expect(timer.seconds).toBeLessThanOrEqual(frozen);
    });

    it('resumes on a repeat count-in click too', async () => {
      const r = rig({ countIn: true, ratio: true, repeatCountIn: 2 });
      timerLink.setEnabled(true);
      metronome.toggle();
      await settle();
      advance(r, 0.1);
      advance(r, BEAT * 4);
      advance(r, 3);
      expect(timer.status).toBe('running');
      metronome.toggle();
      expect(timer.status).toBe('paused');
      metronome.toggle();
      await settle();
      for (let i = 0; i < 400 && timer.status === 'paused'; i++) advance(r, 0.025);
      expect(timer.status).toBe('running');
    });

    it('an audio suspend freezes the timer as a pause does', async () => {
      const r = rig();
      timerLink.setEnabled(true);
      await linkedRun(r);
      r.port.state = 'suspended';
      r.port.resume = () => Promise.reject(new Error('blocked'));
      advance(r, 0.1);
      await settle();
      expect(metronome.phase).toBe('paused');
      expect(timer.status).toBe('paused');
    });

    it('a timer paused by hand is left alone by metronome pause and resume', async () => {
      const r = rig();
      timerLink.setEnabled(true);
      await linkedRun(r);
      timer.toggle();
      expect(timer.status).toBe('paused');
      const frozen = timer.seconds;
      metronome.toggle();
      metronome.toggle();
      await settle();
      advance(r, 1);
      expect(timer.status).toBe('paused');
      expect(timer.seconds).toBe(frozen);
    });

    it('a pause during the initial count-in keeps the pending start, which fires on the first beat after resume', async () => {
      const r = rig({ countIn: true });
      timerLink.setEnabled(true);
      metronome.toggle();
      await settle();
      advance(r, 0.1);
      expect(metronome.countIn).not.toBeNull();
      // a pause is only available when running; the count-in runs as `starting`, so suspend audio
      r.port.state = 'suspended';
      advance(r, 0.5);
      r.port.state = 'running';
      expect(timer.status).toBe('stopped');
      if (metronome.phase === 'paused') {
        metronome.toggle();
        await settle();
      }
      for (let i = 0; i < 40 * 6 && timer.status !== 'running'; i++) advance(r, 0.025);
      expect(timer.status).toBe('running');
      expect(timer.seconds).toBeGreaterThan(115);
    });

    it('hand-pausing the timer leaves the metronome running; it still stops at zero after the timer resumes (US3-3)', async () => {
      const r = rig();
      timerLink.setEnabled(true);
      timer.selectPreset(1);
      await linkedRun(r);
      timer.toggle();
      expect(metronome.phase).toBe('running');
      advance(r, 2);
      expect(metronome.phase).toBe('running');
      timer.toggle();
      r.timerClock.advance(61_000);
      expect(timer.status).toBe('finished');
      expect(metronome.phase).toBe('settings');
    });

    it("the timer's play with the metronome stopped does not start the metronome (US3-4)", () => {
      const r = rig();
      timerLink.setEnabled(true);
      timer.toggle();
      r.timerClock.advance(3000);
      expect(timer.status).toBe('running');
      expect(metronome.phase).toBe('settings');
    });

    it("the timer's play during the count-in cancels the pending start (FR-008)", async () => {
      const r = rig({ countIn: true });
      timerLink.setEnabled(true);
      metronome.toggle();
      await settle();
      advance(r, 0.1);
      timer.toggle();
      r.timerClock.advance(2000);
      const reading = timer.seconds;
      advance(r, BEAT * 4 + 0.5);
      expect(metronome.countIn).toBeNull();
      expect(timer.status).toBe('running');
      expect(timer.seconds).toBeLessThan(reading); // counting on, never restarted from full
      expect(timer.seconds).toBeLessThan(118);
    });

    it('a preset pick during the count-in cancels the pending start (FR-008)', async () => {
      const r = rig({ countIn: true });
      timerLink.setEnabled(true);
      metronome.toggle();
      await settle();
      advance(r, 0.1);
      timer.selectPreset(5);
      advance(r, BEAT * 4 + 1);
      expect(metronome.phase).toBe('running');
      expect(timer.status).toBe('stopped');
      expect(timer.readout).toBe('05:00');
    });

    it('turning the switch off during the count-in cancels the pending start', async () => {
      const r = rig({ countIn: true });
      timerLink.setEnabled(true);
      metronome.toggle();
      await settle();
      advance(r, 0.1);
      timerLink.setEnabled(false);
      advance(r, BEAT * 4 + 1);
      expect(metronome.phase).toBe('running');
      expect(timer.status).toBe('stopped');
    });

    it('off during a pause, then on again, then resume still resumes the timer (FR-016)', async () => {
      const r = rig();
      timerLink.setEnabled(true);
      await linkedRun(r);
      metronome.toggle();
      expect(timer.status).toBe('paused');
      timerLink.setEnabled(false);
      timerLink.setEnabled(true);
      metronome.toggle();
      await settle();
      advance(r, 0.1);
      expect(timer.status).toBe('running');
    });
  });
});
