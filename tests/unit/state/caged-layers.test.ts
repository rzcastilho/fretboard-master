import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CHORD_ONLY,
  drawableCount,
  ensureDrawable,
  isDrawable,
  layerCounts,
  needsAutoFocus,
  resolveCagedPositions,
  revealOrder,
  switchStates,
  toggleLayer,
  type ResolvedPosition
} from '../../../src/lib/state/caged-layers';
import type { LayersOn } from '../../../src/lib/state/caged-view';
import { cagedOccurrences } from '../../../src/lib/theory/caged';
import { shapeTriad, type ShapeTriad } from '../../../src/lib/theory/caged-triad';
import { spellTriad } from '../../../src/lib/theory/triad';
import type { CagedLayer } from '../../../src/lib/theory/caged-layers';

function must<T>(v: T | undefined | null): T {
  if (v === undefined || v === null) throw new Error('expected a value');
  return v;
}

const LAYERS: readonly CagedLayer[] = ['triad', 'chord', 'arpeggio', 'pentatonic', 'scale'];
const on = (...ls: CagedLayer[]): LayersOn => ({
  chord: ls.includes('chord'),
  arpeggio: ls.includes('arpeggio'),
  pentatonic: ls.includes('pentatonic'),
  scale: ls.includes('scale'),
  triad: ls.includes('triad')
});

const STANDARD = [40, 45, 50, 55, 59, 64];
const OPEN = [...STANDARD].reverse();

function resolve(
  layers: LayersOn,
  focusLetter: string | null,
  rootPc = 0,
  quality: 'major' | 'minor' = 'major',
  triad: ShapeTriad | null = null
) {
  const occurrences = cagedOccurrences(STANDARD, rootPc, quality, 24);
  const focusIndex =
    focusLetter === null ? null : occurrences.findIndex((o) => o.shape.id === focusLetter);
  return resolveCagedPositions({
    occurrences,
    focusIndex: focusIndex === -1 ? null : focusIndex,
    layers,
    rootPc,
    quality,
    openPitches: OPEN,
    fretCount: 24,
    triad
  });
}
/** C major A-shape triad on strings 3-2-1 (frets 5-5-3). */
function aShapeTriad(set = 3): ShapeTriad {
  const occ = must(cagedOccurrences(STANDARD, 0, 'major', 24).find((o) => o.shape.id === 'A'));
  return must(shapeTriad(occ, OPEN, spellTriad({ letter: 'C', accidental: 0 }, 'major'), set, 24));
}
const at = (r: readonly ResolvedPosition[], s: number, f: number) =>
  r.filter((p) => p.string === s && p.fret === f);

