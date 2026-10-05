/**
 * CAGED display model (contracts/caged-api §3). Pure + paraglide for text.
 * Turns the view state and instrument into the fretboard `DisplayModel`.
 * Shape letters are literal parameters and never pass through `src/lib/notation`.
 */
import { m } from '$lib/paraglide/messages.js';
import type { DisplayModel, FretboardTag, Marker } from '../fretboard/types';
import type { Instrument } from '../instrument/instrument';
import { noteLabel, spokenNote } from '../notation/notation';
import {
  cagedConnections,
  cagedOccurrences,
  cagedTuningClass,
  fitCount,
  occurrenceRootStrings,
  type CagedConnection,
  type CagedDegree,
  type CagedShapeId,
  type CagedShape,
  type CagedTuningClass,
  type ShapeOccurrence
} from '../theory/caged';
import { pitchOfSpelling, type Pitch, type Spelling } from '../theory/pitch';
import { otherRootSpelling, spellTriad, type TriadFunction } from '../theory/triad';
import { drawnLetters, occurrenceIndex, stepAvailability } from './caged-focus';
import { cagedRootSpelling, type CagedViewState } from './caged-view';
import { qualityName } from './triads-model';

/** Tuning context for the display (slice 015). */
export interface CagedContext {
  readonly tuningName: string;
  readonly temporary: boolean;
}

/** Shared positions of the departing and arriving shapes after a step (data-model §3). */
export interface StepTransition {
  /** "s:f" keys. */
  readonly positions: readonly string[];
}

export interface CagedDisplay {
  readonly keyName: string;
  readonly tuningName: string;
  /** Name of the temporary tuning being shown, else null. */
  readonly temporaryName: string | null;
  /** Explanation for tunings CAGED cannot draw, else null. */
  readonly unsupportedNotice: string | null;
  readonly tuningClass: CagedTuningClass;
  readonly occurrences: readonly ShapeOccurrence[];
  readonly fitCount: number;
  readonly fitNote: string | null;
  readonly model: DisplayModel | null;
  readonly switchTo: Spelling | null;
  /** Index into `occurrences` of the focused shape, else null. */
  readonly focusIndex: number | null;
  readonly focused: ShapeOccurrence | null;
  readonly steps: { readonly previous: boolean; readonly next: boolean };
  readonly drawnLetters: ReadonlySet<CagedShapeId>;
  /** Positions shared by adjacent drawn occurrences; [] for a non-compatible tuning. */
  readonly connections: readonly CagedConnection[];
}

const NO_STEPS = { previous: false, next: false } as const;
const NO_LETTERS: ReadonlySet<CagedShapeId> = new Set();

/** The drawn occurrences (sorted by start) for the view and instrument; [] when non-compatible. */
export function cagedOccurrencesFor(
  view: CagedViewState,
  instrument: Instrument
): readonly ShapeOccurrence[] {
  const open = sixHighestOpen(instrument);
  if (cagedTuningClass(open) === 'non-compatible') return [];
  return [...cagedOccurrences(open, view.rootPc, view.quality, instrument.fretCount)].sort(
    (a, b) => a.start - b.start
  );
}

const FUNCTION_OF: Readonly<Record<CagedDegree, TriadFunction>> = {
  R: 'root',
  '3': 'third',
  b3: 'third',
  '5': 'fifth'
};

function intervalName(d: CagedDegree): string {
  switch (d) {
    case 'R':
      return m.caged_interval_root();
    case '3':
      return m.caged_interval_third();
    case 'b3':
      return m.caged_interval_flat_third();
    default:
      return m.caged_interval_fifth();
  }
}

/** Open pitches of the six highest strings, string 6 → 1 (a 7th string is ignored). */
export function sixHighestOpen(instrument: Instrument): readonly Pitch[] {
  return instrument.openStrings.slice(0, 6).map(pitchOfSpelling).reverse();
}

const strings = (o: ShapeOccurrence): string => occurrenceRootStrings(o).join(', ');

/** Visible tag text, e.g. "C shape · roots on strings 5, 2" (minor: "Cm shape · …"). */
export function cagedTagText(occ: ShapeOccurrence): string {
  const shape: CagedShape = occ.shape;
  const params = { shape: shape.id, strings: strings(occ) };
  return shape.quality === 'major' ? m.caged_tag_major(params) : m.caged_tag_minor(params);
}

