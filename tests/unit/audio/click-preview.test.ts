import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderClick } from '../../../src/lib/audio/click';
import { playClickPreview } from '../../../src/lib/audio/click-preview';
import type { AudioSink } from '../../../src/lib/audio/engine';
import { FakeAudioPort } from './support/fake-audio';

function sinkOf(port: FakeAudioPort): { sink: AudioSink; destination: object } {
  const destination = { kind: 'volume' };
  return {
    destination,
    sink: {
      port: port as unknown as AudioSink['port'],
      destination: destination as unknown as AudioNode,
      running: Promise.resolve(true)
    }
  };
}

describe('playClickPreview (042)', () => {
  beforeEach(() => {
    globalThis.__fmAudioLog = [];
  });
  afterEach(() => {
    globalThis.__fmAudioLog = undefined;
  });

  it('plays one accent buffer now through the sink destination', () => {
    const port = new FakeAudioPort();
    port.state = 'running';
    port.currentTime = 2.5;
    const { sink, destination } = sinkOf(port);
    expect(playClickPreview(sink, 'wood')).toBe(true);
    expect(port.buffers).toHaveLength(1);
    expect(port.sources).toHaveLength(1);
    const src = port.sources[0];
    expect(src.connected).toEqual([destination]);
    expect(src.startCalls).toEqual([2.5]);
    expect(port.buffers[0].length).toBe(renderClick('accent', port.sampleRate, 'wood').length);
  });

  it('logs a click-preview entry', () => {
    const port = new FakeAudioPort();
    port.state = 'running';
    port.currentTime = 1.5;
    playClickPreview(sinkOf(port).sink, 'rim');
    expect(globalThis.__fmAudioLog).toEqual([
      { type: 'click-preview', sound: 'rim', when: 1.5, contextTime: 1.5 }
    ]);
  });

  it('a context that is not running plays nothing and logs nothing', () => {
    const port = new FakeAudioPort();
    port.state = 'suspended';
    expect(playClickPreview(sinkOf(port).sink, 'beep')).toBe(false);
    expect(port.sources).toHaveLength(0);
    expect(globalThis.__fmAudioLog).toEqual([]);
  });

  it('a throwing Web Audio call gives false, never an exception', () => {
    const port = new FakeAudioPort();
    port.state = 'running';
    port.createBufferSource = () => {
      throw new Error('boom');
    };
    expect(playClickPreview(sinkOf(port).sink, 'cowbell')).toBe(false);
    const port2 = new FakeAudioPort();
    port2.state = 'running';
    port2.createBuffer = () => {
      throw new Error('boom');
    };
    expect(playClickPreview(sinkOf(port2).sink, 'click')).toBe(false);
  });
});
