import { readFileSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { expectNoHorizontalScroll, readAudioLog, runAxe } from './support/helpers';

const KEY = 'fretboard-master:prefs';
const LANGUAGES = ['en', 'pt-BR', 'es'] as const;

const catalog = (tag: string): Record<string, string> =>
  JSON.parse(readFileSync(`messages/${tag}.json`, 'utf8')) as Record<string, string>;

const card = (page: Page) => page.locator('section.panel');
const tapButton = (page: Page) => page.locator('button.tap');
const live = (page: Page) => page.locator('.panel [role="status"][aria-live="polite"].sr-only');
const subSelect = (page: Page) => page.locator('#metronome-plain-subdivision');
const position = async (page: Page): Promise<string> =>
  ((await page.locator('.position').textContent()) ?? '').trim().replace(/\s+/g, ' ');

/** Plain mode with the fake clock installed before navigation (taps are timed by the page clock). */
async function openPlain(page: Page): Promise<void> {
  await page.clock.install({ time: 0 });
  await page.goto('/metronome');
  await page.getByRole('tab', { name: 'Metronome', exact: true }).click();
  await expect(card(page)).toHaveAttribute('data-mode', 'plain');
  // Frozen from here: only `runFor` moves page time, so tap gaps are exact.
  await page.clock.pauseAt(1000);
}

/** Advance page time in small steps until `done` holds (the audio clock itself is real). */
async function runUntil(page: Page, done: () => Promise<boolean>): Promise<void> {
  for (let i = 0; i < 400; i++) {
    if (await done()) return;
    await page.clock.runFor(50);
    await page.waitForTimeout(20);
  }
  expect(await done()).toBe(true);
}

/** Tap `n` times on `tap`, with `gap` ms of page time between taps. */
async function tapN(page: Page, n: number, tap: () => Promise<void>, gap = 500): Promise<void> {
  for (let i = 0; i < n; i++) {
    if (i > 0) await page.clock.runFor(gap);
    await tap();
  }
}

const clickTap = (page: Page) => () => tapButton(page).first().click();

const storedPlainBpm = (page: Page): Promise<number | null> =>
  page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    return raw ? ((JSON.parse(raw).metronome?.plain?.bpm as number | undefined) ?? null) : null;
  }, KEY);

