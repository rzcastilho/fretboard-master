/**
 * Valibot field schemas for link format v1 (specs/022 R-05, R-12). Pure: only `object`, `picklist`,
 * `pipe`, `regex` and `fallback` are used. Each field is parsed on its own and falls back to the
 * `BAD` sentinel, so the decoder can substitute that field's default and report its key.
 *
 * Schemas check the token grammar and closed vocabularies; ranges and cross-field rules that need
 * the instrument are applied by `decode.ts` on the parsed tokens.
 */
import * as v from 'valibot';
import {
  BACKGROUND,
  CAGED_LABEL,
  CAGED_LETTER,
  CAGED_QUALITY,
  INVERSION,
  NOTES_LABEL,
  QUALITY,
  SPELLING,
  TRIADS_LABEL,
  TRIADS_VIEW,
  tokensOf,
  type TokenMap
} from './format';

/** A field that was missing or failed its schema. */
export const BAD = Symbol('link-field-bad');
export type Bad = typeof BAD;

export const isBad = (x: unknown): x is Bad => x === BAD;

type Field<T> = v.GenericSchema<unknown, T | Bad>;

const field = <T>(schema: v.GenericSchema<unknown, T>): Field<T> =>
  v.fallback(schema, BAD as never) as unknown as Field<T>;

const token = (re: RegExp): Field<string> => field(v.pipe(v.string(), v.regex(re)));

const INT = '(?:0|[1-9][0-9]{0,5})';
const oneOf = <T extends string>(map: TokenMap<T>): Field<string> =>
  field(v.picklist(tokensOf(map)));

const bool = field(v.picklist(['0', '1'] as const));
const int = token(new RegExp(`^${INT}$`));
/** `-` or a dot-separated list of up to 24 ints. */
const intList = token(new RegExp(`^(?:-|${INT}(?:\\.${INT}){0,23})$`));
const intPair = token(new RegExp(`^${INT}\\.${INT}$`));
const noneOrPair = token(new RegExp(`^(?:-|${INT}\\.${INT})$`));
const noneOrInt = token(new RegExp(`^(?:-|${INT})$`));

const common = {
  sc: field(v.picklist(['6', '7'] as const)),
  tu: token(/^(?:AF-[0-9]{1,2}|c(?:\.[0-9]{1,3}){6,7})$/),
  fr: int
};

export const NotesSchema = v.object({
  sel: intList,
  str: intList,
  rg: intPair,
  bg: oneOf(BACKGROUND),
  hn: bool,
  cd: noneOrPair,
  lb: oneOf(NOTES_LABEL),
  ...common
});

export const TriadsSchema = v.object({
  rt: int,
  sp: oneOf(SPELLING),
  q: oneOf(QUALITY),
  inv: oneOf(INVERSION),
  ss: int,
  vw: oneOf(TRIADS_VIEW),
  oc: int,
  cmp: bool,
  cq: field(v.picklist(['-', ...tokensOf(QUALITY)] as [string, ...string[]])),
  lb: oneOf(TRIADS_LABEL),
  ...common
});

export const CagedSchema = v.object({
  rt: int,
  sp: oneOf(SPELLING),
  q: oneOf(CAGED_QUALITY),
  fc: token(new RegExp(`^(?:-|[${tokensOf(CAGED_LETTER).join('')}]\\.${INT})$`)),
  ly: token(/^[01]{5}$/),
  cn: bool,
  ts: noneOrInt,
  lb: oneOf(CAGED_LABEL),
  tmp: bool,
  ...common
});

/** Every tool's keys that the schemas read, for building the raw input object. */
export const SCHEMA_KEYS = {
  notes: Object.keys(NotesSchema.entries),
  triads: Object.keys(TriadsSchema.entries),
  caged: Object.keys(CagedSchema.entries)
} as const;

const VERSION = v.pipe(v.string(), v.regex(/^[1-9][0-9]{0,8}$/));

/** `v`: a positive integer (up to 9 digits), else `null`. */
export function parseVersion(raw: string | null): number | null {
  const r = v.safeParse(VERSION, raw);
  return r.success ? Number(r.output) : null;
}
