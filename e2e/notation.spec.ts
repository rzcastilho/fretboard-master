import { expect, test, type Page } from '@playwright/test';

import { runAxe } from './support/helpers';

const PREFS_KEY = 'fretboard-master:prefs';

const selector = (page: Page) =>
  page.getByRole('group', { name: /^(Choose notes|Elige las notas|Escolha as notas)$/ });
const languageButton = (page: Page) =>
  page.getByRole('button', { name: /^(Language|Idioma)$/, exact: false }).first();
const panel = (page: Page) => page.locator('div[role="region"][id^="language-panel-"]');

async function openPanel(page: Page): Promise<void> {
  await languageButton(page).click();
  await expect(panel(page)).toBeVisible();
}

async function storedPrefs(page: Page): Promise<Record<string, unknown>> {
  const raw = await page.evaluate((k) => localStorage.getItem(k), PREFS_KEY);
  return raw ? JSON.parse(raw) : {};
}

/** The e2e projects pin `locale: 'en-US'`: Spanish comes from the stored language. */
async function storeLanguage(page: Page, language: string, extra = {}): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      if (localStorage.getItem(key as string) === null) {
        localStorage.setItem(key as string, value as string);
      }
    },
    [
      PREFS_KEY,
      JSON.stringify({
        version: 1,
        tuning: 'AF-1',
        frets: 22,
        muted: false,
        volume: 0.8,
        labels: { notes: 'name', triads: 'interval' },
        language,
        ...extra
      })
    ]
  );
}

const SOLFEGE = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'];

