import { describe, expect, it } from 'vitest';
import { STANDARD_GUITAR, positionPitch } from '../../../src/lib/instrument/instrument';
import { AF_1_12, AF_4, AF_8, NC_UNISON, SHORT_7 } from '../../../src/lib/instrument/fixtures';
import {
  buildTriadsModel,
  nearestClosingSet,
  tagTarget
} from '../../../src/lib/state/triads-model';
import {
  initialTriadsView,
  octaveUp,
  setLabelType,
  selectRoot,
  setQuality,
  setView,
  switchSpelling,
  type TriadsViewState
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
    expect(c.lowToHigh?.map((n) => n.function)).toEqual(['root', 'third', 'fifth']);
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
    expect(display.octave).toEqual({ up: true, down: false, index: 0, count: 2, applies: true });
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
    expect(d.octave).toEqual({ up: false, down: true, index: 1, count: 2, applies: true });
  });

  it('US4-2/3: ends are disabled', () => {
    expect(display.octave.down).toBe(false);
    expect(buildTriadsModel(up, STANDARD_GUITAR).octave.up).toBe(false);
  });

  it('US4-4: 1st inversion on 6-5-4 has a single occurrence, both disabled', () => {
    const d = buildTriadsModel({ ...initial, inversion: 'first', stringSet: 6 }, STANDARD_GUITAR);
    expect(d.octave).toEqual({ up: false, down: false, index: 0, count: 1, applies: true });
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

describe('triads model Full neck (US1)', () => {
  const full = (o: Partial<typeof initial> = {}) =>
    buildTriadsModel({ ...initial, rootPc: 9, view: 'full-neck' as const, ...o }, STANDARD_GUITAR);

  it('US1-1: A major 3-2-1 yields the six chain shapes in order with stable ids', () => {
    const d = full();
    expect(d.view).toBe('full-neck');
    if (d.shape.kind !== 'chain') throw new Error('expected chain');
    expect(d.shape.shapes.map((s) => s.id)).toEqual([
      'root:0',
      'first:0',
      'second:0',
      'root:1',
      'first:1',
      'second:1'
    ]);
    expect(d.shape.shapes.map((s) => s.frets.join('-'))).toEqual([
      '2-2-0',
      '6-5-5',
      '9-10-9',
      '14-14-12',
      '18-17-17',
      '21-22-21'
    ]);
    expect(d.shape.shapes.map((s) => s.selected)).toEqual([true, false, false, true, false, false]);
  });

  it('highlights the selected inversion, others normal, highlighted markers first (R-07)', () => {
    const d = full({ inversion: 'second' });
    const { markers } = d.model;
    expect(markers).toHaveLength(18);
    expect(markers.slice(0, 6).every((k) => k.emphasis === 'highlighted')).toBe(true);
    expect(markers.slice(6).every((k) => k.emphasis === 'normal')).toBe(true);
    expect(markers.slice(0, 3).map((k) => [k.string, k.fret])).toEqual([
      [3, 9],
      [2, 10],
      [1, 9]
    ]);
  });

  it('tags follow chain order with label, accessible name, pressed state', () => {
    const d = full({ inversion: 'second' });
    const tags = d.model.tags ?? [];
    expect(tags.map((t) => t.id)).toEqual([
      'root:0',
      'first:0',
      'second:0',
      'root:1',
      'first:1',
      'second:1'
    ]);
    expect(tags.map((t) => t.label)).toEqual([
      'Root position',
      '1st',
      '2nd',
      'Root position',
      '1st',
      '2nd'
    ]);
    expect(tags[0].name).toBe('Root position, frets 2-2-0');
    expect(tags[1].name).toBe('1st inversion, frets 6-5-5');
    expect(tags[2].name).toBe('2nd inversion, frets 9-10-9');
    expect(tags.map((t) => t.pressed)).toEqual([false, false, true, false, false, true]);
    expect(tags[2]).toMatchObject({ start: 9, end: 10 });
    expect(tags.every((t) => t.detail === undefined)).toBe(true);
  });

  it('C6: a span ≥ 5 shape gets a wide-stretch detail and is never hidden', () => {
    // Drop D, C major, 6-5-4: root position 10-7-5 has span 5.
    const d = buildTriadsModel(
      { ...initialTriadsView(AF_4), stringSet: 6, view: 'full-neck' },
      AF_4
    );
    if (d.shape.kind !== 'chain') throw new Error('expected chain');
    const wide = d.shape.shapes.filter((x) => x.wideStretch);
    expect(wide.length).toBeGreaterThan(0);
    for (const w of wide) {
      const tag = d.model.tags?.find((t) => t.id === w.id);
      expect(tag?.detail).toBe('Wide stretch');
      expect(tag?.name).toContain('wide stretch');
    }
    expect(d.model.tags).toHaveLength(d.shape.shapes.length);
  });

  it('R-06: autoScroll key and groups are the selected shapes', () => {
    const d = full({ inversion: 'first' });
    expect(d.model.autoScroll?.key).toBe('full-neck|3|9|major|22');
    expect(d.model.autoScroll?.groups).toEqual([
      [
        { string: 3, fret: 6 },
        { string: 2, fret: 5 },
        { string: 1, fret: 5 }
      ],
      [
        { string: 3, fret: 18 },
        { string: 2, fret: 17 },
        { string: 1, fret: 17 }
      ]
    ]);
  });

  it('US1-3: control changes keep the selected inversion and the view', () => {
    let s: TriadsViewState = { ...initial, view: 'full-neck', inversion: 'second' };
    s = setQuality(s, 'minor');
    const d = buildTriadsModel(s, STANDARD_GUITAR);
    expect(d.view).toBe('full-neck');
    if (d.shape.kind !== 'chain') throw new Error('expected chain');
    expect(d.shape.shapes.filter((x) => x.selected).every((x) => x.inversion === 'second')).toBe(
      true
    );
  });

  it('C18: the Full neck description names the chain and the selection', () => {
    const d = full({ inversion: 'second' });
    expect(d.model.description).toContain('A major');
    expect(d.model.description).toContain('Root position, frets 2-2-0');
    expect(d.model.description).toContain('Selected: 2nd inversion');
  });

  it('C10: the composition equals Isolated for the selected inversion', () => {
    const iso = buildTriadsModel({ ...initial, rootPc: 9, inversion: 'first' }, STANDARD_GUITAR);
    const fn = full({ inversion: 'first' });
    expect(fn.composition).toEqual(iso.composition);
  });

  it('C7: beyond and does-not-close show guidance and no tags', () => {
    // A major on a 1-fret board: closes, but no occurrence of any inversion fits.
    const short = { ...STANDARD_GUITAR, fretCount: 1 };
    const beyond = buildTriadsModel({ ...initial, rootPc: 9, view: 'full-neck' }, short);
    expect(beyond.shape.kind).toBe('beyond');
    expect(beyond.model.tags).toBeUndefined();
    expect(beyond.model.markers).toEqual([]);
    const dnc = buildTriadsModel({ ...initial, view: 'full-neck' }, NC_UNISON);
    expect(dnc.shape.kind).toBe('does-not-close');
    expect(dnc.model.tags).toBeUndefined();
  });

  it('C17: augmented tags are named relative to the chosen root', () => {
    const d = full({ rootPc: 0, quality: 'augmented' });
    if (d.shape.kind !== 'chain') throw new Error('expected chain');
    expect(d.shape.shapes.map((s) => s.frets.join('-'))).toEqual([
      '1-1-0',
      '5-5-4',
      '9-9-8',
      '13-13-12',
      '17-17-16',
      '21-21-20'
    ]);
    expect(d.shape.shapes.map((s) => s.inversion)).toEqual([
      'second',
      'root',
      'first',
      'second',
      'root',
      'first'
    ]);
  });

  it('tagTarget maps ids back and returns null for unknown ids', () => {
    const d = full();
    expect(tagTarget(d, 'second:1')).toEqual({ inversion: 'second', octave: 1 });
    expect(tagTarget(d, 'nope')).toBeNull();
    expect(tagTarget(buildTriadsModel(initial, STANDARD_GUITAR), 'root:0')).toBeNull();
  });
});

describe('triads model Full neck special cases (US5)', () => {
  const full = (o: Partial<TriadsViewState> = {}, instrument = STANDARD_GUITAR) =>
    buildTriadsModel(
      { ...initialTriadsView(instrument), rootPc: 9, view: 'full-neck', ...o },
      instrument
    );
  const chain = (d: ReturnType<typeof full>) => {
    if (d.shape.kind !== 'chain') throw new Error('expected chain');
    return d.shape.shapes;
  };

  it('US5-3: SHORT-7 A major 3-2-1 shows only root 2-2-0 and 1st 6-5-5, no message', () => {
    const d = full({}, SHORT_7);
    expect(chain(d).map((s) => `${s.inversion}:${s.frets.join('-')}`)).toEqual([
      'root:2-2-0',
      'first:6-5-5'
    ]);
    expect(d.model.tags?.map((t) => t.id)).toEqual(['root:0', 'first:0']);
    expect(d.model.markers).toHaveLength(6);
    expect(d.anotherSet).toBeNull();
    // No guidance, notice or empty-state text (FR-007).
    expect(d.model.summary).toBeUndefined();
    expect(d.model.description).not.toMatch(/beyond|does not|no shape|not fit/i);
  });

  it('C16: C major keeps the same patterns on 6-5-4 and 5-4-3', () => {
    const pattern = (frets: readonly number[]) => {
      const min = Math.min(...frets);
      return frets.map((f) => f - min).join('-');
    };
    const patterns = (stringSet: TriadsViewState['stringSet']) =>
      [
        ...new Set(
          chain(full({ rootPc: 0, stringSet })).map((s) => `${s.inversion}:${pattern(s.frets)}`)
        )
      ].sort();
    expect(patterns(6)).toEqual(patterns(5));
    // 4-3-2 differs from 3-2-1 (C16): the B-G gap shifts the shapes.
    expect(patterns(4)).not.toEqual(patterns(3));
  });

  it('C17: C augmented chain is identical for every root position inversion naming', () => {
    const shapes = chain(full({ rootPc: 0, quality: 'augmented' }));
    const lows = shapes.map((s) => s.frets[0]);
    for (let i = 1; i < lows.length; i++) expect(lows[i] - lows[i - 1]).toBe(4);
    const tags = full({ rootPc: 0, quality: 'augmented' }).model.tags ?? [];
    expect(tags.map((t) => t.id)).toEqual([
      'second:0',
      'root:0',
      'first:0',
      'second:1',
      'root:1',
      'first:1'
    ]);
  });

  it('C6: a wide-stretch shape keeps its tag and is never hidden', () => {
    const d = buildTriadsModel(
      { ...initialTriadsView(AF_4), stringSet: 6, view: 'full-neck' },
      AF_4
    );
    const shapes = chain(d);
    const wide = shapes.filter((s) => s.wideStretch);
    expect(wide.length).toBeGreaterThan(0);
    expect(d.model.markers).toHaveLength(shapes.length * 3);
    for (const w of wide) {
      expect(d.model.tags?.find((t) => t.id === w.id)?.detail).toBe('Wide stretch');
    }
  });
});

describe('triads model All notes (US2)', () => {
  const all = (o: Partial<typeof initial> = {}, inst = STANDARD_GUITAR) =>
    buildTriadsModel({ ...initial, view: 'all-notes' as const, ...o }, inst);
  const QUALITY_PCS = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    diminished: [0, 3, 6],
    augmented: [0, 4, 8]
  } as const;

  it('SC-003: every root/third/fifth position, nothing else, for 12 roots × 4 qualities', () => {
    for (let root = 0; root < 12; root++) {
      for (const quality of ['major', 'minor', 'diminished', 'augmented'] as const) {
        const d = all({ rootPc: root as typeof initial.rootPc, quality });
        const pcs = QUALITY_PCS[quality].map((x) => (root + x) % 12);
        const expected: string[] = [];
        for (let s = 1; s <= 6; s++)
          for (let f = 0; f <= 22; f++)
            if (pcs.includes(positionPitch(STANDARD_GUITAR, { string: s, fret: f }) % 12))
              expected.push(`${s}:${f}`);
        const got = d.model.markers.map((k) => `${k.string}:${k.fret}`);
        expect(new Set(got).size).toBe(got.length);
        expect([...got].sort()).toEqual([...expected].sort());
        expect(d.model.markers.every((k) => k.emphasis === 'normal')).toBe(true);
        for (const k of d.model.markers) {
          const pc = positionPitch(STANDARD_GUITAR, k) % 12;
          const idx = pcs.indexOf(pc);
          expect(k.function).toBe(['root', 'third', 'fifth'][idx]);
          expect(k.spelling).toBeDefined();
          expect(k.interval).toBeDefined();
        }
      }
    }
  });

  it('view-level facts: shape kind, controls, octave, no tags/guidance, autoScroll', () => {
    const d = all({ rootPc: 9 });
    expect(d.view).toBe('all-notes');
    expect(d.shape).toEqual({ kind: 'all-notes' });
    expect(d.controls).toEqual({ inversion: false, stringSet: false });
    expect(d.octave.applies).toBe(false);
    expect(d.octave.up).toBe(false);
    expect(d.octave.down).toBe(false);
    expect(d.model.tags).toBeUndefined();
    expect(d.model.summary).toBeUndefined();
    expect(d.anotherSet).toBeNull();
    expect(d.model.autoScroll).toEqual({ key: 'all-notes', groups: [] });
  });

  it('controls and octave.applies in the other views (SC-004)', () => {
    for (const view of ['isolated', 'full-neck'] as const) {
      const d = buildTriadsModel({ ...initial, rootPc: 9, view }, STANDARD_GUITAR);
      expect(d.controls).toEqual({ inversion: true, stringSet: true });
      expect(d.octave.applies).toBe(view === 'isolated');
    }
  });

  it('shows All notes even where Isolated gives guidance (C9)', () => {
    const d = buildTriadsModel({ ...initial, view: 'all-notes' }, NC_UNISON);
    expect(d.shape.kind).toBe('all-notes');
    expect(d.model.markers.length).toBeGreaterThan(0);
    expect(d.model.summary).toBeUndefined();
    const beyond = buildTriadsModel({ ...initial, rootPc: 9, view: 'all-notes' }, AF_1_12);
    expect(beyond.shape.kind).toBe('all-notes');
  });

  it('C10: composition name has no inversion and lowToHigh is null; notes unchanged', () => {
    const d = all({ rootPc: 9, inversion: 'second' });
    expect(d.composition.name.inversion).toBeNull();
    expect(d.composition.lowToHigh).toBeNull();
    expect(d.composition.notes.map((n) => n.function)).toEqual(['root', 'third', 'fifth']);
    const iso = buildTriadsModel({ ...initial, rootPc: 9, inversion: 'second' }, STANDARD_GUITAR);
    expect(iso.composition.name.inversion).toBe('second');
    expect(iso.composition.lowToHigh).not.toBeNull();
  });

  it('C18: description lists name then each function with positions grouped by string', () => {
    const text = all({ rootPc: 9 }).model.description ?? '';
    expect(text).toMatch(/^A major: /);
    expect(text).toContain('A: string 6 frets 5, 17');
    expect(text).toContain('string 5 frets 0, 12');
    expect(text).toContain('C sharp: ');
    expect(text).toContain('E: ');
    expect(text.endsWith('.')).toBe(true);
  });

  it('US2-4: D♯ major shows F𝄪, never G', () => {
    const d = all({ rootPc: 3, spellingOverride: 'sharp' });
    const thirds = d.model.markers.filter((k) => k.function === 'third');
    expect(thirds.length).toBeGreaterThan(0);
    expect(thirds.every((k) => k.spelling?.letter === 'F' && k.spelling.accidental === 2)).toBe(
      true
    );
    expect(d.model.markers.some((k) => k.spelling?.letter === 'G')).toBe(false);
  });

  it('TM-9 view 14: AF-8 G major shows every G, B, D', () => {
    const d = all({ rootPc: 7, inversion: 'root', stringSet: 4 }, AF_8);
    const expected: string[] = [];
    for (let s = 1; s <= 6; s++)
      for (let f = 0; f <= AF_8.fretCount; f++)
        if ([7, 11, 2].includes(positionPitch(AF_8, { string: s, fret: f }) % 12))
          expected.push(`${s}:${f}`);
    expect(d.model.markers.map((k) => `${k.string}:${k.fret}`).sort()).toEqual(expected.sort());
  });
});

describe('triads model See all notes flag (US3)', () => {
  const base = initialTriadsView(AF_1_12);
  const beyond = {
    ...base,
    rootPc: 0 as const,
    quality: 'diminished' as const,
    stringSet: 5 as const
  };

  it('true iff guidance is shown and view is not all-notes', () => {
    expect(buildTriadsModel(beyond, AF_1_12).seeAllNotes).toBe(true);
    expect(buildTriadsModel({ ...beyond, view: 'all-notes' }, AF_1_12).seeAllNotes).toBe(false);
    expect(buildTriadsModel(initialTriadsView(STANDARD_GUITAR), STANDARD_GUITAR).seeAllNotes).toBe(
      false
    );
  });

  it('does-not-close raises the flag too', () => {
    const s = initialTriadsView(NC_UNISON);
    expect(buildTriadsModel(s, NC_UNISON).seeAllNotes).toBe(true);
    expect(buildTriadsModel({ ...s, view: 'full-neck' }, NC_UNISON).seeAllNotes).toBe(true);
    expect(buildTriadsModel({ ...s, view: 'all-notes' }, NC_UNISON).seeAllNotes).toBe(false);
  });
});

describe('triads model Listen per view (US4)', () => {
  const aMajor = selectRoot(initial, 9);
  const pos = (string: number, fret: number) => ({ string, fret });

  it('Full neck: 6 shapes x (3 single notes + chord) = 24 steps in chain order (C11)', () => {
    const d = buildTriadsModel(setView(aMajor, 'full-neck'), STANDARD_GUITAR);
    expect(d.listen.enabled).toBe(true);
    expect(d.listenSteps).toHaveLength(24);
    if (d.shape.kind !== 'chain') throw new Error('expected chain');
    const expected = d.shape.shapes.flatMap((sh) => {
      const [low, mid, high] = sh.positions;
      return [low, mid, high, [low, mid, high]];
    });
    expect(d.listenSteps).toEqual(expected);
    // first shape: root inversion at 2-2-0 on strings 3-2-1
    expect(d.listenSteps.slice(0, 4)).toEqual([
      pos(3, 2),
      pos(2, 2),
      pos(1, 0),
      [pos(3, 2), pos(2, 2), pos(1, 0)]
    ]);
  });

  it('Full neck: repeated inversions are played each time and steps ignore the selection', () => {
    const a = buildTriadsModel(setView(aMajor, 'full-neck'), STANDARD_GUITAR);
    const b = buildTriadsModel(
      setView({ ...aMajor, inversion: 'second', occurrence: 1 }, 'full-neck'),
      STANDARD_GUITAR
    );
    expect(b.listenSteps).toEqual(a.listenSteps);
  });

  it('Full neck: disabled with no steps when the chain does not close', () => {
    const d = buildTriadsModel(setView(initialTriadsView(NC_UNISON), 'full-neck'), NC_UNISON);
    expect(d.listen.enabled).toBe(false);
    expect(d.listenSteps).toEqual([]);
  });

  it('All notes: A2, C#3, E3 as single notes, no chord (C12)', () => {
    const d = buildTriadsModel(setView(aMajor, 'all-notes'), STANDARD_GUITAR);
    expect(d.listen.enabled).toBe(true);
    expect(d.listenSteps).toEqual([pos(5, 0), pos(5, 4), pos(4, 2)]);
    const pitches = d.listenSteps.map((st) => positionPitch(STANDARD_GUITAR, st as never));
    expect(pitches).toEqual([45, 49, 52]);
  });

  it('All notes: third and fifth sit at the nearest pitch above the previous note', () => {
    // C major: C3 (s5 f3), E3 (s4 f2), G3 (s3 f0)
    const d = buildTriadsModel(setView(initial, 'all-notes'), STANDARD_GUITAR);
    expect(d.listenSteps).toEqual([pos(5, 3), pos(4, 2), pos(3, 0)]);
  });

  it('All notes: root unreachable disables Listen', () => {
    const tiny = { ...STANDARD_GUITAR, fretCount: 0 };
    // Open strings only: E A D G B E; no C.
    const d = buildTriadsModel(setView(initialTriadsView(tiny), 'all-notes'), tiny);
    expect(d.listen.enabled).toBe(false);
    expect(d.listenSteps).toEqual([]);
  });

  it('All notes: unreachable third/fifth keep only the reachable prefix', () => {
    const short = { ...STANDARD_GUITAR, fretCount: 3 };
    // A major on 3 frets: A2 open is reachable, C#3 (pitch 49) is not.
    const d = buildTriadsModel(
      setView(selectRoot(initialTriadsView(short), 9), 'all-notes'),
      short
    );
    expect(d.listen.enabled).toBe(true);
    expect(d.listenSteps).toEqual([pos(5, 0)]);
  });

  it('Isolated: sequence unchanged', () => {
    const d = buildTriadsModel(initial, STANDARD_GUITAR);
    expect(d.listenSteps).toHaveLength(4);
  });
});
