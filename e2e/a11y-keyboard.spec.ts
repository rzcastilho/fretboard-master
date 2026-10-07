import { expect, test, type Locator, type Page } from '@playwright/test';

import { expandDetails } from './support/helpers';
/** US4: every function is reachable and operable by keyboard alone, with a visible two-tone focus ring. */

const board = (page: Page) => page.getByRole('region', { name: 'Fretboard' });
const cell = (page: Page, string: number, fret: number) =>
  page.locator(`.cell[data-string="${string}"][data-fret="${fret}"]`);
const focusedPos = (page: Page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    return `${a?.getAttribute('data-string')}:${a?.getAttribute('data-fret')}`;
  });
const describeButton = (page: Page) => page.getByRole('button', { name: 'Describe this view' });

/** Tab forward until `target` holds focus; fails if it is never reached (a keyboard trap or gap). */
async function tabTo(page: Page, target: Locator, max = 80): Promise<void> {
  const handle = await target.elementHandle();
  if (!handle) throw new Error('target not found');
  for (let i = 0; i < max; i++) {
    if (await handle.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('target never received focus by Tab');
}

const focusBack = (page: Page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    return a !== null && a !== document.body;
  });

test.describe('keyboard only (US4)', () => {
  test('US4-1: Notes — select notes, set filters, arrows, play a position', async ({ page }) => {
    await page.addInitScript(() => {
      globalThis.__fmFretboardEvents = [];
    });
    await page.goto('/notes');
    await expandDetails(page);
    await board(page).waitFor();

    const noteC = page
      .getByRole('group', { name: 'Choose notes' })
      .getByRole('button', { name: 'C', exact: true });
    await tabTo(page, noteC);
    await page.keyboard.press('Enter');
    await expect(noteC).toHaveAttribute('aria-pressed', 'true');

    const string6 = page
      .getByRole('group', { name: 'Strings' })
      .getByRole('button', { name: /^String 6/ });
    await tabTo(page, string6);
    await page.keyboard.press('Space');
    await expect(string6).toHaveAttribute('aria-pressed', 'false');

    await tabTo(page, cell(page, 1, 0));
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    expect(await focusedPos(page)).toBe('2:1');
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => globalThis.__fmFretboardEvents)).toEqual([
      { string: 2, fret: 1 }
    ]);
  });

  test('US4-3: Triads — change inversion by keyboard', async ({ page }) => {
    await page.goto('/triads');
    await expandDetails(page);
    await board(page).waitFor();
    // A radio group is one Tab stop (the checked radio); arrows change the choice.
    const group = page.getByRole('radiogroup', { name: 'Inversion' });
    await tabTo(page, group.getByRole('radio', { checked: true }));
    await page.keyboard.press('ArrowRight');
    await expect(group.getByRole('radio', { checked: true })).toHaveAccessibleName('1st inversion');
  });

  test('US4-3: CAGED — change shape by keyboard', async ({ page }) => {
    await page.goto('/caged');
    await expandDetails(page);
    await board(page).waitFor();
    const group = page.getByRole('radiogroup', { name: 'Shape' });
    await tabTo(page, group.getByRole('radio', { checked: true }));
    await page.keyboard.press('ArrowRight');
    await expect(group.getByRole('radio', { checked: true })).toBeFocused();
  });

  test('US4-3: home, navigation and instrument panel', async ({ page }) => {
    await page.goto('/');
    const triadsLink = page.getByRole('list').getByRole('link', { name: /^(Continue: )?Triads/ });
    await tabTo(page, triadsLink);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/triads/);

    const instrument = page.getByRole('button', { name: /strings · |^Tuning:|^Instrument/ });
    await tabTo(page, instrument);
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Instrument' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(await focusBack(page)).toBe(true);
  });

  test('US4-3/4: shared-view notice is operable and focus is never lost', async ({ page }) => {
    await page.goto('/caged?v=1&rt=2&q=banana&fr=99');
    await expandDetails(page);
    await board(page).waitFor();
    await expect(
      page.getByRole('status').filter({ hasText: 'This link was incomplete' })
    ).toHaveCount(1);
    await tabTo(page, cell(page, 1, 0));
    expect(await focusBack(page)).toBe(true);
  });

  test('US4-3: share notice — Link copied appears from the keyboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/notes');
    await expandDetails(page);
    const share = page.getByRole('banner').getByRole('button', { name: 'Share', exact: true });
    await tabTo(page, share);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: 'Link copied' })).toBeVisible();
    expect(await focusBack(page)).toBe(true);
  });

  test('US4-4: description panel opens and closes with focus on its button', async ({ page }) => {
    await page.goto('/triads');
    await expandDetails(page);
    await board(page).waitFor();
    await tabTo(page, describeButton(page));
    await page.keyboard.press('Enter');
    await expect(describeButton(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(describeButton(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(describeButton(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(describeButton(page)).toBeFocused();
  });

  test('US4-3: focus order follows reading order, no trap', async ({ page }) => {
    await page.goto('/notes');
    await expandDetails(page);
    await board(page).waitFor();
    const tops: number[] = [];
    const lefts: number[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const a = document.activeElement;
        if (!a || a === document.body) return null;
        const r = a.getBoundingClientRect();
        return {
          key: `${a.tagName}|${a.getAttribute('aria-label') ?? a.textContent}`,
          top: r.top + window.scrollY,
          left: r.left
        };
      });
      if (info === null) break; // left the page into browser chrome: no trap
      if (seen.has(info.key)) break; // wrapped around
      seen.add(info.key);
      tops.push(info.top);
      lefts.push(info.left);
    }
    expect(tops.length).toBeGreaterThan(5);
    // Reading order (R-10): top to bottom within a column; a jump back up is only valid when it
    // moves into a column further right (the desktop sidebar after the main column).
    for (let i = 1; i < tops.length; i++) {
      const movesUp = tops[i] < tops[i - 1] - 60;
      if (movesUp) expect(lefts[i], `stop ${i}`).toBeGreaterThan(lefts[i - 1] + 100);
    }
  });

  test('US4-2: two ring rects on a focused position, including a hidden one', async ({ page }) => {
    await page.goto('/notes');
    await expandDetails(page);
    await board(page).waitFor();
    // Nothing selected: every position is unmarked/hidden.
    await cell(page, 4, 2).focus();
    await expect(page.locator('.focus-ring')).toHaveCount(2);
    await expect(page.locator('.focus-ring-outer')).toBeVisible();
    await expect(page.locator('.focus-ring-inner')).toBeVisible();
    const colors = await page.evaluate(() =>
      ['.focus-ring-outer', '.focus-ring-inner'].map((sel) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el).stroke : '';
      })
    );
    expect(colors[0]).not.toBe(colors[1]);
  });

  test('US4-5: focusing an off-screen position scrolls it into view', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/notes');
    await expandDetails(page);
    await board(page).waitFor();
    const target = cell(page, 3, 20);
    await target.focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(async () => {
        const box = await target.boundingBox();
        const vw = page.viewportSize()?.width ?? 0;
        return box !== null && box.x >= 0 && box.x + box.width <= vw + 1;
      })
      .toBe(true);
  });
});
