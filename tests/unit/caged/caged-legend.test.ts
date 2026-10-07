import { describe, expect, it } from 'vitest';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import type { DisplayModel } from '../../../src/lib/fretboard/types';
import { legendGroups } from '../../../src/lib/fretboard/legend';
import { buildCagedModel } from '../../../src/lib/state/caged-model';
import { initialCagedView } from '../../../src/lib/state/caged-view';

const ctx = { tuningName: 'Standard', temporary: false };
const groupsOf = (layers: Partial<ReturnType<typeof initialCagedView>['layers']>) => {
  const view = initialCagedView();
  const built = buildCagedModel(
    { ...view, focus: { letter: 'C', ordinal: 0 }, layers: { ...view.layers, ...layers } },
    STANDARD_GUITAR,
    ctx
  );
  return legendGroups(built.model as DisplayModel);
};

describe('CAGED Legend groups (US3)', () => {
  it('default Chord layer → one Chord group of root, third, fifth', () => {
    expect(groupsOf({})).toEqual([{ label: 'Chord', kinds: ['root', 'third', 'fifth'] }]);
  });

  it('Chord + Pentatonic → Chord and Pentatonic groups', () => {
    expect(groupsOf({ pentatonic: true })).toEqual([
      { label: 'Chord', kinds: ['root', 'third', 'fifth'] },
      { label: 'Pentatonic', kinds: expect.arrayContaining(['degree']) }
    ]);
  });

  it('Chord + Arpeggio → Arpeggio group', () => {
    const groups = groupsOf({ arpeggio: true });
    expect(groups.map((g) => g.label)).toEqual(['Chord', 'Arpeggio']);
    expect(groups[1].kinds).toEqual(['arpeggio']);
  });
});
