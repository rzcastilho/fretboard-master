import { expect, test, type Page } from '@playwright/test';

import { countInOff, ratioOff, readAudioLog } from './support/helpers';

async function clicks(page: Page) {
  return (await readAudioLog(page)).flatMap((e) => (e.type === 'click' ? [e] : []));
}

const start = (page: Page) => page.getByRole('button', { name: 'Start Training' });
const T = 60 / 85;

test.describe('metronome count-in: hear it (US1)', () => {
  test('2.1: four accented clicks one beat apart, then the loop one beat later', async ({
    page
  }) => {
    await page.goto('/metronome');
    const seen: string[] = [];
    await start(page).click();
    await expect
      .poll(
        async () => {
          const text = (await page.locator('.position').textContent())?.trim() ?? '';
          const key = text.replace(/\s+/g, ' ');
          if (seen[seen.length - 1] !== key) seen.push(key);
          return seen.some((t) => t.startsWith('BEAT 1/4'));
        },
        { timeout: 10_000, intervals: [15] }
      )
      .toBe(true);
    const log = await clicks(page);
    const countIn = log.slice(0, 4);
    expect(countIn.map((c) => c.countIn)).toEqual([1, 2, 3, 4]);
    expect(countIn.every((c) => c.kind === 'accent')).toBe(true);
    for (let i = 1; i < 4; i++) {
      expect(Math.abs(countIn[i].when - countIn[i - 1].when - T)).toBeLessThan(0.002);
    }
    const first = countIn[0];
    expect(first.pressedAtMs).not.toBeNull();
    const loop = log[4];
    expect(loop.countIn).toBeNull();
    expect(loop.slot).toBe(4);
    expect(loop.kind).toBe('accent');
    expect(Math.abs(loop.when - countIn[3].when - T)).toBeLessThan(0.002);
    const texts = seen.filter((t) => t.startsWith('COUNT IN') && !t.includes('–'));
    expect(texts).toEqual(['COUNT IN 1/4', 'COUNT IN 2/4', 'COUNT IN 3/4', 'COUNT IN 4/4']);
    expect(seen.some((s) => s.startsWith('BEAT 1/4 · SUB 3'))).toBe(true);
  });

  test('2.2: one dot during the count-in, four after', async ({ page }) => {
    await page.goto('/metronome');
    await start(page).click();
    await expect(page.locator('.position')).toContainText('COUNT IN');
    await expect(page.locator('.dot')).toHaveCount(1);
    await expect(page.locator('.position')).toContainText('BEAT', { timeout: 8000 });
    await expect(page.locator('.dot')).toHaveCount(4);
  });

  test('2.3: reduced motion removes the pulse and keeps the lit state', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/metronome');
    await start(page).click();
    const dot = page.locator('.dot');
    await expect(dot).toHaveAttribute('data-state', 'lit');
    expect(await dot.evaluate((e) => getComputedStyle(e).animationName)).toBe('none');
  });

  test('2.15: 300 BPM with eight clicks stays on a 200 ms grid', async ({ page }) => {
    await page.goto('/metronome');
    await page.getByRole('slider', { name: 'BPM' }).fill('300');
    // The Initial Count In slider arrives with US2; until then the default 4 clicks are checked.
    const slider = page.getByRole('slider', { name: 'Initial Count In' });
    const n = (await slider.count()) > 0 ? 8 : 4;
    if (n === 8) await slider.fill('8');
    await start(page).click();
    await expect.poll(async () => (await clicks(page)).length).toBeGreaterThanOrEqual(n + 1);
    const log = await clicks(page);
    expect(log.slice(0, n).map((c) => c.countIn)).toEqual(
      Array.from({ length: n }, (_, i) => i + 1)
    );
    for (let i = 1; i <= n; i++) {
      expect(Math.abs(log[i].when - log[i - 1].when - 0.2)).toBeLessThan(0.002);
    }
  });
});

