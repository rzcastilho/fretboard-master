import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'build';
// Constitution Principle VI (1.3.0).
const LIMIT = 85 * 1024;
const html = readFileSync(join(dir, 'index.html'), 'utf8');

const refs = new Set();
for (const m of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)) refs.add(m[1]);
for (const m of html.matchAll(/<link\b[^>]*\brel=["']modulepreload["'][^>]*>/g)) {
  const href = m[0].match(/\bhref=["']([^"']+)["']/);
  if (href) refs.add(href[1]);
}
// SvelteKit's bootstrap references the entry modules via dynamic import() inside an inline script.
const inline = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
for (const [, code] of inline) {
  for (const m of code.matchAll(/import\(\s*["']([^"']+\.js)["']\s*\)/g)) refs.add(m[1]);
}

let total = 0;
for (const ref of refs) {
  const path = join(dir, ref.replace(/^(\.\/|\/)/, '').replace(/^\.\.\//, ''));
  if (!ref.endsWith('.js') || !existsSync(path)) continue;
  total += gzipSync(readFileSync(path), { level: 9 }).length;
}
for (const [, code] of inline) total += gzipSync(Buffer.from(code), { level: 9 }).length;

const kb = (total / 1024).toFixed(1);
if (total > LIMIT) {
  console.error(`FAIL: initial JS gzip: ${kb} KB > 85 KB`);
  process.exit(1);
}
console.log(`initial JS gzip: ${kb} KB ≤ 85 KB`);
