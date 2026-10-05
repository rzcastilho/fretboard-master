import { describe, expect, it } from 'vitest';
import { describeView, positionName } from '../../../src/lib/fretboard/description';
import type { DisplayModel, Marker } from '../../../src/lib/fretboard/types';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import { presetInstrument } from '../../../src/lib/instrument/tunings';

const marker = (over: Partial<Marker>): Marker => ({
  string: 1,
  fret: 2,
  function: 'third',
  emphasis: 'normal',
  ...over
});

describe('positionName', () => {
  it('names fretted and open positions', () => {
    expect(positionName(STANDARD_GUITAR, { string: 2, fret: 1 })).toBe('C, string 2, fret 1');
    expect(positionName(STANDARD_GUITAR, { string: 6, fret: 0 })).toBe('E, string 6, open');
  });

  it('adds the function when a marker is present', () => {
    expect(positionName(STANDARD_GUITAR, { string: 1, fret: 2 }, marker({}))).toBe(
      'F sharp, string 1, fret 2, third'
    );
    expect(
      positionName(STANDARD_GUITAR, { string: 1, fret: 2 }, marker({ function: 'neutral' }))
    ).toBe('F sharp, string 1, fret 2, note');
  });

  it('uses an explicit spelling', () => {
    const m = marker({
      string: 1,
      fret: 1,
      function: 'root',
      spelling: { letter: 'E', accidental: 1 }
    });
    expect(positionName(STANDARD_GUITAR, { string: 1, fret: 1 }, m)).toBe(
      'E sharp, string 1, fret 1, root'
    );
  });

  it('adds no function for a hidden marker', () => {
    expect(
      positionName(STANDARD_GUITAR, { string: 1, fret: 2 }, marker({ emphasis: 'hidden' }))
    ).toBe('F sharp, string 1, fret 2');
  });
});

describe('describeView', () => {
  const model = (markers: Marker[], summary?: string): DisplayModel => ({
    markers,
    labelMode: 'note',
    summary
  });

  it('says no positions are marked when empty', () => {
    expect(describeView(STANDARD_GUITAR, model([]))).toBe('No positions marked.');
  });

  it('orders string 6→1 then fret ascending', () => {
    const text = describeView(
      STANDARD_GUITAR,
      model([
        marker({ string: 1, fret: 2, function: 'third' }),
        marker({ string: 6, fret: 5, function: 'fifth' }),
        marker({ string: 6, fret: 3, function: 'root' })
      ])
    );
    expect(text).toBe(
      'string 6, fret 3, G, root; string 6, fret 5, A, fifth; string 1, fret 2, F sharp, third'
    );
  });

  it('uses the open form for fret 0', () => {
    expect(
      describeView(STANDARD_GUITAR, model([marker({ string: 6, fret: 0, function: 'root' })]))
    ).toBe('string 6, open, E, root');
  });

  it('omits dimmed and hidden markers', () => {
    const text = describeView(
      STANDARD_GUITAR,
      model([
        marker({ string: 2, fret: 1, emphasis: 'dimmed' }),
        marker({ string: 3, fret: 1, emphasis: 'hidden' }),
        marker({ string: 4, fret: 1, emphasis: 'highlighted', function: 'root' })
      ])
    );
    expect(text).toBe('string 4, fret 1, D sharp, root');
  });

  it('uses explicit spellings', () => {
    const text = describeView(
      STANDARD_GUITAR,
      model([marker({ string: 1, fret: 1, spelling: { letter: 'E', accidental: 1 } })])
    );
    expect(text).toBe('string 1, fret 1, E sharp, third');
  });

  it('prefixes the summary', () => {
    expect(describeView(STANDARD_GUITAR, model([], 'C major triad.'))).toBe(
      'C major triad. No positions marked.'
    );
    expect(
      describeView(
        STANDARD_GUITAR,
        model([marker({ string: 1, fret: 0, function: 'root' })], 'Hi.')
      )
    ).toBe('Hi. string 1, open, E, root');
  });
});

describe('positionName comparison suffix (F8)', () => {
  it('appends the comparison note suffix for comparison markers only', () => {
    const marker = {
      string: 2,
      fret: 4,
      function: 'third',
      emphasis: 'highlighted',
      variant: 'comparison'
    } as const;
    const plain = positionName(
      STANDARD_GUITAR,
      { string: 2, fret: 4 },
      { ...marker, variant: undefined }
    );
    const named = positionName(STANDARD_GUITAR, { string: 2, fret: 4 }, marker);
    expect(named).toBe(`${plain}, comparison`);
    expect(plain).not.toContain('comparison');
  });
});

describe('seven-string descriptions (FR-018)', () => {
  const seven = presetInstrument('AF-21', 7, 24);
  it('names string 7 positions with accidentals in full', () => {
    expect(positionName(seven, { string: 7, fret: 0 })).toBe('B, string 7, open');
    expect(positionName(seven, { string: 7, fret: 7 })).toBe('F sharp, string 7, fret 7');
    expect(positionName(seven, { string: 7, fret: 1 })).toBe('C, string 7, fret 1');
    expect(positionName(seven, { string: 7, fret: 3 })).toBe('D, string 7, fret 3');
  });
});

describe('CAGED layer change sentence (US2, R-12)', () => {
  it('leads the description with the layer change, then the focus sentence', async () => {
    const { buildCagedModel } = await import('../../../src/lib/state/caged-model');
    const { initialCagedView } = await import('../../../src/lib/state/caged-view');
    const ctx = { tuningName: 'Standard', temporary: false };
    const view = initialCagedView();
    const text = (change: { layer: 'chord' | 'arpeggio'; on: boolean } | null) =>
      buildCagedModel(view, STANDARD_GUITAR, ctx, null, { reveal: null, layerChange: change }).model
        ?.description as string;
    expect(text({ layer: 'arpeggio', on: true }).startsWith('Arpeggio layer on. ')).toBe(true);
    expect(text({ layer: 'arpeggio', on: false }).startsWith('Arpeggio layer off. ')).toBe(true);
    expect(text({ layer: 'chord', on: true }).startsWith('Chord layer on. ')).toBe(true);
    expect(text(null)).not.toMatch(/layer (on|off)\./);
  });
});

describe('CAGED layers and counts sentences (US6, R-12)', () => {
  it('follows the summary with layers and counts, before the shape entries', async () => {
    const { buildCagedModel } = await import('../../../src/lib/state/caged-model');
    const { initialCagedView } = await import('../../../src/lib/state/caged-view');
    const ctx = { tuningName: 'Standard', temporary: false };
    const view = {
      ...initialCagedView(),
      layers: { chord: true, arpeggio: true, pentatonic: false, scale: false }
    };
    const text = buildCagedModel(view, STANDARD_GUITAR, ctx).model?.description as string;
    const at = (s: string) => text.indexOf(s);
    expect(at('Layers on: Chord and Arpeggio.')).toBeGreaterThan(at('shapes along the neck.'));
    expect(at('Across the neck:')).toBeGreaterThan(at('Layers on:'));
    expect(at('C shape, frets')).toBeGreaterThan(at('Across the neck:'));
  });
});
