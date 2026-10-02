import { describe, expect, it } from 'vitest';
import { STANDARD_GUITAR, positionPitch } from '../../../src/lib/instrument/instrument';
import { AF_1_12, AF_4, NC_UNISON } from '../../../src/lib/instrument/fixtures';
import { buildTriadsModel, nearestClosingSet } from '../../../src/lib/state/triads-model';
import {
  initialTriadsView,
  octaveUp,
  setLabelType,
  setQuality,
  switchSpelling
} from '../../../src/lib/state/triads-view';

const initial = initialTriadsView(STANDARD_GUITAR);
const display = buildTriadsModel(initial, STANDARD_GUITAR);

describe('triads model (US1)', () => {
  it('M1: default markers at (3,5) root, (2,5) third, (1,3) fifth, interval labels', () => {
    const marks = display.model.markers.map((k) => [k.string, k.fret, k.function]);
    expect(marks).toEqual([
      [3, 5, 'root'],
      [2, 5, 'third'],
      [1, 3, 'fifth']
    ]);
    expect(display.model.labelMode).toBe('interval');
    expect(display.composition.name).toEqual({
      root: { letter: 'C', accidental: 0 },
      quality: 'major',
      inversion: 'root'
    });
  });

  it('M2: exactly three highlighted markers with spelling and interval', () => {
    const { markers } = display.model;
    expect(markers).toHaveLength(3);
    expect(markers.every((k) => k.emphasis === 'highlighted')).toBe(true);
    expect(markers.map((k) => k.interval)).toEqual(['R', '3', '5']);
    expect(markers.map((k) => k.spelling?.letter)).toEqual(['C', 'E', 'G']);
  });

  it('shows the shape with frets, positions and no wide stretch', () => {
    expect(display.shape).toMatchObject({ kind: 'shown', frets: [5, 5, 3], wideStretch: false });
  });

  it('composition: notes, intervals, stacking, low-to-high (US1-2…US1-4)', () => {
    const c = display.composition;
    expect(c.notes.map((n) => [n.function, n.spelling.letter])).toEqual([
      ['root', 'C'],
      ['third', 'E'],
      ['fifth', 'G']
    ]);
    expect(c.intervals).toEqual(['R', '3', '5']);
    expect(c.stacking).toBe('M3+m3');
    expect(c.lowToHigh.map((n) => n.function)).toEqual(['root', 'third', 'fifth']);
  });

  it('labelMode follows the label type', () => {
    const named = buildTriadsModel(setLabelType(initial, 'name'), STANDARD_GUITAR);
    expect(named.model.labelMode).toBe('note');
    expect(named.shape).toEqual(display.shape);
  });

  it('description summary names the triad and lists the positions', () => {
    expect(display.model.summary).toContain('C major');
    expect(display.model.summary).toContain('Root position');
  });
});

describe('triads model selection (US2)', () => {
  const view = (o: Partial<typeof initial>) => ({ ...initial, ...o });

  it('US2: A major 1st inversion on 4-3-2 → (4,11) C♯, (3,9) E, (2,10) A', () => {
    const d = buildTriadsModel(
      view({ rootPc: 9, inversion: 'first', stringSet: 4 }),
      STANDARD_GUITAR
    );
    expect(d.model.markers.map((k) => [k.string, k.fret, k.spelling?.letter, k.function])).toEqual([
      [4, 11, 'C', 'third'],
      [3, 9, 'E', 'fifth'],
      [2, 10, 'A', 'root']
    ]);
    expect(d.model.markers[0].spelling?.accidental).toBe(1);
  });

  it('C: all 12 quality × inversion × set combinations equal TM-5.5 sounding pitches', () => {
    const pcs = { major: [0, 4, 7], minor: [0, 3, 7], diminished: [0, 3, 6], augmented: [0, 4, 8] };
    const bass = { root: 0, first: 1, second: 2 };
    for (const quality of ['major', 'minor', 'diminished', 'augmented'] as const) {
      for (const inversion of ['root', 'first', 'second'] as const) {
        for (const stringSet of [6, 5, 4, 3]) {
          const d = buildTriadsModel(view({ quality, inversion, stringSet }), STANDARD_GUITAR);
          expect(d.shape.kind).toBe('shown');
          const sounding = d.model.markers.map(
            (k) => positionPitch(STANDARD_GUITAR, { string: k.string, fret: k.fret }) % 12
          );
          const order = [0, 1, 2].map((i) => pcs[quality][(i + bass[inversion]) % 3]);
          expect(sounding).toEqual(order);
        }
      }
    }
  });

  it('every root × quality has the TM-4.2 notes (letters step by thirds)', () => {
    const letters = 'CDEFGAB';
    for (let rootPc = 0; rootPc < 12; rootPc++) {
      for (const quality of ['major', 'minor', 'diminished', 'augmented'] as const) {
        const { notes } = buildTriadsModel(view({ rootPc, quality }), STANDARD_GUITAR).composition;
        const i = letters.indexOf(notes[0].spelling.letter);
        expect(notes[1].spelling.letter).toBe(letters[(i + 2) % 7]);
        expect(notes[2].spelling.letter).toBe(letters[(i + 4) % 7]);
      }
    }
  });
});

