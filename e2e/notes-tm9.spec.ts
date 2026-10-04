import { expect, test, type Page } from '@playwright/test';

import { runAxe } from './support/helpers';

/** TM-9 screenshot views 1–5 (contracts/test-hooks.md). Semantic facts are asserted too. */

const selector = (page: Page) => page.getByRole('group', { name: 'Choose notes' });
const note = (page: Page, name: string) =>
  selector(page).getByRole('button', { name, exact: true });
const board = (page: Page) => page.getByRole('grid', { name: 'Fretboard' });
const markers = (page: Page, emphasis: string) => board(page).locator(`.marker.${emphasis}`);
const description = (page: Page) => page.locator('.description');

async function open(page: Page, instrument?: 'AF-7' | 'AF-21') {
  if (instrument) {
    await page.addInitScript((i) => {
      globalThis.__fmInstrument = i;
    }, instrument);
  }
  await page.goto('/notes');
  await board(page).waitFor();
}

async function setEnd(page: Page, target: number) {
  const end = page.getByRole('spinbutton', { name: 'End fret' });
  await end.focus();
  await end.press('Home');
  for (let i = 0; i < target; i++) await end.press('ArrowUp');
  await expect(end).toHaveAttribute('aria-valuenow', String(target));
}

test.describe('TM-9 views', () => {
  test('view 1: F♯ highlights 11 positions (22 frets) in octave tones with numbers', async ({
    page
  }) => {
    await open(page);
    await note(page, 'F sharp or G flat').click();
    await expect(markers(page, 'highlighted')).toHaveCount(11);
    await expect(board(page).locator('.marker.highlighted[class*="tone-"]')).toHaveCount(11);
    await expect(board(page).locator('.marker.highlighted text.octave-badge')).toHaveCount(11);
    await expect(description(page)).toContainText('F sharp selected: 11 positions highlighted');
    await expect(page).toHaveScreenshot('tm9-view-1.png');
  });

  test('view 2: region 0–12 dims and unlabels beyond, with a lit band', async ({ page }) => {
    await open(page);
    await setEnd(page, 12);
    await expect(board(page).locator('rect.region-band')).toHaveCount(1);
    await expect(markers(page, 'normal').first()).toBeVisible();
    await expect(markers(page, 'dimmed').first()).toBeVisible();
    await expect(board(page).locator('.marker.dimmed text.marker-label')).toHaveCount(0);
    await expect(description(page)).toContainText('frets 0 to 12');
    await expect(page).toHaveScreenshot('tm9-view-2.png');
  });

  test('view 3: card on s3f2 shows A3 with unisons highlighted', async ({ page }) => {
    await open(page);
    await board(page).locator('.cell[data-string="3"][data-fret="2"]').click();
    await expect(markers(page, 'highlighted')).toHaveCount(4);
    for (const [s, f] of [
      [3, 2],
      [4, 7],
      [5, 12],
      [6, 17]
    ]) {
      await expect(board(page).locator(`.marker.highlighted[data-key="${s}:${f}"]`)).toHaveCount(1);
    }
    await expect(description(page)).toContainText('Position card: A3, string 3, fret 2');
    // the tap also plays the note; let its 1.5 s pulse end so the capture is deterministic
    await expect(board(page).locator('.marker.pulse')).toHaveCount(0);
    await expect(page).toHaveScreenshot('tm9-view-3.png');
  });

  test('view 4: AF-21, Show all, region 0–5 → 7 strings, all labeled', async ({ page }) => {
    await open(page, 'AF-21');
    await page
      .getByRole('radiogroup', { name: 'Show' })
      .getByRole('radio', { name: 'All notes' })
      .click();
    await setEnd(page, 5);
    await expect(board(page).getByRole('row')).toHaveCount(7);
    await expect(description(page)).toContainText('strings 1 to 7');
    // 7 strings × frets 0–5 = 42 labeled markers
    await expect(board(page).locator('.marker.normal text.marker-label')).toHaveCount(42);
    await runAxe(page);
    await expect(page).toHaveScreenshot('tm9-view-4.png');
  });

  test('view 5: AF-7 (DADGAD), select D → every D with octave tones', async ({ page }) => {
    await open(page, 'AF-7');
    await note(page, 'D').click();
    const n = await markers(page, 'highlighted').count();
    expect(n).toBeGreaterThan(8);
    await expect(board(page).locator('.marker.highlighted[class*="tone-"]')).toHaveCount(n);
    await expect(description(page)).toContainText(`D selected: ${n} positions highlighted`);
    await expect(page).toHaveScreenshot('tm9-view-5.png');
  });
});
