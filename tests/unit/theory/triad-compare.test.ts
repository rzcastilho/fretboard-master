import { describe, expect, it } from 'vitest';
import type { Pitch } from '../../../src/lib/theory/pitch';
import { QUALITIES, spellTriad, type Quality } from '../../../src/lib/theory/triad';
import {
  INVERSIONS,
  ONE_NOTE_PARTNER,
  comparisonFrets,
  noteMoves,
  occurrences,
  pairOccurrences,
  triadShape,
  type Frets3,
  type Functions3,
  type NoteMove
} from '../../../src/lib/theory/triad-shape';

const SPELL_FOR_PC = [
  { letter: 'C', accidental: 0 },
  { letter: 'C', accidental: 1 },
  { letter: 'D', accidental: 0 },
  { letter: 'E', accidental: -1 },
  { letter: 'E', accidental: 0 },
  { letter: 'F', accidental: 0 },
  { letter: 'F', accidental: 1 },
  { letter: 'G', accidental: 0 },
  { letter: 'A', accidental: -1 },
  { letter: 'A', accidental: 0 },
  { letter: 'B', accidental: -1 },
  { letter: 'B', accidental: 0 }
] as const;

/** 6-string standard (E2 A2 D3 G3 B3 E4) sets 6-5-4 … 3-2-1, plus the 7-string low-B sets. */
const STANDARD_SETS: readonly (readonly [Pitch, Pitch, Pitch])[] = [
  [40, 45, 50],
  [45, 50, 55],
  [50, 55, 59],
  [55, 59, 64]
];
const SEVEN_STRING_SETS: readonly (readonly [Pitch, Pitch, Pitch])[] = [
  [35, 40, 45],
  ...STANDARD_SETS
];

/** data-model §1 expected moves: [function, delta] pairs, keyed by from → to. */
const EXPECTED: Record<Quality, Partial<Record<Quality, readonly [string, number][]>>> = {
  major: {
    minor: [['third', -1]],
    diminished: [
      ['third', -1],
      ['fifth', -1]
    ],
    augmented: [['fifth', 1]]
  },
  minor: {
    major: [['third', 1]],
    diminished: [['fifth', -1]],
    augmented: [
      ['third', 1],
      ['fifth', 1]
    ]
  },
  diminished: {
    major: [
      ['third', 1],
      ['fifth', 1]
    ],
    minor: [['fifth', 1]],
    augmented: [
      ['third', 1],
      ['fifth', 2]
    ]
  },
  augmented: {
    major: [['fifth', -1]],
    minor: [
      ['third', -1],
      ['fifth', -1]
    ],
    diminished: [
      ['third', -1],
      ['fifth', -2]
    ]
  }
};

/** Moves are ordered low → high by string (inversion-dependent); compare as a set by function. */
const summary = (moves: readonly NoteMove[]) =>
  moves
    .map((m) => [m.function, m.delta] as [string, number])
    .sort((a, b) => a[0].localeCompare(b[0]));
const sorted = (e: readonly [string, number][] | undefined) =>
  [...(e ?? [])].sort((a, b) => a[0].localeCompare(b[0]));

describe('T1/T2 SC-001 matrix', () => {
  for (const [label, sets] of [
    ['6-string', STANDARD_SETS],
    ['7-string', SEVEN_STRING_SETS]
  ] as const) {
    it(`moves exactly the changed notes for every root, inversion, set and ordered pair (${label})`, () => {
      let checked = 0;
      for (let pc = 0; pc < 12; pc++) {
        for (const set of sets) {
          for (const inv of INVERSIONS) {
            for (const from of QUALITIES) {
              const base = triadShape(set, spellTriad(SPELL_FOR_PC[pc], from), inv);
              if (base.kind !== 'shape') throw new Error('expected a shape');
              for (const to of QUALITIES) {
                if (to === from) continue;
                const moves = noteMoves(base.frets, base.functions, from, to);
                expect(moves.every((m) => m.function !== ('root' as string))).toBe(true);
                expect(summary(moves)).toEqual(sorted(EXPECTED[from][to]));
                expect(moves.map((m) => m.index)).toEqual(
                  [...moves.map((m) => m.index)].sort((a, b) => a - b)
                );
                const cmp = comparisonFrets(base.frets, base.functions, from, to);
                for (const m of moves) {
                  expect(m.toFret).toBe(m.fromFret + m.delta);
                  expect(cmp[m.index]).toBe(m.toFret);
                  expect(base.frets[m.index]).toBe(m.fromFret);
                }
                checked++;
              }
            }
          }
        }
      }
      expect(checked).toBe(12 * sets.length * 3 * 12);
    });
  }

  it('major↔minor moves only the third; ONE_NOTE_PARTNER pairs are single-note moves', () => {
    for (const q of QUALITIES) {
      const partner = ONE_NOTE_PARTNER[q];
      const base = triadShape(STANDARD_SETS[3], spellTriad(SPELL_FOR_PC[0], q), 'root');
      if (base.kind !== 'shape') throw new Error('expected a shape');
      expect(noteMoves(base.frets, base.functions, q, partner)).toHaveLength(1);
    }
    expect(ONE_NOTE_PARTNER).toEqual({
      major: 'minor',
      minor: 'major',
      diminished: 'minor',
      augmented: 'major'
    });
  });
});

