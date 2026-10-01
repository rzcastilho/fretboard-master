// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Constitution V: root/third/fifth colors are reserved for fretboard markers. */

const RESERVED = /var\(\s*--color-(root|third|fifth)\b/;
const FRETBOARD = 'src/lib/fretboard/Fretboard.svelte';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(svelte|css)$/.test(name) ? [path] : [];
  });
}

const all = files('src').map((p) => ({ path: relative('.', p), text: readFileSync(p, 'utf8') }));

describe('reserved marker colors', () => {
  it('are referenced only from Fretboard.svelte', () => {
    const offenders = all.filter((f) => f.path !== FRETBOARD && RESERVED.test(f.text));
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it('are defined in tokens.css', () => {
    const tokens = all.find((f) => f.path === 'src/lib/styles/tokens.css')?.text ?? '';
    for (const name of ['root', 'third', 'fifth']) {
      expect(tokens).toMatch(new RegExp(`--color-${name}:`));
    }
  });

  it('are used in Fretboard.svelte only inside marker-function rules', () => {
    const text = all.find((f) => f.path === FRETBOARD)?.text ?? '';
    const style = /<style[^>]*>([\s\S]*)<\/style>/.exec(text)?.[1] ?? '';
    const bad: string[] = [];
    for (const rule of style.split('}')) {
      const [selector, body = ''] = rule.split('{');
      const match = RESERVED.exec(body);
      if (!match) continue;
      if (!new RegExp(`\\.${match[1]}\\b`).test(selector)) bad.push(selector.trim());
    }
    expect(bad).toEqual([]);
  });
});
