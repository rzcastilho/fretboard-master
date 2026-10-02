/** Pure triad spelling (TM-4). Imports only `./pitch`. */
import {
  pitchClassOfSpelling,
  type Accidental,
  type Letter,
  type PitchClass,
  type Spelling
} from './pitch';

export type Quality = 'major' | 'minor' | 'diminished' | 'augmented';
export type TriadFunction = 'root' | 'third' | 'fifth';
export type IntervalId = 'R' | '3' | 'b3' | '5' | 'b5' | '#5';
export type StackingId = 'M3+m3' | 'm3+M3' | 'm3+m3' | 'M3+M3';
export type RootSpellingChoice = 'sharp' | 'flat';

export interface TriadSpelling {
  readonly root: Spelling;
  readonly third: Spelling;
  readonly fifth: Spelling;
  /** R–3–5 order. */
  readonly pitchClasses: readonly [PitchClass, PitchClass, PitchClass];
}

/** Display order. */
export const QUALITIES: readonly Quality[] = ['major', 'minor', 'diminished', 'augmented'];

export const QUALITY_INTERVALS: Readonly<
  Record<Quality, { readonly third: number; readonly fifth: number }>
> = {
  major: { third: 4, fifth: 7 },
  minor: { third: 3, fifth: 7 },
  diminished: { third: 3, fifth: 6 },
  augmented: { third: 4, fifth: 8 }
};

export const QUALITY_LABELS: Readonly<
  Record<Quality, readonly [IntervalId, IntervalId, IntervalId]>
> = {
  major: ['R', '3', '5'],
  minor: ['R', 'b3', '5'],
  diminished: ['R', 'b3', 'b5'],
  augmented: ['R', '3', '#5']
};

export const QUALITY_STACKING: Readonly<Record<Quality, StackingId>> = {
  major: 'M3+m3',
  minor: 'm3+M3',
  diminished: 'm3+m3',
  augmented: 'M3+M3'
};

/** TM-4.3 ties in accidental count, resolved by common guitarist usage. */
export const TIE_BREAK: Readonly<Record<string, RootSpellingChoice>> = {
  '3:minor': 'flat',
  '6:major': 'sharp'
};

const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

const NATURAL_ROOT: Readonly<Record<number, Spelling>> = {
  0: { letter: 'C', accidental: 0 },
  2: { letter: 'D', accidental: 0 },
  4: { letter: 'E', accidental: 0 },
  5: { letter: 'F', accidental: 0 },
  7: { letter: 'G', accidental: 0 },
  9: { letter: 'A', accidental: 0 },
  11: { letter: 'B', accidental: 0 }
};

/** [sharp, flat] for altered pitch classes. */
const ALTERED_ROOT: Readonly<Record<number, readonly [Spelling, Spelling]>> = {
  1: [
    { letter: 'C', accidental: 1 },
    { letter: 'D', accidental: -1 }
  ],
  3: [
    { letter: 'D', accidental: 1 },
    { letter: 'E', accidental: -1 }
  ],
  6: [
    { letter: 'F', accidental: 1 },
    { letter: 'G', accidental: -1 }
  ],
  8: [
    { letter: 'G', accidental: 1 },
    { letter: 'A', accidental: -1 }
  ],
  10: [
    { letter: 'A', accidental: 1 },
    { letter: 'B', accidental: -1 }
  ]
};

const norm = (pc: number): PitchClass => ((Math.trunc(pc) % 12) + 12) % 12;

export function intervalsOf(q: Quality): readonly [IntervalId, IntervalId, IntervalId] {
  return QUALITY_LABELS[q];
}

export function stackingOf(q: Quality): StackingId {
  return QUALITY_STACKING[q];
}

/** One spelling for a natural root; `[sharp, flat]` for an altered one. */
export function rootSpellings(pc: PitchClass): readonly Spelling[] {
  const p = norm(pc);
  return NATURAL_ROOT[p] ? [NATURAL_ROOT[p]] : ALTERED_ROOT[p];
}

export function isAlteredRoot(pc: PitchClass): boolean {
  return rootSpellings(pc).length === 2;
}

/** The note a letter-distance above `root` that sits `semitones` above it (TM-4.1). */
function stack(root: Spelling, letterSteps: number, semitones: number): Spelling {
  const letter = LETTERS[(LETTERS.indexOf(root.letter) + letterSteps) % 7];
  const target = norm(pitchClassOfSpelling(root) + semitones);
  const natural = pitchClassOfSpelling({ letter, accidental: 0 });
  // Offset in −6..5; real triads stay within −2..2.
  const accidental = (((target - natural + 18) % 12) - 6) as Accidental;
  return { letter, accidental };
}

export function spellTriad(root: Spelling, q: Quality): TriadSpelling {
  const { third, fifth } = QUALITY_INTERVALS[q];
  const t = stack(root, 2, third);
  const f = stack(root, 4, fifth);
  return {
    root,
    third: t,
    fifth: f,
    pitchClasses: [pitchClassOfSpelling(root), pitchClassOfSpelling(t), pitchClassOfSpelling(f)]
  };
}

export function accidentalCount(t: TriadSpelling): number {
  return Math.abs(t.root.accidental) + Math.abs(t.third.accidental) + Math.abs(t.fifth.accidental);
}

export function defaultRootSpelling(pc: PitchClass, q: Quality): Spelling {
  const options = rootSpellings(pc);
  if (options.length === 1) return options[0];
  const [sharp, flat] = options;
  const a = accidentalCount(spellTriad(sharp, q));
  const b = accidentalCount(spellTriad(flat, q));
  if (a !== b) return a < b ? sharp : flat;
  return TIE_BREAK[`${norm(pc)}:${q}`] === 'flat' ? flat : sharp;
}

export function effectiveRootSpelling(
  pc: PitchClass,
  override: 'none' | RootSpellingChoice,
  q: Quality
): Spelling {
  const options = rootSpellings(pc);
  if (options.length === 2 && override !== 'none') {
    return override === 'sharp' ? options[0] : options[1];
  }
  return defaultRootSpelling(pc, q);
}

export function choiceOf(pc: PitchClass, s: Spelling): RootSpellingChoice | null {
  const options = rootSpellings(pc);
  if (options.length < 2) return null;
  return options[0].letter === s.letter && options[0].accidental === s.accidental
    ? 'sharp'
    : 'flat';
}

export function otherRootSpelling(pc: PitchClass, current: Spelling): Spelling | null {
  const choice = choiceOf(pc, current);
  if (choice === null) return null;
  const options = rootSpellings(pc);
  return choice === 'sharp' ? options[1] : options[0];
}

/** Notes spelled with a double accidental, in R–3–5 order (C3). */
export function doubleAccidentalNotes(
  t: TriadSpelling
): readonly { readonly function: TriadFunction; readonly spelling: Spelling }[] {
  const all: { function: TriadFunction; spelling: Spelling }[] = [
    { function: 'root', spelling: t.root },
    { function: 'third', spelling: t.third },
    { function: 'fifth', spelling: t.fifth }
  ];
  return all.filter((n) => Math.abs(n.spelling.accidental) === 2);
}
