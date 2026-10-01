import { expect, test } from '@playwright/test';

import { trackRequests } from './support/helpers';

test('in-app navigation makes no requests and never reloads', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  const tracker = trackRequests(page);
  tracker.start();
  const entriesBefore = await page.evaluate(
    () => performance.getEntriesByType('navigation').length
  );
  const nav = page.getByRole('navigation', { name: 'Tools' });

  await page.getByRole('link', { name: /^Triads/ }).click();
  await expect(page).toHaveURL(/\/triads$/);
  await nav.getByRole('link', { name: 'Fretboard Notes' }).click();
  await expect(page).toHaveURL(/\/notes$/);
  await nav.getByRole('link', { name: 'About' }).click();
  await expect(page).toHaveURL(/\/about$/);
  await nav.getByRole('link', { name: 'Home' }).click();
  await expect(page).toHaveURL(/\/$/);

  const origin = new URL(page.url()).origin;
  expect(tracker.requests.map((r) => r.url())).toEqual([]);
  expect(tracker.requests.filter((r) => !r.url().startsWith(origin))).toEqual([]);
  expect(await page.evaluate(() => performance.getEntriesByType('navigation').length)).toBe(
    entriesBefore
  );
});
