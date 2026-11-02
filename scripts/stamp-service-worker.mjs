// Stamps the build digest into <dir>/service-worker.js (040 data-model §3).
// Run after make-404.mjs. Build scripts cannot import $lib, so the path-to-URL mapping is repeated.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const LITERAL = '__FM_BUILD_DIGEST__';
const dir = process.argv[2] ?? 'build';
const EXCLUDED = new Set(['/service-worker.js', '/_headers']);

function fail(message) {
  console.error(`stamp-service-worker: ${message}`);
  process.exit(1);
}

function walk(root) {
  const out = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function toUrl(rel) {
  if (rel === 'index.html') return '/';
  if (rel === '404.html') return '/404.html';
  if (rel.endsWith('.html')) return '/' + rel.slice(0, -'.html'.length);
  return '/' + rel;
}

if (!existsSync(join(dir, '404.html'))) fail(`${join(dir, '404.html')} is missing`);
const workerPath = join(dir, 'service-worker.js');
if (!existsSync(workerPath)) fail(`${workerPath} is missing`);

const entries = walk(dir)
  .map((file) => ({ file, url: toUrl(relative(dir, file).split(sep).join('/')) }))
  .filter((e) => !EXCLUDED.has(e.url))
  .sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));

const hash = createHash('sha256');
for (const { file, url } of entries) {
  hash.update(url + '\0');
  hash.update(readFileSync(file));
  hash.update('\0');
}
const digest = hash.digest('hex').slice(0, 12);

const source = readFileSync(workerPath, 'utf8');
const count = source.split(LITERAL).length - 1;
if (count !== 1) fail(`${LITERAL} found ${count} times in ${workerPath}; expected exactly once`);
writeFileSync(workerPath, source.replace(LITERAL, digest));
console.log(`stamp-service-worker: ${workerPath} digest ${digest} (${entries.length} files)`);
