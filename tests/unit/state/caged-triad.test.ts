import { describe, expect, it } from 'vitest';
import { AF_21 } from '../../../src/lib/instrument/fixtures';
import { STANDARD_GUITAR, type Instrument } from '../../../src/lib/instrument/instrument';
import { pitchOfSpelling } from '../../../src/lib/theory/pitch';
import { cagedOccurrences, type CagedShapeId } from '../../../src/lib/theory/caged';
import {
  defaultTriadSet,
  selectedTriad,
  settleTriadSet,
  triadAvailability,
  triadHandoff,
  triadRevealIds,
  type SetAvailability
} from '../../../src/lib/state/caged-triad';
import { initialCagedView } from '../../../src/lib/state/caged-view';

const C = { letter: 'C', accidental: 0 } as const;

function avail(shape: CagedShapeId, instrument: Instrument = STANDARD_GUITAR): SetAvailability[] {
  const six = instrument.openStrings.slice(0, 6).map(pitchOfSpelling).reverse();
  const occ = cagedOccurrences(six, 0, 'major', instrument.fretCount).find(
    (o) => o.shape.id === shape
  );
  return [...triadAvailability(occ ?? null, instrument, C, 'major')];
}

describe('triadAvailability', () => {
  it('is [] when no occurrence is in focus', () => {
    expect(triadAvailability(null, STANDARD_GUITAR, C, 'major')).toEqual([]);
  });

  it('has one entry per set: four on six strings, five on seven', () => {
    expect(avail('A').map((a) => a.set)).toEqual([6, 5, 4, 3]);
    expect(avail('A', AF_21).map((a) => a.set)).toEqual([7, 6, 5, 4, 3]);
  });

  it('C major A shape: set 3 available, set 5 not', () => {
    const a = avail('A');
    expect(a.find((x) => x.set === 3)?.triad?.frets).toEqual([5, 5, 3]);
    expect(a.find((x) => x.set === 5)?.triad).toBeNull();
  });
});

describe('defaultTriadSet', () => {
  it('C major A shape → 3', () => expect(defaultTriadSet(avail('A'))).toBe(3));
  it('C major G shape → 6 (3 unavailable)', () => expect(defaultTriadSet(avail('G'))).toBe(6));
  it('seven strings with 3 unavailable → first available from 7', () => {
    const a = avail('G', AF_21);
    expect(a.find((x) => x.set === 3)?.triad).toBeNull();
    const first = a.find((x) => x.triad !== null)?.set;
    expect(defaultTriadSet(a)).toBe(first);
  });
  it('nothing available → null', () => {
    expect(defaultTriadSet([])).toBeNull();
    expect(defaultTriadSet(avail('A').map((a) => ({ set: a.set, triad: null })))).toBeNull();
  });
});

describe('settleTriadSet', () => {
  it('keeps an available set', () =>
    expect(settleTriadSet(3, avail('A'))).toEqual({ set: 3, moved: false }));
  it('moves to the default when unavailable', () =>
    expect(settleTriadSet(3, avail('G'))).toEqual({ set: 6, moved: true }));
  it('keeps the set when none is available', () => {
    const none = avail('A').map((a) => ({ set: a.set, triad: null }));
    expect(settleTriadSet(3, none)).toEqual({ set: 3, moved: false });
  });
});

describe('selectedTriad', () => {
  it('returns the triad of the set, or null', () => {
    const a = avail('A');
    expect(selectedTriad(3, a)?.frets).toEqual([5, 5, 3]);
    expect(selectedTriad(5, a)).toBeNull();
    expect(selectedTriad(null, a)).toBeNull();
    expect(selectedTriad(3, [])).toBeNull();
  });
});

describe('triadRevealIds', () => {
  it('orders low to high by pitch', () => {
    const t = selectedTriad(3, avail('A'));
    expect(triadRevealIds(t)).toEqual(['triad:3:5', 'triad:2:5', 'triad:1:3']);
  });
  it('is [] for null', () => expect(triadRevealIds(null)).toEqual([]));
  it('ties go to the higher string number first', () => {
    const t = {
      set: 5,
      inversion: 'root',
      frets: [0, 0, 0],
      functions: ['root', 'third', 'fifth'],
      occurrence: 0,
      pitches: [60, 60, 60]
    } as never;
    expect(triadRevealIds(t)).toEqual(['triad:5:0', 'triad:4:0', 'triad:3:0']);
  });
});

describe('triadHandoff', () => {
  const view = initialCagedView();
  const t = selectedTriad(3, avail('A'));
  it('carries root, spelling, quality, inversion, set and occurrence', () => {
    expect(triadHandoff(view, t, false)).toEqual({
      rootPc: 0,
      spelling: 'none',
      quality: 'major',
      inversion: 'root',
      stringSet: 3,
      occurrence: 0
    });
  });
  it('is null when temporary or t is null', () => {
    expect(triadHandoff(view, t, true)).toBeNull();
    expect(triadHandoff(view, null, false)).toBeNull();
  });
});
