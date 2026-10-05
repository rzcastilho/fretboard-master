import { expect, test, type Page } from '@playwright/test';

import { runAxe } from './support/helpers';

/** Slice 015 (CAGED across tunings): quickstart scenarios E1–E14, axe A1–A4. */

const PREFS_KEY = 'fretboard-master:prefs';
const board = (page: Page) => page.getByRole('region', { name: 'Fretboard' });
const tags = (page: Page) => board(page).locator('.tag:visible');
const unsupported = (tuning: string) =>
  `CAGED depends on the standard relationship between the strings, so its shapes don't exist in ${tuning}.`;
const notice = (page: Page, tuning: string) =>
  page.getByRole('status').filter({ hasText: unsupported(tuning) });
const key = (page: Page, pc: number) =>
  page.getByRole('group', { name: 'Key' }).getByRole('button').nth(pc);
const quality = (page: Page, name: 'Major' | 'Minor') =>
  page.getByRole('radiogroup', { name: 'Quality' }).getByRole('radio', { name });

/** Seed the stored v1 preference record before the first navigation. */
const seed = (page: Page, record: Record<string, unknown>) =>
  page.addInitScript(([k, r]) => localStorage.setItem(k as string, JSON.stringify(r)), [
    PREFS_KEY,
    { version: 1, ...record }
  ] as const);

const storedPrefs = (page: Page) => page.evaluate((k) => localStorage.getItem(k), PREFS_KEY);

const openPanel = async (page: Page) => {
  await page
    .getByRole('button', { name: /strings · |^Tuning:|^Temporary tuning:|^Instrument/ })
    .first()
    .click();
  const dialog = page.getByRole('dialog', { name: 'Instrument' });
  await expect(dialog).toBeVisible();
  return dialog;
};

const confirmPanel = async (page: Page) => {
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByRole('dialog', { name: 'Instrument' })).toBeHidden();
};

const viewInStandard = (page: Page) =>
  page.getByRole('button', { name: 'View in standard tuning' }).click();

