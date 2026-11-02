import { expect, test, type Page } from '@playwright/test';

import {
  countInOff,
  expectNoHorizontalScroll,
  expectNoTruncationOrOverlap,
  injectAudioFault,
  readAudioLog,
  runAxe,
  setTextScale,
  trackRequests
} from './support/helpers';

const play = (page: Page) => page.getByRole('button', { name: 'Start timer' });
const pause = (page: Page) => page.getByRole('button', { name: 'Pause timer' });
const readout = (page: Page) =>
  page.getByRole('timer', { name: 'Time remaining' }).locator('.time');
const card = (page: Page) => page.locator('section.timer');

async function chimes(page: Page) {
  return (await readAudioLog(page)).filter((e) => e.type === 'chime');
}

test.beforeEach(async ({ page }) => {
  await page.clock.install();
});

test.describe('practice timer: time-box an exercise (US1)', () => {
  test('1: play counts down from 02:00', async ({ page }) => {
    await page.goto('/metronome');
    await expect(readout(page)).toContainText('02:00');
    await play(page).click();
    await expect(pause(page)).toBeVisible();
    await page.clock.runFor(1100);
    await expect(readout(page)).toContainText('01:59');
  });

  test('2: pause holds the reading and resume continues', async ({ page }) => {
    await page.goto('/metronome');
    await play(page).click();
    await page.clock.runFor(10_000);
    await pause(page).click();
    await expect(readout(page)).toContainText('01:50');
    await page.clock.runFor(30_000);
    await expect(readout(page)).toContainText('01:50');
    await play(page).click();
    await page.clock.runFor(5100);
    await expect(readout(page)).toContainText('01:45');
  });

  test('3: a finished run flashes, chimes once, then settles', async ({ page }) => {
    await page.goto('/metronome');
    await play(page).click();
    await page.clock.runFor(120_100);
    await expect(readout(page)).toContainText('00:00');
    await expect(card(page)).toHaveAttribute('data-status', 'finished');
    await expect(card(page)).toHaveAttribute('data-flash', '');
    await expect.poll(async () => (await chimes(page)).length).toBe(1);
    await expect(play(page)).toBeVisible();
    await page.clock.runFor(5100);
    await expect(card(page)).not.toHaveAttribute('data-flash', '');
    await expect(card(page)).toHaveAttribute('data-status', 'finished');
  });

  test('4: play after a finish restarts from the full duration', async ({ page }) => {
    await page.goto('/metronome');
    await play(page).click();
    await page.clock.runFor(120_100);
    await expect(card(page)).toHaveAttribute('data-status', 'finished');
    await play(page).click();
    await expect(readout(page)).toContainText('02:00');
    await page.clock.runFor(1100);
    await expect(readout(page)).toContainText('01:59');
  });

  test('20: a 2 minute run finishes within 1 s of 120 s', async ({ page }) => {
    await page.goto('/metronome');
    await play(page).click();
    await page.clock.runFor(119_000);
    await expect(card(page)).toHaveAttribute('data-status', 'running');
    await page.clock.runFor(1_100);
    await expect(card(page)).toHaveAttribute('data-status', 'finished');
  });

  test('22: blocked audio still finishes visibly, with no chime', async ({ page }) => {
    await injectAudioFault(page, 'context');
    await page.goto('/metronome');
    await play(page).click();
    await page.clock.runFor(120_100);
    await expect(card(page)).toHaveAttribute('data-status', 'finished');
    await expect(readout(page)).toContainText('00:00');
    expect(await chimes(page)).toHaveLength(0);
  });
});

test.describe('practice timer: presets (US2)', () => {
  const pill = (page: Page, n: number) =>
    page.getByRole('group', { name: 'Timer length' }).getByRole('button', { name: `${n}m` });

  test('5: choosing a preset while running resets to stopped', async ({ page }) => {
    await page.goto('/metronome');
    await play(page).click();
    await page.clock.runFor(5000);
    await pill(page, 5).click();
    await expect(card(page)).toHaveAttribute('data-status', 'stopped');
    await expect(readout(page)).toContainText('05:00');
    await expect(pill(page, 5)).toHaveAttribute('aria-pressed', 'true');
  });

  test('6: re-tapping the selected preset resets the countdown', async ({ page }) => {
    await page.goto('/metronome');
    await pill(page, 5).click();
    await play(page).click();
    await page.clock.runFor(20_000);
    await expect(readout(page)).toContainText('04:40');
    await pill(page, 5).click();
    await expect(card(page)).toHaveAttribute('data-status', 'stopped');
    await expect(readout(page)).toContainText('05:00');
  });

  test('7: ten presets, exactly one pressed', async ({ page }) => {
    await page.goto('/metronome');
    const group = page.getByRole('group', { name: 'Timer length' });
    await expect(group.getByRole('button')).toHaveCount(10);
    await expect(group.locator('[aria-pressed="true"]')).toHaveCount(1);
    await expect(pill(page, 2)).toHaveAttribute('aria-pressed', 'true');
  });

  test('27: 5m then play is running after two taps', async ({ page }) => {
    await page.goto('/metronome');
    await pill(page, 5).click();
    await play(page).click();
    await expect(card(page)).toHaveAttribute('data-status', 'running');
  });
});

