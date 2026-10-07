import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

import { runAxe } from './support/helpers';

const catalog = (tag: string): Record<string, string> =>
  JSON.parse(readFileSync(new URL(`../messages/${tag}.json`, import.meta.url), 'utf8'));

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

  test('sections appear in order with h2 headings', async ({ page }) => {
    await page.goto('/about');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 2 })).toHaveText([
      'What this app is',
      'Marker legend',
      'Keyboard shortcuts',
      'Privacy',
      'Version'
    ]);
  });

  test('legend has exactly root, third and fifth with shape and name', async ({ page }) => {
    await page.goto('/about');
    const items = page.getByRole('region', { name: 'Marker legend' }).getByRole('listitem');
    await expect(items).toHaveCount(3);
    for (const [i, name] of ['Root', 'Third', 'Fifth'].entries()) {
      await expect(items.nth(i)).toContainText(name);
      await expect(items.nth(i).locator('svg')).toHaveCount(1);
    }
  });

  for (const tag of ['en', 'pt-BR', 'es'] as const) {
    test.describe(`about in ${tag}`, () => {
      test.use({ locale: tag });

      test('shows every section translated', async ({ page }) => {
        const cat = catalog(tag);
        await page.goto('/about');
        await expect(page.locator('html')).toHaveAttribute('lang', tag);
        await expect(page.getByRole('heading', { level: 2 })).toHaveText([
          cat.about_intro_heading ?? '',
          cat.about_legend_heading ?? '',
          cat.shortcuts_heading ?? '',
          cat.about_privacy_heading ?? '',
          cat.about_version_heading ?? ''
        ]);
        for (const key of [
          'about_privacy_measured',
          'about_privacy_errors',
          'about_privacy_never',
          'about_privacy_dnt'
        ]) {
          await expect(page.getByText(cat[key] ?? '', { exact: true })).toBeVisible();
        }
      });
    });
  }

  test('switch language on About keeps the page and URL', async ({ page }) => {
    await page.goto('/about');
    await page.getByRole('button', { name: 'Language and appearance', exact: true }).click();
    await page.getByRole('radio', { name: 'Español' }).check();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page).toHaveURL(/\/about$/);
    await expect(
      page.getByRole('heading', { level: 2, name: catalog('es').about_privacy_heading ?? '' })
    ).toBeVisible();
  });

  test('/about#privacy scrolls the Privacy section into view', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 500 });
    await page.goto('/about#privacy');
    await expect(page.locator('#privacy')).toBeInViewport();
  });

  test('an in-app link to /about#privacy scrolls and focuses the Privacy heading', async ({
    page
  }) => {
    await page.setViewportSize({ width: 360, height: 500 });
    await page.goto('/');
    // SvelteKit intercepts same-origin anchor clicks, so this is an in-app navigation (R-15).
    await page.evaluate(() => {
      const a = document.createElement('a');
      a.href = '/about#privacy';
      a.id = 'to-privacy';
      a.textContent = 'x';
      document.body.append(a);
    });
    await page.locator('#to-privacy').click();
    await expect(page).toHaveURL(/\/about#privacy$/);
    await expect(page.locator('#privacy')).toBeInViewport();
    await expect(page.getByRole('heading', { level: 2, name: 'Privacy' })).toBeFocused();
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`has no axe violations in ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/about');
      await runAxe(page);
    });
  }
});
