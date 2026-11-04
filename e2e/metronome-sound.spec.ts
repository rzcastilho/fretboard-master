import { expect, test, type Page } from '@playwright/test';

import { countInOff, readAudioLog, runAxe } from './support/helpers';

const KEY = 'fretboard-master:prefs';
const soundSelect = (page: Page) => page.locator('#metronome-sound');
const start = (page: Page) => page.getByRole('button', { name: 'Start Training' });
const stored = (page: Page) => page.evaluate((k) => localStorage.getItem(k), KEY);

async function clicks(page: Page) {
  return (await readAudioLog(page)).flatMap((e) => (e.type === 'click' ? [e] : []));
}
async function previews(page: Page) {
  return (await readAudioLog(page)).flatMap((e) => (e.type === 'click-preview' ? [e] : []));
}

test.describe('click sound: the select (US3-1)', () => {
  test('lists the five sounds in English with Click selected', async ({ page }) => {
    await page.goto('/metronome');
    const select = soundSelect(page);
    await expect(page.getByLabel('Click sound')).toHaveCount(1);
    await expect(select.locator('option')).toHaveText([
      'Click',
      'Wood block',
      'Beep',
      'Rim',
      'Cowbell'
    ]);
    await expect(select).toHaveValue('click');
  });

  test.describe('es', () => {
    test.use({ locale: 'es-ES' });
    test('names are translated', async ({ page }) => {
      await page.goto('/metronome');
      await expect(page.getByLabel('Sonido del clic')).toHaveCount(1);
      await expect(soundSelect(page).locator('option')).toHaveText([
        'Clic',
        'Bloque de madera',
        'Pitido',
        'Aro',
        'Cencerro'
      ]);
    });
  });

  test.describe('pt-BR', () => {
    test.use({ locale: 'pt-BR' });
    test('names are translated', async ({ page }) => {
      await page.goto('/metronome');
      await expect(page.getByLabel('Som do clique')).toHaveCount(1);
      await expect(soundSelect(page).locator('option')).toHaveText([
        'Clique',
        'Bloco de madeira',
        'Bipe',
        'Aro',
        'Cowbell'
      ]);
    });
  });

  test('axe reports zero violations', async ({ page }) => {
    await page.goto('/metronome');
    await runAxe(page);
  });
});

test.describe('click sound: changing it while running (US3-2, US3-6)', () => {
  test('switches later clicks to rim, on the grid, without a restart', async ({ page }) => {
    await page.goto('/metronome');
    await countInOff(page);
    await start(page).click();
    await expect.poll(async () => (await clicks(page)).length).toBeGreaterThanOrEqual(4);
    await expect(soundSelect(page)).toBeVisible();
    await soundSelect(page).selectOption('rim');
    await expect
      .poll(async () => (await clicks(page)).at(-1)?.sound, { timeout: 5000 })
      .toBe('rim');
    // Within the scheduling horizon plus a beat or two, clicks from the first to the last carry
    // the old sound and then the new one, with no gap in the grid.
    await expect.poll(async () => (await clicks(page)).length).toBeGreaterThanOrEqual(14);
    const log = await clicks(page);
    const first = log.findIndex((c) => c.sound === 'rim');
    expect(first).toBeGreaterThan(0);
    expect(log.slice(0, first).every((c) => c.sound === 'click')).toBe(true);
    expect(log.slice(first).every((c) => c.sound === 'rim')).toBe(true);
    const period = 60 / 85;
    const firsts = log.filter((c) => c.kind !== 'sub');
    for (let i = 1; i < firsts.length; i++) {
      expect(Math.abs(firsts[i].when - firsts[i - 1].when - period)).toBeLessThan(0.003);
    }
    expect(log.map((c) => c.index)).toEqual(log.map((_, i) => i));
    expect((await readAudioLog(page)).filter((e) => e.type === 'click-cancel')).toEqual([]);
    expect(await previews(page)).toEqual([]);
  });
});

test.describe('click sound: preview (US3-3)', () => {
  test('stopped: one accent preview per change', async ({ page }) => {
    await page.goto('/metronome');
    await soundSelect(page).selectOption('wood');
    await expect.poll(async () => (await previews(page)).length).toBe(1);
    const [p] = await previews(page);
    expect(p.sound).toBe('wood');
    expect(await clicks(page)).toEqual([]);
  });

  test('muted: the preview is still requested (the mute gain silences it)', async ({ page }) => {
    await page.goto('/metronome');
    await page.getByRole('button', { name: /Mute sound/ }).click();
    await soundSelect(page).selectOption('beep');
    await expect.poll(async () => (await previews(page)).length).toBe(1);
  });

  test('running: no preview', async ({ page }) => {
    await page.goto('/metronome');
    await countInOff(page);
    await start(page).click();
    await expect.poll(async () => (await clicks(page)).length).toBeGreaterThanOrEqual(2);
    await soundSelect(page).selectOption('cowbell');
    await expect
      .poll(async () => (await clicks(page)).at(-1)?.sound, { timeout: 5000 })
      .toBe('cowbell');
    expect(await previews(page)).toEqual([]);
  });
});

test.describe('click sound: remembered (US3-4, US3-5)', () => {
  test('the choice survives a reload and is stored', async ({ page }) => {
    await page.goto('/metronome');
    await soundSelect(page).selectOption('wood');
    await expect.poll(() => stored(page)).toContain('"sound":"wood"');
    await page.reload();
    await expect(soundSelect(page)).toHaveValue('wood');
  });

  test('an unknown stored sound reads as Click and keeps the other settings', async ({ page }) => {
    await page.addInitScript(
      ([k]) => {
        if (localStorage.getItem(k) === null) {
          localStorage.setItem(
            k,
            '{"version":1,"tuning":"AF-1","frets":22,"metronome":{"mode":"speed","sound":"gong"}}'
          );
        }
      },
      [KEY]
    );
    await page.goto('/metronome');
    await expect(soundSelect(page)).toHaveValue('click');
    await expect(page.locator('section.panel')).toHaveAttribute('data-mode', 'speed');
  });
});

test.describe('click sound: one value for every mode (US3-7)', () => {
  test('a change in Ratios shows in Plain and Speed', async ({ page }) => {
    await page.goto('/metronome');
    await soundSelect(page).selectOption('beep');
    await page.getByRole('tab', { name: 'Metronome', exact: true }).click();
    await expect(page.locator('section.panel')).toHaveAttribute('data-mode', 'plain');
    await expect(soundSelect(page)).toHaveValue('beep');
    await page.getByRole('tab', { name: 'Speed Training' }).click();
    await expect(page.locator('section.panel')).toHaveAttribute('data-mode', 'speed');
    await expect(soundSelect(page)).toHaveValue('beep');
  });
});
