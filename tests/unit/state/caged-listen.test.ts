import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { must } from '../must';
import {
  BLOCK_DELAY_MS,
  LISTEN_BPM,
  RING_MS,
  SHAPE_GAP_MS,
  STRUM_GAP_MS,
  TEMPO_BPM,
  type Tempo
} from '../../../src/lib/state/listen';
import {
  LISTEN_ORDER,
  buildCagedListen,
  chordPositions,
  dedupeUnisons,
  listenRegion,
  listenSource,
  melodicSteps,
  strumEvents,
  type CagedListenInput,
  type CagedListenPlan,
  type RegionNote
} from '../../../src/lib/state/caged-listen';
import { resolveCagedPositions } from '../../../src/lib/state/caged-layers';
import {
  initialCagedView,
  type CagedViewState,
  type LayersOn
} from '../../../src/lib/state/caged-view';
import {
  cagedOccurrences,
  type CagedQuality,
  type CagedShapeId,
  type ShapeOccurrence
} from '../../../src/lib/theory/caged';
import { inLayer, layerNotes } from '../../../src/lib/theory/caged-layers';
import { shapeTriad } from '../../../src/lib/theory/caged-triad';
import type { Pitch } from '../../../src/lib/theory/pitch';
import { rootSpellings, spellTriad } from '../../../src/lib/theory/triad';

const NONE: LayersOn = {
  chord: false,
  arpeggio: false,
  pentatonic: false,
  scale: false,
  triad: false
};
const only = (...on: (keyof LayersOn)[]): LayersOn => ({
  ...NONE,
  ...Object.fromEntries(on.map((k) => [k, true]))
});

/** Strings 6 → 1, standard tuning E2 … E4. */
const STANDARD_SIX: readonly Pitch[] = [40, 45, 50, 55, 59, 64];
const DROP_D: readonly Pitch[] = [38, 45, 50, 55, 59, 64];
const HALF_DOWN: readonly Pitch[] = STANDARD_SIX.map((p) => p - 1);

interface Setup {
  rootPc?: number;
  quality?: CagedQuality;
  layers: LayersOn;
  /** Shape letter to focus; null = See all. */
  focus?: CagedShapeId | null;
  /** Index among occurrences of that letter. */
  ordinal?: number;
  six?: readonly Pitch[];
  /** Open pitch of a seventh (lowest) string. */
  seven?: number | null;
  frets?: number;
  tempo?: Tempo;
  triadSet?: number;
}

function make(s: Setup): CagedListenInput & { open: readonly Pitch[]; frets: number } {
  const rootPc = s.rootPc ?? 0;
  const quality = s.quality ?? 'major';
  const six = s.six ?? STANDARD_SIX;
  const frets = s.frets ?? 22;
  const open = [...(s.seven == null ? six : [s.seven, ...six])].reverse();
  const occurrences = [...cagedOccurrences(six, rootPc, quality, frets)].sort(
    (a, b) => a.start - b.start
  );
  const letter = s.focus ?? null;
  const matches = occurrences
    .map((o, i) => ({ o, i }))
    .filter(({ o }) => letter !== null && o.shape.id === letter);
  const focusIndex = letter === null ? null : (matches[s.ordinal ?? 0]?.i ?? null);
  const base = initialCagedView();
  const view: CagedViewState = {
    ...base,
    rootPc,
    quality,
    layers: s.layers,
    focus: focusIndex === null || letter === null ? null : { letter, ordinal: s.ordinal ?? 0 }
  };
  const triad =
    focusIndex !== null && s.layers.triad
      ? shapeTriad(
          occurrences[focusIndex],
          open,
          spellTriad(rootSpellings(rootPc)[0], quality),
          s.triadSet ?? 3,
          frets
        )
      : null;
  const positions = resolveCagedPositions({
    occurrences,
    focusIndex,
    layers: s.layers,
    rootPc,
    quality,
    openPitches: open,
    fretCount: frets,
    triad
  });
  return {
    view,
    occurrences,
    focusIndex,
    positions,
    triad,
    openPitches: open,
    tempo: s.tempo ?? 'medium',
    open,
    frets
  };
}