test.describe('caged 015 US1: honest CAGED in a non-compatible tuning', () => {
  test('E1: Open G shows the notice, two buttons, no markers, tags or fit note', async ({
    page
  }) => {
    await seed(page, { tuning: 'AF-8' });
    await page.goto('/caged');
    await expect(notice(page, 'Open G')).toBeVisible();
    await expect(board(page).getByRole('button')).toHaveText([
      'View in standard tuning',
      'Go to Triads'
    ]);
    await expect(board(page).locator('.marker')).toHaveCount(0);
    await expect(board(page).locator('.tag')).toHaveCount(0);
    await expect(page.getByText(/shapes fit on the fretboard/)).toHaveCount(0);
  });

  test('E2: View in standard tuning draws five shapes under a temporary badge; prefs untouched', async ({
    page
  }) => {
    await seed(page, { tuning: 'AF-8' });
    await page.goto('/caged');
    const before = await storedPrefs(page);
    await viewInStandard(page);
    await expect(page.getByText('C major', { exact: true })).toBeVisible();
    await expect(tags(page).first()).toBeVisible();
    expect((await tags(page).allInnerTexts()).slice(0, 5).map((t) => t.trim()[0])).toEqual([
      'C',
      'A',
      'G',
      'E',
      'D'
    ]);
    await expect(board(page).locator('.marker').first()).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Temporary tuning: Standard. Open instrument panel' })
    ).toHaveText('Temporary tuning: Standard');
    await expect(notice(page, 'Open G')).toHaveCount(0);
    expect(await storedPrefs(page)).toBe(before);
    expect(JSON.parse((await storedPrefs(page)) ?? '{}').tuning).toBe('AF-8');
    await expect(page.getByText('Temporary tuning: Standard.').first()).toBeAttached();
  });

  test('E3: leaving CAGED and coming back shows the notice again', async ({ page }) => {
    await seed(page, { tuning: 'AF-8' });
    await page.goto('/caged');
    await viewInStandard(page);
    await expect(tags(page).first()).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Tools' });
    await nav.getByRole('link', { name: 'Fretboard Notes' }).click();
    await expect(page).toHaveURL(/\/notes$/);
    await expect(page.getByRole('button', { name: /^Temporary tuning/ })).toHaveCount(0);
    await nav.getByRole('link', { name: 'CAGED' }).click();
    await expect(notice(page, 'Open G')).toBeVisible();
  });

  test('E4: Go to Triads opens /triads under the Open G badge', async ({ page }) => {
    await seed(page, { tuning: 'AF-8' });
    await page.goto('/caged');
    await page.getByRole('button', { name: 'Go to Triads' }).click();
    await expect(page).toHaveURL(/\/triads$/);
    await expect(
      page.getByRole('button', { name: 'Tuning: Open G. Open instrument panel' })
    ).toHaveText('Open G');
    await expect(page.getByText('C major — Root position', { exact: true })).toBeVisible();
  });

  test('E5: Standard → DADGAD via the panel shows the notice and keeps key and quality', async ({
    page
  }) => {
    await page.goto('/caged');
    await key(page, 7).click();
    await quality(page, 'Minor').click();
    const dialog = await openPanel(page);
    await dialog.getByRole('radio', { name: /^DADGAD/ }).check();
    await confirmPanel(page);
    await expect(notice(page, 'DADGAD')).toBeVisible();
    await expect(page.getByText('G minor', { exact: true })).toBeVisible();
    await expect(quality(page, 'Minor')).toBeChecked();
    await expect(key(page, 7)).toHaveAttribute('aria-pressed', 'true');
  });

  test('E6: a non-compatible 7-string board gets the 7-string temporary badge', async ({
    page
  }) => {
    await seed(page, { strings: 7, tuning: 'AF-21', customTuning: [0, 0, 0, 0, 0, 0, 3] });
    await page.goto('/caged');
    await expect(notice(page, 'Custom')).toBeVisible();
    await viewInStandard(page);
    await expect(
      page.getByRole('button', {
        name: 'Temporary tuning: 7-string standard. Open instrument panel'
      })
    ).toHaveText('Temporary tuning: 7-string standard');
    for (let s = 1; s <= 7; s++) {
      await expect(board(page).locator(`.cell[data-string="${s}"]`).first()).toBeAttached();
    }
    await expect(board(page).locator('.cell[data-string="8"]')).toHaveCount(0);
  });

  test('E7: key and quality changes keep the badge; a reload brings the notice back', async ({
    page
  }) => {
    await seed(page, { tuning: 'AF-8' });
    await page.goto('/caged');
    await viewInStandard(page);
    await key(page, 2).click();
    await quality(page, 'Minor').click();
    await expect(page.getByText('D minor', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Temporary tuning: Standard/ })).toBeVisible();
    await page.reload();
    await expect(notice(page, 'Open G')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Temporary tuning/ })).toHaveCount(0);
  });

  test('E8: the badge opens the panel on Open G; Close keeps it, Confirm ends it', async ({
    page
  }) => {
    await seed(page, { tuning: 'AF-8' });
    await page.goto('/caged');
    await viewInStandard(page);
    const dialog = await openPanel(page);
    await expect(dialog.getByRole('radio', { name: /^Open G/ })).toBeChecked();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: /^Temporary tuning: Standard/ })).toBeVisible();
    await openPanel(page);
    await confirmPanel(page);
    await expect(page.getByRole('button', { name: /^Temporary tuning/ })).toHaveCount(0);
    await expect(notice(page, 'Open G')).toBeVisible();
  });
});

test.describe('caged 015 US1: accessibility (A1, A2)', () => {
  test('A1: axe on the Open G notice', async ({ page }) => {
    await seed(page, { tuning: 'AF-8' });
    await page.goto('/caged');
    await expect(notice(page, 'Open G')).toBeVisible();
    await runAxe(page);
  });

  for (const width of [undefined, 320]) {
    test(`A2: axe on the temporary view${width ? ` at ${width} px` : ''}`, async ({ page }) => {
      if (width) await page.setViewportSize({ width, height: 800 });
      await seed(page, { tuning: 'AF-8' });
      await page.goto('/caged');
      await viewInStandard(page);
      await expect(tags(page).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /^Temporary tuning/ })).toBeVisible();
      await runAxe(page);
    });
  }
});

