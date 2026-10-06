import type { ShareSnapshot } from '$lib/link';

export const name = 'triads-default';

export const snapshot: ShareSnapshot = {
  tool: 'triads',
  view: {
    rootPc: 0,
    spellingOverride: 'none',
    quality: 'major',
    inversion: 'root',
    stringSet: 3,
    labelType: 'interval',
    occurrence: 0,
    view: 'isolated',
    compare: { on: false, quality: null }
  },
  instrument: { stringCount: 6, tuning: { kind: 'preset', id: 'AF-1' }, fretCount: 22 }
};

export const link =
  'https://fretboard.example/triads?v=1&rt=0&sp=none&q=major&inv=root&ss=3&vw=isolated&oc=0&cmp=0&cq=-&lb=interval&sc=6&tu=AF-1&fr=22';
