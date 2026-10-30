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
  const order: string[] = [];
  const countIns: number[] = [];
  const events: SchedulerEvents = {
    onBeat: (b) => {
      beats.push(b);
      order.push('beat');
    },
    onCountIn: (c) => {
      countIns.push(c);
      order.push('count-in');
    },
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
  return { port, clock, frames, events, beats, countIns, order, scheduler, advance, begin, starts };
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
    expect(frozen).toEqual({ kind: 'beat', beat: 3 });
    const startsBefore = port.sources.length;
    beats.length = 0;
    await begin({ startBeat: ((frozen.kind === 'beat' ? frozen.beat : 0) % 4) + 1 });
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
      expect(beat).toEqual({ kind: 'beat', beat: 2 });
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
    expect(scheduler.halt('pause')).toEqual({ kind: 'none' });
  });

  it('T031: pausing right after a beat click, and after some soft clicks, returns that beat', async () => {
    const a = setup();
    await a.begin({ bpm: 120, clicksPerBeat: 4 });
    a.advance(1030, 1); // beat 3 click at 1.02 only
    expect(a.scheduler.halt('pause')).toEqual({ kind: 'beat', beat: 3 });
    const b = setup();
    await b.begin({ bpm: 120, clicksPerBeat: 4 });
    b.advance(1020 + 130 + 10, 1); // beat 3 + two soft clicks
    expect(b.scheduler.halt('pause')).toEqual({ kind: 'beat', beat: 3 });
  });

  it('T031: resume begins with the next beat click ≤ 50 ms after the press, then its sub clicks', async () => {
    const { port, scheduler, begin, advance } = setup();
    await begin({ bpm: 120, clicksPerBeat: 3 });
    advance(1100, 1);
    const frozen = scheduler.halt('pause');
    expect(frozen).toEqual({ kind: 'beat', beat: 3 });
    const before = port.sources.length;
    const pressed = port.currentTime;
    await begin({ startBeat: ((frozen.kind === 'beat' ? frozen.beat : 0) % 4) + 1, clicksPerBeat: 3, run: 2 });
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

describe('count-in (033, contracts/click-engine-api.md E1–E9)', () => {
  it('E1: absent countIn, total = from and total 0 reproduce the 032 schedule', async () => {
    const runs: number[][] = [];
    for (const countIn of [undefined, { from: 2, total: 2 }, { from: 0, total: 0 }]) {
      const { scheduler, begin, advance, starts, port } = setup();
      port.currentTime = 5;
      await begin({ bpm: 100, clicksPerBeat: 3, countIn });
      advance(4000);
      runs.push(starts());
      scheduler.halt('leave');
    }
    expect(runs[1]).toEqual(runs[0]);
    expect(runs[2]).toEqual(runs[0]);
  });

  it('E2: grid timing over BPM 30–300 × r 0–8 × n 1–8 and one beat between last count-in and first loop', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 30, max: 300 }),
        fc.integer({ min: 0, max: 8 }),
        fc.integer({ min: 1, max: 8 }),
        (bpm, r, n) => {
          const T = 60 / bpm;
          const seg = {
            anchor: 3.5,
            period: T,
            perBeat: n,
            startBeat: 1,
            beats: 4,
            countInRemaining: r,
            countInFrom: 0
          };
          for (let i = 0; i < r; i++) {
            expect(Math.abs(clickAt(seg, i).when - (3.5 + i * T))).toBeLessThan(0.002);
          }
          for (let j = 0; j < 20; j++) {
            const ideal = 3.5 + r * T + (j * T) / n;
            expect(Math.abs(clickAt(seg, r + j).when - ideal)).toBeLessThan(0.002);
          }
          if (r > 0) {
            expect(
              Math.abs(clickAt(seg, r).when - clickAt(seg, r - 1).when - T)
            ).toBeLessThan(0.002);
          }
        }
      )
    );
  });

  it('E3: count-in clicks are accented, no sub/normal precedes the first loop click', async () => {
    const { scheduler, begin, advance, starts, port } = setup();
    await begin({ bpm: 120, clicksPerBeat: 3, countIn: { from: 0, total: 3 } });
    advance(3000);
    const sources = port.sources as unknown as FakeSource[];
    const accent = sources[0].buffer;
    for (let i = 0; i < 3; i++) {
      expect(sources[i].buffer).toBe(accent);
      expect(sources[i].startCalls.length).toBe(1);
    }
    expect(sources[3].buffer).toBe(accent); // loop beat 1 is accented too
    expect(sources[4].buffer).not.toBe(accent); // then a sub click
    expect(starts().length).toBeGreaterThan(5);
    scheduler.halt('leave');
  });

  it('E4: the first click (count-in) is at anchor within START_LEAD_S', async () => {
    const { scheduler, begin, starts, port } = setup();
    port.currentTime = 10;
    await begin({ countIn: { from: 0, total: 4 } });
    expect(starts()[0]).toBeCloseTo(10 + START_LEAD_S, 9);
    scheduler.halt('leave');
  });

  it('E5: onCountIn(from+c+1) once per count-in click, then onBeat; never interleaved', async () => {
    const { scheduler, begin, advance, frames, countIns, beats, order } = setup();
    await begin({ bpm: 120, countIn: { from: 1, total: 4 } });
    for (let i = 0; i < 160; i++) {
      advance(25);
      frames.flush();
    }
    expect(countIns).toEqual([2, 3, 4]);
    expect(beats.slice(0, 3)).toEqual([1, 2, 3]);
    expect(order.slice(0, 5)).toEqual(['count-in', 'count-in', 'count-in', 'beat', 'beat']);
    expect(order.lastIndexOf('count-in')).toBeLessThan(order.indexOf('beat'));
    scheduler.halt('leave');
  });

  it('E6: halt returns the last audible slot and stops pending sources', async () => {
    const mid = setup();
    await mid.begin({ bpm: 60, countIn: { from: 0, total: 4 } });
    mid.advance(1500); // clicks at .02, 1.02 sounded
    const pendingSources = (mid.port.sources as unknown as FakeSource[]).filter(
      (s) => s.startCalls[0] > mid.port.currentTime
    );
    expect(pendingSources.length).toBeGreaterThan(0);
    expect(mid.scheduler.halt('pause')).toEqual({ kind: 'count-in', click: 2 });
    for (const s of pendingSources) expect(s.stopCalls.length).toBe(1);

    const loop = setup();
    await loop.begin({ bpm: 120, countIn: { from: 0, total: 2 } });
    loop.advance(1600); // loop beat 2 at 1.52
    expect(loop.scheduler.halt('pause')).toEqual({ kind: 'beat', beat: 2 });

    const none = setup();
    await none.begin({ bpm: 120, countIn: { from: 0, total: 2 } });
    expect(none.scheduler.halt('pause')).toEqual({ kind: 'none' });
    expect(none.scheduler.halt('pause')).toEqual({ kind: 'none' });
  });

  it('E7: after a pump gap nothing in the past is scheduled; past the count-in reports onBeat', async () => {
    const { port, scheduler, begin, advance, frames, starts, countIns, beats } = setup();
    await begin({ bpm: 120, countIn: { from: 0, total: 2 } });
    advance(25);
    frames.flush();
    countIns.length = 0;
    const n = starts().length;
    port.currentTime += 10.1;
    const now = port.currentTime;
    advance(25);
    frames.flush();
    const added = starts().slice(n);
    expect(added.length).toBeGreaterThan(0);
    expect(added.every((w) => w >= now)).toBe(true);
    expect(countIns).toEqual([]);
    expect(beats.length).toBeGreaterThan(0);
    scheduler.halt('leave');
  });

  it('E8: a second start() while live is ignored', async () => {
    const { port, scheduler, begin } = setup();
    await begin({ countIn: { from: 0, total: 4 } });
    const n = port.sources.length;
    scheduler.start({
      bpm: 200,
      beats: 3,
      startBeat: 1,
      clicksPerBeat: 1,
      countIn: { from: 0, total: 8 },
      run: 2,
      pressedAtMs: 0
    });
    await Promise.resolve();
    expect(port.sources.length).toBe(n);
    scheduler.halt('leave');
  });

  it('E9: with no sink the same grid drives onCountIn then onBeat from the clock', async () => {
    const { scheduler, begin, advance, frames, countIns, beats } = setup({ sink: 'none' });
    await begin({ bpm: 120, countIn: { from: 2, total: 4 } });
    for (let i = 0; i < 100; i++) {
      advance(25);
      frames.flush();
    }
    expect(countIns).toEqual([3, 4]);
    expect(beats.slice(0, 2)).toEqual([1, 2]);
    scheduler.halt('leave');
  });

  it('plays clicks 3 and 4 then the loop for {from:2,total:4}; invalid specs fall back to none', async () => {
    const ok = setup();
    ok.port.currentTime = 1;
    await ok.begin({ bpm: 60, countIn: { from: 2, total: 4 } });
    ok.advance(3000);
    const t = ok.starts();
    expect(t[1] - t[0]).toBeCloseTo(1, 9);
    expect(t[2] - t[1]).toBeCloseTo(1, 9);
    ok.scheduler.halt('leave');

    const plain = setup();
    plain.port.currentTime = 1;
    await plain.begin({ bpm: 60 });
    plain.advance(3000);
    for (const bad of [
      { from: 0, total: 2.5 },
      { from: 3, total: 2 },
      { from: 0, total: 9 },
      { from: -1, total: 2 }
    ]) {
      const bx = setup();
      bx.port.currentTime = 1;
      await bx.begin({ bpm: 60, countIn: bad });
      bx.advance(3000);
      expect(bx.starts()).toEqual(plain.starts());
      bx.scheduler.halt('leave');
    }
    plain.scheduler.halt('leave');
  });

  it('clickAt carries countIn and negative slots on the combined grid', () => {
    const seg = {
      anchor: 0,
      period: 0.5,
      perBeat: 2,
      startBeat: 1,
      beats: 4,
      countInRemaining: 2,
      countInFrom: 2
    };
    expect(clickAt(seg, 0)).toMatchObject({ slot: -2, beat: 0, countIn: 3, kind: 'accent' });
    expect(clickAt(seg, 1)).toMatchObject({ slot: -1, countIn: 4 });
    expect(clickAt(seg, 2)).toMatchObject({ slot: 0, beat: 1, countIn: null, kind: 'accent' });
    expect(clickAt(seg, 3)).toMatchObject({ slot: 0, kind: 'sub', when: 1.25 });
    expect(skipTo(seg, 0.6)).toBe(2);
  });

  it('log entries carry countIn and negative slot', async () => {
    globalThis.__fmAudioLog = [];
    const { scheduler, begin, advance } = setup();
    await begin({ bpm: 120, countIn: { from: 0, total: 2 } });
    advance(2000);
    scheduler.halt('leave');
    const clicks = (globalThis.__fmAudioLog as unknown as { type: string }[]).filter(
      (e) => e.type === 'click'
    ) as unknown as { index: number; slot: number; beat: number; countIn: number | null }[];
    expect(clicks.slice(0, 3).map((c) => [c.index, c.slot, c.beat, c.countIn])).toEqual([
      [0, -2, 0, 1],
      [1, -1, 0, 2],
      [2, 0, 1, null]
    ]);
    globalThis.__fmAudioLog = [];
  });
});