test.describe('caged 015 US2: transposed compatible tunings', () => {
  test('E9: Half step down, E♭ and G♭ major draw the Standard shapes', async ({ page }) => {
    await seed(page, { tuning: 'AF-2' });
    await page.goto('/caged');
    await key(page, 3).click();
    await expect(page.getByText('E♭ major', { exact: true })).toBeVisible();
    await expect(
      tags(page).filter({ hasText: 'E shape · roots on strings 6, 4, 1' }).first()
    ).toBeVisible();
    await expect(board(page).locator('.marker').first()).toBeVisible();
    await expect(page.getByText(/E shape, frets 0 to /).first()).toBeAttached();

    await key(page, 6).click();
    await page.getByRole('button', { name: /^Switch to/ }).click();
    await expect(page.getByText('G♭ major', { exact: true })).toBeVisible();
    await expect(page.getByText(/E shape, frets 3 to /).first()).toBeAttached();
    await expect(page.getByText(/altered/i)).toHaveCount(0);
  });

  for (const [id, strings] of [
    ['AF-3', 6],
    ['AF-21', 7],
    ['AF-22', 7],
    ['AF-23', 7]
  ] as const) {
    test(`E10: ${id} draws shapes with no altered mark or temporary badge`, async ({ page }) => {
      await seed(page, { strings, tuning: id });
      await page.goto('/caged');
      await expect(tags(page).first()).toBeVisible();
      await expect(board(page).locator('.marker').first()).toBeVisible();
      await expect(page.getByText('altered', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Temporary tuning/ })).toHaveCount(0);
      if (strings === 7)
        await expect(board(page).locator('.marker[data-key^="7:"]')).toHaveCount(0);
    });
  }
});

test.describe('caged 015 US3: altered lowest string', () => {
  const mark = (page: Page) => board(page).locator('text.string-mark');
  const sixFrets = async (page: Page) =>
    (
      await board(page)
        .locator('.marker')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-key') ?? ''))
    )
      .filter((k) => k.startsWith('6:'))
      .map((k) => Number(k.split(':')[1]))
      .sort((a, b) => a - b);
  const starts = async (page: Page) => {
    const text = (await page.locator('body').textContent()) ?? '';
    return [...text.matchAll(/(\w) shape, frets (\d+) to/g)].map((m) => `${m[1]}${m[2]}`);
  };

  test('E11: Drop D, D major: altered mark, string-6 markers at 7 and 12 only, tags omit 6', async ({
    page
  }) => {
    await seed(page, { tuning: 'AF-4' });
    await page.goto('/caged');
    await key(page, 2).click();
    await expect(page.getByText('D major', { exact: true })).toBeVisible();
    await expect(page.getByText('altered', { exact: true })).toBeVisible();
    const frets = await sixFrets(page);
    expect(frets).toEqual(expect.arrayContaining([7, 12]));
    // Only chord tones of D (A at 7 and 19, D at 12) in G and E regions.
    for (const f of frets) expect([7, 12, 19]).toContain(f);
    await expect(
      tags(page).filter({ hasText: 'E shape · roots on strings 4, 1' }).first()
    ).toBeVisible();
    await expect(
      tags(page).filter({ hasText: 'G shape · roots on strings 3, 1' }).first()
    ).toBeVisible();
    await expect(tags(page).filter({ hasText: /strings 6|, 6/ })).toHaveCount(0);
  });

  test('E12: Drop D keeps the altered mark in every key, string-6 markers only on chord tones', async ({
    page
  }) => {
    await seed(page, { tuning: 'AF-4' });
    await page.goto('/caged');
    for (const pc of [0, 4, 6, 9, 11]) {
      await key(page, pc).click();
      await expect(mark(page)).toHaveText('altered');
      const open = 38; // D2
      const frets = await sixFrets(page);
      for (const f of frets) {
        const rel = (((open + f - pc) % 12) + 12) % 12;
        expect([0, 4, 7]).toContain(rel);
      }
    }
  });

  test('E13: Drop C occurrences start where Whole step down starts them', async ({
    page,
    context
  }) => {
    await seed(page, { tuning: 'AF-3' });
    await page.goto('/caged');
    await expect(tags(page).first()).toBeVisible();
    const wsd = await starts(page);
    expect(wsd.length).toBeGreaterThan(0);

    const other = await context.newPage();
    await seed(other, { tuning: 'AF-5' });
    await other.goto('/caged');
    await expect(tags(other).first()).toBeVisible();
    await expect(mark(other)).toHaveText('altered');
    expect(await starts(other)).toEqual(wsd);
  });
});

