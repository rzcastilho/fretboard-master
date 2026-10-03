import { expect, test } from '@playwright/test';

import { injectFault, runAxe, trackRequests } from './support/helpers';

const NOTICE = 'We could not find that page';

test.describe('unknown addresses', () => {
  for (const bad of ['/nope', '/caged', '/triads/x', '/Triads']) {
    test(`${bad} shows home with notice and the URL becomes /`, async ({ page }) => {
      await page.goto('/');
      await page.goto(bad);
      await expect(page.getByRole('status')).toContainText(NOTICE);
      await expect(page.getByRole('heading', { level: 1, name: 'Fretboard Master' })).toBeVisible();
      await expect(page).toHaveURL(/\/$/);
      await page.goBack();
      expect(new URL(page.url()).pathname).not.toBe(bad);
    });
  }

  test('notice is at most two lines at 320 px, default and 200 % zoom', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/nope');
    const text = page.getByRole('status').getByText(NOTICE);
    for (const zoom of [false, true]) {
      if (zoom) await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
      const { height, lineHeight } = await text.evaluate((el) => ({
        height: el.getBoundingClientRect().height,
        lineHeight: parseFloat(getComputedStyle(el).lineHeight)
      }));
      expect(height).toBeLessThanOrEqual(2 * lineHeight + 1);
    }
  });

  test('Dismiss removes notice, adds no history entry, focuses h1', async ({ page }) => {
    await page.goto('/nope');
    const before = await page.evaluate(() => history.length);
    await page.getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.getByRole('status')).toHaveCount(0);
    expect(await page.evaluate(() => history.length)).toBe(before);
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  });

  test('navigating away removes the notice; reload of / shows none', async ({ page }) => {
    await page.goto('/nope');
    await expect(page).toHaveURL(/\/$/); // hydrated: address already replaced with /
    await page.getByRole('link', { name: /^Triads/ }).click();
    await expect(page).toHaveURL(/\/triads$/);
    await page.goBack();
    await expect(page.getByRole('status')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('status')).toHaveCount(0);
  });

  test('axe = 0 on home-with-notice', async ({ page }) => {
    await page.goto('/nope');
    await expect(page.getByRole('status')).toBeVisible();
    await runAxe(page);
  });
});

test.describe('tool failures', () => {
  test('failure view contains the fault, nav stays operable, Reset recovers', async ({ page }) => {
    await injectFault(page, 'triads', 1);
    const logs: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('[fretboard-master] failure')) logs.push(msg.text());
    });
    await page.goto('/triads');
    const tracker = trackRequests(page);
    tracker.start();
    const region = page.getByRole('region', { name: 'Tool error' });
    await expect(region).toContainText('Something went wrong in this view');
    await expect(page.getByRole('navigation', { name: 'Tools' })).toBeVisible();
    await runAxe(page);

    const entries = await page.evaluate(() => history.length);
    await region.getByRole('button', { name: 'Reset tool' }).click();
    await expect(page.getByRole('region', { name: 'Fretboard' })).toBeVisible();
    expect(await page.evaluate(() => history.length)).toBe(entries);
    expect(logs).toHaveLength(1);
    expect(tracker.requests).toEqual([]);
    // Only the remembered-preferences record (lastTool) may exist; the failure path stores nothing.
    const storage = await page.evaluate(() => ({
      local: Object.keys(localStorage),
      session: sessionStorage.length
    }));
    expect(storage.local.filter((k) => k !== 'fretboard-master:prefs')).toEqual([]);
    expect(storage.session).toBe(0);
  });

  test('persistent fault shows the failure view again after Reset (no loop, not blank)', async ({
    page
  }) => {
    await injectFault(page, 'triads', Infinity);
    await page.goto('/triads');
    const region = page.getByRole('region', { name: 'Tool error' });
    await region.getByRole('button', { name: 'Reset tool' }).click();
    await expect(page.getByRole('region', { name: 'Tool error' })).toBeVisible();
  });

  test('Go to home opens /', async ({ page }) => {
    await injectFault(page, 'triads', 1);
    await page.goto('/triads');
    await page
      .getByRole('region', { name: 'Tool error' })
      .getByRole('link', { name: 'Go to home' })
      .click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Fretboard Master' })).toBeVisible();
  });

  test('Notes works while Triads is failed', async ({ page }) => {
    await injectFault(page, 'triads', Infinity);
    await page.goto('/triads');
    await expect(page.getByRole('region', { name: 'Tool error' })).toBeVisible();
    await page
      .getByRole('navigation', { name: 'Tools' })
      .getByRole('link', { name: 'Fretboard Notes' })
      .click();
    await expect(page).toHaveURL(/\/notes$/);
    await expect(page.getByRole('region', { name: 'Fretboard' })).toBeVisible();
  });
});
