import { expect, test, type Page } from '@playwright/test';

import { countInOff, injectAudioFault, injectFault, readAudioLog } from './support/helpers';

async function clicks(page: Page) {
  return (await readAudioLog(page)).flatMap((e) => (e.type === 'click' ? [e] : []));
}

const panel = (page: Page) => page.getByRole('region', { name: 'Ratios Training' });
const start = (page: Page) => page.getByRole('button', { name: 'Start Training' });

test.describe('metronome: steady click (US1)', () => {
  test('US1-1: home → Metronome → Start gives an accented 4-beat click with synced dots', async ({
    page
  }) => {
    await page.goto('/');
    await page
      .getByRole('link', { name: /Metronome/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/metronome$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Metronome' })).toBeVisible();
    await countInOff(page);
    await start(page).click(); // click 2 of 2 on the way to a running click (SC-005)
    await expect(panel(page)).toHaveAttribute('data-phase', 'running');
    await expect(page.locator('.dot')).toHaveCount(4);
    await expect(page.locator('.digits')).toHaveText('85');
    // The status steps through every beat.
    const seen = new Set<string>();
    await expect
      .poll(
        async () => {
          seen.add(((await page.locator('.position').textContent()) ?? '').trim());
          return seen.size;
        },
        { timeout: 10_000, intervals: [50] }
      )
      .toBeGreaterThanOrEqual(4);
    expect([...seen]).toEqual(
      expect.arrayContaining([
        'BEAT 1/4 · SUB 3',
        'BEAT 2/4 · SUB 3',
        'BEAT 3/4 · SUB 3',
        'BEAT 4/4 · SUB 3'
      ])
    );
    await expect.poll(async () => (await clicks(page)).length).toBeGreaterThanOrEqual(5);
    for (const c of (await clicks(page)).filter((e) => e.kind !== 'sub'))
      expect(c.accent).toBe(c.beat === 1);
    expect(
      new Set(
        (await clicks(page))
          .filter((c) => c.kind !== 'sub')
          .slice(0, 4)
          .map((c) => c.beat)
      ).size
    ).toBe(4);
  });

  test('US1-2: with 2 beats the status reads BEAT n/2', async ({ page }) => {
    await page.goto('/metronome');
    await page.getByRole('slider', { name: '# of Beats' }).fill('2');
    await countInOff(page);
    await start(page).click();
    await expect(page.locator('.position')).toHaveText(/BEAT [12]\/2 · SUB 3/);
  });

  test('US1-4: the first click carries the press time and never precedes the context time', async ({
    page
  }) => {
    await page.goto('/metronome');
    await countInOff(page);
    await start(page).click();
    await expect.poll(async () => (await clicks(page)).length).toBeGreaterThan(0);
    const [first] = await clicks(page);
    expect(first.pressedAtMs).not.toBeNull();
    expect(first.when).toBeGreaterThanOrEqual(first.contextTime);
    expect(first.index).toBe(0);
  });

  test('US1-5: a hidden tab keeps clicking in order and the run stays running', async ({
    page
  }) => {
    await page.goto('/metronome');
    await countInOff(page);
    await start(page).click();
    await expect.poll(async () => (await clicks(page)).length).toBeGreaterThan(0);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const before = (await clicks(page)).length;
    await expect
      .poll(async () => (await clicks(page)).length, { timeout: 15_000 })
      .toBeGreaterThanOrEqual(before + 4);
    const idx = (await clicks(page)).map((c) => c.index);
    expect(idx).toEqual(idx.map((_, i) => i));
    await expect(panel(page)).toHaveAttribute('data-phase', 'running');
    expect((await readAudioLog(page)).filter((e) => e.type === 'click-cancel')).toEqual([]);
  });

  test('FR-018: muting mid-run keeps the status stepping', async ({ page }) => {
    await page.goto('/metronome');
    await countInOff(page);
    await start(page).click();
    await expect(panel(page)).toHaveAttribute('data-phase', 'running');
    await page.getByRole('button', { name: /Mute sound/ }).click();
    const first = (await page.locator('.position').textContent())?.trim();
    await expect
      .poll(async () => ((await page.locator('.position').textContent()) ?? '').trim(), {
        timeout: 10_000,
        intervals: [50]
      })
      .not.toBe(first);
    await expect(panel(page)).toHaveAttribute('data-phase', 'running');
  });

  test('FR-027: with no audio the dots still step and a dismissible notice shows', async ({
    page
  }) => {
    await injectAudioFault(page, 'context');
    await page.goto('/metronome');
    await countInOff(page);
    await start(page).click();
    const notice = page.getByText('Sound is unavailable; the beat is shown visually.');
    await expect(notice).toBeVisible();
    await expect(page.locator('.dot[data-state="lit"]')).toHaveCount(1);
    await expect(page.locator('.position')).toHaveText(/BEAT [1-4]\/4 · SUB 3/);
    await panel(page).getByRole('button', { name: 'Dismiss' }).click();
    await expect(notice).toHaveCount(0);
  });

  test('C X: a render fault shows the failure view, the bar stays operable, Reset recovers', async ({
    page
  }) => {
    await injectFault(page, 'metronome', 1);
    const logs: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('[fretboard-master] failure')) logs.push(msg.text());
    });
    await page.goto('/metronome');
    const region = page.getByRole('region', { name: 'Tool error' });
    await expect(region).toContainText('Something went wrong in this view');
    await expect(page.getByRole('navigation', { name: 'Tools' })).toBeVisible();
    expect(logs.length).toBeGreaterThan(0);
    await region.getByRole('button', { name: 'Reset tool' }).click();
    await expect(start(page)).toBeVisible();
    await expect(panel(page)).toHaveAttribute('data-phase', 'settings');
  });
});

