import { expect, test } from '@playwright/test';

test.describe('home without JavaScript', () => {
  test('renders heading and both cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Fretboard Master' })).toBeVisible();
    await expect(page.getByRole('list').getByRole('link')).toHaveCount(2);
  });

  test('card links navigate as full page loads', async ({ page }) => {
    for (const [name, path] of [
      ['Fretboard Notes', '/notes'],
      ['Triads', '/triads']
    ] as const) {
      await page.goto('/');
      await page.getByRole('link', { name: new RegExp(`^${name}`) }).click();
      await page.waitForURL(`**${path}`);
      await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    }
  });
});

test.describe('unknown address without JavaScript', () => {
  test('prerendered 404 markup shows home with the notice', async ({ page }) => {
    const response = await page.goto('/nope');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'Fretboard Master' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('We could not find that page');
    await expect(page.getByRole('list').getByRole('link')).toHaveCount(2);
  });
});
