/**
 * Test-build fixtures (contracts/test-hooks.md). Only reachable behind `__FM_FAULT_INJECTION__`,
 * so production builds drop this module. Lookup is allow-list based: unknown names → undefined.
 */
import type { DisplayModel, Emphasis, Marker, NoteFunction } from './types';

const FUNCTIONS: readonly NoteFunction[] = ['root', 'third', 'fifth', 'degree', 'neutral'];
const EMPHASES: readonly Emphasis[] = ['highlighted', 'normal', 'dimmed', 'hidden'];

const allMarkers: Marker[] = FUNCTIONS.flatMap((fn, i) =>
  EMPHASES.map((emphasis, j) => ({ string: i + 1, fret: 2 + j * 3, function: fn, emphasis }))
);

const highlighted = (string: number, fret: number, fn: NoteFunction = 'neutral'): Marker => ({
  string,
  fret,
  function: fn,
  emphasis: 'highlighted'
});

const FIXTURES = {
  'all-markers': { markers: allMarkers, labelMode: 'note' },
  'labels-spelled': {
    markers: [
      {
        string: 1,
        fret: 1,
        function: 'root',
        emphasis: 'normal',
        spelling: { letter: 'E', accidental: 1 }
      },
      {
        string: 2,
        fret: 10,
        function: 'third',
        emphasis: 'normal',
        spelling: { letter: 'B', accidental: -2 }
      },
      {
        string: 3,
        fret: 0,
        function: 'fifth',
        emphasis: 'normal',
        spelling: { letter: 'F', accidental: 2 }
      },
      {
        string: 2,
        fret: 0,
        function: 'neutral',
        emphasis: 'normal',
        spelling: { letter: 'C', accidental: -1 }
      },
      { string: 6, fret: 1, function: 'neutral', emphasis: 'normal' },
      { string: 5, fret: 3, function: 'neutral', emphasis: 'normal' }
    ],
    labelMode: 'note'
  },
  'highlight-far': {
    markers: [highlighted(6, 15, 'root'), highlighted(6, 16, 'third'), highlighted(6, 17, 'fifth')],
    labelMode: 'note'
  },
  'highlight-split': {
    markers: [highlighted(6, 2, 'root'), highlighted(6, 20, 'fifth')],
    labelMode: 'note'
  },
  empty: { markers: [], labelMode: 'note' }
} as const satisfies Record<string, DisplayModel>;

export function fixtureModel(name: unknown): DisplayModel | undefined {
  return typeof name === 'string' && Object.hasOwn(FIXTURES, name)
    ? FIXTURES[name as keyof typeof FIXTURES]
    : undefined;
}
