import { expect, test, type Page } from '@playwright/test';

/**
 * TM-9 screenshot view 15 (CAGED, C major, standard tuning) and the CAGED part of view 22
 * (left-handed). Specs: specs/014-caged-shapes/quickstart.md Q26.
 */

const board = (page: Page) => page.getByRole('region', { name: 'Fretboard' });

async function open(page: Page) {
  await page.goto('/caged');
  await board(page).waitFor();
  await expect(page.getByText('C major', { exact: true })).toBeVisible();
  await expect(board(page).locator('.marker').first()).toBeVisible();
}

test.describe('TM-9 CAGED views', () => {
  test('tm9 view 15: C major, standard tuning → five linked shapes', async ({ page }) => {
    await open(page);
    await expect(board(page).locator('.tag.static:visible')).toHaveCount(9);
    await expect(page).toHaveScreenshot('tm9-view-15.png');
  });

  test('tm9 view 15 left-handed: C major, mirrored board', async ({ page }) => {
    await open(page);
    await page
      .getByRole('button', { name: /strings · |^Tuning:|^Instrument/ })
      .first()
      .click();
    const dialog = page.getByRole('dialog', { name: 'Instrument' });
    await dialog.getByRole('radio', { name: 'Left-handed' }).check();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('C major', { exact: true })).toBeVisible();
    await expect(board(page).locator('.tag.static:visible')).toHaveCount(9);
    await expect(page).toHaveScreenshot('tm9-view-15-left-handed.png');
  });

  test('tm9 slice 015: Open G notice', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'fretboard-master:prefs',
        JSON.stringify({ version: 1, tuning: 'AF-8' })
      );
    });
    await page.goto('/caged');
    await board(page).waitFor();
    await expect(
      page.getByRole('status').filter({ hasText: "shapes don't exist in Open G" })
    ).toBeVisible();
    await expect(board(page)).toHaveScreenshot('tm9-caged-open-g-notice.png');
  });

  test('tm9 slice 015: Drop D, D major', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'fretboard-master:prefs',
        JSON.stringify({ version: 1, tuning: 'AF-4' })
      );
    });
    await page.goto('/caged');
    await board(page).waitFor();
    await page.getByRole('group', { name: 'Key' }).getByRole('button').nth(2).click();
    await expect(page.getByText('D major', { exact: true })).toBeVisible();
    await expect(board(page).locator('text.string-mark')).toHaveText('altered');
    await expect(board(page).locator('.marker').first()).toBeVisible();
    await expect(board(page)).toHaveScreenshot('tm9-caged-drop-d-d-major.png');
  });
});
