import { expect, test, type Page } from '@playwright/test';

import { readAudioLog } from './support/helpers';

async function clicks(page: Page) {
  return (await readAudioLog(page)).flatMap((e) => (e.type === 'click' ? [e] : []));
}

const start = (page: Page) => page.getByRole('button', { name: 'Start Training' });
const select = (page: Page) => page.getByRole('combobox', { name: 'Loop 1' });

test.describe('metronome subdivisions: hear them (US1)', () => {
  test('US1-1: default places two soft clicks at +1/3 and +2/3 of each beat', async ({ page }) => {
    await page.goto('/metronome');
    await start(page).click();
    await expect.poll(async () => (await clicks(page)).length).toBeGreaterThanOrEqual(12);
    const log = await clicks(page);
    const period = 60 / 85;
    for (let slot = 0; slot < 4; slot++) {
      const group = log.filter((c) => c.slot === slot);
      expect(group.map((c) => c.kind)).toEqual([
        slot % 4 === 0 ? 'accent' : 'normal',
        'sub',
        'sub'
      ]);
      const base = group[0].when;
      expect(Math.abs(group[1].when - base - period / 3)).toBeLessThan(0.002);
      expect(Math.abs(group[2].when - base - (2 * period) / 3)).toBeLessThan(0.002);
    }
    await expect(page.locator('.position')).toHaveText(/BEAT [1-4]\/4 · SUB 3/);
  });

  test('US1-2: Quarter notes plays no sub clicks and reads SUB 1', async ({ page }) => {
    await page.goto('/metronome');
    await select(page).selectOption('1');
    await start(page).click();
    await expect.poll(async () => (await clicks(page)).length).toBeGreaterThanOrEqual(4);
    expect((await clicks(page)).filter((c) => c.kind === 'sub')).toHaveLength(0);
    await expect(page.locator('.position')).toHaveText(/BEAT [1-4]\/4 · SUB 1/);
  });

  test('US1-3: with 2 beats the status reaches BEAT 2/2 · SUB 3 and shows two dots', async ({
    page
  }) => {
    await page.goto('/metronome');
    await page.getByRole('slider', { name: '# of Beats' }).fill('2');
    await start(page).click();
    await expect(page.locator('.dot')).toHaveCount(2);
    await expect(page.locator('.position')).toHaveText('BEAT 2/2 · SUB 3', { timeout: 5000 });
  });

  test('US1-4: the lit dot changes once per slot, not per sub click', async ({ page }) => {
    await page.goto('/metronome');
    await start(page).click();
    const changes: string[] = [];
    let last = '';
    await expect
      .poll(
        async () => {
          const lit = await page.locator('.dot[data-state="lit"]').count();
          const idx = lit
            ? String(
                await page
                  .locator('.dot')
                  .evaluateAll((d) => d.findIndex((e) => e.getAttribute('data-state') === 'lit'))
              )
            : '';
          if (idx !== last) {
            changes.push(idx);
            last = idx;
          }
          return changes.length;
        },
        { timeout: 10_000, intervals: [20] }
      )
      .toBeGreaterThanOrEqual(4);
    // Consecutive lit dots advance by exactly one beat (wrapping), never faster.
    const lits = changes.filter((c) => c !== '').map(Number);
    for (let i = 1; i < lits.length; i++) expect(lits[i]).toBe((lits[i - 1] + 1) % 4);
  });
});

