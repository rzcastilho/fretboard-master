/**
 * Test-only instruments for the TM-9 screenshot fixtures (contracts/test-hooks.md).
 * Pure. Import only inside `if (__FM_FAULT_INJECTION__)` so it is dropped from production;
 * top-level calls carry `@__PURE__` so the bundler can drop them (Object.freeze and the
 * memoizing `presetInstrument` otherwise count as side effects).
 */
import { STANDARD_GUITAR, type Instrument } from './instrument';
import { presetInstrument } from './tunings';
import type { SpelledPitch } from '../theory/pitch';

const open = (letter: SpelledPitch['letter'], octave: number): SpelledPitch =>
  Object.freeze({ letter, accidental: 0, octave });

/** DADGAD, strings 1 → 6, 22 frets (the AF-7 preset). */
export const AF_7: Instrument = /* @__PURE__ */ presetInstrument('AF-7', 6, 22);

/** Half step down, strings 1 → 6, 22 frets (the AF-2 preset). */
export const AF_2: Instrument = /* @__PURE__ */ presetInstrument('AF-2', 6, 22);

/** Seven-string standard, strings 1 → 7, 22 frets. */
export const AF_21: Instrument = /* @__PURE__ */ Object.freeze({
  stringCount: 7,
  fretCount: 22,
  openStrings: /* @__PURE__ */ Object.freeze([
    /* @__PURE__ */ open('E', 4),
    /* @__PURE__ */ open('B', 3),
    /* @__PURE__ */ open('G', 3),
    /* @__PURE__ */ open('D', 3),
    /* @__PURE__ */ open('A', 2),
    /* @__PURE__ */ open('E', 2),
    /* @__PURE__ */ open('B', 1)
  ]),
  handedness: 'right',
  orientation: 'highest-top'
});

/** Drop D, strings 1 → 6, 22 frets (wide stretch, TM-5.7; the AF-4 preset). */
export const AF_4: Instrument = /* @__PURE__ */ presetInstrument('AF-4', 6, 22);

/** Standard tuning with only 12 frets (beyond-fret guidance). */
export const AF_1_12: Instrument = /* @__PURE__ */ Object.freeze({
  ...STANDARD_GUITAR,
  fretCount: 12
});

/** Standard tuning with 24 frets (CAGED second cycle). */
export const AF_1_24: Instrument = /* @__PURE__ */ Object.freeze({
  ...STANDARD_GUITAR,
  fretCount: 24
});

/** Strings 2 and 3 are both B3: shapes do not close on 4-3-2 and 3-2-1. */
export const NC_UNISON: Instrument = /* @__PURE__ */ Object.freeze({
  stringCount: 6,
  fretCount: 22,
  openStrings: /* @__PURE__ */ Object.freeze([
    /* @__PURE__ */ open('E', 4),
    /* @__PURE__ */ open('B', 3),
    /* @__PURE__ */ open('B', 3),
    /* @__PURE__ */ open('D', 3),
    /* @__PURE__ */ open('A', 2),
    /* @__PURE__ */ open('E', 2)
  ]),
  handedness: 'right',
  orientation: 'highest-top'
});

/** Open G (D4 B3 G3 D3 G2 D2), strings 1 → 6, 22 frets. */
export const AF_8: Instrument = /* @__PURE__ */ Object.freeze({
  stringCount: 6,
  fretCount: 22,
  openStrings: /* @__PURE__ */ Object.freeze([
    /* @__PURE__ */ open('D', 4),
    /* @__PURE__ */ open('B', 3),
    /* @__PURE__ */ open('G', 3),
    /* @__PURE__ */ open('D', 3),
    /* @__PURE__ */ open('G', 2),
    /* @__PURE__ */ open('D', 2)
  ]),
  handedness: 'right',
  orientation: 'highest-top'
});

/** Standard tuning with only 7 frets (US5-3: few inversions fit, no message). */
export const SHORT_7: Instrument = /* @__PURE__ */ Object.freeze({
  ...STANDARD_GUITAR,
  fretCount: 7
});

export type FixtureName =
  'AF-7' | 'AF-2' | 'AF-21' | 'AF-4' | 'AF-1-12' | 'AF-1-24' | 'NC-UNISON' | 'AF-8' | 'SHORT-7';

export const INSTRUMENT_FIXTURES: Readonly<Record<FixtureName, Instrument>> =
  /* @__PURE__ */ Object.freeze({
    'AF-7': AF_7,
    'AF-2': AF_2,
    'AF-21': AF_21,
    'AF-4': AF_4,
    'AF-1-12': AF_1_12,
    'AF-1-24': AF_1_24,
    'NC-UNISON': NC_UNISON,
    'AF-8': AF_8,
    'SHORT-7': SHORT_7
  });

/** Allow-list lookup; anything unknown falls back to the default instrument. Never throws. */
export function fixtureInstrument(name: unknown): Instrument {
  return typeof name === 'string' && Object.hasOwn(INSTRUMENT_FIXTURES, name)
    ? INSTRUMENT_FIXTURES[name as FixtureName]
    : STANDARD_GUITAR;
}