const pause = (page: Page) => page.getByRole('button', { name: 'Pause', exact: true });
const resume = (page: Page) => page.getByRole('button', { name: 'Resume', exact: true });
const reset = (page: Page) => page.getByRole('button', { name: 'Reset', exact: true });

async function shownBeat(page: Page): Promise<number> {
  const text = ((await page.locator('.position').textContent()) ?? '').trim();
  return Number(/BEAT (\d+)\//.exec(text)?.[1] ?? 0);
}

test.describe('metronome: pause, resume and reset (US2)', () => {
  test('US2-1/2: pause freezes on the shown beat; resume continues with the next one', async ({
    page
  }) => {
    await page.goto('/metronome');
    await countInOff(page);
    await start(page).click();
    await expect(page.locator('.position')).toHaveText('BEAT 3/4 · SUB 3', { timeout: 10_000 });
    await pause(page).click();
    await expect(panel(page)).toHaveAttribute('data-phase', 'paused');
    const frozen = await shownBeat(page);
    const frozenCount = (await clicks(page)).length;
    // The scheduled clicks were cancelled, and nothing new is scheduled while paused.
    await page.waitForTimeout(1500);
    expect((await clicks(page)).length).toBe(frozenCount);
    expect(await shownBeat(page)).toBe(frozen);
    expect((await readAudioLog(page)).some((e) => e.type === 'click-cancel')).toBe(true);

    await resume(page).click();
    await expect(panel(page)).toHaveAttribute('data-phase', /starting|running/);
    await expect.poll(async () => (await clicks(page)).length).toBeGreaterThan(frozenCount);
    const after = (await clicks(page)).slice(frozenCount);
    expect(after[0].beat).toBe((frozen % 4) + 1);
    expect(after[0].pressedAtMs).not.toBeNull();
    const beatClicks = async () =>
      (await clicks(page)).slice(frozenCount).filter((c) => c.kind !== 'sub');
    await expect.poll(async () => (await beatClicks()).length).toBeGreaterThan(1);
    const next = (await beatClicks())[1];
    expect(next.beat).toBe(((frozen + 1) % 4) + 1);
    expect(next.accent).toBe(next.beat === 1);
  });

  test('US2-3: Reset returns to the settings view with the values kept', async ({ page }) => {
    await page.goto('/metronome');
    await countInOff(page);
    await start(page).click();
    await expect(panel(page)).toHaveAttribute('data-phase', 'running');
    await reset(page).click();
    await expect(panel(page)).toHaveAttribute('data-phase', 'settings');
    await expect(start(page)).toBeFocused();
    await countInOff(page);
    await start(page).click();
    await expect(page.locator('.digits')).toHaveText('85');
    await expect(page.locator('.dot')).toHaveCount(4);
  });

  test('US2-4: Space toggles start, pause and resume; Esc resets; Esc in settings does nothing', async ({
    page
  }) => {
    await page.goto('/metronome');
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveAttribute('data-phase', 'settings');
    await page.keyboard.press('Space');
    await expect(panel(page)).toHaveAttribute('data-phase', /starting|running/);
    await expect(panel(page)).toHaveAttribute('data-phase', 'running');
    // Focus is on the main button: Space is exactly one toggle, not two.
    await expect(pause(page)).toBeFocused();
    await page.keyboard.press('Space');
    await expect(panel(page)).toHaveAttribute('data-phase', 'paused');
    await expect(resume(page)).toBeFocused();
    await page.keyboard.press('Space');
    await expect(panel(page)).toHaveAttribute('data-phase', /starting|running/);
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveAttribute('data-phase', 'settings');
    await expect(start(page)).toBeFocused();
  });

  test('FR-017: leaving the page halts the run and the tool comes back at 85/4', async ({
    page
  }) => {
    await page.goto('/metronome');
    await countInOff(page);
    await start(page).click();
    await expect(panel(page)).toHaveAttribute('data-phase', 'running');
    await page.getByRole('link', { name: 'Fretboard Notes', exact: true }).first().click();
    await expect(page).toHaveURL(/\/notes/);
    await page.getByRole('link', { name: 'Metronome', exact: true }).first().click();
    await expect(panel(page)).toHaveAttribute('data-phase', 'settings');
    expect(
      (await readAudioLog(page)).some((e) => e.type === 'click-cancel' && e.reason === 'leave')
    ).toBe(true);
    await countInOff(page);
    await start(page).click();
    await expect(page.locator('.digits')).toHaveText('85');
    await expect(page.locator('.dot')).toHaveCount(4);
  });

  test('FR-023/024: no Share, tuning badge, Stop or instrument button; P, L, N do nothing', async ({
    page
  }) => {
    await page.goto('/metronome');
    await expect(page.getByRole('button', { name: /Share/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Stop/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /instrument/i })).toHaveCount(0);
    await expect(page.locator('.tuning-badge, [data-tuning-badge]')).toHaveCount(0);
    for (const k of ['p', 'l', 'n', '.', ',']) await page.keyboard.press(k);
    await expect(panel(page)).toHaveAttribute('data-phase', 'settings');
    expect(await clicks(page)).toEqual([]);
  });

  test('FR-028: ten rapid Space presses never log a duplicate (run, index)', async ({ page }) => {
    await page.goto('/metronome');
    await page.waitForLoadState('networkidle'); // hydrated before the first key
    await page.keyboard.press('Space');
    await expect(panel(page)).toHaveAttribute('data-phase', 'running');
    for (let i = 0; i < 10; i++) await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    const keys = (await clicks(page)).map((c) => `${c.run}:${c.index}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

const bpmSlider = (page: Page) => page.getByRole('slider', { name: 'BPM' });
const beatsSlider = (page: Page) => page.getByRole('slider', { name: '# of Beats' });

test.describe('metronome: tempo and beats (US3)', () => {
  test('US3-1/2: defaults 85/4; limits; slider and pill in sync; Home/End', async ({ page }) => {
    await page.goto('/metronome');
    await expect(bpmSlider(page)).toHaveValue('85');
    await expect(beatsSlider(page)).toHaveValue('4');
    await bpmSlider(page).focus();
    await page.keyboard.press('End');
    await expect(bpmSlider(page)).toHaveValue('300');
    await expect(page.getByRole('button', { name: 'Increase BPM' })).toBeDisabled();
    await expect(page.locator('output').first()).toHaveText('300');
    await page.keyboard.press('Home');
    await expect(bpmSlider(page)).toHaveValue('30');
    await expect(page.getByRole('button', { name: 'Decrease BPM' })).toBeDisabled();
    await page.getByRole('button', { name: 'Increase BPM' }).click();
    await expect(bpmSlider(page)).toHaveValue('31');
    await expect(page.locator('output').first()).toHaveText('31');
    await beatsSlider(page).focus();
    await page.keyboard.press('End');
    await expect(page.getByRole('button', { name: 'More beats' })).toBeDisabled();
    await page.keyboard.press('Home');
    await expect(page.getByRole('button', { name: 'Fewer beats' })).toBeDisabled();
    await page.keyboard.press('PageUp');
    await expect(beatsSlider(page)).toHaveValue('11');
  });

  test('US3: chosen values show in the running view', async ({ page }) => {
    await page.goto('/metronome');
    await bpmSlider(page).fill('120');
    await beatsSlider(page).fill('6');
    await countInOff(page);
    await start(page).click();
    await expect(page.locator('.digits')).toHaveText('120');
    await expect(page.locator('.dot')).toHaveCount(6);
  });

  for (const [width, height] of [
    [1024, 768],
    [2560, 1200],
    [320, 700]
  ] as const) {
    test(`US3-3: layout at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/metronome');
      const pill = page.locator('.pill').first();
      const box = await pill.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(96);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
        )
      ).toBe(true);
      await expect(start(page)).toBeVisible();
    });
  }

  test('US3-3: pt-BR at 200 % text zoom still reflows at 320 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('/metronome');
    await page.evaluate(() => {
      document.documentElement.lang = 'pt-BR';
      document.documentElement.style.fontSize = '200%';
    });
    const box = await page.locator('.pill').first().boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(96);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    ).toBe(true);
  });

  test('metronome views', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/metronome');
      await expect(panel(page)).toHaveScreenshot(`metronome-settings-${scheme}.png`, {
        animations: 'disabled'
      });
      await start(page).click();
      await expect(panel(page)).toHaveAttribute('data-phase', 'running');
      const mask = [page.locator('.position'), page.locator('.dots')];
      await expect(panel(page)).toHaveScreenshot(`metronome-running-${scheme}.png`, {
        animations: 'disabled',
        mask
      });
      await pause(page).click();
      await expect(panel(page)).toHaveAttribute('data-phase', 'paused');
      await expect(panel(page)).toHaveScreenshot(`metronome-paused-${scheme}.png`, {
        animations: 'disabled',
        mask
      });
    }
  });
});
