import { expect, test, type Page } from '@playwright/test';

/**
 * TM-9 screenshot views 7, 8, 11, 12 (specs/005-triads-isolated-view/contracts/test-hooks.md)
 * and 6, 9, 14 (specs/006-full-neck-and-all-notes/contracts/test-hooks.md).
 */

const board = (page: Page) => page.getByRole('region', { name: 'Fretboard' });
const panel = (page: Page) => page.getByRole('region', { name: 'Composition' });
const root = (page: Page, name: string | RegExp) =>
  page
    .getByRole('group', { name: 'Root' })
    .getByRole('button', { name, exact: typeof name === 'string' });

async function open(page: Page, instrument?: 'AF-4' | 'AF-8') {
  if (instrument) {
    await page.addInitScript((i) => {
      globalThis.__fmInstrument = i;
    }, instrument);
  }
  await page.goto('/triads');
  await board(page).waitFor();
}

test.describe('TM-9 triads views', () => {
  test('view 7: E♭ minor, 1st inversion, 4-3-2 → E♭–G♭–B♭ with G♭ in the bass', async ({
    page
  }) => {
    await open(page);
    await root(page, /D sharp/).click();
    await page.getByRole('radio', { name: 'minor' }).click();
    await page.getByRole('radio', { name: '1st inversion' }).click();
    await page.getByRole('radio', { name: '4-3-2' }).click();
    await expect(page.getByText('E♭ minor — 1st inversion', { exact: true })).toBeVisible();
    await expect(panel(page).getByRole('list', { name: 'Notes' }).getByRole('listitem')).toHaveText(
      ['E♭', 'G♭', 'B♭']
    );
    await expect(page).toHaveScreenshot('tm9-view-7.png');
  });

  test('view 8: B diminished, root position, 5-4-3 → B–D–F, ♭5 statement', async ({ page }) => {
    await open(page);
    await root(page, 'B').click();
    await page.getByRole('radio', { name: 'diminished' }).click();
    await page.getByRole('radio', { name: '5-4-3' }).click();
    await expect(page.getByText('B diminished — Root position', { exact: true })).toBeVisible();
    await expect(panel(page).getByRole('list', { name: 'Notes' }).getByRole('listitem')).toHaveText(
      ['B', 'D', 'F']
    );
    await expect(page.getByText(/The ♭5 is the characteristic note/)).toBeVisible();
    await expect(page).toHaveScreenshot('tm9-view-8.png');
  });

  test('view 11: D♯ major via Switch to D♯ → D♯–F𝄪–A♯, F𝄪 sounds as G, suggests E♭', async ({
    page
  }) => {
    await open(page);
    await root(page, /D sharp/).click();
    await page.getByRole('button', { name: 'Switch to D♯' }).click();
    await page.getByRole('radio', { name: 'Note names' }).click();
    await expect(page.getByText('D♯ major — Root position', { exact: true })).toBeVisible();
    await expect(panel(page).getByRole('list', { name: 'Notes' }).getByRole('listitem')).toHaveText(
      ['D♯', 'F\u{1D12A}', 'A♯']
    );
    await expect(panel(page).getByText('F\u{1D12A} sounds as G')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Simpler spelling: E♭' })).toBeVisible();
    await expect(board(page).locator('text').filter({ hasText: 'F\u{1D12A}' })).toHaveCount(1);
    await expect(page).toHaveScreenshot('tm9-view-11.png');
  });

  test('view 12: AF-4 Drop D, C major root on 6-5-4 → frets 10-7-5 and Wide stretch', async ({
    page
  }) => {
    await open(page, 'AF-4');
    await page.getByRole('radio', { name: '6-5-4' }).click();
    await expect(page.getByText('Wide stretch', { exact: true })).toBeVisible();
    await expect(page.getByText('C major — Root position', { exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot('tm9-view-12.png');
  });

  test('view 6: A major, 3-2-1, Full neck → six tagged shapes', async ({ page }) => {
    await open(page);
    await root(page, 'A').click();
    await page.getByRole('radio', { name: 'Full neck' }).click();
    const tags = page.getByRole('group', { name: 'Shapes' }).getByRole('button');
    await expect(tags).toHaveCount(6);
    await expect(tags).toHaveText([/Root position/, /1st/, /2nd/, /Root position/, /1st/, /2nd/]);
    await expect(page).toHaveScreenshot('tm9-view-6.png');
  });

  test('view 9: A♭ augmented, 6-5-4, Full neck → A♭–C–E, tags relative to A♭', async ({ page }) => {
    await open(page);
    await root(page, /G sharp/).click();
    await page.getByRole('radio', { name: 'augmented' }).click();
    await page.getByRole('radio', { name: '6-5-4' }).click();
    await page.getByRole('radio', { name: 'Full neck' }).click();
    // Pick the flat spelling when the default is sharp.
    const flat = page.getByRole('button', { name: /^Switch to A♭/ });
    if (await flat.count()) await flat.click();
    const tags = page.getByRole('group', { name: 'Shapes' }).getByRole('button');
    await expect(tags.first()).toBeVisible();
    await expect(panel(page).getByRole('list', { name: 'Notes' }).getByRole('listitem')).toHaveText(
      ['A♭', 'C', 'E']
    );
    // Same drawing, four frets apart.
    const names = await tags.evaluateAll((els) =>
      els.map((e) => e.getAttribute('aria-label') ?? '')
    );
    const lows = names.map((n) => Number(/frets (\d+)-/.exec(n)?.[1]));
    for (let i = 1; i < lows.length; i++) expect(lows[i] - lows[i - 1]).toBe(4);
    await expect(page).toHaveScreenshot('tm9-view-9.png');
  });

  test('view 14: AF-8 Open G, G major, All notes → every G, B, D by function', async ({ page }) => {
    await open(page, 'AF-8');
    await root(page, 'G').click();
    await page.getByRole('radio', { name: 'All notes', exact: true }).click();
    await expect(page.getByRole('radio', { name: 'All notes', exact: true })).toBeChecked();
    await expect(board(page).locator('.marker').first()).toBeVisible();
    await expect(page).toHaveScreenshot('tm9-view-14.png');
  });
});

test.describe('TM-9 triads Compare (feature 007)', () => {
  test('view 10: G major vs minor, 2nd inversion, 4-3-2 → 12-12-12 and 12-12-11', async ({
    page
  }) => {
    await open(page);
    await root(page, 'G').click();
    await page.getByRole('radio', { name: '2nd inversion' }).click();
    await page.getByRole('radio', { name: '4-3-2' }).click();
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    await expect(board(page).locator('.marker.comparison[data-key="2:11"]')).toHaveCount(1);
    await expect(board(page).locator('g.arrows .arrow')).toHaveCount(1);
    await expect(page).toHaveScreenshot('tm9-view-10.png');
  });
});
