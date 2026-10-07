import { expect, test } from '@playwright/test';

test.describe('home without JavaScript', () => {
  test('renders heading and all three cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Fretboard Master' })).toBeVisible();
    await expect(page.getByRole('list').getByRole('link')).toHaveCount(3);
  });

  test('card links navigate as full page loads', async ({ page }) => {
    for (const [name, path] of [
      ['Fretboard Notes', '/notes'],
      ['Triads', '/triads'],
      ['CAGED', '/caged']
    ] as const) {
      await page.goto('/');
      await page.getByRole('link', { name: new RegExp(`^${name}`) }).click();
      await page.waitForURL(new RegExp(`${path}(\\?v=1&.*)?$`));
      await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    }
  });
});

test.describe('tool screens without JavaScript', () => {
  test('prerendered /notes shows the drawn fretboard', async ({ page }) => {
    await page.goto('/notes');
    const grid = page.getByRole('grid', { name: 'Fretboard' });
    await expect(grid).toBeVisible();
    await expect(grid.getByRole('gridcell')).toHaveCount(138);
    await expect(grid.locator('.fret-number')).toHaveCount(22);
  });
});

test.describe('unknown address without JavaScript', () => {
  test('prerendered 404 markup shows home with the notice', async ({ page }) => {
    const response = await page.goto('/nope');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'Fretboard Master' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('We could not find that page');
    await expect(page.getByRole('list').getByRole('link')).toHaveCount(3);
  });
});

test.describe('theme without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('device setting applies through CSS, no attribute, no flash', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    const light = await page.screenshot();
    await page.emulateMedia({ colorScheme: 'dark' });
    const dark = await page.screenshot();
    expect(await page.locator('html').getAttribute('data-theme')).toBeNull();
    expect(dark.equals(light)).toBe(false);
  });
});
