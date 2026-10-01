/**
 * Notes display model (data-model §4–§5). Pure + paraglide for description text.
 * Turns the view state into the fretboard `DisplayModel`.
 */
import { m } from '$lib/paraglide/messages.js';
import type { DisplayModel, LabelMode, Marker, OctaveTone } from '../fretboard/types';
import {
  allPositions,
  positionPitch,
  unisonsOf,
  type Instrument,
  type Position
} from '../instrument/instrument';
import { defaultSpelling, flatSpelling, pitchLabel, spokenNoteList } from '../notation/notation';
import { octaveOf, pitchClass, type PitchClass, type Spelling } from '../theory/pitch';
import { missingNotes, type Background, type NotesViewState } from './notes-view';

/** Facts for the position card (data-model §6). */
export interface CardInfo {
  readonly position: Position;
  /** Pitch class 0–11 (for See every occurrence). */
  readonly pitchClass: PitchClass;
  /** Sharp spelling. */
  readonly spelling: Spelling;
  /** Flat spelling of the same pitch class when altered, else `null`. */
  readonly altSpelling: Spelling | null;
  readonly octave: number;
  readonly unisons: readonly Position[];
  /** Whether the pitch class is already selected. */
  readonly selected: boolean;
}

/** Listen tempo (R-07, FR-012). */
export const LISTEN_BPM = 120;

export type ListenStep = Position | readonly Position[];

export type ListenState =
  | { readonly enabled: true }
  | { readonly enabled: false; readonly reason: 'none' | 'too-many' | 'no-positions' };

export interface NotesDisplay {
  readonly model: DisplayModel;
  /** Number of `highlighted` markers. */
  readonly highlightedCount: number;
  /** Selected notes with no position in the filters, selection order (FR-015). */
  readonly missing: readonly PitchClass[];
  readonly cardInfo: CardInfo | null;
  /** Steps for Listen: selected notes inside the filters, ascending pitch (R-07). */
  readonly listenSteps: readonly ListenStep[];
  readonly listen: ListenState;
  /** Nothing can be shown: background none and no selection (FR-004 guidance). */
  readonly emptyGuidance: boolean;
}

export function cardInfo(s: NotesViewState, instrument: Instrument): CardInfo | null {
  const p = s.card;
  if (p === null) return null;
  const pitch = positionPitch(instrument, p);
  const pc = pitchClass(pitch);
  const spelling = defaultSpelling(pc);
  return {
    position: p,
    pitchClass: pc,
    spelling,
    altSpelling: spelling.accidental === 0 ? null : flatSpelling(pc),
    octave: octaveOf(pitch),
    unisons: unisonsOf(instrument, p),
    selected: s.selection.includes(pc)
  };
}

function cardSentence(info: CardInfo): string {
  const { position: p, unisons } = info;
  const note = pitchLabel(info.spelling, info.octave);
  const where =
    p.fret === 0
      ? m.notes_desc_card_where_open({ string: p.string })
      : m.notes_desc_card_where({ string: p.string, fret: p.fret });
  const count =
    unisons.length === 0
      ? m.notes_desc_card_unisons_none()
      : unisons.length === 1
        ? m.notes_desc_card_unisons_one()
        : m.notes_desc_card_unisons({ count: unisons.length });
  return m.notes_desc_card({ note, where, unisons: count });
}

/**
 * Positions of the selected notes on active strings inside the region, grouped by pitch
 * (same pitch = one chord step ordered by string number), ascending pitch (R-07).
 */
export function listenSteps(s: NotesViewState, instrument: Instrument): readonly ListenStep[] {
  const byPitch = new Map<number, Position[]>();
  for (const p of allPositions(instrument)) {
    if (!s.activeStrings.includes(p.string)) continue;
    if (p.fret < s.region.start || p.fret > s.region.end) continue;
    const pitch = positionPitch(instrument, p);
    if (!s.selection.includes(pitchClass(pitch))) continue;
    const group = byPitch.get(pitch);
    if (group) group.push(p);
    else byPitch.set(pitch, [p]);
  }
  return [...byPitch.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, group]) => {
      group.sort((a, b) => a.string - b.string);
      return group.length === 1 ? group[0] : group;
    });
}

function listenState(s: NotesViewState, steps: readonly ListenStep[]): ListenState {
  if (s.selection.length === 0) return { enabled: false, reason: 'none' };
  if (s.selection.length > 3) return { enabled: false, reason: 'too-many' };
  if (steps.length === 0) return { enabled: false, reason: 'no-positions' };
  return { enabled: true };
}

const NATURALS: ReadonlySet<number> = new Set([0, 2, 4, 5, 7, 9, 11]);
const ALL: ReadonlySet<number> = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
const NONE: ReadonlySet<number> = new Set();

const backgroundSet = (b: Background): ReadonlySet<number> =>
  b === 'naturals' ? NATURALS : b === 'all' ? ALL : NONE;

