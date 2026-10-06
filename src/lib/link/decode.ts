/**
 * Link decoder (specs/022 R-05, data-model §1). Total: never throws. Each field falls back on its
 * own to its default and its key is listed in `fellBack`. Pure: no DOM, Svelte or i18n.
 *
 * Applying a decoded snapshot to the app is slice 006/002; this slice exercises decode in tests.
 */
import * as v from 'valibot';
import { isOffsets, referencePitches } from '$lib/instrument/custom-tuning';
import {
  DEFAULT_FRETS,
  DEFAULT_STRING_COUNT,
  MAX_FRETS,
  MIN_FRETS,
  isTuningIdFor,
  standardTuningId,
  tuningFromOffsets,
  tuningInstrument,
  type StringCount,
  type Tuning
} from '$lib/instrument/tunings';
import { isValidPosition, type Instrument } from '$lib/instrument/instrument';
import type { PitchClass } from '$lib/theory/pitch';
import { isAlteredRoot } from '$lib/theory/triad';
import { CHORD_ONLY } from '$lib/state/caged-layers';
import type { CagedFocus, CagedViewState } from '$lib/state/caged-view';
import { initialNotesView, revalidate as revalidateNotes } from '$lib/state/notes-view';
import type { NotesViewState } from '$lib/state/notes-view';
import {
  initialTriadsView,
  revalidate as revalidateTriads,
  type TriadsCompare,
  type TriadsViewState
} from '$lib/state/triads-view';
import {
  BACKGROUND,
  CAGED_LABEL,
  CAGED_LETTER,
  CAGED_QUALITY,
  INVERSION,
  NONE,
  NOTES_LABEL,
  QUALITY,
  SPELLING,
  TRIADS_LABEL,
  TRIADS_VIEW,
  fromTokenOf,
  intsOf,
  layersOf,
  type TokenMap
} from './format';
import {
  BAD,
  CagedSchema,
  NotesSchema,
  TriadsSchema,
  isBad,
  parseVersion,
  type Bad
} from './schema';
import type { DecodeResult, LinkInstrument, LinkTool, ShareSnapshot } from './types';

const TOOL_PATHS: Readonly<Record<string, LinkTool>> = Object.freeze({
  '/notes': 'notes',
  '/triads': 'triads',
  '/caged': 'caged'
});

type Raw = Record<string, string | undefined>;

/** Takes a parsed field or its default, and records the key when the field was bad. */
class Fallbacks {
  readonly keys: string[] = [];

  pick<T>(key: string, value: T | Bad | undefined, fallback: T): T {
    if (value === undefined || isBad(value)) {
      this.keys.push(key);
      return fallback;
    }
    return value;
  }

  note(key: string): void {
    if (!this.keys.includes(key)) this.keys.push(key);
  }
}

/** First occurrence of each wanted key; later duplicates and unknown keys are ignored. */
function rawOf(params: URLSearchParams, keys: readonly string[]): Raw {
  const raw: Raw = {};
  for (const key of keys) raw[key] = params.get(key) ?? undefined;
  return raw;
}

const fromMap = <T extends string>(map: TokenMap<T>, token: string | Bad): T | Bad =>
  isBad(token) ? BAD : (fromTokenOf(map, token) ?? BAD);

const intIn = (token: string | Bad, min: number, max: number): number | Bad => {
  if (isBad(token)) return BAD;
  const n = Number(token);
  return Number.isInteger(n) && n >= min && n <= max ? n : BAD;
};

const boolOf = (token: string | Bad): boolean | Bad => (isBad(token) ? BAD : token === '1');

/* ---------- instrument ---------- */

function tuningOf(token: string | Bad, count: StringCount): Tuning | Bad {
  if (isBad(token)) return BAD;
  if (token.startsWith('c.')) {
    const pitches = token.slice(2).split('.').map(Number);
    if (pitches.length !== count || pitches.some((p) => !Number.isInteger(p) || p > 127))
      return BAD;
    const ref = referencePitches(count);
    const offsets = [...pitches].reverse().map((pitch, i) => pitch - ref[i]);
    if (!isOffsets(offsets, count)) return BAD;
    // A custom list equal to a preset decodes to the preset (ADR 0014).
    return tuningFromOffsets(Object.freeze(offsets));
  }
  return isTuningIdFor(token, count) ? Object.freeze({ kind: 'preset', id: token }) : BAD;
}

