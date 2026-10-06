import type { ShareSnapshot } from '$lib/link';

export const name = 'notes-rich';

export const snapshot: ShareSnapshot = {
  tool: 'notes',
  view: {
    selection: [4, 7, 0, 11, 2, 9, 5, 1, 10, 3, 8, 6],
    labelType: 'octave',
    background: 'all',
    hideNames: true,
    activeStrings: [1, 2, 3, 4, 5, 6, 7],
    region: { start: 3, end: 17 },
    card: { string: 7, fret: 12 }
  },
  instrument: {
    stringCount: 7,
    tuning: { kind: 'custom', offsets: [-1, 0, 0, 0, 0, 0, 2] },
    fretCount: 22
  }
};

export const link =
  'https://fretboard.example/notes?v=1&sel=4.7.0.11.2.9.5.1.10.3.8.6&str=1.2.3.4.5.6.7&rg=3.17&bg=all&hn=1&cd=7.12&lb=octave&sc=7&tu=c.66.59.55.50.45.40.34&fr=22';
