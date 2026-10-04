import { describe, expect, it } from 'vitest';
import { AF_1_12, AF_1_24, AF_2, AF_21, AF_4, AF_8 } from '../../../src/lib/instrument/fixtures';
import { STANDARD_GUITAR, withPresentation } from '../../../src/lib/instrument/instrument';
import type { DisplayModel } from '../../../src/lib/fretboard/types';
import { buildCagedModel } from '../../../src/lib/state/caged-model';
import { initialCagedView } from '../../../src/lib/state/caged-view';

const view = initialCagedView();

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

  it('is interval-labelled with non-interactive tags', () => {
    expect(model.labelMode).toBe('interval');
    expect(model.tagsInteractive).toBe(false);
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
    expect(model.description).toContain('string 5 fret 3 root');
    expect(model.description).toContain('string 3 open fifth');
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
    const d = buildCagedModel({ rootPc: 1, spellingOverride: 'none', quality: 'major' }, AF_4);
    expect(d.keyName).toBe('D♭ major');
  });
});

describe('buildCagedModel: key choice (US2)', () => {
  const at = (rootPc: number, spellingOverride: 'none' | 'sharp' | 'flat' = 'none') => ({
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

  it.each([
    ['Drop D', AF_4],
    ['Open G', AF_8]
  ])('%s: not compatible, nothing drawn, no fit note', (_n, inst) => {
    const d = buildCagedModel(view, inst);
    expect(d.tuningClass).not.toBe('compatible');
    expect(d.model).toBeNull();
    expect(d.fitNote).toBeNull();
    expect(d.occurrences).toEqual([]);
    expect(d.fitCount).toBe(0);
  });
});
