// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseTokenSheet } from './tokens';

/**
 * 026 R-05: the fretboard palette is identical in light and dark. Its tokens are literals that
 * no theme overrides, and the board never reads a surface token.
 */

const sheet = parseTokenSheet();

const PALETTE = /^(--fb-color-|--fb-octave-tone-|--fb-region-band$|--emph-)/;
const HEX = /^#[0-9a-f]{3,8}$/i;
const NUMBER = /^\d+(\.\d+)?$/;

/** Removed names (data-model §5). The lookbehind keeps `--fb-octave-tone-*` from matching. */
const REMOVED = [
  '--color-fretboard-wood',
  '--color-fretboard-line',
  '--color-nut',
  '--color-inlay',
  '--color-root',
  '--color-third',
  '--color-fifth',
  '--color-neutral-note-stroke',
  '--color-neutral-note',
  '--color-degree-stroke',
  '--color-marker-label',
  '--color-note-highlight-label',
  '--color-note-highlight',
  '--octave-tone-\\d',
  '--region-band',
  '--connection-ring(?!-)'
].map((n) => new RegExp(`(?<![\\w-])${n}`));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(svelte|css|ts)$/.test(name) ? [path] : [];
  });
}

describe('palette tokens are literal and theme-independent', () => {
  const palette = Object.entries(sheet.root).filter(([name]) => PALETTE.test(name));

  it('the standard set is present', () => {
    const names = palette.map(([n]) => n);
    for (const required of [
      '--fb-color-wood',
      '--fb-color-edge',
      '--fb-color-root',
      '--fb-color-third',
      '--fb-color-fifth',
      '--fb-color-label',
      '--fb-octave-tone-1',
      '--fb-octave-tone-7',
      '--fb-region-band',
      '--emph-dim-opacity'
    ]) {
      expect(names, required).toContain(required);
    }
  });

  it.each(palette)('%s is a literal, not light-dark() or var()', (name, value) => {
    expect(value).not.toMatch(/light-dark|var\(/i);
    expect(value, name).toMatch(name.startsWith('--emph-') ? NUMBER : HEX);
  });

  it('no [data-theme] block redefines a palette token', () => {
    for (const [theme, map] of Object.entries(sheet.dataTheme)) {
      const offenders = Object.keys(map).filter((n) => PALETTE.test(n));
      expect(offenders, theme).toEqual([]);
    }
  });

  it('no prefers-color-scheme block exists any more', () => {
    expect(Object.keys(sheet.colorSchemeDark)).toEqual([]);
  });
});

/**
 * The migration of the readers (US2: T034–T036) deletes the legacy block of `--color-*` board
 * names from tokens.css. The reader checks below switch on when that block is gone, so they
 * verify the finished migration and are not red while it is in flight.
 */
const migrated = !('--color-fretboard-wood' in sheet.root);

describe.runIf(migrated)('readers use the shared palette only', () => {
  it('no removed token name appears anywhere in src/', () => {
    const offenders = files('src').flatMap((path) => {
      const text = readFileSync(path, 'utf8');
      return REMOVED.filter((re) => re.test(text)).map((re) => `${relative('.', path)}: ${re}`);
    });
    expect(offenders).toEqual([]);
  });

  it('no rule inside the board SVG styles reads a --color-* surface token', () => {
    const text = readFileSync('src/lib/fretboard/Fretboard.svelte', 'utf8');
    const style = /<style[^>]*>([\s\S]*)<\/style>/.exec(text)?.[1] ?? '';
    const board = style.slice(style.indexOf('\n  svg {'));
    expect(board.length).toBeGreaterThan(0);
    const offenders = [...board.matchAll(/var\(\s*(--color-[\w-]+)/g)]
      .map((m) => m[1])
      .filter((n) => !n.startsWith('--color-focus-ring'));
    expect(offenders).toEqual([]);
  });
});