test.describe('caged 015 US3: accessibility (A3, A4)', () => {
  test('A3: axe on Drop D', async ({ page }) => {
    await seed(page, { tuning: 'AF-4' });
    await page.goto('/caged');
    await expect(board(page).locator('text.string-mark')).toHaveText('altered');
    await runAxe(page);
  });

  for (const width of [undefined, 320]) {
    test(`A4: axe on left-handed lowest-top Drop D${width ? ` at ${width} px` : ''}`, async ({
      page
    }) => {
      if (width) await page.setViewportSize({ width, height: 800 });
      await seed(page, { tuning: 'AF-4', handedness: 'left', orientation: 'lowest-top' });
      await page.goto('/caged');
      const mark = board(page).locator('text.string-mark');
      await expect(mark).toHaveText('altered');
      // Mirrored: the label column sits at the right edge of the board.
      const svg = board(page).locator('svg[role="grid"]');
      const box = await svg.boundingBox();
      const markBox = await mark.boundingBox();
      if (box && markBox)
        expect(markBox.x + markBox.width / 2).toBeGreaterThan(box.x + box.width / 2);
      await runAxe(page);
    });
  }
});

test.describe('caged 015 polish: every preset tuning (E14, SC-001)', () => {
  const COMPATIBLE = [
    ['AF-1', 6],
    ['AF-2', 6],
    ['AF-3', 6],
    ['AF-21', 7],
    ['AF-22', 7],
    ['AF-23', 7]
  ] as const;
  const ALTERED = [
    ['AF-4', 6],
    ['AF-5', 6]
  ] as const;
  const NON_COMPATIBLE = ['AF-6', 'AF-7', 'AF-8', 'AF-9', 'AF-10', 'AF-11'] as const;
  const anyNotice = (page: Page) =>
    page.getByRole('status').filter({ hasText: /^CAGED depends on the standard relationship/ });

  for (const [id, strings] of COMPATIBLE) {
    test(`E14: ${id} is compatible: shapes, no altered mark, no badge`, async ({ page }) => {
      await seed(page, { strings, tuning: id });
      await page.goto('/caged');
      await expect(tags(page).first()).toBeVisible();
      await expect(board(page).locator('.marker').first()).toBeVisible();
      await expect(page.getByText('altered', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Temporary tuning/ })).toHaveCount(0);
      await expect(anyNotice(page)).toHaveCount(0);
    });
  }

  for (const [id, strings] of ALTERED) {
    test(`E14: ${id} is altered: shapes plus the altered mark`, async ({ page }) => {
      await seed(page, { strings, tuning: id });
      await page.goto('/caged');
      await expect(tags(page).first()).toBeVisible();
      await expect(board(page).locator('.marker').first()).toBeVisible();
      await expect(board(page).locator('text.string-mark')).toHaveText('altered');
      await expect(anyNotice(page)).toHaveCount(0);
    });
  }

  for (const id of NON_COMPATIBLE) {
    test(`E14: ${id} is non-compatible: notice, two actions, no invented shape`, async ({
      page
    }) => {
      await seed(page, { tuning: id });
      await page.goto('/caged');
      await expect(anyNotice(page)).toBeVisible();
      await expect(board(page).getByRole('button')).toHaveText([
        'View in standard tuning',
        'Go to Triads'
      ]);
      await expect(board(page).locator('.marker')).toHaveCount(0);
      await expect(board(page).locator('.tag')).toHaveCount(0);
    });
  }
});
