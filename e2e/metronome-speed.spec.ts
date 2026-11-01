import { expect, test, type Page } from '@playwright/test';

import { expectNoTruncationOrOverlap, readAudioLog, runAxe, setTextScale } from './support/helpers';

async function clicks(page: Page) {
  return (await readAudioLog(page)).flatMap((e) => (e.type === 'click' ? [e] : []));
}

const FAST = {
  startBpm: 290,
  targetBpm: 300,
  increment: 5,
  loops: 1,
  beats: 1,
  countIn: true,
  initialCountIn: 1,
  repeatCountIn: 1,
  atTarget: 'hold' as 'hold' | 'stop'
};

type Speed = typeof FAST;

const row = (page: Page, id: string) => page.locator(`#metronome-${id}`);

/** Open the Speed Training tab and set every row through the controls (no seeded storage). */
async function configure(page: Page, speed: Partial<Speed> = {}): Promise<void> {
  const s = { ...FAST, ...speed };
  await page.goto('/metronome');
  await page.getByRole('tab', { name: 'Speed Training', exact: true }).click();
  await expect(page.locator('section.panel')).toHaveAttribute('data-mode', 'speed');
  // Start first: raising it lifts Target, which is then set explicitly.
  await row(page, 'start-bpm').fill(String(s.startBpm));
  await row(page, 'target-bpm').fill(String(s.targetBpm));
  await row(page, 'increment').fill(String(s.increment));
  await row(page, 'loops').fill(String(s.loops));
  await row(page, 'beats').fill(String(s.beats));
  const sw = page.getByRole('switch', { name: /Count In/ });
  if ((await sw.getAttribute('aria-checked')) !== String(s.countIn)) await sw.click();
  if (s.countIn) {
    await row(page, 'initial-count-in').fill(String(s.initialCountIn));
    await row(page, 'repeat-count-in').fill(String(s.repeatCountIn));
  }
  await page.getByRole('radio', { name: s.atTarget === 'stop' ? 'Stop' : 'Hold' }).check();
}