export function buildCagedModel(
  view: CagedViewState,
  instrument: Instrument,
  context: CagedContext,
  transition: StepTransition | null = null
): CagedDisplay {
  const { tuningName, temporary } = context;
  const temporaryName = temporary ? tuningName : null;
  const root = cagedRootSpelling(view);
  const triad = spellTriad(root, view.quality);
  const keyName = m.caged_key_name({ root: noteLabel(root), quality: qualityName(view.quality) });
  const spokenKey = m.caged_key_name({
    root: spokenNote(root),
    quality: qualityName(view.quality)
  });

  const tuningClass = cagedTuningClass(sixHighestOpen(instrument));
  if (tuningClass === 'non-compatible') {
    return {
      keyName,
      tuningName,
      temporaryName,
      unsupportedNotice: m.caged_tuning_unsupported({ tuning: tuningName }),
      tuningClass,
      occurrences: [],
      fitCount: 0,
      fitNote: null,
      model: null,
      switchTo: otherRootSpelling(view.rootPc, root),
      focusIndex: null,
      focused: null,
      steps: NO_STEPS,
      drawnLetters: NO_LETTERS,
      connections: []
    };
  }

  const altered = tuningClass === 'altered-string';
  const occurrences = cagedOccurrencesFor(view, instrument);
  const focusIndex = occurrenceIndex(view.focus, occurrences);
  const focused = focusIndex === null ? null : occurrences[focusIndex];
  const inFocus = new Set(focused ? focused.notes.map((n) => `${n.string}:${n.fret}`) : []);
  const stepping = new Set(transition?.positions ?? []);
  const connections = cagedConnections(occurrences);
  const connected = new Set(
    view.connections ? connections.map((c) => `${c.string}:${c.fret}`) : []
  );

  const markers: Marker[] = [];
  const seen = new Set<string>();
  for (const occ of occurrences) {
    for (const n of occ.notes) {
      const id = `${n.string}:${n.fret}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const fn = FUNCTION_OF[n.degree];
      const inStep = stepping.has(id);
      const ringed = inStep || connected.has(id);
      markers.push({
        string: n.string,
        fret: n.fret,
        function: fn,
        emphasis:
          inStep || inFocus.has(id) ? 'highlighted' : focused === null ? 'normal' : 'dimmed',
        spelling: triad[fn],
        interval: n.degree,
        id,
        ...(ringed ? { ring: true } : {})
      });
    }
  }

  const tags: FretboardTag[] = occurrences.map((o, i) => {
    const label = cagedTagText(o);
    return {
      id: `${o.shape.id}@${o.start}`,
      start: o.start,
      end: o.end,
      label,
      name: label,
      pressed: i === focusIndex
    };
  });

  const entries = occurrences.map((o) =>
    m.caged_description_entry({
      shape: o.shape.id,
      lo: o.start,
      hi: o.end,
      strings: strings(o),
      notes: o.notes
        .map((n) =>
          n.fret === 0
            ? m.caged_description_note_open({
                string: n.string,
                interval: intervalName(n.degree)
              })
            : m.caged_description_note({
                string: n.string,
                fret: n.fret,
                interval: intervalName(n.degree)
              })
        )
        .join(', ')
    })
  );
  const connectionSentences = view.connections
    ? connections.map((c) => {
        const [lower, upper] = c.pairs[0];
        return m.caged_description_connection({
          string: c.string,
          fret: c.fret,
          interval: intervalName(c.degree),
          a: occurrences[lower].shape.id,
          b: occurrences[upper].shape.id
        });
      })
    : [];
  const focusSentence = focused
    ? m.caged_focus_status({ shape: focused.shape.id, lo: focused.start, hi: focused.end })
    : m.caged_focus_none();
  const description = [
    focusSentence,
    temporary
      ? m.caged_description_temporary({ tuning: tuningName })
      : m.caged_description_tuning({ tuning: tuningName }),
    ...(altered ? [m.caged_description_altered({ string: 6 })] : []),
    m.caged_description_summary({ key: spokenKey, count: occurrences.length }),
    ...entries,
    ...connectionSentences
  ].join(' ');

  const fit = fitCount(occurrences);
  const fitNote = fit < 5 ? m.caged_fit_note({ frets: instrument.fretCount, count: fit }) : null;

  return {
    keyName,
    tuningName,
    temporaryName,
    unsupportedNotice: null,
    tuningClass,
    occurrences,
    fitCount: fit,
    fitNote,
    model: {
      markers,
      labelMode: 'interval',
      tags,
      tagsInteractive: true,
      ...(focused
        ? { region: { start: focused.start, end: focused.end, align: 'center' as const } }
        : {}),
      description,
      ...(altered ? { stringMarks: [{ string: 6, label: m.caged_altered_mark() }] } : {})
    },
    switchTo: otherRootSpelling(view.rootPc, root),
    focusIndex,
    focused,
    steps: stepAvailability(view.focus, occurrences),
    drawnLetters: drawnLetters(occurrences),
    connections
  };
}
