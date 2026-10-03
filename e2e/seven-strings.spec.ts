import { expect, test, type Page } from '@playwright/test';

import { readAudioLog, runAxe } from './support/helpers';

const PREFS_KEY = 'fretboard-master:prefs';

const openPanel = async (page: Page) => {
  await page
    .getByRole('button', { name: /strings · |^Tuning:|^Instrument/ })
    .first()
    .click();
  const dialog = page.getByRole('dialog', { name: 'Instrument' });
  await expect(dialog).toBeVisible();
  return dialog;
};

const confirm = async (page: Page) => {
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByRole('dialog', { name: 'Instrument' })).toBeHidden();
};

const useSevenStrings = async (page: Page) => {
  const dialog = await openPanel(page);
  await dialog.getByRole('radio', { name: '7 strings' }).check();
  await confirm(page);
};

const storedPrefs = (page: Page) =>
  page.evaluate((k) => localStorage.getItem(k), PREFS_KEY) as Promise<string | null>;

const cellAt = (page: Page, string: number, fret: number) =>
  page.locator(`.cell[data-string="${string}"][data-fret="${fret}"]`);

test.describe('seven strings: panel and instrument (US1)', () => {
  test('Q1: 7 strings → Confirm shows seven strings, B1 on string 7, no badge, summary', async ({
    page
  }) => {
    await page.goto('/');
    await useSevenStrings(page);
    await expect(
      page.getByRole('button', { name: '7 strings · standard tuning · right-handed' })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /^Tuning:/ })).toHaveCount(0);

    await page.goto('/notes');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await expect(page.locator('.cell[data-fret="0"]')).toHaveCount(7);
    await expect(cellAt(page, 7, 0)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Tuning:/ })).toHaveCount(0);
    await runAxe(page);
  });

  test('Q2: string 7 fret 0 plays B1 (pitch 35)', async ({ page }) => {
    await page.goto('/');
    await useSevenStrings(page);
    await page.goto('/notes');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    // Direct navigation reloads: the remembered 7-string instrument is restored.
    await cellAt(page, 7, 0).click();
    await expect
      .poll(async () => (await readAudioLog(page)).filter((e) => e.type === 'step').length)
      .toBe(1);
    const step = (await readAudioLog(page)).find((e) => e.type === 'step');
    if (step?.type !== 'step') throw new Error('no step entry');
    expect(step.pitches).toEqual([35]);
  });

  test('Q3: 12 presets in FR-003 order; Drop D row shows A1 D2 A2 D3 G3 B3 E4', async ({
    page
  }) => {
    await page.goto('/');
    const dialog = await openPanel(page);
    await dialog.getByRole('radio', { name: '7 strings' }).check();
    const names = await dialog.locator('.preset .name').allTextContents();
    expect(names).toEqual([
      '7-string standard',
      '7-string half step down',
      'Drop A',
      'Whole step down',
      'Drop D',
      'Drop C',
      'Double Drop D',
      'DADGAD',
      'Open G',
      'Open D',
      'Open E',
      'Open A',
      'Custom'
    ]);
    const dropD = dialog.locator('.preset', { has: page.getByRole('radio', { name: /^Drop D:/ }) });
    await expect(dropD.locator('.notes')).toHaveText('A1 D2 A2 D3 G3 B3 E4');
    await runAxe(page);
  });

  test('Q4: Drop A on 7 strings shows the badge and plays A1 (pitch 33)', async ({ page }) => {
    await page.goto('/');
    const dialog = await openPanel(page);
    await dialog.getByRole('radio', { name: '7 strings' }).check();
    await dialog
      .locator('.preset', { has: page.getByRole('radio', { name: /^Drop A:/ }) })
      .locator('input')
      .check();
    await confirm(page);
    await expect(
      page.getByRole('button', { name: '7 strings · Drop A · right-handed' })
    ).toBeVisible();
    await page.goto('/notes');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await expect(
      page.getByRole('button', { name: 'Tuning: Drop A. Open instrument panel' })
    ).toBeVisible();
    await cellAt(page, 7, 0).click();
    await expect
      .poll(async () => (await readAudioLog(page)).filter((e) => e.type === 'step').length)
      .toBe(1);
    const step = (await readAudioLog(page)).find((e) => e.type === 'step');
    if (step?.type !== 'step') throw new Error('no step entry');
    expect(step.pitches).toEqual([33]);
  });

  test('Q5: Drop D stays checked going 6 → 7 and the badge stays "Drop D"', async ({ page }) => {
    await page.goto('/');
    let dialog = await openPanel(page);
    await dialog
      .locator('.preset', { has: page.getByRole('radio', { name: /^Drop D:/ }) })
      .locator('input')
      .check();
    await confirm(page);
    dialog = await openPanel(page);
    await dialog.getByRole('radio', { name: '7 strings' }).check();
    await expect(
      dialog
        .locator('.preset', { has: page.getByRole('radio', { name: /^Drop D:/ }) })
        .locator('input')
    ).toBeChecked();
    await expect(
      dialog
        .locator('.preset', { has: page.getByRole('radio', { name: /^Drop D:/ }) })
        .locator('.notes')
    ).toHaveText('A1 D2 A2 D3 G3 B3 E4');
    await confirm(page);
    await page.goto('/notes');
    await expect(
      page.getByRole('button', { name: 'Tuning: Drop D. Open instrument panel' })
    ).toBeVisible();
  });

  test('Q6: lowering string 7 stops at E1; Drop A at A1, Custom at G♯1', async ({ page }) => {
    await page.goto('/');
    const dialog = await openPanel(page);
    await dialog.getByRole('radio', { name: '7 strings' }).check();
    await dialog.getByRole('radio', { name: /^Custom/ }).check();
    const lower = dialog.getByRole('button', { name: 'Lower string 7' });
    await lower.click();
    await lower.click();
    await expect(dialog.getByRole('button', { name: 'String 7, A 1' })).toBeVisible();
    await expect(dialog.getByRole('status')).toContainText('Drop A');
    await lower.click();
    await expect(dialog.getByRole('status')).toContainText('Custom');
    for (let i = 0; i < 4; i++) await lower.click();
    await expect(lower).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'String 7, E 1' })).toBeVisible();
    await expect(dialog.locator('[role="alert"]')).toHaveCount(0);
    await runAxe(page);
  });
});