describe('layer switches', () => {
  it('CHORD_ONLY is frozen and chord-only', () => {
    expect(CHORD_ONLY).toEqual(on('chord'));
    expect(Object.isFrozen(CHORD_ONLY)).toBe(true);
  });

  it('isDrawable: pentatonic and scale need focus', () => {
    expect(isDrawable(on('chord'), 'chord', false)).toBe(true);
    expect(isDrawable(on('arpeggio'), 'arpeggio', false)).toBe(true);
    expect(isDrawable(on('scale'), 'scale', false)).toBe(false);
    expect(isDrawable(on('scale'), 'scale', true)).toBe(true);
    expect(isDrawable(on('chord'), 'scale', true)).toBe(false);
    expect(drawableCount(on('chord', 'scale', 'pentatonic'), false)).toBe(1);
    expect(drawableCount(on('chord', 'scale', 'pentatonic'), true)).toBe(3);
  });

  it('switchStates: last-layer and no-shapes', () => {
    const s = switchStates(on('chord'), false, true);
    expect(s.chord).toEqual({ on: true, disabled: 'last-layer' });
    expect(s.scale).toEqual({ on: false, disabled: null });
    const two = switchStates(on('chord', 'arpeggio'), false, true);
    expect(two.chord.disabled).toBeNull();
    expect(two.arpeggio.disabled).toBeNull();
    const none = switchStates(on('chord'), false, false);
    for (const l of LAYERS) expect(none[l].disabled).toBe('no-shapes');
    expect(none.chord.on).toBe(true);
  });

  it('a layer that is on but not drawable is not last-layer', () => {
    const s = switchStates(on('chord', 'scale'), false, true);
    expect(s.scale.disabled).toBeNull();
    expect(s.chord.disabled).toBe('last-layer');
  });

  it('toggleLayer: on never blocked; off blocked on last layer; same ref when disabled', () => {
    const start = on('chord');
    expect(toggleLayer(start, 'chord', false, true)).toBe(start);
    expect(toggleLayer(start, 'arpeggio', false, true)).toEqual(on('chord', 'arpeggio'));
    expect(toggleLayer(on('chord', 'arpeggio'), 'chord', false, true)).toEqual(on('arpeggio'));
    expect(toggleLayer(start, 'arpeggio', false, false)).toBe(start);
  });

  it('needsAutoFocus', () => {
    expect(needsAutoFocus(on('chord'), 'scale', null)).toBe(true);
    expect(needsAutoFocus(on('chord'), 'pentatonic', null)).toBe(true);
    expect(needsAutoFocus(on('chord'), 'arpeggio', null)).toBe(false);
    expect(needsAutoFocus(on('chord', 'scale'), 'scale', null)).toBe(false);
    expect(needsAutoFocus(on('chord'), 'scale', { letter: 'E', ordinal: 0 })).toBe(false);
  });

  it('ensureDrawable restores chord, keeps the other flags', () => {
    const r = ensureDrawable(on('scale', 'pentatonic'), false);
    expect(r.restoredChord).toBe(true);
    expect(r.layers).toEqual(on('chord', 'scale', 'pentatonic'));
    const keep = on('arpeggio');
    const same = ensureDrawable(keep, false);
    expect(same.restoredChord).toBe(false);
    expect(same.layers).toBe(keep);
  });
});

