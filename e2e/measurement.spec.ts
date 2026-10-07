import { readFileSync } from 'node:fs';

import { expect, test, type Browser, type Page } from '@playwright/test';

import { findMissingKeys } from '../src/lib/i18n/gaps';
import { expandDetails } from './support/helpers';

/** 028 US1: the six usage events are sent with allowlisted fields only and no identifier. */

type Item = Record<string, unknown>;

const ALLOWED = [
  'r',
  'type',
  'tool',
  'device',
  'lang',
  'strings',
  'tuning',
  'hand',
  'start',
  'secs'
];

/** Capture every `/m` batch (answering 204) and expose the flattened items. */
async function capture(page: Page): Promise<() => Item[]> {
  const items: Item[] = [];
  await page.route('**/m', async (route) => {
    const body = route.request().postData();
    if (body) items.push(...(JSON.parse(body) as { items: Item[] }).items);
    await route.fulfill({ status: 204, body: '' });
  });
  return () => items;
}

const ofType = (items: Item[], type: string): Item[] => items.filter((i) => i.type === type);

async function hide(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

async function tapFret(page: Page): Promise<void> {
  await page.getByRole('grid', { name: 'Fretboard' }).click();
}

test.describe('measurement US1: usage events', () => {
  test('US1-1: tool-opened with start, then first-interaction with whole seconds', async ({
    page
  }) => {
    const items = await capture(page);
    await page.goto('/triads');
    await tapFret(page);
    await hide(page);
    await expect
      .poll(() => ofType(items(), 'first-interaction').length, { timeout: 15_000 })
      .toBe(1);
    const [opened] = ofType(items(), 'tool-opened');
    expect(opened).toMatchObject({ r: 'e', tool: 'triads', start: true });
    const [first] = ofType(items(), 'first-interaction');
    expect(Number.isInteger(first.secs)).toBe(true);
    for (const item of items()) {
      for (const key of Object.keys(item)) expect(ALLOWED).toContain(key);
    }
  });

  test('US1-2: pressing Listen twice sends exactly one sound-played', async ({ page }) => {
    const items = await capture(page);
    await page.goto('/triads');
    const listen = page.getByRole('button', { name: 'Listen', exact: true });
    await listen.click();
    await listen.click();
    await expect.poll(() => ofType(items(), 'sound-played').length, { timeout: 15_000 }).toBe(1);
    await page.waitForTimeout(500);
    expect(ofType(items(), 'sound-played')).toHaveLength(1);
  });

  test('US1-3: sharing sends link-shared and no value looks like a link', async ({
    page,
    context
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const items = await capture(page);
    await page.goto('/triads');
    await page.getByRole('banner').getByRole('button', { name: 'Share', exact: true }).click();
    await expect.poll(() => ofType(items(), 'link-shared').length, { timeout: 15_000 }).toBe(1);
    for (const item of items()) {
      for (const value of Object.values(item)) {
        const text = String(value);
        expect(text).not.toContain('http');
        expect(text).not.toContain('/triads');
        expect(text).not.toContain('?');
      }
    }
  });

  test.describe('US1-4: opening a shared link', () => {
    async function triadsLink(browser: Browser, baseURL: string | undefined): Promise<string> {
      const context = await browser.newContext({ baseURL, locale: 'en-US' });
      try {
        const page = await context.newPage();
        await page.goto('/triads');
        await expandDetails(page);
        await page
          .getByRole('group', { name: 'Root' })
          .getByRole('button', { name: 'D', exact: true })
          .click();
        await expect.poll(() => page.url()).toMatch(/rt=2/);
        return page.url();
      } finally {
        await context.close();
      }
    }

    test('a good link sends link-opened for triads', async ({ page, browser, baseURL }) => {
      const link = await triadsLink(browser, baseURL);
      const items = await capture(page);
      await page.goto(link);
      await expect.poll(() => ofType(items(), 'link-opened').length, { timeout: 15_000 }).toBe(1);
      expect(ofType(items(), 'link-opened')[0]).toMatchObject({ tool: 'triads' });
    });

    test('a broken link sends none', async ({ page }) => {
      const items = await capture(page);
      await page.goto('/nothing-here?v=1');
      await page.goto('/triads');
      await expect.poll(() => ofType(items(), 'tool-opened').length, { timeout: 15_000 }).toBe(1);
      expect(ofType(items(), 'link-opened')).toHaveLength(0);
    });
  });

  test('US1-5: preset then custom tuning send instrument-changed with no note names', async ({
    page
  }) => {
    const items = await capture(page);
    await page.goto('/notes');
    const panel = async () => {
      await page
        .getByRole('button', { name: /^6 strings|^Tuning:|^Instrument/ })
        .first()
        .click();
      return page.getByRole('dialog', { name: 'Instrument' });
    };

    let dialog = await panel();
    await dialog.getByRole('radio', { name: /^Drop D/ }).check();
    await dialog.getByRole('button', { name: 'Confirm' }).click();
    await expect
      .poll(() => ofType(items(), 'instrument-changed').length, { timeout: 15_000 })
      .toBe(1);
    expect(ofType(items(), 'instrument-changed')[0].tuning).toBe('AF-4');

    dialog = await panel();
    await dialog.getByRole('radio', { name: /^Custom/ }).check();
    await page.getByRole('button', { name: 'Lower string 6' }).click();
    await dialog.getByRole('button', { name: 'Confirm' }).click();
    await expect
      .poll(() => ofType(items(), 'instrument-changed').length, { timeout: 15_000 })
      .toBe(2);
    expect(ofType(items(), 'instrument-changed')[1].tuning).toBe('custom');
    expect(JSON.stringify(items())).not.toMatch(/"[A-G][#♯♭b]?\d?"/);
  });

  test('US1-6: two loads share no id-like value', async ({ browser, baseURL }) => {
    const runs: string[] = [];
    for (let i = 0; i < 2; i++) {
      const context = await browser.newContext({ baseURL, locale: 'en-US' });
      const page = await context.newPage();
      const items = await capture(page);
      await page.goto('/notes');
      await tapFret(page);
      await expect.poll(() => items().length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
      for (const item of items()) {
        for (const key of Object.keys(item)) expect(ALLOWED).toContain(key);
      }
      runs.push(JSON.stringify(items().map(({ secs: _secs, ...rest }) => rest)));
      await context.close();
    }
    expect(runs[0]).toBe(runs[1]);
  });
});

test.describe('measurement US2: never in the way', () => {
  const SCREENS = ['/', '/notes', '/triads', '/caged', '/about'];

  /** Visible alerts or status messages: measurement must never raise one. */
  const notices = (page: Page): Promise<number> =>
    page.locator('[role="alert"], [role="status"]:not(:empty)').count();

  /** Visible state that must not depend on whether `/m` works. */
  async function walk(page: Page): Promise<string[]> {
    const out: string[] = [];
    for (const path of SCREENS) {
      await page.goto(path);
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible();
      out.push(`${path} ${await heading.innerText()} notices=${await notices(page)}`);
    }
    await page.goto('/triads');
    await tapFret(page);
    await hide(page);
    out.push(`triads tapped notices=${await notices(page)}`);
    return out;
  }

  /** Console errors the app raises, minus the browser's own noise about the blocked `/m` request. */
  function collectErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !/\/m\b|Failed to load resource|net::/i.test(m.text())) {
        errors.push(m.text());
      }
    });
    page.on('pageerror', (e) => errors.push(e.message));
    return errors;
  }

  async function healthyWalk(
    browser: Browser,
    baseURL: string | undefined
  ): Promise<{ visible: string[]; errors: string[] }> {
    const context = await browser.newContext({ baseURL, locale: 'en-US' });
    const page = await context.newPage();
    const errors = collectErrors(page);
    await capture(page);
    const visible = await walk(page);
    await context.close();
    return { visible, errors };
  }

  const FAILURES: [string, (route: import('@playwright/test').Route) => Promise<void>][] = [
    ['aborted', (route) => route.abort()],
    ['500', (route) => route.fulfill({ status: 500, body: 'nope' })],
    [
      '30 s delay',
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 30_000));
        await route.fulfill({ status: 204, body: '' }).catch(() => {});
      }
    ],
    [
      '302',
      (route) => route.fulfill({ status: 302, headers: { location: 'https://example.invalid/' } })
    ]
  ];

  for (const [name, handler] of FAILURES) {
    test(`US2-1: /m ${name} leaves the interface identical, with no notice or console error`, async ({
      browser,
      baseURL
    }) => {
      const baseline = await healthyWalk(browser, baseURL);
      const context = await browser.newContext({ baseURL, locale: 'en-US' });
      const page = await context.newPage();
      const errors = collectErrors(page);
      await page.route('**/m', handler);
      const actual = await walk(page);
      expect(actual).toEqual(baseline.visible);
      // No error beyond what the healthy run already raises (e.g. pre-existing CSP noise).
      expect(errors.filter((e) => !baseline.errors.includes(e))).toEqual([]);
      await context.close();
    });
  }

  test('US2-4: DNT and GPC each send nothing to /m on any screen (SC-004)', async ({
    browser,
    baseURL
  }) => {
    const signals: [string, string][] = [
      [
        'GPC',
        `Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true, configurable: true });`
      ],
      [
        'DNT',
        `Object.defineProperty(navigator, 'doNotTrack', { get: () => '1', configurable: true });`
      ]
    ];
    for (const [, script] of signals) {
      const context = await browser.newContext({ baseURL, locale: 'en-US' });
      const page = await context.newPage();
      let requests = 0;
      await page.route('**/m', async (route) => {
        requests += 1;
        await route.fulfill({ status: 204, body: '' });
      });
      await page.addInitScript(script);
      await walk(page);
      await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      expect(requests).toBe(0);
      await context.close();
    }
  });
});

