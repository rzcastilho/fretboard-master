import { describe, expect, it } from 'vitest';
import { encodeLink, isIncomplete, readReceivedLink, type LinkInstrument } from '$lib/link';
import { initialCagedView } from '$lib/state/caged-view';
import { tuningFromOffsets, type Tuning } from '$lib/instrument/tunings';

const ORIGIN = 'https://fretboard.example';
const read = (path: string, stored: LinkInstrument = STANDARD) =>
  readReceivedLink(new URL(ORIGIN + path), stored);

const STANDARD: LinkInstrument = {
  stringCount: 6,
  tuning: { kind: 'preset', id: 'AF-1' } as Tuning,
  fretCount: 22
};
const DROP_D: LinkInstrument = {
  stringCount: 6,
  tuning: tuningFromOffsets([0, 0, 0, 0, 0, -2]),
  fretCount: 19
};

function tool(r: ReturnType<typeof read>) {
  if (r.kind !== 'tool') throw new Error(`expected tool, got ${r.kind}`);
  return r;
}

describe('readReceivedLink: classification (data-model §1 rules 1–4)', () => {
  it('bare tool path, empty query and "?" are none', () => {
    expect(read('/caged')).toEqual({ kind: 'none' });
    expect(read('/caged?')).toEqual({ kind: 'none' });
    expect(read('/notes/')).toEqual({ kind: 'none' });
  });

  it('non-tool paths without `v` are none', () => {
    expect(read('/')).toEqual({ kind: 'none' });
    expect(read('/about')).toEqual({ kind: 'none' });
    expect(read('/scales?rt=0')).toEqual({ kind: 'none' });
  });

  it('non-tool path with `v` is unknown-tool', () => {
    expect(read('/scales?v=1&rt=0')).toEqual({ kind: 'unknown-tool' });
    expect(read('/?v=1')).toEqual({ kind: 'unknown-tool' });
    expect(isIncomplete(read('/scales?v=1'))).toBe(true);
  });

  it('strips one trailing slash from a tool path', () => {
    expect(read('/caged/?v=1&rt=2').kind).toBe('tool');
  });

  it('none is never incomplete', () => {
    expect(isIncomplete(read('/caged'))).toBe(false);
  });
});

describe('readReceivedLink: instrument defaults (R3)', () => {
  it('missing sc/tu/fr take the stored values and sc/tu/fr are reported', () => {
    const r = tool(read('/triads?v=1&rt=2', DROP_D));
    expect(r.snapshot.instrument).toEqual(DROP_D);
    expect(r.fellBack).toEqual(expect.arrayContaining(['sc', 'tu', 'fr']));
    expect(isIncomplete(r)).toBe(true);
  });

  it('a complete link keeps its own instrument and reports nothing', () => {
    const r = tool(read('/caged?v=1&rt=2&sc=6&tu=AF-4&fr=20', DROP_D));
    expect(r.snapshot.instrument.tuning).toEqual({ kind: 'preset', id: 'AF-4' });
    expect(r.snapshot.instrument.fretCount).toBe(20);
    expect(r.fellBack).not.toContain('sc');
    expect(r.fellBack).not.toContain('tu');
    expect(r.fellBack).not.toContain('fr');
  });

  it('invalid sc takes both sc and tu from stored, reporting both', () => {
    const r = tool(read('/caged?v=1&sc=9&tu=AF-4&fr=20', DROP_D));
    expect(r.snapshot.instrument.stringCount).toBe(6);
    expect(r.snapshot.instrument.tuning).toEqual(DROP_D.tuning);
    expect(r.snapshot.instrument.fretCount).toBe(20);
    expect(r.fellBack).toEqual(expect.arrayContaining(['sc', 'tu']));
  });

  it('invalid tu takes both from stored, even when sc is valid and differs', () => {
    const r = tool(read('/caged?v=1&sc=7&tu=nonsense&fr=20', DROP_D));
    expect(r.snapshot.instrument.stringCount).toBe(6);
    expect(r.snapshot.instrument.tuning).toEqual(DROP_D.tuning);
    expect(r.fellBack).toEqual(expect.arrayContaining(['sc', 'tu']));
  });

  it('custom tuning with the wrong pitch count takes both from stored', () => {
    const r = tool(read('/caged?v=1&sc=6&tu=c.67.59.55.48.45&fr=20', DROP_D));
    expect(r.snapshot.instrument.tuning).toEqual(DROP_D.tuning);
    expect(r.fellBack).toEqual(expect.arrayContaining(['sc', 'tu']));
  });

  it('a preset invalid for the string count takes both from stored', () => {
    const r = tool(read('/caged?v=1&sc=6&tu=AF-21&fr=20', DROP_D));
    expect(r.snapshot.instrument.stringCount).toBe(6);
    expect(r.snapshot.instrument.tuning).toEqual(DROP_D.tuning);
    expect(r.fellBack).toEqual(expect.arrayContaining(['sc', 'tu']));
  });

  it('invalid or out-of-range fr takes the stored fret count and reports fr', () => {
    for (const fr of ['11', '25', 'x', '']) {
      const r = tool(read(`/caged?v=1&sc=6&tu=AF-4&fr=${fr}`, DROP_D));
      expect(r.snapshot.instrument.fretCount).toBe(19);
      expect(r.fellBack).toContain('fr');
      expect(r.fellBack).not.toContain('sc');
    }
  });
});

