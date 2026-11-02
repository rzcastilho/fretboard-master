import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const script = join(process.cwd(), 'scripts/stamp-service-worker.mjs');
const LITERAL = '__FM_BUILD_DIGEST__';
const dirs: string[] = [];

function fixture(opts: { sw?: string; with404?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'stamp-'));
  dirs.push(dir);
  mkdirSync(join(dir, '_app/immutable'), { recursive: true });
  writeFileSync(join(dir, 'index.html'), '<html>home</html>');
  writeFileSync(join(dir, 'notes.html'), '<html>notes</html>');
  if (opts.with404 !== false) writeFileSync(join(dir, '404.html'), '<html>404</html>');
  writeFileSync(join(dir, 'theme-boot.js'), 'boot();');
  writeFileSync(join(dir, '_app/immutable/a.js'), 'a();');
  writeFileSync(join(dir, '_headers'), '/*\n  X: 1\n');
  writeFileSync(join(dir, 'service-worker.js'), opts.sw ?? `const d='${LITERAL}';`);
  return dir;
}

const run = (dir: string) => spawnSync('node', [script, dir], { encoding: 'utf8' });
const digestOf = (dir: string) =>
  /const d='([^']*)'/.exec(readFileSync(join(dir, 'service-worker.js'), 'utf8'))?.[1];

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('stamp-service-worker', () => {
  it('replaces the literal with 12 lowercase hex characters', () => {
    const dir = fixture();
    expect(run(dir).status).toBe(0);
    expect(digestOf(dir)).toMatch(/^[0-9a-f]{12}$/);
  });

  it('is stable for the same files', () => {
    const a = fixture();
    const b = fixture();
    run(a);
    run(b);
    expect(digestOf(a)).toBe(digestOf(b));
  });

  it.each(['theme-boot.js', '404.html', 'notes.html', '_app/immutable/a.js'])(
    'changes when %s changes by one byte',
    (file) => {
      const a = fixture();
      const b = fixture();
      writeFileSync(join(b, file), readFileSync(join(b, file), 'utf8') + ' ');
      run(a);
      run(b);
      expect(digestOf(a)).not.toBe(digestOf(b));
    }
  );

  it('ignores service-worker.js and _headers', () => {
    const a = fixture();
    const b = fixture({ sw: `const d='${LITERAL}'; // other` });
    writeFileSync(join(b, '_headers'), 'changed');
    run(a);
    run(b);
    expect(digestOf(a)).toBe(digestOf(b));
  });

  it('exits 1 when the literal is missing, repeated, or 404.html is missing', () => {
    expect(run(fixture({ sw: 'nothing' })).status).toBe(1);
    expect(run(fixture({ sw: `'${LITERAL}' '${LITERAL}'` })).status).toBe(1);
    expect(run(fixture({ with404: false })).status).toBe(1);
  });

  it('maps files to clean URLs (digest depends on the mapped path)', () => {
    // Renaming notes.html to about.html changes the mapped URL, so the digest must change.
    const a = fixture();
    const b = fixture();
    rmSync(join(b, 'notes.html'));
    writeFileSync(join(b, 'about.html'), '<html>notes</html>');
    run(a);
    run(b);
    expect(digestOf(a)).not.toBe(digestOf(b));
  });
});
