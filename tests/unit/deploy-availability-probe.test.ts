// @vitest-environment node
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const script = join(process.cwd(), 'scripts/deploy-availability-probe.mjs');
const servers: Server[] = [];
const dirs: string[] = [];

type Handler = (url: string, count: number) => { status: number; body?: string } | 'reset';

async function fixture(handler: Handler): Promise<string> {
  let count = 0;
  const server = createServer((req, res) => {
    count++;
    const r = handler(req.url ?? '/', count);
    if (r === 'reset') return req.socket.destroy();
    res.writeHead(r.status, { 'content-type': 'text/html' });
    res.end(r.body ?? '');
  });
  servers.push(server);
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const healthy: Handler = (url) => {
  if (url === '/') return { status: 200, body: '<script src="/_app/immutable/a.js"></script>' };
  if (url === '/nope') return { status: 404 };
  return { status: 200 };
};

function run(base: string, stopAfterMs: number) {
  const dir = mkdtempSync(join(tmpdir(), 'fm-probe-'));
  dirs.push(dir);
  const stop = join(dir, 'stop');
  const child = spawn('node', [script, base, '--stop-file', stop]);
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (out += d));
  setTimeout(() => writeFileSync(stop, ''), stopAfterMs);
  return new Promise<{ code: number | null; out: string }>((ok) =>
    child.on('close', (code) => ok({ code, out }))
  );
}

afterEach(() => {
  for (const s of servers.splice(0)) s.close();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('deploy-availability-probe', () => {
  it('exits 0 when every request succeeds', async () => {
    const r = await run(await fixture(healthy), 700);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/availability: \d+ requests, 0 failed/);
  });

  it('exits 1 on a single 503 and prints the failing URL', async () => {
    const base = await fixture((url, n) =>
      url === '/about' && n > 8 ? { status: 503 } : healthy(url, n)
    );
    const r = await run(base, 800);
    expect(r.code).toBe(1);
    expect(r.out).toContain('/about');
  });

  it('exits 1 on a connection reset', async () => {
    const base = await fixture((url, n) =>
      url === '/triads' && n > 8 ? 'reset' : healthy(url, n)
    );
    const r = await run(base, 800);
    expect(r.code).toBe(1);
    expect(r.out).toContain('/triads');
  });

  it('exits 1 when a referenced immutable asset is missing', async () => {
    const base = await fixture((url, n) =>
      url.startsWith('/_app/immutable/') ? { status: 404 } : healthy(url, n)
    );
    const r = await run(base, 700);
    expect(r.code).toBe(1);
    expect(r.out).toContain('/_app/immutable/a.js');
  });

  it('skips with exit 0 when nothing is serving yet', async () => {
    const r = await run('http://127.0.0.1:1', 300);
    expect(r.code).toBe(0);
    expect(r.out).toContain('SKIP: no prior deployment');
  });
});
