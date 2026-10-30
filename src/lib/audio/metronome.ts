/**
 * Click scheduler (031, contracts/click-engine-api.md §2). Framework-free: no Svelte, `$app/*`,
 * i18n, state, shell or prefs imports. Click k of a segment starts at `anchor + k × period`
 * (never accumulated), scheduled ahead on the audio clock; the beat shown to the user follows
 * the audible time through animation frames.
 */
import { CLICK_S, renderClick, type ClickKind } from './click';
import type { AudioPort, TimerClock } from './engine';
import { log } from './log';

export const START_LEAD_S = 0.02;
export const HORIZON_S = 1.5;
export const TICK_MS = 25;

export type ClickPort = AudioPort;

export interface ClickSink {
  readonly port: ClickPort;
  readonly destination: AudioNode;
  readonly running: Promise<boolean>;
}

export interface FrameClock {
  request(cb: () => void): number;
  cancel(id: number): void;
}

export interface SchedulerDeps {
  readonly sink: ClickSink | null;
  readonly clock: TimerClock;
  readonly frames: FrameClock;
}

export interface SchedulerEvents {
  onBeat(beat: number): void;
  /** A count-in click became audible; 1-based in the run's numbering (`from + 1 … total`). */
  onCountIn(click: number): void;
  onSuspended(): void;
  onSoundUnavailable(): void;
}

export interface CountInSpan {
  /** Clicks already played, 0…total. */
  readonly from: number;
  /** Clicks in the whole count-in, 0–8. */
  readonly total: number;
}

export interface SegmentStart {
  readonly bpm: number;
  readonly beats: number;
  readonly startBeat: number;
  /** Clicks per beat, 1–8: the beat click plus n − 1 soft ones. Anything else counts as 1. */
  readonly clicksPerBeat: number;
  /** Accented count-in clicks before the loop; absent or invalid means none. */
  readonly countIn?: CountInSpan;
  readonly run: number;
  readonly pressedAtMs: number;
}

export type HaltReason = 'pause' | 'reset' | 'leave' | 'suspend';

export type HaltedAt =
  | { readonly kind: 'count-in'; readonly click: number }
  | { readonly kind: 'beat'; readonly beat: number }
  | { readonly kind: 'none' };

export interface ClickScheduler {
  start(segment: SegmentStart): void;
  halt(reason: HaltReason): HaltedAt;
  readonly live: boolean;
}

interface Grid {
  readonly anchor: number;
  readonly period: number;
  readonly perBeat: number;
  readonly startBeat: number;
  readonly beats: number;
  /** Count-in clicks still to play at the segment start (r); absent = 0. */
  readonly countInRemaining?: number;
  /** Count-in clicks already played before this segment; absent = 0. */
  readonly countInFrom?: number;
}

export interface GridClick {
  readonly index: number;
  readonly when: number;
  /** `c − r` (negative) for count-in clicks, `floor(j / perBeat)` for loop clicks. */
  readonly slot: number;
  /** 0 for count-in clicks. */
  readonly beat: number;
  /** `from + c + 1` for count-in clicks, else null. */
  readonly countIn: number | null;
  readonly kind: ClickKind;
  readonly accent: boolean;
}

/**
 * Combined grid click `c`: count-in clicks `c < r` at `anchor + c × period`, then loop click
 * `j = c − r` at `anchor + r × period + j × period / perBeat`. Never accumulated.
 */
export function clickAt(seg: Grid, c: number): GridClick {
  const r = seg.countInRemaining ?? 0;
  if (c < r) {
    return {
      index: c,
      when: seg.anchor + c * seg.period,
      slot: c - r,
      beat: 0,
      countIn: (seg.countInFrom ?? 0) + c + 1,
      kind: 'accent',
      accent: true
    };
  }
  const j = c - r;
  const slot = Math.floor(j / seg.perBeat);
  const beat = ((((seg.startBeat - 1 + slot) % seg.beats) + seg.beats) % seg.beats) + 1;
  const kind: ClickKind = j % seg.perBeat !== 0 ? 'sub' : beat === 1 ? 'accent' : 'normal';
  return {
    index: c,
    when: seg.anchor + r * seg.period + (j * seg.period) / seg.perBeat,
    slot,
    beat,
    countIn: null,
    kind,
    accent: kind === 'accent'
  };
}

