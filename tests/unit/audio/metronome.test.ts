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
    clicksPerBeat: 1,
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
          const c = clickAt({ anchor: 1.25, period, perBeat: 1, startBeat: 1, beats: 4 }, k);
          expect(Math.abs(c.when - (1.25 + (k * 60) / bpm))).toBeLessThan(1e-9);
        }
      )
    );
  });

  it('skipTo returns the first index not in the past', () => {
    const seg = { anchor: 1, period: 0.5, perBeat: 1 };
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
    scheduler.start({ bpm: 200, beats: 3, startBeat: 1, clicksPerBeat: 1, run: 2, pressedAtMs: 0 });
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
      expect(
        clickAt({ anchor: 0, period: 0.5, perBeat: 1, startBeat: 1, beats: 1 }, k)
      ).toMatchObject({
        beat: 1,
        accent: true
      });
    }
    scheduler.halt('leave');
  });

  it('S12: the three click buffers are created once per sink', async () => {
    const { port, scheduler, begin, advance } = setup();
    await begin({ bpm: 240 });
    advance(3000);
    expect(port.sources.length).toBeGreaterThan(10);
    expect(port.buffers.length).toBe(3);
    scheduler.halt('pause');
    await begin({ bpm: 240 });
    advance(1000);
    expect(port.buffers.length).toBe(3);
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

describe('subdivisions (032)', () => {
  const grid = (perBeat: number, over = {}) => ({
    anchor: 2,
    period: 0.5,
    perBeat,
    startBeat: 1,
    beats: 4,
    ...over
  });

  it('clickAt with perBeat 3 places soft clicks at thirds of the period', () => {
    const kinds = [0, 1, 2, 3, 4, 5, 6].map((j) => clickAt(grid(3), j));
    kinds.forEach((c, j) => {
      expect(c.when).toBeCloseTo(2 + (j * 0.5) / 3, 12);
      expect(c.slot).toBe(Math.floor(j / 3));
    });
    expect(kinds.map((c) => c.kind)).toEqual([
      'accent',
      'sub',
      'sub',
      'normal',
      'sub',
      'sub',
      'normal'
    ]);
    expect(kinds.map((c) => c.beat)).toEqual([1, 1, 1, 2, 2, 2, 3]);
  });

  it('beat wraps and honours startBeat', () => {
    expect(clickAt(grid(2, { startBeat: 4 }), 2)).toMatchObject({ beat: 1, kind: 'accent' });
    expect(clickAt(grid(2, { startBeat: 4 }), 1)).toMatchObject({ beat: 4, kind: 'sub' });
  });

  it('perBeat 1 gives the 031 sequence', () => {
    for (let j = 0; j < 9; j++) {
      const c = clickAt(grid(1), j);
      expect(c.when).toBeCloseTo(2 + j * 0.5, 12);
      expect(c.kind).toBe(c.beat === 1 ? 'accent' : 'normal');
    }
  });

  it('skipTo counts grid clicks, not beats', () => {
    const g = grid(4);
    const k = skipTo(g, 10);
    expect(clickAt(g, k).when).toBeGreaterThanOrEqual(10);
    expect(clickAt(g, k - 1).when).toBeLessThan(10 + START_LEAD_S);
  });

  it('schedules three clicks per beat with the right buffers', async () => {
    const { port, scheduler, begin, advance } = setup();
    await begin({ bpm: 120, clicksPerBeat: 3 });
    advance(1200);
    const sources = port.sources as unknown as FakeSource[];
    const t = sources.map((s) => s.startCalls[0]);
    expect(t[1] - t[0]).toBeCloseTo(0.5 / 3, 9);
    const [accent, sub1, sub2, normal] = sources.map((s) => s.buffer);
    expect(sub1).toBe(sub2);
    expect(new Set([accent, sub1, normal]).size).toBe(3);
    expect(sources[4].buffer).toBe(sub1);
    expect(sources[6].buffer).toBe(accent === sources[6].buffer ? accent : normal);
    scheduler.halt('leave');
  });

  it('onBeat fires once per slot and never for sub clicks', async () => {
    const { scheduler, begin, advance, frames, beats } = setup();
    await begin({ bpm: 120, clicksPerBeat: 4 });
    for (let i = 0; i < 100; i++) {
      advance(25);
      frames.flush();
    }
    expect(beats.slice(0, 5)).toEqual([1, 2, 3, 4, 1]);
    scheduler.halt('leave');
  });

  it.each([0, 9, 2.5, NaN])('clicksPerBeat %s behaves as 1', async (n) => {
    const { port, scheduler, begin, advance } = setup();
    await begin({ bpm: 120, clicksPerBeat: n });
    advance(1200);
    const t = (port.sources as unknown as FakeSource[]).map((s) => s.startCalls[0]);
    expect(t[1] - t[0]).toBeCloseTo(0.5, 9);
    scheduler.halt('leave');
  });
});

describe('high-speed exactness (032 US3)', () => {
  it('T030: every grid click is within 2 ms of the ideal time, BPM 30–300 × n 1–8, 10 min', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 30, max: 300 }),
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 0, max: 600 * 40 }),
        (bpm, n, jRaw) => {
          const j = Math.min(jRaw, Math.floor((600 * bpm * n) / 60));
          const g = { anchor: 3.5, period: 60 / bpm, perBeat: n, startBeat: 1, beats: 4 };
          const c = clickAt(g, j);
          expect(Math.abs(c.when - (3.5 + (j * 60) / (bpm * n)))).toBeLessThan(0.002);
        }
      )
    );
  });

  it('T030: scheduled start(when) equals the ideal time for 60 s at 300 BPM × 8', async () => {
    const { port, scheduler, begin, advance, starts } = setup();
    await begin({ bpm: 300, clicksPerBeat: 8 });
    advance(60_000);
    const all = starts();
    const first = all[0];
    const sources = port.sources as unknown as FakeSource[];
    expect(first).toBeCloseTo(START_LEAD_S, 9);
    // 40 clicks/s × 60 s = 2400 within the scheduled window (± horizon lookahead).
    const inWindow = all.filter((w) => w < first + 60 - 1e-9);
    expect(Math.abs(inWindow.length - 2400)).toBeLessThanOrEqual(1);
    all.forEach((w, k) => expect(Math.abs(w - (first + (k * 60) / (300 * 8)))).toBeLessThan(1e-9));
    for (let k = 1; k < all.length; k++) expect(all[k] - all[k - 1]).toBeCloseTo(0.025, 9);
    expect(new Set(all).size).toBe(all.length);
    expect(sources.length).toBe(all.length);
    scheduler.halt('leave');
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    'T031: halt() mid-beat stops every pending source and returns the last audible beat (n = %i)',
    async (n) => {
      const { port, scheduler, begin, advance, starts } = setup();
      await begin({ bpm: 120, clicksPerBeat: n });
      // Beat 2 starts at 0.52; stop 0.5 / n / 2 s into it (between clicks).
      advance(520 + Math.round(250 / n / 2) + 1, 1);
      const t = port.currentTime;
      const future = (port.sources as unknown as FakeSource[]).filter((s) => s.startCalls[0] > t);
      expect(future.length).toBeGreaterThan(0);
      const beat = scheduler.halt('pause');
      expect(beat).toBe(2);
      for (const s of future) expect(s.stopCalls.length).toBe(1);
      const count = starts().length;
      advance(5000);
      expect(starts().length).toBe(count);
      expect(
        starts()
          .filter((w) => w > t)
          .every((w) => w <= t + HORIZON_S + 0.5)
      ).toBe(true);
    }
  );

  it('T031: halt before any click sounded returns 0', async () => {
    const { scheduler, begin } = setup();
    await begin({ bpm: 120, clicksPerBeat: 4 });
    expect(scheduler.halt('pause')).toBe(0);
  });

  it('T031: pausing right after a beat click, and after some soft clicks, returns that beat', async () => {
    const a = setup();
    await a.begin({ bpm: 120, clicksPerBeat: 4 });
    a.advance(1030, 1); // beat 3 click at 1.02 only
    expect(a.scheduler.halt('pause')).toBe(3);
    const b = setup();
    await b.begin({ bpm: 120, clicksPerBeat: 4 });
    b.advance(1020 + 130 + 10, 1); // beat 3 + two soft clicks
    expect(b.scheduler.halt('pause')).toBe(3);
  });

  it('T031: resume begins with the next beat click ≤ 50 ms after the press, then its sub clicks', async () => {
    const { port, scheduler, begin, advance } = setup();
    await begin({ bpm: 120, clicksPerBeat: 3 });
    advance(1100, 1);
    const frozen = scheduler.halt('pause');
    expect(frozen).toBe(3);
    const before = port.sources.length;
    const pressed = port.currentTime;
    await begin({ startBeat: (frozen % 4) + 1, clicksPerBeat: 3, run: 2 });
    advance(400, 1);
    const fresh = (port.sources.slice(before) as unknown as FakeSource[]).map(
      (s) => [s.startCalls[0], s.buffer] as const
    );
    expect(fresh[0][0] - pressed).toBeLessThanOrEqual(0.05);
    expect(fresh[0][0] - pressed).toBeGreaterThanOrEqual(0);
    // Beat 4 is a normal click; its two sub clicks share a different buffer.
    expect(fresh[1][1]).toBe(fresh[2][1]);
    expect(fresh[0][1]).not.toBe(fresh[1][1]);
    expect(fresh[1][0] - fresh[0][0]).toBeCloseTo(0.5 / 3, 9);
  });

  it('T032: after a pump gap scheduling resumes at skipTo, with no catch-up burst', async () => {
    const { port, scheduler, begin, advance, starts, frames, beats } = setup();
    await begin({ bpm: 120, clicksPerBeat: 3 });
    advance(100);
    const n = starts().length;
    port.currentTime += 20.07;
    const now = port.currentTime;
    const anchor = starts()[0];
    advance(25);
    const added = starts().slice(n);
    expect(added.length).toBeGreaterThan(0);
    expect(added.every((w) => w >= now)).toBe(true);
    expect(added[0]).toBeCloseTo(
      anchor + (skipTo({ anchor, period: 0.5, perBeat: 3 }, now) * 0.5) / 3,
      9
    );
    expect(added.length).toBeLessThanOrEqual(Math.ceil((HORIZON_S * 6) / 1) + 2);
    frames.flush();
    // The displayed beat is the slot of the last grid click reached.
    const lastReached = Math.floor((now - anchor) / (0.5 / 3) + 1e-9);
    expect(beats.at(-1)).toBe((Math.floor(lastReached / 3) % 4) + 1);
    scheduler.halt('leave');
  });

  it.each([1, 3, 8])('T032: skipTo returns the first not-past grid index (n = %i)', (n) => {
    const seg = { anchor: 2, period: 0.5, perBeat: n };
    for (const now of [0, 2, 2.01, 7.3, 100.123]) {
      const k = skipTo(seg, now);
      const step = 0.5 / n;
      expect(2 + k * step).toBeGreaterThanOrEqual(now + START_LEAD_S - 1e-9);
      if (k > 0) expect(2 + (k - 1) * step).toBeLessThan(now + START_LEAD_S);
    }
  });
});