export const toneOf = (octave: number): OctaveTone =>
  Math.min(7, Math.max(1, Math.trunc(octave))) as OctaveTone;

const LABEL_MODE: Readonly<Record<NotesViewState['labelType'], LabelMode>> = {
  name: 'note',
  octave: 'octave',
  none: 'none'
};

function stringsText(strings: readonly number[]): string {
  const first = strings[0];
  const last = strings[strings.length - 1];
  if (strings.length === 1) return m.notes_desc_strings_one({ string: first });
  if (last - first + 1 === strings.length) {
    return m.notes_desc_strings_range({ from: first, to: last });
  }
  return m.notes_desc_strings_list({ list: strings.join(', ') });
}

function fretsText(start: number, end: number): string {
  return start === end
    ? m.notes_desc_frets_one({ fret: start })
    : m.notes_desc_frets_range({ from: start, to: end });
}

function describe(
  s: NotesViewState,
  instrument: Instrument,
  highlighted: readonly Position[]
): string {
  const strings = stringsText(s.activeStrings);
  const frets = fretsText(s.region.start, s.region.end);
  if (s.selection.length === 0) {
    const key = `notes_desc_background_${s.background}` as const;
    return m[key]({ strings, frets });
  }
  const notes = spokenNoteList(s.selection.map(defaultSpelling));
  const summary =
    highlighted.length === 1
      ? m.notes_desc_selected_one({ notes, strings, frets })
      : m.notes_desc_selected({ notes, count: highlighted.length, strings, frets });
  const entries = [...highlighted]
    .sort((a, b) => b.string - a.string || a.fret - b.fret)
    .map((p) => {
      const pitch = positionPitch(instrument, p);
      const note = pitchLabel(defaultSpelling(pitchClass(pitch)), octaveOf(pitch));
      return p.fret === 0
        ? m.notes_desc_entry_open({ string: p.string, note })
        : m.notes_desc_entry({ string: p.string, fret: p.fret, note });
    });
  return entries.length > 0 ? `${summary} ${entries.join('; ')}` : summary;
}

export function buildNotesModel(s: NotesViewState, instrument: Instrument): NotesDisplay {
  const bg = backgroundSet(s.background);
  const tonesOn =
    !s.hideNames &&
    s.labelType !== 'none' &&
    (s.selection.length === 1 || s.labelType === 'octave');
  const markers: Marker[] = [];
  const highlighted: Position[] = [];
  let cardHighlighted = 0;
  const info = cardInfo(s, instrument);
  const cardKeys = new Set(
    info ? [info.position, ...info.unisons].map((q) => `${q.string}:${q.fret}`) : []
  );

  for (const p of allPositions(instrument)) {
    const pitch = positionPitch(instrument, p);
    const pc = pitchClass(pitch);
    const selected = s.selection.includes(pc);
    const inBg = bg.has(pc);
    const inFilter =
      s.activeStrings.includes(p.string) && p.fret >= s.region.start && p.fret <= s.region.end;
    const base = { string: p.string, fret: p.fret, function: 'neutral' } as const;

    if (info && cardKeys.has(`${p.string}:${p.fret}`)) {
      // 1a: tapped position and unisons; single highlight token, labeled even if otherwise hidden.
      cardHighlighted++;
      markers.push({ ...base, emphasis: 'highlighted', label: true });
    } else if (!selected && !inBg) {
      // 1b / 2
      markers.push({ ...base, emphasis: 'hidden' });
    } else if (info) {
      // 1c
      markers.push({ ...base, emphasis: 'dimmed', label: inFilter });
    } else if (!inFilter) {
      markers.push({ ...base, emphasis: 'dimmed', label: false });
    } else if (selected) {
      highlighted.push(p);
      markers.push({
        ...base,
        emphasis: 'highlighted',
        ...(tonesOn ? { tone: toneOf(octaveOf(pitch)) } : {}),
        octaveBadge: tonesOn && s.labelType === 'name'
      });
    } else if (s.selection.length === 0) {
      markers.push({ ...base, emphasis: 'normal' });
    } else {
      markers.push({ ...base, emphasis: 'dimmed', label: true });
    }
  }

  const steps = listenSteps(s, instrument);
  const base = describe(s, instrument, highlighted);
  const wholeNeck = s.region.start === 0 && s.region.end === instrument.fretCount;
  return {
    model: {
      ...(wholeNeck ? {} : { region: { start: s.region.start, end: s.region.end } }),
      markers,
      labelMode: s.hideNames ? 'none' : LABEL_MODE[s.labelType],
      hoverHint: !s.hideNames,
      description: info ? `${base} ${cardSentence(info)}` : base
    },
    highlightedCount: highlighted.length + cardHighlighted,
    missing: missingNotes(s, instrument),
    cardInfo: info,
    listenSteps: steps,
    listen: listenState(s, steps),
    emptyGuidance: s.background === 'none' && s.selection.length === 0
  };
}
