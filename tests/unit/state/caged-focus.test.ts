import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { presetStrings } from '../../../src/lib/instrument/tunings';
import {
  STEP_WINDOW_MS,
  drawnLetters,
  focusFromLetter,
  focusOfIndex,
  occurrenceIndex,
  reresolveFocus,
  stepAvailability,
  stepFocus,
  toggleTagFocus
} from '../../../src/lib/state/caged-focus';
import type { CagedFocus } from '../../../src/lib/state/caged-view';
import { cagedOccurrences, type CagedQuality } from '../../../src/lib/theory/caged';
import { pitchOfSpelling } from '../../../src/lib/theory/pitch';

const STD = presetStrings('AF-1', 6).map(pitchOfSpelling).slice(-6);
const occs = (rootPc: number, frets: number, q: CagedQuality = 'major') =>
  cagedOccurrences(STD, rootPc, q, frets);
const C22 = occs(0, 22); // C0 A3 G5 E8 D10 C12 A15 G17 E20
const f = (letter: CagedFocus['letter'], ordinal = 0): CagedFocus => ({ letter, ordinal });
const lbl = (o: (typeof C22)[number] | undefined) => (o ? `${o.shape.id}${o.start}` : null);

describe('occurrenceIndex / focusOfIndex', () => {
  it('round trips; ordinal 0 is nearest the nut', () => {
    expect(C22.map((o) => `${o.shape.id}${o.start}`)).toEqual([
      'C0',
      'A3',
      'G5',
      'E8',
      'D10',
      'C12',
      'A15',
      'G17',
      'E20'
    ]);
    expect(occurrenceIndex(f('C', 0), C22)).toBe(0);
    expect(occurrenceIndex(f('C', 1), C22)).toBe(5);
    for (let i = 0; i < C22.length; i++) {
      const focus = focusOfIndex(i, C22);
      expect(focus).not.toBeNull();
      expect(occurrenceIndex(focus, C22)).toBe(i);
    }
  });
  it('null / missing give null', () => {
    expect(occurrenceIndex(null, C22)).toBeNull();
    expect(occurrenceIndex(f('D', 1), C22)).toBeNull();
    expect(focusOfIndex(-1, C22)).toBeNull();
    expect(focusOfIndex(99, C22)).toBeNull();
  });
});

describe('focusFromLetter', () => {
  it("'all' gives null", () => expect(focusFromLetter(f('E'), 'all', C22)).toBeNull());
  it('already-focused letter returns the same reference', () => {
    const cur = f('C', 1);
    expect(focusFromLetter(cur, 'C', C22)).toBe(cur);
  });
  it('otherwise ordinal 0', () => {
    expect(focusFromLetter(f('E'), 'G', C22)).toEqual(f('G', 0));
    expect(focusFromLetter(null, 'C', C22)).toEqual(f('C', 0));
  });
  it('undrawn letter returns f unchanged', () => {
    const o12 = occs(0, 12);
    const cur = f('E');
    expect(focusFromLetter(cur, 'D', o12)).toBe(cur);
    expect(focusFromLetter(null, 'D', o12)).toBeNull();
  });
});

describe('toggleTagFocus', () => {
  it('focused index gives null; otherwise that occurrence', () => {
    expect(toggleTagFocus(f('E'), 3, C22)).toBeNull();
    expect(toggleTagFocus(f('E'), 5, C22)).toEqual(f('C', 1));
    expect(toggleTagFocus(null, 6, C22)).toEqual(f('A', 1));
  });
});

describe('stepFocus', () => {
  it('moves by one, no wrap', () => {
    expect(stepFocus(f('E'), 1, C22)).toEqual(f('D', 0));
    expect(stepFocus(f('E'), -1, C22)).toEqual(f('G', 0));
  });
  it('unchanged (same reference) at either end or with null focus', () => {
    const first = f('C', 0);
    const last = f('E', 1);
    expect(stepFocus(first, -1, C22)).toBe(first);
    expect(stepFocus(last, 1, C22)).toBe(last);
    expect(stepFocus(null, 1, C22)).toBeNull();
  });
  it('a letter drawn twice is visited once per occurrence', () => {
    let cur: CagedFocus | null = f('C', 0);
    const seen: string[] = [];
    for (let i = 0; i < 20; i++) {
      const next = stepFocus(cur, 1, C22);
      if (next === cur) break;
      cur = next;
      seen.push(`${cur?.letter}${cur?.ordinal}`);
    }
    expect(seen).toEqual(['A0', 'G0', 'E0', 'D0', 'C1', 'A1', 'G1', 'E1']);
  });
});

