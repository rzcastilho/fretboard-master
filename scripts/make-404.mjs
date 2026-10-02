import { existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'build';
const from = join(dir, '__not-found.html');
const to = join(dir, '404.html');

if (!existsSync(from)) {
  console.error(`make-404: ${from} is missing; the catch-all route was not prerendered`);
  process.exit(1);
}
renameSync(from, to);
console.log(`make-404: ${from} -> ${to}`);
