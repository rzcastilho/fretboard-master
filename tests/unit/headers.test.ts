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

  it('revalidates the theme boot script (026)', () => {
    expect(rules.get('/theme-boot.js')?.get('cache-control')).toBe('no-cache');
  });

  it('keeps the CSP script-src at self only (026)', () => {
    const config = readFileSync(join(process.cwd(), 'svelte.config.js'), 'utf8');
    expect(config).toMatch(/'script-src':\s*\['self'\]/);
  });

  it('app.html loads exactly one external boot script in head and no inline script (026)', () => {
    const html = readFileSync(join(process.cwd(), 'src/app.html'), 'utf8');
    const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
    expect(head.match(/<script src="\/theme-boot\.js"><\/script>/g)).toHaveLength(1);
    expect(html.match(/<script\b/g)).toHaveLength(1);
  });

  it('viewport meta has no viewport-fit=cover (030)', () => {
    const html = readFileSync(join(process.cwd(), 'src/app.html'), 'utf8');
    expect(html).toMatch(/<meta name="viewport"/);
    expect(html).not.toContain('viewport-fit');
  });

  it.each(['/', '/*.html', '/notes', '/triads', '/about', '/404.html'])(
    'revalidates HTML at %s',
    (path) => {
      expect(rules.get(path)?.get('cache-control')).toBe('no-cache');
    }
  );

  it.each(['/service-worker.js', '/manifest.webmanifest', '/caged', '/metronome'])(
    'revalidates %s (040)',
    (path) => {
      expect(rules.get(path)?.get('cache-control')).toBe('no-cache');
    }
  );

  it('serves the manifest as application/manifest+json (040)', () => {
    expect(rules.get('/manifest.webmanifest')?.get('content-type')).toBe(
      'application/manifest+json'
    );
  });

  it('caches icons for one day, not immutable (040)', () => {
    expect(rules.get('/icons/*')?.get('cache-control')).toBe('public, max-age=86400');
  });
});
