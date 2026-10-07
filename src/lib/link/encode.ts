/**
 * Link encoder (specs/022 contracts/link-format.md). Pure and total over valid snapshots.
 * The string is built by concatenation: every value is `[A-Za-z0-9.-]`, so there is never any
 * percent-encoding and no `URLSearchParams` ordering to depend on.
 */
import { referencePitches } from '$lib/instrument/custom-tuning';
import type { Tuning } from '$lib/instrument/tunings';
import type { NotesViewState } from '$lib/state/notes-view';
import type { TriadsViewState } from '$lib/state/triads-view';
import type { CagedViewState } from '$lib/state/caged-view';
import {
  BACKGROUND,
  CAGED_LABEL,
  CAGED_LETTER,
  CAGED_QUALITY,
  INVERSION,
  NONE,
  NOTES_LABEL,
  PARAM_ORDER,
  QUALITY,
  SPELLING,
  TRIADS_LABEL,
  TRIADS_VIEW,
  bool,
  layersToken,
  list
} from './format';
import type { LinkInstrument, LinkTool, ShareSnapshot } from './types';

export const LINK_VERSION = 1;

export function linkPath(tool: LinkTool): string {
  return `/${tool}`;
}

/** Preset id, or `c.` and each string's MIDI pitch, string 1 (highest) → string n (R-03). */
function tuningToken(tuning: Tuning, stringCount: LinkInstrument['stringCount']): string {
  if (tuning.kind === 'preset') return tuning.id;
  const ref = referencePitches(stringCount);
  const lowToHigh = tuning.offsets.map((offset, i) => ref[i] + offset);
  return `c.${lowToHigh.reverse().join('.')}`;
}

function instrumentFields(i: LinkInstrument): Record<string, string> {
  return {
    sc: String(i.stringCount),
    tu: tuningToken(i.tuning, i.stringCount),
    fr: String(i.fretCount)
  };
}

function notesFields(v: NotesViewState): Record<string, string> {
  return {
    sel: list(v.selection),
    str: list([...v.activeStrings].sort((a, b) => a - b)),
    rg: `${v.region.start}.${v.region.end}`,
    bg: BACKGROUND.toToken(v.background),
    hn: bool(v.hideNames),
    cd: v.card === null ? NONE : `${v.card.string}.${v.card.fret}`,
    lb: NOTES_LABEL.toToken(v.labelType)
  };
}

function triadsFields(v: TriadsViewState): Record<string, string> {
  return {
    rt: String(v.rootPc),
    sp: SPELLING.toToken(v.spellingOverride),
    q: QUALITY.toToken(v.quality),
    inv: INVERSION.toToken(v.inversion),
    ss: String(v.stringSet),
    vw: TRIADS_VIEW.toToken(v.view),
    oc: String(v.occurrence),
    cmp: bool(v.compare.on),
    // Always written, even when compare is off: the store remembers it (R-04).
    cq: v.compare.quality === null ? NONE : QUALITY.toToken(v.compare.quality),
    lb: TRIADS_LABEL.toToken(v.labelType)
  };
}

function cagedFields(v: CagedViewState, temporary: boolean): Record<string, string> {
  return {
    rt: String(v.rootPc),
    sp: SPELLING.toToken(v.spellingOverride),
    q: CAGED_QUALITY.toToken(v.quality),
    fc: v.focus === null ? NONE : `${CAGED_LETTER.toToken(v.focus.letter)}.${v.focus.ordinal}`,
    ly: layersToken(v.layers),
    cn: bool(v.connections),
    ts: v.triadSet === null ? NONE : String(v.triadSet),
    lb: CAGED_LABEL.toToken(v.labelType),
    tmp: bool(temporary)
  };
}

function toolFields(s: ShareSnapshot): Record<string, string> {
  switch (s.tool) {
    case 'notes':
      return notesFields(s.view);
    case 'triads':
      return triadsFields(s.view);
    case 'caged':
      return cagedFields(s.view, s.temporary);
  }
}

/** `<origin>/<tool>?v=1&…`, every parameter explicit and in the frozen order. */
export function encodeLink(snapshot: ShareSnapshot, origin: string): string {
  const fields: Record<string, string> = {
    v: String(LINK_VERSION),
    ...toolFields(snapshot),
    ...instrumentFields(snapshot.instrument)
  };
  const query = PARAM_ORDER[snapshot.tool].map((key) => `${key}=${fields[key]}`).join('&');
  return `${origin}${linkPath(snapshot.tool)}?${query}`;
}

/** Instrument keys and the version never belong in a measurement report (R-11). */
const NOT_VIEW = new Set(['v', 'sc', 'tu', 'fr']);

/** The tool's own view tokens only: no version, no instrument, no origin or path. */
export function viewParams(snapshot: ShareSnapshot): Record<string, string> {
  const fields = toolFields(snapshot);
  const out: Record<string, string> = {};
  for (const key of PARAM_ORDER[snapshot.tool]) {
    if (!NOT_VIEW.has(key) && key in fields) out[key] = fields[key];
  }
  return out;
}