describe('readReceivedLink: view fields (R4, EC-10.2)', () => {
  it('reports clamped triad fields on their keys', () => {
    const r = tool(read('/triads?v=1&rt=2&ss=7&sc=6&tu=AF-4&fr=20'));
    expect(r.fellBack).toContain('ss');
  });

  it('reports an occurrence past the end', () => {
    const r = tool(read('/triads?v=1&rt=2&oc=999&sc=6&tu=AF-4&fr=20'));
    expect(r.fellBack).toContain('oc');
  });

  it('reports a notes region beyond the fret count', () => {
    const r = tool(read('/notes?v=1&rg=0.22&sc=6&tu=AF-4&fr=12'));
    expect(r.fellBack).toContain('rg');
  });

  it('invalid view fields fall back individually and keep the valid ones', () => {
    const r = tool(read('/caged?v=1&rt=2&q=banana&sc=6&tu=AF-4&fr=20'));
    if (r.snapshot.tool !== 'caged') throw new Error('tool');
    expect(r.snapshot.view.rootPc).toBe(2);
    expect(r.snapshot.view.quality).toBe('major');
    expect(r.fellBack).toContain('q');
    expect(r.fellBack).not.toContain('rt');
  });
});

/** A complete canonical CAGED link, optionally with extra raw query text appended. */
const COMPLETE = new URL(
  encodeLink(
    {
      tool: 'caged',
      view: { ...initialCagedView('interval'), rootPc: 2 },
      instrument: { stringCount: 6, tuning: { kind: 'preset', id: 'AF-4' }, fretCount: 20 },
      temporary: false
    },
    ORIGIN
  )
);
const completeQuery = COMPLETE.search.slice(1);

describe('readReceivedLink: version (R5)', () => {
  const body = completeQuery.replace(/^v=1&?/, '');
  it.each([
    ['absent', ''],
    ['non-integer', 'v=x&'],
    ['zero', 'v=0&'],
    ['greater than 1', 'v=2&']
  ])('v %s forces the notice', (_label, v) => {
    const r = tool(read(`/caged?${v}${body}`));
    expect(r.forcedNotice).toBe(true);
    expect(isIncomplete(r)).toBe(true);
    if (r.snapshot.tool !== 'caged') throw new Error('tool');
    expect(r.snapshot.view.rootPc).toBe(2);
  });

  it('v=1 with a complete valid link is not incomplete', () => {
    const r = tool(read(`/caged?${completeQuery}`));
    expect(r.forcedNotice).toBe(false);
    expect(r.fellBack).toEqual([]);
    expect(isIncomplete(r)).toBe(false);
  });
});

describe('readReceivedLink: unknown and duplicate keys (R7)', () => {
  const body = completeQuery;
  it('unknown keys are not reported', () => {
    const r = tool(read(`/caged?${body}&utm_source=x&zz=1`));
    expect(r.fellBack).toEqual([]);
    expect(isIncomplete(r)).toBe(false);
  });

  it('the first occurrence of a duplicate key wins', () => {
    const r = tool(read(`/caged?${body}&rt=5`));
    if (r.snapshot.tool !== 'caged') throw new Error('tool');
    expect(r.snapshot.view.rootPc).toBe(2);
  });
});

describe('readReceivedLink: hostile values', () => {
  it('markup in values never reaches the result', () => {
    const evil = encodeURIComponent('<script>alert(1)</script>');
    const r = tool(read(`/caged?v=1&rt=${evil}&q=${evil}&fc=${evil}&sc=${evil}&tu=${evil}`));
    expect(JSON.stringify(r)).not.toContain('script');
    expect(isIncomplete(r)).toBe(true);
  });

  it('never throws for odd paths', () => {
    for (const p of ['/%E0%A4%A', '//', '/caged//?v=1', '/__proto__?v=1', '/constructor?v=1']) {
      expect(() => read(p)).not.toThrow();
    }
  });
});
