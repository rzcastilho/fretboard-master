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
  onSuspended(): void;
  onSoundUnavailable(): void;
}

export interface SegmentStart {
  readonly bpm: number;
  readonly beats: number;
  readonly startBeat: number;
  readonly run: number;
  readonly pressedAtMs: number;
}

export type HaltReason = 'pause' | 'reset' | 'leave' | 'suspend';

export interface ClickScheduler {
  start(segment: SegmentStart): void;
  halt(reason: HaltReason): number;
  readonly live: boolean;
}

interface Grid {
  readonly anchor: number;
  readonly period: number;
  readonly startBeat: number;
  readonly beats: number;
}

/** Click `k` of a segment. */
export function clickAt(
  seg: Grid,
  k: number
): { index: number; when: number; beat: number; accent: boolean } {
  const beat = ((((seg.startBeat - 1 + k) % seg.beats) + seg.beats) % seg.beats) + 1;
  return { index: k, when: seg.anchor + k * seg.period, beat, accent: beat === 1 };
}

/** First click index worth scheduling at `now` (skip-forward, never a burst). */
export function skipTo(seg: { anchor: number; period: number }, now: number): number {
  return Math.max(0, Math.ceil((now + START_LEAD_S - seg.anchor) / seg.period));
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
    b = { accent: make('accent'), normal: make('normal') };
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
  let reported = -1;
  let timer: number | null = null;
  let frame: number | null = null;
  let resuming = false;
  let pending: Pending[] = [];

  const now = (): number => (visual || !sink ? clock.now() / 1000 : sink.port.currentTime);
  const latency = (): number =>
    visual || !sink ? 0 : (sink.port.outputLatency ?? sink.port.baseLatency ?? 0);

  /** Index of the latest click whose audible time has been reached, or -1. */
  function audibleIndex(): number {
    if (!seg) return -1;
    const k = Math.floor((now() - latency() - seg.anchor) / seg.period + 1e-9);
    return k < 0 ? -1 : Math.min(k, next - 1);
  }

  function schedule(g: Grid & { run: number; pressedAtMs: number }, k: number): void {
    const c = clickAt(g, k);
    if (visual || !sink) return;
    const bufs = buffersFor(sink);
    const source = sink.port.createBufferSource();
    source.buffer = bufs[c.accent ? 'accent' : 'normal'];
    source.connect(sink.destination);
    source.onended = () => source.disconnect();
    source.start(c.when);
    pending.push({ when: c.when, source });
    log({
      type: 'click',
      run: g.run,
      index: k,
      beat: c.beat,
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
    if (k > reported) {
      reported = k;
      events.onBeat(clickAt(seg, k).beat);
    }
    frame = frames.request(() => frameLoop(g));
  }

  function anchorAndRun(g: number, segment: SegmentStart): void {
    if (g !== gen) return;
    const period = 60 / segment.bpm;
    seg = {
      anchor: now() + START_LEAD_S,
      period,
      startBeat: segment.startBeat,
      beats: segment.beats,
      run: segment.run,
      pressedAtMs: segment.pressedAtMs
    };
    next = 0;
    reported = -1;
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

    halt(reason): number {
      if (!live) return 0;
      const k = audibleIndex();
      const beat = seg && k >= 0 ? clickAt(seg, k).beat : 0;
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
      return beat;
    }
  };
  return scheduler;
}
