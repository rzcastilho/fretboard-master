import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

import { countInOff, readAudioLog, trackRequests } from './support/helpers';

// 040: the worker is off by default (playwright.config.ts); this spec opts in.
test.use({ serviceWorkers: 'allow' });

const buildDir = join(process.cwd(), 'build');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]
  );
}

/** Every file in `build/` except the worker and `_headers`, as the URL path the cache must hold. */
function expectedKeys(): string[] {
  return walk(buildDir)
    .map((f) => '/' + relative(buildDir, f).split('\\').join('/'))
    .filter((p) => p !== '/service-worker.js' && p !== '/_headers')
    .map((p) => {
      if (p === '/index.html') return '/';
      if (p === '/404.html') return p;
      return p.endsWith('.html') ? p.slice(0, -'.html'.length) : p;
    })
    .sort();
}

/** Paths held by the single `fm-offline-*` cache, or null if there is none yet. */
async function cachedKeys(page: Page): Promise<string[] | null> {
  return page.evaluate(async () => {
    const names = (await caches.keys()).filter((n) => n.startsWith('fm-offline-'));
    if (names.length === 0) return null;
    const cache = await caches.open(names[0]);
    return (await cache.keys()).map((r) => new URL(r.url).pathname).sort();
  });
}

/** Load `/` online, wait for the worker and a complete copy, then take the network away. */
async function goOffline(page: Page, context: BrowserContext): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  const expected = expectedKeys();
  await expect.poll(() => cachedKeys(page), { timeout: 30_000 }).toEqual(expected);
  await context.setOffline(true);
}

/** Notices about the connection, in any of the three languages. Other notices are tool content. */
const NETWORK_WORDS = /offline|network|connect|conex|rede\b|\bred\b|internet/i;
const notices = (page: Page) => page.locator('.notice').filter({ hasText: NETWORK_WORDS });
const failureView = (page: Page) => page.locator('section.failure');

test('C-02: the cache holds exactly the files of the build', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  const expected = expectedKeys();
  expect(expected).toContain('/');
  expect(expected).toContain('/404.html');
  expect(expected).toContain('/triads');
  await expect.poll(() => cachedKeys(page), { timeout: 30_000 }).toEqual(expected);
});

for (const { locale, lang } of [
  { locale: 'en-US', lang: 'en' },
  { locale: 'pt-BR', lang: 'pt-BR' },
  { locale: 'es-ES', lang: 'es' }
] as const) {
  test.describe(`offline in ${lang}`, () => {
    test.use({ locale });

    test(`US1-AS1/2/5, SC-001, FR-004: every screen opens with no connection (${lang})`, async ({
      page,
      context
    }) => {
      const failed: string[] = [];
      await goOffline(page, context);
      page.on('requestfailed', (r) => failed.push(r.url()));
      await page.reload();
      for (const path of ['/', '/notes', '/triads', '/caged', '/metronome', '/about']) {
        await page.goto(path);
        await expect(page.locator('html')).toHaveAttribute('lang', lang);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(failureView(page)).toHaveCount(0);
        await expect(notices(page)).toHaveCount(0);
        expect(new URL(page.url()).pathname).toBe(path);
      }
      expect(failed).toEqual([]);
    });
  });
}

test('US1-AS3, C-13: Ratios Training clicks and the timer chimes with no connection', async ({
  page,
  context
}) => {
  test.setTimeout(120_000); // a running scheduler makes each virtual second cost real time
  await goOffline(page, context);
  await page.clock.install();
  await page.goto('/metronome');
  await page.getByRole('button', { name: 'Start Training' }).click();
  await expect
    .poll(
      async () => {
        await page.clock.runFor(500);
        return (await readAudioLog(page)).filter((e) => e.type === 'click').length;
      },
      { timeout: 30_000, intervals: [50] }
    )
    .toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('tab', { name: 'Metronome', exact: true }).click();
  await countInOff(page);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page
    .getByRole('group', { name: 'Timer length' })
    .getByRole('button', { name: '1m' })
    .click();
  await page.getByRole('button', { name: 'Start timer' }).click();
  await expect
    .poll(
      async () => {
        await page.clock.runFor(10_000);
        return page.locator('section.timer').getAttribute('data-status');
      },
      { timeout: 80_000, intervals: [50] }
    )
    .toBe('finished');
  await expect
    .poll(async () => (await readAudioLog(page)).filter((e) => e.type === 'chime').length)
    .toBe(1);
});

