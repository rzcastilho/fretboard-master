import { expect, test, type Page } from '@playwright/test';

import { runAxe } from './support/helpers';

const sizes = [
  { name: 'phone', width: 360, height: 740 },
  { name: 'desktop', width: 1280, height: 800 }
];

const board = (page: Page) => page.getByRole('region', { name: 'Fretboard' });
const tags = (page: Page) => page.getByRole('group', { name: 'Shapes' }).getByRole('button');

/** A major, strings 3-2-1, Full neck. */
async function openFullNeck(page: Page) {
  await page.goto('/triads');
  await page
    .getByRole('group', { name: 'Root' })
    .getByRole('button', { name: 'A', exact: true })
    .click();
  await page.getByRole('radio', { name: 'Full neck' }).click();
  await expect(tags(page)).toHaveCount(6);
}

for (const size of sizes) {
  test.describe(`triads Full neck @ ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('US1-1: A major 3-2-1 shows exactly six shapes with tags in order', async ({ page }) => {
      await openFullNeck(page);
      await expect(tags(page)).toHaveText([
        /Root position/,
        /1st/,
        /2nd/,
        /Root position/,
        /1st/,
        /2nd/
      ]);
      await expect(tags(page).nth(2)).toHaveAttribute('aria-label', '2nd inversion, frets 9-10-9');
      await expect(board(page).locator('.marker')).toHaveCount(18);
      await expect(board(page).locator('.marker.highlighted')).toHaveCount(6);
    });

    test('US1-2: tapping "2nd" highlights both 2nd-inversion shapes (SC-001)', async ({ page }) => {
      await openFullNeck(page);
      await tags(page).nth(2).click();
      await expect(tags(page).nth(2)).toHaveAttribute('aria-pressed', 'true');
      await expect(tags(page).nth(5)).toHaveAttribute('aria-pressed', 'true');
      await expect(tags(page).nth(0)).toHaveAttribute('aria-pressed', 'false');
      await expect(page.getByRole('radio', { name: '2nd inversion' })).toBeChecked();
      await expect(board(page).locator('.marker.highlighted')).toHaveCount(6);
    });

    test('US1-3/4: control changes keep the view and the selected inversion', async ({ page }) => {
      await openFullNeck(page);
      await page.getByRole('radio', { name: '1st inversion' }).click();
      await expect(tags(page).nth(1)).toHaveAttribute('aria-pressed', 'true');
      await expect(tags(page).nth(4)).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('radio', { name: 'minor' }).click();
      await expect(page.getByRole('radio', { name: 'Full neck' })).toBeChecked();
      await expect(page.getByRole('radio', { name: '1st inversion' })).toBeChecked();
    });

    test('US1-5: keyboard reaches tags in chain order; Enter and Space select', async ({
      page
    }) => {
      await openFullNeck(page);
      await tags(page).nth(0).focus();
      await page.keyboard.press('Tab');
      await expect(tags(page).nth(1)).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(tags(page).nth(2)).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(tags(page).nth(2)).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Space');
      await expect(tags(page).nth(3)).toHaveAttribute('aria-pressed', 'true');
    });

    test('tag tap never scrolls the board; page has no horizontal scroll', async ({ page }) => {
      await openFullNeck(page);
      const scroller = page.locator('.scroller');
      await scroller.evaluate((el) => {
        el.scrollLeft = 0;
      });
      const before = await scroller.evaluate((el) => el.scrollLeft);
      await tags(page).nth(0).click();
      await page.waitForTimeout(400);
      expect(await scroller.evaluate((el) => el.scrollLeft)).toBe(before);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test('SC-008: tags are ≥ 44×44 px and do not overlap', async ({ page }) => {
      await openFullNeck(page);
      const boxes = await tags(page).evaluateAll((els) =>
        els.map((e) => {
          const r = e.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        })
      );
      for (const b of boxes) {
        expect(b.w).toBeGreaterThanOrEqual(43.5);
        expect(b.h).toBeGreaterThanOrEqual(43.5);
      }
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          const apart =
            a.x + a.w <= b.x + 0.5 ||
            b.x + b.w <= a.x + 0.5 ||
            a.y + a.h <= b.y + 0.5 ||
            b.y + b.h <= a.y + 0.5;
          expect(apart).toBe(true);
        }
    });

    test('SC-008: still legible at 320 px', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 700 });
      await openFullNeck(page);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test('SC-007: no axe violations in Full neck', async ({ page }) => {
      await openFullNeck(page);
      await runAxe(page);
    });
  });
}

test.describe('triads guidance recovery in Full neck (US3)', () => {
  test('US3-3/4: Full neck offers See all notes and Another set; Another set keeps the view', async ({
    page
  }) => {
    await page.addInitScript(() => {
      globalThis.__fmInstrument = 'NC-UNISON';
    });
    await page.goto('/triads');
    await page.getByRole('radio', { name: 'Full neck' }).click();
    await expect(page.getByRole('button', { name: 'See all notes' })).toBeVisible();
    await runAxe(page);
    await page.getByRole('button', { name: 'Another set' }).click();
    await expect(page.getByRole('radio', { name: 'Full neck' })).toBeChecked();
    await expect(page.getByRole('button', { name: 'See all notes' })).toHaveCount(0);
    await expect(
      page.getByRole('group', { name: 'Shapes' }).getByRole('button').first()
    ).toBeVisible();
  });
});

/** Frets of every tag in chain order, read from the accessible names. */
async function chainFrets(page: Page): Promise<string[][]> {
  const names = await tags(page).evaluateAll((els) =>
    els.map((e) => e.getAttribute('aria-label') ?? '')
  );
  return names.map((n) => (/frets (\d+)-(\d+)-(\d+)/.exec(n) ?? []).slice(1));
}

const pattern = (frets: string[]) => {
  const n = frets.map(Number);
  const min = Math.min(...n);
  return n.map((f) => f - min).join('-');
};

/** First root-position tag of the chain. */
const rootPattern = async (page: Page) => {
  const all = await chainFrets(page);
  const labels = await tags(page).allTextContents();
  return pattern(all[labels.findIndex((l) => /Root position/.test(l))]);
};

test.describe('triads Full neck special cases (US5)', () => {
  test('US5-1: C major 6-5-4 equals 5-4-3; 4-3-2 differs from 3-2-1 (C16)', async ({ page }) => {
    await page.goto('/triads');
    await page.getByRole('radio', { name: 'Full neck' }).click();
    await expect(tags(page).first()).toBeVisible();

    const patternsFor = async (set: string) => {
      await page.getByRole('radio', { name: set, exact: true }).click();
      await expect(tags(page).first()).toBeVisible();
      const frets = await chainFrets(page);
      const labels = await tags(page).allTextContents();
      const byInversion = new Map<string, string>();
      frets.forEach((f, i) => byInversion.set(labels[i].trim(), pattern(f)));
      return byInversion;
    };

    const six = await patternsFor('6-5-4');
    const five = await patternsFor('5-4-3');
    expect([...six.entries()].sort()).toEqual([...five.entries()].sort());
    expect(await rootPattern(page)).toBe('3-2-0');

    const four = await patternsFor('4-3-2');
    const three = await patternsFor('3-2-1');
    expect([...four.entries()].sort()).not.toEqual([...three.entries()].sort());
  });

  test('US5-2: C augmented shapes are four frets apart with the same drawing (C17)', async ({
    page
  }) => {
    await page.goto('/triads');
    await page.getByRole('radio', { name: 'augmented' }).click();
    await page.getByRole('radio', { name: 'Full neck' }).click();
    await expect(tags(page)).toHaveCount(6);
    const frets = await chainFrets(page);
    expect(frets.map((f) => f.join('-'))).toEqual([
      '1-1-0',
      '5-5-4',
      '9-9-8',
      '13-13-12',
      '17-17-16',
      '21-21-20'
    ]);
    expect(new Set(frets.map(pattern)).size).toBe(1);
    await expect(tags(page)).toHaveText([
      /2nd/,
      /Root position/,
      /1st/,
      /2nd/,
      /Root position/,
      /1st/
    ]);
  });

  test('US5-3: SHORT-7 shows only root and 1st with no message', async ({ page }) => {
    await page.addInitScript(() => {
      globalThis.__fmInstrument = 'SHORT-7';
    });
    await page.goto('/triads');
    await page
      .getByRole('group', { name: 'Root' })
      .getByRole('button', { name: 'A', exact: true })
      .click();
    await page.getByRole('radio', { name: 'Full neck' }).click();
    await expect(tags(page)).toHaveCount(2);
    await expect(tags(page)).toHaveText([/Root position/, /1st/]);
    expect((await chainFrets(page)).map((f) => f.join('-'))).toEqual(['2-2-0', '6-5-5']);
    await expect(page.getByRole('button', { name: 'See all notes' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Another set' })).toHaveCount(0);
    // The shell keeps an empty sound-notice live region mounted; only regions with text count.
    await expect(
      page.locator('[role="status"], [role="alert"]').filter({ hasText: /\S/ })
    ).toHaveCount(0);
  });
});
