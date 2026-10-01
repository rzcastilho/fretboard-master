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
  /** Unlocks audio without playing (sound-control interaction). */
  unlock(): void;
  /** Ramps the mute gain over 10 ms; never stops sources. Also unlocks. */
  setMuted(muted: boolean): void;
  /** 0..100, gain (v/100)², ramped over 10 ms; never stops sources. Also unlocks. */
  setVolume(volume: number): void;
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

  function after(ms: number, cb: () => void): void {
    const id = d.clock.setTimeout(() => {
      pulseTimers.delete(id);
      cb();
    }, ms);
    pulseTimers.add(id);
  }

  /** Pulses depend only on the plan, never on audio success, mute, or dropped notes (E5). */
  function schedulePulses(marks: readonly TimeMark[]): void {
    for (const mark of marks) {
      const pulse: PulseEvent = {
        id: nextPulseId++,
        position: mark.position,
        durationMs: mark.endMs - mark.onsetMs
      };
      after(mark.onsetMs, () => events.onPulseStart(pulse));
      after(mark.endMs, () => events.onPulseEnd(pulse.id));
    }
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
  function schedule(
    port: AudioPort,
    s: Synth,
    request: PlaybackRequest,
    instrument: Instrument
  ): void {
    const plan = planRequest(request, instrument);
    const destination = volumeGain;
    if (!destination) return;
    const requestId = nextRequestId++;
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
        gain: volumeToGain(volume),
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

    play(request, instrument): readonly TimeMark[] {
      const marks = planRequest(request, instrument).marks;
      if (marks.length === 0) return marks;
      schedulePulses(marks);
      const port = ensureContext();
      if (!port) return marks;
      if (synth) {
        schedule(port, synth, request, instrument);
      } else {
        void startLoader().then((s) => {
          if (s) schedule(port, s, request, instrument);
        });
      }
      return marks;
    }
  };
}