test.describe('tap tempo (038 US1)', () => {
  test('1: four taps 500 ms apart set 120, announce it and store it', async ({ page }) => {
    await openPlain(page);
    await expect(tapButton(page)).toHaveAccessibleName('85 BPM, tap tempo');
    await tapN(page, 4, clickTap(page));
    await expect(tapButton(page)).toHaveText('120');
    await expect(tapButton(page)).toHaveAccessibleName('120 BPM, tap tempo');
    await expect(page.getByRole('slider', { name: 'BPM' })).toHaveValue('120');
    await expect(live(page)).toHaveText('120 BPM');
    await expect.poll(() => storedPlainBpm(page)).toBe(120);
  });

  test('2: three taps change nothing', async ({ page }) => {
    await openPlain(page);
    await tapN(page, 3, clickTap(page));
    await expect(tapButton(page)).toHaveText('85');
    await expect(live(page)).toHaveText('');
    expect(await storedPlainBpm(page)).toBeNull();
  });

  test('3: four taps 100 ms apart give 300', async ({ page }) => {
    await openPlain(page);
    await tapN(page, 4, clickTap(page), 100);
    await expect(tapButton(page)).toHaveText('300');
  });

  test('4: a gap over 2 s starts a new run', async ({ page }) => {
    await openPlain(page);
    await tapN(page, 2, clickTap(page));
    await page.clock.runFor(2100);
    await tapN(page, 3, clickTap(page));
    await expect(tapButton(page)).toHaveText('85');
    await page.clock.runFor(500);
    await clickTap(page)();
    await expect(tapButton(page)).toHaveText('120');
  });

  test('6: a live tap retimes the running loop without restarting it', async ({ page }) => {
    await openPlain(page);
    await page.getByRole('switch', { name: 'Count In' }).click();
    await page.getByRole('slider', { name: '# of Beats' }).fill('16');
    await page.getByRole('slider', { name: 'BPM' }).fill('100');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await runUntil(page, async () => (await card(page).getAttribute('data-phase')) === 'running');
    await runUntil(page, async () => /BEAT [2-9]\/16/.test(await position(page)));
    await tapN(page, 4, clickTap(page));
    await expect(tapButton(page)).toHaveText('120 BPM');
    await expect(card(page)).toHaveAttribute('data-phase', 'running');
    await expect(card(page)).toHaveAttribute('data-mode', 'plain');
    const seen = new Set<string>();
    await runUntil(page, async () => {
      seen.add(await position(page));
      return seen.size > 2;
    });
    expect(seen.has('BEAT 1/16')).toBe(false);
    const cancels = (await readAudioLog(page)).filter(
      (e) => e.type === 'click-cancel' && e.reason === 'retime'
    );
    expect(cancels.length).toBeGreaterThan(0);
  });

  test('7: pressing T four times sets the tempo', async ({ page }) => {
    await openPlain(page);
    await tapN(page, 4, () => page.keyboard.press('t'));
    await expect(tapButton(page)).toHaveText('120');
  });

  test('8: with shortcuts off T does nothing, the button still taps', async ({ page }) => {
    await openPlain(page);
    await page.goto('/about');
    await page.getByRole('switch', { name: 'Keyboard shortcuts' }).uncheck();
    await page.goto('/metronome');
    await expect(card(page)).toHaveAttribute('data-mode', 'plain');
    await tapN(page, 4, () => page.keyboard.press('t'));
    await expect(tapButton(page)).toHaveText('85');
    await tapN(page, 4, clickTap(page));
    await expect(tapButton(page)).toHaveText('120');
  });

  test('10: taps while paused apply on Resume', async ({ page }) => {
    await openPlain(page);
    await page.getByRole('switch', { name: 'Count In' }).click();
    await page.getByRole('slider', { name: '# of Beats' }).fill('16');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await runUntil(page, async () => (await card(page).getAttribute('data-phase')) === 'running');
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(card(page)).toHaveAttribute('data-phase', 'paused');
    await tapN(page, 4, clickTap(page));
    await expect(card(page)).toHaveAttribute('data-phase', 'paused');
    await expect(tapButton(page)).toHaveText('120 BPM');
    await page.getByRole('button', { name: 'Resume' }).click();
    await expect(card(page)).toHaveAttribute('data-phase', /starting|running/);
    await expect(tapButton(page)).toHaveText('120 BPM');
  });

  test('12: Space and Enter on the focused tap button tap, Space never starts', async ({
    page
  }) => {
    await openPlain(page);
    await tapButton(page).focus();
    await tapN(page, 4, () => page.keyboard.press('Space'));
    await expect(card(page)).toHaveAttribute('data-phase', 'settings');
    await expect(tapButton(page)).toHaveText('120');
    await page.clock.runFor(3000);
    await tapN(page, 4, () => page.keyboard.press('Enter'), 250);
    await expect(card(page)).toHaveAttribute('data-phase', 'settings');
    await expect(tapButton(page)).toHaveText('240');
  });

  test('22: About lists the T key', async ({ page }) => {
    await page.goto('/about');
    const section = page.getByRole('region', { name: 'Keyboard shortcuts' });
    await expect(section.locator('kbd', { hasText: /^T$/ })).toBeVisible();
    await expect(section.getByText('Tap tempo (Metronome mode)', { exact: true })).toBeVisible();
  });
});

