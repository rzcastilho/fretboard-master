import type { ShareSnapshot } from '$lib/link';

export const name = 'caged-default';

export const snapshot: ShareSnapshot = {
  tool: 'caged',
  view: {
    rootPc: 0,
    spellingOverride: 'none',
    quality: 'major',
    focus: null,
    connections: false,
    layers: { chord: true, arpeggio: false, pentatonic: false, scale: false, triad: false },
    triadSet: null,
    labelType: 'interval'
  },
  instrument: { stringCount: 6, tuning: { kind: 'preset', id: 'AF-1' }, fretCount: 22 },
  temporary: false
};

export const link =
  'https://fretboard.example/caged?v=1&rt=0&sp=none&q=major&fc=-&ly=10000&cn=0&ts=-&lb=interval&tmp=0&sc=6&tu=AF-1&fr=22';
