import { expect, test, type Page } from '@playwright/test';

import { expectNoTruncationOrOverlap, setTextScale } from './support/helpers';

const PREFS_KEY = 'fretboard-master:prefs';

const board = (page: Page) => page.getByRole('region', { name: 'Fretboard' });
const describeButton = (page: Page) => page.getByRole('button', { name: 'Describe this view' });
const panel = (page: Page) => page.locator('.description');

async function open(page: Page) {
  await describeButton(page).click();
  await expect(describeButton(page)).toHaveAttribute('aria-expanded', 'true');
}

async function storePrefs(page: Page, extra: Record<string, unknown>) {
  await page.addInitScript(
    ([key, value]) => {
      if (localStorage.getItem(key as string) === null) {
        localStorage.setItem(key as string, value as string);
      }
    },
    [
      PREFS_KEY,
      JSON.stringify({
        version: 1,
        tuning: 'AF-1',
        frets: 22,
        muted: false,
        volume: 0.8,
        labels: { notes: 'name', triads: 'interval' },
        language: 'en',
        ...extra
      })
    ]
  );
}

async function pickA1stInversion432(page: Page) {
  await page
    .getByRole('group', { name: 'Root' })
    .getByRole('button', { name: 'A', exact: true })
    .click();
  await page.getByRole('radio', { name: '1st inversion' }).click();
  await page.getByRole('radio', { name: '4-3-2' }).click();
}

const A_MAJOR_FIRST =
  'A major, first inversion, strings 4, 3, and 2: string 4, fret 11, C sharp, third; string 3, fret 9, E, fifth; string 2, fret 10, A, root.';

test.describe('Describe this view (US1)', () => {
  test('US1-1: Triads reads the exact sentence', async ({ page }) => {
    await page.goto('/triads');
    await pickA1stInversion432(page);
    await open(page);
    await expect(panel(page)).toHaveText(A_MAJOR_FIRST);
    await expect(describeButton(page)).toHaveText('Describe this view');
  });

  test('US1-2: Portuguese with solfège', async ({ page }) => {
    await storePrefs(page, { language: 'pt-BR', notation: 'solfege' });
    await page.goto('/triads');
    await page.getByRole('radio', { name: '1ª inversão' }).click();
    await page.getByRole('radio', { name: '4-3-2' }).click();
    await page.getByRole('button', { name: 'Descrever esta vista' }).click();
    await expect(panel(page)).toContainText('Dó maior, primeira inversão, cordas 4, 3, e 2:');
  });

  test('US1-3: left-handed gives the same order', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /strings · .* tuning/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Instrument' });
    await dialog.getByRole('radio', { name: 'Left-handed' }).check();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await page
      .getByRole('list')
      .getByRole('link', { name: /^(Continue: )?Triads/ })
      .click();
    await pickA1stInversion432(page);
    await open(page);
    await expect(panel(page)).toHaveText(A_MAJOR_FIRST);
  });

  test('US1-4: Notes states the selection and the string filter', async ({ page }) => {
    await page.goto('/notes');
    await page
      .getByRole('group', { name: 'Choose notes' })
      .getByRole('button', { name: 'C', exact: true })
      .click();
    await page
      .getByRole('group', { name: 'Strings' })
      .getByRole('button', { name: /^String 6/ })
      .click();
    await open(page);
    await expect(panel(page)).toContainText('C selected');
    await expect(panel(page)).toContainText('strings 1 to 5');
    await expect(panel(page)).not.toContainText('root');
  });

  test('US1-5: CAGED with pentatonic lists entries with notes', async ({ page }) => {
    await page.goto('/caged');
    await page
      .getByRole('group', { name: 'Layers' })
      .getByRole('switch', { name: 'Pentatonic', exact: true })
      .click();
    await open(page);
    await expect(panel(page)).toContainText('string 5, fret 3, C, root');
    await expect(panel(page)).toContainText('string 3, open, G, fifth');
  });

  test('US1-6: the open panel updates when the view changes', async ({ page }) => {
    await page.goto('/triads');
    await open(page);
    const before = await panel(page).textContent();
    await page.getByRole('radio', { name: '1st inversion' }).click();
    await expect(panel(page)).not.toHaveText(before ?? '');
    await expect(panel(page)).toContainText('first inversion');
  });

  test('US1-7: an empty Notes view says what to do', async ({ page }) => {
    await page.goto('/notes');
    await page.getByRole('radio', { name: 'None' }).first().click();
    await open(page);
    await expect(panel(page)).toHaveText('No notes selected. Pick a note in the note selector.');
    await expect(board(page)).toBeVisible();
  });
});

