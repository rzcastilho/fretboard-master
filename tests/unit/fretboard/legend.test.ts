import { describe, expect, it } from 'vitest';
import { legendGroups, legendKinds } from '../../../src/lib/fretboard/legend';
import type { DisplayModel, Marker } from '../../../src/lib/fretboard/types';

const mk = (over: Partial<Marker> & Pick<Marker, 'function'>): Marker => ({
  string: 1,
  fret: 0,
  emphasis: 'highlighted',
  ...over
});
const model = (markers: Marker[], extra: Partial<DisplayModel> = {}): DisplayModel => ({
  markers,
  labelMode: 'note',
  ...extra
});
const triad = [
  mk({ function: 'root', string: 4 }),
  mk({ function: 'third', string: 3 }),
  mk({ function: 'fifth', string: 2 })
];

describe('legendKinds (contract fixtures)', () => {
  it('Triads 4-3-2 → root, third, fifth', () => {
    expect(legendKinds(model(triad))).toEqual(['root', 'third', 'fifth']);
  });

  it('Triads + comparison → adds comparison (arrows)', () => {
    const m = model(triad, {
      arrows: [{ kind: 'move', id: 'a', string: 3, fromFret: 1, toFret: 2, label: 'x' }]
    });
    expect(legendKinds(m)).toEqual(['root', 'third', 'fifth', 'comparison']);
  });

  it('comparison variant marker counts as comparison', () => {
    const m = model([...triad, mk({ function: 'third', string: 5, variant: 'comparison' })]);
    expect(legendKinds(m)).toContain('comparison');
  });

  it('wide shape → adds wideStretch', () => {
    expect(legendKinds(model(triad, { wideStretch: true }))).toEqual([
      'root',
      'third',
      'fifth',
      'wideStretch'
    ]);
  });

  it('Notes: 3 selected over neutral background → neutral, selected', () => {
    const m = model([
      mk({ function: 'neutral', emphasis: 'highlighted', string: 1 }),
      mk({ function: 'neutral', emphasis: 'highlighted', string: 2 }),
      mk({ function: 'neutral', emphasis: 'highlighted', string: 3 }),
      mk({ function: 'neutral', emphasis: 'normal', string: 4 })
    ]);
    expect(legendKinds(m)).toEqual(['neutral', 'selected']);
  });

  it('Notes octave labels → adds octave', () => {
    const m = model(
      [
        mk({ function: 'neutral', emphasis: 'highlighted', tone: 2 }),
        mk({ function: 'neutral', emphasis: 'normal', string: 2 })
      ],
      { labelMode: 'octave' }
    );
    expect(legendKinds(m)).toEqual(['neutral', 'selected', 'octave']);
  });

  it('octave badge counts as octave', () => {
    const m = model([mk({ function: 'neutral', octaveBadge: true })]);
    expect(legendKinds(m)).toContain('octave');
  });

  it('CAGED default → root, third, fifth', () => {
    expect(legendKinds(model(triad))).toEqual(['root', 'third', 'fifth']);
  });

  it('CAGED layers: arpeggio, degree, extra, triadLayer', () => {
    const m = model([
      mk({ function: 'root' }),
      mk({ function: 'third', layer: 'arpeggio', string: 2 }),
      mk({ function: 'degree', string: 3 }),
      mk({ function: 'degree', extra: true, string: 4 }),
      mk({ function: 'fifth', layer: 'triad', string: 5 })
    ]);
    expect(legendKinds(m)).toEqual(['root', 'degree', 'arpeggio', 'triadLayer', 'extra']);
  });

  it('connections → adds connection', () => {
    const m = model([mk({ function: 'root', ring: true }), ...triad.slice(1)]);
    expect(legendKinds(m)).toEqual(['root', 'third', 'fifth', 'connection']);
  });

  it('altered sixth string → adds alteredString', () => {
    const m = model(triad, { stringMarks: [{ string: 6, label: 'x' }] });
    expect(legendKinds(m)).toEqual(['root', 'third', 'fifth', 'alteredString']);
  });

  it('empty → []', () => {
    expect(legendKinds(model([]))).toEqual([]);
    expect(legendGroups(model([]))).toEqual([]);
  });

  it('hidden markers never count; dimmed markers count', () => {
    const m = model([
      mk({ function: 'root', emphasis: 'hidden' }),
      mk({ function: 'third', emphasis: 'dimmed', string: 2 }),
      mk({ function: 'neutral', emphasis: 'hidden', string: 3, ring: true, tone: 1 })
    ]);
    expect(legendKinds(m)).toEqual(['third']);
  });

  it('dimmed neutral is neutral, not selected', () => {
    expect(legendKinds(model([mk({ function: 'neutral', emphasis: 'dimmed' })]))).toEqual([
      'neutral'
    ]);
  });
});

describe('legendGroups', () => {
  it('flat single group when legendGroups absent', () => {
    expect(legendGroups(model(triad))).toEqual([{ kinds: ['root', 'third', 'fifth'] }]);
  });

  it('CAGED Chord + Pentatonic → Chord, Arpeggio, Pentatonic groups', () => {
    const m = model(
      [
        ...triad,
        mk({ function: 'root', layer: 'arpeggio', string: 5 }),
        mk({ function: 'degree', string: 6 })
      ],
      {
        legendGroups: [
          { label: 'Chord', kinds: ['root', 'third', 'fifth'] },
          { label: 'Arpeggio', kinds: ['arpeggio'] },
          { label: 'Pentatonic', kinds: ['degree'] }
        ]
      }
    );
    expect(legendGroups(m)).toEqual([
      { label: 'Chord', kinds: ['root', 'third', 'fifth'] },
      { label: 'Arpeggio', kinds: ['arpeggio'] },
      { label: 'Pentatonic', kinds: ['degree'] }
    ]);
  });

  it('drops unknown kinds and empty groups', () => {
    const m = model(triad, {
      legendGroups: [
        { label: 'Chord', kinds: ['root', 'third', 'fifth', 'degree'] },
        { label: 'Arpeggio', kinds: ['arpeggio'] },
        { label: 'Empty', kinds: [] }
      ]
    });
    expect(legendGroups(m)).toEqual([{ label: 'Chord', kinds: ['root', 'third', 'fifth'] }]);
  });

  it('a kind keeps only its first group', () => {
    const m = model([mk({ function: 'degree' })], {
      legendGroups: [
        { label: 'Pentatonic', kinds: ['degree'] },
        { label: 'Scale', kinds: ['degree'] }
      ]
    });
    expect(legendGroups(m)).toEqual([{ label: 'Pentatonic', kinds: ['degree'] }]);
  });

  it('in-use kinds in no group go to a trailing unlabeled group', () => {
    const m = model([...triad, mk({ function: 'root', ring: true, string: 6 })], {
      stringMarks: [{ string: 6, label: 'x' }],
      legendGroups: [{ label: 'Chord', kinds: ['root', 'third', 'fifth'] }]
    });
    expect(legendGroups(m)).toEqual([
      { label: 'Chord', kinds: ['root', 'third', 'fifth'] },
      { kinds: ['connection', 'alteredString'] }
    ]);
  });
});