test.describe('seven strings: remembered (US1, Q15–Q17)', () => {
  test('Q15: 7 strings persist across reload', async ({ page }) => {
    await page.goto('/');
    await useSevenStrings(page);
    expect(await storedPrefs(page)).toContain('"strings":7');
    await page.reload();
    await expect(
      page.getByRole('button', { name: '7 strings · standard tuning · right-handed' })
    ).toBeVisible();
    await page.goto('/notes');
    await expect(page.locator('.cell[data-fret="0"]')).toHaveCount(7);
  });

  test('Q16: Restore default → Confirm gives 6 strings and no strings key', async ({ page }) => {
    await page.goto('/');
    await useSevenStrings(page);
    const dialog = await openPanel(page);
    await dialog.getByRole('button', { name: 'Restore default' }).click();
    await confirm(page);
    await expect(
      page.getByRole('button', { name: '6 strings · standard tuning · right-handed' })
    ).toBeVisible();
    const raw = await storedPrefs(page);
    expect(raw === null || !raw.includes('"strings"')).toBe(true);
  });

  test('Q17: closing without Confirm keeps 6 strings', async ({ page }) => {
    await page.goto('/');
    const dialog = await openPanel(page);
    await dialog.getByRole('radio', { name: '7 strings' }).check();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(
      page.getByRole('button', { name: '6 strings · standard tuning · right-handed' })
    ).toBeVisible();
    const raw = await storedPrefs(page);
    expect(raw === null || !raw.includes('"strings"')).toBe(true);
  });
});

test.describe('seven strings: back to six (US4, Q12, Q13)', () => {
  const ADJUSTED = 'We adjusted the view to the new instrument';

  test('Q12 via panel: 7-6-5 → 6 strings shows the notice, set 6-5-4; axe clean', async ({
    page
  }) => {
    await page.goto('/');
    await useSevenStrings(page);
    await page.goto('/triads');
    const sets = page.getByRole('radiogroup', { name: /string set/i });
    await sets.getByRole('radio', { name: '7-6-5' }).click();
    const dialog = await openPanel(page);
    await dialog.getByRole('radio', { name: '6 strings' }).check();
    await confirm(page);
    const status = page.getByRole('status').filter({ hasText: ADJUSTED });
    await expect(status).toBeVisible();
    await expect(sets.getByRole('radio', { name: '6-5-4' })).toBeChecked();
    await runAxe(page);
    await status.getByRole('button', { name: 'Dismiss' }).click();
    await expect(status).toHaveCount(0);
  });

  test('6 → 7 strings on Triads: no notice, set unchanged', async ({ page }) => {
    await page.goto('/triads');
    await useSevenStrings(page);
    await expect(page.getByText(ADJUSTED)).toHaveCount(0);
    await expect(
      page.getByRole('radiogroup', { name: /string set/i }).getByRole('radio', { name: '3-2-1' })
    ).toBeChecked();
  });
});
