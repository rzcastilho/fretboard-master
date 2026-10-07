import { expect, test, type Page } from '@playwright/test';

import { runAxe } from './support/helpers';

const seed = (page: Page, extra: Record<string, unknown> = {}) =>
  page.addInitScript((prefs) => {
    if (localStorage.getItem('__seeded') === null) {
      localStorage.setItem(
        'fretboard-master:prefs',
        JSON.stringify({ version: 1, tuning: 'AF-21', strings: 7, frets: 24, ...prefs })
      );
      localStorage.setItem('__seeded', '1');
    }
  }, extra);

const open = async (page: Page, path = '/notes') => {
  await page.goto(path);
  await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
};

const minimap = (page: Page) => page.getByRole('slider', { name: 'Fretboard overview' });
const scrollLeft = (page: Page) =>
  page
    .locator('.scroller')
    .first()
    .evaluate((el) => el.scrollLeft);
const maxScroll = (page: Page) =>
  page
    .locator('.scroller')
    .first()
    .evaluate((el) => el.scrollWidth - el.clientWidth);
const cellAt = (page: Page, string: number, fret: number) =>
  page.locator(`.cell[data-string="${string}"][data-fret="${fret}"]`);

test.describe('minimap (US1)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await seed(page);
  });

  test('minimap at 320 with 7 strings', async ({ page }) => {
    await open(page);
    await expect(minimap(page)).toBeVisible();
    const box = await minimap(page).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(43.5);
    await expect(minimap(page)).toHaveAttribute('aria-valuetext', /^Frets 1 to \d+ of 24$/);
  });

  test('tap far end shows last fret', async ({ page }) => {
    await open(page);
    await minimap(page).scrollIntoViewIfNeeded();
    const box = await minimap(page).boundingBox();
    if (!box) throw new Error('no minimap');
    await page.mouse.click(box.x + box.width - 2, box.y + box.height / 2);
    await expect.poll(() => scrollLeft(page)).toBeGreaterThan((await maxScroll(page)) - 2);
    await expect(minimap(page)).toHaveAttribute('aria-valuetext', /to 24 of 24$/);
    await expect(cellAt(page, 1, 24)).toBeInViewport();
  });

  test('dot count equals highlighted count', async ({ page }) => {
    await open(page);
    await cellAt(page, 1, 3).click();
    await cellAt(page, 2, 5).click();
    // Markers fade in and out: compare once both counts settle on the same non-zero number.
    await expect
      .poll(async () => {
        const markers = await page.locator('.marker.highlighted').count();
        const dots = await minimap(page).locator('.dot').count();
        return markers > 0 && markers === dots;
      })
      .toBe(true);
  });

  test('window follows scroll', async ({ page }) => {
    await open(page);
    const x = () =>
      minimap(page)
        .locator('.window')
        .evaluate((el) => Number(el.getAttribute('x')));
    const before = await x();
    await page
      .locator('.scroller')
      .first()
      .evaluate((el) => (el.scrollLeft = 400));
    await expect.poll(x).toBeGreaterThan(before);
  });

  test('keyboard: arrow moves the window and valuetext updates', async ({ page }) => {
    await open(page);
    const before = await minimap(page).getAttribute('aria-valuetext');
    await minimap(page).focus();
    await page.keyboard.press('ArrowRight');
    await expect(minimap(page)).not.toHaveAttribute('aria-valuetext', before ?? '');
    await page.keyboard.press('End');
    await expect(minimap(page)).toHaveAttribute('aria-valuetext', /to 24 of 24$/);
    await page.keyboard.press('Home');
    await expect(minimap(page)).toHaveAttribute('aria-valuetext', /^Frets 1 to/);
  });

  test('reduced motion: jump is instant', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await minimap(page).focus();
    await page.keyboard.press('End');
    // No animation: the very next read is already at the end.
    expect(await scrollLeft(page)).toBeGreaterThan((await maxScroll(page)) - 2);
  });

  test('axe clean with the minimap', async ({ page }) => {
    await open(page);
    await runAxe(page);
  });
});

test.describe('minimap: left-handed mirror (US1)', () => {
  const middleTap = async (page: Page, handedness: 'right' | 'left') => {
    await page.setViewportSize({ width: 320, height: 800 });
    await seed(page, { handedness });
    await open(page);
    await minimap(page).scrollIntoViewIfNeeded();
    const box = await minimap(page).boundingBox();
    if (!box) throw new Error('no minimap');
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height / 2);
    await expect(minimap(page)).toHaveAttribute('aria-valuetext', /^Frets/);
    return minimap(page).getAttribute('aria-valuetext');
  };

  test('tap at the same minimap point shows the same frets as right-handed', async ({
    browser
  }) => {
    const rightPage = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage();
    const leftPage = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage();
    const right = await middleTap(rightPage, 'right');
    const left = await middleTap(leftPage, 'left');
    // The label column makes the mirror differ by at most one fret at the window edges.
    const frets = (t: string | null) => (t ?? '').match(/\d+/g)?.map(Number) ?? [];
    const [rf, rl] = frets(right);
    const [lf, ll] = frets(left);
    expect(Math.abs(rf - lf)).toBeLessThanOrEqual(1);
    expect(Math.abs(rl - ll)).toBeLessThanOrEqual(1);
  });
});