test.describe('measurement US3: failure reports', () => {
  const reportsOf = (items: Item[]): Item[] => items.filter((i) => i.r === 'r');

  /** Arm `__fmFault` before load; keys are `tool` (drawing) or `tool:calculation`. */
  async function fault(page: Page, key: string, count: number): Promise<void> {
    await page.addInitScript(
      ([k, c]) => {
        (globalThis as unknown as { __fmFault: Record<string, number> }).__fmFault = {
          [k as string]: c as number
        };
      },
      [key, count] as const
    );
  }

  async function settle(page: Page): Promise<void> {
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  }

  test('US3-1: Triads drawing fault shows the fallback and sends one drawing report', async ({
    page
  }) => {
    const items = await capture(page);
    await fault(page, 'triads', 1);
    await page.goto('/triads');
    await expect(page.getByRole('region', { name: 'Tool error' })).toContainText(
      'Something went wrong in this view'
    );
    await settle(page);
    await expect.poll(() => reportsOf(items()).length, { timeout: 15_000 }).toBe(1);
    const [report] = reportsOf(items());
    expect(report).toMatchObject({
      kind: 'drawing',
      tool: 'triads',
      strings: 6,
      tuning: 'AF-1',
      hand: 'right',
      frets: 22,
      name: 'Error'
    });
    expect(typeof report.view).toBe('object');
    expect(Object.keys(report.view as object)).toEqual(
      expect.not.arrayContaining(['v', 'sc', 'tu', 'fr'])
    );
    expect(report).not.toHaveProperty('key');
  });

  test('US3-2: a calculation fault sends one calculation report', async ({ page }) => {
    const items = await capture(page);
    await fault(page, 'notes:calculation', 1);
    await page.goto('/notes');
    await expect(page.getByRole('region', { name: 'Tool error' })).toBeVisible();
    await settle(page);
    await expect.poll(() => reportsOf(items()).length, { timeout: 15_000 }).toBe(1);
    expect(reportsOf(items())[0]).toMatchObject({ kind: 'calculation', tool: 'notes' });
  });

  test('US3-2: an audio failure sends one audio report and keeps the notice', async ({ page }) => {
    const items = await capture(page);
    await page.addInitScript(() => {
      (globalThis as unknown as { __fmAudioFault: string }).__fmAudioFault = 'context';
    });
    await page.goto('/notes');
    await expandDetails(page);
    await page.getByRole('grid', { name: 'Fretboard' }).click();
    await expect(page.getByText('Sound is not available on this device right now')).toHaveCount(1);
    await settle(page);
    await expect.poll(() => reportsOf(items()).length, { timeout: 15_000 }).toBe(1);
    expect(reportsOf(items())[0]).toMatchObject({ kind: 'audio', tool: 'notes' });
  });

  test('US3-3: the same fault twice sends one report', async ({ page }) => {
    const items = await capture(page);
    await fault(page, 'triads', 2);
    await page.goto('/triads');
    const region = page.getByRole('region', { name: 'Tool error' });
    await expect(region).toBeVisible();
    await region.getByRole('button', { name: 'Reset tool' }).click();
    await expect(region).toBeVisible();
    await settle(page);
    await expect.poll(() => reportsOf(items()).length, { timeout: 15_000 }).toBe(1);
    await page.waitForTimeout(500);
    expect(reportsOf(items())).toHaveLength(1);
  });

  test('US3-5: custom tuning reports "custom" and no offsets', async ({ page }) => {
    const items = await capture(page);
    await page.addInitScript(() => {
      localStorage.setItem(
        'fretboard-master:prefs',
        '{"version":1,"tuning":"AF-1","customTuning":[-2,0,0,-1,0,0]}'
      );
    });
    await fault(page, 'triads', 1);
    await page.goto('/triads');
    await expect(page.getByRole('region', { name: 'Tool error' })).toBeVisible();
    await settle(page);
    await expect.poll(() => reportsOf(items()).length, { timeout: 15_000 }).toBe(1);
    const [report] = reportsOf(items());
    expect(report.tuning).toBe('custom');
    expect(JSON.stringify(report)).not.toMatch(/offsets/i);
  });

  test('US3-4: a missing translation sends one missing-text report per key', async ({
    browser,
    baseURL
  }) => {
    const base = JSON.parse(readFileSync('messages/en.json', 'utf8')) as Record<string, unknown>;
    const catalog = JSON.parse(readFileSync('messages/pt-BR.json', 'utf8')) as Record<
      string,
      unknown
    >;
    const gaps = findMissingKeys(base, catalog);
    test.skip(gaps.length === 0, 'pt-BR has no missing text in this build');
    const context = await browser.newContext({ baseURL, locale: 'pt-BR' });
    const page = await context.newPage();
    const items = await capture(page);
    await page.goto('/notes');
    await settle(page);
    await expect.poll(() => reportsOf(items()).length, { timeout: 15_000 }).toBe(gaps.length);
    const keys = reportsOf(items()).map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(reportsOf(items())[0]).toMatchObject({ kind: 'missing-text' });
    await context.close();
  });
});
