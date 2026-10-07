import { expect, test, type Page } from '@playwright/test';

import { expandDetails, expectNoHorizontalScroll } from './support/helpers';

const LANDSCAPE = { width: 844, height: 390 };
const PORTRAIT = { width: 390, height: 844 };

const board = (page: Page) => page.getByRole('region', { name: 'Fretboard' });
const opener = (page: Page) => page.getByRole('button', { name: 'Panels', exact: true });
const panel = (page: Page) => page.getByRole('region', { name: 'Actions and details' });
const header = (page: Page) => page.locator('header').first();
const E_TAG = /^E shape · roots on strings 6, 4, 1$/;

async function openTool(page: Page, tool: string, size = LANDSCAPE) {
  await page.setViewportSize(size);
  await page.goto(`/${tool}`);
  await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
  await expect(page.locator('main .grid')).toHaveAttribute('data-arrangement', /.+/);
}

const focused = async (page: Page) => {
  await expect(board(page).getByRole('button', { name: E_TAG }).first()).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(board(page).locator('rect.region-band')).toHaveCount(1);
  await expect(board(page).locator('.description')).toContainText(
    'E shape in focus, frets 8 to 10.'
  );
};

test.describe('landscape (US4)', () => {
  test('rotate keeps CAGED focus', async ({ page }) => {
    await openTool(page, 'caged', PORTRAIT);
    await board(page).getByRole('button', { name: E_TAG }).first().click();
    await focused(page);
    await page.setViewportSize(LANDSCAPE);
    await expect(page.locator('main .grid')).toHaveAttribute('data-arrangement', 'landscape');
    await focused(page);
  });

  test('arrangement: icon-only bar, one-row strip, Panels at strip end', async ({ page }) => {
    await openTool(page, 'caged');
    await expect(page.locator('main .grid')).toHaveAttribute('data-arrangement', 'landscape');
    await expect(header(page)).toHaveAttribute('data-landscape', '');
    const labels = header(page).locator('.bar-label');
    const count = await labels.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const b = await labels.nth(i).boundingBox();
      expect((b?.width ?? 0) <= 1 && (b?.height ?? 0) <= 1).toBe(true);
    }
    const strip = page.locator('main .grid .b').first();
    const sb = await strip.boundingBox();
    const ob = await opener(page).boundingBox();
    if (!sb || !ob) throw new Error('no box');
    expect(sb.height).toBeLessThanOrEqual(120);
    expect(ob.y).toBeLessThanOrEqual(sb.y + sb.height);
    await expectNoHorizontalScroll(page);
  });

  test('sliding panel: ≤ 50% width, board operable, Escape, focus return', async ({ page }) => {
    await openTool(page, 'caged');
    await expect(panel(page)).toHaveCount(0);
    await opener(page).click();
    await expect(panel(page)).toBeVisible();
    await expect(opener(page)).toHaveAttribute('aria-expanded', 'true');
    const pb = await panel(page).boundingBox();
    if (!pb) throw new Error('no panel box');
    expect(pb.width).toBeLessThanOrEqual(LANDSCAPE.width / 2 + 1);
    await expect(page.getByRole('button', { name: 'Close panels' })).toBeFocused();
    // The uncovered fretboard stays operable: its first column is not under the panel.
    const cell = page.getByRole('gridcell').first();
    const cb = await cell.boundingBox();
    if (!cb) throw new Error('no cell box');
    expect(cb.x + cb.width).toBeLessThanOrEqual(pb.x + 1);
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
    await expect(opener(page)).toBeFocused();
    await opener(page).click();
    await page.getByRole('button', { name: 'Close panels' }).click();
    await expect(opener(page)).toBeFocused();
  });

  test('state survives rotation', async ({ page }) => {
    await openTool(page, 'notes', PORTRAIT);
    await page.getByRole('button', { name: /^C$/ }).first().click();
    const pressed = await page.locator('[aria-pressed="true"]').count();
    await page.setViewportSize(LANDSCAPE);
    await expect(page.locator('main .grid')).toHaveAttribute('data-arrangement', 'landscape');
    await page.setViewportSize(PORTRAIT);
    await expect(page.locator('main .grid')).toHaveAttribute('data-arrangement', 'narrow');
    expect(await page.locator('[aria-pressed="true"]').count()).toBe(pressed);
  });

  test('function inventory: same control names as portrait', async ({ page }) => {
    const names = async () => {
      await expandDetails(page).catch(() => undefined);
      return page.evaluate(() => {
        const out = new Set<string>();
        for (const el of document.querySelectorAll(
          'button, a[href], [role="radio"], [role="switch"]'
        )) {
          const n = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim();
          if (n) out.add(n);
        }
        return [...out].sort();
      });
    };
    await openTool(page, 'caged', PORTRAIT);
    // The rotate hint (and its Dismiss) exists only in portrait on purpose.
    const portrait = (await names()).filter((n) => !/^((Show|Hide) details|Dismiss)$/.test(n));
    await page.setViewportSize(LANDSCAPE);
    await expect(page.locator('main .grid')).toHaveAttribute('data-arrangement', 'landscape');
    await opener(page).click();
    const landscape = await names();
    for (const n of portrait) expect(landscape).toContain(n);
  });

  test('no rotate hint at 844×390', async ({ page }) => {
    const HINT = 'Turn your phone sideways to see more of the neck.';
    await openTool(page, 'caged');
    await opener(page).click();
    await expect(page.getByText(HINT)).toHaveCount(0);
  });

  test('portrait hint still shown once', async ({ page }) => {
    const HINT = 'Turn your phone sideways to see more of the neck.';
    await openTool(page, 'caged', PORTRAIT);
    await expandDetails(page);
    await expect(page.getByText(HINT)).toBeVisible();
  });

  test('1024×768 is not landscape', async ({ page }) => {
    await openTool(page, 'caged', { width: 1024, height: 768 });
    await expect(page.locator('main .grid')).not.toHaveAttribute('data-arrangement', 'landscape');
    await expect(header(page)).not.toHaveAttribute('data-landscape', '');
    await expect(opener(page)).toBeHidden();
  });
});