test.describe('metronome subdivisions: dropdown (US2)', () => {
  for (let n = 1; n <= 8; n++) {
    test(`US2-5: option ${n} reads SUB ${n} and plays ${n - 1} sub clicks per slot`, async ({
      page
    }) => {
      await page.goto('/metronome');
      await select(page).selectOption(String(n));
      await start(page).click();
      await expect(page.locator('.position')).toHaveText(new RegExp(`SUB ${n}$`));
      await expect.poll(async () => (await clicks(page)).length).toBeGreaterThanOrEqual(n * 2 + 1);
      const log = await clicks(page);
      const complete = log.filter((c) => c.slot === 0);
      expect(complete.filter((c) => c.kind === 'sub')).toHaveLength(n - 1);
    });
  }

  test('US2-6: keyboard only chooses an option without starting', async ({ page }) => {
    await page.goto('/metronome');
    await select(page).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    await page.keyboard.press('Enter');
    await expect(select(page)).toHaveValue('4');
    await expect(page.getByRole('region', { name: 'Ratios Training' })).toHaveAttribute(
      'data-phase',
      'settings'
    );
  });

  test('US2-9: Reset keeps the choice; leaving and returning restores 8th Triplets', async ({
    page
  }) => {
    await page.goto('/metronome');
    await select(page).selectOption('6');
    await start(page).click();
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(select(page)).toHaveValue('6');
    await page.goto('/');
    await page.goto('/metronome');
    await expect(select(page)).toHaveValue('3');
  });

  test.describe('pt-BR', () => {
    test.use({ locale: 'pt-BR' });
    test('US2-10: label and status are translated', async ({ page }) => {
      await page.goto('/metronome');
      await expect(page.getByRole('combobox', { name: 'Loop 1' })).toBeVisible();
      await page.getByRole('slider', { name: 'Nº de tempos' }).fill('2');
      await page.getByRole('button', { name: 'Iniciar treino' }).click();
      await expect(page.locator('.position')).toHaveText('TEMPO 2/2 · SUB 3', { timeout: 5000 });
    });

    test('US2-11: no horizontal scroll at 320 px', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto('/metronome');
      const box = await page.getByRole('combobox', { name: 'Loop 1' }).boundingBox();
      if (!box) throw new Error('combobox has no bounding box');
      expect(box.x + box.width).toBeLessThanOrEqual(320);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
      ).toBe(true);
      await page.getByRole('button', { name: 'Iniciar treino' }).click();
      await expect(page.locator('.position')).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
      ).toBe(true);
    });
  });

  test.describe('es', () => {
    test.use({ locale: 'es-ES' });
    test('US2-10: Bucle 1 and TIEMPO … SUB 3', async ({ page }) => {
      await page.goto('/metronome');
      await expect(page.getByRole('combobox', { name: 'Bucle 1' })).toBeVisible();
      await page.getByRole('slider', { name: /tiempos/i }).fill('2');
      await page.getByRole('button', { name: /^Iniciar/ }).click();
      await expect(page.locator('.position')).toHaveText('TIEMPO 2/2 · SUB 3', { timeout: 5000 });
    });
  });
});

test.describe('metronome subdivisions: exact at high speed (US3)', () => {
  test('US3-7: 300 BPM × 32nds keeps 25 ms ± 2 ms between clicks, none duplicated', async ({
    page
  }) => {
    await page.goto('/metronome');
    await page.getByRole('slider', { name: 'BPM' }).focus();
    await page.keyboard.press('End');
    await select(page).selectOption('8');
    await start(page).click();
    await expect
      .poll(async () => (await clicks(page)).length, { timeout: 10_000 })
      .toBeGreaterThan(80);
    const log = await clicks(page);
    const keys = log.map((c) => `${c.run}:${c.index}`);
    expect(new Set(keys).size).toBe(keys.length);
    const whens = log.map((c) => c.when).sort((a, b) => a - b);
    for (let i = 1; i < whens.length; i++) {
      expect(Math.abs(whens[i] - whens[i - 1] - 0.025)).toBeLessThan(0.002);
    }
  });

  test('US3-8: Pause cancels pending soft clicks; Resume starts on the next beat', async ({
    page
  }) => {
    await page.goto('/metronome');
    await page.getByRole('slider', { name: 'BPM' }).focus();
    await page.keyboard.press('Home');
    await select(page).selectOption('8');
    await start(page).click();
    await expect.poll(async () => (await clicks(page)).length).toBeGreaterThanOrEqual(4);
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByRole('region', { name: 'Ratios Training' })).toHaveAttribute(
      'data-phase',
      'paused'
    );
    const cancels = (await readAudioLog(page)).flatMap((e) =>
      e.type === 'click-cancel' ? [e] : []
    );
    expect(cancels.length).toBeGreaterThan(0);
    expect(cancels.at(-1)?.count).toBeGreaterThan(0);
    const frozen = (await clicks(page)).length;
    await page.waitForTimeout(800);
    expect((await clicks(page)).length).toBe(frozen);

    await page.getByRole('button', { name: 'Resume' }).click();
    await expect.poll(async () => (await clicks(page)).length).toBeGreaterThan(frozen + 2);
    const fresh = (await clicks(page)).slice(frozen);
    expect(['normal', 'accent']).toContain(fresh[0].kind);
    expect(fresh[0].when - fresh[0].contextTime).toBeLessThanOrEqual(0.05);
    expect(fresh[1].kind).toBe('sub');
  });

  test('US3-8b: rapid Start/Pause/Resume/Space presses never double the stream', async ({
    page
  }) => {
    await page.goto('/metronome');
    await start(page).click();
    const main = page.getByRole('button', { name: /^(Pause|Resume)$/ });
    for (let i = 0; i < 4; i++) {
      await main.click();
      await page.keyboard.press('Space');
    }
    await page.waitForTimeout(2000);
    const live = (await clicks(page)).filter((c) => c.when > 0);
    const last = live.at(-1)?.run;
    const whens = live
      .filter((c) => c.run === last)
      .map((c) => c.when)
      .sort((a, b) => a - b);
    const keys = live.map((c) => `${c.run}:${c.index}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (let i = 1; i < whens.length; i++) expect(whens[i] - whens[i - 1]).toBeGreaterThan(0.1);
  });
});
