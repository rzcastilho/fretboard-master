import { describe, expect, it } from 'vitest';
import { beatDots, statusParams } from '../../../src/lib/state/metronome-view';

describe('beatDots', () => {
  it('lights the current beat, dims earlier ones, leaves later ones upcoming', () => {
    expect(beatDots(4, 3)).toEqual(['played', 'played', 'lit', 'upcoming']);
  });

  it('is all upcoming before the first click', () => {
    expect(beatDots(4, 0)).toEqual(['upcoming', 'upcoming', 'upcoming', 'upcoming']);
  });

  it('wrapping to beat 1 resets the others to upcoming', () => {
    expect(beatDots(4, 4)).toEqual(['played', 'played', 'played', 'lit']);
    expect(beatDots(4, 1)).toEqual(['lit', 'upcoming', 'upcoming', 'upcoming']);
  });

  it('a single beat is always lit', () => {
    expect(beatDots(1, 1)).toEqual(['lit']);
  });
});

describe('statusParams', () => {
  it('selects the "none" message for beat 0', () => {
    expect(statusParams(0, 4)).toEqual({ kind: 'none', beats: 4 });
  });
  it('selects the beat message otherwise', () => {
    expect(statusParams(2, 4)).toEqual({ kind: 'beat', beat: 2, beats: 4 });
  });
});