describe('triads model spelling (US3)', () => {
  const v = (o: Partial<typeof initial>) => ({ ...initial, ...o });
  const L = (n: { spelling: { letter: string; accidental: number } }) =>
    `${n.spelling.letter}${n.spelling.accidental}`;

  it('US3-1: D♯ major (switched) is D♯–F𝄪–A♯, sounds-as F𝄪→G, suggests E♭', () => {
    const d = buildTriadsModel(switchSpelling(v({ rootPc: 3 })), STANDARD_GUITAR);
    expect(d.composition.notes.map(L)).toEqual(['D1', 'F2', 'A1']);
    expect(d.composition.soundsAs).toEqual([
      { written: { letter: 'F', accidental: 2 }, sounds: { letter: 'G', accidental: 0 } }
    ]);
    expect(d.composition.suggestion).toEqual({ letter: 'E', accidental: -1 });
    expect(d.composition.canSwitchSpelling).toBe(true);
    expect(d.composition.switchTo).toEqual({ letter: 'E', accidental: -1 });
  });

  it('default D♯/E♭ major is E♭–G–B♭: no sounds-as, no suggestion, can switch to D♯', () => {
    const d = buildTriadsModel(v({ rootPc: 3 }), STANDARD_GUITAR);
    expect(d.composition.notes.map(L)).toEqual(['E-1', 'G0', 'B-1']);
    expect(d.composition.soundsAs).toEqual([]);
    expect(d.composition.suggestion).toBeNull();
    expect(d.composition.switchTo).toEqual({ letter: 'D', accidental: 1 });
  });

  it('D♯ augmented has two double accidentals in R–3–5 order, suggests E♭', () => {
    const d = buildTriadsModel(
      switchSpelling(v({ rootPc: 3, quality: 'augmented' })),
      STANDARD_GUITAR
    );
    expect(d.composition.notes.map(L)).toEqual(['D1', 'F2', 'A2']);
    expect(d.composition.soundsAs.map((x) => [x.written.letter, x.sounds.letter])).toEqual([
      ['F', 'G'],
      ['A', 'B']
    ]);
    expect(d.composition.soundsAs[1].sounds).toEqual({ letter: 'B', accidental: 0 });
    expect(d.composition.suggestion).toEqual({ letter: 'E', accidental: -1 });
  });

  it('B augmented: sounds-as line for F𝄪 only, no suggestion, no switch (natural)', () => {
    const d = buildTriadsModel(v({ rootPc: 11, quality: 'augmented' }), STANDARD_GUITAR);
    expect(d.composition.soundsAs.map((x) => x.written.letter)).toEqual(['F']);
    expect(d.composition.suggestion).toBeNull();
    expect(d.composition.canSwitchSpelling).toBe(false);
    expect(d.composition.switchTo).toBeNull();
  });

  it('A augmented (A–C♯–E♯): single accidentals only, nothing to say', () => {
    const d = buildTriadsModel(v({ rootPc: 9, quality: 'augmented' }), STANDARD_GUITAR);
    expect(d.composition.soundsAs).toEqual([]);
    expect(d.composition.suggestion).toBeNull();
  });

  it('naturals: no switch command', () => {
    const d = buildTriadsModel(initial, STANDARD_GUITAR);
    expect(d.composition.canSwitchSpelling).toBe(false);
    expect(d.composition.switchTo).toBeNull();
  });

  it('switching changes spellings only: same frets and pitches', () => {
    const a = buildTriadsModel(v({ rootPc: 3 }), STANDARD_GUITAR);
    const b = buildTriadsModel(switchSpelling(v({ rootPc: 3 })), STANDARD_GUITAR);
    expect(b.shape).toEqual(a.shape);
    expect(b.model.markers.map((k) => [k.string, k.fret])).toEqual(
      a.model.markers.map((k) => [k.string, k.fret])
    );
    expect(b.model.markers[1].spelling).toEqual({ letter: 'F', accidental: 2 });
    expect(
      buildTriadsModel(setLabelType(switchSpelling(v({ rootPc: 3 })), 'name'), STANDARD_GUITAR)
        .model.labelMode
    ).toBe('note');
  });

  it('suggestion exists for every altered root/quality only when current has a double and other has none', () => {
    for (let rootPc = 0; rootPc < 12; rootPc++) {
      for (const quality of ['major', 'minor', 'diminished', 'augmented'] as const) {
        for (const sw of [false, true]) {
          const base = v({ rootPc, quality });
          const d = buildTriadsModel(sw ? switchSpelling(base) : base, STANDARD_GUITAR);
          const hasDouble = d.composition.soundsAs.length > 0;
          if (d.composition.suggestion) {
            expect(hasDouble).toBe(true);
            expect(d.composition.canSwitchSpelling).toBe(true);
            const other = buildTriadsModel(
              switchSpelling(sw ? switchSpelling(base) : base),
              STANDARD_GUITAR
            );
            expect(other.composition.soundsAs).toEqual([]);
          }
        }
      }
    }
  });
});

