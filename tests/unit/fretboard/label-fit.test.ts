import { describe, expect, it } from 'vitest';
import { fitMarkerLabel } from '../../../src/lib/fretboard/label-fit';

describe('fitMarkerLabel (F-3, data-model §11)', () => {
  it('keeps a short label at normal size', () => {
    expect(fitMarkerLabel(['F♯'], 'medium')).toEqual({ lines: ['F♯'], size: 'normal' });
  });

  it('shrinks a 4-grapheme label to min', () => {
    expect(fitMarkerLabel(['Sol♯'], 'medium')).toEqual({ lines: ['Sol♯'], size: 'min' });
  });

  it('abbreviates the name to 2 graphemes first', () => {
    expect(fitMarkerLabel(['Sol♯3'], 'medium')).toEqual({ lines: ['So♯3'], size: 'min' });
    expect(fitMarkerLabel(['Sol𝄪3'], 'medium')).toEqual({ lines: ['So𝄪3'], size: 'min' });
  });

  it('drops the octave when the name abbreviation is not enough', () => {
    expect(fitMarkerLabel(['Sol𝄫10'], 'medium')).toEqual({ lines: ['So𝄫'], size: 'min' });
  });

  it('stacks two lines on medium and root markers at min', () => {
    for (const size of ['medium', 'root'] as const) {
      expect(fitMarkerLabel(['C♯', 'D♭'], size)).toEqual({ lines: ['C♯', 'D♭'], size: 'min' });
      expect(fitMarkerLabel(['Do♯', 'Re♭'], size)).toEqual({
        lines: ['Do♯', 'Re♭'],
        size: 'min'
      });
    }
  });

  it('keeps the first line only on a small marker', () => {
    expect(fitMarkerLabel(['C♯', 'D♭'], 'small')).toEqual({ lines: ['C♯'], size: 'normal' });
  });

  it('falls back to line 1 when a stacked line is longer than 3', () => {
    expect(fitMarkerLabel(['Sol♯', 'La♭'], 'medium')).toEqual({ lines: ['Sol♯'], size: 'min' });
  });

  it('is deterministic', () => {
    expect(fitMarkerLabel(['Sol♯3'], 'root')).toEqual(fitMarkerLabel(['Sol♯3'], 'root'));
  });
});
