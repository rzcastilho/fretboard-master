/**
 * Test-only instruments for the TM-9 screenshot fixtures (contracts/test-hooks.md).
 * Pure. Import only inside `if (__FM_FAULT_INJECTION__)` so it is dropped from production.
 */
import { STANDARD_GUITAR, type Instrument } from './instrument';
import type { SpelledPitch } from '../theory/pitch';

const open = (letter: SpelledPitch['letter'], octave: number): SpelledPitch =>
  Object.freeze({ letter, accidental: 0, octave });

/** DADGAD, strings 1 → 6, 22 frets. */
export const AF_7: Instrument = Object.freeze({
  stringCount: 6,
  fretCount: 22,
  openStrings: Object.freeze([
    open('D', 4),
    open('A', 3),
    open('G', 3),
    open('D', 3),
    open('A', 2),
    open('D', 2)
  ]),
  handedness: 'right',
  orientation: 'highest-top'
});

/** Seven-string standard, strings 1 → 7, 22 frets. */
export const AF_21: Instrument = Object.freeze({
  stringCount: 7,
  fretCount: 22,
  openStrings: Object.freeze([
    open('E', 4),
    open('B', 3),
    open('G', 3),
    open('D', 3),
    open('A', 2),
    open('E', 2),
    open('B', 1)
  ]),
  handedness: 'right',
  orientation: 'highest-top'
});

/** Drop D, strings 1 → 6, 22 frets (wide stretch, TM-5.7). */
export const AF_4: Instrument = Object.freeze({
  stringCount: 6,
  fretCount: 22,
  openStrings: Object.freeze([
    open('E', 4),
    open('B', 3),
    open('G', 3),
    open('D', 3),
    open('A', 2),
    open('D', 2)
  ]),
  handedness: 'right',
  orientation: 'highest-top'
});

/** Standard tuning with only 12 frets (beyond-fret guidance). */
export const AF_1_12: Instrument = Object.freeze({
  ...STANDARD_GUITAR,
  fretCount: 12
});

/** Strings 2 and 3 are both B3: shapes do not close on 4-3-2 and 3-2-1. */
export const NC_UNISON: Instrument = Object.freeze({
  stringCount: 6,
  fretCount: 22,
  openStrings: Object.freeze([
    open('E', 4),
    open('B', 3),
    open('B', 3),
    open('D', 3),
    open('A', 2),
    open('E', 2)
  ]),
  handedness: 'right',
  orientation: 'highest-top'
});

/** Open G (D4 B3 G3 D3 G2 D2), strings 1 → 6, 22 frets. */
export const AF_8: Instrument = Object.freeze({
  stringCount: 6,
  fretCount: 22,
  openStrings: Object.freeze([
    open('D', 4),
    open('B', 3),
    open('G', 3),
    open('D', 3),
    open('G', 2),
    open('D', 2)
  ]),
  handedness: 'right',
  orientation: 'highest-top'
});

/** Standard tuning with only 7 frets (US5-3: few inversions fit, no message). */
export const SHORT_7: Instrument = Object.freeze({
  ...STANDARD_GUITAR,
  fretCount: 7
});

export type FixtureName = 'AF-7' | 'AF-21' | 'AF-4' | 'AF-1-12' | 'NC-UNISON' | 'AF-8' | 'SHORT-7';

export const INSTRUMENT_FIXTURES: Readonly<Record<FixtureName, Instrument>> = Object.freeze({
  'AF-7': AF_7,
  'AF-21': AF_21,
  'AF-4': AF_4,
  'AF-1-12': AF_1_12,
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
