import { describe, expect, it } from 'vitest';
import { checkSite } from '../../scripts/uptime-check.mjs';

type Fake = (url: string) => Promise<Response>;
const html = '<html><script src="/_app/immutable/entry/start.abc.js"></script></html>';
const ok = (body = ''): Promise<Response> => Promise.resolve(new Response(body, { status: 200 }));

describe('checkSite', () => {
  it('passes when site and asset answer 200', async () => {
    const seen: string[] = [];
    const f: Fake = (url) => {
      seen.push(url);
      return ok(url.endsWith('/') ? html : 'js');
    };
    const r = await checkSite('https://x.test/', f);
    expect(r.ok).toBe(true);
    expect(seen).toEqual(['https://x.test/', 'https://x.test/_app/immutable/entry/start.abc.js']);
  });

  it('fails on status 500', async () => {
    const r = await checkSite('https://x.test', () =>
      Promise.resolve(new Response('', { status: 500 }))
    );
    expect(r.ok).toBe(false);
    expect(r.lines[0]).toContain('500');
  });

  it('fails when slower than 2000 ms', async () => {
    const f: Fake = async () => {
      await new Promise((res) => setTimeout(res, 2100));
      return new Response(html, { status: 200 });
    };
    const r = await checkSite('https://x.test', f);
    expect(r.ok).toBe(false);
  }, 10_000);

  it('fails when the HTML has no immutable asset', async () => {
    const r = await checkSite('https://x.test', () => ok('<html></html>'));
    expect(r.ok).toBe(false);
    expect(r.lines.join('\n')).toContain('/_app/immutable/');
  });

  it('fails when the asset is missing', async () => {
    const f: Fake = (url) =>
      url.endsWith('/') ? ok(html) : Promise.resolve(new Response('', { status: 404 }));
    expect((await checkSite('https://x.test', f)).ok).toBe(false);
  });

  it('skips with exit 0 on an empty URL', async () => {
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync('node', ['scripts/uptime-check.mjs', ''], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('uptime-check: PRODUCTION_URL not set, skipping');
  });
});
