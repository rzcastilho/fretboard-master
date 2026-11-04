/**
 * Click sound preview (042, contracts/click-sound-api.md §3). Framework-free: plays one accent
 * click of the chosen sound through the shared sink, so volume and mute apply.
 */
import { renderClick, type ClickSound } from './click';
import type { AudioSink } from './engine';
import { log } from './log';

/** Plays one accent click now. Never throws; `false` when nothing played. */
export function playClickPreview(sink: AudioSink, sound: ClickSound): boolean {
  const { port } = sink;
  if (port.state !== 'running') return false;
  try {
    const samples = renderClick('accent', port.sampleRate, sound);
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
    log({ type: 'click-preview', sound, when, contextTime: port.currentTime });
    return true;
  } catch {
    return false;
  }
}