describe('resolveCagedPositions', () => {
  it('chord only, no focus: only chord markers, one per position', () => {
    const r = resolve(on('chord'), null);
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((p) => p.layer === 'chord')).toBe(true);
    expect(new Set(r.map((p) => `${p.string}:${p.fret}`)).size).toBe(r.length);
    expect(r.some((p) => p.string === 7)).toBe(false);
  });

  it('chord + arpeggio, no focus: every R 3 5; chord keys are chord, others arpeggio normal', () => {
    const r = resolve(on('chord', 'arpeggio'), null);
    const chordOnly = resolve(on('chord'), null);
    const chordKeys = new Set(chordOnly.map((p) => `${p.string}:${p.fret}`));
    for (const p of r) {
      expect(['R', '3', '5']).toContain(p.degree);
      if (chordKeys.has(`${p.string}:${p.fret}`)) expect(p.layer).toBe('chord');
      else {
        expect(p.layer).toBe('arpeggio');
        expect(p.emphasis).toBe('normal');
      }
    }
    expect(r.length).toBeGreaterThan(chordOnly.length);
  });

  it('chord + scale, focus E: s5 f7 is one scale highlighted marker (FR-018)', () => {
    const r = at(resolve(on('chord', 'scale'), 'E'), 5, 7);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ layer: 'scale', emphasis: 'highlighted', degree: '3' });
  });

  it('chord + arpeggio, focus E: s5 f7 is one arpeggio highlighted marker', () => {
    const r = at(resolve(on('chord', 'arpeggio'), 'E'), 5, 7);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ layer: 'arpeggio', emphasis: 'highlighted' });
  });

  it('chord + pentatonic + scale, focus E: extra only on F and B', () => {
    const r = resolve(on('chord', 'pentatonic', 'scale'), 'E');
    const extras = r
      .filter((p) => p.extra)
      .map((p) => `${p.string}:${p.fret}`)
      .sort();
    expect(extras).toEqual(['1:7', '3:10', '4:9', '5:8', '6:7'].sort());
    expect(r.every((p) => !p.extra || p.layer === 'pentatonic' || p.layer === 'scale')).toBe(true);
  });

  it('extra marks exactly 4 and 7 in major, 2 and b6 in minor (US5-1, US5-2)', () => {
    const major = resolve(on('chord', 'pentatonic', 'scale'), 'E');
    const extraMajor = new Set(major.filter((p) => p.extra).map((p) => p.degree));
    expect(extraMajor).toEqual(new Set(['4', '7']));
    // Every 4 and 7 in the region that is drawn as scale carries it.
    expect(major.filter((p) => p.layer === 'scale').every((p) => p.extra)).toBe(true);
    const minor = resolve(on('chord', 'pentatonic', 'scale'), 'E', 9, 'minor');
    const extraMinor = new Set(minor.filter((p) => p.extra).map((p) => p.degree));
    expect(extraMinor).toEqual(new Set(['2', 'b6']));
    expect(minor.filter((p) => p.degree === '4' || p.degree === 'b7').some((p) => p.extra)).toBe(
      false
    );
  });

  it('never marks chord or arpeggio positions (US5-4)', () => {
    const r = resolve(on('chord', 'arpeggio', 'pentatonic', 'scale'), 'E');
    expect(r.some((p) => p.extra)).toBe(true);
    expect(
      r.filter((p) => p.layer === 'chord' || p.layer === 'arpeggio').some((p) => p.extra)
    ).toBe(false);
  });

  it('no extra unless both pentatonic and scale are on', () => {
    expect(resolve(on('chord', 'scale'), 'E').some((p) => p.extra)).toBe(false);
    expect(resolve(on('chord', 'pentatonic'), 'E').some((p) => p.extra)).toBe(false);
  });

  it('scale only (chord off): no chord layer; chord positions become scale', () => {
    const r = resolve(on('scale'), 'E');
    expect(r.some((p) => p.layer === 'chord')).toBe(false);
    expect(at(r, 6, 8)[0]).toMatchObject({ layer: 'scale', degree: 'R' });
  });

  it('arpeggio only, no focus: chord positions are arpeggio; nothing dimmed', () => {
    const r = resolve(on('arpeggio'), null);
    expect(r.every((p) => p.layer === 'arpeggio')).toBe(true);
    expect(r.some((p) => p.emphasis === 'dimmed')).toBe(false);
  });

  it('chord + pentatonic, no focus: no pentatonic positions (FR-012)', () => {
    const r = resolve(on('chord', 'pentatonic'), null);
    expect(r.some((p) => p.layer === 'pentatonic')).toBe(false);
  });

  it('focus: non-focused chord shapes are dimmed, focused ones highlighted', () => {
    const r = resolve(on('chord'), 'E');
    expect(r.some((p) => p.emphasis === 'highlighted')).toBe(true);
    expect(r.some((p) => p.emphasis === 'dimmed')).toBe(true);
  });

  it('layerCounts counts per layer', () => {
    const r = resolve(on('chord', 'arpeggio', 'pentatonic', 'scale'), 'E');
    const c = layerCounts(r);
    expect(c.chord + c.arpeggio + c.pentatonic + c.scale).toBe(r.length);
    expect(c.scale).toBeGreaterThan(0);
  });

  it('revealOrder: new keys only, pitch ascending, ties higher string first', () => {
    const prev = resolve(on('chord'), 'E');
    const next = resolve(on('chord', 'scale'), 'E');
    const order = revealOrder(prev, next);
    const prevKeys = new Set(prev.map((p) => `${p.string}:${p.fret}`));
    expect(order.every((k) => !prevKeys.has(k))).toBe(true);
    expect(new Set(order).size).toBe(order.length);
    const pitch = new Map(next.map((p) => [`${p.string}:${p.fret}`, p]));
    for (let i = 1; i < order.length; i++) {
      const a = must(pitch.get(order[i - 1]));
      const b = must(pitch.get(order[i]));
      expect(a.pitch < b.pitch || (a.pitch === b.pitch && a.string > b.string)).toBe(true);
    }
    expect(revealOrder(next, next)).toEqual([]);
  });

  it('altered tuning (Drop D, D major, E): s6 notes exist for every layer; chord on s6 only for G/E', () => {
    const drop = [38, 45, 50, 55, 59, 64];
    const occurrences = cagedOccurrences(drop, 2, 'major', 24);
    const idx = occurrences.findIndex((o) => o.shape.id === 'E' && o.region.start === 9);
    const r = resolveCagedPositions({
      occurrences,
      focusIndex: idx,
      layers: on('chord', 'pentatonic', 'scale'),
      rootPc: 2,
      quality: 'major',
      openPitches: [...drop].reverse(),
      fretCount: 24,
      triad: null
    });
    expect(at(r, 6, 12)[0].layer).toBe('chord');
    expect(at(r, 6, 9)[0].layer).toBe('pentatonic');
    expect(at(r, 6, 11)[0].layer).toBe('scale');
  });
});