interface Parsed {
  readonly instrument: LinkInstrument;
  readonly inst: Instrument;
}

function instrumentOf(
  r: { sc: string | Bad; tu: string | Bad; fr: string | Bad },
  fb: Fallbacks
): Parsed {
  const count = fb.pick<StringCount>(
    'sc',
    isBad(r.sc) ? BAD : (Number(r.sc) as StringCount),
    DEFAULT_STRING_COUNT
  );
  const tuning = fb.pick<Tuning>(
    'tu',
    tuningOf(r.tu, count),
    Object.freeze({ kind: 'preset', id: standardTuningId(count) })
  );
  const fretCount = fb.pick<number>('fr', intIn(r.fr, MIN_FRETS, MAX_FRETS), DEFAULT_FRETS);
  return {
    instrument: { stringCount: count, tuning, fretCount },
    inst: tuningInstrument(tuning, count, fretCount)
  };
}

/* ---------- tools ---------- */

function decodeNotes(params: URLSearchParams, fb: Fallbacks): ShareSnapshot {
  const r = v.parse(NotesSchema, rawOf(params, Object.keys(NotesSchema.entries)));
  const { instrument, inst } = instrumentOf(r, fb);
  const base = initialNotesView(inst);

  const selection = ((): PitchClass[] | Bad => {
    if (isBad(r.sel)) return BAD;
    const xs = intsOf(r.sel);
    return xs !== null &&
      xs.length <= 12 &&
      xs.every((n) => n <= 11) &&
      new Set(xs).size === xs.length
      ? xs
      : BAD;
  })();

  const activeStrings = ((): number[] | Bad => {
    if (isBad(r.str)) return BAD;
    const xs = intsOf(r.str);
    if (xs === null || xs.length === 0 || new Set(xs).size !== xs.length) return BAD;
    return xs.every((n) => n >= 1 && n <= instrument.stringCount)
      ? [...xs].sort((a, b) => a - b)
      : BAD;
  })();

  const region = ((): { start: number; end: number } | Bad => {
    if (isBad(r.rg)) return BAD;
    const xs = intsOf(r.rg);
    if (xs === null || xs.length !== 2) return BAD;
    const [start, end] = xs;
    return start <= end && end <= instrument.fretCount ? { start, end } : BAD;
  })();

  const card = ((): { string: number; fret: number } | null | Bad => {
    if (isBad(r.cd)) return BAD;
    if (r.cd === NONE) return null;
    const xs = intsOf(r.cd);
    if (xs === null || xs.length !== 2) return BAD;
    const p = { string: xs[0], fret: xs[1] };
    return isValidPosition(inst, p) ? p : BAD;
  })();

  const view: NotesViewState = revalidateNotes(
    {
      selection: fb.pick('sel', selection, base.selection),
      activeStrings: fb.pick('str', activeStrings, base.activeStrings),
      region: fb.pick('rg', region, base.region),
      background: fb.pick('bg', fromMap(BACKGROUND, r.bg), base.background),
      hideNames: fb.pick('hn', boolOf(r.hn), base.hideNames),
      card: fb.pick('cd', card, base.card),
      labelType: fb.pick('lb', fromMap(NOTES_LABEL, r.lb), base.labelType)
    },
    inst
  );
  return { tool: 'notes', view, instrument };
}