/** First grid click worth scheduling at `now` (skip-forward, never a burst). */
export function skipTo(
  seg: { anchor: number; period: number; perBeat: number; countInRemaining?: number },
  now: number
): number {
  const r = seg.countInRemaining ?? 0;
  const u = now + START_LEAD_S - seg.anchor;
  if (u <= 0) return 0;
  if (u <= r * seg.period) return Math.ceil(u / seg.period);
  return r + Math.ceil(((u - r * seg.period) * seg.perBeat) / seg.period);
}

/** Valid `countIn` → remaining and already-played counts; anything else → no count-in. */
function toCountIn(c: CountInSpan | undefined): { remaining: number; from: number } {
  if (
    !c ||
    !Number.isInteger(c.total) ||
    !Number.isInteger(c.from) ||
    c.total < 0 ||
    c.total > 8 ||
    c.from < 0 ||
    c.from > c.total
  ) {
    return { remaining: 0, from: 0 };
  }
  return { remaining: c.total - c.from, from: c.from };
}

function toPerBeat(n: number): number {
  return Number.isInteger(n) && n >= 1 && n <= 8 ? n : 1;
}

interface Pending {
  readonly when: number;
  readonly source: AudioBufferSourceNode;
}

type Buffers = Record<ClickKind, AudioBuffer>;
const buffersBySink = new WeakMap<ClickSink, Buffers>();

function buffersFor(sink: ClickSink): Buffers {
  let b = buffersBySink.get(sink);
  if (!b) {
    const make = (kind: ClickKind): AudioBuffer => {
      const samples = renderClick(kind, sink.port.sampleRate);
      const buffer = sink.port.createBuffer(1, samples.length, sink.port.sampleRate);
      buffer.getChannelData(0).set(samples);
      return buffer;
    };
    b = { accent: make('accent'), normal: make('normal'), sub: make('sub') };
    buffersBySink.set(sink, b);
  }
  return b;
}

