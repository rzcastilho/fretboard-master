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
import { log } from './log';

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
  /** Optional: seconds between a sample being scheduled and heard (031). */
  readonly outputLatency?: number;
  readonly baseLatency?: number;
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

/** The shared context and its volume→mute chain, for sources the engine does not manage (031). */
export interface AudioSink {
  readonly port: AudioPort;
  readonly destination: AudioNode;
  /** `true` once the context is running; `false` if it could not be resumed or audio failed. */
  readonly running: Promise<boolean>;
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
  /**
   * Unlocks (call within a user gesture) and hands out the shared context and its volume→mute
   * chain; `null` when audio is unavailable. Sources started on it are not part of the active
   * request, so `stop()` (any reason) never touches them.
   */
  sink(): AudioSink | null;
  /** Unlocks audio without playing (sound-control interaction). */
  unlock(): void;
  /** Ramps the mute gain over 10 ms; never stops sources. Also unlocks. */
  setMuted(muted: boolean): void;
  /** 0..100, gain (v/100)², ramped over 10 ms; never stops sources. Also unlocks. */
  setVolume(volume: number): void;
  /**
   * Assigns mute and volume (0..100) without unlocking: never creates an AudioContext.
   * Ramps only when a context already exists. Used to apply remembered preferences.
   */
  restore(muted: boolean, volume: number): void;
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

/** A note waiting on the synth loader plays only if the loader settles this soon after activation (R-10). */
const SYNTH_WINDOW_MS = 100;
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

const volumeToGain = (v: number): number => (v / 100) ** 2;

export function createPlaybackEngine(
  events: EngineEvents,
  deps: Partial<EngineDeps> = {}
): PlaybackEngine {
  const d: EngineDeps = { ...defaultDeps(), ...deps };
  // Test builds only (R-16): force a failure on the first unlock. Read once, enum allow-list.
  if (__FM_FAULT_INJECTION__) {
    const fault = globalThis.__fmAudioFault;
    if (fault === 'context') {
      d.createContext = () => {
        throw new Error('injected audio context fault');
      };
    } else if (fault === 'synth') {
      d.loadSynth = () => Promise.reject(new Error('injected synth fault'));
    }
  }

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
  /** The first resume() resolved: audio was on, so later failures are not "unavailable" (R-09). */
  let wasOn = false;
  let loadFailed = false;
  let gestureSeen = false;
  /** Settles `true`/`false` when the latest resume() call does; `null` before any. */
  let resumeSettled: Promise<boolean> | null = null;
  let nextRequestId = 1;
  let active: ActiveRequest | null = null;

  /** Ramps the request's voices to 0 and stops their sources. Pulses are untouched. */
  function silence(current: ActiveRequest): void {
    if (!ctx) return;
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
    current.voices.length = 0;
  }

  /** Ends the active request: silence, drop pending timers, end live pulses, clear sequence. */
  function halt(reason: Extract<AudioLogEntry, { type: 'stop' }>['reason']): void {
    const current = active;
    if (!current) return;
    active = null;
    log({ type: 'stop', requestId: current.id, reason });
    for (const id of pulseTimers) d.clock.clearTimeout(id);
    pulseTimers.clear();
    silence(current);
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
        // Unavailable only counts once a gesture attempted to unlock audio (R-09).
        loadFailed = true;
        if (gestureSeen) fail('synth');
        return null;
      }
    );
    return loading;
  }

  /** A resume() that rejected: terminal on the first unlock, otherwise only that request's sound is lost. */
  function resumeRejected(request: ActiveRequest | null): void {
    if (!wasOn) fail('resume');
    else if (request) silence(request);
  }

  /** Creates the context and graph on first use, and asks a suspended context to resume. */
  function ensureContext(request: ActiveRequest | null = null): AudioPort | null {
    gestureSeen = true;
    if (loadFailed) fail('synth');
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
        const first = created.resume();
        resumeSettled = first.then(
          () => true,
          () => false
        );
        first.then(
          () => {
            wasOn = true;
          },
          () => resumeRejected(request)
        );
        log({ type: 'unlock', state: created.state as AudioContextState });
        return created;
      } catch {
        fail('context');
        return null;
      }
    }
    // 'suspended' or Safari's 'interrupted': resumable, never unavailable once audio was on.
    if (ctx.state !== 'running') {
      const again = ctx.resume();
      resumeSettled = again.then(
        () => true,
        () => false
      );
      again.catch(() => resumeRejected(request));
    }
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
      // Every step, single notes included, goes through the static peak limiter (R-07).
      const samples = s.mixVoices(voices);
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

    sink(): AudioSink | null {
      const port = ensureContext();
      if (!port || !volumeGain) return null;
      const running =
        port.state === 'running' || !resumeSettled ? Promise.resolve(!failed) : resumeSettled;
      return { port, destination: volumeGain, running: running.then((ok) => ok && !failed) };
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

    restore(nextMuted, nextVolume): void {
      muted = nextMuted;
      volume = Math.min(100, Math.max(0, Number.isFinite(nextVolume) ? nextVolume : 0));
      ramp(muteGain, muted ? 0 : 1);
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
        sequence: plan.kind === 'sequence' || plan.kind === 'timeline',
        voices: [],
        livePulses: new Set()
      };
      active = current;
      if (current.sequence) events.onSequenceChange(true);
      schedulePulses(current, marks);
      const activatedAt = d.clock.now();
      const port = ensureContext(current);
      if (!port) return marks;
      if (synth) {
        schedule(port, synth, plan, current);
      } else {
        // FR-017: pulse now; the note sounds only if the synth arrives within the window.
        void startLoader().then((s) => {
          if (s && active === current && d.clock.now() - activatedAt <= SYNTH_WINDOW_MS) {
            schedule(port, s, plan, current);
          }
        });
      }
      return marks;
    }
  };
}