const liveRegion = (page: Page) => page.locator('.view-aids [aria-live="polite"]');

/** Load with a fake clock, let the page settle, then stop time so only runFor moves it. */
async function gotoFrozen(page: Page, path: string) {
  await page.clock.install({ time: new Date('2030-01-01T00:00:00Z') });
  await page.goto(path);
  await page.clock.runFor(1000);
  await page.clock.pauseAt(new Date('2030-01-01T00:01:00Z'));
}

test.describe('Announcements (US2)', () => {
  test('US2-1/2: one announcement 500 ms after the last change, focus unchanged', async ({
    page
  }) => {
    await gotoFrozen(page, '/triads');
    await expect(liveRegion(page)).toHaveText('');

    await page.getByRole('radio', { name: '1st inversion' }).click();
    await page.clock.runFor(499);
    await expect(liveRegion(page)).toHaveText('');
    await page.clock.runFor(2);
    await expect(liveRegion(page)).toContainText('first inversion');

    // Focus stays on the control the user used.
    await expect(page.getByRole('radio', { name: '1st inversion' })).toBeFocused();
  });

  test('US2-1: rapid changes produce a single announcement of the last text', async ({ page }) => {
    await gotoFrozen(page, '/triads');
    await page.getByRole('radio', { name: '1st inversion' }).click();
    await page.clock.runFor(200);
    await page.getByRole('radio', { name: '2nd inversion' }).click();
    await page.clock.runFor(499);
    await expect(liveRegion(page)).toHaveText('');
    await page.clock.runFor(2);
    await expect(liveRegion(page)).toContainText('second inversion');
  });

  test('US2-3: arrow keys across positions do not change the live region', async ({ page }) => {
    await gotoFrozen(page, '/notes');
    const grid = board(page).getByRole('grid');
    await grid.getByRole('gridcell').first().focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await page.clock.runFor(2000);
    await expect(liveRegion(page)).toHaveText('');
  });

  test('US2-4: announces while the description panel is closed', async ({ page }) => {
    await gotoFrozen(page, '/triads');
    await expect(describeButton(page)).toHaveAttribute('aria-expanded', 'false');
    await page.getByRole('radio', { name: '1st inversion' }).click();
    await page.clock.runFor(501);
    await expect(liveRegion(page)).toContainText('first inversion');
    await expect(describeButton(page)).toHaveAttribute('aria-expanded', 'false');
  });

  test('US2-5: one announcement in Portuguese after a language change', async ({ page }) => {
    await gotoFrozen(page, '/triads');
    await expect(liveRegion(page)).toHaveText('');
    await page.getByRole('button', { name: 'Language', exact: true }).click();
    await page
      .locator('div[role="region"][id^="language-panel-"]')
      .getByRole('radio', { name: 'Português' })
      .check();
    await page.clock.runFor(499);
    await expect(liveRegion(page)).toHaveText('');
    await page.clock.runFor(2);
    const text = (await liveRegion(page).textContent()) ?? '';
    expect(text).toMatch(/cordas/);
    expect(text).not.toMatch(/strings/);
    await page.clock.runFor(2000);
    await expect(liveRegion(page)).toHaveText(text);
  });
});

const legendButton = (page: Page) => page.getByRole('button', { name: 'Legend', exact: true });
const legendPanel = (page: Page) => page.locator('.view-aids .legend');
const legendNames = (page: Page) => legendPanel(page).locator('li .name');

