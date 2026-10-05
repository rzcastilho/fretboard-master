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
  cagedOccurrences,
  cagedTuningClass,
  fitCount,
  occurrenceRootStrings,
  type CagedDegree,
  type CagedShape,
  type CagedTuningClass,
  type ShapeOccurrence
} from '../theory/caged';
import { pitchOfSpelling, type Pitch, type Spelling } from '../theory/pitch';
import { otherRootSpelling, spellTriad, type TriadFunction } from '../theory/triad';
import { cagedRootSpelling, type CagedViewState } from './caged-view';
import { qualityName } from './triads-model';

/** Tuning context for the display (slice 015). */
export interface CagedContext {
  readonly tuningName: string;
  readonly temporary: boolean;
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
  context: CagedContext
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
      switchTo: otherRootSpelling(view.rootPc, root)
    };
  }

  const altered = tuningClass === 'altered-string';
  const occurrences = cagedOccurrences(
    sixHighestOpen(instrument),
    view.rootPc,
    view.quality,
    instrument.fretCount
  );

  const markers: Marker[] = [];
  const seen = new Set<string>();
  for (const occ of occurrences) {
    for (const n of occ.notes) {
      const id = `${n.string}:${n.fret}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const fn = FUNCTION_OF[n.degree];
      markers.push({
        string: n.string,
        fret: n.fret,
        function: fn,
        emphasis: 'normal',
        spelling: triad[fn],
        interval: n.degree,
        id
      });
    }
  }

  const tags: FretboardTag[] = occurrences.map((o) => {
    const label = cagedTagText(o);
    return {
      id: `${o.shape.id}@${o.start}`,
      start: o.start,
      end: o.end,
      label,
      name: label,
      pressed: false
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
  const description = [
    temporary
      ? m.caged_description_temporary({ tuning: tuningName })
      : m.caged_description_tuning({ tuning: tuningName }),
    ...(altered ? [m.caged_description_altered({ string: 6 })] : []),
    m.caged_description_summary({ key: spokenKey, count: occurrences.length }),
    ...entries
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
      tagsInteractive: false,
      description,
      ...(altered ? { stringMarks: [{ string: 6, label: m.caged_altered_mark() }] } : {})
    },
    switchTo: otherRootSpelling(view.rootPc, root)
  };
}
