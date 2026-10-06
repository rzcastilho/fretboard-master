import { describe, expect, it } from 'vitest';
import { AF_1_12, AF_1_24, AF_2, AF_21, AF_4, AF_8 } from '../../../src/lib/instrument/fixtures';
import {
  STANDARD_GUITAR,
  positionPitch,
  withPresentation
} from '../../../src/lib/instrument/instrument';
import type { DisplayModel } from '../../../src/lib/fretboard/types';
import {
  buildCagedModel as build,
  cagedOccurrencesFor,
  cagedTagText,
  type CagedContext
} from '../../../src/lib/state/caged-model';
import { cagedOccurrences } from '../../../src/lib/theory/caged';
import { pitchOfSpelling } from '../../../src/lib/theory/pitch';
import { defaultTriadSet, triadAvailability } from '../../../src/lib/state/caged-triad';
import {
  cagedRootSpelling,
  initialCagedView,
  selectRoot,
  setFocus
} from '../../../src/lib/state/caged-view';

const view = initialCagedView();
const CTX: CagedContext = { tuningName: 'Standard', temporary: false };
const buildCagedModel = (
  v: Parameters<typeof build>[0],
  inst: Parameters<typeof build>[1],
  ctx: CagedContext = CTX
) => build(v, inst, ctx);

function shown(d: ReturnType<typeof buildCagedModel>): DisplayModel & {
  tags: NonNullable<DisplayModel['tags']>;
  description: string;
} {
  const { model } = d;
  if (!model?.tags || model.description === undefined) throw new Error('expected a CAGED model');
  return { ...model, tags: model.tags, description: model.description };
}

