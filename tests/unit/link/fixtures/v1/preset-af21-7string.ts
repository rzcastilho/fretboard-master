import type { ShareSnapshot } from '$lib/link';

export const name = 'preset-af21-7string';

export const snapshot: ShareSnapshot = {
  tool: 'triads',
  view: {
    rootPc: 4,
    spellingOverride: 'none',
    quality: 'major',
    inversion: 'root',
    stringSet: 5,
    labelType: 'interval',
    occurrence: 0,
    view: 'isolated',
    compare: { on: false, quality: null }
  },
  instrument: { stringCount: 7, tuning: { kind: 'preset', id: 'AF-21' }, fretCount: 24 }
};

export const link =
  'https://fretboard.example/triads?v=1&rt=4&sp=none&q=major&inv=root&ss=5&vw=isolated&oc=0&cmp=0&cq=-&lb=interval&sc=7&tu=AF-21&fr=24';
