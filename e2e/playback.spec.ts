import { expect, test, type Page } from '@playwright/test';

import { readAudioLog } from './support/helpers';

const cellAt = (page: Page, string: number, fret: number) =>
  page.locator(`.cell[data-string="${string}"][data-fret="${fret}"]`);

async function stepEntries(page: Page) {
  return (await readAudioLog(page)).filter((e) => e.type === 'step');
}

test.describe('note playback (US1)', () => {
  test('no audio is unlocked by navigation or scrolling (US1-4, FR-002)', async ({ page }) => {
    await page.goto('/notes');
    const grid = page.getByRole('grid', { name: 'Fretboard' });
    await grid.waitFor();
    await grid.evaluate((el) => {
      const scroller = el.closest('[class*="scroll"]') ?? el.parentElement;
      scroller?.scrollBy?.({ left: 300 });
    });
    await page
      .getByRole('link', { name: /triads/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/triads$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/notes$/);
    const log = await readAudioLog(page);
    expect(log.filter((e) => e.type === 'unlock')).toEqual([]);
  });

  test('first activation unlocks then sounds string 6 open at 82.41 Hz (US1-1, SC-002)', async ({
    page
  }) => {
    await page.goto('/notes');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    expect(await readAudioLog(page)).toEqual([]);
    await page.getByRole('gridcell', { name: 'E, string 6, open', exact: true }).click();
    await expect.poll(async () => (await stepEntries(page)).length).toBe(1);
    const log = await readAudioLog(page);
    expect(log.map((e) => e.type).slice(0, 2)).toEqual(['unlock', 'step']);
    const step = log.find((e) => e.type === 'step');
    if (step?.type !== 'step') throw new Error('no step entry');
    expect(step.kind).toBe('note');
    expect(step.pitches).toEqual([40]);
    expect(step.frequencies[0]).toBeCloseTo(82.41, 1);
  });

  test('keyboard: Enter on string 5 fret 3 sounds pitch 48', async ({ page }) => {
    await page.goto('/notes');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await cellAt(page, 5, 3).focus();
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await stepEntries(page)).length).toBe(1);
    const step = (await stepEntries(page))[0];
    if (step?.type !== 'step') throw new Error('no step entry');
    expect(step.pitches).toEqual([48]);
  });
});
