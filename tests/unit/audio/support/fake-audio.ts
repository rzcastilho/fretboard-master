/** Recording fakes for the engine's AudioPort and TimerClock (contracts/playback-api.md §2). */

export interface GainCall {
  readonly method:
    'setValueAtTime' | 'setTargetAtTime' | 'linearRampToValueAtTime' | 'cancelScheduledValues';
  readonly args: readonly number[];
}

export class FakeParam {
  value = 1;
  readonly calls: GainCall[] = [];
  setValueAtTime(v: number, t: number): this {
    this.calls.push({ method: 'setValueAtTime', args: [v, t] });
    this.value = v;
    return this;
  }
  setTargetAtTime(v: number, t: number, tc: number): this {
    this.calls.push({ method: 'setTargetAtTime', args: [v, t, tc] });
    return this;
  }
  linearRampToValueAtTime(v: number, t: number): this {
    this.calls.push({ method: 'linearRampToValueAtTime', args: [v, t] });
    return this;
  }
  cancelScheduledValues(t: number): this {
    this.calls.push({ method: 'cancelScheduledValues', args: [t] });
    return this;
  }
}

export class FakeGain {
  readonly gain = new FakeParam();
  readonly connected: unknown[] = [];
  connect(node: unknown): unknown {
    this.connected.push(node);
    return node;
  }
  disconnect(): void {
    this.connected.length = 0;
  }
}

export class FakeBuffer {
  private readonly data: Float32Array;
  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number
  ) {
    this.data = new Float32Array(length);
  }
  getChannelData(_channel: number): Float32Array {
    return this.data;
  }
  copyToChannel(source: Float32Array, _channel: number): void {
    this.data.set(source);
  }
}

export class FakeSource {
  buffer: FakeBuffer | null = null;
  readonly startCalls: number[] = [];
  readonly stopCalls: number[] = [];
  readonly connected: unknown[] = [];
  onended: (() => void) | null = null;
  connect(node: unknown): unknown {
    this.connected.push(node);
    return node;
  }
  disconnect(): void {
    this.connected.length = 0;
  }
  start(when = 0): void {
    this.startCalls.push(when);
  }
  stop(when = 0): void {
    this.stopCalls.push(when);
  }
}

export type FakeState = AudioContextState | 'interrupted';

export class FakeAudioPort {
  currentTime = 0;
  sampleRate = 48000;
  state: FakeState = 'suspended';
  outputLatency = 0;
  baseLatency = 0;
  readonly destination = { kind: 'destination' } as unknown as AudioNode;
  readonly buffers: FakeBuffer[] = [];
  readonly sources: FakeSource[] = [];
  readonly gains: FakeGain[] = [];
  resumeCalls = 0;
  private pending: { resolve: () => void; reject: (e: unknown) => void }[] = [];
  /** 'resolve' / 'reject' settle immediately; 'manual' waits for resolveResume / rejectResume. */
  resumeMode: 'resolve' | 'reject' | 'manual' = 'resolve';

  resume(): Promise<void> {
    this.resumeCalls++;
    if (this.resumeMode === 'resolve') {
      this.state = 'running';
      return Promise.resolve();
    }
    if (this.resumeMode === 'reject') return Promise.reject(new Error('resume rejected'));
    return new Promise<void>((resolve, reject) => this.pending.push({ resolve, reject }));
  }
  resolveResume(): void {
    this.state = 'running';
    this.pending.splice(0).forEach((p) => p.resolve());
  }
  rejectResume(error: unknown = new Error('resume rejected')): void {
    this.pending.splice(0).forEach((p) => p.reject(error));
  }
  createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer {
    const b = new FakeBuffer(channels, length, sampleRate);
    this.buffers.push(b);
    return b as unknown as AudioBuffer;
  }
  createBufferSource(): AudioBufferSourceNode {
    const s = new FakeSource();
    this.sources.push(s);
    return s as unknown as AudioBufferSourceNode;
  }
  createGain(): GainNode {
    const g = new FakeGain();
    this.gains.push(g);
    return g as unknown as GainNode;
  }
}

export class FakeClock {
  private t = 0;
  private nextId = 1;
  private timers = new Map<number, { at: number; cb: () => void }>();

  now(): number {
    return this.t;
  }
  setTimeout(cb: () => void, ms: number): number {
    const id = this.nextId++;
    this.timers.set(id, { at: this.t + Math.max(0, ms), cb });
    return id;
  }
  clearTimeout(id: number): void {
    this.timers.delete(id);
  }
  get pendingCount(): number {
    return this.timers.size;
  }
  /** Advance time, firing due timers in time order (ties by creation order). */
  advance(ms: number): void {
    const target = this.t + ms;
    for (;;) {
      let nextId = -1;
      let nextAt = Infinity;
      for (const [id, tm] of this.timers) {
        if (tm.at <= target && tm.at < nextAt) {
          nextAt = tm.at;
          nextId = id;
        }
      }
      if (nextId < 0) break;
      const tm = this.timers.get(nextId);
      if (!tm) break;
      this.timers.delete(nextId);
      this.t = Math.max(this.t, tm.at);
      tm.cb();
    }
    this.t = target;
  }
  /** Advance `steps` × `stepMs` (default 1000 ms), firing timers in each step. */
  tick(steps = 1, stepMs = 1000): void {
    for (let i = 0; i < steps; i++) this.advance(stepMs);
  }
}

/** `FrameClock` fake: callbacks run only on a manual `flush()`. */
export class FakeFrames {
  private nextId = 1;
  private cbs = new Map<number, () => void>();
  request(cb: () => void): number {
    const id = this.nextId++;
    this.cbs.set(id, cb);
    return id;
  }
  cancel(id: number): void {
    this.cbs.delete(id);
  }
  get pendingCount(): number {
    return this.cbs.size;
  }
  /** Run the callbacks queued so far (callbacks queued while flushing wait for the next flush). */
  flush(): void {
    const due = [...this.cbs.entries()];
    this.cbs.clear();
    for (const [, cb] of due) cb();
  }
}
