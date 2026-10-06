import type { ShareSnapshot } from '$lib/link';

export const name = 'caged-temporary';

export const snapshot: ShareSnapshot = {
  tool: 'caged',
  view: {
    rootPc: 6,
    spellingOverride: 'sharp',
    quality: 'minor',
    focus: { letter: 'D', ordinal: 0 },
    connections: false,
    layers: { chord: true, arpeggio: false, pentatonic: true, scale: false, triad: false },
    triadSet: null,
    labelType: 'interval'
  },
  instrument: {
    stringCount: 6,
    tuning: { kind: 'custom', offsets: [0, 0, -2, 0, 0, 3] },
    fretCount: 20
  },
  temporary: true
};

export const link =
  'https://fretboard.example/caged?v=1&rt=6&sp=sharp&q=minor&fc=D.0&ly=10100&cn=0&ts=-&lb=interval&tmp=1&sc=6&tu=c.67.59.55.48.45.40&fr=20';
