import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  adoptKeys,
  reconcileMarkers,
  type KeyedMarker,
  type MotionKind
} from '../../../src/lib/fretboard/transition';
import type { DrawnMarker, NoteFunction } from '../../../src/lib/fretboard/types';

const mk = (
  string: number,
  fret: number,
  fn: NoteFunction = 'neutral',
  extra: Partial<DrawnMarker> = {}
): DrawnMarker => ({ string, fret, function: fn, emphasis: 'normal', ...extra });

/** Draw `markers` as a first frame (no motion) to get a keyed `prev`. */
const frame = (markers: readonly DrawnMarker[]): readonly KeyedMarker[] =>
  reconcileMarkers([], markers, 'none', 0);

const keys = (list: readonly KeyedMarker[]): string[] => list.map((k) => k.key);

describe('slide', () => {
  // C major triad shape on strings 1..3, then the same shape two frets up (D).
  const c = [mk(1, 3, 'root'), mk(2, 5, 'third'), mk(3, 5, 'fifth'), mk(2, 8, 'neutral')];
  const d = [mk(1, 5, 'root'), mk(2, 7, 'third'), mk(3, 7, 'fifth'), mk(2, 10, 'neutral')];

  it('pairs old and new per string in fret order; no key spans two strings', () => {
    const prev = frame(c);
    const out = reconcileMarkers(prev, d, 'slide', 1);
    const prevKey = (s: number, f: number) =>
      prev.find((p) => p.mk.string === s && p.mk.fret === f)?.key;
    for (const k of out) {
      const old = prev.find((p) => p.key === k.key);
      expect(old, k.key).toBeDefined();
      expect(old?.mk.string).toBe(k.mk.string);
    }
    expect(out[0].key).toBe(prevKey(1, 3));
    expect(out[1].key).toBe(prevKey(2, 5));
    expect(out[3].key).toBe(prevKey(2, 8));
    expect(new Set(keys(out)).size).toBe(out.length);
  });

  it('gives extra new markers on a string a fade-in', () => {
    const prev = frame([mk(1, 3)]);
    const out = reconcileMarkers(prev, [mk(1, 5), mk(1, 9)], 'slide', 1);
    expect(out[0].key).toBe(prev[0].key);
    expect(out[0].enter).toBe('instant');
    expect(out[1].enter).toBe('fade');
    expect(prev.map((p) => p.key)).not.toContain(out[1].key);
  });

  it('drops old keys when there are fewer new markers, which exit with a fade', () => {
    const prev = frame([mk(1, 3), mk(1, 7)]);
    const out = reconcileMarkers(prev, [mk(1, 5)], 'slide', 1);
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe(prev[0].key);
    expect(out[0].exit).toBe('fade');
    expect(keys(out)).not.toContain(prev[1].key);
  });

  it('pairs the same way for the seven-string, left-handed case (keys use string and fret)', () => {
    const before = [mk(7, 2), mk(6, 4), mk(1, 5)];
    const after = [mk(7, 4), mk(6, 6), mk(1, 7)];
    const prev = frame(before);
    const out = reconcileMarkers(prev, after, 'slide', 3);
    expect(keys(out)).toEqual(keys(prev));
  });

  it('never pairs across strings', () => {
    const prev = frame([mk(1, 3)]);
    const out = reconcileMarkers(prev, [mk(2, 3)], 'slide', 1);
    expect(out[0].key).not.toBe(prev[0].key);
    expect(out[0].enter).toBe('fade');
  });
});

describe('by-role', () => {
  const majorMarks = [
    mk(5, 3, 'root', { id: 'root' }),
    mk(4, 2, 'third', { id: 'third' }),
    mk(3, 0, 'fifth', { id: 'fifth' })
  ];

  it('C major → C minor keeps all keys; the third moves one fret down', () => {
    const prev = frame(majorMarks);
    const minor = [majorMarks[0], mk(4, 1, 'third', { id: 'third' }), majorMarks[2]];
    const out = reconcileMarkers(prev, minor, 'by-role', 1);
    expect(keys(out)).toEqual(keys(prev));
    expect(out[1].mk.fret).toBe(prev[1].mk.fret - 1);
    expect(out[1].enter).toBe('instant');
  });

  it('a role that moves to another string gets a fresh key and fades', () => {
    const prev = frame(majorMarks);
    const moved = [majorMarks[0], mk(3, 2, 'third', { id: 'third' }), majorMarks[2]];
    const out = reconcileMarkers(prev, moved, 'by-role', 2);
    expect(out[1].key).not.toBe(prev[1].key);
    expect(out[1].enter).toBe('fade');
    expect(out[0].key).toBe(prev[0].key);
    expect(out[2].key).toBe(prev[2].key);
  });

  it('comparison markers start from the base marker of the same role; base keys stay', () => {
    const prev = frame(majorMarks);
    const withComparison = [
      ...majorMarks,
      mk(5, 3, 'root', { id: 'cmp-root', variant: 'comparison' }),
      mk(4, 1, 'third', { id: 'cmp-third', variant: 'comparison' }),
      mk(3, 0, 'fifth', { id: 'cmp-fifth', variant: 'comparison' })
    ];
    const out = reconcileMarkers(prev, withComparison, 'by-role', 1);
    expect(keys(out).slice(0, 3)).toEqual(keys(prev));
    expect(out[4].from).toEqual({ string: 4, fret: 2 });
    expect(out[3].from).toEqual({ string: 5, fret: 3 });
    expect(out[5].from).toEqual({ string: 3, fret: 0 });
    expect(out[0].from).toBeUndefined();
  });

  it('falls back to the position key without an id', () => {
    const prev = frame([mk(1, 3)]);
    const out = reconcileMarkers(prev, [mk(1, 3), mk(2, 4)], 'by-role', 1);
    expect(out[0].key).toBe(prev[0].key);
    expect(out[1].enter).toBe('fade');
  });
});

