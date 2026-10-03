import { expect, test, type Page } from '@playwright/test';

import { expectNoHorizontalScroll, runAxe } from './support/helpers';

const PREFS_KEY = 'fretboard-master:prefs';

const sizes = [
  { name: 'phone', width: 360, height: 740 },
  { name: 'desktop', width: 1280, height: 800 }
];

const openPanel = async (page: Page) => {
  await page
    .getByRole('button', { name: /^6 strings|^Tuning:|^Instrument/ })
    .first()
    .click();
  return page.getByRole('dialog', { name: 'Instrument' });
};

const chooseCustom = async (page: Page) => {
  const dialog = await openPanel(page);
  await dialog.getByRole('radio', { name: /^Custom/ }).check();
  return dialog;
};

const press = async (page: Page, action: 'Lower' | 'Raise', string: number, times = 1) => {
  for (let i = 0; i < times; i++) {
    await page.getByRole('button', { name: `${action} string ${string}` }).click();
  }
};

for (const size of sizes) {
  test.describe(`custom tuning @ ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('US1/US3: Drop D in two presses, name line, back to Custom (SC-001)', async ({ page }) => {
      await page.goto('/');
      const dialog = await chooseCustom(page);

      const notes = ['E 2', 'A 2', 'D 3', 'G 3', 'B 3', 'E 4'];
      for (const [i, note] of notes.entries()) {
        await expect(
          dialog.getByRole('button', { name: `String ${6 - i}, ${note}` })
        ).toBeVisible();
      }

      await press(page, 'Lower', 6, 2);
      await expect(dialog.getByRole('button', { name: 'String 6, D 2' })).toBeVisible();
      await expect(dialog.getByRole('status')).toContainText('Drop D');
      await expect(dialog.locator('.fretboard-preview .string-label').last()).toHaveText('D');

      await press(page, 'Raise', 6);
      await expect(dialog.getByRole('status')).toContainText('Custom');
      await expect(dialog.getByRole('status')).not.toContainText('Drop D');
    });

    test('US1: limits disable the button silently and focus moves to the note button', async ({
      page
    }) => {
      await page.goto('/');
      const dialog = await chooseCustom(page);

      await press(page, 'Lower', 1, 7);
      const lower = dialog.getByRole('button', { name: 'Lower string 1' });
      await expect(lower).toBeDisabled();
      await expect(dialog.getByRole('button', { name: 'String 1, A 3' })).toBeFocused();
      await expect(dialog.locator('[role="alert"]')).toHaveCount(0);
    });

    test('US4: order note appears while inverted and clears when equal', async ({ page }) => {
      await page.goto('/');
      const dialog = await chooseCustom(page);
      const orderNote = dialog.getByText('The strings are not in order from low to high');

      await press(page, 'Lower', 3, 6);
      await expect(dialog.getByRole('button', { name: 'String 3, C sharp 3' })).toBeVisible();
      await expect(orderNote).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Confirm' })).toBeEnabled();

      await press(page, 'Raise', 3);
      await expect(dialog.getByRole('button', { name: 'String 3, D 3' })).toBeVisible();
      await expect(orderNote).toHaveCount(0);
    });

    test('US3/US5: unmatched custom confirms as Custom, summary and reload persist', async ({
      page
    }) => {
      await page.goto('/');
      const dialog = await chooseCustom(page);
      await press(page, 'Raise', 6);
      await dialog.getByRole('button', { name: 'Confirm' }).click();
      await expect(dialog).toBeHidden();

      await expect(
        page.getByRole('button', { name: /^6 strings · Custom · right-handed/ })
      ).toBeVisible();
      await page.getByRole('link', { name: /^Fretboard Notes/ }).click();
      await expect(page.getByRole('button', { name: /^Tuning: Custom/ })).toBeVisible();

      const stored = await page.evaluate((k) => localStorage.getItem(k), PREFS_KEY);
      expect(stored).toContain('"customTuning"');

      await page.reload();
      await expect(page.getByRole('button', { name: /^Tuning: Custom/ })).toBeVisible();
      const reopened = await openPanel(page);
      await expect(reopened.getByRole('radio', { name: /^Custom/ })).toBeChecked();
      await expect(reopened.getByRole('button', { name: 'String 6, F 2' })).toBeVisible();
    });

    test('US5: damaged customTuning falls back without an error screen', async ({ page }) => {
      await page.addInitScript(
        ([key]) => {
          if (localStorage.getItem('__seeded') === null) {
            localStorage.setItem(
              key as string,
              JSON.stringify({ version: 1, tuning: 'AF-1', customTuning: [0, 0, 0, 0, 0, 9] })
            );
            localStorage.setItem('__seeded', '1');
          }
        },
        [PREFS_KEY]
      );
      await page.goto('/');
      await expect(page.getByRole('button', { name: /^6 strings/ })).toBeVisible();
      await expect(page.getByRole('alert')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^6 strings · Custom/ })).toHaveCount(0);
    });

    test('US4: Triads unison on 3-2-1 shows guidance with both actions', async ({ page }) => {
      await page.goto('/');
      const dialog = await chooseCustom(page);
      await press(page, 'Raise', 3, 4); // string 3 = B3 = string 2
      await dialog.getByRole('button', { name: 'Confirm' }).click();
      await expect(dialog).toBeHidden();

      await page.getByRole('link', { name: /^Triads/ }).click();
      await page.getByRole('radio', { name: '3-2-1' }).click();
      await expect(
        page.getByText(/^This triad does not close on this string set with the current tuning/)
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Another set' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'See all notes' })).toBeVisible();
    });

    test('Erase preferences returns to Standard with no badge', async ({ page }) => {
      await page.goto('/');
      const dialog = await chooseCustom(page);
      await press(page, 'Raise', 6);
      await dialog.getByRole('button', { name: 'Confirm' }).click();
      await expect(dialog).toBeHidden();

      await page.evaluate((k) => localStorage.removeItem(k), PREFS_KEY);
      await page.reload();
      await expect(
        page.getByRole('button', { name: /^6 strings · standard tuning/ })
      ).toBeVisible();
      await page.getByRole('link', { name: /^Fretboard Notes/ }).click();
      await expect(page.getByRole('button', { name: /^Tuning:/ })).toHaveCount(0);
    });
  });
}

// Runs once per project (phone 360 px, phone-touch 320 px, desktop 1280 px).
test.describe('custom tuning accessibility (SC-008)', () => {
  test('axe: zero violations with Custom rows shown', async ({ page }) => {
    await page.goto('/');
    const dialog = await chooseCustom(page);
    await press(page, 'Lower', 6, 2);
    await press(page, 'Lower', 3, 6); // order note visible too
    await expect(dialog.getByText('The strings are not in order from low to high')).toBeVisible();
    await runAxe(page);
  });

  test('axe: zero violations with a limit button disabled', async ({ page }) => {
    await page.goto('/');
    await chooseCustom(page);
    await press(page, 'Lower', 1, 7);
    await runAxe(page);
  });

  test('320 px width at 200 % text zoom: rows wrap, nothing clipped or overlapping', async ({
    page
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/');
    await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
    const dialog = await chooseCustom(page);

    const clipped = await page.evaluate(() =>
      [
        ...document.querySelectorAll<HTMLElement>(
          'dialog button, dialog legend, dialog [role="status"]'
        )
      ]
        .filter(
          (el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1
        )
        .map((el) => el.textContent?.trim() ?? '')
    );
    expect(clipped).toEqual([]);

    // Every row button is at least 44 px both ways and rows do not overlap.
    const boxes = [];
    for (let n = 6; n >= 1; n--) {
      for (const name of [`Lower string ${n}`, `Raise string ${n}`]) {
        const box = await dialog.getByRole('button', { name }).boundingBox();
        if (!box) throw new Error(`no box for ${name}`);
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        boxes.push(box);
      }
    }
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) {
        const overlap =
          a.x < b.x + b.width - 1 &&
          b.x < a.x + a.width - 1 &&
          a.y < b.y + b.height - 1 &&
          b.y < a.y + a.height - 1;
        expect(overlap).toBe(false);
      }
    }
    await runAxe(page);
    // The page itself must not scroll sideways (only the preview fretboard may).
    await expectNoHorizontalScroll(page);
  });
});