type Click = Extract<Awaited<ReturnType<typeof readAudioLog>>[number], { type: 'click' }>;
const clicksOf = async (page: Page): Promise<Click[]> =>
  (await readAudioLog(page)).flatMap((e) => (e.type === 'click' ? [e] : []));

async function openPlainReal(page: Page): Promise<void> {
  await page.goto('/metronome');
  await page.getByRole('tab', { name: 'Metronome', exact: true }).click();
  await expect(card(page)).toHaveAttribute('data-mode', 'plain');
}

test.describe('subdivision (038 US2)', () => {
  test('13: Triplets at 90 BPM show SUB 3 and click accent, sub, sub per beat', async ({
    page
  }) => {
    test.setTimeout(30_000);
    await openPlainReal(page);
    await page.getByRole('switch', { name: 'Count In' }).click();
    await page.getByRole('slider', { name: 'BPM' }).fill('90');
    await subSelect(page).selectOption('3');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect
      .poll(async () => (await clicksOf(page)).length, { timeout: 10_000 })
      .toBeGreaterThanOrEqual(9);
    await expect(page.locator('.position')).toContainText(/BEAT \d\/4\s*·\s*SUB 3/);
    const clicks = await clicksOf(page);
    const beat = 60 / 90;
    clicks.slice(0, 9).forEach((c, i) => {
      expect(c.kind).toBe(i % 3 === 0 ? (i === 0 ? 'accent' : 'normal') : 'sub');
      expect(Math.abs(c.when - clicks[0].when - (i * beat) / 3)).toBeLessThan(0.01);
    });
  });

  test('14: 8ths and 16ths show SUB 2 and SUB 4; Quarter shows no SUB', async ({ page }) => {
    test.setTimeout(30_000);
    await openPlainReal(page);
    await page.getByRole('switch', { name: 'Count In' }).click();
    for (const [value, expected] of [
      ['2', /SUB 2/],
      ['4', /SUB 4/]
    ] as const) {
      await subSelect(page).selectOption(value);
      await page.getByRole('button', { name: 'Start', exact: true }).click();
      await expect(page.locator('.position')).toContainText(expected);
      await page.getByRole('button', { name: 'Reset' }).click();
      await expect(card(page)).toHaveAttribute('data-phase', 'settings');
    }
    await subSelect(page).selectOption('1');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.locator('.position')).toContainText(/BEAT \d\/4/);
    expect(await position(page)).not.toContain('SUB');
  });
});

for (const tag of LANGUAGES) {
  test.describe(`tap tempo layout and a11y in ${tag} (038, row 23)`, () => {
    test.use({ locale: tag, viewport: { width: 320, height: 800 } });

    test('settings, running and About fit, are axe-clean and the tap target is large enough', async ({
      page
    }) => {
      const cat = catalog(tag);
      await page.goto('/metronome');
      await page.getByRole('tab', { name: cat.metronome_mode_plain, exact: true }).click();
      await expect(card(page)).toHaveAttribute('data-mode', 'plain');
      const name = cat.metronome_tap_name.replace('{bpm}', '85');
      await expect(tapButton(page)).toHaveAccessibleName(name);
      await expect(
        page.getByLabel(cat.metronome_plain_subdivision_label, { exact: true })
      ).toBeVisible();
      await expect(tapButton(page)).toHaveAttribute('title', cat.metronome_tap_title);
      const box = await tapButton(page).boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
      await expectNoHorizontalScroll(page);
      await runAxe(page);

      await page.getByRole('button', { name: cat.metronome_start_plain, exact: true }).click();
      await expect(card(page)).toHaveAttribute('data-phase', /starting|running/);
      await expect(tapButton(page)).toHaveAccessibleName(name);
      await expectNoHorizontalScroll(page);
      await runAxe(page);

      await page.goto('/about');
      await expect(page.getByText(cat.shortcuts_metronome_tap, { exact: true })).toBeVisible();
      await expectNoHorizontalScroll(page);
      await runAxe(page);
    });
  });
}
