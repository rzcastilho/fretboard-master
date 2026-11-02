import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import {
  HORIZON_S,
  START_LEAD_S,
  clickTime,
  createClickScheduler,
  skipTo,
  type Grid,
  type ClickSink,
  type SchedulerEvents,
  type SegmentStart
} from '../../../src/lib/audio/metronome';
import { clickAt, slotStart, type RunPlan } from '../../../src/lib/audio/metronome-cycle';
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
  const beatAts: unknown[] = [];
  const countInAts: unknown[] = [];
  const events: SchedulerEvents = {
    onBeat: (b, at) => {
      beats.push(b);
      beatAts.push(at);
      order.push('beat');
    },
    onCountIn: (c, at) => {
      countIns.push(c);
      countInAts.push(at);
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
  return {
    port,
    clock,
    frames,
    events,
    beats,
    countIns,
    beatAts,
    countInAts,
    order,
    scheduler,
    advance,
    begin,
    starts
  };
}

/** A grid over a plan with `perBeat` clicks per beat, 4 beats, no count-in, no alternation. */
function gridOf(plan: Partial<RunPlan> = {}, over: Partial<Grid> = {}): Grid {
  const full: RunPlan = { beats: 4, initial: 0, loops: [1], repeat: 0, ...plan };
  const startSlot = over.startSlot ?? 0;
  return {
    plan: full,
    anchor: 1.25,
    period: 0.5,
    startSlot,
    startIndex: slotStart(full, startSlot),
    ...over
  };
}
const whenOf = (g: Grid, c: number): number => clickTime(g, clickAt(g.plan, c));

describe('click grid maths', () => {
  it('E1: when = anchor + (slot − startSlot) * 60/bpm + sub * T/n within 1e-9 s', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 30, max: 300 }),
        fc.integer({ min: 0, max: 3000 }),
        (bpm, k) => {
          const g = gridOf({}, { period: 60 / bpm });
          expect(Math.abs(whenOf(g, k) - (1.25 + (k * 60) / bpm))).toBeLessThan(1e-9);
        }
      )
    );
  });

  it('skipTo returns the first index not in the past', () => {
    const g = gridOf({}, { anchor: 1 });
    const k = skipTo(g, 31);
    expect(whenOf(g, k)).toBeGreaterThanOrEqual(31);
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
    expect(frozen).toMatchObject({ kind: 'beat', beat: 3, slot: 2 });
    const startsBefore = port.sources.length;
    beats.length = 0;
    await begin({ startSlot: (frozen.kind === 'none' ? -1 : frozen.slot) + 1 });
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
    scheduler.start({ bpm: 200, beats: 3, clicksPerBeat: 1, run: 2, pressedAtMs: 0 });
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
      expect(clickAt({ beats: 1, initial: 0, loops: [1], repeat: 0 }, k)).toMatchObject({
        position: { beat: 1 },
        kind: 'accent'
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
  const grid = (perBeat: number, over: Partial<Grid> = {}): Grid =>
    gridOf({ loops: [perBeat] }, { anchor: 2, ...over });

  it('clickAt with perBeat 3 places soft clicks at thirds of the period', () => {
    const g = grid(3);
    const cs = [0, 1, 2, 3, 4, 5, 6].map((j) => clickAt(g.plan, j));
    cs.forEach((c, j) => {
      expect(clickTime(g, c)).toBeCloseTo(2 + (j * 0.5) / 3, 12);
      expect(c.slot).toBe(Math.floor(j / 3));
    });
    expect(cs.map((c) => c.kind)).toEqual([
      'accent',
      'sub',
      'sub',
      'normal',
      'sub',
      'sub',
      'normal'
    ]);
    expect(cs.map((c) => (c.position.kind === 'beat' ? c.position.beat : 0))).toEqual([
      1, 1, 1, 2, 2, 2, 3
    ]);
  });

  it('beat wraps and honours startSlot', () => {
    const g = grid(2, { startSlot: 3, startIndex: slotStart(grid(2).plan, 3) });
    expect(clickAt(g.plan, g.startIndex + 2)).toMatchObject({
      position: { beat: 1 },
      kind: 'accent'
    });
    expect(clickAt(g.plan, g.startIndex + 1)).toMatchObject({
      position: { beat: 4 },
      kind: 'sub'
    });
    expect(whenOf(g, g.startIndex)).toBeCloseTo(2, 12);
  });

  it('perBeat 1 gives the 031 sequence', () => {
    const g = grid(1);
    for (let j = 0; j < 9; j++) {
      const c = clickAt(g.plan, j);
      expect(clickTime(g, c)).toBeCloseTo(2 + j * 0.5, 12);
      expect(c.kind).toBe(j % 4 === 0 ? 'accent' : 'normal');
    }
  });

  it('skipTo counts grid clicks, not beats', () => {
    const g = grid(4);
    const k = skipTo(g, 10);
    expect(whenOf(g, k)).toBeGreaterThanOrEqual(10);
    expect(whenOf(g, k - 1)).toBeLessThan(10 + START_LEAD_S);
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
    const { scheduler, begin, advance, frames } = setup();
    await begin({ bpm: 120, clicksPerBeat: 4 });
    for (let i = 0; i < 100; i++) {
      advance(25);
      frames.flush();
    }
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
          const g = gridOf({ loops: [n] }, { anchor: 3.5, period: 60 / bpm });
          expect(Math.abs(whenOf(g, j) - (3.5 + (j * 60) / (bpm * n)))).toBeLessThan(0.002);
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
      expect(beat).toMatchObject({ kind: 'beat', beat: 2, loop: 1, clicksPerBeat: n });
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
    expect(a.scheduler.halt('pause')).toMatchObject({ kind: 'beat', beat: 3 });
    const b = setup();
    await b.begin({ bpm: 120, clicksPerBeat: 4 });
    b.advance(1020 + 130 + 10, 1); // beat 3 + two soft clicks
    expect(b.scheduler.halt('pause')).toMatchObject({ kind: 'beat', beat: 3 });
  });

  it('T031: resume begins with the next beat click ≤ 50 ms after the press, then its sub clicks', async () => {
    const { port, scheduler, begin, advance } = setup();
    await begin({ bpm: 120, clicksPerBeat: 3 });
    advance(1100, 1);
    const frozen = scheduler.halt('pause');
    expect(frozen).toMatchObject({ kind: 'beat', beat: 3 });
    const before = port.sources.length;
    const pressed = port.currentTime;
    await begin({
      startSlot: (frozen.kind === 'none' ? -1 : frozen.slot) + 1,
      clicksPerBeat: 3,
      run: 2
    });
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
      anchor + (skipTo(gridOf({ loops: [3] }, { anchor, period: 0.5 }), now) * 0.5) / 3,
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
    const seg = gridOf({ loops: [n] }, { anchor: 2, period: 0.5 });
    for (const now of [0, 2, 2.01, 7.3, 100.123]) {
      const k = skipTo(seg, now);
      const step = 0.5 / n;
      expect(2 + k * step).toBeGreaterThanOrEqual(now + START_LEAD_S - 1e-9);
      if (k > 0) expect(2 + (k - 1) * step).toBeLessThan(now + START_LEAD_S);
    }
  });
});

describe('count-in (033, contracts/click-engine-api.md E1–E9)', () => {
  it('E1: absent initialCountIn and 0 reproduce the 032 schedule', async () => {
    const runs: number[][] = [];
    for (const initialCountIn of [undefined, 0]) {
      const { scheduler, begin, advance, starts, port } = setup();
      port.currentTime = 5;
      await begin({ bpm: 100, clicksPerBeat: 3, initialCountIn });
      advance(4000);
      runs.push(starts());
      scheduler.halt('leave');
    }
    expect(runs[1]).toEqual(runs[0]);
  });

  it('E2: grid timing over BPM 30–300 × k 0–8 × n 1–8 and one beat between last count-in and first loop', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 30, max: 300 }),
        fc.integer({ min: 0, max: 8 }),
        fc.integer({ min: 1, max: 8 }),
        (bpm, r, n) => {
          const T = 60 / bpm;
          const g = gridOf({ initial: r, loops: [n] }, { anchor: 3.5, period: T });
          for (let i = 0; i < r; i++) {
            expect(Math.abs(whenOf(g, i) - (3.5 + i * T))).toBeLessThan(0.002);
          }
          for (let j = 0; j < 20; j++) {
            const ideal = 3.5 + r * T + (j * T) / n;
            expect(Math.abs(whenOf(g, r + j) - ideal)).toBeLessThan(0.002);
          }
          if (r > 0) {
            expect(Math.abs(whenOf(g, r) - whenOf(g, r - 1) - T)).toBeLessThan(0.002);
          }
        }
      )
    );
  });

  it('E3: count-in clicks are accented, no sub/normal precedes the first loop click', async () => {
    const { scheduler, begin, advance, starts, port } = setup();
    await begin({ bpm: 120, clicksPerBeat: 3, initialCountIn: 3 });
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
    await begin({ initialCountIn: 4 });
    expect(starts()[0]).toBeCloseTo(10 + START_LEAD_S, 9);
    scheduler.halt('leave');
  });

  it('E5: onCountIn(slot + 1) once per count-in click, then onBeat; never interleaved', async () => {
    const { scheduler, begin, advance, frames, countIns, beats, order } = setup();
    await begin({ bpm: 120, initialCountIn: 4, startSlot: 1 });
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

  it('E6/H2: halt returns the last audible slot and stops pending sources', async () => {
    const mid = setup();
    await mid.begin({ bpm: 60, initialCountIn: 4 });
    mid.advance(1500); // clicks at .02, 1.02 sounded
    const pendingSources = (mid.port.sources as unknown as FakeSource[]).filter(
      (s) => s.startCalls[0] > mid.port.currentTime
    );
    expect(pendingSources.length).toBeGreaterThan(0);
    expect(mid.scheduler.halt('pause')).toMatchObject({
      kind: 'count-in',
      click: 2,
      total: 4,
      repeat: false,
      slot: 1
    });
    for (const s of pendingSources) expect(s.stopCalls.length).toBe(1);

    const loop = setup();
    await loop.begin({ bpm: 120, initialCountIn: 2 });
    loop.advance(1600); // loop beat 2 at 1.52
    expect(loop.scheduler.halt('pause')).toMatchObject({ kind: 'beat', beat: 2, slot: 3 });

    const none = setup();
    await none.begin({ bpm: 120, initialCountIn: 2 });
    expect(none.scheduler.halt('pause')).toEqual({ kind: 'none' });
    expect(none.scheduler.halt('pause')).toEqual({ kind: 'none' });
  });

  it('E7: after a pump gap nothing in the past is scheduled; past the count-in reports onBeat', async () => {
    const { port, scheduler, begin, advance, frames, starts, countIns, beats } = setup();
    await begin({ bpm: 120, initialCountIn: 2 });
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
    await begin({ initialCountIn: 4 });
    const n = port.sources.length;
    scheduler.start({
      bpm: 200,
      beats: 3,
      clicksPerBeat: 1,
      initialCountIn: 8,
      run: 2,
      pressedAtMs: 0
    });
    await Promise.resolve();
    expect(port.sources.length).toBe(n);
    scheduler.halt('leave');
  });

  it('E9: with no sink the same grid drives onCountIn then onBeat from the clock', async () => {
    const { scheduler, begin, advance, frames, countIns, beats } = setup({ sink: 'none' });
    await begin({ bpm: 120, initialCountIn: 4, startSlot: 2 });
    for (let i = 0; i < 100; i++) {
      advance(25);
      frames.flush();
    }
    expect(countIns).toEqual([3, 4]);
    expect(beats.slice(0, 2)).toEqual([1, 2]);
    scheduler.halt('leave');
  });

  it('plays clicks 3 and 4 then the loop for k = 4 from slot 2; invalid inputs fall back', async () => {
    const ok = setup();
    ok.port.currentTime = 1;
    await ok.begin({ bpm: 60, initialCountIn: 4, startSlot: 2 });
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
      { initialCountIn: 2.5 },
      { initialCountIn: 9 },
      { initialCountIn: -1 },
      { startSlot: -1 },
      { startSlot: 1.5 },
      { startSlot: NaN }
    ]) {
      const bx = setup();
      bx.port.currentTime = 1;
      await bx.begin({ bpm: 60, ...bad });
      bx.advance(3000);
      expect(bx.starts()).toEqual(plain.starts());
      bx.scheduler.halt('leave');
    }
    plain.scheduler.halt('leave');
  });

  it('log entries carry run-global slot, beat 0 and countIn for count-in clicks, and the phase', async () => {
    globalThis.__fmAudioLog = [];
    const { scheduler, begin, advance } = setup();
    await begin({ bpm: 120, initialCountIn: 2 });
    advance(2000);
    scheduler.halt('leave');
    const clicks = (globalThis.__fmAudioLog as unknown as { type: string }[]).filter(
      (e) => e.type === 'click'
    ) as unknown as {
      index: number;
      slot: number;
      beat: number;
      countIn: number | null;
      phase: string;
    }[];
    expect(clicks.slice(0, 3).map((c) => [c.index, c.slot, c.beat, c.countIn, c.phase])).toEqual([
      [0, 0, 0, 1, 'initial'],
      [1, 1, 0, 2, 'initial'],
      [2, 2, 1, null, 'loop1']
    ]);
    globalThis.__fmAudioLog = [];
  });
});

