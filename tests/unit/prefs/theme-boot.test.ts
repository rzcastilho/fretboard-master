// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { MAX_RAW_LENGTH, THEMES } from '../../../src/lib/prefs/schema';
import { PREFS_KEY } from '../../../src/lib/prefs/storage';
import { arrangementFor, REFLOW_MAX } from '../../../src/lib/shell/layout';

const source = readFileSync('static/theme-boot.js', 'utf8');

interface Run {
  readonly theme: string | undefined;
  readonly calls: readonly string[];
}

type Storage = { getItem(key: string): string | null };

/** Run the script with a stub `localStorage` (or a throwing getter) and a stub dataset. */
function run(storage: Storage | 'getter-throws'): Run {
  const dataset: Record<string, string> = {};
  const calls: string[] = [];
  const sandbox: Record<string, unknown> = { document: { documentElement: { dataset } } };
  if (storage === 'getter-throws') {
    Object.defineProperty(sandbox, 'localStorage', {
      get() {
        throw new Error('SecurityError');
      }
    });
  } else {
    sandbox.localStorage = {
      getItem(key: string) {
        calls.push(`getItem:${key}`);
        return storage.getItem(key);
      },
      setItem() {
        calls.push('setItem');
      },
      removeItem() {
        calls.push('removeItem');
      }
    };
  }
  runInNewContext(source, sandbox);
  return { theme: dataset.theme, calls };
}

const withRaw = (raw: string | null): Storage => ({
  getItem: (key) => (key === PREFS_KEY ? raw : null)
});

describe('theme-boot.js behaviour', () => {
  it('leaves the theme unset when the key is absent', () => {
    expect(run(withRaw(null)).theme).toBeUndefined();
  });
  it.each(['dark', 'light'])('applies a stored %s', (t) => {
    expect(run(withRaw(JSON.stringify({ version: 1, theme: t }))).theme).toBe(t);
  });
  it.each([
    ['invalid theme', { version: 1, theme: 'system' }],
    ['wrong case', { version: 1, theme: 'Dark' }],
    ['non-string theme', { version: 1, theme: 1 }],
    ['absent theme', { version: 1 }]
  ])('leaves the theme unset for %s', (_n, record) => {
    expect(run(withRaw(JSON.stringify(record))).theme).toBeUndefined();
  });
  it.each([
    ['non-JSON', 'not json {'],
    ['JSON array', '["dark"]'],
    ['null', 'null']
  ])('leaves the theme unset for %s', (_n, raw) => {
    expect(run(withRaw(raw)).theme).toBeUndefined();
  });
  it('does not throw and leaves the theme unset when getItem throws', () => {
    const throwing: Storage = {
      getItem() {
        throw new Error('denied');
      }
    };
    expect(() => run(throwing)).not.toThrow();
    expect(run(throwing).theme).toBeUndefined();
  });
  it('does not throw when the localStorage getter throws', () => {
    expect(() => run('getter-throws')).not.toThrow();
    expect(run('getter-throws').theme).toBeUndefined();
  });
  it('ignores a raw value longer than MAX_RAW_LENGTH', () => {
    const pad = ' '.repeat(MAX_RAW_LENGTH);
    expect(run(withRaw(JSON.stringify({ theme: 'dark' }) + pad)).theme).toBeUndefined();
  });
  it('only reads storage: never writes or removes', () => {
    const { calls } = run(withRaw(JSON.stringify({ theme: 'dark' })));
    expect(calls).toEqual([`getItem:${PREFS_KEY}`]);
  });
});

describe('theme-boot.js source', () => {
  it('contains PREFS_KEY verbatim', () => {
    expect(source).toContain(PREFS_KEY);
  });
  it('contains MAX_RAW_LENGTH as a literal', () => {
    expect(source).toContain(String(MAX_RAW_LENGTH));
  });
  it('accepts exactly the THEMES values', () => {
    const accepted = [...source.matchAll(/theme === '([^']+)'/g)].map((m) => m[1]);
    expect(accepted.sort()).toEqual([...THEMES].sort());
  });
  it('has no import or export', () => {
    expect(source).not.toMatch(/^\s*(import|export)\b/m);
  });
  it('never calls setItem or removeItem', () => {
    expect(source).not.toMatch(/\.(setItem|removeItem)\b/);
  });
});

describe('theme-boot.js provisional arrangement', () => {
  /** Run the script on `pathname` with a `w × h` window; returns the root's `data-arrangement`. */
  function arrangementAt(pathname: string, w: number, h: number): string | undefined {
    const dataset: Record<string, string> = {};
    runInNewContext(source, {
      document: { documentElement: { dataset } },
      localStorage: { getItem: () => null },
      location: { pathname },
      innerWidth: w,
      innerHeight: h
    });
    return dataset.arrangement;
  }

  const chrome = { mainPadding: 16, gap: 16, zoneBorder: 1 };
  it.each([
    [320, 568],
    [360, 740],
    [REFLOW_MAX, 900],
    [REFLOW_MAX + 1, 900],
    [740, 360],
    [900, 450]
  ])('matches arrangementFor at %i × %i', (w, h) => {
    expect(arrangementAt('/triads', w, h)).toBe(arrangementFor({ width: w, neckWidth: 0, chrome }));
  });
  it('guesses wide-side above the reflow width (the neck is not known yet)', () => {
    expect(arrangementAt('/caged', 1440, 900)).toBe('wide-side');
  });
  it.each(['/notes', '/caged', '/about', '/triads/'])('applies on %s', (path) => {
    expect(arrangementAt(path, 360, 740)).toBe('reflow');
  });
  it.each(['/', '/triads/x', '/privacy'])('leaves %s alone', (path) => {
    expect(arrangementAt(path, 360, 740)).toBeUndefined();
  });
  it('does not throw without a window (theme still applies)', () => {
    expect(run(withRaw(JSON.stringify({ theme: 'dark' }))).theme).toBe('dark');
  });
});
