// Minimal static server that mimics Cloudflare Pages routing for the `build/` output:
// exact file → `<path>.html` → `<path>/index.html`, `/x/` → 308 `/x`, otherwise `404.html` with 404.
// `vite preview` cannot be used for e2e because it never serves the post-build `404.html`.
import { createServer } from 'node:http';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const dir = process.argv[2] ?? 'build';
const port = Number(process.argv[3] ?? 4173);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

// Case-sensitive like the host (macOS filesystems are not).
const isFile = (p) =>
  existsSync(p) &&
  statSync(p).isFile() &&
  readdirSync(join(p, '..')).includes(p.slice(p.lastIndexOf('/') + 1));

function resolveFile(pathname) {
  const clean = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const candidates = [join(dir, clean), join(dir, `${clean}.html`)];
  return candidates.find((c) => isFile(c) && c !== join(dir, '404.html'));
}

createServer((req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  // 028 R-05: mirror the `/m` Pages Function so Lighthouse and unstubbed e2e runs see no 404 noise.
  if (pathname === '/m' && req.method === 'POST') {
    res.writeHead(204, { 'cache-control': 'no-store' }).end();
    return;
  }
  if (pathname.length > 1 && pathname.endsWith('/')) {
    res.writeHead(308, { location: pathname.slice(0, -1) }).end();
    return;
  }
  const file =
    pathname === '/' ? join(dir, 'index.html') : resolveFile(decodeURIComponent(pathname));
  const found = file && isFile(file);
  const target = found ? file : join(dir, '404.html');
  const ext = extname(target);
  res.writeHead(found ? 200 : 404, {
    'content-type': TYPES[ext] ?? 'application/octet-stream',
    'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable'
  });
  res.end(readFileSync(target));
}).listen(port, () => console.log(`serve-build: ${dir} on http://localhost:${port}`));