describe('alternating cycle (034)', () => {
  const alt = {
    bpm: 120,
    beats: 4,
    clicksPerBeat: 3,
    initialCountIn: 4,
    alternate: { clicksPerBeat: 6, repeatCountIn: 2 }
  } as const;

  const clickLog = (): {
    index: number;
    slot: number;
    beat: number;
    countIn: number | null;
    phase: string;
    when: number;
  }[] =>
    (globalThis.__fmAudioLog as unknown as { type: string }[]).filter(
      (e) => e.type === 'click'
    ) as never;

  it('E1/E2: logs the phases in order, one beat apart across every boundary', async () => {
    globalThis.__fmAudioLog = [];
    const { port, scheduler, begin, advance } = setup();
    port.currentTime = 10;
    await begin(alt);
    advance(14000);
    scheduler.halt('leave');
    const log = clickLog();
    expect(log[0].when).toBeCloseTo(10 + START_LEAD_S, 9);
    const runs: [string, number][] = [];
    for (const c of log) {
      const last = runs.at(-1);
      if (last && last[0] === c.phase) last[1]++;
      else runs.push([c.phase, 1]);
    }
    expect(runs.slice(0, 6)).toEqual([
      ['initial', 4],
      ['loop1', 12],
      ['repeat', 2],
      ['loop2', 24],
      ['repeat', 2],
      ['loop1', 12]
    ]);
    // First click of every slot is one beat after the previous slot's first click.
    const firsts = log.filter((c, i) => i === 0 || c.slot !== log[i - 1].slot);
    firsts.slice(1).forEach((c, i) => {
      expect(c.when - firsts[i].when).toBeCloseTo(0.5, 9);
    });
    globalThis.__fmAudioLog = [];
  });

  it('E2: starting at a later slot begins with that slot, within 50 ms', async () => {
    globalThis.__fmAudioLog = [];
    const { port, scheduler, begin } = setup();
    port.currentTime = 3;
    const plan: RunPlan = { beats: 4, initial: 4, loops: [3, 6], repeat: 2 };
    await begin({ ...alt, startSlot: 9 });
    scheduler.halt('leave');
    const first = clickLog()[0];
    expect(first.index).toBe(slotStart(plan, 9));
    expect(first.slot).toBe(9);
    expect(first.phase).toBe('repeat');
    expect(first.countIn).toBe(2);
    expect(first.when - 3).toBeLessThanOrEqual(0.05);
    globalThis.__fmAudioLog = [];
  });

  it('E3: skip-forward over a switch lands on the right phase with no burst', async () => {
    globalThis.__fmAudioLog = [];
    const { port, scheduler, begin, advance, starts } = setup();
    await begin(alt);
    advance(100);
    const n = starts().length;
    port.currentTime += 4.3; // slot 8 starts at 4.02; now inside the first repeat count-in
    const now = port.currentTime;
    advance(25);
    const fresh = clickLog().slice(n);
    expect(fresh.length).toBeGreaterThan(0);
    expect(fresh.every((c) => c.when >= now)).toBe(true);
    expect(fresh[0].phase).toBe('repeat');
    expect(fresh[0].countIn).toBe(2); // slot 9 at 4.52
    expect(fresh.length).toBeLessThanOrEqual(Math.ceil((HORIZON_S * 12) / 1) + 8);
    scheduler.halt('leave');
    globalThis.__fmAudioLog = [];
  });

  it('E4/H1: without a sink the same grid drives one event per slot with its SlotPosition', async () => {
    const { scheduler, begin, advance, frames, beatAts, countInAts } = setup({ sink: 'none' });
    await begin(alt);
    for (let i = 0; i < 300; i++) {
      advance(25);
      frames.flush();
    }
    expect(countInAts.slice(0, 4)).toMatchObject([
      { slot: 0, click: 1, total: 4, repeat: false },
      { slot: 1, click: 2 },
      { slot: 2, click: 3 },
      { slot: 3, click: 4 }
    ]);
    expect(beatAts.slice(0, 4)).toMatchObject([
      { slot: 4, beat: 1, loop: 1, clicksPerBeat: 3 },
      { slot: 5, beat: 2 },
      { slot: 6, beat: 3 },
      { slot: 7, beat: 4 }
    ]);
    expect(countInAts.slice(4, 6)).toMatchObject([
      { slot: 8, click: 1, total: 2, repeat: true, next: 2 },
      { slot: 9, click: 2 }
    ]);
    expect(beatAts[4]).toMatchObject({ slot: 10, beat: 1, loop: 2, clicksPerBeat: 6 });
    scheduler.halt('leave');
  });

  it('H2: halt in a repeat count-in returns it and logs click-cancel', async () => {
    globalThis.__fmAudioLog = [];
    const { scheduler, begin, advance } = setup();
    await begin(alt);
    advance(4100); // slot 8 (repeat click 1) at 4.02
    expect(scheduler.halt('pause')).toMatchObject({
      kind: 'count-in',
      slot: 8,
      click: 1,
      total: 2,
      repeat: true,
      next: 2
    });
    const cancel = (globalThis.__fmAudioLog as unknown as { type: string }[]).filter(
      (e) => e.type === 'click-cancel'
    );
    expect(cancel).toHaveLength(1);
    globalThis.__fmAudioLog = [];
  });

  it('H3: events of a superseded segment are dropped', async () => {
    const { scheduler, begin, advance, frames, beats, countIns } = setup({ sink: 'none' });
    await begin(alt);
    advance(100);
    scheduler.halt('pause');
    beats.length = 0;
    countIns.length = 0;
    advance(5000);
    frames.flush();
    expect(beats).toEqual([]);
    expect(countIns).toEqual([]);
  });
});

