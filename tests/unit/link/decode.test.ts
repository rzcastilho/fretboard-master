import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { decodeLink, type ShareSnapshot } from '$lib/link';
import { STANDARD_TUNING } from '$lib/instrument/tunings';

const O = 'https://fretboard.example';
const NOTES = `${O}/notes?v=1&sel=-&str=1.2.3.4.5.6&rg=0.22&bg=naturals&hn=0&cd=-&lb=name&sc=6&tu=AF-1&fr=22`;
const TRIADS = `${O}/triads?v=1&rt=0&sp=none&q=major&inv=root&ss=3&vw=isolated&oc=0&cmp=0&cq=-&lb=interval&sc=6&tu=AF-1&fr=22`;
const CAGED = `${O}/caged?v=1&rt=0&sp=none&q=major&fc=-&ly=10000&cn=0&ts=-&lb=interval&tmp=0&sc=6&tu=AF-1&fr=22`;

/** Replace one `key=value` in a link (or drop it when value is null). */
function patch(link: string, key: string, value: string | null): string {
  const [base, query] = link.split('?');
  const out = query
    .split('&')
    .flatMap((p) => (p.split('=')[0] === key ? (value === null ? [] : [`${key}=${value}`]) : [p]));
  return `${base}?${out.join('&')}`;
}

const decode = (link: string) => decodeLink(new URL(link));

function ok(link: string) {
  const r = decode(link);
  if (r.kind !== 'ok') throw new Error(`expected ok, got ${r.kind}`);
  return r;
}

describe('decodeLink: envelope', () => {
  it('decodes the canonical defaults with no fallbacks', () => {
    for (const link of [NOTES, TRIADS, CAGED]) {
      expect(ok(link).fellBack).toEqual([]);
    }
  });

  it('v missing or non-integer is invalid', () => {
    expect(decode(patch(NOTES, 'v', null))).toEqual({ kind: 'invalid' });
    expect(decode(patch(NOTES, 'v', 'x'))).toEqual({ kind: 'invalid' });
    expect(decode(patch(NOTES, 'v', '1.5'))).toEqual({ kind: 'invalid' });
    expect(decode(patch(NOTES, 'v', '0'))).toEqual({ kind: 'invalid' });
    expect(decode(patch(NOTES, 'v', '-1'))).toEqual({ kind: 'invalid' });
    expect(decode(patch(NOTES, 'v', ''))).toEqual({ kind: 'invalid' });
  });

  it('v above 1 is unsupported-version', () => {
    expect(decode(patch(NOTES, 'v', '2'))).toEqual({ kind: 'unsupported-version', version: 2 });
    expect(decode(patch(TRIADS, 'v', '17'))).toEqual({ kind: 'unsupported-version', version: 17 });
  });

  it('paths that are not a tool are not-a-tool', () => {
    for (const path of ['/', '/about', '/foo', '/notes/extra', '/NOTES']) {
      expect(decode(`${O}${path}?v=1`)).toEqual({ kind: 'not-a-tool' });
    }
  });

  it('ignores unknown params and duplicate keys after the first', () => {
    const base = ok(NOTES).snapshot;
    expect(ok(`${NOTES}&zz=1&future=a.b`).snapshot).toEqual(base);
    const dup = ok(`${NOTES}&lb=none&sc=7`);
    expect(dup.snapshot).toEqual(base);
    expect(dup.fellBack).toEqual([]);
  });

  it('a missing param falls back and is reported', () => {
    const r = ok(patch(TRIADS, 'q', null));
    expect(r.fellBack).toEqual(['q']);
    expect(r.snapshot.tool === 'triads' && r.snapshot.view.quality).toBe('major');
  });
});

