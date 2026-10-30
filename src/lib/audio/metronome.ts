/**
 * Click scheduler (031, contracts/click-engine-api.md §2). Framework-free: no Svelte, `$app/*`,
 * i18n, state, shell or prefs imports. Click k of a segment starts at `anchor + k × period`
 * (never accumulated), scheduled ahead on the audio clock; the beat shown to the user follows
 * the audible time through animation frames.
 */
import { CLICK_S, renderClick, type ClickKind } from './click';
import type { AudioPort, TimerClock } from './engine';
import { log } from './log';
import {
  clickAt,
  slotStart,
  toRunPlan,
  type CycleClick,
  type RunPlan,
  type SlotPosition
} from './metronome-cycle';

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
  /** A loop slot became audible; once per slot, never for sub-clicks. */
  onBeat(beat: number, at: SlotPosition & { readonly kind: 'beat' }): void;
  /** A count-in click (initial or repeat) became audible. */
  onCountIn(click: number, at: SlotPosition & { readonly kind: 'count-in' }): void;
  onSuspended(): void;
  onSoundUnavailable(): void;
}

export interface SegmentStart {
  readonly bpm: number;
  readonly beats: number;
  /** Loop 1 clicks per beat, 1–8: the beat click plus n − 1 soft ones. Anything else counts as 1. */
  readonly clicksPerBeat: number;
  /** Accented clicks before the first loop; absent or invalid means none. */
  readonly initialCountIn?: number;
  /** Loop 2 and the repeat count-in; absent means Loop 1 only. */
  readonly alternate?: {
    readonly clicksPerBeat: number;
    readonly repeatCountIn: number;
  };
  /** Run-global slot to begin at; absent or invalid means 0. */
  readonly startSlot?: number;
  readonly run: number;
  readonly pressedAtMs: number;
}

export type HaltReason = 'pause' | 'reset' | 'leave' | 'suspend';

export type HaltedAt = SlotPosition | { readonly kind: 'none' };

export interface ClickScheduler {
  start(segment: SegmentStart): void;
  halt(reason: HaltReason): HaltedAt;
  readonly live: boolean;
}

export interface Grid {
  readonly plan: RunPlan;
  readonly anchor: number;
  readonly period: number;
  readonly startSlot: number;
  /** Run-global index of the first click of `startSlot`. */
  readonly startIndex: number;
}

/**
 * Time of a click: `anchor + (slot − startSlot) × T + sub × T / n`. The slot difference is an
 * integer evaluated first, so nothing accumulates.
 */
export function clickTime(g: Grid, c: CycleClick): number {
  const n = c.position.kind === 'beat' ? c.position.clicksPerBeat : 1;
  return g.anchor + (c.slot - g.startSlot) * g.period + (c.sub * g.period) / n;
}

const timeOf = (g: Grid, index: number): number => clickTime(g, clickAt(g.plan, index));

/** First click index worth scheduling at `now` (skip-forward, never a burst). */
export function skipTo(g: Grid, now: number): number {
  const target = now + START_LEAD_S;
  const u = target - g.anchor;
  if (u <= 0) return g.startIndex;
  let k = Math.max(g.startIndex, slotStart(g.plan, g.startSlot + Math.floor(u / g.period)));
  while (k > g.startIndex && timeOf(g, k - 1) >= target) k--;
  while (timeOf(g, k) < target) k++;
  return k;
}

/** Latest click whose time is ≤ `t` (seconds on the context clock), or −1. */
export function indexAt(g: Grid, t: number): number {
  const u = t - g.anchor;
  if (u < -1e-9) return -1;
  let k = Math.max(
    g.startIndex,
    slotStart(g.plan, g.startSlot + Math.max(0, Math.floor(u / g.period + 1e-9)))
  );
  while (timeOf(g, k + 1) <= t + 1e-9) k++;
  return timeOf(g, k) <= t + 1e-9 ? k : -1;
}

function toStartSlot(v: number | undefined): number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0;
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
    return Math.min(indexAt(seg, now() - latency()), next - 1);
  }

  function schedule(g: Grid & { run: number; pressedAtMs: number }, k: number): void {
    const c = clickAt(g.plan, k);
    const when = clickTime(g, c);
    if (visual || !sink) return;
    const bufs = buffersFor(sink);
    const source = sink.port.createBufferSource();
    source.buffer = bufs[c.kind];
    source.connect(sink.destination);
    source.onended = () => source.disconnect();
    source.start(when);
    pending.push({ when, source });
    log({
      type: 'click',
      run: g.run,
      index: k,
      slot: c.slot,
      beat: c.position.kind === 'beat' ? c.position.beat : 0,
      countIn: c.position.kind === 'count-in' ? c.position.click : null,
      phase: c.phase,
      kind: c.kind,
      accent: c.kind === 'accent',
      when,
      contextTime: sink.port.currentTime,
      pressedAtMs: k === g.startIndex ? g.pressedAtMs : null,
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
    if (next === seg.startIndex && sink && !visual) {
      // The context clock may have started moving after the anchor was taken: re-anchor
      // before anything is scheduled so the first (accented) click is never in the past.
      const ct = sink.port.currentTime;
      if (seg.anchor < ct + START_LEAD_S / 2) seg = { ...seg, anchor: ct + START_LEAD_S };
    }
    if (timeOf(seg, next) < t) next = Math.max(next, skipTo(seg, t));
    while (timeOf(seg, next) <= t + HORIZON_S) {
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
      const { slot, position } = clickAt(seg.plan, k);
      if (slot > reported) {
        reported = slot;
        if (position.kind === 'count-in') events.onCountIn(position.click, position);
        else events.onBeat(position.beat, position);
      }
    }
    frame = frames.request(() => frameLoop(g));
  }

  function anchorAndRun(g: number, segment: SegmentStart): void {
    if (g !== gen) return;
    const plan = toRunPlan({
      beats: segment.beats,
      clicksPerBeat: segment.clicksPerBeat,
      initialCountIn: segment.initialCountIn,
      alternate: segment.alternate
    });
    const startSlot = toStartSlot(segment.startSlot);
    const startIndex = slotStart(plan, startSlot);
    seg = {
      plan,
      anchor: now() + START_LEAD_S,
      period: 60 / segment.bpm,
      startSlot,
      startIndex,
      run: segment.run,
      pressedAtMs: segment.pressedAtMs
    };
    next = startIndex;
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
        halted = clickAt(seg.plan, k).position;
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