describe('stepAvailability', () => {
  it('both false with null focus', () =>
    expect(stepAvailability(null, C22)).toEqual({ previous: false, next: false }));
  it('previous false at index 0; next false at last', () => {
    expect(stepAvailability(f('C', 0), C22)).toEqual({ previous: false, next: true });
    expect(stepAvailability(f('E', 1), C22)).toEqual({ previous: true, next: false });
    expect(stepAvailability(f('E', 0), C22)).toEqual({ previous: true, next: true });
  });
});

describe('drawnLetters', () => {
  it('12 frets omits D', () => {
    expect([...drawnLetters(occs(0, 12))].sort()).toEqual(['A', 'C', 'E', 'G']);
  });
  it('22 frets has all five', () => expect(drawnLetters(C22).size).toBe(5));
  it('empty occurrences give an empty set', () => expect(drawnLetters([]).size).toBe(0));
});

describe('reresolveFocus', () => {
  it('rule 1: null stays null', () => expect(reresolveFocus(C22[3], null, C22)).toBeNull());
  it('rule 2: empty gives null', () => expect(reresolveFocus(C22[3], f('E'), [])).toBeNull());
  it('rule 3: keep same letter + ordinal', () => {
    const cur = f('E', 0);
    expect(reresolveFocus(C22[3], cur, occs(7, 22))).toBe(cur);
  });
  it('rule 4: nearest same-letter start', () => {
    // A@15 (ordinal 1) on 22 frets; 12 frets has only A@3.
    const prev = C22[6];
    expect(lbl(prev)).toBe('A15');
    const next = occs(0, 12);
    expect(reresolveFocus(prev, f('A', 1), next)).toEqual(f('A', 0));
  });
  it('rule 5: nearest start overall; lower start wins a tie', () => {
    const stub = (id: 'C' | 'A' | 'G', start: number) => {
      const base = C22.find((o) => o.shape.id === id) ?? C22[0];
      return { ...base, start, end: start + 3 };
    };
    const prev = { ...C22[4], start: 10, end: 13 }; // D@10, D not drawn next
    const next = [stub('C', 8), stub('A', 12)];
    expect(reresolveFocus(prev, f('D'), next)).toEqual(f('C', 0));
    const next2 = [stub('A', 12), stub('C', 8)].sort((a, b) => a.start - b.start);
    expect(reresolveFocus(prev, f('D'), next2)).toEqual(f('C', 0));
    const nearer = [stub('C', 5), stub('A', 11)];
    expect(reresolveFocus(prev, f('D'), nearer)).toEqual(f('A', 0));
  });
  it('quickstart: C major E focused → G major keeps E', () => {
    const cur = f('E', 0);
    expect(reresolveFocus(C22[3], cur, occs(7, 22))).toBe(cur);
  });
  it('quickstart: 24→12 frets, A@15 ordinal 1 → A@3', () => {
    const prev = occs(0, 24).find((o) => o.shape.id === 'A' && o.start === 15) ?? null;
    expect(prev).not.toBeNull();
    const next = occs(0, 12);
    const out = reresolveFocus(prev, f('A', 1), next);
    expect(lbl(next[occurrenceIndex(out, next) ?? -1])).toBe('A3');
  });
});

describe('STEP_WINDOW_MS', () => {
  it('is 500 and equals --duration-medium', () => {
    expect(STEP_WINDOW_MS).toBe(500);
    const css = readFileSync('src/lib/styles/tokens.css', 'utf8');
    const m = /--duration-medium:\s*(\d+)ms/.exec(css);
    expect(Number(m?.[1])).toBe(STEP_WINDOW_MS);
  });
});