describe('triads model octaves (US4)', () => {
  const up = octaveUp(initial, STANDARD_GUITAR);

  it('M7: lowest occurrence has octave.down false, octave.up true', () => {
    expect(display.octave).toEqual({ up: true, down: false, index: 0, count: 2 });
  });

  it('US4-1: octave up shows frets +12 with the same notes, down becomes available', () => {
    const d = buildTriadsModel(up, STANDARD_GUITAR);
    expect(d.model.markers.map((k) => [k.string, k.fret])).toEqual([
      [3, 17],
      [2, 17],
      [1, 15]
    ]);
    expect(d.model.markers.map((k) => k.spelling)).toEqual(
      display.model.markers.map((k) => k.spelling)
    );
    expect(d.octave).toEqual({ up: false, down: true, index: 1, count: 2 });
  });

  it('US4-2/3: ends are disabled', () => {
    expect(display.octave.down).toBe(false);
    expect(buildTriadsModel(up, STANDARD_GUITAR).octave.up).toBe(false);
  });

  it('US4-4: 1st inversion on 6-5-4 has a single occurrence, both disabled', () => {
    const d = buildTriadsModel({ ...initial, inversion: 'first', stringSet: 6 }, STANDARD_GUITAR);
    expect(d.octave).toEqual({ up: false, down: false, index: 0, count: 1 });
  });

  it('pitches shown sound an octave higher', () => {
    const d = buildTriadsModel(up, STANDARD_GUITAR);
    const low = display.model.markers.map((k) => positionPitch(STANDARD_GUITAR, k));
    const high = d.model.markers.map((k) => positionPitch(STANDARD_GUITAR, k));
    expect(high).toEqual(low.map((p) => p + 12));
  });

  it('spelling and label changes keep the octave', () => {
    const d = buildTriadsModel(setLabelType(up, 'name'), STANDARD_GUITAR);
    expect(d.octave.index).toBe(1);
  });
});

describe('triads model wide stretch (US5)', () => {
  const standardShapes = (inst: typeof STANDARD_GUITAR) =>
    (['root', 'first', 'second'] as const).flatMap((inversion) =>
      ([3, 4, 5, 6] as const).map((stringSet) =>
        buildTriadsModel({ ...initialTriadsView(inst), inversion, stringSet }, inst)
      )
    );

  it('US5-1: Drop D C major root on 6-5-4 is 10-7-5, span 5, wide stretch', () => {
    const d = buildTriadsModel({ ...initialTriadsView(AF_4), stringSet: 6 }, AF_4);
    expect(d.shape).toMatchObject({ kind: 'shown', span: 5, wideStretch: true });
    if (d.shape.kind === 'shown')
      expect([...d.shape.frets].sort((a, b) => b - a)).toEqual([10, 7, 5]);
    expect(d.model.summary).toContain('Wide stretch.');
  });

  it('US5-2: no standard-tuning C shape is a wide stretch', () => {
    for (const d of standardShapes(STANDARD_GUITAR)) {
      if (d.shape.kind === 'shown') expect(d.shape.wideStretch).toBe(false);
      expect(d.model.summary ?? '').not.toContain('Wide stretch.');
    }
  });

  it('US5-3: C major 2nd inversion on 3-2-1 is 0-1-0, span 0, no mark', () => {
    const d = buildTriadsModel(
      { ...initialTriadsView(STANDARD_GUITAR), inversion: 'second' },
      STANDARD_GUITAR
    );
    expect(d.shape).toMatchObject({ kind: 'shown', span: 0, wideStretch: false });
  });
});

describe('triads model (US6)', () => {
  it('US6-1: augmented is symmetric, no characteristic note', () => {
    const d = buildTriadsModel(setQuality(initial, 'augmented'), STANDARD_GUITAR);
    expect(d.composition.symmetric).toBe(true);
    expect(d.composition.characteristic).toBeNull();
  });

  it('US6-2: diminished marks b5 as characteristic, not symmetric', () => {
    const d = buildTriadsModel(setQuality(initial, 'diminished'), STANDARD_GUITAR);
    expect(d.composition.characteristic).toBe('b5');
    expect(d.composition.symmetric).toBe(false);
  });

  it('US6-3: major and minor have neither', () => {
    for (const q of ['major', 'minor'] as const) {
      const d = buildTriadsModel(setQuality(initial, q), STANDARD_GUITAR);
      expect(d.composition.symmetric).toBe(false);
      expect(d.composition.characteristic).toBeNull();
    }
  });
});

