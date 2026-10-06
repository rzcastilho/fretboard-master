import type { ShareSnapshot } from '$lib/link';

export const name = 'triads-compare-off-remembered';

export const snapshot: ShareSnapshot = {
  tool: 'triads',
  view: {
    rootPc: 1,
    spellingOverride: 'flat',
    quality: 'diminished',
    inversion: 'second',
    stringSet: 3,
    labelType: 'interval',
    occurrence: 0,
    view: 'isolated',
    compare: { on: false, quality: 'augmented' }
  },
  instrument: { stringCount: 6, tuning: { kind: 'preset', id: 'AF-1' }, fretCount: 22 }
};

export const link =
  'https://fretboard.example/triads?v=1&rt=1&sp=flat&q=diminished&inv=second&ss=3&vw=isolated&oc=0&cmp=0&cq=augmented&lb=interval&sc=6&tu=AF-1&fr=22';
