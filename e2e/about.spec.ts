import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

import { runAxe } from './support/helpers';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
};

test.describe('about screen', () => {
  test('opens from home with heading, title, description and version', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('banner').getByRole('link', { name: 'About' }).click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(page).toHaveTitle('About — Fretboard Master');
    await expect(
      page.getByRole('heading', { level: 1, name: 'About Fretboard Master' })
    ).toBeVisible();
    await expect(page.getByText(/interactive fretboard study tools/)).toBeVisible();
    await expect(page.getByText(`Version ${pkg.version}`, { exact: true })).toBeVisible();
  });

  test('persistent nav marks About as current', async ({ page }) => {
    await page.goto('/about');
    const nav = page.getByRole('navigation');
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('link', { name: 'About' })).toHaveAttribute('aria-current', 'page');
  });

  test('Home link returns to home', async ({ page }) => {
    await page.goto('/about');
    await page.getByRole('navigation').getByRole('link', { name: 'Home' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Fretboard Master' })).toBeVisible();
  });

  test('browser Back returns to home', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('banner').getByRole('link', { name: 'About' }).click();
    await expect(page).toHaveURL(/\/about$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Fretboard Master' })).toBeVisible();
  });

  test('has no axe violations', async ({ page }) => {
    await page.goto('/about');
    await runAxe(page);
  });
});
