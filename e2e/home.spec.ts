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

  test('shows the four cards in order, no spinner or auth UI', async ({ page }) => {
    const cards = page.getByRole('list').getByRole('link');
    await expect(cards).toHaveCount(4);
    await expect(cards.nth(0)).toHaveAccessibleName('Fretboard Notes — Where is every note?');
    await expect(cards.nth(1)).toHaveAccessibleName('Triads — What is a chord made of?');
    await expect(cards.nth(0)).toBeVisible();
    await expect(cards.nth(2)).toHaveAccessibleName('CAGED — How does the whole neck connect?');
    await expect(cards.nth(3)).toHaveAccessibleName(/^Metronome/);
    await expect(cards.nth(3)).toHaveAttribute('href', '/metronome');
    await expect(cards.nth(1)).toBeVisible();
    await expect(cards.nth(2)).toBeVisible();
    await expect(cards.nth(3)).toBeVisible();
    await expect(page.getByRole('progressbar')).toHaveCount(0);
    await expect(page.getByText(/sign[ -]?(up|in)|log ?in/i)).toHaveCount(0);
  });

  test('each card has a decorative fretboard thumbnail and one tab stop', async ({ page }) => {
    const cards = page.getByRole('list').getByRole('link');
    for (const i of [0, 1, 2, 3]) {
      await expect(cards.nth(i).locator('svg.fretboard-thumbnail[aria-hidden="true"]')).toHaveCount(
        1
      );
    }
    await page.keyboard.press('Tab');
    const stops: string[] = [];
    // The app nav also links to /notes and /triads; only card stops (and anything focusable
    // inside a card, e.g. the thumbnail) count. Stop once focus wraps to an already-seen element.
    for (let i = 0; i < 20; i++) {
      const stop = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        if (el.dataset.tabSeen) return null;
        el.dataset.tabSeen = '1';
        return el.closest('a.card')?.getAttribute('href') ?? '';
      });
      if (stop === null) break;
      if (stop) stops.push(stop);
      await page.keyboard.press('Tab');
    }
    expect(stops.filter((h) => h === '/notes')).toHaveLength(1);
    expect(stops.filter((h) => h === '/triads')).toHaveLength(1);
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