describe('decodeLink: instrument fallbacks', () => {
  const inst = (s: ShareSnapshot) => s.instrument;

  it('sc', () => {
    const r = ok(patch(NOTES, 'sc', '8'));
    expect(r.fellBack).toContain('sc');
    expect(inst(r.snapshot).stringCount).toBe(6);
  });

  it('tu: unknown id falls back to standard for the string count', () => {
    const r = ok(patch(patch(NOTES, 'sc', '7'), 'tu', 'AF-99'));
    expect(r.fellBack).toEqual(['tu']);
    expect(inst(r.snapshot).tuning).toEqual({ kind: 'preset', id: 'AF-21' });
  });

  it('tu: a preset id for the wrong string count falls back', () => {
    const r = ok(patch(patch(NOTES, 'sc', '7'), 'tu', 'AF-1'));
    expect(r.fellBack).toEqual(['tu']);
    expect(inst(r.snapshot).tuning).toEqual({ kind: 'preset', id: 'AF-21' });
  });

  it('tu: custom list with the wrong length or an out-of-range offset falls back', () => {
    for (const tu of ['c.64.59.55.50.45', 'c.64.59.55.50.45.38.30', 'c.64.59.55.50.45.20']) {
      const r = ok(patch(NOTES, 'tu', tu));
      expect(r.fellBack).toEqual(['tu']);
      expect(inst(r.snapshot).tuning).toEqual(STANDARD_TUNING);
    }
  });

  it('tu: a custom list equal to a preset decodes to the preset (ADR 0014)', () => {
    // drop D is AF-4
    const r = ok(patch(NOTES, 'tu', 'c.64.59.55.50.45.38'));
    expect(r.fellBack).toEqual([]);
    expect(inst(r.snapshot).tuning).toEqual({ kind: 'preset', id: 'AF-4' });
  });

  it('tu: a genuine custom tuning decodes to offsets', () => {
    const r = ok(patch(NOTES, 'tu', 'c.66.59.55.50.45.39'));
    expect(inst(r.snapshot).tuning).toEqual({ kind: 'custom', offsets: [-1, 0, 0, 0, 0, 2] });
  });

  it('fr outside 12..24 or not an integer falls back to 22', () => {
    for (const fr of ['11', '25', 'x', '1.5', '']) {
      const r = ok(patch(NOTES, 'fr', fr));
      expect(r.fellBack).toEqual(['fr']);
      expect(inst(r.snapshot).fretCount).toBe(22);
    }
    expect(inst(ok(patch(NOTES, 'fr', '12')).snapshot).fretCount).toBe(12);
    expect(inst(ok(patch(NOTES, 'fr', '24')).snapshot).fretCount).toBe(24);
  });
});

