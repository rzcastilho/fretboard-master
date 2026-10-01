import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, renameSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const [major, minor, patch] = pkg.version.split('.').map(Number);
const next = `${major}.${minor}.${patch + 1}`;

function run(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log(`build-next-version: building ${next} -> build-next/`);
run('pnpm', ['exec', 'vite', 'build', '--mode', 'test'], { FM_APP_VERSION: next });
run('node', ['scripts/make-404.mjs']);
rmSync('build-next', { recursive: true, force: true });
renameSync('build', 'build-next');

console.log(`build-next-version: building ${pkg.version} -> build/`);
run('pnpm', ['build:test']);