test.describe('practice timer: independent of the metronome (US3)', () => {
  const panel = (page: Page) => page.locator('section.panel');
  const startMetronome = (page: Page) => page.getByRole('button', { name: 'Start', exact: true });
  const pill = (page: Page, n: number) =>
    page.getByRole('group', { name: 'Timer length' }).getByRole('button', { name: `${n}m` });
  const clicks = async (page: Page) => (await readAudioLog(page)).filter((e) => e.type === 'click');

  async function openPlain(page: Page) {
    await page.goto('/metronome');
    await page.getByRole('tab', { name: 'Metronome', exact: true }).click();
    await expect(panel(page)).toHaveAttribute('data-mode', 'plain');
  }

  async function oneMinute(page: Page) {
    await pill(page, 1).click();
    await expect(readout(page)).toContainText('01:00');
  }

  test('8: the metronome keeps clicking after the timer chimes', async ({ page }) => {
    test.setTimeout(120_000); // the running scheduler makes each virtual second cost real time
    await openPlain(page);
    await countInOff(page);
    await startMetronome(page).click();
    await expect(panel(page)).toHaveAttribute('data-phase', 'running');
    await oneMinute(page);
    await play(page).click();
    // Step in slices so the running scheduler's timers fire between checks.
    await expect
      .poll(
        async () => {
          await page.clock.runFor(10_000);
          return card(page).getAttribute('data-status');
        },
        { timeout: 80_000, intervals: [50] }
      )
      .toBe('finished');
    await expect.poll(async () => (await chimes(page)).length).toBe(1);
    const atChime = (await clicks(page)).length;
    await page.clock.runFor(3000);
    await expect.poll(async () => (await clicks(page)).length).toBeGreaterThan(atChime);
    await expect(panel(page)).toHaveAttribute('data-phase', 'running');
  });

  test('9: starting the timer alone logs no click and leaves the metronome stopped', async ({
    page
  }) => {
    await openPlain(page);
    await play(page).click();
    await page.clock.runFor(5000);
    expect(await clicks(page)).toHaveLength(0);
    await expect(startMetronome(page)).toBeVisible();
    await expect(panel(page)).toHaveAttribute('data-phase', 'settings');
  });

  test('10: metronome Reset and Escape leave the timer counting', async ({ page }) => {
    await openPlain(page);
    await countInOff(page);
    await startMetronome(page).click();
    await expect(panel(page)).toHaveAttribute('data-phase', 'running');
    await play(page).click();
    await page.clock.runFor(10_100);
    await expect(readout(page)).toContainText('01:49');
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(panel(page)).toHaveAttribute('data-phase', 'settings');
    await expect(card(page)).toHaveAttribute('data-status', 'running');
    await page.clock.runFor(5000);
    await expect(readout(page)).toContainText('01:44');
    await startMetronome(page).click();
    await expect(panel(page)).toHaveAttribute('data-phase', /starting|running/);
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveAttribute('data-phase', 'settings');
    await expect(card(page)).toHaveAttribute('data-status', 'running');
    await page.clock.runFor(5000);
    await expect(readout(page)).toContainText('01:39');
  });

  test('11: every mode tab shows the card with the same reading', async ({ page }) => {
    await openPlain(page);
    await play(page).click();
    await page.clock.runFor(10_100);
    await expect(readout(page)).toContainText('01:49');
    for (const name of ['Ratios Training', 'Speed Training', 'Metronome']) {
      await page.getByRole('tab', { name, exact: true }).click();
      await expect(card(page)).toHaveCount(1);
      await expect(card(page)).toHaveAttribute('data-status', 'running');
      await expect(readout(page)).toContainText('01:49');
    }
    await page.clock.runFor(1000);
    await expect(readout(page)).toContainText('01:48');
  });

  test('12: leaving the page for 61 s comes back to a finished timer, one chime', async ({
    page
  }) => {
    await openPlain(page);
    await oneMinute(page);
    await play(page).click();
    await page.getByRole('link', { name: 'Fretboard Notes', exact: true }).first().click();
    await expect(page).toHaveURL(/\/notes/);
    await page.clock.runFor(61_000);
    await expect.poll(async () => (await chimes(page)).length).toBe(1);
    await page.getByRole('link', { name: 'Metronome', exact: true }).first().click();
    await expect(card(page)).toHaveAttribute('data-status', 'finished');
    await expect(readout(page)).toContainText('00:00');
    expect(await chimes(page)).toHaveLength(1);
  });

  test('23: Space and Enter on the timer controls never toggle the metronome', async ({ page }) => {
    await openPlain(page);
    await pill(page, 3).focus();
    await page.keyboard.press('Space');
    await expect(pill(page, 3)).toHaveAttribute('aria-pressed', 'true');
    await expect(panel(page)).toHaveAttribute('data-phase', 'settings');
    await play(page).focus();
    await page.keyboard.press('Space');
    await expect(card(page)).toHaveAttribute('data-status', 'running');
    await expect(panel(page)).toHaveAttribute('data-phase', 'settings');
    await pause(page).focus();
    await page.keyboard.press('Enter');
    await expect(card(page)).toHaveAttribute('data-status', 'paused');
    await expect(panel(page)).toHaveAttribute('data-phase', 'settings');
    expect(await clicks(page)).toHaveLength(0);
  });
});

