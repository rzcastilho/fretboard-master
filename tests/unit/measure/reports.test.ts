// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  measure,
  resetMeasureForTests,
  useMeasureForTests
} from '../../../src/lib/measure/measure.svelte';
import { parseItems, type FailureReport } from '../../../src/lib/measure/wire';
import { instrument, resetInstrumentForTests } from '../../../src/lib/state/instrument.svelte';

let bodies: string[];

function begin(): void {
  bodies = [];
  useMeasureForTests({
    endpoint: '/m',
    send: (b) => void bodies.push(b),
    device: 'phone',
    now: () => 0,
    hidden: false
  });
  measure.start();
}

const flushAll = (): void => void vi.advanceTimersByTime(5000);
const reports = (): FailureReport[] =>
  bodies
    .flatMap((b) => [...parseItems(JSON.parse(b))] as FailureReport[])
    .filter((i) => i.r === 'r');

beforeEach(() => {
  vi.useFakeTimers();
  resetInstrumentForTests();
});
afterEach(() => {
  resetMeasureForTests();
  vi.useRealTimers();
});

describe('report', () => {
  it('carries kind, tool, traits, frets, version, view and name+msg; no key', () => {
    begin();
    measure.toolOpened('triads');
    measure.report({ kind: 'drawing', tool: 'triads', error: new TypeError('bad cell') });
    flushAll();
    const [r] = reports();
    expect(r).toMatchObject({
      r: 'r',
      kind: 'drawing',
      tool: 'triads',
      device: 'phone',
      lang: 'en',
      strings: 6,
      hand: 'right',
      frets: 22,
      name: 'TypeError',
      msg: 'bad cell'
    });
    expect(r.ver).toMatch(/^\d+\.\d+\.\d+/);
    expect(r.tuning).toBe('AF-1');
    expect(r.view).toBeDefined();
    expect(Object.keys(r.view ?? {})).toEqual(expect.not.arrayContaining(['v', 'sc', 'tu', 'fr']));
    expect(r.key).toBeUndefined();
  });

  it('shell reports omit the view; null tool means shell', () => {
    begin();
    measure.report({ kind: 'drawing', tool: null, error: new Error('x') });
    flushAll();
    const [r] = reports();
    expect(r.tool).toBe('shell');
    expect(r.view).toBeUndefined();
  });

  it('reports "custom" with no offsets for a custom tuning (US3-5)', () => {
    begin();
    instrument.open();
    instrument.chooseCustom();
    instrument.stepString(6, 1);
    instrument.confirm('notes');
    measure.report({ kind: 'calculation', tool: 'notes', error: new Error('x') });
    flushAll();
    const [r] = reports();
    expect(instrument.active.tuning.kind).toBe('custom');
    expect(r.tuning).toBe('custom');
    expect(JSON.stringify(r)).not.toMatch(/offset|steps/i);
  });

  it('masks URLs, caps at 200 characters, sends no stack', () => {
    begin();
    const e = new Error(`failed https://x.test/triads?a=1 ${'z'.repeat(400)}`);
    measure.report({ kind: 'drawing', tool: 'notes', error: e });
    flushAll();
    const [r] = reports();
    expect(r.msg).toContain('<url>');
    expect(r.msg).not.toContain('x.test');
    expect(r.msg?.length).toBeLessThanOrEqual(200);
    expect(JSON.stringify(r)).not.toContain('stack');
  });

  it('non-Error values are reported as UnknownError through the sanitizer', () => {
    begin();
    measure.report({ kind: 'drawing', tool: 'notes', error: 'see http://a.b/c' });
    flushAll();
    const [r] = reports();
    expect(r.name).toBe('UnknownError');
    expect(r.msg).toBe('see <url>');
  });

  it('sends the same failure once, and drops the 11th distinct report', () => {
    begin();
    for (let i = 0; i < 3; i++) {
      measure.report({ kind: 'drawing', tool: 'notes', error: new Error('same') });
    }
    for (let i = 0; i < 11; i++) {
      measure.report({ kind: 'drawing', tool: 'notes', error: new Error(`distinct ${i}`) });
    }
    flushAll();
    const all = reports();
    expect(all).toHaveLength(10);
    expect(all.filter((r) => r.msg === 'same')).toHaveLength(1);
    expect(all.map((r) => r.msg)).not.toContain('distinct 9');
  });
});

describe('missingText', () => {
  it('sends a key-only report for the current tool, or shell before any tool', () => {
    begin();
    measure.missingText('some_key');
    measure.toolOpened('caged');
    measure.missingText('other_key');
    measure.missingText('other_key');
    flushAll();
    const rs = reports();
    expect(rs.map((r) => [r.kind, r.tool, r.key, r.name, r.msg])).toEqual([
      ['missing-text', 'shell', 'some_key', undefined, undefined],
      ['missing-text', 'caged', 'other_key', undefined, undefined]
    ]);
    expect(rs[0].view).toBeUndefined();
  });
});

describe('inert', () => {
  it('sends nothing when the endpoint is empty', () => {
    bodies = [];
    useMeasureForTests({ endpoint: '', send: (b) => void bodies.push(b) });
    measure.start();
    measure.report({ kind: 'drawing', tool: 'notes', error: new Error('x') });
    measure.missingText('k');
    flushAll();
    expect(bodies).toEqual([]);
  });
});
