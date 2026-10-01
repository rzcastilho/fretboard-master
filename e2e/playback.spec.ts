import { expect, test, type Page } from '@playwright/test';

import {
  expectNoHorizontalScroll,
  injectAudioFault,
  readAudioLog,
  runAxe
} from './support/helpers';

const cellAt = (page: Page, string: number, fret: number) =>
  page.locator(`.cell[data-string="${string}"][data-fret="${fret}"]`);

async function stepEntries(page: Page) {
  return (await readAudioLog(page)).filter((e) => e.type === 'step');
}

test.describe('note playback (US1)', () => {
  test('no audio is unlocked by navigation or scrolling (US1-4, FR-002)', async ({ page }) => {
    await page.goto('/notes');
    const grid = page.getByRole('grid', { name: 'Fretboard' });
    await grid.waitFor();
    await grid.evaluate((el) => {
      const scroller = el.closest('[class*="scroll"]') ?? el.parentElement;
      scroller?.scrollBy?.({ left: 300 });
    });
    await page
      .getByRole('link', { name: /triads/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/triads$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/notes$/);
    const log = await readAudioLog(page);
    expect(log.filter((e) => e.type === 'unlock')).toEqual([]);
  });

  test('first activation unlocks then sounds string 6 open at 82.41 Hz (US1-1, SC-002)', async ({
    page
  }) => {
    await page.goto('/notes');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    expect(await readAudioLog(page)).toEqual([]);
    await page.getByRole('gridcell', { name: 'E, string 6, open', exact: true }).click();
    await expect.poll(async () => (await stepEntries(page)).length).toBe(1);
    const log = await readAudioLog(page);
    expect(log.map((e) => e.type).slice(0, 2)).toEqual(['unlock', 'step']);
    const step = log.find((e) => e.type === 'step');
    if (step?.type !== 'step') throw new Error('no step entry');
    expect(step.kind).toBe('note');
    expect(step.pitches).toEqual([40]);
    expect(step.frequencies[0]).toBeCloseTo(82.41, 1);
  });

  test('keyboard: Enter on string 5 fret 3 sounds pitch 48', async ({ page }) => {
    await page.goto('/notes');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await cellAt(page, 5, 3).focus();
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await stepEntries(page)).length).toBe(1);
    const step = (await stepEntries(page))[0];
    if (step?.type !== 'step') throw new Error('no step entry');
    expect(step.pitches).toEqual([48]);
  });
});

test.describe('pulse feedback (US2)', () => {
  const openString6 = (page: Page) =>
    page.getByRole('gridcell', { name: 'E, string 6, open', exact: true });

  test.beforeEach(async ({ page }) => {
    await page.clock.install();
    await page.goto('/notes');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
  });

  test('a tapped position pulses until the 1.5 s end mark (US2-1)', async ({ page }) => {
    await openString6(page).click();
    const pulse = page.locator('.marker.pulse[data-key="6:0"]');
    await expect(pulse).toHaveCount(1);
    await page.clock.runFor(1500);
    await expect(page.locator('.marker.pulse')).toHaveCount(0);
  });

  test('still pulses after muting (US2-2)', async ({ page }) => {
    await page.getByRole('button', { name: 'Mute sound' }).click();
    await openString6(page).click();
    await expect(page.locator('.marker.pulse')).toHaveCount(1);
  });

  test('reduced motion: highlighted with no running animation (US2-3)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openString6(page).click();
    const marker = page.locator('.marker.pulse[data-key="6:0"]');
    await expect(marker).toHaveClass(/highlighted/);
    const animations = await marker.evaluate(
      (el) => el.querySelector('.shape')?.getAnimations().length
    );
    expect(animations).toBe(0);
  });

  test('an empty position shows a transient neutral marker (US2-4)', async ({ page }) => {
    expect(await page.locator('.marker[data-key="6:0"]').count()).toBe(0);
    await openString6(page).click();
    const marker = page.locator('.marker[data-key="6:0"]');
    await expect(marker).toHaveClass(/neutral/);
    await expect(marker).toHaveClass(/highlighted/);
    await page.clock.runFor(1500);
    await expect(page.locator('.marker[data-key="6:0"]')).toHaveCount(0);
  });
});

