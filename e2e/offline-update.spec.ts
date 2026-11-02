import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join } from 'node:path';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

import { readAudioLog } from './support/helpers';

// 040 US3: a newer version installs in the background and never interrupts a session.
// Needs `build/` (version N) and `build-next/` (N+1): `pnpm build:test:skew`.
test.use({ serviceWorkers: 'allow' });

const dirs = { N: join(process.cwd(), 'build'), N1: join(process.cwd(), 'build-next') };
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.woff2': 'font/woff2'
};

test.skip(!existsSync(dirs.N1), 'build-next/ missing; run `pnpm build:test:skew`');
test.skip(({ browserName }) => browserName !== 'chromium', 'single-browser check');

function resolve(dir: string, pathname: string): string | null {
  const clean = pathname.replace(/\/$/, '') || '/index';
  const candidates = [join(dir, clean), join(dir, `${clean}.html`)];
  return candidates.find((p) => existsSync(p) && extname(p) !== '') ?? null;
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
const [maj, min, patch] = pkg.version.split('.').map(Number);
const versionN = pkg.version;
const versionN1 = `${maj}.${min}.${patch + 1}`;

type Server = {
  version: 'N' | 'N1';
  offline: boolean;
  failPaths: Set<string>;
};

/**
 * Serve `build/` (N) or `build-next/` (N+1) from a switch, on a port of its own.
 * The browser fetches a worker's update check itself, which `context.route` does not see,
 * so a real server is the only way to publish N+1 under the same origin.
 */
async function startServer(): Promise<{ state: Server; origin: string; close: () => void }> {
  const state: Server = { version: 'N', offline: false, failPaths: new Set() };
  const server = createServer((req, res) => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    if (state.offline) return void req.socket.destroy();
    if (state.version === 'N1' && state.failPaths.has(pathname)) {
      res.writeHead(500).end('broken');
      return;
    }
    const file = resolve(dirs[state.version], pathname);
    if (!file) {
      res.writeHead(404).end('gone');
      return;
    }
    res.writeHead(200, {
      'content-type': types[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-cache'
    });
    res.end(readFileSync(file));
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as AddressInfo;
  return {
    state,
    origin: `http://localhost:${port}`,
    close: () => {
      server.closeAllConnections();
      server.close();
    }
  };
}

type Rig = { state: Server; context: BrowserContext; page: Page };

/** Run `body` against a fresh context whose origin is the switchable server. */
async function withRig(browser: Browser, body: (rig: Rig) => Promise<void>): Promise<void> {
  const { state, origin, close } = await startServer();
  const context = await browser.newContext({
    baseURL: origin,
    locale: 'en-US',
    serviceWorkers: 'allow'
  });
  try {
    await body({ state, context, page: await context.newPage() });
  } finally {
    await context.close();
    close();
  }
}

const cacheNames = (page: Page) =>
  page.evaluate(async () => (await caches.keys()).filter((n) => n.startsWith('fm-offline-')));

/** First visit: install, fill the copy, then reload so this page is controlled by the worker. */
async function settle(page: Page): Promise<string> {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await expect.poll(() => cacheNames(page), { timeout: 30_000 }).toHaveLength(1);
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => !!r?.active))
    )
    .toBe(true);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  return (await cacheNames(page))[0];
}

const waiting = (page: Page) =>
  page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => !!r?.waiting));
const checkUpdate = (page: Page) =>
  page.evaluate(() =>
    navigator.serviceWorker
      .getRegistration()
      .then((r) => r?.update())
      .then(
        () => 'resolved',
        () => 'rejected'
      )
  );

async function goAbout(page: Page): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Tools' })
    .getByRole('link', { name: 'About' })
    .click();
  await expect(page).toHaveURL(/\/about$/);
}

const clicks = async (page: Page) =>
  (await readAudioLog(page)).filter((e) => e.type === 'click').length;

/** Close every page, open a new one, and wait until the waiting worker has taken over. */
async function relaunch(context: BrowserContext): Promise<Page> {
  for (const p of context.pages()) await p.close();
  const fresh = await context.newPage();
  await fresh.goto('/');
  await expect
    .poll(
      () =>
        fresh.evaluate(() =>
          navigator.serviceWorker.getRegistration().then((r) => !!r?.active && !r.waiting)
        ),
      { timeout: 30_000 }
    )
    .toBe(true);
  return fresh;
}

