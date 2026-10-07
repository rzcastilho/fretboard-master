import { describe, expect, it } from 'vitest';
import { HANDEDNESS } from '$lib/instrument/instrument';
import { TUNING_PRESETS } from '$lib/instrument/tunings';
import { LANGUAGE_TAGS } from '$lib/i18n/languages';
import {
  BatchSchema,
  HANDS,
  LANGUAGES,
  MAX_BATCH,
  MAX_BODY_BYTES,
  TUNING_TRAITS,
  parseItems
} from '../../../src/lib/measure/wire';
import * as v from 'valibot';

const event = {
  r: 'e',
  type: 'first-interaction',
  tool: 'triads',
  device: 'phone',
  lang: 'pt-BR',
  strings: 6,
  tuning: 'AF-1',
  hand: 'right',
  secs: 9
};
const report = {
  r: 'r',
  kind: 'drawing',
  tool: 'triads',
  device: 'desktop',
  lang: 'en',
  strings: 6,
  tuning: 'custom',
  hand: 'left',
  frets: 22,
  ver: '0.1.0',
  view: { rt: 'c', q: 'maj', inv: 'root', ss: '1', vw: 'one', lb: 'interval' },
  name: 'TypeError',
  msg: "Cannot read properties of undefined (reading 'x')"
};
const omit = (o: Record<string, unknown>, keys: string[]) =>
  Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
const batch = (items: unknown[], extra: object = {}) => ({ v: 1, items, ...extra });

describe('wire enums mirror the app', () => {
  it('Language = LANGUAGES', () => expect([...LANGUAGES]).toEqual([...LANGUAGE_TAGS]));
  it('Handedness = HANDEDNESS', () => expect([...HANDS]).toEqual([...HANDEDNESS]));
  it('TuningTrait = preset ids + custom', () =>
    expect([...TUNING_TRAITS]).toEqual([...TUNING_PRESETS.map((t) => t.id), 'custom']));
});

describe('parseItems', () => {
  it('accepts the contract examples', () => {
    expect(parseItems(batch([event, report]))).toHaveLength(2);
  });

  it('accepts start on tool-opened and a missing-text report', () => {
    const opened = { ...event, type: 'tool-opened', start: true, secs: undefined };
    const base = omit(report, ['name', 'msg']);
    const missing = {
      ...base,
      kind: 'missing-text',
      tool: 'shell',
      key: 'about_title',
      view: undefined
    };
    expect(parseItems(batch([opened, missing]))).toHaveLength(2);
  });

  it('strips unknown keys', () => {
    const [item] = parseItems(batch([{ ...event, ip: '1.2.3.4' }]));
    expect(item).toBeDefined();
    expect('ip' in item).toBe(false);
  });

  it('rejects start on a non-tool-opened event', () => {
    expect(parseItems(batch([{ ...event, start: true }]))).toHaveLength(0);
  });

  it('rejects secs out of range or on another event type', () => {
    expect(parseItems(batch([{ ...event, secs: 3601 }]))).toHaveLength(0);
    expect(parseItems(batch([{ ...event, type: 'sound-played' }]))).toHaveLength(0);
    expect(parseItems(batch([{ ...event, secs: 1.5 }]))).toHaveLength(0);
  });

  it('rejects key on a drawing report and a drawing report without name+msg', () => {
    expect(parseItems(batch([{ ...report, key: 'about_title' }]))).toHaveLength(0);
    const noText = omit(report, ['name', 'msg']);
    expect(parseItems(batch([noText]))).toHaveLength(0);
  });

  it('rejects name+msg on a missing-text report', () => {
    expect(parseItems(batch([{ ...report, kind: 'missing-text', key: 'a_b' }]))).toHaveLength(0);
  });

  it('drops invalid items but keeps valid ones', () => {
    expect(parseItems(batch([event, { r: 'e' }, report]))).toHaveLength(2);
  });

  it('rejects bad batches', () => {
    expect(parseItems(batch([event], { v: 2 }))).toHaveLength(0);
    expect(parseItems(batch([]))).toHaveLength(0);
    expect(parseItems(batch(Array.from({ length: MAX_BATCH + 1 }, () => event)))).toHaveLength(0);
    expect(parseItems(batch(Array.from({ length: MAX_BATCH }, () => event)))).toHaveLength(
      MAX_BATCH
    );
    expect(parseItems(null)).toHaveLength(0);
    expect(parseItems('x')).toHaveLength(0);
    expect(v.is(BatchSchema, batch([event]))).toBe(true);
  });

  it('exports the body limit', () => expect(MAX_BODY_BYTES).toBe(16_384));

  describe('view limits', () => {
    const withView = (view: unknown) => parseItems(batch([{ ...report, view }]));
    it('accepts ≤ 24 keys, rejects 25', () => {
      const keys = (n: number) =>
        Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, 'a']));
      expect(withView(keys(24))).toHaveLength(1);
      expect(withView(keys(25))).toHaveLength(0);
    });
    it('checks key and value patterns', () => {
      expect(withView({ Rt: 'c' })).toHaveLength(0);
      expect(withView({ '1a': 'c' })).toHaveLength(0);
      expect(withView({ ['a'.repeat(17)]: 'c' })).toHaveLength(0);
      expect(withView({ rt: 'a b' })).toHaveLength(0);
      expect(withView({ rt: 'a'.repeat(49) })).toHaveLength(0);
      expect(withView({ rt: '' })).toHaveLength(1);
    });
    it('rejects the forbidden instrument keys', () => {
      for (const k of ['v', 'sc', 'tu', 'fr']) expect(withView({ [k]: '1' })).toHaveLength(0);
    });
  });

  it('checks ver, name, msg and key patterns', () => {
    expect(parseItems(batch([{ ...report, ver: '1.2.3-beta.1' }]))).toHaveLength(1);
    expect(parseItems(batch([{ ...report, ver: 'abc' }]))).toHaveLength(0);
    expect(parseItems(batch([{ ...report, name: '1Bad' }]))).toHaveLength(0);
    expect(parseItems(batch([{ ...report, msg: 'x'.repeat(201) }]))).toHaveLength(0);
    expect(parseItems(batch([{ ...report, frets: 25 }]))).toHaveLength(0);
  });
});
