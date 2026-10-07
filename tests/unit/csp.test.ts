// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import config from '../../svelte.config.js';

const directives = config.kit?.csp?.directives as Record<string, string[]>;
const ALLOWED = new Set(['self', 'none', 'data:']);

describe('content security policy (FR-019)', () => {
  it('allows only self, none and data: (no scheme-host source)', () => {
    for (const [name, values] of Object.entries(directives)) {
      for (const value of values) {
        expect(ALLOWED.has(value), `${name}: ${value}`).toBe(true);
      }
    }
  });

  it('script-src and connect-src are exactly self', () => {
    expect(directives['script-src']).toEqual(['self']);
    expect(directives['connect-src']).toEqual(['self']);
  });

  it('measurement adds no origin: connect-src stays exactly self (FR-014)', () => {
    expect(directives['connect-src']).toEqual(['self']);
    expect(JSON.stringify(directives)).not.toMatch(/https?:|\/\/|\*/);
  });

  it('keeps the policy this slice shipped with (no widening)', () => {
    expect(directives).toEqual({
      'default-src': ['self'],
      'script-src': ['self'],
      'style-src': ['self'],
      'img-src': ['self', 'data:'],
      'connect-src': ['self'],
      'object-src': ['none'],
      'base-uri': ['self'],
      'form-action': ['self']
    });
  });

  it('static/_headers adds no policy that could widen it', () => {
    const headers = readFileSync(join(process.cwd(), 'static/_headers'), 'utf8');
    expect(headers).not.toMatch(/content-security-policy/i);
  });
});
