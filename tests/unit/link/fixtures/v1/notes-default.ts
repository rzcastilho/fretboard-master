import type { ShareSnapshot } from '$lib/link';

export const name = 'notes-default';

export const snapshot: ShareSnapshot = {
  tool: 'notes',
  view: {
    selection: [],
    labelType: 'name',
    background: 'naturals',
    hideNames: false,
    activeStrings: [1, 2, 3, 4, 5, 6],
    region: { start: 0, end: 22 },
    card: null
  },
  instrument: { stringCount: 6, tuning: { kind: 'preset', id: 'AF-1' }, fretCount: 22 }
};

export const link =
  'https://fretboard.example/notes?v=1&sel=-&str=1.2.3.4.5.6&rg=0.22&bg=naturals&hn=0&cd=-&lb=name&sc=6&tu=AF-1&fr=22';
