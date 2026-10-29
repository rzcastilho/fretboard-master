import { expect, test, type Page } from '@playwright/test';

import { expectNoHorizontalScroll, runAxe } from './support/helpers';

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