test.describe('metronome count-in: switch and length (US2)', () => {
  test('2.5: switch off removes the rows and Start goes straight to beat 1', async ({ page }) => {
    await page.goto('/metronome');
    await ratioOff(page);
    await expect(page.getByRole('slider')).toHaveCount(4);
    await countInOff(page);
    await expect(page.getByRole('slider')).toHaveCount(2);
    await expect(page.getByRole('slider', { name: 'Initial Count In' })).toHaveCount(0);
    await page.getByRole('switch', { name: 'Count In' }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('switch', { name: 'Subdivision ratio' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('combobox')).toBeFocused();
    await start(page).click();
    await expect(page.locator('.position')).toContainText('BEAT 1/4', { timeout: 5000 });
    const log = await clicks(page);
    expect(log.every((c) => c.countIn === null)).toBe(true);
  });

  test('2.6: keyboard only: arrows, Home/End, −/+ and Space on the switch', async ({ page }) => {
    await page.goto('/metronome');
    const initial = page.getByRole('slider', { name: 'Initial Count In' });
    await initial.focus();
    await page.keyboard.press('ArrowRight');
    await expect(initial).toHaveValue('5');
    await page.keyboard.press('End');
    await expect(initial).toHaveValue('8');
    await expect(page.getByRole('button', { name: 'More initial count-in clicks' })).toBeDisabled();
    await page.keyboard.press('Home');
    await expect(initial).toHaveValue('0');
    await expect(
      page.getByRole('button', { name: 'Fewer initial count-in clicks' })
    ).toBeDisabled();
    await page.getByRole('button', { name: 'More repeat count-in clicks' }).click();
    await expect(page.getByRole('slider', { name: 'Repeat Count In' })).toHaveValue('3');
    const sw = page.getByRole('switch', { name: 'Count In' });
    await sw.focus();
    await page.keyboard.press('Space');
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await expect(start(page)).toBeVisible();
    await page.keyboard.press('Space');
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await expect(start(page)).toBeVisible();
  });

  test('2.4: Initial Count In 0 starts straight on beat 1', async ({ page }) => {
    await page.goto('/metronome');
    await page.getByRole('slider', { name: 'Initial Count In' }).fill('0');
    await start(page).click();
    await expect(page.locator('.position')).toContainText('BEAT 1/4', { timeout: 5000 });
    await expect(page.locator('.position')).not.toContainText('COUNT IN');
    const log = await clicks(page);
    expect(log[0].countIn).toBeNull();
    expect(log.every((c) => c.countIn === null)).toBe(true);
  });

  test('2.7: off then on keeps the values', async ({ page }) => {
    await page.goto('/metronome');
    await page.getByRole('slider', { name: 'Initial Count In' }).fill('6');
    await page.getByRole('slider', { name: 'Repeat Count In' }).fill('3');
    const sw = page.getByRole('switch', { name: 'Count In' });
    await sw.click();
    await sw.click();
    await expect(page.getByRole('slider', { name: 'Initial Count In' })).toHaveValue('6');
    await expect(page.getByRole('slider', { name: 'Repeat Count In' })).toHaveValue('3');
  });
});

test.describe('metronome count-in: pause, resume, reset (US3)', () => {
  const pause = (page: Page) => page.getByRole('button', { name: 'Pause', exact: true });
  const resume = (page: Page) => page.getByRole('button', { name: 'Resume', exact: true });
  const reset = (page: Page) => page.getByRole('button', { name: 'Reset', exact: true });

  test('2.8: pause after COUNT IN 2/4 freezes; resume plays clicks 3 and 4, then the loop', async ({
    page
  }) => {
    await page.goto('/metronome');
    await start(page).click();
    await expect(page.locator('.position')).toContainText('COUNT IN 2/4', { timeout: 5000 });
    await pause(page).click();
    await expect(resume(page)).toBeVisible();
    const frozenText = (await page.locator('.position').textContent())?.replace(/\s+/g, ' ');
    expect(frozenText).toContain('COUNT IN 2/4');
    const before = (await clicks(page)).filter((c) => c.countIn !== null).length;
    await page.waitForTimeout(1500);
    expect((await page.locator('.position').textContent())?.replace(/\s+/g, ' ')).toBe(frozenText);
    expect((await clicks(page)).filter((c) => c.countIn !== null).length).toBe(before);

    const sinceResume = (await readAudioLog(page)).length;
    await resume(page).click();
    await expect(page.locator('.position')).toContainText('BEAT 1/4', { timeout: 8000 });
    const after = (await readAudioLog(page))
      .slice(sinceResume)
      .flatMap((e) => (e.type === 'click' ? [e] : []));
    const counted = after.filter((c) => c.countIn !== null).map((c) => c.countIn);
    expect(counted).toEqual([3, 4]);
    const loop = after.find((c) => c.countIn === null);
    const last = after.filter((c) => c.countIn !== null).pop();
    if (!loop || !last) throw new Error('missing loop or last count-in click');
    expect(Math.abs(loop.when - last.when - T)).toBeLessThan(0.002);
  });

  test('2.9: pause in the loop then resume plays no count-in', async ({ page }) => {
    await page.goto('/metronome');
    await ratioOff(page);
    await start(page).click();
    await expect(page.locator('.position')).toContainText('BEAT', { timeout: 8000 });
    await pause(page).click();
    const since = (await readAudioLog(page)).length;
    await resume(page).click();
    await expect.poll(async () => (await clicks(page)).length).toBeGreaterThan(since);
    await page.waitForTimeout(800);
    const after = (await readAudioLog(page))
      .slice(since)
      .flatMap((e) => (e.type === 'click' ? [e] : []));
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((c) => c.countIn === null)).toBe(true);
  });

  test('2.10: reset mid-count-in keeps the settings; the next Start counts in fully', async ({
    page
  }) => {
    await page.goto('/metronome');
    await page.getByRole('slider', { name: 'Initial Count In' }).fill('3');
    await start(page).click();
    await expect(page.locator('.position')).toContainText('COUNT IN 1/3', { timeout: 5000 });
    await reset(page).click();
    await expect(page.getByRole('switch', { name: 'Count In' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    await expect(page.getByRole('slider', { name: 'Initial Count In' })).toHaveValue('3');
    await expect(page.getByRole('slider', { name: 'Repeat Count In' })).toHaveValue('2');
    const since = (await readAudioLog(page)).length;
    await start(page).click();
    await expect(page.locator('.position')).toContainText('BEAT 1/4', { timeout: 8000 });
    const run = (await readAudioLog(page))
      .slice(since)
      .flatMap((e) => (e.type === 'click' ? [e] : []));
    expect(run.filter((c) => c.countIn !== null).map((c) => c.countIn)).toEqual([1, 2, 3]);
  });
});

test.describe('metronome count-in: repeat value (US4)', () => {
  test('2.11: Repeat Count In 6 survives Start and Reset with no extra count-in clicks', async ({
    page
  }) => {
    await page.goto('/metronome');
    await page.getByRole('slider', { name: 'Repeat Count In' }).fill('6');
    await expect(page.getByRole('slider', { name: 'Repeat Count In' })).toHaveValue('6');
    const since = (await readAudioLog(page)).length;
    await start(page).click();
    await expect(page.locator('.position')).toContainText('BEAT 2/4', { timeout: 10000 });
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(page.getByRole('slider', { name: 'Repeat Count In' })).toHaveValue('6');
    const run = (await readAudioLog(page))
      .slice(since)
      .flatMap((e) => (e.type === 'click' ? [e] : []));
    expect(run.filter((c) => c.countIn !== null).map((c) => c.countIn)).toEqual([1, 2, 3, 4]);
  });
});

test.describe('metronome count-in: announcements, languages, reflow (polish)', () => {
  test('2.12: live-region texts, no per-click announcements', async ({ page }) => {
    await page.goto('/metronome');
    const live = page.locator('[role="status"][aria-live="polite"].sr-only');
    await ratioOff(page);
    await start(page).click();
    await expect(live).toHaveText('Started, 85 BPM, 4 beats, 8th Triplets, count in 4');
    const seen = await page.evaluate(
      () =>
        new Promise<string[]>((resolve) => {
          const el = document.querySelector(
            '[role="status"][aria-live="polite"].sr-only'
          ) as HTMLElement;
          const texts = [el.textContent ?? ''];
          const mo = new MutationObserver(() => texts.push(el.textContent ?? ''));
          mo.observe(el, { childList: true, characterData: true, subtree: true });
          setTimeout(() => {
            mo.disconnect();
            resolve(texts);
          }, 1000);
        })
    );
    expect(new Set(seen).size).toBe(1);
    await expect(page.locator('.position')).toContainText('COUNT IN 2/4', { timeout: 5000 });
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(live).toHaveText('Paused on count-in click 2 of 4');
  });

  test.describe('pt-BR', () => {
    test.use({ locale: 'pt-BR' });
    test('2.13: switch and status line', async ({ page }) => {
      await page.goto('/metronome');
      await expect(page.getByRole('switch', { name: 'Contagem' })).toBeVisible();
      await page.getByRole('button', { name: 'Iniciar treino' }).click();
      await expect(page.locator('.position')).toContainText('CONTAGEM 1/4');
    });
  });

  test.describe('es', () => {
    test.use({ locale: 'es-ES' });
    test('2.13: switch and status line', async ({ page }) => {
      await page.goto('/metronome');
      await expect(page.getByRole('switch', { name: 'Cuenta previa' })).toBeVisible();
      await page.getByRole('button', { name: /^Iniciar/ }).click();
      await expect(page.locator('.position')).toContainText('CUENTA 1/4');
    });
  });

  const noScroll = (page: Page) =>
    page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    );

  for (const theme of ['light', 'dark', 'more contrast', 'forced colours'] as const) {
    test(`2.14: 320 px and 200 % text zoom, ${theme}`, async ({ page }) => {
      await page.emulateMedia({
        colorScheme: theme === 'dark' ? 'dark' : 'light',
        contrast: theme === 'more contrast' ? 'more' : 'no-preference',
        forcedColors: theme === 'forced colours' ? 'active' : 'none'
      });
      await page.setViewportSize({ width: 320, height: 700 });
      await page.goto('/metronome');
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });
      const sw = page.getByRole('switch', { name: 'Count In' });
      await expect(sw).toBeVisible();
      await page.getByRole('slider', { name: 'Initial Count In' }).fill('8');
      await expect(page.getByRole('slider', { name: 'Initial Count In' })).toBeVisible();
      await expect(page.getByRole('slider', { name: 'Repeat Count In' })).toBeVisible();
      expect(await noScroll(page)).toBe(true);
      for (const el of [sw, page.getByRole('slider', { name: 'Initial Count In' })]) {
        const box = await el.boundingBox();
        if (!box) throw new Error('no bounding box');
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(320);
      }
      await start(page).click();
      await expect(page.locator('.position')).toContainText('COUNT IN 1/8');
      await expect(page.locator('.position')).toContainText('COUNT IN 8/8', { timeout: 12_000 });
      expect(await noScroll(page)).toBe(true);
      const box = await page.locator('.position').boundingBox();
      if (!box) throw new Error('no bounding box');
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(320);
    });
  }
});
