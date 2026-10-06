import type { ShareSnapshot } from '$lib/link';

export const name = 'triads-compare-full-neck';

export const snapshot: ShareSnapshot = {
  tool: 'triads',
  view: {
    rootPc: 2,
    spellingOverride: 'none',
    quality: 'minor',
    inversion: 'first',
    stringSet: 4,
    labelType: 'name',
    occurrence: 0,
    view: 'full-neck',
    compare: { on: true, quality: 'major' }
  },
  instrument: { stringCount: 6, tuning: { kind: 'preset', id: 'AF-1' }, fretCount: 22 }
};

export const link =
  'https://fretboard.example/triads?v=1&rt=2&sp=none&q=minor&inv=first&ss=4&vw=full-neck&oc=0&cmp=1&cq=major&lb=name&sc=6&tu=AF-1&fr=22';
