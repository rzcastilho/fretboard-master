import { describe, expect, it, vi } from 'vitest';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import {
  initialCagedView,
  setFocus,
  setLayers,
  setTriadSet
} from '../../../src/lib/state/caged-view';

// A shape with no close-position triad on any set cannot be built from the fixtures, so the
// availability is stubbed to "all unavailable"; the rest of caged-triad stays real.
vi.mock('../../../src/lib/state/caged-triad', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../src/lib/state/caged-triad')>();
  return {
    ...real,
    triadAvailability: (...args: Parameters<typeof real.triadAvailability>) =>
      real.triadAvailability(...args).map((a) => ({ set: a.set, triad: null }))
  };
});

const { buildCagedModel } = await import('../../../src/lib/state/caged-model');

describe('Triad layer model: every set unavailable (018 US2)', () => {
  const base = setFocus(initialCagedView(), { letter: 'A', ordinal: 0 });
  const view = setTriadSet(
    setLayers(base, { chord: true, arpeggio: false, pentatonic: false, scale: false, triad: true }),
    3
  );
  const d = buildCagedModel(view, STANDARD_GUITAR, { tuningName: 'Standard', temporary: false });

  it('selected is null, with every set disabled and the note shown', () => {
    expect(d.triad?.selected).toBeNull();
    expect(d.triad?.sets.every((s) => !s.available)).toBe(true);
    expect(d.triad?.unavailableNote).toBe(
      'In this shape there is no close-position triad on these strings'
    );
    expect(d.triad?.summary).toBeNull();
  });

  it('draws no triad markers and offers no handoff', () => {
    expect((d.model?.markers ?? []).filter((k) => k.layer === 'triad')).toHaveLength(0);
    expect(d.triad?.handoff).toBeNull();
  });
});