test('US1-AS4: a note plays with no connection', async ({ page, context }) => {
  await goOffline(page, context);
  await page.goto('/notes');
  await page.locator('.cell[data-string="3"][data-fret="2"]').click();
  await expect
    .poll(async () => (await readAudioLog(page)).filter((e) => e.type === 'step').length)
    .toBe(1);
});

async function triadsLink(browser: Browser, baseURL: string | undefined): Promise<string> {
  const ctx = await browser.newContext({ baseURL, locale: 'en-US', serviceWorkers: 'block' });
  try {
    const page = await ctx.newPage();
    await page.goto('/triads');
    await page
      .getByRole('group', { name: 'Root' })
      .getByRole('button', { name: 'A', exact: true })
      .click();
    await page.getByRole('radio', { name: 'minor', exact: true }).click();
    await page.getByRole('radio', { name: '2nd inversion', exact: true }).click();
    await expect.poll(() => page.url()).toMatch(/inv=second/);
    await page.waitForTimeout(300);
    return page.url();
  } finally {
    await ctx.close();
  }
}

test('C-04, FR-017: share links, unknown addresses and trailing slashes work offline', async ({
  page,
  context,
  browser,
  baseURL
}) => {
  const link = await triadsLink(browser, baseURL);
  await goOffline(page, context);

  await page.goto(link);
  expect(new URL(page.url()).pathname).toBe('/triads');
  await expect(page.getByRole('radio', { name: '2nd inversion', exact: true })).toBeChecked();

  await page.goto('/does-not-exist');
  await expect(page.getByRole('status')).toContainText('We could not find that page');
  await expect(page.getByRole('heading', { level: 1, name: 'Fretboard Master' })).toBeVisible();

  await page.goto('/triads/');
  await expect(page).toHaveURL(/\/triads(\?|$)/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('C-10, FR-018: in-app navigation makes no page request once the worker controls', async ({
  page
}) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await expect.poll(() => cachedKeys(page), { timeout: 30_000 }).toEqual(expectedKeys());
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  const seen: string[] = [];
  page.on('request', (request) => {
    // Requests the worker itself makes carry a service-worker frame; those are not the page's.
    if (request.serviceWorker()) return;
    if (request.resourceType() === 'document') seen.push(request.url());
  });
  const track = trackRequests(page);
  track.start();

  await page.getByRole('link', { name: /^Triads/ }).click();
  await expect(page).toHaveURL(/\/triads/);
  const nav = page.getByRole('navigation', { name: 'Tools' });
  for (const name of ['Fretboard Notes', 'CAGED', 'Metronome', 'About', 'Home']) {
    await nav.getByRole('link', { name }).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  expect(seen).toEqual([]);
});

test('C-03, FR-016: POST /m is not intercepted and shows nothing', async ({ page, context }) => {
  await goOffline(page, context);
  await page.goto('/');
  const failed: string[] = [];
  page.on('requestfailed', (r) => failed.push(`${r.method()} ${new URL(r.url()).pathname}`));
  const outcome = await page.evaluate(() =>
    fetch('/m', { method: 'POST', body: '{}' }).then(
      () => 'resolved',
      () => 'rejected'
    )
  );
  // Without a worker the browser fails the request itself; the worker adds no answer of its own.
  expect(outcome).toBe('rejected');
  await expect.poll(() => failed).toContain('POST /m');
  await expect(notices(page)).toHaveCount(0);
  await expect(failureView(page)).toHaveCount(0);
});

test('SC-007, C-11: the manifest is valid, icons load, every page links it, no sign-in', async ({
  page,
  request
}) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.status()).toBe(200);
  const manifest = await res.json();
  expect(manifest).toMatchObject({
    id: '/',
    name: 'Fretboard Master',
    short_name: 'Fretboard Master',
    start_url: '/',
    scope: '/',
    display: 'standalone'
  });
  for (const icon of manifest.icons as { src: string }[]) {
    const r = await request.get(icon.src);
    expect(r.status(), icon.src).toBe(200);
    expect(r.headers()['content-type'], icon.src).toBe('image/png');
  }
  const apple = await request.get('/icons/apple-touch-icon.png');
  expect(apple.status()).toBe(200);

  for (const path of ['/', '/notes', '/triads', '/caged', '/metronome', '/about', '/404.html']) {
    await page.goto(path);
    await expect(page.locator('link[rel="manifest"]'), path).toHaveAttribute(
      'href',
      '/manifest.webmanifest'
    );
    await expect(page.locator('link[rel="apple-touch-icon"]'), path).toHaveAttribute(
      'href',
      /^(https?:\/\/[^/]+)?\/icons\/apple-touch-icon\.png$/
    );
  }

  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await expect(
    page.getByRole('button', { name: /sign[ -]?(in|up)|log ?in|create account/i })
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: /sign[ -]?(in|up)|log ?in|create account/i })
  ).toHaveCount(0);
});

