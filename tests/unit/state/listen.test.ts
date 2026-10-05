import { describe, expect, it } from 'vitest';
import { NOTE_MS } from '../../../src/lib/audio/schedule';
import { LISTEN_BPM, RING_MS, TEMPOS, TEMPO_BPM, isTempo } from '../../../src/lib/state/listen';

describe('listen constants', () => {
  it('medium tempo matches LISTEN_BPM', () => {
    expect(TEMPO_BPM.medium).toBe(LISTEN_BPM);
  });

  it('RING_MS equals NOTE_MS', () => {
    expect(RING_MS).toBe(NOTE_MS);
  });

  it('isTempo accepts only the three tempos', () => {
    for (const t of TEMPOS) expect(isTempo(t)).toBe(true);
    for (const x of ['', 'Slow', 'fastest', 80, null, undefined, {}])
      expect(isTempo(x)).toBe(false);
  });
});
