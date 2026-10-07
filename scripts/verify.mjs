// Local merge gate. Holds a per-worktree lock so overlapping `pnpm verify` runs cannot pile up,
// starve the machine, and collide on the shared `coverage/` directory.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const LOCK_DIR = 'node_modules/.cache';
const LOCK = `${LOCK_DIR}/verify.lock`;

const STEPS = [
  'pnpm check',
  'pnpm lint',
  'pnpm format:check',
  'pnpm test:unit --coverage',
  'pnpm build',
  'node scripts/check-bundle-size.mjs build',
  'pnpm build:test',
  'pnpm test:e2e:fast'
];

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

function acquire() {
  mkdirSync(LOCK_DIR, { recursive: true });
  try {
    writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
    return;
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
  const holder = Number(readFileSync(LOCK, 'utf8'));
  if (holder && alive(holder)) {
    console.error(`verify already running in this worktree (pid ${holder}); not starting another.`);
    process.exit(1);
  }
  // Stale lock from a killed run: take it over.
  writeFileSync(LOCK, String(process.pid));
}

function release() {
  try {
    if (Number(readFileSync(LOCK, 'utf8')) === process.pid) rmSync(LOCK);
  } catch {
    // Already gone.
  }
}

acquire();
process.on('exit', release);

const child = spawn(STEPS.join(' && '), { shell: true, stdio: 'inherit' });
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => child.kill(sig));
}
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