test('C-05, FR-006, FR-007, SC-003: a running session is untouched; the next launch gets N+1', async ({
  browser
}) => {
  await withRig(browser, async ({ state: server, page, context }) => {
    test.setTimeout(120_000);
    await page.clock.install();
    await settle(page);

    await page.goto('/metronome');
    await page.getByRole('button', { name: 'Start Training' }).click();
    await expect
      .poll(
        async () => {
          await page.clock.runFor(500);
          return clicks(page);
        },
        { timeout: 30_000, intervals: [50] }
      )
      .toBeGreaterThan(0);

    const entries = () => page.evaluate(() => performance.getEntriesByType('navigation').length);
    const before = await entries();
    await page.evaluate(() => {
      (window as unknown as { __alive: number }).__alive = 1;
    });

    server.version = 'N1';
    expect(await checkUpdate(page)).toBe('resolved');
    await expect.poll(() => waiting(page), { timeout: 30_000 }).toBe(true);

    const seen = await clicks(page);
    await expect
      .poll(
        async () => {
          await page.clock.runFor(1000);
          return clicks(page);
        },
        { timeout: 30_000, intervals: [50] }
      )
      .toBeGreaterThan(seen);
    expect(await entries()).toBe(before);
    expect(await page.evaluate(() => (window as unknown as { __alive?: number }).__alive)).toBe(1);

    await goAbout(page);
    await expect(page.getByText(`Version ${versionN}`, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __alive?: number }).__alive)).toBe(1);

    await page.reload();
    await expect(page.getByText(`Version ${versionN}`, { exact: true })).toBeVisible();

    const fresh = await relaunch(context);
    await fresh.goto('/about');
    await expect(fresh.getByText(`Version ${versionN1}`, { exact: true })).toBeVisible();
  });
});

test('FR-008, SC-004: saved values are byte-identical after the new version takes over', async ({
  browser
}) => {
  await withRig(browser, async ({ state: server, page, context }) => {
    await settle(page);

    await page.goto('/metronome');
    await page.getByRole('switch', { name: 'Subdivision ratio' }).click();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('fretboard-master:prefs')))
      .toContain('"metronome"');
    const snapshot = () =>
      page.evaluate(() =>
        Object.keys(localStorage)
          .filter((k) => k.startsWith('fretboard-master:') && k !== 'fretboard-master:probe')
          .sort()
          .map((k) => [k, localStorage.getItem(k)])
      );
    await page.waitForTimeout(300);
    const before = await snapshot();
    expect(before.length).toBeGreaterThan(0);

    server.version = 'N1';
    await checkUpdate(page);
    await expect.poll(() => waiting(page), { timeout: 30_000 }).toBe(true);

    const fresh = await relaunch(context);
    await fresh.goto('/about');
    await expect(fresh.getByText(`Version ${versionN1}`, { exact: true })).toBeVisible();
    const after = await fresh.evaluate(() =>
      Object.keys(localStorage)
        .filter((k) => k.startsWith('fretboard-master:') && k !== 'fretboard-master:probe')
        .sort()
        .map((k) => [k, localStorage.getItem(k)])
    );
    expect(after).toEqual(before);
  });
});

test('FR-012, C-07: after activation exactly one fm-offline cache remains, and it is new', async ({
  browser
}) => {
  await withRig(browser, async ({ state: server, page, context }) => {
    const old = await settle(page);

    server.version = 'N1';
    await checkUpdate(page);
    await expect.poll(() => waiting(page), { timeout: 30_000 }).toBe(true);
    // Both copies exist while the old one is in use.
    expect(await cacheNames(page)).toContain(old);

    const fresh = await relaunch(context);
    await expect.poll(() => cacheNames(fresh), { timeout: 30_000 }).toHaveLength(1);
    const [current] = await cacheNames(fresh);
    expect(current).not.toBe(old);
  });
});

test('FR-011, US3-AS4: no connection during an update check changes nothing', async ({
  browser
}) => {
  await withRig(browser, async ({ state: server, page }) => {
    const old = await settle(page);

    server.offline = true;
    expect(await checkUpdate(page)).toBe('rejected');
    expect(await waiting(page)).toBe(false);
    expect(await cacheNames(page)).toEqual([old]);
    await expect(page.locator('.notice')).toHaveCount(0);
    await expect(page.locator('section.failure')).toHaveCount(0);

    // Still works from the copy.
    await page.goto('/about');
    await expect(page.getByText(`Version ${versionN}`, { exact: true })).toBeVisible();
  });
});

test('FR-011: a failed install of N+1 leaves N intact and in use', async ({ browser }) => {
  await withRig(browser, async ({ state: server, page }) => {
    const old = await settle(page);

    server.version = 'N1';
    server.failPaths.add('/about');
    await checkUpdate(page); // the install fails; update() may reject
    await page.waitForTimeout(1500);
    expect(await waiting(page)).toBe(false);
    expect(await cacheNames(page)).toEqual([old]);

    server.offline = true;
    await page.goto('/about');
    await expect(page.getByText(`Version ${versionN}`, { exact: true })).toBeVisible();
  });
});
