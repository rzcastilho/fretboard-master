// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

type Rules = Map<string, Map<string, string>>;

/** Parses Cloudflare `_headers`: unindented lines are paths, indented `Name: value` are headers. */
function parse(text: string): Rules {
  const rules: Rules = new Map();
  let current: Map<string, string> | null = null;
  for (const raw of text.split('\n')) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (/^\s/.test(raw)) {
      const idx = raw.indexOf(':');
      current?.set(raw.slice(0, idx).trim().toLowerCase(), raw.slice(idx + 1).trim());
    } else {
      current = rules.get(raw.trim()) ?? new Map();
      rules.set(raw.trim(), current);
    }
  }
  return rules;
}

const rules = parse(readFileSync(join(process.cwd(), 'static/_headers'), 'utf8'));

describe('static/_headers', () => {
  it('sets the five security headers on every path', () => {
    const all = rules.get('/*');
    expect(all?.get('strict-transport-security')).toBe('max-age=31536000; includeSubDomains');
    expect(all?.get('x-content-type-options')).toBe('nosniff');
    expect(all?.get('referrer-policy')).toBe('no-referrer');
    expect(all?.get('permissions-policy')).toBe(
      'camera=(), microphone=(), geolocation=(), interest-cohort=()'
    );
    expect(all?.get('x-frame-options')).toBe('DENY');
  });

  it('caches immutable assets for one year', () => {
    expect(rules.get('/_app/immutable/*')?.get('cache-control')).toBe(
      'public, max-age=31536000, immutable'
    );
  });

  it('caches self-hosted fonts for one year', () => {
    expect(rules.get('/fonts/*')?.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });

  it.each(['/', '/*.html', '/notes', '/triads', '/about', '/404.html'])(
    'revalidates HTML at %s',
    (path) => {
      expect(rules.get(path)?.get('cache-control')).toBe('no-cache');
    }
  );
});