const pitchOf = (open: readonly Pitch[], p: { string: number; fret: number }): Pitch =>
  open[p.string - 1] + p.fret;
const flat = (steps: readonly unknown[]) => steps.flat() as { string: number; fret: number }[];

function planOf(s: Setup): { plan: CagedListenPlan; input: ReturnType<typeof make> } {
  const input = make(s);
  return { plan: buildCagedListen(input), input };
}
function sequence(p: CagedListenPlan) {
  if (p.kind !== 'sequence') throw new Error(`expected sequence, got ${p.kind}`);
  return p;
}
function timeline(p: CagedListenPlan) {
  if (p.kind !== 'timeline') throw new Error(`expected timeline, got ${p.kind}`);
  return p;
}

describe('LISTEN_ORDER', () => {
  it('is widest first', () => {
    expect(LISTEN_ORDER).toEqual(['scale', 'pentatonic', 'arpeggio', 'triad', 'chord']);
  });
});

describe('listenSource', () => {
  it('no focus gives all-chords, whatever the layers', () => {
    expect(listenSource(make({ layers: only('scale') }))).toEqual({ kind: 'all-chords' });
    expect(listenSource(make({ layers: only('chord') }))).toEqual({ kind: 'all-chords' });
  });

  it.each([
    [only('chord'), 'chord'],
    [only('chord', 'triad'), 'triad'],
    [only('chord', 'triad', 'arpeggio'), 'arpeggio'],
    [only('chord', 'arpeggio', 'pentatonic'), 'pentatonic'],
    [only('pentatonic', 'scale'), 'scale'],
    [only('chord', 'triad', 'arpeggio', 'pentatonic', 'scale'), 'scale']
  ] as const)('focused E shape, layers %j plays the widest: %s', (layers, layer) => {
    expect(listenSource(make({ layers, focus: 'E' }))).toEqual({
      kind: 'shape',
      layer,
      letter: 'E'
    });
  });

  it('Triad on with no triad available falls back to chord', () => {
    const input = { ...make({ layers: only('triad'), focus: 'E' }), triad: null };
    expect(listenSource(input)).toEqual({ kind: 'shape', layer: 'chord', letter: 'E' });
  });

  it('chord plays even when the Chord switch is off', () => {
    const input = make({ layers: NONE, focus: 'C' });
    expect(listenSource(input)).toEqual({ kind: 'shape', layer: 'chord', letter: 'C' });
  });
});

describe('listenRegion and the drawing (P-2)', () => {
  const keys = (n: readonly { string: number; fret: number }[]) =>
    new Set(n.map((x) => `${x.string}:${x.fret}`));

  it('equals the drawn scale notes for G major, A shape', () => {
    const input = make({ rootPc: 7, layers: only('chord', 'scale'), focus: 'A' });
    const occ = must(input.occurrences[input.focusIndex ?? -1]);
    const region = listenRegion(input.positions, 'scale', 'major');
    const expected = layerNotes(occ, input.open, 7, 'major', input.frets).filter((n) =>
      inLayer(n.degree, 'scale', 'major')
    );
    expect(keys(region)).toEqual(keys(expected));
    expect(region.length).toBeGreaterThan(10);
  });

  it('property: region equals layerNotes filtered by the layer, before dedupe', () => {
    const arb = fc.record({
      rootPc: fc.integer({ min: 0, max: 11 }),
      quality: fc.constantFrom<CagedQuality>('major', 'minor'),
      letter: fc.constantFrom<CagedShapeId>('C', 'A', 'G', 'E', 'D'),
      layer: fc.constantFrom<'scale' | 'pentatonic' | 'arpeggio'>(
        'scale',
        'pentatonic',
        'arpeggio'
      ),
      chord: fc.boolean(),
      frets: fc.constantFrom(12, 15, 22, 24),
      base: fc.integer({ min: 36, max: 44 }),
      seven: fc.option(fc.integer({ min: 28, max: 38 }), { nil: null }),
      transpose: fc.integer({ min: -2, max: 2 })
    });
    fc.assert(
      fc.property(arb, (c) => {
        const six: Pitch[] = [c.base + c.transpose];
        for (const step of [5, 5, 5, 4, 5]) six.push(six[six.length - 1] + step);
        const layers = { ...only(c.layer), chord: c.chord };
        const input = make({ ...c, six, layers, focus: c.letter });
        if (input.focusIndex === null) return;
        const occ = must(input.occurrences[input.focusIndex]);
        const region = listenRegion(input.positions, c.layer, c.quality);
        const expected = layerNotes(occ, input.open, c.rootPc, c.quality, c.frets).filter((n) =>
          inLayer(n.degree, c.layer, c.quality)
        );
        expect(keys(region)).toEqual(keys(expected));
      }),
      { numRuns: 200 }
    );
  });
});

