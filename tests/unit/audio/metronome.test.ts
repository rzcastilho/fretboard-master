import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import {
  HORIZON_S,
  START_LEAD_S,
  clickAt,
  createClickScheduler,
  skipTo,
  type ClickSink,
  type SchedulerEvents,
  type SegmentStart
} from '../../../src/lib/audio/metronome';
import { FakeAudioPort, FakeClock, FakeFrames, FakeSource } from './support/fake-audio';

function setup(opts: { sink?: 'none' | 'ok' | 'unavailable' } = {}) {
  const port = new FakeAudioPort();
  port.state = 'running';
  const clock = new FakeClock();
  const frames = new FakeFrames();
  const sink: ClickSink | null =
    opts.sink === 'none'
      ? null
      : {
          port: port as never,
          destination: port.destination,
          running: Promise.resolve(opts.sink !== 'unavailable')
        };
  const beats: number[] = [];
  const events: SchedulerEvents = {
    onBeat: (b) => beats.push(b),
    onSuspended: vi.fn(),
    onSoundUnavailable: vi.fn()
  };
  const scheduler = createClickScheduler(events, { sink, clock, frames });
  /** Advance audio and timer clocks together in `stepMs` steps. */
  const advance = (ms: number, stepMs = 25): void => {
    for (let t = 0; t < ms; t += stepMs) {
      port.currentTime += stepMs / 1000;
      clock.advance(stepMs);
    }
  };
  const seg = (over: Partial<SegmentStart> = {}): SegmentStart => ({
    bpm: 120,
    beats: 4,
    startBeat: 1,
    run: 1,
    pressedAtMs: 0,
    ...over
  });
  const begin = async (over: Partial<SegmentStart> = {}): Promise<void> => {
    scheduler.start(seg(over));
    await Promise.resolve();
    await Promise.resolve();
  };
  const starts = (): number[] =>
    port.sources.flatMap((s) => (s as unknown as FakeSource).startCalls);
  return { port, clock, frames, events, beats, scheduler, advance, begin, starts };
}

describe('click grid maths', () => {
  it('S1: when = anchor + k * 60/bpm within 1e-9 s', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 30, max: 300 }),
        fc.integer({ min: 0, max: 3000 }),
        (bpm, k) => {
          const period = 60 / bpm;
          const c = clickAt({ anchor: 1.25, period, startBeat: 1, beats: 4 }, k);
          expect(Math.abs(c.when - (1.25 + (k * 60) / bpm))).toBeLessThan(1e-9);
        }
      )
    );
  });

  it('skipTo returns the first index not in the past', () => {
    const seg = { anchor: 1, period: 0.5 };
    const k = skipTo(seg, 31);
    expect(clickAt({ ...seg, startBeat: 1, beats: 4 }, k).when).toBeGreaterThanOrEqual(31);
  });
});

