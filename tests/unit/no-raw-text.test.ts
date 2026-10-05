import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';

/** FR-017 / R-08: every user-facing string comes from the Paraglide catalog. */

const TEXT_ATTRIBUTES = new Set(['aria-label', 'title', 'alt', 'placeholder', 'aria-description']);

function svelteFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return svelteFiles(path);
    return path.endsWith('.svelte') ? [path] : [];
  });
}

type Node = { type: string; [key: string]: unknown };

/** Collect literal user-facing text found in a template AST. */
export function findRawText(source: string): string[] {
  const found: string[] = [];
  const ast = parse(source, { modern: true }) as unknown as { fragment: Node };

  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const n = node as Node;

    if (n.type === 'Text') {
      const data = String(n.data ?? '').trim();
      if (data) found.push(`text "${data}"`);
      return;
    }

    // Other attributes (class, href, component props like tool="triads") are not text.
    if (n.type === 'Attribute' && !TEXT_ATTRIBUTES.has(String(n.name))) return;

    if (n.type === 'Attribute') {
      const value = n.value;
      const parts = Array.isArray(value) ? value : [value];
      for (const part of parts as Node[]) {
        if (part && part.type === 'Text' && String(part.data ?? '').trim()) {
          found.push(`${String(n.name)}="${String(part.data).trim()}"`);
        }
        if (part && part.type === 'ExpressionTag') {
          const expr = part.expression as Node;
          if (expr.type === 'Literal' && typeof expr.value === 'string' && expr.value.trim()) {
            found.push(`${String(n.name)}={'${expr.value}'}`);
          }
        }
      }
      return;
    }

    // <style> contents are CSS, not user-facing text.
    if (n.type === 'StyleSheet' || n.type === 'Comment') return;

    for (const [key, child] of Object.entries(n)) {
      if (key === 'type' || key === 'metadata') continue;
      visit(child);
    }
  };

  visit(ast.fragment);
  return found;
}

describe('findRawText', () => {
  it('flags literal text nodes and literal text attributes', () => {
    expect(findRawText('<p>Hello</p>')).toEqual(['text "Hello"']);
    expect(findRawText('<a aria-label="Go" href="/">{m.x()}</a>')).toEqual(['aria-label="Go"']);
    expect(findRawText(`<button title={'Go'}>{m.x()}</button>`)).toEqual([`title={'Go'}`]);
  });

  it('ignores catalog calls, whitespace, comments, and styles', () => {
    const source = `<script lang="ts">const a = 'literal';</script>
<!-- note -->
<h1 aria-label={m.a()}>{m.b()}</h1>
<style>.x { content: 'css'; }</style>`;
    expect(findRawText(source)).toEqual([]);
  });
});

describe('no raw user-facing text in Svelte components', () => {
  const files = svelteFiles('src');

  it('finds components to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} uses only catalog strings`, () => {
      expect(findRawText(readFileSync(file, 'utf8'))).toEqual([]);
    });
  }
});

describe('triad layer strings (018)', () => {
  const triadComponent = 'src/lib/tools/caged/CagedTriadSets.svelte';
  const catalog = JSON.parse(readFileSync('messages/en.json', 'utf8')) as Record<string, string>;
  const triadKeys = Object.keys(catalog).filter((key) => key.startsWith('caged_triad_'));

  it('scans the triad selector component', () => {
    expect(svelteFiles('src')).toContain(triadComponent);
    expect(findRawText(readFileSync(triadComponent, 'utf8'))).toEqual([]);
  });

  it('every caged_triad_* catalog message is used outside the catalog', () => {
    const sources = [
      ...svelteFiles('src'),
      'src/lib/state/caged-triad.ts',
      'src/lib/state/caged-model.ts',
      'src/lib/state/caged.svelte.ts'
    ]
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    expect(triadKeys.length).toBeGreaterThan(0);
    for (const key of triadKeys) expect(sources, key).toContain(key);
  });

  it('the pure theory module imports nothing from the app layers (R-15)', () => {
    const imports = [
      ...readFileSync('src/lib/theory/caged-triad.ts', 'utf8').matchAll(/from '([^']+)'/g)
    ].map((match) => match[1]);
    expect(imports.length).toBeGreaterThan(0);
    for (const spec of imports) expect(spec, spec).toMatch(/^\.\.?\//);
  });
});
