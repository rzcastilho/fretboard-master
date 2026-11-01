import { expect, test, type Page } from '@playwright/test';

const KEY = 'fretboard-master:prefs';

const slider = (page: Page, name: string) => page.getByRole('slider', { name });
const loop1 = (page: Page) => page.getByRole('combobox', { name: 'Loop 1' });
const loop2 = (page: Page) => page.getByRole('combobox', { name: 'Loop 2' });
const countInSwitch = (page: Page) => page.getByRole('switch', { name: 'Count In' });
const ratioSwitch = (page: Page) => page.getByRole('switch', { name: 'Subdivision ratio' });

const stored = (page: Page) => page.evaluate((k) => localStorage.getItem(k), KEY);

/** The record is written on change; wait for it so a reload cannot race the write. */
async function waitForMetronome(page: Page, fragment: string): Promise<void> {
  await expect.poll(() => stored(page)).toContain(fragment);
}

async function expectDefaults(page: Page): Promise<void> {
  await expect(slider(page, 'BPM')).toHaveValue('85');
  await expect(slider(page, '# of Beats')).toHaveValue('4');
  await expect(countInSwitch(page)).toHaveAttribute('aria-checked', 'true');
  await expect(slider(page, 'Initial Count In')).toHaveValue('4');
  await expect(slider(page, 'Repeat Count In')).toHaveValue('2');
  await expect(ratioSwitch(page)).toHaveAttribute('aria-checked', 'true');
  await expect(loop1(page)).toHaveValue('3');
  await expect(loop2(page)).toHaveValue('6');
}