describe('createClickScheduler', () => {
  it('S1/S2/S3: schedules on the grid, never in the past, first click within 50 ms', async () => {
    const { port, scheduler, begin, advance, starts } = setup();
    port.currentTime = 10;
    await begin({ bpm: 90 });
    const first = starts()[0];
    expect(first - 10).toBeLessThanOrEqual(0.05);
    expect(first).toBeCloseTo(10 + START_LEAD_S, 9);
    advance(5000);
    const all = starts();
    all.forEach((when, k) => expect(Math.abs(when - (first + (k * 60) / 90))).toBeLessThan(1e-9));
    // Each start() call had when >= currentTime at that point (clicks lead by <= HORIZON).
    expect(all.every((w) => w >= 10)).toBe(true);
    scheduler.halt('leave');
  });

  it('S4: wakes only every 1000 ms still schedule each index once, in order, none late', async () => {
    const { port, scheduler, begin, advance, starts } = setup();
    const lateCheck: boolean[] = [];
    const orig = port.createBufferSource.bind(port);
    port.createBufferSource = () => {
      const s = orig() as unknown as FakeSource;
      const start = s.start.bind(s);
      s.start = (when = 0) => {
        lateCheck.push(when >= port.currentTime);
        start(when);
      };
      return s as unknown as AudioBufferSourceNode;
    };
    await begin({ bpm: 120 });
    advance(60_000, 1000);
    const all = starts();
    expect(all.length).toBeGreaterThan(100);
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort((a, b) => a - b)).toEqual(all);
    expect(lateCheck.every(Boolean)).toBe(true);
    all.forEach((w, k) => expect(w).toBeCloseTo(all[0] + k * 0.5, 9));
    scheduler.halt('leave');
  });

  it('S5: halt cancels sources with when > now and nothing schedules afterwards', async () => {
    const { port, scheduler, begin, advance } = setup();
    await begin({ bpm: 60 });
    advance(500);
    const before = port.sources.length;
    const future = (port.sources as unknown as FakeSource[]).filter(
      (s) => s.startCalls[0] > port.currentTime
    );
    expect(future.length).toBeGreaterThan(0);
    scheduler.halt('pause');
    for (const s of future) expect(s.stopCalls.length).toBe(1);
    advance(5000);
    expect(port.sources.length).toBe(before);
    expect(scheduler.live).toBe(false);
  });

  it('S6: pause at beat 3 of 4, resume at beat 4 (no accent), then beat 1 (accent)', async () => {
    const { port, scheduler, begin, advance, frames, beats } = setup();
    await begin({ bpm: 120 });
    // Click k sounds at 0.02 + 0.5k; beat 3 is k = 2 at 1.02.
    advance(1100);
    frames.flush();
    expect(beats.at(-1)).toBe(3);
    const frozen = scheduler.halt('pause');
    expect(frozen).toBe(3);
    const startsBefore = port.sources.length;
    beats.length = 0;
    await begin({ startBeat: (frozen % 4) + 1 });
    for (let i = 0; i < 100; i++) {
      advance(25);
      frames.flush();
    }
    const buffers = (port.sources.slice(startsBefore) as unknown as FakeSource[]).map(
      (s) => s.buffer
    );
    // Beat 4 is a normal click, beat 1 the accent: the first two buffers differ and the 1st is normal.
    expect(buffers[0]).not.toBe(buffers[1]);
    const normal = port.buffers.find((b) => Math.max(...b.getChannelData(0)) < 0.6);
    expect(buffers[0]).toBe(normal);
    expect(beats.slice(0, 3)).toEqual([4, 1, 2]);
  });

  it('S7: a 30 s jump of currentTime schedules no past click', async () => {
    const { port, scheduler, begin, advance, starts } = setup();
    await begin({ bpm: 120 });
    advance(100);
    const n = starts().length;
    port.currentTime += 30;
    const now = port.currentTime;
    advance(25);
    const added = starts().slice(n);
    expect(added.length).toBeGreaterThan(0);
    expect(added.every((w) => w >= now)).toBe(true);
    expect(added.length).toBeLessThanOrEqual(Math.ceil(HORIZON_S / 0.5) + 1);
    scheduler.halt('leave');
  });

  it('S8: onBeat fires only from a frame callback, after the output latency', async () => {
    const { port, scheduler, begin, advance, frames, beats } = setup();
    port.outputLatency = 0.1;
    await begin({ bpm: 60 });
    advance(50);
    expect(beats).toEqual([]);
    frames.flush();
    expect(beats).toEqual([]); // first click at 0.02 + 0.1 latency = 0.12 > 0.05
    advance(100);
    expect(beats).toEqual([]);
    frames.flush();
    expect(beats).toEqual([1]);
    scheduler.halt('leave');
  });

  it('S9: a second start() while live does nothing; stale timers after halt do nothing', async () => {
    const { port, scheduler, begin, advance, clock, frames } = setup();
    await begin();
    const n = port.sources.length;
    scheduler.start({ bpm: 200, beats: 3, startBeat: 1, run: 2, pressedAtMs: 0 });
    await Promise.resolve();
    expect(port.sources.length).toBe(n);
    scheduler.halt('reset');
    expect(clock.pendingCount).toBe(0);
    expect(frames.pendingCount).toBe(0);
    advance(5000);
    frames.flush();
    expect(port.sources.length).toBe(n);
  });

  it('S10: with no sink no source is created, but beats still step', async () => {
    const { port, scheduler, begin, advance, frames, beats } = setup({ sink: 'none' });
    await begin({ bpm: 120 });
    for (let i = 0; i < 12; i++) {
      advance(125);
      frames.flush();
    }
    expect(port.sources.length).toBe(0);
    expect(beats.slice(0, 3)).toEqual([1, 2, 3]);
    scheduler.halt('leave');
  });

  it('S10b: a sink whose running resolves false runs visually and reports it', async () => {
    const { port, events, scheduler, begin, advance, frames, beats } = setup({
      sink: 'unavailable'
    });
    await begin({ bpm: 120 });
    advance(1000);
    frames.flush();
    expect(events.onSoundUnavailable).toHaveBeenCalledOnce();
    expect(port.sources.length).toBe(0);
    expect(beats.length).toBeGreaterThan(0);
    scheduler.halt('leave');
  });

  it('S11: beats = 1 makes every click accented', async () => {
    const { port, scheduler, begin, advance } = setup();
    await begin({ beats: 1, bpm: 120 });
    advance(2000);
    const bufs = new Set((port.sources as unknown as FakeSource[]).map((s) => s.buffer));
    expect(bufs.size).toBe(1);
    for (let k = 0; k < 8; k++) {
      expect(clickAt({ anchor: 0, period: 0.5, startBeat: 1, beats: 1 }, k)).toMatchObject({
        beat: 1,
        accent: true
      });
    }
    scheduler.halt('leave');
  });

  it('S12: the two click buffers are created once per sink', async () => {
    const { port, scheduler, begin, advance } = setup();
    await begin({ bpm: 240 });
    advance(3000);
    expect(port.sources.length).toBeGreaterThan(10);
    expect(port.buffers.length).toBe(2);
    scheduler.halt('pause');
    await begin({ bpm: 240 });
    advance(1000);
    expect(port.buffers.length).toBe(2);
    scheduler.halt('leave');
  });

  it('reports onSuspended when a suspended context cannot resume', async () => {
    const { port, events, scheduler, begin, advance } = setup();
    await begin();
    port.state = 'suspended';
    port.resumeMode = 'reject';
    advance(50);
    await Promise.resolve();
    await Promise.resolve();
    expect(events.onSuspended).toHaveBeenCalledOnce();
    expect(scheduler.live).toBe(false);
  });
});