const KEY = 'fretboard-master:prefs';
const stored = (page: Page) => page.evaluate((k) => localStorage.getItem(k), KEY);
const storedTimer = async (page: Page) => {
  const raw = await stored(page);
  return raw ? (JSON.parse(raw).metronome?.timer ?? null) : null;
};

test.describe('practice timer: remembered preset (US4)', () => {
  const pill = (page: Page, n: number) =>
    page.getByRole('group', { name: 'Timer length' }).getByRole('button', { name: `${n}m` });

  test('13: 5m survives a reload', async ({ page }) => {
    await page.goto('/metronome');
    await pill(page, 5).click();
    await expect.poll(() => storedTimer(page)).toBe(5);
    await page.reload();
    await expect(pill(page, 5)).toHaveAttribute('aria-pressed', 'true');
    await expect(readout(page)).toContainText('05:00');
    await expect(card(page)).toHaveAttribute('data-status', 'stopped');
  });

  test('14: a running countdown does not survive a reload', async ({ page }) => {
    await page.goto('/metronome');
    await pill(page, 5).click();
    await expect.poll(() => storedTimer(page)).toBe(5);
    await play(page).click();
    await page.clock.runFor(10_000);
    await expect(readout(page)).toContainText('04:50');
    await page.reload();
    await expect(card(page)).toHaveAttribute('data-status', 'stopped');
    await expect(readout(page)).toContainText('05:00');
  });

  test('15: Erase preferences returns to 2m with no timer key', async ({ page }) => {
    await page.goto('/metronome');
    await pill(page, 5).click();
    await expect.poll(() => storedTimer(page)).toBe(5);
    await page.goto('/about');
    await page.locator('#privacy').getByRole('button', { name: 'Erase my preferences' }).click();
    await page.getByRole('button', { name: 'Erase', exact: true }).click();
    await expect(page).toHaveURL('/');
    expect(await stored(page)).toBeNull();
    await page.goto('/metronome');
    await expect(pill(page, 2)).toHaveAttribute('aria-pressed', 'true');
    await expect(readout(page)).toContainText('02:00');
    expect(await storedTimer(page)).toBeNull();
  });

  test('16: a seeded mode and timer gives 2m with Speed Training active', async ({ page }) => {
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
      [KEY, JSON.stringify({ v: 1, metronome: { mode: 'speed', timer: '7' } })]
    );
    await page.goto('/metronome');
    await expect(pill(page, 2)).toHaveAttribute('aria-pressed', 'true');
    await expect(readout(page)).toContainText('02:00');
    await expect(page.getByRole('tab', { name: 'Speed Training', exact: true })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });
});