async function openLegend(page: Page) {
  await legendButton(page).click();
  await expect(legendButton(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(legendPanel(page)).toBeVisible();
}

const layerSwitch = (page: Page, name: string) =>
  page.getByRole('group', { name: 'Layers' }).getByRole('switch', { name, exact: true });

test.describe('Legend (US3)', () => {
  test('US3-1: CAGED with Pentatonic lists Chord and Pentatonic groups', async ({ page }) => {
    await page.goto('/caged');
    await layerSwitch(page, 'Pentatonic').click();
    await openLegend(page);
    await expect(legendPanel(page).locator('h3')).toHaveText(['Chord', 'Pentatonic']);
    await expect(legendNames(page)).toContainText(['Root', 'Third', 'Fifth', 'Scale degree']);
  });

  test('US3-2: connection ring appears with Show connections', async ({ page }) => {
    await page.goto('/caged');
    await openLegend(page);
    await expect(legendNames(page).filter({ hasText: 'Connection' })).toHaveCount(0);
    await page.getByRole('switch', { name: 'Show connections' }).click();
    await expect(legendNames(page).filter({ hasText: 'Connection' })).toHaveCount(1);
  });

  test('US3-3: altered sixth string adds Altered string', async ({ page }) => {
    await storePrefs(page, { tuning: 'AF-4' });
    await page.goto('/caged');
    await openLegend(page);
    await expect(legendNames(page).filter({ hasText: 'Altered string' })).toHaveCount(1);
  });

  test('US3-3: wide stretch adds Wide stretch', async ({ page }) => {
    await page.addInitScript(() => {
      globalThis.__fmInstrument = 'AF-4';
    });
    await page.goto('/triads');
    await page.getByRole('radio', { name: '6-5-4' }).click();
    await openLegend(page);
    await expect(legendNames(page).filter({ hasText: 'Wide stretch' })).toHaveCount(1);
  });

  test('US3-4: Triads comparison adds a Comparison entry', async ({ page }) => {
    await page.goto('/triads');
    await openLegend(page);
    await expect(legendNames(page)).toHaveText(['Root', 'Third', 'Fifth']);
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    await expect(legendNames(page)).toContainText(['Comparison']);
  });

  test('US3-5: Notes lists Note, then Selected note and Octave colour once a note is chosen', async ({
    page
  }) => {
    await page.goto('/notes');
    await openLegend(page);
    await expect(legendNames(page).filter({ hasText: 'Selected note' })).toHaveCount(0);
    await expect(legendNames(page).filter({ hasText: 'Octave colour' })).toHaveCount(0);
    await page
      .getByRole('group', { name: 'Choose notes' })
      .getByRole('button', { name: 'C', exact: true })
      .click();
    await expect(legendNames(page)).toContainText(['Note', 'Selected note', 'Octave colour']);
  });

  test('US3-5: the open Legend updates when the view changes', async ({ page }) => {
    await page.goto('/caged');
    await openLegend(page);
    await expect(legendNames(page)).toHaveText(['Root', 'Third', 'Fifth']);
    await layerSwitch(page, 'Arpeggio').click();
    await expect(legendNames(page)).toContainText(['Arpeggio note']);
  });

  test('US3-6: Escape closes and focuses the button; Tab leaves without a trap', async ({
    page
  }) => {
    await page.goto('/triads');
    await openLegend(page);
    await legendButton(page).press('Tab');
    await expect(legendPanel(page)).toBeVisible();
    await page.keyboard.press('Escape');
    // Focus was outside the panel (no interactive content): Escape does nothing there.
    await expect(legendPanel(page)).toBeVisible();
    await legendPanel(page)
      .locator('li')
      .first()
      .evaluate((el) => {
        el.setAttribute('tabindex', '-1');
        (el as HTMLElement).focus();
      });
    await page.keyboard.press('Escape');
    await expect(legendPanel(page)).toBeHidden();
    await expect(legendButton(page)).toBeFocused();
    await expect(legendButton(page)).toHaveAttribute('aria-expanded', 'false');
  });

  test('both panels open independently', async ({ page }) => {
    await page.goto('/triads');
    await openLegend(page);
    await expect(describeButton(page)).toHaveAttribute('aria-expanded', 'false');
    await open(page);
    await expect(legendButton(page)).toHaveAttribute('aria-expanded', 'true');
  });

  test('SC-008: both panels open at 320 px and 200% text have no truncation or overlap', async ({
    page
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/caged');
    await layerSwitch(page, 'Pentatonic').click();
    await open(page);
    await openLegend(page);
    await setTextScale(page, 200);
    await expectNoTruncationOrOverlap(page);
  });
});
