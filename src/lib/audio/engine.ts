/**
 * Web Audio playback engine (contracts/playback-api.md §2). No Svelte, no app imports.
 * Rendering is main-thread: pure synth → AudioBuffer → source → voice gain → volume → mute → out.
 */
import type { Instrument } from '../instrument/instrument';
import { frequencyOf } from '../theory/pitch';
import { pluckSynth } from './pluck';
import { planRequest } from './schedule';
import type {
  AudioLogEntry,
  Plan,
  PlaybackRequest,
  PulseEvent,
  Synth,
  SynthLoader,
  TimeMark
} from './types';

export interface TimerClock {
  now(): number;
  setTimeout(cb: () => void, ms: number): number;
  clearTimeout(id: number): void;
}

/** Subset of BaseAudioContext the engine uses; a fake implements it in tests. */
export interface AudioPort {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly state: AudioContextState | 'interrupted';
  readonly destination: AudioNode;
  resume(): Promise<void>;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer;
  createBufferSource(): AudioBufferSourceNode;
  createGain(): GainNode;
}

export interface EngineDeps {
  /** May throw. */
  createContext: () => AudioPort;
  loadSynth: SynthLoader;
  clock: TimerClock;
}

export interface EngineEvents {
  onPulseStart(p: PulseEvent): void;
  onPulseEnd(id: number): void;
  onSequenceChange(playing: boolean): void;
  onUnavailable(cause: 'context' | 'resume' | 'synth'): void;
}

export interface PlaybackEngine {
  /** Starts loading the synth without creating an AudioContext. Call after the fretboard is interactive. */
  preload(): void;
  /** Must be called from a user-gesture handler. */
  play(request: PlaybackRequest, instrument: Instrument): readonly TimeMark[];
  /**
   * Silences the active request (if any): ramps voices to 0, cancels pending steps and pulses.
   * A no-op when nothing is active. Never auto-resumes.
   */
  stop(reason?: StopReason): void;
  /** Unlocks audio without playing (sound-control interaction). */
  unlock(): void;
  /** Ramps the mute gain over 10 ms; never stops sources. Also unlocks. */
  setMuted(muted: boolean): void;
  /** 0..100, gain (v/100)², ramped over 10 ms; never stops sources. Also unlocks. */
  setVolume(volume: number): void;
}

export type StopReason = 'stop' | 'hidden' | 'navigate' | 'instrument' | 'view';

/** Voice-gain ramp to silence on interruption or stop (≤ 20 ms budget, E4). */
const STOP_RAMP_S = 0.01;
/** Sources are stopped just after the ramp completes. */
const STOP_AFTER_S = 0.012;

interface ActiveRequest {
  readonly id: number;
  readonly sequence: boolean;
  readonly voices: { source: AudioBufferSourceNode; gain: GainNode }[];
  readonly livePulses: Set<number>;
}

const DEFAULT_VOLUME = 80;
/** setTargetAtTime time constant: ≈ 10 ms to settle (E12). */
const RAMP_TAU_S = 0.003;

function defaultDeps(): EngineDeps {
  return {
    createContext: () => new AudioContext({ latencyHint: 'interactive' }) as unknown as AudioPort,
    loadSynth: () => Promise.resolve(pluckSynth),
    clock: {
      now: () => performance.now(),
      setTimeout: (cb, ms) => window.setTimeout(cb, ms),
      clearTimeout: (id) => window.clearTimeout(id)
    }
  };
}

/** Test builds only: append to `__fmAudioLog` (never read by app code). */
function log(entry: AudioLogEntry): void {
  if (__FM_FAULT_INJECTION__) (globalThis.__fmAudioLog ??= []).push(entry);
}

const volumeToGain = (v: number): number => (v / 100) ** 2;