test('no minimap where the neck fits (1440 / 12 frets)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page, { strings: 6, tuning: 'AF-1', frets: 12 });
  await open(page);
  await expect(minimap(page)).toHaveCount(0);
});

const fitButton = (page: Page) => page.getByRole('button', { name: 'Fit to screen' });
const notice = (page: Page) =>
  page.getByRole('status').filter({ hasText: 'These frets are small' });
const gridWidth = (page: Page) =>
  page.getByRole('grid', { name: 'Fretboard' }).evaluate((el) => el.getBoundingClientRect().width);

test.describe('fit to screen (US2)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await seed(page);
  });

  test('fit to screen: whole neck visible, minimap gone, button pressed', async ({ page }) => {
    await open(page);
    await expect(fitButton(page)).toHaveAttribute('aria-pressed', 'false');
    await fitButton(page).click();
    await expect(fitButton(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(minimap(page)).toHaveCount(0);
    await cellAt(page, 1, 0).scrollIntoViewIfNeeded();
    await expect(cellAt(page, 1, 24)).toBeInViewport();
    await expect(cellAt(page, 1, 0)).toBeInViewport();
    expect(await gridWidth(page)).toBeLessThanOrEqual(320);
    await fitButton(page).click();
    await expect(fitButton(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(minimap(page)).toBeVisible();
  });

  test('return keeps the highlighted region visible', async ({ page }) => {
    await open(page);
    await fitButton(page).click();
    await cellAt(page, 1, 20).click();
    await notice(page).getByRole('button', { name: 'Dismiss' }).click();
    await fitButton(page).click();
    // Horizontal containment only: the page may be scrolled vertically.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const box = document.querySelector('.scroller')?.getBoundingClientRect();
          const mk = document.querySelector('.marker.highlighted')?.getBoundingClientRect();
          return !!box && !!mk && mk.left >= box.left - 1 && mk.right <= box.right + 1;
        })
      )
      .toBe(true);
  });

  test('small-fret notice selects the nearest position and offers comfortable size', async ({
    page
  }) => {
    await open(page);
    await fitButton(page).click();
    await expect(notice(page)).toHaveCount(0);
    await cellAt(page, 2, 18).click();
    await expect(page.locator('.marker.highlighted')).not.toHaveCount(0);
    await expect(notice(page)).toBeVisible();
    await expect(notice(page).getByRole('button', { name: 'Use comfortable size' })).toBeVisible();
  });

  test('accepting the notice switches to comfortable and centres the tapped position', async ({
    page
  }) => {
    await open(page);
    await fitButton(page).click();
    await cellAt(page, 2, 18).click();
    await notice(page).getByRole('button', { name: 'Use comfortable size' }).click();
    await expect(fitButton(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(notice(page)).toHaveCount(0);
    await expect(cellAt(page, 2, 18)).toBeInViewport();
    await expect(cellAt(page, 2, 18)).toBeFocused();
  });

  test('a dismissed notice is not repeated until the mode changes', async ({ page }) => {
    await open(page);
    await fitButton(page).click();
    await cellAt(page, 2, 18).click();
    await notice(page).getByRole('button', { name: 'Dismiss' }).click();
    await cellAt(page, 3, 20).click();
    await expect(notice(page)).toHaveCount(0);
    await fitButton(page).click();
    await fitButton(page).click();
    await cellAt(page, 3, 20).click();
    await expect(notice(page)).toBeVisible();
  });

  test('mode persists across tools and resize', async ({ page }) => {
    await open(page);
    await fitButton(page).click();
    await page.getByRole('link', { name: 'Triads' }).first().click();
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await expect(fitButton(page)).toHaveAttribute('aria-pressed', 'true');
    await page.setViewportSize({ width: 360, height: 800 });
    await expect(fitButton(page)).toHaveAttribute('aria-pressed', 'true');
    expect(await gridWidth(page)).toBeLessThanOrEqual(360);
  });

  test('axe clean in whole mode with the notice', async ({ page }) => {
    await open(page);
    await fitButton(page).click();
    await cellAt(page, 2, 18).click();
    await expect(notice(page)).toBeVisible();
    await runAxe(page);
  });
});

test('no fit button where the neck fits (1440 / 12 frets)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page, { strings: 6, tuning: 'AF-1', frets: 12 });
  await open(page);
  await expect(fitButton(page)).toHaveCount(0);
});
