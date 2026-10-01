// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const script = join(process.cwd(), 'scripts/check-no-fault-hook.mjs');
const dirs: string[] = [];

function fixture(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'fm-fault-'));
  dirs.push(dir);
  writeFileSync(join(dir, 'app.js'), content);
  return dir;
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('check-no-fault-hook', () => {
  it('fails when the output contains __fmFault', () => {
    const r = spawnSync('node', [script, fixture('globalThis.__fmFault = {}')], {
      encoding: 'utf8'
    });
    expect(r.status).toBe(1);
  });

  it('fails when the output contains "Injected fault"', () => {
    const r = spawnSync('node', [script, fixture('throw new Error("Injected fault: x")')], {
      encoding: 'utf8'
    });
    expect(r.status).toBe(1);
  });

  it('passes on a clean directory', () => {
    const r = spawnSync('node', [script, fixture('console.log("hi")')], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('OK: no fault hook in');
  });
});