test('US2-AS2, C-12: the start_url opens offline in a new page and practice runs', async ({
  page,
  context
}) => {
  test.setTimeout(120_000);
  await goOffline(page, context);
  const startUrl = (await (await page.request.get('/manifest.webmanifest')).json()).start_url;
  const fresh = await context.newPage();
  await fresh.clock.install();
  await fresh.goto(startUrl);
  await expect(fresh.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(failureView(fresh)).toHaveCount(0);

  await fresh.goto('/metronome');
  await fresh.getByRole('button', { name: 'Start Training' }).click();
  await expect
    .poll(
      async () => {
        await fresh.clock.runFor(500);
        return (await readAudioLog(fresh)).filter((e) => e.type === 'click').length;
      },
      { timeout: 30_000, intervals: [50] }
    )
    .toBeGreaterThan(0);

  await fresh.getByRole('button', { name: 'Reset', exact: true }).click();
  await fresh.getByRole('tab', { name: 'Metronome', exact: true }).click();
  await countInOff(fresh);
  await fresh.getByRole('button', { name: 'Start', exact: true }).click();
  await fresh
    .getByRole('group', { name: 'Timer length' })
    .getByRole('button', { name: '1m' })
    .click();
  await fresh.getByRole('button', { name: 'Start timer' }).click();
  await expect
    .poll(
      async () => {
        await fresh.clock.runFor(10_000);
        return fresh.locator('section.timer').getAttribute('data-status');
      },
      { timeout: 80_000, intervals: [50] }
    )
    .toBe('finished');
  await expect
    .poll(async () => (await readAudioLog(fresh)).filter((e) => e.type === 'chime').length)
    .toBe(1);
});

const deleteAllCaches = (page: Page) =>
  page.evaluate(async () => {
    for (const name of await caches.keys()) await caches.delete(name);
  });

test('US4-AS1, FR-010: a never-loaded offline device gets the browser error page', async ({
  browser,
  baseURL
}) => {
  const ctx = await browser.newContext({ baseURL, offline: true });
  const page = await ctx.newPage();
  await expect(page.goto('/')).rejects.toThrow(/ERR_INTERNET_DISCONNECTED/);
  await expect(page.locator('main, h1, section.failure')).toHaveCount(0);
  await ctx.close();
});

test('US4-AS2, C-08, FR-009: a cleared copy is stored again on the next online load', async ({
  page
}) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  const expected = expectedKeys();
  await expect.poll(() => cachedKeys(page), { timeout: 30_000 }).toEqual(expected);

  await deleteAllCaches(page);
  expect(await cachedKeys(page)).toBeNull();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect.poll(() => cachedKeys(page), { timeout: 30_000 }).toEqual(expected);
});

test('US4-AS3: after clearing, offline shows the browser error, then online recovers', async ({
  page,
  context
}) => {
  test.setTimeout(120_000);
  await goOffline(page, context);
  await context.setOffline(false);
  await deleteAllCaches(page);
  await context.setOffline(true);
  await expect(page.goto('/')).rejects.toThrow(/ERR_/);

  await context.setOffline(false);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect.poll(() => cachedKeys(page), { timeout: 30_000 }).toEqual(expectedKeys());
});

test('FR-013, C-17: a rejected registration leaves the app working with only a console warning', async ({
  page
}) => {
  const warnings: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'warning') warnings.push(m.text());
  });
  await page.addInitScript(() => {
    navigator.serviceWorker.register = () => Promise.reject(new Error('blocked'));
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(failureView(page)).toHaveCount(0);
  await expect(notices(page)).toHaveCount(0);
  await expect
    .poll(() => warnings.some((w) => w.includes('[fretboard-master] offline unavailable')))
    .toBe(true);
});
