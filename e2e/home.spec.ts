import { expect, test, type Locator } from '@playwright/test';

import { expectNoHorizontalScroll, runAxe } from './support/helpers';

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error('element has no bounding box');
  return b;
}

test.describe('home screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows both cards in order, no spinner or auth UI', async ({ page }) => {
    const cards = page.getByRole('list').getByRole('link');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toHaveAccessibleName('Fretboard Notes — Where is every note?');
    await expect(cards.nth(1)).toHaveAccessibleName('Triads — What is a chord made of?');
    await expect(cards.nth(0)).toBeVisible();
    await expect(cards.nth(1)).toBeVisible();
    await expect(page.getByRole('progressbar')).toHaveCount(0);
    await expect(page.getByText(/sign[ -]?(up|in)|log ?in/i)).toHaveCount(0);
  });

  test('cards are equal size and at least 44x44', async ({ page }) => {
    const cards = page.getByRole('list').getByRole('link');
    const a = await box(cards.nth(0));
    const b = await box(cards.nth(1));
    expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(1);
    for (const r of [a, b]) {
      expect(r.width).toBeGreaterThanOrEqual(44);
      expect(r.height).toBeGreaterThanOrEqual(44);
    }
  });

  for (const width of [320, 360, 600, 1024, 1280, 2560]) {
    test(`no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await expectNoHorizontalScroll(page);
    });
  }

  test('safe areas keep content inside insets', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'CDP only on Chromium');
    await page.setViewportSize({ width: 360, height: 740 });
    const cdp = await page.context().newCDPSession(page);
    const targets = () => [
      page.getByRole('banner'),
      page.getByRole('heading', { level: 1 }),
      page.getByRole('banner').getByRole('link', { name: 'About' }),
      ...[0, 1].map((i) => page.getByRole('list').getByRole('link').nth(i))
    ];
    const cases = [
      { top: 47, bottom: 34, left: 0, right: 0 },
      { top: 0, bottom: 0, left: 47, right: 47 }
    ];
    for (const insets of cases) {
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets });
      const vp = { width: 360, height: 740 };
      for (const target of targets()) {
        const r = await box(target);
        expect(r.y).toBeGreaterThanOrEqual(insets.top);
        expect(r.y + r.height).toBeLessThanOrEqual(vp.height - insets.bottom);
        expect(r.x).toBeGreaterThanOrEqual(insets.left);
        expect(r.x + r.width).toBeLessThanOrEqual(vp.width - insets.right);
      }
    }
  });

  test('200% text zoom: no horizontal scroll or overlap', async ({ page }) => {
    // CSSOM (not addStyleTag): style-src 'self' blocks injected <style> elements.
    await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
    await expectNoHorizontalScroll(page);
    const cards = page.getByRole('list').getByRole('link');
    const a = await box(cards.nth(0));
    const b = await box(cards.nth(1));
    const overlap =
      a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    expect(overlap).toBe(false);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`axe clean in ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await runAxe(page);
    });
  }

  test('title and language', async ({ page }) => {
    await expect(page).toHaveTitle('Fretboard Master');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});