test.describe('remembered metronome settings: US1', () => {
  test('US1-1 / SC-001: 120 BPM, 2 beats, Loop 2 Quintuplets survive a reload', async ({
    page
  }) => {
    await page.goto('/metronome');
    await slider(page, 'BPM').fill('120');
    await slider(page, '# of Beats').fill('2');
    await loop2(page).selectOption('5');
    await waitForMetronome(page, '"loop2":5');

    await page.reload();

    await expect(slider(page, 'BPM')).toHaveValue('120');
    await expect(slider(page, '# of Beats')).toHaveValue('2');
    await expect(loop2(page)).toHaveValue('5');
    await expect(slider(page, 'Initial Count In')).toHaveValue('4');
    await expect(slider(page, 'Repeat Count In')).toHaveValue('2');
    await expect(loop1(page)).toHaveValue('3');
    await expect(countInSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await expect(ratioSwitch(page)).toHaveAttribute('aria-checked', 'true');
  });

  test('US1-2: all eight settings are restored, including a hidden Loop 2', async ({ page }) => {
    await page.goto('/metronome');
    await slider(page, 'BPM').fill('140');
    await slider(page, '# of Beats').fill('7');
    await slider(page, 'Initial Count In').fill('6');
    await slider(page, 'Repeat Count In').fill('3');
    await loop1(page).selectOption('2');
    await loop2(page).selectOption('5');
    await countInSwitch(page).click();
    await ratioSwitch(page).click(); // last: Loop 2 is hidden from here on
    await expect(ratioSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await waitForMetronome(page, '"ratio":false');

    await page.reload();

    await expect(slider(page, 'BPM')).toHaveValue('140');
    await expect(slider(page, '# of Beats')).toHaveValue('7');
    await expect(loop1(page)).toHaveValue('2');
    await expect(countInSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(ratioSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await countInSwitch(page).click();
    await ratioSwitch(page).click();
    await expect(slider(page, 'Initial Count In')).toHaveValue('6');
    await expect(slider(page, 'Repeat Count In')).toHaveValue('3');
    await expect(loop2(page)).toHaveValue('5');

    const raw = await stored(page);
    expect(raw).not.toBeNull();
    const record = JSON.parse(raw as string) as Record<string, unknown>;
    expect(Object.keys(record).at(-1)).toBe('metronome');
    const ratios = (record.metronome as { ratios: Record<string, unknown> }).ratios;
    expect(Object.keys(ratios)).toEqual([
      'bpm',
      'beats',
      'countIn',
      'initialCountIn',
      'repeatCountIn',
      'ratio',
      'loop1',
      'loop2'
    ]);
  });

  test('US1-3: leaving to Notes and coming back keeps the BPM', async ({ page }) => {
    await page.goto('/metronome');
    await slider(page, 'BPM').fill('132');
    await page.getByRole('link', { name: 'Fretboard Notes', exact: true }).first().click();
    await expect(page).toHaveURL(/\/notes/);
    await page.getByRole('link', { name: 'Metronome', exact: true }).first().click();
    await expect(slider(page, 'BPM')).toHaveValue('132');
  });

  test('US1-4: a fresh context shows the defaults', async ({ page }) => {
    await page.goto('/metronome');
    await expectDefaults(page);
    expect(await stored(page)).not.toContain('"metronome":');
  });

  test('the record has no metronome key once every value is back at its default', async ({
    page
  }) => {
    await page.goto('/metronome');
    await slider(page, 'BPM').fill('120');
    await waitForMetronome(page, '"bpm":120');
    await slider(page, 'BPM').fill('85');
    await expect.poll(() => stored(page)).not.toContain('"metronome":');
  });
});

// The card (data-phase, data-mode) wraps the tab bar and the tabpanel.
const card = (page: Page) => page.locator('section.panel');
const startBtn = (page: Page) => page.getByRole('button', { name: 'Start Training' });
const resetBtn = (page: Page) => page.getByRole('button', { name: 'Reset', exact: true });
const pauseBtn = (page: Page) => page.getByRole('button', { name: 'Pause', exact: true });

test.describe('remembered metronome settings: US2', () => {
  test('US2-1: Reset keeps the changed settings, also after a reload', async ({ page }) => {
    await page.goto('/metronome');
    await page.waitForLoadState('networkidle');
    await slider(page, 'BPM').fill('120');
    await slider(page, '# of Beats').fill('2');
    await waitForMetronome(page, '"beats":2');
    await startBtn(page).click();
    await expect(card(page)).toHaveAttribute('data-phase', /starting|running/);
    await expect(pauseBtn(page)).toBeVisible();
    await pauseBtn(page).click();
    await expect(card(page)).toHaveAttribute('data-phase', 'paused');
    await resetBtn(page).click();
    await expect(card(page)).toHaveAttribute('data-phase', 'settings');
    await expect(slider(page, 'BPM')).toHaveValue('120');
    await expect(slider(page, '# of Beats')).toHaveValue('2');

    await page.reload();

    await expect(card(page)).toHaveAttribute('data-phase', 'settings');
    await expect(slider(page, 'BPM')).toHaveValue('120');
    await expect(slider(page, '# of Beats')).toHaveValue('2');
  });

  test('US2-2 / SC-006: a reload mid-run lands on settings and Start begins at COUNT IN –/4', async ({
    page
  }) => {
    await page.goto('/metronome');
    await page.waitForLoadState('networkidle');
    await slider(page, 'BPM').fill('120');
    await waitForMetronome(page, '"bpm":120');
    await startBtn(page).click();
    await expect(card(page)).toHaveAttribute('data-phase', /starting|running/);
    await expect(page.locator('.position')).toContainText('COUNT IN');

    await page.reload();

    await expect(card(page)).toHaveAttribute('data-phase', 'settings');
    await expect(slider(page, 'BPM')).toHaveValue('120');
    await startBtn(page).click();
    await expect(page.locator('.position')).toContainText('COUNT IN –/4');
  });
});

const NOTICE = "Preferences won't be remembered on this device.";
const notice = (page: Page) => page.getByRole('status').filter({ hasText: NOTICE });

/** Seed a stored record before any page script runs (once, so reloads keep later writes). */
async function seed(page: Page, record: unknown): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      try {
        if (localStorage.getItem('__seeded') === null) {
          localStorage.setItem(key as string, value as string);
          localStorage.setItem('__seeded', '1');
        }
      } catch {
        // storage unavailable
      }
    },
    [KEY, JSON.stringify(record)]
  );
}

test.describe('remembered metronome settings: US3', () => {
  test('US3-1 / SC-003: an out-of-range BPM resets only itself', async ({ page }) => {
    await seed(page, {
      version: 1,
      metronome: {
        ratios: {
          bpm: 900,
          beats: 7,
          countIn: false,
          initialCountIn: 6,
          repeatCountIn: 3,
          ratio: true,
          loop1: 2,
          loop2: 5
        }
      }
    });
    await page.goto('/metronome');
    await expect(slider(page, 'BPM')).toHaveValue('85');
    await expect(slider(page, '# of Beats')).toHaveValue('7');
    await expect(countInSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(ratioSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await expect(loop1(page)).toHaveValue('2');
    await expect(loop2(page)).toHaveValue('5');
    await countInSwitch(page).click();
    await expect(slider(page, 'Initial Count In')).toHaveValue('6');
    await expect(slider(page, 'Repeat Count In')).toHaveValue('3');
  });

  test('US3-3: a non-object metronome entry gives the defaults and no notice', async ({ page }) => {
    await seed(page, { version: 1, metronome: [] });
    await page.goto('/metronome');
    await expectDefaults(page);
    await expect(notice(page)).toHaveCount(0);
  });

  test('US3-4: a string "120" and 2.5 fall back to the defaults', async ({ page }) => {
    await seed(page, { version: 1, metronome: { ratios: { bpm: '120', beats: 2.5 } } });
    await page.goto('/metronome');
    await expectDefaults(page);
  });

  test('US3-5: blocked storage keeps the BPM in the session with no new notice', async ({
    page
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('blocked', 'SecurityError');
        }
      });
    });
    await page.goto('/metronome');
    const before = await notice(page).count();
    await slider(page, 'BPM').fill('120');
    await page.getByRole('link', { name: 'Fretboard Notes', exact: true }).first().click();
    await expect(page).toHaveURL(/\/notes/);
    await page.getByRole('link', { name: 'Metronome', exact: true }).first().click();
    await expect(slider(page, 'BPM')).toHaveValue('120');
    expect(await notice(page).count()).toBeLessThanOrEqual(before);
  });
});

