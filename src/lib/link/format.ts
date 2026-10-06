/**
 * Wire vocabulary of link format v1 (specs/022 contracts/link-format.md). Frozen once released:
 * token spellings never follow internal type ids by passthrough (§8.3), they are mapped here.
 * Pure: no Svelte, DOM or i18n.
 */
import type { Background, LabelType } from '$lib/state/notes-view';
import type { SpellingOverride, TriadsView, TriadsLabelType } from '$lib/state/triads-view';
import type { CagedLabelType, LayersOn } from '$lib/state/caged-view';
import type { Quality } from '$lib/theory/triad';
import type { Inversion } from '$lib/theory/triad-shape';
import type { CagedQuality, CagedShapeId } from '$lib/theory/caged';
import type { LinkTool } from './types';

export const TOOLS: readonly LinkTool[] = Object.freeze(['notes', 'triads', 'caged']);

/** Parameter order per tool: `v` first, tool fields, then the common tail `sc` `tu` `fr`. */
export const PARAM_ORDER: Readonly<Record<LinkTool, readonly string[]>> = {
  notes: 'v sel str rg bg hn cd lb sc tu fr'.split(' '),
  triads: 'v rt sp q inv ss vw oc cmp cq lb sc tu fr'.split(' '),
  caged: 'v rt sp q fc ly cn ts lb tmp sc tu fr'.split(' ')
};

/** The single "none" token. */
export const NONE = '-';

/**
 * A closed vocabulary with an explicit two-way mapping. The encoder only needs `toToken`; the
 * reverse lookups live in `tokensOf` / `fromTokenOf` so the initial bundle (encoder only) drops them.
 */
export interface TokenMap<T extends string> {
  readonly table: Readonly<Record<T, string>>;
  toToken(value: T): string;
}

function toToken<T extends string>(this: TokenMap<T>, value: T): string {
  return this.table[value];
}

function tokenMap<T extends string>(table: Readonly<Record<T, string>>): TokenMap<T> {
  return { table, toToken };
}

/** Every wire token of the vocabulary, in declaration order. */
export function tokensOf<T extends string>(map: TokenMap<T>): readonly [string, ...string[]] {
  return Object.values(map.table) as unknown as readonly [string, ...string[]];
}

/** Reverse lookup: the value spelled by `token`, or `undefined`. */
export function fromTokenOf<T extends string>(map: TokenMap<T>, token: string): T | undefined {
  return (Object.keys(map.table) as T[]).find((value) => map.table[value] === token);
}

export const BACKGROUND = tokenMap<Background>({ naturals: 'naturals', all: 'all', none: 'none' });
export const NOTES_LABEL = tokenMap<LabelType>({ name: 'name', octave: 'octave', none: 'none' });
export const SPELLING = tokenMap<SpellingOverride>({ none: 'none', sharp: 'sharp', flat: 'flat' });
export const QUALITY = tokenMap<Quality>({
  major: 'major',
  minor: 'minor',
  diminished: 'diminished',
  augmented: 'augmented'
});
export const CAGED_QUALITY = tokenMap<CagedQuality>({ major: 'major', minor: 'minor' });
export const INVERSION = tokenMap<Inversion>({ root: 'root', first: 'first', second: 'second' });
export const TRIADS_VIEW = tokenMap<TriadsView>({
  isolated: 'isolated',
  'full-neck': 'full-neck',
  'all-notes': 'all-notes'
});
export const TRIADS_LABEL = tokenMap<TriadsLabelType>({ interval: 'interval', name: 'name' });
export const CAGED_LABEL = tokenMap<CagedLabelType>({ interval: 'interval', name: 'name' });
export const CAGED_LETTER = tokenMap<CagedShapeId>({ C: 'C', A: 'A', G: 'G', E: 'E', D: 'D' });

/** Layer digit order in `ly`. */
export const LAYER_ORDER: readonly (keyof LayersOn)[] = Object.freeze([
  'chord',
  'arpeggio',
  'pentatonic',
  'scale',
  'triad'
]);

export const bool = (b: boolean): string => (b ? '1' : '0');

export const list = (xs: readonly number[]): string => (xs.length === 0 ? NONE : xs.join('.'));

export const layersToken = (l: LayersOn): string => LAYER_ORDER.map((k) => bool(l[k])).join('');

/** `null` when the digits are not exactly five 0/1, or none is set. */
export function layersOf(token: string): LayersOn | null {
  if (!/^[01]{5}$/.test(token) || !token.includes('1')) return null;
  const on = (i: number): boolean => token[i] === '1';
  return { chord: on(0), arpeggio: on(1), pentatonic: on(2), scale: on(3), triad: on(4) };
}

/** `-` → `[]`; `a.b.c` → ints; anything else → `null`. */
export function intsOf(token: string): number[] | null {
  if (token === NONE) return [];
  const out: number[] = [];
  for (const part of token.split('.')) {
    if (!/^(0|[1-9][0-9]{0,5})$/.test(part)) return null;
    out.push(Number(part));
  }
  return out;
}