test.describe('practice timer: by ear and screen reader (US5)', () => {
  const status = (page: Page) => card(page).getByRole('status');

  test('17: a muted run to zero still shows the finished state', async ({ page }) => {
    await page.goto('/metronome');
    await page.getByRole('button', { name: 'Mute sound' }).click();
    await page.getByRole('button', { name: '1m', exact: true }).click();
    await play(page).click();
    await page.clock.runFor(60_100);
    await expect(card(page)).toHaveAttribute('data-status', 'finished');
    await expect(card(page)).toHaveAttribute('data-flash', '');
    await expect(readout(page)).toContainText('00:00');
  });

  test('18: reduced motion replaces the flash with a static highlight', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/metronome');
    await page.getByRole('button', { name: '1m', exact: true }).click();
    await play(page).click();
    await page.clock.runFor(60_100);
    await expect(card(page)).toHaveAttribute('data-flash', '');
    await expect(readout(page)).toHaveCSS('animation-name', 'none');
    await expect(readout(page)).toHaveCSS('text-decoration-line', 'underline');
  });

  test('19: the polite region announces 10, 5, 1 seconds and the finish', async ({ page }) => {
    await page.goto('/metronome');
    await page.getByRole('button', { name: '1m', exact: true }).click();
    await play(page).click();
    await page.clock.runFor(49_000);
    await expect(status(page)).toHaveText('');
    await page.clock.runFor(1_100);
    await expect(status(page)).toHaveText('10 seconds');
    await page.clock.runFor(5_000);
    await expect(status(page)).toHaveText('5 seconds');
    await page.clock.runFor(4_000);
    await expect(status(page)).toHaveText('1 second');
    await page.clock.runFor(1_000);
    await expect(status(page)).toHaveText('Timer finished');
    await expect(page.getByRole('timer', { name: 'Time remaining' })).not.toHaveAttribute(
      'aria-live'
    );
  });
});

test.describe('practice timer: polish (layout, contrast, offline)', () => {
  const pills = (page: Page) => card(page).locator('button[aria-pressed]');

  async function expectAllPillsUsable(page: Page) {
    await expect(pills(page)).toHaveCount(10);
    for (const pill of await pills(page).all()) {
      await expect(pill).toBeVisible();
      await expect(pill).toBeEnabled();
    }
  }

  for (const { tag, locale } of [
    { tag: 'en', locale: 'en-US' },
    { tag: 'pt-BR', locale: 'pt-BR' },
    { tag: 'es', locale: 'es-ES' }
  ]) {
    test.describe(`24: 200% text zoom in ${tag}`, () => {
      test.use({ locale });

      for (const width of [320, 1024]) {
        test(`${width} px fits with all ten pills`, async ({ page }) => {
          await page.setViewportSize({ width, height: 800 });
          await page.goto('/metronome');
          await expect(page.locator('html')).toHaveAttribute('lang', tag);
          await setTextScale(page, 200);
          await expectAllPillsUsable(page);
          await expectNoHorizontalScroll(page);
          await expectNoTruncationOrOverlap(page);
        });
      }
    });
  }

  test('25: large desktop viewports show the card and all pills at 100% zoom', async ({ page }) => {
    for (const [width, height] of [
      [1024, 768],
      [2560, 1440]
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto('/metronome');
      await expect(card(page)).toBeVisible();
      await expectAllPillsUsable(page);
      await expectNoHorizontalScroll(page);
      await expectNoTruncationOrOverlap(page);
    }
  });

  const MODES = [
    { name: 'light', media: { colorScheme: 'light' as const } },
    { name: 'dark', media: { colorScheme: 'dark' as const } },
    { name: 'more contrast', media: { contrast: 'more' as const } }
  ];
  for (const { name, media } of MODES) {
    test(`axe is clean running and finished (${name})`, async ({ page }) => {
      await page.emulateMedia(media);
      await page.goto('/metronome');
      await page.getByRole('button', { name: '1m', exact: true }).click();
      await play(page).click();
      await page.clock.runFor(5_000);
      await expect(card(page)).toHaveAttribute('data-status', 'running');
      await runAxe(page);
      await page.clock.runFor(60_000);
      await expect(card(page)).toHaveAttribute('data-status', 'finished');
      await runAxe(page);
    });
  }

  test('28: offline, a 1m run reaches zero with no network requests', async ({ page, context }) => {
    await page.goto('/metronome');
    await page.getByRole('button', { name: '1m', exact: true }).click();
    await page.waitForLoadState('networkidle');
    const tracker = trackRequests(page);
    tracker.start();
    await context.setOffline(true);
    await play(page).click();
    await page.clock.runFor(60_100);
    await expect(card(page)).toHaveAttribute('data-status', 'finished');
    await expect(readout(page)).toContainText('00:00');
    expect(tracker.requests.map((r) => r.url())).toEqual([]);
  });

  test('timer card', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    await page.goto('/metronome');
    await expect(card(page)).toHaveScreenshot('timer-card-idle.png', { animations: 'disabled' });
    await page.getByRole('button', { name: '1m', exact: true }).click();
    await play(page).click();
    await page.clock.runFor(66_000);
    await expect(card(page)).toHaveAttribute('data-status', 'finished');
    await expect(card(page)).not.toHaveAttribute('data-flash', '');
    await expect(card(page)).toHaveScreenshot('timer-card-finished.png', {
      animations: 'disabled'
    });
  });
});