function decodeTriads(params: URLSearchParams, fb: Fallbacks): ShareSnapshot {
  const r = v.parse(TriadsSchema, rawOf(params, Object.keys(TriadsSchema.entries)));
  const { instrument, inst } = instrumentOf(r, fb);
  const base = initialTriadsView(inst);

  const rootPc = fb.pick<PitchClass>('rt', intIn(r.rt, 0, 11), base.rootPc);
  const spelling = fromMap(SPELLING, r.sp);
  const spellingOverride = fb.pick(
    'sp',
    !isBad(spelling) && spelling !== 'none' && !isAlteredRoot(rootPc) ? BAD : spelling,
    base.spellingOverride
  );
  const quality = fb.pick('q', fromMap(QUALITY, r.q), base.quality);
  const cq = isBad(r.cq) ? BAD : r.cq === NONE ? null : (fromTokenOf(QUALITY, r.cq) ?? BAD);
  const cmp = boolOf(r.cmp);

  // Invariant: `on ⇒ quality ∉ {null, state.quality}`; a remembered quality may not equal it either.
  const cqOk = !isBad(cq) && cq !== quality;
  if (isBad(r.cq) || isBad(cq) || (cq !== null && cq === quality)) fb.note('cq');
  let compare: TriadsCompare = { on: false, quality: cqOk ? cq : null };
  if (isBad(cmp)) {
    fb.note('cmp');
  } else if (cmp) {
    if (cqOk && cq !== null) compare = { on: true, quality: cq };
    else fb.note('cmp');
  }

  const decoded: TriadsViewState = {
    rootPc,
    spellingOverride,
    quality,
    inversion: fb.pick('inv', fromMap(INVERSION, r.inv), base.inversion),
    stringSet: fb.pick('ss', intIn(r.ss, 3, instrument.stringCount), base.stringSet),
    labelType: fb.pick('lb', fromMap(TRIADS_LABEL, r.lb), base.labelType),
    occurrence: fb.pick('oc', intIn(r.oc, 0, 999_999), base.occurrence),
    view: fb.pick('vw', fromMap(TRIADS_VIEW, r.vw), base.view),
    compare
  };
  // Cross-field clamp (occurrence count). Anything it changes is reported on that key.
  const view = revalidateTriads(decoded, inst);
  if (view.stringSet !== decoded.stringSet) fb.note('ss');
  if (view.occurrence !== decoded.occurrence) fb.note('oc');
  return { tool: 'triads', view, instrument };
}

function decodeCaged(params: URLSearchParams, fb: Fallbacks): ShareSnapshot {
  const r = v.parse(CagedSchema, rawOf(params, Object.keys(CagedSchema.entries)));
  const { instrument } = instrumentOf(r, fb);

  const focus = ((): CagedFocus | null | Bad => {
    if (isBad(r.fc)) return BAD;
    if (r.fc === NONE) return null;
    const [letter, ordinal] = r.fc.split('.');
    const id = fromTokenOf(CAGED_LETTER, letter);
    return id === undefined ? BAD : { letter: id, ordinal: Number(ordinal) };
  })();

  const layersParsed = isBad(r.ly) ? BAD : (layersOf(r.ly) ?? BAD);
  const layers = fb.pick('ly', layersParsed, CHORD_ONLY);

  const triadSet = ((): number | null | Bad => {
    if (isBad(r.ts)) return BAD;
    if (r.ts === NONE) return null;
    // Non-null only while the Triad layer is on.
    return layers.triad ? intIn(r.ts, 3, instrument.stringCount) : BAD;
  })();

  const view: CagedViewState = {
    rootPc: fb.pick<PitchClass>('rt', intIn(r.rt, 0, 11), 0),
    spellingOverride: 'none',
    quality: fb.pick('q', fromMap(CAGED_QUALITY, r.q), 'major'),
    focus: fb.pick('fc', focus, null),
    connections: fb.pick('cn', boolOf(r.cn), false),
    layers,
    triadSet: fb.pick('ts', triadSet, null),
    labelType: fb.pick('lb', fromMap(CAGED_LABEL, r.lb), 'interval')
  };
  const spelling = fromMap(SPELLING, r.sp);
  const override = fb.pick(
    'sp',
    !isBad(spelling) && spelling !== 'none' && !isAlteredRoot(view.rootPc) ? BAD : spelling,
    'none'
  );
  const temporary = fb.pick('tmp', boolOf(r.tmp), false);
  return { tool: 'caged', view: { ...view, spellingOverride: override }, instrument, temporary };
}

/** Decode a share link. Never throws. */
export function decodeLink(url: URL): DecodeResult {
  try {
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/$/, '') : url.pathname;
    const tool = Object.hasOwn(TOOL_PATHS, path) ? TOOL_PATHS[path] : undefined;
    if (tool === undefined) return { kind: 'not-a-tool' };

    const version = parseVersion(url.searchParams.get('v'));
    if (version === null) return { kind: 'invalid' };
    if (version > 1) return { kind: 'unsupported-version', version };

    const fb = new Fallbacks();
    const snapshot =
      tool === 'notes'
        ? decodeNotes(url.searchParams, fb)
        : tool === 'triads'
          ? decodeTriads(url.searchParams, fb)
          : decodeCaged(url.searchParams, fb);
    return { kind: 'ok', snapshot, fellBack: fb.keys };
  } catch {
    // Total by contract (Constitution IX): an unforeseen failure is an invalid link, not a crash.
    return { kind: 'invalid' };
  }
}