describe('cross-fade', () => {
  it('shares no key with prev and fades every marker', () => {
    const before = [mk(1, 3, 'root', { id: 'a' }), mk(2, 5)];
    const prev = frame(before);
    const out = reconcileMarkers(prev, before, 'cross-fade', 4);
    const old = new Set(keys(prev));
    for (const k of out) {
      expect(old.has(k.key)).toBe(false);
      expect(k.enter).toBe('fade');
      expect(k.exit).toBe('fade');
    }
  });
});

describe('reveal', () => {
  it('new markers reveal; existing ones keep their keys', () => {
    const prev = frame([mk(1, 3, 'root', { id: 'r' })]);
    const out = reconcileMarkers(
      prev,
      [mk(1, 3, 'root', { id: 'r' }), mk(2, 5, 'neutral', { layer: 'arpeggio', appear: 0.5 })],
      'reveal',
      1
    );
    expect(out[0].key).toBe(prev[0].key);
    expect(out[0].enter).toBe('instant');
    expect(out[1].enter).toBe('reveal');
  });
});

describe('none and focus', () => {
  it.each(['none', 'focus'] as const)('%s keeps keys stable with no fade or reveal', (kind) => {
    const list = [mk(1, 3, 'root', { id: 'a' }), mk(2, 5)];
    const prev = frame(list);
    const out = reconcileMarkers(prev, [list[0], mk(2, 6)], kind, 1);
    expect(out[0].key).toBe(prev[0].key);
    for (const k of out) {
      expect(k.enter).toBe('instant');
      expect(k.exit).toBe('instant');
    }
  });
});

describe('pulse', () => {
  const KINDS: readonly MotionKind[] = [
    'slide',
    'by-role',
    'cross-fade',
    'focus',
    'reveal',
    'none'
  ];
  it.each(KINDS)('keys a pulsed marker by pulse.id under %s', (kind) => {
    const pulsedMarker = mk(2, 5, 'neutral', { id: 'x', pulse: { id: 42, durationMs: 300 } });
    const prev = frame([mk(2, 5, 'neutral', { id: 'x' })]);
    const out = reconcileMarkers(prev, [pulsedMarker], kind, 7);
    expect(out[0].key).toBe('pulse:42');
  });
});

describe('properties', () => {
  const arbMarker = fc.record({
    string: fc.integer({ min: 1, max: 7 }),
    fret: fc.integer({ min: 0, max: 24 }),
    function: fc.constantFrom<NoteFunction>('root', 'third', 'fifth', 'degree', 'neutral'),
    emphasis: fc.constant('normal' as const),
    id: fc.option(fc.constantFrom('a', 'b', 'c', 'd'), { nil: undefined }),
    variant: fc.option(fc.constant('comparison' as const), { nil: undefined }),
    pulse: fc.option(
      fc.record({ id: fc.integer({ min: 1, max: 3 }), durationMs: fc.constant(100) }),
      { nil: undefined }
    )
  });
  const arbList = fc.array(arbMarker, { maxLength: 12 });
  const arbKind = fc.constantFrom<MotionKind>(
    'slide',
    'by-role',
    'cross-fade',
    'focus',
    'reveal',
    'none'
  );

  it('outputs exactly next in order, unique keys, deterministic', () => {
    fc.assert(
      fc.property(arbList, arbList, arbKind, fc.nat(50), (a, b, kind, gen) => {
        const prev = frame(a);
        const out = reconcileMarkers(prev, b, kind, gen);
        expect(out.map((k) => k.mk)).toEqual(b);
        expect(new Set(keys(out)).size).toBe(out.length);
        expect(reconcileMarkers(prev, b, kind, gen)).toEqual(out);
      })
    );
  });

  it('slide: every shared key joins two markers on the same string', () => {
    fc.assert(
      fc.property(arbList, arbList, (a, b) => {
        const prev = frame(a);
        const out = reconcileMarkers(prev, b, 'slide', 1);
        for (const k of out) {
          const old = prev.find((p) => p.key === k.key);
          if (old && !k.mk.pulse) expect(old.mk.string).toBe(k.mk.string);
        }
      })
    );
  });

  it('none: no marker has a fade or reveal mode', () => {
    fc.assert(
      fc.property(arbList, arbList, (a, b) => {
        for (const k of reconcileMarkers(frame(a), b, 'none', 1)) {
          expect(k.enter).toBe('instant');
          expect(k.exit).toBe('instant');
        }
      })
    );
  });
});

describe('adoptKeys', () => {
  const mk = (string: number, fret: number): DrawnMarker => ({
    string,
    fret,
    function: 'root',
    emphasis: 'normal'
  });
  const keyed = (key: string, m: DrawnMarker): KeyedMarker => ({
    key,
    mk: m,
    enter: 'fade',
    exit: 'fade'
  });

  it('keeps the previous key at the same position and does not re-enter', () => {
    const prev = [keyed('7:a', mk(1, 3))];
    const out = adoptKeys(prev, [keyed('1:3', mk(1, 3)), keyed('2:5', mk(2, 5))]);
    expect(out.map((k) => k.key)).toEqual(['7:a', '2:5']);
    expect(out[0].enter).toBe('instant');
    expect(out[1].enter).toBe('fade');
  });

  it('never gives two markers the same key', () => {
    const prev = [keyed('x', mk(1, 3))];
    const out = adoptKeys(prev, [keyed('x', mk(2, 4)), keyed('y', mk(1, 3))]);
    expect(new Set(out.map((k) => k.key)).size).toBe(2);
  });
});