describe('invariants I-1 … I-7', () => {
  const arbLayers = fc.record({
    chord: fc.boolean(),
    arpeggio: fc.boolean(),
    pentatonic: fc.boolean(),
    scale: fc.boolean(),
    triad: fc.constant(false)
  });

  it('I-1…I-6 hold for random layers, focus, key, quality', () => {
    fc.assert(
      fc.property(
        arbLayers,
        fc.integer({ min: 0, max: 11 }),
        fc.constantFrom<'major' | 'minor'>('major', 'minor'),
        fc.option(fc.integer({ min: 0, max: 8 }), { nil: null }),
        (layers, rootPc, quality, f) => {
          const occurrences = cagedOccurrences(STANDARD, rootPc, quality, 24);
          const focusIndex = f === null || occurrences.length === 0 ? null : f % occurrences.length;
          const r = resolveCagedPositions({
            occurrences,
            focusIndex,
            layers,
            rootPc,
            quality,
            openPitches: OPEN,
            fretCount: 24,
            triad: null
          });
          // I-1
          expect(new Set(r.map((p) => `${p.string}:${p.fret}`)).size).toBe(r.length);
          // I-2
          if (!layers.chord) expect(r.some((p) => p.layer === 'chord')).toBe(false);
          // I-3
          if (focusIndex === null)
            expect(r.some((p) => p.layer === 'pentatonic' || p.layer === 'scale')).toBe(false);
          // I-4
          if (focusIndex !== null) {
            const reg = occurrences[focusIndex].region;
            for (const p of r)
              if (p.layer !== 'chord') {
                expect(p.fret).toBeGreaterThanOrEqual(reg.start);
                expect(p.fret).toBeLessThanOrEqual(reg.end);
                expect(p.emphasis).toBe('highlighted');
              }
          }
          // I-5
          for (const p of r)
            if (p.extra)
              expect(
                (p.layer === 'pentatonic' || p.layer === 'scale') &&
                  layers.pentatonic &&
                  layers.scale
              ).toBe(true);
          // I-6
          expect(r.some((p) => p.layer === 'chord' && p.string === 7)).toBe(false);
        }
      )
    );
  });

  it('I-7: toggle and focus sequence then ensureDrawable leaves ≥ 1 drawable', () => {
    const arbStep = fc.oneof(
      fc.record({ kind: fc.constant('toggle' as const), layer: fc.constantFrom(...LAYERS) }),
      fc.record({ kind: fc.constant('focus' as const), has: fc.boolean() })
    );
    fc.assert(
      fc.property(fc.array(arbStep, { maxLength: 30 }), (steps) => {
        let layers: LayersOn = CHORD_ONLY;
        let hasFocus = false;
        for (const s of steps) {
          if (s.kind === 'focus') {
            hasFocus = s.has;
            layers = ensureDrawable(layers, hasFocus).layers;
          } else layers = toggleLayer(layers, s.layer, hasFocus, true);
        }
        const final = ensureDrawable(layers, hasFocus);
        expect(drawableCount(final.layers, hasFocus)).toBeGreaterThanOrEqual(1);
      })
    );
  });
});