test.describe('US1: choose how note names are written', () => {
  test('US1-1 / SC-001: Spanish with no stored notation reads Do Re Mi Fa Sol La Si', async ({
    page
  }) => {
    await storeLanguage(page, 'es');
    await page.goto('/notes');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    for (const name of SOLFEGE) {
      await expect(selector(page).getByRole('button', { name, exact: true })).toBeVisible();
    }
    const labels = await page.locator('.marker text.marker-label').allTextContents();
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((l) => SOLFEGE.includes(l))).toBe(true);
    expect((await storedPrefs(page)).notation).toBeUndefined();
    await runAxe(page);
  });

  test('US1-2 / US1-3: switching in the panel changes every name, English included', async ({
    page
  }) => {
    await page.goto('/notes');
    await expect(selector(page).getByRole('button', { name: 'C', exact: true })).toBeVisible();
    await openPanel(page);
    await panel(page).getByRole('radio', { name: 'Solfège' }).check();
    await expect(selector(page).getByRole('button', { name: 'Do', exact: true })).toBeVisible();
    await expect(selector(page).getByRole('button', { name: 'C', exact: true })).toHaveCount(0);
    const labels = await page.locator('.marker text.marker-label').allTextContents();
    expect(labels.every((l) => SOLFEGE.includes(l))).toBe(true);
    await panel(page).getByRole('radio', { name: 'Letters' }).check();
    await expect(selector(page).getByRole('button', { name: 'C', exact: true })).toBeVisible();
    await runAxe(page);
  });

  test('US1-4: an explicit choice survives a language change and a reload', async ({ page }) => {
    await page.goto('/notes');
    await openPanel(page);
    await panel(page).getByRole('radio', { name: 'Solfège' }).check();
    expect((await storedPrefs(page)).notation).toBe('solfege');
    await panel(page).getByRole('radio', { name: 'Português' }).check();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(selector(page).getByRole('button', { name: 'Dó', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(selector(page).getByRole('button', { name: 'Dó', exact: true })).toBeVisible();
  });

  test('US1-5: an explicit letters choice survives switching to Spanish', async ({ page }) => {
    await page.goto('/notes');
    await openPanel(page);
    // English already shows letters, so an explicit pick needs a real change first.
    await panel(page).getByRole('radio', { name: 'Solfège' }).check();
    await panel(page).getByRole('radio', { name: 'Letters' }).check();
    expect((await storedPrefs(page)).notation).toBe('letters');
    await panel(page).getByRole('radio', { name: 'Español' }).check();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(selector(page).getByRole('button', { name: 'C', exact: true })).toBeVisible();
    await expect(selector(page).getByRole('button', { name: 'Do', exact: true })).toHaveCount(0);
  });
});

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const toggle = (page: Page) =>
  page.getByRole('banner').getByRole('group', { name: /^(Note names|Nombres de notas)$/ });

/** Visible note-name markers on the fretboard, whatever the tool. */
async function markerLabels(page: Page): Promise<string[]> {
  return page.locator('.marker text.marker-label').allTextContents();
}

test.describe('US2: switch notation from anywhere, instantly', () => {
  for (const tool of ['notes', 'triads', 'caged']) {
    test(`toggle reaches every surface on ${tool}`, async ({ page }) => {
      await storeLanguage(page, 'en', { tuning: 'AF-4' });
      await page.goto(`/${tool}`);
      // A document reload would drop this marker; same-document history updates keep it.
      await expect(toggle(page)).toBeVisible();
      await page.evaluate(() => {
        (window as unknown as { __noReload: boolean }).__noReload = true;
      });
      const heading = await page.getByRole('heading', { level: 1 }).textContent();

      await toggle(page).getByRole('button', { name: 'Do Re Mi' }).click();
      await expect(toggle(page).getByRole('button', { name: 'Do Re Mi' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      await expect(toggle(page).getByRole('button', { name: 'Do Re Mi' })).toBeFocused();
      await expect(page.getByRole('button', { name: /^Tuning: Drop Re/ })).toBeVisible();
      if (tool !== 'caged') {
        const labels = await markerLabels(page);
        expect(labels.some((l) => LETTERS.includes(l))).toBe(false);
      }
      expect(await page.getByRole('heading', { level: 1 }).textContent()).toBe(heading);
      expect(
        await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)
      ).toBe(true);

      await toggle(page).getByRole('button', { name: 'C D E' }).click();
      await expect(page.getByRole('button', { name: /^Tuning: Drop D\b/ })).toBeVisible();
    });
  }

  test('one shared state: toggle and panel agree', async ({ page }) => {
    await page.goto('/notes');
    await toggle(page).getByRole('button', { name: 'Do Re Mi' }).click();
    await openPanel(page);
    await expect(panel(page).getByRole('radio', { name: 'Solfège' })).toBeChecked();
    await panel(page).getByRole('radio', { name: 'Letters' }).check();
    await expect(toggle(page).getByRole('button', { name: 'C D E' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  test('solfège everywhere: tuning, selector, composition, live regions', async ({ page }) => {
    await storeLanguage(page, 'en', { tuning: 'AF-4', notation: 'solfege' });
    await page.goto('/triads');
    await expect(page.getByRole('button', { name: /^Tuning: Drop Re/ })).toBeVisible();
    // The live region stays silent until a change; the panel text is always current.
    const text = (await page.locator('.description').allTextContents()).join(' ');
    expect(text).not.toMatch(/\b[A-G] (major|minor|diminished|augmented)\b/);
    await page.goto('/notes');
    for (const name of SOLFEGE) {
      await expect(selector(page).getByRole('button', { name, exact: true })).toBeVisible();
    }
  });

  test('persistence: reload remembers; a corrupt stored value falls back to defaults', async ({
    page
  }) => {
    await page.goto('/notes');
    await toggle(page).getByRole('button', { name: 'Do Re Mi' }).click();
    await page.reload();
    await expect(toggle(page).getByRole('button', { name: 'Do Re Mi' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    await page.evaluate((key) => {
      const raw = JSON.parse(localStorage.getItem(key) ?? '{}');
      localStorage.setItem(key, JSON.stringify({ ...raw, notation: 'klingon', accidentals: 7 }));
    }, PREFS_KEY);
    await page.reload();
    await expect(toggle(page).getByRole('button', { name: 'C D E' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(errors.filter((e) => /hydrat/i.test(e))).toEqual([]);
  });
});

test.describe('US3: sharps, flats, or both for single notes', () => {
  const triadRoot = (page: Page) => page.getByRole('group', { name: 'Root' });

  test('flats in notes, theory in triads (US3-1, US3-2, SC-003)', async ({ page }) => {
    await storeLanguage(page, 'en', { accidentals: 'flats' });
    await page.goto('/notes');
    // Preferred spelling first in the selector: D♭ / C♯.
    const key = selector(page).getByRole('button', { name: 'D flat or C sharp' });
    await expect(key).toHaveText('D♭ / C♯');
    await key.click();
    // Naturals stay drawn as the background; only the altered note changes.
    const altered = (await markerLabels(page)).filter((l) => /[♯♭]/.test(l));
    expect(altered.length).toBeGreaterThan(0);
    expect(altered.every((l) => l === 'D♭')).toBe(true);
    expect((await page.locator('.description').allTextContents()).join(' ')).not.toContain(
      'C sharp'
    );

    // Triads keep theory spelling: A major is A, C♯, E under flats.
    await page.goto('/triads');
    await triadRoot(page).getByRole('button', { name: 'A', exact: true }).click();
    // The root selector lists pairs (preferred first); the board and descriptions keep theory.
    const described = (await page.locator('.description').allTextContents()).join(' ');
    expect(described).toContain('C sharp');
    expect(described).not.toContain('D flat');
    await expect(
      page.getByRole('gridcell', { name: /^C sharp, string 2, fret 2, third/ })
    ).toBeVisible();
    await expect(page.getByRole('gridcell', { name: /flat/ })).toHaveCount(0);
  });

  test('both spellings (US3-3): markers and the card show both', async ({ page }) => {
    await storeLanguage(page, 'en', { accidentals: 'both' });
    await page.goto('/notes');
    await selector(page).getByRole('button', { name: 'C sharp or D flat' }).click();
    const altered = (await markerLabels(page)).filter((l) => /[♯♭]/.test(l));
    expect(altered.length).toBeGreaterThan(0);
    expect(altered.every((l) => l.includes('C♯') && l.includes('D♭'))).toBe(true);
    const description = (await page.locator('.description').allTextContents()).join(' ');
    expect(description).toContain('C sharp or D flat');
  });

  for (const accidentals of ['sharps', 'flats', 'both']) {
    test(`string names (US3-4): Half step down keeps E♭ under ${accidentals}`, async ({ page }) => {
      await storeLanguage(page, 'en', { tuning: 'AF-2', accidentals });
      await page.goto('/notes');
      await expect(page.locator('.string-label').last()).toHaveText('6 E♭');
    });
  }

  test('string names (US3-5): a custom altered string follows the accidental policy', async ({
    page,
    context
  }) => {
    const seed = (accidentals: string) =>
      context.addInitScript(
        ([key, value]) => localStorage.setItem(key as string, value as string),
        [
          PREFS_KEY,
          JSON.stringify({
            version: 1,
            tuning: 'AF-1',
            customTuning: [-1, 0, 0, 0, 0, 0],
            accidentals
          })
        ]
      );
    await seed('sharps');
    await page.goto('/notes');
    await expect(page.locator('.string-label').last()).toHaveText('6 D♯');
    await openPanel(page);
    await panel(page).getByRole('radio', { name: 'Flats' }).check();
    await expect(page.locator('.string-label').last()).toHaveText('6 E♭');
  });
});

test.describe('US4: real accidental symbols, legible and spoken in full', () => {
  const ASCII_FLAT = /\b([A-G]|Do|Dó|Re|Ré|Mi|Fa|Fá|Sol|La|Lá|Si)b\b/;
  const LANGS = ['en', 'pt-BR', 'es'] as const;
  const NOTATIONS = ['letters', 'solfege'] as const;
  const POLICIES = ['sharps', 'flats', 'both'] as const;

  for (const language of LANGS) {
    for (const notation of NOTATIONS) {
      for (const accidentals of POLICIES) {
        test(`no ascii accidentals: ${language} / ${notation} / ${accidentals}`, async ({
          page
        }) => {
          await storeLanguage(page, language, { notation, accidentals });
          for (const path of ['/notes', '/triads', '/caged']) {
            await page.goto(path);
            await page.waitForLoadState('networkidle');
            const { text, aria } = await page.evaluate(() => ({
              text: document.body.innerText,
              aria: [...document.querySelectorAll('[aria-label]')]
                .map((el) => el.getAttribute('aria-label'))
                .join('\n')
            }));
            for (const haystack of [text, aria]) {
              expect(haystack, path).not.toContain('#');
              expect(haystack, path).not.toMatch(ASCII_FLAT);
            }
          }
        });
      }
    }
  }

  test('label fit (US4-2): long labels shrink, never overflow the marker', async ({ page }) => {
    await storeLanguage(page, 'es', { accidentals: 'both' });
    await page.goto('/notes');
    await selector(page)
      .getByRole('button', { name: /sostenido o Sol bemol|Fa sostenido/ })
      .click();
    const labels = page.locator('.marker text.marker-label');
    expect(await labels.count()).toBeGreaterThan(0);
    for (const label of await labels.all()) {
      const text = (await label.textContent()) ?? '';
      const stacked = (await label.locator('tspan').count()) === 2;
      if (stacked || Array.from(text).length > 3) {
        await expect(label).toHaveClass(/\bmin\b/);
      }
      expect(await label.getAttribute('aria-hidden')).toBe('true');
      const box = await label.boundingBox();
      const marker = await label
        .locator('xpath=ancestor::*[contains(@class,"marker")][1]')
        .boundingBox();
      if (box && marker) {
        expect(box.width).toBeLessThanOrEqual(marker.width + 1);
        expect(box.height).toBeLessThanOrEqual(marker.height + 1);
      }
    }
  });

  test('spoken names (US4-3, US4-4, SC-005): full names, preferred first', async ({ page }) => {
    await storeLanguage(page, 'es', { accidentals: 'both' });
    await page.goto('/notes');
    await selector(page).getByRole('button', { name: 'Do sostenido o Re bemol' }).click();
    const spoken = (await page.locator('.description').allTextContents()).join(' ');
    expect(spoken).toContain('Do sostenido o Re bemol');
    await expect(
      page.getByRole('gridcell', { name: /^Do sostenido o Re bemol, cuerda/ }).first()
    ).toBeVisible();
  });

  test('accidental glyphs: ♯ ♭ sit at letter weight and baseline', async ({ page }) => {
    await storeLanguage(page, 'es', { notation: 'solfege', accidentals: 'sharps' });
    await page.goto('/notes');
    await selector(page).getByRole('button', { name: 'Sol sostenido' }).click();
    const marker = page
      .locator('.marker')
      .filter({ has: page.locator('text.marker-label', { hasText: 'Sol♯' }) })
      .first();
    await marker.scrollIntoViewIfNeeded();
    await expect(marker).toBeVisible();
    await expect(marker).toHaveScreenshot('accidental-glyphs.png', { animations: 'disabled' });
  });
});
