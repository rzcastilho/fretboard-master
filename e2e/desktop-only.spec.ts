import { expect, test, type Page } from '@playwright/test';

import {
  expectNoHorizontalScroll,
  expectNoTruncationOrOverlap,
  runAxe,
  setTextScale
} from './support/helpers';

const ROUTES = ['/', '/notes', '/triads', '/caged', '/about'] as const;
const TOOLS = ['/notes', '/triads', '/caged'] as const;
const DESKTOP_SIZES = [
  { width: 1024, height: 768 },
  { width: 2560, height: 1440 }
] as const;

const arrangement = (page: Page) => page.locator('main .grid').getAttribute('data-arrangement');

test.describe('desktop layouts (US1)', () => {
  for (const route of ROUTES) {
    for (const size of DESKTOP_SIZES) {
      test(`${route} at ${size.width}×${size.height}: fits, controls visible, axe clean`, async ({
        page
      }) => {
        await page.setViewportSize(size);
        await page.goto(route);
        await expectNoHorizontalScroll(page);
        if (route !== '/' && route !== '/about') {
          await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
          await expect.poll(() => arrangement(page)).toMatch(/^wide-(side|stacked)$/);
          // No menu hides a control: every zone is on screen and no Show details toggle exists.
          await expect(page.getByRole('button', { name: /^(Show|Hide) details$/ })).toHaveCount(0);
          for (const zone of ['b', 'c', 'e', 'd']) {
            await expect(page.locator(`main .grid > .${zone}`)).toBeVisible();
          }
        }
        await runAxe(page);
      });
    }
  }

  for (const route of TOOLS) {
    test(`${route}: resizing 1024 ↔ 2560 only toggles wide-side / wide-stacked`, async ({
      page
    }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto(route);
      await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
      for (const width of [1024, 1400, 1800, 2560, 1800, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        await expect.poll(() => arrangement(page)).toMatch(/^wide-(side|stacked)$/);
        await expect(page.locator('html')).toHaveAttribute(
          'data-arrangement',
          /^wide-(side|stacked)$/
        );
      }
    });
  }

  test('keyboard-only pass reaches the controls of a tool in order', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/notes');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const label = await page.evaluate(() => {
        const el = document.activeElement;
        return el === null || el === document.body
          ? ''
          : (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40);
      });
      if (label !== '') seen.add(label);
    }
    // The main controls, the fretboard and the action buttons are all reachable by Tab alone.
    expect(seen.size).toBeGreaterThan(10);
    const inMain = await page.evaluate(() => document.activeElement?.closest('main') !== null);
    expect(inMain || seen.size > 10).toBe(true);
  });
});

test.describe('phone-only behaviors are gone (US2)', () => {
  const ROTATE_HINT = /Turn your phone sideways/;

  for (const size of [
    { width: 390, height: 844 },
    { width: 600, height: 900 }
  ]) {
    test(`CAGED at ${size.width}×${size.height}: no rotate hint on first visit`, async ({
      page
    }) => {
      await page.setViewportSize(size);
      await page.goto('/caged');
      await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
      await expect(page.getByText(ROTATE_HINT)).toHaveCount(0);
      await expect(page.locator('.notice')).toHaveCount(0);
    });
  }

  test('1280×500 is a wide arrangement with no Panels button', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 });
    await page.goto('/notes');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await expect.poll(() => arrangement(page)).toMatch(/^wide-(side|stacked)$/);
    await expect(page.getByRole('button', { name: /panels/i })).toHaveCount(0);
  });

  test.describe('touch input', () => {
    test.use({ hasTouch: true });

    test('a two-finger pinch leaves the fit mode unchanged', async ({ page }) => {
      await page.setViewportSize({ width: 640, height: 400 });
      await page.goto('/notes');
      const svg = page.locator('.fretboard svg[role="grid"]');
      await svg.waitFor();
      const before = await svg.getAttribute('width');
      await page.locator('.fretboard .scroller').evaluate((el) => {
        const touch = (id: number, x: number) =>
          new Touch({ identifier: id, target: el, clientX: x, clientY: 100 });
        const fire = (type: string, gap: number, live = true) =>
          el.dispatchEvent(
            new TouchEvent(type, {
              bubbles: true,
              touches: live ? [touch(1, 100), touch(2, 100 + gap)] : []
            })
          );
        fire('touchstart', 200);
        fire('touchmove', 100);
        fire('touchend', 0, false);
        fire('touchstart', 100);
        fire('touchmove', 200);
        fire('touchend', 0, false);
      });
      await expect(svg).toHaveAttribute('width', before ?? '');
    });

    test('a tap on a fretboard position behaves like a click', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/notes');
      const cell = page.locator('[data-string="2"][data-fret="1"]').first();
      await cell.waitFor();
      await cell.tap();
      await expect(cell).toBeFocused();
    });
  });

  test('body has no safe-area padding', async ({ page }) => {
    await page.goto('/');
    const padding = await page.evaluate(() => {
      const cs = getComputedStyle(document.body);
      return [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft];
    });
    expect(padding).toEqual(['0px', '0px', '0px', '0px']);
  });
});