export function createClickScheduler(events: SchedulerEvents, deps: SchedulerDeps): ClickScheduler {
  const { sink, clock, frames } = deps;
  /** Bumped by every start and halt: a stale timer, frame or promise sees a different value. */
  let gen = 0;
  let live = false;
  let seg: (Grid & { run: number; pressedAtMs: number }) | null = null;
  let visual = sink === null;
  let next = 0;
  let reported = -Infinity;
  let timer: number | null = null;
  let frame: number | null = null;
  let resuming = false;
  let pending: Pending[] = [];

  const now = (): number => (visual || !sink ? clock.now() / 1000 : sink.port.currentTime);
  const latency = (): number =>
    visual || !sink ? 0 : (sink.port.outputLatency ?? sink.port.baseLatency ?? 0);

  /** Index of the latest grid click whose audible time has been reached, or -1. */
  function audibleIndex(): number {
    if (!seg) return -1;
    const r = seg.countInRemaining ?? 0;
    const t = now() - latency() - seg.anchor;
    const k =
      t < r * seg.period
        ? Math.floor(t / seg.period + 1e-9)
        : r + Math.floor(((t - r * seg.period) * seg.perBeat) / seg.period + 1e-9);
    return k < 0 ? -1 : Math.min(k, next - 1);
  }

  function schedule(g: Grid & { run: number; pressedAtMs: number }, k: number): void {
    const c = clickAt(g, k);
    if (visual || !sink) return;
    const bufs = buffersFor(sink);
    const source = sink.port.createBufferSource();
    source.buffer = bufs[c.kind];
    source.connect(sink.destination);
    source.onended = () => source.disconnect();
    source.start(c.when);
    pending.push({ when: c.when, source });
    log({
      type: 'click',
      run: g.run,
      index: k,
      slot: c.slot,
      beat: c.beat,
      countIn: c.countIn,
      kind: c.kind,
      accent: c.accent,
      when: c.when,
      contextTime: sink.port.currentTime,
      pressedAtMs: k === 0 ? g.pressedAtMs : null,
      scheduledAtMs: performance.now()
    });
  }

  function pump(g: number): void {
    if (g !== gen || !seg) return;
    const t = now();
    if (sink && !visual && sink.port.state !== 'running' && !resuming) {
      resuming = true;
      sink.port.resume().then(
        () => {
          resuming = false;
        },
        () => {
          resuming = false;
          if (g !== gen) return;
          scheduler.halt('suspend');
          events.onSuspended();
        }
      );
    }
    if (next === 0 && sink && !visual) {
      // The context clock may have started moving after the anchor was taken: re-anchor
      // before anything is scheduled so the first (accented) click is never in the past.
      const ct = sink.port.currentTime;
      if (seg.anchor < ct + START_LEAD_S / 2) seg = { ...seg, anchor: ct + START_LEAD_S };
    }
    if (clickAt(seg, next).when < t) next = Math.max(next, skipTo(seg, t));
    while (clickAt(seg, next).when <= t + HORIZON_S) {
      schedule(seg, next);
      next++;
    }
    pending = pending.filter((p) => p.when + CLICK_S >= t);
    timer = clock.setTimeout(() => pump(g), TICK_MS);
  }

  function frameLoop(g: number): void {
    if (g !== gen || !seg) return;
    const k = audibleIndex();
    if (k >= 0) {
      const c = clickAt(seg, k);
      if (c.slot > reported) {
        reported = c.slot;
        if (c.countIn !== null) events.onCountIn(c.countIn);
        else events.onBeat(clickAt(seg, (seg.countInRemaining ?? 0) + c.slot * seg.perBeat).beat);
      }
    }
    frame = frames.request(() => frameLoop(g));
  }

  function anchorAndRun(g: number, segment: SegmentStart): void {
    if (g !== gen) return;
    const period = 60 / segment.bpm;
    const ci = toCountIn(segment.countIn);
    seg = {
      countInRemaining: ci.remaining,
      countInFrom: ci.from,
      anchor: now() + START_LEAD_S,
      period,
      perBeat: toPerBeat(segment.clicksPerBeat),
      startBeat: segment.startBeat,
      beats: segment.beats,
      run: segment.run,
      pressedAtMs: segment.pressedAtMs
    };
    next = 0;
    reported = -Infinity;
    pump(g);
    frame = frames.request(() => frameLoop(g));
  }

  const scheduler: ClickScheduler = {
    get live() {
      return live;
    },

    start(segment): void {
      if (live) return;
      live = true;
      seg = null;
      const g = ++gen;
      if (!sink) {
        visual = true;
        anchorAndRun(g, segment);
        return;
      }
      void sink.running.then((ok) => {
        if (g !== gen) return;
        if (!ok) {
          visual = true;
          events.onSoundUnavailable();
        }
        anchorAndRun(g, segment);
      });
    },

    halt(reason): HaltedAt {
      if (!live) return { kind: 'none' };
      const k = audibleIndex();
      let halted: HaltedAt = { kind: 'none' };
      if (seg && k >= 0) {
        const c = clickAt(seg, k);
        halted =
          c.countIn !== null
            ? { kind: 'count-in', click: c.countIn }
            : {
                kind: 'beat',
                beat: clickAt(seg, (seg.countInRemaining ?? 0) + c.slot * seg.perBeat).beat
              };
      }
      const t = now();
      let count = 0;
      for (const p of pending) {
        if (p.when > t) {
          try {
            p.source.stop();
          } catch {
            // Already ended.
          }
          p.source.disconnect();
          count++;
        }
      }
      if (sink && !visual && seg) log({ type: 'click-cancel', run: seg.run, count, reason });
      pending = [];
      if (timer !== null) clock.clearTimeout(timer);
      if (frame !== null) frames.cancel(frame);
      timer = frame = null;
      gen++;
      live = false;
      seg = null;
      return halted;
    }
  };
  return scheduler;
}