describe('decodeLink: Notes fallbacks', () => {
  const view = (link: string) => {
    const s = ok(link).snapshot;
    if (s.tool !== 'notes') throw new Error('tool');
    return s.view;
  };

  it('sel', () => {
    for (const sel of ['12', '1.1', 'x', '0.1.2.3.4.5.6.7.8.9.10.11.0']) {
      const r = ok(patch(NOTES, 'sel', sel));
      expect(r.fellBack).toEqual(['sel']);
      expect(view(patch(NOTES, 'sel', sel)).selection).toEqual([]);
    }
    expect(view(patch(NOTES, 'sel', '7.0.4')).selection).toEqual([7, 0, 4]);
  });

  it('str', () => {
    for (const str of ['-', '0', '7', '1.1', 'a']) {
      const r = ok(patch(NOTES, 'str', str));
      expect(r.fellBack).toEqual(['str']);
      expect(view(patch(NOTES, 'str', str)).activeStrings).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });

  it('rg', () => {
    for (const rg of ['5.3', '0.23', '3', 'a.b', '-']) {
      const r = ok(patch(NOTES, 'rg', rg));
      expect(r.fellBack).toEqual(['rg']);
      expect(view(patch(NOTES, 'rg', rg)).region).toEqual({ start: 0, end: 22 });
    }
  });

  it('bg, hn, lb', () => {
    expect(ok(patch(NOTES, 'bg', 'all2')).fellBack).toEqual(['bg']);
    expect(ok(patch(NOTES, 'hn', '2')).fellBack).toEqual(['hn']);
    expect(ok(patch(NOTES, 'lb', 'interval')).fellBack).toEqual(['lb']);
    expect(view(patch(NOTES, 'bg', 'x')).background).toBe('naturals');
    expect(view(patch(NOTES, 'hn', 'x')).hideNames).toBe(false);
    expect(view(patch(NOTES, 'lb', 'x')).labelType).toBe('name');
  });

  it('cd', () => {
    expect(view(patch(NOTES, 'cd', '2.5')).card).toEqual({ string: 2, fret: 5 });
    for (const cd of ['7.5', '0.5', '1.23', 'x']) {
      expect(ok(patch(NOTES, 'cd', cd)).fellBack).toEqual(['cd']);
      expect(view(patch(NOTES, 'cd', cd)).card).toBeNull();
    }
  });
});

describe('decodeLink: Triads fallbacks', () => {
  const view = (link: string) => {
    const s = ok(link).snapshot;
    if (s.tool !== 'triads') throw new Error('tool');
    return s.view;
  };

  it('rt, sp, q, inv, vw, lb', () => {
    expect(ok(patch(TRIADS, 'rt', '12')).fellBack).toEqual(['rt']);
    expect(view(patch(TRIADS, 'rt', '12')).rootPc).toBe(0);
    expect(ok(patch(TRIADS, 'sp', 'x')).fellBack).toEqual(['sp']);
    expect(ok(patch(TRIADS, 'q', 'x')).fellBack).toEqual(['q']);
    expect(ok(patch(TRIADS, 'inv', 'third')).fellBack).toEqual(['inv']);
    expect(ok(patch(TRIADS, 'vw', 'x')).fellBack).toEqual(['vw']);
    expect(ok(patch(TRIADS, 'lb', 'octave')).fellBack).toEqual(['lb']);
  });

  it('spelling override is only allowed on altered roots', () => {
    const natural = ok(patch(TRIADS, 'sp', 'sharp'));
    expect(natural.fellBack).toEqual(['sp']);
    expect(view(patch(TRIADS, 'sp', 'sharp')).spellingOverride).toBe('none');
    const altered = patch(patch(TRIADS, 'rt', '1'), 'sp', 'flat');
    expect(ok(altered).fellBack).toEqual([]);
    expect(view(altered).spellingOverride).toBe('flat');
  });

  it('ss must be 3..stringCount', () => {
    for (const ss of ['2', '7', 'x']) {
      expect(ok(patch(TRIADS, 'ss', ss)).fellBack).toEqual(['ss']);
      expect(view(patch(TRIADS, 'ss', ss)).stringSet).toBe(3);
    }
    expect(view(patch(patch(TRIADS, 'sc', '7'), 'ss', '7')).stringSet).toBe(7);
  });

  it('oc is clamped to existing occurrences', () => {
    expect(ok(patch(TRIADS, 'oc', 'x')).fellBack).toEqual(['oc']);
    const big = ok(patch(TRIADS, 'oc', '999'));
    expect(big.fellBack).toEqual(['oc']);
    expect(view(patch(TRIADS, 'oc', '999')).occurrence).toBeLessThan(10);
  });

  it('compare on with cq none falls back to compare off', () => {
    const link = patch(patch(TRIADS, 'cmp', '1'), 'cq', '-');
    const r = ok(link);
    expect(r.fellBack).toContain('cmp');
    expect(view(link).compare).toEqual({ on: false, quality: null });
  });

  it('compare quality equal to the main quality falls back', () => {
    const link = patch(patch(TRIADS, 'cmp', '1'), 'cq', 'major');
    expect(view(link).compare).toEqual({ on: false, quality: null });
    expect(ok(link).fellBack).toContain('cq');
  });

  it('compare on with a valid cq is kept; compare off keeps the remembered quality', () => {
    expect(view(patch(patch(TRIADS, 'cmp', '1'), 'cq', 'minor')).compare).toEqual({
      on: true,
      quality: 'minor'
    });
    expect(view(patch(TRIADS, 'cq', 'minor')).compare).toEqual({ on: false, quality: 'minor' });
  });
});

describe('decodeLink: CAGED fallbacks', () => {
  const full = (link: string) => {
    const s = ok(link).snapshot;
    if (s.tool !== 'caged') throw new Error('tool');
    return s;
  };

  it('q only major/minor', () => {
    expect(ok(patch(CAGED, 'q', 'diminished')).fellBack).toEqual(['q']);
    expect(full(patch(CAGED, 'q', 'diminished')).view.quality).toBe('major');
  });

  it('fc', () => {
    expect(full(patch(CAGED, 'fc', 'G.2')).view.focus).toEqual({ letter: 'G', ordinal: 2 });
    for (const fc of ['B.0', 'E', 'E.x', 'E.-1']) {
      expect(ok(patch(CAGED, 'fc', fc)).fellBack).toEqual(['fc']);
      expect(full(patch(CAGED, 'fc', fc)).view.focus).toBeNull();
    }
  });

  it('ly needs exactly 5 binary digits with at least one 1', () => {
    for (const ly of ['0000', '000000', '00000', '1020x', '-']) {
      expect(ok(patch(CAGED, 'ly', ly)).fellBack).toEqual(['ly']);
      expect(full(patch(CAGED, 'ly', ly)).view.layers).toEqual({
        chord: true,
        arpeggio: false,
        pentatonic: false,
        scale: false,
        triad: false
      });
    }
  });

  it('ts is non-null only when the triad layer is on', () => {
    const off = patch(CAGED, 'ts', '4');
    expect(ok(off).fellBack).toEqual(['ts']);
    expect(full(off).view.triadSet).toBeNull();
    const on = patch(patch(CAGED, 'ly', '10001'), 'ts', '4');
    expect(ok(on).fellBack).toEqual([]);
    expect(full(on).view.triadSet).toBe(4);
    const range = patch(patch(CAGED, 'ly', '10001'), 'ts', '7');
    expect(ok(range).fellBack).toEqual(['ts']);
  });

  it('tmp carries the temporary flag', () => {
    expect(full(patch(CAGED, 'tmp', '1')).temporary).toBe(true);
    expect(ok(patch(CAGED, 'tmp', '2')).fellBack).toEqual(['tmp']);
    expect(full(patch(CAGED, 'tmp', '2')).temporary).toBe(false);
  });
});

describe('decodeLink is total', () => {
  it('never throws for arbitrary URLs', () => {
    fc.assert(
      fc.property(fc.webUrl({ withQueryParameters: true, withFragments: true }), (u) => {
        const r = decodeLink(new URL(u));
        expect(['ok', 'not-a-tool', 'invalid', 'unsupported-version']).toContain(r.kind);
      }),
      { numRuns: 300 }
    );
  });

  it('never throws for arbitrary query strings on each tool path', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('notes', 'triads', 'caged'),
        fc.string({ maxLength: 120 }),
        (tool, q) => {
          const url = new URL(`${O}/${tool}`);
          url.search = q;
          const r = decodeLink(url);
          expect(['ok', 'invalid', 'unsupported-version']).toContain(r.kind);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('never throws for token-shaped garbage in every field', () => {
    const token = fc.stringMatching(/^[A-Za-z0-9.-]{0,24}$/);
    const keys = [
      'v',
      'sel',
      'str',
      'rg',
      'bg',
      'hn',
      'cd',
      'lb',
      'rt',
      'sp',
      'q',
      'inv',
      'ss',
      'vw',
      'oc',
      'cmp',
      'cq',
      'fc',
      'ly',
      'cn',
      'ts',
      'tmp',
      'sc',
      'tu',
      'fr'
    ];
    fc.assert(
      fc.property(
        fc.constantFrom('notes', 'triads', 'caged'),
        fc.array(fc.tuple(fc.constantFrom(...keys), token), { maxLength: 30 }),
        (tool, pairs) => {
          const url = new URL(`${O}/${tool}`);
          url.search = ['v=1', ...pairs.map(([k, v]) => `${k}=${v}`)].join('&');
          const r = decodeLink(url);
          expect(r.kind === 'ok' || r.kind === 'unsupported-version' || r.kind === 'invalid').toBe(
            true
          );
        }
      ),
      { numRuns: 500 }
    );
  });
});
