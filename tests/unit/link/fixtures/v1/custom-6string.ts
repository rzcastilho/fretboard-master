import type { ShareSnapshot } from '$lib/link';

export const name = 'custom-6string';

export const snapshot: ShareSnapshot = {
  tool: 'notes',
  view: {
    selection: [0, 4, 7],
    labelType: 'octave',
    background: 'all',
    hideNames: true,
    activeStrings: [1, 2, 3],
    region: { start: 5, end: 9 },
    card: { string: 2, fret: 5 }
  },
  instrument: {
    stringCount: 6,
    tuning: { kind: 'custom', offsets: [-1, 0, 0, 0, 0, 2] },
    fretCount: 22
  }
};

export const link =
  'https://fretboard.example/notes?v=1&sel=0.4.7&str=1.2.3&rg=5.9&bg=all&hn=1&cd=2.5&lb=octave&sc=6&tu=c.66.59.55.50.45.39&fr=22';