test.describe('remembered metronome settings: US4', () => {
  test('US4-1 / SC-005: Erase resets the metronome to defaults, also after a reload', async ({
    page
  }) => {
    await page.goto('/metronome');
    await slider(page, 'BPM').fill('120');
    await slider(page, '# of Beats').fill('2');
    await loop2(page).selectOption('5');
    await waitForMetronome(page, '"loop2":5');

    await page.goto('/about');
    await page.locator('#privacy').getByRole('button', { name: 'Erase my preferences' }).click();
    await page.getByRole('button', { name: 'Erase', exact: true }).click();
    await expect(page).toHaveURL('/');

    await page
      .getByRole('link', { name: /^Metronome/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/metronome/);
    await expectDefaults(page);

    await page.reload();
    await expectDefaults(page);
  });
});

test.describe('remembered metronome settings: US5', () => {
  test('US5-1: a speed entry next to ratios does not affect the ratios values', async ({
    page
  }) => {
    await seed(page, {
      version: 1,
      metronome: {
        ratios: { bpm: 120, beats: 2, loop2: 5 },
        speed: { bpm: 200, beats: 9 }
      }
    });
    await page.goto('/metronome');
    await expect(slider(page, 'BPM')).toHaveValue('120');
    await expect(slider(page, '# of Beats')).toHaveValue('2');
    await expect(loop2(page)).toHaveValue('5');
  });

  test('US5-2: an invalid speed entry is dropped on the next write', async ({ page }) => {
    await seed(page, {
      version: 1,
      metronome: { ratios: { bpm: 120 }, speed: 'garbage' }
    });
    await page.goto('/metronome');
    await expect(slider(page, 'BPM')).toHaveValue('120');
    await slider(page, 'BPM').fill('130');
    await waitForMetronome(page, '"bpm":130');
    expect(await stored(page)).not.toContain('"speed"');
  });
});