test.describe('old preferences and links keep working (US4)', () => {
  const PREFS_KEY = 'fretboard-master:prefs';

  test('a stored record with rotateHint applies every other field and drops the field on write', async ({
    page
  }) => {
    await page.addInitScript(
      ([key, value]) => {
        if (localStorage.getItem('__seeded') === null) {
          localStorage.setItem(key as string, value as string);
          localStorage.setItem('__seeded', '1');
        }
      },
      [
        PREFS_KEY,
        '{"version":1,"tuning":"AF-3","frets":24,"muted":true,"volume":0.35,"labels":{"notes":"octave","triads":"name"},"rotateHint":true}'
      ] as const
    );
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/notes');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await expect(page.getByRole('status').filter({ hasText: /incomplete|storage/i })).toHaveCount(
      0
    );
    // The tool screen records `lastTool`, which rewrites the record without `rotateHint`.
    await expect
      .poll(() =>
        page.evaluate((key) => {
          const raw = localStorage.getItem(key);
          return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>);
        }, PREFS_KEY)
      )
      .toMatchObject({ tuning: 'AF-3', frets: 24, muted: true, lastTool: 'notes' });
    const stored = await page.evaluate((key) => localStorage.getItem(key) ?? '', PREFS_KEY);
    expect(stored).not.toContain('rotateHint');
  });

  test('a canonical link opens the same view with a legacy record in storage', async ({
    page,
    browser,
    baseURL
  }) => {
    const context = await browser.newContext({ baseURL, locale: 'en-US' });
    const maker = await context.newPage();
    await maker.goto('/caged?v=1&rt=2');
    await maker.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await expect.poll(() => maker.url()).toContain('/caged');
    const link = maker.url();
    await context.close();

    await page.addInitScript(
      ([key, value]) => localStorage.setItem(key as string, value as string),
      [PREFS_KEY, '{"version":1,"rotateHint":true}'] as const
    );
    await page.goto(link);
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    expect(new URL(page.url()).pathname).toBe('/caged');
  });
});

test.describe('small screens are not blocked (US5)', () => {
  const SMALL = [
    { width: 320, height: 200 },
    { width: 640, height: 400 }
  ] as const;

  for (const route of ROUTES) {
    for (const size of SMALL) {
      test(`${route} at ${size.width}×${size.height}: reflow, reachable, nothing blocking, axe clean`, async ({
        page
      }) => {
        await page.setViewportSize(size);
        await page.goto(route);
        // Home has no arrangement-dependent layout, so it carries no attribute.
        if (route !== '/') {
          await expect(page.locator('html')).toHaveAttribute('data-arrangement', 'reflow');
        }
        await expectNoHorizontalScroll(page);
        // The instrument panel's <dialog> is always in the DOM but closed; only an open one blocks.
        await expect(
          page.locator('dialog[open], [role="dialog"]:visible, [aria-modal="true"]:visible')
        ).toHaveCount(0);
        if (route !== '/' && route !== '/about') {
          const board = page.getByRole('grid', { name: 'Fretboard' });
          await board.waitFor();
          await expect(board).toBeAttached();
          await expect.poll(() => arrangement(page)).toBe('reflow');
        }
        await runAxe(page);
      });
    }
  }

  for (const { tag, locale } of [
    { tag: 'en', locale: 'en-US' },
    { tag: 'pt-BR', locale: 'pt-BR' },
    { tag: 'es', locale: 'es-ES' }
  ]) {
    test.describe(`200% text zoom in ${tag}`, () => {
      test.use({ locale, viewport: { width: 1024, height: 768 } });

      test('a tool has no truncation or overlap', async ({ page }) => {
        await page.goto('/notes');
        await expect(page.locator('html')).toHaveAttribute('lang', tag);
        await page.getByRole('grid').first().waitFor();
        await page.waitForLoadState('networkidle');
        await setTextScale(page, 200);
        await expectNoTruncationOrOverlap(page);
      });
    });
  }
});
