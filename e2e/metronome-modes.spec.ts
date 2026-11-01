import { expect, test, type Page } from '@playwright/test';

import { readAudioLog, runAxe } from './support/helpers';

async function clicks(page: Page) {
  return (await readAudioLog(page)).flatMap((e) => (e.type === 'click' ? [e] : []));
}

const card = (page: Page) => page.locator('section.panel');
const start = (page: Page) => page.getByRole('button', { name: 'Start', exact: true });

async function openPlain(page: Page): Promise<void> {
  await page.goto('/metronome');
  await page.getByRole('tab', { name: 'Metronome', exact: true }).click();
  await expect(card(page)).toHaveAttribute('data-mode', 'plain');
}

test.describe('plain Metronome (036 US1)', () => {
  test('2: settings view shows BPM, beats, count in and a Start button only', async ({ page }) => {
    await openPlain(page);
    const panel = page.getByRole('tabpanel', { name: 'Metronome' });
    await expect(panel.getByRole('slider', { name: 'BPM' })).toHaveValue('85');
    await expect(panel.getByRole('slider', { name: '# of Beats' })).toHaveValue('4');
    await expect(panel.getByRole('switch', { name: 'Count In' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    await expect(panel.getByRole('slider', { name: 'Initial Count In' })).toHaveValue('4');
    await expect(start(page)).toBeVisible();
    await expect(panel.getByRole('slider', { name: 'Repeat Count In' })).toHaveCount(0);
    await expect(panel.getByText('Loop 1')).toHaveCount(0);
    await expect(panel.getByText('Loop 2')).toHaveCount(0);
    await expect(panel.getByRole('switch', { name: /ratio/i })).toHaveCount(0);
  });

  test('3: 100 BPM, 3 beats: four count-in clicks, then one click per beat, beat 1 accented', async ({
    page
  }) => {
    await openPlain(page);
    await page.getByRole('slider', { name: 'BPM' }).fill('100');
    await page.getByRole('slider', { name: '# of Beats' }).fill('3');
    const seen: string[] = [];
    await start(page).click();
    await expect
      .poll(
        async () => {
          const text = ((await page.locator('.position').textContent()) ?? '')
            .trim()
            .replace(/\s+/g, ' ');
          if (seen[seen.length - 1] !== text) seen.push(text);
          return (await clicks(page)).length;
        },
        { timeout: 15_000, intervals: [15] }
      )
      .toBeGreaterThanOrEqual(10);
    const log = await clicks(page);
    const countIn = log.slice(0, 4);
    expect(countIn.map((c) => c.countIn)).toEqual([1, 2, 3, 4]);
    const T = 60 / 100;
    for (let i = 1; i < log.length; i++) {
      expect(Math.abs(log[i].when - log[i - 1].when - T)).toBeLessThan(0.003);
    }
    const loop = log.slice(4, 10);
    expect(loop.every((c) => c.countIn === null)).toBe(true);
    expect(loop.map((c) => c.kind)).toEqual([
      'accent',
      'normal',
      'normal',
      'accent',
      'normal',
      'normal'
    ]);
    expect(seen.some((t) => t.startsWith('COUNT IN 1/4'))).toBe(true);
    expect(seen.some((t) => /^BEAT 1\/3$/.test(t))).toBe(true);
    expect(seen.some((t) => t.includes('SUB'))).toBe(false);
    await expect(page.locator('.dot')).toHaveCount(3);
  });

  test('4: Space pauses and resumes, Escape resets keeping 100/3', async ({ page }) => {
    await openPlain(page);
    await page.getByRole('slider', { name: 'BPM' }).fill('100');
    await page.getByRole('slider', { name: '# of Beats' }).fill('3');
    await page.keyboard.press('Space');
    await expect(card(page)).toHaveAttribute('data-phase', 'running');
    await page.keyboard.press('Space');
    await expect(card(page)).toHaveAttribute('data-phase', 'paused');
    await page.keyboard.press('Space');
    await expect(card(page)).toHaveAttribute('data-phase', /starting|running/);
    await page.keyboard.press('Escape');
    await expect(card(page)).toHaveAttribute('data-phase', 'settings');
    await expect(page.getByRole('slider', { name: 'BPM' })).toHaveValue('100');
    await expect(page.getByRole('slider', { name: '# of Beats' })).toHaveValue('3');
  });

  test('14: one beat: every click is accented and a single dot is lit', async ({ page }) => {
    await openPlain(page);
    await page.getByRole('slider', { name: 'BPM' }).fill('300');
    await page.getByRole('slider', { name: '# of Beats' }).fill('1');
    await page.getByRole('switch', { name: 'Count In' }).click();
    await start(page).click();
    await expect.poll(async () => (await clicks(page)).length).toBeGreaterThanOrEqual(4);
    const log = await clicks(page);
    expect(log.slice(0, 4).every((c) => c.kind === 'accent')).toBe(true);
    await expect(page.locator('.dot')).toHaveCount(1);
    await expect(page.locator('.dot')).toHaveAttribute('data-state', 'lit');
  });
});

const KEY = 'fretboard-master:prefs';
const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });
const slider = (page: Page, name: string) => page.getByRole('slider', { name });
const stored = (page: Page) => page.evaluate((k) => localStorage.getItem(k), KEY);

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

/** Stop means: nothing further is scheduled once the switch has happened. */
async function expectSilent(page: Page): Promise<void> {
  const after = (await clicks(page)).length;
  await page.waitForTimeout(900);
  expect((await clicks(page)).length).toBe(after);
}

test.describe('mode tabs: structure (036 US2)', () => {
  test('1: tab bar first, three equal-width tabs in order, Ratios selected', async ({ page }) => {
    await page.goto('/metronome');
    const tabs = page.getByRole('tablist');
    await expect(tabs).toBeVisible();
    const first = await card(page)
      .locator('> *')
      .first()
      .evaluate((el) => el.getAttribute('role'));
    expect(first).toBe('tablist');
    await expect(page.getByRole('tab')).toHaveText([
      /Metronome/,
      /Speed Training/,
      /Ratios Training/
    ]);
    await expect(tab(page, 'Ratios Training')).toHaveAttribute('aria-selected', 'true');
    await expect(tab(page, 'Metronome')).toHaveAttribute('aria-selected', 'false');
    const widths = await Promise.all(
      ['Metronome', 'Speed Training', 'Ratios Training'].map(
        async (n) => (await tab(page, n).boundingBox())?.width ?? 0
      )
    );
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1.5);
  });
});

