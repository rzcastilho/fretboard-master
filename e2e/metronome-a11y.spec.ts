import { expect, test, type Page } from '@playwright/test';

import { countInOff, ratioOff, runAxe } from './support/helpers';

// The card (data-phase, data-mode) wraps the tab bar and the tabpanel.
const card = (page: Page) => page.locator('section.panel');
const live = (page: Page) => page.locator('.panel [role="status"][aria-live="polite"].sr-only');

async function toPaused(page: Page): Promise<void> {
  await countInOff(page);
  await page.getByRole('button', { name: 'Start Training' }).click();
  await expect(card(page)).toHaveAttribute('data-phase', 'running');
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(card(page)).toHaveAttribute('data-phase', 'paused');
}

test.describe('metronome a11y: axe (SC-008)', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`settings, running and paused are axe-clean in ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('/metronome');
      await runAxe(page);
      await countInOff(page);
      await page.getByRole('button', { name: 'Start Training' }).click();
      await expect(card(page)).toHaveAttribute('data-phase', 'running');
      await runAxe(page);
      await page.getByRole('button', { name: 'Pause' }).click();
      await expect(card(page)).toHaveAttribute('data-phase', 'paused');
      await runAxe(page);
    });
  }
});

test.describe('metronome a11y: subdivision select (032)', () => {
  test('settings view with the select is axe-clean', async ({ page }) => {
    await page.goto('/metronome');
    await expect(page.getByRole('combobox', { name: 'Loop 1' })).toBeVisible();
    await runAxe(page);
  });

  test('settings view is axe-clean in forced colours', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/metronome');
    await expect(page.getByRole('combobox', { name: 'Loop 1' })).toBeVisible();
    await runAxe(page);
  });

  test('settings and running views are axe-clean with more contrast', async ({ page }) => {
    await page.emulateMedia({ contrast: 'more' });
    await page.goto('/metronome');
    await runAxe(page);
    await page.getByRole('button', { name: 'Start Training' }).click();
    await expect(card(page)).toHaveAttribute('data-phase', 'running');
    await runAxe(page);
  });
});

test.describe('metronome a11y: keyboard only (SC-007)', () => {
  test('start, pause, resume and reset without a pointer', async ({ page }) => {
    await page.goto('/metronome');
    const start = page.getByRole('button', { name: 'Start Training' });
    await start.focus();
    await page.keyboard.press('Enter');
    await expect(card(page)).toHaveAttribute('data-phase', 'running');
    // Focus stays inside the panel, on the main button, which now reads Pause.
    const main = page.getByRole('button', { name: 'Pause' });
    await expect(main).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(card(page)).toHaveAttribute('data-phase', 'paused');
    await expect(page.getByRole('button', { name: 'Resume' })).toBeFocused();
    await page.keyboard.press('Space');
    await expect(card(page)).toHaveAttribute('data-phase', 'running');
    await page.keyboard.press('Space');
    await expect(card(page)).toHaveAttribute('data-phase', 'paused');
    const reset = page.getByRole('button', { name: 'Reset' });
    await reset.focus();
    await page.keyboard.press('Enter');
    await expect(card(page)).toHaveAttribute('data-phase', 'settings');
    await expect(page.getByRole('button', { name: 'Start Training' })).toBeFocused();
  });

  test('every control is reachable with Tab', async ({ page }) => {
    await page.goto('/metronome');
    const wanted = new Set(['Start Training']);
    const seen = new Set<string>();
    for (let i = 0; i < 40 && seen.size < wanted.size; i++) {
      await page.keyboard.press('Tab');
      const name = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return el?.getAttribute('aria-label') ?? el?.textContent?.trim() ?? '';
      });
      if (wanted.has(name)) seen.add(name);
    }
    expect([...seen]).toEqual(['Start Training']);
  });
});

test.describe('metronome a11y: live region', () => {
  test('holds only run-state announcements, never a per-beat update', async ({ page }) => {
    await page.goto('/metronome');
    await countInOff(page);
    await ratioOff(page);
    await page.getByRole('button', { name: 'Start Training' }).click();
    await expect(card(page)).toHaveAttribute('data-phase', 'running');
    await expect(live(page)).toHaveText(/^Started, 85 BPM, 4 beats, 8th Triplets$/);
    // Observe the region across several beats: its text must not change.
    const seen = await page.evaluate(
      () =>
        new Promise<string[]>((resolve) => {
          const el = document.querySelector(
            '.panel [role="status"][aria-live="polite"].sr-only'
          ) as HTMLElement;
          const texts = [el.textContent ?? ''];
          const mo = new MutationObserver(() => texts.push(el.textContent ?? ''));
          mo.observe(el, { childList: true, characterData: true, subtree: true });
          setTimeout(() => {
            mo.disconnect();
            resolve(texts);
          }, 2500);
        })
    );
    expect(new Set(seen).size).toBe(1);
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(live(page)).toHaveText(/^Paused on beat \d of 4$/);
    await page.getByRole('button', { name: 'Resume' }).click();
    await expect(live(page)).toHaveText('Resumed');
    // The dots are decorative.
    await expect(page.locator('.dots')).toHaveAttribute('aria-hidden', 'true');
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(live(page)).toHaveText('Reset');
  });
});

test.describe('metronome a11y: languages (US4-2)', () => {
  test.describe('pt-BR', () => {
    test.use({ locale: 'pt-BR' });
    test('labels and the status line are translated', async ({ page }) => {
      await page.goto('/metronome');
      await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
      await expect(page.getByRole('heading', { level: 1, name: 'Metrônomo' })).toBeVisible();
      await expect(page.getByRole('slider', { name: 'Nº de tempos' })).toBeVisible();
      await page.getByRole('switch', { name: 'Contagem' }).click();
      await page.getByRole('button', { name: 'Iniciar treino' }).click();
      await expect(page.locator('.position')).toHaveText(/TEMPO [1-4–]\/4/);
      await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Reiniciar' })).toBeVisible();
    });
  });

  test.describe('es', () => {
    test.use({ locale: 'es-ES' });
    test('labels and the status line are translated', async ({ page }) => {
      await page.goto('/metronome');
      await expect(page.locator('html')).toHaveAttribute('lang', 'es');
      await expect(page.getByRole('heading', { level: 1, name: 'Metrónomo' })).toBeVisible();
      await page.getByRole('switch', { name: 'Cuenta previa' }).click();
      await page.getByRole('button', { name: /^Iniciar(?! temporizador)/ }).click();
      await expect(page.locator('.position')).not.toHaveText(/BEAT/);
      await expect(page.locator('.position')).toHaveText(/\d\/4|–\/4/);
    });
  });
});

test.describe('metronome a11y: contrast, forced colours and motion', () => {
  test('forced colours: controls stay visible and axe is clean', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/metronome');
    await expect(page.getByRole('button', { name: 'Start Training' })).toBeVisible();
    await toPaused(page);
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
    await runAxe(page);
  });

  test('more contrast: running view is axe-clean', async ({ page }) => {
    await page.emulateMedia({ contrast: 'more' });
    await page.goto('/metronome');
    await toPaused(page);
    await runAxe(page);
  });

  test('reduced motion: the dots have no transition', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/metronome');
    await countInOff(page);
    await page.getByRole('button', { name: 'Start Training' }).click();
    await expect(card(page)).toHaveAttribute('data-phase', 'running');
    const durations = await page
      .locator('.dot')
      .evaluateAll((els) => els.map((e) => getComputedStyle(e).transitionDuration));
    expect(durations).toHaveLength(4);
    for (const d of durations) expect(parseFloat(d)).toBe(0);
  });
});

test.describe('metronome a11y: count-in axe (033)', () => {
  const modes = [
    { name: 'light', media: { colorScheme: 'light' as const } },
    { name: 'dark', media: { colorScheme: 'dark' as const } },
    { name: 'more contrast', media: { contrast: 'more' as const } },
    { name: 'forced colours', media: { forcedColors: 'active' as const } }
  ];
  for (const { name, media } of modes) {
    test(`settings (switch on and off) and the count-in running view are axe-clean in ${name}`, async ({
      page
    }) => {
      await page.emulateMedia(media);
      await page.goto('/metronome');
      const sw = page.getByRole('switch', { name: 'Count In' });
      await expect(sw).toHaveAttribute('aria-checked', 'true');
      await runAxe(page);
      await sw.click();
      await expect(sw).toHaveAttribute('aria-checked', 'false');
      await runAxe(page);
      await sw.click();
      await page.getByRole('button', { name: 'Start Training' }).click();
      await expect(page.locator('.position')).toContainText('COUNT IN');
      await runAxe(page);
    });
  }
});

test.describe('metronome a11y: alternating ratios axe (034)', () => {
  const modes = [
    { name: 'light', media: { colorScheme: 'light' as const } },
    { name: 'dark', media: { colorScheme: 'dark' as const } },
    { name: 'more contrast', media: { contrast: 'more' as const } },
    { name: 'forced colours', media: { forcedColors: 'active' as const } }
  ];
  for (const { name, media } of modes) {
    test(`settings (section on and off), a running loop and a repeat count-in are axe-clean in ${name}`, async ({
      page
    }) => {
      test.setTimeout(60_000);
      await page.emulateMedia(media);
      await page.goto('/metronome');
      const sw = page.getByRole('switch', { name: 'Subdivision ratio' });
      await expect(sw).toHaveAttribute('aria-checked', 'true');
      await runAxe(page);
      await sw.click();
      await expect(sw).toHaveAttribute('aria-checked', 'false');
      await runAxe(page);
      await sw.click();
      await page.getByRole('slider', { name: 'Initial Count In' }).fill('0');
      await page.getByRole('slider', { name: 'BPM' }).fill('300');
      await page.getByRole('button', { name: 'Start Training' }).click();
      await expect(page.locator('.position')).toContainText('BEAT');
      await runAxe(page);
      await expect(page.locator('.position')).toContainText('COUNT IN', { timeout: 15_000 });
      await runAxe(page);
    });
  }
});
