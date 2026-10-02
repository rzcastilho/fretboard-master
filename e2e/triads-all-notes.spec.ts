import { expect, test, type Page } from '@playwright/test';

import { expectNoHorizontalScroll, runAxe } from './support/helpers';

const sizes = [
  { name: 'phone', width: 360, height: 740 },
  { name: 'desktop', width: 1280, height: 800 }
];

const board = (page: Page) => page.getByRole('region', { name: 'Fretboard' });
const view = (page: Page, name: string) => page.getByRole('radio', { name, exact: true });
const inversionGroup = (page: Page) => page.getByRole('radiogroup', { name: 'Inversion' });
const setGroup = (page: Page) => page.getByRole('radiogroup', { name: 'String set' });

/** A major, All notes. Pass `navigate: false` to keep selections made on the current page. */
async function openAllNotes(page: Page, { navigate = true } = {}) {
  if (navigate) await page.goto('/triads');
  await page
    .getByRole('group', { name: 'Root' })
    .getByRole('button', { name: 'A', exact: true })
    .click();
  await view(page, 'All notes').click();
  await expect(view(page, 'All notes')).toBeChecked();
}

for (const size of sizes) {
  test.describe(`triads All notes @ ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('US2-1: every A, C♯ and E is marked, none outlined, no tags', async ({ page }) => {
      await openAllNotes(page);
      // A major, standard tuning, 22 frets: 35 positions carry A, C♯ or E.
      await expect(board(page).locator('.marker')).toHaveCount(35);
      await expect(board(page).locator('.marker.highlighted')).toHaveCount(0);
      await expect(page.getByRole('group', { name: 'Shapes' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'See all notes' })).toHaveCount(0);
    });

    test('US2-2: inversion and string set are disabled, values kept, hint shown', async ({
      page
    }) => {
      await page.goto('/triads');
      await page.getByRole('radio', { name: '2nd inversion' }).click();
      await page.getByRole('radio', { name: '4-3-2' }).click();
      await openAllNotes(page, { navigate: false });
      await expect(page.getByRole('radio', { name: '2nd inversion' })).toBeChecked();
      await expect(page.getByRole('radio', { name: '4-3-2' })).toBeChecked();
      for (const group of [inversionGroup(page), setGroup(page)]) {
        await expect(group).toHaveAttribute('aria-disabled', 'true');
        await expect(group).toHaveAccessibleDescription('Not used in All notes');
      }
      await expect(page.getByRole('button', { name: 'Octave up' })).toHaveAttribute(
        'aria-disabled',
        'true'
      );
      await expect(page.getByRole('button', { name: 'Octave down' })).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });

    test('US2-2: controls re-enable with their previous values', async ({ page }) => {
      await page.goto('/triads');
      await page.getByRole('radio', { name: '1st inversion' }).click();
      await page.getByRole('radio', { name: '4-3-2' }).click();
      await view(page, 'All notes').click();
      // A disabled radio does nothing when clicked (force: Playwright waits for enabled otherwise).
      await inversionGroup(page)
        .getByRole('radio', { name: 'Root position' })
        .click({ force: true });
      await expect(page.getByRole('radio', { name: '1st inversion' })).toBeChecked();
      await view(page, 'Isolated').click();
      await expect(inversionGroup(page)).not.toHaveAttribute('aria-disabled', 'true');
      await expect(setGroup(page)).not.toHaveAttribute('aria-disabled', 'true');
      await expect(page.getByRole('radio', { name: '1st inversion' })).toBeChecked();
      await expect(page.getByRole('radio', { name: '4-3-2' })).toBeChecked();
    });

    test('US2-3: composition panel drops the inversion and the low-to-high line', async ({
      page
    }) => {
      await openAllNotes(page);
      const panel = page.getByRole('region', { name: 'Composition' });
      await expect(panel.getByText('A major', { exact: true })).toBeVisible();
      await expect(panel.getByText('Low to high')).toHaveCount(0);
      await expect(panel.getByText(/inversion|Root position/)).toHaveCount(0);
    });

    test('US2-4: D♯ major spells the third F𝄪', async ({ page }) => {
      await page.goto('/triads');
      await page
        .getByRole('group', { name: 'Root' })
        .getByRole('button', { name: 'D sharp or E flat' })
        .click();
      await view(page, 'All notes').click();
      // Pick the sharp spelling when the default is flat.
      const sharp = page.getByRole('button', { name: /^Switch to D♯/ });
      if (await sharp.count()) await sharp.click();
      const description = page.locator('p.description');
      await expect(description).toContainText('D sharp major');
      await expect(description).toContainText('F double sharp');
    });

    test('Reset tool returns to Isolated', async ({ page }) => {
      await openAllNotes(page);
      await page.getByRole('button', { name: 'Reset tool', exact: true }).click();
      await expect(view(page, 'Isolated')).toBeChecked();
      await expect(inversionGroup(page)).not.toHaveAttribute('aria-disabled', 'true');
      await expect(page.getByRole('region', { name: 'Composition' })).toContainText('C major');
    });

    test('no axe violations in All notes', async ({ page }) => {
      await openAllNotes(page);
      await runAxe(page);
    });
  });
}

test.describe('triads All notes layout', () => {
  for (const width of [320, 768, 1280, 2560]) {
    test(`no page horizontal scroll at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openAllNotes(page);
      await expectNoHorizontalScroll(page);
    });
  }
});

test.describe('triads guidance recovery to All notes (US3)', () => {
  test('US3-1: beyond fret → See all notes shows every note, keeps selections', async ({
    page
  }) => {
    await page.addInitScript(() => {
      globalThis.__fmInstrument = 'AF-1-12';
    });
    await page.goto('/triads');
    await page.getByRole('radio', { name: 'diminished' }).click();
    await page.getByRole('radio', { name: '5-4-3' }).click();
    await page.getByRole('button', { name: 'See all notes' }).click();
    await expect(view(page, 'All notes')).toBeChecked();
    await expect(page.getByText('This shape lies beyond fret 12')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'See all notes' })).toHaveCount(0);
    await expect(board(page).locator('.marker').first()).toBeVisible();
    await expect(page.getByRole('radio', { name: '5-4-3' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  test('US3-2: does-not-close → See all notes shows every note', async ({ page }) => {
    await page.addInitScript(() => {
      globalThis.__fmInstrument = 'NC-UNISON';
    });
    await page.goto('/triads');
    await page.getByRole('button', { name: 'See all notes' }).click();
    await expect(view(page, 'All notes')).toBeChecked();
    await expect(page.getByText(/does not close/)).toHaveCount(0);
    await expect(board(page).locator('.marker').first()).toBeVisible();
    await runAxe(page);
  });
});
