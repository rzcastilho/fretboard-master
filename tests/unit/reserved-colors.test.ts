// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Constitution V: root/third/fifth colors are reserved for fretboard markers. */

const RESERVED = /var\(\s*--color-(root|third|fifth)\b/;
const FRETBOARD = 'src/lib/fretboard/Fretboard.svelte';
/** Legend sample of the same marker glyph (spec 017, R-09): still a fretboard marker, not UI chrome. */
const MARKER_SAMPLE = 'src/lib/fretboard/MarkerSample.svelte';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(svelte|css)$/.test(name) ? [path] : [];
  });
}

const all = files('src').map((p) => ({ path: relative('.', p), text: readFileSync(p, 'utf8') }));

describe('reserved marker colors', () => {
  it('are referenced only from Fretboard.svelte and its legend sample', () => {
    const offenders = all.filter(
      (f) => f.path !== FRETBOARD && f.path !== MARKER_SAMPLE && RESERVED.test(f.text)
    );
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

  describe('notes tokens', () => {
    const tokens = all.find((f) => f.path === 'src/lib/styles/tokens.css')?.text ?? '';
    const names = [
      '--color-note-highlight',
      '--color-note-highlight-label',
      ...[1, 2, 3, 4, 5, 6, 7].map((n) => `--octave-tone-${n}`),
      '--region-band'
    ];

    /** Declaration blocks: light (:root), dark (color-scheme media), contrast (contrast media). */
    const blocks = {
      light: /^:root\s*\{([\s\S]*?)\n\}/m.exec(tokens)?.[1] ?? '',
      dark:
        /@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([\s\S]*?)\n\s*\}/.exec(
          tokens
        )?.[1] ?? '',
      contrast:
        /@media \(prefers-contrast: more\)\s*\{\s*:root\s*\{([\s\S]*?)\n\s*\}/.exec(tokens)?.[1] ??
        ''
    };

    const value = (block: string, name: string): string | undefined =>
      new RegExp(`${name}:\\s*([^;]+);`).exec(block)?.[1].trim();

    it.each(names)('%s is defined for light, dark, and more-contrast', (name) => {
      for (const mode of ['light', 'dark', 'contrast'] as const) {
        expect(value(blocks[mode], name), `${name} in ${mode}`).toBeDefined();
      }
    });

    it('never equals or references the reserved root/third/fifth colors', () => {
      for (const mode of ['light', 'dark', 'contrast'] as const) {
        const reserved = ['root', 'third', 'fifth'].map((n) => value(blocks[mode], `--color-${n}`));
        for (const name of names) {
          const v = value(blocks[mode], name);
          if (v === undefined) continue;
          expect(v).not.toMatch(/--color-(root|third|fifth)\b/);
          expect(reserved).not.toContain(v);
        }
      }
    });
  });
});