describe('triads model (US7)', () => {
  it('M6: listenSteps = low, mid, high, then the block', () => {
    const [low, mid, high] = display.model.markers.map((k) => ({ string: k.string, fret: k.fret }));
    expect(display.listen.enabled).toBe(true);
    expect(display.listenSteps).toEqual([low, mid, high, [low, mid, high]]);
  });

  it('listenSteps follow the shown shape in low-to-high pitch order', () => {
    const d = buildTriadsModel(octaveUp(initial, STANDARD_GUITAR), STANDARD_GUITAR);
    const pitches = d.listenSteps
      .slice(0, 3)
      .map((st) => positionPitch(STANDARD_GUITAR, st as { string: number; fret: number }));
    expect(pitches).toEqual([...pitches].sort((a, b) => a - b));
  });

  it('empty and disabled when no shape is shown (does-not-close)', () => {
    const d = buildTriadsModel(initialTriadsView(NC_UNISON), NC_UNISON);
    expect(d.shape.kind).toBe('does-not-close');
    expect(d.listenSteps).toEqual([]);
    expect(d.listen.enabled).toBe(false);
  });
});

describe('triads model (US8)', () => {
  const beyond = {
    ...initialTriadsView(AF_1_12),
    rootPc: 0 as const,
    quality: 'diminished' as const,
    stringSet: 5
  };

  it('M3: beyond fret 12 — no markers, octaves and listen disabled, composition populated', () => {
    const d = buildTriadsModel(beyond, AF_1_12);
    expect(d.shape).toEqual({ kind: 'beyond', fretCount: 12 });
    expect(d.model.markers).toEqual([]);
    expect(d.octave.up).toBe(false);
    expect(d.octave.down).toBe(false);
    expect(d.listen.enabled).toBe(false);
    expect(d.listenSteps).toEqual([]);
    expect(d.anotherSet).toBeNull();
    expect(d.composition.notes.map((n) => n.spelling.letter)).toEqual(['C', 'E', 'G']);
  });

  it('M3: the same shape is shown on 22 frets', () => {
    const d = buildTriadsModel({ ...beyond }, STANDARD_GUITAR);
    expect(d.shape.kind).toBe('shown');
  });

  it('M4: does-not-close offers the C11 set; markers empty', () => {
    const d = buildTriadsModel(initialTriadsView(NC_UNISON), NC_UNISON);
    expect(d.model.markers).toEqual([]);
    expect(d.anotherSet).toBe(5);
  });

  it('C11: treble step first, then bass, alternating; null when none', () => {
    const s = initialTriadsView(NC_UNISON);
    expect(nearestClosingSet(s, NC_UNISON)).toBe(5);
    // From 4-3-2 (also unison): treble neighbour 3 does not close, bass neighbour 5 does.
    expect(nearestClosingSet({ ...s, stringSet: 4 }, NC_UNISON)).toBe(5);
    // From 5-4-3 (closes): treble neighbour 4 does not close, so bass neighbour 6 wins.
    expect(nearestClosingSet({ ...s, stringSet: 5 }, NC_UNISON)).toBe(6);
  });

  it('C11: null when no set closes', () => {
    const none = { ...NC_UNISON, stringCount: 3, openStrings: NC_UNISON.openStrings.slice(0, 3) };
    expect(nearestClosingSet(initialTriadsView(none), none)).toBeNull();
  });

  it('M8: description carries the guidance text', () => {
    const b = buildTriadsModel(beyond, AF_1_12);
    expect(b.model.summary).toContain('this shape lies beyond fret 12');
    const n = buildTriadsModel(initialTriadsView(NC_UNISON), NC_UNISON);
    expect(n.model.summary).toContain('does not close on this string set');
  });

  it('40 of 576 combinations lie beyond fret 12', () => {
    let count = 0;
    for (let rootPc = 0; rootPc < 12; rootPc++)
      for (const quality of ['major', 'minor', 'diminished', 'augmented'] as const)
        for (const inversion of ['root', 'first', 'second'] as const)
          for (const stringSet of [3, 4, 5, 6]) {
            const d = buildTriadsModel(
              {
                ...initialTriadsView(AF_1_12),
                rootPc: rootPc as never,
                quality,
                inversion,
                stringSet
              },
              AF_1_12
            );
            if (d.shape.kind === 'beyond') count++;
          }
    expect(count).toBe(40);
  });
});
