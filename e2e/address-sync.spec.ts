import { expect, test, type Page } from '@playwright/test';

const radio = (page: Page, name: string) => page.getByRole('radio', { name, exact: true });
const shareButton = (page: Page) =>
  page.getByRole('banner').getByRole('button', { name: 'Share', exact: true });
const nav = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Tools' }).getByRole('link', { name });

test.describe('address sync US4', () => {
  test('US4-1: changing the inversion updates inv= and Back leaves the tool', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /^Triads/ }).click();
    await expect(page).toHaveURL(/\/triads\?v=1&/);
    await radio(page, '2nd inversion').click();
    await expect.poll(() => page.url()).toContain('inv=second');
    await page.goBack();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/');
  });

  test('US4-2 / SC-004: ten view changes add no history entries', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /^Triads/ }).click();
    await expect(page).toHaveURL(/\/triads\?v=1&/);
    const names = ['minor', '1st inversion', 'diminished', '2nd inversion', 'augmented'];
    for (let i = 0; i < 10; i++) await radio(page, names[i % names.length]).click();
    await page.goBack();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/');
  });

  test('US4-3: the settled address equals the Share link', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/triads');
    await radio(page, 'minor').click();
    await radio(page, '1st inversion').click();
    await expect.poll(() => page.url()).toContain('inv=first');
    await page.waitForTimeout(300);
    const settled = page.url();
    await shareButton(page).click();
    await expect(page.getByRole('status').filter({ hasText: 'Link copied' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(settled);
  });

  test('US4-4: Triads → CAGED gives a CAGED link with no Triads keys', async ({ page }) => {
    await page.goto('/triads');
    await radio(page, '2nd inversion').click();
    await expect.poll(() => page.url()).toContain('inv=second');
    await nav(page, 'CAGED').click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/caged');
    await expect.poll(() => page.url()).toMatch(/\/caged\?v=1&/);
    expect(page.url()).not.toContain('inv=');
  });

  test('panel: changing frets in the instrument panel is reflected in fr=', async ({ page }) => {
    await page.goto('/notes');
    await expect.poll(() => page.url()).toContain('fr=22');
    await page
      .getByRole('button', { name: /instrument/i })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    const spin = dialog.getByRole('spinbutton', { name: 'Frets' });
    await spin.focus();
    await page.keyboard.press('Home');
    await dialog.getByRole('button', { name: 'Confirm' }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => page.url()).toContain('fr=12');
  });

  test('first load: an incoming link is replaced by the canonical link, history unchanged', async ({
    page
  }) => {
    await page.goto('/triads?v=1&inv=second');
    await expect(page.getByText('C major — 2nd inversion', { exact: true }).first()).toBeHidden();
    await expect.poll(() => page.url()).toMatch(/\/triads\?v=1&rt=0&sp=none&q=major&inv=root&/);
    expect(await page.evaluate(() => history.length)).toBeLessThanOrEqual(2);
  });
});
