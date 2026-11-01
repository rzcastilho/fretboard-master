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
import {
  rampClickAt,
  rampOffset,
  rampSlotFloor,
  toRampPlan,
  type RampPlan
} from './metronome-ramp';

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
  /** Stop ramps only: audible time reached the end of the run. Fired once, then not live. */
  onEnd?(): void;
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
  /**
   * Speed Training (037): a tempo ramp. When present, `clicksPerBeat` and `alternate` are
   * ignored (one click per beat) and `bpm` is only the fallback for an invalid `bpms`.
   */
  readonly ramp?: {
    readonly bpms: readonly number[];
    readonly loops: number;
    readonly repeatCountIn: number;
    readonly atTarget: 'hold' | 'stop';
  };
  /** Run-global slot to begin at; absent or invalid means 0. */
  readonly startSlot?: number;
  readonly run: number;
  readonly pressedAtMs: number;
}

export type HaltReason = 'pause' | 'reset' | 'leave' | 'suspend' | 'end';

export type HaltedAt = SlotPosition | { readonly kind: 'none' };

export interface ClickScheduler {
  start(segment: SegmentStart): void;
  halt(reason: HaltReason): HaltedAt;
  /**
   * 038: change the tempo of a live periodic segment without restarting it. The change applies
   * from the first slot whose first click starts at or after now + START_LEAD_S. Returns false
   * (and does nothing) when the segment is not live or is a ramp, or when bpm is not a finite
   * number in 30–300.
   */
  retime(bpm: number): boolean;
  readonly live: boolean;
}

export interface Grid {
  readonly plan: RunPlan;
  readonly anchor: number;
  readonly period: number;
  readonly startSlot: number;
  /** Run-global index of the first click of `startSlot`. */
  readonly startIndex: number;
  /** Speed Training: the tempo ramp; `period` is then unused. */
  readonly ramp?: RampPlan;
}

/**
 * Time of a click: `anchor + (slot − startSlot) × T + sub × T / n`. The slot difference is an
 * integer evaluated first, so nothing accumulates.
 */
export function clickTime(g: Grid, c: CycleClick): number {
  if (g.ramp) return g.anchor + (rampOffset(g.ramp, c.slot) - rampOffset(g.ramp, g.startSlot));
  const n = c.position.kind === 'beat' ? c.position.clicksPerBeat : 1;
  return g.anchor + (c.slot - g.startSlot) * g.period + (c.sub * g.period) / n;
}

const clickOf = (g: Grid, index: number): CycleClick =>
  g.ramp ? rampClickAt(g.ramp, index) : clickAt(g.plan, index);

const timeOf = (g: Grid, index: number): number => clickTime(g, clickOf(g, index));

/** First click index worth scheduling at `now` (skip-forward, never a burst). */
export function skipTo(g: Grid, now: number): number {
  const target = now + START_LEAD_S;
  const u = target - g.anchor;
  if (u <= 0) return g.startIndex;
  let k = g.ramp
    ? Math.max(g.startIndex, rampSlotFloor(g.ramp, u + rampOffset(g.ramp, g.startSlot)))
    : Math.max(g.startIndex, slotStart(g.plan, g.startSlot + Math.floor(u / g.period)));
  while (k > g.startIndex && timeOf(g, k - 1) >= target) k--;
  while (timeOf(g, k) < target) k++;
  return k;
}

