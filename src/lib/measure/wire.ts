/**
 * Wire format and allowlist for anonymous measurement (specs/028 contracts/measurement-wire.md).
 * Shared by the client and the `functions/m.ts` Pages Function, so it imports nothing but
 * `valibot`. Enum lists that mirror app types are copied here and guarded by an equality unit test.
 */
import * as v from 'valibot';

export const MAX_BODY_BYTES = 16_384;
export const MAX_BATCH = 10;

export const EVENT_TYPES = [
  'tool-opened',
  'first-interaction',
  'sound-played',
  'link-shared',
  'link-opened',
  'instrument-changed'
] as const;
export const FAILURE_KINDS = ['calculation', 'drawing', 'audio', 'missing-text'] as const;
export const EVENT_TOOLS = ['notes', 'triads', 'caged'] as const;
export const REPORT_TOOLS = ['notes', 'triads', 'caged', 'shell'] as const;
export const DEVICE_CLASSES = ['phone', 'tablet', 'desktop'] as const;
export const LANGUAGES = ['en', 'pt-BR', 'es'] as const;
export const HANDS = ['right', 'left'] as const;
export const TUNING_TRAITS = [
  'AF-1',
  'AF-2',
  'AF-3',
  'AF-4',
  'AF-5',
  'AF-6',
  'AF-7',
  'AF-8',
  'AF-9',
  'AF-10',
  'AF-11',
  'AF-21',
  'AF-22',
  'AF-23',
  'custom'
] as const;

export type EventType = (typeof EVENT_TYPES)[number];
export type FailureKind = (typeof FAILURE_KINDS)[number];
export type EventTool = (typeof EVENT_TOOLS)[number];
export type ReportTool = (typeof REPORT_TOOLS)[number];
export type DeviceClass = (typeof DEVICE_CLASSES)[number];
export type Language = (typeof LANGUAGES)[number];
export type Handedness = (typeof HANDS)[number];
export type TuningTrait = (typeof TUNING_TRAITS)[number];

export interface InstrumentTraits {
  readonly strings: 6 | 7;
  readonly tuning: TuningTrait;
  readonly hand: Handedness;
}
export interface InstrumentReport extends InstrumentTraits {
  readonly frets: number;
}

/** Instrument-config keys that must never appear in a report's `view`. */
const FORBIDDEN_VIEW_KEYS: readonly string[] = ['v', 'sc', 'tu', 'fr'];

const common = {
  device: v.picklist(DEVICE_CLASSES),
  lang: v.picklist(LANGUAGES),
  strings: v.picklist([6, 7] as const),
  tuning: v.picklist(TUNING_TRAITS),
  hand: v.picklist(HANDS)
};

const UsageEventSchema = v.pipe(
  v.object({
    r: v.literal('e'),
    type: v.picklist(EVENT_TYPES),
    tool: v.picklist(EVENT_TOOLS),
    ...common,
    start: v.optional(v.literal(true)),
    secs: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(3600)))
  }),
  v.check((e) => e.start === undefined || e.type === 'tool-opened', 'start only on tool-opened'),
  v.check(
    (e) => e.secs === undefined || e.type === 'first-interaction',
    'secs only on first-interaction'
  )
);

const ViewSchema = v.pipe(
  v.record(
    v.pipe(v.string(), v.regex(/^[a-z][a-z0-9]{0,15}$/)),
    v.pipe(v.string(), v.regex(/^[A-Za-z0-9._-]{0,48}$/))
  ),
  v.check((o) => Object.keys(o).length <= 24, 'at most 24 view entries'),
  v.check((o) => FORBIDDEN_VIEW_KEYS.every((k) => !(k in o)), 'no instrument keys in view')
);

const FailureReportSchema = v.pipe(
  v.object({
    r: v.literal('r'),
    kind: v.picklist(FAILURE_KINDS),
    tool: v.picklist(REPORT_TOOLS),
    ...common,
    frets: v.pipe(v.number(), v.integer(), v.minValue(12), v.maxValue(24)),
    ver: v.pipe(v.string(), v.regex(/^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]{1,32})?$/)),
    view: v.optional(ViewSchema),
    name: v.optional(v.pipe(v.string(), v.regex(/^[A-Za-z_$][\w$]{0,63}$/))),
    msg: v.optional(v.pipe(v.string(), v.maxLength(200))),
    key: v.optional(v.pipe(v.string(), v.regex(/^[a-z0-9_]{1,96}$/)))
  }),
  v.check(
    (r) =>
      r.kind === 'missing-text'
        ? r.key !== undefined && r.name === undefined && r.msg === undefined
        : r.key === undefined && r.name !== undefined && r.msg !== undefined,
    'name+msg for errors, key for missing-text'
  )
);

export type UsageEvent = v.InferOutput<typeof UsageEventSchema>;
export type FailureReport = v.InferOutput<typeof FailureReportSchema>;
export type WireItem = UsageEvent | FailureReport;

const ItemSchema = v.union([UsageEventSchema, FailureReportSchema]);

export interface Batch {
  v: 1;
  items: WireItem[];
}

/** A whole batch, strictly: every item must be valid. */
export const BatchSchema: v.GenericSchema<unknown, Batch> = v.object({
  v: v.literal(1),
  items: v.pipe(v.array(ItemSchema), v.minLength(1), v.maxLength(MAX_BATCH))
});

const EnvelopeSchema = v.object({
  v: v.literal(1),
  items: v.pipe(v.array(v.unknown()), v.minLength(1), v.maxLength(MAX_BATCH))
});

/** Valid items only, unknown keys stripped; anything that is not a good envelope yields none. */
export function parseItems(body: unknown): readonly WireItem[] {
  const envelope = v.safeParse(EnvelopeSchema, body);
  if (!envelope.success) return [];
  const out: WireItem[] = [];
  for (const raw of envelope.output.items) {
    const item = v.safeParse(ItemSchema, raw);
    if (item.success) out.push(item.output);
  }
  return out;
}
