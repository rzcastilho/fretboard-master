import { beforeEach, describe, expect, it } from 'vitest';
import { encodeLink, type LinkInstrument, type ShareSnapshot } from '../../../src/lib/link';
import { tuningFromOffsets, tuningInstrument } from '../../../src/lib/instrument/tunings';
import type { Tuning } from '../../../src/lib/instrument/tunings';
import { resetCagedForTests } from '../../../src/lib/state/caged.svelte';
import { initialCagedView } from '../../../src/lib/state/caged-view';
import { CHORD_ONLY } from '../../../src/lib/state/caged-layers';
import { resetInstrumentForTests } from '../../../src/lib/state/instrument.svelte';
import { initialNotesView } from '../../../src/lib/state/notes-view';
import { resetNotesForTests } from '../../../src/lib/state/notes.svelte';
import { opening, resetOpeningForTests } from '../../../src/lib/state/opening.svelte';
import { resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';
import { preferences, resetPreferencesForTests } from '../../../src/lib/state/preferences.svelte';
import { currentSnapshot, resetShareForTests } from '../../../src/lib/state/share.svelte';
import { initialTriadsView } from '../../../src/lib/state/triads-view';
import { resetTriadsForTests } from '../../../src/lib/state/triads.svelte';
import { fakeStorage } from '../prefs/support';

const ORIGIN = 'https://fretboard.example';

const preset = (id: Extract<Tuning, { kind: 'preset' }>['id']): Tuning => ({ kind: 'preset', id });

/** SC-001: preset and custom tunings, 6 and 7 strings, several fret counts. */
const INSTRUMENTS: readonly LinkInstrument[] = [
  { stringCount: 6, tuning: preset('AF-1'), fretCount: 22 },
  { stringCount: 6, tuning: preset('AF-4'), fretCount: 12 },
  { stringCount: 6, tuning: tuningFromOffsets([-2, 0, 0, 0, 0, 3]), fretCount: 24 },
  { stringCount: 7, tuning: preset('AF-21'), fretCount: 22 },
  { stringCount: 7, tuning: tuningFromOffsets([-5, -2, 0, 0, 0, 0, 1]), fretCount: 18 }
];

const inst = (i: LinkInstrument) => tuningInstrument(i.tuning, i.stringCount, i.fretCount);

function snapshotsOn(i: LinkInstrument): ShareSnapshot[] {
  const base = inst(i);
  const compatible = i.tuning.kind === 'preset' && i.tuning.id === 'AF-1';
  return [
    // Every optional field at its "none" value.
    { tool: 'notes', view: initialNotesView(base), instrument: i },
    {
      tool: 'notes',
      view: {
        ...initialNotesView(base),
        selection: [4, 0, 7],
        labelType: 'octave',
        background: 'all',
        hideNames: true,
        activeStrings: [1, 2],
        region: { start: 2, end: Math.min(9, i.fretCount) },
        card: { string: 1, fret: 3 }
      },
      instrument: i
    },
    { tool: 'triads', view: initialTriadsView(base), instrument: i },
    {
      tool: 'triads',
      view: {
        ...initialTriadsView(base),
        rootPc: 6,
        spellingOverride: 'flat',
        quality: 'minor',
        inversion: 'second',
        labelType: 'name',
        view: 'full-neck',
        compare: { on: true, quality: 'diminished' }
      },
      instrument: i
    },
    { tool: 'caged', view: initialCagedView('interval'), instrument: i, temporary: false },
    {
      tool: 'caged',
      view: {
        ...initialCagedView('name'),
        rootPc: 2,
        quality: 'minor',
        focus: compatible ? { letter: 'E', ordinal: 0 } : null,
        layers: { ...CHORD_ONLY, arpeggio: true },
        connections: true
      },
      instrument: i,
      temporary: false
    }
  ];
}

beforeEach(() => {
  resetPlaybackForTests();
  resetPreferencesForTests();
  resetNotesForTests();
  resetTriadsForTests();
  resetCagedForTests();
  resetInstrumentForTests();
  resetOpeningForTests();
  resetShareForTests();
  preferences.start(fakeStorage());
});

describe('opening → share round trip (SC-001)', () => {
  for (const i of INSTRUMENTS) {
    const label = `${i.stringCount} strings, ${i.tuning.kind === 'preset' ? i.tuning.id : 'custom'}, ${i.fretCount} frets`;
    for (const snapshot of snapshotsOn(i)) {
      it(`${snapshot.tool} on ${label}`, () => {
        opening.start(encodeLink(snapshot, ORIGIN));
        expect(opening.incomplete).toBeNull();
        expect(currentSnapshot(snapshot.tool)).toEqual(snapshot);
      });
    }
  }
});
