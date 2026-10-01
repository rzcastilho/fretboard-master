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

export const INSTRUMENT_FIXTURES: Readonly<Record<'AF-7' | 'AF-21', Instrument>> = Object.freeze({
  'AF-7': AF_7,
  'AF-21': AF_21
});

/** Allow-list lookup; anything unknown falls back to the default instrument. Never throws. */
export function fixtureInstrument(name: unknown): Instrument {
  return typeof name === 'string' && Object.hasOwn(INSTRUMENT_FIXTURES, name)
    ? INSTRUMENT_FIXTURES[name as 'AF-7' | 'AF-21']
    : STANDARD_GUITAR;
}