describe('arpeggio layer (017 US3)', () => {
  const pcOf = (p: ResolvedPosition) => ((p.pitch % 12) + 12) % 12;
  const chordKeys = (occs: ReturnType<typeof cagedOccurrences>) =>
    new Set(occs.flatMap((o) => o.notes.map((n) => `${n.string}:${n.fret}`)));

  it('no focus: every triad note in each region is drawn once; chord wins, else arpeggio', () => {
    const occs = cagedOccurrences(STANDARD, 0, 'major', 24);
    const r = resolve(on('chord', 'arpeggio'), null);
    const keys = r.map((p) => `${p.string}:${p.fret}`);
    expect(new Set(keys).size).toBe(keys.length);
    const chord = chordKeys(occs);
    for (const p of r) {
      expect([0, 4, 7]).toContain(pcOf(p));
      expect(p.layer).toBe(chord.has(`${p.string}:${p.fret}`) ? 'chord' : 'arpeggio');
      expect(p.emphasis).toBe('normal');
    }
    expect(r.some((p) => p.layer === 'arpeggio')).toBe(true);
    // Every triad note inside any occurrence region is present.
    for (const o of occs)
      OPEN.forEach((open, i) => {
        for (let f = Math.max(0, o.region.start); f <= Math.min(24, o.region.end); f++)
          if ([0, 4, 7].includes((open + f) % 12)) expect(keys).toContain(`${i + 1}:${f}`);
      });
  });

  it('A minor: arpeggio notes are R, b3 and 5 only', () => {
    const r = resolve(on('chord', 'arpeggio'), null, 9, 'minor');
    expect(r.length).toBeGreaterThan(0);
    for (const p of r) {
      expect(['R', 'b3', '5']).toContain(p.degree);
      expect([9, 0, 4]).toContain(pcOf(p));
    }
  });

  it('with focus: arpeggio notes lie only in the focused region', () => {
    const occs = cagedOccurrences(STANDARD, 0, 'major', 24);
    const e = must(occs.find((o) => o.shape.id === 'E'));
    const r = resolve(on('chord', 'arpeggio'), 'E');
    const lit = r.filter((p) => p.layer === 'arpeggio');
    expect(lit.length).toBeGreaterThan(0);
    for (const p of lit) {
      expect(p.fret).toBeGreaterThanOrEqual(e.region.start);
      expect(p.fret).toBeLessThanOrEqual(e.region.end);
      expect(p.emphasis).toBe('highlighted');
    }
  });

  it('Chord off: chord positions become arpeggio and nothing is dimmed', () => {
    const occs = cagedOccurrences(STANDARD, 0, 'major', 24);
    const chord = chordKeys(occs);
    for (const focus of [null, 'E']) {
      const r = resolve(on('arpeggio'), focus);
      expect(r.length).toBeGreaterThan(0);
      for (const p of r) {
        expect(p.layer).toBe('arpeggio');
        expect(p.emphasis).not.toBe('dimmed');
      }
      if (focus === null)
        for (const k of chord) expect(r.map((p) => `${p.string}:${p.fret}`)).toContain(k);
    }
  });
});

