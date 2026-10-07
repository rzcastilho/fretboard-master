import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 013 FR-018 / research R-08: handedness and orientation are presentation only. Only the
 * modules below may read or write them; everything else must go through `screenOrder` /
 * `layoutFretboard`, so no tool, theory, audio or notation code can depend on them.
 */
const SRC = join(process.cwd(), 'src');

const ALLOWED = new Set([
  'lib/instrument/instrument.ts',
  'lib/instrument/tunings.ts',
  'lib/instrument/fixtures.ts',
  'lib/fretboard/geometry.ts',
  'lib/state/instrument-config.ts',
  'lib/state/instrument.svelte.ts',
  'lib/state/preferences.svelte.ts',
  'lib/prefs/schema.ts',
  // 028: reads handedness only to label the anonymous `hand` trait; no behaviour depends on it.
  'lib/measure/traits.ts',
  'lib/shell/InstrumentPanel.svelte',
  'lib/shell/InstrumentSummary.svelte'
]);

const PATTERN = /\.(handedness|orientation)\b|\b(handedness|orientation)\s*:/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'paraglide' ? [] : sourceFiles(path);
    return /\.(ts|svelte)$/.test(name) ? [path] : [];
  });
}

/** Drop block, HTML and line comments so prose never trips the scan. */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
}

export function violations(source: string): string[] {
  return stripComments(source)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => PATTERN.test(line));
}

describe('presentation boundary (FR-018)', () => {
  it('the scan ignores comments and catches reads and writes', () => {
    expect(violations('// inst.handedness\n/* orientation: x */\n<!-- .orientation -->')).toEqual(
      []
    );
    expect(violations('const h = inst.handedness;')).toHaveLength(1);
    expect(violations('const c = { orientation: o };')).toHaveLength(1);
    expect(violations('const orientationCount = 2;')).toEqual([]);
  });

  it('only the allow-listed modules touch handedness or orientation', () => {
    const offenders = sourceFiles(SRC)
      .map((file) => ({ file: relative(SRC, file), hits: violations(readFileSync(file, 'utf8')) }))
      .filter(({ file, hits }) => hits.length > 0 && !ALLOWED.has(file))
      .map(({ file, hits }) => `${file}: ${hits.join(' | ')}`);
    expect(offenders).toEqual([]);
  });
});