describe('dedupeUnisons (P-3)', () => {
  const n = (string: number, fret: number, pitch: number, degree = '3'): RegionNote => ({
    string,
    fret,
    pitch,
    degree: degree as RegionNote['degree']
  });

  it('keeps the thicker string of a unison', () => {
    const out = dedupeUnisons([n(4, 7, 57), n(3, 2, 57), n(5, 0, 45), n(2, 1, 60)]);
    expect(out.map((p) => [p.string, p.fret])).toEqual([
      [5, 0],
      [4, 7],
      [2, 1]
    ]);
  });

  it('keeps the first position given a pitch-sorted, thick-first region', () => {
    const out = dedupeUnisons([n(5, 0, 45), n(4, 7, 57), n(3, 2, 57)]);
    expect(out.map((p) => p.string)).toEqual([5, 4]);
  });

  it('returns pitches strictly ascending', () => {
    const out = dedupeUnisons([n(2, 1, 60), n(3, 2, 57), n(4, 7, 57), n(5, 0, 45)]);
    expect(out.map((p) => p.pitch)).toEqual([45, 57, 60]);
  });
});

describe('melodicSteps', () => {
  const r = (pitch: number, degree: RegionNote['degree'], string = 1): RegionNote => ({
    string,
    fret: pitch,
    pitch,
    degree
  });
  const region = [r(40, '3'), r(43, 'R'), r(47, '5'), r(50, 'R'), r(52, '3')];

  it('arpeggio goes up then back, top once: 2n−1 steps (P-1)', () => {
    const steps = melodicSteps(region, 'arpeggio');
    expect(steps.map((s) => (s as { fret: number }).fret)).toEqual([
      40, 43, 47, 50, 52, 50, 47, 43, 40
    ]);
  });

  it('pentatonic and scale start and end at the lowest root (P-4)', () => {
    for (const layer of ['pentatonic', 'scale'] as const) {
      const steps = melodicSteps(region, layer);
      expect(steps.map((s) => (s as { fret: number }).fret)).toEqual([43, 47, 50, 52, 50, 47, 43]);
    }
  });

  it('a region with no root starts at its lowest note', () => {
    const steps = melodicSteps([r(40, '3'), r(47, '5'), r(52, '3')], 'scale');
    expect(steps.map((s) => (s as { fret: number }).fret)).toEqual([40, 47, 52, 47, 40]);
  });

  it('a single note plays once; an empty region plays nothing', () => {
    expect(melodicSteps([r(40, 'R')], 'arpeggio')).toHaveLength(1);
    expect(melodicSteps([r(40, 'R')], 'scale')).toHaveLength(1);
    expect(melodicSteps([], 'scale')).toEqual([]);
  });

  it('steps are plain positions', () => {
    expect(melodicSteps([r(40, 'R', 6)], 'scale')).toEqual([{ string: 6, fret: 40 }]);
  });
});