describe('triad layer (018 US1)', () => {
  const triad = aShapeTriad();
  const triads = (r: readonly ResolvedPosition[]) => r.filter((p) => p.layer === 'triad');

  it('chord + triad: s3 f5, s2 f5, s1 f3 are triad, each key once', () => {
    const r = resolve(on('chord', 'triad'), 'A', 0, 'major', triad);
    expect(
      triads(r)
        .map((p) => `${p.string}:${p.fret}`)
        .sort()
    ).toEqual(['1:3', '2:5', '3:5']);
    for (const [s, f] of [
      [3, 5],
      [2, 5],
      [1, 3]
    ])
      expect(at(r, s, f)).toHaveLength(1);
    expect(triads(r).every((p) => p.emphasis === 'highlighted')).toBe(true);
    expect(
      triads(r)
        .map((p) => p.degree)
        .sort()
    ).toEqual(['3', '5', 'R']);
  });

  it('triad only: three triad positions, no chord anywhere', () => {
    const r = resolve(on('triad'), 'A', 0, 'major', triad);
    expect(triads(r)).toHaveLength(3);
    expect(r.some((p) => p.layer === 'chord')).toBe(false);
  });

  it('I-10: arpeggio on then off gives identical triad positions', () => {
    const withArp = triads(resolve(on('chord', 'arpeggio', 'triad'), 'A', 0, 'major', triad));
    const without = triads(resolve(on('chord', 'triad'), 'A', 0, 'major', triad));
    expect(withArp).toEqual(without);
  });

  it('focus cleared: zero triad, chord as before', () => {
    const r = resolve(on('chord', 'triad'), null, 0, 'major', triad);
    expect(triads(r)).toHaveLength(0);
    expect(r).toEqual(resolve(on('chord'), null));
  });

  it('triad null: zero triad, other layers unchanged', () => {
    const r = resolve(on('chord', 'triad'), 'A', 0, 'major', null);
    expect(triads(r)).toHaveLength(0);
    expect(r).toEqual(resolve(on('chord'), 'A'));
  });

  it('triad off: the triad is not drawn even when supplied', () => {
    expect(triads(resolve(on('chord'), 'A', 0, 'major', triad))).toHaveLength(0);
  });

  it('all five layers: one entry per key; triad > chord > arpeggio > pentatonic > scale', () => {
    const r = resolve(
      on('triad', 'chord', 'arpeggio', 'pentatonic', 'scale'),
      'A',
      0,
      'major',
      triad
    );
    const keys = r.map((p) => `${p.string}:${p.fret}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(triads(r)).toHaveLength(3);
    for (const p of triads(r)) expect(at(r, p.string, p.fret)).toHaveLength(1);
  });

  it('I-8, I-9: exactly three triad positions, never another layer on the same key', () => {
    const r = resolve(on('triad', 'chord', 'scale'), 'A', 0, 'major', triad);
    const tk = new Set(triads(r).map((p) => `${p.string}:${p.fret}`));
    expect(tk.size).toBe(3);
    expect(r.filter((p) => tk.has(`${p.string}:${p.fret}`))).toHaveLength(3);
  });

  it('layerCounts has triad', () => {
    const r = resolve(on('chord', 'triad'), 'A', 0, 'major', triad);
    expect(layerCounts(r).triad).toBe(3);
    expect(layerCounts(resolve(on('chord'), null)).triad).toBe(0);
  });

  it('switches: triad drawable only with focus; auto-focus; last-layer', () => {
    expect(isDrawable(on('chord', 'triad'), 'triad', false)).toBe(false);
    expect(isDrawable(on('chord', 'triad'), 'triad', true)).toBe(true);
    expect(needsAutoFocus(on('chord'), 'triad', null)).toBe(true);
    expect(needsAutoFocus(on('chord', 'triad'), 'triad', null)).toBe(false);
    expect(needsAutoFocus(on('chord'), 'triad', { letter: 'A', ordinal: 0 })).toBe(false);
    expect(switchStates(on('chord'), false, true).triad).toEqual({ on: false, disabled: null });
    expect(switchStates(on('triad'), true, true).triad.disabled).toBe('last-layer');
    expect(switchStates(on('chord'), false, false).triad.disabled).toBe('no-shapes');
  });

  it('clearing focus with only triad on restores chord, triad stays on', () => {
    const r = ensureDrawable(on('triad'), false);
    expect(r.restoredChord).toBe(true);
    expect(r.layers).toEqual(on('chord', 'triad'));
  });
});

describe('triad layer without focus (018 US4)', () => {
  it('toggle sequence: on, focus cleared, refocus keeps the switch on and draws only with focus', () => {
    const layers = toggleLayer(on('chord'), 'triad', false, true);
    expect(layers.triad).toBe(true);
    // Focus cleared with Chord still on: nothing to restore, Triad stays on but undrawn.
    const cleared = ensureDrawable(layers, false);
    expect(cleared.restoredChord).toBe(false);
    expect(cleared.layers.triad).toBe(true);
    expect(isDrawable(cleared.layers, 'triad', false)).toBe(false);
    expect(isDrawable(cleared.layers, 'triad', true)).toBe(true);
    expect(switchStates(cleared.layers, true, true).triad).toEqual({ on: true, disabled: null });
  });

  it('only Triad on and focus cleared: Chord restored, Triad stays on', () => {
    const r = ensureDrawable(on('triad'), false);
    expect(r).toEqual({ layers: on('chord', 'triad'), restoredChord: true });
  });

  it('Triad is the last drawable layer: switch disabled last-layer; with Chord also on it is not', () => {
    expect(switchStates(on('triad'), true, true).triad.disabled).toBe('last-layer');
    expect(switchStates(on('chord', 'triad'), true, true).triad.disabled).toBeNull();
  });
});