test.describe('Speed Training run (037 US1)', () => {
  test('6, 8: the tempo steps at each boundary, and the status follows the run', async ({
    page
  }) => {
    await configure(page);
    await expect(page.getByRole('tab', { name: 'Speed Training', exact: true })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    const seen: string[] = [];
    await page.getByRole('button', { name: 'Start Training', exact: true }).click();
    await expect
      .poll(
        async () => {
          const text = ((await page.locator('.position').textContent()) ?? '')
            .trim()
            .replace(/\s+/g, ' ');
          if (seen[seen.length - 1] !== text) seen.push(text);
          return (await clicks(page)).length >= 8 && seen.includes('STEP 3/3 · LOOP 1/1');
        },
        { timeout: 15_000, intervals: [10] }
      )
      .toBe(true);
    const log = await clicks(page);
    // Each interval is spaced at the tempo of the click that starts it, so the boundary
    // count-in click still sounds at the old tempo.
    const expected = [290, 290, 290, 295, 295, 300, 300].map((bpm) => 60 / bpm);
    for (let i = 0; i < expected.length; i++) {
      expect(Math.abs(log[i + 1].when - log[i].when - expected[i]), `interval ${i}`).toBeLessThan(
        0.002
      );
    }
    for (const status of ['STEP 1/3 · LOOP 1/1', 'STEP 2/3 · LOOP 1/1', 'STEP 3/3 · LOOP 1/1']) {
      expect(seen, status).toContain(status);
    }
    expect(seen.some((t) => t.startsWith('COUNT IN 1/1'))).toBe(true);
    await expect(page.locator('.digits')).toHaveText('300');
  });
});

test.describe('Speed Training at target (037 US2)', () => {
  const live = (page: Page) => page.locator('section.panel [role="status"]');

  test('9: Hold keeps clicking at the target tempo with no count-in', async ({ page }) => {
    await configure(page);
    await page.getByRole('button', { name: 'Start Training', exact: true }).click();
    await expect(page.locator('.position')).toHaveText(/STEP 3\/3\s*·\s*HOLD/, {
      timeout: 15_000
    });
    await expect(live(page)).toHaveText('Holding at 300 BPM');
    await expect
      .poll(async () => (await clicks(page)).length, { timeout: 15_000 })
      .toBeGreaterThan(9);
    const log = await clicks(page);
    // Everything after the last step's single beat is spaced at 60/300 with no count-in.
    const tail = log.slice(-4);
    for (let i = 0; i < tail.length - 1; i++) {
      expect(Math.abs(tail[i + 1].when - tail[i].when - 60 / 300)).toBeLessThan(0.002);
    }
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await expect(live(page)).toHaveText('Holding at 300 BPM');
  });

  test('10: Stop returns to settings one beat after the last beat', async ({ page }) => {
    await configure(page, { atTarget: 'stop' });
    await page.getByRole('button', { name: 'Start Training', exact: true }).click();
    const start = page.getByRole('button', { name: 'Start Training', exact: true });
    await expect(start).toBeVisible({ timeout: 15_000 });
    await expect(start).toBeFocused();
    await expect(live(page)).toHaveText('Finished at 300 BPM');
    const count = (await clicks(page)).length;
    // 1 count-in + 3 steps of one beat + 2 repeat count-ins.
    expect(count).toBe(1 + 3 + 2);
    await page.waitForTimeout(1000);
    expect((await clicks(page)).length).toBe(count);
    // The values are unchanged.
    await expect(page.getByRole('radio', { name: 'Stop' })).toBeChecked();
  });

  test('11: Start = Target is a single step', async ({ page }) => {
    await configure(page, { startBpm: 300, targetBpm: 300, countIn: false });
    await page.getByRole('button', { name: 'Start Training', exact: true }).click();
    await expect(page.locator('.position')).toHaveText(/STEP 1\/1/);
    await expect(page.locator('.position')).toHaveText(/STEP 1\/1\s*·\s*HOLD/, {
      timeout: 5_000
    });
  });
});

test.describe('Speed Training settings (037 US3)', () => {
  const panel = (page: Page) => page.locator('section.panel');
  const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });
  const start = (page: Page) => page.getByRole('button', { name: 'Start Training', exact: true });

  async function openSpeed(page: Page): Promise<void> {
    await page.goto('/metronome');
    await tab(page, 'Speed Training').click();
    await expect(panel(page)).toHaveAttribute('data-mode', 'speed');
  }

  test('1: three tabs; arrows, Home, End and Enter work from the keyboard', async ({ page }) => {
    await page.goto('/metronome');
    await expect(page.getByRole('tab')).toHaveText([
      /Metronome/,
      /Speed Training/,
      /Ratios Training/
    ]);
    await tab(page, 'Metronome').focus();
    await page.keyboard.press('ArrowRight');
    await expect(tab(page, 'Speed Training')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(tab(page, 'Ratios Training')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(tab(page, 'Metronome')).toBeFocused();
    await page.keyboard.press('End');
    await expect(tab(page, 'Ratios Training')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(tab(page, 'Metronome')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(tab(page, 'Speed Training')).toHaveAttribute('aria-selected', 'true');
    await expect(panel(page)).toHaveAttribute('data-mode', 'speed');
  });

  test('2: first-use defaults, with no BPM, ratio or Loop rows', async ({ page }) => {
    await openSpeed(page);
    await expect(row(page, 'start-bpm')).toHaveValue('85');
    await expect(row(page, 'target-bpm')).toHaveValue('125');
    await expect(row(page, 'increment')).toHaveValue('5');
    await expect(row(page, 'loops')).toHaveValue('4');
    await expect(row(page, 'beats')).toHaveValue('4');
    await expect(page.getByRole('switch', { name: /Count In/ })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    await expect(row(page, 'initial-count-in')).toHaveValue('4');
    await expect(row(page, 'repeat-count-in')).toHaveValue('2');
    await expect(page.getByRole('radio', { name: 'Hold' })).toBeChecked();
    await expect(page.locator('#metronome-bpm')).toHaveCount(0);
    await expect(page.getByText('Loop 1')).toHaveCount(0);
    await expect(page.getByText('Loop 2')).toHaveCount(0);
    await expect(page.getByRole('switch', { name: /ratio/i })).toHaveCount(0);
    await expect(start(page)).toBeVisible();
  });

  test('3: Target never goes below Start; a higher Start lifts it', async ({ page }) => {
    await openSpeed(page);
    const minus = page.getByRole('button', { name: 'Decrease target BPM' });
    await row(page, 'target-bpm').fill('60');
    await expect(row(page, 'target-bpm')).toHaveValue('85');
    await expect(
      page.locator('#metronome-target-bpm').locator('xpath=..').locator('output')
    ).toHaveText('85');
    await expect(minus).toBeDisabled();
    await row(page, 'start-bpm').fill('130');
    await expect(row(page, 'target-bpm')).toHaveValue('130');
    await row(page, 'start-bpm').fill('100');
    await expect(row(page, 'target-bpm')).toHaveValue('130');
    await expect(minus).toBeEnabled();
  });

  test('5: Count In off hides the Initial and Repeat rows and a run starts at STEP 1', async ({
    page
  }) => {
    await openSpeed(page);
    await page.getByRole('switch', { name: /Count In/ }).click();
    await expect(row(page, 'initial-count-in')).toHaveCount(0);
    await expect(row(page, 'repeat-count-in')).toHaveCount(0);
    await start(page).click();
    await expect(page.locator('.position')).toHaveText(/STEP 1\/9\s*·\s*LOOP 1\/4/);
  });

  test('14: the climb settings are remembered across a reload; Erase returns the defaults', async ({
    page
  }) => {
    await openSpeed(page);
    await row(page, 'start-bpm').fill('80');
    await row(page, 'target-bpm').fill('120');
    await page.getByRole('radio', { name: 'Stop' }).check();
    await page.reload();
    await expect(tab(page, 'Speed Training')).toHaveAttribute('aria-selected', 'true');
    await expect(row(page, 'start-bpm')).toHaveValue('80');
    await expect(row(page, 'target-bpm')).toHaveValue('120');
    await expect(page.getByRole('radio', { name: 'Stop' })).toBeChecked();
    await page.goto('/about');
    await page.getByRole('button', { name: 'Erase my preferences' }).click();
    await page.getByRole('button', { name: 'Erase', exact: true }).click();
    await page.goto('/metronome');
    await expect(tab(page, 'Ratios Training')).toHaveAttribute('aria-selected', 'true');
    await tab(page, 'Speed Training').click();
    await expect(row(page, 'start-bpm')).toHaveValue('85');
    await expect(page.getByRole('radio', { name: 'Hold' })).toBeChecked();
  });
});

test.describe('Speed Training pause, resume and reset (037 US4)', () => {
  const live = (page: Page) => page.locator('section.panel [role="status"]');
  const start = (page: Page) => page.getByRole('button', { name: 'Start Training', exact: true });
  // Slow enough (0.6 s per click) to pause inside a chosen step.
  const SLOW = { startBpm: 100, targetBpm: 110, atTarget: 'stop' as const };

  async function runToStep2(page: Page): Promise<void> {
    await configure(page, SLOW);
    await start(page).click();
    await expect(page.locator('.position')).toHaveText(/STEP 2\/3\s*·\s*LOOP 1\/1/, {
      timeout: 10_000
    });
  }

  test('12: pause announces the position; resume adds no count-in', async ({ page }) => {
    await runToStep2(page);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(live(page)).toHaveText('Paused, step 2 of 3, loop 1 of 1, beat 1 of 1');
    const paused = (await clicks(page)).length;
    await page.waitForTimeout(1200);
    expect((await clicks(page)).length).toBe(paused);
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(live(page)).toHaveText('Resumed');
    // The next click is the step-2/3 boundary repeat count-in, never a fresh initial count-in.
    await expect(page.locator('.position')).toHaveText(/STEP 3\/3/, { timeout: 10_000 });
    await expect(start(page)).toBeVisible({ timeout: 10_000 });
    // Clicks scheduled ahead at the pause are cancelled and replayed. After the cancel there
    // are only the remaining slots (repeat count-in, step 3 beat): no new initial count-in.
    const log = await readAudioLog(page);
    const afterPause = log.slice(log.findIndex((e) => e.type === 'click-cancel') + 1);
    expect(afterPause.filter((e) => e.type === 'click')).toHaveLength(2);
  });

  test('12: Reset and Escape return to settings; the next Start begins at step 1; Space toggles', async ({
    page
  }) => {
    await runToStep2(page);
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(start(page)).toBeVisible();
    const afterReset = (await clicks(page)).length;
    await page.waitForTimeout(1000);
    expect((await clicks(page)).length).toBe(afterReset);
    await start(page).click();
    await expect(page.locator('.position')).toHaveText(/STEP 1\/3\s*·\s*LOOP 1\/1/);
    await page.keyboard.press('Escape');
    await expect(start(page)).toBeVisible();
    // Space activates the focused main button: start, pause, resume.
    await start(page).focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeFocused();
    await expect(page.locator('.position')).toHaveText(/STEP 1\/3/);
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeFocused();
  });

  test('13: selecting Metronome mid-run stops the click; Speed values are unchanged', async ({
    page
  }) => {
    await runToStep2(page);
    await page.getByRole('tab', { name: 'Metronome', exact: true }).click();
    const n = (await clicks(page)).length;
    await page.waitForTimeout(1200);
    expect((await clicks(page)).length).toBe(n);
    await page.getByRole('tab', { name: 'Speed Training', exact: true }).click();
    await expect(start(page)).toBeVisible();
    await expect(row(page, 'start-bpm')).toHaveValue('100');
    await expect(row(page, 'target-bpm')).toHaveValue('110');
    await expect(page.getByRole('radio', { name: 'Stop' })).toBeChecked();
  });
});

test.describe('Speed Training accessibility and reflow (037 SC-006)', () => {
  const panel = (page: Page) => page.locator('section.panel');
  const LANGS = [
    { tag: 'en', locale: 'en-US' },
    { tag: 'pt-BR', locale: 'pt-BR' },
    { tag: 'es', locale: 'es-ES' }
  ] as const;

  /** Open Speed Training by position (the label is localised) and make a Hold reachable fast. */
  async function openSpeedShort(page: Page): Promise<void> {
    await page.goto('/metronome');
    await page.getByRole('tab').nth(1).click();
    await expect(panel(page)).toHaveAttribute('data-mode', 'speed');
    await row(page, 'start-bpm').fill('290');
    await row(page, 'target-bpm').fill('300');
    await row(page, 'increment').fill('5');
    await row(page, 'loops').fill('1');
    await row(page, 'beats').fill('1');
    await row(page, 'initial-count-in').fill('1');
    await row(page, 'repeat-count-in').fill('1');
  }

  async function toHold(page: Page): Promise<void> {
    await page.locator('button.start').click();
    await expect(panel(page)).toHaveAttribute('data-phase', 'running');
    await expect(page.locator('.position')).toHaveText(/STEP 3\/3\s*·|3\/3\s*·/, {
      timeout: 15_000
    });
    await expect(page.locator('.position')).not.toHaveText(/LOOP|BUCLE/i);
  }

  async function expectReflow(page: Page): Promise<void> {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    ).toBe(true);
    await expectNoTruncationOrOverlap(page);
  }

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`16: settings, running and Hold are axe-clean in ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await openSpeedShort(page);
      await runAxe(page);
      await toHold(page);
      await runAxe(page);
    });
  }

  test('16: every control works by keyboard', async ({ page }) => {
    await openSpeedShort(page);
    await row(page, 'start-bpm').focus();
    await page.keyboard.press('ArrowRight');
    await expect(row(page, 'start-bpm')).toHaveValue('291');
    await page.keyboard.press('Home');
    await expect(row(page, 'start-bpm')).not.toHaveValue('291');
    const sw = page.getByRole('switch').first();
    await sw.focus();
    await page.keyboard.press('Space');
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Space');
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    const radios = page.getByRole('radio');
    await radios.nth(0).focus();
    await page.keyboard.press('ArrowRight');
    await expect(radios.nth(1)).toBeChecked();
    await page.keyboard.press('ArrowLeft');
    await expect(radios.nth(0)).toBeChecked();
    await page.locator('button.start').focus();
    await page.keyboard.press('Enter');
    await expect(panel(page)).toHaveAttribute('data-phase', 'running');
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveAttribute('data-phase', 'settings');
  });

  for (const { tag, locale } of LANGS) {
    test.describe(`reflow in ${tag}`, () => {
      test.use({ locale });

      for (const [width, height] of [
        [1024, 768],
        [2560, 1200],
        [375, 800],
        [320, 700]
      ] as const) {
        test(`${width} px: settings, running and Hold`, async ({ page }) => {
          await page.setViewportSize({ width, height });
          await openSpeedShort(page);
          await expect(page.locator('html')).toHaveAttribute('lang', tag);
          await expectReflow(page);
          await toHold(page);
          await expectReflow(page);
        });
      }

      test('320 px at 200 % text zoom', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 700 });
        await openSpeedShort(page);
        await setTextScale(page, 200);
        await expectReflow(page);
        await toHold(page);
        await expectReflow(page);
      });
    });
  }
});