export function createPlaybackEngine(
  events: EngineEvents,
  deps: Partial<EngineDeps> = {}
): PlaybackEngine {
  const d: EngineDeps = { ...defaultDeps(), ...deps };

  let ctx: AudioPort | null = null;
  let volumeGain: GainNode | null = null;
  let muteGain: GainNode | null = null;
  let muted = false;
  let volume = DEFAULT_VOLUME;
  let nextPulseId = 1;
  const pulseTimers = new Set<number>();
  let synth: Synth | null = null;
  let loading: Promise<Synth | null> | null = null;
  let failed = false;
  let nextRequestId = 1;
  let active: ActiveRequest | null = null;

  /** Ends the active request: silence, drop pending timers, end live pulses, clear sequence. */
  function halt(reason: Extract<AudioLogEntry, { type: 'stop' }>['reason']): void {
    const current = active;
    if (!current) return;
    active = null;
    log({ type: 'stop', requestId: current.id, reason });
    for (const id of pulseTimers) d.clock.clearTimeout(id);
    pulseTimers.clear();
    if (ctx) {
      const now = ctx.currentTime;
      for (const { source, gain } of current.voices) {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + STOP_RAMP_S);
        try {
          source.stop(now + STOP_AFTER_S);
        } catch {
          // Already ended.
        }
      }
    }
    for (const id of current.livePulses) events.onPulseEnd(id);
    current.livePulses.clear();
    if (current.sequence) events.onSequenceChange(false);
  }

  function after(ms: number, cb: () => void): void {
    const id = d.clock.setTimeout(() => {
      pulseTimers.delete(id);
      cb();
    }, ms);
    pulseTimers.add(id);
  }

  /** Pulses depend only on the plan, never on audio success, mute, or dropped notes (E5). */
  function schedulePulses(request: ActiveRequest, marks: readonly TimeMark[]): void {
    let lastEnd = 0;
    for (const mark of marks) {
      const pulse: PulseEvent = {
        id: nextPulseId++,
        position: mark.position,
        durationMs: mark.endMs - mark.onsetMs
      };
      lastEnd = Math.max(lastEnd, mark.endMs);
      after(mark.onsetMs, () => {
        request.livePulses.add(pulse.id);
        events.onPulseStart(pulse);
      });
      after(mark.endMs, () => {
        request.livePulses.delete(pulse.id);
        events.onPulseEnd(pulse.id);
      });
    }
    // Natural end of the request.
    after(lastEnd, () => {
      if (active !== request) return;
      active = null;
      if (request.sequence) events.onSequenceChange(false);
    });
  }

  function ramp(node: GainNode | null, target: number): void {
    if (!node || !ctx) return;
    node.gain.setTargetAtTime(target, ctx.currentTime, RAMP_TAU_S);
  }

  function fail(cause: 'context' | 'resume' | 'synth'): void {
    if (failed) return;
    failed = true;
    log({ type: 'unavailable', cause });
    events.onUnavailable(cause);
  }

  function startLoader(): Promise<Synth | null> {
    loading ??= new Promise<Synth>((resolve) => resolve(d.loadSynth())).then(
      (s) => {
        synth = s;
        return s;
      },
      () => {
        fail('synth');
        return null;
      }
    );
    return loading;
  }

  /** Creates the context and graph on first use, and asks a suspended context to resume. */
  function ensureContext(): AudioPort | null {
    if (failed) return null;
    if (!ctx) {
      try {
        const created = d.createContext();
        const volumeNode = created.createGain();
        const muteNode = created.createGain();
        volumeNode.gain.value = volumeToGain(volume);
        muteNode.gain.value = muted ? 0 : 1;
        volumeNode.connect(muteNode);
        muteNode.connect(created.destination);
        volumeGain = volumeNode;
        muteGain = muteNode;
        ctx = created;
        // Unlock: resume() is called inside the gesture and deliberately not awaited (R-08).
        created.resume().catch(() => undefined);
        log({ type: 'unlock', state: created.state as AudioContextState });
        return created;
      } catch {
        fail('context');
        return null;
      }
    }
    if (ctx.state !== 'running') ctx.resume().catch(() => undefined);
    return ctx;
  }

  /** Render and schedule every step of the plan on the audio clock. */
  function schedule(port: AudioPort, s: Synth, plan: Plan, current: ActiveRequest): void {
    const destination = volumeGain;
    if (!destination) return;
    const requestId = current.id;
    const t0 = port.currentTime;
    for (const step of plan.steps) {
      const length = Math.max(1, Math.round((step.durationMs / 1000) * port.sampleRate));
      const voices = step.pitches.map((p) => s.renderVoice(p, port.sampleRate, length));
      const samples = voices.length === 1 ? voices[0] : s.mixVoices(voices);
      const buffer = port.createBuffer(1, length, port.sampleRate);
      buffer.getChannelData(0).set(samples);
      const source = port.createBufferSource();
      source.buffer = buffer;
      const voice = port.createGain();
      voice.gain.value = 1;
      source.connect(voice);
      voice.connect(destination);
      current.voices.push({ source, gain: voice });
      source.onended = () => {
        source.disconnect();
        voice.disconnect();
      };
      const when = t0 + step.onsetMs / 1000;
      source.start(when);
      log({
        type: 'step',
        requestId,
        kind: plan.kind,
        pitches: [...step.pitches],
        frequencies: step.pitches.map(frequencyOf),
        when,
        contextTime: port.currentTime,
        gain: muted ? 0 : volumeToGain(volume),
        scheduledAtMs: performance.now()
      });
    }
  }

  return {
    preload(): void {
      if (!failed) void startLoader();
    },

    unlock(): void {
      ensureContext();
    },

    setMuted(next): void {
      muted = next;
      if (!ensureContext()) return;
      ramp(muteGain, muted ? 0 : 1);
    },

    setVolume(next): void {
      volume = Math.min(100, Math.max(0, Number.isFinite(next) ? next : 0));
      if (!ensureContext()) return;
      ramp(volumeGain, volumeToGain(volume));
    },

    stop(reason = 'stop'): void {
      halt(reason);
    },

    play(request, instrument): readonly TimeMark[] {
      const plan = planRequest(request, instrument);
      const marks = plan.marks;
      if (marks.length === 0) return marks;
      // SC-004: at most one active request; a new one supersedes it.
      halt('interrupt');
      const current: ActiveRequest = {
        id: nextRequestId++,
        sequence: plan.kind === 'sequence',
        voices: [],
        livePulses: new Set()
      };
      active = current;
      if (current.sequence) events.onSequenceChange(true);
      schedulePulses(current, marks);
      const port = ensureContext();
      if (!port) return marks;
      if (synth) {
        schedule(port, synth, plan, current);
      } else {
        void startLoader().then((s) => {
          if (s && active === current) schedule(port, s, plan, current);
        });
      }
      return marks;
    }
  };
}