describe('T5 TM-9 sample 10', () => {
  it('G major 2nd inversion on 4-3-2: two occurrences, only the 2nd pair fits', () => {
    const base = triadShape(STANDARD_SETS[2], spellTriad(SPELL_FOR_PC[7], 'major'), 'second');
    if (base.kind !== 'shape') throw new Error('expected a shape');
    const occs = occurrences(base.frets, 22);
    expect(occs).toEqual([
      [0, 0, 0],
      [12, 12, 12]
    ]);
    expect(pairOccurrences(occs, base.functions, 'major', 'minor', 22)).toEqual([1]);
    expect(comparisonFrets(occs[1], base.functions, 'major', 'minor')).toEqual([12, 12, 11]);
  });

  it('keeps every occurrence whose comparison frets are all in range', () => {
    const f: Functions3 = ['root', 'third', 'fifth'];
    const occs: Frets3[] = [
      [3, 2, 0],
      [15, 14, 12]
    ];
    expect(pairOccurrences(occs, f, 'major', 'minor', 22)).toEqual([0, 1]);
    // augmented fifth +1 pushes the top fret past the end
    expect(pairOccurrences([[10, 10, 22]], f, 'major', 'augmented', 22)).toEqual([]);
    expect(pairOccurrences([[10, 10, 22]], f, 'major', 'minor', 22)).toEqual([0]);
    expect(pairOccurrences([[0, 0, 0]], f, 'minor', 'major', 22)).toEqual([0]);
  });
});

describe('C2 spellings', () => {
  it('D♭ minor is D♭–F♭–A♭', () => {
    const t = spellTriad({ letter: 'D', accidental: -1 }, 'minor');
    expect([t.root, t.third, t.fifth]).toEqual([
      { letter: 'D', accidental: -1 },
      { letter: 'F', accidental: -1 },
      { letter: 'A', accidental: -1 }
    ]);
  });

  it('D♯ major vs augmented: A♯ becomes A𝄪', () => {
    const root = { letter: 'D', accidental: 1 } as const;
    expect(spellTriad(root, 'major').fifth).toEqual({ letter: 'A', accidental: 1 });
    expect(spellTriad(root, 'augmented').fifth).toEqual({ letter: 'A', accidental: 2 });
  });
});

describe('T6 same quality', () => {
  it('is the identity with no moves', () => {
    for (const q of QUALITIES) {
      for (const inv of INVERSIONS) {
        const base = triadShape(STANDARD_SETS[1], spellTriad(SPELL_FOR_PC[4], q), inv);
        if (base.kind !== 'shape') throw new Error('expected a shape');
        expect(comparisonFrets(base.frets, base.functions, q, q)).toEqual(base.frets);
        expect(noteMoves(base.frets, base.functions, q, q)).toEqual([]);
      }
    }
  });
});

describe('T7 purity', () => {
  it('does not mutate frozen input and is repeatable', () => {
    const frets = Object.freeze([5, 4, 3]) as unknown as Frets3;
    const fns = Object.freeze(['root', 'third', 'fifth']) as unknown as Functions3;
    const occs = Object.freeze([frets]) as readonly Frets3[];
    const a = noteMoves(frets, fns, 'major', 'diminished');
    expect(noteMoves(frets, fns, 'major', 'diminished')).toEqual(a);
    expect(comparisonFrets(frets, fns, 'major', 'diminished')).toEqual(
      comparisonFrets(frets, fns, 'major', 'diminished')
    );
    expect(pairOccurrences(occs, fns, 'major', 'minor', 22)).toEqual([0]);
    expect([...frets]).toEqual([5, 4, 3]);
    expect([...fns]).toEqual(['root', 'third', 'fifth']);
  });
});
