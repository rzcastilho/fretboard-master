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
    await expect(board(page).locator('.tag:visible')).toHaveCount(9);
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
    await expect(board(page).locator('.tag:visible')).toHaveCount(9);
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

test.describe('TM-9 CAGED view 18 (connections)', () => {
  test('tm9 view 18: F♯ minor, five shapes, connections on', async ({ page }) => {
    await open(page);
    await page.getByRole('radio', { name: 'Minor', exact: true }).click();
    await page.getByRole('group', { name: 'Key' }).getByRole('button').nth(6).click();
    await page.getByRole('switch', { name: 'Show connections' }).click();
    await expect(board(page).locator('.markers .connection-ring').first()).toBeAttached();
    await expect(page).toHaveScreenshot('tm9-view-18.png');
  });
});

test.describe('TM-9 CAGED layers (017)', () => {
  test('tm9 view 20 layers: D major, C shape in focus, Chord + Scale, 7 strings', async ({
    page
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'fretboard-master:prefs',
        JSON.stringify({ version: 1, strings: 7, tuning: 'AF-21' })
      );
    });
    await page.goto('/caged');
    await board(page).waitFor();
    await page.getByRole('group', { name: 'Key' }).getByRole('button').nth(2).click();
    await expect(page.getByText('D major', { exact: true })).toBeVisible();
    await page
      .getByRole('radiogroup', { name: 'Shape' })
      .getByRole('radio', { name: 'C', exact: true })
      .click();
    await page
      .getByRole('group', { name: 'Layers' })
      .getByRole('switch', { name: 'Scale', exact: true })
      .click();
    await expect(board(page).locator('.marker[data-key^="7:"]').first()).toBeVisible();
    // Let the reveal finish before the capture.
    await expect(board(page).locator('.marker.degree').first()).toHaveCSS('opacity', '1');
    await expect(board(page)).toHaveScreenshot('tm9-caged-20-d-c-scale-7.png');
  });

  test('tm9 view 16 layers: A minor, Em shape in focus, Chord + Pentatonic, 6 strings', async ({
    page
  }) => {
    await page.goto('/caged');
    await board(page).waitFor();
    await page.getByRole('group', { name: 'Key' }).getByRole('button').nth(9).click();
    await page
      .getByRole('radiogroup', { name: 'Quality' })
      .getByRole('radio', { name: /minor/i })
      .click();
    await expect(page.getByText('A minor', { exact: true })).toBeVisible();
    await page
      .getByRole('radiogroup', { name: 'Shape' })
      .getByRole('radio', { name: 'E', exact: true })
      .click();
    await page
      .getByRole('group', { name: 'Layers' })
      .getByRole('switch', { name: 'Pentatonic', exact: true })
      .click();
    // Let the reveal finish before the capture.
    await expect(board(page).locator('.marker.degree').first()).toHaveCSS('opacity', '1');
    await expect(board(page)).toHaveScreenshot('tm9-caged-16-am-em-pentatonic.png');
  });

  test('tm9 view 17 layers: G major, E shape in focus, Chord + Arpeggio + Scale', async ({
    page
  }) => {
    await page.goto('/caged');
    await board(page).waitFor();
    await page.getByRole('group', { name: 'Key' }).getByRole('button').nth(7).click();
    await expect(page.getByText('G major', { exact: true })).toBeVisible();
    await page
      .getByRole('radiogroup', { name: 'Shape' })
      .getByRole('radio', { name: 'E', exact: true })
      .click();
    const layers = page.getByRole('group', { name: 'Layers' });
    await layers.getByRole('switch', { name: 'Arpeggio', exact: true }).click();
    await layers.getByRole('switch', { name: 'Scale', exact: true }).click();
    // Let the reveal finish before the capture.
    await expect(board(page).locator('.marker.degree').first()).toHaveCSS('opacity', '1');
    await expect(board(page)).toHaveScreenshot('tm9-caged-17-g-e-arp-scale.png');
  });
});
