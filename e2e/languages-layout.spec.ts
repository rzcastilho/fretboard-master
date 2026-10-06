import { expect, test, type Page } from '@playwright/test';

import { expectNoTruncationOrOverlap, runAxe, setTextScale } from './support/helpers';

const LANGUAGES = [
  { tag: 'en', locale: 'en-US' },
  { tag: 'pt-BR', locale: 'pt-BR' },
  { tag: 'es', locale: 'es-ES' }
] as const;

const SCALES = [100, 200] as const;

type View = { name: string; open: (page: Page) => Promise<void> };

const languageButton = (page: Page) => page.locator('button.language-button');

const VIEWS: readonly View[] = [
  { name: 'home', open: async (page) => void (await page.goto('/')) },
  { name: 'Notes', open: async (page) => void (await page.goto('/notes')) },
  { name: 'Triads', open: async (page) => void (await page.goto('/triads')) },
  { name: 'CAGED', open: async (page) => void (await page.goto('/caged')) },
  { name: 'About', open: async (page) => void (await page.goto('/about')) },
  {
    name: 'instrument panel open',
    open: async (page) => {
      await page.goto('/notes');
      await page.locator('button.instrument-button').click();
      await expect(page.getByRole('dialog')).toBeVisible();
    }
  },
  {
    name: 'language panel open',
    open: async (page) => {
      await page.goto('/notes');
      await languageButton(page).click();
      await expect(page.locator('div[role="region"][id^="language-panel-"]')).toBeVisible();
    }
  }
];

test.use({ viewport: { width: 320, height: 640 } });

for (const { tag, locale } of LANGUAGES) {
  test.describe(`layout in ${tag}`, () => {
    test.use({ locale });

    for (const view of VIEWS) {
      for (const scale of SCALES) {
        test(`${view.name} at ${scale}% has no truncation or overlap`, async ({ page }) => {
          await view.open(page);
          await expect(page.locator('html')).toHaveAttribute('lang', tag);
          await page.waitForLoadState('networkidle');
          if (scale !== 100) await setTextScale(page, scale);
          await expectNoTruncationOrOverlap(page);
        });
      }
    }

    test('notice text stays within two lines at 100% (SC-004)', async ({ page }) => {
      await page.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', {
          get() {
            throw new DOMException('blocked', 'SecurityError');
          }
        });
      });
      await page.goto('/');
      const notices = page.locator('.notice[role="status"]');
      await expect(notices).toHaveCount(1);
      const { height, lineHeight } = await notices.first().evaluate((el) => {
        const target = el.querySelector('p, span') ?? el;
        const style = getComputedStyle(target);
        const fontSize = parseFloat(style.fontSize);
        const lh = style.lineHeight === 'normal' ? fontSize * 1.2 : parseFloat(style.lineHeight);
        return { height: target.getBoundingClientRect().height, lineHeight: lh };
      });
      expect(height).toBeLessThanOrEqual(2 * lineHeight + 1);
    });

    test('selector and language panel pass axe (WCAG 3.1.1/3.1.2)', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('lang', tag);
      await runAxe(page);
      await page.goto('/notes');
      await languageButton(page).click();
      await expect(page.locator('div[role="region"][id^="language-panel-"]')).toBeVisible();
      await runAxe(page);
    });
  });
}