describe('chordPositions (P-5)', () => {
  const occOf = (six: readonly Pitch[], letter: CagedShapeId, rootPc = 0) =>
    must(
      cagedOccurrences(six, rootPc, 'major', 22)
        .filter((o) => o.shape.id === letter)
        .sort((a, b) => a.start - b.start)[0]
    );
  const open = (six: readonly Pitch[]) => [...six].reverse();

  it('C shape in C: pitches ascend from C3', () => {
    const out = chordPositions(occOf(STANDARD_SIX, 'C'), open(STANDARD_SIX));
    expect(out.map((p) => p.pitch)).toEqual([48, 52, 55, 60, 64]);
    expect(out.map((p) => p.string)).toEqual([5, 4, 3, 2, 1]);
  });

  it('never includes string 7', () => {
    const seven = [35, ...STANDARD_SIX];
    const occ = occOf(STANDARD_SIX, 'E', 4);
    const withSeven: ShapeOccurrence = {
      ...occ,
      notes: [...occ.notes, { string: 7, fret: 0, degree: 'R' }]
    };
    const out = chordPositions(withSeven, open(seven));
    expect(out.every((p) => p.string <= 6)).toBe(true);
  });

  it('skips string 6 when it is altered (Drop D), keeps it otherwise', () => {
    const drop = cagedOccurrences(DROP_D, 4, 'major', 22).filter((o) => o.shape.id === 'E');
    expect(drop.length).toBeGreaterThan(0);
    for (const occ of drop) {
      expect(occ.alteredString).toBe(true);
      expect(chordPositions(occ, open(DROP_D)).some((p) => p.string === 6)).toBe(false);
    }
    const std = chordPositions(occOf(STANDARD_SIX, 'E', 4), open(STANDARD_SIX));
    expect(std.some((p) => p.string === 6)).toBe(true);
  });

  it('ties go to the higher string number', () => {
    const occ: ShapeOccurrence = {
      ...occOf(STANDARD_SIX, 'C'),
      notes: [
        { string: 3, fret: 5, degree: 'R' }, // G string +5 = C4 (60)
        { string: 4, fret: 10, degree: 'R' } // D string +10 = C4 (60)
      ]
    };
    const out = chordPositions(occ, open(STANDARD_SIX));
    expect(out.map((p) => p.string)).toEqual([4, 3]);
  });
});

describe('strumEvents', () => {
  const c = [
    { string: 5, fret: 3, pitch: 48 },
    { string: 4, fret: 2, pitch: 52 },
    { string: 3, fret: 0, pitch: 55 }
  ];

  it('strums at 250 ms steps, then the block 500 ms after the last strum', () => {
    const events = strumEvents(c, 1000);
    expect(events).toHaveLength(4);
    expect(events.slice(0, 3).map((e) => e.onsetMs)).toEqual([
      1000,
      1000 + STRUM_GAP_MS,
      1000 + 2 * STRUM_GAP_MS
    ]);
    expect(events.every((e) => e.durationMs === RING_MS)).toBe(true);
    expect(events.slice(0, 3).map((e) => e.positions)).toEqual(
      c.map((p) => [{ string: p.string, fret: p.fret }])
    );
    expect(events[3].onsetMs).toBe(1000 + STRUM_GAP_MS * 2 + BLOCK_DELAY_MS);
    expect(events[3].positions).toEqual(c.map((p) => ({ string: p.string, fret: p.fret })));
  });

  it('is empty for an empty chord', () => {
    expect(strumEvents([], 0)).toEqual([]);
  });
});

