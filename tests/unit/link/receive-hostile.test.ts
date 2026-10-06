import { describe, expect, it } from 'vitest';
import { readReceivedLink, type LinkInstrument } from '$lib/link';
import { tuningFromOffsets } from '$lib/instrument/tunings';

const ORIGIN = 'https://fretboard.example';
const STORED: LinkInstrument = {
  stringCount: 6,
  tuning: tuningFromOffsets([0, 0, 0, 0, 0, 0]),
  fretCount: 22
};

const LONG = 'a'.repeat(100_000);
const CORPUS: readonly string[] = [
  // truncated
  '/caged?v=1&rt=',
  '/caged?v=1&rt=2&q',
  '/caged?v=',
  '/notes?v=1&sel=0.4.',
  '/caged?v=1&tu=c.',
  '/caged?%',
  '/caged?v=1&rt=%E0%A4%A',
  // oversized
  `/notes?v=1&sel=${LONG}`,
  `/caged?v=1&q=${LONG}&lb=${LONG}`,
  `/triads?v=1&${'k=1&'.repeat(5000)}`,
  '/caged?v=1&fr=' + '9'.repeat(5000),
  // percent-encoded
  '/caged?v=1&q=%62anana&rt=%32',
  '/notes?v=1&sel=%00%01%02&lb=%ff%fe',
  '/notes?v=1&sel=0%2E4%2E7',
  // markup
  '/notes?v=1&sel=<script>alert(1)</script>&lb=%22%3E%3Cimg%3E',
  '/caged?v=1&q=<img src=x onerror=alert(1)>&fc=%3Csvg%2Fonload%3Dalert(1)%3E',
  '/triads?v=1&tu=javascript:alert(1)&sc=7',
  // null bytes
  '/caged?v=1&q=major%00&rt=2%00',
  '/caged?v=1%00&rt=2',
  '/caged%00?v=1',
  // duplicated keys
  '/caged?v=1&v=9&rt=1&rt=2&rt=3&q=major&q=banana',
  '/notes?v=1&sel=0.4&sel=<b>&sel=',
  // unknown tool / path
  '/scales?v=1&rt=0',
  '/%00?v=1',
  '/__proto__?v=1',
  '/caged/../notes?v=1',
  '/constructor?v=1&__proto__=x&constructor=y',
  // versions
  '/caged?v=-1',
  '/caged?v=1.5',
  '/caged?v=99999999999999999999',
  '/caged?v=NaN',
  '/caged?v=0x1'
];

const SAFE_STRING = /^[A-Za-z0-9._-]{0,24}$/;

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value !== null && typeof value === 'object') {
    Object.values(value).forEach((v) => strings(v, out));
  }
  return out;
}

describe('readReceivedLink: hostile corpus (SC-004)', () => {
  it.each(CORPUS.map((p) => [p.length > 80 ? `${p.slice(0, 77)}...` : p, p]))(
    'never throws and stays within fixed outputs: %s',
    (_label, path) => {
      let url: URL;
      try {
        url = new URL(ORIGIN + path);
      } catch {
        return; // not a loadable address at all; the browser never hands this to the app
      }
      const r = readReceivedLink(url, STORED);
      expect(['none', 'unknown-tool', 'tool']).toContain(r.kind);
      if (r.kind === 'tool') {
        for (const s of strings(r.snapshot)) expect(s).toMatch(SAFE_STRING);
        for (const k of r.fellBack) expect(k.length).toBeLessThanOrEqual(8);
      }
    }
  );

  it('an unknown query with markup on a valid tool yields a usable tool view', () => {
    const r = readReceivedLink(
      new URL(ORIGIN + '/notes?v=1&sel=<script>alert(1)</script>&lb=%22%3E%3Cimg%3E'),
      STORED
    );
    expect(r.kind).toBe('tool');
  });
});