test.describe('sound control (US3)', () => {
  test('mute then click logs a silent step and still pulses', async ({ page }) => {
    await page.clock.install();
    await page.goto('/notes');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await page.getByRole('button', { name: 'Mute sound' }).click();
    await cellAt(page, 6, 0).click();
    await expect.poll(async () => (await stepEntries(page)).length).toBe(1);
    const step = (await stepEntries(page))[0];
    if (step?.type !== 'step') throw new Error('no step entry');
    expect(step.gain).toBe(0);
    await expect(page.locator('.marker.pulse')).toHaveCount(1);
  });

  test('settings last for the session only (US3-4)', async ({ page }) => {
    await page.goto('/notes');
    await page.getByRole('button', { name: 'Sound settings' }).click();
    await page.getByRole('slider', { name: 'Volume' }).fill('40');
    await page.getByRole('button', { name: 'Mute sound' }).click();
    await expect(page.getByRole('button', { name: 'Mute sound' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await page.reload();
    await expect(page.getByRole('button', { name: 'Mute sound' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    await page.getByRole('button', { name: 'Sound settings' }).click();
    await expect(page.getByRole('slider', { name: 'Volume' })).toHaveValue('80');
  });

  for (const path of ['/', '/about', '/notes', '/triads']) {
    test(`control is present with 44×44 targets and no page scroll on ${path}`, async ({
      page
    }) => {
      await page.goto(path);
      const group = page.getByRole('group', { name: 'Sound' });
      await expect(group).toBeVisible();
      for (const name of ['Mute sound', 'Sound settings']) {
        const box = await group.getByRole('button', { name }).boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }
      await expectNoHorizontalScroll(page);
    });
  }

  test('axe: zero violations with the panel open (SC-009)', async ({ page }) => {
    await page.goto('/notes');
    await page.getByRole('button', { name: 'Sound settings' }).click();
    await expect(page.getByRole('slider', { name: 'Volume' })).toBeVisible();
    await runAxe(page);
  });

  test('keyboard: Escape closes the panel and focuses the settings button', async ({ page }) => {
    await page.goto('/about');
    const settings = page.getByRole('button', { name: 'Sound settings' });
    await settings.focus();
    await page.keyboard.press('Enter');
    await expect(settings).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(settings).toHaveAttribute('aria-expanded', 'false');
    await expect(settings).toBeFocused();
  });

  test('grayscale: on / muted states are distinguishable without color', async ({ page }) => {
    await page.goto('/about');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.addStyleTag({ content: 'html { filter: grayscale(1); }' });
    const group = page.getByRole('group', { name: 'Sound' });
    await expect(group).toHaveScreenshot('sound-control-on.png');
    await page.getByRole('button', { name: 'Mute sound' }).click();
    await expect(group).toHaveScreenshot('sound-control-muted.png');
  });
});

test.describe('interruption, stop, and hidden app (US4)', () => {
  async function stops(page: Page) {
    return (await readAudioLog(page)).filter((e) => e.type === 'stop');
  }

  test.beforeEach(async ({ page }) => {
    await page.clock.install();
    await page.goto('/notes');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
  });

  test('three rapid taps: two interrupt stops and one live pulse (US4-1, SC-004)', async ({
    page
  }) => {
    await cellAt(page, 6, 0).click();
    await cellAt(page, 5, 3).click();
    await cellAt(page, 4, 2).click();
    await expect.poll(async () => (await stops(page)).length).toBe(2);
    for (const e of await stops(page)) {
      if (e.type !== 'stop') throw new Error('not a stop');
      expect(e.reason).toBe('interrupt');
    }
    await expect(page.locator('.marker.pulse')).toHaveCount(1);
  });

  test('hiding the page stops playback; returning does not resume (US4-3, SC-006)', async ({
    page
  }) => {
    await cellAt(page, 6, 0).click();
    await expect.poll(async () => (await stepEntries(page)).length).toBe(1);
    const hide = (state: 'hidden' | 'visible') =>
      page.evaluate((s) => {
        Object.defineProperty(document, 'visibilityState', { value: s, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      }, state);
    await hide('hidden');
    const entries = await stops(page);
    expect(entries).toHaveLength(1);
    if (entries[0]?.type !== 'stop') throw new Error('not a stop');
    expect(entries[0].reason).toBe('hidden');
    await expect(page.locator('.marker.pulse')).toHaveCount(0);
    await hide('visible');
    await page.clock.runFor(3000);
    expect(await stepEntries(page)).toHaveLength(1);
    await expect(page.locator('.marker.pulse')).toHaveCount(0);
  });

  test('navigating via the app nav stops playback (US4-4)', async ({ page }) => {
    await cellAt(page, 6, 0).click();
    await expect.poll(async () => (await stepEntries(page)).length).toBe(1);
    await page
      .getByRole('link', { name: /triads/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/triads$/);
    const entries = await stops(page);
    expect(entries).toHaveLength(1);
    if (entries[0]?.type !== 'stop') throw new Error('not a stop');
    expect(entries[0].reason).toBe('navigate');
  });

  test('no Stop button for a single note', async ({ page }) => {
    await cellAt(page, 6, 0).click();
    await expect(page.getByRole('button', { name: 'Stop' })).toHaveCount(0);
  });
});

test.describe('graceful failure when sound is unavailable (US5)', () => {
  const NOTICE = 'Sound is not available on this device right now';

  for (const cause of ['context', 'synth'] as const) {
    test(`'${cause}' fault: one notice, unavailable control, pulses, no retry (US5-1/2/4, SC-005)`, async ({
      page
    }) => {
      await injectAudioFault(page, cause);
      await page.clock.install();
      await page.goto('/notes');
      await page.getByRole('grid', { name: 'Fretboard' }).waitFor();

      await cellAt(page, 6, 0).click();
      await expect(page.getByText(NOTICE)).toHaveCount(1);
      await expect(page.locator('.marker.pulse')).toHaveCount(1);
      await expect(page.getByRole('button', { name: 'Sound unavailable' })).toHaveAttribute(
        'aria-disabled',
        'true'
      );

      await page.clock.runFor(1500);
      await cellAt(page, 5, 3).click();
      await expect(page.locator('.marker.pulse')).toHaveCount(1);
      await expect(page.getByText(NOTICE)).toHaveCount(1);

      const log = await readAudioLog(page);
      expect(log.filter((e) => e.type === 'unavailable')).toHaveLength(1);
      expect(log.filter((e) => e.type === 'step')).toHaveLength(0);
    });
  }

  test('dismiss removes the notice for good and focuses the mute button (US5-3)', async ({
    page
  }) => {
    await injectAudioFault(page, 'context');
    await page.goto('/notes');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await cellAt(page, 6, 0).click();
    await expect(page.getByText(NOTICE)).toBeVisible();
    await page.getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.getByText(NOTICE)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sound unavailable' })).toBeFocused();
    await cellAt(page, 5, 3).click();
    await expect(page.getByText(NOTICE)).toHaveCount(0);
  });

  test('notice is at most two lines at 320 px', async ({ page }) => {
    await injectAudioFault(page, 'context');
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/notes');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await cellAt(page, 6, 0).click();
    const text = page.getByText(NOTICE);
    await expect(text).toBeVisible();
    const { height, lineHeight } = await text.evaluate((el) => ({
      height: el.getBoundingClientRect().height,
      lineHeight: parseFloat(getComputedStyle(el).lineHeight)
    }));
    expect(height).toBeLessThanOrEqual(2 * lineHeight + 1);
    await expectNoHorizontalScroll(page);
  });

  test('axe: zero violations with the notice visible (SC-009)', async ({ page }) => {
    await injectAudioFault(page, 'context');
    await page.goto('/notes');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await cellAt(page, 6, 0).click();
    await expect(page.getByText(NOTICE)).toBeVisible();
    await runAxe(page);
  });

  test('offline after load: a tap still sounds (FR-016, SC-008)', async ({ page, context }) => {
    await page.goto('/notes');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await context.setOffline(true);
    await cellAt(page, 6, 0).click();
    await expect.poll(async () => (await stepEntries(page)).length).toBe(1);
    await expect(page.getByText(NOTICE)).toHaveCount(0);
  });
});