describe('buildCagedListen', () => {
  it('returns none when there is no occurrence (non-compatible tuning or no fit)', () => {
    const input = make({ layers: only('chord'), six: [40, 45, 50, 55, 60, 65] });
    expect(input.occurrences).toHaveLength(0);
    expect(buildCagedListen(input)).toEqual({ kind: 'none' });
    expect(buildCagedListen({ ...input, focusIndex: null })).toEqual({ kind: 'none' });
  });

  it('chord only: strum + block timeline of the focused shape', () => {
    const { plan, input } = planOf({ layers: only('chord'), focus: 'C' });
    const t = timeline(plan);
    expect(t.source).toEqual({ kind: 'shape', layer: 'chord', letter: 'C' });
    const occ = must(input.occurrences[input.focusIndex ?? -1]);
    const k = chordPositions(occ, input.open).length;
    expect(t.events).toHaveLength(k + 1);
    expect(t.events.map((e) => e.onsetMs).slice(0, k)).toEqual(
      Array.from({ length: k }, (_, i) => i * STRUM_GAP_MS)
    );
    expect(t.events[k].onsetMs).toBe((k - 1) * STRUM_GAP_MS + BLOCK_DELAY_MS);
  });

  it('chord plays with the Chord switch off', () => {
    const t = timeline(planOf({ layers: NONE, focus: 'C' }).plan);
    expect(t.source).toEqual({ kind: 'shape', layer: 'chord', letter: 'C' });
  });

  it('triad: [low, mid, high, [low, mid, high]] at LISTEN_BPM, whatever the tempo', () => {
    const { plan, input } = planOf({
      layers: only('chord', 'triad'),
      focus: 'E',
      tempo: 'fast'
    });
    const s = sequence(plan);
    expect(s.bpm).toBe(LISTEN_BPM);
    expect(s.steps).toHaveLength(4);
    const t = must(input.triad);
    const [low, mid, high] = t.frets.map((fret, i) => ({ string: t.set - i, fret }));
    expect(s.steps).toEqual([low, mid, high, [low, mid, high]]);
    expect(s.source).toEqual({ kind: 'shape', layer: 'triad', letter: 'E' });
  });

  it.each(['slow', 'medium', 'fast'] as const)('arpeggio bpm follows tempo %s', (tempo) => {
    const s = sequence(planOf({ layers: only('arpeggio'), focus: 'A', tempo }).plan);
    expect(s.bpm).toBe(TEMPO_BPM[tempo]);
  });

  it('arpeggio: up to the top once and back, first = last pitch (P-1)', () => {
    const { plan, input } = planOf({ rootPc: 10, layers: only('arpeggio'), focus: 'E' });
    const pitches = flat(sequence(plan).steps).map((p) => pitchOf(input.open, p));
    const n = (pitches.length + 1) / 2;
    expect(Number.isInteger(n)).toBe(true);
    const top = Math.max(...pitches);
    expect(pitches.filter((p) => p === top)).toHaveLength(1);
    expect(pitches[0]).toBe(pitches[pitches.length - 1]);
    for (let i = 0; i < n - 1; i++) expect(pitches[i]).toBeLessThan(pitches[i + 1]);
    for (let i = n - 1; i < pitches.length - 1; i++)
      expect(pitches[i]).toBeGreaterThan(pitches[i + 1]);
  });

  it('scale (G major, E shape) starts and ends on the lowest root; nothing sounds below it (P-4)', () => {
    const { plan, input } = planOf({ rootPc: 7, layers: only('scale'), focus: 'E' });
    const steps = flat(sequence(plan).steps);
    const pitches = steps.map((p) => pitchOf(input.open, p));
    const rootPitches = input.positions.filter((p) => p.degree === 'R').map((p) => p.pitch);
    const lowestRoot = Math.min(...rootPitches);
    expect(pitches[0]).toBe(lowestRoot);
    expect(pitches[pitches.length - 1]).toBe(lowestRoot);
    expect(Math.min(...pitches)).toBe(lowestRoot);
  });

  it('pentatonic + scale on plays the scale', () => {
    const s = sequence(planOf({ layers: only('pentatonic', 'scale'), focus: 'A' }).plan);
    expect(s.source).toEqual({ kind: 'shape', layer: 'scale', letter: 'A' });
  });

  it('no focus plays every shape nut → body: strum + block, next shape 1500 ms after the block', () => {
    const { plan, input } = planOf({ layers: only('chord') });
    const t = timeline(plan);
    expect(t.source).toEqual({ kind: 'all-chords' });
    const sizes = input.occurrences.map((o) => chordPositions(o, input.open).length);
    const total = sizes.reduce((a, k) => a + k + 1, 0);
    expect(t.events).toHaveLength(total);
    let cursor = 0;
    let t0 = 0;
    for (const k of sizes) {
      const block = t.events[cursor + k];
      expect(t.events[cursor].onsetMs).toBe(t0);
      expect(block.onsetMs).toBe(t0 + (k - 1) * STRUM_GAP_MS + BLOCK_DELAY_MS);
      t0 = block.onsetMs + SHAPE_GAP_MS;
      cursor += k + 1;
    }
  });

  describe('tables: keys C, G, A♯ × shapes E, A, C', () => {
    const cases = [0, 7, 10].flatMap((rootPc) =>
      (['E', 'A', 'C'] as const).map((letter) => [rootPc, letter] as const)
    );
    it.each(cases)('root %i, %s shape: every layer plays only drawn notes', (rootPc, letter) => {
      for (const layer of ['arpeggio', 'pentatonic', 'scale'] as const) {
        const input = make({ rootPc, layers: only(layer), focus: letter });
        if (input.focusIndex === null) continue;
        const plan = buildCagedListen(input);
        const drawn = new Set(input.positions.map((p) => `${p.string}:${p.fret}`));
        for (const p of flat(sequence(plan).steps))
          expect(drawn.has(`${p.string}:${p.fret}`)).toBe(true);
      }
    });
  });

  describe('open position and special tunings (P-6)', () => {
    it('C shape in C reaches the open strings', () => {
      const { plan } = planOf({ layers: only('scale'), focus: 'C', frets: 22 });
      expect(flat(sequence(plan).steps).some((p) => p.fret === 0)).toBe(true);
    });

    it.each([
      ['Drop D', DROP_D, null],
      ['Half step down', HALF_DOWN, null],
      ['7-string', STANDARD_SIX, 35],
      ['Half step down 7-string', HALF_DOWN, 34]
    ] as const)('%s: planned pitches are open pitch + fret', (_name, six, seven) => {
      for (const layer of ['arpeggio', 'scale'] as const) {
        const input = make({ rootPc: 4, layers: only(layer), focus: 'E', six, seven });
        if (input.focusIndex === null) continue;
        const steps = flat(sequence(buildCagedListen(input)).steps);
        const expected = new Map(input.positions.map((p) => [`${p.string}:${p.fret}`, p.pitch]));
        for (const p of steps)
          expect(pitchOf(input.open, p)).toBe(expected.get(`${p.string}:${p.fret}`));
      }
    });

    it('temporary standard view: pitches come from the passed (standard) open pitches', () => {
      // The caller passes the effective instrument; with standard pitches the low E is 40.
      const input = make({ rootPc: 4, layers: only('scale'), focus: 'E', six: STANDARD_SIX });
      const steps = flat(sequence(buildCagedListen(input)).steps);
      expect(Math.min(...steps.map((p) => pitchOf(input.open, p)))).toBe(40);
    });
  });

  it('property: chord strums of every plan sit on drawn chord positions, never string 7 (P-5, P-6)', () => {
    const arb = fc.record({
      rootPc: fc.integer({ min: 0, max: 11 }),
      quality: fc.constantFrom<CagedQuality>('major', 'minor'),
      frets: fc.integer({ min: 12, max: 24 }),
      base: fc.integer({ min: 36, max: 44 }),
      seven: fc.option(fc.integer({ min: 28, max: 38 }), { nil: null }),
      focus: fc.constantFrom<CagedShapeId | null>(null, 'C', 'A', 'G', 'E', 'D')
    });
    fc.assert(
      fc.property(arb, (c) => {
        const six: Pitch[] = [c.base];
        for (const step of [5, 5, 5, 4, 5]) six.push(six[six.length - 1] + step);
        const input = make({ ...c, six, layers: only('chord') });
        const plan = buildCagedListen(input);
        if (plan.kind !== 'timeline') return;
        for (const e of plan.events)
          for (const p of e.positions) {
            expect(p.string).toBeLessThanOrEqual(6);
            expect(input.open[p.string - 1] + p.fret).toBeGreaterThan(0);
          }
      }),
      { numRuns: 100 }
    );
  });
});