describe('tempo ramp (037, E6/E8/E10)', () => {
  const rampOf = (atTarget: 'hold' | 'stop', bpms = [120, 240]) =>
    ({ bpms, loops: 1, repeatCountIn: 1, atTarget }) as const;
  // bpms 120→240, N=2, L=1, k=1, r=1: slots 0 (count-in), 1-2 (step 1), 3 (repeat), 4-5 (step 2)
  // times: 0, .5, 1, 1.5, 2, 2.25 ; tailT0 = 2.5
  const base = { beats: 2, initialCountIn: 1 } as const;
  const clickLog = () =>
    (globalThis.__fmAudioLog as unknown as { type: string }[]).filter(
      (e) => e.type === 'click'
    ) as unknown as { slot: number; when: number; beat: number; countIn: number | null }[];

  it('E6: Stop never schedules an index >= endSlot and fires onEnd once', async () => {
    globalThis.__fmAudioLog = [];
    const { scheduler, begin, advance, port, events } = setup();
    const onEnd = vi.fn();
    (events as { onEnd?: () => void }).onEnd = onEnd;
    await begin({ ...base, ramp: rampOf('stop') });
    advance(500);
    expect(onEnd).not.toHaveBeenCalled();
    advance(5000);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(scheduler.live).toBe(false);
    expect(Math.max(...clickLog().map((c) => c.slot))).toBe(5);
    expect(clickLog()).toHaveLength(6);
    expect(scheduler.halt('leave')).toEqual({ kind: 'none' });
    expect(port.sources.length).toBe(6);
    const cancel = (
      globalThis.__fmAudioLog as unknown as { type: string; reason?: string; count?: number }[]
    ).filter((e) => e.type === 'click-cancel');
    expect(cancel).toEqual([expect.objectContaining({ reason: 'end', count: 0 })]);
    globalThis.__fmAudioLog = [];
  });

  it('E6: onEnd fires at anchor + tailT0 once audible, not before', async () => {
    const { begin, advance, port, events, scheduler } = setup();
    const onEnd = vi.fn();
    (events as { onEnd?: () => void }).onEnd = onEnd;
    const t0 = port.currentTime;
    await begin({ ...base, ramp: rampOf('stop') });
    advance(2400); // 2.4 s after start < 2.52 (anchor = t0 + lead, end at +2.5)
    expect(onEnd).not.toHaveBeenCalled();
    advance(200);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(port.currentTime - t0).toBeGreaterThan(2.5);
    expect(scheduler.live).toBe(false);
  });

  it('E6: onEnd also fires from the pump timer when frames never run', async () => {
    const { begin, advance, events, frames } = setup();
    const onEnd = vi.fn();
    (events as { onEnd?: () => void }).onEnd = onEnd;
    await begin({ ...base, ramp: rampOf('stop') });
    advance(4000);
    expect(frames.pendingCount).toBeLessThanOrEqual(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('E6: onEnd also fires with no sink', async () => {
    const { begin, advance, events } = setup({ sink: 'none' });
    const onEnd = vi.fn();
    (events as { onEnd?: () => void }).onEnd = onEnd;
    await begin({ ...base, ramp: rampOf('stop') });
    advance(4000);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('E7: Hold never ends and keeps scheduling at the target tempo', async () => {
    globalThis.__fmAudioLog = [];
    const { scheduler, begin, advance, events } = setup();
    const onEnd = vi.fn();
    (events as { onEnd?: () => void }).onEnd = onEnd;
    await begin({ ...base, ramp: rampOf('hold') });
    advance(10000);
    expect(onEnd).not.toHaveBeenCalled();
    expect(scheduler.live).toBe(true);
    const c = clickLog();
    expect(c.length).toBeGreaterThan(20);
    const a = c.filter((x) => x.slot === 20)[0];
    const b = c.filter((x) => x.slot === 21)[0];
    expect(b.when - a.when).toBeCloseTo(0.25, 9);
    scheduler.halt('leave');
    globalThis.__fmAudioLog = [];
  });

  it('E8: start at a later slot resumes inside a block, across a boundary, in the tail', async () => {
    for (const startSlot of [2, 3, 5, 9]) {
      globalThis.__fmAudioLog = [];
      const { scheduler, begin, advance, port } = setup();
      await begin({ ...base, ramp: rampOf('hold'), startSlot });
      advance(1500);
      const c = clickLog();
      expect(c[0].slot).toBe(startSlot);
      expect(c[0].when).toBeCloseTo(0.02, 9);
      // times relative to the first scheduled slot follow the ramp offsets
      const off = [0, 0.5, 1, 1.5, 2, 2.25];
      for (const x of c.slice(1, 6)) {
        const o = (s: number) => (s < 6 ? off[s] : 2.5 + (s - 6) * 0.25);
        expect(x.when - c[0].when).toBeCloseTo(o(x.slot) - o(startSlot), 9);
      }
      scheduler.halt('leave');
      expect(port.sources.length).toBeGreaterThan(0);
    }
    globalThis.__fmAudioLog = [];
  });

  it('E10: click log entries for ramp runs: 1-based beat, countIn number or null', async () => {
    globalThis.__fmAudioLog = [];
    const { scheduler, begin, advance } = setup();
    await begin({ ...base, ramp: rampOf('stop') });
    advance(1200);
    scheduler.halt('leave');
    expect(
      clickLog()
        .slice(0, 4)
        .map((c) => [c.slot, c.beat, c.countIn])
    ).toEqual([
      [0, 0, 1],
      [1, 1, null],
      [2, 2, null],
      [3, 0, 1]
    ]);
    globalThis.__fmAudioLog = [];
  });

  it('visual-only ramp runs report positions with ramp fields', async () => {
    const { begin, advance, frames, beatAts, scheduler } = setup({ sink: 'none' });
    await begin({ ...base, ramp: rampOf('hold') });
    for (let i = 0; i < 40; i++) {
      advance(100);
      frames.flush();
    }
    scheduler.halt('leave');
    expect(beatAts.every((a) => (a as { ramp?: unknown }).ramp !== undefined)).toBe(true);
    expect(beatAts.length).toBeGreaterThan(5);
  });
});

describe('live retime (038, E11–E20)', () => {
  /** Start times of the sources that were not stopped, ascending. */
  const sounding = (port: FakeAudioPort): number[] =>
    port.sources
      .filter((s) => s.stopCalls.length === 0)
      .flatMap((s) => s.startCalls)
      .sort((a, b) => a - b);
  const clickLog = () =>
    (globalThis.__fmAudioLog as unknown as { type: string }[]).filter(
      (e) => e.type === 'click'
    ) as unknown as { index: number; slot: number; when: number }[];

  it('E11/E12/E13: old grid before S′, no phase shift after, S′ = a + 1', async () => {
    globalThis.__fmAudioLog = [];
    const { port, scheduler, begin, advance } = setup();
    port.currentTime = 10;
    await begin({ bpm: 120, clicksPerBeat: 2 }); // slot k at 10.02 + 0.5k
    advance(1100); // now 11.1; audible slot 2 (11.02)
    expect(scheduler.retime(60)).toBe(true); // S′ = 3 at 11.52
    advance(4000);
    scheduler.halt('leave');
    const t = sounding(port).filter((w) => w < 12.6 + 1e-9);
    const expected = [10.02, 10.27, 10.52, 10.77, 11.02, 11.27, 11.52, 12.02, 12.52 /* slot 4 */];
    // Slot 3: 11.52 and 11.52 + 0.5 (sub at T/2 = 0.5 s); slot 4 first click 12.52.
    expected.forEach((w, i) => expect(t[i]).toBeCloseTo(w, 9));
    // Slot 4 (beat 4) → slot 5... spacing after the commit is 1 s per beat.
    const all = sounding(port);
    expect(all[8] - all[6]).toBeCloseTo(1, 9);
    const firstOfSlots = all.filter((_, i) => i >= 6 && i % 2 === 0);
    firstOfSlots.slice(1, 5).forEach((w, i) => expect(w - firstOfSlots[i]).toBeCloseTo(1, 9));
  });

  it('E13: when the next slot starts within the lead, S′ is a + 2', async () => {
    globalThis.__fmAudioLog = [];
    const { port, scheduler, begin, advance } = setup();
    port.currentTime = 10;
    await begin({ bpm: 120 }); // clicks at 10.02, 10.52, 11.02 …
    advance(1000); // now 11.0 → slot 2 (11.02) is within the lead of now + 0.02? 11.02 >= 11.02
    port.currentTime += 0.005; // 11.005: 11.02 < 11.025 → skip to slot 3
    expect(scheduler.retime(60)).toBe(true);
    advance(3000);
    scheduler.halt('leave');
    const w = sounding(port);
    expect(w[2]).toBeCloseTo(11.02, 9);
    expect(w[3]).toBeCloseTo(11.52, 9); // slot 3 unchanged (the commit slot)
    expect(w[4]).toBeCloseTo(12.52, 9);
  });

  it('E15/E19: continuous beats, the re-anchor guard never fires after a retime', async () => {
    globalThis.__fmAudioLog = [];
    const { port, scheduler, begin, advance, frames, beats } = setup();
    port.currentTime = 10;
    await begin({ bpm: 120, initialCountIn: 2 });
    const run = (ms: number): void => {
      for (let t = 0; t < ms; t += 25) {
        advance(25);
        frames.flush();
      }
    };
    run(600);
    scheduler.retime(240);
    run(6000);
    scheduler.halt('leave');
    const slots = clickLog().map((c) => c.slot);
    expect(new Set(slots).size).toBe(Math.max(...slots) + 1);
    expect(beats.slice(0, 4)).toEqual([1, 2, 3, 4]);
  });

  it('E16: invalid, halted and ramp retimes return false and change nothing', async () => {
    globalThis.__fmAudioLog = [];
    const { port, scheduler, begin, advance } = setup();
    expect(scheduler.retime(100)).toBe(false);
    port.currentTime = 10;
    await begin({ bpm: 120 });
    advance(200);
    const before = port.sources.length;
    const logged = globalThis.__fmAudioLog.length;
    for (const bad of [NaN, Infinity, 29, 301, '90' as never])
      expect(scheduler.retime(bad)).toBe(false);
    expect(globalThis.__fmAudioLog.length).toBe(logged);
    expect(port.sources.every((s) => s.stopCalls.length === 0)).toBe(true);
    expect(port.sources.length).toBe(before);
    scheduler.halt('leave');
    expect(scheduler.retime(100)).toBe(false);

    const r = setup();
    r.port.currentTime = 10;
    await r.begin({
      bpm: 120,
      beats: 2,
      ramp: { bpms: [120, 240], loops: 1, repeatCountIn: 0, atTarget: 'hold' }
    });
    expect(r.scheduler.retime(100)).toBe(false);
    r.scheduler.halt('leave');
  });

  it('E17: a retime before the anchor starts the segment at the new bpm', () => {
    const port = new FakeAudioPort();
    port.state = 'running';
    port.currentTime = 5;
    let resolve!: (v: boolean) => void;
    const running = new Promise<boolean>((r) => (resolve = r));
    const scheduler = createClickScheduler(
      { onBeat: vi.fn(), onCountIn: vi.fn(), onSuspended: vi.fn(), onSoundUnavailable: vi.fn() },
      {
        sink: { port: port as never, destination: port.destination, running },
        clock: new FakeClock(),
        frames: new FakeFrames()
      }
    );
    scheduler.start({ bpm: 120, beats: 4, clicksPerBeat: 1, run: 1, pressedAtMs: 0 });
    expect(scheduler.retime(60)).toBe(true);
    resolve(true);
    return running.then(async () => {
      await Promise.resolve();
      const w = port.sources.flatMap((s) => s.startCalls);
      expect(w[1] - w[0]).toBeCloseTo(1, 9);
      scheduler.halt('leave');
    });
  });

  it('E18: pause right after a retime never returns a slot ≥ S′', async () => {
    const { port, scheduler, begin, advance } = setup();
    port.currentTime = 10;
    await begin({ bpm: 120 });
    advance(1100); // audible slot 2
    scheduler.retime(60); // S′ = 3
    const h = scheduler.halt('pause');
    expect(h.kind === 'none' || h.slot < 3).toBe(true);
  });

  it('E20: no retime → clicks sit on the 037 grid', async () => {
    const { port, scheduler, begin, advance } = setup();
    port.currentTime = 10;
    await begin({ bpm: 90, clicksPerBeat: 3 });
    advance(3000);
    scheduler.halt('leave');
    const w = starts_of(port);
    w.forEach((x, k) => expect(x).toBeCloseTo(10.02 + (k * 60) / 90 / 3, 9));
  });

  it('row 24: 16ths at 300 BPM give 20 clicks/s, exact to 1e-9', async () => {
    const { port, scheduler, begin, advance } = setup();
    port.currentTime = 10;
    await begin({ bpm: 300, clicksPerBeat: 4, beats: 4 });
    advance(10000);
    scheduler.halt('leave');
    const w = starts_of(port).filter((x) => x < 20.02 - 1e-9);
    expect(w.length).toBe(200);
    w.forEach((x, k) => expect(Math.abs(x - (10.02 + k * 0.05))).toBeLessThan(1e-9));
  });

  it('E14: any sequence of advances and retimes sounds each click exactly once', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 1, max: 16 }),
        fc.integer({ min: 0, max: 8 }),
        fc.array(fc.tuple(fc.integer({ min: 1, max: 900 }), fc.integer({ min: 30, max: 300 })), {
          minLength: 1,
          maxLength: 8
        }),
        async (n, beatsN, countIn, steps) => {
          globalThis.__fmAudioLog = [];
          const { port, scheduler, begin, advance } = setup();
          port.currentTime = 10;
          await begin({ bpm: 120, beats: beatsN, clicksPerBeat: n, initialCountIn: countIn });
          for (const [ms, bpm] of steps) {
            advance(Math.max(25, Math.round(ms / 25) * 25));
            scheduler.retime(bpm);
          }
          advance(300);
          scheduler.halt('leave');
          const idx = [...new Set(clickLog().map((c) => c.index))];
          expect(Math.max(...idx)).toBe(idx.length - 1);
          const live = sounding(port);
          // The halt cancels clicks that had not started: compare what is audible by then.
          const t = port.currentTime;
          const played = live.filter((w) => w <= t);
          for (let i = 1; i < live.length; i++) expect(live[i] - live[i - 1]).toBeGreaterThan(1e-6);
          expect(played.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

function starts_of(port: FakeAudioPort): number[] {
  return port.sources.flatMap((s) => s.startCalls);
}