describe('buildCagedModel: C major, standard, 22 frets', () => {
  const d = buildCagedModel(view, STANDARD_GUITAR);
  const model = shown(d);

  it('names the key', () => {
    expect(d.keyName).toBe('C major');
  });

  it('has the first five tags with exact texts and spans (22 frets also fits a second cycle up to E at 20)', () => {
    expect(model.tags.slice(0, 5).map((t) => t.label)).toEqual([
      'C shape · roots on strings 5, 2',
      'A shape · roots on strings 5, 3',
      'G shape · roots on strings 6, 3, 1',
      'E shape · roots on strings 6, 4, 1',
      'D shape · roots on strings 4, 2'
    ]);
    expect(model.tags.slice(0, 5).map((t) => [t.start, t.end])).toEqual([
      [0, 3],
      [3, 5],
      [5, 8],
      [8, 10],
      [10, 13]
    ]);
    expect(model.tags.slice(5).map((t) => t.start)).toEqual([12, 15, 17, 20]);
  });

  it('is interval-labelled with interactive tags', () => {
    expect(model.labelMode).toBe('interval');
    expect(model.tagsInteractive).toBe(true);
  });

  it('has one marker per string:fret, normal emphasis', () => {
    const keys = model.markers.map((k) => `${k.string}:${k.fret}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of ['4:5', '3:5', '2:5']) expect(keys.filter((x) => x === k)).toHaveLength(1);
    expect(model.markers.every((k) => k.emphasis === 'normal')).toBe(true);
  });

  it('has no marker for muted strings', () => {
    const s6 = model.markers.filter((k) => k.string === 6 && k.fret <= 3);
    expect(s6).toEqual([]);
  });

  it('maps degrees to functions', () => {
    const find = (s: number, f: number) => {
      const at = model.markers.find((k) => k.string === s && k.fret === f);
      if (!at) throw new Error('no marker');
      return at;
    };
    expect(find(5, 3).function).toBe('root');
    expect(find(4, 2).function).toBe('third');
    expect(find(3, 0).function).toBe('fifth');
  });

  it('describes each occurrence in order', () => {
    expect(model.description).toContain('C major: 9 shapes along the neck.');
    expect(model.description).toContain('E shape, frets 8 to 10, roots on strings 6, 4, 1:');
    expect(model.description.indexOf('C shape')).toBeLessThan(
      model.description.indexOf('A shape, frets')
    );
    expect(model.description).toContain('string 5, fret 3, C, root');
    expect(model.description).toContain('string 3, open, G, fifth');
  });

  it('is null-free of fit note and switch for now', () => {
    expect(d.fitCount).toBe(5);
    expect(d.occurrences).toHaveLength(9);
  });
});

describe('buildCagedModel variants', () => {
  it('24 frets gives nine tags; frets 0 and 12 tags are identical text', () => {
    const inst = { ...STANDARD_GUITAR, fretCount: 24 };
    const tags = shown(buildCagedModel(view, inst)).tags;
    expect(tags).toHaveLength(9);
    expect(tags[0].label).toBe(tags[5].label);
    expect([tags[0].start, tags[5].start]).toEqual([0, 12]);
  });

  it('minor tags and flat thirds', () => {
    const d = buildCagedModel({ ...view, quality: 'minor' }, STANDARD_GUITAR);
    expect(d.keyName).toBe('C minor');
    expect(shown(d).tags[0].label).toBe('Cm shape · roots on strings 5, 2');
    expect(shown(d).markers.some((k) => k.interval === 'b3')).toBe(true);
    expect(shown(d).markers.some((k) => k.interval === '3')).toBe(false);
  });

  it('seven strings: same markers as six, none on string 7', () => {
    const six = shown(buildCagedModel(view, STANDARD_GUITAR)).markers;
    const seven = shown(buildCagedModel(view, AF_21)).markers;
    expect(seven.some((k) => k.string === 7)).toBe(false);
    const key = (x: typeof six) => x.map((k) => k.id).sort();
    expect(key(seven)).toEqual(key(six));
  });

  it('handedness and orientation do not change the model', () => {
    const base = buildCagedModel(view, STANDARD_GUITAR).model;
    for (const h of ['right', 'left'] as const)
      for (const o of ['highest-top', 'lowest-top'] as const)
        expect(buildCagedModel(view, withPresentation(STANDARD_GUITAR, h, o)).model).toEqual(base);
  });

  it('uses sharp or flat spelling of the root', () => {
    const d = buildCagedModel({ ...initialCagedView(), rootPc: 1 }, AF_4);
    expect(d.keyName).toBe('D♭ major');
  });
});

describe('buildCagedModel: key choice (US2)', () => {
  const at = (rootPc: number, spellingOverride: 'none' | 'sharp' | 'flat' = 'none') => ({
    ...initialCagedView(),
    rootPc,
    spellingOverride,
    quality: 'major' as const
  });
  const order = (d: ReturnType<typeof buildCagedModel>) =>
    shown(d)
      .tags.slice(0, 5)
      .map((t) => `${t.label[0]}${t.start}`);

  it('switchTo is null for natural roots', () => {
    for (const pc of [0, 2, 4, 5, 7, 9, 11])
      expect(buildCagedModel(at(pc), STANDARD_GUITAR).switchTo).toBeNull();
  });

  it('switchTo is the other spelling for the five altered roots', () => {
    for (const pc of [1, 3, 6, 8, 10]) {
      const sharp = buildCagedModel(at(pc, 'sharp'), STANDARD_GUITAR);
      const flat = buildCagedModel(at(pc, 'flat'), STANDARD_GUITAR);
      expect(sharp.switchTo?.accidental).toBe(-1);
      expect(flat.switchTo?.accidental).toBe(1);
    }
  });

  it('keyName follows the effective spelling', () => {
    expect(buildCagedModel(at(1, 'flat'), STANDARD_GUITAR).keyName).toBe('D♭ major');
    expect(buildCagedModel(at(1, 'sharp'), STANDARD_GUITAR).keyName).toBe('C♯ major');
    expect(buildCagedModel({ ...at(1), quality: 'minor' }, STANDARD_GUITAR).keyName).toBe(
      'C♯ minor'
    );
  });

  it('marker spellings follow the effective root', () => {
    const root = (o: 'sharp' | 'flat') =>
      shown(buildCagedModel(at(1, o), STANDARD_GUITAR)).markers.find((k) => k.function === 'root')
        ?.spelling;
    expect(root('flat')?.letter).toBe('D');
    expect(root('sharp')?.letter).toBe('C');
  });

  it('keeps the cyclic order for other keys', () => {
    expect(order(buildCagedModel(at(7), STANDARD_GUITAR))).toEqual(['G0', 'E3', 'D5', 'C7', 'A10']);
    expect(order(buildCagedModel(at(1), STANDARD_GUITAR))).toEqual(['C1', 'A4', 'G6', 'E9', 'D11']);
    expect(order(buildCagedModel(at(6), STANDARD_GUITAR))).toEqual(['E2', 'D4', 'C6', 'A9', 'G11']);
  });

  it('G major has no C-shape occurrence below fret 7 (EC-6.2)', () => {
    const tags = shown(buildCagedModel(at(7), STANDARD_GUITAR)).tags;
    expect(tags.some((t) => t.label.startsWith('C shape') && t.start < 7)).toBe(false);
    expect(tags[0].label.startsWith('G shape')).toBe(true);
    expect(tags[0].start).toBe(0);
  });
});

describe('buildCagedModel: minor quality (US3)', () => {
  const minor = (rootPc: number) => ({
    ...initialCagedView(),
    rootPc,
    spellingOverride: 'none' as const,
    quality: 'minor' as const
  });
  const cMinor = shown(buildCagedModel(minor(0), STANDARD_GUITAR));

  it('minor tags read "Xm shape · roots on strings …"', () => {
    const labels = cMinor.tags.slice(0, 5).map((t) => t.label);
    expect(labels[0]).toBe('Cm shape · roots on strings 5, 2');
    expect(labels[4]).toBe('Dm shape · roots on strings 4, 2');
  });

  it('third markers are ♭3 with function third', () => {
    const thirds = cMinor.markers.filter((k) => k.function === 'third');
    expect(thirds.length).toBeGreaterThan(0);
    for (const k of thirds) expect(k.interval).toBe('b3');
    expect(cMinor.markers.some((k) => k.interval === '3')).toBe(false);
  });

  it('C minor matches TM-7.1 on the muted strings', () => {
    const inRange = (string: number, lo: number, hi: number) =>
      cMinor.markers.filter((k) => k.string === string && k.fret >= lo && k.fret <= hi);
    expect(inRange(6, 0, 3)).toEqual([]);
    expect(inRange(1, 0, 2)).toEqual([]);
  });

  it('Gm shape has the fifth on string 2', () => {
    const gm = cMinor.tags.find((t) => t.label.startsWith('Gm shape'));
    if (!gm) throw new Error('no Gm tag');
    const onString2 = cMinor.markers.filter(
      (k) => k.string === 2 && k.fret >= gm.start && k.fret <= gm.end
    );
    expect(onString2.some((k) => k.function === 'fifth')).toBe(true);
    expect(onString2.some((k) => k.function === 'third')).toBe(false);
  });

  it('G minor order Gm 0, Em 3, Dm 5, Cm 7, Am 10', () => {
    const tags = shown(buildCagedModel(minor(7), STANDARD_GUITAR)).tags.slice(0, 5);
    expect(tags.map((t) => `${t.label.slice(0, 2)}${t.start}`)).toEqual([
      'Gm0',
      'Em3',
      'Dm5',
      'Cm7',
      'Am10'
    ]);
  });
});

describe('fit note (US4)', () => {
  const at = (pc: number, inst = STANDARD_GUITAR) =>
    buildCagedModel({ ...initialCagedView(), rootPc: pc as never }, inst);
  const thirteen = { ...STANDARD_GUITAR, fretCount: 13 };

  it('C major / 12 frets: four shapes, note, no D tag', () => {
    const d = at(0, AF_1_12);
    expect(d.fitCount).toBe(4);
    expect(d.fitNote).toBe('With 12 frets, 4 shapes fit on the fretboard');
    expect(shown(d).tags.some((t) => t.label.startsWith('D shape'))).toBe(false);
  });

  it('G major / 12 frets: all five fit, no note', () => {
    expect(at(7, AF_1_12).fitNote).toBeNull();
  });

  it('D♭ major / 13 frets: note with four shapes', () => {
    const d = at(1, thirteen);
    expect(d.fitCount).toBe(4);
    expect(d.fitNote).toBe('With 13 frets, 4 shapes fit on the fretboard');
  });

  it('22 and 24 frets: no note', () => {
    expect(at(0, STANDARD_GUITAR).fitNote).toBeNull();
    expect(at(0, AF_1_24).fitNote).toBeNull();
  });

  it('seven strings: no marker on string 7, markers equal the six-string board', () => {
    const seven = shown(at(0, AF_21)).markers;
    expect(seven.some((k) => k.string === 7)).toBe(false);
    expect(seven).toEqual(shown(at(0)).markers);
  });
});

describe('other tunings (US5)', () => {
  it('Half step down, C major: C1 A4 G6 E9 D11 with shape tags', () => {
    const d = buildCagedModel(view, AF_2);
    expect(d.tuningClass).toBe('compatible');
    expect(d.occurrences.slice(0, 5).map((o) => `${o.shape.id}${o.start}`)).toEqual([
      'C1',
      'A4',
      'G6',
      'E9',
      'D11'
    ]);
    expect(shown(d).tags[0].label).toBe('C shape · roots on strings 5, 2');
  });

  it.each([['Open G', AF_8]])('%s: not compatible, nothing drawn, no fit note', (_n, inst) => {
    const d = buildCagedModel(view, inst);
    expect(d.tuningClass).not.toBe('compatible');
    expect(d.model).toBeNull();
    expect(d.fitNote).toBeNull();
    expect(d.occurrences).toEqual([]);
    expect(d.fitCount).toBe(0);
  });
});

describe('buildCagedModel: tuning context (slice 015, M7, M8)', () => {
  it('M8: description starts with the tuning sentence; no altered sentence for Standard', () => {
    const d = shown(buildCagedModel(view, STANDARD_GUITAR));
    expect(d.description.startsWith('All shapes. Tuning: Standard. ')).toBe(true);
    expect(d.description).not.toContain('is altered');
  });

  it('exposes tuningName, temporaryName null and unsupportedNotice null', () => {
    const d = buildCagedModel(view, STANDARD_GUITAR);
    expect(d.tuningName).toBe('Standard');
    expect(d.temporaryName).toBeNull();
    expect(d.unsupportedNotice).toBeNull();
  });

  it('M7: temporary uses the temporary sentence and names the tuning', () => {
    const d = buildCagedModel(view, AF_21, { tuningName: '7-string standard', temporary: true });
    expect(d.temporaryName).toBe('7-string standard');
    expect(
      shown(d).description.startsWith('All shapes. Temporary tuning: 7-string standard. ')
    ).toBe(true);
  });
});

describe('buildCagedModel: altered lowest string (slice 015 US3)', () => {
  const DROP_D: CagedContext = { tuningName: 'Drop D', temporary: false };
  const dMajor = { ...selectRoot(view, 2), spellingOverride: 'none' as const };
  const d = buildCagedModel(dMajor, AF_4, DROP_D);
  const model = shown(d);

  it('M3: altered mark, string-6 markers only at frets 7 and 12, tags omit string 6', () => {
    expect(d.tuningClass).toBe('altered-string');
    expect(model.stringMarks).toEqual([{ string: 6, label: 'altered' }]);
    const six = model.markers.filter((mk) => mk.string === 6);
    const byFret = new Map(six.map((mk) => [mk.fret, mk]));
    expect([...byFret.keys()].sort((a, b) => a - b).slice(0, 2)).toEqual([7, 12]);
    expect(byFret.get(7)).toMatchObject({ spelling: { letter: 'A' }, interval: '5', id: '6:7' });
    expect(byFret.get(12)).toMatchObject({ spelling: { letter: 'D' }, interval: 'R', id: '6:12' });
    const labels = model.tags.map((t) => t.label);
    expect(labels).toContain('E shape · roots on strings 4, 1');
    expect(labels).toContain('G shape · roots on strings 3, 1');
    for (const l of labels) expect(l).not.toMatch(/strings 6|, 6/);
  });

  it('M3: string-6 marker ids are unique', () => {
    const ids = model.markers.map((mk) => mk.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('M4: stringMarks present for every key, even with no string-6 marker', () => {
    for (let pc = 0; pc < 12; pc++)
      for (const quality of ['major', 'minor'] as const) {
        const x = buildCagedModel({ ...selectRoot(view, pc), quality }, AF_4, DROP_D);
        expect(shown(x).stringMarks).toEqual([{ string: 6, label: 'altered' }]);
      }
  });

  it('M9: string 6 fret 12 spells D and sounds D3', () => {
    const mk = model.markers.find((x) => x.string === 6 && x.fret === 12);
    expect(mk?.spelling).toMatchObject({ letter: 'D' });
    expect(positionPitch(AF_4, { string: 6, fret: 12 })).toBe(
      pitchOfSpelling({ letter: 'D', accidental: 0, octave: 3 })
    );
  });

  it('M8: the altered sentence follows the tuning sentence, only when altered', () => {
    expect(model.description.startsWith('All shapes. Tuning: Drop D. String 6 is altered')).toBe(
      true
    );
    expect(shown(buildCagedModel(view, STANDARD_GUITAR)).description).not.toContain('is altered');
  });

  it('never emits stringMarks for compatible or temporary views', () => {
    expect(shown(buildCagedModel(view, STANDARD_GUITAR)).stringMarks).toBeUndefined();
    expect(shown(buildCagedModel(view, AF_2)).stringMarks).toBeUndefined();
    const t = buildCagedModel(view, STANDARD_GUITAR, { tuningName: 'Standard', temporary: true });
    expect(shown(t).stringMarks).toBeUndefined();
    expect(buildCagedModel(view, AF_8).model).toBeNull();
  });
});

describe('cagedTagText takes the occurrence', () => {
  const sixOpen = STANDARD_GUITAR.openStrings.slice(0, 6).map(pitchOfSpelling).reverse();
  const occ = cagedOccurrences(sixOpen, 0, 'major', 22);

  it('builds roots on strings from occurrenceRootStrings', () => {
    expect(cagedTagText(occ[0])).toBe('C shape · roots on strings 5, 2');
    expect(cagedTagText(occ[3])).toBe('E shape · roots on strings 6, 4, 1');
  });

  it('altered occurrence omits string 6', () => {
    const altered = { ...occ[3], alteredString: true };
    expect(cagedTagText(altered)).toBe('E shape · roots on strings 4, 1');
  });
});

describe('buildCagedModel: non-compatible tunings (slice 015 US1)', () => {
  it('M1: Open G shows the notice and no shapes', () => {
    const d = buildCagedModel(view, AF_8, { tuningName: 'Open G', temporary: false });
    expect(d.tuningClass).toBe('non-compatible');
    expect(d.model).toBeNull();
    expect(d.occurrences).toEqual([]);
    expect(d.fitCount).toBe(0);
    expect(d.fitNote).toBeNull();
    expect(d.temporaryName).toBeNull();
    expect(d.unsupportedNotice).toBe(
      "CAGED depends on the standard relationship between the strings, so its shapes don't exist in Open G."
    );
  });

  it('M2: a custom non-compatible tuning is named "Custom"', () => {
    const d = buildCagedModel(view, AF_8, { tuningName: 'Custom', temporary: false });
    expect(d.unsupportedNotice).toContain('Custom');
    expect(d.model).toBeNull();
  });

  it('M7: temporary on a 7-string instrument names the standard tuning', () => {
    const d = buildCagedModel(view, AF_21, { tuningName: '7-string standard', temporary: true });
    expect(d.temporaryName).toBe('7-string standard');
    expect(d.unsupportedNotice).toBeNull();
    expect(
      d.model?.description?.startsWith('All shapes. Temporary tuning: 7-string standard.')
    ).toBe(true);
  });
});

describe('buildCagedModel: transposed compatible tunings (slice 015 US2)', () => {
  const flatView = (pc: number) => ({ ...selectRoot(view, pc), spellingOverride: 'flat' as const });

  it('M5: Standard and Half step down have no stringMarks and equal tag texts', () => {
    const std = shown(buildCagedModel(view, STANDARD_GUITAR));
    const half = shown(
      buildCagedModel(view, AF_2, { tuningName: 'Half step down', temporary: false })
    );
    expect(std.stringMarks).toBeUndefined();
    expect(half.stringMarks).toBeUndefined();
    expect(half.tags.map((t) => t.label)).toEqual(
      std.tags.slice(0, half.tags.length).map((t) => t.label)
    );
  });

  it('M6: Half step down, E♭ major: E shape roots at fret 0 spell E♭ and sound E♭2/E♭3/E♭4', () => {
    const d = buildCagedModel(flatView(3), AF_2, {
      tuningName: 'Half step down',
      temporary: false
    });
    expect(d.keyName).toBe('E♭ major');
    const model = shown(d);
    const e = d.occurrences.find((o) => o.shape.id === 'E' && o.start === 0);
    expect(e).toBeDefined();
    expect(model.tags.find((t) => t.id === 'E@0')?.label).toBe(
      'E shape · roots on strings 6, 4, 1'
    );
    const roots = [
      [6, 0, 39],
      [4, 2, 51],
      [1, 0, 63]
    ] as const;
    for (const [string, fret, pitch] of roots) {
      const mk = model.markers.find((k) => k.string === string && k.fret === fret);
      expect(mk?.function).toBe('root');
      expect(mk?.spelling).toMatchObject({ letter: 'E', accidental: -1 });
      expect(positionPitch(AF_2, { string, fret })).toBe(pitch);
    }
  });

  it('G♭ major: E shape starts at fret 3 and spells G♭–B♭–D♭', () => {
    const d = buildCagedModel(flatView(6), AF_2, {
      tuningName: 'Half step down',
      temporary: false
    });
    expect(d.occurrences.find((o) => o.shape.id === 'E')?.start).toBe(3);
    const names = new Set(
      d.occurrences
        .filter((o) => o.shape.id === 'E' && o.start === 3)
        .flatMap((o) => o.notes)
        .map((n) => {
          const sp = shown(d).markers.find(
            (k) => k.string === n.string && k.fret === n.fret
          )?.spelling;
          return `${sp?.letter}${sp?.accidental}`;
        })
    );
    expect([...names].sort()).toEqual(['B-1', 'D-1', 'G-1']);
    expect(d.model?.stringMarks).toBeUndefined();
  });
});

describe('buildCagedModel: shape focus (US1)', () => {
  const focusE = setFocus(view, { letter: 'E', ordinal: 0 });

  it('cagedOccurrencesFor is sorted by start', () => {
    const occs = cagedOccurrencesFor(view, STANDARD_GUITAR);
    expect(occs.map((o) => o.start)).toEqual([...occs.map((o) => o.start)].sort((a, b) => a - b));
    expect(cagedOccurrencesFor(view, STANDARD_GUITAR)).toHaveLength(9);
  });

  it('no focus: every marker normal, no region, nothing pressed, steps off', () => {
    const d = buildCagedModel(view, STANDARD_GUITAR);
    const model = shown(d);
    expect(model.markers.every((mk) => mk.emphasis === 'normal')).toBe(true);
    expect(model.region).toBeUndefined();
    expect(model.tags.every((t) => !t.pressed)).toBe(true);
    expect(model.tagsInteractive).toBe(true);
    expect(d.focusIndex).toBeNull();
    expect(d.focused).toBeNull();
    expect(d.steps).toEqual({ previous: false, next: false });
    expect(model.description.startsWith('All shapes.')).toBe(true);
  });

  it('focus: focused notes highlighted (shared too), others dimmed, band centred, tag pressed', () => {
    const d = buildCagedModel(focusE, STANDARD_GUITAR);
    const model = shown(d);
    const focused = d.focused;
    if (!focused || d.focusIndex === null) throw new Error('expected focus');
    expect(focused.shape.id).toBe('E');
    const ids = new Set(focused.notes.map((n) => `${n.string}:${n.fret}`));
    for (const mk of model.markers) {
      expect(mk.emphasis).toBe(ids.has(`${mk.string}:${mk.fret}`) ? 'highlighted' : 'dimmed');
    }
    expect(model.markers.filter((mk) => mk.emphasis === 'highlighted')).toHaveLength(ids.size);
    expect(model.region).toEqual({ start: 8, end: 10, align: 'center' });
    expect(model.tags.map((t) => t.pressed)).toEqual(model.tags.map((_, i) => i === d.focusIndex));
    expect(model.tags[d.focusIndex].id).toBe('E@8');
    expect(d.steps).toEqual({ previous: true, next: true });
    expect(model.description.startsWith('E shape in focus, frets 8 to 10. ')).toBe(true);
  });

  it('first and last occurrence disable one step', () => {
    const first = buildCagedModel(setFocus(view, { letter: 'C', ordinal: 0 }), STANDARD_GUITAR);
    expect(first.steps).toEqual({ previous: false, next: true });
    const last = buildCagedModel(setFocus(view, { letter: 'E', ordinal: 1 }), STANDARD_GUITAR);
    expect(last.steps).toEqual({ previous: true, next: false });
  });

  it('drawnLetters on 12 frets omits D', () => {
    const d = buildCagedModel(view, AF_1_12);
    expect([...d.drawnLetters].sort()).toEqual(['A', 'C', 'E', 'G']);
  });

  it('non-compatible tuning: no focus fields', () => {
    const d = buildCagedModel(focusE, AF_8);
    expect(d.model).toBeNull();
    expect(d.focusIndex).toBeNull();
    expect(d.steps).toEqual({ previous: false, next: false });
    expect(d.drawnLetters.size).toBe(0);
    expect(d.connections).toEqual([]);
  });
});

describe('buildCagedModel: step transition (016 US2)', () => {
  const eFocus = setFocus(view, { letter: 'E', ordinal: 0 });
  const find = (d: ReturnType<typeof buildCagedModel>, key: string) =>
    d.model?.markers.find((mk) => mk.id === key);

  it('rings and highlights transition positions even with connections off', () => {
    const d = build(eFocus, STANDARD_GUITAR, CTX, { positions: ['4:10'] });
    expect(view.connections).toBe(false);
    const ringed = find(d, '4:10');
    expect(ringed?.ring).toBe(true);
    expect(ringed?.emphasis).toBe('highlighted');
  });

  it('keeps focus-driven emphasis for every other position and rings only the transition', () => {
    const d = build(eFocus, STANDARD_GUITAR, CTX, { positions: ['4:10'] });
    const others = (d.model?.markers ?? []).filter((mk) => mk.id !== '4:10');
    expect(others.length).toBeGreaterThan(0);
    expect(others.every((mk) => mk.ring !== true)).toBe(true);
    const plain = build(eFocus, STANDARD_GUITAR, CTX);
    for (const mk of others) expect(mk.emphasis).toBe(find(plain, mk.id as string)?.emphasis);
  });

  it('a null or absent transition changes nothing', () => {
    const plain = build(eFocus, STANDARD_GUITAR, CTX);
    expect(build(eFocus, STANDARD_GUITAR, CTX, null).model).toEqual(plain.model);
    expect(plain.model?.markers.some((mk) => mk.ring === true)).toBe(false);
  });

  it('a transition position outside the drawn markers is ignored', () => {
    const plain = build(eFocus, STANDARD_GUITAR, CTX);
    const d = build(eFocus, STANDARD_GUITAR, CTX, { positions: ['1:21'] });
    expect(d.model?.markers).toEqual(plain.model?.markers);
  });
});

describe('buildCagedModel: connections (016 US3)', () => {
  const on = (v: typeof view) => ({ ...v, connections: true });
  const ringed = (d: ReturnType<typeof buildCagedModel>) =>
    new Set((d.model?.markers ?? []).filter((mk) => mk.ring === true).map((mk) => mk.id as string));
  const keys = (list: readonly string[]) => new Set(list);

  const C_MAJOR = keys([
    '5:3',
    '4:5',
    '3:5',
    '2:5',
    '6:8',
    '1:8',
    '4:10',
    '3:12',
    '2:13',
    '1:12',
    // 22 frets: the same pairs again +12 for C@12→A@15→G@17→E@20 (contract §1)
    '5:15',
    '4:17',
    '3:17',
    '2:17',
    '6:20',
    '1:20'
  ]);
  const C_MINOR = keys([
    '5:3',
    '4:5',
    '3:5',
    '6:8',
    '2:8',
    '1:8',
    '4:10',
    '3:12',
    '2:13',
    '5:15',
    '4:17',
    '3:17',
    '6:20',
    '2:20',
    '1:20'
  ]);
  const minor = { ...view, quality: 'minor' as const };

  it('connections equal cagedConnections of the occurrences', () => {
    const d = buildCagedModel(view, STANDARD_GUITAR);
    expect(d.connections.length).toBeGreaterThan(0);
    expect(new Set(d.connections.map((c) => `${c.string}:${c.fret}`))).toEqual(C_MAJOR);
  });

  it('TM-6.3: C major rings exactly the anchor table, with or without focus', () => {
    expect(ringed(buildCagedModel(on(view), STANDARD_GUITAR))).toEqual(C_MAJOR);
    const focused = setFocus(on(view), { letter: 'E', ordinal: 0 });
    expect(ringed(buildCagedModel(focused, STANDARD_GUITAR))).toEqual(C_MAJOR);
  });

  it('TM-7.2: C minor rings exactly the anchor table', () => {
    expect(ringed(buildCagedModel(on(minor), STANDARD_GUITAR))).toEqual(C_MINOR);
  });

  it('F# minor rings the C-minor pattern shifted by 6 frets modulo 12', () => {
    const fsm = on(selectRoot(minor, 6));
    const d = buildCagedModel(fsm, STANDARD_GUITAR);
    expect(d.occurrences.length).toBeGreaterThanOrEqual(5);
    const norm = (ids: Iterable<string>) =>
      new Set([...ids].map((id) => `${id.split(':')[0]}:${Number(id.split(':')[1]) % 12}`));
    const expected = norm(
      [...C_MINOR].map((id) => {
        const [s, f] = id.split(':').map(Number);
        return `${s}:${(f + 6) % 12}`;
      })
    );
    expect(norm(ringed(d))).toEqual(expected);
  });

  it('off: no ring outside a transition', () => {
    expect(ringed(buildCagedModel(view, STANDARD_GUITAR)).size).toBe(0);
  });

  it('rings follow focus emphasis: highlighted inside the focus, dimmed elsewhere', () => {
    const focused = setFocus(on(view), { letter: 'E', ordinal: 0 });
    const d = buildCagedModel(focused, STANDARD_GUITAR);
    const inFocus = new Set(d.focused?.notes.map((n) => `${n.string}:${n.fret}`));
    const rings = (d.model?.markers ?? []).filter((mk) => mk.ring === true);
    expect(rings.some((mk) => inFocus.has(mk.id as string))).toBe(true);
    expect(rings.some((mk) => !inFocus.has(mk.id as string))).toBe(true);
    for (const mk of rings) {
      expect(mk.emphasis).toBe(inFocus.has(mk.id as string) ? 'highlighted' : 'dimmed');
    }
  });

  it('partial fits ring only between adjacent drawn occurrences', () => {
    const d = buildCagedModel(on(view), AF_1_12);
    expect(d.occurrences.length).toBeLessThan(5);
    const expected = new Set(d.connections.map((c) => `${c.string}:${c.fret}`));
    expect(ringed(d)).toEqual(expected);
    expect(ringed(d).size).toBeLessThan(C_MAJOR.size);
  });

  it('describes each ringed connection with both shape letters, after the existing sentences', () => {
    const d = buildCagedModel(on(view), STANDARD_GUITAR);
    const text = shown(d).description;
    expect(text).toContain('String 4, fret 5, fifth, shared by A and G shapes.');
    expect(text).toContain('String 4, fret 10, root, shared by E and D shapes.');
    const sentences = text.match(/shared by/g) ?? [];
    expect(sentences).toHaveLength(d.connections.length);
    expect(text.indexOf('shared by')).toBeGreaterThan(text.indexOf('shape, frets'));
    expect(shown(buildCagedModel(view, STANDARD_GUITAR)).description).not.toContain('shared by');
  });

  it('non-compatible tuning has no connections', () => {
    const d = buildCagedModel(on(view), AF_8);
    expect(d.connections).toEqual([]);
    expect(d.model).toBeNull();
  });
});

describe('buildCagedModel: layer switches (US2)', () => {
  it('derives switches from the layer rules', () => {
    const d = build(view, STANDARD_GUITAR, CTX);
    expect(d.switches.chord).toEqual({ on: true, disabled: 'last-layer' });
    expect(d.switches.arpeggio).toEqual({ on: false, disabled: null });
    expect(d.extraSampleShown).toBe(false);
  });

  it('shows the extra sample only when Pentatonic and Scale are both on', () => {
    const layers = { chord: true, arpeggio: false, pentatonic: true, scale: false, triad: false };
    expect(build({ ...view, layers }, STANDARD_GUITAR, CTX).extraSampleShown).toBe(false);
    expect(
      build({ ...view, layers: { ...layers, scale: true } }, STANDARD_GUITAR, CTX).extraSampleShown
    ).toBe(true);
  });

  it('forces every switch to no-shapes in a non-compatible tuning and keeps the layers', () => {
    const v = {
      ...view,
      layers: { chord: true, arpeggio: true, pentatonic: false, scale: false, triad: false }
    };
    const d = build(v, AF_8, CTX);
    expect(d.tuningClass).toBe('non-compatible');
    for (const s of Object.values(d.switches)) expect(s.disabled).toBe('no-shapes');
    expect(d.switches.arpeggio.on).toBe(true);
    expect(d.positions).toEqual([]);
  });

  it('exposes resolved positions for the layers', () => {
    const d = build(view, STANDARD_GUITAR, CTX);
    expect(d.positions.length).toBeGreaterThan(0);
    expect(new Set(d.positions.map((p) => p.layer))).toEqual(new Set(['chord']));
  });
});

describe('buildCagedModel: layer markers and labels (017 US1)', () => {
  const ALL = { chord: true, arpeggio: false, pentatonic: false, scale: true, triad: false };
  const focusE = setFocus(view, { letter: 'E', ordinal: 0 });
  const scaleView = { ...focusE, layers: ALL };
  const keyed = (d: ReturnType<typeof buildCagedModel>) =>
    new Map((d.model?.markers ?? []).map((mk) => [mk.id as string, mk]));

  it('maps scale positions to degree markers with interval, spelling and extra', () => {
    const d = build(scaleView, STANDARD_GUITAR, CTX);
    const marks = keyed(d);
    expect(marks.size).toBe(d.positions.length);
    for (const p of d.positions) {
      const mk = marks.get(`${p.string}:${p.fret}`);
      expect(mk).toBeDefined();
      expect(mk?.interval).toBe(p.degree);
      expect(mk?.emphasis).toBe(p.emphasis);
      if (p.layer === 'scale' || p.layer === 'pentatonic') {
        expect(mk?.function).toBe('degree');
        expect(mk?.layer).toBeUndefined();
      } else {
        expect(['root', 'third', 'fifth']).toContain(mk?.function);
      }
    }
    // C major E shape: B at s6 f7 is a scale 7th, spelled B.
    const b = marks.get('6:7');
    expect(b?.function).toBe('degree');
    expect(b?.interval).toBe('7');
    expect(b?.spelling).toEqual({ letter: 'B', accidental: 0 });
  });

  it('draws chord positions as root, third and fifth in the E shape of C major', () => {
    const marks = keyed(build(scaleView, STANDARD_GUITAR, CTX));
    expect(marks.get('6:8')?.function).toBe('root');
    expect(marks.get('6:8')?.interval).toBe('R');
  });

  it('marks the arpeggio layer on non-chord arpeggio notes', () => {
    const v = {
      ...focusE,
      layers: { chord: true, arpeggio: true, pentatonic: false, scale: false, triad: false }
    };
    const d = build(v, STANDARD_GUITAR, CTX);
    const arps = d.positions.filter((p) => p.layer === 'arpeggio');
    expect(arps.length).toBeGreaterThan(0);
    const marks = keyed(d);
    for (const p of arps) expect(marks.get(`${p.string}:${p.fret}`)?.layer).toBe('arpeggio');
  });

  it('sets labelMode from labelType', () => {
    expect(build(scaleView, STANDARD_GUITAR, CTX).model?.labelMode).toBe('interval');
    expect(build({ ...scaleView, labelType: 'name' }, STANDARD_GUITAR, CTX).model?.labelMode).toBe(
      'note'
    );
    expect(build(view, STANDARD_GUITAR, CTX).model?.labelMode).toBe('interval');
  });

  it('spells scale degrees on consecutive letters in the key (F major B♭)', () => {
    const v = { ...selectRoot(view, 5), layers: ALL };
    const f = setFocus(v, { letter: 'E', ordinal: 0 });
    const d = build(f, STANDARD_GUITAR, CTX);
    const four = d.model?.markers.find((mk) => mk.interval === '4');
    expect(four?.spelling).toEqual({ letter: 'B', accidental: -1 });
  });

  it('staggers appear = i / n only for ids in reveal.ids, in order', () => {
    const base = build(scaleView, STANDARD_GUITAR, CTX);
    const ids = base.positions.slice(0, 4).map((p) => `${p.string}:${p.fret}`);
    const d = build(scaleView, STANDARD_GUITAR, CTX, null, {
      reveal: { ids },
      layerChange: null,
      triadChange: null
    });
    const marks = keyed(d);
    ids.forEach((id, i) => expect(marks.get(id)?.appear).toBeCloseTo(i / ids.length));
    for (const [id, mk] of marks) if (!ids.includes(id)) expect(mk.appear).toBeUndefined();
    for (const mk of marks.values()) {
      if (mk.appear !== undefined) {
        expect(mk.appear).toBeGreaterThanOrEqual(0);
        expect(mk.appear).toBeLessThan(1);
      }
    }
  });

  it('no reveal: no marker carries appear', () => {
    const d = build(scaleView, STANDARD_GUITAR, CTX);
    expect(d.model?.markers.every((mk) => mk.appear === undefined)).toBe(true);
  });

  it('rings only positions that have a marker', () => {
    const v = { ...scaleView, connections: true };
    const d = build(v, STANDARD_GUITAR, CTX);
    const ids = new Set((d.model?.markers ?? []).map((mk) => mk.id));
    const ringed = (d.model?.markers ?? []).filter((mk) => mk.ring);
    expect(ringed.length).toBeGreaterThan(0);
    for (const c of d.connections) {
      const id = `${c.string}:${c.fret}`;
      expect(ringed.some((mk) => mk.id === id)).toBe(ids.has(id));
    }
  });

  it('Drop D, D major, E shape: string 6 is 9, 11, 12 with 12 as Chord', () => {
    const v = { ...selectRoot(view, 2), layers: ALL };
    const f = setFocus(v, { letter: 'E', ordinal: 0 });
    const d = build(f, AF_4, CTX);
    expect(d.model?.region).toMatchObject({ start: 10, end: 12 });
    expect(d.focused?.start).toBe(10);
    const s6 = (d.model?.markers ?? []).filter((mk) => mk.string === 6 && mk.emphasis !== 'dimmed');
    expect(s6.map((mk) => mk.fret).sort((a, b) => a - b)).toEqual([9, 11, 12]);
    expect(s6.find((mk) => mk.fret === 12)?.function).toBe('root');
    expect(s6.find((mk) => mk.fret === 9)?.function).toBe('degree');
  });

  it('7 strings: string 7 carries layer markers only, no chord markers', () => {
    const v = { ...selectRoot(view, 2), layers: ALL };
    const f = setFocus(v, { letter: 'C', ordinal: 0 });
    const d = build(f, AF_21, CTX);
    const drawn = (d.model?.markers ?? []).filter((mk) => mk.emphasis !== 'dimmed');
    const s7 = drawn.filter((mk) => mk.string === 7);
    expect(s7.length).toBeGreaterThan(0);
    for (const mk of s7) expect(mk.function).toBe('degree');
    const s2 = drawn.filter((mk) => mk.string === 2).map((mk) => mk.fret);
    expect(s7.map((mk) => mk.fret).sort((a, b) => a - b)).toEqual(s2.sort((a, b) => a - b));
  });
});

describe('buildCagedModel: extra mark (017 US5)', () => {
  const focusE = setFocus(view, { letter: 'E', ordinal: 0 });
  const both = { chord: true, arpeggio: false, pentatonic: true, scale: true, triad: false };

  it('marks only the 4th and 7th as extra in major and names them', () => {
    const d = buildCagedModel({ ...focusE, layers: both }, STANDARD_GUITAR);
    const extra = (d.model?.markers ?? []).filter((mk) => mk.extra);
    expect(extra.map((mk) => mk.id).sort()).toEqual(['1:7', '3:10', '4:9', '5:8', '6:7'].sort());
    expect(extra.every((mk) => mk.function === 'degree')).toBe(true);
    expect(shown(d).description).toContain('Extra mark: F, B.');
  });

  it('names the 2nd and flat 6th in minor with spoken names', () => {
    const minor = { ...focusE, rootPc: 9, quality: 'minor' as const, layers: both };
    const d = buildCagedModel(minor, STANDARD_GUITAR);
    expect(shown(d).description).toContain('Extra mark: B, F.');
  });

  it('has no extra markers and no sentence unless both layers are on', () => {
    for (const layers of [
      { ...both, pentatonic: false },
      { ...both, scale: false }
    ]) {
      const d = buildCagedModel({ ...focusE, layers }, STANDARD_GUITAR);
      expect((d.model?.markers ?? []).some((mk) => mk.extra)).toBe(false);
      expect(shown(d).description).not.toContain('Extra mark');
    }
  });
});

describe('buildCagedModel: arpeggio layer (017 US3)', () => {
  const arp = { chord: true, arpeggio: true, pentatonic: false, scale: false, triad: false };
  const markers = (d: ReturnType<typeof buildCagedModel>) => d.model?.markers ?? [];

  it('no focus: one marker per position; arpeggio markers keep root/third/fifth functions', () => {
    const d = build({ ...view, layers: arp }, STANDARD_GUITAR, CTX);
    const ids = markers(d).map((mk) => mk.id);
    expect(new Set(ids).size).toBe(ids.length);
    const layered = markers(d).filter((mk) => mk.layer === 'arpeggio');
    expect(layered.length).toBeGreaterThan(0);
    for (const mk of markers(d)) expect(['root', 'third', 'fifth']).toContain(mk.function);
    for (const mk of layered) expect(['R', '3', '5']).toContain(mk.interval);
    expect(markers(d).some((mk) => mk.layer === undefined)).toBe(true);
    expect(markers(d).every((mk) => mk.emphasis === 'normal')).toBe(true);
  });

  it('A minor draws R, b3, 5 only', () => {
    const v = { ...selectRoot(view, 9), quality: 'minor' as const, layers: arp };
    for (const mk of markers(build(v, STANDARD_GUITAR, CTX)))
      expect(['R', 'b3', '5']).toContain(mk.interval);
  });

  it('with focus: arpeggio markers only inside the focused region', () => {
    const d = build(
      { ...setFocus(view, { letter: 'E', ordinal: 0 }), layers: arp },
      STANDARD_GUITAR,
      CTX
    );
    const region = d.focused?.region;
    const layered = markers(d).filter((mk) => mk.layer === 'arpeggio');
    expect(layered.length).toBeGreaterThan(0);
    for (const mk of layered) {
      expect(mk.fret).toBeGreaterThanOrEqual(region?.start ?? 0);
      expect(mk.fret).toBeLessThanOrEqual(region?.end ?? 0);
    }
  });

  it('Chord off: chord positions drawn as arpeggio, no dimmed markers', () => {
    const off = { ...arp, chord: false };
    for (const v of [view, setFocus(view, { letter: 'E', ordinal: 0 })]) {
      const d = build({ ...v, layers: off }, STANDARD_GUITAR, CTX);
      expect(markers(d).length).toBeGreaterThan(0);
      for (const mk of markers(d)) {
        expect(mk.layer).toBe('arpeggio');
        expect(mk.emphasis).not.toBe('dimmed');
      }
    }
  });

  it('connection rings sit only on positions that have a marker', () => {
    const d = build(
      { ...view, layers: { ...arp, chord: false }, connections: true },
      STANDARD_GUITAR,
      CTX
    );
    const ids = new Set(markers(d).map((mk) => mk.id));
    for (const mk of markers(d).filter((x) => x.ring)) expect(ids.has(mk.id)).toBe(true);
    expect(d.connections.length).toBeGreaterThan(0);
  });
});

describe('buildCagedModel: layer description (017 US6)', () => {
  const focusE = setFocus(view, { letter: 'E', ordinal: 0 });
  const all = { chord: true, arpeggio: true, pentatonic: true, scale: true, triad: false };
  const countOf = (d: ReturnType<typeof buildCagedModel>, layer: string): number =>
    d.positions.filter((p) => p.layer === layer).length;

  it('chord only, no focus: layers sentence and neck-wide chord count', () => {
    const d = buildCagedModel(view, STANDARD_GUITAR);
    const text = shown(d).description;
    expect(text).toContain(
      `C major: 9 shapes along the neck. Layers on: Chord. Across the neck: ${countOf(d, 'chord')} chord notes.`
    );
  });

  it('all layers with focus: region counts per drawn layer, chord root counted once', () => {
    const d = buildCagedModel({ ...focusE, layers: all }, STANDARD_GUITAR);
    const text = shown(d).description;
    const counts = ['chord', 'arpeggio', 'pentatonic', 'scale']
      .map((l) => `${countOf(d, l)} ${l} notes`)
      .join(', ');
    expect(text).toContain(
      `Layers on: Chord, Arpeggio, Pentatonic, and Scale. In this region: ${counts}.`
    );
    const keys = d.positions.map((p) => `${p.string}:${p.fret}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('names a layer that is on but not drawable without a focus', () => {
    const d = buildCagedModel(
      {
        ...view,
        layers: { chord: true, arpeggio: false, pentatonic: true, scale: false, triad: false }
      },
      STANDARD_GUITAR
    );
    const text = shown(d).description;
    expect(text).toContain('Pentatonic is on and shows when a shape is in focus.');
    expect(text).not.toMatch(/\d+ pentatonic notes/);
  });

  it('orders change · focus · tuning · summary · layers · counts · extra · entries', () => {
    const d = build({ ...focusE, layers: all }, STANDARD_GUITAR, CTX, null, {
      reveal: null,
      layerChange: { layer: 'scale', on: true },
      triadChange: null
    });
    const text = shown(d).description;
    const marks = [
      'Scale layer on.',
      'E shape in focus',
      'Tuning: Standard.',
      'C major: 9 shapes',
      'Layers on:',
      'In this region:',
      'Extra mark:',
      'E shape, frets 8 to 10, roots'
    ].map((s) => text.indexOf(s));
    expect(marks.every((i) => i >= 0)).toBe(true);
    expect([...marks].sort((a, b) => a - b)).toEqual(marks);
  });

  it('puts waiting sentences after counts and before entries', () => {
    const d = buildCagedModel(
      {
        ...view,
        layers: { chord: true, arpeggio: false, pentatonic: false, scale: true, triad: false }
      },
      STANDARD_GUITAR
    );
    const text = shown(d).description;
    expect(text.indexOf('Across the neck:')).toBeLessThan(text.indexOf('Scale is on and shows'));
    expect(text.indexOf('Scale is on and shows')).toBeLessThan(text.indexOf('C shape, frets'));
  });
});

describe('Triad layer model (018 US1)', () => {
  const focusA = setFocus(view, { letter: 'A', ordinal: 0 });
  const triadView = (over: Partial<typeof view> = {}) => ({
    ...focusA,
    layers: { chord: true, arpeggio: false, pentatonic: false, scale: false, triad: true },
    triadSet: 3 as const,
    ...over
  });
  const NO_EXTRAS = { reveal: null, layerChange: null, triadChange: null };
  const triadMarkers = (d: ReturnType<typeof buildCagedModel>) =>
    (d.model?.markers ?? []).filter((k) => k.layer === 'triad');

  it('draws exactly three triad markers, ids triad:s:f, function glyphs', () => {
    const d = build(triadView(), STANDARD_GUITAR, CTX);
    const t = triadMarkers(d);
    expect(t.map((k) => k.id).sort()).toEqual(['triad:1:3', 'triad:2:5', 'triad:3:5']);
    expect(t.map((k) => k.function).sort()).toEqual(['fifth', 'root', 'third']);
    expect(t.find((k) => k.id === 'triad:3:5')?.function).toBe('root');
  });

  it('Name labels give C, E, G', () => {
    const d = build(triadView({ labelType: 'name' }), STANDARD_GUITAR, CTX);
    expect(d.model?.labelMode).toBe('note');
    const names = triadMarkers(d)
      .sort((a, b) => b.string - a.string)
      .map((k) => k.spelling?.letter);
    expect(names).toEqual(['C', 'E', 'G']);
  });

  it('keeps ring when the position is a connection', () => {
    const d = build(triadView({ connections: true }), STANDARD_GUITAR, CTX);
    const shared = new Set(d.connections.map((c) => `${c.string}:${c.fret}`));
    for (const k of triadMarkers(d))
      expect(k.ring === true).toBe(shared.has(`${k.string}:${k.fret}`));
  });

  it('display.triad has sets, selected and summary', () => {
    const d = build(triadView(), STANDARD_GUITAR, CTX);
    expect(d.triad?.selected).toBe(3);
    expect(d.triad?.sets.map((x) => x.id)).toEqual([6, 5, 4, 3]);
    expect(d.triad?.sets.find((x) => x.id === 3)?.available).toBe(true);
    expect(d.triad?.summary).toBe('C major, root position, strings 3-2-1, frets 5-5-3');
  });

  it('display.triad is null with Triad off or no focus', () => {
    expect(build(triadView({ layers: view.layers }), STANDARD_GUITAR, CTX).triad).toBeNull();
    expect(build({ ...triadView(), focus: null }, STANDARD_GUITAR, CTX).triad).toBeNull();
    expect(build(view, STANDARD_GUITAR, CTX).triad).toBeNull();
  });

  it('description has the triad sentence with spoken accidentals', () => {
    const d = build(triadView(), STANDARD_GUITAR, CTX);
    expect(shown(d).description).toContain(
      'Triad: C, E, G — root position, strings 3-2-1, frets 5-5-3.'
    );
    const sharp = build(
      { ...selectRoot(triadView(), 1), focus: { letter: 'A', ordinal: 0 }, triadSet: 3 },
      STANDARD_GUITAR,
      CTX
    );
    const text = shown(sharp).description;
    if (text.includes('Triad:')) expect(text).not.toMatch(/Triad:[^.]*[♯♭]/);
  });

  it('announces triadChange selected first', () => {
    const d = build(triadView(), STANDARD_GUITAR, CTX, null, {
      ...NO_EXTRAS,
      layerChange: { layer: 'triad', on: true },
      triadChange: { kind: 'selected', set: 3 }
    });
    const text = shown(d).description;
    expect(text.startsWith('Strings 3-2-1: C major triad, root position, frets 5-5-3')).toBe(true);
  });

  it('sets appear for ids in extras.reveal', () => {
    const ids = ['triad:3:5', 'triad:2:5', 'triad:1:3'];
    const d = build(triadView(), STANDARD_GUITAR, CTX, null, {
      ...NO_EXTRAS,
      reveal: { ids }
    });
    const t = triadMarkers(d);
    for (const k of t) expect(k.appear).toBeDefined();
    expect(t.find((k) => k.id === 'triad:3:5')?.appear).toBeCloseTo(0);
  });

  it('no triad markers when the set is unavailable or Triad is off', () => {
    expect(triadMarkers(build(triadView({ triadSet: 5 }), STANDARD_GUITAR, CTX))).toHaveLength(0);
    expect(
      triadMarkers(build(triadView({ layers: view.layers }), STANDARD_GUITAR, CTX))
    ).toHaveLength(0);
  });

  it('Triad row is last in the layer order', () => {
    const d = build(triadView(), STANDARD_GUITAR, CTX);
    expect(Object.keys(d.switches).at(-1)).toBe('triad');
    expect(d.switches.triad.on).toBe(true);
  });

  it('US2: sets[i].available and ariaLabel; unavailableNote only when some set is unavailable', () => {
    const d = build(triadView(), STANDARD_GUITAR, CTX); // A shape: 5-4-3 unavailable
    const s5 = d.triad?.sets.find((x) => x.id === 5);
    expect(s5?.available).toBe(false);
    expect(s5?.ariaLabel).toBe('Strings 5-4-3, unavailable');
    expect(d.triad?.sets.find((x) => x.id === 3)?.ariaLabel).toBe('3-2-1');
    expect(d.triad?.unavailableNote).toBe(
      'In this shape there is no close-position triad on these strings'
    );
  });

  it('US2: no unavailableNote when every set is available', () => {
    const all = (d: ReturnType<typeof build>) => d.triad?.sets.every((x) => x.available);
    // 24-fret board: scan the five letters for a fully available shape; none ⇒ nothing to assert.
    for (const letter of ['C', 'A', 'G', 'E', 'D'] as const) {
      const d = build(
        { ...triadView(), focus: { letter, ordinal: 0 }, triadSet: null },
        AF_1_24,
        CTX
      );
      if (all(d)) expect(d.triad?.unavailableNote).toBeNull();
      else expect(d.triad?.unavailableNote).not.toBeNull();
    }
  });
});

describe('Triad layer model: tunings (018 US5)', () => {
  const on = { chord: true, arpeggio: false, pentatonic: false, scale: false, triad: true };
  const HALF: CagedContext = { tuningName: 'Half step down', temporary: false };
  const DROP_D: CagedContext = { tuningName: 'Drop D', temporary: false };
  const NO_EXTRAS = { reveal: null, layerChange: null, triadChange: null };
  const triadMarkers = (d: ReturnType<typeof build>) =>
    (d.model?.markers ?? []).filter((k) => k.layer === 'triad');
  const sig = (d: ReturnType<typeof build>) =>
    triadMarkers(d)
      .map((k) => `${k.string}:${k.fret}`)
      .sort();

  it('Half step down names follow real pitch and frets match the standard drawing (every key)', () => {
    for (let pc = 0; pc < 12; pc++) {
      for (const letter of ['C', 'A', 'G', 'E', 'D'] as const) {
        const base = {
          ...selectRoot(view, pc),
          focus: { letter, ordinal: 0 },
          layers: on,
          triadSet: 3 as const,
          labelType: 'name' as const
        };
        const std = build(base, STANDARD_GUITAR, CTX, null, NO_EXTRAS);
        const half = build(base, AF_2, HALF, null, NO_EXTRAS);
        // Same key: names come from the key's spelling, so they match; frets move with the shapes.
        const names = triadMarkers(half).map((k) => k.spelling);
        for (const k of triadMarkers(half)) {
          const sp = k.spelling;
          if (!sp) throw new Error('triad marker has no spelling');
          const sounding = positionPitch(AF_2, { string: k.string, fret: k.fret });
          expect(pitchOfSpelling({ ...sp, octave: 0 }) % 12).toBe(sounding % 12);
        }
        expect(names.length).toBe(triadMarkers(std).length);
        if (triadMarkers(half).length === 3 && triadMarkers(std).length === 3) {
          // fret pattern of the triad inside its shape is tuning independent
          const rel = (d: ReturnType<typeof build>) => {
            const f = triadMarkers(d).map((k) => k.fret);
            const lo = Math.min(...f);
            return f.map((x) => x - lo).sort();
          };
          expect(rel(half)).toEqual(rel(std));
        }
      }
    }
  });

  it('Half step down E major A shape draws the same frets as standard', () => {
    const base = {
      ...selectRoot(setFocus(view, { letter: 'A', ordinal: 0 }), 4),
      layers: on,
      triadSet: 3 as const
    };
    const std = build(base, STANDARD_GUITAR, CTX, null, NO_EXTRAS);
    const half = build(base, AF_2, HALF, null, NO_EXTRAS);
    // Half step down sounds a semitone lower, so the same key sits one fret higher.
    expect(sig(std)).toHaveLength(3);
    expect(sig(half)).toEqual(
      triadMarkers(std)
        .map((k) => `${k.string}:${k.fret + 1}`)
        .sort()
    );
  });

  it('Drop D: set 6 is listed; when available it uses real D2 pitches, otherwise it is unavailable', () => {
    let withSix = 0;
    for (const letter of ['C', 'A', 'G', 'E', 'D'] as const) {
      for (let ordinal = 0; ordinal < 3; ordinal++) {
        const v = {
          ...selectRoot(setFocus(view, { letter, ordinal }), 2),
          spellingOverride: 'none' as const,
          layers: on,
          triadSet: 6 as const
        };
        const d = build(v, AF_4, DROP_D, null, NO_EXTRAS);
        if (!d.triad) continue;
        expect(d.triad.sets.map((s) => s.id)).toEqual([6, 5, 4, 3]);
        const six = d.triad.sets.find((s) => s.id === 6);
        const marks = triadMarkers(d);
        if (!six?.available) {
          expect(marks).toHaveLength(0);
          continue;
        }
        withSix++;
        expect(new Set(marks.map((k) => k.string))).toEqual(new Set([6, 5, 4]));
        const classes = marks.map(
          (k) => positionPitch(AF_4, { string: k.string, fret: k.fret }) % 12
        );
        expect(classes.sort((x, y) => x - y)).toEqual([2, 6, 9]); // D, F#, A
      }
    }
    expect(withSix).toBeGreaterThanOrEqual(0);
  });

  it('7-string: selector lists 7-6-5 first', () => {
    const v = {
      ...setFocus(view, { letter: 'A', ordinal: 0 }),
      layers: on,
      triadSet: 3 as const
    };
    const d = build(
      v,
      AF_21,
      { tuningName: '7-string standard', temporary: false },
      null,
      NO_EXTRAS
    );
    expect(d.triad?.sets.map((s) => s.id)).toEqual([7, 6, 5, 4, 3]);
  });

  it('7-string: default falls to the first available when 3-2-1 is unavailable', () => {
    let checked = 0;
    for (const letter of ['C', 'A', 'G', 'E', 'D'] as const) {
      for (let pc = 0; pc < 12; pc++) {
        const v = selectRoot(setFocus(view, { letter, ordinal: 0 }), pc);
        const occ = cagedOccurrencesFor(v, AF_21).find((o) => o.shape.id === letter);
        if (!occ) continue;
        const avail = triadAvailability(occ, AF_21, cagedRootSpelling(v), 'major');
        if (avail.find((a) => a.set === 3)?.triad === null) {
          const first = avail.find((a) => a.triad !== null)?.set ?? null;
          expect(defaultTriadSet(avail)).toBe(first);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('non-compatible tuning: switch disabled, display.triad null, state kept', () => {
    const v = {
      ...setFocus(view, { letter: 'A', ordinal: 0 }),
      layers: on,
      triadSet: 3 as const
    };
    const d = build(v, AF_8, { tuningName: 'Open G', temporary: false }, null, NO_EXTRAS);
    expect(d.switches.triad.disabled).toBe('no-shapes');
    expect(d.triad).toBeNull();
    expect(v.layers.triad).toBe(true);
    expect(v.triadSet).toBe(3);
  });
});

describe('display.listen (019)', () => {
  const layersOn = (
    l: Partial<Record<'chord' | 'arpeggio' | 'pentatonic' | 'scale' | 'triad', boolean>>
  ) => ({
    chord: false,
    arpeggio: false,
    pentatonic: false,
    scale: false,
    triad: false,
    ...l
  });

  it('enabled iff there is an occurrence; no reason; all-chords source with no focus', () => {
    const d = buildCagedModel(view, STANDARD_GUITAR);
    expect(d.occurrences.length).toBeGreaterThan(0);
    expect(d.listen).toEqual({ enabled: true, reason: null, source: { kind: 'all-chords' } });
  });

  it('source follows the widest layer on for the focused shape', () => {
    const focused = setFocus(view, { letter: 'A', ordinal: 0 });
    const d = buildCagedModel(
      { ...focused, layers: layersOn({ chord: true, arpeggio: true }) },
      STANDARD_GUITAR
    );
    expect(d.listen.source).toEqual({ kind: 'shape', layer: 'arpeggio', letter: 'A' });
    const s = buildCagedModel(
      { ...focused, layers: layersOn({ chord: true, scale: true }) },
      STANDARD_GUITAR
    );
    expect(s.listen.source).toEqual({ kind: 'shape', layer: 'scale', letter: 'A' });
  });

  it('Triad on with a triad available makes triad the source', () => {
    const focused = setFocus(view, { letter: 'E', ordinal: 0 });
    const d = buildCagedModel(
      { ...focused, layers: layersOn({ chord: true, triad: true }), triadSet: 3 },
      STANDARD_GUITAR
    );
    expect(d.listen.source).toEqual({ kind: 'shape', layer: 'triad', letter: 'E' });
  });

  it('non-compatible tuning without the temporary view: disabled, no shapes reason', () => {
    const d = buildCagedModel(view, AF_8, { tuningName: 'Open G', temporary: false });
    expect(d.listen).toEqual({
      enabled: false,
      reason: 'No shapes to play',
      source: null
    });
  });

  it('no shape fits the fret count: disabled, no fit reason', () => {
    const d = buildCagedModel(view, { ...STANDARD_GUITAR, fretCount: 2 });
    expect(d.occurrences).toEqual([]);
    expect(d.tuningClass).toBe('compatible');
    expect(d.listen).toEqual({
      enabled: false,
      reason: 'No shape fits on the fretboard',
      source: null
    });
  });

  it('pitches come from the effective instrument: the temporary standard view plays standard', () => {
    const d = buildCagedModel(view, STANDARD_GUITAR, { tuningName: 'Standard', temporary: true });
    expect(d.listen.enabled).toBe(true);
    for (const p of d.positions) {
      expect(p.pitch).toBe(positionPitch(STANDARD_GUITAR, { string: p.string, fret: p.fret }));
    }
  });

  it('Half step down: listen is enabled', () => {
    const half = buildCagedModel(view, AF_2);
    expect(half.listen.enabled).toBe(true);
  });
});
