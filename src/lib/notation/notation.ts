/** Note naming: glyph labels and spoken names. */
import { m } from '$lib/paraglide/messages.js';
import { getLocale } from '$lib/paraglide/runtime.js';
import type { IntervalId } from '../theory/triad';
import type { ScaleDegree } from '../theory/caged-layers';
import { pitchClassOfSpelling, sharpSpelling } from '../theory/pitch';
import type { Accidental, Letter, PitchClass, Spelling } from '../theory/pitch';
import { DEFAULT_NOTATION_CONTEXT, type NotationContext } from './policy';

let readContext: () => NotationContext = () => DEFAULT_NOTATION_CONTEXT;

/** Installs the notation source; every formatter reads it on each call (N-1). */
export function overwriteNotationSource(get: () => NotationContext): void {
  readContext = get;
}

/** Test seam: back to letters and sharps. */
export function resetNotationSourceForTests(): void {
  readContext = () => DEFAULT_NOTATION_CONTEXT;
}

/** The syllable for a letter, in the active language (fixed do, with Si). */
export function solfegeName(letter: Letter): string {
  switch (letter) {
    case 'C':
      return m.note_name_solfege_c();
    case 'D':
      return m.note_name_solfege_d();
    case 'E':
      return m.note_name_solfege_e();
    case 'F':
      return m.note_name_solfege_f();
    case 'G':
      return m.note_name_solfege_g();
    case 'A':
      return m.note_name_solfege_a();
    default:
      return m.note_name_solfege_b();
  }
}

/** The letter, or its syllable in solfège. */
export function noteName(letter: Letter): string {
  return readContext().notation === 'solfege' ? solfegeName(letter) : letter;
}

const GLYPH: Readonly<Record<Accidental, string>> = {
  [-2]: '\u{1D12B}',
  [-1]: '♭',
  0: '',
  1: '♯',
  2: '\u{1D12A}'
};

/** Sharps: C C♯ D D♯ E F F♯ G G♯ A A♯ B. */
export function defaultSpelling(pc: PitchClass): Spelling {
  return sharpSpelling(pc);
}

/** Flats for altered notes (C♯ → D♭); naturals are unchanged. */
export function flatSpelling(pc: PitchClass): Spelling {
  const sharp = defaultSpelling(pc);
  if (sharp.accidental === 0) return sharp;
  return { letter: defaultSpelling(pc + 1).letter, accidental: -1 };
}

const isNatural = (s: Spelling): boolean => s.accidental === 0;

/** One spelling per the accidental preference: sharp under sharps and both, flat under flats. */
export function singleSpelling(pc: PitchClass): Spelling {
  return readContext().accidentals === 'flats' ? flatSpelling(pc) : defaultSpelling(pc);
}

/** Both spellings of an altered note, preferred first; a natural alone. */
export function spellingPair(pc: PitchClass): readonly Spelling[] {
  const sharp = defaultSpelling(pc);
  if (isNatural(sharp)) return [sharp];
  const flat = flatSpelling(pc);
  return readContext().accidentals === 'flats' ? [flat, sharp] : [sharp, flat];
}

/** Spellings drawn on a marker: sharps [♯], flats [♭], both [♯, ♭]. */
export function markerSpellings(pc: PitchClass): readonly Spelling[] {
  const sharp = defaultSpelling(pc);
  if (isNatural(sharp)) return [sharp];
  switch (readContext().accidentals) {
    case 'flats':
      return [flatSpelling(pc)];
    case 'both':
      return [sharp, flatSpelling(pc)];
    default:
      return [sharp];
  }
}

/** A string's open note: a fixed (preset) spelling is kept, else it follows the preference. */
export function stringSpelling(open: Spelling, fixed: boolean): Spelling {
  if (fixed || isNatural(open)) return open;
  return singleSpelling(pitchClassOfSpelling(open));
}

/** Spoken pair for an altered note ("C sharp or D flat"); a natural is spoken alone. */
export function spokenPair(pc: PitchClass): string {
  const [first, second] = spellingPair(pc);
  if (second === undefined) return spokenNote(first);
  return m.note_spoken_either({ first: spokenNote(first), second: spokenNote(second) });
}

/**
 * Spoken name for an unspelled marker: both spellings only under `both`, else the single
 * preferred one (so "C sharp", not "C sharp or D flat", when only ♯ is drawn).
 */
export function spokenMarker(pc: PitchClass): string {
  return readContext().accidentals === 'both' ? spokenPair(pc) : spokenNote(singleSpelling(pc));
}

/** `spokenMarker` for several notes, joined with the locale's conjunction. */
export function spokenMarkerList(pcs: readonly PitchClass[]): string {
  return new Intl.ListFormat(getLocale(), { style: 'long', type: 'conjunction' }).format(
    pcs.map(spokenMarker)
  );
}

/** Label pair for an altered note ("D♭ / C♯"); a natural is labelled alone. */
export function labelPair(pc: PitchClass): string {
  return spellingPair(pc).map(noteLabel).join(' / ');
}

/** A label split for layout: name, accidental glyph and octave digits (empty when absent). */
export function noteLabelParts(
  s: Spelling,
  octave?: number
): { readonly name: string; readonly accidental: string; readonly octave: string } {
  return {
    name: noteName(s.letter),
    accidental: GLYPH[s.accidental],
    octave: octave === undefined ? '' : String(octave)
  };
}

export function noteLabel(s: Spelling): string {
  const p = noteLabelParts(s);
  return `${p.name}${p.accidental}`;
}

export function spokenNote(s: Spelling): string {
  const note = noteName(s.letter);
  switch (s.accidental) {
    case -2:
      return m.note_spoken_double_flat({ note });
    case -1:
      return m.note_spoken_flat({ note });
    case 1:
      return m.note_spoken_sharp({ note });
    case 2:
      return m.note_spoken_double_sharp({ note });
    default:
      return m.note_spoken_natural({ note });
  }
}

/** Spoken names joined with the locale's conjunction ("C sharp and E"). */
export function spokenNoteList(spellings: readonly Spelling[]): string {
  return new Intl.ListFormat(getLocale(), { style: 'long', type: 'conjunction' }).format(
    spellings.map(spokenNote)
  );
}

/** Note label plus octave number, e.g. "G3", "C♯5". */
export function pitchLabel(s: Spelling, octave: number): string {
  const p = noteLabelParts(s, octave);
  return `${p.name}${p.accidental}${p.octave}`;
}

/** Note labels joined with the locale's disjunction ("C♯ or D"), in the given order. */
export function noteList(spellings: readonly Spelling[]): string {
  return new Intl.ListFormat(getLocale(), { style: 'long', type: 'disjunction' }).format(
    spellings.map(noteLabel)
  );
}

/** Interval label for a triad member or scale degree: R from the catalog, others as glyphs. */
export function intervalLabel(id: IntervalId | ScaleDegree): string {
  switch (id) {
    case 'R':
      return m.interval_root();
    case 'b3':
      return '♭3';
    case 'b6':
      return '♭6';
    case 'b7':
      return '♭7';
    case 'b5':
      return '♭5';
    case '#5':
      return '♯5';
    default:
      return id;
  }
}
