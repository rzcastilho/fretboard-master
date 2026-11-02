/**
 * Timer chime (039, contracts/chime-api.md). Framework-free: a short two-partial bell rendered
 * into a buffer and played through the shared sink, so volume and mute apply.
 */
import type { AudioSink } from './engine';
import { log } from './log';

export const CHIME_S = 0.8;
const FALLBACK_RATE = 48_000;
const PEAK = 0.5;
const ATTACK_S = 0.005;
/** Decay target at the end of the chime (0.1 %). */
const END_LEVEL = 0.001;

export function renderChime(sampleRate: number): Float32Array {
  const rate = Number.isFinite(sampleRate) && sampleRate > 0 ? sampleRate : FALLBACK_RATE;
  const length = Math.round(CHIME_S * rate);
  const out = new Float32Array(length);
  const decay = Math.log(END_LEVEL) / CHIME_S;
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const t = i / rate;
    const attack = t < ATTACK_S ? t / ATTACK_S : 1;
    const env = attack * Math.exp(decay * t);
    const x = env * (Math.sin(2 * Math.PI * 880 * t) + 0.5 * Math.sin(2 * Math.PI * 1320 * t));
    out[i] = x;
    peak = Math.max(peak, Math.abs(x));
  }
  const k = peak > 0 ? PEAK / peak : 0;
  for (let i = 0; i < length; i++) out[i] *= k;
  return out;
}

/** Starts the chime now on the sink's context. Never throws; `false` when nothing played. */
export function playChime(sink: AudioSink, lateMs: number): boolean {
  const { port } = sink;
  if (port.state !== 'running') return false;
  try {
    const samples = renderChime(port.sampleRate);
    const buffer = port.createBuffer(1, samples.length, port.sampleRate);
    buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
    const source = port.createBufferSource();
    source.buffer = buffer;
    source.connect(sink.destination);
    source.onended = () => {
      try {
        source.disconnect();
      } catch {
        // Already disconnected.
      }
    };
    const when = port.currentTime;
    source.start(when);
    log({ type: 'chime', when, contextTime: port.currentTime, lateMs });
    return true;
  } catch {
    // Audio failure must not affect the timer (FR-008): the visual finish still happens.
    return false;
  }
}