/** Latest click whose time is ≤ `t` (seconds on the context clock), or −1. */
export function indexAt(g: Grid, t: number): number {
  const u = t - g.anchor;
  if (u < -1e-9) return -1;
  let k = g.ramp
    ? Math.max(g.startIndex, rampSlotFloor(g.ramp, u + rampOffset(g.ramp, g.startSlot) + 1e-9))
    : Math.max(
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
  /** 038: a retime requested while the segment was live but not yet anchored. */
  let pendingBpm: number | null = null;
  /** 038: true once a click of this segment was scheduled (limits the first-click re-anchor). */
  let firstScheduled = false;
  /** 038: grids in force before the current one (ascending `startIndex`); only after a retime. */
  let earlier: Grid[] = [];
  /** Run-global index of the segment's first click (a retime moves `seg.startIndex`). */
  let originIndex = 0;

  const now = (): number => (visual || !sink ? clock.now() / 1000 : sink.port.currentTime);
  const latency = (): number =>
    visual || !sink ? 0 : (sink.port.outputLatency ?? sink.port.baseLatency ?? 0);

  /** Index of the latest grid click whose audible time has been reached, or -1. */
  function audibleIndex(): number {
    if (!seg) return -1;
    const t = now() - latency();
    let k = indexAt(seg, t);
    if (k < 0 && earlier.length > 0 && t < seg.anchor - 1e-9) {
      // Before the retime point: the clicks still sound on the grid they were scheduled on.
      for (let j = earlier.length - 1; j >= 0 && k < 0; j--) k = indexAt(earlier[j], t);
    }
    return Math.min(k, next - 1);
  }

  /** The grid that owns click `i` (a retime leaves earlier clicks on their old grid). */
  function gridFor(g: Grid, i: number): Grid {
    if (i >= g.startIndex) return g;
    for (let j = earlier.length - 1; j >= 0; j--) if (i >= earlier[j].startIndex) return earlier[j];
    return earlier[0] ?? g;
  }

  function schedule(g0: Grid & { run: number; pressedAtMs: number }, k: number): void {
    const g = { ...gridFor(g0, k), run: g0.run, pressedAtMs: g0.pressedAtMs };
    const c = clickOf(g, k);
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
      pressedAtMs: k === originIndex ? g.pressedAtMs : null,
      scheduledAtMs: performance.now()
    });
  }

  function pump(g: number): void {
    if (g !== gen || !seg) return;
    if (endReached()) return finish();
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
    if (!firstScheduled && next === seg.startIndex && sink && !visual) {
      // The context clock may have started moving after the anchor was taken: re-anchor
      // before anything is scheduled so the first (accented) click is never in the past.
      const ct = sink.port.currentTime;
      if (seg.anchor < ct + START_LEAD_S / 2) seg = { ...seg, anchor: ct + START_LEAD_S };
    }
    if (timeOf(seg, next) < t) next = Math.max(next, skipTo(seg, t));
    const endSlot = seg.ramp?.endSlot ?? Infinity;
    while (next < endSlot && timeOf(seg, next) <= t + HORIZON_S) {
      schedule(seg, next);
      firstScheduled = true;
      next++;
    }
    if (earlier.length > 0 && now() - latency() >= seg.anchor) earlier = [];
    pending = pending.filter((p) => p.when + CLICK_S >= t);
    timer = clock.setTimeout(() => pump(g), TICK_MS);
  }

  /** Stop ramps: audible time has reached the end of the run. */
  function endReached(): boolean {
    const r = seg?.ramp;
    if (!seg || !r || r.endSlot === null) return false;
    const endAt = seg.anchor + (r.tailT0 - rampOffset(r, seg.startSlot));
    return now() - latency() >= endAt;
  }

  /** The run ended by itself: tear down like `halt`, then tell the owner once. */
  function finish(): void {
    if (!live || !seg) return;
    if (sink && !visual) log({ type: 'click-cancel', run: seg.run, count: 0, reason: 'end' });
    pending = [];
    earlier = [];
    pendingBpm = null;
    if (timer !== null) clock.clearTimeout(timer);
    if (frame !== null) frames.cancel(frame);
    timer = frame = null;
    gen++;
    live = false;
    seg = null;
    events.onEnd?.();
  }

  /** Fire `onBeat` / `onCountIn` for the audible slot if it was not reported yet. */
  function reportAudible(): void {
    if (!seg) return;
    const k = audibleIndex();
    if (k < 0) return;
    const { slot, position } = clickOf(seg, k);
    if (slot > reported) {
      reported = slot;
      if (position.kind === 'count-in') events.onCountIn(position.click, position);
      else events.onBeat(position.beat, position);
    }
  }

  function frameLoop(g: number): void {
    if (g !== gen || !seg) return;
    reportAudible();
    if (endReached()) return finish();
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
    const ramp = segment.ramp
      ? toRampPlan(segment.beats, segment.initialCountIn ?? 0, segment.bpm, segment.ramp)
      : undefined;
    const startIndex = ramp ? startSlot : slotStart(plan, startSlot);
    seg = {
      plan,
      ...(ramp ? { ramp } : {}),
      anchor: now() + START_LEAD_S,
      period: 60 / (pendingBpm ?? segment.bpm),
      startSlot,
      startIndex,
      run: segment.run,
      pressedAtMs: segment.pressedAtMs
    };
    next = startIndex;
    originIndex = startIndex;
    pendingBpm = null;
    firstScheduled = false;
    earlier = [];
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

    retime(bpm): boolean {
      if (!live || typeof bpm !== 'number' || !Number.isFinite(bpm) || bpm < 30 || bpm > 300) {
        return false;
      }
      if (seg === null) {
        pendingBpm = bpm;
        return true;
      }
      if (seg.ramp) return false;
      const cur = seg;
      reportAudible();
      const t = now();
      const k = audibleIndex();
      const first = earlier[0] ?? cur;
      const audibleSlot = k >= 0 ? clickOf(cur, k).slot : first.startSlot - 1;
      const timeOfSlot = (slot: number): number => {
        const i = slotStart(cur.plan, slot);
        return clickTime(gridFor(cur, i), clickAt(cur.plan, i));
      };
      let commit = audibleSlot + 1;
      while (timeOfSlot(commit) < t + START_LEAD_S) commit++;
      const at = timeOfSlot(commit);
      const startIndex = slotStart(cur.plan, commit);
      while (next < startIndex) {
        schedule(cur, next);
        firstScheduled = true;
        next++;
      }
      let count = 0;
      pending = pending.filter((p) => {
        if (p.when < at - 1e-9) return true;
        try {
          p.source.stop();
        } catch {
          // Already ended.
        }
        p.source.disconnect();
        count++;
        return false;
      });
      if (sink && !visual) log({ type: 'click-cancel', run: cur.run, count, reason: 'retime' });
      earlier = [...earlier, cur].filter((e) => e.startIndex < startIndex);
      seg = { ...cur, anchor: at, period: 60 / bpm, startSlot: commit, startIndex };
      next = startIndex;
      return true;
    },

    halt(reason): HaltedAt {
      if (!live) return { kind: 'none' };
      const k = audibleIndex();
      let halted: HaltedAt = { kind: 'none' };
      if (seg && k >= 0) {
        halted = clickOf(seg, k).position;
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
      earlier = [];
      pendingBpm = null;
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
