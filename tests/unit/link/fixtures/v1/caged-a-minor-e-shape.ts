import type { ShareSnapshot } from '$lib/link';

export const name = 'caged-a-minor-e-shape';

export const snapshot: ShareSnapshot = {
  tool: 'caged',
  view: {
    rootPc: 9,
    spellingOverride: 'none',
    quality: 'minor',
    focus: { letter: 'E', ordinal: 0 },
    connections: false,
    layers: { chord: true, arpeggio: false, pentatonic: true, scale: false, triad: false },
    triadSet: null,
    labelType: 'interval'
  },
  instrument: { stringCount: 6, tuning: { kind: 'preset', id: 'AF-1' }, fretCount: 22 },
  temporary: false
};

export const link =
  'https://fretboard.example/caged?v=1&rt=9&sp=none&q=minor&fc=E.0&ly=10100&cn=0&ts=-&lb=interval&tmp=0&sc=6&tu=AF-1&fr=22';
