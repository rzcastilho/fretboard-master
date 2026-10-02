// Polls a live site every 250 ms during a deploy and fails on any non-expected response.
// Usage: node scripts/deploy-availability-probe.mjs <base-url> --stop-file <path>
import { existsSync } from 'node:fs';

const args = process.argv.slice(2);
const base = args[0]?.replace(/\/$/, '');
const stopIdx = args.indexOf('--stop-file');
const stopFile = stopIdx >= 0 ? args[stopIdx + 1] : undefined;
if (!base || !stopFile) {
  console.error('usage: deploy-availability-probe.mjs <base-url> --stop-file <path>');
  process.exit(2);
}

const expected = [
  ['/', 200],
  ['/notes', 200],
  ['/triads', 200],
  ['/about', 200],
  ['/nope', 404]
];
let requests = 0;
const failures = [];

async function check(path, want) {
  requests++;
  try {
    const res = await fetch(base + path, { redirect: 'follow' });
    const text = await res.text();
    if (res.status !== want) failures.push(`${base}${path}: ${res.status} (expected ${want})`);
    return path === '/' ? text : '';
  } catch (err) {
    failures.push(`${base}${path}: ${err.cause?.code ?? err.message}`);
    return null;
  }
}

// Very first deploy: nothing serving yet.
requests = 0;
try {
  await fetch(base + '/', { redirect: 'follow' });
} catch {
  console.log('SKIP: no prior deployment');
  process.exit(0);
}

do {
  let html = '';
  for (const [path, want] of expected) {
    const body = await check(path, want);
    if (path === '/' && body) html = body;
  }
  const assets = new Set(
    [...html.matchAll(/(?:src|href)=["']([^"']*\/_app\/immutable\/[^"']+)["']/g)].map((m) => m[1])
  );
  for (const asset of assets) {
    const path = asset.startsWith('http') ? new URL(asset).pathname : asset.replace(/^\.\//, '/');
    await check(path, 200);
  }
  await new Promise((r) => setTimeout(r, 250));
} while (!existsSync(stopFile));

for (const f of failures) console.error(`FAIL: ${f}`);
console.log(`availability: ${requests} requests, ${failures.length} failed`);
process.exit(failures.length > 0 ? 1 : 0);
