import type { ShareSnapshot } from '$lib/link';

export const name = 'caged-triad-layer-ts';

export const snapshot: ShareSnapshot = {
  tool: 'caged',
  view: {
    rootPc: 7,
    spellingOverride: 'none',
    quality: 'major',
    focus: { letter: 'C', ordinal: 1 },
    connections: true,
    layers: { chord: true, arpeggio: false, pentatonic: false, scale: false, triad: true },
    triadSet: 4,
    labelType: 'name'
  },
  instrument: { stringCount: 6, tuning: { kind: 'preset', id: 'AF-1' }, fretCount: 22 },
  temporary: false
};

export const link =
  'https://fretboard.example/caged?v=1&rt=7&sp=none&q=major&fc=C.1&ly=10001&cn=1&ts=4&lb=name&tmp=0&sc=6&tu=AF-1&fr=22';