test.describe('switching stops playback (036 US3)', () => {
  test('5: Ratios running → Metronome stops the sound; back keeps the Ratios values', async ({
    page
  }) => {
    await page.goto('/metronome');
    await slider(page, 'BPM').fill('120');
    await page.getByRole('button', { name: 'Start Training' }).click();
    await expect.poll(async () => (await clicks(page)).length).toBeGreaterThanOrEqual(2);
    await tab(page, 'Metronome').click();
    await expect(card(page)).toHaveAttribute('data-phase', 'settings');
    await expect(card(page)).toHaveAttribute('data-mode', 'plain');
    await expect(start(page)).toBeVisible();
    await expectSilent(page);
    await tab(page, 'Ratios Training').click();
    await expect(slider(page, 'BPM')).toHaveValue('120');
  });

  test('6: switching in the count-in and while paused stops; next Start begins at COUNT IN –/4', async ({
    page
  }) => {
    await openPlain(page);
    await start(page).click();
    await expect(page.locator('.position')).toContainText('COUNT IN');
    await tab(page, 'Ratios Training').click();
    await expect(card(page)).toHaveAttribute('data-phase', 'settings');
    await expectSilent(page);
    await tab(page, 'Metronome').click();
    await start(page).click();
    await expect.poll(async () => (await clicks(page)).length).toBeGreaterThanOrEqual(2);
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(card(page)).toHaveAttribute('data-phase', 'paused');
    await tab(page, 'Ratios Training').click();
    await expect(card(page)).toHaveAttribute('data-phase', 'settings');
    await expectSilent(page);
    await tab(page, 'Metronome').click();
    await start(page).click();
    await expect(page.locator('.position')).toContainText('COUNT IN –/4');
  });

  test('7: clicking the active tab while running keeps it running', async ({ page }) => {
    await openPlain(page);
    await start(page).click();
    await expect(card(page)).toHaveAttribute('data-phase', 'running');
    await tab(page, 'Metronome').click();
    await expect(card(page)).toHaveAttribute('data-phase', 'running');
    await expect.poll(async () => (await clicks(page)).length).toBeGreaterThanOrEqual(3);
  });

  test('8: arrows, Home and End move focus only; Enter selects and stops; Space selects without pausing', async ({
    page
  }) => {
    await openPlain(page);
    await start(page).click();
    await expect(card(page)).toHaveAttribute('data-phase', 'running');
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
    await page.keyboard.press('ArrowLeft');
    await expect(tab(page, 'Ratios Training')).toBeFocused();
    await expect(tab(page, 'Metronome')).toHaveAttribute('aria-selected', 'true');
    await expect(card(page)).toHaveAttribute('data-phase', 'running');
    await page.keyboard.press('Enter');
    await expect(tab(page, 'Ratios Training')).toHaveAttribute('aria-selected', 'true');
    await expect(card(page)).toHaveAttribute('data-phase', 'settings');
    await page.getByRole('button', { name: 'Start Training' }).click();
    await expect(card(page)).toHaveAttribute('data-phase', /starting|running/);
    await tab(page, 'Metronome').focus();
    await page.keyboard.press('Space');
    await expect(tab(page, 'Metronome')).toHaveAttribute('aria-selected', 'true');
    await expect(card(page)).toHaveAttribute('data-phase', 'settings');
  });

  test('9: each mode keeps its values and the last tab reopens after a reload', async ({
    page
  }) => {
    await page.goto('/metronome');
    await slider(page, 'BPM').fill('120');
    await tab(page, 'Metronome').click();
    await slider(page, 'BPM').fill('100');
    await slider(page, '# of Beats').fill('3');
    await tab(page, 'Ratios Training').click();
    await expect(slider(page, 'BPM')).toHaveValue('120');
    await tab(page, 'Metronome').click();
    await expect(slider(page, 'BPM')).toHaveValue('100');
    await expect(slider(page, '# of Beats')).toHaveValue('3');
    await expect.poll(() => stored(page)).toContain('"mode":"plain"');
    await page.reload();
    await expect(tab(page, 'Metronome')).toHaveAttribute('aria-selected', 'true');
    await expect(slider(page, 'BPM')).toHaveValue('100');
    await expect(slider(page, '# of Beats')).toHaveValue('3');
    await tab(page, 'Ratios Training').click();
    await expect(slider(page, 'BPM')).toHaveValue('120');
    await expect.poll(() => stored(page)).not.toContain('"mode"');
    await page.reload();
    await expect(tab(page, 'Ratios Training')).toHaveAttribute('aria-selected', 'true');
  });

  test('10: an unknown stored mode and an out-of-range plain BPM fall back individually', async ({
    page
  }) => {
    await seed(page, {
      version: 1,
      metronome: {
        ratios: { bpm: 120 },
        plain: { bpm: 999, beats: 3 },
        mode: 'bogus'
      }
    });
    await page.goto('/metronome');
    await expect(tab(page, 'Ratios Training')).toHaveAttribute('aria-selected', 'true');
    await expect(slider(page, 'BPM')).toHaveValue('120');
    await tab(page, 'Metronome').click();
    await expect(slider(page, 'BPM')).toHaveValue('85');
    await expect(slider(page, '# of Beats')).toHaveValue('3');
  });

  test('11: Erase preferences returns to Ratios with both modes at defaults', async ({ page }) => {
    await openPlain(page);
    await slider(page, 'BPM').fill('100');
    await tab(page, 'Ratios Training').click();
    await slider(page, 'BPM').fill('120');
    await tab(page, 'Metronome').click();
    await expect.poll(() => stored(page)).toContain('"mode":"plain"');
    await page.goto('/about');
    await page.locator('#privacy').getByRole('button', { name: 'Erase my preferences' }).click();
    await page.getByRole('button', { name: 'Erase', exact: true }).click();
    await expect(page).toHaveURL('/');
    await page
      .getByRole('link', { name: /^Metronome/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/metronome/);
    await expect(tab(page, 'Ratios Training')).toHaveAttribute('aria-selected', 'true');
    await expect(slider(page, 'BPM')).toHaveValue('85');
    await tab(page, 'Metronome').click();
    await expect(slider(page, 'BPM')).toHaveValue('85');
  });
});

const LANGS = [
  { tag: 'en', locale: 'en-US' },
  { tag: 'pt-BR', locale: 'pt-BR' },
  { tag: 'es', locale: 'es-ES' }
] as const;

test.describe('tab bar across widths and languages (036 #12)', () => {
  for (const { tag, locale } of LANGS) {
    test.describe(`in ${tag}`, () => {
      test.use({ locale });

      for (const width of [375, 320]) {
        test(`${width} px: icons hidden, labels whole, no horizontal scroll`, async ({ page }) => {
          await page.setViewportSize({ width, height: 700 });
          await page.goto('/metronome');
          await expect(page.locator('html')).toHaveAttribute('lang', tag);
          const tabs = page.getByRole('tab');
          await expect(tabs).toHaveCount(3);
          await expect(page.locator('.tab-icon')).toHaveCount(3);
          for (const icon of await page.locator('.tab-icon').all()) {
            await expect(icon).not.toBeVisible();
          }
          const boxes: { x: number; right: number }[] = [];
          for (const t of await tabs.all()) {
            await expect(t).toBeVisible();
            const fits = await t.evaluate((el) => {
              const label = el.querySelector('.tab-label') ?? el;
              const style = getComputedStyle(label);
              return (
                style.textOverflow !== 'ellipsis' &&
                label.scrollWidth <= label.clientWidth + 1 &&
                el.scrollWidth <= el.clientWidth + 1
              );
            });
            expect(fits).toBe(true);
            const b = await t.boundingBox();
            boxes.push({ x: b?.x ?? 0, right: (b?.x ?? 0) + (b?.width ?? 0) });
          }
          expect(boxes[0].right).toBeLessThanOrEqual(boxes[1].x + 1);
          expect(boxes[1].right).toBeLessThanOrEqual(boxes[2].x + 1);
          expect(boxes[2].right).toBeLessThanOrEqual(width);
          const overflow = await page.evaluate(
            () => (document.scrollingElement?.scrollWidth ?? 0) - window.innerWidth
          );
          expect(overflow).toBeLessThanOrEqual(0);
        });
      }

      test('1024 px: icons are visible', async ({ page }) => {
        await page.setViewportSize({ width: 1024, height: 768 });
        await page.goto('/metronome');
        for (const icon of await page.locator('.tab-icon').all()) {
          await expect(icon).toBeVisible();
        }
      });
    });
  }

  for (const width of [1024, 375]) {
    test(`accessible names at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      await page.goto('/metronome');
      await expect(tab(page, 'Metronome')).toBeVisible();
      await expect(tab(page, 'Ratios Training')).toBeVisible();
    });
  }
});

test.describe('modes are axe-clean (036 #13)', () => {
  test('settings, running and paused views in both modes', async ({ page }) => {
    await page.goto('/metronome');
    await runAxe(page);
    await page.getByRole('button', { name: 'Start Training' }).click();
    await expect(card(page)).toHaveAttribute('data-phase', /starting|running/);
    await runAxe(page);
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(card(page)).toHaveAttribute('data-phase', 'paused');
    await runAxe(page);

    await tab(page, 'Metronome').click();
    await expect(card(page)).toHaveAttribute('data-phase', 'settings');
    await runAxe(page);
    await start(page).click();
    await expect(card(page)).toHaveAttribute('data-phase', /starting|running/);
    await runAxe(page);
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(card(page)).toHaveAttribute('data-phase', 'paused');
    await runAxe(page);
  });
});
