import { expect, test, type Page } from '@playwright/test';

import { expectNoHorizontalScroll, runAxe, setTextScale } from './support/helpers';

const KEY = 'fretboard-master:prefs';
const card = (page: Page) => page.locator('section.timer');
const panel = (page: Page) => page.locator('section.panel');
const readout = (page: Page) =>
  page.getByRole('timer', { name: 'Time remaining' }).locator('.time');
const linkSwitch = (page: Page) =>
  page.getByRole('switch', { name: 'Start and stop with metronome' });
const startMetronome = (page: Page) => page.getByRole('button', { name: 'Start', exact: true });
const pill = (page: Page, n: number) =>
  page.getByRole('group', { name: 'Timer length' }).getByRole('button', { name: `${n}m` });
const stored = (page: Page) => page.evaluate((k) => localStorage.getItem(k), KEY);

async function openPlain(page: Page) {
  await page.goto('/metronome');
  await page.getByRole('tab', { name: 'Metronome', exact: true }).click();
  await expect(panel(page)).toHaveAttribute('data-mode', 'plain');
}

test.beforeEach(async ({ page }) => {
  await page.clock.install();
});

test.describe('timer linked to metronome: the switch (US2)', () => {
  test('off by default, and the timer and metronome stay independent', async ({ page }) => {
    await openPlain(page);
    await expect(linkSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await startMetronome(page).click();
    await expect(panel(page)).toHaveAttribute('data-phase', /starting|running/);
    await page.clock.runFor(5000);
    await expect(card(page)).toHaveAttribute('data-status', 'stopped');
    await expect(readout(page)).toContainText('02:00');
  });

  test('on survives a reload with nothing running; Erase preferences turns it off', async ({
    page
  }) => {
    await page.goto('/metronome');
    await linkSwitch(page).click();
    await expect(linkSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => stored(page)).toContain('"timerLink":true');
    await page.reload();
    await expect(linkSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await expect(card(page)).toHaveAttribute('data-status', 'stopped');
    await expect(panel(page)).toHaveAttribute('data-phase', 'settings');
    await page.goto('/about');
    await page.locator('#privacy').getByRole('button', { name: 'Erase my preferences' }).click();
    await page.getByRole('button', { name: 'Erase', exact: true }).click();
    await expect(page).toHaveURL('/');
    await page.goto('/metronome');
    await expect(linkSwitch(page)).toHaveAttribute('aria-checked', 'false');
  });
});

test.describe('timer linked to metronome: one press starts both (US1)', () => {
  test('count-in holds 01:00, the countdown runs after it, and zero stops the metronome', async ({
    page
  }) => {
    test.setTimeout(120_000); // the running scheduler makes each virtual second cost real time
    await openPlain(page);
    await pill(page, 1).click();
    await linkSwitch(page).click();
    await startMetronome(page).click();
    await expect(panel(page)).toHaveAttribute('data-phase', /starting|running/);
    await expect(card(page)).toHaveAttribute('data-status', 'stopped');
    await expect(readout(page)).toContainText('01:00');
    // Past the 4-click count-in the countdown runs.
    await expect
      .poll(
        async () => {
          await page.clock.runFor(1000);
          return card(page).getAttribute('data-status');
        },
        { timeout: 30_000, intervals: [50] }
      )
      .toBe('running');
    await expect(panel(page)).toHaveAttribute('data-phase', 'running');
    await expect
      .poll(
        async () => {
          await page.clock.runFor(10_000);
          return card(page).getAttribute('data-status');
        },
        { timeout: 80_000, intervals: [50] }
      )
      .toBe('finished');
    await expect(readout(page)).toContainText('00:00');
    await expect(panel(page)).toHaveAttribute('data-phase', 'settings');
    await expect(startMetronome(page)).toBeVisible();
  });
});

const timerStatus = (page: Page) => card(page).getAttribute('data-status');
const resetButton = (page: Page) => page.getByRole('button', { name: 'Reset', exact: true });

/** Link on, start the metronome, and run until the countdown has begun (past the count-in). */
async function startLinked(page: Page) {
  await openPlain(page);
  await linkSwitch(page).click();
  await startMetronome(page).click();
  await expect
    .poll(
      async () => {
        await page.clock.runFor(1000);
        return timerStatus(page);
      },
      { timeout: 30_000, intervals: [50] }
    )
    .toBe('running');
  await expect(panel(page)).toHaveAttribute('data-phase', 'running');
}

test.describe('timer linked to metronome: stopping early (US3)', () => {
  test('Reset mid-run returns the timer to the full duration, stopped', async ({ page }) => {
    test.setTimeout(120_000);
    await startLinked(page);
    await page.clock.runFor(3000);
    await resetButton(page).click();
    await expect(panel(page)).toHaveAttribute('data-phase', 'settings');
    await expect(card(page)).toHaveAttribute('data-status', 'stopped');
    await expect(readout(page)).toContainText('02:00');
  });

  test('Reset during the count-in: the timer never starts', async ({ page }) => {
    await openPlain(page);
    await linkSwitch(page).click();
    await startMetronome(page).click();
    await expect(panel(page)).toHaveAttribute('data-phase', /starting|running/);
    await resetButton(page).click();
    await expect(panel(page)).toHaveAttribute('data-phase', 'settings');
    await page.clock.runFor(8000);
    await expect(card(page)).toHaveAttribute('data-status', 'stopped');
    await expect(readout(page)).toContainText('02:00');
  });

  test('pausing then resuming the metronome pauses and resumes the timer', async ({ page }) => {
    test.setTimeout(120_000);
    await startLinked(page);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(card(page)).toHaveAttribute('data-status', 'paused');
    const frozen = await readout(page).innerText();
    await page.clock.runFor(10_000);
    await expect(readout(page)).toHaveText(frozen);
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect
      .poll(
        async () => {
          await page.clock.runFor(500);
          return timerStatus(page);
        },
        { timeout: 20_000, intervals: [50] }
      )
      .toBe('running');
  });

  test('switching mode tab resets the timer', async ({ page }) => {
    test.setTimeout(120_000);
    await startLinked(page);
    await page.getByRole('tab', { name: 'Speed Training', exact: true }).click();
    await expect(card(page)).toHaveAttribute('data-status', 'stopped');
    await expect(readout(page)).toContainText('02:00');
  });

  test("the timer's own play does not start the metronome", async ({ page }) => {
    await openPlain(page);
    await linkSwitch(page).click();
    await page.getByRole('button', { name: 'Start timer' }).click();
    await page.clock.runFor(3000);
    await expect(card(page)).toHaveAttribute('data-status', 'running');
    await expect(panel(page)).toHaveAttribute('data-phase', 'settings');
  });
});

test.describe('timer linked to metronome: accessibility and layout', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`axe is clean with the switch on (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/metronome');
      await linkSwitch(page).click();
      await expect(linkSwitch(page)).toHaveAttribute('aria-checked', 'true');
      await runAxe(page);
    });
  }

  test('320 px at 200% text zoom: no horizontal scroll and the switch is reachable', async ({
    page
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/metronome');
    await setTextScale(page, 200);
    await linkSwitch(page).scrollIntoViewIfNeeded();
    await expect(linkSwitch(page)).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
