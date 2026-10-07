// Delivery monitor: the site and one hashed asset must answer 200 within 2000 ms.
// Usage: node scripts/uptime-check.mjs <production-url>
import { pathToFileURL } from 'node:url';

const LIMIT_MS = 2000;

/** @typedef {(url: string, init?: RequestInit) => Promise<Response>} Fetcher */

/**
 * @param {string} url
 * @param {Fetcher} fetchImpl
 */
async function probe(url, fetchImpl) {
  const started = Date.now();
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(LIMIT_MS), redirect: 'follow' });
    const text = await res.text();
    const ms = Date.now() - started;
    return { url, status: res.status, ms, text, ok: res.status === 200 && ms <= LIMIT_MS };
  } catch (err) {
    return {
      url,
      status: 0,
      ms: Date.now() - started,
      text: '',
      ok: false,
      error: err instanceof Error ? err.name : 'error'
    };
  }
}

/**
 * @param {string} base
 * @param {Fetcher} [fetchImpl]
 * @returns {Promise<{ ok: boolean, lines: string[] }>}
 */
export async function checkSite(base, fetchImpl = fetch) {
  const root = base.replace(/\/$/, '');
  const lines = [];
  /** @param {{ ok: boolean, url: string, status: number, ms: number, error?: string }} r */
  const line = (r) => `${r.ok ? 'ok  ' : 'FAIL'} ${r.url} ${r.status || r.error} ${r.ms}ms`;

  const home = await probe(`${root}/`, fetchImpl);
  lines.push(line(home));
  if (!home.ok) return { ok: false, lines };

  const match = /(?:src|href)=["']([^"']*\/_app\/immutable\/[^"']+)["']/.exec(home.text);
  if (!match) {
    lines.push(`FAIL ${root}/ no /_app/immutable/ asset found in HTML`);
    return { ok: false, lines };
  }
  const asset = await probe(new URL(match[1], `${root}/`).href, fetchImpl);
  lines.push(line(asset));
  return { ok: asset.ok, lines };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = process.argv[2]?.trim();
  if (!base) {
    console.log('uptime-check: PRODUCTION_URL not set, skipping');
    process.exit(0);
  }
  const { ok, lines } = await checkSite(base);
  for (const l of lines) console.log(l);
  process.exit(ok ? 0 : 1);
}
